import { GoogleGenerativeAI } from '@google/generative-ai';
import { getToolSchemas, DEFAULT_TOOLS, getToolRisk, TOOL_LIBRARY } from '@/lib/toolLibrary';
import { getSkillSchemas, DEFAULT_SKILLS, SKILLS_LIBRARY } from '@/lib/skillsLibrary';
import { executeWithRetry } from '@/app/actions';
import { SOFTWARE_ARCHITECT_PROMPT } from '@/lib/agents/prompts';
import AI_CONFIG, { getProviderDefaultModel } from '@/lib/aiConfig';
import { deepSerialize } from '@/lib/serialization';
import { generateTraceId, TraceContext } from '@/lib/tracing';
import { resolveModelId } from '@/lib/modelCatalog';
import { sessionMetricStore } from '@/lib/observability';
import { readFile as readFileFS } from 'fs/promises';
import { join } from 'path';
import prisma from '@/lib/prisma';
import { sendCopilotMessage } from '@/lib/llm/providers/copilot';
import { normalizeFunctionDeclarations } from '@/lib/llm/tool-schema-mapper';

// Retry configuration for stream reliability
const RETRY_CONFIG = {
    maxRetries: 1,
    initialBackoffMs: 250,
    maxBackoffMs: 1000
};

// Check if error is transient and retryable
function isTransientError(error: any): boolean {
    const message = error?.message || String(error);
    const transientPatterns = [
        'ECONNRESET',
        'ETIMEDOUT',
        'ENOTFOUND',
        'socket hang up',
        'network error',
        'fetch failed',
        'aborted',
        '503',
        '429',
        'rate limit'
    ];
    return transientPatterns.some(pattern =>
        message.toLowerCase().includes(pattern.toLowerCase())
    );
}

function formatCopilotHistory(history: Array<{ role?: string; parts?: Array<{ text?: string }> }> = []): string {
    const entries = history.flatMap((item) => {
        const content = Array.isArray(item.parts)
            ? item.parts.map(part => part?.text).filter((value): value is string => typeof value === 'string' && value.length > 0).join('\n')
            : '';

        if (!content) {
            return [];
        }

        const role = item.role === 'model' ? 'assistant' : (item.role || 'user');
        return [`${role.toUpperCase()}: ${content}`];
    });

    return entries.length > 0 ? `Conversation history:\n${entries.join('\n\n')}\n\n` : '';
}

function hydrateToolArgsWithContext(toolName: string, args: unknown, fileIds: string[] = []) {
    const normalizedArgs = args && typeof args === 'object'
        ? { ...(args as Record<string, unknown>) }
        : {} as Record<string, unknown>;

    if (SKILLS_LIBRARY[toolName]) {
        const currentFileIds = Array.isArray(normalizedArgs.fileIds)
            ? normalizedArgs.fileIds.filter((id): id is string => typeof id === 'string')
            : [];

        if (currentFileIds.length === 0 && fileIds.length > 0) {
            normalizedArgs.fileIds = fileIds;
        }
    }

    return normalizedArgs;
}

async function buildCopilotAttachments(fileIds: string[] = []) {
    if (!fileIds.length) {
        return [];
    }

    const resolvedFileIds = new Set<string>(fileIds);
    const files = await Promise.all(
        Array.from(resolvedFileIds).map(id => prisma.workspaceFile.findUnique({ where: { id } }))
    );

    return files
        .filter((file): file is NonNullable<typeof file> => Boolean(file))
        .filter(file => file.type !== 'folder')
        .map(file => ({
            type: 'file' as const,
            path: file.storagePath ? join(process.cwd(), file.storagePath) : join(process.cwd(), 'data', 'workspace', file.name),
            displayName: file.name
        }));
}

// Pre-process image files with Gemini Vision when Copilot can't handle them inline
async function extractImageContextWithVision(fileIds: string[]): Promise<string> {
    if (!fileIds.length) return '';
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) return '';

    const files = await Promise.all(
        fileIds.map(id => prisma.workspaceFile.findUnique({ where: { id } }))
    );
    const imageExts = new Set(['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif']);
    const imageFiles = files.filter((f): f is NonNullable<typeof f> => {
        if (!f) return false;
        const ext = f.name.split('.').pop()?.toLowerCase() || '';
        return imageExts.has(ext) || imageExts.has(f.type || '');
    });

    if (!imageFiles.length) return '';

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const descriptions: string[] = [];

    for (const file of imageFiles) {
        try {
            const filePath = file.storagePath
                ? join(process.cwd(), file.storagePath)
                : join(process.cwd(), 'data', 'workspace', file.name);
            const buffer = await readFileFS(filePath);
            if (buffer.length === 0) continue;

            const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
            const mimeMap: Record<string, string> = {
                png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
                webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
            };

            const result = await model.generateContent([
                {
                    inlineData: {
                        data: buffer.toString('base64'),
                        mimeType: mimeMap[ext] || 'image/jpeg'
                    }
                },
                'Extract ALL text visible in this image. Include every number, word, date, code, and identifier you can read. Format as structured text preserving the layout. If this is a receipt or invoice, extract: business name, RNC, NCF, date, items with prices, subtotal, ITBIS/tax, total, payment method.'
            ]);

            const text = result.response.text();
            if (text) {
                descriptions.push(`=== VISION EXTRACTION: ${file.name} ===\n${text}\n=== END VISION ===`);
            }
        } catch (err) {
            console.error(`Vision extraction failed for ${file.name}:`, err);
        }
    }

    return descriptions.join('\n\n');
}

type AppliedContext = {
    agent?: { id?: string; name?: string; description?: string };
    scope: { mode: 'workspace' | 'repo'; label: string };
    workflows: Array<{ name: string; stepCount: number }>;
};

function normalizeCapabilityIds(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return Array.from(new Set(
        value.filter((item): item is string =>
            typeof item === 'string' && (Boolean(TOOL_LIBRARY[item]) || Boolean(SKILLS_LIBRARY[item]))
        )
    ));
}

function normalizeWorkflowContext(value: unknown): Array<{ name: string; stepCount: number }> {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.map((workflow) => {
        const record = workflow && typeof workflow === 'object' ? workflow as Record<string, unknown> : {};
        const name = typeof record.name === 'string'
            ? record.name
            : typeof record.title === 'string'
                ? record.title
                : 'Workflow';
        const stepCount = Array.isArray(record.steps) ? record.steps.length : 0;
        return { name, stepCount };
    });
}

function buildWorkflowInstruction(workflows: Array<{ name: string; stepCount: number }>): string {
    if (workflows.length === 0) {
        return '';
    }

    return [
        'ASSIGNED WORKFLOWS:',
        ...workflows.map((workflow, index) => `${index + 1}. ${workflow.name}${workflow.stepCount > 0 ? ` (${workflow.stepCount} steps)` : ''}`),
        'Prefer these workflows when they match the request instead of defaulting to a generic answer.'
    ].join('\n');
}

export async function POST(request: Request) {
    let body;
    try {
        body = await request.json();
    } catch (e) {
        console.error('Failed to parse request body:', e);
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const {
        query,
        fileIds,
        history = [],
        currentFolder,
        currentFolderId,
        sessionId,
        verbosity = 'normal',
        activeAppName,
        activeAppPath,
        model: requestedModel,
        enabledToolIds,
        enabledCapabilityIds,
        allowToolExecution = true,
        allowHighRiskExecution = false,
        chatScope = 'workspace',
        activePromptId,
        activePromptName,
        activePromptDescription,
        activePromptPrompt,
        activePromptWorkflows
    } = body || {};

    const encoder = new TextEncoder();

    // P3-OBSERVABILITY: Generate Trace ID
    const traceId = generateTraceId();
    const traceContext: TraceContext = { traceId, sessionId: body.sessionId };
    console.log(`📡 Stream Request [Trace: ${traceId}]`);

    const stream = new ReadableStream({
        async start(controller) {
            const enqueue = (data: any) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            // Send initial trace ID event
            enqueue({ type: 'debug', message: `Trace ID: ${traceId}` });

            // P3-OBSERVABILITY: Record Session Turn
            if (sessionId) {
                // We don't await this to keep the stream snappy
                sessionMetricStore.recordTurn(sessionId);
            }

            // Track partial content and completed tools for retry
            let partialContent = '';
            const completedTools = new Set<string>();
            let retryCount = 0;

            // Shared tool tracking — accessible from both Copilot/Gemini paths AND the catch block
            let streamLastToolUsed = '';
            let streamLastToolResult: unknown = null;
            let streamLastToolArgs: Record<string, unknown> | null = null;
            let streamAppliedContext: Record<string, unknown> | undefined;

            const executeStream = async (): Promise<void> => {
                try {
                    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
                    if (AI_CONFIG.provider !== 'github-copilot' && !apiKey) {
                        enqueue({ type: 'error', message: 'API Key missing' });
                        controller.close();
                        return;
                    }

                    const appliedWorkflows = normalizeWorkflowContext(activePromptWorkflows);
                    const requestedCapabilities = normalizeCapabilityIds(enabledCapabilityIds);
                    const fallbackCapabilities = normalizeCapabilityIds(enabledToolIds);
                    const hasExplicitCapabilitySelection = requestedCapabilities.length > 0;
                    const hasSpecialistContext = Boolean(
                        (typeof activePromptName === 'string' && activePromptName.trim()) ||
                        (typeof activePromptPrompt === 'string' && activePromptPrompt.trim()) ||
                        appliedWorkflows.length > 0
                    );

                    let candidateCapabilities = requestedCapabilities.length > 0
                        ? requestedCapabilities
                        : fallbackCapabilities.length > 0
                            ? fallbackCapabilities
                            : DEFAULT_SKILLS.filter((id) => Boolean(TOOL_LIBRARY[id]) || Boolean(SKILLS_LIBRARY[id]));

                    if (!hasExplicitCapabilitySelection && !hasSpecialistContext) {
                        const defaultCapabilities = [...candidateCapabilities];
                        try {
                            const { classifyIntent, getToolsForIntent } = await import('@/lib/toolRouting');
                            const intentResult = classifyIntent(query, fileIds || [], []);
                            const allowedTools = new Set(getToolsForIntent(intentResult.intent));
                            const originalCount = candidateCapabilities.length;
                            candidateCapabilities = DEFAULT_TOOLS.filter((toolId: string) => allowedTools.has(toolId));

                            if (candidateCapabilities.length < 3) {
                                const general = new Set(getToolsForIntent('general_chat'));
                                candidateCapabilities = DEFAULT_TOOLS.filter((toolId: string) => general.has(toolId));
                            }

                            console.log(`📉 Stream Tool Reduction: ${originalCount} -> ${candidateCapabilities.length} tools`);
                        } catch (e) {
                            candidateCapabilities = defaultCapabilities;
                            console.error('Tool routing failed:', e);
                        }
                    }

                    const enabledCapabilities = candidateCapabilities.length > 0
                        ? candidateCapabilities
                        : DEFAULT_SKILLS.filter((id) => Boolean(TOOL_LIBRARY[id]) || Boolean(SKILLS_LIBRARY[id]));
                    const skillDecls = getSkillSchemas(enabledCapabilities)[0]?.functionDeclarations || [];
                    const toolDecls = getToolSchemas(enabledCapabilities);
                    const allDecls = [...skillDecls, ...toolDecls].filter((declaration, index, array) =>
                        array.findIndex((candidate) => candidate.name === declaration.name) === index
                    );

                    // Scope-based tool filtering: enforce chatScope by removing tools not matching the scope
                    const agentEnabledToolIds = new Set(enabledToolIds || []);
                    const scopeFilteredDecls = allDecls.filter(decl => {
                        // Agent-selected tools always override scope filtering
                        if (agentEnabledToolIds.has(decl.name)) return true;
                        const tool = TOOL_LIBRARY[decl.name] || SKILLS_LIBRARY[decl.name];
                        if (!tool?.scopeFilter || tool.scopeFilter === 'both') return true;
                        return tool.scopeFilter === chatScope;
                    });

                    const enabledFunctionNames = scopeFilteredDecls.map((declaration) => declaration.name);
                    const agentPrompt = typeof activePromptPrompt === 'string' && activePromptPrompt.trim()
                        ? activePromptPrompt.trim()
                        : SOFTWARE_ARCHITECT_PROMPT;
                    const workflowInstruction = buildWorkflowInstruction(appliedWorkflows);
                    const scopeInstruction = chatScope === 'repo'
                        ? 'CHAT SCOPE: REPO APPS. Prioritize work inside apps/* and avoid workspace file-manager operations unless the user explicitly asks for them.'
                        : 'CHAT SCOPE: FILE MANAGER. Prioritize workspace files, workspace file IDs, and local artifacts. Avoid repo app edits unless the user explicitly asks for them.';
                    const agentInstruction = activePromptName
                        ? `SELECTED AGENT: ${activePromptName}${activePromptDescription ? ` - ${activePromptDescription}` : ''}\nBehave as this specialist for the entire turn. If the user asks which agent is active, answer with this selected agent.`
                        : 'SELECTED AGENT: AI Assistant';
                    const toolInstructions = [
                        'You have access to a curated capability set. Use tools when they are necessary and aligned with the selected agent, workflow, and scope.',
                        `ENABLED CAPABILITIES: ${enabledCapabilities.join(', ') || 'none'}`,
                        `ENABLED FUNCTIONS: ${enabledFunctionNames.join(', ') || 'none'}`,
                        'TOOL DISCIPLINE:',
                        '- When files are attached to the message, use them directly via their IDs. Do NOT search the filesystem for them.',
                        '- When a skill (like receipt_intelligence) returns structured data, TRUST the result and present it. Do NOT re-search for the same information.',
                        '- Prefer ONE precise tool call over multiple exploratory calls. Minimize list_dir and search_codebase usage.',
                        '- Be concise in your responses. Present extracted data as a clean summary, not verbose paragraphs.'
                    ].join('\n');
                    // Build attached-file context so the AI knows what's available without searching
                    let attachedFileContext = '';
                    if (fileIds && fileIds.length > 0) {
                        try {
                            const attachedFiles = await Promise.all(
                                fileIds.map((id: string) => prisma.workspaceFile.findUnique({ where: { id }, select: { id: true, name: true, type: true, storagePath: true } }))
                            );
                            const validFiles = attachedFiles.filter(Boolean);
                            if (validFiles.length > 0) {
                                attachedFileContext = [
                                    'ATTACHED FILES (already available — do NOT search for them):',
                                    ...validFiles.map(f => `- ${f!.name} (id: ${f!.id}, type: ${f!.type}${f!.storagePath ? ', path: ' + f!.storagePath : ''})`)
                                ].join('\n');
                            }
                        } catch { /* non-critical */ }
                    }

                    const systemInstruction = [
                        agentPrompt,
                        agentInstruction,
                        scopeInstruction,
                        workflowInstruction,
                        activeAppName ? `ACTIVE APP: ${activeAppName}${activeAppPath ? ` at ${activeAppPath}` : ''}. Keep commands and edits inside this app unless the user broadens scope.` : '',
                        attachedFileContext,
                        toolInstructions,
                        'MODE: STREAMING ASSISTANT. Be concise. Present results clearly. Avoid verbose narration.',
                        'Respect the selected agent, scope, and workflows over generic defaults.'
                    ].filter(Boolean).join('\n\n');
                    const appliedContext: AppliedContext = {
                        agent: activePromptName ? {
                            id: typeof activePromptId === 'string' ? activePromptId : undefined,
                            name: activePromptName,
                            description: typeof activePromptDescription === 'string' ? activePromptDescription : undefined
                        } : undefined,
                        scope: {
                            mode: chatScope === 'repo' ? 'repo' : 'workspace',
                            label: chatScope === 'repo' ? 'Repo Apps' : 'File Manager'
                        },
                        workflows: appliedWorkflows
                    };
                    streamAppliedContext = appliedContext as unknown as Record<string, unknown>;

                    enqueue({ type: 'context', appliedContext });

                    const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

                    const selectedModel = resolveModelId(requestedModel, getProviderDefaultModel('fast'));

                    if (AI_CONFIG.provider === 'github-copilot') {
                        const attachments = await buildCopilotAttachments(fileIds || []);

                        // Pre-process images with Gemini Vision since Copilot can't handle inline images
                        const visionContext = await extractImageContextWithVision(fileIds || []);

                        const copilotPrompt = [
                            activeAppName ? `Active app: ${activeAppName}${activeAppPath ? ` at ${activeAppPath}` : ''}` : '',
                            visionContext ? `The user attached image file(s). Here is the extracted text from vision analysis:\n\n${visionContext}` : '',
                            formatCopilotHistory(history),
                            query
                        ].filter(Boolean).join('\n\n');

                        const deniedTools: string[] = [];
                        const deniedHighRiskTools: string[] = [];
                        const toolStartTimes = new Map<string, number>();
                        let toolInvocationCounter = 0;
                        let lastToolResult: unknown = null;
                        let lastToolUsed = '';
                        let lastToolArgs: Record<string, unknown> | null = null;

                        await sendCopilotMessage({
                            model: selectedModel,
                            prompt: copilotPrompt,
                            systemInstruction,
                            attachments,
                            tools: normalizeFunctionDeclarations(scopeFilteredDecls),
                            availableToolNames: enabledFunctionNames,
                            workingDirectory: process.cwd(),
                            allowToolExecution,
                            allowHighRiskExecution,
                            isHighRiskTool: (toolName) => getToolRisk(toolName) === 'high',
                            executeTool: async (toolName, args) => {
                                const hydratedArgs = hydrateToolArgsWithContext(toolName, args, fileIds || []);
                                const toolRunId = `${toolName}:${++toolInvocationCounter}`;
                                const startTime = Date.now();
                                toolStartTimes.set(toolRunId, startTime);

                                enqueue({
                                    type: 'tool_status',
                                    tool: toolName,
                                    phase: 'start',
                                    timestamp: startTime
                                });

                                const result = await executeWithRetry(toolName, hydratedArgs, traceContext);
                                const endTime = Date.now();
                                const elapsedMs = endTime - startTime;

                                enqueue({
                                    type: 'tool_status',
                                    tool: toolName,
                                    phase: 'finish',
                                    timestamp: endTime,
                                    elapsedMs
                                });

                                if (sessionId) {
                                    const isSuccess = result && typeof result === 'object' && 'success' in result
                                        ? (result as { success?: boolean }).success !== false
                                        : true;
                                    sessionMetricStore.recordToolUsage(sessionId, toolName, isSuccess, elapsedMs);
                                }

                                lastToolUsed = toolName;
                                lastToolResult = result;
                                lastToolArgs = hydratedArgs;
                                streamLastToolUsed = toolName;
                                streamLastToolResult = result;
                                streamLastToolArgs = hydratedArgs;
                                return result;
                            },
                            onDeniedTool: (toolName, reason) => {
                                deniedTools.push(toolName);
                                if (reason === 'high-risk') {
                                    deniedHighRiskTools.push(toolName);
                                }
                            },
                            onEvent: (event) => {
                                if (event.type === 'assistant.message_delta') {
                                    const text = typeof event.data.deltaContent === 'string' ? event.data.deltaContent : '';
                                    if (text) {
                                        partialContent += text;
                                        enqueue({ type: 'delta', text });
                                    }
                                    return;
                                }

                                if (event.type === 'assistant.reasoning_delta') {
                                    const text = typeof event.data.deltaContent === 'string' ? event.data.deltaContent : '';
                                    if (text) {
                                        enqueue({ type: 'thinking', text });
                                    }
                                    return;
                                }

                                if (event.type === 'tool.execution_start' || event.type === 'tool.execution_complete') {
                                    return;
                                }
                            }
                        });

                        if (deniedTools.length > 0) {
                            enqueue({
                                type: 'done',
                                toolUsed: undefined,
                                toolResult: {
                                    requiresApproval: true,
                                    proposedTools: deniedTools,
                                    highRiskTools: deniedHighRiskTools.length > 0 ? deniedHighRiskTools : undefined
                                },
                                toolArgs: undefined,
                                appliedContext
                            });
                        } else {
                            enqueue({
                                type: 'done',
                                toolUsed: lastToolUsed || undefined,
                                toolResult: deepSerialize(lastToolResult) || undefined,
                                toolArgs: deepSerialize(lastToolArgs) || undefined,
                                appliedContext
                            });
                        }

                        controller.close();
                        return;
                    }

                    const tools = [{ functionDeclarations: scopeFilteredDecls }];

                    // P3-CONTEXT-BUDGET: History Truncation
                    // Ensure we don't exceed the model's context window with massive history
                    const { getContextBudget, prioritizeFiles, getTruncationStrategy, generateTruncationReport } = await import('@/lib/contextBudget');
                    const budget = getContextBudget(selectedModel, query.length);

                    let currentHistory = [...history];
                    let totalHistoryChars = currentHistory.reduce((acc, h) => acc + (h.parts?.[0]?.text?.length || 0), 0);

                    if (totalHistoryChars > budget) {
                        const originalLength = currentHistory.length;
                        // Keep the last message? No, history is previous turns. 
                        // Remove from beginning (oldest).
                        while (totalHistoryChars > budget && currentHistory.length > 1) {
                            const removed = currentHistory.shift();
                            totalHistoryChars -= (removed?.parts?.[0]?.text?.length || 0);
                        }
                        if (currentHistory.length < originalLength) {
                            enqueue({ type: 'debug', message: `Context Budget: Trimmed history ${originalLength} -> ${currentHistory.length} msgs` });
                        }
                    }

                    // P3-CONTEXT-BUDGET: Resolve and truncate file attachments
                    let promptParts: any[] = [query];
                    let remainingContext = Math.max(0, budget - query.length);
                    const truncationResults: any[] = [];

                    const appendToPrompt = (text: string) => {
                        if (remainingContext <= 0) return false;
                        const slice = text.slice(0, remainingContext);
                        promptParts[0] += slice;
                        remainingContext -= slice.length;
                        return slice.length === text.length;
                    };

                    const getWorkspaceFilePath = (file: { storagePath?: string | null; name: string }) => {
                        if (file.storagePath) return join(process.cwd(), file.storagePath);
                        return join(process.cwd(), 'data', 'workspace', file.name);
                    };

                    if (fileIds && fileIds.length > 0) {
                        const resolvedFileIds = new Set<string>(fileIds);

                        const allFilesToProcess = await Promise.all(
                            Array.from(resolvedFileIds).map(id =>
                                prisma.workspaceFile.findUnique({ where: { id } })
                            )
                        );

                        const validFiles = allFilesToProcess.filter(f => f !== null) as any[];
                        const userSelectedIds = new Set<string>(fileIds);
                        const prioritizedFiles = prioritizeFiles(validFiles, userSelectedIds);

                        for (const file of prioritizedFiles) {
                            appendToPrompt(`\n(File: ${file.name})`);
                            const ext = file.name.split('.').pop()?.toLowerCase() || '';
                            const supportedImageExts = ['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif'];

                            if (supportedImageExts.includes(ext) && ['image', 'png', 'jpg', 'jpeg', 'webp', 'heic', 'heif'].includes(file.type)) {
                                try {
                                    const fileBuffer = await readFileFS(getWorkspaceFilePath(file));
                                    if (fileBuffer.length > 0) {
                                        let mimeType = "image/jpeg";
                                        if (ext === 'png') mimeType = "image/png";
                                        if (ext === 'webp') mimeType = "image/webp";
                                        if (ext === 'heic') mimeType = "image/heic";
                                        if (ext === 'heif') mimeType = "image/heif";
                                        
                                        promptParts.push({
                                            inlineData: { data: fileBuffer.toString('base64'), mimeType }
                                        });

                                        truncationResults.push({
                                            filename: file.name,
                                            originalSize: fileBuffer.length,
                                            truncatedSize: fileBuffer.length,
                                            truncated: false,
                                            percentage: 100,
                                            strategy: 'image'
                                        });
                                    }
                                } catch (err) {
                                    console.error(`Error reading image:`, err);
                                }
                            } else if (file.type === 'pdf') {
                                try {
                                    if (remainingContext <= 0) {
                                        appendToPrompt(`\n[Context budget exhausted - PDF skipped: ${file.name}]`);
                                        continue;
                                    }
                                    const fileBuffer = await readFileFS(getWorkspaceFilePath(file));
                                    const parseModule: any = await import('pdf-parse');
                                    const parser = parseModule?.default?.default ?? parseModule?.default ?? parseModule;
                                    const data = await parser(fileBuffer);
                                    let pdfText = data.text;
                                    const pdfBlock = `\n\n=== CONTENT OF PDF: ${file.name} ===\n${pdfText}\n=== END OF PDF ===\n`;

                                    const strategy = getTruncationStrategy('pdf');
                                    const availableSpace = remainingContext - 100;
                                    
                                    if (pdfBlock.length > availableSpace) {
                                        const result = strategy.truncate(pdfText, availableSpace);
                                        appendToPrompt(`\n\n=== CONTENT OF PDF: ${file.name} (truncated) ===\n${result.content}\n=== END OF PDF ===\n`);
                                        truncationResults.push({
                                            filename: file.name, originalSize: pdfText.length, truncatedSize: result.content.length,
                                            truncated: result.truncated, percentage: result.percentage, strategy: strategy.name
                                        });
                                    } else {
                                        appendToPrompt(pdfBlock);
                                        truncationResults.push({
                                            filename: file.name, originalSize: pdfText.length, truncatedSize: pdfText.length,
                                            truncated: false, percentage: 100, strategy: 'none'
                                        });
                                    }
                                } catch (e) { console.error(e); }
                            } else {
                                const textLikeExts = new Set(['txt', 'md', 'markdown', 'json', 'jsonl', 'csv', 'log', 'ts', 'tsx', 'js', 'jsx', 'css', 'scss', 'html', 'xml', 'yml', 'yaml']);
                                const textLikeTypes = new Set(['text', 'markdown', 'md', 'json', 'jsonl', 'csv', 'log', 'ts', 'tsx', 'js', 'jsx', 'css', 'scss', 'html', 'xml', 'yml', 'yaml']);

                                if (textLikeExts.has(ext) || textLikeTypes.has(file.type)) {
                                    try {
                                        if (remainingContext <= 0) {
                                            appendToPrompt(`\n[Context budget exhausted - file skipped: ${file.name}]`);
                                            continue;
                                        }
                                        const textContent = await readFileFS(getWorkspaceFilePath(file), 'utf-8');
                                        const block = `\n\n=== CONTENT OF FILE: ${file.name} ===\n${textContent}\n=== END OF FILE ===\n`;
                                        const strategy = getTruncationStrategy(ext);
                                        const availableSpace = remainingContext - 100;

                                        if (block.length > availableSpace) {
                                            const result = strategy.truncate(textContent, availableSpace);
                                            appendToPrompt(`\n\n=== CONTENT OF FILE: ${file.name} (truncated via ${strategy.name}) ===\n${result.content}\n=== END OF FILE ===\n`);
                                            truncationResults.push({
                                                filename: file.name, originalSize: textContent.length, truncatedSize: result.content.length,
                                                truncated: result.truncated, percentage: result.percentage, strategy: strategy.name
                                            });
                                        } else {
                                            appendToPrompt(block);
                                            truncationResults.push({
                                                filename: file.name, originalSize: textContent.length, truncatedSize: textContent.length,
                                                truncated: false, percentage: 100, strategy: 'none'
                                            });
                                        }
                                    } catch(e) { console.error(e); }
                                }
                            }
                        }
                    }

                    const truncationReport = generateTruncationReport(truncationResults);

                    const model = genAI.getGenerativeModel({
                        model: selectedModel,
                        systemInstruction,
                        tools
                    });

                    const chat = model.startChat({
                        history: currentHistory,
                        generationConfig: {
                            temperature: 0.7,
                            topP: 0.95,
                            topK: 40,
                            maxOutputTokens: 8192,
                        }
                    });

                    let lastToolResult = null;
                    let lastToolUsed = '';
                    let lastToolArgs = null;

                    const MAX_TURNS = 6;

                    const runTurn = async (input: any, depth = 0): Promise<void> => {
                        if (depth >= MAX_TURNS) {
                            enqueue({ type: 'error', message: 'Max tool turns reached.' });
                            return;
                        }

                        const result = await chat.sendMessageStream(input);

                        for await (const chunk of result.stream) {
                            const text = chunk.text();
                            if (text) {
                                partialContent += text; // Preserve partial output for retry
                                enqueue({ type: 'delta', text });
                            }
                        }

                        const response = await result.response;
                        const calls = response.functionCalls();

                        if (!calls || calls.length === 0) {
                            return;
                        }

                        const proposedTools = calls.map(c => c.name);
                        const highRiskTools = proposedTools.filter(tool => getToolRisk(tool) === 'high');

                        if (highRiskTools.length > 0 && !allowHighRiskExecution) {
                            enqueue({
                                type: 'done',
                                toolUsed: undefined,
                                toolResult: { requiresApproval: true, proposedTools, highRiskTools },
                                toolArgs: undefined,
                                appliedContext
                            });
                            return;
                        }

                        if (!allowToolExecution) {
                            enqueue({
                                type: 'done',
                                toolUsed: undefined,
                                toolResult: { requiresApproval: true, proposedTools },
                                toolArgs: undefined,
                                appliedContext
                            });
                            return;
                        }

                        const toolResults = [] as { functionResponse: { name: string; response: any } }[];

                        for (const call of calls) {
                            const toolKey = `${call.name}:${JSON.stringify(call.args)}`;

                            // Skip if already executed (prevents duplicate execution on retry)
                            if (completedTools.has(toolKey)) {
                                console.log(`⏭️ [Stream] Skipping already executed tool: ${call.name}`);
                                continue;
                            }

                            // Emit tool start event with timestamp
                            const toolStartTime = Date.now();
                            enqueue({
                                type: 'tool_status',
                                tool: call.name,
                                phase: 'start',
                                timestamp: toolStartTime
                            });

                            console.log(`🔧 [Stream] Executing tool: ${call.name} [Trace: ${traceId}]`, call.args);

                            const hydratedArgs = hydrateToolArgsWithContext(call.name, call.args, fileIds || []);
                            const res = await executeWithRetry(call.name, hydratedArgs, traceContext);

                            // Emit tool finish event with elapsed time
                            const toolEndTime = Date.now();
                            const elapsedMs = toolEndTime - toolStartTime;
                            enqueue({
                                type: 'tool_status',
                                tool: call.name,
                                phase: 'finish',
                                timestamp: toolEndTime,
                                elapsedMs
                            });

                            // P3-OBSERVABILITY: Record Tool Usage
                            if (sessionId) {
                                const isSuccess = res && res.success !== false; // assume success unless explicit false
                                sessionMetricStore.recordToolUsage(sessionId, call.name, isSuccess, elapsedMs);
                            }

                            lastToolUsed = call.name;
                            lastToolArgs = call.args;
                            lastToolResult = res;
                            streamLastToolUsed = call.name;
                            streamLastToolResult = res;
                            streamLastToolArgs = call.args as Record<string, unknown>;

                            // Mark tool as completed to prevent duplicate execution
                            completedTools.add(toolKey);

                            toolResults.push({
                                functionResponse: {
                                    name: call.name,
                                    response: res
                                }
                            });
                        }

                        if (toolResults.length !== calls.length) {
                            enqueue({ type: 'error', message: 'Tool response count mismatch.' });
                            return;
                        }

                        await runTurn(toolResults, depth + 1);
                    };

                    await runTurn(promptParts);

                    // Final payload
                    enqueue({
                        type: 'done',
                        toolUsed: lastToolUsed || undefined,
                        toolResult: deepSerialize(lastToolResult) || undefined,
                        toolArgs: deepSerialize(lastToolArgs) || undefined,
                        truncationReport: truncationReport?.truncatedFiles?.length > 0 ? truncationReport : undefined,
                        appliedContext
                    });

                    controller.close();
                } catch (error) {
                    console.error('💥 Stream Route Error:', error);
                    const errorMessage = error instanceof Error ? error.message : String(error);

                    if (errorMessage.includes('session.idle') && (partialContent || streamLastToolUsed || streamLastToolResult)) {
                        console.warn('⚠️ Recovering from session.idle timeout with partial stream content.');
                        enqueue({
                            type: 'done',
                            toolUsed: streamLastToolUsed || undefined,
                            toolResult: deepSerialize(streamLastToolResult) || undefined,
                            toolArgs: deepSerialize(streamLastToolArgs) || undefined,
                            appliedContext: streamAppliedContext
                        });
                        if (sessionId) {
                            sessionMetricStore.recordError(sessionId, `Recovered from ${errorMessage}`);
                        }
                        controller.close();
                        return;
                    }

                    // Check if error is transient and we haven't exceeded retry limit
                    if (isTransientError(error) && retryCount < RETRY_CONFIG.maxRetries) {
                        retryCount++;
                        const backoffMs = Math.min(
                            RETRY_CONFIG.initialBackoffMs * Math.pow(2, retryCount - 1),
                            RETRY_CONFIG.maxBackoffMs
                        );

                        console.log(`🔄 [Stream] Retrying after ${backoffMs}ms (attempt ${retryCount}/${RETRY_CONFIG.maxRetries})`);
                        enqueue({
                            type: 'status',
                            phase: 'retry',
                            message: `Connection interrupted. Retrying in ${backoffMs}ms...`,
                            retryCount,
                            backoffMs
                        });

                        // Wait for backoff period
                        await new Promise(resolve => setTimeout(resolve, backoffMs));

                        // Retry the stream
                        return executeStream();
                    }

                    // Non-transient error or max retries exceeded
                    enqueue({
                        type: 'error',
                        message: errorMessage,
                        partialContent: partialContent || undefined
                    });

                    // P3-OBSERVABILITY: Record Stream Error
                    if (sessionId) {
                        sessionMetricStore.recordError(sessionId, errorMessage);
                    }
                    controller.close();
                }
            };

            // Start the stream execution
            await executeStream();
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        }
    });
}
