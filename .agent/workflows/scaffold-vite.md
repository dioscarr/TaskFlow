---
description: Scaffold a new Vite + React + TypeScript application (Token-Optimized)
---

# Scaffold Vite + React App

This workflow creates a production-ready Vite + React + TypeScript application with:
- Opinionated folder structure
- Design system foundation (CSS variables, typography, colors)
- SEO best practices with react-helmet-async
- Component library structure
- Git initialization with comprehensive .gitignore
- GitHub Actions CI/CD workflows
- Docker containerization for deployment

// turbo-all

## ⚠️ CRITICAL AGENT RULES

- **EXECUTION**: Use the `execute_command` tool (not `<execute>` tags). Agents have this tool available for running terminal commands.
- **LOCATION**: Create repo apps under `apps/<project-name>`. The `apps/` folder is a required system folder and must never be deleted.
- **ENVIRONMENT**: You are running on Windows (PowerShell). Use `New-Item -ItemType Directory` (or `mkdir`), `;` (not `&&`), and `Copy-Item`. Avoid CMD-specific flags like `/y`.
- **DEPENDENCIES**: React 19 has peer dependency conflicts with `react-helmet-async`. ALWAYS use `npm install --legacy-peer-deps`.
- **DOCKER**: The app is served via Nginx. The health check should target the mapped port on `localhost`.
- **QUESTION-FIRST**: This workflow requires gathering user input BEFORE execution. Ask all questions upfront, then execute the scaffold with collected answers.

## 🎯 Validation & Defaults (Quick AI Check)

### Quick Validation

1. **Check Node.js installed**: `node -v`
2. **Check npm installed**: `npm -v`

---

## 📋 STEP 1: Gather Project Information

**BEFORE executing any commands, you MUST ask the user for:**

1. **Project Name** (required)
   - Must be kebab-case (lowercase, hyphens only)
   - Example: "my-awesome-app", "food-delivery", "crm-dashboard"

2. **Project Description** (optional)
   - Brief description of what the app does
   - Example: "A food delivery platform for local restaurants"

3. **Desired Features** (optional)
   - Any specific features they want included
   - Example: "authentication", "dark mode", "API integration"

**ONLY AFTER collecting all answers, proceed to Step 2.**

---

## 🚀 STEP 2: Execute Scaffold

Once you have collected all the information from Step 1, call the `execute_scaffold_vite` action:

```
Action: execute_scaffold_vite
Parameters:
  - projectName: <user-provided-name>
  - description: <user-provided-description> (optional)
  - features: [<user-provided-features>] (optional)
```

This will automatically:
- ✅ Create the project folder
- ✅ Initialize Vite + React + TypeScript
- ✅ Install design system and SEO configuration
- ✅ Add sample components
- ✅ Initialize Git with .gitignore
- ✅ Set up GitHub Actions CI/CD
- ✅ Install dependencies
- ✅ Build for production
- ✅ Add Docker configuration

---

## ✅ Completion

When the scaffold completes successfully, the AI should report:

```
🎉 BOILERPLATE COMPLETE

Project:        <project-name>
Location:       apps\<project-name>
Dev Server:     npm run dev (at http://localhost:5173)
Docker:         Ready for containerization
Git:            Initialized with commits
CI/CD:          GitHub Actions workflows in place
```

The folder now exists and the app is ready for development.
