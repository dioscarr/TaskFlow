# Error Handling Patterns

## Purpose
Documents the error handling patterns and utilities used throughout the codebase for better user experience and debugging.

## Docker Error Handling

### Actionable Error Messages (dockerErrors.ts)

```typescript
import { getActionableError, isDockerDaemonError, formatErrorForLog } from '@/lib/dockerErrors';

// Convert technical Docker errors to user-friendly messages
try {
    await dockerExec(['build', '-t', imageName, context]);
} catch (error: any) {
    const actionable = getActionableError(error, 'build image');

    // Log technical details
    console.error(formatErrorForLog(error, 'Docker build'));

    // Return user-friendly message
    return { success: false, message: actionable };
}
```

### Daemon Detection Pattern

```typescript
import { isDockerDaemonError, isDockerDaemonUnavailable } from '@/lib/dockerErrors';

const dockerIsUp = await checkDockerAvailability();
if (!dockerIsUp) {
    console.warn('[App] Docker daemon unavailable. Attempting local fallback...');

    // Trigger local fallback
    const dockerError = {
        message: 'daemon',
        isDaemonError: true,
        stderr: 'daemon'
    };
    throw dockerError;
}

// Later in catch block
catch (error: any) {
    const isDaemonError = isDockerDaemonError(error);

    if (isDaemonError) {
        // Fall back to local execution
        console.log('⚠️ Docker Daemon unreachable. Falling back to local...');
        // ... local fallback logic
    } else {
        // Other error - report to user
        return { success: false, message: error.message };
    }
}
```

### Silent Docker Failures

```typescript
// In background sync operations
try {
    await Promise.allSettled([
        syncDockerAppProcesses(userId),
        syncRepoAppProcesses(userId)
    ]);
} catch (e: any) {
    if (isDockerDaemonUnavailable(e)) {
        console.warn('Docker daemon unavailable; skipping docker process sync');
        // Don't throw - continue with degraded functionality
    } else {
        throw e;  // Re-throw unexpected errors
    }
}
```

## Standard Response Pattern

### Server Actions
```typescript
export async function myAction(input: SomeInput) {
    try {
        // Validate input
        if (!input.required) {
            return {
                success: false,
                message: 'Required field missing: required'
            };
        }

        // Main logic
        const result = await doSomething(input);

        return {
            success: true,
            message: 'Operation completed successfully',
            data: deepSerialize(result)
        };
    } catch (error: any) {
        // Log technical details
        console.error('Error in myAction:', error);

        // Return user-friendly message
        return {
            success: false,
            message: error.message || 'Operation failed'
        };
    }
}
```

### Client-Side Handling
```typescript
const handleAction = async () => {
    try {
        const res = await myAction(input);

        if (res.success) {
            toast.success(res.message);
            onSuccess(res.data);
        } else {
            toast.error(res.message);
            onError();
        }
    } catch (error: any) {
        // Unexpected client error
        toast.error('An unexpected error occurred');
        console.error('Client error:', error);
    }
};
```

## Validation Errors

### Early Return Pattern
```typescript
export async function updateResource(id: string, data: UpdateData) {
    const user = await getDemoUser();

    // Ownership check
    const existing = await prisma.appResource.findFirst({
        where: { id, userId: user.id }
    });

    if (!existing) {
        return {
            success: false,
            message: 'Resource not found'
        };
    }

    // Validation
    if (data.slug && data.slug !== existing.slug) {
        const slugExists = await prisma.appResource.findFirst({
            where: { userId: user.id, slug: data.slug, id: { not: id } }
        });

        if (slugExists) {
            return {
                success: false,
                message: `Resource with slug "${data.slug}" already exists`
            };
        }
    }

    // Proceed with update
    const updated = await prisma.appResource.update({ ... });
    return { success: true, resource: updated };
}
```

## Process Lifecycle Errors

### Graceful Degradation
```typescript
// Try Docker first, fallback to local
try {
    const dockerIsUp = await checkDockerAvailability();
    if (!dockerIsUp) {
        throw { isDaemonError: true };
    }

    // Docker operations
    await dockerExec(['build', ...]);
    await dockerExec(['run', ...]);

    return {
        success: true,
        message: 'Started in Docker',
        mode: 'docker'
    };
} catch (dockerError: any) {
    if (isDockerDaemonError(dockerError)) {
        // Fallback to local
        const child = exec(localCommand, { cwd: appPath });

        return {
            success: true,
            message: 'Docker unavailable. Started locally.',
            mode: 'local-fallback'
        };
    }

    return {
        success: false,
        message: 'Failed to start: ' + dockerError.message
    };
}
```

## Port Conflict Handling

### Kill and Retry Pattern
```typescript
const port = await getAvailablePort(5000, 5999);

// Try to kill anything on this port
try {
    await execAsync(
        `powershell -Command "$proc = (Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -ne 0 } | Select-Object -First 1).OwningProcess; if ($proc) { Stop-Process -Id $proc -Force }"`
    );
} catch (e) {
    // Ignore if nothing running
}

// Verify port is actually available
if (!(await isPortAvailable(port))) {
    return {
        success: false,
        message: `Port ${port} is already in use and could not be freed`
    };
}
```

## Async Error Handling

### Promise.allSettled Pattern
```typescript
// When some failures are acceptable
const results = await Promise.allSettled([
    syncDockerAppProcesses(userId),
    syncRepoAppProcesses(userId),
    syncSystemProcesses(userId)
]);

const successes = results.filter(r => r.status === 'fulfilled');
const failures = results.filter(r => r.status === 'rejected');

if (failures.length > 0) {
    console.warn(`${failures.length} sync operations failed`);
}

return { success: successes.length > 0 };
```

### Promise.all vs allSettled
```typescript
// Use Promise.all when all must succeed
const [user, settings, profile] = await Promise.all([
    getUser(),
    getSettings(),
    getProfile()
]);
// Throws if any fail

// Use Promise.allSettled when some can fail
const results = await Promise.allSettled([
    optionalOperation1(),
    optionalOperation2(),
    optionalOperation3()
]);
// Never throws, check individual results
```

## Timeout Handling

### Command Execution Timeouts
```typescript
async function dockerExec(args: string[], options = {}) {
    return execFileAsync('docker', args, {
        timeout: options.timeout || 30000,  // 30s default
        maxBuffer: 10 * 1024 * 1024  // 10MB
    });
}

// Override for long operations
try {
    await dockerExec(['build', '-t', imageName, context], {
        timeout: 300000  // 5 minutes for builds
    });
} catch (error: any) {
    if (error.killed && error.signal === 'SIGTERM') {
        return {
            success: false,
            message: 'Build timed out after 5 minutes'
        };
    }
    throw error;
}
```

## User-Facing Error Messages

### Context-Aware Messages
```typescript
// ❌ BAD - Technical jargon
return {
    success: false,
    message: 'ECONNREFUSED: Connection refused at pipe/docker_engine'
};

// ✅ GOOD - Actionable guidance
return {
    success: false,
    message: 'Docker Desktop is not running. Please start Docker Desktop and try again.'
};
```

### Error Message Guidelines
1. **Be specific**: "Port 5050 is in use" not "Port unavailable"
2. **Suggest action**: "Please stop the other app" not "Cannot proceed"
3. **Avoid jargon**: "Docker not running" not "Daemon unreachable"
4. **Include context**: "Failed to build my-app" not "Build failed"

## Logging Best Practices

### Structured Logging
```typescript
// Console logs for debugging
console.log(`✓ Container ${containerName} already running on port ${port}`);
console.warn('Docker daemon unavailable; falling back to local');
console.error('Error starting process:', error);

// Format for logs
console.error(formatErrorForLog(error, 'Docker container start'));
// Output: [Docker container start] Error: ENOENT - Detailed stack trace...
```

### Production Logging
```typescript
// In production, consider using a logging service
if (process.env.NODE_ENV === 'production') {
    logger.error('Process failed', {
        processId: id,
        error: error.message,
        stack: error.stack,
        userId: user.id,
        timestamp: new Date().toISOString()
    });
}
```

## Error Recovery Strategies

### Retry with Backoff
```typescript
async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries - 1) throw error;

            const delay = baseDelay * Math.pow(2, i);
            console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw new Error('Should not reach here');
}

// Usage
const tunnelUrl = await retryWithBackoff(
    () => fetch('http://localhost:4040/api/tunnels'),
    3,
    500
);
```

## Related Files

- `src/lib/dockerErrors.ts` - Docker error utilities
- `src/lib/processActionsCore.ts` - Process error handling
- `src/app/processActions.ts` - Action error patterns
