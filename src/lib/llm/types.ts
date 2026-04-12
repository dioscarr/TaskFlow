export interface LLMToolDefinition {
    name: string;
    description?: string;
    parameters?: unknown;
}

export interface LLMToolCall {
    name: string;
    args: Record<string, unknown>;
}

export interface LLMToolResult {
    name: string;
    result: unknown;
}

export interface LLMResponse {
    text: string;
    toolCalls: LLMToolCall[];
    raw?: unknown;
}

export interface LLMChatOptions {
    history?: unknown[];
    generationConfig?: Record<string, unknown>;
}

export interface LLMChatSession {
    sendMessage(input: string | LLMToolResult[]): Promise<LLMResponse>;
}

export interface LLMModel {
    generateContent(input: string): Promise<LLMResponse>;
    startChat(options?: LLMChatOptions): LLMChatSession;
}
