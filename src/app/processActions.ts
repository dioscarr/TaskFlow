'use server';

import prisma from '@/lib/prisma';
import { deepSerialize } from '@/lib/serialization';
import { writeFile, readFile } from 'fs/promises';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import {
    ProcessInput,
    getDemoUser,
    syncDockerAppProcesses,
    syncRepoAppProcesses,
    isDockerProcess,
    execAsync,
    getAvailablePort,
    isPortAvailable,
    resolveStartScript,
    checkDockerAvailability,
    waitForPortAvailable,
    startOrCreateContainer
} from '@/lib/processActionsCore';
import { getActionableError, isDockerDaemonError, formatErrorForLog } from '@/lib/dockerErrors';
import { broadcastProcesses } from '@/lib/processSocket';

export { type ProcessInput };

// Safe execution functions to prevent command injection
const execFileAsync = promisify(execFile);

/**
 * Safely execute Docker commands without shell interpretation
 * Prevents command injection attacks
 */
async function dockerExec(args: string[], options: { timeout?: number; cwd?: string } = {}): Promise<{ stdout: string; stderr: string }> {
    return execFileAsync('docker', args, {
        timeout: options.timeout || 30000,
        cwd: options.cwd,
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large outputs
    });
}

const DEFAULT_PREVIEW_PORT = 5050;

const ensureEnvValue = async (key: string, value: string) => {
    try {
        const envPath = join(process.cwd(), '.env');
        let raw = '';
        try { raw = await readFile(envPath, 'utf-8'); } catch { /* file may not exist */ }
        const lines = raw ? raw.split(/\r?\n/) : [];
        let updated = false;
        const next = lines.map(line => {
            if (line.startsWith(`${key}=`)) {
                updated = true;
                return `${key}=${value}`;
            }
            return line;
        });
        if (!updated) next.push(`${key}=${value}`);
        await writeFile(envPath, next.filter(Boolean).join('\n'));
    } catch { /* best-effort only */ }
};

// Detect common Docker daemon unavailable errors so we can degrade gracefully.
const isDockerDaemonUnavailable = (error: any) => {
    const msg = (error?.stderr || error?.message || '').toString().toLowerCase();
    return msg.includes('pipe/docker_engine') || msg.includes('daemon') || msg.includes('failed to connect to the docker api');
};

const ensurePreviewPortDefaults = async (preferredPort: number = DEFAULT_PREVIEW_PORT) => {
    const normalized = Number.isFinite(preferredPort) && preferredPort > 0 ? preferredPort : DEFAULT_PREVIEW_PORT;

    if (process.env.PREVIEW_PORT !== normalized.toString()) process.env.PREVIEW_PORT = normalized.toString();
    if (process.env.NGROK_PORT !== normalized.toString()) process.env.NGROK_PORT = normalized.toString();

    await ensureEnvValue('PREVIEW_PORT', process.env.PREVIEW_PORT);
    await ensureEnvValue('NGROK_PORT', process.env.NGROK_PORT);

    try {
        await execAsync(`powershell -Command "$proc = (Get-NetTCPConnection -LocalPort ${normalized} -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -ne 0 } | Select-Object -First 1).OwningProcess; if ($proc) { Stop-Process -Id $proc -Force }"`);
    } catch { /* port already free */ }

    return normalized;
};

const ensurePublicAccess = async (processId: string, targetPort?: number) => {
    try {
        return await togglePublicAccess(processId, { mode: 'ensure', targetPort });
    } catch (e: any) {
        return { success: false, message: e?.message || 'Failed to ensure public access' };
    }
};

/**
 * List all processes for the current user (optimized - no blocking sync)
 * Pagination support for better performance with many processes
 */
export async function listProcesses(options: { page?: number; limit?: number; triggerBackgroundSync?: boolean } = {}) {
    try {
        const user = await getDemoUser();
        const { page = 1, limit = 100, triggerBackgroundSync = true } = options;

        // Trigger background sync (non-blocking) if needed
        if (triggerBackgroundSync) {
            syncProcessesInBackground(user.id).catch(err =>
                console.warn('Background process sync failed:', err)
            );
        }

        // Fast read from database
        const skip = (page - 1) * limit;

        // Perform a quick health check broadcast if sync was skipped by cooldown
        // This ensures the current state in DB is shared with all clients even if no heavy sync happened
        broadcastProcesses().catch(() => { });

        const [processes, total] = await Promise.all([
            prisma.processRegistry.findMany({
                where: { userId: user.id },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.processRegistry.count({ where: { userId: user.id } })
        ]);

        return {
            success: true,
            processes: deepSerialize(processes),
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    } catch (error: any) {
        console.error('Error listing processes:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Background sync - non-blocking process sync
 * Called automatically by listProcesses or manually via refreshProcesses
 */
async function syncProcessesInBackground(userId: string): Promise<void> {
    try {
        await Promise.allSettled([
            syncDockerAppProcesses(userId),
            syncRepoAppProcesses(userId)
        ]);
    } catch (e: any) {
        if (isDockerDaemonUnavailable(e)) {
            console.warn('Docker daemon unavailable; skipping docker process sync');
        } else {
            console.error('Background sync error:', e);
        }
    } finally {
        // Always broadcast after sync attempt
        broadcastProcesses().catch(() => { });
    }
}

/**
 * Manual refresh - forces immediate sync (useful for "Refresh" button)
 */
export async function refreshProcesses() {
    try {
        const user = await getDemoUser();

        // Force sync by clearing cooldown
        const { clearSyncCooldown } = await import('@/lib/processActionsCore');
        clearSyncCooldown(user.id);

        // Perform sync
        await syncProcessesInBackground(user.id);

        // Return fresh data
        return listProcesses({ triggerBackgroundSync: false });
    } catch (error: any) {
        console.error('Error refreshing processes:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Register a new process
 */
export async function registerProcess(data: ProcessInput) {
    try {
        const user = await getDemoUser();
        const process = await prisma.processRegistry.create({
            data: {
                name: data.name,
                type: data.type,
                port: data.port,
                path: data.path,
                command: data.command,
                status: 'running',
                healthUrl: data.healthUrl,
                healthCheckType: data.healthCheckType || 'port',
                healthInterval: data.healthInterval || 30000,
                metadata: data.metadata || {},
                userId: user.id
            }
        });


        broadcastProcesses().catch(() => { });
        return { success: true, message: 'Process registered successfully', process: deepSerialize(process) };
    } catch (error: any) {
        console.error('Error registering process:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Stop a running process
 */
export async function stopProcess(id: string) {
    try {
        const user = await getDemoUser();
        const process = await prisma.processRegistry.findFirst({
            where: { id, userId: user.id }
        });

        if (!process) {
            return { success: false, message: 'Process not found' };
        }

        if (isDockerProcess(process)) {
            const meta = (process.metadata as any) || {};
            const containerName = meta?.containerName as string | undefined;
            const ngrokName = `ngrok-${process.id}`;

            if (containerName) {
                try {
                    // Safe: Stop container using array args
                    await dockerExec(['stop', containerName]);
                } catch (dockerError: any) {
                    if (!isDockerDaemonUnavailable(dockerError)) {
                        console.error('Error stopping docker container:', dockerError);
                    }
                }
            }

            // Also stop and remove ngrok container
            try {
                // Safe: Remove ngrok container
                await dockerExec(['rm', '-f', ngrokName]);
            } catch (e: any) {
                if (!isDockerDaemonUnavailable(e)) {
                    console.error('Error removing ngrok container:', e);
                }
            }
        } else {
            // Kill the process by PID
            if (process.pid) {
                try {
                    // Windows: taskkill
                    await execAsync(`taskkill /PID ${process.pid} /F`);
                } catch (killError: any) {
                    console.error('Error killing process:', killError);
                    // Process might already be dead, continue anyway
                }
            }

            // Cleanup ngrok for local processes too
            try {
                const ngrokName = `ngrok-${process.id}`;
                // Safe: Remove ngrok container
                await dockerExec(['rm', '-f', ngrokName]);
            } catch (e: any) {
                if (!isDockerDaemonUnavailable(e)) {
                    console.error('Error removing ngrok container:', e);
                }
            }
        }
        // Kill by port if no PID
        if (process.port && !process.pid) {
            try {
                const cmd = `$proc = (Get-NetTCPConnection -LocalPort ${process.port} -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -ne 0 } | Select-Object -First 1).OwningProcess; if ($proc) { Stop-Process -Id $proc -Force }`;
                await execAsync(`powershell -Command "${cmd}"`);
            } catch (portError: any) {
                console.error('Error killing process by port:', portError);
            }
        }

        if (process.port) {
            await waitForPortAvailable(process.port, 8000);
        }

        // Update database
        const updated = await prisma.processRegistry.update({
            where: { id },
            data: {
                status: 'stopped',
                stoppedAt: new Date()
            }
        });


        broadcastProcesses().catch(() => { });
        return { success: true, message: 'Process stopped successfully', process: deepSerialize(updated) };
    } catch (error: any) {
        console.error('Error stopping process:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Restart a running process
 */
export async function restartProcess(id: string) {
    try {
        const user = await getDemoUser();
        const process = await prisma.processRegistry.findFirst({
            where: { id, userId: user.id }
        });

        if (!process) {
            return { success: false, message: 'Process not found' };
        }

        if (isDockerProcess(process)) {
            const containerName = (process.metadata as any)?.containerName as string | undefined;
            if (containerName) {
                try {
                    // Safe: Restart container using array args
                    await dockerExec(['restart', containerName]);
                } catch (dockerError: any) {
                    console.error('Error restarting docker container:', dockerError);
                    return { success: false, message: 'Failed to restart docker container' };
                }
            }
        } else {
            // For regular processes, stop and start
            await stopProcess(id);
            return await startProcess(id);
        }

        const updated = await prisma.processRegistry.update({
            where: { id },
            data: {
                status: 'running',
                startedAt: new Date(),
                stoppedAt: null
            }
        });


        broadcastProcesses().catch(() => { });
        return { success: true, message: 'Process restarted successfully', process: deepSerialize(updated) };
    } catch (error: any) {
        console.error('Error restarting process:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Rebuild and start a Docker process
 */
export async function rebuildProcess(id: string) {
    try {
        const user = await getDemoUser();
        const process = await prisma.processRegistry.findFirst({
            where: { id, userId: user.id }
        });

        if (!process) {
            return { success: false, message: 'Process not found' };
        }

        if (!isDockerProcess(process)) {
            return { success: false, message: 'Rebuild is only supported for Docker processes' };
        }

        // For Docker processes, startProcess already does a build and run for repo-apps
        // We just need to trigger the startProcess logic which has the build/run cycle
        return await startProcess(id);
    } catch (error: any) {
        console.error('Error rebuilding process:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Start a process
 */
export async function startProcess(id: string) {
    try {
        const user = await getDemoUser();
        const process = await prisma.processRegistry.findFirst({
            where: { id, userId: user.id }
        });

        if (!process) {
            return { success: false, message: 'Process not found' };
        }

        const enforcedPreviewPort = await ensurePreviewPortDefaults();

        if (isDockerProcess(process)) {
            const meta = process.metadata as any || {};
            const containerName = meta?.containerName as string | undefined;
            const appPath = meta?.appPath as string | undefined;
            const imageName = meta?.imageName as string | undefined;

            if ((meta?.source === 'repo-app' || process.type === 'docker-dev') && appPath && containerName && imageName) {
                // Ensure allowedHosts is set for NGrok
                try {
                    const viteConfigPath = join(appPath, 'vite.config.ts');
                    const viteConfig = await readFile(viteConfigPath, 'utf-8');
                    if (!viteConfig.includes('allowedHosts: true')) {
                        const newConfig = viteConfig.replace('plugins: [react()],', 'plugins: [react()],\n  server: { allowedHosts: true, host: true },');
                        if (newConfig !== viteConfig) {
                            await writeFile(viteConfigPath, newConfig);
                        }
                    }
                } catch (e) {
                    // Ignore config update errors
                }

                let internalPort = 3000;
                let dockerFileName = 'Dockerfile.taskflow';
                let useExistingDockerfile = false;

                const forcedDockerFile = (meta?.dockerFile as string | undefined);
                const requestedRunMode = (meta?.runMode as string | undefined);

                // Access global process for cwd, avoiding shadow
                const currentDir = (global as any).process.cwd();
                const absAppPath = (process as any).type === 'docker-dev' && appPath ? join(currentDir, appPath) : appPath || '';

                if (!forcedDockerFile && requestedRunMode === 'dev') {
                    try {
                        const content = await readFile(join(absAppPath, 'Dockerfile.dev'), 'utf-8');
                        useExistingDockerfile = true;
                        dockerFileName = 'Dockerfile.dev';
                        const exposeMatch = content.match(/EXPOSE\s+(\d+)/);
                        if (exposeMatch) {
                            internalPort = parseInt(exposeMatch[1]);
                        }
                    } catch {
                        // If Dockerfile.dev doesn't exist, fall through to default logic
                    }
                }

                if (forcedDockerFile) {
                    dockerFileName = forcedDockerFile;
                    useExistingDockerfile = true;
                    try {
                        const content = await readFile(join(absAppPath, forcedDockerFile), 'utf-8');
                        const exposeMatch = content.match(/EXPOSE\s+(\d+)/);
                        if (exposeMatch) {
                            internalPort = parseInt(exposeMatch[1]);
                        }
                    } catch (e) {
                        console.error('Error reading forced dockerfile:', e);
                    }
                } else {
                    // Check if a custom Dockerfile exists
                    if (!useExistingDockerfile) {
                        try {
                            const existingDockerfileContent = await readFile(join(absAppPath, 'Dockerfile'), 'utf-8');
                            useExistingDockerfile = true;
                            dockerFileName = 'Dockerfile';

                            // Try to detect exposed port
                            const exposeMatch = existingDockerfileContent.match(/EXPOSE\s+(\d+)/);
                            if (exposeMatch) {
                                internalPort = parseInt(exposeMatch[1]);
                            } else if (existingDockerfileContent.includes('nginx')) {
                                internalPort = 80;
                            }
                        } catch {
                            // No existing Dockerfile, proceed with generation logic
                        }
                    }
                }

                let startScript = meta?.startScript as string | undefined;

                if (!useExistingDockerfile) {
                    if (!startScript) {
                        try {
                            const pkgRaw = await readFile(join(absAppPath, 'package.json'), 'utf-8');
                            const pkg = JSON.parse(pkgRaw) as { scripts?: Record<string, string> };
                            startScript = resolveStartScript(pkg.scripts || null) || undefined;
                        } catch {
                            startScript = undefined;
                        }
                    }

                    if (!startScript) {
                        return { success: false, message: 'package.json is missing a start/preview/dev script' };
                    }

                    const dockerfilePath = join(absAppPath, 'Dockerfile.taskflow');
                    const dockerfile = `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
ENV NODE_ENV=production
ENV PORT=3000
RUN npm run build --if-present
EXPOSE 3000
CMD ["npm", "run", "${startScript}"]
`;
                    await writeFile(dockerfilePath, dockerfile);
                }

                // 4. Find Port (prefer reserved preview port when configured)
                const previewPort = Number((global as any).process.env.PREVIEW_PORT || enforcedPreviewPort);
                const usePreviewPort = Number.isFinite(previewPort) && previewPort > 0;
                let port = usePreviewPort ? previewPort : (process.port || await getAvailablePort(5000, 5999));
                if (usePreviewPort && process.port && process.port !== previewPort) {
                    port = previewPort;
                }

                if (usePreviewPort) {
                    try {
                        // Kill anything on this port first
                        // Windows/Powershell way
                        await execAsync(`powershell -Command "$proc = (Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -ne 0 } | Select-Object -First 1).OwningProcess; if ($proc) { Stop-Process -Id $proc -Force }"`);
                    } catch (e) {
                        // Ignore if nothing running
                    }
                    // Also try docker stop if we can find container by port... hard to do generically without query
                    // But if we rebuild/run with same name, docker rm -f below handles it for THIS app.
                    // For OTHER apps on same port? User has to rely on the kill command above?
                    // Actually, if we use the same port, docker run will fail if port is bound.
                    // So we must ensure it's free.
                }

                const dockerfilePath = join(absAppPath, dockerFileName);

                const dockerIsUp = await checkDockerAvailability();
                if (!dockerIsUp) {
                    console.warn(`[Repo App ${process.name}] Docker daemon unavailable. Attempting local fallback...`);
                    // For repo apps, immediately trigger local fallback instead of throwing
                    const dockerError = { message: 'daemon', isDaemonError: true };
                    // Jump directly to fallback block by setting flag
                    (dockerError as any).stderr = 'daemon';
                    throw dockerError;
                }

                try {
                    // Check if container exists (running or stopped)
                    let containerExists = false;
                    let isRunning = false;
                    let runningPort: number | undefined;

                    try {
                        const { stdout: inspectOut } = await dockerExec(['inspect', '--format', '{{.State.Running}}|{{.NetworkSettings.Ports}}', containerName]);
                        const [runningStatus, portsJson] = inspectOut.trim().split('|');
                        containerExists = true;
                        isRunning = runningStatus === 'true';

                        if (isRunning) {
                            // Parse the port from the running container
                            // Format: map[3000/tcp:[map[HostIp:0.0.0.0 HostPort:5050]]]
                            const portMatch = portsJson.match(/HostPort:(\d+)/);
                            if (portMatch) {
                                runningPort = parseInt(portMatch[1]);
                            }
                            console.log(`✓ Container ${containerName} is already running on port ${runningPort || 'unknown'}`);
                        } else {
                            console.log(`✓ Container ${containerName} exists but is stopped`);
                        }
                    } catch (inspectError) {
                        // Container doesn't exist, will create it
                        containerExists = false;
                        isRunning = false;
                    }

                    // If already running, just hook into it
                    if (isRunning && runningPort) {
                        const updated = await prisma.processRegistry.update({
                            where: { id },
                            data: {
                                port: runningPort,
                                status: 'running',
                                startedAt: new Date(),
                                stoppedAt: null,
                                command: `docker start ${containerName}`,
                                metadata: {
                                    ...(process.metadata as any),
                                    mode: 'docker-existing'
                                }
                            }
                        });

                        const tunnel = await ensurePublicAccess(updated.id, runningPort);
                        const publicUrl = (tunnel as any)?.publicUrl || (tunnel as any)?.process?.metadata?.publicUrl;
                        const finalProcess = publicUrl
                            ? await prisma.processRegistry.findUnique({ where: { id: updated.id } })
                            : updated;

                        return {
                            success: true,
                            message: `Hooked into existing ${process.name} container`,
                            previewUrl: publicUrl || `http://localhost:${runningPort}`,
                            publicUrl,
                            process: deepSerialize(finalProcess)
                        };
                    }

                    // If container exists but is stopped, just start it
                    if (containerExists && !isRunning) {
                        console.log(`Starting stopped container ${containerName}...`);
                        await dockerExec(['start', containerName]);

                        // Get the port from the container
                        const { stdout: portOut } = await dockerExec(['port', containerName]);
                        const portMatch = portOut.match(/\d+\/tcp -> [^:]+:(\d+)/);
                        const containerPort = portMatch ? parseInt(portMatch[1]) : port;

                        const updated = await prisma.processRegistry.update({
                            where: { id },
                            data: {
                                port: containerPort,
                                status: 'running',
                                startedAt: new Date(),
                                stoppedAt: null,
                                command: `docker start ${containerName}`,
                                metadata: {
                                    ...(process.metadata as any),
                                    mode: 'docker-restarted'
                                }
                            }
                        });

                        const tunnel = await ensurePublicAccess(updated.id, containerPort);
                        const publicUrl = (tunnel as any)?.publicUrl || (tunnel as any)?.process?.metadata?.publicUrl;
                        const finalProcess = publicUrl
                            ? await prisma.processRegistry.findUnique({ where: { id: updated.id } })
                            : updated;

                        return {
                            success: true,
                            message: `Restarted ${process.name} container`,
                            previewUrl: publicUrl || `http://localhost:${containerPort}`,
                            publicUrl,
                            process: deepSerialize(finalProcess)
                        };
                    }

                    // Container doesn't exist, build and run it
                    // Safe: Remove any remnants (shouldn't exist but being safe)
                    await dockerExec(['rm', '-f', containerName]).catch(() => { });

                    // Safe: Build image with validated parameters
                    console.log(`Building Docker image: ${imageName}`);
                    await dockerExec([
                        'build',
                        '-t', imageName,
                        '-f', dockerfilePath,
                        absAppPath
                    ], { timeout: 300000 }); // 5 minutes for build

                    // Safe: Run container with explicit parameters
                    console.log(`Starting container: ${containerName}`);
                    await dockerExec([
                        'run', '-d',
                        '--name', containerName,
                        '-p', `${port}:${internalPort}`,
                        '--memory', '512m',
                        '--cpus', '0.5',
                        '--restart', 'unless-stopped',
                        imageName
                    ]);

                    const updated = await prisma.processRegistry.update({
                        where: { id },
                        data: {
                            port,
                            status: 'running',
                            startedAt: new Date(),
                            stoppedAt: null,
                            command: `docker run -d --name ${containerName} -p ${port}:${internalPort} ${imageName}`,
                            metadata: { ...(process.metadata as any) }
                        }
                    });

                    const tunnel = await ensurePublicAccess(updated.id, port);
                    const publicUrl = (tunnel as any)?.publicUrl || (tunnel as any)?.process?.metadata?.publicUrl;
                    const finalProcess = publicUrl
                        ? await prisma.processRegistry.findUnique({ where: { id: updated.id } })
                        : updated;

                    return {
                        success: true,
                        message: `Started ${process.name}`,
                        previewUrl: publicUrl || `http://localhost:${port}`,
                        publicUrl,
                        process: deepSerialize(finalProcess)
                    };
                } catch (dockerError: any) {
                    // Use actionable error messaging
                    const actionable = getActionableError(dockerError, 'start container');
                    console.error(formatErrorForLog(dockerError, 'Docker container start'));

                    // Check if it's a daemon error for fallback logic
                    const isDaemonError = isDockerDaemonError(dockerError);

                    if (isDaemonError && (meta?.source === 'repo-app' || process.type === 'docker-dev')) {
                        console.log('⚠️ Docker Daemon unreachable. Falling back to local execution...');

                        // Fallback to local
                        const script = startScript || 'dev';

                        // ensure dependencies
                        try {
                            // Check if node_modules exists to skip install if possible (for speed)
                            const hasModules = await import('fs').then(fs => fs.existsSync(join(absAppPath, 'node_modules')));
                            if (!hasModules) {
                                console.log('Installing dependencies locally...');
                                await execAsync('npm install', { cwd: absAppPath });
                            }
                        } catch (e) {
                            console.error('Failed to install dependencies:', e);
                            return { success: false, message: 'Docker is down and local install failed.' };
                        }

                        // Start Local
                        let actualCmd = `npm run ${script}`;
                        // Quick hack for vite
                        if (actualCmd.includes('vite') || actualCmd.includes('dev')) {
                            actualCmd += ` -- --port ${port} --host`;
                        }

                        const { exec } = await import('child_process');
                        const child = exec(actualCmd, { cwd: absAppPath, env: { ...(global as any).process.env, PORT: port.toString() } });

                        if (child.pid) {
                            const updated = await prisma.processRegistry.update({
                                where: { id },
                                data: {
                                    status: 'running',
                                    port,
                                    pid: child.pid, // Track local PID now
                                    startedAt: new Date(),
                                    stoppedAt: null,
                                    metadata: {
                                        ...process.metadata as any,
                                        startScript,
                                        mode: 'local-fallback' // Mark as fallback
                                    }
                                }
                            });
                            const tunnel = await ensurePublicAccess(updated.id, port);
                            const publicUrl = (tunnel as any)?.publicUrl || (tunnel as any)?.process?.metadata?.publicUrl;
                            const finalProcess = publicUrl
                                ? await prisma.processRegistry.findUnique({ where: { id: updated.id } })
                                : updated;

                            return {
                                success: true,
                                message: 'Docker unreachable. Started in Local Fallback mode.',
                                previewUrl: publicUrl || `http://localhost:${port}`,
                                publicUrl,
                                process: deepSerialize(finalProcess)
                            };
                        }
                    }

                    return { success: false, message: 'Failed to start docker container and fallback failed: ' + dockerError.message };
                } finally {
                    broadcastProcesses().catch(() => { });
                }
            }
        }

        return { success: false, message: 'Process configuration invalid or not supported for start.' };
    } catch (error: any) {
        console.error('Error starting process:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Check process health
 */
export async function checkProcessHealth(id: string) {
    try {
        const user = await getDemoUser();
        const process = await prisma.processRegistry.findFirst({
            where: { id, userId: user.id }
        });

        if (!process) {
            return { success: false, message: 'Process not found' };
        }

        let healthStatus = 'unknown';
        let responseTime = 0;
        const startTime = Date.now();

        // HTTP health check
        if (process.healthCheckType === 'http' && process.healthUrl) {
            try {
                const response = await fetch(process.healthUrl, {
                    method: 'GET',
                    signal: AbortSignal.timeout(5000)
                });
                responseTime = Date.now() - startTime;
                healthStatus = response.ok ? 'healthy' : 'unhealthy';
            } catch (error) {
                healthStatus = 'unhealthy';
                responseTime = Date.now() - startTime;
            }
        }

        // Port check
        if (process.healthCheckType === 'port' && process.port) {
            try {
                // Return 'healthy' if port is IN USE
                const available = await isPortAvailable(process.port);
                healthStatus = available ? 'unhealthy' : 'healthy';
                responseTime = Date.now() - startTime;
            } catch (error) {
                healthStatus = 'unhealthy';
                responseTime = Date.now() - startTime;
            }
        }

        // Update database
        const updated = await prisma.processRegistry.update({
            where: { id },
            data: {
                lastHealthCheck: new Date(),
                healthStatus,
                responseTime,
                status: healthStatus === 'healthy' ? 'running' : 'error'
            }
        });

        return { success: true, health: { status: healthStatus, responseTime, lastCheck: deepSerialize(new Date()) } };
    } catch (error: any) {
        console.error('Error checking process health:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Discover running processes on common ports
 */
export async function discoverProcesses() {
    try {
        const user = await getDemoUser();
        // Sync docker apps first
        try {
            await syncDockerAppProcesses(user.id);
            await syncRepoAppProcesses(user.id); // Also sync repo apps
        } catch (e: any) {
            if (isDockerDaemonUnavailable(e)) {
                console.warn('Docker daemon unavailable; skipping docker discovery');
            } else {
                throw e;
            }
        }

        const commonPorts = [3000, 3001, 5173, 5174, 5175, 5176, 8080, 8081, 4200, 4100, 4101, 4102, 4103, 4104, 4105, 5000, 5001];
        const discovered = [];

        for (const port of commonPorts) {
            try {
                // Determine platform-specific command
                const isWin = process.platform === 'win32';
                const cmd = isWin
                    ? `netstat -ano | findstr :${port}`
                    : `lsof -i :${port} -t`;

                const { stdout } = await execAsync(cmd);

                // Check if we found anything
                if (stdout && (isWin ? stdout.includes(`:${port}`) : stdout.trim().length > 0)) {
                    let pid: number | null = null;

                    if (isWin) {
                        // Windows parsing: "  TCP    0.0.0.0:3000 ... 1234"
                        const lines = stdout.trim().split('\n');
                        // Prefer LISTENING
                        const listeningLine = lines.find(l => l.includes('LISTENING')) || lines[0];
                        const match = listeningLine?.match(/\s+(\d+)\r?$/);
                        pid = match ? parseInt(match[1]) : null;
                    } else {
                        // lsof returns just PIDs
                        const lines = stdout.trim().split('\n');
                        pid = lines[0] ? parseInt(lines[0]) : null;
                    }

                    // Check if already registered
                    const existing = await prisma.processRegistry.findFirst({
                        where: {
                            userId: user.id,
                            port: port
                        }
                    });

                    if (!existing && pid) {
                        // Create the process record (mark as local dev server)
                        const p = await prisma.processRegistry.create({
                            data: {
                                name: `App on Port ${port}`,
                                type: 'dev-server',
                                port,
                                pid,
                                path: 'Detected locally',
                                command: `Running on port ${port}`,
                                status: 'running',
                                healthCheckType: 'port',
                                healthInterval: 30000,
                                startedAt: new Date(),
                                metadata: { source: 'local' },
                                userId: user.id
                            }
                        });

                        discovered.push(p);
                    }
                }
            } catch (error) {
                // Port not in use, continue
                continue;
            }
        }

        broadcastProcesses().catch(() => { });
        return { success: true, discovered: deepSerialize(discovered) };
    } catch (error: any) {
        console.error('Error discovering processes:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Delete a process from registry
 */
export async function deleteProcess(id: string) {
    try {
        const user = await getDemoUser();
        const process = await prisma.processRegistry.findFirst({
            where: { id, userId: user.id }
        });

        if (process && isDockerProcess(process)) {
            const containerName = (process.metadata as any)?.containerName as string | undefined;
            if (containerName) {
                try {
                    // Safe: Remove container forcefully
                    await dockerExec(['rm', '-f', containerName]);
                } catch (dockerError: any) {
                    console.error('Error removing docker container:', dockerError);
                }
            }
        }

        await prisma.processRegistry.delete({
            where: { id }
        });

        broadcastProcesses().catch(() => { });
        return { success: true };
    } catch (error: any) {
        console.error('Error deleting process:', error);
        return { success: false, message: error.message };
    }
}
/**
 * Get Docker container logs
 */
export async function getDockerLogs(id: string) {
    try {
        const user = await getDemoUser();
        const process = await prisma.processRegistry.findFirst({
            where: { id, userId: user.id }
        });

        if (!process || !isDockerProcess(process)) {
            return { success: false, message: 'Process not found or not a Docker container' };
        }

        const containerName = (process.metadata as any)?.containerName as string | undefined;
        if (!containerName) {
            return { success: false, message: 'Container name not found in metadata' };
        }

        // Safe: Get container logs using array args
        const { stdout, stderr } = await dockerExec(['logs', '--tail', '100', containerName]);
        return { success: true, logs: stdout + stderr };
    } catch (error: any) {
        console.error('Error getting docker logs:', error);
        return { success: false, message: error.message };
    }
}

export async function reconfigureProcessPort(processId: string) {
    try {
        const user = await getDemoUser();
        if (!user) return { success: false, error: 'User not found' };

        const proc = await prisma.processRegistry.findUnique({ where: { id: processId } });
        if (!proc) return { success: false, error: 'Process not found' };

        // Determine container/image details
        let containerName = proc.name.replace('Repo App ', '').trim();
        let imageName = containerName;

        if (proc.metadata && typeof proc.metadata === 'object' && !Array.isArray(proc.metadata)) {
            const meta = proc.metadata as any;
            if (meta.containerName) containerName = meta.containerName;
            if (meta.imageName) imageName = meta.imageName;
        }

        // Determine internal port via inspection
        let internalPort = '3000';
        try {
            // Inspect image configuration for exposed ports
            const { stdout } = await execAsync(`docker inspect --format="{{json .Config.ExposedPorts}}" ${imageName}`);
            const portsObj = JSON.parse(stdout.trim());
            if (portsObj) {
                const ports = Object.keys(portsObj);
                if (ports.includes('80/tcp')) internalPort = '80';
                else if (ports.includes('5173/tcp')) internalPort = '5173';
                else if (ports.includes('3000/tcp')) internalPort = '3000';
                else if (ports.length > 0) internalPort = ports[0].split('/')[0];
            }
        } catch (e) {
            console.log('Failed to detect port via docker inspect, attempting build if repo-app...', e);

            // Attempt build for repo apps (fixes missing image issue)
            if (proc.metadata && (proc.metadata as any).source === 'repo-app' && (proc.metadata as any).appPath) {
                try {
                    const appPath = (proc.metadata as any).appPath;
                    console.log(`Building image for ${proc.name}...`);
                    await execAsync(`docker build -t ${imageName} "${appPath}"`);

                    // Retry inspect
                    const { stdout } = await execAsync(`docker inspect --format="{{json .Config.ExposedPorts}}" ${imageName}`);
                    const portsObj = JSON.parse(stdout.trim());
                    if (portsObj) {
                        const ports = Object.keys(portsObj);
                        if (ports.includes('80/tcp')) internalPort = '80';
                        else if (ports.includes('5173/tcp')) internalPort = '5173';
                        else if (ports.includes('3000/tcp')) internalPort = '3000';
                        else if (ports.length > 0) internalPort = ports[0].split('/')[0];
                    }
                } catch (buildError) {
                    console.error('Build failed during auto-fix:', buildError);
                }
            }
        }

        // Allocate new port
        const port = await getAvailablePort();
        console.log(`🔧 Reconfiguring port for ${proc.name}: New port ${port} -> ${internalPort}`);

        // Stop/Remove old
        try {
            await execAsync(`docker stop ${containerName}`);
            await execAsync(`docker rm ${containerName}`);
        } catch (e) { }

        // Construct new command
        const newCommand = `docker run -d --name ${containerName} -p ${port}:${internalPort} ${imageName}`;

        // Execute start
        await execAsync(newCommand);

        // Update Registry
        await prisma.processRegistry.update({
            where: { id: processId },
            data: {
                port,
                command: newCommand,
                status: 'running',
                startedAt: new Date(),
                stoppedAt: null
            }
        });

        broadcastProcesses().catch(() => { });
        return { success: true, port };
    } catch (error: any) {
        console.error('Failed to reconfigure port:', error);
        return { success: false, error: error?.message || 'Failed to reconfigure port' };
    }
}
// ...existing exports...

/**
 * Manage App Lifecycle (Start/Stop/Restart)
 * Optimized for local web apps (Vite, Next.js, etc.)
 */
export async function manageAppLifecycle(args: { action: 'start' | 'stop' | 'restart' | 'status', target?: string, script?: string, stopOthers?: boolean, runMode?: 'dev' | 'prod' }) {
    try {
        const user = await getDemoUser();
        const root = process.cwd();
        // ... (existing variable declarations) ...
        let appPath = root;
        let appName = 'Root App';

        // Resolve Target Path
        if (args.target) {
            if (!args.target.startsWith('/') && !args.target.includes(':') && !args.target.startsWith('.')) {
                // Try Repo App first
                const repoAppPath = join(root, 'apps', args.target);
                try {
                    await readFile(join(repoAppPath, 'package.json')); // Check existence
                    appPath = repoAppPath;
                    appName = args.target;
                } catch {
                    // Fallback to relative from root
                    appPath = join(root, args.target);
                    appName = args.target.split(/[\\/]/).pop() || 'App';
                }
            } else {
                appPath = join(root, args.target); // Absolute or relative
                appName = args.target.split(/[\\/]/).pop() || 'App';
            }
        }

        const processName = `App: ${appName}`;

        // Find existing process registry
        let proc = await prisma.processRegistry.findFirst({
            where: {
                userId: user.id,
                OR: [
                    { path: appPath },
                    { path: `apps/${appName}` },
                    { name: processName },
                    { name: appName } // Fallback match
                ]
            }
        });

        if (args.action === 'status') {
            return { success: true, status: proc?.status || 'stopped', process: deepSerialize(proc) };
        }

        if (args.action === 'stop') {
            if (proc) return await stopProcess(proc.id);
            return { success: false, message: 'Process not running' };
        }

        if (args.action === 'restart') {
            if (proc) return await restartProcess(proc.id);
            return { success: false, message: 'Process not running' };
        }

        if (args.action === 'start') {
            const enforcedPreviewPort = await ensurePreviewPortDefaults();

            if (args.runMode && proc && isDockerProcess(proc)) {
                const meta = (proc.metadata as any) || {};
                const dockerFile = args.runMode === 'dev' ? 'Dockerfile.dev' : 'Dockerfile';
                const updatedProc = await prisma.processRegistry.update({
                    where: { id: proc.id },
                    data: {
                        metadata: {
                            ...meta,
                            runMode: args.runMode,
                            dockerFile
                        }
                    }
                });
                proc = updatedProc;
            }
            // STOP OTHERS IF REQUESTED
            if (args.stopOthers) {
                const runningApps = await prisma.processRegistry.findMany({
                    where: {
                        userId: user.id,
                        status: 'running',
                        type: { in: ['docker-dev', 'repo-app', 'dev-server', 'docker-app'] }
                    }
                });

                if (runningApps.length > 0) {
                    console.log(`🛑 Stopping ${runningApps.length} other apps before start...`);
                    await Promise.all(runningApps.map(app => stopProcess(app.id)));
                    // Brief pause to ensure ports enable
                    await Promise.all(runningApps.map(app => app.port ? waitForPortAvailable(app.port, 8000) : Promise.resolve()));
                }

                // Refresh proc in case we just stopped the target (if it was running)
                if (proc) {
                    const refreshed = await prisma.processRegistry.findUnique({ where: { id: proc.id } });
                    if (refreshed) proc = refreshed;
                }
            }

            const previewPort = Number(process.env.PREVIEW_PORT || enforcedPreviewPort);
            const usePreviewPort = Number.isFinite(previewPort) && previewPort > 0;

            if (proc && proc.status === 'running') {
                // If we enforce a preview port, and this app is running on a different port,
                // we should consider it "not running" effectively, and force a restart on the correct port.
                if (usePreviewPort && proc.port !== previewPort) {
                    console.log(`App ${proc.name} running on ${proc.port}, but needed on ${previewPort}. Restarting...`);
                    await stopProcess(proc.id);
                    // proc is now stopped, fall through to start logic
                } else {
                    const meta = proc.metadata as any;
                    const publicUrl = meta?.publicUrl as string | undefined;
                    return {
                        success: true,
                        message: `App is already running on port ${proc.port}`,
                        previewUrl: publicUrl || `http://localhost:${proc.port}`,
                        publicUrl,
                        process: deepSerialize(proc)
                    };
                }
            }

            // 1. Delegate to startProcess if already registered (handles Docker correctly)
            if (proc) {
                const result = await startProcess(proc.id);
                if (result.success && result.process) {
                    const meta = (result.process as any).metadata || {};
                    const publicUrl = meta.publicUrl as string | undefined;
                    return {
                        success: true,
                        message: `Started ${appName}`,
                        previewUrl: publicUrl || (result.process.port ? `http://localhost:${result.process.port}` : undefined),
                        publicUrl,
                        process: result.process
                    };
                }
                return result;
            }

            // 2. Read package.json to find script
            const pkgPath = join(appPath, 'package.json');
            let pkg: any;
            try {
                const pkgRaw = await readFile(pkgPath, 'utf-8');
                pkg = JSON.parse(pkgRaw);
            } catch (e) {
                return { success: false, message: `No package.json found at ${appPath}` };
            }

            // 3. Determine Script
            const script = args.script || (pkg.scripts?.dev ? 'dev' : pkg.scripts?.start ? 'start' : null);
            if (!script) return { success: false, message: 'No "dev" or "start" script found in package.json' };

            // 4. Find Port (prefer reserved preview port when configured)
            // variables previewPort and usePreviewPort are already declared above
            let port = usePreviewPort ? previewPort : await getAvailablePort(5000, 5999);

            if (usePreviewPort && !(await isPortAvailable(previewPort))) {
                const existingOnPort = await prisma.processRegistry.findFirst({
                    where: { userId: user.id, port: previewPort }
                });

                if (existingOnPort) {
                    await stopProcess(existingOnPort.id);
                }

                if (!(await isPortAvailable(previewPort))) {
                    return { success: false, message: `Preview port ${previewPort} is already in use` };
                }

                port = previewPort;
            }

            // 5. Construct Command (Framework Aware)
            let actualCmd = `npm run ${script}`;
            let env = { ...process.env, PORT: port.toString(), BROWSER: 'none' };

            if (pkg.devDependencies?.vite || pkg.dependencies?.vite) {
                // Vite needs --port and --host
                actualCmd = `npm run ${script} -- --port ${port} --host`;
            } else if (pkg.dependencies?.next) {
                // Next.js needs -p
                actualCmd = `npm run ${script} -- -p ${port}`;
            } else {
                // Fallback for generic Node apps
                actualCmd = `npm run ${script}`;
                // Hope they respect PORT env var
            }

            // 6. Register/Update DB (Pending)
            if (!proc) {
                proc = await prisma.processRegistry.create({
                    data: {
                        name: processName,
                        type: 'dev-server',
                        path: appPath,
                        command: actualCmd,
                        userId: user.id,
                        status: 'pending',
                        metadata: { appName }
                    }
                });
            }

            // 7. Execute (Background)
            console.log(`🚀 Starting ${appName} with: ${actualCmd} (Port ${port})`);
            const child = exec(actualCmd, { cwd: appPath, env: env as any });

            if (!child.pid) throw new Error('Failed to spawn process');

            // Log output for debugging
            child.stdout?.on('data', (data) => console.log(`[${appName}]`, data));
            child.stderr?.on('data', (data) => console.error(`[${appName}]`, data));

            // 8. Update DB to Running
            const updated = await prisma.processRegistry.update({
                where: { id: proc.id },
                data: {
                    pid: child.pid,
                    port: port,
                    status: 'running',
                    startedAt: new Date(),
                    stoppedAt: null,
                    command: actualCmd
                }
            });

            const tunnel = await ensurePublicAccess(updated.id, port);
            const publicUrl = (tunnel as any)?.publicUrl || (tunnel as any)?.process?.metadata?.publicUrl;
            const finalProcess = publicUrl
                ? await prisma.processRegistry.findUnique({ where: { id: updated.id } })
                : updated;

            return {
                success: true,
                message: `Started ${appName} on port ${port}`,
                previewUrl: publicUrl || `http://localhost:${port}`,
                publicUrl,
                process: deepSerialize(finalProcess)
            };
        }

        return { success: false, message: `Invalid action: ${args.action}` };

    } catch (e: any) {
        console.error('manageAppLifecycle error:', e);
        return { success: false, message: `Error: ${e.message}` };
    }
}

export async function setAppRunMode(target: string, runMode: 'dev' | 'prod') {
    try {
        const user = await getDemoUser();
        const root = process.cwd();
        let appPath = root;
        let appName = 'Root App';

        if (target) {
            if (!target.startsWith('/') && !target.includes(':') && !target.startsWith('.')) {
                const repoAppPath = join(root, 'apps', target);
                try {
                    await readFile(join(repoAppPath, 'package.json'));
                    appPath = repoAppPath;
                    appName = target;
                } catch {
                    appPath = join(root, target);
                    appName = target.split(/[\\/]/).pop() || 'App';
                }
            } else {
                appPath = join(root, target);
                appName = target.split(/[\\/]/).pop() || 'App';
            }
        }

        const processName = `App: ${appName}`;
        const proc = await prisma.processRegistry.findFirst({
            where: {
                userId: user.id,
                OR: [
                    { path: appPath },
                    { path: `apps/${appName}` },
                    { name: processName },
                    { name: appName }
                ]
            }
        });

        if (!proc) {
            return { success: false, message: 'Process not found. Start the app once to register it.' };
        }

        const meta = (proc.metadata as any) || {};
        const dockerFile = runMode === 'dev' ? 'Dockerfile.dev' : 'Dockerfile';
        const updated = await prisma.processRegistry.update({
            where: { id: proc.id },
            data: {
                metadata: {
                    ...meta,
                    runMode,
                    dockerFile
                }
            }
        });

        return { success: true, process: deepSerialize(updated) };
    } catch (error: any) {
        console.error('setAppRunMode error:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Toggle Public Access (Ngrok Tunnel)
 */
export async function togglePublicAccess(id: string, options?: { mode?: 'toggle' | 'ensure', targetPort?: number }) {
    try {
        const user = await getDemoUser();
        const process = await prisma.processRegistry.findFirst({
            where: { id, userId: user.id }
        });

        if (!process) {
            return { success: false, message: 'Process not found' };
        }

        const meta = (process.metadata as any) || {};
        const mode = options?.mode || 'toggle';
        const targetPort = options?.targetPort || process.port;
        const currentPublicUrl = meta.publicUrl;
        const ngrokContainerName = `ngrok-${process.id}`;

        // IF PUBLIC URL EXISTS
        if (currentPublicUrl) {
            if (mode === 'ensure') {
                return { success: true, isPublic: true, publicUrl: currentPublicUrl, process: deepSerialize(process) };
            }

            try {
                // Safe: Remove ngrok container
                await dockerExec(['rm', '-f', ngrokContainerName]);
            } catch (e) {
                // Ignore if already gone
            }

            const updated = await prisma.processRegistry.update({
                where: { id },
                data: {
                    metadata: {
                        ...meta,
                        publicUrl: undefined,
                        publicUrlId: undefined
                    }
                }
            });

            return { success: true, isPublic: false, process: deepSerialize(updated) };
        }

        // IF NO PUBLIC URL -> START TUNNEL
        if (!targetPort) {
            return { success: false, message: 'Process has no port assigned' };
        }

        // If an ngrok tunnel is already running (manual or external), reuse it.
        const existingTunnel = await getNgrokUrl(`http://localhost:${targetPort}`);
        if (existingTunnel.success && existingTunnel.url) {
            const updated = await prisma.processRegistry.update({
                where: { id },
                data: {
                    metadata: {
                        ...meta,
                        publicUrl: existingTunnel.url
                    }
                }
            });
            return { success: true, isPublic: true, publicUrl: existingTunnel.url, process: deepSerialize(updated) };
        }

        const authToken = (global as any).process.env.NGROK_AUTHTOKEN;
        if (!authToken) {
            return { success: false, message: 'NGROK_AUTHTOKEN not configured' };
        }

        // 1. Start Ngrok Container
        // Prefer fixed 4040 mapping; fall back to random if busy
        let apiPort = 4040;
        try {
            // Safe: Remove existing ngrok container
            await dockerExec(['rm', '-f', ngrokContainerName]).catch(() => { });

            // Safe: Run ngrok container with explicit parameters
            await dockerExec([
                'run', '-d',
                '--name', ngrokContainerName,
                '-p', '4040:4040',
                '-e', `NGROK_AUTHTOKEN=${authToken}`,
                'ngrok/ngrok',
                'http',
                `host.docker.internal:${targetPort}`
            ]);
        } catch (e: any) {
            if (isDockerDaemonUnavailable(e)) {
                return { success: false, message: 'Docker daemon unavailable; tunnel not started' };
            }
            try {
                apiPort = 0; // we'll resolve the random published port below

                // Safe: Fallback with random port
                await dockerExec([
                    'run', '-d',
                    '--name', ngrokContainerName,
                    '-P', // Random port mapping
                    '-e', `NGROK_AUTHTOKEN=${authToken}`,
                    'ngrok/ngrok',
                    'http',
                    `host.docker.internal:${targetPort}`
                ]);
            } catch (fallbackError: any) {
                if (!isDockerDaemonUnavailable(fallbackError)) {
                    console.error('Failed to start ngrok container', fallbackError);
                }
                return { success: false, message: 'Failed to start tunnel container' };
            }
        }

        // 2. Wait for it to initialize (Polling with timeout)
        let publicUrl = '';
        const pollStart = Date.now();
        const MAX_POLL = 10000; // 10s max

        while (Date.now() - pollStart < MAX_POLL) {
            try {
                // If random port, resolve it first
                if (apiPort === 0) {
                    // Safe: Get container port mapping
                    const { stdout } = await dockerExec(['port', ngrokContainerName, '4040']).catch(() => ({ stdout: '' }));
                    const match = stdout.match(/:(\d+)/);
                    if (match) apiPort = parseInt(match[1]);
                }

                if (apiPort !== 0) {
                    const res = await fetch(`http://localhost:${apiPort}/api/tunnels`).catch(() => null);
                    if (res && res.ok) {
                        const data = await res.json();
                        publicUrl = data.tunnels?.[0]?.public_url;
                        if (publicUrl) break;
                    }
                }
            } catch (queryError) {
                // Ignore query errors during startup
            }
            await new Promise(r => setTimeout(r, 500));
        }

        if (!publicUrl) {
            // Safe: Cleanup failed ngrok container
            await dockerExec(['rm', '-f', ngrokContainerName]).catch(() => { });
            return { success: false, message: 'Tunnel failed to initialize or provide public URL' };
        }

        // 5. Update Registry
        const updated = await prisma.processRegistry.update({
            where: { id: process.id },
            data: {
                metadata: {
                    ...meta,
                    publicUrl,
                    ngrokContainer: ngrokContainerName,
                    ngrokApiPort: apiPort
                }
            }
        });

        return { success: true, isPublic: true, publicUrl, process: deepSerialize(updated) };

    } catch (error: any) {
        console.error('Error toggling public access:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Get the global ngrok URL if running
 */
/**
 * Get the ngrok URL for a given process or the first active one
 */
export async function getNgrokUrl(localUrl?: string) {
    const logs: string[] = [];
    logs.push(`[${new Date().toLocaleTimeString()}] Starting ngrok detection...`);

    try {
        // 1. Check Database Registry (Most reliable)
        logs.push('Querying database process registry...');
        const processes = await prisma.processRegistry.findMany({
            where: {
                status: 'running'
            }
        });

        for (const proc of processes) {
            const meta = proc.metadata as any;
            if (meta?.publicUrl) {
                // If localUrl is provided, try to match by port
                if (localUrl) {
                    const portMatch = localUrl.match(/:(\d+)/);
                    const targetPort = portMatch ? parseInt(portMatch[1]) : null;
                    if (targetPort && proc.port === targetPort) {
                        logs.push(`SUCCESS: Found matching tunnel in DB: ${meta.publicUrl} for port ${targetPort}`);
                        return { success: true, url: meta.publicUrl, logs };
                    }
                } else {
                    // Return first available if no filter
                    logs.push(`SUCCESS: Found tunnel in DB: ${meta.publicUrl}`);
                    return { success: true, url: meta.publicUrl, logs };
                }
            }
        }
    } catch (dbError: any) {
        logs.push(`Database check failed: ${dbError.message}`);
    }

    // 2. Fallback: Check local dashboard endpoints (Standard ngrok)
    // This is useful if ngrok was started manually or registry is stale
    const endpoints = [
        'http://localhost:4040/api/tunnels',
        'http://127.0.0.1:4040/api/tunnels',
        'http://host.docker.internal:4040/api/tunnels',
        'http://ngrok:4040/api/tunnels'
    ];

    for (const endpoint of endpoints) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000);

        try {
            logs.push(`Checking fallback endpoint: ${endpoint}`);
            const res = await fetch(endpoint, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                signal: controller.signal,
                cache: 'no-store'
            });

            if (res.ok) {
                const data = await res.json();
                const tunnel = data.tunnels?.find((t: any) => t.public_url && t.public_url.startsWith('https'));
                if (tunnel?.public_url) {
                    logs.push(`SUCCESS: Found tunnel ${tunnel.public_url} at ${endpoint}`);
                    clearTimeout(timeoutId);
                    return { success: true, url: tunnel.public_url, logs };
                }
            }
        } catch (e: any) {
            // Silently continue
        } finally {
            clearTimeout(timeoutId);
        }
    }

    logs.push('Final: No active ngrok tunnel detected in DB or local endpoints.');
    return { success: false, url: null, logs };
}
