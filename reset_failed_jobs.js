
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Resetting failed jobs...');
    // Only reset last 50 failed jobs
    const jobs = await prisma.agentJob.findMany({
        where: { status: 'failed' },
        take: 50,
        orderBy: { updatedAt: 'desc' }
    });
    
    for (const job of jobs) {
        await prisma.agentJob.update({
            where: { id: job.id },
            data: { 
                status: 'queued', 
                iteration: 0, 
                attempts: 0,
                error: null 
            }
        });
    }
    console.log(`Reset ${jobs.length} jobs.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
