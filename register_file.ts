
import { PrismaClient } from '@prisma/client';
import { rename, mkdir, stat } from 'fs/promises';
import { join } from 'path';

const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
    if (!user) {
        console.error('User not found');
        return;
    }

    const filename = 'premium_demo.html';
    const sourcePath = join(process.cwd(), 'public', filename);
    const targetDir = join(process.cwd(), 'public', 'uploads', '_root_');
    const targetPath = join(targetDir, filename);

    // Ensure target directory exists
    await mkdir(targetDir, { recursive: true });

    // Move file
    try {
        await rename(sourcePath, targetPath);
        console.log(`Moved file to ${targetPath}`);
    } catch (e) {
        console.error('Failed to move file (it might already be there or missing):', e);
        // Try to continue if file exists at target
        try {
            await stat(targetPath);
        } catch {
            console.error('File definitely missing.');
            return;
        }
    }

    const relativeStoragePath = `_root_/${filename}`;
    const stats = await stat(targetPath);

    // Upsert into DB
    const existing = await prisma.workspaceFile.findFirst({
        where: {
            userId: user.id,
            name: filename,
            parentId: null
        }
    });

    if (existing) {
        await prisma.workspaceFile.update({
            where: { id: existing.id },
            data: {
                storagePath: relativeStoragePath,
                size: `${stats.size} bytes`,
                type: 'html'
            }
        });
        console.log('Updated existing file record.');
    } else {
        await prisma.workspaceFile.create({
            data: {
                name: filename,
                type: 'html',
                size: `${stats.size} bytes`,
                userId: user.id,
                parentId: null,
                storagePath: relativeStoragePath,
                tags: ['demo', 'premium']
            }
        });
        console.log('Created new file record.');
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
