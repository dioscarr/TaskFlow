# ECONNRESET Error Fix - AI Chat Context Attachment

## Problem
The application was experiencing `ECONNRESET` errors when attaching context (files) to the AI chat. This manifested as:
```
⨯ Error: aborted
    at ignore-listed frames {
  code: 'ECONNRESET',
  digest: '438432453'
}
```

## Root Causes

1. **Large Context Payloads**: When users attached folders or many files, the `expandFileIdsWithFolders` function could expand to up to 50 files, creating very large HTTP request bodies.

2. **No Request Timeout**: The fetch request had no timeout, allowing it to hang indefinitely and eventually be aborted by the browser or server.

3. **Poor Error Handling**: Connection errors weren't properly detected or handled, leading to confusing error messages.

4. **No Payload Size Validation**: Neither client nor server validated the size of the context being sent.

## Solutions Implemented

### 1. Client-Side Improvements (`AIChat.tsx`)

#### Added Request Timeout (Lines 1340-1342)
```typescript
const abortController = new AbortController();
const timeoutId = setTimeout(() => abortController.abort(), 5 * 60 * 1000); // 5 minute timeout
```
- Prevents requests from hanging indefinitely
- 5-minute timeout is generous for large contexts but prevents infinite hangs

#### Proactive Warning for Large Contexts (Lines 1299-1302)
```typescript
if (expandedFileIds.length > 30) {
    toast.warning(`Large context detected (${expandedFileIds.length} files). This may cause connection issues.`);
}
```
- Warns users before sending large contexts
- Helps users understand potential issues

#### Improved Error Detection (Lines 1417-1428)
```typescript
const errorMessage = streamError instanceof Error ? streamError.message : String(streamError);
const isAbortError = errorMessage.includes('abort');
const isConnectionError = errorMessage.includes('ECONNRESET') || errorMessage.includes('aborted');

if (isAbortError) {
    toast.error('Request timed out. Try reducing the number of attached files.');
} else if (isConnectionError) {
    toast.warning('Connection interrupted. Retrying with fallback method...');
}
```
- Detects specific error types
- Provides user-friendly error messages
- Suggests actionable solutions

#### Automatic Context Reduction on Retry (Lines 1432-1436)
```typescript
const reducedFileIds = expandedFileIds.slice(0, 20); // Limit to 20 files for fallback
if (reducedFileIds.length < expandedFileIds.length) {
    toast.info(`Reducing context from ${expandedFileIds.length} to ${reducedFileIds.length} files for retry`);
}
```
- Automatically reduces context size when falling back to non-streaming mode
- Increases likelihood of successful retry

### 2. Server-Side Improvements (`route.ts`)

#### Payload Size Validation (Lines 20-31)
```typescript
const fileCount = Array.isArray(fileIds) ? fileIds.length : 0;
const historyCount = Array.isArray(history) ? history.length : 0;

if (fileCount > 50) {
    console.warn(`⚠️ Large file context: ${fileCount} files`);
}

if (historyCount > 100) {
    console.warn(`⚠️ Large history: ${historyCount} messages`);
}
```
- Logs warnings for large payloads
- Helps with debugging and monitoring

#### Better Error Handling (Lines 75-84)
```typescript
catch (error) {
    console.error('Stream error:', error);
    try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            message: error instanceof Error ? error.message : 'Streaming failed'
        })}\n\n`));
    } catch (enqueueError) {
        console.error('Failed to enqueue error:', enqueueError);
    }
    controller.close();
}
```
- Properly logs errors
- Handles cases where the stream is already closed

#### Enhanced Response Headers (Lines 89-93)
```typescript
headers: {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no' // Disable nginx buffering if behind proxy
}
```
- Ensures proper keep-alive behavior
- Disables proxy buffering that could cause issues

## Testing Recommendations

1. **Test with Small Context** (1-5 files)
   - Should work without any warnings

2. **Test with Medium Context** (10-30 files)
   - Should work but may show performance warnings

3. **Test with Large Context** (30-50 files)
   - Should show warning toast
   - May timeout and automatically retry with reduced context

4. **Test with Very Large Context** (50+ files)
   - Should show warning
   - Will be reduced to 20 files on retry if initial request fails

## Future Improvements

1. **Implement Chunking**: Break large contexts into multiple smaller requests
2. **Add Progress Indicators**: Show upload/processing progress for large contexts
3. **Smart Context Selection**: Use AI to select most relevant files instead of all files
4. **Caching**: Cache file contents on server to reduce payload sizes
5. **Compression**: Compress request bodies for large contexts

## Monitoring

Watch for these log messages:
- `⚠️ Large file context: X files` - Server receiving large context
- `⚠️ Large history: X messages` - Server receiving large history
- `⚠️ Request timeout - context may be too large` - Client timeout
- `⚠️ Connection reset - likely due to large context` - ECONNRESET detected
