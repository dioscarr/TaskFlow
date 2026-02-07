
import prisma from '../src/lib/prisma';

async function main() {
    console.log('Fixing Call App Port to 3001...');

    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) {
            console.error('Demo user not found');
            return;
        }

        // Find existing process
        const process = await prisma.processRegistry.findFirst({
            where: {
                userId: user.id,
                OR: [
                    { name: 'Call App (Docker Dev)' },
                    { name: 'App: call' },
                    { path: { endsWith: 'apps/call' } }
                ]
            }
        });

        if (process) {
            console.log(`Found process: ${process.name} (ID: ${process.id}) currently on port ${process.port}`);

            // Delete conflicts on port 3001 first just in case
            await prisma.processRegistry.deleteMany({
                where: {
                    userId: user.id,
                    port: 3001,
                    NOT: { id: process.id }
                }
            });

            // Update port to 3001
            await prisma.processRegistry.update({
                where: { id: process.id },
                data: {
                    port: 3001,
                    metadata: {
                        ...(process.metadata as any),
                        startScript: 'dev' // ensure start script is correct
                    }
                }
            });
            console.log('Updated process port to 3001.');

            // Also try to remove the container so it rebuilds/restarts cleanly
            const { exec } = await import('child_process');
            exec('docker rm -f taskflow-call-dev', (err) => {
                if (err) console.log('Docker cleanup (optional): ' + err.message);
                else console.log('Removed old container taskflow-call-dev');
            });

        } else {
            console.log('No existing process found for apps/call. Please run register_docker_dev.ts first or start via UI.');
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

main();
