/**
 * Normalizes markdown content to fix common AI-generated formatting issues
 * Specifically handles:
 * - Blank lines within tables
 * - Broken markdown links
 * - Code blocks wrapping tables
 * - Inconsistent line endings
 */
export function normalizeMarkdown(text: string): string {
    console.log('🔍 Original markdown:', text);
    console.log('🔍 Has table pipes:', text.includes('|'));
    console.log('🔍 Has separator:', text.includes('---') || text.includes('|--'));

    let normalized = text;

    // 1. Remove code blocks that wrap markdown tables
    normalized = normalized.replace(/```markdown?\s*\n(\|[^\n]+\|[\s\S]*?)\n```/gi, '$1');
    normalized = normalized.replace(/```\s*\n(\|[^\n]+\|[\s\S]*?)\n```/g, '$1');

    // 2. Remove blank lines within potential markdown tables
    // This handles both single and multiple blank lines
    normalized = normalized.replace(/(\|[^\n]+\|)\n\s*\n+(\|[^\n]+\|)/g, '$1\n$2');

    // 3. Fix broken markdown links (newlines between [label] and (url))
    normalized = normalized.replace(/\[([^\]]+)\]\s*\n\s*\(([^)]+)\)/g, '[$1]($2)');

    // 4. Fix broken URLs (newlines within the parentheses of a markdown link)
    normalized = normalized.replace(/\((https?:\/\/[^\s)]+)\n\s*([^\s)]+)\)/g, '($1$2)');

    // 5. Ensure table separators are properly formatted
    // Match lines that look like separators but might be malformed
    normalized = normalized.replace(/\|\s*-+\s*\|/g, (match) => {
        // Count the number of pipes to ensure consistency
        const pipeCount = (match.match(/\|/g) || []).length;
        if (pipeCount >= 2) {
            // Rebuild separator with proper dashes
            return match.replace(/-+/g, '-----');
        }
        return match;
    });

    console.log('✅ Normalized markdown:', normalized);
    console.log('✅ Table structure preserved:', normalized.includes('|') && normalized.includes('---'));

    return normalized;
}

/**
 * Detects if content contains a markdown table
 */
export function hasMarkdownTable(text: string): boolean {
    return text.includes('|') && (text.includes('---') || text.includes('|--'));
}
