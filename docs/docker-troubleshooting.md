# Docker Troubleshooting Guide

## Common Issues and Solutions

### 1. Docker Daemon Not Running

**Symptoms:**
- Error: `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`
- Apps show "daemon marked as down" in VibeFileExplorer
- `docker info` command fails

**Solutions:**
1. **Start Docker Desktop**
   - Open from Start Menu: "Docker Desktop"
   - Wait 30-60 seconds for full startup
   - System tray icon should show "Engine Running"

2. **Verify Docker Service**
   ```powershell
   Get-Service | Where-Object { $_.Name -like "*docker*" }
   ```
   Both "Docker Desktop Service" and "com.docker.service" should be "Running"

3. **Restart Docker Desktop**
   - Right-click system tray icon → "Restart"
   - Or: `taskkill /IM "Docker Desktop.exe" /F` then restart

4. **WSL 2 Backend**
   - Docker Desktop → Settings → General
   - Ensure "Use WSL 2 based engine" is checked
   - Restart Docker if changed

5. **Automatic Fallback Mode**
   - If Docker can't start, TaskFlow apps will run locally
   - You'll see: "Started in Local Fallback mode"
   - No container isolation, but functionality preserved

### 2. Port 5050 Already in Use

**Symptoms:**
- Error: `EADDRINUSE: address already in use :::5050`
- Container fails to start
- Preview not accessible

**Solutions:**
1. **Kill Process on Port** (PowerShell)
   ```powershell
   $proc = (Get-NetTCPConnection -LocalPort 5050 -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess
   if ($proc) {
       Stop-Process -Id $proc -Force
       Write-Host "Killed process on port 5050"
   } else {
       Write-Host "No process found on port 5050"
   }
   ```

2. **Stop Docker Container**
   ```bash
   docker ps -a | grep 5050
   docker stop <container-name>
   docker rm <container-name>
   ```

3. **Automatic Port Cleanup**
   - TaskFlow automatically tries to free port 5050 before starting
   - Check logs: "Killed process on preview port"

### 3. Container Build Failures

**Symptoms:**
- `docker build` fails with npm errors
- Missing dependencies
- Build hangs or times out

**Solutions:**
1. **Clear Docker Cache**
   ```bash
   docker build --no-cache -t <image-name> -f Dockerfile.dev .
   ```

2. **Fix npm Dependencies**
   - Use `--legacy-peer-deps` flag (already in Dockerfile.dev)
   - Update package.json if needed
   - Delete node_modules locally: `rm -rf node_modules`

3. **Check Dockerfile**
   - Ensure Dockerfile.dev exists in app directory
   - Verify EXPOSE port matches CMD port (should be 5050)
   - Check CMD uses `--host 0.0.0.0`

4. **View Full Build Output**
   ```bash
   docker build -t <image-name> -f Dockerfile.dev . --progress=plain
   ```

### 4. VibeFileExplorer: "Error starting process { message: 'daemon' }"

**Symptoms:**
- Clicking play button fails
- Error toast shows "daemon marked as down"
- Apps won't start from Explorer

**Solutions:**
1. **Docker Not Running** (Most Common)
   - Start Docker Desktop and wait for engine ready
   - Click "Retry" button in error toast
   - Or use refresh icon in Explorer

2. **Fallback Mode Active**
   - If you see "Started in local mode", Docker was unavailable
   - App is running locally instead of in container
   - Check http://localhost:5050 - should still work

3. **Force Refresh Process List**
   - Click refresh icon (↻) in VibeFileExplorer header
   - This re-syncs Docker container status

4. **Check Logs**
   - Open DevTools Console (F12)
   - Look for: "Docker daemon unavailable. Attempting local fallback..."
   - Or: "Skipping Docker commands (daemon marked as down)"

### 5. AI Chat Tools Not Working in Container

**Symptoms:**
- AI commands timeout
- File operations fail
- Tools can't reach app API

**Current Behavior:**
- **AI Tools Execute on HOST** - They don't run inside the container
- **File Operations** - Work directly on source files (not container files)
- **API Calls** - Route through `host.docker.internal` from container
- **Process Management** - Container lifecycle managed from host

**Solutions:**
1. **Verify Networking**
   - Container should use `host.docker.internal` for host access
   - Check vite.config.ts has `allowedHosts: true`
   - Port 5050 should be bound: `0.0.0.0:5050`

2. **Volume Mounts Not Needed**
   - Current setup: AI tools work on host files
   - Container rebuilds when files change (via `manageAppLifecycle`)
   - Hot reload works because container COPY's files at build time

3. **For Live Development** (Future Enhancement)
   ```bash
   # Add volume mount for real-time sync
   docker run -d \
     -p 5050:5050 \
     -v "${PWD}:/app" \
     -v /app/node_modules \
     --name app-name \
     image-name
   ```

### 6. Preview URL Not Accessible

**Symptoms:**
- localhost:5050 shows "connection refused"
- Container is running but preview fails
- Ngrok tunnel not created

**Solutions:**
1. **Check Container Logs**
   ```bash
   docker logs <container-name> --tail 50
   ```
   Look for:
   - "VITE ready in XXms"
   - "Local: http://localhost:5050"
   - Errors like "EADDRINUSE" or build failures

2. **Verify Port Mapping**
   ```bash
   docker ps
   ```
   Should show: `0.0.0.0:5050->5050/tcp`

3. **Test Container Directly**
   ```bash
   docker exec -it <container-name> sh
   wget http://localhost:5050
   exit
   ```

4. **Check Process Registry**
   - Open TaskFlow → Process Manager
   - Find your app, check status
   - metadata.publicUrl should have ngrok URL (if tunnel active)

### 7. Ngrok Tunnel Fails

**Symptoms:**
- No publicUrl in response
- Tunnel container not starting
- Port 4040 conflict

**Solutions:**
1. **NGROK_AUTHTOKEN Missing**
   ```powershell
   # Add to .env file
   NGROK_AUTHTOKEN=your-token-here
   ```
   Get token from: https://dashboard.ngrok.com/get-started/your-authtoken

2. **Port 4040 Busy**
   - TaskFlow automatically tries random port if 4040 busy
   - Check: `docker ps | grep ngrok`
   - Manual fix:
   ```bash
   docker rm -f ngrok-*
   ```

3. **Tunnel Creation Timeout**
   - Tunnel polls for 10 seconds max
   - If fails, check ngrok container logs:
   ```bash
   docker logs ngrok-<processId>
   ```

### 8. Multiple Apps Running / Port Conflicts

**Symptoms:**
- Can't start new app
- "Another app is running" prompt
- Port already in use

**Solutions:**
1. **Auto-Stop Other Apps**
   - When prompted, click "Yes" to stop other running apps
   - TaskFlow will stop them and free the port
   - Script: `stopOthers: true` in manageAppLifecycle

2. **Manual Cleanup**
   ```bash
   # Stop all TaskFlow containers
   docker ps --filter "name=salon-premium|test-app|call" -q | ForEach-Object { docker stop $_ }

   # Remove stopped containers
   docker ps -a --filter "status=exited" -q | ForEach-Object { docker rm $_ }
   ```

3. **Process Registry Cleanup**
   - Use Process Manager in TaskFlow UI
   - Delete stale processes (shows "unknown" status)
   - Registry syncs every 2 minutes automatically

### 9. Vite "Optimize Dependencies" Loop

**Symptoms:**
- Build repeatedly optimizes dependencies
- Hot reload not working
- Slow rebuild times

**Solutions:**
1. **Update vite.config.ts**
   ```typescript
   export default defineConfig({
     server: {
       watch: {
         usePolling: true, // Required for Docker
         interval: 1000
       }
     },
     optimizeDeps: {
       include: ['react', 'react-dom'] // Pre-bundle common deps
     }
   })
   ```

2. **Clear Vite Cache**
   ```bash
   rm -rf node_modules/.vite
   docker build --no-cache -t app -f Dockerfile.dev .
   ```

### 10. Windows-Specific Issues

#### WSL Integration
- Docker Desktop → Settings → Resources → WSL Integration
- Enable for your WSL distribution
- Restart WSL: `wsl --shutdown` then reopen terminal

#### File Permissions
- Docker containers run as root by default
- Generated files owned by root
- Fix: Add `USER node` to Dockerfile after install steps

#### Line Endings
- Git may convert LF to CRLF on Windows
- Add `.gitattributes`:
  ```
  * text=auto
  *.sh text eol=lf
  Dockerfile* text eol=lf
  ```

#### Performance
- WSL 2 backend is 10x faster than Hyper-V
- Store code in WSL filesystem, not `/mnt/c/`
- Use BuildKit: `$env:DOCKER_BUILDKIT=1`

## Diagnostic Commands

### Quick Health Check
```bash
# 1. Docker daemon
docker info

# 2. Running containers
docker ps

# 3. TaskFlow app port
Get-NetTCPConnection -LocalPort 5050 -ErrorAction SilentlyContinue

# 4. Ngrok tunnels
docker ps | grep ngrok

# 5. Docker resource usage
docker stats --no-stream
```

### Full Diagnostic
```powershell
# Save to file for sharing
$diagFile = "docker-diagnostic.txt"

"=== Docker Info ===" | Out-File $diagFile
docker info 2>&1 | Out-File -Append $diagFile

"`n=== Running Containers ===" | Out-File -Append $diagFile
docker ps -a | Out-File -Append $diagFile

"`n=== Port 5050 Usage ===" | Out-File -Append $diagFile
Get-NetTCPConnection -LocalPort 5050 -ErrorAction SilentlyContinue | Out-File -Append $diagFile

"`n=== Docker Version ===" | Out-File -Append $diagFile
docker version | Out-File -Append $diagFile

"`n=== TaskFlow Containers ===" | Out-File -Append $diagFile
docker ps --filter "name=salon|test|call|ngrok" -a | Out-File -Append $diagFile

Write-Host "Diagnostic saved to: $diagFile"
```

### Container Debug Shell
```bash
# Enter running container
docker exec -it <container-name> sh

# Inside container:
ps aux              # Check processes
netstat -tlnp       # Check ports
env                 # Check environment
cat package.json    # Check config
exit
```

## Advanced Fixes

### Reset Docker Completely
```powershell
# WARNING: Removes ALL containers, images, volumes
docker system prune -a --volumes
Restart-Service -Name "Docker Desktop Service"
```

### Force Rebuild Everything
```bash
# Navigate to app
cd apps/my-app

# Remove all Docker artifacts for this app
docker rm -f my-app
docker rmi my-app
docker build -t my-app -f Dockerfile.dev .
docker run -d --name my-app -p 5050:5050 my-app
```

### Check Docker Disk Usage
```bash
docker system df -v
```

### Enable Docker Debug Logging
- Docker Desktop → Settings → Docker Engine
- Add: `"debug": true`
- Restart Docker
- Logs: `C:\Users\<user>\AppData\Local\Docker\log.txt`

## Getting Help

If issues persist:
1. Check **docs/docker-dev-setup.md** for setup guide
2. Run diagnostic commands above
3. Share output with team or in issue tracker
4. Include:
   - Error messages
   - Docker Desktop version
   - Windows version
   - Output of `docker info`
   - Container logs if applicable

## Prevention Tips

1. **Keep Docker Desktop Running**
   - Set to start on boot if you use it frequently
   - Or leverage automatic fallback mode

2. **Regular Cleanup**
   ```bash
   # Weekly cleanup command
   docker container prune -f
   docker image prune -f
   ```

3. **Monitor Resources**
   - Docker Desktop → Settings → Resources
   - Ensure adequate disk space (60GB+)
   - Check CPU/Memory limits

4. **Update Regularly**
   - Docker Desktop auto-updates
   - Keep Node.js updated in base images
   - Update dependencies: `npm update`
