This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or run Next.js with the Omni-Shell attached
npm run dev:omni-shell
# or launch just the Omni-Shell
npm run omni-shell
# or run any app under apps/ (example)
npm run dev:app -- --app=call
# or run an app under apps/ with Omni-Shell (example)
npm run dev:app:omni-shell -- --app=call
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Docker App Runner

Run any app under apps/ with a single reusable compose file.

```bash
# Dev (Vite) example
APP_NAME=call docker compose -f docker-compose.app.yml --profile dev up --build

# Prod (Nginx) example
APP_NAME=call docker compose -f docker-compose.app.yml --profile prod up --build
```

Optional port overrides:

```bash
DEV_PORT=5050 PROD_PORT=8080 APP_NAME=call docker compose -f docker-compose.app.yml --profile dev up --build
```

VS Code task (TaskFlow UI / Explorer):

```bash
# Command Palette -> Tasks: Run Task -> Docker: App (dev/prod)
```

npm script:

```bash
npm run docker:app -- --app=call --profile=dev
```

Troubleshooting:

- See [docs/docker-troubleshooting.md](docs/docker-troubleshooting.md) for daemon connection errors and recovery steps.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
