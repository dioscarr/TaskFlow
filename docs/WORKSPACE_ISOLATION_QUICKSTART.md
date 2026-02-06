# Workspace Isolation - Quick Start Guide

## 🎯 What Is This?

Workspace Isolation is a **security system** that prevents AI agents from accidentally destroying TaskFlow's core files when working on repo apps.

## 🚨 The Problem It Solves

**BEFORE (Dangerous):**
```
You: "create the dashboard component"
AI: *creates src/components/Dashboard.tsx*
Result: TaskFlow's Dashboard is DESTROYED! 💥
```

**AFTER (Safe):**
```
You: "create the dashboard component"
AI: *tries to create src/components/Dashboard.tsx*
System: 🚫 WORKSPACE VIOLATION - REJECTED
AI: *creates crm-app/src/components/Dashboard.tsx instead*
Result: File created safely in the repo app! ✅
```

## 🚀 How to Use It

### Step 1: Set Active App
1. Go to **Dashboard → Files → Repo Apps**
2. Find the app you want to work on (e.g., `crm-app`)
3. Click the **"Active"** button (blue with sparkles ✨)

### Step 2: Verify Isolation is Active
Look for this message in your terminal/logs:
```
🔒 WORKSPACE ISOLATION ACTIVE: Restricting to repo app "crm-app"
```

### Step 3: Work Safely
Now when you ask the AI to work on the app, it will:
- ✅ Create files in `crm-app/src/...`
- ✅ Edit files in `crm-app/components/...`
- ❌ **REJECT** any attempts to edit TaskFlow core files

## 📋 What Gets Protected?

### Protected TaskFlow Directories
The AI **cannot** edit files in:
- ❌ `src/` (TaskFlow core)
- ❌ `components/` (TaskFlow core)
- ❌ `app/` (TaskFlow core)
- ❌ `lib/` (TaskFlow core)
- ❌ Any other TaskFlow directories

### Allowed Repo App Paths
The AI **can** edit files in:
- ✅ `crm-app/src/...`
- ✅ `crm-app/components/...`
- ✅ `crm-app/public/...`
- ✅ `apps/crm-app/...`

## 💡 Example Workflow

### Scenario: Building a CRM App

1. **Set Active App**
   ```
   Click "Active" on crm-app
   ```

2. **Ask AI to Work**
   ```
   You: "create the main dashboard component for this CRM"
   ```

3. **AI Creates Safely**
   ```
   AI creates: crm-app/src/components/Dashboard.tsx ✅
   NOT: src/components/Dashboard.tsx ❌
   ```

4. **Continue Working**
   ```
   You: "add a customer list component"
   AI creates: crm-app/src/components/CustomerList.tsx ✅
   ```

## 🛡️ Protection Layers

### Layer 1: AI Instructions
The AI receives explicit instructions about workspace boundaries.

### Layer 2: Technical Validation
Every file operation is validated before execution.

### Layer 3: Operation Rejection
Invalid operations are rejected with clear error messages.

### Layer 4: Logging
All violations are logged for debugging.

## 🔍 What You'll See

### When Isolation is Active
```
🔒 WORKSPACE ISOLATION ACTIVE: Restricting to repo app "crm-app"
```

### When a Violation is Prevented
```
❌ 🚫 WORKSPACE VIOLATION: Cannot edit "src/components/Dashboard.tsx". 
Active repo app is "crm-app". All file operations must be within "crm-app/"
```

### When Operations Succeed
```
✅ Created: crm-app/src/components/Dashboard.tsx
```

## ⚠️ Common Mistakes

### ❌ Wrong: No Path Prefix
```
You: "create src/App.tsx"
Result: REJECTED - missing app prefix
```

### ✅ Correct: With App Prefix
```
You: "create crm-app/src/App.tsx"
Result: SUCCESS - file created in repo app
```

### ✅ Even Better: Let AI Figure It Out
```
You: "create the main app component"
Result: AI creates crm-app/src/App.tsx automatically
```

## 🔧 Troubleshooting

### Problem: Isolation Not Activating
**Check:** Did you click the "Active" button?
**Look for:** The log message `🔒 WORKSPACE ISOLATION ACTIVE`

### Problem: Valid Operations Being Rejected
**Check:** Are you using the correct path prefix?
**Example:** Use `crm-app/src/...` not just `src/...`

### Problem: AI Still Editing TaskFlow Files
**Check:** Is the repo app properly detected?
**Solution:** Refresh browser and click "Active" again

## 📚 More Information

- **Full Documentation:** `docs/WORKSPACE_ISOLATION.md`
- **Implementation Details:** `docs/WORKSPACE_ISOLATION_SUMMARY.md`
- **Active App Feature:** `docs/ACTIVE_APP_FEATURE.md`

## 🎉 Benefits

1. **🛡️ Safety**: TaskFlow core is protected from accidental edits
2. **🎯 Precision**: AI works in the correct app directory
3. **📝 Clarity**: Clear error messages when something goes wrong
4. **🔍 Transparency**: All operations are logged
5. **⚡ Speed**: No performance impact

## 🚦 Status Indicators

| Indicator | Meaning |
|-----------|---------|
| 🔒 | Workspace isolation is active |
| ✅ | Operation allowed and succeeded |
| ❌ | Operation rejected (violation) |
| 🚫 | Workspace violation detected |

## 🆘 Emergency Recovery

If TaskFlow files get damaged (shouldn't happen now!):

```bash
# Restore a specific file
git checkout HEAD -- src/components/Dashboard.tsx

# Restore all src files
git checkout HEAD -- src/
```

---

**Ready to use!** Just click "Active" on a repo app and start working safely! 🚀
