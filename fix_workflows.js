const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixWorkflows() {
    const expertId = 'cmksojtn3000p8zcs6nst3b0r';

    const workflows = [
        {
            "id": "q1satn0lm",
            "name": "To Alegra",
            "steps": [
                {
                    "id": "step_extract",
                    "action": "extract_receipt_info",
                    "params": {}
                },
                {
                    "id": "step_folder",
                    "action": "create_folder",
                    "params": {
                        "onExistingFolder": "reuse",
                        "autoName": true,
                        "prefix": "Extraction"
                    }
                },
                {
                    "id": "step_report",
                    "action": "generate_markdown_report",
                    "params": {
                        "title": "Tax Receipt Verification"
                    }
                },
                {
                    "id": "step_file",
                    "action": "create_markdown_file",
                    "params": {
                        "filename": "tax-report"
                    }
                },
                {
                    "id": "step_move",
                    "action": "move_attachments_to_folder",
                    "params": {
                        "nameConflictStrategy": "timestamp"
                    }
                }
            ],
            "triggerKeywords": [
                "to alegra",
                "save to alegra",
                "send to alegra",
                "alegra",
                "extract this receipt"
            ]
        }
    ];

    try {
        await prisma.aIPromptSet.update({
            where: { id: expertId },
            data: {
                workflows: workflows
            }
        });
        console.log('✅ Dominican Receipt Expert workflows repaired!');
    } catch (err) {
        console.error('❌ Failed to update workflows:', err);
    } finally {
        await prisma.$disconnect();
    }
}

fixWorkflows();
