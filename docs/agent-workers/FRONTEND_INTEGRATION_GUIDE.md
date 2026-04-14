# Frontend Integration Guide - Phase 2 Features

This guide explains how to integrate the Phase 2 backend features into the frontend UI.

## 1. Tool Status Timeline Integration

### Step 1: Import the Component
```typescript
import ToolStatusTimeline, { ToolStatusEvent } from '@/components/ai-chat/ToolStatusTimeline';
```

### Step 2: Add State to Track Events
```typescript
const [toolStatusEvents, setToolStatusEvents] = useState<ToolStatusEvent[]>([]);
```

### Step 3: Process Stream Events
In your existing stream event handler, add handling for `tool_status` events:

```typescript
// Existing stream processing code
const processStreamEvent = (event: any) => {
  switch (event.type) {
    case 'delta':
      // Existing delta handling
      setStreamingContent(prev => prev + event.text);
      break;
    
    case 'status':
      // Existing status handling
      setStatusMessage(event.message);
      break;
    
    // NEW: Handle tool status events
    case 'tool_status':
      setToolStatusEvents(prev => [...prev, {
        tool: event.tool,
        phase: event.phase,
        timestamp: event.timestamp,
        elapsedMs: event.elapsedMs
      }]);
      break;
    
    case 'done':
      // Existing done handling
      setIsStreaming(false);
      break;
    
    case 'error':
      // Existing error handling
      setError(event.message);
      // NEW: Check for partial content
      if (event.partialContent) {
        setStreamingContent(event.partialContent);
      }
      break;
  }
};
```

### Step 4: Render the Timeline
Add the timeline component to your message bubble or chat interface:

```typescript
<div className="message-container">
  {/* Existing message content */}
  <div className="message-text">{content}</div>
  
  {/* NEW: Tool status timeline */}
  {toolStatusEvents.length > 0 && (
    <ToolStatusTimeline events={toolStatusEvents} />
  )}
</div>
```

### Step 5: Clear Events on New Message
Reset the events when starting a new message:

```typescript
const handleSendMessage = async (text: string) => {
  setToolStatusEvents([]);  // Clear previous events
  // ... rest of send logic
};
```

## 2. Preview Auto-Open Integration

### Step 1: Import the Functions
```typescript
import { getPreviewAutoOpen, setPreviewAutoOpen } from '@/app/settingsActions';
```

### Step 2: Add State for the Setting
```typescript
const [previewAutoOpen, setPreviewAutoOpenState] = useState(true);
```

### Step 3: Load Setting on Mount
```typescript
useEffect(() => {
  const loadPreviewSetting = async () => {
    const enabled = await getPreviewAutoOpen();
    setPreviewAutoOpenState(enabled);
  };
  loadPreviewSetting();
}, []);
```

### Step 4: Conditional Preview Opening
Replace direct `window.open()` calls with conditional logic:

```typescript
// BEFORE:
window.open(previewUrl, '_blank');

// AFTER:
if (previewAutoOpen) {
  window.open(previewUrl, '_blank');
} else {
  // Show a button or notification instead
  setShowPreviewPrompt(true);
}
```

### Step 5: Add UI Toggle
Add a settings toggle in your settings panel:

```typescript
<div className="setting-item">
  <label>
    <input
      type="checkbox"
      checked={previewAutoOpen}
      onChange={async (e) => {
        const enabled = e.target.checked;
        setPreviewAutoOpenState(enabled);
        await setPreviewAutoOpen(enabled);
      }}
    />
    Automatically open preview links
  </label>
  <p className="setting-description">
    When enabled, preview links will open automatically. 
    When disabled, you'll see a button to open them manually.
  </p>
</div>
```

### Step 6: Manual Preview Button
When auto-open is disabled, show a manual button:

```typescript
{!previewAutoOpen && previewUrl && (
  <button
    onClick={() => window.open(previewUrl, '_blank')}
    className="preview-button"
  >
    <ExternalLink size={16} />
    Open Preview
  </button>
)}
```

## 3. Stream Retry User Feedback

The retry logic is automatic, but you can enhance UX by showing retry status:

### Display Retry Messages
The stream already emits status messages during retries:

```typescript
case 'status':
  if (event.message.includes('Retrying')) {
    // Show retry notification
    setRetryStatus(event.message);
  } else {
    setStatusMessage(event.message);
  }
  break;
```

### Show Partial Content on Error
When an error occurs after retries are exhausted:

```typescript
case 'error':
  setError(event.message);
  
  // Show partial content if available
  if (event.partialContent) {
    setStreamingContent(event.partialContent);
    
    // Optionally show a warning
    toast.warning('Response was incomplete due to connection issues');
  }
  break;
```

## Complete Example: AIChat Integration

Here's a complete example showing all three features integrated:

```typescript
'use client';

import React, { useState, useEffect } from 'react';
import ToolStatusTimeline, { ToolStatusEvent } from '@/components/ai-chat/ToolStatusTimeline';
import { getPreviewAutoOpen, setPreviewAutoOpen } from '@/app/settingsActions';
import { ExternalLink } from 'lucide-react';

export default function AIChat() {
  // Existing state
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  
  // NEW: Tool status events
  const [toolStatusEvents, setToolStatusEvents] = useState<ToolStatusEvent[]>([]);
  
  // NEW: Preview auto-open setting
  const [previewAutoOpen, setPreviewAutoOpenState] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Load preview setting on mount
  useEffect(() => {
    getPreviewAutoOpen().then(setPreviewAutoOpenState);
  }, []);
  
  const handleSendMessage = async (text: string) => {
    // Clear previous tool events
    setToolStatusEvents([]);
    setIsStreaming(true);
    
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: text })
    });
    
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const event = JSON.parse(line.slice(6));
          
          switch (event.type) {
            case 'delta':
              // Append text to current message
              setMessages(prev => {
                const last = prev[prev.length - 1];
                return [...prev.slice(0, -1), { ...last, content: last.content + event.text }];
              });
              break;
            
            case 'tool_status':
              // NEW: Track tool execution
              setToolStatusEvents(prev => [...prev, event]);
              break;
            
            case 'status':
              // Show status (including retry messages)
              console.log('Status:', event.message);
              break;
            
            case 'done':
              setIsStreaming(false);
              
              // Check for preview URL in tool result
              if (event.toolResult?.previewUrl) {
                const url = event.toolResult.previewUrl;
                setPreviewUrl(url);
                
                // NEW: Conditional auto-open
                if (previewAutoOpen) {
                  window.open(url, '_blank');
                }
              }
              break;
            
            case 'error':
              setIsStreaming(false);
              
              // NEW: Show partial content if available
              if (event.partialContent) {
                setMessages(prev => {
                  const last = prev[prev.length - 1];
                  return [...prev.slice(0, -1), { 
                    ...last, 
                    content: event.partialContent,
                    isPartial: true 
                  }];
                });
              }
              break;
          }
        }
      }
    }
  };
  
  return (
    <div className="chat-container">
      {/* Messages */}
      {messages.map((msg, i) => (
        <div key={i} className="message">
          <div className="message-content">{msg.content}</div>
          
          {/* NEW: Show tool timeline if events exist */}
          {msg.toolEvents && msg.toolEvents.length > 0 && (
            <ToolStatusTimeline events={msg.toolEvents} />
          )}
          
          {/* NEW: Show warning for partial messages */}
          {msg.isPartial && (
            <div className="warning">
              ⚠️ This response was incomplete due to connection issues
            </div>
          )}
        </div>
      ))}
      
      {/* NEW: Manual preview button when auto-open is disabled */}
      {!previewAutoOpen && previewUrl && (
        <button
          onClick={() => window.open(previewUrl, '_blank')}
          className="preview-button"
        >
          <ExternalLink size={16} />
          Open Preview
        </button>
      )}
      
      {/* Settings Panel */}
      <div className="settings">
        <label>
          <input
            type="checkbox"
            checked={previewAutoOpen}
            onChange={async (e) => {
              const enabled = e.target.checked;
              setPreviewAutoOpenState(enabled);
              await setPreviewAutoOpen(enabled);
            }}
          />
          Auto-open previews
        </label>
      </div>
    </div>
  );
}
```

## Testing Checklist

### Tool Status Timeline
- [ ] Timeline appears when tools are executed
- [ ] Shows correct tool names
- [ ] Displays elapsed time for completed tools
- [ ] Updates in real-time during execution
- [ ] Clears when starting a new message

### Preview Auto-Open
- [ ] Setting loads correctly on mount
- [ ] Toggle persists across page refreshes
- [ ] Auto-open works when enabled
- [ ] Manual button appears when disabled
- [ ] Default is enabled (auto-open)

### Stream Retry
- [ ] Retry messages appear in status
- [ ] Partial content is preserved on error
- [ ] Tools don't execute twice on retry
- [ ] Error messages include partial content
- [ ] Retry happens automatically (no user action needed)

## Styling Recommendations

### Tool Status Timeline
The component already has built-in styling, but you can customize:
- Timeline border color
- Tool name font
- Status indicator colors
- Elapsed time display

### Preview Button
Suggested styling for the manual preview button:
```css
.preview-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(56, 189, 248, 0.1);
  border: 1px solid rgba(56, 189, 248, 0.3);
  border-radius: 8px;
  color: rgb(56, 189, 248);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.preview-button:hover {
  background: rgba(56, 189, 248, 0.2);
  border-color: rgba(56, 189, 248, 0.5);
}
```

## Performance Considerations

1. **Tool Events Array**: Consider limiting the array size if you expect many tool executions:
   ```typescript
   setToolStatusEvents(prev => [...prev.slice(-20), event]); // Keep last 20
   ```

2. **Preview Setting**: Cache the setting in memory to avoid repeated database calls:
   ```typescript
   let cachedPreviewSetting: boolean | null = null;
   
   const getPreviewAutoOpenCached = async () => {
     if (cachedPreviewSetting === null) {
       cachedPreviewSetting = await getPreviewAutoOpen();
     }
     return cachedPreviewSetting;
   };
   ```

3. **Stream Processing**: The retry logic is server-side, so no additional client-side overhead.

## Troubleshooting

### Tool Timeline Not Showing
- Check that `tool_status` events are being emitted from the stream
- Verify the events array is being updated in state
- Ensure the component is imported correctly

### Preview Setting Not Persisting
- Check that the user is authenticated (setting requires auth)
- Verify the database connection
- Check browser console for errors

### Retry Not Working
- Retry is automatic and server-side
- Check server logs for retry messages
- Verify the error is transient (network-related)

## Support

For questions or issues with integration:
1. Check `WORKER_B_SUMMARY.md` for implementation details
2. Review `STREAM_RETRY_FLOW.md` for retry mechanism
3. Examine the source files directly for the latest code
