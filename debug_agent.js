const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAgent() {
    try {
        console.log('Fetching "Action-First Architect" agent...');
        const agent = await prisma.aIPromptSet.findFirst({
            where: {
                name: 'Action-First Architect'
            }
        });

        if (!agent) {
            console.log('Agent "Action-First Architect" not found!');
            // List all agents
            const allAgents = await prisma.aIPromptSet.findMany({ select: { name: true, tools: true } });
            console.log('Available agents:', allAgents.map(a => a.name));
            return;
        }

        console.log('Agent found:', agent.name);
        console.log('Tools:', agent.tools);

        const hasCreateHtml = agent.tools && agent.tools.includes('create_html_file');
        console.log('Has create_html_file tool:', hasCreateHtml);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkAgent();
