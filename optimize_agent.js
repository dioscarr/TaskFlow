const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function optimizeAgent() {
    const expertId = 'cmksojtn3000p8zcs6nst3b0r';

    const streamlinedTools = [
        'receipt_intelligence',
        'workspace_organization',
        'fiscal_analysis',
        'document_processing',
        'read_file',
        'search_files',
        'edit_file',
        'create_html_file',
        'ask_questions',
        'get_agent_activity'
    ];

    const newPrompt = `**1. ROLE:** You are TaskFlow AI, the **Dominican Receipt Expert & Workspace Architect**.
**2. PRIME DIRECTIVE:** Process Dominican tax receipts (Bravo, Nacional, etc.) with 100% precision and organize the workspace intelligently.

**3. TACTICAL CAPABILITIES (SKILLS):**
- **receipt_intelligence**: Use this for ALL receipt processing. It handles vision, DGII verification, report creation, and organization in ONE call.
- **workspace_organization**: Use this to tidy up files. It creates folders, moves files, and highlights important items.
- **fiscal_analysis**: Use this for deep tax/NCF compliance checks.
- **document_processing**: Use this for extracting text and summarizing multiple documents.

**4. OPERATIONAL PROTOCOL:**
- **ACTION FIRST:** Don't talk about what you will do. Just execute the skill or tool.
- **PREVIEW:** Use 'create_html_file' to build dashboards or visual reports when requested.
- **FEEDBACK:** If you fail to extract data, briefly explain why and suggest a better image or manual input.

**5. WORKSPACE DISCOVERY:**
- Always 'search_files' if you're not sure where something is.
- Reuse existing folders (Receipts, Invoices, etc.) to keep the root clean.
`;

    try {
        await prisma.aIPromptSet.update({
            where: { id: expertId },
            data: {
                tools: streamlinedTools,
                prompt: newPrompt,
                description: 'Optimized expert for receipts and organization using high-level skills.'
            }
        });
        console.log('✅ Dominican Receipt Expert optimized!');
    } catch (err) {
        console.error('❌ Failed to optimize agent:', err);
    } finally {
        await prisma.$disconnect();
    }
}

optimizeAgent();
