
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const activities = await prisma.agentActivity.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10
    });

    console.log('--- Recent Agent Activity ---');
    activities.forEach(a => {
        console.log(`[${a.type}] ${a.title}: ${a.message}`);
    });

    const jobs = await prisma.agentJob.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 5
    });

    console.log('\n--- Recent Jobs ---');
    jobs.forEach(j => {
        console.log(`Job ${j.id} (${j.status}) - Result: ${JSON.stringify(j.result)} Error: ${j.error}`);
    });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
