# Process Registry & Real-Time Broadcasting

## Purpose
This skill documents the pattern for managing the process registry with real-time WebSocket broadcasting to keep all clients in sync.

## Core Pattern

### Always Broadcast After State Changes
Every function that modifies process state must call `broadcastProcesses()` to notify all connected clients:

```typescript
// After any database mutation
await prisma.processRegistry.update({ ... });

// Always broadcast (non-blocking, catch errors)
broadcastProcesses().catch(() => { });
```

### Key Functions That Must Broadcast

1. **registerProcess** - New process created
2. **stopProcess** - Process stopped
3. **restartProcess** - Process restarted
4. **startProcess** - Process started/hooked
5. **deleteProcess** - Process deleted
6. **discoverProcesses** - New processes discovered
7. **reconfigureProcessPort** - Port changed

### Non-Blocking Pattern

```typescript
// CORRECT - Non-blocking, won't fail the operation
broadcastProcesses().catch(() => { });

// WRONG - Blocking, could fail the operation
await broadcastProcesses();
```

## List Processes Optimization

### Background Sync Pattern (processActions.ts:96-183)

The new optimized pattern separates sync from read:

```typescript
export async function listProcesses(options = {}) {
    const { page = 1, limit = 100, triggerBackgroundSync = true } = options;

    // 1. Trigger background sync (non-blocking)
    if (triggerBackgroundSync) {
        syncProcessesInBackground(user.id).catch(err =>
            console.warn('Background process sync failed:', err)
        );
    }

    // 2. Quick broadcast (ensures clients get current DB state)
    broadcastProcesses().catch(() => { });

    // 3. Fast read from database (doesn't wait for sync)
    const [processes, total] = await Promise.all([
        prisma.processRegistry.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit
        }),
        prisma.processRegistry.count({ where: { userId: user.id } })
    ]);

    return {
        success: true,
        processes: deepSerialize(processes),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
}
```

### Key Benefits
- **Non-blocking**: UI doesn't wait for Docker sync
- **Fast reads**: Returns cached data immediately
- **Eventually consistent**: Sync happens in background
- **Pagination**: Handles large process lists efficiently

### Background Sync Function

```typescript
async function syncProcessesInBackground(userId: string): Promise<void> {
    try {
        await Promise.allSettled([
            syncDockerAppProcesses(userId),
            syncRepoAppProcesses(userId)
        ]);
    } catch (e: any) {
        if (isDockerDaemonUnavailable(e)) {
            console.warn('Docker daemon unavailable; skipping sync');
        } else {
            console.error('Background sync error:', e);
        }
    } finally {
        // Always broadcast after sync attempt
        broadcastProcesses().catch(() => { });
    }
}
```

## Manual Refresh

For "Refresh" buttons that need immediate sync:

```typescript
export async function refreshProcesses() {
    const user = await getDemoUser();

    // 1. Clear sync cooldown to force sync
    const { clearSyncCooldown } = await import('@/lib/processActionsCore');
    clearSyncCooldown(user.id);

    // 2. Force sync
    await syncProcessesInBackground(user.id);

    // 3. Return fresh data (skip background trigger)
    return listProcesses({ triggerBackgroundSync: false });
}
```

## WebSocket Broadcasting

### Backend (processSocket.ts)
```typescript
import { processSocket } from '@/lib/processSocket';

// Broadcast to all connected clients
export async function broadcastProcesses() {
    const processes = await prisma.processRegistry.findMany({
        orderBy: { createdAt: 'desc' }
    });

    processSocket.broadcast('processes:update', {
        processes: deepSerialize(processes)
    });
}
```

### Frontend (React)
```typescript
useEffect(() => {
    const socket = processSocket.connect();

    socket.on('processes:update', (data) => {
        setProcesses(data.processes);
    });

    return () => socket.disconnect();
}, []);
```

## Sync Cooldown Pattern

To prevent excessive Docker queries, use cooldown:

```typescript
// In processActionsCore.ts
const lastSync: { [key: string]: number } = {};
const SYNC_COOLDOWN = 30000; // 30 seconds

export const syncDockerAppProcesses = async (userId: string) => {
    const now = Date.now();
    if (lastSync[`docker-${userId}`] &&
        now - lastSync[`docker-${userId}`] < SYNC_COOLDOWN) {
        return; // Skip if synced recently
    }

    // Perform sync...
    lastSync[`docker-${userId}`] = now;
};

export const clearSyncCooldown = (userId: string) => {
    delete lastSync[`docker-${userId}`];
    delete lastSync[`repo-${userId}`];
};
```

## Common Patterns

### After Container Operations
```typescript
// Hook into existing container
const updated = await prisma.processRegistry.update({ ... });
broadcastProcesses().catch(() => { });

return {
    success: true,
    message: 'Hooked into existing container',
    process: deepSerialize(updated)
};
```

### In Finally Blocks
```typescript
try {
    // Docker operations
} catch (error) {
    // Handle error
} finally {
    // Always broadcast, even if operation failed
    broadcastProcesses().catch(() => { });
}
```

### Discovery Operations
```typescript
// After discovering new processes
for (const port of commonPorts) {
    const p = await prisma.processRegistry.create({ ... });
    discovered.push(p);
}

broadcastProcesses().catch(() => { });
return { success: true, discovered };
```

## Error Handling

### Graceful Degradation
```typescript
// Broadcast should never fail the main operation
try {
    await updateProcess();
} catch (error) {
    return { success: false, message: error.message };
}

// Separate broadcast (won't affect return)
broadcastProcesses().catch(err => {
    console.warn('Broadcast failed:', err);
    // Don't throw - this is non-critical
});
```

## Performance Considerations

1. **Cooldown prevents spam**: 30s between Docker syncs
2. **Background sync**: UI doesn't wait
3. **Pagination**: Handles 100+ processes efficiently
4. **Quick broadcast**: Shares DB state even when sync skipped
5. **Non-blocking**: Never awaits broadcast

## Testing Checklist

- [ ] All process mutations call broadcast
- [ ] Broadcast is non-blocking (.catch())
- [ ] List operations use pagination
- [ ] Background sync has cooldown
- [ ] Refresh button clears cooldown
- [ ] WebSocket reconnects on disconnect
- [ ] Frontend handles updates gracefully

## Related Files

- `src/lib/processSocket.ts` - WebSocket implementation
- `src/lib/processActionsCore.ts` - Sync cooldown logic
- `src/app/processActions.ts` - All process mutations
