# Web App Scaffolding Guide

This guide explains how to use the scaffolding system to create new React applications with a structured, production-ready starting point.

## Quick Start

### Vite + React App

```bash
# Navigate to your project
cd c:\Users\Drod\Source\a

# Run the scaffolding workflow
# Use your AI assistant: "scaffold a new vite app called 'my-app'"
# Or manually follow: .agent/workflows/scaffold-vite.md
```

### Remix + Vite App

```bash
# Navigate to your project
cd c:\Users\Drod\Source\a

# Run the scaffolding workflow
# Use your AI assistant: "scaffold a new remix app called 'my-site'"
# Or manually follow: .agent/workflows/scaffold-remix.md
```

## When to Use Which Template

| Use Case | Recommended Template | Why? |
|----------|---------------------|------|
| Dashboard, Admin Panel | **Vite** | Fast client-side interactions, no SEO needed |
| Marketing Website, Blog | **Remix** | SEO-critical, server-side rendering |
| Internal Tool, Prototype | **Vite** | Quick setup, minimal overhead |
| E-commerce, Portfolio | **Remix** | SEO + dynamic data loading |
| SPA (Single Page App) | **Vite** | Client-side routing, API-driven |

## What's Included

Every scaffolded app comes with:

### ✅ Design System Foundation
- Modern color palette (vibrant purples, blues, teals)
- Typography scale with fluid sizing
- Spacing system (xs to 4xl)
- Utility classes for common patterns
- Pre-built components (buttons, cards)
- Smooth animations and transitions

**Location:** `src/styles/design-system.css` (Vite) or `app/styles/design-system.css` (Remix)

### ✅ SEO Best Practices
- Meta tags configured
- Open Graph support
- Twitter Card integration
- Semantic HTML structure
- Centralized SEO config

**Location:** `src/lib/seo-config.ts` (Vite) or integrated in Remix routes

### ✅ Git + GitHub Ready
- Repository initialized
- Comprehensive `.gitignore`
- CI workflow (build + lint)
- Deploy workflow template
- One-command repo creation

**Location:** `.github/workflows/`

### ✅ TypeScript Configuration
- Strict type checking
- Path aliases configured
- Modern ES modules

### ✅ Component Structure
- Organized folder layout
- Example components
- TypeScript interfaces
- Accessibility built-in

## Project Structure

### Vite App Structure
```
apps/your-app/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
├── src/
│   ├── components/
│   │   └── Button.tsx
│   ├── lib/
│   │   └── seo-config.ts
│   ├── styles/
│   │   └── design-system.css
│   ├── App.tsx
│   └── main.tsx
├── .gitignore
├── package.json
└── vite.config.ts
```

### Remix App Structure
```
apps/your-site/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
├── app/
│   ├── routes/
│   │   └── _index.tsx
│   ├── styles/
│   │   └── design-system.css
│   └── root.tsx
├── .gitignore
├── package.json
└── vite.config.ts
```

## GitHub Integration

### Option 1: Using GitHub CLI (Recommended)

**Install GitHub CLI:**
```powershell
winget install --id GitHub.cli
gh auth login
```

**Create repo and push:**
```bash
cd apps/your-app
gh repo create your-app --public --source=. --push
```

### Option 2: Manual GitHub Setup

1. Create a new repository on GitHub.com
2. Copy the remote URL
3. In your terminal:
   ```bash
   cd apps/your-app
   git remote add origin https://github.com/yourusername/your-app.git
   git push -u origin main
   ```

## Deployment

### Vercel (Recommended)

**Why Vercel?** Zero-config deployments for both Vite and Remix, automatic GitHub integration.

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from project directory
cd apps/your-app
vercel

# Follow prompts to link GitHub and deploy
```

**Auto-deploy:** Once connected to GitHub, every push to `main` triggers deployment.

### Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
cd apps/your-app
netlify deploy --prod
```

### Firebase Hosting

```bash
cd apps/your-app
firebase init hosting
firebase deploy --only hosting
```

### Cloudflare Pages

Push to GitHub, then connect repository on [Cloudflare Pages Dashboard](https://pages.cloudflare.com/).

## Customization Guide

### Changing Colors

Edit `design-system.css`:
```css
:root {
  --color-primary: hsl(262, 83%, 58%);  /* Change this */
  --color-secondary: hsl(200, 98%, 39%); /* And this */
}
```

### Adding Google Fonts

1. Visit [Google Fonts](https://fonts.google.com/)
2. Select your font
3. Add to `<head>` in `index.html` (Vite) or `root.tsx` (Remix)
4. Update CSS:
   ```css
   --font-family-sans: 'Your Font', -apple-system, ...;
   ```

### Creating New Components

Use the template as a starting point:

```bash
# Copy the component template
copy .agent\workflows\templates\component-template.tsx src\components\YourComponent.tsx
```

Then customize to your needs.

## Troubleshooting

### Build Errors

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Port Already in Use

```bash
# Vite/Remix uses port 5173 by default
# To use a different port:
npm run dev -- --port 3000
```

### GitHub CLI Not Working

Make sure you're authenticated:
```bash
gh auth status
gh auth login
```

### TypeScript Errors

```bash
# Regenerate types
npm run build
```

## Next Steps

After scaffolding your app:

1. **Customize the design system** - Make it your own!
2. **Update SEO metadata** - Add your app name, description
3. **Build components** - Start with the basics
4. **Set up deployment** - Choose Vercel, Netlify, etc.
5. **Add features** - State management, routing, API calls
6. **Write tests** - Add testing framework if needed

## Tips & Best Practices

### 🎨 Design
- Use CSS variables for theming
- Keep animations subtle (150-350ms)
- Test on mobile devices
- Maintain consistent spacing

### 🔍 SEO
- Update meta descriptions per page
- Use semantic HTML (`<header>`, `<nav>`, `<main>`)
- Add alt text to images
- Include structured data when relevant

### 📦 Performance
- Lazy load components: `const Component = lazy(() => import('./Component'))`
- Optimize images (WebP format)
- Code split large bundles
- Use Lighthouse for audits

### 🔐 Security
- Never commit `.env` files
- Use environment variables for secrets
- Keep dependencies updated: `npm audit`
- Enable HTTPS in production

## Resources

- [Vite Documentation](https://vitejs.dev/)
- [Remix Documentation](https://remix.run/)
- [React Documentation](https://react.dev/)
- [GitHub Actions Docs](https://docs.github.com/actions)
- [Vercel Deployment Guide](https://vercel.com/docs)

## Support

Having issues? Check:
1. Workflow files in `.agent/workflows/`
2. Template files in `.agent/workflows/templates/`
3. Your AI assistant for step-by-step help

---

**Happy Building! 🚀**
