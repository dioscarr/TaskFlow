/**
 * Context Budget Module - P3-CONTEXT-BUDGET
 * 
 * Provides intelligent context management for AI prompts to prevent oversized
 * prompts and improve response quality through smart truncation strategies.
 */

export interface TruncationResult {
    filename: string;
    originalSize: number;
    truncatedSize: number;
    truncated: boolean;
    percentage: number;
    strategy: string;
}

export interface TruncationReport {
    totalFiles: number;
    truncatedFiles: string[];
    totalTruncatedPercentage: number;
    recommendation?: string;
    results: TruncationResult[];
}

export interface FileWithPriority {
    id: string;
    name: string;
    type: string;
    size: number;
    priority: number;
    estimatedTokens: number;
}

/**
 * Get context budget based on model's token limit
 */
export function getContextBudget(modelId: string, queryLength: number): number {
    const MODEL_LIMITS: Record<string, number> = {
        'gemini-2.0-flash-exp': 1_000_000, // 1M tokens
        'gemini-2.0-flash-thinking-exp': 1_000_000,
        'gemini-1.5-flash': 32_000,
        'gemini-1.5-flash-8b': 32_000,
        'gemini-1.5-pro': 128_000,
        'gemini-pro': 32_000,
    };

    const maxTokens = MODEL_LIMITS[modelId] || 32_000;
    const reservedForResponse = 8_192; // Max output tokens
    const queryTokens = Math.ceil(queryLength / 4); // Rough estimate: 4 chars ≈ 1 token

    const availableTokens = maxTokens - reservedForResponse - queryTokens;
    return Math.max(1000, availableTokens * 4); // Convert back to chars, minimum 1000
}

/**
 * Calculate priority score for a file
 */
export function calculatePriority(
    file: { id: string; name: string; type: string; size?: number; updatedAt?: Date },
    userSelectedIds: Set<string>
): number {
    let score = 0;

    // User-selected files get highest priority
    if (userSelectedIds.has(file.id)) {
        score += 100;
    }

    // Prefer smaller files
    const size = file.size || 0;
    if (size < 10_000) score += 50;
    else if (size < 50_000) score += 25;
    else if (size < 100_000) score += 10;

    // Prefer code files
    const codeTypes = ['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'cpp', 'c', 'go', 'rs'];
    if (codeTypes.includes(file.type)) {
        score += 30;
    }

    // Prefer configuration files
    const configTypes = ['json', 'yaml', 'yml', 'toml', 'env'];
    if (configTypes.includes(file.type)) {
        score += 20;
    }

    // Prefer recent files
    if (file.updatedAt) {
        const ageInDays = (Date.now() - file.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (ageInDays < 1) score += 20;
        else if (ageInDays < 7) score += 10;
        else if (ageInDays < 30) score += 5;
    }

    return score;
}

/**
 * Estimate token count for a file
 */
export function estimateTokens(content: string): number {
    return Math.ceil(content.length / 4);
}

/**
 * Prioritize files for context inclusion
 */
export function prioritizeFiles(
    files: Array<{ id: string; name: string; type: string; size?: number; updatedAt?: Date }>,
    userSelectedIds: Set<string>
): FileWithPriority[] {
    return files.map(file => ({
        id: file.id,
        name: file.name,
        type: file.type,
        size: file.size || 0,
        priority: calculatePriority(file, userSelectedIds),
        estimatedTokens: Math.ceil((file.size || 0) / 4)
    })).sort((a, b) => b.priority - a.priority);
}

/**
 * Truncation strategy interface
 */
export interface TruncationStrategy {
    name: string;
    truncate(content: string, maxChars: number): { content: string; truncated: boolean; percentage: number };
}

/**
 * Code file truncation strategy
 * Keeps imports, exports, and function signatures
 */
export class CodeTruncationStrategy implements TruncationStrategy {
    name = 'code';

    truncate(content: string, maxChars: number): { content: string; truncated: boolean; percentage: number } {
        if (content.length <= maxChars) {
            return { content, truncated: false, percentage: 100 };
        }

        const lines = content.split('\n');
        const important: string[] = [];

        // Extract imports
        const imports = lines.filter(l =>
            /^\s*(import|from|require|#include|using)\s/.test(l)
        );
        important.push('// Imports:', ...imports, '');

        // Extract exports and function/class signatures
        const signatures = lines.filter(l => {
            const trimmed = l.trim();
            return /^(export\s+)?(async\s+)?(function|class|interface|type|const|let|var)\s/.test(trimmed) ||
                /^(public|private|protected)\s+(static\s+)?(async\s+)?/.test(trimmed);
        });
        important.push('// Signatures:', ...signatures);

        let result = important.join('\n');

        if (result.length > maxChars) {
            result = result.slice(0, maxChars) + '\n// [Truncated - showing imports and signatures only]';
        }

        return {
            content: result,
            truncated: true,
            percentage: Math.round((result.length / content.length) * 100)
        };
    }
}

/**
 * Document/Markdown truncation strategy
 * Keeps headers and first sections
 */
export class DocumentTruncationStrategy implements TruncationStrategy {
    name = 'document';

    truncate(content: string, maxChars: number): { content: string; truncated: boolean; percentage: number } {
        if (content.length <= maxChars) {
            return { content, truncated: false, percentage: 100 };
        }

        const lines = content.split('\n');
        const result: string[] = [];
        let currentLength = 0;

        // Always include headers
        const headers = lines.filter(l => l.trim().startsWith('#'));
        result.push(...headers, '');
        currentLength = result.join('\n').length;

        // Add content until we hit the limit
        for (const line of lines) {
            if (!line.trim().startsWith('#')) {
                const newLength = currentLength + line.length + 1;
                if (newLength > maxChars) break;
                result.push(line);
                currentLength = newLength;
            }
        }

        result.push('', '[Document truncated - showing headers and first sections]');

        const finalContent = result.join('\n');
        return {
            content: finalContent,
            truncated: true,
            percentage: Math.round((finalContent.length / content.length) * 100)
        };
    }
}

/**
 * Log file truncation strategy
 * Keeps first and last N lines
 */
export class LogTruncationStrategy implements TruncationStrategy {
    name = 'log';

    truncate(content: string, maxChars: number): { content: string; truncated: boolean; percentage: number } {
        if (content.length <= maxChars) {
            return { content, truncated: false, percentage: 100 };
        }

        const lines = content.split('\n');
        const linesPerSection = Math.floor(maxChars / 200); // Rough estimate

        const firstLines = lines.slice(0, linesPerSection);
        const lastLines = lines.slice(-linesPerSection);

        const result = [
            ...firstLines,
            '',
            `... [${lines.length - (linesPerSection * 2)} lines omitted] ...`,
            '',
            ...lastLines
        ].join('\n');

        return {
            content: result,
            truncated: true,
            percentage: Math.round((result.length / content.length) * 100)
        };
    }
}

/**
 * JSON truncation strategy
 * Keeps structure, truncates arrays
 */
export class JSONTruncationStrategy implements TruncationStrategy {
    name = 'json';

    truncate(content: string, maxChars: number): { content: string; truncated: boolean; percentage: number } {
        if (content.length <= maxChars) {
            return { content, truncated: false, percentage: 100 };
        }

        try {
            const obj = JSON.parse(content);
            const truncated = this.truncateObject(obj, maxChars);
            const result = JSON.stringify(truncated, null, 2);

            return {
                content: result,
                truncated: true,
                percentage: Math.round((result.length / content.length) * 100)
            };
        } catch {
            // If parsing fails, use simple truncation
            return {
                content: content.slice(0, maxChars) + '\n... [JSON truncated]',
                truncated: true,
                percentage: Math.round((maxChars / content.length) * 100)
            };
        }
    }

    private truncateObject(obj: any, maxChars: number): any {
        if (Array.isArray(obj)) {
            if (obj.length > 5) {
                return [...obj.slice(0, 3), `... [${obj.length - 3} items omitted]`];
            }
            return obj;
        }

        if (typeof obj === 'object' && obj !== null) {
            const result: any = {};
            for (const [key, value] of Object.entries(obj)) {
                result[key] = this.truncateObject(value, maxChars);
            }
            return result;
        }

        return obj;
    }
}

/**
 * Default truncation strategy
 * Simple hard cut-off
 */
export class DefaultTruncationStrategy implements TruncationStrategy {
    name = 'default';

    truncate(content: string, maxChars: number): { content: string; truncated: boolean; percentage: number } {
        if (content.length <= maxChars) {
            return { content, truncated: false, percentage: 100 };
        }

        const result = content.slice(0, maxChars) + '\n... [Content truncated]';

        return {
            content: result,
            truncated: true,
            percentage: Math.round((maxChars / content.length) * 100)
        };
    }
}

/**
 * Get appropriate truncation strategy for file type
 */
export function getTruncationStrategy(fileType: string): TruncationStrategy {
    const codeTypes = ['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'cpp', 'c', 'go', 'rs'];
    const docTypes = ['md', 'markdown', 'txt'];
    const logTypes = ['log'];
    const jsonTypes = ['json', 'jsonl'];

    if (codeTypes.includes(fileType)) {
        return new CodeTruncationStrategy();
    }

    if (docTypes.includes(fileType)) {
        return new DocumentTruncationStrategy();
    }

    if (logTypes.includes(fileType)) {
        return new LogTruncationStrategy();
    }

    if (jsonTypes.includes(fileType)) {
        return new JSONTruncationStrategy();
    }

    return new DefaultTruncationStrategy();
}

/**
 * Generate truncation report
 */
export function generateTruncationReport(results: TruncationResult[]): TruncationReport {
    const truncated = results.filter(r => r.truncated);

    const totalTruncatedPercentage = truncated.length > 0
        ? Math.round(truncated.reduce((sum, r) => sum + (100 - r.percentage), 0) / truncated.length)
        : 0;

    const recommendation = truncated.length > results.length / 2
        ? 'Consider reducing the number of attachments for better context quality'
        : truncated.length > 0
            ? 'Some files were truncated to fit context limits'
            : undefined;

    return {
        totalFiles: results.length,
        truncatedFiles: truncated.map(r => r.filename),
        totalTruncatedPercentage,
        recommendation,
        results
    };
}
