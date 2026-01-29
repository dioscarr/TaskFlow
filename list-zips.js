
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listZips() {
    const files = await prisma.workspaceFile.findMany({
        where: { name: { contains: '.zip' } }
    });
    console.log(JSON.stringify(files.map(f => ({ id: f.id, name: f.name, parentId: f.parentId })), null, 2));
    process.exit(0);
}

listZips().catch(err => {
    console.error(err);
    process.exit(1);
});
