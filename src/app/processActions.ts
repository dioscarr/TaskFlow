'use server';

import prisma from '@/lib/prisma';
import { deepSerialize } from '@/lib/serialization';
import { writeFile, readFile } from 'fs/promises';
import { exec } from 'child_process';
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
    resolveStartScript
} from '@/lib/processActionsCore';

export { type ProcessInput };

/**
 * List all processes for the current user
 */
export async function listProcesses() {
    try {
        const user = await getDemoUser();
        await syncDockerAppProcesses(user.id);
        await syncRepoAppProcesses(user.id);
        const processes = await prisma.processRegistry.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' }
        });

        return { success: true, processes: deepSerialize(processes) };
    } catch (error: any) {
        console.error('Error listing processes:', error);
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

        return { success: true, process: deepSerialize(process) };
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
            const containerName = (process.metadata as any)?.containerName as string | undefined;
            if (containerName) {
                try {
                    await execAsync(`docker stop ${containerName}`);
                } catch (dockerError: any) {
                    console.error('Error stopping docker container:', dockerError);
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

            // Kill by port if no PID
            if (process.port && !process.pid) {
                try {
                    const cmd = `Stop-Process -Id (Get-NetTCPConnection -LocalPort ${process.port}).OwningProcess -Force`;
                    await execAsync(`powershell -Command "${cmd}"`);
                } catch (portError: any) {
                    console.error('Error killing process by port:', portError);
                }
            }
        }

        // Update database
        const updated = await prisma.processRegistry.update({
            where: { id },
            data: {
                status: 'stopped',
                stoppedAt: new Date()
            }
        });

        return { success: true, process: deepSerialize(updated) };
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
                    await execAsync(`docker restart ${containerName}`);
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

        return { success: true, process: deepSerialize(updated) };
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

                // Access global process for cwd, avoiding shadow
                const currentDir = (global as any).process.cwd();
                const absAppPath = (process as any).type === 'docker-dev' && appPath ? join(currentDir, appPath) : appPath || '';

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
                const previewPort = Number((global as any).process.env.PREVIEW_PORT || '');
                const usePreviewPort = Number.isFinite(previewPort) && previewPort > 0;
                let port = usePreviewPort ? previewPort : await getAvailablePort(5000, 5999);

                if (usePreviewPort) {
                    try {
                        // Kill anything on this port first
                        // Windows/Powershell way
                        await execAsync(`powershell -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort ${port}).OwningProcess -Force"`);
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

                try {
                    await execAsync(`docker rm -f ${containerName}`);
                } catch {
                    // ignore if container doesn't exist
                }

                try {
                    await execAsync(`docker build -t ${imageName} -f "${dockerfilePath}" "${absAppPath}"`);
                    await execAsync(`docker run -d --name ${containerName} -p ${port}:${internalPort} ${imageName}`);
                } catch (dockerError: any) {
                    console.error('Error starting docker container:', dockerError);
                    return { success: false, message: 'Failed to start docker container' };
                }

                const updated = await prisma.processRegistry.update({
                    where: { id },
                    data: {
                        status: 'running',
                        port,
                        startedAt: new Date(),
                        stoppedAt: null,
                        metadata: {
                            ...process.metadata as any,
                            startScript
                        }
                    }
                });

                return { success: true, process: deepSerialize(updated) };
            }

            if (containerName) {
                try {
                    await execAsync(`docker start ${containerName}`);
                } catch (dockerError: any) {
                    console.error('Error starting docker container:', dockerError);
                    return { success: false, message: 'Failed to start docker container' };
                }
            }

            const updated = await prisma.processRegistry.update({
                where: { id },
                data: {
                    status: 'running',
                    startedAt: new Date(),
                    stoppedAt: null
                }
            });

            return { success: true, process: deepSerialize(updated) };
        }

        // This would need proper process spawning implementation
        // For now, we'll just update the status
        // In a real implementation, use child_process.spawn() and track the PID

        const updated = await prisma.processRegistry.update({
            where: { id },
            data: {
                status: 'running',
                startedAt: new Date(),
                stoppedAt: null
            }
        });

        return { success: true, process: deepSerialize(updated), message: 'To start the process, run the command manually for now' };
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
                const { stdout } = await execAsync(`netstat -ano | findstr :${process.port}`);
                healthStatus = stdout.includes(`${process.port}`) ? 'healthy' : 'unhealthy';
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
        await syncDockerAppProcesses(user.id);
        await syncRepoAppProcesses(user.id); // Also sync repo apps

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
                    await execAsync(`docker rm -f ${containerName}`);
                } catch (dockerError: any) {
                    console.error('Error removing docker container:', dockerError);
                }
            }
        }

        await prisma.processRegistry.delete({
            where: { id }
        });

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

        const { stdout, stderr } = await execAsync(`docker logs --tail 100 ${containerName}`);
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
export async function manageAppLifecycle(args: { action: 'start' | 'stop' | 'restart' | 'status', target?: string, script?: string }) {
    try {
        const user = await getDemoUser();
        const root = process.cwd();
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
                    { path: `apps/${appName}` }
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
            const previewPort = Number(process.env.PREVIEW_PORT || '');
            const usePreviewPort = Number.isFinite(previewPort) && previewPort > 0;

            if (proc && proc.status === 'running') {
                // If we enforce a preview port, and this app is running on a different port,
                // we should consider it "not running" effectively, and force a restart on the correct port.
                if (usePreviewPort && proc.port !== previewPort) {
                    console.log(`App ${proc.name} running on ${proc.port}, but needed on ${previewPort}. Restarting...`);
                    await stopProcess(proc.id);
                    // proc is now stopped, fall through to start logic
                } else {
                    return {
                        success: true,
                        message: `App is already running on port ${proc.port}`,
                        previewUrl: `http://localhost:${proc.port}`,
                        process: deepSerialize(proc)
                    };
                }
            }

            // 1. Delegate to startProcess if already registered (handles Docker correctly)
            if (proc) {
                const result = await startProcess(proc.id);
                if (result.success && result.process) {
                    return {
                        success: true,
                        message: `Started ${appName}`,
                        previewUrl: result.process.port ? `http://localhost:${result.process.port}` : undefined,
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

            return {
                success: true,
                message: `Started ${appName} on port ${port}`,
                previewUrl: `http://localhost:${port}`,
                process: deepSerialize(updated)
            };
        }

        return { success: false, message: `Invalid action: ${args.action}` };

    } catch (e: any) {
        console.error('manageAppLifecycle error:', e);
        return { success: false, message: `Error: ${e.message}` };
    }
}

/**
 * Toggle Public Access (Ngrok Tunnel)
 */
export async function togglePublicAccess(id: string) {
    try {
        const user = await getDemoUser();
        const process = await prisma.processRegistry.findFirst({
            where: { id, userId: user.id }
        });

        if (!process) {
            return { success: false, message: 'Process not found' };
        }

        const meta = (process.metadata as any) || {};
        const currentPublicUrl = meta.publicUrl;
        const ngrokContainerName = `ngrok-${process.id}`;

        // IF PUBLIC URL EXISTS -> STOP TUNNEL
        if (currentPublicUrl) {
            try {
                await execAsync(`docker rm -f ${ngrokContainerName}`);
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
        if (!process.port) {
            return { success: false, message: 'Process has no port assigned' };
        }

        const authToken = (global as any).process.env.NGROK_AUTHTOKEN;
        if (!authToken) {
            return { success: false, message: 'NGROK_AUTHTOKEN not configured' };
        }

        // 1. Start Ngrok Container
        // We look for host.docker.internal to access the app on the host machine
        // We use -P to publish the API port (4040) to a random host port
        try {
            // Clean up any stale container
            await execAsync(`docker rm -f ${ngrokContainerName}`).catch(() => { });

            await execAsync(
                `docker run -d --name ${ngrokContainerName} -P -e NGROK_AUTHTOKEN=${authToken} ngrok/ngrok http host.docker.internal:${process.port}`
            );
        } catch (e: any) {
            console.error('Failed to start ngrok container', e);
            return { success: false, message: 'Failed to start tunnel container' };
        }

        // 2. Wait for it to initialize
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 3. Find the API port
        let apiPort = 0;
        try {
            const { stdout } = await execAsync(`docker port ${ngrokContainerName} 4040`);
            // Output format depends on OS, usually 0.0.0.0:32768
            const match = stdout.match(/:(\d+)/);
            if (match) {
                apiPort = parseInt(match[1]);
            }
        } catch (e) {
            await execAsync(`docker rm -f ${ngrokContainerName}`);
            return { success: false, message: 'Failed to detect tunnel port' };
        }

        if (!apiPort) {
            await execAsync(`docker rm -f ${ngrokContainerName}`);
            return { success: false, message: 'Failed to detect tunnel port' };
        }

        // 4. Query Ngrok API for Public URL
        let publicUrl = '';
        try {
            const res = await fetch(`http://localhost:${apiPort}/api/tunnels`);
            const data = await res.json();
            publicUrl = data.tunnels?.[0]?.public_url;
        } catch (e) {
            console.error('Failed to fetch tunnels from ngrok api', e);
        }

        if (!publicUrl) {
            // Try one more time with a slightly longer delay
            await new Promise(resolve => setTimeout(resolve, 2000));
            try {
                const res = await fetch(`http://localhost:${apiPort}/api/tunnels`);
                const data = await res.json();
                publicUrl = data.tunnels?.[0]?.public_url;
            } catch (e) { }
        }

        if (!publicUrl) {
            await execAsync(`docker rm -f ${ngrokContainerName}`);
            return { success: false, message: 'Failed to obtain public URL from tunnel' };
        }

        // 5. Update Registry
        const updated = await prisma.processRegistry.update({
            where: { id },
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
