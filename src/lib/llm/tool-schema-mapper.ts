import type { LLMToolDefinition } from './types';

export function normalizeFunctionDeclaration(schema: unknown): LLMToolDefinition | null {
    if (!schema || typeof schema !== 'object') {
        return null;
    }

    const candidate = schema as Record<string, unknown>;
    if (typeof candidate.name !== 'string') {
        return null;
    }

    return {
        name: candidate.name,
        description: typeof candidate.description === 'string' ? candidate.description : undefined,
        parameters: candidate.parameters
    };
}

export function normalizeFunctionDeclarations(schemas: unknown[]): LLMToolDefinition[] {
    return schemas
        .map(normalizeFunctionDeclaration)
        .filter((schema): schema is LLMToolDefinition => schema !== null);
}
