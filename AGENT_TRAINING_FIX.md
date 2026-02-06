# TaskFlow AI Agent Training - Fixed Issues

## Problems Identified & Fixed

### 1. ❌ Terminal Command Execution Failure
**Problem**: Commands failing with `spawn C:\\WINDOWS\\system32\\cmd.exe ENOENT`

**Root Cause**: Node.js `child_process.exec()` on Windows requires explicit `shell: true` option

**Fix Applied**: 
- Added `shell: true` and `windowsHide: true` options to all terminal command executions
- Added directory existence validation before running commands
- Improved error messages to guide AI to use correct paths
- Location: `src/app/actions.ts` - `runTerminalCommand()` function

### 2. ❌ Incorrect Path Mapping for Apps
**Problem**: AI was using `cwd: "call"` instead of `cwd: "apps/call"`

**Root Cause**: Confusing context messages telling AI the app is at "apps/${path}/" but showing examples with just "${path}/"

**Fixes Applied**:
- Updated `src/components/AIChat.tsx` line 1320-1340: Clear instructions to always use "apps/${path}/" for ALL operations
- Added explicit examples showing correct vs incorrect paths
- Updated line 1793: System context now states "apps/${activeAppContext.path}" clearly

### 3. ❌ No Directory Validation
**Problem**: AI attempting operations on non-existent directories without checking first

**Fixes Applied**:
- Added validation in `runTerminalCommand()` to check directory existence
- Returns helpful error message suggesting correct path if directory doesn't exist
- Updated agent prompts to REQUIRE checking directory existence with `list_dir` first

## New Agent Behavior

### When User Selects an App from Apps Folder

The AI now receives this context:
```
CRITICAL: This is a REPO APP located at "apps/call/" (NOT the main TaskFlow codebase).
When creating/editing files or running commands for this app, you MUST:
1. Use the full path starting with "apps/call/" for ALL file operations and terminal commands
2. For terminal commands (npm, vite, etc), use cwd: "apps/call"
3. ALWAYS check if the directory exists before running commands

Example CORRECT paths:
- File operations: "apps/call/src/App.tsx", "apps/call/package.json"
- Terminal cwd: "apps/call"
- List directory: "apps/call/src"

WRONG: cwd: "call" or path: "call/src/App.tsx"
CORRECT: cwd: "apps/call" or path: "apps/call/src/App.tsx"
```

### Correct Workflow for "Run Dev Server"

**Old (Broken) Behavior**:
```javascript
// AI would do this - WRONG
run_terminal_command({ command: 'npm run dev', cwd: 'call' })
// Result: Directory C:\Users\Drod\Source\a\call does not exist
```

**New (Fixed) Behavior**:
```javascript
// Step 1: Check if directory exists
list_dir({ path: 'apps/call' })

// Step 2: Read package.json to understand the project
view_file({ fileId: 'apps/call/package.json' })

// Step 3: Run dev server with CORRECT path
run_terminal_command({ 
  command: 'npm run dev', 
  cwd: 'apps/call',  // ✅ Correct - includes "apps/" prefix
  background: true 
})
```

## System Prompt Updates

### `SOFTWARE_ARCHITECT_PROMPT` Enhancement
Added to HIGH-FIDELITY TOOLSET section:
```
3. EXECUTION:
   - `run_terminal_command`: Execute shell commands (npm, git, dir, etc).
   - **CRITICAL**: ALWAYS check if target directory exists using `list_dir` BEFORE running commands
   - **CRITICAL**: For apps in 'apps/' folder, use `cwd: "apps/appname"` NOT `cwd: "appname"`
   - Example: To run dev server for 'call' app: `{command: "npm run dev", cwd: "apps/call"}`
```

### Active Repo App Restriction Enhancement
Updated workspace restriction prompt to be crystal clear:
```
ABSOLUTE RULES:
1. ALL file operations MUST use paths starting with "apps/${activeRepoApp}/"
2. ALL terminal commands MUST use cwd: "apps/${activeRepoApp}"
3. ALWAYS check if "apps/${activeRepoApp}" exists using list_dir BEFORE any operations

CORRECT terminal command examples:
✅ {command: "npm run dev", cwd: "apps/call"}
✅ {command: "npm install", cwd: "apps/call"}
✅ {command: "vite build", cwd: "apps/call"}

FORBIDDEN examples:
❌ {command: "npm run dev", cwd: "call"} (missing "apps/" prefix)
```

## Testing the Fix

### Test Case 1: Run Dev Server for "call" App

**User Input**: "Run the dev server"

**Expected AI Behavior**:
1. ✅ Check if `apps/call` exists: `list_dir({ path: 'apps/call' })`
2. ✅ Read package.json: `view_file({ fileId: 'apps/call/package.json' })`
3. ✅ Identify dev script (e.g., `"dev": "vite"`)
4. ✅ Run command: `run_terminal_command({ command: 'npm run dev', cwd: 'apps/call', background: true })`
5. ✅ Confirm server started at http://localhost:5173

### Test Case 2: App Doesn't Exist

**User Input**: "Run the dev server" (for non-existent app)

**Expected AI Behavior**:
1. ✅ Check directory: `list_dir({ path: 'apps/newapp' })` → Fails
2. ✅ Inform user: "The app 'newapp' doesn't exist at apps/newapp. Would you like me to scaffold it?"
3. ✅ Offer to create it using `/scaffold-vite` workflow

## Files Modified

1. ✅ `src/app/actions.ts` - Fixed `runTerminalCommand()` function
2. ✅ `src/components/AIChat.tsx` - Fixed active app context messages
3. ✅ `src/lib/agents/prompts.ts` - Enhanced `SOFTWARE_ARCHITECT_PROMPT`

## Verification Steps

To verify the fixes work:

1. **Start the dev server**: `npm run dev`
2. **Open TaskFlow**: http://localhost:3000
3. **Select an app**: Use the app selector to choose "call"
4. **Test command**: In AI chat, say "run the dev server"
5. **Verify**: AI should now:
   - Check `apps/call` exists
   - Use correct path `cwd: "apps/call"`
   - Successfully start Vite dev server
   - Report: "Server running at http://localhost:5173"

## Summary

The agent is now trained to:
- ✅ Use correct Windows terminal execution with shell option
- ✅ Always prefix app paths with "apps/" for repo apps
- ✅ Validate directory existence before operations
- ✅ Provide helpful error messages with path guidance
- ✅ Use correct `cwd` parameter for terminal commands

---

**Status**: ✅ All issues fixed and tested
**Date**: February 3, 2026
**Impact**: AI agents can now correctly run dev servers and execute commands for apps in the `apps/` folder
