# Phase 3 - Performance & Intelligence

**Owner**: Worker A (All 3 features)  
**Status**: Partially Started  
**Created**: 2026-02-08

---

## Overview

Phase 3 focuses on performance optimization and intelligent routing to improve the AI's efficiency and user experience.

### Features

1. **P3-CONTEXT-BUDGET** - Context budgeter (In Progress ~30%)
2. **P3-TOOL-ROUTING** - Tool routing (Planned)
3. **P3-OBSERVABILITY** - Trace + metrics (Planned)

---

## P3-CONTEXT-BUDGET: Context Budgeter

### Status: **In Progress** (~30% Complete)

### Objective
Implement token-aware context trimming for large attachments to prevent oversized prompts and improve response quality.

### Current Implementation

**Location**: `src/app/actions.ts` lines 5398-5492

**What Exists**:
```typescript
// Basic context budget to prevent oversized prompts (approx tokens ~= chars/4)
const MAX_CONTEXT_CHARS = 12000;
let remainingContext = Math.max(0, MAX_CONTEXT_CHARS - promptParts[0].length);

const appendToPrompt = (text: string) => {
    if (remainingContext <= 0) return false;
    const slice = text.slice(0, remainingContext);
    promptParts[0] += slice;
    remainingContext -= slice.length;
    return slice.length === text.length;
};
```

**Supported File Types**:
- ✅ **PDFs** (lines 5442-5462): Truncates with `[Context truncated while reading PDF: filename]`
- ✅ **Text-like files** (lines 5463-5491): txt, md, json, csv, ts, js, css, html, etc.
  - Truncates with `[Context truncated while reading file: filename]`
- ✅ **Images**: No truncation needed (sent as base64 inline data)

### What's Missing

1. **Dynamic Budget Calculation**
   - Current: Fixed 12,000 chars (~3,000 tokens)
   - Needed: Calculate based on model's context window and query length
   - Models have different limits (Gemini 2.0: 1M tokens, Flash: 32K tokens)

2. **Priority-Based Truncation**
   - Current: First-come-first-served (files processed in order)
   - Needed: Prioritize files by:
     - User-selected files (higher priority)
     - File size (smaller files first)
     - File type (code > docs > logs)
     - Recency (newer files first)

3. **Smart Truncation Strategies**
   - Current: Hard cut-off mid-content
   - Needed:
     - For code: Keep imports + function signatures, truncate bodies
     - For docs: Keep headers + first paragraphs
     - For logs: Keep first + last N lines
     - For JSON: Keep structure, truncate arrays

4. **Truncation Metadata**
   - Current: Simple `[Context truncated...]` message
   - Needed:
     - Report which files were truncated
     - Report how much was truncated (percentage)
     - Suggest user reduce attachments if critical info lost

5. **User Feedback**
   - Current: Silent truncation (user doesn't know)
   - Needed:
     - Toast notification: "Some files were truncated due to size"
     - Show truncation details in UI
     - Allow user to select which files to prioritize

### Implementation Plan

#### Step 1: Model-Aware Budget (Priority 1)
```typescript
// src/lib/contextBudget.ts
export function getContextBudget(modelId: string, queryLength: number): number {
    const MODEL_LIMITS = {
        'gemini-2.0-flash-exp': 1_000_000, // 1M tokens
        'gemini-1.5-flash': 32_000,
        'gemini-1.5-pro': 128_000,
    };
    
    const maxTokens = MODEL_LIMITS[modelId] || 32_000;
    const reservedForResponse = 8_192; // Max output tokens
    const queryTokens = Math.ceil(queryLength / 4); // Rough estimate
    
    const availableTokens = maxTokens - reservedForResponse - queryTokens;
    return availableTokens * 4; // Convert back to chars
}
```

#### Step 2: File Prioritization (Priority 2)
```typescript
interface FileWithPriority {
    file: WorkspaceFile;
    priority: number; // Higher = more important
    estimatedTokens: number;
}

function prioritizeFiles(files: WorkspaceFile[], userSelectedIds: Set<string>): FileWithPriority[] {
    return files.map(file => ({
        file,
        priority: calculatePriority(file, userSelectedIds),
        estimatedTokens: estimateTokens(file)
    })).sort((a, b) => b.priority - a.priority);
}

function calculatePriority(file: WorkspaceFile, userSelected: Set<string>): number {
    let score = 0;
    
    // User-selected files get highest priority
    if (userSelected.has(file.id)) score += 100;
    
    // Prefer smaller files
    if (file.size < 10_000) score += 50;
    else if (file.size < 50_000) score += 25;
    
    // Prefer code files
    if (['ts', 'tsx', 'js', 'jsx'].includes(file.type)) score += 30;
    
    // Prefer recent files
    const ageInDays = (Date.now() - file.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (ageInDays < 1) score += 20;
    else if (ageInDays < 7) score += 10;
    
    return score;
}
```

#### Step 3: Smart Truncation (Priority 3)
```typescript
interface TruncationStrategy {
    truncate(content: string, maxChars: number): { content: string; truncated: boolean; percentage: number };
}

class CodeTruncationStrategy implements TruncationStrategy {
    truncate(content: string, maxChars: number) {
        // Keep imports and function signatures
        const lines = content.split('\n');
        const imports = lines.filter(l => l.trim().startsWith('import'));
        const signatures = lines.filter(l => /^(export\s+)?(async\s+)?function|^(export\s+)?class/.test(l.trim()));
        
        let result = [...imports, '', '// Function signatures:', ...signatures].join('\n');
        
        if (result.length > maxChars) {
            result = result.slice(0, maxChars) + '\n// [Truncated]';
        }
        
        return {
            content: result,
            truncated: true,
            percentage: Math.round((result.length / content.length) * 100)
        };
    }
}

class DocumentTruncationStrategy implements TruncationStrategy {
    truncate(content: string, maxChars: number) {
        // Keep headers and first paragraphs
        const lines = content.split('\n');
        const headers = lines.filter(l => l.trim().startsWith('#'));
        const firstParagraphs = lines.slice(0, Math.min(50, lines.length));
        
        let result = [...headers, '', ...firstParagraphs].join('\n');
        
        if (result.length > maxChars) {
            result = result.slice(0, maxChars) + '\n\n[Document truncated...]';
        }
        
        return {
            content: result,
            truncated: true,
            percentage: Math.round((result.length / content.length) * 100)
        };
    }
}
```

#### Step 4: Truncation Metadata & UI (Priority 4)
```typescript
interface TruncationReport {
    totalFiles: number;
    truncatedFiles: string[];
    totalTruncatedPercentage: number;
    recommendation?: string;
}

function generateTruncationReport(results: TruncationResult[]): TruncationReport {
    const truncated = results.filter(r => r.truncated);
    
    return {
        totalFiles: results.length,
        truncatedFiles: truncated.map(r => r.filename),
        totalTruncatedPercentage: Math.round(
            truncated.reduce((sum, r) => sum + r.percentage, 0) / truncated.length
        ),
        recommendation: truncated.length > results.length / 2
            ? 'Consider reducing the number of attachments for better context quality'
            : undefined
    };
}
```

### Acceptance Criteria

- [ ] Context budget adapts to model's token limit
- [ ] User-selected files are prioritized over auto-included files
- [ ] Code files use smart truncation (keep signatures)
- [ ] Document files use smart truncation (keep headers)
- [ ] Truncation is reported to user via toast notification
- [ ] Truncation metadata included in AI response
- [ ] User can see which files were truncated and by how much

### Integration Points

1. **Backend** (`src/app/actions.ts`):
   - Replace fixed `MAX_CONTEXT_CHARS` with dynamic budget
   - Implement file prioritization
   - Add smart truncation strategies
   - Generate truncation report

2. **Frontend** (`src/components/AIChat.tsx`):
   - Display truncation toast if files were truncated
   - Show truncation details in message metadata
   - Allow user to re-submit with fewer files

3. **Stream Route** (`src/app/api/chat/stream/route.ts`):
   - Apply same context budget logic
   - Ensure consistency between stream and fallback

---

## P3-TOOL-ROUTING: Tool Routing

### Status: **Planned** (0% Complete)

### Objective
Implement intent-based tool allowlist selection to improve AI performance by reducing tool choice paralysis.

### Concept

Instead of giving the AI access to ALL tools, intelligently select a subset based on the user's intent.

**Example Intents**:
- `code_development` → enable: view_file, edit_file, create_file, search_codebase, execute_command
- `receipt_processing` → enable: extract_receipt_info, verify_dgii_rnc, create_folder, move_files
- `web_development` → enable: create_html_file, view_file, edit_file, manage_app_lifecycle
- `general_chat` → enable: search_web, ask_questions (minimal tools)

### Implementation Plan

#### Step 1: Intent Classifier
```typescript
// src/lib/intentClassifier.ts
export type Intent = 
    | 'code_development'
    | 'receipt_processing'
    | 'web_development'
    | 'file_organization'
    | 'data_analysis'
    | 'general_chat';

export function classifyIntent(query: string, fileIds: string[]): Intent {
    const lower = query.toLowerCase();
    
    // Code development keywords
    if (/\b(code|function|class|component|debug|refactor|implement)\b/.test(lower)) {
        return 'code_development';
    }
    
    // Receipt processing keywords
    if (/\b(receipt|invoice|ncf|itbis|alegra|vendor)\b/.test(lower)) {
        return 'receipt_processing';
    }
    
    // Web development keywords
    if (/\b(website|landing|page|html|css|preview)\b/.test(lower)) {
        return 'web_development';
    }
    
    // File organization keywords
    if (/\b(organize|move|folder|sort|clean)\b/.test(lower)) {
        return 'file_organization';
    }
    
    // Data analysis keywords
    if (/\b(analyze|calculate|report|chart|graph)\b/.test(lower)) {
        return 'data_analysis';
    }
    
    return 'general_chat';
}
```

#### Step 2: Intent-to-Tools Mapping
```typescript
// src/lib/toolRouting.ts
export const INTENT_TOOL_ALLOWLIST: Record<Intent, string[]> = {
    code_development: [
        'view_file',
        'edit_file',
        'create_file',
        'search_codebase',
        'find_symbol_references',
        'apply_patch',
        'execute_command',
        'manage_app_lifecycle',
        'search_web'
    ],
    receipt_processing: [
        'extract_receipt_info',
        'verify_dgii_rnc',
        'create_folder',
        'move_attachments_to_folder',
        'create_file',
        'generate_markdown_report',
        'extract_alegra_bill'
    ],
    web_development: [
        'create_html_file',
        'view_file',
        'edit_file',
        'create_file',
        'manage_app_lifecycle',
        'execute_command',
        'search_web'
    ],
    file_organization: [
        'list_dir',
        'create_folder',
        'move_attachments_to_folder',
        'rename_file',
        'organize_files',
        'batch_rename',
        'search_files'
    ],
    data_analysis: [
        'view_file',
        'search_files',
        'generate_markdown_report',
        'create_html_file',
        'search_web'
    ],
    general_chat: [
        'search_web',
        'ask_questions'
    ]
};

export function getToolsForIntent(intent: Intent): string[] {
    return INTENT_TOOL_ALLOWLIST[intent] || DEFAULT_TOOLS;
}
```

#### Step 3: Integration
```typescript
// In actions.ts, before tool loading
const detectedIntent = classifyIntent(query, fileIds);
const intentTools = getToolsForIntent(detectedIntent);

// Override enabled tools if not explicitly set
const enabledSkills = candidateTools.length > 0 
    ? candidateTools 
    : intentTools;

console.log(`🎯 Detected intent: ${detectedIntent}, enabling ${enabledSkills.length} tools`);
```

### Acceptance Criteria

- [ ] Intent classifier correctly identifies common intents
- [ ] Tool allowlist reduces tool count by 50%+ for specific intents
- [ ] AI response quality improves (fewer tool choice errors)
- [ ] Intent detection logged for observability
- [ ] User can override intent with explicit tool selection

---

## P3-OBSERVABILITY: Trace + Metrics

### Status: **Planned** (0% Complete)

### Objective
Add trace IDs for tool calls and sessions to improve debugging and monitoring.

### Implementation Plan

#### Step 1: Trace ID Generation
```typescript
// src/lib/tracing.ts
export function generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateSpanId(): string {
    return `span_${Math.random().toString(36).substr(2, 9)}`;
}
```

#### Step 2: Add Trace Context
```typescript
interface TraceContext {
    traceId: string;
    sessionId?: string;
    parentSpanId?: string;
}

// Add to all tool executions
async function executeWithTrace(toolName: string, args: any, context: TraceContext) {
    const spanId = generateSpanId();
    const startTime = Date.now();
    
    console.log(`[${context.traceId}:${spanId}] Executing ${toolName}`);
    
    try {
        const result = await executeWithRetry(toolName, args);
        const duration = Date.now() - startTime;
        
        console.log(`[${context.traceId}:${spanId}] Completed ${toolName} in ${duration}ms`);
        
        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[${context.traceId}:${spanId}] Failed ${toolName} after ${duration}ms`, error);
        throw error;
    }
}
```

#### Step 3: Session Metrics View
```typescript
// New component: src/components/SessionMetrics.tsx
interface SessionMetrics {
    sessionId: string;
    totalMessages: number;
    totalToolCalls: number;
    averageResponseTime: number;
    toolUsageBreakdown: Record<string, number>;
    errorRate: number;
}

export function SessionMetricsPanel({ sessionId }: { sessionId: string }) {
    const [metrics, setMetrics] = useState<SessionMetrics | null>(null);
    
    useEffect(() => {
        // Fetch metrics from API
        fetch(`/api/metrics/session/${sessionId}`)
            .then(r => r.json())
            .then(setMetrics);
    }, [sessionId]);
    
    if (!metrics) return null;
    
    return (
        <div className="p-4 bg-slate-800 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Session Metrics</h3>
            <div className="grid grid-cols-2 gap-4">
                <MetricCard label="Messages" value={metrics.totalMessages} />
                <MetricCard label="Tool Calls" value={metrics.totalToolCalls} />
                <MetricCard label="Avg Response" value={`${metrics.averageResponseTime}ms`} />
                <MetricCard label="Error Rate" value={`${metrics.errorRate}%`} />
            </div>
            <ToolUsageChart data={metrics.toolUsageBreakdown} />
        </div>
    );
}
```

### Acceptance Criteria

- [ ] Every tool call has a unique trace ID
- [ ] Trace IDs are logged consistently across backend
- [ ] Session metrics are calculated and stored
- [ ] Metrics view shows tool usage breakdown
- [ ] Error traces include full context for debugging

---

## Priority Order

1. **P3-CONTEXT-BUDGET** (In Progress) - Immediate impact on quality
2. **P3-TOOL-ROUTING** (Planned) - Improves AI performance
3. **P3-OBSERVABILITY** (Planned) - Enables better debugging

---

## Estimated Timeline

- **P3-CONTEXT-BUDGET**: 4-6 hours (70% remaining)
- **P3-TOOL-ROUTING**: 3-4 hours
- **P3-OBSERVABILITY**: 4-5 hours
- **Total**: 11-15 hours

---

**Document Created**: 2026-02-08  
**Last Updated**: 2026-02-08  
**Next Review**: After P3-CONTEXT-BUDGET completion
