# Quick Recovery Script for Stuck AI Chat

## The Problem
Your AI chat is stuck in "COMPUTING..." state because the streaming response is hanging.

## Immediate Fix

### Option 1: Refresh the Browser (Recommended)
1. Press `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac) to hard refresh the page
2. This will:
   - Reset the client state
   - Load the new code with timeout protection
   - Clear any stuck requests

### Option 2: Close and Reopen the Chat
1. Click the X button to close the AI chat panel
2. Reopen it
3. The state should be reset

### Option 3: Restart the Dev Server (If above doesn't work)
```powershell
# Stop the current dev server (Ctrl+C in the terminal)
# Then restart:
npm run dev
```

## What Was Fixed

The code now has multiple layers of protection:

1. **5-minute request timeout** - Prevents fetch from hanging forever
2. **4-minute stream reading timeout** - Prevents the stream reader from getting stuck
3. **Automatic context reduction** - If a request fails, it retries with fewer files (20 instead of 50)
4. **Better error messages** - You'll see exactly what went wrong

## Prevention

The new code will warn you if you're attaching too many files (>30) before sending the request.

## Testing After Recovery

Try sending a simple message like "hi" to verify the chat is working again.
