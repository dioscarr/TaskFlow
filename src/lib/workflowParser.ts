
import { WorkflowStep } from './intentLibrary';

/**
 * Parses a markdown workflow file into executable steps.
 * 
 * Expected format:
 * ### Step Name
 * Description...
 * 
 * <execute>
 * command to run
 * </execute>
 * 
 * OR specific file operations (future expansion).
 * For now, we focus on extracting <execute> blocks as 'execute_command' steps.
 */
export function parseMarkdownWorkflow(content: string): WorkflowStep[] {
    const steps: WorkflowStep[] = [];

    // Regex to find sections. 
    // We look for headers (###) followed by content until the next header or end of file
    const sections = content.split(/^###\s+/m).slice(1); // slice(1) to ignore preamble before first header

    sections.forEach((section, index) => {
        const lines = section.split('\n');
        const titleLine = lines[0].trim();
        // Remove numbering if present (e.g. "1. Run Script" -> "Run Script")
        const title = titleLine.replace(/^\d+\.\s*/, '');

        const sectionContent = lines.slice(1).join('\n');

        // Extract <execute> blocks
        const executeMatch = sectionContent.match(/<execute>([\s\S]*?)<\/execute>/);

        if (executeMatch) {
            const command = executeMatch[1].trim();
            if (command) {
                steps.push({
                    id: `step-${index + 1}-${title.toLowerCase().replace(/\s+/g, '-')}`,
                    action: 'execute_command',
                    params: {
                        command: command,
                        reason: title
                    }
                });
            }
        }

        // Future: Detect other patterns like file creation blocks if needed
        // For now, we strictly follow the <execute> tag convention for safety.
    });

    return steps;
}
