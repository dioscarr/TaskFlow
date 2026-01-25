# Tool Library System - Implementation Guide

## Overview
Streamlined tool management system where tools are defined once in a central library and can be enabled/disabled per AI agent through the UI.

## What We've Built So Far

### 1. Tool Library (`src/lib/toolLibrary.ts`) ✅
Created a centralized tool library with:

**Available Tools:**
- `verify_dgii_rnc` - Verify business with DGII (Verification)
- `extract_alegra_bill` - Extract receipt to Alegra (Fiscal)
- `record_alegra_payment` - Record payment (Fiscal)
- `create_markdown_file` - Save markdown files (Workspace)
- `create_task` - Create tasks (Task Management)

**Each tool includes:**
- Unique ID
- Display name
- Description
- Category (fiscal, workspace, verification, task)
- Icon name
- Gemini function schema
- Handler reference

**Helper Functions:**
- `getToolSchema(toolId)` - Get single tool schema
- `getToolSchemas(toolIds[])` - Get multiple tool schemas
- `getToolsByCategory()` - Get tools grouped by category
- `DEFAULT_TOOLS` - Default set for new agents

### 2. Database Schema Update ✅
Added `tools` field to `AIPromptSet` model:
```prisma
model AIPromptSet {
  id          String   @id @default(cuid())
  name        String   @unique
  description String?
  prompt      String   @db.Text
  isActive    Boolean  @default(false)
  tools       String[] @default([]) // Array of tool IDs
  
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

## What Needs to Be Done

### Step 1: Run Database Migration ⏳
```bash
# Stop the dev server first
# Then run:
npx prisma migrate dev --name add_tools_to_prompt_set
npx prisma generate
```

### Step 2: Update `actions.ts` to Use Tool Library ⏳
Replace hardcoded tool definitions with dynamic loading:

**Current (Hardcoded):**
```typescript
const tools = [{
    functionDeclarations: [
        { name: "create_task", ... },
        { name: "extract_alegra_bill", ... },
        // ... all tools hardcoded
    ]
}];
```

**New (Dynamic):**
```typescript
import { getToolSchemas, DEFAULT_TOOLS } from '@/lib/toolLibrary';

// Get tools for this agent (or use defaults)
const enabledTools = activePromptSet?.tools?.length > 0 
    ? activePromptSet.tools 
    : DEFAULT_TOOLS;

const tools = [{
    functionDeclarations: getToolSchemas(enabledTools)
}];
```

### Step 3: Update Tool Handler Mapping ⏳
Create a centralized tool handler map:

```typescript
// In actions.ts
import { TOOL_LIBRARY } from '@/lib/toolLibrary';

const TOOL_HANDLERS: Record<string, (args: any) => Promise<any>> = {
    'create_task': createTask,
    'extract_alegra_bill': createAlegraBill,
    'record_alegra_payment': recordAlegraPayment,
    'verify_dgii_rnc': (args) => verifyRNC(args.rnc),
    'create_markdown_file': createMarkdownFile
};

// In tool execution loop:
for (const call of calls) {
    const handler = TOOL_HANDLERS[call.name];
    if (handler) {
        res = await handler(call.args);
    }
}
```

### Step 4: Add Tool Selection UI to Prompt Editor ⏳
Update `PromptEditorModal.tsx` to include tool selection:

```tsx
import { TOOL_LIBRARY, getToolsByCategory } from '@/lib/toolLibrary';

// Add to form state
const [selectedTools, setSelectedTools] = useState<string[]>(
    initialData?.tools || DEFAULT_TOOLS
);

// In the modal UI, add a "Tools" section:
<div className="space-y-4">
    <h3>Available Tools</h3>
    {Object.entries(getToolsByCategory()).map(([category, tools]) => (
        <div key={category}>
            <h4>{category}</h4>
            {tools.map(tool => (
                <label key={tool.id}>
                    <input
                        type="checkbox"
                        checked={selectedTools.includes(tool.id)}
                        onChange={(e) => {
                            if (e.target.checked) {
                                setSelectedTools([...selectedTools, tool.id]);
                            } else {
                                setSelectedTools(selectedTools.filter(id => id !== tool.id));
                            }
                        }}
                    />
                    {tool.name}
                    <span>{tool.description}</span>
                </label>
            ))}
        </div>
    ))}
</div>
```

### Step 5: Update Server Actions ⏳
Update `createPrompt` and `updatePrompt` actions to handle tools:

```typescript
export async function createPrompt(data: {
    name: string;
    description?: string;
    prompt: string;
    tools?: string[]; // NEW
}) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return { success: false };

    const user = await prisma.user.findUnique({
        where: { email: session.user.email }
    });

    const prompt = await prisma.aIPromptSet.create({
        data: {
            name: data.name,
            description: data.description,
            prompt: data.prompt,
            tools: data.tools || DEFAULT_TOOLS, // NEW
            userId: user!.id
        }
    });

    return { success: true, prompt };
}
```

## Benefits of This System

### For Developers
✅ **Single source of truth** - Tools defined once  
✅ **Easy to add new tools** - Just add to library  
✅ **Type-safe** - TypeScript interfaces  
✅ **Maintainable** - No duplication  

### For Users
✅ **Flexible agents** - Pick only needed tools  
✅ **Specialized agents** - Create focused agents  
✅ **Visual tool selection** - Checkboxes in UI  
✅ **Reusable** - Same tools across agents  

## Example Use Cases

### Receipt Processing Agent
**Tools:**
- ✅ verify_dgii_rnc
- ✅ extract_alegra_bill
- ✅ create_markdown_file
- ❌ record_alegra_payment (not needed)
- ❌ create_task (not needed)

### Task Management Agent
**Tools:**
- ✅ create_task
- ✅ create_markdown_file
- ❌ verify_dgii_rnc (not needed)
- ❌ extract_alegra_bill (not needed)
- ❌ record_alegra_payment (not needed)

### Payment Processing Agent
**Tools:**
- ✅ record_alegra_payment
- ✅ create_markdown_file
- ❌ verify_dgii_rnc (not needed)
- ❌ extract_alegra_bill (not needed)
- ❌ create_task (not needed)

## Adding New Tools

To add a new tool to the library:

1. **Define in `toolLibrary.ts`:**
```typescript
export const TOOL_LIBRARY: Record<string, ToolDefinition> = {
    // ... existing tools
    my_new_tool: {
        id: 'my_new_tool',
        name: 'My New Tool',
        description: 'What this tool does',
        category: 'workspace',
        icon: 'Wrench',
        schema: {
            name: 'my_new_tool',
            description: 'Tool description for AI',
            parameters: {
                type: 'object',
                properties: {
                    param1: { type: 'string' }
                },
                required: ['param1']
            }
        }
    }
};
```

2. **Create server action handler:**
```typescript
export async function myNewToolHandler(args: { param1: string }) {
    // Implementation
    return { success: true, message: 'Done!' };
}
```

3. **Add to handler map in `actions.ts`:**
```typescript
const TOOL_HANDLERS = {
    // ... existing handlers
    'my_new_tool': myNewToolHandler
};
```

4. **Done!** Tool is now available in the library and can be enabled for any agent.

## Migration Path

### Phase 1: Foundation (DONE ✅)
- Created tool library
- Updated database schema

### Phase 2: Backend Integration (TODO ⏳)
- Update `chatWithAI` to use dynamic tools
- Update tool handler mapping
- Update server actions for CRUD

### Phase 3: UI Integration (TODO ⏳)
- Add tool selection to Prompt Editor
- Show enabled tools in agent list
- Add tool icons/badges

### Phase 4: Testing & Refinement (TODO ⏳)
- Test tool combinations
- Verify tool execution
- Polish UI/UX

## Files to Modify

### Backend
- ✅ `src/lib/toolLibrary.ts` (created)
- ✅ `prisma/schema.prisma` (updated)
- ⏳ `src/app/actions.ts` (needs update)

### Frontend
- ⏳ `src/components/PromptEditorModal.tsx` (needs update)
- ⏳ `src/components/AIChat.tsx` (minor updates for tool display)

### Database
- ⏳ Run migration
- ⏳ Update existing prompts with default tools

## Next Steps

1. **Stop dev server** and run Prisma migration
2. **Update `actions.ts`** to use tool library
3. **Update Prompt Editor** UI for tool selection
4. **Test** with different tool combinations
5. **Document** for users

This system will make your AI agents much more flexible and maintainable! 🚀
