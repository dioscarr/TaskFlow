---
description: Generate and manage application blueprints
---

# Blueprint Management Workflow

This workflow helps you generate, retrieve, and manage application blueprints.

## When to Use This Workflow

- You want to generate a complete snapshot of the application
- You need context about the app structure for AI assistance
- You're documenting the architecture
- You want to export the app for recreation elsewhere
- HTML files have been updated and you want to sync the blueprint

## Steps

### 1. Generate a New Blueprint

Generate a fresh blueprint by scanning the entire codebase:

```
User: "Generate an application blueprint"
AI: [calls generate_blueprint tool]
```

**What happens:**
- Scans all source files, components, APIs
- Discovers HTML projects in `public/uploads`
- Extracts database schema from Prisma
- Analyzes dependencies from `package.json`
- Saves to `.agent/blueprint.json`

### 2. View Current Blueprint

Retrieve the existing blueprint without regenerating:

```
User: "Show me the current blueprint"
AI: [calls get_blueprint tool with format='markdown']
```

**Available formats:**
- `json` - Full structured data
- `markdown` - Human-readable summary

### 3. Check Specific Information

Ask questions about the blueprint:

```
User: "What features are implemented?"
User: "List all API endpoints"
User: "How many HTML projects do we have?"
User: "What's our tech stack?"
```

The AI will call `get_blueprint` and extract the relevant information.

### 4. Update Blueprint After Changes

After making changes to HTML files or adding new components:

```
User: "Update the blueprint to reflect recent changes"
AI: [regenerates blueprint]
```

### 5. Export for Recreation

Create a complete export package with recreation scripts:

```
User: "Export the blueprint for recreation"
AI: [calls export_blueprint tool]
```

**Export includes:**
- Full JSON blueprint
- Bash recreation script
- Step-by-step manual instructions

### 6. Use Blueprint for Planning

Use the blueprint to inform development decisions:

```
User: "Based on our current architecture, where should I add a new payment feature?"
AI: [retrieves blueprint, analyzes structure, provides recommendation]
```

## Automation Options

### Auto-Generate on File Changes

You can set up automatic blueprint regeneration when HTML files change by adding this to your file upload handler:

```typescript
// After file upload/update
await fetch('/api/blueprint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'generate' })
});
```

### Scheduled Regeneration

Set up a cron job or workflow to regenerate daily:

```typescript
// In a cron job or scheduled task
setInterval(async () => {
  await fetch('/api/blueprint', {
    method: 'POST',
    body: JSON.stringify({ action: 'generate' })
  });
}, 24 * 60 * 60 * 1000); // Every 24 hours
```

## Expected Output

After generating a blueprint, you'll see:

```
✅ Blueprint generated successfully!

📊 Summary:
- Components: 18
- API Endpoints: 15
- Features: 7
- HTML Projects: 45
- Database Models: 15
- Dependencies: 42 production, 28 development

📁 Saved to: .agent/blueprint.json
```

## Troubleshooting

**Blueprint not generating:**
- Ensure dev server is running
- Check file permissions on `.agent/` directory
- Verify all required files exist (package.json, prisma/schema.prisma)

**Missing HTML projects:**
- Ensure projects are in `public/uploads/`
- Each project folder must contain at least one `.html` file

**Incomplete data:**
- Some sections may be empty if those parts don't exist in your app
- This is normal - the blueprint adapts to your app structure

## Tips

- Generate blueprints regularly to track evolution
- Use markdown format for sharing with team
- Export before major refactoring for backup
- Include blueprints in onboarding documentation

---

**Tools Used:**
- `generate_blueprint`
- `get_blueprint`
- `export_blueprint`

**API Endpoint:** `/api/blueprint`  
**Storage:** `.agent/blueprint.json`
