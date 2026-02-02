import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findFirst({
        where: { email: 'demo@example.com' }
    });

    if (!user) {
        console.error('User not found');
        return;
    }

    const processName = 'Salon Premium (Local)';
    const appPath = 'c:/Users/Drod/Source/a/apps/salon-premium';
    const port = 5174;

    await prisma.processRegistry.upsert({
        where: { id: 'salon-premium-local' },
        update: {
            status: 'running',
            port,
            startedAt: new Date(),
        },
        create: {
            id: 'salon-premium-local',
            name: processName,
            type: 'dev-server',
            port,
            path: appPath,
            command: 'npx vite --port 5174 --host 0.0.0.0',
            status: 'running',
            startedAt: new Date(),
            userId: user.id,
            metadata: {
                source: 'local-dev',
                appPath
            }
        }
    });

    console.log('✅ Updated Salon Premium in Process Registry to Port 5174');
    await prisma.$disconnect();
}

main().catch(console.error);
