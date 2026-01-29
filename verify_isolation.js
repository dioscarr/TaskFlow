const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function verifyIsolation() {
    try {
        const folderId = 'test-isolation-folder-' + Date.now();
        const filename = 'index.html';

        // Logic from actions.ts
        const directoryName = folderId ? folderId : '_root_';
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads', directoryName);

        console.log('Creating directory:', uploadsDir);
        fs.mkdirSync(uploadsDir, { recursive: true });

        const filePath = path.join(uploadsDir, filename);
        fs.writeFileSync(filePath, '<h1>Isolation Test</h1>');
        console.log('File written to:', filePath);

        const relativeStoragePath = `${directoryName}/${filename}`;
        console.log('Relative Storage Path:', relativeStoragePath);

        const expectedUrlPath = `/uploads/${relativeStoragePath}`;
        console.log('Expected URL Path:', expectedUrlPath);

        console.log('✅ Verification successful');
    } catch (error) {
        console.error('❌ Verification failed:', error);
    }
}

verifyIsolation();
