const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function createHtmlFileDebug(data) {
    try {
        console.log('📄 createHtmlFile called with:', JSON.stringify(data));
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        // Use unique ID for disk storage to allow duplicate filenames in different folders
        const uniqueId = Math.random().toString(36).substring(2, 15);
        const displayName = data.filename.endsWith('.html') ? data.filename : `${data.filename}.html`;
        const diskFileName = `${uniqueId}_${displayName}`; // e.g. "x8d9f_index.html"

        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const filePath = path.join(uploadsDir, diskFileName);

        console.log('Writing to:', filePath);
        fs.writeFileSync(filePath, data.content);

        const file = await prisma.workspaceFile.create({
            data: {
                name: displayName, // "index.html"
                type: 'html',
                size: `${Buffer.byteLength(data.content)} bytes`,
                userId: user.id,
                parentId: data.folderId || null,
                storagePath: diskFileName // Save the actual disk path
            }
        });

        console.log('File created successfully:', file.id);
        return { success: true, file };
    } catch (error) {
        console.error(error);
        return { success: false, message: 'Failed to create HTML file' };
    } finally {
        await prisma.$disconnect();
    }
}

// Test execution
createHtmlFileDebug({
    filename: 'test_debug_page.html',
    content: '<html><body><h1>Hello World</h1></body></html>',
    folderId: null
});
