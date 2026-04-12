import { GoogleGenerativeAI, type ChatSession as GeminiChatSession, type FunctionDeclaration, type GenerativeModel, type Tool as GeminiTool } from '@google/generative-ai';

import type { CreateLLMModelOptions, LLMProvider } from '../provider';
import type { LLMChatOptions, LLMChatSession as ChatSessionContract, LLMModel, LLMResponse, LLMToolCall, LLMToolDefinition, LLMToolResult } from '../types';

function normalizeToolCalls(calls: unknown): LLMToolCall[] {
    if (!Array.isArray(calls)) {
        return [];
    }

    return calls
        .filter((call): call is { name: string; args?: Record<string, unknown> } => !!call && typeof call === 'object' && typeof (call as { name?: unknown }).name === 'string')
        .map(call => ({
            name: call.name,
            args: call.args && typeof call.args === 'object' ? call.args : {}
        }));
}

function normalizeGeminiResponse(response: {
    text?: () => string;
    functionCalls?: () => unknown;
}): LLMResponse {
    let text = '';
    if (typeof response.text === 'function') {
        try {
            text = response.text();
        } catch {
            text = '';
        }
    }

    return {
        text,
        toolCalls: normalizeToolCalls(typeof response.functionCalls === 'function' ? response.functionCalls() : []),
        raw: response
    };
}

function toGeminiToolResults(results: LLMToolResult[]) {
    return results.map(result => ({
        functionResponse: {
            name: result.name,
            response: { result: result.result }
        }
    }));
}

export function toGeminiTools(tools?: LLMToolDefinition[]): GeminiTool[] | undefined {
    if (!tools?.length) {
        return undefined;
    }

    return [{
        functionDeclarations: tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
        }) as unknown as FunctionDeclaration)
    }];
}

class GeminiChatSessionAdapter implements ChatSessionContract {
    constructor(private readonly chat: GeminiChatSession) { }

    async sendMessage(input: string | LLMToolResult[]): Promise<LLMResponse> {
        const payload = typeof input === 'string' ? input : toGeminiToolResults(input);
        const result = await this.chat.sendMessage(payload);
        return normalizeGeminiResponse(result.response);
    }
}

class GeminiModelAdapter implements LLMModel {
    constructor(private readonly model: GenerativeModel) { }

    async generateContent(input: string): Promise<LLMResponse> {
        const result = await this.model.generateContent(input);
        return normalizeGeminiResponse(result.response);
    }

    startChat(options?: LLMChatOptions): ChatSessionContract {
        return new GeminiChatSessionAdapter(this.model.startChat(options as Parameters<GenerativeModel['startChat']>[0]));
    }
}

export function wrapGeminiModel(model: GenerativeModel): LLMModel {
    return new GeminiModelAdapter(model);
}

export class GeminiProvider implements LLMProvider {
    readonly name = 'gemini' as const;

    constructor(private readonly apiKey: string) { }

    createModel(options: CreateLLMModelOptions): LLMModel {
        const client = new GoogleGenerativeAI(this.apiKey);
        const model = client.getGenerativeModel({
            model: options.model,
            systemInstruction: options.systemInstruction,
            tools: toGeminiTools(options.tools),
            generationConfig: options.generationConfig as Record<string, unknown> | undefined
        });

        return wrapGeminiModel(model);
    }
}
