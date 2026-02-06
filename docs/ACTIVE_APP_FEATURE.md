# Active App Feature

## Overview

The "Active" button in the Repo Apps view allows you to set a specific app folder as the active context for the AI chat. When you click "Active" on an app, the AI will be aware of that folder and keep all file operations within it.

## How It Works

### 1. User Clicks "Active" Button
In the FileManager component (`src/components/FileManager.tsx`), when you click the "Active" button on a repo app:

```typescript
onClick={(e) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('set-active-app', { 
        detail: { name: entry.name, path: entry.path } 
    }));
    toast.success(`Active app set to ${entry.name}`);
}}
```

This dispatches a custom browser event called `set-active-app` with the app's name and path.

### 2. AIChat Listens for the Event
The AIChat component (`src/components/AIChat.tsx`) has an event listener that catches this event:

```typescript
useEffect(() => {
    const handleSetActiveApp = async (event: CustomEvent) => {
        const { name, path } = event.detail;
        
        // Find the folder in workspace files
        const appFolder = workspaceFiles.find(f => 
            f.type === 'folder' && 
            (f.name === name || f.storagePath === path)
        );
        
        if (appFolder) {
            // Add folder to attached files
            setAttachedFiles(prev => [...prev, {
                id: appFolder.id,
                name: appFolder.name,
                type: 'folder',
                parentId: appFolder.parentId
            }]);
            
            // Add system message to input
            setInput(prev => {
                const systemMsg = `[SYSTEM: Active app selected: "${name}" at path "${path}". Keep edits and file operations within this app unless user explicitly says otherwise.]\n\n`;
                return systemMsg + prev;
            });
        }
    };
    
    window.addEventListener('set-active-app', handleSetActiveApp as EventListener);
    
    return () => {
        window.removeEventListener('set-active-app', handleSetActiveApp as EventListener);
    };
}, [workspaceFiles]);
```

### 3. What Happens

When you click "Active":

1. ✅ **Folder is attached to chat** - The app folder appears in the "Attached Files" section
2. ✅ **System message is added** - A system instruction is prepended to your input telling the AI to work within that app
3. ✅ **Toast notification** - You get visual feedback confirming the action
4. ✅ **AI is aware** - The AI receives context about which app to work in

### 4. Example Flow

1. User clicks "Active" on the `call` app
2. Toast shows: "Active app set to call"
3. The `call` folder is added to attached files
4. Input field gets prepended with:
   ```
   [SYSTEM: Active app selected: "call" at path "call". Keep edits and file operations within this app unless user explicitly says otherwise.]
   
   ```
5. User types: "create the UIs for this app"
6. AI receives the full context and knows to create files inside the `call` folder

## Benefits

- **Scoped Work**: AI knows exactly where to create/edit files
- **No Ambiguity**: Clear instructions prevent files from being created in wrong locations
- **Visual Feedback**: Attached folder badge shows the active context
- **Easy Switching**: Click "Active" on a different app to switch context

## Usage Tips

- Click "Active" before asking the AI to work on a specific app
- The folder will stay attached until you manually remove it
- You can have multiple folders attached, but the last "Active" one gets the system message
- The system message is visible in the input field - you can edit or remove it if needed
