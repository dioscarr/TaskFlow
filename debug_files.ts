
import { PrismaClient } from '@prisma/client';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function diagnose() {
    console.log("--- DIAGNOSTIC START ---");

    // 1. Check User
    const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
    if (!user) {
        console.error("CRITICAL: Demo user not found!");
        return;
    }
    console.log(`User Found: ${user.id} (${user.email})`);

    // 2. Check Database Records for this user
    const files = await prisma.workspaceFile.findMany({
        where: { userId: user.id },
        select: { id: true, name: true, storagePath: true, parentId: true, type: true }
    });
    console.log(`\nDatabase Records (${files.length} found):`);
    files.forEach(f => {
        console.log(` - [${f.type}] ${f.name} (ID: ${f.id}, Parent: ${f.parentId}) -> Path: ${f.storagePath}`);
    });

    // 3. Check Disk - Public Root
    const publicPath = join(process.cwd(), 'public');
    const uploadsPath = join(publicPath, 'uploads');
    const rootUploadsPath = join(uploadsPath, '_root_');

    console.log(`\nChecking Disk Paths:`);
    console.log(` - public/uploads exists? ${existsSync(uploadsPath)}`);
    console.log(` - public/uploads/_root_ exists? ${existsSync(rootUploadsPath)}`);

    if (existsSync(uploadsPath)) {
        console.log("   Contents of public/uploads:", readdirSync(uploadsPath));
    }
    if (existsSync(rootUploadsPath)) {
        console.log("   Contents of public/uploads/_root_:", readdirSync(rootUploadsPath));
    }

    // 4. Specific file check
    const targetFile = 'premium_demo.html';
    const dbRecord = files.find(f => f.name === targetFile);

    console.log(`\nSpecific Check for '${targetFile}':`);
    if (dbRecord) {
        console.log(` ✅ DB Record found.`);
        const expectedPath = join(uploadsPath, dbRecord.storagePath || '');
        if (existsSync(expectedPath)) {
            console.log(` ✅ File exists on disk at: ${expectedPath}`);
        } else {
            console.error(` ❌ File MISSING on disk at: ${expectedPath}`);
            // Check if it's in _root_ but DB points elsewhere or vice versa
            const rootPath = join(rootUploadsPath, targetFile);
            if (existsSync(rootPath)) {
                console.log(`    (But it IS found at ${rootPath}. Database path mismatch?)`);
            }
        }
    } else {
        console.error(` ❌ DB Record NOT found.`);
    }

    console.log("--- DIAGNOSTIC END ---");
}

diagnose()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
