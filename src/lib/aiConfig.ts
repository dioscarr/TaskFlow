
/**
 * Centralized configuration for AI Models.
 * Use this single source of truth to manage model versions across the application.
 */

export const AI_CONFIG = {
    // fast: Used for workers, simple tasks, and chat (cost-effective)
    fastModel: 'gemini-2.0-flash',

    // smart: Used for orchestration, planning, and complex reasoning
    // Currently set to flash for cost/speed as requested, but can be switched to 'gemini-1.5-pro' or 'gemini-ultra' later.
    smartModel: 'gemini-2.0-flash',

    // vision: Used for image analysis
    visionModel: 'gemini-2.0-flash'
};

export default AI_CONFIG;
