---
description: Scaffold a new Vite + React + TypeScript application
---

# Scaffold Vite + React App

This workflow creates a production-ready Vite + React + TypeScript application with:
- Opinionated folder structure
- Design system foundation (CSS variables, typography, colors)
- SEO best practices with react-helmet-async
- Component library structure
- Git initialization with comprehensive .gitignore
- GitHub Actions CI/CD workflows
- Optional GitHub repo creation

// turbo-all

## ⚠️ CRITICAL AGENT RULES
- **LOCATION**: Create repo apps under `apps/<project-name>`. The `apps/` folder is a required system folder and must never be deleted.
- **ENVIRONMENT**: You are running on Windows (PowerShell/CMD). Use `mkdir` (not `mkdir -p`), `;` (not `&&`), and standard Windows `copy`.
- **DEPENDENCIES**: React 19 has peer dependency conflicts with `react-helmet-async`. ALWAYS use `npm install --legacy-peer-deps`.
- **DOCKER**: The app is served via Nginx. The health check should target the mapped port on `localhost`.

## Prerequisites

1.  **Choose a Project Name**: Use a short, kebab-case name (e.g., `marketing-app`).
2.  **Target Directory**: Your project root will be `apps/<project-name>`.
3.  **Slash Command Input**: If triggered via `/scaffold-vite <project-name>`, use that name for all steps.

## Steps

### 1. Run Scaffold Script

Run the predefined PowerShell script to create the app folder and scaffold Vite:
```
<execute>
powershell -ExecutionPolicy Bypass -File scripts\scaffold-vite.ps1 -AppName <project-name>
</execute>
```

### 2. Install Additional Dependencies

```bash
npm install react-helmet-async --legacy-peer-deps
```

### 3. Copy Design System

Copy the design system CSS from templates:
```bash
mkdir src\styles
copy ..\..\..\.agent\workflows\templates\design-system.css src\styles\design-system.css
```

### 4. Copy SEO Config

```bash
copy ..\..\..\.agent\workflows\templates\seo-config.ts src\lib\seo-config.ts
```

Note: Create `src\lib` directory if it doesn't exist:
```bash
mkdir src\lib
```

### 5. Set Up Component Structure

```bash
mkdir src\components
copy ..\..\..\.agent\workflows\templates\component-template.tsx src\components\Button.tsx
```

### 6. Update Main App File

Update `src/App.tsx` to import the design system and use react-helmet-async:

```typescript
import { Helmet, HelmetProvider } from 'react-helmet-async';
import './styles/design-system.css';
import './App.css';

function App() {
  return (
    <HelmetProvider>
      <Helmet>
        <title>Your App Name</title>
        <meta name="description" content="Your app description" />
      </Helmet>
      <div className="app">
        <h1>Welcome to Your App</h1>
        <p>Your premium React application is ready!</p>
      </div>
    </HelmetProvider>
  );
}

export default App;
```

### 7. Initialize Git

```bash
git init
copy ..\..\..\.agent\workflows\templates\app-gitignore .gitignore
git add .
git commit -m "Initial Vite + React scaffold with design system and SEO"
```

### 8. Set Up GitHub Actions

```bash
mkdir .github\workflows
copy ..\..\.agent\workflows\templates\github-ci.yml .github\workflows\ci.yml
copy ..\..\.agent\workflows\templates\github-deploy.yml .github\workflows\deploy.yml
git add .github
git commit -m "Add GitHub Actions CI/CD workflows"
```

### 9. Install Dependencies and Test

```bash
npm install --legacy-peer-deps
npm run dev
```

Verify the app runs at http://localhost:5173

### 10. Dockerize the Application

We will containerize the application to make it deployable and manageable by the Process Manager.

```bash
copy ..\..\..\.agent\workflows\templates\Dockerfile.vite Dockerfile
copy ..\..\..\.agent\workflows\templates\nginx-spa.conf nginx.conf
```

### 11. Build and Run Container

Build the Docker image and run it. The container name MUST start with `taskflow-repo-app-` for the Process Manager to auto-discover it.

Ask the user for a port number (default to 4173 or similar).

```bash
docker build -t taskflow-repo-app-<project-name> .
docker run -d --name taskflow-repo-app-<project-name> -p <port>:80 taskflow-repo-app-<project-name>
```

### 12. Verify Deployment

1. Check the Process Manager in the main app (http://localhost:3000/processes).
2. Click "Discover" if the app doesn't appear immediately.
3. The app should show up as "Repo App <project-name>".

## Success!

Your Vite + React app is ready at `apps\<project-name>` and running in Docker!

- **Local Dev:** http://localhost:5173
- **Production Container:** http://localhost:<port>
- **Management:** Controllable via Process Manager

