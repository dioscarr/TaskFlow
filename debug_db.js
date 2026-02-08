
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const processes = await prisma.processRegistry.findMany();
    console.log(JSON.stringify(processes, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
