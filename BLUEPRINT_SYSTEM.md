# Application Blueprint System

## Overview

The Application Blueprint System allows you to generate a comprehensive, structured snapshot of your entire application. This blueprint can be used for:

1. **AI Context** - Provide the AI with complete application context in any chat session
2. **Documentation** - Auto-generate up-to-date documentation of your app's structure
3. **Recreation** - Export blueprints with recreation scripts to rebuild the app from scratch
4. **Revision Tracking** - Keep track of how your application evolves over time

## Features

### 📋 What's Included in a Blueprint

- **Metadata**: Name, version, type, frameworks used
- **Architecture**: Layers, patterns, technologies
- **File Structure**: Complete directory tree
- **Dependencies**: Production and development packages
- **Database Schema**: Prisma models and relationships
- **API Endpoints**: All routes with HTTP methods
- **React Components**: Component dependencies and exports
- **Application Features**: List of implemented features
- **HTML Projects**: All static HTML projects in `public/uploads`

### 🔧 Usage

#### In AI Chat

The AI can now use blueprint tools in conversations:

```
User: "Generate a blueprint of our application"
AI: [calls generate_blueprint tool]

User: "What features do we have implemented?"
AI: [calls get_blueprint tool to check features]

User: "Export the blueprint for recreation"
AI: [calls export_blueprint tool]
```

#### Via API

**Generate Blueprint:**
```bash
curl -X POST http://localhost:3000/api/blueprint \
  -H "Content-Type: application/json" \
  -d '{"action": "generate"}'
```

**Get Latest Blueprint (JSON):**
```bash
curl http://localhost:3000/api/blueprint?action=latest
```

**Get Blueprint (Markdown):**
```bash
curl http://localhost:3000/api/blueprint?action=latest&format=markdown
```

**Export Blueprint:**
```bash
curl -X POST http://localhost:3000/api/blueprint \
  -H "Content-Type: application/json" \
  -d '{"action": "export"}'
```

### 📁 Storage

Blueprints are stored as JSON files in:
```
.agent/blueprint.json
```

This location is:
- ✅ Gitignored (so large blueprints don't bloat the repo)
- ✅ Persistent across sessions
- ✅ Easy to version control if needed
- ✅ Accessible to all tools and workflows

### 🤖 AI Tools

Three new tools are available in `toolLibrary.ts`:

1. **`generate_blueprint`** - Scan and generate a new blueprint
   - Scans the entire codebase
   - Discovers APIs, components, features
   - Analyzes dependencies and architecture
   - Saves to `.agent/blueprint.json`

2. **`get_blueprint`** - Retrieve current blueprint
   - Returns latest blueprint
   - Available in JSON or Markdown format
   - Perfect for providing context to AI

3. **`export_blueprint`** - Export for recreation
   - Includes full blueprint data
   - Generates bash recreation script
   - Provides step-by-step instructions
   - Ready to recreate the app elsewhere

### 📊 Blueprint Schema

```typescript
interface Blueprint {
  id: string;
  version: string;
  timestamp: Date;
  metadata: {
    name: string;
    description: string;
    type: 'fullstack' | 'frontend' | 'backend' | 'component';
    framework: string[];
    database?: string;
    deployment?: string;
  };
  architecture: {
    type: 'monolithic' | 'microservices' | 'serverless' | 'hybrid';
    layers: Layer[];
    patterns: string[];
  };
  structure: FileNode[];
  dependencies: {
    production: Record<string, string>;
    development: Record<string, string>;
  };
  database?: {
    type: string;
    schema: string;
    models: Model[];
  };
  apis: API[];
  components: Component[];
  features: Feature[];
  htmlProjects: HTMLProject[];
}
```

### 🔄 Auto-Update on HTML Changes

The blueprint system can be configured to automatically regenerate when HTML files are updated. This ensures the blueprint stays in sync with your application structure.

To enable auto-updates, you can:

1. **Manually trigger** in AI chat: "Update the blueprint"
2. **API call** after file changes
3. **Workflow trigger** (coming soon)

### 📖 Example Workflow

**Initial Setup:**
```
User: "Generate an application blueprint"
AI: ✅ Blueprint generated with:
     - 18 components
     - 15 API endpoints
     - 7 features
     - 45 HTML projects
     - PostgreSQL database with 15 models
```

**Check Features:**
```
User: "What features are implemented?"
AI: [retrieves blueprint]
    Here are the implemented features:
    1. AI Chat Assistant
    2. File Management
    3. Task Management
    4. Agent Workflows
    5. Magic Folders
    6. Document Synthesis
    7. Blueprint System
```

**Export for Recreation:**
```
User: "Export the blueprint so I can recreate this app"
AI: [exports blueprint with scripts]
    ✅ Blueprint exported with:
    - Complete JSON blueprint
    - Bash recreation script
    - Step-by-step instructions
```

### 🎯 Use Cases

1. **Onboarding**: Give new team members a complete app overview
2. **Documentation**: Auto-generate architecture docs
3. **Migration**: Move app to new environment
4. **Backup**: Snapshot of app structure
5. **AI Context**: Provide full context for better AI responses
6. **Code Review**: Understand the full scope before reviewing

### 🚀 Future Enhancements

- [ ] Blueprint versioning with diff support
- [ ] Visual architecture diagrams
- [ ] Auto-update on file system changes
- [ ] Blueprint comparison tool
- [ ] Integration with git hooks
- [ ] Export to various formats (PDF, HTML, etc.)

---

**Location:** `.agent/blueprint.json`  
**Generator:** `src/lib/blueprintGenerator.ts`  
**API:** `src/app/api/blueprint/route.ts`  
**Tools:** Added to `src/lib/toolLibrary.ts`
