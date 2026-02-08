import { GoogleGenerativeAI } from '@google/generative-ai';
import { getToolSchemas, DEFAULT_TOOLS } from '@/lib/toolLibrary';
import { executeWithRetry } from '@/app/actions';
import { SOFTWARE_ARCHITECT_PROMPT } from '@/lib/agents/prompts';
import AI_CONFIG from '@/lib/aiConfig';
import { deepSerialize } from '@/lib/serialization';
import { resolveModelId } from '@/lib/modelCatalog';

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
        model: requestedModel
    } = body || {};

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const enqueue = (data: any) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            try {
                const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
                if (!apiKey) {
                    enqueue({ type: 'error', message: 'API Key missing' });
                    controller.close();
                    return;
                }

                const genAI = new GoogleGenerativeAI(apiKey);

                // Construct System Instruction matching actions.ts logic
                const enabledTools = DEFAULT_TOOLS;
                const toolInstructions = "\n\nYou have access to a rich library of TOOLS. Use them whenever necessary to fulfill the request." +
                    `\nENABLED TOOLS: ${enabledTools.join(', ')}`;
                const systemInstruction = SOFTWARE_ARCHITECT_PROMPT + toolInstructions +
                    "\n\nMODE: STREAMING ASSISTANT." +
                    "\nTHINKING PROTOCOL: Use <thinking>...</thinking> tags at the start of your response for complex plans." +
                    (activeAppName ? `\nACTIVE APP: ${activeAppName} at ${activeAppPath}` : "");

                const tools = [{ functionDeclarations: getToolSchemas(enabledTools) }];
                const selectedModel = resolveModelId(requestedModel, AI_CONFIG.fastModel || 'gemini-2.0-flash');
                const model = genAI.getGenerativeModel({
                    model: selectedModel,
                    systemInstruction,
                    tools
                });

                const chat = model.startChat({
                    history: history,
                    generationConfig: {
                        temperature: 0.7,
                        topP: 0.95,
                        topK: 40,
                        maxOutputTokens: 8192,
                    }
                });

                let currentQuery = query;
                let maxTurns = 5;
                let lastToolResult = null;
                let lastToolUsed = '';
                let lastToolArgs = null;
                let thinking = '';

                while (maxTurns > 0) {
                    const result = await chat.sendMessageStream(currentQuery);
                    let fullText = '';

                    for await (const chunk of result.stream) {
                        const text = chunk.text();
                        if (text) {
                            fullText += text;

                            // Extract thinking on the fly or after completion
                            // For simplicity in streaming, we'll send the raw text and let the UI handle the tags
                            // but if we want to explicitly send 'thought' chunks, we can.
                            enqueue({ type: 'delta', text });
                        }
                    }

                    const response = await result.response;
                    const calls = response.functionCalls();

                    if (calls && calls.length > 0) {
                        maxTurns--;
                        const toolResults = [];

                        for (const call of calls) {
                            enqueue({ type: 'status', message: `Executing ${call.name}...` });
                            console.log(`🔧 [Stream] Executing tool: ${call.name}`, call.args);

                            const res = await executeWithRetry(call.name, call.args);

                            lastToolUsed = call.name;
                            lastToolArgs = call.args;
                            lastToolResult = res;

                            toolResults.push({
                                functionResponse: {
                                    name: call.name,
                                    response: res
                                }
                            });
                        }

                        // Check if we should keep going or if the model will talk next
                        // In Gemini Chat, after tool results, you MUST send them back to continue
                        const feedbackResult = await chat.sendMessageStream(toolResults);

                        // Continue loop to stream the AI's reaction to tool results
                        currentQuery = toolResults as any; // Not used because we already called sendMessageStream above

                        // We need to re-assign currentQuery or handle the next stream in this loop
                        // but actually sendMessageStream already triggered the next turn.
                        // So we should just continue the loop with the new feedbackResult.

                        // Wait, my loop structure is slightly off for manual recursion. 
                        // Let's refactor to handle the "Reaction" turn.

                        for await (const chunk of feedbackResult.stream) {
                            const text = chunk.text();
                            if (text) {
                                fullText += text;
                                enqueue({ type: 'delta', text });
                            }
                        }

                        const finalResponse = await feedbackResult.response;
                        const nextCalls = finalResponse.functionCalls();
                        if (!nextCalls || nextCalls.length === 0) {
                            // No more tools, we are done
                            break;
                        }
                        // If there are more tools, the loop will continue
                    } else {
                        // No tools called, we are done
                        break;
                    }
                }

                // Final payload
                enqueue({
                    type: 'done',
                    toolUsed: lastToolUsed || undefined,
                    toolResult: deepSerialize(lastToolResult) || undefined,
                    toolArgs: deepSerialize(lastToolArgs) || undefined
                });

                controller.close();
            } catch (error) {
                console.error('💥 Stream Route Error:', error);
                enqueue({
                    type: 'error',
                    message: error instanceof Error ? error.message : 'Streaming failed'
                });
                controller.close();
            }
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
