---
description: Scaffold a new Remix + Vite application
---

# Scaffold Remix + Vite App

This workflow creates a production-ready Remix + Vite application with:
- File-based routing with loaders/actions
- Server-side rendering (SSR)
- Built-in SEO via Remix meta exports
- Design system integration
- Git initialization with comprehensive .gitignore
- GitHub Actions CI/CD workflows
- Optional GitHub repo creation

// turbo-all

## Prerequisites

Make sure you're in the main project directory:
```bash
cd c:\Users\Drod\Source\a
```

## Steps

### 1. Get Project Name

Ask the user for the project name (use kebab-case, e.g., "my-remix-site").

### 2. Create Project Directory

Note: `apps/` is a required system folder and must not be deleted.

```bash
mkdir apps\<project-name>
cd apps\<project-name>
```

### 3. Initialize Remix Project

```bash
npx -y create-remix@latest ./ --template remix-run/remix/templates/vite
```

When prompted:
- TypeScript: Yes
- Install dependencies: Yes

### 4. Copy Design System

```bash
mkdir app\styles
copy ..\..\..\.agent\workflows\templates\design-system.css app\styles\design-system.css
```

### 5. Update Root Layout

Update `app/root.tsx` to import the design system:

```typescript
import type { LinksFunction } from "@remix-run/node";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import designSystemStyles from "./styles/design-system.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: designSystemStyles },
];

export function meta() {
  return [
    { title: "Your Remix App" },
    { name: "description", content: "Welcome to your Remix app!" },
  ];
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}
```

### 6. Create Example Route with Loader

Create `app/routes/_index.tsx`:

```typescript
import type { MetaFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export const meta: MetaFunction = () => {
  return [
    { title: "Home - Your Remix App" },
    { name: "description", content: "Welcome to your premium Remix application!" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  return json({
    message: "Hello from the server!",
    timestamp: new Date().toISOString(),
  });
}

export default function Index() {
  const data = useLoaderData<typeof loader>();
  
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.8" }}>
      <h1>Welcome to Remix + Vite</h1>
      <p>Your premium full-stack application is ready!</p>
      <p>Server message: {data.message}</p>
      <p>Loaded at: {data.timestamp}</p>
    </div>
  );
}
```

### 7. Initialize Git

```bash
git init
copy ..\..\..\.agent\workflows\templates\app-gitignore .gitignore
git add .
git commit -m "Initial Remix + Vite scaffold with design system and SSR"
```

### 8. Set Up GitHub Actions

```bash
mkdir .github\workflows
copy ..\..\..\.agent\workflows\templates\github-ci.yml .github\workflows\ci.yml
copy ..\..\..\.agent\workflows\templates\github-deploy.yml .github\workflows\deploy.yml
git add .github
git commit -m "Add GitHub Actions CI/CD workflows"
```

### 9. Test Development Server

```bash
npm run dev
```

Verify the app runs at http://localhost:5173

### 10. (Optional) Create GitHub Repository

If the user wants to create a GitHub repo:

```bash
gh repo create <project-name> --public --source=. --push
```

Or for a private repo:
```bash
gh repo create <project-name> --private --source=. --push
```

## Success!

Your Remix + Vite app is ready at `apps\<project-name>` with:
- ✅ File-based routing
- ✅ Server-side rendering
- ✅ Built-in SEO
- ✅ Design system integrated
- ✅ Git initialized
- ✅ GitHub Actions ready
- ✅ Development server running

Next steps:
- Add routes in `app/routes/`
- Customize the design system in `app/styles/design-system.css`
- Add loaders and actions for data fetching
- Deploy to Vercel: `npx vercel`
