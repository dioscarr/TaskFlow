
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const files = await prisma.workspaceFile.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10
        });
        console.log('Recent files:', JSON.stringify(files, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
