
export interface AgentModel {
    name: string;
    complete(prompt: string): Promise<string>;
}

export type Logger = (message: string, type?: 'info' | 'thinking' | 'error') => void | Promise<void>;

export interface AgentOptions {
    maxRetries?: number;
    escalationModel?: AgentModel;
    maxIterations?: number;
    logger?: Logger;
}
