/**
 * Tool Library - Centralized tool definitions for AI agents
 * Each tool can be enabled/disabled per agent
 */

export interface ToolDefinition {
    id: string;
    name: string;
    description: string;
    category: 'fiscal' | 'workspace' | 'verification' | 'task';
    icon: string;
    schema: any; // Gemini function declaration
    handler: (args: any) => Promise<any>; // Server action to execute
}

/**
 * Available tools in the library
 */
export const TOOL_LIBRARY: Record<string, Omit<ToolDefinition, 'handler'>> = {
    verify_dgii_rnc: {
        id: 'verify_dgii_rnc',
        name: 'Verify Business (DGII)',
        description: 'Verify Dominican business information using RNC from DGII database. CRITICAL: Use this for ANY business name lookup or status verification. This tool is MANDATORY when analyzing Dominican receipts - call it immediately after extracting the RNC.',
        category: 'verification',
        icon: 'Search',
        schema: {
            name: 'verify_dgii_rnc',
            description: 'Verify Dominican business information using RNC from DGII database. CRITICAL: Use this for ANY business name lookup or status verification. This tool is MANDATORY when analyzing Dominican receipts - call it immediately after extracting the RNC.',
            parameters: {
                type: 'object',
                properties: {
                    rnc: {
                        type: 'string',
                        description: 'The RNC (Registro Nacional del Contribuyente) number to verify'
                    }
                },
                required: ['rnc']
            }
        }
    },
    extract_alegra_bill: {
        id: 'extract_alegra_bill',
        name: 'Extract Receipt to Alegra',
        description: 'Extract bill data from a receipt and save to Alegra accounting system',
        category: 'fiscal',
        icon: 'Receipt',
        schema: {
            name: 'extract_alegra_bill',
            description: 'Extract bill data from a receipt and save to Alegra',
            parameters: {
                type: 'object',
                properties: {
                    provider: { type: 'string', description: 'Provider/vendor name (use VERIFIED name from verify_dgii_rnc)' },
                    date: { type: 'string', description: 'Bill date (YYYY-MM-DD)' },
                    total: { type: 'number', description: 'Total amount' },
                    ncf: { type: 'string', description: 'NCF number' },
                    ncfType: { type: 'string', description: 'NCF type (e.g., "01", "02", "14", "15")' },
                    itbis: { type: 'number', description: 'ITBIS amount' },
                    items: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                description: { type: 'string' },
                                quantity: { type: 'number' },
                                price: { type: 'number' }
                            }
                        }
                    }
                },
                required: ['provider', 'date', 'total']
            }
        }
    },
    record_alegra_payment: {
        id: 'record_alegra_payment',
        name: 'Record Payment',
        description: 'Record a payment for an existing bill in Alegra',
        category: 'fiscal',
        icon: 'DollarSign',
        schema: {
            name: 'record_alegra_payment',
            description: 'Record a payment for a bill',
            parameters: {
                type: 'object',
                properties: {
                    billId: { type: 'string', description: 'The bill ID' },
                    amount: { type: 'number', description: 'Payment amount' },
                    date: { type: 'string', description: 'Payment date (YYYY-MM-DD)' },
                    method: { type: 'string', description: 'Payment method (e.g., "cash", "transfer", "card")' }
                },
                required: ['billId', 'amount', 'date']
            }
        }
    },
    create_markdown_file: {
        id: 'create_markdown_file',
        name: 'Save Markdown File',
        description: 'Create a markdown file with content. CRITICAL: You MUST call this tool to actually save files. Saying "I have saved the file" without calling this tool is a CRITICAL FAILURE.',
        category: 'workspace',
        icon: 'Save',
        schema: {
            name: 'create_markdown_file',
            description: 'Create a markdown file with content',
            parameters: {
                type: 'object',
                properties: {
                    filename: { type: 'string', description: 'File name (without .md extension)' },
                    content: { type: 'string', description: 'Markdown content' },
                    folderName: { type: 'string', description: 'Optional folder name to create/use' }
                },
                required: ['filename', 'content']
            }
        }
    },
    create_task: {
        id: 'create_task',
        name: 'Create Task',
        description: 'Create a new task in the task management system',
        category: 'task',
        icon: 'CheckSquare',
        schema: {
            name: 'create_task',
            description: 'Create a new task',
            parameters: {
                type: 'object',
                properties: {
                    title: { type: 'string', description: 'Task title' },
                    description: { type: 'string', description: 'Task description' },
                    priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Task priority' },
                    dueDate: { type: 'string', description: 'Due date (YYYY-MM-DD)' }
                },
                required: ['title']
            }
        }
    },
    highlight_file: {
        id: 'highlight_file',
        name: 'Highlight File',
        description: 'Highlights a workspace file with custom colors and styling.',
        category: 'workspace',
        icon: 'Highlighter',
        schema: {
            name: 'highlight_file',
            description: 'Highlights a file with custom colors and font weight',
            parameters: {
                type: 'object',
                properties: {
                    fileId: { type: 'string', description: 'The ID of the file to highlight' },
                    backgroundColor: { type: 'string', description: 'Background color (hex or name)' },
                    textColor: { type: 'string', description: 'Text color (hex or name)' },
                    borderColor: { type: 'string', description: 'Border color (hex or name)' },
                    fontWeight: { type: 'string', enum: ['normal', 'bold', 'bolder'], description: 'Font weight' }
                },
                required: ['fileId']
            }
        }
    },
    move_attachments_to_folder: {
        id: 'move_attachments_to_folder',
        name: 'Move Attachments to Folder',
        description: 'Moves files/attachments into a specific folder.',
        category: 'workspace',
        icon: 'FolderInput',
        schema: {
            name: 'move_attachments_to_folder',
            description: 'Moves attached files into the target folder',
            parameters: {
                type: 'object',
                properties: {
                    fileIds: { type: 'array', items: { type: 'string' }, description: 'List of file IDs to move' },
                    folderId: { type: 'string', description: 'Target folder ID' }
                },
                required: ['fileIds', 'folderId']
            }
        }
    },
    create_folder: {
        id: 'create_folder',
        name: 'Create Folder',
        description: 'Creates a new folder with optional auto-generated name.',
        category: 'workspace',
        icon: 'FolderPlus',
        schema: {
            name: 'create_folder',
            description: 'Creates a new folder with optional auto-naming',
            parameters: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'Folder name (optional - will auto-generate if not provided)' },
                    parentId: { type: 'string', description: 'Parent folder ID (optional)' },
                    autoName: { type: 'boolean', description: 'Whether to auto-generate a name' },
                    prefix: { type: 'string', description: 'Prefix for auto-generated names (default: "Folder")' }
                }
            }
        }
    },
    copy_attachments_to_folder: {
        id: 'copy_attachments_to_folder',
        name: 'Copy Attachments to Folder',
        description: 'Copies files/attachments into a specific folder (preserves originals).',
        category: 'workspace',
        icon: 'Copy',
        schema: {
            name: 'copy_attachments_to_folder',
            description: 'Copies attached files into the target folder while preserving originals',
            parameters: {
                type: 'object',
                properties: {
                    fileIds: { type: 'array', items: { type: 'string' }, description: 'List of file IDs to copy' },
                    folderId: { type: 'string', description: 'Target folder ID' }
                },
                required: ['fileIds', 'folderId']
            }
        }
    }
};

/**
 * Get tool schema for Gemini API
 */
export function getToolSchema(toolId: string) {
    const tool = TOOL_LIBRARY[toolId];
    return tool ? tool.schema : null;
}

/**
 * Get multiple tool schemas
 */
export function getToolSchemas(toolIds: string[]) {
    return toolIds
        .map(id => getToolSchema(id))
        .filter(schema => schema !== null);
}

/**
 * Get all available tools grouped by category
 */
export function getToolsByCategory() {
    const categories: Record<string, typeof TOOL_LIBRARY[string][]> = {
        verification: [],
        fiscal: [],
        workspace: [],
        task: []
    };

    Object.values(TOOL_LIBRARY).forEach(tool => {
        categories[tool.category].push(tool);
    });

    return categories;
}

/**
 * Default tool set for new agents
 */
export const DEFAULT_TOOLS = [
    'verify_dgii_rnc',
    'create_markdown_file',
    'create_folder',
    'highlight_file',
    'move_attachments_to_folder',
    'copy_attachments_to_folder'
];
