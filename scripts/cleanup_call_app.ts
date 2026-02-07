
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Delete duplicate/stale 'Call' apps
    // We want to keep the one with ID cmlbvreyh00018z1sbw2ckze8 (Port 3000)
    // The failing one is cml4tgc6n00428zf4xkjfrupi (Port 5050)

    const staleIds = ['cml4tgc6n00428zf4xkjfrupi', 'cmlbub9u600038zykawh10ood'];

    for (const id of staleIds) {
        try {
            await prisma.processRegistry.delete({ where: { id } });
            console.log(`Deleted stale process: ${id}`);
        } catch (e) {
            console.log(`Could not delete ${id} (probably already gone): ${(e as Error).message}`);
        }
    }

    // Safety check: ensure the good one is still there
    const goodApp = await prisma.processRegistry.findUnique({
        where: { id: 'cmlbvreyh00018z1sbw2ckze8' }
    });

    if (goodApp) {
        console.log('Correct "Call" app is present and safe.');
    } else {
        console.error('WARNING: Correct app was not found. Please re-run registry script.');
    }
}

main()
    .finally(async () => {
        await prisma.$disconnect();
    });
