# Agent Communication & File Tracking Guidelines

## 🎯 Core Principle
**ALWAYS explain what you're doing, what you did, and where things are.**

---

## ✅ Required Communication Pattern

### **Before Action**
```
I'm going to:
1. Create folder: C:\Users\Drod\Source\a\crm-dashboard
2. Create file: C:\Users\Drod\Source\a\crm-dashboard\index.html
3. Add glassmorphic CRM dashboard with charts

Approve to proceed?
```

### **After Action**
```
✅ Created successfully!

📁 Location: C:\Users\Drod\Source\a\crm-dashboard\index.html

📊 What I built:
- Modern dark mode CRM dashboard
- Glassmorphic navigation bar
- 4 metric cards with glow effects
- Interactive charts (placeholder)
- Customer data table

🚀 Next steps:
1. Open: C:\Users\Drod\Source\a\crm-dashboard\index.html
2. Or run: cd C:\Users\Drod\Source\a\crm-dashboard && start index.html

Would you like me to open it in your browser?
```

---

## 📝 File Creation Protocol

### **ALWAYS Track Created Files**

When creating files, maintain a mental map:

```typescript
// Internal tracking (conceptual)
const createdFiles = {
    'crm-dashboard': {
        folder: 'C:\\Users\\Drod\\Source\\a\\crm-dashboard',
        files: [
            'index.html',
            'styles.css',
            'app.js'
        ],
        purpose: 'CRM Dashboard with glassmorphism',
        created: '2026-01-28T21:59:17-08:00'
    }
};
```

### **ALWAYS Provide Full Paths**

❌ **Bad**: "I created index.html"
✅ **Good**: "I created `C:\Users\Drod\Source\a\crm-dashboard\index.html`"

---

## 🗂️ File Organization Rules

### **1. Use Descriptive Folder Names**
- ❌ Bad: `app`, `project`, `new-folder`
- ✅ Good: `crm-dashboard`, `receipt-analyzer`, `task-manager`

### **2. Create in Workspace Root**
- Default: `C:\Users\Drod\Source\a\[project-name]`
- Unless user specifies otherwise

### **3. Avoid Name Collisions**
- Check if folder/file exists first
- Suggest unique names if collision detected
- Ask user for preference

---

## 💬 Communication Templates

### **Template 1: File Creation**
```markdown
## 📁 Created: [Project Name]

**Location**: `[Full Path]`

**Files Created**:
- ✅ `index.html` - Main dashboard
- ✅ `styles.css` - Glassmorphic styles
- ✅ `app.js` - Interactive features

**What's Inside**:
- [Feature 1]
- [Feature 2]
- [Feature 3]

**To View**:
1. Open: `[Full Path]/index.html`
2. Or run: `start [Full Path]/index.html`

**Next Steps**: [What user should do next]
```

### **Template 2: Delegation Failure**
```markdown
## ⚠️ Delegation Failed

**What happened**: Design Expert agent encountered an error

**Fallback Plan**:
1. I'll create the CRM dashboard myself
2. Then we can review it together
3. Make any adjustments you need

**Proceeding with**: [Specific actions]

Approve to continue?
```

### **Template 3: Search Results**
```markdown
## 🔍 Found Multiple Files

I found [N] files named `index.html`:

1. **CRM Dashboard** (just created)
   - Path: `C:\Users\Drod\Source\a\crm-dashboard\index.html`
   - Created: 2 minutes ago
   - Purpose: Glassmorphic CRM dashboard

2. **Task Manager**
   - Path: `C:\Users\Drod\Source\a\task-manager\index.html`
   - Created: 1 day ago
   - Purpose: Task management app

Which one would you like to open?
```

---

## 🧠 Cognitive Improvements Needed

### **1. File Creation Memory**
```typescript
// After creating a file, store in context:
interface CreatedFile {
    path: string;
    purpose: string;
    timestamp: string;
    relatedFiles: string[];
}

// Example:
const lastCreated: CreatedFile = {
    path: 'C:\\Users\\Drod\\Source\\a\\crm-dashboard\\index.html',
    purpose: 'CRM Dashboard with glassmorphism',
    timestamp: '2026-01-28T21:59:17-08:00',
    relatedFiles: ['styles.css', 'app.js']
};
```

### **2. Action Logging**
Every action should be logged:
```
[2026-01-28 21:59:17] CREATE_FOLDER: C:\Users\Drod\Source\a\crm-dashboard
[2026-01-28 21:59:18] CREATE_FILE: C:\Users\Drod\Source\a\crm-dashboard\index.html
[2026-01-28 21:59:19] WRITE_CONTENT: 1247 lines of HTML/CSS/JS
[2026-01-28 21:59:20] SUCCESS: CRM Dashboard created
```

### **3. Context Persistence**
Store recent creations in a session file:
```json
{
  "session_id": "2026-01-28-session",
  "created_projects": [
    {
      "name": "CRM Dashboard",
      "path": "C:\\Users\\Drod\\Source\\a\\crm-dashboard",
      "files": ["index.html", "styles.css", "app.js"],
      "created_at": "2026-01-28T21:59:17-08:00",
      "status": "complete"
    }
  ]
}
```

---

## 🎯 Best Practices

### **DO**
✅ Always provide full file paths
✅ Explain what you're doing before and after
✅ Summarize what was created
✅ Provide next steps
✅ Ask for confirmation on ambiguous actions
✅ Track all created files mentally
✅ Use descriptive folder names
✅ Check for existing files before creating

### **DON'T**
❌ Create files without explaining
❌ Use vague paths like "in the folder"
❌ Forget where you created files
❌ Leave user guessing about location
❌ Fail silently on delegation
❌ Create duplicate files without warning
❌ Use generic names like "app" or "project"

---

## 📊 Example: Good vs Bad

### **❌ Bad Communication**
```
User: Create a CRM dashboard
Agent: I'm ready to run tool processing in the background.
User: approve
Agent: Background task completed.
User: where is it?
Agent: There are multiple index.html files...
```

### **✅ Good Communication**
```
User: Create a CRM dashboard
Agent: I'll create a modern CRM dashboard with glassmorphism!

📁 Creating:
- Folder: C:\Users\Drod\Source\a\crm-dashboard
- File: index.html (with embedded CSS/JS)

Features:
- Dark mode with glassmorphic cards
- Key metrics dashboard
- Interactive charts
- Customer data table

Approve to proceed?

User: approve
Agent: ✅ Created successfully!

📁 Location: C:\Users\Drod\Source\a\crm-dashboard\index.html

🎨 What I built:
- Modern dark mode theme (#0a0e1a background)
- Glassmorphic navigation bar
- 4 metric cards with glow effects
- Placeholder charts (ready for data)
- Sortable customer table

🚀 To view:
Run: start C:\Users\Drod\Source\a\crm-dashboard\index.html

Or I can open it in your browser now?
```

---

## 🔧 Implementation Checklist

For every file creation task:

- [ ] Explain what will be created
- [ ] Provide full file paths
- [ ] Ask for confirmation
- [ ] Create the files
- [ ] Confirm success with paths
- [ ] Summarize what was built
- [ ] Provide next steps
- [ ] Offer to open/run the file

---

## 📈 Metrics to Track

To improve agent performance, track:

1. **Clarity Score**: Did user understand what was created?
2. **Path Accuracy**: Were all paths provided correctly?
3. **Follow-up Questions**: How many "where is it?" questions?
4. **Success Rate**: Did user find the file on first try?

**Goal**: Zero "where is it?" questions

---

## 🎓 Training Examples

### Example 1: Web App Creation
```
User: Create a task manager app

Agent: I'll create a premium task manager web app!

📁 Project Structure:
C:\Users\Drod\Source\a\task-manager\
├── index.html (main app)
├── styles.css (glassmorphic design)
└── app.js (task logic)

Features:
- Add/delete/complete tasks
- Glassmorphic cards
- Dark mode theme
- Local storage persistence

Approve to proceed?

[User approves]

✅ Created successfully!

📁 Location: C:\Users\Drod\Source\a\task-manager\

Files:
- index.html (247 lines)
- styles.css (156 lines)
- app.js (89 lines)

🚀 To run:
start C:\Users\Drod\Source\a\task-manager\index.html

Would you like me to open it now?
```

### Example 2: Delegation Failure
```
User: Get a design review

Agent: I'll delegate to the Design Expert...

⚠️ Design Expert encountered an error

Fallback plan:
1. I'll create the dashboard myself
2. Document the design decisions
3. You can review it directly

Proceeding with manual creation. Approve?

[User approves]

✅ Created CRM Dashboard

📁 Location: C:\Users\Drod\Source\a\crm-dashboard\index.html

Design decisions:
- Dark mode (#0a0e1a background)
- Glassmorphism (backdrop-blur-xl)
- Inter font family
- Blue accent (#3b82f6)

Ready for your review!
```

---

## 🚀 Quick Reference

**Every file creation must include**:
1. ✅ Full path
2. ✅ What was created
3. ✅ How to access it
4. ✅ Next steps

**Never say**:
- ❌ "I created the file"
- ❌ "It's in the folder"
- ❌ "Background task completed"

**Always say**:
- ✅ "Created: C:\Users\Drod\Source\a\[project]\[file]"
- ✅ "Location: [full path]"
- ✅ "To view: [specific command]"

---

**Remember**: The user should NEVER have to ask "where is it?"
