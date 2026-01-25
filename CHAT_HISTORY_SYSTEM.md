# Chat History & Multiple Sessions - Implementation Guide

## Overview
Added persistent chat history with support for multiple chat sessions, allowing users to:
- Save conversations to the database
- Create and switch between multiple chats
- Resume conversations later
- Search and organize chat history

## What We've Built

### 1. Database Schema ✅

**Added Models:**

```prisma
model ChatSession {
  id          String   @id @default(cuid())
  title       String   @default("New Chat")
  messages    ChatMessage[]
  
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model ChatMessage {
  id          String   @id @default(cuid())
  role        String   // 'user' or 'ai'
  content     String   @db.Text
  fileIds     String[] @default([]) // Attached files
  toolUsed    String?  // Tool executed
  
  sessionId   String
  session     ChatSession @relation(fields: [sessionId], references: [id])
  createdAt   DateTime @default(now())
}
```

**Features:**
- Multiple chat sessions per user
- Messages linked to sessions
- File attachments tracked
- Tool usage recorded
- Timestamps for sorting

### 2. Server Actions ✅

Created `src/app/chatActions.ts` with:

**Session Management:**
- `createChatSession(title?)` - Create new chat
- `getChatSessions()` - List all user's chats
- `getChatSession(id)` - Get chat with messages
- `updateChatSessionTitle(id, title)` - Rename chat
- `deleteChatSession(id)` - Delete chat
- `clearChatSession(id)` - Clear messages

**Message Management:**
- `addChatMessage(sessionId, role, content, fileIds?, toolUsed?)` - Add message

## What Needs to Be Done

### Step 1: Run Database Migration ⏳

```bash
# Stop dev server first
npx prisma migrate dev --name add_chat_sessions
npx prisma generate
```

### Step 2: Update AIChat Component ⏳

**Add State for Sessions:**
```typescript
const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
const [sessions, setSessions] = useState<ChatSession[]>([]);
const [showSessions, setShowSessions] = useState(false);
```

**Load Sessions on Mount:**
```typescript
useEffect(() => {
    loadSessions();
}, []);

const loadSessions = async () => {
    const sessions = await getChatSessions();
    setSessions(sessions);
    
    // Auto-create first session if none exist
    if (sessions.length === 0) {
        const result = await createChatSession();
        if (result.success) {
            setCurrentSessionId(result.session.id);
            setSessions([result.session]);
        }
    } else {
        setCurrentSessionId(sessions[0].id);
    }
};
```

**Save Messages to DB:**
```typescript
const handleSend = async (e: React.FormEvent) => {
    // ... existing code ...
    
    // Save user message
    if (currentSessionId) {
        await addChatMessage(
            currentSessionId,
            'user',
            userMsg.content,
            userMsg.files.map(f => f.id)
        );
    }
    
    // ... AI response ...
    
    // Save AI response
    if (currentSessionId && res.success) {
        await addChatMessage(
            currentSessionId,
            'ai',
            res.text,
            [],
            res.toolUsed
        );
    }
};
```

**Load Session Messages:**
```typescript
const loadSession = async (sessionId: string) => {
    const session = await getChatSession(sessionId);
    if (session) {
        setCurrentSessionId(sessionId);
        setMessages(session.messages.map(m => ({
            role: m.role as 'user' | 'ai',
            content: m.content,
            files: [], // Load files if needed
            toolUsed: m.toolUsed
        })));
    }
};
```

### Step 3: Add Chat Sessions UI ⏳

**Add Sessions Sidebar:**
```tsx
{/* Chat Sessions Sidebar */}
{showSessions && (
    <div className="absolute left-0 top-0 bottom-0 w-64 bg-slate-900 border-r border-white/10 p-4">
        {/* New Chat Button */}
        <button
            onClick={async () => {
                const result = await createChatSession();
                if (result.success) {
                    setCurrentSessionId(result.session.id);
                    setMessages([]);
                    loadSessions();
                }
            }}
            className="w-full px-4 py-2 bg-blue-600 rounded-xl mb-4"
        >
            + New Chat
        </button>
        
        {/* Sessions List */}
        <div className="space-y-2">
            {sessions.map(session => (
                <button
                    key={session.id}
                    onClick={() => loadSession(session.id)}
                    className={cn(
                        "w-full px-3 py-2 rounded-lg text-left",
                        currentSessionId === session.id
                            ? "bg-blue-600"
                            : "bg-white/5 hover:bg-white/10"
                    )}
                >
                    <div className="font-medium truncate">{session.title}</div>
                    <div className="text-xs text-white/40">
                        {session._count.messages} messages
                    </div>
                </button>
            ))}
        </div>
    </div>
)}

{/* Toggle Sessions Button */}
<button
    onClick={() => setShowSessions(!showSessions)}
    className="p-2 rounded-lg bg-white/5"
>
    <MessageSquare size={20} />
</button>
```

### Step 4: Add Auto-Title Generation ⏳

Generate smart titles based on first message:

```typescript
const generateTitle = (firstMessage: string) => {
    // Take first 50 chars or first sentence
    const title = firstMessage.length > 50
        ? firstMessage.substring(0, 50) + '...'
        : firstMessage;
    return title;
};

// After first user message:
if (messages.length === 1 && currentSessionId) {
    const title = generateTitle(userMsg.content);
    await updateChatSessionTitle(currentSessionId, title);
    loadSessions(); // Refresh list
}
```

### Step 5: Add Search & Filter ⏳

```tsx
const [searchQuery, setSearchQuery] = useState('');

const filteredSessions = sessions.filter(session =>
    session.title.toLowerCase().includes(searchQuery.toLowerCase())
);

// In UI:
<input
    type="text"
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    placeholder="Search chats..."
    className="w-full px-3 py-2 bg-white/5 rounded-lg"
/>
```

## UI Design

### Chat Sessions Sidebar

```
┌─────────────────────────────────────┐
│  [≡] TaskFlow AI                    │
├─────────────────────────────────────┤
│  [+ New Chat]                       │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ Receipt Analysis              │ │ ← Active
│  │ 12 messages                   │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ Payment Processing            │ │
│  │ 5 messages                    │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ Business Verification         │ │
│  │ 8 messages                    │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Chat Header with Session Info

```
┌─────────────────────────────────────┐
│  [≡] Receipt Analysis        [⋮]    │ ← Session title + menu
│  12 messages • Updated 2m ago       │
├─────────────────────────────────────┤
│  [Messages...]                      │
└─────────────────────────────────────┘
```

## Features to Add

### Phase 1: Core (Priority) ⏳
- ✅ Database schema
- ✅ Server actions
- ⏳ Save messages to DB
- ⏳ Load session messages
- ⏳ Create new sessions
- ⏳ Switch between sessions

### Phase 2: UX Enhancements ⏳
- ⏳ Auto-generate titles
- ⏳ Rename sessions
- ⏳ Delete sessions
- ⏳ Clear session messages
- ⏳ Sessions sidebar UI

### Phase 3: Advanced ⏳
- ⏳ Search/filter sessions
- ⏳ Pin important chats
- ⏳ Archive old chats
- ⏳ Export chat history
- ⏳ Share chat links

## Benefits

### For Users
✅ **Never lose conversations** - All chats saved  
✅ **Organize by topic** - Multiple sessions  
✅ **Resume anytime** - Pick up where you left off  
✅ **Search history** - Find past conversations  
✅ **Context preserved** - Files stay attached  

### For Developers
✅ **Analytics** - Track tool usage  
✅ **Debugging** - See conversation history  
✅ **Improvements** - Analyze user patterns  
✅ **Compliance** - Audit trail  

## Example Use Cases

### Receipt Processing Workflow
1. Create "January Receipts" chat
2. Attach multiple receipt images
3. Process each one
4. All extractions saved in one place
5. Come back later to review

### Business Verification
1. Create "Vendor Verification" chat
2. Verify multiple businesses
3. All verification results in one thread
4. Easy to reference later

### Report Generation
1. Create "Monthly Report" chat
2. Analyze data
3. Generate tables
4. Export to markdown
5. Session preserved for next month

## Migration Strategy

### For Existing Users
1. **Auto-migrate** current chat to first session
2. **Preserve** all messages and files
3. **Generate** title from first message
4. **Notify** user about new multi-chat feature

### Code Example:
```typescript
// On first load after migration
const migrateExistingChat = async () => {
    if (messages.length > 0 && !currentSessionId) {
        const title = generateTitle(messages[0].content);
        const result = await createChatSession(title);
        
        if (result.success) {
            // Save all existing messages
            for (const msg of messages) {
                await addChatMessage(
                    result.session.id,
                    msg.role,
                    msg.content,
                    msg.files?.map(f => f.id),
                    msg.toolUsed
                );
            }
            
            setCurrentSessionId(result.session.id);
        }
    }
};
```

## Files to Modify

### Backend
- ✅ `prisma/schema.prisma` (updated)
- ✅ `src/app/chatActions.ts` (created)

### Frontend
- ⏳ `src/components/AIChat.tsx` (needs major update)
- ⏳ Create `src/components/ChatSessionsSidebar.tsx` (new component)
- ⏳ Create `src/components/ChatSessionItem.tsx` (new component)

### Types
- ⏳ Update types in `AIChat.tsx` to include session info

## Next Steps

1. **Run migration** to create tables
2. **Update AIChat** to use sessions
3. **Add sessions sidebar** UI
4. **Test** session switching
5. **Add** auto-title generation
6. **Polish** UX

This will transform your AI chat into a powerful conversation manager! 🚀
