/**
 * Core System Prompts for AI Agents
 * These prompts define the default behavior and operational rules for all software agents.
 */

/**
 * Senior Full-Stack Software Architect prompt
 * This is the DEFAULT prompt for all software development agents.
 */
export const SOFTWARE_ARCHITECT_PROMPT = `You are TaskFlow AI, a pragmatic software assistant.

Goals:
- Be concise, direct, and action-oriented.
- Do NOT include internal reasoning, role labels, or tool-call syntax in responses.
- Use tools when needed; otherwise answer directly.
- Ask questions only when required inputs are missing.
- Avoid placeholders and follow repository conventions.

Tooling rules:
- Use tools by name with valid JSON args; never fabricate tool results.
- Prefer apply_patch for edits; use replace_in_file only for stable, unique targets.
- For dev servers, use manage_app_lifecycle.
- For builds, installs, diagnostics, and git, use run_in_terminal (or execute_command when required).
- Do not start dev servers via terminal commands.

Context rules:
- Respect active app context; keep file operations within the active app root when set.
- Prefer existing folders and avoid clutter in the workspace root.

If the user asks for complex planning, provide a short plan only when asked.`;


/**
 * Event types for agent activity logging
 */
export type AgentEventType =
    | 'thinking'      // Internal monologue/reasoning
    | 'reading'       // Reading/analyzing files
    | 'generating'    // Creating new content/code
    | 'editing'       // Modifying existing files
    | 'executing'     // Running commands/tools
    | 'reviewing'     // Self-correction/review phase
    | 'planning'      // Creating execution plans
    | 'summary';      // Final summary for stakeholders

/**
 * File operation record with edit statistics
 */
export interface FileOperationRecord {
    path: string;
    operation: 'create' | 'read' | 'edit' | 'delete' | 'move';
    linesAdded?: number;
    linesRemoved?: number;
    fileType: string;
    timestamp: string;
    purpose?: string;
}

/**
 * Get file type icon based on extension
 */
export function getFileTypeIcon(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const iconMap: Record<string, string> = {
        'ts': '📘',
        'tsx': '⚛️',
        'js': '📒',
        'jsx': '⚛️',
        'json': '📋',
        'md': '📝',
        'html': '🌐',
        'css': '🎨',
        'scss': '🎨',
        'py': '🐍',
        'sql': '🗃️',
        'prisma': '💎',
        'yml': '⚙️',
        'yaml': '⚙️',
        'env': '🔐',
        'sh': '🖥️',
        'dockerfile': '🐳',
        'png': '🖼️',
        'jpg': '🖼️',
        'jpeg': '🖼️',
        'svg': '🎨',
        'gif': '🖼️',
        'pdf': '📄',
    };
    return iconMap[ext] || '📄';
}

/**
 * Format file edit statistics
 */
export function formatEditStats(added: number, removed: number): string {
    const addStr = added > 0 ? `+${added}` : '';
    const remStr = removed > 0 ? `-${removed}` : '';
    return [addStr, remStr].filter(Boolean).join(' ');
}

/**
 * Generate stakeholder-ready summary
 */
export function generateStakeholderSummary(operations: FileOperationRecord[]): string {
    const created = operations.filter(o => o.operation === 'create');
    const edited = operations.filter(o => o.operation === 'edit');
    const totalAdded = operations.reduce((sum, o) => sum + (o.linesAdded || 0), 0);
    const totalRemoved = operations.reduce((sum, o) => sum + (o.linesRemoved || 0), 0);

    let summary = `## 📊 Session Summary\n\n`;
    summary += `### Overview\n`;
    summary += `- **Files Created:** ${created.length}\n`;
    summary += `- **Files Modified:** ${edited.length}\n`;
    summary += `- **Lines Added:** +${totalAdded}\n`;
    summary += `- **Lines Removed:** -${totalRemoved}\n`;
    summary += `- **Net Change:** ${totalAdded - totalRemoved >= 0 ? '+' : ''}${totalAdded - totalRemoved} lines\n\n`;

    if (created.length > 0) {
        summary += `### 📁 New Files\n`;
        created.forEach(f => {
            summary += `- ${getFileTypeIcon(f.path)} \`${f.path}\`${f.purpose ? ` - ${f.purpose}` : ''}\n`;
        });
        summary += '\n';
    }

    if (edited.length > 0) {
        summary += `### ✏️ Modified Files\n`;
        edited.forEach(f => {
            const stats = formatEditStats(f.linesAdded || 0, f.linesRemoved || 0);
            summary += `- ${getFileTypeIcon(f.path)} \`${f.path}\` ${stats}\n`;
        });
        summary += '\n';
    }

    return summary;
}

/**
 * Cognitive Agent system prompt (for planning tasks)
 */
export const COGNITIVE_AGENT_PROMPT = `You are the Cognitive Brain of an AI system.
Your responsibility is to analyze user requests and generate STRATEGIC EXECUTION PLANS.

${SOFTWARE_ARCHITECT_PROMPT}

PLANNING RULES:
1. CONSULTATION PROTOCOL: You are not a single agent; you are a team. Before proposing a plan, mentally consult with your Specialized Tool Agents.
2. CONSTRUCTIVE CRITIQUE: Your primary value is precision. Identify improvement opportunities, ambiguities, or risks to address. 
3. RESEARCH QUESTIONS: Formulate 2-3 "Real Questions" to ask the Tool Agent or User to ensure the right solution fit.
4. JSON CONTEXT: Always treat the provided workspace metadata as a precise JSON data structure.
5. Break down complex tasks into logical phases (Blueprint → Foundation → Implementation → Polish).
6. Identify which specialist agent should handle each phase.
7. If the task requires expert UI/UX or design, suggest the 'designer' specialist.
8. If the task requires research or data analysis, suggest the 'researcher' specialist.
9. Output valid JSON for the execution plan, including 'critiques', 'researchQuestions', and 'confidenceScore'.
10. MANDATORY: If the plan involves creating/modifying files, include a final step to sync the workspace.
`;

/**
 * Workflows and specialist prompts are now integrated into the Elite Architect.
 */
export const WORKER_AGENT_PROMPT = SOFTWARE_ARCHITECT_PROMPT;
export const ORCHESTRATOR_AGENT_PROMPT = SOFTWARE_ARCHITECT_PROMPT;
export const RESEARCHER_PROMPT = SOFTWARE_ARCHITECT_PROMPT;
export const DEVELOPER_PROMPT = SOFTWARE_ARCHITECT_PROMPT;
export const REVIEWER_PROMPT = SOFTWARE_ARCHITECT_PROMPT;


/**
 * Default agent names and their roles
 */
export const AGENT_ROLES = {
    orchestrator: {
        name: 'Army Commander',
        description: 'Lead Architect coordinating the development task force.'
    },
    designer: {
        name: 'UI/UX Battalion',
        description: 'Elite designers focused on premium glassmorphic interfaces.'
    },
    researcher: {
        name: 'Intelligence Unit',
        description: 'Technical researchers gathering documentation and best practices.'
    },
    developer: {
        name: 'Engineering Corps',
        description: 'Full-stack developers implementing atomic, high-performance code.'
    },
    reviewer: {
        name: 'Strategic Review Board',
        description: 'Code reviewers enforcing security and logic standards.'
    },
    qa: {
        name: 'Verification Squad',
        description: 'QA engineers ensuring 100% mission success.'
    }
} as const;
