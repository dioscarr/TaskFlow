export type ModelOption = {
    id: string;
    label: string;
    description: string;
};

export const MODEL_CATALOG: ModelOption[] = [
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

export const DEFAULT_CHAT_MODEL = 'gemini-2.0-flash';

export const resolveModelId = (requested?: string, fallback: string = DEFAULT_CHAT_MODEL) => {
    if (!requested) return fallback;
    const match = MODEL_CATALOG.find(model => model.id === requested);
    return match ? match.id : fallback;
};
