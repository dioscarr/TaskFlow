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

/**
 * Predefined workflows for common tasks
 */
export const DEFAULT_WORKFLOWS: WorkflowDefinition[] = [
    {
        id: 'create_web_app',
        name: 'Create Web App',
        triggerKeywords: [
            'create a website',
            'build a website',
            'make a website',
            'create a web app',
            'build a web app',
            'create a landing page',
            'build a landing page',
            'create an app',
            'build an app'
        ],
        steps: [
            {
                id: 'step-1-create-folder',
                action: 'create_folder',
                params: {
                    autoName: true,
                    prefix: 'WebApp',
                    onExistingFolder: 'create_unique'
                }
            },
            {
                id: 'step-2-create-html',
                action: 'create_html_file',
                params: {
                    filename: 'index.html',
                    useLastFolder: true // Use the folder created in step 1
                }
            }
        ]
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
