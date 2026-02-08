
import prisma from '@/lib/prisma';
import { exec } from 'child_process';
import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { promisify } from 'util';

export const execAsync = promisify(exec);

export const isDockerDaemonUnavailable = (error: any) => {
    const msg = (error?.stderr || error?.message || '').toString().toLowerCase();
    // Check for timeout signals - Docker may be slow to respond on Windows/WSL2
    const isTimeout = error?.killed && error?.signal === 'SIGTERM';
    return isTimeout || msg.includes('pipe/docker_engine') || msg.includes('daemon') || msg.includes('failed to connect to the docker api');
};

export const checkDockerAvailability = async () => {
    const now = Date.now();
    if (!isDockerAvailable && now - lastDockerCheck < DOCKER_RECHECK_INTERVAL) {
        return false;
    }
    try {
        // Increased timeout for Windows/WSL2 - Docker Desktop with many plugins can be slow
        await execAsync('docker info', { timeout: 10000 });
        isDockerAvailable = true;
        lastDockerCheck = Date.now();
        return true;
    } catch (error) {
        lastDockerCheck = Date.now();
        if (isDockerDaemonUnavailable(error)) {
            isDockerAvailable = false;
            return false;
        }
        throw error;
    }
};

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
    return new Promise((resolve) => {
        const server = require('net').createServer();
        server.once('error', () => {
            resolve(false);
        });
        server.once('listening', () => {
            server.close();
            resolve(true);
        });
        server.listen(port);
    });
};

export const getAvailablePort = async (start = 5000, end = 5999) => {
    for (let port = start; port <= end; port += 1) {
        if (await isPortAvailable(port)) return port;
    }
    throw new Error('No available ports found');
};

export const waitForPortAvailable = async (port: number, timeoutMs = 5000, intervalMs = 250) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (await isPortAvailable(port)) return true;
        await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    return false;
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

/**
 * Get detailed container state (exists, status, health)
 */
export interface ContainerState {
    exists: boolean;
    status: 'running' | 'exited' | 'created' | 'paused' | 'restarting' | 'removing' | 'dead' | 'unknown';
    health?: 'healthy' | 'unhealthy' | 'starting';
}

export const getContainerState = async (containerName: string): Promise<ContainerState> => {
    try {
        const { stdout } = await execAsync(
            `docker inspect -f "{{.State.Status}}|{{.State.Health.Status}}" ${containerName}`,
            { timeout: 10000 }
        );
        const [status, health] = stdout.trim().split('|');
        return {
            exists: true,
            status: (status || 'unknown') as ContainerState['status'],
            health: health ? (health as ContainerState['health']) : undefined
        };
    } catch (error) {
        return { exists: false, status: 'unknown' };
    }
};

/**
 * Check if container is running using docker ps (faster than inspect)
 */
export const isContainerRunning = async (containerName: string): Promise<boolean> => {
    try {
        const { stdout } = await execAsync(
            `docker ps --filter "name=^${containerName}$" --filter "status=running" --format "{{.Names}}"`,
            { timeout: 10000 }
        );
        return stdout.trim() === containerName;
    } catch {
        return false;
    }
};

/**
 * Safe Docker command execution using array args (prevents command injection)
 */
export async function dockerExec(args: string[], options: any = {}): Promise<{ stdout: string; stderr: string }> {
    const { execFile } = require('child_process');
    const execFileAsync = promisify(execFile);
    return execFileAsync('docker', args, { timeout: 30000, ...options });
}

/**
 * Idempotent container start - implements "start once, keep running" pattern
 *
 * Industry best practice: Reuse containers instead of recreating
 * - If container is running → return immediately
 * - If container exists but stopped → docker start
 * - If container doesn't exist → docker run
 *
 * This follows the pattern used by VS Code Dev Containers, Docker Compose, and Tilt.
 */
export async function startOrCreateContainer(options: {
    containerName: string;
    imageName: string;
    port: number;
    internalPort?: number;
    volumes?: string[];
    env?: Record<string, string>;
    restart?: string;
}): Promise<{
    success: boolean;
    action: 'created' | 'started' | 'already_running';
    port: number;
    error?: string;
}> {
    const {
        containerName,
        imageName,
        port,
        internalPort = 5050,
        volumes = [],
        env = {},
        restart = 'unless-stopped'
    } = options;

    try {
        // Step 1: Check current state
        const state = await getContainerState(containerName);

        // Step 2: Container already running - nothing to do
        if (state.status === 'running') {
            return { success: true, action: 'already_running', port };
        }

        // Step 3: Container exists but stopped - restart it
        if (state.exists && (state.status === 'exited' || state.status === 'created')) {
            try {
                await dockerExec(['start', containerName]);
                return { success: true, action: 'started', port };
            } catch (startError: any) {
                // If start fails, remove the container and recreate
                console.error(`Failed to start existing container ${containerName}, removing:`, startError);
                try {
                    await dockerExec(['rm', '-f', containerName]);
                } catch (rmError) {
                    // Ignore removal errors, will fail on run anyway
                }
            }
        }

        // Step 4: Create new container
        const args = [
            'run', '-d',
            '--name', containerName,
            '-p', `${port}:${internalPort}`,
            '--restart', restart,
            '--memory', '512m',
            '--cpus', '0.5',
            ...volumes.flatMap(v => ['-v', v]),
            ...Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]),
            imageName
        ];

        await dockerExec(args);
        return { success: true, action: 'created', port };

    } catch (error: any) {
        console.error(`Failed to start/create container ${containerName}:`, error);
        return {
            success: false,
            action: 'created',
            port,
            error: error.message || 'Unknown error'
        };
    }
}

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
const SYNC_COOLDOWN = 300000; // 5 minutes - optimized for fast UI with background sync

/**
 * Clear sync cooldown for a user (for manual refresh)
 */
export function clearSyncCooldown(userId: string) {
    delete lastSync[`docker-${userId}`];
    delete lastSync[`repo-${userId}`];
    delete lastSync[`all-${userId}`];
}

/**
 * Get last sync timestamp for debugging
 */
export function getLastSyncTime(userId: string, type: 'docker' | 'repo' | 'all' = 'all'): number | null {
    return lastSync[`${type}-${userId}`] || null;
}

// Track docker availability to avoid hanging on slow failures
let lastDockerCheck = 0;
let isDockerAvailable = true;
const DOCKER_RECHECK_INTERVAL = 10000; // 10 seconds - reduced for faster recovery
let sharedContainerInfoPromise: Promise<Map<string, any> | null> | null = null;

async function getSharedContainerInfo() {
    const now = Date.now();

    // If we're already fetching, return that promise
    if (sharedContainerInfoPromise) return sharedContainerInfoPromise;

    if (!isDockerAvailable && now - lastDockerCheck < DOCKER_RECHECK_INTERVAL) {
        return null;
    }

    sharedContainerInfoPromise = (async () => {
        try {
            // Increased timeout for Windows/WSL2 - docker ps can be slow with many containers
            const { stdout: psOutput } = await execAsync('docker ps -a --format "{{.Names}}|{{.Status}}|{{.Ports}}"', { timeout: 10000 });
            isDockerAvailable = true;
            lastDockerCheck = Date.now();
            return new Map(psOutput.split('\n').filter(Boolean).map(line => {
                const [name, status, ports] = line.trim().split('|');
                return [name, { status: status?.startsWith('Up') ? 'running' as const : 'stopped' as const, ports }];
            }));
        } catch (error) {
            lastDockerCheck = Date.now();
            if (isDockerDaemonUnavailable(error)) {
                isDockerAvailable = false;
                return null;
            }
            throw error;
        } finally {
            sharedContainerInfoPromise = null;
        }
    })();

    return sharedContainerInfoPromise;
}

export const syncDockerAppProcesses = async (userId: string, sharedInfo?: Map<string, any>) => {
    const now = Date.now();
    if (lastSync[`docker-${userId}`] && now - lastSync[`docker-${userId}`] < SYNC_COOLDOWN) {
        return; // Skip if synced recently
    }

    try {
        // 1. Fetch container statuses early or use shared
        const containerInfo = sharedInfo || await getSharedContainerInfo();
        if (containerInfo === null) {
            // Docker unavailable - still optionally sync generic registries but they'll be 'unknown' or 'stopped'
            // We'll skip for now to save time
            return;
        }

        // 2. Fetch all deployments and process registries in one go
        const [deployments, existingProcesses] = await Promise.all([
            prisma.appDeployment.findMany({ where: { userId } }),
            prisma.processRegistry.findMany({ where: { userId, type: 'docker-app' } })
        ]);

        if (!deployments.length && !existingProcesses.length) {
            await discoverGenericContainers(userId, existingProcesses, containerInfo);
            lastSync[`docker-${userId}`] = now;
            return;
        }

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
        if (isDockerDaemonUnavailable(error)) return;
        console.error('syncDockerAppProcesses error:', error);
    }
};

async function discoverGenericContainers(userId: string, existingProcesses: any[], containerInfo: Map<string, any>) {
    try {
        const info = containerInfo;

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

export const syncRepoAppProcesses = async (userId: string, sharedInfo?: Map<string, any>) => {
    const now = Date.now();
    if (lastSync[`repo-${userId}`] && now - lastSync[`repo-${userId}`] < SYNC_COOLDOWN) {
        return;
    }

    try {
        // 1. Fetch container statuses early or use shared
        const containerInfo = sharedInfo || await getSharedContainerInfo();
        if (containerInfo === null) return;

        const root = getRepoAppsRoot();
        const items = await readdir(root, { withFileTypes: true });
        const entries = items.filter(item => item.isDirectory()).map(item => item.name);

        if (!entries.length) {
            lastSync[`repo-${userId}`] = now;
            return;
        }

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
        if (isDockerDaemonUnavailable(error)) return;
        console.error('syncRepoAppProcesses error:', error);
    }
};
