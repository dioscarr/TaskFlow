const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAgentPrompt() {
    try {
        const agent = await prisma.aIPromptSet.findFirst({
            where: { name: 'Action-First Architect' }
        });

        if (agent) {
            console.log('Prompt for Action-First Architect:');
            console.log(agent.prompt);
        } else {
            console.log('Agent not found');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkAgentPrompt();
