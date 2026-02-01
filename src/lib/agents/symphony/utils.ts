
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
                console.error(`❌ FAILED TO EXTRACT JSON from ${agent.name}'s response`);
                console.error(`📝 RAW RESPONSE:\n${rawResponse.substring(0, 1000)}${rawResponse.length > 1000 ? '\n...(truncated)' : ''}`);
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
            currentPrompt = `[SYSTEM: RETRY REQUIRED]\n\nYour previous JSON response was invalid and failed validation.\n\nERROR: ${errorMessage}\n\nORIGINAL OBJECTIVE: ${prompt}\n\n⚠️ CRITICAL: You MUST respond with ONLY valid JSON (wrapped in \`\`\`json code block). No additional text. No explanations outside the code block.`;


        } catch (error) {
            console.warn(`⚠️ Agent ${agent.name} error (Attempt ${attempts + 1}/${maxRetries + 1}):`, error);
            attempts++;

            currentPrompt = `[SYSTEM: RETRY REQUIRED - JSON PARSE ERROR]\n\nYour previous response could not be parsed as JSON.\n\nERROR: ${error instanceof Error ? error.message : String(error)}\n\nORIGINAL OBJECTIVE: ${prompt}\n\n⚠️ CRITICAL: Return ONLY valid JSON wrapped in triple backticks with the "json" language identifier:\n\`\`\`json\n{your json here}\n\`\`\`\n\nDo not include any text before or after the code block.`;
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
    if (jsonBlockMatch) {
        const extracted = jsonBlockMatch[1].trim();
        if (isValidJson(extracted)) {
            return extracted;
        }
    }

    // Look for generic ``` blocks
    const blockMatch = text.match(/```\s*([\s\S]*?)\s*```/);
    if (blockMatch) {
        const extracted = blockMatch[1].trim();
        if (isValidJson(extracted)) {
            return extracted;
        }
    }

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
            if (braceCount === 0 && start !== -1) {
                end = i;
                // If we found a complete object, validate and return it
                const extracted = text.substring(start, end + 1);
                if (isValidJson(extracted)) {
                    return extracted;
                }
            }
        }
    }

    // Fallback: simple index lookup if the counting failed (e.g. malformed)
    const simpleStart = text.indexOf('{');
    const simpleEnd = text.lastIndexOf('}');
    if (simpleStart !== -1 && simpleEnd !== -1 && simpleEnd > simpleStart) {
        const extracted = text.substring(simpleStart, simpleEnd + 1);
        if (isValidJson(extracted)) {
            return extracted;
        }
    }

    return null;
}

/**
 * Helper function to validate if a string is valid JSON
 */
function isValidJson(str: string): boolean {
    try {
        JSON.parse(str);
        return true;
    } catch {
        return false;
    }
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
