
import prisma from './src/lib/prisma';

async function main() {
    const count = await prisma.workspaceFile.count();
    console.log(`Total WorkspaceFiles: ${count}`);
}

main().catch(console.error);
