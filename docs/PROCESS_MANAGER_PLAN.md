# Process Manager & Health Monitoring System - Implementation Plan

## Overview

Create a centralized process management system within TaskFlow that allows users to:
1. View all running development servers and background processes
2. Start/stop processes from the UI
3. Monitor health via automatic health checks
4. Configure external tools and integrations
5. View real-time logs and status

---

## Feature Breakdown

### 1. Process Registry & Monitoring

**Database Schema:**
```prisma
model ProcessRegistry {
  id          String   @id @default(cuid())
  name        String   // "Main App", "test-app-demo"
  type        String   // "dev-server", "background-job", "external-tool"
  port        Int?     // Port if applicable
  pid         Int?     // Process ID
  path        String   // Working directory
  command     String   // Command that started it
  status      String   // "running", "stopped", "error", "healthy", "unhealthy"
  healthUrl   String?  // URL to check health (e.g., http://localhost:3000/api/health)
  startedAt   DateTime @default(now())
  stoppedAt   DateTime?
  lastHealthCheck DateTime?
  healthStatus    String? // "healthy", "unhealthy", "unknown"
  metadata    Json?    // Additional data (env vars, config, etc.)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model ToolConfiguration {
  id          String   @id @default(cuid())
  name        String   @unique // "firebase-cli", "vercel-cli", etc.
  type        String   // "cli", "api", "service"
  enabled     Boolean  @default(true)
  config      Json     // Configuration object
  healthCheck Json?    // { url, interval, timeout }
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

---

### 2. Process Manager UI Component

**Location:** `src/components/ProcessManager.tsx`

**Features:**
- **Process List** - Show all registered processes
- **Status Indicators** - Color-coded health status
- **Action Buttons** - Start/Stop/Restart/View Logs
- **Health Metrics** - Uptime, response time, error count
- **Port Detection** - Auto-detect apps running on common ports
- **Log Viewer** - Stream and view process logs

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ Process Manager                          [+ New]    │
├─────────────────────────────────────────────────────┤
│ ● Main App                    Port: 3000  ✓ Healthy │
│   /c/Users/Drod/Source/a                            │
│   Uptime: 12h 48m  |  Response: 45ms                │
│   [View Logs] [Restart] [Stop]                      │
├─────────────────────────────────────────────────────┤
│ ● test-app-demo              Port: 5173  ✓ Healthy │
│   /c/Users/Drod/Source/a/apps/test-app-demo        │
│   Uptime: 5m 43s  |  Response: 32ms                 │
│   [View Logs] [Restart] [Stop]                      │
├─────────────────────────────────────────────────────┤
│ ○ Firebase Functions        Port: 5001  ⚠ Stopped  │
│   /c/Users/Drod/Source/a/functions                 │
│   [Start] [Configure]                               │
└─────────────────────────────────────────────────────┘
```

---

### 3. Server Actions

**File:** `src/app/processActions.ts`

**Actions:**
```typescript
// List all running processes
export async function listProcesses()

// Register a new process
export async function registerProcess(data: ProcessInput)

// Start a process
export async function startProcess(id: string)

// Stop a process
export async function stopProcess(id: string)

// Restart a process
export async function restartProcess(id: string)

// Get process logs
export async function getProcessLogs(id: string, lines?: number)

// Run health check
export async function checkProcessHealth(id: string)

// Auto-discover running processes on common ports
export async function discoverProcesses()
```

---

### 4. Health Check System

**File:** `src/lib/healthChecker.ts`

**Features:**
- Auto-ping health endpoints every 30 seconds
- Check HTTP status codes
- Measure response times
- Track error rates
- Alert on failures

**Health Check Types:**
1. **HTTP Ping** - GET request to health endpoint
2. **Port Check** - Verify port is listening
3. **Process Check** - Verify PID exists
4. **Custom Script** - Run custom health validation

**Example:**
```typescript
interface HealthCheck {
  type: 'http' | 'port' | 'process' | 'script';
  url?: string;           // For HTTP checks
  port?: number;          // For port checks
  pid?: number;           // For process checks
  script?: string;        // For custom scripts
  interval: number;       // Check interval in ms
  timeout: number;        // Timeout in ms
  retries: number;        // Retry attempts
}
```

---

### 5. External Tool Configuration

**File:** `src/components/ToolConfigModal.tsx`

**Supported Tools:**
- Firebase CLI
- Vercel CLI
- Supabase CLI
- Docker
- Git
- Custom scripts

**Configuration UI:**
```
┌──────────────────────────────────────┐
│ Tool Configuration                   │
├──────────────────────────────────────┤
│ Firebase CLI                   [✓]   │
│ Path: /usr/local/bin/firebase       │
│ Health: firebase --version           │
│ [Test] [Save]                        │
├──────────────────────────────────────┤
│ Vercel CLI                     [✓]   │
│ Path: /usr/local/bin/vercel         │
│ Health: vercel --version             │
│ [Test] [Save]                        │
└──────────────────────────────────────┘
```

**Config Schema:**
```json
{
  "tools": {
    "firebase": {
      "enabled": true,
      "path": "firebase",
      "healthCheck": "firebase --version",
      "projects": ["main", "staging"]
    },
    "vercel": {
      "enabled": true,
      "path": "vercel",
      "healthCheck": "vercel --version"
    }
  }
}
```

---

### 6. Process Discovery

**Auto-detect processes on startup:**
```typescript
// Check common development ports
const commonPorts = [3000, 3001, 5173, 5174, 8080, 8081, 4200, 5000, 5001];

for (const port of commonPorts) {
  const process = await detectProcessOnPort(port);
  if (process) {
    await registerProcess({
      name: `App on :${port}`,
      port,
      pid: process.pid,
      status: 'running'
    });
  }
}
```

---

### 7. Integration Points

**Add to Sidebar Navigation:**
```tsx
<nav>
  {/* ... existing items ... */}
  <NavItem icon={Activity} href="/processes">
    Process Manager
  </NavItem>
</nav>
```

**Add Status Bar Widget:**
```tsx
<StatusBar>
  <ProcessIndicator>
    ● 2 running  ○ 1 stopped
  </ProcessIndicator>
</StatusBar>
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (Day 1)
- [ ] Add database models (ProcessRegistry, ToolConfiguration)
- [ ] Create server actions for process management
- [ ] Implement process discovery
- [ ] Build basic UI component

### Phase 2: Health Monitoring (Day 2)
- [ ] Implement health check system
- [ ] Add health status indicators
- [ ] Create health check scheduler
- [ ] Build alerting system

### Phase 3: Tool Configuration (Day 3)
- [ ] Create tool configuration UI
- [ ] Add preset configurations (Firebase, Vercel, etc.)
- [ ] Implement tool testing/validation
- [ ] Build integration helpers

### Phase 4: Polish & Features (Day 4)
- [ ] Add log viewer
- [ ] Implement process restart
- [ ] Add metrics dashboard
- [ ] Create quick actions menu

---

## API Examples

### Start a Process
```typescript
const result = await startProcess({
  name: 'My New App',
  command: 'npm run dev',
  path: 'c:/Users/Drod/Source/a/apps/my-new-app',
  port: 5174,
  healthCheck: {
    type: 'http',
    url: 'http://localhost:5174',
    interval: 30000
  }
});
```

### Stop a Process
```typescript
await stopProcess('clx123abc');
```

### Check Health
```typescript
const health = await checkProcessHealth('clx123abc');
// Returns: { status: 'healthy', responseTime: 45, lastCheck: Date }
```

---

## Benefits

1. **Centralized Control** - Manage all dev servers from one place
2. **Visibility** - See what's running at a glance
3. **Health Monitoring** - Know when something breaks
4. **Quick Actions** - Stop/restart with one click
5. **Extensibility** - Add custom tools and integrations
6. **Developer Experience** - Streamlined workflow

---

## Technical Considerations

### Windows Compatibility
- Use PowerShell commands for process management
- Handle process PIDs correctly
- Support Windows paths

### Security
- Validate all process commands
- Restrict to workspace directory
- Sanitize inputs

### Performance
- Throttle health checks
- Cache process status
- Use background jobs for monitoring

---

## Next Steps

1. **Approve this plan**
2. **Run database migration** to add new tables
3. **Implement Phase 1** (core functionality)
4. **Test with existing processes**
5. **Iterate based on usage**

---

**Estimated Implementation Time:** 2-3 days  
**Complexity:** Medium  
**Impact:** High (significantly improves developer workflow)
