# Blueprint System - Quick Reference

## 🎯 What Is It?

A system that generates a complete snapshot of your application including:
- File structure, APIs, components, features
- Database schema, dependencies, HTML projects
- Can be used for AI context, documentation, and recreation

## 📍 Storage Location

```
.agent/blueprint.json
```

## 🤖 AI Commands

| Command | What It Does |
|---------|-------------|
| "Generate a blueprint" | Scans app and creates blueprint |
| "Get the blueprint" | Retrieves current blueprint |
| "Show me our features" | Lists all implemented features |
| "What APIs do we have?" | Shows all API endpoints |
| "Export the blueprint" | Creates recreation package |

## 🔧 API Endpoints

### Generate
```bash
POST /api/blueprint
{ "action": "generate" }
```

### Get (JSON)
```bash
GET /api/blueprint?action=latest&format=json
```

### Get (Markdown)
```bash
GET /api/blueprint?action=latest&format=markdown
```

### Export
```bash
POST /api/blueprint
{ "action": "export" }
```

## 📊 What's Included

✅ Metadata (name, version, frameworks)  
✅ Architecture layers & patterns  
✅ Complete file tree  
✅ All dependencies  
✅ Database models  
✅ API endpoints  
✅ React components  
✅ Features list  
✅ HTML projects  

## 🎨 Update Blueprint

**Via AI Chat:**
```
"Regenerate the blueprint"
```

**Via API:**
```javascript
fetch('/api/blueprint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'generate' })
});
```

## 📝 Example Output

```json
{
  "id": "blueprint-1738359600000",
  "version": "1.0.0",
  "metadata": {
    "name": "TaskFlow",
    "type": "fullstack",
    "framework": ["Next.js", "React", "TypeScript", "Prisma"]
  },
  "apis": [
    { "method": "GET", "path": "/api/files" },
    { "method": "POST", "path": "/api/blueprint" }
  ],
  "features": [
    { "name": "AI Chat Assistant", "status": "implemented" },
    { "name": "File Management", "status": "implemented" }
  ],
  "components": [
    { "name": "AIChat", "type": "component" },
    { "name": "FileManager", "type": "component" }
  ]
}
```

## 🚀 Quick Start

1. Open AI chat
2. Say: **"Generate an application blueprint"**
3. Done! Blueprint saved to `.agent/blueprint.json`

## 💡 Use Cases

- **AI Context**: "Based on our blueprint, what features should we add?"
- **Documentation**: Export markdown for README
- **Onboarding**: Show new devs the app structure
- **Recreation**: Rebuild app in new environment
- **Tracking**: See how app evolves over time

## 🔗 Related Files

- `src/lib/blueprintGenerator.ts` - Core generator
- `src/app/api/blueprint/route.ts` - API routes
- `src/lib/toolLibrary.ts` - AI tools
- `BLUEPRINT_SYSTEM.md` - Full documentation
- `BLUEPRINT_IMPLEMENTATION.md` - Implementation details

---

**Last Updated:** 2026-01-31  
**Status:** ✅ Fully Implemented
