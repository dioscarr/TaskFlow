# Markdown Table Rendering Debug Guide

## Issue
Markdown tables are not rendering correctly in the AI chat interface.

## Debugging Steps

### 1. Check Browser Console
Open the browser console (F12) and look for:
- 🔍 logs showing the original markdown
- ✅ logs showing the normalized markdown
- Any React or rendering errors

### 2. Test with Simple Table
Ask the AI to create a simple table:
```
Create a markdown table with 2 columns (Name, Age) and 2 rows of sample data
```

Expected markdown output should look like:
```markdown
| Name | Age |
|------|-----|
| John | 25  |
| Jane | 30  |
```

### 3. Common Issues to Check

#### Issue A: Blank Lines in Table
**Problem**: AI adds blank lines between table rows
```markdown
| Name | Age |

| John | 25  |
```

**Solution**: The normalizeMarkdown function should fix this, but check console logs to verify

#### Issue B: Code Blocks Around Tables
**Problem**: AI wraps table in code blocks
```markdown
```
| Name | Age |
|------|-----|
| John | 25  |
```
```

**Solution**: The AI instructions forbid this, but if it happens, we need to strip code blocks

#### Issue C: Inconsistent Separators
**Problem**: Separator row doesn't match column count
```markdown
| Name | Age | City |
|------|-----|
| John | 25  | NYC  |
```

**Solution**: Each separator needs to match the number of columns

#### Issue D: Missing remarkGfm Plugin
**Problem**: ReactMarkdown doesn't recognize table syntax
**Solution**: Verify `remarkGfm` is imported and passed to ReactMarkdown

### 4. Manual Test Cases

Test these markdown strings directly in the console:

```javascript
// Test 1: Simple valid table
const test1 = `| Name | Age |
|------|-----|
| John | 25  |`;

// Test 2: Table with blank lines (should be fixed)
const test2 = `| Name | Age |

|------|-----|

| John | 25  |`;

// Test 3: Table with broken link
const test3 = `| Name | Link |
|------|------|
| John | [Google]
(https://google.com) |`;
```

### 5. Verify CSS
Check that these CSS classes exist and are applied:
- `.markdown-content` - parent container
- `.markdown-content .table-container` - table wrapper
- `.markdown-content table` - table element
- `.markdown-content th` - table headers
- `.markdown-content td` - table cells

### 6. Check ReactMarkdown Components
Verify the custom table component is being used:
```tsx
components={{
    table: ({ node, ...props }) => (
        <div className="table-container" style={{ display: 'block', width: '100%' }}>
            <table {...props} style={{ fontSize: '10px' }} />
        </div>
    )
}}
```

### 7. Inspect DOM
In browser DevTools:
1. Right-click on where the table should appear
2. Select "Inspect Element"
3. Check if:
   - `<table>` element exists
   - Table has proper structure (`<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`)
   - CSS classes are applied
   - Styles are not being overridden

## Expected Console Output

When a table is rendered, you should see:
```
🔍 Original markdown: | Name | Age |
|------|-----|
| John | 25  |
🔍 Has table pipes: true
🔍 Has separator: true
✅ Normalized markdown: | Name | Age |
|------|-----|
| John | 25  |
```

## Next Steps Based on Findings

### If console shows no logs:
- normalizeMarkdown is not being called
- Check that the function is properly defined and imported

### If table appears as plain text:
- remarkGfm plugin is not working
- Check import: `import remarkGfm from 'remark-gfm'`
- Check it's passed to ReactMarkdown: `remarkPlugins={[remarkGfm]}`

### If table renders but looks broken:
- CSS issue
- Check `.markdown-content` class is on parent div
- Verify CSS file is imported in layout/page

### If table doesn't appear at all:
- Check if content is being passed to ReactMarkdown
- Verify no errors in console
- Check if content is being filtered/sanitized somewhere

## Quick Fix Attempts

### Fix 1: Enhanced Normalization
Add more aggressive table fixing:
```typescript
const normalizeMarkdown = (text: string) => {
    let normalized = text;
    
    // Remove blank lines within tables
    normalized = normalized.replace(/(\\|[^\\n]+\\|)\\n\\s*\\n(\\|[^\\n]+\\|)/g, '$1\\n$2');
    
    // Remove code blocks around tables
    normalized = normalized.replace(/```\\n(\\|[^\\n]+\\|[\\s\\S]*?)```/g, '$1');
    
    // Fix broken links
    normalized = normalized.replace(/\\[([^\\]]+)\\]\\s*\\n\\s*\\(([^)]+)\\)/g, '[$1]($2)');
    
    return normalized;
};
```

### Fix 2: Force Table Detection
Update the "Save as Markdown" button condition:
```tsx
{msg.role === 'ai' && (
    msg.content.includes('|') && 
    (msg.content.includes('---') || msg.content.includes('|--'))
) && (
    // button code
)}
```

### Fix 3: Add Table-Specific CSS
Ensure tables are visible:
```css
.markdown-content table {
    display: table !important;
    width: 100% !important;
    border-collapse: collapse !important;
}
```
