
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const processes = await prisma.processRegistry.findMany({
        select: {
            id: true,
            name: true,
            port: true,
            status: true,
            command: true,
        }
    });

    console.log('--- Process Registry Dump ---');
    console.table(processes);

    // Specifically log the "Call" app
    const callApps = processes.filter(p => p.name.toLowerCase().includes('call'));
    console.log('--- Call Apps ---');
    console.log(JSON.stringify(callApps, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
