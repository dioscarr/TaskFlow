# Stream Retry Flow Diagram

## Normal Flow (No Errors)
```
┌─────────────────┐
│  Client Request │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ executeStream() │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Start Chat    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Stream Chunks  │◄─── partialContent += text
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Tool Calls?    │
└────────┬────────┘
         │ Yes
         ▼
┌─────────────────┐
│ Emit tool_start │◄─── timestamp, tool name
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Execute Tool   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Emit tool_finish│◄─── elapsedMs, tool name
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Mark Completed  │◄─── completedTools.add(toolKey)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Send Done     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Close Stream   │
└─────────────────┘
```

## Retry Flow (Transient Error)
```
┌─────────────────┐
│  Client Request │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ executeStream() │
│  retryCount=0   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Start Chat    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Stream Chunks  │◄─── partialContent += "Hello, I can help..."
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Tool Calls?    │
└────────┬────────┘
         │ Yes
         ▼
┌─────────────────┐
│ Emit tool_start │◄─── Tool: "view_file"
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Execute Tool   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Mark Completed  │◄─── completedTools.add("view_file:{...}")
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Emit tool_finish│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Next Tool Call │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Emit tool_start │◄─── Tool: "write_file"
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Execute Tool   │
└────────┬────────┘
         │
         ▼
    ❌ ERROR! ❌
    ECONNRESET
         │
         ▼
┌─────────────────┐
│ Catch Error     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│isTransientError?│
└────────┬────────┘
         │ Yes
         ▼
┌─────────────────┐
│retryCount < max?│
└────────┬────────┘
         │ Yes (0 < 1)
         ▼
┌─────────────────┐
│ Calculate Backoff│◄─── 250ms * 2^0 = 250ms
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Emit Status Msg │◄─── "Retrying in 250ms..."
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Wait 250ms     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ executeStream() │◄─── RECURSIVE CALL
│  retryCount=1   │     (Same partialContent & completedTools)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Start Chat    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Tool Calls?    │
└────────┬────────┘
         │ Yes
         ▼
┌─────────────────┐
│ Check Completed │◄─── "view_file:{...}" in Set?
└────────┬────────┘
         │ Yes - SKIP!
         ▼
┌─────────────────┐
│ Next Tool       │◄─── "write_file:{...}" in Set?
└────────┬────────┘
         │ No - Execute!
         ▼
┌─────────────────┐
│ Emit tool_start │◄─── Tool: "write_file" (RETRY)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Execute Tool   │◄─── ✅ Success this time!
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Emit tool_finish│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Mark Completed  │◄─── completedTools.add("write_file:{...}")
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Send Done     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Close Stream   │
└─────────────────┘
```

## Key Mechanisms

### 1. Partial Content Preservation
```typescript
let partialContent = '';  // Declared in outer scope

// During streaming:
partialContent += text;   // Accumulates across retries
enqueue({ type: 'delta', text });

// On error:
enqueue({
  type: 'error',
  message: error.message,
  partialContent: partialContent || undefined  // Sent to client
});
```

### 2. Duplicate Prevention
```typescript
const completedTools = new Set<string>();  // Declared in outer scope

// Before executing tool:
const toolKey = `${call.name}:${JSON.stringify(call.args)}`;

if (completedTools.has(toolKey)) {
  console.log(`⏭️ Skipping already executed tool: ${call.name}`);
  continue;  // Skip to next tool
}

// After successful execution:
completedTools.add(toolKey);
```

### 3. Exponential Backoff
```typescript
const backoffMs = Math.min(
  RETRY_CONFIG.initialBackoff * Math.pow(2, retryCount - 1),
  RETRY_CONFIG.maxBackoff
);

// Examples:
// retryCount=1: min(250 * 2^0, 1000) = 250ms
// retryCount=2: min(250 * 2^1, 1000) = 500ms
// retryCount=3: min(250 * 2^2, 1000) = 1000ms (capped)
```

### 4. Transient Error Detection
```typescript
const transientPatterns = [
  'ECONNRESET',      // Connection reset
  'ETIMEDOUT',       // Timeout
  'ENOTFOUND',       // DNS lookup failed
  'socket hang up',  // Socket closed unexpectedly
  '503',             // Service unavailable
  '429',             // Rate limit
  'rate limit',      // Rate limit (text)
  'temporarily unavailable'
];

return transientPatterns.some(pattern => 
  message.toLowerCase().includes(pattern.toLowerCase())
);
```

## State Preservation Across Retries

| Variable | Scope | Purpose | Preserved? |
|----------|-------|---------|------------|
| `partialContent` | Outer | Accumulates all text chunks | ✅ Yes |
| `completedTools` | Outer | Tracks executed tools | ✅ Yes |
| `retryCount` | Outer | Counts retry attempts | ✅ Yes |
| `lastToolResult` | Inner | Last tool's result | ❌ No (recreated) |
| `lastToolUsed` | Inner | Last tool's name | ❌ No (recreated) |
| `chat` | Inner | Gemini chat session | ❌ No (new session) |

## Error Scenarios

### Scenario 1: Non-Transient Error
```
Error: "Invalid API key" → NOT retryable
↓
Emit error event immediately
Close stream
```

### Scenario 2: Max Retries Exceeded
```
Attempt 1: ECONNRESET → Retry
Attempt 2: ECONNRESET → Max retries reached
↓
Emit error event with partialContent
Close stream
```

### Scenario 3: Success After R try
```
Attempt 1: ETIMEDOUT → Retry after 250ms
Attempt 2: Success → Complete normally
```
