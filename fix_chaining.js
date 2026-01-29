
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CHAINING_INSTRUCTIONS = `
### ⚡ CHAINING RULE (CRITICAL)
When building an app (e.g. "Create a CRM"), you must perform ALL steps in a SINGLE chain of execution.
1. **Create Folder** -> Wait for ID.
2. **IMMEDIATELY** call \`create_html_file\` using the ID.
3. **IMMEDIATELY** call \`create_file\` for \`app.json\`.

**DO NOT STOP** after creating the folder.
**DO NOT ASK** the user for permission to proceed to the next step.
**DO NOT OUTPUT TEXT** "I have created the folder, now I will..." -> Just CALL THE NEXT TOOL.

You are an ACTION-FIRST Architect. Build the WHOLE thing.
`;

async function main() {
    const active = await prisma.aIPromptSet.findFirst({
        where: { isActive: true }
    });

    if (!active) {
        console.error('No active prompt found!');
        return;
    }

    console.log(`Updating prompt: ${active.name}`);

    let newPrompt = active.prompt;

    // Remove old chaining rules if they exist to avoid clutter
    if (newPrompt.includes('CHAINING RULE')) {
        // Simple replacement or append? Let's append for safety/strength
        console.log('Reinforcing Chaining Rules...');
    }

    newPrompt = newPrompt + '\n\n' + CHAINING_INSTRUCTIONS;

    await prisma.aIPromptSet.update({
        where: { id: active.id },
        data: { prompt: newPrompt }
    });

    console.log('✅ Successfully reinforced AGENT CHAINING behavior.');
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
