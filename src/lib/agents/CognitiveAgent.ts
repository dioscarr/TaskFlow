import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { TOOL_LIBRARY } from '../toolLibrary';

export interface ExecutionStep {
    phase: string;
    action: string;
    description: string;
}

export interface ExecutionPlan {
    objective: string;
    rationale: string;
    steps: ExecutionStep[];
    suggestedSpecialist?: 'designer' | 'researcher' | 'none';
}

export interface FileCreationRecord {
    path: string;
    purpose: string;
    timestamp: string;
    type: string;
    size?: number;
    relatedFiles?: string[];
    metadata?: Record<string, any>;
}

export interface ActionLog {
    timestamp: string;
    action: string;
    details: any;
    status: 'success' | 'error' | 'pending';
}

export class CognitiveAgent {
    private genAI: GoogleGenerativeAI;
    private createdFiles: Map<string, FileCreationRecord> = new Map();
    private actionLog: ActionLog[] = [];
    private sessionId: string;

    constructor(apiKey: string, sessionId?: string) {
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.sessionId = sessionId || `session-${Date.now()}`;
    }

    async generateExecutionPlan(query: string, context: {
        history: any[],
        currentFolder?: string,
        files?: any[],
        availableTools: string[]
    }): Promise<ExecutionPlan | null> {
        const model = this.genAI.getGenerativeModel({
            model: 'gemini-2.0-flash-exp',
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        objective: { type: SchemaType.STRING },
                        rationale: { type: SchemaType.STRING },
                        steps: {
                            type: SchemaType.ARRAY,
                            items: {
                                type: SchemaType.OBJECT,
                                properties: {
                                    phase: { type: SchemaType.STRING },
                                    action: { type: SchemaType.STRING },
                                    description: { type: SchemaType.STRING }
                                },
                                required: ['phase', 'action', 'description']
                            }
                        },
                        suggestedSpecialist: {
                            type: SchemaType.STRING,
                            nullable: true
                        }
                    },
                    required: ['objective', 'rationale', 'steps']
                } as any
            }
        });

        // Enrich tool context with descriptions
        const toolDescriptions = context.availableTools.map(toolId => {
            const tool = TOOL_LIBRARY[toolId];
            return tool ? `- ${tool.name} (${toolId}): ${tool.description}` : `- ${toolId}`;
        }).join('\n');

        const systemPrompt = `You are the Cognitive Brain of an AI system. 
Your task is to analyze the user request and generate a STRATEGIC EXECUTION PLAN.
You do not execute tools. You provide the roadmap for the Active Agent.

Available Context:
- User Query: "${query}"
- Current Folder: "${context.currentFolder || 'Root'}"

Available Tools:
${toolDescriptions}

Rules:
1. Break down complex tasks into logical phases.
2. If the task requires expert UI/UX or design (e.g. creating a landing page, styling a dashboard), suggest the 'designer' specialist.
3. Be concise but strategic.
4. Output valid JSON.
`;

        try {
            const result = await model.generateContent(systemPrompt);
            const plan = JSON.parse(result.response.text()) as ExecutionPlan;
            console.log('🧠 Cognitive Plan Generated:', plan);
            return plan;
        } catch (error) {
            console.error('❌ Cognitive Planning Failed:', error);
            return null;
        }
    }

    /**
     * Track a created file
     */
    trackFileCreation(record: FileCreationRecord): void {
        this.createdFiles.set(record.path, record);
        this.logAction('CREATE_FILE', { path: record.path, purpose: record.purpose }, 'success');
        console.log(`📁 Tracked file: ${record.path}`);
    }

    /**
     * Get the most recently created file
     */
    getLastCreatedFile(): FileCreationRecord | null {
        const entries = Array.from(this.createdFiles.entries());
        if (entries.length === 0) return null;

        const sorted = entries.sort((a, b) =>
            new Date(b[1].timestamp).getTime() - new Date(a[1].timestamp).getTime()
        );

        return sorted[0][1];
    }

    /**
     * Find created files by name or path
     */
    findCreatedFiles(searchTerm: string): FileCreationRecord[] {
        const results: FileCreationRecord[] = [];

        for (const [path, record] of this.createdFiles) {
            if (path.toLowerCase().includes(searchTerm.toLowerCase())) {
                results.push(record);
            }
        }

        return results.sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
    }

    /**
     * Get all created files
     */
    getAllCreatedFiles(): FileCreationRecord[] {
        return Array.from(this.createdFiles.values()).sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
    }

    /**
     * Log an action
     */
    logAction(action: string, details: any, status: 'success' | 'error' | 'pending' = 'success'): void {
        const log: ActionLog = {
            timestamp: new Date().toISOString(),
            action,
            details,
            status
        };
        this.actionLog.push(log);

        // Keep only last 100 actions
        if (this.actionLog.length > 100) {
            this.actionLog = this.actionLog.slice(-100);
        }
    }

    /**
     * Get recent actions
     */
    getRecentActions(count: number = 10): ActionLog[] {
        return this.actionLog.slice(-count);
    }

    /**
     * Get session summary
     */
    getSessionSummary(): {
        sessionId: string;
        filesCreated: number;
        actionsLogged: number;
        lastActivity: string | null;
        recentFiles: FileCreationRecord[];
    } {
        const recentFiles = this.getAllCreatedFiles().slice(0, 5);
        const lastAction = this.actionLog[this.actionLog.length - 1];

        return {
            sessionId: this.sessionId,
            filesCreated: this.createdFiles.size,
            actionsLogged: this.actionLog.length,
            lastActivity: lastAction?.timestamp || null,
            recentFiles
        };
    }

    /**
     * Format file creation for user communication
     */
    formatFileCreation(record: FileCreationRecord): string {
        return `
✅ Created successfully!

📁 Location: \`${record.path}\`

📝 Purpose: ${record.purpose}

📊 Details:
- File type: ${record.type}
${record.size ? `- Size: ${record.size} bytes` : ''}
- Created: ${new Date(record.timestamp).toLocaleString()}

🚀 To view:
\`\`\`bash
start ${record.path}
\`\`\`
        `.trim();
    }

    /**
     * Clear session data (for testing)
     */
    clearSession(): void {
        this.createdFiles.clear();
        this.actionLog = [];
        console.log('🧹 Session cleared');
    }
}
