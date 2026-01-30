
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const jobs = await prisma.agentJob.findMany({
        where: {
            status: { in: ['running', 'queued'] }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
    });
    console.log(JSON.stringify(jobs, null, 2));
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
