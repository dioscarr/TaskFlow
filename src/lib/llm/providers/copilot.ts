import { CopilotClient, type CopilotSession, defineTool, type MessageOptions, type PermissionRequest, type PermissionRequestResult, type Tool, type ToolResultObject, approveAll } from '@github/copilot-sdk';

import type { CreateLLMModelOptions, LLMProvider } from '../provider';
import type { LLMChatOptions, LLMChatSession, LLMModel, LLMResponse, LLMToolDefinition } from '../types';

function stringifyToolResult(result: unknown): string {
    if (typeof result === 'string') {
        return result;
    }

    if (result == null) {
        return '';
    }

    try {
        return JSON.stringify(result);
    } catch {
        return String(result);
    }
}

function normalizeAssistantMessage(message: { data?: { content?: string } } | undefined): LLMResponse {
    return {
        text: message?.data?.content ?? '',
        toolCalls: [],
        raw: message
    };
}

function normalizeHistory(history?: unknown[]): string {
    if (!Array.isArray(history) || history.length === 0) {
        return '';
    }

    const lines = history.flatMap((entry) => {
        if (!entry || typeof entry !== 'object') {
            return [];
        }

        const candidate = entry as { role?: string; parts?: Array<{ text?: string }> };
        const text = Array.isArray(candidate.parts)
            ? candidate.parts.map(part => part?.text).filter((value): value is string => typeof value === 'string' && value.length > 0).join('\n')
            : '';

        if (!text) {
            return [];
        }

        const role = candidate.role === 'model' ? 'assistant' : (candidate.role || 'user');
        return [`${role.toUpperCase()}: ${text}`];
    });

    return lines.length > 0 ? `Conversation so far:\n${lines.join('\n\n')}\n\n` : '';
}

function createPrompt(prompt: string, history?: unknown[]): string {
    return `${normalizeHistory(history)}${prompt}`.trim();
}

class CopilotModelAdapter implements LLMModel {
    constructor(
        private readonly options: CreateLLMModelOptions,
        private readonly workingDirectory: string
    ) { }

    private async createSession(streaming = false, history?: unknown[]) {
        const client = new CopilotClient();
        const session = await client.createSession({
            model: this.options.model,
            streaming,
            workingDirectory: this.workingDirectory,
            systemMessage: this.options.systemInstruction
                ? { mode: 'append', content: this.options.systemInstruction }
                : undefined,
            tools: this.options.tools?.map((tool) =>
                defineTool(tool.name, {
                    description: tool.description,
                    parameters: (tool.parameters as Record<string, unknown> | undefined),
                    overridesBuiltInTool: true,
                    skipPermission: true,
                    handler: () => {
                        throw new Error(`Tool ${tool.name} must be supplied through a route-level handler.`);
                    }
                })
            ),
            availableTools: this.options.tools?.map(tool => tool.name),
            onPermissionRequest: approveAll,
            infiniteSessions: { enabled: false }
        });

        return {
            client,
            session,
            history
        };
    }

    async generateContent(input: string): Promise<LLMResponse> {
        const runtime = await this.createSession(false);

        try {
            const message = await runtime.session.sendAndWait({ prompt: input });
            return normalizeAssistantMessage(message);
        } finally {
            await runtime.session.disconnect();
            await runtime.client.stop();
        }
    }

    startChat(options?: LLMChatOptions): LLMChatSession {
        let runtimePromise: Promise<{ client: CopilotClient; session: CopilotSession; history?: unknown[] }> | null = null;

        const getRuntime = async () => {
            if (!runtimePromise) {
                runtimePromise = this.createSession(false, options?.history);
            }

            return runtimePromise;
        };

        return {
            sendMessage: async (input) => {
                if (typeof input !== 'string') {
                    const finalResult = input[input.length - 1];
                    return {
                        text: stringifyToolResult(finalResult?.result),
                        toolCalls: [],
                        raw: finalResult
                    };
                }

                const runtime = await getRuntime();
                const message = await runtime.session.sendAndWait({
                    prompt: createPrompt(input, runtime.history)
                });

                return normalizeAssistantMessage(message);
            }
        };
    }
}

export function toCopilotToolResult(result: unknown): ToolResultObject | string {
    if (typeof result === 'string') {
        return result;
    }

    const text = stringifyToolResult(result);
    const normalized = result && typeof result === 'object' ? result as Record<string, unknown> : null;

    return {
        textResultForLlm: text,
        resultType: normalized?.success === false ? 'failure' : 'success',
        error: normalized?.success === false && typeof normalized?.message === 'string' ? normalized.message : undefined,
        toolTelemetry: normalized ?? undefined
    };
}

export function createCopilotTools(
    tools: LLMToolDefinition[],
    executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>,
    options?: { skipPermission?: boolean }
): Tool<Record<string, unknown>>[] {
    return tools.map((tool) =>
        defineTool(tool.name, {
            description: tool.description,
            parameters: (tool.parameters as Record<string, unknown> | undefined),
            overridesBuiltInTool: true,
            skipPermission: options?.skipPermission ?? false,
            handler: async (args) => toCopilotToolResult(await executeTool(tool.name, args))
        })
    );
}

export function createCopilotPermissionHandler(options: {
    allowToolExecution: boolean;
    allowHighRiskExecution: boolean;
    isHighRiskTool: (toolName: string) => boolean;
    onDeniedTool?: (toolName: string, reason: 'tool-execution-disabled' | 'high-risk') => void;
}): (request: PermissionRequest) => PermissionRequestResult {
    return (request) => {
        const toolName = typeof request.toolName === 'string' ? request.toolName : '';

        if (request.kind !== 'custom-tool') {
            return { kind: 'denied-no-approval-rule-and-could-not-request-from-user' };
        }

        if (!options.allowToolExecution) {
            if (toolName) {
                options.onDeniedTool?.(toolName, 'tool-execution-disabled');
            }
            return { kind: 'denied-no-approval-rule-and-could-not-request-from-user' };
        }

        if (toolName && options.isHighRiskTool(toolName) && !options.allowHighRiskExecution) {
            options.onDeniedTool?.(toolName, 'high-risk');
            return { kind: 'denied-no-approval-rule-and-could-not-request-from-user' };
        }

        return { kind: 'approved' };
    };
}

export async function sendCopilotMessage(options: {
    model: string;
    prompt: string;
    systemInstruction?: string;
    attachments?: MessageOptions['attachments'];
    tools?: LLMToolDefinition[];
    availableToolNames?: string[];
    workingDirectory?: string;
    allowToolExecution: boolean;
    allowHighRiskExecution: boolean;
    isHighRiskTool: (toolName: string) => boolean;
    executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
    onDeniedTool?: (toolName: string, reason: 'tool-execution-disabled' | 'high-risk') => void;
    onEvent?: (event: { type: string; data: Record<string, unknown> }) => void;
}) {
    const client = new CopilotClient();
    const session = await client.createSession({
        model: options.model,
        streaming: true,
        workingDirectory: options.workingDirectory,
        systemMessage: options.systemInstruction
            ? { mode: 'append', content: options.systemInstruction }
            : undefined,
        tools: options.tools ? createCopilotTools(options.tools, options.executeTool) : undefined,
        availableTools: options.availableToolNames,
        onPermissionRequest: createCopilotPermissionHandler({
            allowToolExecution: options.allowToolExecution,
            allowHighRiskExecution: options.allowHighRiskExecution,
            isHighRiskTool: options.isHighRiskTool,
            onDeniedTool: options.onDeniedTool
        }),
        infiniteSessions: { enabled: false }
    });

    try {
        if (options.onEvent) {
            session.on((event) => {
                options.onEvent?.(event as { type: string; data: Record<string, unknown> });
            });
        }

        return await session.sendAndWait({
            prompt: options.prompt,
            attachments: options.attachments
        });
    } finally {
        await session.disconnect();
        await client.stop();
    }
}

export class CopilotProvider implements LLMProvider {
    readonly name = 'github-copilot' as const;

    constructor(private readonly workingDirectory: string = process.cwd()) { }

    createModel(options: CreateLLMModelOptions): LLMModel {
        return new CopilotModelAdapter(options, this.workingDirectory);
    }
}
