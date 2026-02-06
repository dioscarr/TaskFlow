# Workspace Isolation System

## Overview

The Workspace Isolation System prevents AI agents from accidentally editing TaskFlow's core files when working on a repo app. This is a **critical security feature** that enforces strict boundaries between the main TaskFlow codebase and individual repo apps.

## The Problem It Solves

**Before:** When you set a repo app as "Active" and asked the AI to work on it, the AI could still edit TaskFlow's core files (like `src/components/Dashboard.tsx`), causing catastrophic failures.

**After:** The AI is now **technically prevented** from editing any files outside the active repo app's directory.

## How It Works

### 1. Detection Phase

When an agent job starts, the system checks if any attached files are repo apps:

```typescript
// Check for virtual repo app folders (id starts with 'repo-app-')
if (file.id.startsWith('repo-app-')) {
    activeRepoApp = file.id.replace('repo-app-', '');
    console.log(`🔒 WORKSPACE ISOLATION ACTIVE: Restricting to repo app "${activeRepoApp}"`);
}
```

### 2. System Instruction Enhancement

If a repo app is detected, the AI receives an **enhanced system prompt** with explicit workspace restrictions:

```
🔒 CRITICAL WORKSPACE RESTRICTION 🔒
You are currently working on the REPO APP: "crm-app"

ABSOLUTE RULES:
1. ALL file operations MUST use paths starting with "crm-app/" or "apps/crm-app/"
2. You are FORBIDDEN from editing ANY files in:
   - src/ (TaskFlow core)
   - components/ (TaskFlow core)
   - app/ (TaskFlow core)
   - lib/ (TaskFlow core)

CORRECT file path examples:
✅ crm-app/src/App.tsx
✅ crm-app/src/components/Button.tsx
✅ crm-app/package.json

FORBIDDEN file path examples:
❌ src/components/Dashboard.tsx (TaskFlow core)
❌ components/AIChat.tsx (TaskFlow core)
❌ Dashboard.tsx (no path prefix)
```

### 3. Technical Validation

Before **every file operation**, the system validates the file path:

```typescript
const validateWorkspace = (toolName: string, args: any) => {
    if (!activeRepoApp) return { valid: true };

    // Extract file path from arguments
    let filePath = args.fileId || args.path || args.filename || args.file;

    // Check if path is within the allowed repo app
    const allowedPrefixes = [
        `${activeRepoApp}/`,
        `apps/${activeRepoApp}/`,
    ];

    const isAllowed = allowedPrefixes.some(prefix => 
        normalizedPath.startsWith(prefix.toLowerCase())
    );

    if (!isAllowed) {
        return {
            valid: false,
            error: `🚫 WORKSPACE VIOLATION: Cannot edit "${filePath}". Active repo app is "${activeRepoApp}".`
        };
    }

    return { valid: true };
};
```

### 4. Operation Rejection

If a file operation violates the workspace restriction, it is **immediately rejected**:

```typescript
const validation = validateWorkspace(name, args);
if (!validation.valid) {
    console.error(`❌ ${validation.error}`);
    await logger(validation.error!, 'error');
    return { success: false, error: validation.error };
}
```

## Protected File Operations

The following operations are validated:

- ✅ `create_file`
- ✅ `edit_file`
- ✅ `replace_in_file`
- ✅ `view_file`
- ✅ `delete_file`
- ✅ `move_file`
- ✅ `copy_file`
- ✅ `write_file`
- ✅ `createMarkdownFile`

## Allowed Path Formats

When working on a repo app (e.g., `crm-app`), these paths are **allowed**:

```
✅ crm-app/src/App.tsx
✅ crm-app/src/components/Button.tsx
✅ crm-app/package.json
✅ crm-app/README.md
✅ apps/crm-app/src/index.tsx
✅ ./crm-app/src/utils.ts
✅ ./apps/crm-app/public/logo.png
```

These paths are **forbidden**:

```
❌ src/components/Dashboard.tsx (TaskFlow core)
❌ components/AIChat.tsx (TaskFlow core)
❌ app/actions.ts (TaskFlow core)
❌ lib/utils.ts (TaskFlow core)
❌ Dashboard.tsx (no path prefix)
❌ App.tsx (no path prefix)
```

## Example Scenario

### User Action
1. User clicks "Active" on the `crm-app` in Repo Apps
2. User asks: "create the main dashboard component"

### System Response

**Without Isolation (OLD - DANGEROUS):**
```
AI creates: src/components/Dashboard.tsx ❌
Result: TaskFlow's Dashboard is destroyed!
```

**With Isolation (NEW - SAFE):**
```
AI attempts: src/components/Dashboard.tsx
System: 🚫 WORKSPACE VIOLATION: Cannot edit "src/components/Dashboard.tsx". 
        Active repo app is "crm-app". All file operations must be within "crm-app/"
AI corrects: crm-app/src/components/Dashboard.tsx ✅
Result: File created in the correct location!
```

## Logging

When workspace isolation is active, you'll see these logs:

```
🔒 WORKSPACE ISOLATION ACTIVE: Restricting to repo app "crm-app"
❌ 🚫 WORKSPACE VIOLATION: Cannot edit "src/components/Dashboard.tsx". Active repo app is "crm-app".
```

## Benefits

1. **🛡️ Protection**: TaskFlow core files are protected from accidental edits
2. **🎯 Precision**: AI operations are scoped to the correct app
3. **📝 Clear Errors**: Developers get clear error messages when violations occur
4. **🔍 Transparency**: All violations are logged for debugging
5. **⚡ Performance**: Validation is fast and doesn't impact performance

## Technical Implementation

**File:** `src/app/actions.ts`
**Function:** `processAgentJob()`
**Lines:** ~3588-3760

### Key Components:

1. **Detection Logic** (~line 3588): Detects active repo app from attached files
2. **Validation Function** (~line 3634): Validates file paths against allowed prefixes
3. **Executor Wrapper** (~line 3690): Wraps skill executor with validation
4. **System Instruction** (~line 3720): Enhances AI prompt with restrictions

## Future Enhancements

Potential improvements:

1. **Whitelist Mode**: Allow specific TaskFlow files to be edited (e.g., `package.json`)
2. **Multi-App Support**: Allow working on multiple repo apps simultaneously
3. **Path Rewriting**: Automatically rewrite incorrect paths to correct ones
4. **Visual Indicators**: Show workspace restriction status in the UI
5. **Audit Log**: Track all workspace violations for security auditing

## Testing

To test the workspace isolation:

1. Click "Active" on a repo app (e.g., `crm-app`)
2. Ask the AI to create a file without the app prefix (e.g., "create src/App.tsx")
3. Verify the operation is rejected with a clear error message
4. Ask the AI to create a file with the correct prefix (e.g., "create crm-app/src/App.tsx")
5. Verify the operation succeeds

## Troubleshooting

**Problem:** AI still editing TaskFlow files
**Solution:** Check that the repo app is properly detected. Look for the log message:
```
🔒 WORKSPACE ISOLATION ACTIVE: Restricting to repo app "your-app"
```

**Problem:** Valid operations being rejected
**Solution:** Ensure file paths start with the app name (e.g., `crm-app/src/...`)

**Problem:** Workspace isolation not activating
**Solution:** Verify the attached file has `id` starting with `repo-app-` or `storagePath` matching the app name
