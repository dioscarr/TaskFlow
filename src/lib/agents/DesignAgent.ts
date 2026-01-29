import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

export class DesignAgent {
    private genAI: GoogleGenerativeAI;

    constructor(apiKey: string) {
        this.genAI = new GoogleGenerativeAI(apiKey);
    }

    async generateDesignSpec(task: string, searchFn: (args: { query: string; type?: 'web' | 'image' }) => Promise<any>): Promise<string> {
        console.log('🎨 Design Expert activated for task:', task);

        const model = this.genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            tools: [{
                functionDeclarations: [{
                    name: 'search_web',
                    description: 'Search the internet for design trends, UI patterns, or color palettes',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            query: { type: SchemaType.STRING, description: 'The search query' }
                        },
                        required: ['query']
                    }
                }]
            }]
        });

        const systemPrompt = `You are an Elite UI/UX Designer and Frontend Architect.
Your goal is to provide expert design advice in the form of a "Trend Analysis" or "Component Spec".

Rules:
1. If you need inspiration or technical info (e.g., "latest shadcn cards style"), use 'search_web'.
2. Focus on premium aesthetics: Glassmorphism, Modern Dark Mode, Tailwind CSS, and Inter typography.
3. OUTPUT FORMAT: detailed markdown. Include a "Trend Analysis" section (why this design?) and a "Component Spec" section (HTML/CSS/Tailwind code).
4. Be proactive and deliver high-quality code.
5. Maximum 2 turns of search.

Current Task: ${task}
`;

        const chat = model.startChat({
            history: [
                { role: 'user', parts: [{ text: systemPrompt }] }
            ]
        });

        let responseText = '';
        let turns = 2;

        try {
            let result = await chat.sendMessage('Analyze the task and provide your expert design solution. Search if necessary.');

            while (turns > 0) {
                const calls = result.response.functionCalls();
                if (!calls || calls.length === 0) {
                    responseText = result.response.text();
                    break;
                }

                const toolResults = [];
                for (const call of calls) {
                    if (call.name === 'search_web') {
                        console.log('🎨 Design Expert is searching:', call.args);
                        const searchResult = await searchFn(call.args as any);
                        toolResults.push({
                            functionResponse: {
                                name: 'search_web',
                                response: searchResult
                            }
                        });
                    }
                }

                result = await chat.sendMessage(toolResults);
                turns--;
                responseText = result.response.text();
            }

            return responseText;
        } catch (error) {
            console.error('❌ Design Agent failed:', error);
            return 'The Design Expert encountered an error while processing your request.';
        }
    }
}
