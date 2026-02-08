# Docker Ops + Debug (TaskFlow agents)

Use this when agents need to diagnose or adjust running containers within TaskFlow.

## Standard checks
- Confirm daemon: `docker info` must succeed; if it fails, report and switch to local fallback run.
- Verify image existence before run: `docker images | findstr <imageName>`; if missing for repo-app, rebuild.
- Inspect exposed ports: `docker inspect --format="{{json .Config.ExposedPorts}}" <imageName>`.
- Check who owns a port (host): `netstat -ano | findstr :<port>` → last column PID; kill with `Stop-Process -Id <pid> -Force`.

## Logs and health
- Logs: `docker logs --tail 100 <containerName>`; include stderr.
- Health: if registry uses `healthCheckType: "port"`, treat `netstat` success as healthy; if `http`, GET `healthUrl` with 5s timeout.
- Record `healthStatus`, `responseTime`, and set status to `running` or `error` accordingly.

## Restart/port rebind
- Restart container: `docker restart <containerName>`; if it fails because image missing, rebuild using appPath metadata and rerun.
- Rebind to new host port:
```
# stop/remove old
docker stop <containerName>
docker rm <containerName>
# choose new <port> (use getAvailablePort)
docker run -d --name <containerName> -p <port>:<internalPort> <imageName>
```
- Detect internal port via `docker inspect` exposed ports (prefer 80, 5173, 3000 in that order). Update registry with new `port`, `command`, `startedAt`.

## Ngrok lifecycle
- Tunnel name: `ngrok-<processId>`.
- Stop tunnel: `docker rm -f ngrok-<processId>`; clear `publicUrl` in metadata.
- Start tunnel: run ngrok container (see containerize skill), wait 3s, fetch `public_url`; store in metadata.

## Cleanup rules
- On stop: for Docker processes, stop app container and `ngrok-<id>`; for local fallback, `taskkill /PID <pid> /F` and attempt port kill.
- On delete: also `docker rm -f <containerName>` when metadata supplies it.

## Failure patterns to report
- Docker daemon unreachable: advise user to start Docker Desktop; if local fallback started, note mode `local-fallback`.
- Port collision persists after kill attempts: return actionable error `Preview port <port> is already in use`.
- Missing start script: `package.json is missing a start/preview/dev script`.
- NGROK_AUTHTOKEN not set: return clear message and skip tunnel creation.
