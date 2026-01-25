/**
 * Skills Library - High-level capabilities for AI agents
 * Skills combine multiple tools/operations into intelligent behaviors
 */

export interface SkillDefinition {
    id: string;
    name: string;
    description: string;
    category: 'receipt_processing' | 'file_management' | 'fiscal_operations' | 'workspace_organization';
    icon: string;
    schema: any; // Gemini function declaration
    handler: (args: any, context?: any) => Promise<any>; // Intelligent skill execution
    capabilities: string[]; // What this skill can do
}

/**
 * Available skills in the library
 */
export const SKILLS_LIBRARY: Record<string, Omit<SkillDefinition, 'handler'>> = {
    receipt_intelligence: {
        id: 'receipt_intelligence',
        name: 'Receipt Intelligence',
        description: 'Complete receipt processing: vision analysis, business verification, data extraction, and organized storage.',
        category: 'receipt_processing',
        icon: 'Receipt',
        capabilities: ['vision_analysis', 'dgii_verification', 'data_extraction', 'markdown_creation', 'file_organization'],
        schema: {
            name: 'receipt_intelligence',
            description: 'Process a receipt image with full intelligence: extract data, verify business, create organized report',
            parameters: {
                type: 'object',
                properties: {
                    imageAnalysis: { type: 'boolean', description: 'Whether to perform detailed image analysis', default: true },
                    createReport: { type: 'boolean', description: 'Whether to create a markdown report', default: true },
                    organizeFiles: { type: 'boolean', description: 'Whether to organize files into folders', default: true },
                    folderStrategy: {
                        type: 'string',
                        enum: ['year', 'month', 'provider', 'auto'],
                        description: 'How to organize files',
                        default: 'year'
                    }
                }
            }
        }
    },
    workspace_organization: {
        id: 'workspace_organization',
        name: 'Workspace Organization',
        description: 'Intelligently organize files and folders based on content and context.',
        category: 'workspace_organization',
        icon: 'FolderTree',
        capabilities: ['folder_creation', 'file_movement', 'highlighting', 'auto_naming'],
        schema: {
            name: 'workspace_organization',
            description: 'Organize workspace files with intelligent folder structure and highlighting',
            parameters: {
                type: 'object',
                properties: {
                    targetFiles: { type: 'array', items: { type: 'string' }, description: 'File IDs to organize' },
                    organizationType: {
                        type: 'string',
                        enum: ['by_date', 'by_type', 'by_content', 'custom'],
                        description: 'How to organize the files'
                    },
                    createFolders: { type: 'boolean', description: 'Whether to create new folders', default: true },
                    applyHighlighting: { type: 'boolean', description: 'Whether to apply intelligent highlighting', default: true },
                    folderName: { type: 'string', description: 'Custom folder name (optional)' }
                },
                required: ['targetFiles']
            }
        }
    },
    fiscal_analysis: {
        id: 'fiscal_analysis',
        name: 'Fiscal Analysis',
        description: 'Analyze fiscal documents, validate compliance, and prepare for accounting systems.',
        category: 'fiscal_operations',
        icon: 'Calculator',
        capabilities: ['ncf_validation', 'itbis_calculation', 'compliance_check', 'accounting_prep'],
        schema: {
            name: 'fiscal_analysis',
            description: 'Perform comprehensive fiscal analysis on documents',
            parameters: {
                type: 'object',
                properties: {
                    documentType: {
                        type: 'string',
                        enum: ['receipt', 'invoice', 'credit_note', 'debit_note'],
                        description: 'Type of fiscal document'
                    },
                    validateCompliance: { type: 'boolean', description: 'Check DGII compliance', default: true },
                    calculateTaxes: { type: 'boolean', description: 'Calculate ITBIS and other taxes', default: true },
                    prepareForAccounting: { type: 'boolean', description: 'Format for accounting system import', default: false }
                },
                required: ['documentType']
            }
        }
    },
    document_processing: {
        id: 'document_processing',
        name: 'Document Processing',
        description: 'Process various document types with intelligent content extraction and organization.',
        category: 'file_management',
        icon: 'FileText',
        capabilities: ['content_extraction', 'format_conversion', 'metadata_analysis', 'auto_categorization'],
        schema: {
            name: 'document_processing',
            description: 'Process documents with intelligent analysis and organization',
            parameters: {
                type: 'object',
                properties: {
                    documentIds: { type: 'array', items: { type: 'string' }, description: 'Document file IDs to process' },
                    processingType: {
                        type: 'string',
                        enum: ['extract_text', 'analyze_content', 'convert_format', 'categorize'],
                        description: 'Type of processing to perform'
                    },
                    createSummary: { type: 'boolean', description: 'Create a summary document', default: true },
                    organizeByContent: { type: 'boolean', description: 'Organize based on content analysis', default: true }
                },
                required: ['documentIds', 'processingType']
            }
        }
    }
};

/**
 * Get skill schema for Gemini API
 */
export function getSkillSchema(skillId: string) {
    const skill = SKILLS_LIBRARY[skillId];
    return skill ? skill.schema : null;
}

/**
 * Get multiple skill schemas
 */
export function getSkillSchemas(skillIds: string[]) {
    const functionDeclarations = skillIds
        .map(id => getSkillSchema(id))
        .filter(schema => schema !== null);

    if (!functionDeclarations.length) {
        return [];
    }

    return [{ functionDeclarations }] as any;
}

/**
 * Get all available skills grouped by category
 */
export function getSkillsByCategory() {
    const categories: Record<string, typeof SKILLS_LIBRARY[string][]> = {
        receipt_processing: [],
        file_management: [],
        fiscal_operations: [],
        workspace_organization: []
    };

    Object.values(SKILLS_LIBRARY).forEach(skill => {
        categories[skill.category].push(skill);
    });

    return categories;
}

/**
 * Default skill set for new agents
 */
export const DEFAULT_SKILLS = [
    'receipt_intelligence',
    'workspace_organization'
];