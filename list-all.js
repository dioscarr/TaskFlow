
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listAll() {
    const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
    const files = await prisma.workspaceFile.findMany({
        where: { userId: user.id }
    });
    console.log(JSON.stringify(files.map(f => ({ id: f.id, name: f.name, parentId: f.parentId })), null, 2));
    process.exit(0);
}

listAll().catch(err => {
    console.error(err);
    process.exit(1);
});
