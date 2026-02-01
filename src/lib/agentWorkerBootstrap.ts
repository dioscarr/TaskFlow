import { spawn } from 'child_process';

import { execAsync } from '@/lib/processActionsCore';

type BootstrapState = {
    __agentWorkerBootstrap?: Promise<void>;
};

const getBootstrapState = () => globalThis as typeof globalThis & BootstrapState;

const resolveComposeCommand = async () => {
    try {
        await execAsync('docker compose version');
        return 'docker compose';
    } catch {
        // ignore
    }

    try {
        await execAsync('docker-compose version');
        return 'docker-compose';
    } catch {
        // ignore
    }

    return null;
};

const isDockerAvailable = async () => {
    try {
        await execAsync('docker version');
        return true;
    } catch {
        return false;
    }
};

const isWorkerContainerRunning = async (composeCommand: string) => {
    try {
        const { stdout } = await execAsync(`${composeCommand} -f docker-compose.agents.yml ps --status running -q agent-worker`);
        return stdout.trim().length > 0;
    } catch {
        return false;
    }
};

const startDockerWorker = async (composeCommand: string) => {
    await execAsync(`${composeCommand} -f docker-compose.agents.yml up -d --scale agent-worker=1`);
};

const startLocalWorker = () => {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(npmCommand, ['run', 'agent:start'], {
        cwd: process.cwd(),
        stdio: 'ignore',
        detached: true,
        env: {
            ...process.env,
            AGENT_CONCURRENCY: '1'
        }
    });
    child.unref();
};

export const ensureAgentWorkerAvailable = async () => {
    if (process.env.NEXT_RUNTIME === 'edge') return;

    const bootstrapState = getBootstrapState();
    if (bootstrapState.__agentWorkerBootstrap) {
        await bootstrapState.__agentWorkerBootstrap;
        return;
    }

    bootstrapState.__agentWorkerBootstrap = (async () => {
        try {
            const dockerAvailable = await isDockerAvailable();
            if (!dockerAvailable) {
                startLocalWorker();
                return;
            }

            const composeCommand = await resolveComposeCommand();
            if (!composeCommand) {
                startLocalWorker();
                return;
            }

            const isRunning = await isWorkerContainerRunning(composeCommand);
            if (!isRunning) {
                await startDockerWorker(composeCommand);
            }
        } catch (error) {
            console.error('Failed to ensure Docker agent worker is running:', error);
            try {
                startLocalWorker();
            } catch (fallbackError) {
                console.error('Failed to start local agent worker fallback:', fallbackError);
            }
        }
    })();

    await bootstrapState.__agentWorkerBootstrap;
};
