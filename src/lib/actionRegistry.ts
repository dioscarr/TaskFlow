import { TOOL_LIBRARY } from './toolLibrary';
import { DEFAULT_INTENT_RULES, IntentRuleDefinition } from './intentLibrary';

export interface ActionDefinition {
    id: string;
    name: string;
    description: string;
    type: 'tool' | 'intent' | 'workflow';
    category?: string;
}

export function getAllActions(customIntents: IntentRuleDefinition[] = []): ActionDefinition[] {
    const tools: ActionDefinition[] = Object.entries(TOOL_LIBRARY).map(([id, tool]) => ({
        id: id,
        name: tool.name || id,
        description: tool.description || '',
        type: 'tool',
        category: 'AI Tools'
    }));

    const baseIntents: ActionDefinition[] = DEFAULT_INTENT_RULES.map(rule => ({
        id: rule.action,
        name: rule.name,
        description: `Triggered by keywords: ${rule.keywords.join(', ')}`,
        type: 'intent',
        category: 'Internal Processes'
    }));

    const dynamicIntents: ActionDefinition[] = customIntents.map(rule => ({
        id: rule.action,
        name: rule.name,
        description: `Custom process: ${rule.keywords.join(', ')}`,
        type: 'intent',
        category: 'Internal Processes'
    }));

    // Add extra common internal processes
    const extraIntents: ActionDefinition[] = [
        { id: 'create_markdown_file', name: 'Save to Markdown', description: 'Creates a markdown file and saves it to a folder', type: 'intent', category: 'Internal Processes' },
        { id: 'highlight_file', name: 'Highlight File', description: 'Highlights a file with custom colors and font weight', type: 'intent', category: 'Internal Processes' },
        { id: 'move_attachments_to_folder', name: 'Move Attachments to Folder', description: 'Moves attached files into the target folder (defaults to last created folder)', type: 'intent', category: 'Internal Processes' },
        { id: 'copy_attachments_to_folder', name: 'Copy Attachments to Folder', description: 'Copies attached files into the target folder (defaults to last created folder)', type: 'intent', category: 'Internal Processes' },
        { id: 'extract_alegra_bill', name: 'Extract Alegra Bill', description: 'Extracts billing data for Alegra', type: 'intent', category: 'Internal Processes' },
        { id: 'verify_dgii_rnc', name: 'Verify RNC (DGII)', description: 'Verifies an RNC with DGII', type: 'intent', category: 'Internal Processes' },
        { id: 'create_folder', name: 'Create Folder', description: 'Creates a new folder with optional auto-generated name', type: 'intent', category: 'Internal Processes' },
    ];

    // Deduplicate and merge
    const registry = new Map<string, ActionDefinition>();
    [...tools, ...baseIntents, ...dynamicIntents, ...extraIntents].forEach(item => {
        if (!registry.has(item.id)) {
            registry.set(item.id, item);
        }
    });

    return Array.from(registry.values());
}
