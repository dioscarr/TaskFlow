# Docker Container Hooking Skill

## Purpose
This skill provides context for working with the Docker container detection and hooking pattern implemented in the VibeFileExplorer. It enables apps to connect to already-running Docker containers instead of rebuilding them, significantly improving startup performance.

## Background
The VibeFileExplorer component displays apps in the `apps/` directory and allows users to start/stop them. Previously, clicking "start" would always trigger a full Docker rebuild even if the container was already running. This was slow and wasteful.

## Implementation Pattern

### Core Logic (processActions.ts:479-582)
The `startProcess` function now follows a three-tier detection strategy:

1. **Check if container is running**
   - Uses `docker inspect --format '{{.State.Running}}|{{.NetworkSettings.Ports}}' <containerName>`
   - Extracts running status and port mapping
   - If running: updates registry with existing port, returns immediately
   - Message: `Hooked into existing {app} container`

2. **Check if container exists but is stopped**
   - If inspect succeeds but container is not running
   - Uses `docker start <containerName>` (fast restart)
   - Extracts port from `docker port <containerName>`
   - Message: `Restarted {app} container`

3. **Container doesn't exist**
   - Falls through to normal build process
   - `docker build` + `docker run`
   - Message: `Started {app}`

### Key Code Snippets

```typescript
// Detection pattern
try {
    const { stdout: inspectOut } = await dockerExec([
        'inspect', '--format',
        '{{.State.Running}}|{{.NetworkSettings.Ports}}',
        containerName
    ]);
    const [runningStatus, portsJson] = inspectOut.trim().split('|');
    containerExists = true;
    isRunning = runningStatus === 'true';

    if (isRunning) {
        const portMatch = portsJson.match(/HostPort:(\d+)/);
        runningPort = portMatch ? parseInt(portMatch[1]) : undefined;
    }
} catch (inspectError) {
    // Container doesn't exist
    containerExists = false;
}
```

### Frontend Integration (VibeFileExplorer.tsx:101-137)
The UI detects which scenario occurred and shows appropriate feedback:

```typescript
const res = await manageAppLifecycle({
    action: 'start',
    target: appName,
    stopOthers,
    runMode
}) as any;

if (res.success) {
    const isExisting = res.message?.includes('Hooked into existing');
    const isRestarted = res.message?.includes('Restarted');

    if (isExisting) {
        toast.success(`🔗 Connected to running ${appName}`);
    } else if (isRestarted) {
        toast.success(`▶️ Restarted ${appName}`);
    } else {
        toast.success(`🎉 ${appName} is ready!`);
    }

    // Set preview URL and refresh
    if (res.previewUrl) {
        window.dispatchEvent(new CustomEvent('set-vibe-preview', {
            detail: res.previewUrl
        }));
    }
    await loadEntries();
}
```

## Performance Benefits

| Scenario | Old Approach | New Approach | Time Saved |
|----------|--------------|--------------|------------|
| Already Running | Full rebuild + restart | Hook into existing | ~2-5 minutes |
| Stopped Container | Full rebuild | `docker start` | ~1-3 minutes |
| New Container | Full rebuild | Full rebuild | 0 |

## Related Files

### Modified Files
- `src/app/processActions.ts` - Core detection logic
- `src/components/VibeFileExplorer.tsx` - UI integration
- `src/lib/processActionsCore.ts` - Helper utilities

### Key Functions
- `startProcess(id)` - Main entry point in processActions.ts
- `dockerExec(args)` - Safe Docker command execution
- `ensurePublicAccess(processId, port)` - Ngrok tunnel setup
- `manageAppLifecycle(args)` - High-level lifecycle management

## Container Metadata Modes

The system tracks how a container was started via metadata:

```typescript
metadata: {
    mode: 'docker-existing'  // Hooked into running container
    mode: 'docker-restarted' // Restarted stopped container
    mode: 'docker-new'       // Newly built and started
    mode: 'local-fallback'   // Docker unavailable, running locally
}
```

## Ngrok Integration

After hooking/starting a container, the system automatically:
1. Ensures public access via `ensurePublicAccess(processId, port)`
2. Sets up Ngrok tunnel if not already active
3. Updates process registry with `publicUrl`
4. Broadcasts to all clients via WebSocket

## Docker Safety

All Docker commands use `dockerExec()` which:
- Uses `execFile` instead of `exec` to prevent shell injection
- Passes arguments as array (not string concatenation)
- Has timeout protection (default 30s, build 300s)
- Handles daemon unavailability gracefully

## Common Issues

### Port Parsing
Docker's port format: `map[3000/tcp:[map[HostIp:0.0.0.0 HostPort:5050]]]`
- Use regex: `/HostPort:(\d+)/` to extract host port
- Fallback to `docker port <container>` if inspect fails

### Container Name Normalization
```typescript
const safeName = folderName
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .toLowerCase();
```

### Docker Daemon Detection
```typescript
const dockerIsUp = await checkDockerAvailability();
if (!dockerIsUp) {
    // Fall back to local execution (npm run dev)
    throw dockerError;
}
```

## Testing Scenarios

1. **Start app when container running**: Should hook instantly
2. **Start app when container stopped**: Should restart (no build)
3. **Start app when no container**: Should build and run
4. **Docker daemon down**: Should fall back to local execution
5. **Port conflicts**: Should kill process on port before starting

## Future Enhancements

- [ ] Add health check before hooking
- [ ] Support hooking into containers with different ports
- [ ] Add container resource monitoring
- [ ] Implement container cleanup on app deletion
- [ ] Add live logs viewer integration
- [ ] Support Docker Compose multi-container apps

## Usage in Conversations

When working with Docker container management in this codebase:
1. Reference this skill for the hooking pattern
2. Maintain the three-tier detection strategy
3. Use the metadata modes for tracking
4. Follow the safe dockerExec pattern
5. Always handle daemon unavailability

## Related Skills

- `docker-ops.md` - General Docker operations
- `docker-containerize.md` - App containerization guide
