'use server';

import prisma from '@/lib/prisma';
import { deepSerialize } from '@/lib/serialization';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import {
    ProcessInput,
    getDemoUser,
    syncDockerAppProcesses,
    syncRepoAppProcesses,
    isDockerProcess,
    execAsync,
    getAvailablePort,
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
            const containerName = process.metadata?.containerName as string | undefined;
            const appPath = process.metadata?.appPath as string | undefined;
            const imageName = process.metadata?.imageName as string | undefined;

            if (process.metadata?.source === 'repo-app' && appPath && containerName && imageName) {
                let internalPort = 3000;
                let dockerFileName = 'Dockerfile.taskflow';
                let useExistingDockerfile = false;

                // Check if a custom Dockerfile exists
                try {
                    const existingDockerfileContent = await readFile(join(appPath, 'Dockerfile'), 'utf-8');
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

                let startScript = process.metadata?.startScript as string | undefined;

                if (!useExistingDockerfile) {
                    if (!startScript) {
                        try {
                            const pkgRaw = await readFile(join(appPath, 'package.json'), 'utf-8');
                            const pkg = JSON.parse(pkgRaw) as { scripts?: Record<string, string> };
                            startScript = resolveStartScript(pkg.scripts || null) || undefined;
                        } catch {
                            startScript = undefined;
                        }
                    }

                    if (!startScript) {
                        return { success: false, message: 'package.json is missing a start/preview/dev script' };
                    }

                    const dockerfilePath = join(appPath, 'Dockerfile.taskflow');
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

                const port = await getAvailablePort();
                const dockerfilePath = join(appPath, dockerFileName);

                try {
                    await execAsync(`docker rm -f ${containerName}`);
                } catch {
                    // ignore if container doesn't exist
                }

                try {
                    await execAsync(`docker build -t ${imageName} -f "${dockerfilePath}" "${appPath}"`);
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

        const commonPorts = [3000, 3001, 5173, 5174, 5175, 5176, 8080, 8081, 4200, 5000, 5001];
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
                        // Create the process record
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
            console.log('Failed to detect port via docker inspect, defaulting to 3000', e);
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
