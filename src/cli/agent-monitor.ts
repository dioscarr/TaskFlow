import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient() as any;

async function monitorAgents() {
    console.log('📊 Agent System Monitor');
    console.log('----------------------');

    while (true) {
        try {
            const [queued, running, succeeded, failed, totalMessages] = await Promise.all([
                prisma.agentJob.count({ where: { status: 'queued' } }),
                prisma.agentJob.count({ where: { status: 'running' } }),
                prisma.agentJob.count({ where: { status: 'succeeded' } }),
                prisma.agentJob.count({ where: { status: 'failed' } }),
                prisma.agentMessage.count()
            ]);

            const recentJobs = await prisma.agentJob.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    type: true,
                    status: true,
                    iteration: true,
                    createdAt: true
                }
            });

            console.clear();
            console.log('📊 Agent System Status');
            console.log(`Queued: ${queued} | Running: ${running} | Succeeded: ${succeeded} | Failed: ${failed}`);
            console.log(`Total Agent Messages: ${totalMessages}`);
            console.log('\n--- Recent Jobs ---');
            recentJobs.forEach((j: any) => {
                console.log(`[${j.status.toUpperCase()}] ${j.type} | Iteration: ${j.iteration} | ID: ${j.id.slice(-6)}`);
            });

            await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (error) {
            console.error('Monitor error:', error);
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }
}

monitorAgents().catch(console.error);
