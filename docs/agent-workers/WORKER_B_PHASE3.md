# Worker B - Phase 3 Implementation

**Date**: 2026-02-08  
**Status**: In Progress  
**Previous Work**: Phase 2 Complete (Stream Retry, Status Events, Preview Toggle)

---

## 🎯 New Mission: Phase 3 Support

Worker B has completed all Phase 2 features and is now assisting with Phase 3 implementation, focusing on:
- **P3-TOOL-ROUTING**: Intent-based tool selection
- **P3-OBSERVABILITY**: Trace IDs and metrics

---

## ✅ P3-TOOL-ROUTING: Intent-Based Tool Selection

### Status: **In Progress** (40% Complete)

### Objective
Reduce AI tool choice paralysis by intelligently selecting a subset of tools based on the user's intent.

### What Was Completed

#### 1. Tool Routing Module ✅
**File**: `src/lib/toolRouting.ts`

**Features**:
- ✅ **Intent Classification**: 8 intent types
  - `code_development`
  - `receipt_processing`
  - `web_development`
  - `file_organization`
  - `data_analysis`
  - `debugging`
  - `documentation`
  - `general_chat`

- ✅ **Keyword-Based Detection**: Analyzes query for intent signals
  - Code: function, class, component, debug, refactor, etc.
  - Receipt: invoice, ncf, itbis, alegra, vendor, etc.
  - Web: website, landing, html, css, design, etc.
  - Organization: organize, move, folder, sort, clean, etc.
  - Data: analyze, calculate, report, chart, statistics, etc.
  - Debugging: error, crash, fail, broken, troubleshoot, etc.
  - Documentation: document, readme, guide, explain, etc.

- ✅ **File Type Analysis**: Boosts confidence based on attached files
  - Code files (.ts, .js, .py) → boost code_development
  - Web files (.html, .css) → boost web_development
  - Receipt files (.pdf, images) + receipt keywords → boost receipt_processing
  - Data files (.csv, .json) → boost data_analysis

- ✅ **Confidence Scoring**: 0-1 confidence score for classification
  - Calculates based on keyword matches and file types
  - Falls back to general_chat if no clear intent

- ✅ **Curated Tool Allowlists**: Each intent has optimized tool subset
  - **code_development**: 18 tools (view_file, edit_file, search_codebase, execute_command, etc.)
  - **receipt_processing**: 15 tools (extract_receipt_info, verify_dgii_rnc, organize_files, etc.)
  - **web_development**: 12 tools (create_html_file, manage_app_lifecycle, etc.)
  - **file_organization**: 16 tools (organize_files, batch_rename, find_duplicates, etc.)
  - **data_analysis**: 11 tools (analyze_codebase, generate_markdown_report, etc.)
  - **debugging**: 11 tools (search_codebase, get_app_logs, execute_command, etc.)
  - **documentation**: 10 tools (generate_markdown_report, search_codebase, etc.)
  - **general_chat**: 4 tools (search_web, ask_questions, view_file, list_dir)

- ✅ **Tool Reduction Metrics**: Calculate reduction percentage
  - Example: code_development uses 18/60 tools (70% reduction)
  - Example: general_chat uses 4/60 tools (93% reduction)

### Key Functions

```typescript
// Classify user intent
const classification = classifyIntent(query, fileIds, fileTypes);
// Returns: { intent, confidence, reasoning, suggestedTools }

// Get tools for an intent
const tools = getToolsForIntent('code_development');
// Returns: ['view_file', 'edit_file', ...]

// Get reduction percentage
const reduction = getToolReduction('code_development');
// Returns: 70 (70% fewer tools)

// Get overall statistics
const stats = getToolRoutingStats();
// Returns: { totalTools: 60, intentStats: [...] }
```

### Example Classifications

#### Example 1: Code Development
**Query**: "Fix the bug in the authentication function"  
**Files**: `auth.ts`, `login.tsx`  
**Result**:
```json
{
  "intent": "code_development",
  "confidence": 0.85,
  "reasoning": "Detected code_development intent based on keywords and file types (confidence: 85%)",
  "suggestedTools": ["view_file", "edit_file", "search_codebase", ...]
}
```

#### Example 2: Receipt Processing
**Query**: "Process this invoice and extract the NCF"  
**Files**: `invoice.pdf`  
**Result**:
```json
{
  "intent": "receipt_processing",
  "confidence": 0.92,
  "reasoning": "Detected receipt_processing intent based on keywords and file types (confidence: 92%)",
  "suggestedTools": ["extract_receipt_info", "verify_dgii_rnc", ...]
}
```

#### Example 3: General Chat
**Query**: "What's the weather like today?"  
**Files**: []  
**Result**:
```json
{
  "intent": "general_chat",
  "confidence": 0.5,
  "reasoning": "No specific intent detected, using general chat mode",
  "suggestedTools": ["search_web", "ask_questions"]
}
```

### Remaining Work (60%)

#### 1. Integration into `actions.ts` (30%)
**Location**: `src/app/actions.ts` (around line 5235)

**Current Code**:
```typescript
const candidateTools = Array.isArray(options?.enabledToolIds) && options.enabledToolIds.length > 0
    ? options.enabledToolIds.filter(id => toolRegistryIds.includes(id))
    : (selectedPromptSet && Array.isArray(selectedPromptSet.tools) && selectedPromptSet.tools.length > 0
        ? selectedPromptSet.tools.filter(id => toolRegistryIds.includes(id))
        : DEFAULT_SKILLS);
```

**Needed Changes**:
```typescript
// P3-TOOL-ROUTING: Classify intent and select tools
const { classifyIntent } = await import('@/lib/toolRouting');

// Get file types for classification
const fileTypes = validFiles.map(f => f.type);

// Classify intent
const intentClassification = classifyIntent(effectiveQuery, fileIds, fileTypes);

console.log(`🎯 Intent: ${intentClassification.intent} (${Math.round(intentClassification.confidence * 100)}% confidence)`);
console.log(`   ${intentClassification.reasoning}`);
console.log(`   Suggested tools: ${intentClassification.suggestedTools.length}/${getAllTools().length} (${getToolReduction(intentClassification.intent)}% reduction)`);

// Use intent-based tools if no explicit tool selection
const candidateTools = Array.isArray(options?.enabledToolIds) && options.enabledToolIds.length > 0
    ? options.enabledToolIds.filter(id => toolRegistryIds.includes(id))
    : (selectedPromptSet && Array.isArray(selectedPromptSet.tools) && selectedPromptSet.tools.length > 0
        ? selectedPromptSet.tools.filter(id => toolRegistryIds.includes(id))
        : intentClassification.suggestedTools); // Use intent-based tools instead of DEFAULT_SKILLS
```

#### 2. Integration into Stream Route (20%)
**Location**: `src/app/api/chat/stream/route.ts`

Apply same intent classification logic to streaming endpoint.

#### 3. Testing & Metrics (10%)
- Test with various query types
- Verify tool reduction improves response quality
- Measure AI response time improvement
- Track intent classification accuracy

---

## 📋 P3-OBSERVABILITY: Trace IDs and Metrics

### Status: **In Progress** (0% Complete)

### Objective
Add trace IDs for tool calls and sessions to improve debugging and monitoring.

### Implementation Plan

#### 1. Trace ID Generation Module
**File**: `src/lib/tracing.ts` (to be created)

```typescript
export function generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateSpanId(): string {
    return `span_${Math.random().toString(36).substr(2, 9)}`;
}

export interface TraceContext {
    traceId: string;
    sessionId?: string;
    parentSpanId?: string;
}
```

#### 2. Instrumentation
- Add trace IDs to all tool executions
- Add span IDs for nested operations
- Include trace context in logs
- Pass trace IDs through request chain

#### 3. Metrics Collection
- Track tool execution times
- Track success/failure rates
- Track token usage per session
- Track intent classification accuracy

#### 4. Metrics Dashboard
**Component**: `src/components/SessionMetrics.tsx` (to be created)

Display:
- Total messages in session
- Total tool calls
- Average response time
- Tool usage breakdown
- Error rate
- Intent classification history

---

## 📊 Progress Summary

| Feature | Status | Completion | Priority |
|---------|--------|------------|----------|
| P3-TOOL-ROUTING | 🔄 In Progress | 40% | High |
| P3-OBSERVABILITY | 📋 Planned | 0% | Medium |

### P3-TOOL-ROUTING Breakdown:
- ✅ Core module (100%)
- ⏳ Integration into actions.ts (0%)
- ⏳ Integration into stream route (0%)
- ⏳ Testing (0%)

### P3-OBSERVABILITY Breakdown:
- ⏳ Trace module (0%)
- ⏳ Instrumentation (0%)
- ⏳ Metrics collection (0%)
- ⏳ Dashboard (0%)

---

## 🎯 Next Steps

### Immediate (Priority 1):
1. **Integrate tool routing into `actions.ts`** (~1 hour)
   - Add intent classification
   - Use suggested tools instead of DEFAULT_SKILLS
   - Add logging

2. **Integrate into stream route** (~30 min)
   - Apply same logic
   - Ensure consistency

3. **Test tool routing** (~30 min)
   - Test with various queries
   - Verify tool reduction
   - Measure improvements

### Follow-up (Priority 2):
4. **Create tracing module** (~1 hour)
   - Trace ID generation
   - Span ID generation
   - Context management

5. **Instrument tool calls** (~2 hours)
   - Add trace IDs to all executions
   - Include in logs
   - Pass through request chain

6. **Build metrics dashboard** (~2 hours)
   - Create SessionMetrics component
   - Display statistics
   - Show tool usage breakdown

---

## 📁 Files Created

1. ✅ **src/lib/toolRouting.ts** (NEW)
   - Intent classification
   - Tool allowlists
   - Reduction metrics

2. ✅ **docs/agent-workers/WORKER_B_PHASE3.md** (this file)
   - Progress tracking
   - Implementation plan

---

## ⏱️ Time Estimates

- **P3-TOOL-ROUTING completion**: 2-3 hours
  - Integration: 1.5 hours
  - Testing: 0.5-1 hour

- **P3-OBSERVABILITY completion**: 5-6 hours
  - Tracing module: 1 hour
  - Instrumentation: 2-3 hours
  - Dashboard: 2 hours

**Total**: 7-9 hours

---

**Last Updated**: 2026-02-08 16:25 PST  
**Next Review**: After P3-TOOL-ROUTING integration
