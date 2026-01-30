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
    search_web: {
        id: 'search_web',
        name: 'Search Web',
        description: 'Search the internet for information or images. Use "type" parameter to switch between web search and image search.',
        category: 'task',
        icon: 'Globe',
        schema: {
            name: 'search_web',
            description: 'Search the internet for information or images',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Search query' },
                    type: { type: 'string', enum: ['web', 'image'], description: 'Type of search: "web" for text results, "image" for image URLs' }
                },
                required: ['query']
            }
        }
    },
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
    create_file: {
        id: 'create_file',
        name: 'Create File',
        description: 'Create a new file (Markdown, JSON, TXT, etc). Use this for any non-HTML file creation. CRITICAL: You MUST call this to save files.',
        category: 'workspace',
        icon: 'Save',
        schema: {
            name: 'create_file',
            description: 'Create a new file with content',
            parameters: {
                type: 'object',
                properties: {
                    filename: { type: 'string', description: 'File name including extension (e.g. app.json, notes.md)' },
                    content: { type: 'string', description: 'File content' },
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
        description: 'Creates a new folder. RETURNS THE FOLDER ID. IMPORTANT: If you are building an app, you MUST use the returned folderId to immediately create the files inside it in the SAME response loop.',
        category: 'workspace',
        icon: 'FolderPlus',
        schema: {
            name: 'create_folder',
            description: 'Creates a new folder. Returns folderId which must be used for subsequent file creation.',
            parameters: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'Folder name' },
                    parentId: { type: 'string', description: 'Parent folder ID' },
                    autoName: { type: 'boolean', description: 'Whether to auto-generate a name' },
                    prefix: { type: 'string', description: 'Prefix for auto-generated names' },
                    onExistingFolder: {
                        type: 'string',
                        enum: ['reuse', 'ask', 'create_unique'],
                        description: 'Strategy if folder exists: reuse existing, ask user, or create unique with timestamp',
                        default: 'reuse'
                    }
                }
            }
        }
    },
    extract_receipt_info: {
        id: 'extract_receipt_info',
        name: 'Extract Receipt Data',
        description: 'Analyze receipt images and extract structured data (vendor, RNC, items, total, etc.).',
        category: 'fiscal',
        icon: 'ScanLine',
        schema: {
            name: 'extract_receipt_info',
            description: 'Extract raw data from receipt images',
            parameters: {
                type: 'object',
                properties: {
                    fileIds: { type: 'array', items: { type: 'string' }, description: 'List of image file IDs' }
                },
                required: ['fileIds']
            }
        }
    },
    generate_markdown_report: {
        id: 'generate_markdown_report',
        name: 'Generate Markdown Report',
        description: 'Converts structured data (like receipt info) into a beautifully formatted markdown table and report.',
        category: 'workspace',
        icon: 'Layout',
        schema: {
            name: 'generate_markdown_report',
            description: 'Generate formatted markdown from structured data',
            parameters: {
                type: 'object',
                properties: {
                    data: { type: 'object', description: 'The JSON data to report on' },
                    title: { type: 'string', description: 'Report title' },
                    includeBusinessInfo: { type: 'boolean', description: 'Whether to include a dedicated business/DGII section', default: true }
                },
                required: ['data']
            }
        }
    },
    organize_files: {
        id: 'organize_files',
        name: 'Smart Organize Files',
        description: 'Automatically organizes files into a folder (e.g., by vendor or project). Reuses existing folders whenever possible to avoid clutter.',
        category: 'workspace',
        icon: 'Workflow',
        schema: {
            name: 'organize_files',
            description: 'Intelligently organize files into folders',
            parameters: {
                type: 'object',
                properties: {
                    fileIds: { type: 'array', items: { type: 'string' }, description: 'Files to organize' },
                    suggestedName: { type: 'string', description: 'Optional folder name hint' },
                    strategy: { type: 'string', enum: ['merge', 'new_folder'], default: 'merge' }
                },
                required: ['fileIds']
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
    },
    edit_file: {
        id: 'edit_file',
        name: 'Edit File',
        description: 'Edit the content of an existing file in the workspace.',
        category: 'workspace',
        icon: 'Edit',
        schema: {
            name: 'edit_file',
            description: 'Edit the content of an existing file by overwriting it.',
            parameters: {
                type: 'object',
                properties: {
                    fileId: { type: 'string', description: 'The ID or exact name of the file to edit' },
                    content: { type: 'string', description: 'The new full content of the file' }
                },
                required: ['fileId', 'content']
            }
        }
    },
    agent_delegate: {
        id: 'agent_delegate',
        name: 'Delegate to Agent',
        description: 'Delegate a specific task or sub-problem to another specialized agent.',
        category: 'task',
        icon: 'Bot',
        schema: {
            name: 'agent_delegate',
            description: 'Delegate a task to another agent',
            parameters: {
                type: 'object',
                properties: {
                    agentType: { type: 'string', description: 'Type of agent (e.g., "designer", "researcher", "analyst")' },
                    task: { type: 'string', description: 'The specific task to delegate' }
                },
                required: ['agentType', 'task']
            }
        }
    },
    enqueue_agent_job: {
        id: 'enqueue_agent_job',
        name: 'Enqueue Background Agent Job',
        description: 'Queue a background agent task for asynchronous execution after user approval.',
        category: 'task',
        icon: 'Bot',
        schema: {
            name: 'enqueue_agent_job',
            description: 'Create a background agent job (requires user approval before execution)',
            parameters: {
                type: 'object',
                properties: {
                    sessionId: { type: 'string', description: 'Chat session ID' },
                    type: { type: 'string', description: 'Job type (e.g., "chat_task")' },
                    payload: { type: 'object', description: 'Job payload for the background agent' }
                },
                required: ['type', 'payload']
            }
        }
    },
    ask_questions: {
        id: 'ask_questions',
        name: 'Clarify Requirements',
        description: 'Ask questions to clarify requirements before proceeding with a task.',
        category: 'task',
        icon: 'MessageSquare',
        schema: {
            name: 'ask_questions',
            description: 'Ask clarity questions to the user',
            parameters: {
                type: 'object',
                properties: {
                    questions: { type: 'array', items: { type: 'string' }, description: 'List of questions to ask' }
                },
                required: ['questions']
            }
        }
    },
    read_file: {
        id: 'read_file',
        name: 'Read File',
        description: 'Read the contents of one or more files in your workspace.',
        category: 'workspace',
        icon: 'FileText',
        schema: {
            name: 'read_file',
            description: 'Read the contents of files from the workspace',
            parameters: {
                type: 'object',
                properties: {
                    fileIds: { type: 'array', items: { type: 'string' }, description: 'List of file IDs or names to read' }
                },
                required: ['fileIds']
            }
        }
    },
    search_files: {
        id: 'search_files',
        name: 'Search Files',
        description: 'Search for files in your workspace by name or content.',
        category: 'workspace',
        icon: 'Search',
        schema: {
            name: 'search_files',
            description: 'Search files by query string',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'The search query' },
                    searchContent: { type: 'boolean', description: 'Whether to search file content (true) or just names (false)', default: true }
                },
                required: ['query']
            }
        }
    },
    execute_command: {
        id: 'execute_command',
        name: 'Execute Command',
        description: 'Execute code or shell commands on the machine.',
        category: 'task',
        icon: 'Terminal',
        schema: {
            name: 'execute_command',
            description: 'Execute a system command',
            parameters: {
                type: 'object',
                properties: {
                    command: { type: 'string', description: 'The command to execute' },
                    reason: { type: 'string', description: 'Why this command needs to be run' }
                },
                required: ['command', 'reason']
            }
        }
    },
    create_workflow: {
        id: 'create_workflow',
        name: 'Create Workflow',
        description: 'Create a new automated workflow sequence based on natural language requirements.',
        category: 'task',
        icon: 'Bot',
        schema: {
            name: 'create_workflow',
            description: 'Define a new automation workflow with multiple steps',
            parameters: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'Name of the workflow' },
                    triggerKeywords: { type: 'array', items: { type: 'string' }, description: 'Keywords that should trigger this workflow automatically' },
                    steps: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                action: { type: 'string', description: 'The tool ID or action name' },
                                params: { type: 'object', description: 'Parameters for the action' }
                            },
                            required: ['action']
                        },
                        description: 'Ordered list of steps to execute'
                    }
                },
                required: ['name', 'steps']
            }
        }
    },
    create_agent: {
        id: 'create_agent',
        name: 'Create Specialized Agent',
        description: 'Create a new specialized AI agent with custom instructions and toolsets.',
        category: 'task',
        icon: 'Sparkles',
        schema: {
            name: 'create_agent',
            description: 'Create a new AI agent/persona',
            parameters: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'Name of the agent (e.g., "Fiscal Researcher", "Code Reviewer")' },
                    description: { type: 'string', description: 'What this agent specializes in' },
                    systemPrompt: { type: 'string', description: 'The base instructions/identity for the agent' },
                    tools: { type: 'array', items: { type: 'string' }, description: 'List of tool IDs to enable for this agent' }
                },
                required: ['name', 'systemPrompt']
            }
        }
    },
    configure_agent: {
        id: 'configure_agent',
        name: 'Configure Agent',
        description: 'Update an existing agent\'s prompt, toolset, or active status.',
        category: 'task',
        icon: 'Settings',
        schema: {
            name: 'configure_agent',
            description: 'Update an existing AI agent configuration',
            parameters: {
                type: 'object',
                properties: {
                    agentId: { type: 'string', description: 'The ID or exact name of the agent to update' },
                    systemPrompt: { type: 'string', description: 'New instructions for the agent' },
                    tools: { type: 'array', items: { type: 'string' }, description: 'Updated list of tool IDs' },
                    isActive: { type: 'boolean', description: 'Set as the primary active agent' }
                },
                required: ['agentId']
            }
        }
    },
    manage_data_table: {
        id: 'manage_data_table',
        name: 'Manage Data Table',
        description: 'Create, append to, or edit structured markdown tables within workspace files. Ideal for trackers, ledgers, and logs.',
        category: 'workspace',
        icon: 'Table',
        schema: {
            name: 'manage_data_table',
            description: 'Manipulate markdown tables in the workspace',
            parameters: {
                type: 'object',
                properties: {
                    fileId: { type: 'string', description: 'The file containing the table' },
                    action: { type: 'string', enum: ['create', 'add_row', 'update_row'], description: 'Creation or modification action' },
                    headers: { type: 'array', items: { type: 'string' }, description: 'Column headers (for create)' },
                    row: { type: 'object', description: 'Data row to add or updated values' },
                    searchKey: { type: 'string', description: 'Field to search for when updating (e.g., "ID" or "Date")' },
                    searchValue: { type: 'string', description: 'Value to match for the update' }
                },
                required: ['fileId', 'action']
            }
        }
    },
    remove_highlights: {
        id: 'remove_highlights',
        name: 'Remove Highlights',
        description: 'Removes highlighting from specific files or ALL files in the workspace.',
        category: 'workspace',
        icon: 'Eraser',
        schema: {
            name: 'remove_highlights',
            description: 'Clear highlight styling from files',
            parameters: {
                type: 'object',
                properties: {
                    fileIds: { type: 'array', items: { type: 'string' }, description: 'List of file IDs to clear. Leave empty to clear ALL highlights.' }
                }
            }
        }
    },
    batch_rename: {
        id: 'batch_rename',
        name: 'Batch Rename',
        description: 'Rename multiple files at once using patterns, prefixes, suffixes, or find/replace.',
        category: 'workspace',
        icon: 'Type',
        schema: {
            name: 'batch_rename',
            description: 'Rename multiple files at once',
            parameters: {
                type: 'object',
                properties: {
                    fileIds: { type: 'array', items: { type: 'string' }, description: 'Files to rename' },
                    prefix: { type: 'string', description: 'String to add at the beginning' },
                    suffix: { type: 'string', description: 'String to add before the extension' },
                    find: { type: 'string', description: 'Pattern to find in names' },
                    replace: { type: 'string', description: 'String to replace the found pattern with' }
                },
                required: ['fileIds']
            }
        }
    },
    summarize_file: {
        id: 'summarize_file',
        name: 'Summarize File',
        description: 'Generate a concise summary of a file\'s content using AI.',
        category: 'workspace',
        icon: 'AlignLeft',
        schema: {
            name: 'summarize_file',
            description: 'Summarize the content of a file',
            parameters: {
                type: 'object',
                properties: {
                    fileId: { type: 'string', description: 'The file to summarize' },
                    detailLevel: { type: 'string', enum: ['brief', 'detailed'], default: 'brief' }
                },
                required: ['fileId']
            }
        }
    },
    extract_text_from_image: {
        id: 'extract_text_from_image',
        name: 'OCR / Extract Text',
        description: 'Extract text from images or scanned documents using Vision AI.',
        category: 'workspace',
        icon: 'ScanText',
        schema: {
            name: 'extract_text_from_image',
            description: 'Extract text from an image file',
            parameters: {
                type: 'object',
                properties: {
                    fileId: { type: 'string', description: 'The image file ID' }
                },
                required: ['fileId']
            }
        }
    },
    find_duplicate_files: {
        id: 'find_duplicate_files',
        name: 'Find Duplicates',
        description: 'Identify files with identical content or very similar names to help clean the workspace.',
        category: 'workspace',
        icon: 'CopyCheck',
        schema: {
            name: 'find_duplicate_files',
            description: 'Look for duplicate or highly similar files',
            parameters: {
                type: 'object',
                properties: {
                    similarityThreshold: { type: 'number', description: 'Sensitivity (0.1 to 1.0)', default: 0.9 }
                }
            }
        }
    },
    focus_workspace_item: {
        id: 'focus_workspace_item',
        name: 'Focus / Highlight Item',
        description: 'Auto-scrolled and highlights a file or folder in the UI so the user can see it immediately. Use this after creating, moving, or renaming something important.',
        category: 'workspace',
        icon: 'Focus',
        schema: {
            name: 'focus_workspace_item',
            description: 'Focus the UI on a specific file or folder',
            parameters: {
                type: 'object',
                properties: {
                    itemId: { type: 'string', description: 'The ID or name of the file/folder to focus' }
                },
                required: ['itemId']
            }
        }
    },
    configure_magic_folder: {
        id: 'configure_magic_folder',
        name: 'Configure Magic Folder',
        description: 'Designate a folder with a "Magic Rule" for automatic processing (e.g., auto-organize, auto-OCR).',
        category: 'workspace',
        icon: 'Sparkles',
        schema: {
            name: 'configure_magic_folder',
            description: 'Set a magic automation rule for a folder',
            parameters: {
                type: 'object',
                properties: {
                    folderId: { type: 'string', description: 'The ID of the folder' },
                    rule: { type: 'string', enum: ['invoices', 'cleanup', 'reports', 'none'], description: 'The automation rule to apply' }
                },
                required: ['folderId', 'rule']
            }
        }
    },
    create_html_file: {
        id: 'create_html_file',
        name: 'Create HTML Page',
        description: 'Create a fully functional HTML web page. The agent will render this immediately for the user.',
        category: 'workspace',
        icon: 'Layout',
        schema: {
            name: 'create_html_file',
            description: 'Create a new HTML file',
            parameters: {
                type: 'object',
                properties: {
                    filename: { type: 'string', description: 'Name of the file (e.g., landing-page)' },
                    content: { type: 'string', description: 'Full HTML content including styles' },
                    folderId: { type: 'string', description: 'Optional folder to save in' }
                },
                required: ['filename', 'content']
            }
        }
    },
    set_file_tags: {
        id: 'set_file_tags',
        name: 'Set File Tags',
        description: 'Attach semantic tags to a file for better filtering and discovery.',
        category: 'workspace',
        icon: 'Tag',
        schema: {
            name: 'set_file_tags',
            description: 'Add or update tags on a workspace file',
            parameters: {
                type: 'object',
                properties: {
                    fileId: { type: 'string', description: 'The file ID' },
                    tags: { type: 'array', items: { type: 'string' }, description: 'List of tags' }
                },
                required: ['fileId', 'tags']
            }
        }
    },
    synthesize_documents: {
        id: 'synthesize_documents',
        name: 'Synthesize documents',
        description: 'Analyze and combine multiple documents into a single, cohesive master report.',
        category: 'workspace',
        icon: 'Combine',
        schema: {
            name: 'synthesize_documents',
            description: 'Combine multiple files into a synthesized report',
            parameters: {
                type: 'object',
                properties: {
                    fileIds: { type: 'array', items: { type: 'string' }, description: 'Files to synthesize' },
                    outputFilename: { type: 'string', description: 'Name for the resulting synthesized file' }
                },
                required: ['fileIds', 'outputFilename']
            }
        }
    },
    get_agent_activity: {
        id: 'get_agent_activity',
        name: 'Get Activity Feed',
        description: 'Retrieve the recent activity feed of the AI agent\'s background actions.',
        category: 'workspace',
        icon: 'Activity',
        schema: {
            name: 'get_agent_activity',
            description: 'Get recent agent actions and reasoning',
            parameters: {
                type: 'object',
                properties: {
                    limit: { type: 'number', description: 'Number of items to fetch', default: 10 }
                }
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
    'search_web',
    'verify_dgii_rnc',
    'create_file',
    'edit_file',
    'manage_data_table',
    'read_file',
    'search_files',
    'create_folder',
    'organize_files',
    'move_attachments_to_folder',
    'highlight_file',
    'create_task',
    'ask_questions',
    'agent_delegate',
    'enqueue_agent_job',
    'create_workflow',
    'batch_rename',
    'remove_highlights',
    'summarize_file',
    'extract_text_from_image',
    'find_duplicate_files',
    'focus_workspace_item',
    'configure_magic_folder',
    'create_html_file',
    'set_file_tags',
    'synthesize_documents',
    'get_agent_activity'
];
