# Web App Workflow - Quick Reference

## ⚡ Quick Start

### To Create a Website:
Just say: **"create a website"**

That's it! The system will automatically:
1. ✅ Create a folder (e.g., "WebApp_2026-01-28")
2. ✅ Create index.html inside it
3. ✅ Open the preview

---

## 🎯 Trigger Phrases

Any of these will work:
- "create a website"
- "build a website"
- "make a website"
- "create a web app"
- "build a web app"
- "create a landing page"
- "build a landing page"
- "create an app"
- "build an app"

---

## 📁 What Gets Created

```
Workspace/
└── WebApp_2026-01-28/          ← Auto-generated folder
    └── index.html              ← Your HTML file
```

---

## 🔧 Customization Examples

### Add More Files to the Workflow

Edit `src/lib/intentLibrary.ts`:

```typescript
{
    id: 'step-3-create-css',
    action: 'create_html_file',
    params: {
        filename: 'styles.css',
        useLastFolder: true,
        content: `
            /* Your CSS here */
            body {
                font-family: system-ui;
                margin: 0;
                padding: 20px;
            }
        `
    }
}
```

### Add More Trigger Keywords

```typescript
triggerKeywords: [
    'create a website',
    'new site',           // ← Add this
    'start a project',    // ← Add this
    // ... existing keywords
]
```

### Change Folder Prefix

```typescript
{
    action: 'create_folder',
    params: {
        autoName: true,
        prefix: 'MySite',  // ← Change from 'WebApp'
        onExistingFolder: 'create_unique'
    }
}
```

---

## 🐛 Troubleshooting

### Workflow Not Triggering?

**Check 1**: Are you using a trigger keyword?
```
❌ "make me a site"
✅ "create a website"
```

**Check 2**: Is the workflow loaded?
```bash
node test_web_app_workflow.js
```

**Check 3**: Check agent activity
- Open Intelligence Command Center
- Look for "Workflow Create Web App executed"

### Files Not in Folder?

**Check**: Is `useLastFolder: true` set?
```typescript
{
    action: 'create_html_file',
    params: {
        filename: 'index.html',
        useLastFolder: true  // ← Must be true
    }
}
```

### Folder Name Conflicts?

**Solution**: The workflow uses `create_unique` strategy
- If "WebApp_2026-01-28" exists
- Creates "WebApp_2026-01-28_1"
- Then "WebApp_2026-01-28_2", etc.

---

## 📊 Workflow Status

### Check if Workflow is Running

Look for these indicators:
1. **Header**: "Background Agent Active: Executed: create_folder"
2. **Input**: "Background agent working..."
3. **Activity Feed**: Real-time updates

### Expected Timeline

```
0s  - User sends message
1s  - Workflow matched
2s  - Folder created
3s  - HTML file created
4s  - Preview opens
```

---

## 🎨 Advanced Examples

### Multi-Page Website

```typescript
{
    id: 'create_multi_page_site',
    name: 'Create Multi-Page Site',
    triggerKeywords: ['create a multi-page website'],
    steps: [
        { action: 'create_folder', params: { ... } },
        { action: 'create_html_file', params: { filename: 'index.html', ... } },
        { action: 'create_html_file', params: { filename: 'about.html', ... } },
        { action: 'create_html_file', params: { filename: 'contact.html', ... } }
    ]
}
```

### With Styling

```typescript
{
    id: 'create_styled_site',
    name: 'Create Styled Website',
    triggerKeywords: ['create a styled website'],
    steps: [
        { action: 'create_folder', params: { prefix: 'StyledSite' } },
        { 
            action: 'create_html_file', 
            params: { 
                filename: 'index.html',
                useLastFolder: true,
                content: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <link rel="stylesheet" href="styles.css">
                    </head>
                    <body>
                        <h1>Welcome</h1>
                    </body>
                    </html>
                `
            } 
        },
        { 
            action: 'create_html_file', 
            params: { 
                filename: 'styles.css',
                useLastFolder: true,
                content: `
                    body {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        font-family: 'Inter', sans-serif;
                    }
                `
            } 
        }
    ]
}
```

---

## 📚 Related Files

- `WEB_APP_WORKFLOW.md` - Full documentation
- `WEB_APP_IMPLEMENTATION_SUMMARY.md` - Technical details
- `WEB_APP_WORKFLOW_DIAGRAMS.md` - Visual diagrams
- `src/lib/intentLibrary.ts` - Workflow definitions
- `src/app/actions.ts` - Execution logic

---

## 🚀 Next Steps

1. **Test it**: Type "create a website" in the chat
2. **Customize it**: Add your own trigger keywords
3. **Extend it**: Add CSS, JS, or more HTML files
4. **Share it**: Create workflows for your team

---

## 💡 Pro Tips

1. **Use Descriptive Triggers**: "create a portfolio site" is better than just "create site"
2. **Chain Workflows**: One workflow can trigger another
3. **Context Matters**: Files created in a workflow share the same folder
4. **Preview Auto-Opens**: No need to manually open files
5. **Unique Names**: Folders get timestamps to avoid conflicts

---

## ✅ Success Checklist

- [ ] Workflow triggers on keyword
- [ ] Folder is created with unique name
- [ ] HTML file is inside the folder
- [ ] Preview opens automatically
- [ ] Status updates show in header
- [ ] Activity logged in Command Center

---

**Need Help?** Check the full documentation in `WEB_APP_WORKFLOW.md`
