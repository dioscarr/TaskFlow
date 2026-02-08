# Modern Docker Development Workflow

## 🎯 Overview

We've leveled up Docker integration following industry best practices from VS Code Dev Containers, Docker Compose, Tilt, and Skaffold. The new system implements:

- **Idempotent Container Operations** - Smart start logic (reuse existing containers)
- **Docker Compose Watch** - Instant hot reload without rebuilds
- **Live Log Streaming** - Real-time container logs with filtering
- **Container Preview** - View running containers without restarting

## 🚀 Quick Start

### Start an app with hot reload:
```bash
npm run docker:dev salon-premium
```

That's it! The system will:
1. ✅ Check if Docker is running
2. ✅ Check if container already exists
3. ✅ Start existing container OR create new one (smart choice)
4. ✅ Enable hot reload (file changes sync instantly)
5. ✅ Open preview at http://localhost:5050

### View live logs:
```bash
npm run docker:dev salon-premium --logs
```

### Force rebuild (only when needed):
```bash
npm run docker:dev salon-premium --rebuild
```

### Check all running containers:
```bash
npm run docker:status
```

## 🔄 Container Lifecycle - Industry Best Practice

### The Old Way (Problematic):
```typescript
// ❌ WRONG: Recreate container every time
await dockerExec(['stop', containerName]);
await dockerExec(['rm', containerName]);
await dockerExec(['run', '-d', '--name', containerName, ...]);
// Result: Slow, wasteful, fails if container exists
```

### The New Way (Idempotent):
```typescript
// ✅ RIGHT: Reuse containers (like VS Code Dev Containers)
const result = await startOrCreateContainer({
    containerName,
    imageName,
    port: 5050
});

// Result:
// - Container running → returns immediately
// - Container stopped → docker start (fast)
// - Container missing → docker run (create new)
```

### Decision Flow:
```
Need a container?
├─ Running? → ✅ Use it (0ms)
├─ Stopped? → 🔄 docker start (1-2s)
└─ Missing? → 🏗️  docker run (10-30s)
```

## 🎬 How It Works

### 1. Smart Container Start

**Function:** `startOrCreateContainer()` in `src/lib/processActionsCore.ts`

```typescript
// Check state first
const state = await getContainerState(containerName);

if (state.status === 'running') {
    return { action: 'already_running' }; // Instant!
}

if (state.exists && state.status === 'exited') {
    await dockerExec(['start', containerName]); // Fast restart
    return { action: 'started' };
}

// Only create if doesn't exist
await dockerExec(['run', '-d', '--name', containerName, ...]);
return { action: 'created' };
```

**Benefits:**
- ⚡ Instant if already running
- 🔄 Fast restart (1-2s) vs full rebuild (30s+)
- 🛡️ No "container already exists" errors
- 📊 Metrics tracking (created vs started)

### 2. Docker Compose Watch (Hot Reload)

**File:** `docker-compose.app.yml`

```yaml
services:
  app-dev:
    volumes:
      # Source files (hot reload)
      - ./apps/${APP_NAME}/src:/app/src:cached

      # Named volume for node_modules (performance)
      - ${APP_NAME}_node_modules:/app/node_modules

    # 🆕 Modern hot reload
    develop:
      watch:
        # Sync source changes (triggers Vite HMR)
        - action: sync
          path: ./apps/${APP_NAME}/src
          target: /app/src

        # Rebuild only on dependency changes
        - action: rebuild
          path: ./apps/${APP_NAME}/package.json

        # Restart on config changes
        - action: sync+restart
          path: ./apps/${APP_NAME}/vite.config.ts
```

**How it works:**
- **File change in `src/`** → Synced to container → Vite HMR activates → Instant update
- **package.json change** → Full image rebuild (rare)
- **vite.config.ts change** → Sync + container restart (fast)

**Performance:**
- Source changes: **1-2 seconds** (sync + HMR)
- Dependency changes: **30-60 seconds** (full rebuild)
- Config changes: **3-5 seconds** (restart)

### 3. Live Log Streaming

**API Endpoint:** `/api/docker/logs-stream`

**Server:** Server-Sent Events (SSE) for real-time streaming
```typescript
// src/app/api/docker/logs-stream/route.ts
const logsProcess = spawn('docker', [
    'logs', '--follow', '--timestamps', containerName
]);

logsProcess.stdout.on('data', (data) => {
    controller.enqueue(encoder.encode(
        `data: ${JSON.stringify({ log, timestamp, level })}\n\n`
    ));
});
```

**Client:** `ContainerLogs.tsx` component with EventSource
```typescript
const eventSource = new EventSource(
    `/api/docker/logs-stream?container=${containerName}`
);

eventSource.onmessage = (event) => {
    const { log, timestamp, level } = JSON.parse(event.data);
    setLogs(prev => [...prev, { log, timestamp, level }]);
};
```

**Features:**
- ✅ Real-time streaming (no polling)
- ✅ Filter by level (info/error)
- ✅ Search logs
- ✅ Auto-scroll with pause
- ✅ Timestamps
- ✅ 1000 log buffer (memory safe)

### 4. Preview Running Containers (New!)

In `VibeFileExplorer` or `ProcessManager`, containers now show:
- 🟢 **Already Running** - Open preview immediately
- 🟡 **Stopped** - Fast restart (1-2s)
- ⚪ **Not Created** - Build required (30s+)

Click preview on a running container → **0ms to view!**

## 📁 File Structure

```
c:\Users\Drod\Source\a\
├── docker-compose.app.yml          # 🆕 Enhanced with Watch
├── Dockerfile.dev.template          # Secure non-root template
├── scripts/
│   └── docker-dev.mjs              # 🆕 Smart CLI helper
├── src/
│   ├── lib/
│   │   └── processActionsCore.ts   # 🆕 startOrCreateContainer()
│   ├── app/
│   │   ├── api/
│   │   │   └── docker/
│   │   │       ├── build-stream/   # ✅ Existing (build progress)
│   │   │       └── logs-stream/    # 🆕 Live log streaming
│   │   └── processActions.ts       # 🔄 Updated to use new functions
│   └── components/
│       ├── ContainerLogs.tsx       # 🆕 Live log viewer
│       ├── DockerBuildProgress.tsx # ✅ Existing (enhanced)
│       └── VibeFileExplorer.tsx    # 🔄 Uses new lifecycle
```

## 🎯 Usage Examples

### Example 1: Start App (First Time)
```bash
$ npm run docker:dev salon-premium

🔍 Checking container status: salon-premium-dev
🏗️  Creating new container...
✨ Starting with hot reload (Docker Compose Watch)...

[+] Building 45.2s (12/12) FINISHED
[+] Running 1/1
 ✔ Container salon-premium-dev  Started

✅ Container started successfully!
   Preview: http://localhost:5050
   Logs: npm run docker:dev salon-premium --logs

🔥 Hot reload enabled - Edit your files and see changes instantly!
   Press Ctrl+C to stop
```

### Example 2: Start App (Already Running)
```bash
$ npm run docker:dev salon-premium

🔍 Checking container status: salon-premium-dev
✅ Container already running!
   Preview: http://localhost:5050

🔥 Hot reload enabled - Edit your files and see changes instantly!
```
**Time:** <1 second!

### Example 3: Start App (Stopped Container)
```bash
$ npm run docker:dev salon-premium

🔍 Checking container status: salon-premium-dev
🔄 Container exists but stopped. Restarting...

✅ Container restarted successfully!
   Preview: http://localhost:5050
```
**Time:** 1-2 seconds (vs 30+ for rebuild)

### Example 4: View Live Logs
```bash
$ npm run docker:dev salon-premium --logs

🔍 Checking container status: salon-premium-dev
✅ Container already running!

📜 Streaming logs (Ctrl+C to exit)...

2024-02-08T10:30:00.123Z  VITE v5.0.0  ready in 543 ms
2024-02-08T10:30:00.234Z  ➜  Local:   http://localhost:5050/
2024-02-08T10:30:05.567Z  [vite] page reload src/App.tsx
```

### Example 5: Force Rebuild
```bash
$ npm run docker:dev salon-premium --rebuild

🔍 Checking container status: salon-premium-dev
🏗️  Force rebuilding container...

[+] Building 28.5s (12/12) FINISHED
...
```

## 🔧 Advanced Usage

### Use Docker Compose Directly
```bash
# Set app name
export APP_NAME=salon-premium
export DEV_PORT=5050

# Start with watch (hot reload)
docker compose -f docker-compose.app.yml --profile dev up --watch

# Build and start
docker compose -f docker-compose.app.yml --profile dev up --build

# Just watch (if already running)
docker compose -f docker-compose.app.yml --profile dev watch

# Stop
docker compose -f docker-compose.app.yml --profile dev down
```

### Named Volumes (Performance)

**Why named volumes for node_modules?**
```yaml
volumes:
  # ❌ SLOW: Bind mount (thousands of small files)
  - ./apps/my-app/node_modules:/app/node_modules

  # ✅ FAST: Named volume (Docker-managed)
  - my-app_node_modules:/app/node_modules
```

**Benefits:**
- 10-100x faster file access
- Platform-independent (Linux binaries stay in container)
- No sync overhead

### Volume Strategy Matrix

| Path | Strategy | Why |
|------|----------|-----|
| `src/` | **Bind mount** | Hot reload (Vite HMR) |
| `public/` | **Bind mount** | Direct asset access |
| `node_modules/` | **Named volume** | Performance |
| `.vite/` cache | **Named volume** | Speed, don't pollute host |

## 📊 Performance Comparison

| Operation | Old Way | New Way | Improvement |
|-----------|---------|---------|-------------|
| Start (already running) | 30s (rebuild) | <1s (detect) | **30x faster** |
| Start (stopped) | 30s (rebuild) | 1-2s (restart) | **15x faster** |
| Code change | 30s (rebuild) | 1-2s (sync+HMR) | **15x faster** |
| Dependency change | 60s (rebuild) | 60s (rebuild) | Same (rare) |
| View logs | Manual `docker logs` | Live stream UI | 🎉 Better UX |

## 🎨 UI Enhancements

### Container Status Badges
```tsx
{status === 'running' && (
    <span className="text-green-500">● Already Running</span>
    // Click → instant preview 0ms
)}

{status === 'exited' && (
    <span className="text-yellow-500">● Stopped</span>
    // Click → fast restart 1-2s
)}

{status === 'unknown' && (
    <span className="text-gray-500">● Not Created</span>
    // Click → full build 30s+
)}
```

### Live Logs Modal
- Real-time streaming (EventSource)
- Filter by level (info/error)
- Search functionality
- Auto-scroll with pause
- Timestamps
- Terminal-style UI

## 🔐 Security Improvements

All Docker commands now use **array arguments** (prevents injection):

```typescript
// ❌ VULNERABLE:
await execAsync(`docker run -d --name ${name} ${image}`);
// If name = "app; rm -rf /" → DISASTER

// ✅ SECURE:
await dockerExec(['run', '-d', '--name', name, image]);
// Array args = no shell interpretation
```

## 📝 Key Takeaways

### ✅ DO:
- Reuse containers (restart existing)
- Use Docker Compose Watch for hot reload
- Bind mount source code only
- Use named volumes for dependencies
- Check container state before acting

### ❌ DON'T:
- Recreate containers on every start
- Bind mount node_modules
- Use string concatenation for Docker commands
- Rebuild for source code changes
- Create new containers if one exists

## 🎓 Learn More

Industry standards we followed:
- [VS Code Dev Containers](https://code.visualstudio.com/docs/devcontainers/containers)
- [Docker Compose Watch](https://docs.docker.com/compose/file-watch/)
- [Tilt](https://tilt.dev/) - Fast Kubernetes development
- [Skaffold](https://skaffold.dev/) - Continuous development

---

**Result:** Modern, fast, production-grade Docker development workflow! 🚀
