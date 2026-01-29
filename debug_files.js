
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const files = await prisma.workspaceFile.findMany({
            where: { type: 'html' },
            orderBy: { createdAt: 'desc' },
            take: 5
        });
        console.log('Recent HTML files:', JSON.stringify(files, null, 2));

        const folders = await prisma.workspaceFile.findMany({
            where: { type: 'folder' },
            select: { id: true, name: true }
        });
        console.log('Folders:', JSON.stringify(folders, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
