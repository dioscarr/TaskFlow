import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testDelete() {
    try {
        // Get all files
        const files = await prisma.workspaceFile.findMany({
            include: {
                children: true
            }
        });

        console.log('Files in database:');
        files.forEach(f => {
            console.log(`- ${f.name} (${f.type}) - ID: ${f.id}, Parent: ${f.parentId || 'root'}, Children: ${f.children.length}`);
        });

        // Try to delete a file without children
        const fileToDelete = files.find(f => f.type !== 'folder' && !f.children.length);

        if (fileToDelete) {
            console.log(`\nAttempting to delete: ${fileToDelete.name}`);
            await prisma.workspaceFile.delete({
                where: { id: fileToDelete.id }
            });
            console.log('✓ Delete successful!');
        } else {
            console.log('\nNo suitable file found for deletion test');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testDelete();
