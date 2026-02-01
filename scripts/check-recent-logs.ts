
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkRecentLogs() {
    try {
        console.log('--- LATEST Chat Session Detailed Log ---');
        const session = await prisma.chatSession.findFirst({
            orderBy: { updatedAt: 'desc' },
            include: {
                messages: {
                    orderBy: { createdAt: 'asc' }
                },
                activities: {
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        if (!session) {
            console.log("No sessions found.");
            return;
        }

        console.log(`Session ID: ${session.id}`);
        console.log(`Title: ${session.title}`);
        console.log(`Updated: ${session.updatedAt}`);

        console.log('\n--- Messages ---');
        for (const msg of session.messages) {
            console.log(`[${msg.createdAt.toISOString().split('T')[1].split('.')[0]}] [${msg.role.toUpperCase()}]`);
            console.log(msg.content.substring(0, 300) + (msg.content.length > 300 ? '...' : ''));
            if (msg.toolUsed) console.log(` >> Tool: ${msg.toolUsed}`);
            console.log('');
        }

        console.log('\n--- Associated Activities ---');
        for (const act of session.activities) {
            console.log(`[${act.createdAt.toISOString().split('T')[1].split('.')[0]}] [${act.type}] ${act.title}`);
            console.log(`   ${act.message.substring(0, 150)}`);
        }

    } catch (error) {
        console.error('Error fetching logs:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkRecentLogs();
