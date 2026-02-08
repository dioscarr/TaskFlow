# Docker Troubleshooting

## Symptoms

- "failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine"
- TaskFlow app launcher shows "daemon" errors or skips Docker commands

## Root Cause

Docker Desktop's Linux engine is not running, or Docker is in Windows-container mode.

## Fix (Windows)

1. Start Docker Desktop and wait until it shows "Running".
2. Ensure it is set to Linux containers.
3. Verify the daemon:

```powershell
docker info
```

## Stop All Containers (PowerShell)

```powershell
# Kill all running containers
docker ps -q | ForEach-Object { docker kill $_ }

# Remove all containers
docker ps -a -q | ForEach-Object { docker rm $_ }
```

## If the daemon is unresponsive

- Restart Docker Desktop (tray icon -> Restart).
- If that fails, reboot Windows.

## Notes

- The Docker CLI cannot stop containers when the daemon is down.
- The TaskFlow app launcher will skip Docker actions until the daemon is healthy.
