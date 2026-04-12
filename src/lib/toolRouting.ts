/**
 * Tool Routing Module - P3-TOOL-ROUTING
 * 
 * Implements intent-based tool allowlist selection to improve AI performance
 * by reducing tool choice paralysis through intelligent tool subset selection.
 */

export type Intent =
    | 'code_development'
    | 'receipt_processing'
    | 'web_development'
    | 'file_organization'
    | 'data_analysis'
    | 'general_chat'
    | 'debugging'
    | 'documentation';

export interface IntentClassification {
    intent: Intent;
    confidence: number;
    reasoning: string;
    suggestedTools: string[];
}

/**
 * Classify user intent based on query and context
 */
export function classifyIntent(
    query: string,
    fileIds: string[] = [],
    fileTypes: string[] = []
): IntentClassification {
    const lower = query.toLowerCase();
    const hasFiles = fileIds.length > 0;

    // Code development keywords and patterns
    const codeKeywords = /\b(code|function|class|component|debug|refactor|implement|fix|bug|error|test|unit test|integration|api|endpoint|route|controller|service|model|schema|interface|type|async|await|promise|callback)\b/i;
    const codeScore = (lower.match(codeKeywords) || []).length;

    // Receipt processing keywords
    const receiptKeywords = /\b(receipt|invoice|ncf|itbis|alegra|vendor|tax|fiscal|payment|bill|expense|dgii|rnc)\b/i;
    const receiptScore = (lower.match(receiptKeywords) || []).length;

    // Web development keywords
    const webKeywords = /\b(website|landing|page|html|css|style|design|layout|responsive|mobile|desktop|preview|deploy|build|frontend|ui|ux)\b/i;
    const webScore = (lower.match(webKeywords) || []).length;

    // File organization keywords
    const orgKeywords = /\b(organize|move|folder|sort|clean|rename|delete|archive|categorize|structure|hierarchy)\b/i;
    const orgScore = (lower.match(orgKeywords) || []).length;

    // Data analysis keywords
    const dataKeywords = /\b(analyze|calculate|report|chart|graph|data|statistics|metrics|aggregate|sum|average|count|filter|query)\b/i;
    const dataScore = (lower.match(dataKeywords) || []).length;

    // Debugging keywords
    const debugKeywords = /\b(debug|error|crash|fail|broken|not working|issue|problem|troubleshoot|diagnose|trace|stack trace|exception)\b/i;
    const debugScore = (lower.match(debugKeywords) || []).length;

    // Documentation keywords
    const docKeywords = /\b(document|readme|guide|tutorial|explain|describe|how to|what is|why|comment|annotation|jsdoc|docstring)\b/i;
    const docScore = (lower.match(docKeywords) || []).length;

    // File type analysis
    const hasCodeFiles = fileTypes.some(t => ['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'cpp', 'c', 'go', 'rs'].includes(t));
    const hasWebFiles = fileTypes.some(t => ['html', 'css', 'scss'].includes(t));
    const hasReceiptFiles = fileTypes.some(t => ['pdf', 'image', 'png', 'jpg', 'jpeg'].includes(t)) && receiptScore > 0;
    const hasDataFiles = fileTypes.some(t => ['csv', 'json', 'xlsx'].includes(t));

    // Calculate scores with file type boosting
    const scores = {
        code_development: codeScore + (hasCodeFiles ? 2 : 0),
        receipt_processing: receiptScore + (hasReceiptFiles ? 3 : 0),
        web_development: webScore + (hasWebFiles ? 2 : 0),
        file_organization: orgScore + (hasFiles ? 1 : 0),
        data_analysis: dataScore + (hasDataFiles ? 2 : 0),
        debugging: debugScore,
        documentation: docScore,
        general_chat: 0
    };

    // Find highest scoring intent
    const sortedIntents = Object.entries(scores)
        .sort(([, a], [, b]) => b - a);

    const [topIntent, topScore] = sortedIntents[0];

    // If no clear intent, default to general_chat
    if (topScore === 0) {
        return {
            intent: 'general_chat',
            confidence: 0.5,
            reasoning: 'No specific intent detected, using general chat mode',
            suggestedTools: getToolsForIntent('general_chat')
        };
    }

    // Calculate confidence (0-1)
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    const confidence = totalScore > 0 ? topScore / totalScore : 0.5;

    const intent = topIntent as Intent;
    const suggestedTools = getToolsForIntent(intent);

    return {
        intent,
        confidence,
        reasoning: `Detected ${intent} intent based on keywords and file types (confidence: ${Math.round(confidence * 100)}%)`,
        suggestedTools
    };
}

/**
 * Intent-to-Tools mapping
 * Maps each intent to a curated subset of tools
 */
export const INTENT_TOOL_ALLOWLIST: Record<Intent, string[]> = {
    code_development: [
        // File operations
        'view_file',
        'edit_file',
        'create_file',
        'rename_file',

        // Code search & analysis
        'search_codebase',
        'find_symbol_references',
        'repo_context_pack',
        'analyze_codebase',

        // Code modification
        'apply_patch',
        'apply_batch',

        // Execution
        'execute_command',
        'run_in_terminal',
        'manage_app_lifecycle',
        'run_app_command',

        // Research
        'search_web',

        // File management
        'list_dir',
        'create_folder'
    ],

    receipt_processing: [
        // Receipt analysis
        'extract_receipt_info',
        'verify_dgii_rnc',
        'extract_alegra_bill',

        // File operations
        'view_file',
        'create_file',
        'read_file',

        // Organization
        'create_folder',
        'move_attachments_to_folder',
        'copy_attachments_to_folder',
        'organize_files',

        // Reporting
        'generate_markdown_report',
        'create_html_file',

        // Metadata
        'add_file_tags',
        'set_file_tags',
        'highlight_file'
    ],

    web_development: [
        // File operations
        'create_html_file',
        'view_file',
        'edit_file',
        'create_file',

        // App management
        'manage_app_lifecycle',
        'run_app_command',
        'execute_command',

        // Research
        'search_web',

        // File management
        'list_dir',
        'create_folder',

        // Code operations
        'apply_patch',
        'search_codebase'
    ],

    file_organization: [
        // Directory operations
        'list_dir',
        'create_folder',
        'get_folder_contents',

        // File operations
        'move_attachments_to_folder',
        'copy_attachments_to_folder',
        'rename_file',
        'delete_file',

        // Organization
        'organize_files',
        'batch_rename',
        'set_auto_organize_rule',

        // Search
        'search_files',
        'find_duplicates',
        'find_duplicate_files',

        // Metadata
        'get_file_metadata',
        'add_file_tags',
        'set_file_tags',
        'highlight_file',
        'remove_highlights'
    ],

    data_analysis: [
        // File reading
        'view_file',
        'read_file',
        'search_files',

        // Analysis
        'analyze_codebase',
        'extract_receipt_info',

        // Reporting
        'generate_markdown_report',
        'create_html_file',
        'create_file',

        // Research
        'search_web',

        // File management
        'list_dir',
        'get_folder_contents'
    ],

    debugging: [
        // File operations
        'view_file',
        'search_codebase',
        'find_symbol_references',
        'repo_context_pack',

        // Execution & logs
        'execute_command',
        'run_in_terminal',
        'get_app_logs',
        'manage_app_lifecycle',

        // Analysis
        'analyze_codebase',

        // Research
        'search_web',

        // File management
        'list_dir'
    ],

    documentation: [
        // File operations
        'view_file',
        'create_file',
        'edit_file',

        // Code analysis
        'search_codebase',
        'repo_context_pack',
        'analyze_codebase',

        // Generation
        'generate_markdown_report',
        'create_html_file',

        // Research
        'search_web',

        // File management
        'list_dir'
    ],

    general_chat: [
        // Minimal toolset for general conversation
        'search_web',
        'ask_questions',
        'view_file',
        'list_dir'
    ]
};

/**
 * Get tools for a specific intent
 */
export function getToolsForIntent(intent: Intent): string[] {
    return INTENT_TOOL_ALLOWLIST[intent] || INTENT_TOOL_ALLOWLIST.general_chat;
}

/**
 * Get all unique tools across all intents
 */
export function getAllTools(): string[] {
    const allTools = new Set<string>();
    Object.values(INTENT_TOOL_ALLOWLIST).forEach(tools => {
        tools.forEach(tool => allTools.add(tool));
    });
    return Array.from(allTools).sort();
}

/**
 * Get tool reduction percentage for an intent
 */
export function getToolReduction(intent: Intent): number {
    const intentTools = getToolsForIntent(intent);
    const allTools = getAllTools();
    const reduction = ((allTools.length - intentTools.length) / allTools.length) * 100;
    return Math.round(reduction);
}

/**
 * Get statistics about tool routing
 */
export function getToolRoutingStats(): {
    totalTools: number;
    intentStats: Array<{
        intent: Intent;
        toolCount: number;
        reduction: number;
    }>;
} {
    const totalTools = getAllTools().length;
    const intentStats = (Object.keys(INTENT_TOOL_ALLOWLIST) as Intent[]).map(intent => ({
        intent,
        toolCount: getToolsForIntent(intent).length,
        reduction: getToolReduction(intent)
    }));

    return {
        totalTools,
        intentStats
    };
}
