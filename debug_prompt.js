
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const active = await prisma.aIPromptSet.findFirst({
        where: { isActive: true }
    });
    console.log('--- CURRENT ACTIVE PROMPT ---');
    console.log(active ? active.prompt : 'No active prompt found');
    console.log('-----------------------------');
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
