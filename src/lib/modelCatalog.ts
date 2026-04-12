export type ModelOption = {
    id: string;
    label: string;
    description: string;
};

export const MODEL_CATALOG: ModelOption[] = [
    {
        id: 'gpt-5.4',
        label: 'GPT-5.4',
        description: 'Primary Copilot model for complex reasoning and tools.'
    },
    {
        id: 'gpt-5-mini',
        label: 'GPT-5 mini',
        description: 'Faster, lower-cost Copilot model for lightweight tasks.'
    },
    {
        id: 'gpt-4.1',
        label: 'GPT-4.1',
        description: 'Stable Copilot model for broad compatibility.'
    },
    {
        id: 'claude-sonnet-4.5',
        label: 'Claude Sonnet 4.5',
        description: 'Copilot-accessible Anthropic model for strong reasoning.'
    },
    {
        id: 'gemini-2.0-flash',
        label: 'Gemini 2.0 Flash',
        description: 'Fast, cost-efficient for chat and tools.'
    },
    {
        id: 'gemini-1.5-flash',
        label: 'Gemini 1.5 Flash',
        description: 'Lightweight model for quick responses.'
    },
    {
        id: 'gemini-1.5-pro',
        label: 'Gemini 1.5 Pro',
        description: 'Deeper reasoning and longer context.'
    }
];

export const DEFAULT_CHAT_MODEL = 'gpt-5.4';

export const resolveModelId = (requested?: string, fallback: string = DEFAULT_CHAT_MODEL) => {
    if (!requested) return fallback;
    const match = MODEL_CATALOG.find(model => model.id === requested);
    return match ? match.id : fallback;
};
