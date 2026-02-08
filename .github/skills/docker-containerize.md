# Docker: Containerize Repo Apps (TaskFlow agents)

Goal: enable agents to containerize a repo app (Next/Vite/Node) on Windows Docker Desktop and align with TaskFlow process registry/start logic.

## Defaults and prerequisites
- Use the repo root as cwd unless `appPath` is specified.
- Honor `PREVIEW_PORT`/`NGROK_PORT` from `.env`; fallback to 5050.
- Assume Docker Desktop is running; if daemon is unreachable, fall back to local run is allowed only after Docker attempt fails.
- Use PowerShell-friendly commands; prefer `npm` (not `pnpm/yarn`) unless package lock indicates otherwise.

## Detect app + start script
1) If target provided and not absolute: try `apps/<target>/package.json`; else treat as relative/absolute.
2) Parse `package.json`:
   - Prefer `dev`, else `start`, else `preview`.
   - For Vite: pass `--host --port <port>` when running locally.
   - For Next: pass `-p <port>` when running locally.
3) If no suitable script: stop and report `package.json is missing a start/preview/dev script`.

## Choose Dockerfile
- If user supplied `Dockerfile` or `Dockerfile.taskflow`, reuse it and detect `EXPOSE` to set internal port (default 3000; if nginx present use 80).
- If none exists, generate `Dockerfile.taskflow`:
```
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
ENV NODE_ENV=production
ENV PORT=3000
RUN npm run build --if-present
EXPOSE 3000
CMD ["npm", "run", "<startScript>"]
```
Replace `<startScript>` with the detected script (dev/start/preview). Keep EXPOSE aligned with `PORT`.

## Build + run container
1) Determine port:
   - Use `PREVIEW_PORT` if set; otherwise pick `getAvailablePort(5000-5999)`.
   - If using preview port, kill any process on that port via `Stop-Process -Id (Get-NetTCPConnection -LocalPort <port>).OwningProcess -Force` (best-effort).
2) Build image (with names from metadata when provided):
```
docker build -t <imageName> -f "<dockerfilePath>" "<appPath>"
```
3) Run container:
```
docker rm -f <containerName>  # ignore errors
docker run -d --name <containerName> -p <port>:<internalPort> <imageName>
```
4) Update process registry: status `running`, store `port`, `startedAt`, `command`, and preserve metadata (containerName, imageName, appPath, startScript, dockerFile).

## Ngrok public URL (if NGROK_AUTHTOKEN exists)
- Container name for tunnel: `ngrok-<processId>`.
- Start tunnel:
```
docker rm -f ngrok-<processId>  # ignore errors
docker run -d --name ngrok-<processId> -p 4040:4040 -e NGROK_AUTHTOKEN=$env:NGROK_AUTHTOKEN ngrok/ngrok http host.docker.internal:<port>
```
- If 4040 busy, allow `-P` and then resolve published port via `docker port ngrok-<processId> 4040`.
- Query `http://localhost:<apiPort>/api/tunnels` for `public_url`; store in metadata as `publicUrl`.

## Fallback when Docker daemon unreachable
- Install deps if missing (`npm install` in appPath).
- Start locally with detected script, passing port flags (Vite: `--port --host`; Next: `-p`).
- Record `pid`, `port`, `metadata.mode = "local-fallback"`.

## Health + cleanup
- Health check type `port` unless an explicit HTTP health URL is known.
- Stop logic should remove app container and `ngrok-<id>` container; also `taskkill /PID <pid> /F` for local fallback.
- Delete logic should also `docker rm -f <containerName>` when metadata provides it.

## Quick reference commands (PowerShell)
- List containers: `docker ps -a`
- Stop/remove: `docker stop <name>; docker rm <name>`
- Logs: `docker logs --tail 100 <name>`
- Kill by port (host): `Stop-Process -Id (Get-NetTCPConnection -LocalPort <port>).OwningProcess -Force`
