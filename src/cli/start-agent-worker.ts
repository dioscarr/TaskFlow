import { spawn } from 'child_process';
import path from 'path';

/**
 * lifecycle manager for the agent worker.
 * Restarts the worker if it crashes and handles graceful shutdown.
 */
function startWorker() {
    console.log('🚀 Starting Agent Worker Lifecycle Manager...');

    const workerPath = path.join(process.cwd(), 'src/cli/agent-worker.ts');

    const worker = spawn('npx', ['tsx', workerPath], {
        stdio: 'inherit',
        env: { ...process.env, AGENT_WORKER_ID: `worker-main-${process.pid}` },
        shell: true
    });

    worker.on('exit', (code) => {
        console.log(`📡 Worker exited with code ${code}. Restarting in 5s...`);
        setTimeout(startWorker, 5000);
    });

    process.on('SIGINT', () => {
        console.log('🛑 Shutting down worker...');
        worker.kill('SIGINT');
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('🛑 Shutting down worker...');
        worker.kill('SIGTERM');
        process.exit(0);
    });
}

startWorker();
