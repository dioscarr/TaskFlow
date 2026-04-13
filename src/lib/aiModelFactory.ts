/**
 * Centralized AI Model Factory
 *
 * ALL server-side AI calls should go through this module instead of
 * directly instantiating GoogleGenerativeAI. This respects the
 * AI_CONFIG.provider setting and routes to the appropriate backend.
 */

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import AI_CONFIG, { getProviderDefaultModel } from '@/lib/aiConfig';
import { CopilotClient, approveAll } from '@github/copilot-sdk';

// Re-export SchemaType so callers don't need a separate import for structured output
export { SchemaType };

export interface GenerateTextOptions {
    model?: string;
    purpose?: 'fast' | 'smart' | 'vision';
    systemInstruction?: string;
    jsonOutput?: boolean;
    generationConfig?: Record<string, unknown>;
}

export type ContentPart =
    | string
    | { inlineData: { data: string; mimeType: string } };

function getGeminiApiKey(): string | undefined {
    return process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
}

function isCopilotProvider(): boolean {
    return AI_CONFIG.provider === 'github-copilot';
}

function resolveModel(options?: GenerateTextOptions): string {
    if (options?.model) return options.model;
    return getProviderDefaultModel(options?.purpose ?? 'fast');
}

function hasVisionParts(parts: ContentPart[]): boolean {
    return parts.some(p => typeof p !== 'string' && p.inlineData);
}

/**
 * Generate text using the configured AI provider.
 * Falls back to Gemini when Copilot is selected but unavailable or fails.
 */
export async function generateAIText(
    prompt: string,
    options?: GenerateTextOptions
): Promise<string> {
    if (isCopilotProvider()) {
        try {
            return await generateViaCopilot(prompt, options);
        } catch (err) {
            console.warn('Copilot text generation failed, falling back to Gemini:', err);
        }
    }

    return generateViaGemini(prompt, options);
}

/**
 * Generate content from multimodal parts (text + images).
 * For vision calls, if Copilot is active but the input contains inline image
 * data, we fall back to Gemini since the Copilot SDK text-only path can't
 * handle raw base64 vision payloads.
 */
export async function generateAIContent(
    parts: ContentPart[],
    options?: GenerateTextOptions
): Promise<string> {
    const hasVision = hasVisionParts(parts);

    if (isCopilotProvider() && !hasVision) {
        try {
            const textPrompt = parts
                .filter((p): p is string => typeof p === 'string')
                .join('\n');
            return await generateViaCopilot(textPrompt, options);
        } catch (err) {
            console.warn('Copilot content generation failed, falling back to Gemini:', err);
        }
    }

    return generateViaGeminiMultimodal(parts, options);
}

// ---------------------------------------------------------------------------
// Internal: Copilot path
// ---------------------------------------------------------------------------

async function generateViaCopilot(
    prompt: string,
    options?: GenerateTextOptions
): Promise<string> {
    const model = resolveModel(options);
    const client = new CopilotClient();

    const session = await client.createSession({
        model,
        streaming: false,
        workingDirectory: process.cwd(),
        systemMessage: options?.systemInstruction
            ? { mode: 'append', content: options.systemInstruction }
            : undefined,
        onPermissionRequest: approveAll,
        infiniteSessions: { enabled: false }
    });

    try {
        const message = await session.sendAndWait({ prompt });
        return message?.data?.content ?? '';
    } finally {
        await session.disconnect();
        await client.stop();
    }
}

// ---------------------------------------------------------------------------
// Internal: Gemini paths
// ---------------------------------------------------------------------------

function buildGeminiModel(options?: GenerateTextOptions) {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        throw new Error('Google Gemini API key missing (GOOGLE_GEMINI_API_KEY)');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = options?.model
        ?? (options?.purpose === 'smart' ? AI_CONFIG.smartModel
            : options?.purpose === 'vision' ? AI_CONFIG.visionModel
                : AI_CONFIG.fastModel);

    return genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: options?.systemInstruction,
        generationConfig: options?.generationConfig as any
    });
}

async function generateViaGemini(
    prompt: string,
    options?: GenerateTextOptions
): Promise<string> {
    const model = buildGeminiModel(options);
    const result = await model.generateContent(prompt);
    return result.response.text();
}

async function generateViaGeminiMultimodal(
    parts: ContentPart[],
    options?: GenerateTextOptions
): Promise<string> {
    const model = buildGeminiModel(options);
    const result = await model.generateContent(parts as any);
    return result.response.text();
}
