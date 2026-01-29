
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_INSTRUCTIONS = `
## DATA STORAGE & INTERACTIVITY API 🚀
You have access to a logical backend for building fully interactive prototypes connected to a database.

### 1. The Strategy
- **App ID**: The Folder ID of the project is the App ID.
- **Data Store**: You can read/write JSON data to collections scoped to this App ID.

### 2. Implementation Steps
When the user asks for an app with database/persistence:
1. **Create Folder**: Call \`create_folder\`. note the \`id\` returned.
2. **Inject Config**: In your HTML/JS, hardcode this ID.
   \`\`\`javascript
   const APP_ID = "folder_clz..."; // The ID you got from create_folder
   const API_BASE = \`/api/storage/\${APP_ID}\`;
   \`\`\`
3. **Connect Data**: Use the built-in REST endpoints.

### 3. API Reference
| Method | Endpoint | Description |
|--------|----------|-------------|
| **GET** | \`/api/storage/{APP_ID}/{COLLECTION}\` | Get all items in a collection (e.g. 'todos') |
| **POST** | \`/api/storage/{APP_ID}/{COLLECTION}\` | Create a new item. Body: JSON. Returns \`{_id, ...data}\` |
| **DELETE** | \`/api/storage/{APP_ID}/{COLLECTION}?id={ID}\` | Delete an item by ID |

### 4. Code Pattern
Use this pattern for robust apps:
\`\`\`javascript
const API = {
    get: async (col) => (await fetch(\`\${API_BASE}/\${col}\`)).json(),
    add: async (col, data) => (await fetch(\`\${API_BASE}/\${col}\`, { method: 'POST', body: JSON.stringify(data) })).json(),
    del: async (col, id) => fetch(\`\${API_BASE}/\${col}?id=\${id}\`, { method: 'DELETE' })
};

// Automation / Workflows
const WORKFLOW = {
    trigger: async (ruleName, data) => (await fetch('/api/workflows/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleName, data })
    })).json()
};

// Usage
await API.add('todos', { text: 'Buy milk', done: false });
await WORKFLOW.trigger('process_invoice', { invoiceId: 123 });
\`\`\`

### 5. App Documentation (Manifest) 📑
To allow apps to be discovered and composed, ALWAYS create a \`app.json\` file in the root of your app folder (alongside index.html) when creating a complex app.
Manifest Format:
\`\`\`json
{
    "name": "CRM Module",
    "description": "Manages customer leads and deals",
    "collections": ["leads", "deals"],
    "events": ["lead_created"],
    "inputs": [],
    "outputs": ["leadId"]
}
\`\`\`
This allows you (the Agent) to READ this file later to understand how to integrate this app with others.
`;

async function main() {
    const active = await prisma.aIPromptSet.findFirst({
        where: { isActive: true }
    });

    if (!active) {
        console.error('No active prompt found!');
        return;
    }

    console.log(`Updating prompt: ${active.name}`);

    // Check if instructions already exist to avoid duplication
    if (active.prompt.includes('DATA STORAGE API')) {
        console.log('Instructions already present. Skipping.');
        // Optional: Force update if we want to overwrite
        // return;
    }

    const newPrompt = active.prompt + '\n\n' + API_INSTRUCTIONS;

    await prisma.aIPromptSet.update({
        where: { id: active.id },
        data: { prompt: newPrompt }
    });

    console.log('✅ Successfully injected Data Storage API instructions into the active agent.');
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
