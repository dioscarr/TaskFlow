
import { GenerativeModel, ChatSession } from "@google/generative-ai";
import { AgentModel, Logger } from "./types";

export interface SkillExecutionContext {
    userId: string;
    sessionId?: string;
    fileIds: string[];
    query: string;
}

export class GeminiAgentAdapter implements AgentModel {
    name: string;
    private model: GenerativeModel;
    private context?: SkillExecutionContext;
    private executeTool?: (name: string, args: any) => Promise<any>;
    private logger?: Logger;

    constructor(
        name: string,
        model: GenerativeModel,
        context?: SkillExecutionContext,
        executeTool?: (name: string, args: any) => Promise<any>,
        logger?: Logger
    ) {
        this.name = name;
        this.model = model;
        this.context = context;
        this.executeTool = executeTool;
        this.logger = logger;
    }

    async complete(prompt: string): Promise<string> {
        try {
            if (!this.executeTool) {
                const result = await this.model.generateContent(prompt);
                return result.response.text();
            }

            // Multi-turn tool execution support
            const chat = this.model.startChat();
            let result = await chat.sendMessage(prompt);
            let response = result.response;
            let turns = 0;

            while (response.functionCalls()?.length && turns < 10) {
                const calls = response.functionCalls();
                const toolResults = [];

                for (const call of calls!) {
                    const logMsg = `[Agent ${this.name}] Using Skill: ${call.name}`;
                    console.log(logMsg);
                    if (this.logger) await this.logger(logMsg, 'info');

                    const toolResult = await this.executeTool(call.name, call.args);
                    toolResults.push({
                        functionResponse: {
                            name: call.name,
                            response: { result: toolResult }
                        }
                    });
                }

                result = await chat.sendMessage(toolResults);
                response = result.response;
                turns++;
            }

            return response.text();
        } catch (error) {
            console.error(`Agent ${this.name} failed:`, error);
            throw error;
        }
    }
}
