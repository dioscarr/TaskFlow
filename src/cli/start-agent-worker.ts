import { spawn } from 'child_process';
import path from 'path';

/**
 * lifecycle manager for the agent worker cluster.
 * Launches multiple workers for parallelism and handles restarts.
 */
const NUM_WORKERS = process.env.AGENT_CONCURRENCY ? parseInt(process.env.AGENT_CONCURRENCY) : 1;

function startWorker(workerIndex: number) {
    console.log(`🚀 Starting Agent Worker #${workerIndex + 1}...`);

    const workerPath = path.join(process.cwd(), 'src/cli/agent-worker.ts');

    const worker = spawn('npx', ['tsx', workerPath], {
        stdio: 'inherit',
        env: { ...process.env, AGENT_WORKER_ID: `worker-${workerIndex}-${process.pid}` },
        shell: true
    });

    worker.on('exit', (code) => {
        console.log(`📡 Worker #${workerIndex + 1} exited with code ${code}. Restarting in 5s...`);
        setTimeout(() => startWorker(workerIndex), 5000);
    });
}

function startCluster() {
    console.log(`🌍 Initializing Agent Cluster with ${NUM_WORKERS} workers...`);

    for (let i = 0; i < NUM_WORKERS; i++) {
        startWorker(i);
    }

    // Handle cluster shutdown
    const cleanup = () => {
        console.log('🛑 Shutting down agent cluster...');
        process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
}

startCluster();
