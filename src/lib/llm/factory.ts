import AI_CONFIG, { getProviderDefaultModel } from '@/lib/aiConfig';

import type { CreateLLMModelOptions, LLMProvider } from './provider';
import { GeminiProvider } from './providers/gemini';
import { CopilotProvider } from './providers/copilot';

export function createConfiguredProvider(): LLMProvider {
    if (AI_CONFIG.provider === 'github-copilot') {
        return new CopilotProvider(process.cwd());
    }

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        throw new Error('Google Gemini API key missing');
    }

    return new GeminiProvider(apiKey);
}

export function createConfiguredModel(options: Omit<CreateLLMModelOptions, 'model'> & { model?: string; purpose?: 'fast' | 'smart' | 'vision' }) {
    const provider = createConfiguredProvider();
    return provider.createModel({
        ...options,
        model: options.model || getProviderDefaultModel(options.purpose || 'fast')
    });
}
