# Docker Development Setup Guide

## Prerequisites

### Windows Setup
1. **Docker Desktop** must be installed and running
   - Download from: https://www.docker.com/products/docker-desktop
   - Ensure "Use WSL 2 based engine" is enabled in Settings
   - Verify status: Whale icon in system tray should show "Engine Running"

2. **Verify Docker is Running**
   ```bash
   docker info
   ```
   Should show server information without errors.

### Common Docker Desktop Issues on Windows

#### Issue: "failed to connect to the docker API at npipe"
**Solution:**
1. Open Docker Desktop from Start Menu
2. Wait 30-60 seconds for engine to fully start
3. Check system tray icon - it should be stable (not animating)
4. If stuck, restart Docker Desktop: Right-click tray icon → Restart

#### Issue: Apps in VibeFileExplorer show "daemon marked as down"
**Solution:**
1. This app automatically falls back to local execution when Docker is unavailable
2. To use Docker properly:
   - Start Docker Desktop
   - Wait for engine to be ready
   - Click "Retry" in the error toast
   - Or refresh the app list (refresh icon in Explorer)

## Docker Container Development

### Network Configuration for AI Chat Tooling

When developing inside Docker containers, AI chat tools need proper networking:

#### 1. Host Access from Containers
Containers use `host.docker.internal` to reach services on the host machine:
```dockerfile
# In Dockerfile.dev - already configured
ENV API_HOST=host.docker.internal
ENV NEXT_PUBLIC_API_URL=http://host.docker.internal:3000
```

#### 2. Port Binding
The standard dev port (5050) is mapped for preview:
```dockerfile
EXPOSE 5050
```
Run command:
```bash
docker run -d -p 5050:5050 --name app-name image-name
```

#### 3. Volume Mounts for Live Development
For hot reload and file watching:
```bash
docker run -d \
  -p 5050:5050 \
  -v "$(pwd):/app" \
  -v /app/node_modules \
  --name app-name \
  image-name
```

#### 4. Environment Variables
Pass required env vars to container:
```bash
docker run -d \
  -p 5050:5050 \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -e NGROK_AUTHTOKEN=$NGROK_AUTHTOKEN \
  --name app-name \
  image-name
```

### Dockerfile.dev Best Practices

Standard structure for Vite/React apps:
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Expose preview port
EXPOSE 5050

# Start development server with host binding
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5050"]
```

**Key Points:**
- `--host 0.0.0.0` - Required for Docker networking
- `--port 5050` - Standard preview port for this app
- `--legacy-peer-deps` - Handles dependency conflicts gracefully

### Vite Configuration for Docker

Add to `vite.config.ts`:
```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Listen on all interfaces
    port: 5050,
    strictPort: true, // Fail if port is busy
    allowedHosts: true, // Allow ngrok tunnels
    watch: {
      usePolling: true, // Required for Docker volume watches
      interval: 1000
    }
  }
})
```

## AI Chat Tooling in Docker Containers

### Architecture
```
┌─────────────────┐
│  Host Machine   │
│  (Windows)      │
│                 │
│  ┌───────────┐  │
│  │ TaskFlow  │  │  Port 3000
│  │ Main App  │◄─┼── AI Chat Server
│  └───────────┘  │
│                 │
│  ┌───────────┐  │
│  │  Ngrok    │  │  Port 4040
│  │  Tunnel   │◄─┼── Public URL API
│  └───────────┘  │
└─────────────────┘
        │ host.docker.internal
        ▼
┌─────────────────┐
│ Docker Container│
│                 │
│  ┌───────────┐  │
│  │  Your App │  │  Port 5050
│  │  (Vite)   │◄─┼── Preview
│  └───────────┘  │
│                 │
│  Accesses host  │
│  via API calls  │
└─────────────────┘
```

### Tool Execution

1. **File Operations** - Execute on host, not in container
2. **API Calls** - Route through `host.docker.internal`
3. **Process Management** - Container lifecycle managed by host4. **Live Preview** - Port forwarded from container to host

### Testing Your Setup

1. **Start Docker Desktop** (most important!)
2. **Build a test app:**
   ```bash
   cd apps/test-app-2
   docker build -t test-app -f Dockerfile.dev .
   docker run -d --name test-app -p 5050:5050 test-app
   ```
3. **Check logs:**
   ```bash
   docker logs test-app --tail 50
   ```
4. **Visit preview:**
   ```
   http://localhost:5050
   ```

### Fallback Mode

If Docker is unavailable, apps automatically run in **Local Fallback Mode**:
- Executes `npm run dev` directly on host
- Uses same port (5050)
- No container isolation
- Faster startup
- ⚠️ "Docker-only" features won't work

## Troubleshooting

### Logs say "daemon marked as down"
1. Check Docker Desktop is running
2. Run `docker info` - should succeed
3. Check Windows Services: "Docker Desktop Service" should be "Running"
4. Restart Docker Desktop if needed

### Port 5050 already in use
```bash
# Windows PowerShell
$proc = (Get-NetTCPConnection -LocalPort 5050 -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess
if ($proc) { Stop-Process -Id $proc -Force }
```

### Container won't start - build errors
```bash
# Check build logs
docker build -t app-name -f Dockerfile.dev . --progress=plain

# Common fixes:
# 1. Clear npm cache
docker build --no-cache -t app-name -f Dockerfile.dev .

# 2. Check node_modules conflicts
rm -rf node_modules
docker build -t app-name -f Dockerfile.dev .
```

### AI chat tool can't modify files
- AI tools execute on **host**, not inside container
- File changes are synced via volume mounts (if configured)
- For live dev, ensure `-v "$(pwd):/app"` is used

## Performance Tips

1. **Use `.dockerignore`** to exclude unnecessary files:
   ```
   node_modules
   .git
   dist
   .env.local
   ```

2. **Layer caching** - Keep `COPY package*.json` before `COPY . .`

3. **Development vs Production**
   - Dev: Use Dockerfile.dev with hot reload
   - Prod: Use Dockerfile with nginx for static builds

4. **Resource limits** - In Docker Desktop Settings:
   - Memory: 4GB minimum (8GB recommended)
   - CPUs: 2 minimum (4 recommended)
   - Disk: 60GB minimum

## Integration with TaskFlow

### Process Registry
All Docker apps are tracked in the database:
- Type: `docker-app` or `docker-dev`
- Metadata includes: `containerName`, `imageName`, `runMode`
- Status synced automatically every 2 minutes

### VibeFileExplorer Controls
- **Play button** - Starts app in Docker (or local if daemon down)
- **Stop button** - Stops container and cleans up
- **Mode badge** (dev/prod) - Click to toggle Dockerfile

### AI Chat Integration
When AI chat tools need to work with your app:
1. Tools run on **host machine**
2. File operations work directly on source files
3. Container rebuilds automatically when needed
4. Preview URLs are generated with ngrok tunnels
