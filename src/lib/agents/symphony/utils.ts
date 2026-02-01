
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { AgentModel, Logger } from "./types";

/**
 * Calls an AI agent and enforces a Zod schema on the response with automatic retries.
 */
export async function callAgentWithRetry<T>(
    agent: AgentModel,
    prompt: string,
    schema: z.ZodSchema<T>,
    maxRetries = 2,
    logger?: Logger
): Promise<T> {
    let attempts = 0;
    let currentPrompt = prompt;

    while (attempts <= maxRetries) {
        try {
            const rawResponse = await agent.complete(currentPrompt);

            // Extract and log thinking if present
            const thoughtMatch = rawResponse.match(/<thinking>([\s\S]*?)<\/thinking>/);
            if (thoughtMatch && logger) {
                await logger(thoughtMatch[1].trim(), 'thinking');
            }

            // Attempt to parse JSON from the response (handling potentially wrapped markdown code blocks)
            const cleanJson = extractJson(rawResponse);
            if (!cleanJson) {
                console.log('📝 RAW RESPONSE (No JSON found):\n', rawResponse);
                throw new Error("No JSON found in response");
            }

            const json = JSON.parse(cleanJson);
            const result = schema.safeParse(json);

            if (result.success) {
                return result.data;
            }

            // Validation failed
            const errorMessage = fromZodError(result.error as any).message;
            console.warn(`⚠️ Agent ${agent.name} validation failed (Attempt ${attempts + 1}/${maxRetries + 1}): ${errorMessage}`);
            console.log('📝 RAW RESPONSE:\n', rawResponse); // DEBUGGING: Show me what you got

            attempts++;
            currentPrompt = `
Your previous response was invalid. 
ERROR: ${errorMessage}

ORIGINAL INSTRUCTIONS: ${prompt}

Please fix the JSON structure and return ONLY the corrected JSON.
            `.trim();

        } catch (error) {
            console.warn(`⚠️ Agent ${agent.name} error (Attempt ${attempts + 1}/${maxRetries + 1}):`, error);
            attempts++;

            currentPrompt = `
Your previous response could not be parsed as JSON.
ERROR: ${error instanceof Error ? error.message : String(error)}

ORIGINAL INSTRUCTIONS: ${prompt}

Return ONLY valid JSON.
            `.trim();
        }
    }

    throw new Error(`Max retries (${maxRetries}) reached. Agent ${agent.name} unable to provide valid output.`);
}

/**
 * Helper to extract JSON from potentially Markdown-wrapped text
 */
function extractJson(text: string): string | null {
    // Remove <thinking> blocks first to avoid confusion
    text = text.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();

    // Look for ```json blocks first (most reliable)
    const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) return jsonBlockMatch[1];

    // Look for generic ``` blocks
    const blockMatch = text.match(/```\s*([\s\S]*?)\s*```/);
    if (blockMatch) return blockMatch[1];

    // Attempt to find the outermost { and }
    // This handles cases where the model validates "Here is the JSON: { ... }" without code blocks
    let start = -1;
    let end = -1;
    let braceCount = 0;

    for (let i = 0; i < text.length; i++) {
        if (text[i] === '{') {
            if (braceCount === 0) start = i;
            braceCount++;
        } else if (text[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
                end = i;
                // If we found a complete object, return it. 
                // We assume the first valid full object is the response.
                return text.substring(start, end + 1);
            }
        }
    }

    // Fallback: simple index lookup if the counting failed (e.g. malformed)
    const simpleStart = text.indexOf('{');
    const simpleEnd = text.lastIndexOf('}');
    if (simpleStart !== -1 && simpleEnd !== -1 && simpleEnd > simpleStart) {
        return text.substring(simpleStart, simpleEnd + 1);
    }

    return null;
}

/**
 * Escalate to a more powerful model if the primary model fails.
 */
export async function callAgentWithEscalation<T>(
    primaryAgent: AgentModel,
    escalationAgent: AgentModel | undefined,
    prompt: string,
    schema: z.ZodSchema<T>,
    maxRetries = 2,
    logger?: Logger
): Promise<T> {
    try {
        return await callAgentWithRetry(primaryAgent, prompt, schema, maxRetries, logger);
    } catch (error) {
        if (!escalationAgent) {
            throw error;
        }

        console.warn(`🔥 Escalating task to senior agent ${escalationAgent.name} after failure.`);

        const escalationPrompt = `
The previous model failed to complete this task correctly. 
Please resolve the following objective with high precision.

OBJECTIVE: ${prompt}
        `.trim();

        return await callAgentWithRetry(escalationAgent, escalationPrompt, schema, 1, logger);
    }
}
