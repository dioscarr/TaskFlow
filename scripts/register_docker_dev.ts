
import prisma from '../src/lib/prisma';
import path from 'path';

async function main() {
    console.log('Registering Docker Dev App (Attempt 2)...');

    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) {
            console.error('Demo user not found');
            return;
        }

        const appPath = path.resolve(process.cwd(), 'apps/call');

        // Clean up old entries by name to avoid duplicates
        await prisma.processRegistry.deleteMany({
            where: {
                userId: user.id,
                OR: [
                    { name: 'Call App (Docker Dev)' },
                    { name: 'App: call' }, // Clean up the manual one too
                    { name: 'App: apps/call' }
                ]
            }
        });
        console.log('Cleaned up old entries.');

        console.log('Creating new Docker Dev Process...');
        await prisma.processRegistry.create({
            data: {
                name: 'Call App (Docker Dev)',
                type: 'docker-app',
                path: appPath,
                command: 'Docker Dev Container',
                status: 'stopped',
                port: 3001, // Explicitly set port to match mapped external port (avoid 3000 conflict)
                healthCheckType: 'port',
                healthInterval: 10000,
                // Prisma handles JSON metadata directly
                metadata: {
                    source: 'repo-app',
                    appName: 'call',
                    appPath: appPath,
                    containerName: 'taskflow-call-dev',
                    imageName: 'taskflow-call-dev',
                    dockerFile: 'Dockerfile.dev',
                    startScript: 'dev',
                    publicUrl: undefined  // Reset public URL on re-registration
                },
                userId: user.id
            }
        });
        console.log('Registered Call App (Docker Dev) successfully.');

    } catch (e) {
        console.error('Error:', e);
    }
}

main().catch(console.error);
