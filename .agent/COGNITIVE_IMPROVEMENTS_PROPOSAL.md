# Cognitive Agent Improvements - File Tracking & Context Awareness

## 🧠 Problem Statement

The current agent system has **memory and tracking issues**:

1. **Creates files but forgets where they are**
2. **Has to search for its own creations**
3. **Doesn't maintain context across actions**
4. **Poor communication about what was done**

---

## 💡 Proposed Solutions

### **Solution 1: Session Context File**

Create a persistent session file that tracks all actions:

```typescript
// .agent/session-context.json
{
  "session_id": "2026-01-28-21-59",
  "workspace": "C:\\Users\\Drod\\Source\\a",
  "created_files": [
    {
      "path": "C:\\Users\\Drod\\Source\\a\\crm-dashboard\\index.html",
      "type": "html",
      "purpose": "CRM Dashboard with glassmorphism",
      "created_at": "2026-01-28T21:59:17-08:00",
      "size_bytes": 12470,
      "related_files": ["styles.css", "app.js"],
      "status": "complete"
    }
  ],
  "actions": [
    {
      "timestamp": "2026-01-28T21:59:17-08:00",
      "action": "CREATE_FOLDER",
      "target": "C:\\Users\\Drod\\Source\\a\\crm-dashboard",
      "status": "success"
    },
    {
      "timestamp": "2026-01-28T21:59:18-08:00",
      "action": "CREATE_FILE",
      "target": "C:\\Users\\Drod\\Source\\a\\crm-dashboard\\index.html",
      "status": "success",
      "metadata": {
        "lines": 247,
        "features": ["glassmorphism", "dark-mode", "charts"]
      }
    }
  ],
  "last_created": {
    "path": "C:\\Users\\Drod\\Source\\a\\crm-dashboard\\index.html",
    "timestamp": "2026-01-28T21:59:18-08:00"
  }
}
```

**Benefits**:
- ✅ Agent can always reference what it created
- ✅ Persistent across sessions
- ✅ Easy to query "what did I just create?"
- ✅ Provides audit trail

---

### **Solution 2: Enhanced CognitiveAgent Memory**

Add file tracking to the CognitiveAgent class:

```typescript
// src/lib/agents/CognitiveAgent.ts

interface FileCreationRecord {
  path: string;
  purpose: string;
  timestamp: string;
  relatedFiles: string[];
  metadata: Record<string, any>;
}

class CognitiveAgent {
  private createdFiles: Map<string, FileCreationRecord> = new Map();
  private sessionContext: SessionContext;

  async createFile(path: string, content: string, purpose: string) {
    // Create the file
    await fs.writeFile(path, content);
    
    // Track it immediately
    const record: FileCreationRecord = {
      path,
      purpose,
      timestamp: new Date().toISOString(),
      relatedFiles: [],
      metadata: {
        size: content.length,
        type: path.split('.').pop()
      }
    };
    
    this.createdFiles.set(path, record);
    
    // Persist to session file
    await this.sessionContext.addCreatedFile(record);
    
    // Return detailed info
    return {
      success: true,
      path,
      record,
      message: `Created: ${path}\nPurpose: ${purpose}\nSize: ${content.length} bytes`
    };
  }

  async getLastCreated(): Promise<FileCreationRecord | null> {
    const entries = Array.from(this.createdFiles.entries());
    if (entries.length === 0) return null;
    
    // Sort by timestamp, return most recent
    const sorted = entries.sort((a, b) => 
      new Date(b[1].timestamp).getTime() - new Date(a[1].timestamp).getTime()
    );
    
    return sorted[0][1];
  }

  async findCreatedFile(name: string): Promise<FileCreationRecord[]> {
    const results: FileCreationRecord[] = [];
    
    for (const [path, record] of this.createdFiles) {
      if (path.includes(name)) {
        results.push(record);
      }
    }
    
    return results;
  }
}
```

**Benefits**:
- ✅ Agent has immediate access to created files
- ✅ Can query by name, purpose, or timestamp
- ✅ No need to search filesystem
- ✅ Integrated with cognitive system

---

### **Solution 3: Action Logger**

Create a real-time action logger:

```typescript
// src/lib/agents/ActionLogger.ts

class ActionLogger {
  private logFile: string;
  
  constructor(workspace: string) {
    this.logFile = path.join(workspace, '.agent', 'action-log.txt');
  }

  async log(action: string, details: any) {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${action}: ${JSON.stringify(details)}\n`;
    
    await fs.appendFile(this.logFile, entry);
    
    // Also log to console for debugging
    console.log(`🤖 ${action}:`, details);
  }

  async logFileCreation(path: string, purpose: string) {
    await this.log('CREATE_FILE', {
      path,
      purpose,
      size: (await fs.stat(path)).size
    });
  }

  async getRecentActions(count: number = 10): Promise<string[]> {
    const content = await fs.readFile(this.logFile, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    return lines.slice(-count);
  }
}
```

**Benefits**:
- ✅ Complete audit trail
- ✅ Easy debugging
- ✅ Can review what agent did
- ✅ Helps with error recovery

---

### **Solution 4: Smart Response Templates**

Create response templates that enforce good communication:

```typescript
// src/lib/agents/ResponseTemplates.ts

class ResponseTemplates {
  static fileCreated(record: FileCreationRecord): string {
    return `
## ✅ Created Successfully!

**📁 Location**: \`${record.path}\`

**📝 Purpose**: ${record.purpose}

**📊 Details**:
- File type: ${record.metadata.type}
- Size: ${record.metadata.size} bytes
- Created: ${new Date(record.timestamp).toLocaleString()}

**🚀 To view**:
\`\`\`bash
start ${record.path}
\`\`\`

**Next steps**: [What user should do next]
    `.trim();
  }

  static multipleFilesFound(files: FileCreationRecord[]): string {
    const list = files.map((f, i) => 
      `${i + 1}. **${path.basename(f.path)}**
   - Path: \`${f.path}\`
   - Purpose: ${f.purpose}
   - Created: ${new Date(f.timestamp).toLocaleString()}`
    ).join('\n\n');

    return `
## 🔍 Found Multiple Files

${list}

Which one would you like to open?
    `.trim();
  }

  static actionPlan(actions: string[]): string {
    const list = actions.map((a, i) => `${i + 1}. ${a}`).join('\n');
    
    return `
## 📋 Action Plan

I'm going to:

${list}

Approve to proceed?
    `.trim();
  }
}
```

**Benefits**:
- ✅ Consistent communication
- ✅ Always includes paths
- ✅ Always provides next steps
- ✅ Reduces "where is it?" questions

---

### **Solution 5: Context-Aware Prompts**

Enhance the agent's system prompt to include file tracking:

```typescript
const ENHANCED_SYSTEM_PROMPT = `
You are a helpful AI assistant with excellent file tracking abilities.

CRITICAL RULES FOR FILE OPERATIONS:

1. ALWAYS track files you create
2. ALWAYS provide full absolute paths
3. ALWAYS explain what you're doing
4. ALWAYS confirm what you did
5. NEVER forget where you created files

When creating files:
- Store the path immediately
- Provide full path to user
- Explain what's inside
- Provide command to open it

When user asks "where is it?":
- Check your recent creations first
- Provide the exact path
- Offer to open it for them

Example good response:
"✅ Created: C:\\Users\\Drod\\Source\\a\\crm-dashboard\\index.html
Purpose: CRM Dashboard with glassmorphism
To view: start C:\\Users\\Drod\\Source\\a\\crm-dashboard\\index.html"

Example bad response:
"Background task completed."

Your goal: User should NEVER have to ask "where is it?"
`;
```

---

## 🎯 Implementation Plan

### **Phase 1: Immediate (This Session)**
1. ✅ Create communication guidelines document
2. ✅ Create cognitive improvements proposal
3. ⏳ Update CognitiveAgent.ts with file tracking
4. ⏳ Create session context system

### **Phase 2: Short-term (Next Session)**
1. Implement ActionLogger
2. Create ResponseTemplates
3. Update system prompts
4. Add file tracking to all creation tools

### **Phase 3: Long-term (Future)**
1. Persistent memory across sessions
2. AI-powered context retrieval
3. Automatic file organization
4. Smart suggestions based on history

---

## 📊 Success Metrics

Track these metrics to measure improvement:

| Metric | Current | Target |
|--------|---------|--------|
| "Where is it?" questions | High | 0 |
| Path accuracy | ~60% | 100% |
| User confusion | High | Low |
| Follow-up questions | 3-5 | 0-1 |
| First-try success | ~40% | 95%+ |

---

## 🔧 Quick Wins

Immediate improvements we can make:

### **1. Session Context File**
Create `.agent/session-context.json` that tracks all actions

### **2. Action Logger**
Log every file creation to `.agent/action-log.txt`

### **3. Response Templates**
Use consistent templates for all responses

### **4. Path Validation**
Always validate paths before reporting to user

### **5. Auto-Open Option**
Always offer to open created files

---

## 💬 Example: Improved Workflow

### **Before** (Current - Bad)
```
User: Create a CRM dashboard
Agent: I'm ready to run tool processing...
User: approve
Agent: Background task completed.
User: where is it?
Agent: There are multiple index.html files...
User: 😤
```

### **After** (Improved - Good)
```
User: Create a CRM dashboard

Agent: I'll create a modern CRM dashboard!

📋 Plan:
1. Create folder: C:\Users\Drod\Source\a\crm-dashboard
2. Create file: index.html (with glassmorphism)
3. Add charts, metrics, and data table

Approve to proceed?

User: approve

Agent: ✅ Created successfully!

📁 Location: C:\Users\Drod\Source\a\crm-dashboard\index.html

🎨 What I built:
- Dark mode CRM dashboard
- Glassmorphic navigation
- 4 metric cards with glow
- Interactive charts
- Customer data table

🚀 To view:
start C:\Users\Drod\Source\a\crm-dashboard\index.html

Would you like me to open it now?

User: 😊 yes!
```

---

## 🎓 Training Data

Add these examples to agent training:

```json
{
  "good_examples": [
    {
      "scenario": "File creation",
      "response": "✅ Created: [full path]\nPurpose: [description]\nTo view: [command]"
    },
    {
      "scenario": "Multiple files found",
      "response": "Found N files:\n1. [path] - [purpose]\n2. [path] - [purpose]\nWhich one?"
    }
  ],
  "bad_examples": [
    {
      "scenario": "File creation",
      "response": "Background task completed.",
      "why_bad": "No path, no details, no next steps"
    },
    {
      "scenario": "User asks location",
      "response": "It's in the folder",
      "why_bad": "Vague, no specific path"
    }
  ]
}
```

---

## 🚀 Next Steps

To implement these improvements:

1. **Update CognitiveAgent.ts** - Add file tracking
2. **Create SessionContext** - Persistent memory
3. **Add ActionLogger** - Audit trail
4. **Create Templates** - Consistent responses
5. **Update Prompts** - Better instructions
6. **Test & Iterate** - Measure success

---

## 📝 Summary

The agent needs:
- ✅ Better memory (track created files)
- ✅ Better communication (always provide paths)
- ✅ Better context (session persistence)
- ✅ Better templates (consistent responses)
- ✅ Better logging (audit trail)

**Goal**: User should NEVER ask "where is it?"

**Status**: Ready to implement
**Priority**: HIGH
**Impact**: MAXIMUM user satisfaction
