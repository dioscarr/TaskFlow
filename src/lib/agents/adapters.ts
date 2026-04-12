import { AgentModel, Logger } from "./types";
import type { LLMModel, LLMToolResult } from "../llm/types";

export interface SkillExecutionContext {
    userId: string;
    sessionId?: string;
    fileIds: string[];
    query: string;
}

export class ToolCallingAgentAdapter implements AgentModel {
    name: string;
    private model: LLMModel;
    private context?: SkillExecutionContext;
    private executeTool?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
    private logger?: Logger;

    constructor(
        name: string,
        model: LLMModel,
        context?: SkillExecutionContext,
        executeTool?: (name: string, args: Record<string, unknown>) => Promise<unknown>,
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
                return result.text;
            }

            // Multi-turn tool execution support
            const chat = this.model.startChat();
            let response = await chat.sendMessage(prompt);
            let turns = 0;

            while (turns < 20) { // Increased turns for complex tasks
                const text = response.text;
                const calls = response.toolCalls;

                // Log thoughts if there's text
                if (text && this.logger) {
                    await this.logger(text, 'thinking');
                }

                if (!calls || calls.length === 0) break;

                const toolResults: LLMToolResult[] = [];
                for (const call of calls) {
                    const logMsg = `Using Tool: ${call.name}`;
                    if (this.logger) await this.logger(logMsg, 'info');

                    const toolResult = await this.executeTool!(call.name, call.args);

                    if (this.logger) {
                        const resultStr = typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult);
                        await this.logger(`Tool '${call.name}' Result: ${resultStr.slice(0, 500)}${resultStr.length > 500 ? '...' : ''}`, 'info');
                    }

                    toolResults.push({
                        name: call.name,
                        result: toolResult
                    });
                }

                response = await chat.sendMessage(toolResults);
                turns++;
            }

            return response.text;
        } catch (error) {
            console.error(`Agent ${this.name} failed:`, error);
            throw error;
        }
    }
}

export class GeminiAgentAdapter extends ToolCallingAgentAdapter { }
