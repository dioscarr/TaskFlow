/**
 * Intent Library - keyword driven automation rules
 */

export type IntentAction = 'create_markdown_file' | 'create_task' | 'extract_alegra_bill' | 'record_alegra_payment' | 'workflow';

export interface WorkflowStep {
    id: string;
    action: string; // references either an IntentAction or a Tool ID
    params?: Record<string, any>;
}

export interface WorkflowDefinition {
    id: string;
    name: string;
    triggerKeywords: string[];
    steps: WorkflowStep[];
}

export interface IntentRuleDefinition {
    id?: string;
    name: string;
    action: IntentAction;
    keywords: string[];
    enabled?: boolean;
    steps?: WorkflowStep[]; // If action is 'workflow'
    config?: {
        autoFolder?: 'year' | 'none';
        autoFilename?: 'timestamp' | 'file' | 'short';
        [key: string]: any;
    };
}

export const DEFAULT_INTENT_RULES: IntentRuleDefinition[] = [
    {
        name: 'Auto-create & Move',
        action: 'create_markdown_file',
        keywords: ['autocreate', 'auto create', 'just create it', 'create it', 'auto-create', 'auto save', 'save and move'],
        enabled: true,
        config: {
            autoFolder: 'year',
            autoFilename: 'timestamp',
            moveToFolder: true
        }
    }
];

const normalizeKeyword = (value: string) => value.toLowerCase().trim();

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const matchesIntentRule = (input: string, keywords: string[]) => {
    const text = normalizeKeyword(input);
    return keywords.some(keyword => {
        const normalized = normalizeKeyword(keyword);
        if (!normalized) return false;
        if (text === normalized) return true;
        if (text.startsWith(`${normalized} `)) return true;
        const regex = new RegExp(`\\b${escapeRegex(normalized)}\\b`, 'i');
        return regex.test(text);
    });
};
