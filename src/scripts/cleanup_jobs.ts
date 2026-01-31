
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🧹 Cleaning up stuck background jobs...');

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const result = await prisma.agentJob.updateMany({
        where: {
            status: { in: ['running', 'queued', 'pending'] },
            createdAt: { lt: fiveMinutesAgo }
        },
        data: {
            status: 'failed',
            error: 'Force failing stuck job (timeout > 5m)',
            finishedAt: new Date()
        }
    });

    console.log(`✅ Marked ${result.count} stuck jobs as failed.`);

    await prisma.$disconnect();
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
