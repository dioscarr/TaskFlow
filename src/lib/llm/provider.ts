import type { LLMModel, LLMToolDefinition } from './types';

export type LLMProviderName = 'gemini' | 'github-copilot';

export interface CreateLLMModelOptions {
    model: string;
    systemInstruction?: string;
    tools?: LLMToolDefinition[];
    generationConfig?: Record<string, unknown>;
}

export interface LLMProvider {
    readonly name: LLMProviderName;
    createModel(options: CreateLLMModelOptions): LLMModel;
}
