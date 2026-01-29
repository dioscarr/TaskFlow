
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { executeWorkflow } from '@/app/actions';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { ruleName, data } = body;

        if (!ruleName) {
            return NextResponse.json({ error: 'ruleName is required' }, { status: 400 });
        }

        // Find the rule (IntentRule) by name
        // This allows apps to trigger "Magic Folder" rules or other automation rules defined in the system
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const rule = await prisma.intentRule.findFirst({
            where: {
                name: ruleName,
                userId: user.id,
                enabled: true
            }
        });

        if (!rule) {
            return NextResponse.json({ error: `Workflow/Rule '${ruleName}' not found or disabled.` }, { status: 404 });
        }

        // Execute the rule's action
        // We accept a single step execution for now, or we could expand IntentRule to have 'steps'
        // Currently IntentRule has 'action' and 'params' (single step)

        console.log(`🚀 API Triggering Workflow: ${ruleName}`, data);

        const result = await executeWorkflow([
            {
                id: 'api-trigger',
                action: rule.action as string,
                params: { ...rule.config as any, ...data } // Merge stored config with incoming data
            }
        ], {
            // Context
            query: `Triggered via API by ${ruleName}`,
            ...data
        });

        return NextResponse.json(result);

    } catch (error) {
        console.error('API Workflow Error:', error);
        return NextResponse.json({ error: 'Failed to execute workflow' }, { status: 500 });
    }
}
