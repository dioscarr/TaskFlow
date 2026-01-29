
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testMove() {
    const fileId = "cmkw67vrl00168zsgdr0wp84n";
    const targetFolderId = "cmkw8bh53005z8zsgh8snk3vw";

    console.log('--- BEFORE ---');
    const before = await prisma.workspaceFile.findUnique({ where: { id: fileId } });
    console.log('File Parent:', before.parentId);

    console.log('Updating...');
    const updated = await prisma.workspaceFile.update({
        where: { id: fileId },
        data: { parentId: targetFolderId, updatedAt: new Date() }
    });

    console.log('--- AFTER ---');
    console.log('File Parent:', updated.parentId);
    console.log('Updated At:', updated.updatedAt);

    process.exit(0);
}

testMove().catch(err => {
    console.error(err);
    process.exit(1);
});
