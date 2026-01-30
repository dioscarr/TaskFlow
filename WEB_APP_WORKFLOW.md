# Automatic Web App Creation Workflow

## Overview
A new automated workflow has been added to streamline website and web application creation. When triggered, it automatically:
1. Creates a dedicated folder for the project
2. Creates an `index.html` file inside that folder
3. Sets up the proper file structure for web development

## How to Trigger

Simply say any of these phrases in the chat:
- "create a website"
- "build a website"
- "make a website"
- "create a web app"
- "build a web app"
- "create a landing page"
- "build a landing page"
- "create an app"
- "build an app"

## What Happens Automatically

### Step 1: Folder Creation
- **Action**: `create_folder`
- **Behavior**: Creates a uniquely named folder (e.g., "WebApp_2026-01-28")
- **Conflict Handling**: If a folder with the same name exists, creates a unique variant
- **Parameters**:
  - `autoName: true` - Automatically generates a descriptive name
  - `prefix: 'WebApp'` - Uses "WebApp" as the folder name prefix
  - `onExistingFolder: 'create_unique'` - Ensures no conflicts

### Step 2: HTML File Creation
- **Action**: `create_html_file`
- **Behavior**: Creates `index.html` inside the newly created folder
- **Parameters**:
  - `filename: 'index.html'` - Standard entry point name
  - `useLastFolder: true` - Uses the folder from Step 1

## Benefits

### Before (Manual Process):
1. User: "Create a website"
2. Agent: "What should I name the folder?"
3. User: "MyWebsite"
4. Agent creates folder
5. User: "Now create index.html in that folder"
6. Agent creates file

### After (Automated Workflow):
1. User: "Create a website"
2. Agent automatically:
   - Creates folder "WebApp_2026-01-28"
   - Creates "WebApp_2026-01-28/index.html"
   - Opens preview
3. Done! ✅

## Technical Implementation

### File Structure
```
intentLibrary.ts
├── DEFAULT_WORKFLOWS[]
│   └── create_web_app
│       ├── triggerKeywords[]
│       └── steps[]
│           ├── create_folder
│           └── create_html_file
```

### Workflow Definition
```typescript
{
    id: 'create_web_app',
    name: 'Create Web App',
    triggerKeywords: [
        'create a website',
        'build a website',
        // ... more triggers
    ],
    steps: [
        {
            id: 'step-1-create-folder',
            action: 'create_folder',
            params: {
                autoName: true,
                prefix: 'WebApp',
                onExistingFolder: 'create_unique'
            }
        },
        {
            id: 'step-2-create-html',
            action: 'create_html_file',
            params: {
                filename: 'index.html',
                useLastFolder: true
            }
        }
    ]
}
```

### Execution Flow
1. **Keyword Matching**: User query is matched against `triggerKeywords`
2. **Workflow Execution**: `executeWorkflow()` processes each step sequentially
3. **Context Passing**: Folder ID from Step 1 is passed to Step 2 via `context.folderId`
4. **File Creation**: HTML file is created with `parentId` set to the new folder

## Extending the Workflow

### Add More Files
You can extend the workflow to create additional files:

```typescript
{
    id: 'step-3-create-css',
    action: 'create_html_file',
    params: {
        filename: 'styles.css',
        useLastFolder: true,
        content: '/* Your styles here */'
    }
}
```

### Add More Triggers
Add custom trigger keywords:

```typescript
triggerKeywords: [
    'create a website',
    'new project',
    'start a site',
    // Add your custom triggers
]
```

## Future Enhancements

### Planned Features:
1. **Template Selection**: Choose from pre-built templates (landing page, dashboard, portfolio)
2. **Framework Support**: Auto-setup for React, Vue, or Next.js projects
3. **Asset Generation**: Automatically generate placeholder images and icons
4. **Multi-Page Setup**: Create multiple HTML pages with navigation
5. **CSS Framework Integration**: Auto-include Tailwind, Bootstrap, or custom CSS

### Example: Multi-Page Workflow
```typescript
{
    id: 'create_multi_page_site',
    name: 'Create Multi-Page Website',
    triggerKeywords: ['create a multi-page site'],
    steps: [
        { action: 'create_folder', params: { ... } },
        { action: 'create_html_file', params: { filename: 'index.html', ... } },
        { action: 'create_html_file', params: { filename: 'about.html', ... } },
        { action: 'create_html_file', params: { filename: 'contact.html', ... } },
        { action: 'create_html_file', params: { filename: 'styles.css', ... } }
    ]
}
```

## Testing

### Test the Workflow:
1. Open the AI chat
2. Type: "create a website for my portfolio"
3. Observe:
   - Folder created automatically
   - index.html created inside folder
   - Preview opens automatically
4. Verify file structure in workspace

### Expected Output:
```
✅ Workflow Create Web App executed successfully.
• Created folder: WebApp_2026-01-28
• Created file: index.html
```

## Files Modified
- `src/lib/intentLibrary.ts` - Added DEFAULT_WORKFLOWS
- `src/app/actions.ts` - Enhanced workflow execution
  - Added `useLastFolder` parameter handling
  - Merged DEFAULT_WORKFLOWS with agent workflows
  - Added HTML file context tracking

## Related Documentation
- `AGENT_STATUS_ENHANCEMENT.md` - Status display improvements
- `src/lib/intentLibrary.ts` - Workflow definitions
- `src/app/actions.ts` - Workflow execution logic
