# CognitiveAgent File Tracking - Usage Guide

## 🎯 Overview

The CognitiveAgent now has **built-in file tracking and context awareness**! It can remember every file it creates and provide detailed information about them.

---

## ✨ New Features

### **1. File Creation Tracking**
Every file created is automatically tracked with:
- Full path
- Purpose/description
- Timestamp
- File type
- Size (optional)
- Related files (optional)
- Custom metadata (optional)

### **2. Action Logging**
All actions are logged with:
- Timestamp
- Action type
- Details
- Status (success/error/pending)

### **3. Session Management**
- Unique session ID
- Session summary
- Recent activity tracking

---

## 📚 API Reference

### **Track File Creation**

```typescript
const agent = new CognitiveAgent(apiKey, sessionId);

// Track a created file
agent.trackFileCreation({
    path: 'C:\\Users\\Drod\\Source\\a\\crm-dashboard\\index.html',
    purpose: 'CRM Dashboard with glassmorphism',
    timestamp: new Date().toISOString(),
    type: 'html',
    size: 12470,
    relatedFiles: ['styles.css', 'app.js'],
    metadata: {
        features: ['glassmorphism', 'dark-mode', 'charts']
    }
});
```

### **Get Last Created File**

```typescript
const lastFile = agent.getLastCreatedFile();

if (lastFile) {
    console.log(`Last created: ${lastFile.path}`);
    console.log(`Purpose: ${lastFile.purpose}`);
}
```

### **Find Files**

```typescript
// Find all files matching "dashboard"
const dashboardFiles = agent.findCreatedFiles('dashboard');

dashboardFiles.forEach(file => {
    console.log(`Found: ${file.path}`);
});
```

### **Get All Created Files**

```typescript
const allFiles = agent.getAllCreatedFiles();

console.log(`Total files created: ${allFiles.length}`);
```

### **Log Actions**

```typescript
// Log a successful action
agent.logAction('CREATE_FOLDER', {
    path: 'C:\\Users\\Drod\\Source\\a\\crm-dashboard'
}, 'success');

// Log an error
agent.logAction('DELETE_FILE', {
    path: 'C:\\Users\\Drod\\Source\\a\\old-file.txt',
    error: 'File not found'
}, 'error');
```

### **Get Recent Actions**

```typescript
const recentActions = agent.getRecentActions(5);

recentActions.forEach(action => {
    console.log(`[${action.timestamp}] ${action.action}: ${action.status}`);
});
```

### **Get Session Summary**

```typescript
const summary = agent.getSessionSummary();

console.log(`Session ID: ${summary.sessionId}`);
console.log(`Files created: ${summary.filesCreated}`);
console.log(`Actions logged: ${summary.actionsLogged}`);
console.log(`Last activity: ${summary.lastActivity}`);
console.log(`Recent files:`, summary.recentFiles);
```

### **Format File Creation for User**

```typescript
const lastFile = agent.getLastCreatedFile();

if (lastFile) {
    const message = agent.formatFileCreation(lastFile);
    console.log(message);
    // Outputs:
    // ✅ Created successfully!
    // 📁 Location: `C:\Users\Drod\Source\a\crm-dashboard\index.html`
    // ...
}
```

---

## 🔧 Integration Example

### **In Server Actions**

```typescript
// src/app/actions.ts

import { CognitiveAgent } from '@/lib/agents/CognitiveAgent';

export async function createHTMLFile(
    path: string,
    content: string,
    purpose: string,
    sessionId: string
) {
    const agent = new CognitiveAgent(process.env.GEMINI_API_KEY!, sessionId);

    try {
        // Create the file
        await fs.writeFile(path, content);

        // Track it immediately
        agent.trackFileCreation({
            path,
            purpose,
            timestamp: new Date().toISOString(),
            type: 'html',
            size: content.length,
            metadata: {
                lines: content.split('\n').length
            }
        });

        // Get formatted message
        const lastFile = agent.getLastCreatedFile();
        const message = lastFile ? agent.formatFileCreation(lastFile) : 'File created';

        return {
            success: true,
            message,
            path
        };
    } catch (error) {
        agent.logAction('CREATE_FILE', { path, error }, 'error');
        throw error;
    }
}
```

### **In Background Jobs**

```typescript
// When processing background jobs

const agent = new CognitiveAgent(apiKey, job.sessionId);

// Track each file created
for (const file of filesToCreate) {
    await createFile(file.path, file.content);
    
    agent.trackFileCreation({
        path: file.path,
        purpose: file.purpose,
        timestamp: new Date().toISOString(),
        type: file.type
    });
}

// Get summary at the end
const summary = agent.getSessionSummary();

return {
    success: true,
    filesCreated: summary.filesCreated,
    recentFiles: summary.recentFiles
};
```

---

## 💡 Usage Patterns

### **Pattern 1: Track and Report**

```typescript
// Create file
await createFile(path, content);

// Track it
agent.trackFileCreation({
    path,
    purpose: 'User dashboard',
    timestamp: new Date().toISOString(),
    type: 'html'
});

// Report to user
const lastFile = agent.getLastCreatedFile();
if (lastFile) {
    return agent.formatFileCreation(lastFile);
}
```

### **Pattern 2: Find and Open**

```typescript
// User asks: "Where is the dashboard?"

const files = agent.findCreatedFiles('dashboard');

if (files.length === 1) {
    return `Found it! ${files[0].path}`;
} else if (files.length > 1) {
    return `Found ${files.length} dashboards:\n` +
        files.map((f, i) => `${i + 1}. ${f.path}`).join('\n');
} else {
    return 'No dashboard files found.';
}
```

### **Pattern 3: Session Summary**

```typescript
// At end of session

const summary = agent.getSessionSummary();

return `
## Session Summary

**Session ID**: ${summary.sessionId}
**Files Created**: ${summary.filesCreated}
**Actions Logged**: ${summary.actionsLogged}
**Last Activity**: ${summary.lastActivity}

**Recent Files**:
${summary.recentFiles.map(f => `- ${f.path}`).join('\n')}
`;
```

---

## 🎯 Best Practices

### **1. Always Track File Creations**

```typescript
// ❌ Bad - No tracking
await fs.writeFile(path, content);

// ✅ Good - Track immediately
await fs.writeFile(path, content);
agent.trackFileCreation({
    path,
    purpose: 'User dashboard',
    timestamp: new Date().toISOString(),
    type: 'html'
});
```

### **2. Use Descriptive Purposes**

```typescript
// ❌ Bad - Vague purpose
agent.trackFileCreation({
    path: 'index.html',
    purpose: 'HTML file',
    ...
});

// ✅ Good - Descriptive purpose
agent.trackFileCreation({
    path: 'C:\\Users\\Drod\\Source\\a\\crm-dashboard\\index.html',
    purpose: 'CRM Dashboard with glassmorphism, dark mode, and interactive charts',
    ...
});
```

### **3. Log Important Actions**

```typescript
// Log folder creation
agent.logAction('CREATE_FOLDER', {
    path: 'C:\\Users\\Drod\\Source\\a\\crm-dashboard'
}, 'success');

// Log file creation
agent.logAction('CREATE_FILE', {
    path: 'C:\\Users\\Drod\\Source\\a\\crm-dashboard\\index.html',
    size: 12470
}, 'success');

// Log errors
agent.logAction('DELETE_FILE', {
    path: 'old-file.txt',
    error: 'File not found'
}, 'error');
```

### **4. Use Session IDs**

```typescript
// ✅ Pass session ID for persistence
const agent = new CognitiveAgent(apiKey, chatSession.id);

// Now all tracking is associated with this session
```

---

## 📊 Example Output

### **File Creation Message**

```
✅ Created successfully!

📁 Location: `C:\Users\Drod\Source\a\crm-dashboard\index.html`

📝 Purpose: CRM Dashboard with glassmorphism

📊 Details:
- File type: html
- Size: 12470 bytes
- Created: 1/28/2026, 10:00:00 PM

🚀 To view:
```bash
start C:\Users\Drod\Source\a\crm-dashboard\index.html
```
```

### **Session Summary**

```json
{
  "sessionId": "session-1738123456789",
  "filesCreated": 3,
  "actionsLogged": 5,
  "lastActivity": "2026-01-28T22:00:00.000Z",
  "recentFiles": [
    {
      "path": "C:\\Users\\Drod\\Source\\a\\crm-dashboard\\index.html",
      "purpose": "CRM Dashboard with glassmorphism",
      "timestamp": "2026-01-28T22:00:00.000Z",
      "type": "html",
      "size": 12470
    }
  ]
}
```

---

## 🚀 Next Steps

1. **Integrate with Server Actions** - Track all file creations
2. **Add to Background Jobs** - Track files created by agents
3. **Create Session Persistence** - Save to database
4. **Add UI Display** - Show recent files in chat
5. **Implement Search** - Let users search created files

---

## 📝 Summary

The CognitiveAgent now has:
- ✅ File creation tracking
- ✅ Action logging
- ✅ Session management
- ✅ Search capabilities
- ✅ Formatted output for users

**Goal**: User should NEVER ask "where is it?" again!

**Status**: ✅ Implemented and ready to use
**Impact**: 🚀 Maximum context awareness
