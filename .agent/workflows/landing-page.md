---
description: Scaffold a premium SaaS landing page (Vite + React + TypeScript)
---

# Landing Page Workflow

This workflow scaffolds a premium SaaS landing page using Vite + React + TypeScript and prepares a polished UI layout.

## Trigger Keywords

- /landing-page
- landing-page
- landing page

## Required Inputs

- Project name (kebab-case, e.g., "premium-saas")
- Product name (e.g., "XCustomer")
- Optional tagline (default provided in script)
- Docker port (default 4173)

## Steps

### 1. Run the Landing Page Script

```
<execute>
powershell -ExecutionPolicy Bypass -File scripts\landing-page.ps1 -AppName <project-name> -ProductName "<product-name>" -Tagline "<tagline>" -Port <port>
</execute>
```

### 2. Verify Local Dev

```
<execute>
powershell -Command "Set-Location apps\<project-name>; npm run dev"
</execute>
```

App runs at http://localhost:5173

### 3. Dockerize

```
<execute>
powershell -Command "Set-Location apps\<project-name>; copy ..\..\..\.agent\workflows\templates\Dockerfile.vite Dockerfile; copy ..\..\..\.agent\workflows\templates\nginx-spa.conf nginx.conf"
</execute>
```

```
<execute>
docker build -t taskflow-repo-app-<project-name> .
</execute>
```

```
<execute>
docker run -d --name taskflow-repo-app-<project-name> -p <port>:80 taskflow-repo-app-<project-name>
</execute>
```

App runs at http://localhost:<port>

## Notes

- Do not use public/uploads. Use CSS shapes and gradients instead.
- Keep the landing page responsive (mobile and desktop).
- Use premium typography and layered backgrounds for a high-end look.
