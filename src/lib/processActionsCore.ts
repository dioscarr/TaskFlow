
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

export const getAvailablePort = async (start = 4100, end = 4999) => {
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

export const syncDockerAppProcesses = async (userId: string) => {
    const deployments = await prisma.appDeployment.findMany({
        where: { userId }
    });

    if (!deployments.length) return;

    const workspaceFiles = await prisma.workspaceFile.findMany({
        where: { userId, id: { in: deployments.map(d => d.appId) } },
        select: { id: true, name: true }
    });
    const nameByAppId = new Map(workspaceFiles.map(file => [file.id, file.name]));

    for (const deployment of deployments) {
        const appName = nameByAppId.get(deployment.appId) || deployment.appId;
        const processName = `Docker App ${deployment.appId}`;
        const status = deployment.containerName
            ? await getDockerContainerStatus(deployment.containerName)
            : 'unknown';

        const existing = await prisma.processRegistry.findFirst({
            where: { userId, name: processName }
        });

        const data = {
            name: processName,
            type: 'docker-app',
            port: deployment.port || undefined,
            path: deployment.appId,
            command: deployment.containerName
                ? `docker run -d --name ${deployment.containerName} -p ${deployment.port}:3000 ${deployment.imageName}`
                : 'docker run -d <container>',
            status,
            healthCheckType: 'port',
            healthInterval: 30000,
            startedAt: status === 'running' ? new Date() : existing?.startedAt || new Date(),
            stoppedAt: status === 'running' ? null : new Date(),
            metadata: {
                containerName: deployment.containerName,
                imageName: deployment.imageName,
                internalDomain: deployment.internalDomain,
                appId: deployment.appId,
                appName
            }
        };

        if (existing) {
            await prisma.processRegistry.update({
                where: { id: existing.id },
                data
            });
        } else {
            await prisma.processRegistry.create({
                data: { ...data, userId }
            });
        }
    }

    // Also discover generic container logic
    try {
        const { stdout } = await execAsync('docker ps -a --format "{{.Names}}|{{.Status}}|{{.Ports}}"');
        const lines = stdout.split('\n').map(line => line.trim()).filter(Boolean);
        for (const line of lines) {
            const [containerName, statusText, portsText] = line.split('|');
            if (!containerName) continue;

            const isTaskflowApp = containerName.startsWith('taskflow-app-');
            const appId = isTaskflowApp ? containerName.replace('taskflow-app-', '') : null;
            const processName = appId ? `Docker App ${appId}` : `Docker Container ${containerName}`;
            const status = statusText?.startsWith('Up') ? 'running' : 'stopped';
            const port = parseDockerPort(portsText);

            const existing = await prisma.processRegistry.findFirst({
                where: { userId, name: processName }
            });

            const data = {
                name: processName,
                type: 'docker-app',
                port,
                path: appId || containerName,
                command: `docker start ${containerName}`,
                status,
                healthCheckType: 'port',
                healthInterval: 30000,
                startedAt: status === 'running' ? new Date() : existing?.startedAt || new Date(),
                stoppedAt: status === 'running' ? null : new Date(),
                metadata: {
                    containerName,
                    appId: appId || undefined
                }
            };

            if (existing) {
                await prisma.processRegistry.update({
                    where: { id: existing.id },
                    data
                });
            } else {
                await prisma.processRegistry.create({
                    data: { ...data, userId }
                });
            }
        }
    } catch (error) {
        // Docker not available
    }
};

export const syncRepoAppProcesses = async (userId: string) => {
    const root = getRepoAppsRoot();
    let entries: string[] = [];

    try {
        entries = await readdir(root, { withFileTypes: true }).then(items => items.filter(item => item.isDirectory()).map(item => item.name));
    } catch (error) {
        return;
    }

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

        if (!startScript) {
            continue;
        }

        const safeName = folderName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
        const containerName = safeName;
        const imageName = safeName;
        const processName = `Repo App ${folderName}`;
        const defaultInternalDomain = `repo-${safeName}.internal`;

        const status = await getDockerContainerStatus(containerName);

        const existing = await prisma.processRegistry.findFirst({
            where: { userId, name: processName }
        });

        const data = {
            name: processName,
            type: 'docker-app',
            port: existing?.port || undefined,
            path: appPath,
            command: existing?.command || `docker run -d --name ${containerName} -p <port>:3000 ${imageName}`,
            status: status === 'unknown' ? 'stopped' : status,
            healthCheckType: 'port',
            healthInterval: 30000,
            startedAt: status === 'running' ? new Date() : existing?.startedAt || new Date(),
            stoppedAt: status === 'running' ? null : new Date(),
            metadata: {
                containerName,
                imageName,
                internalDomain: (existing?.metadata as any)?.internalDomain || defaultInternalDomain,
                appName: folderName,
                appPath,
                source: 'repo-app'
            }
        };

        if (existing) {
            await prisma.processRegistry.update({
                where: { id: existing.id },
                data
            });
        } else {
            await prisma.processRegistry.create({
                data: { ...data, userId }
            });
        }
    }
};
