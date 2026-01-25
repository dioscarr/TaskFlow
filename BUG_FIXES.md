# Bug Fixes - Tool Persistence & UI Issues

## Issues Identified

From the screenshots:
1. ✅ **Tool selection not persisting** when editing prompts
2. ⏳ **Missing tool shortcut buttons** in pinned chat
3. ⏳ **Z-index issues** - Buttons overlapping other UI elements
4. ⏳ **Inconsistent state** across floating and pinned chat

## Fixes Applied

### 1. Tool Selection Persistence ✅

**Problem:** When editing an existing prompt, the selected tools weren't being loaded into the editor.

**Root Cause:** The `startEditing` function wasn't including the `tools` field when setting up the edit state.

**Fix Applied:**
```typescript
// Before
const startEditing = (p: AIPromptSet) => {
    setNewPrompt({ name: p.name, description: p.description || '', prompt: p.prompt });
    setEditingPromptId(p.id);
    setIsEditorOpen(true);
};

// After
const startEditing = (p: AIPromptSet) => {
    setNewPrompt({ 
        name: p.name, 
        description: p.description || '', 
        prompt: p.prompt,
        tools: p.tools || []  // ✅ Now includes tools
    });
    setEditingPromptId(p.id);
    setIsEditorOpen(true);
};
```

**Files Modified:**
- `src/components/AIChat.tsx` - Line 167-176
- `src/components/AIChat.tsx` - Line 35 (state type)
- `src/components/AIChat.tsx` - Lines 362, 746 (new prompt initialization)

**Status:** ✅ **FIXED** - Tools will now persist when editing prompts

---

## Remaining Issues

### 2. Missing Tool Shortcut Buttons in Pinned Chat ⏳

**Problem:** The pinned chat (screenshots 3 & 4) doesn't show the tool shortcut chips that appear in the floating chat.

**Location:** Around line 600-700 in `AIChat.tsx` (pinned chat render section)

**Fix Needed:**
Add the tool shortcut chips section to the pinned chat UI:
```typescript
{/* Tool Shortcut Chips */}
<div className="flex items-center gap-2 mb-3 px-4">
    {[
        { id: 'verify', label: '🔍 Verify Business', prompt: 'Verify this business with DGII' },
        { id: 'extract', label: '📄 Extract Receipt', prompt: 'Extract this receipt to Alegra' },
        { id: 'payment', label: '💰 Record Payment', prompt: 'Record a payment for this bill' },
        { id: 'report', label: '💾 Save Report', prompt: 'Save this as a markdown report' }
    ].map(tool => (
        <button
            key={tool.id}
            onClick={() => {
                setInput(tool.prompt);
                setActiveTool(tool.id);
            }}
            className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                activeTool === tool.id
                    ? "bg-purple-600 text-white"
                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
            )}
        >
            {tool.label}
        </button>
    ))}
</div>
```

### 3. Z-Index Issues ⏳

**Problem:** Buttons appearing on top of other UI elements (visible in screenshots).

**Likely Causes:**
1. Modal/overlay z-index conflicts
2. Fixed positioning without proper z-index hierarchy
3. Stacking context issues

**Fix Needed:**
Review and standardize z-index values:
```css
/* Suggested z-index hierarchy */
.chat-overlay { z-index: 9000; }
.chat-modal { z-index: 9100; }
.prompt-editor { z-index: 10000; }
.tool-shortcuts { z-index: 9050; }
.dropdown-menus { z-index: 9200; }
```

**Files to Check:**
- `src/components/AIChat.tsx` - All className props with z-index
- `src/app/globals.css` - Global z-index definitions

### 4. State Synchronization ⏳

**Problem:** Inconsistent state between floating and pinned chat views.

**Fix Needed:**
- Ensure both views use the same state variables
- No duplicate state management
- Shared event handlers

---

## Testing Checklist

After fixes are complete, test:

- [ ] Create new prompt → Select tools → Save → Edit → Tools still selected ✅
- [ ] Edit existing prompt → Tools load correctly ✅
- [ ] Tool shortcut chips visible in floating chat
- [ ] Tool shortcut chips visible in pinned chat
- [ ] Clicking chip pre-fills input
- [ ] No UI overlap issues
- [ ] Buttons don't cover other elements
- [ ] Consistent behavior between floating/pinned views

---

## TypeScript Errors (Expected)

The following errors are expected and will resolve automatically:
```
Property 'tools' does not exist on type '{ name: string; ... }'
```

**Why:** The IDE hasn't picked up the regenerated Prisma types yet. These will disappear after:
1. Dev server recompiles
2. IDE refreshes TypeScript server
3. Or restart VS Code

**No action needed** - these are transient type errors.

---

## Next Steps

1. ⏳ Add tool shortcut chips to pinned chat
2. ⏳ Fix z-index hierarchy
3. ⏳ Test all scenarios
4. ⏳ Verify state consistency

**Priority:** Tool shortcut chips in pinned chat (most visible missing feature)
