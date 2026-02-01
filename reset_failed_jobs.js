
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const statusesToEnd = ['pending', 'queued', 'running'];
    console.log(`Deleting jobs with status: ${statusesToEnd.join(', ')}...`);
    const result = await prisma.agentJob.deleteMany({
        where: { status: { in: statusesToEnd } }
    });
    console.log(`Deleted ${result.count} jobs.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
