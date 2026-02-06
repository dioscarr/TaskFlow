
import prisma from '@/lib/prisma';
import { exec } from 'child_process';
import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { promisify } from 'util';

export const execAsync = promisify(exec);

export interface ProcessInput {
    name: string;
    type: 'dev-server' | 'background-job' | 'external-tool' | 'docker-app';
    port?: number;
    path: string;
    command: string;
    healthUrl?: string;
    healthCheckType?: 'http' | 'port' | 'process' | 'script';
    healthInterval?: number;
    metadata?: any;
}

export const isDockerProcess = (process: { type?: string; metadata?: any }) => {
    return process?.type === 'docker-app' || !!process?.metadata?.containerName;
};

export const getRepoAppsRoot = () => join(process.cwd(), 'apps');

export const isPortAvailable = async (port: number) => {
    try {
        const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
        return !stdout.includes(`${port}`);
    } catch (error) {
        return true;
    }
};

export const getAvailablePort = async (start = 5000, end = 5999) => {
    for (let port = start; port <= end; port += 1) {
        if (await isPortAvailable(port)) return port;
    }
    throw new Error('No available ports found');
};

/**
 * Get the demo user (same pattern as actions.ts)
 */
export async function getDemoUser() {
    const user = await prisma.user.findUnique({
        where: { email: 'demo@example.com' }
    });
    if (!user) throw new Error('Demo user not found');
    return user;
}

export const getDockerContainerStatus = async (containerName: string) => {
    try {
        const { stdout } = await execAsync(`docker inspect -f "{{.State.Status}}" ${containerName}`);
        const status = stdout.trim();
        if (!status) return 'unknown';
        return status === 'running' ? 'running' : 'stopped';
    } catch (error) {
        return 'unknown';
    }
};

export const parseDockerPort = (ports?: string) => {
    if (!ports) return undefined;

    // Prefer mappings that target common app ports (3000, 80, 5173)
    let match = ports.match(/:(\d+)->\s*3000\/tcp/);
    if (!match) match = ports.match(/:(\d+)->\s*80\/tcp/);
    if (!match) match = ports.match(/:(\d+)->\s*5173\/tcp/);

    // Fallback: match any host port mapping like '0.0.0.0:12345->80/tcp' or ':::12345->80/tcp'
    if (!match) match = ports.match(/:(\d+)->\s*\d+\/tcp/);

    if (!match) return undefined;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : undefined;
};

export const resolveStartScript = (scripts: Record<string, string> | null) => {
    if (!scripts) return null;
    if (scripts.start) return 'start';
    if (scripts.preview) return 'preview';
    if (scripts.dev) return 'dev';
    return null;
};

// global cache to throttle syncs
const lastSync: { [key: string]: number } = {};
const SYNC_COOLDOWN = 120000; // 2 minutes

export const syncDockerAppProcesses = async (userId: string) => {
    const now = Date.now();
    if (lastSync[`docker-${userId}`] && now - lastSync[`docker-${userId}`] < SYNC_COOLDOWN) {
        return; // Skip if synced recently
    }

    try {
        // 1. Fetch all deployments and process registries in one go
        const [deployments, existingProcesses] = await Promise.all([
            prisma.appDeployment.findMany({ where: { userId } }),
            prisma.processRegistry.findMany({ where: { userId, type: 'docker-app' } })
        ]);

        if (!deployments.length && !existingProcesses.length) {
            await discoverGenericContainers(userId, existingProcesses);
            lastSync[`docker-${userId}`] = now;
            return;
        }

        // 2. Fetch all container statuses in ONE docker call
        const { stdout: psOutput } = await execAsync('docker ps -a --format "{{.Names}}|{{.Status}}|{{.Ports}}"');
        const containerInfo = new Map(psOutput.split('\n').filter(Boolean).map(line => {
            const [name, status, ports] = line.trim().split('|');
            return [name, { status: status?.startsWith('Up') ? 'running' as const : 'stopped' as const, ports }];
        }));

        // 3. Sync deployments
        const workspaceFiles = await prisma.workspaceFile.findMany({
            where: { userId, id: { in: deployments.map(d => d.appId) } },
            select: { id: true, name: true }
        });
        const nameByAppId = new Map(workspaceFiles.map(file => [file.id, file.name]));

        for (const deployment of deployments) {
            const appName = nameByAppId.get(deployment.appId) || deployment.appId;
            const processName = `Docker App ${deployment.appId}`;
            const info = deployment.containerName ? containerInfo.get(deployment.containerName) : null;
            const status = info?.status || 'unknown';

            const existing = existingProcesses.find(p => p.name === processName);

            const data = {
                name: processName,
                type: 'docker-app' as const,
                port: deployment.port || undefined,
                path: deployment.appId,
                command: deployment.containerName
                    ? `docker run -d --name ${deployment.containerName} -p ${deployment.port}:3000 ${deployment.imageName}`
                    : 'docker run -d <container>',
                status,
                healthCheckType: 'port' as const,
                healthInterval: 30000,
                // keep startedAt if it was already running
                startedAt: (status === 'running' && existing?.status === 'running') ? existing.startedAt : (status === 'running' ? new Date() : existing?.startedAt || new Date()),
                stoppedAt: status === 'running' ? null : (existing?.stoppedAt || new Date()),
                metadata: {
                    containerName: deployment.containerName,
                    imageName: deployment.imageName,
                    internalDomain: deployment.internalDomain,
                    appId: deployment.appId,
                    appName
                }
            };

            if (existing) {
                // Only update if something meaningful changed
                if (existing.status !== data.status || existing.port !== data.port || JSON.stringify(existing.metadata) !== JSON.stringify(data.metadata)) {
                    await prisma.processRegistry.update({ where: { id: existing.id }, data });
                }
            } else {
                await prisma.processRegistry.create({ data: { ...data, userId } });
            }
        }

        // 4. Also discover generic container logic
        await discoverGenericContainers(userId, existingProcesses, containerInfo);
        lastSync[`docker-${userId}`] = now;
    } catch (error) {
        console.error('syncDockerAppProcesses error:', error);
    }
};

async function discoverGenericContainers(userId: string, existingProcesses: any[], containerInfo?: Map<string, any>) {
    try {
        const info = containerInfo || new Map((await execAsync('docker ps -a --format "{{.Names}}|{{.Status}}|{{.Ports}}"')).stdout.split('\n').filter(Boolean).map(line => {
            const [name, status, ports] = line.trim().split('|');
            return [name, { status: status?.startsWith('Up') ? 'running' as const : 'stopped' as const, ports }];
        }));

        for (const [containerName, details] of info.entries()) {
            if (containerName.includes('supabase') || containerName.includes('agent-worker') || containerName === 'a-agent-worker-1') continue;

            const isTaskflowApp = containerName.startsWith('taskflow-app-');
            const appId = isTaskflowApp ? containerName.replace('taskflow-app-', '') : null;
            const processName = appId ? `Docker App ${appId}` : `Docker Container ${containerName}`;

            // Skip if it's already a repo-app or handled by deployments
            if (existingProcesses.some(p => p.name === processName || p.metadata?.containerName === containerName)) continue;

            const status = details.status;
            const port = parseDockerPort(details.ports);

            const data = {
                name: processName,
                type: 'docker-app' as const,
                port,
                path: appId || containerName,
                command: `docker start ${containerName}`,
                status,
                healthCheckType: 'port' as const,
                healthInterval: 30000,
                startedAt: status === 'running' ? new Date() : new Date(),
                stoppedAt: status === 'running' ? null : new Date(),
                metadata: {
                    containerName,
                    appId: appId || undefined,
                    source: 'docker'
                }
            };

            await prisma.processRegistry.create({ data: { ...data, userId } });
        }
    } catch (e) {
        // Docker probably not running
    }
}

export const syncRepoAppProcesses = async (userId: string) => {
    const now = Date.now();
    if (lastSync[`repo-${userId}`] && now - lastSync[`repo-${userId}`] < SYNC_COOLDOWN) {
        return;
    }

    try {
        const root = getRepoAppsRoot();
        const items = await readdir(root, { withFileTypes: true });
        const entries = items.filter(item => item.isDirectory()).map(item => item.name);

        if (!entries.length) {
            lastSync[`repo-${userId}`] = now;
            return;
        }

        // 1. Fetch all container statuses in ONE call
        const { stdout: psOutput } = await execAsync('docker ps -a --format "{{.Names}}|{{.Status}}|{{.Ports}}"');
        const containerInfo = new Map(psOutput.split('\n').filter(Boolean).map(line => {
            const [name, status, ports] = line.trim().split('|');
            return [name, { status: status?.startsWith('Up') ? 'running' as const : 'stopped' as const, ports }];
        }));

        // 2. Fetch all relevant registries
        const existingProcesses = await prisma.processRegistry.findMany({
            where: { userId }
        });

        for (const folderName of entries) {
            const appPath = join(root, folderName);
            const packageJsonPath = join(appPath, 'package.json');
            let packageJson: { scripts?: Record<string, string> } | null = null;

            try {
                const pkgRaw = await readFile(packageJsonPath, 'utf-8');
                packageJson = JSON.parse(pkgRaw);
            } catch (error) {
                continue;
            }

            const startScript = resolveStartScript(packageJson?.scripts || null);
            if (!startScript) continue;

            const safeName = folderName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
            const containerName = safeName;
            const imageName = safeName;
            const processName = `Repo App ${folderName}`;

            const info = containerInfo.get(containerName);
            const status = info?.status || 'stopped';

            const existing = existingProcesses.find(p => p.name === processName);

            const data = {
                name: processName,
                type: 'docker-app' as const,
                port: existing?.port || undefined,
                path: appPath,
                command: existing?.command || `docker run -d --name ${containerName} -p <port>:3000 ${imageName}`,
                status,
                healthCheckType: 'port' as const,
                healthInterval: 30000,
                startedAt: (status === 'running' && existing?.status === 'running') ? existing.startedAt : (status === 'running' ? new Date() : existing?.startedAt || new Date()),
                stoppedAt: status === 'running' ? null : (existing?.stoppedAt || new Date()),
                metadata: {
                    containerName,
                    imageName,
                    internalDomain: (existing?.metadata as any)?.internalDomain || `repo-${safeName}.internal`,
                    appName: folderName,
                    appPath,
                    source: 'repo-app'
                }
            };

            if (existing) {
                // Optimized check to avoid DB write
                const metaChanged = JSON.stringify(existing.metadata) !== JSON.stringify(data.metadata);
                if (existing.status !== data.status || existing.port !== data.port || metaChanged) {
                    await prisma.processRegistry.update({ where: { id: existing.id }, data });
                }
            } else {
                await prisma.processRegistry.create({ data: { ...data, userId } });
            }
        }
        lastSync[`repo-${userId}`] = now;
    } catch (error) {
        console.error('syncRepoAppProcesses error:', error);
    }
};
