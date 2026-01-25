# "Show as Table" Suggested Action Button

## Overview
Added a smart "Show as Table" button that appears in AI responses when the AI mentions needing information or has just verified a business, allowing users to instantly request a formatted markdown table with one click.

## Feature Description

### When It Appears
The "Show as Table" button shows up when:
1. AI response contains words like "need", "information", or "proceed"
2. AI just executed the `verify_dgii_rnc` tool (business verification)
3. The response doesn't already contain a markdown table

### What It Does
**One-click action** that pre-fills the input with:
> "Display the extracted receipt data in a markdown table, including all fields (Date, Provider, RNC, NCF, Total Amount, ITBIS) and the business verification information from DGII."

## User Workflow

### Before (Manual):
1. AI: "To proceed, I need some additional information..."
2. User types: "Show me the data in a table"
3. AI generates table

### After (One-Click):
1. AI: "To proceed, I need some additional information..."
2. **Purple "Show as Table" button appears** ✨
3. User clicks button
4. AI immediately generates table with business info

## Visual Design

### Button Styling
```tsx
className="flex items-center gap-2 px-4 py-2 
  bg-purple-500/20 hover:bg-purple-500/30 
  rounded-xl text-xs text-purple-200 hover:text-purple-100 
  transition-all border border-purple-500/30 
  shadow-lg shadow-purple-500/10"
```

**Features:**
- 📊 Receipt icon (purple)
- Purple color scheme (matches "Extract Receipt" tool chip)
- Glow effect on hover
- Smooth transitions

## Complete Button System

Now there are **two suggested action buttons** that appear contextually:

### 1. "Show as Table" (Purple)
- **When**: AI mentions needing info OR just verified business
- **Condition**: No table in response yet
- **Action**: Request formatted table with business verification
- **Icon**: Receipt

### 2. "Generate Markdown File" (White/Blue)
- **When**: Response contains a markdown table
- **Condition**: Table exists in message
- **Action**: Export table to markdown file
- **Icon**: FileText

## Example Workflow

### Step 1: Attach Receipt
User attaches `receipt.jpg`

### Step 2: Click "Extract Receipt" Chip
Input pre-fills: "Extract this receipt to Alegra"

### Step 3: AI Verifies Business
```
✅ Action Executed: verify dgii rnc

Business Verification:
- Name: CARNICERIA Y EMBUTIDOS BRAVO (CENTRAL)
- Status: ACTIVO
- Type: REGIMEN GENERAL
```

**Purple "Show as Table" button appears** ⬅️ NEW!

### Step 4: Click "Show as Table"
Input auto-fills with the request for a formatted table

### Step 5: AI Displays Table
```markdown
| Field | Value |
|-------|-------|
| Date | 2024-01-10 |
| Provider | CARNICERIA Y EMBUTIDOS BRAVO (CENTRAL) |
| RNC | 131000225563 |
| NCF | E310002255623 |
| Total Amount | RD$ 231.59 |
| ITBIS | RD$ 31.59 |

**Business Verification:**
- Name: CARNICERIA Y EMBUTIDOS BRAVO (CENTRAL) (verified with DGII)
- Status: ACTIVO
```

**White "Generate Markdown File" button appears** ⬅️ Existing feature

### Step 6: (Optional) Export to File
Click "Generate Markdown File" to save the table

## Technical Implementation

### Detection Logic
```typescript
{(msg.content.toLowerCase().includes('need') || 
  msg.content.toLowerCase().includes('information') ||
  msg.content.toLowerCase().includes('proceed') ||
  msg.toolUsed === 'verify_dgii_rnc') && 
  !hasMarkdownTable(msg.content) && (
    // Show "Show as Table" button
)}
```

### Click Handler
```typescript
onClick={() => {
    setInput("Display the extracted receipt data in a markdown table, including all fields (Date, Provider, RNC, NCF, Total Amount, ITBIS) and the business verification information from DGII.");
    setActiveTool('extract');
}}
```

### Pre-filled Prompt
The button sets a comprehensive prompt that:
- Requests markdown table format
- Specifies all required fields
- Includes business verification data from DGII
- Ensures complete information display

## Benefits

✅ **Zero typing** - One click instead of typing a request  
✅ **Smart detection** - Appears exactly when needed  
✅ **Consistent format** - Always requests the same comprehensive table  
✅ **Visual guidance** - Users know what action to take next  
✅ **Faster workflow** - Reduces back-and-forth with AI  
✅ **Professional output** - Ensures complete data display  

## Button Hierarchy

The AI chat now has a complete button system:

### Tool Shortcut Chips (Top of Input)
1. 🔍 Verify Business (Blue)
2. 📄 Extract Receipt (Purple)
3. 💰 Record Payment (Green)
4. 💾 Save Report (Amber)

### Suggested Action Buttons (In AI Responses)
1. 📊 Show as Table (Purple) - NEW!
2. 📝 Generate Markdown File (White/Blue) - Existing

## Files Modified

### `src/components/AIChat.tsx`
- Added "Show as Table" button with detection logic
- Moved "Generate Markdown File" button into same container
- Created flex-wrap container for multiple action buttons
- Added comprehensive pre-fill prompt for table request

## Future Enhancements

Possible additions:
1. **"Compare Receipts"** button - When multiple receipts are attached
2. **"Show Line Items"** button - Display itemized breakdown
3. **"Calculate Total"** button - Sum amounts across receipts
4. **"Export to Excel"** button - Convert to spreadsheet
5. **"Send to Email"** button - Email the analysis
