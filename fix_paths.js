const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

async function main() {
    const files = await prisma.workspaceFile.findMany({
        where: { storagePath: null }
    });
    console.log(`Found ${files.length} files with null storagePath`);

    const baseDir = path.join(process.cwd(), 'public', 'uploads');

    for (const file of files) {
        const directoryName = file.parentId ? file.parentId : '_root_';
        const storagePath = `${directoryName}/${file.name}`;

        const oldPath = path.join(baseDir, file.name);
        const newDir = path.join(baseDir, directoryName);
        const newPath = path.join(newDir, file.name);

        if (!fs.existsSync(newDir)) {
            fs.mkdirSync(newDir, { recursive: true });
        }

        if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
            console.log(`Moving ${file.name} to ${directoryName}/`);
            fs.renameSync(oldPath, newPath);
        }

        await prisma.workspaceFile.update({
            where: { id: file.id },
            data: { storagePath }
        });
        console.log(`Updated DB: ${file.name} -> ${storagePath}`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
