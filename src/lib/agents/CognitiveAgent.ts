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

export class CognitiveAgent {
    private genAI: GoogleGenerativeAI;

    constructor(apiKey: string) {
        this.genAI = new GoogleGenerativeAI(apiKey);
    }

    async generateExecutionPlan(query: string, context: {
        history: any[],
        currentFolder?: string,
        files?: any[],
        availableTools: string[]
    }): Promise<ExecutionPlan | null> {
        const model = this.genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
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
}
