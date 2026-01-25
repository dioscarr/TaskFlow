# Tool Shortcut Chips Feature

## Overview
Added quick-access tool shortcut buttons to the AI chat interface, allowing users to trigger specific workflows with a single click.

## Features Implemented

### 🎯 **Tool Chips**
Four shortcut buttons above the chat input:

1. **🔍 Verify Business** (Blue)
   - Pre-fills: "Verify this business with DGII"
   - Triggers: `verify_dgii_rnc` tool
   - Use case: Quick RNC verification

2. **📄 Extract Receipt** (Purple)
   - Pre-fills: "Extract this receipt to Alegra"
   - Triggers: `extract_alegra_bill` tool
   - Use case: Process receipt images

3. **💰 Record Payment** (Green)
   - Pre-fills: "Record a payment for this bill"
   - Triggers: `record_alegra_payment` tool
   - Use case: Mark bills as paid

4. **💾 Save Report** (Amber)
   - Pre-fills: "Save this as a markdown report"
   - Triggers: `create_markdown_file` tool
   - Use case: Export data to files

### 🎨 **Visual Design**
- **Inactive state**: Subtle white/5 background with white/60 text
- **Active state**: Colored background (blue/purple/green/amber) with glow effect
- **Hover state**: Brightens to white/10 background
- **Icons**: Lucide React icons for visual clarity
- **Responsive**: Wraps on smaller screens

### ⚡ **Interaction**
- **Click to activate**: Sets the tool as active and pre-fills the input
- **Click again to deactivate**: Clears the input and removes active state
- **Auto-clear**: Active state clears when message is sent
- **Toggle behavior**: Only one tool can be active at a time

## User Workflow

### Before (Manual Typing):
1. User types: "Extract this receipt to Alegra"
2. Attaches image
3. Sends message

### After (One-Click):
1. User clicks **Extract Receipt** chip
2. Input auto-fills with the command
3. Attaches image
4. Sends message (or edits the pre-filled text)

## Technical Implementation

### State Management
```typescript
const [activeTool, setActiveTool] = useState<string | null>(null);
```

### Tool Definitions
Each chip has:
- Unique ID ('verify', 'extract', 'payment', 'save')
- Icon component
- Pre-filled prompt text
- Color scheme

### Click Handler
```typescript
onClick={() => {
    setActiveTool(activeTool === 'verify' ? null : 'verify');
    setInput(activeTool === 'verify' ? '' : 'Verify this business with DGII');
}}
```

### Auto-Clear on Send
```typescript
setActiveTool(null); // Added to handleSend function
```

## Benefits

✅ **Faster workflow** - One click vs typing  
✅ **Discoverability** - Users see available tools  
✅ **Consistency** - Standardized prompts  
✅ **Visual feedback** - Clear active state  
✅ **Reduced errors** - Pre-validated prompts  
✅ **Better UX** - Intuitive, modern interface  

## Future Enhancements

### Possible Additions:
1. **Context-aware chips** - Show/hide based on attached files
2. **Keyboard shortcuts** - Ctrl+1, Ctrl+2, etc.
3. **Custom chips** - User-defined shortcuts
4. **Chip tooltips** - Hover to see what each tool does
5. **Recent tools** - Show most-used tools first
6. **Tool history** - Track which tools are used most

## Files Modified

- `src/components/AIChat.tsx`
  - Added icons: Search, Receipt, DollarSign, Save
  - Added state: activeTool
  - Added UI: Tool chips section
  - Updated: handleSend to clear activeTool

## Usage Examples

### Example 1: Quick Business Verification
1. Click **Verify Business**
2. Attach receipt image
3. Send → AI extracts RNC and verifies with DGII

### Example 2: Receipt Processing
1. Attach receipt image
2. Click **Extract Receipt**
3. Send → AI extracts all data and saves to Alegra

### Example 3: Payment Recording
1. Click **Record Payment**
2. AI asks for bill ID and amount
3. Provide details → Payment recorded

### Example 4: Save Analysis
1. Have a conversation with AI about receipts
2. Click **Save Report**
3. AI creates markdown file with the analysis
