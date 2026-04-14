# Phase 2 Features - Quick Reference

## 🔄 Stream Retry Policy

### What It Does
Automatically retries streaming requests that fail due to transient network errors.

### How It Works
- **Automatic**: No user action required
- **Smart Detection**: Only retries transient errors (network issues, timeouts)
- **Preserves Progress**: Keeps partial output from before the error
- **Prevents Duplicates**: Won't re-execute tools that already completed

### User Experience
- If connection drops during streaming, you'll see: "Connection interrupted. Retrying..."
- The AI will automatically retry once with a brief delay
- Your partial response is preserved - no lost content!

---

## 📊 Tool Execution Timeline

### What It Does
Shows real-time status of tool executions with timing information.

### Where to Find It
- Appears automatically during AI responses that use tools
- Located below the activity log in the chat interface
- Shows each tool with:
  - ⏳ Spinning icon = In progress
  - ✅ Check icon = Complete
  - ⏱️ Elapsed time in seconds

### Example Display
```
Tool Execution Timeline
━━━━━━━━━━━━━━━━━━━━━━
✅ create_file      ⏱️ 0.45s  Done
⏳ run_command      (in progress...)
```

---

## 🖼️ Preview Auto-Open Control

### What It Does
Gives you control over whether previews automatically open.

### Current Behavior
- **Default**: ON (previews auto-open)
- **When ON**: HTML files and dev servers open automatically in preview tab
- **When OFF**: You get a notification with an "Open Preview" button

### How to Use (When OFF)
1. AI creates an HTML file or starts a dev server
2. You see a toast notification: "Created index.html. Click to open preview."
3. Click the "Open Preview" button to view it

### Examples

**Auto-Open ON** (default):
```
AI: "I've created index.html"
→ Preview tab opens automatically
```

**Auto-Open OFF**:
```
AI: "I've created index.html"
→ Toast: "Created index.html. [Open Preview]"
→ Click button to open when ready
```

---

## 🎯 Quick Tips

### Retry Policy
- **No action needed** - it just works!
- If you see multiple retries, check your network connection
- Partial responses are never lost

### Timeline
- **Watch tool progress** in real-time
- **See timing data** to understand performance
- **Identify slow tools** for optimization

### Preview Control
- **Keep auto-open ON** for rapid prototyping
- **Turn auto-open OFF** when:
  - Working with multiple files
  - Want to review code before previewing
  - Prefer manual control

---

## 🔧 For Developers

### Retry Configuration
Located in: `src/app/api/chat/stream/route.ts`
```typescript
const RETRY_CONFIG = {
    maxRetries: 1,              // Number of retry attempts
    initialBackoffMs: 250,      // First retry delay
    maxBackoffMs: 1000          // Maximum retry delay
};
```

### Status Event Format
```typescript
{
    type: 'tool_status',
    tool: 'create_file',
    phase: 'start' | 'finish',
    timestamp: 1707432000000,
    elapsedMs: 450              // Only on 'finish'
}
```

### Preview Control State
```typescript
const [autoOpenPreview, setAutoOpenPreview] = useState(true);
```

---

## 📝 Notes

- All features are **production-ready** and enabled by default
- **No breaking changes** - existing functionality preserved
- **Backward compatible** - works with all existing tools
- **Performance optimized** - minimal overhead

---

## 🐛 Troubleshooting

### Retry Not Working?
- Check console for error messages
- Verify error is transient (network-related)
- Non-transient errors won't retry (by design)

### Timeline Not Showing?
- Only appears when tools are executed
- Requires streaming mode (not fallback)
- Check browser console for errors

### Preview Not Auto-Opening?
- Verify `autoOpenPreview` is `true`
- Check browser popup blocker settings
- Ensure preview tab component is loaded

---

**Last Updated**: 2026-02-08  
**Phase**: 2 - Reliability + UX  
**Status**: ✅ Complete
