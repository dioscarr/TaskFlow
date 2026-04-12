
/**
 * Centralized configuration for AI Models.
 * Use this single source of truth to manage model versions across the application.
 */

export const AI_CONFIG = {
    provider: process.env.AI_PROVIDER || 'github-copilot',

    // fast: Used for workers, simple tasks, and chat (cost-effective)
    fastModel: 'gemini-2.0-flash',

    // smart: Used for orchestration, planning, and complex reasoning
    // Currently set to flash for cost/speed as requested, but can be switched to 'gemini-1.5-pro' or 'gemini-ultra' later.
    smartModel: 'gemini-2.0-flash',

    // vision: Used for image analysis
    visionModel: 'gemini-2.0-flash',

    // Tool execution defaults
    // 'synchronous' = run tools/agents inline during the chat turn (BLOCKS UI - NOT RECOMMENDED)
    // 'background' = enqueue jobs to background worker (RECOMMENDED for responsiveness)
    toolExecutionMode: process.env.TOOL_EXECUTION_MODE || 'background',

    // Number of automatic retries to attempt for failed tool calls (default 1)
    toolAutoRetry: Number(process.env.TOOL_AUTO_RETRY ?? 1),

    providers: {
        gemini: {
            apiKeyEnv: 'GOOGLE_GEMINI_API_KEY',
            fastModel: 'gemini-2.0-flash',
            smartModel: 'gemini-2.0-flash',
            visionModel: 'gemini-2.0-flash'
        },
        githubCopilot: {
            apiKeyEnv: 'GITHUB_COPILOT_API_KEY',
            fastModel: 'gpt-5.4',
            smartModel: 'gpt-5.4',
            visionModel: 'gpt-5.4'
        }
    }
};

export function getProviderDefaultModel(purpose: 'fast' | 'smart' | 'vision' = 'fast') {
    if (AI_CONFIG.provider === 'github-copilot') {
        if (purpose === 'smart') return AI_CONFIG.providers.githubCopilot.smartModel;
        if (purpose === 'vision') return AI_CONFIG.providers.githubCopilot.visionModel;
        return AI_CONFIG.providers.githubCopilot.fastModel;
    }

    if (purpose === 'smart') return AI_CONFIG.providers.gemini.smartModel;
    if (purpose === 'vision') return AI_CONFIG.providers.gemini.visionModel;
    return AI_CONFIG.providers.gemini.fastModel;
}

export default AI_CONFIG;
