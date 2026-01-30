// Test file creation directly
const { PrismaClient } = require('@prisma/client');
const { mkdir, writeFile } = require('fs/promises');
const { join } = require('path');

const prisma = new PrismaClient();

async function testFileCreation() {
    try {
        console.log('🧪 Testing file creation...');

        // Get user
        const user = await prisma.user.findUnique({
            where: { email: 'demo@example.com' }
        });

        if (!user) {
            console.error('❌ User not found');
            return;
        }

        console.log('✅ User found:', user.email);

        // Create test folder
        const folder = await prisma.workspaceFile.create({
            data: {
                name: 'test-portfolio',
                type: 'folder',
                size: '0 bytes',
                userId: user.id,
                parentId: null
            }
        });

        console.log('✅ Folder created:', folder.id, folder.name);

        // Create directory on disk
        const uploadsDir = join(process.cwd(), 'public', 'uploads', folder.id);
        await mkdir(uploadsDir, { recursive: true });
        console.log('✅ Directory created:', uploadsDir);

        // Create HTML file
        const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>Test Portfolio</title>
    <style>
        body {
            background: #0a0a0a;
            color: white;
            font-family: 'Inter', sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
        }
        .hero {
            text-align: center;
            padding: 4rem;
            background: rgba(255,255,255,0.05);
            backdrop-filter: blur(20px);
            border-radius: 2rem;
            border: 1px solid rgba(255,255,255,0.1);
        }
        h1 {
            font-size: 3rem;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin: 0;
        }
    </style>
</head>
<body>
    <div class="hero">
        <h1>Portfolio Site</h1>
        <p>Dark Mode Glassmorphism</p>
    </div>
</body>
</html>`;

        const filePath = join(uploadsDir, 'index.html');
        await writeFile(filePath, htmlContent);
        console.log('✅ HTML file written:', filePath);

        // Create database record
        const file = await prisma.workspaceFile.create({
            data: {
                name: 'index.html',
                type: 'html',
                size: `${Buffer.byteLength(htmlContent)} bytes`,
                userId: user.id,
                parentId: folder.id,
                storagePath: `${folder.id}/index.html`
            }
        });

        console.log('✅ File record created:', file.id, file.name);
        console.log('\n📁 Folder ID:', folder.id);
        console.log('📄 File ID:', file.id);
        console.log('🌐 URL: http://localhost:3000/uploads/' + folder.id + '/index.html');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testFileCreation();
