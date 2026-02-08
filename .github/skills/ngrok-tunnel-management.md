# Ngrok Tunnel Management Pattern

## Purpose
Documents the ngrok tunnel integration for exposing local processes with public HTTPS URLs.

## Core Architecture

### Container-Based Tunnels
Each process gets its own ngrok container:
- Container name: `ngrok-<processId>`
- API port: 4040 (or random if busy)
- Tunnel info stored in process metadata

## Toggle Public Access Pattern

### Main Function (processActions.ts:1236-1401)

```typescript
export async function togglePublicAccess(
    id: string,
    options?: { mode?: 'toggle' | 'ensure', targetPort?: number }
) {
    const process = await prisma.processRegistry.findFirst({ ... });
    const meta = process.metadata as any || {};
    const mode = options?.mode || 'toggle';
    const currentPublicUrl = meta.publicUrl;
    const ngrokContainerName = `ngrok-${process.id}`;

    // If already has public URL
    if (currentPublicUrl) {
        if (mode === 'ensure') {
            // Already public, just return
            return { success: true, isPublic: true, publicUrl: currentPublicUrl };
        }

        // Toggle off - remove tunnel
        await dockerExec(['rm', '-f', ngrokContainerName]);

        const updated = await prisma.processRegistry.update({
            where: { id },
            data: {
                metadata: {
                    ...meta,
                    publicUrl: undefined,
                    publicUrlId: undefined
                }
            }
        });

        return { success: true, isPublic: false, process: updated };
    }

    // Toggle on - create tunnel
    // ... (see below)
}
```

### Creating Tunnel

```typescript
// 1. Check for existing tunnel first (reuse if available)
const existingTunnel = await getNgrokUrl(`http://localhost:${targetPort}`);
if (existingTunnel.success && existingTunnel.url) {
    // Reuse existing
    await updateProcessMetadata(id, { publicUrl: existingTunnel.url });
    return { success: true, publicUrl: existingTunnel.url };
}

// 2. Verify NGROK_AUTHTOKEN
const authToken = process.env.NGROK_AUTHTOKEN;
if (!authToken) {
    return { success: false, message: 'NGROK_AUTHTOKEN not configured' };
}

// 3. Start ngrok container
try {
    // Prefer fixed 4040 port
    await dockerExec([
        'run', '-d',
        '--name', ngrokContainerName,
        '-p', '4040:4040',
        '-e', `NGROK_AUTHTOKEN=${authToken}`,
        'ngrok/ngrok',
        'http',
        `host.docker.internal:${targetPort}`
    ]);
} catch (e) {
    // Fallback to random port
    await dockerExec([
        'run', '-d',
        '--name', ngrokContainerName,
        '-P',  // Random port
        '-e', `NGROK_AUTHTOKEN=${authToken}`,
        'ngrok/ngrok',
        'http',
        `host.docker.internal:${targetPort}`
    ]);
}
```

### Polling for Tunnel URL

```typescript
let publicUrl = '';
let apiPort = 4040;
const pollStart = Date.now();
const MAX_POLL = 10000; // 10 seconds

while (Date.now() - pollStart < MAX_POLL) {
    try {
        // If random port, resolve it
        if (apiPort === 0) {
            const { stdout } = await dockerExec(['port', ngrokContainerName, '4040']);
            const match = stdout.match(/:(\d+)/);
            if (match) apiPort = parseInt(match[1]);
        }

        if (apiPort !== 0) {
            const res = await fetch(`http://localhost:${apiPort}/api/tunnels`);
            if (res.ok) {
                const data = await res.json();
                publicUrl = data.tunnels?.[0]?.public_url;
                if (publicUrl) break;
            }
        }
    } catch (e) {
        // Ignore during startup
    }

    await new Promise(r => setTimeout(r, 500));
}

if (!publicUrl) {
    await dockerExec(['rm', '-f', ngrokContainerName]);
    return { success: false, message: 'Tunnel failed to initialize' };
}

// Update process with public URL
await prisma.processRegistry.update({
    where: { id },
    data: {
        metadata: {
            ...meta,
            publicUrl,
            ngrokContainer: ngrokContainerName,
            ngrokApiPort: apiPort
        }
    }
});
```

## Get Ngrok URL Pattern

### Multi-Source Detection (processActions.ts:1409-1484)

```typescript
export async function getNgrokUrl(localUrl?: string) {
    const logs: string[] = [];

    // 1. Check Database Registry (Most reliable)
    const processes = await prisma.processRegistry.findMany({
        where: { status: 'running' }
    });

    for (const proc of processes) {
        const meta = proc.metadata as any;
        if (meta?.publicUrl) {
            // Match by port if localUrl provided
            if (localUrl) {
                const portMatch = localUrl.match(/:(\d+)/);
                const targetPort = portMatch ? parseInt(portMatch[1]) : null;
                if (targetPort && proc.port === targetPort) {
                    return { success: true, url: meta.publicUrl };
                }
            } else {
                // Return first available
                return { success: true, url: meta.publicUrl };
            }
        }
    }

    // 2. Fallback: Check local ngrok API endpoints
    const endpoints = [
        'http://localhost:4040/api/tunnels',
        'http://127.0.0.1:4040/api/tunnels',
        'http://host.docker.internal:4040/api/tunnels'
    ];

    for (const endpoint of endpoints) {
        try {
            const res = await fetch(endpoint, {
                method: 'GET',
                signal: AbortSignal.timeout(1000)
            });

            if (res.ok) {
                const data = await res.json();
                const tunnel = data.tunnels?.find(t =>
                    t.public_url && t.public_url.startsWith('https')
                );
                if (tunnel?.public_url) {
                    return { success: true, url: tunnel.public_url };
                }
            }
        } catch (e) {
            // Continue to next endpoint
        }
    }

    return { success: false, url: null };
}
```

## Ensure Public Access Pattern

### Auto-Enable for New Processes

```typescript
const ensurePublicAccess = async (processId: string, targetPort?: number) => {
    try {
        return await togglePublicAccess(processId, {
            mode: 'ensure',
            targetPort
        });
    } catch (e: any) {
        return {
            success: false,
            message: e?.message || 'Failed to ensure public access'
        };
    }
};

// Usage after starting a process
const updated = await prisma.processRegistry.update({ ... });

const tunnel = await ensurePublicAccess(updated.id, port);
const publicUrl = (tunnel as any)?.publicUrl ||
                  (tunnel as any)?.process?.metadata?.publicUrl;

const finalProcess = publicUrl
    ? await prisma.processRegistry.findUnique({ where: { id: updated.id } })
    : updated;

return {
    success: true,
    previewUrl: publicUrl || `http://localhost:${port}`,
    publicUrl,
    process: deepSerialize(finalProcess)
};
```

## Cleanup Pattern

### On Process Stop
```typescript
export async function stopProcess(id: string) {
    const process = await prisma.processRegistry.findFirst({ ... });
    const meta = process.metadata as any || {};
    const ngrokName = `ngrok-${process.id}`;

    // Stop main container
    if (meta.containerName) {
        await dockerExec(['stop', meta.containerName]);
    }

    // Remove ngrok tunnel
    try {
        await dockerExec(['rm', '-f', ngrokName]);
    } catch (e) {
        // Ignore if already gone
    }

    // Update database
    await prisma.processRegistry.update({
        where: { id },
        data: {
            status: 'stopped',
            stoppedAt: new Date(),
            metadata: {
                ...meta,
                publicUrl: undefined  // Clear public URL
            }
        }
    });
}
```

## Environment Setup

### Required Environment Variable
```bash
# .env
NGROK_AUTHTOKEN=your_ngrok_auth_token_here
```

### Getting Auth Token
1. Sign up at https://ngrok.com
2. Go to dashboard → Your Authtoken
3. Copy token to `.env`

## Frontend Integration

### Display Public URL
```typescript
const PreviewButton = ({ process }: { process: any }) => {
    const publicUrl = process.metadata?.publicUrl;
    const localUrl = `http://localhost:${process.port}`;

    return (
        <div className="flex gap-2">
            <a href={localUrl} target="_blank">
                Local Preview
            </a>
            {publicUrl && (
                <a href={publicUrl} target="_blank" className="text-blue-400">
                    🌐 Public URL
                </a>
            )}
        </div>
    );
};
```

### Toggle Button
```typescript
const [isPublic, setIsPublic] = useState(!!process.metadata?.publicUrl);

const handleTogglePublic = async () => {
    const res = await togglePublicAccess(process.id);
    if (res.success) {
        setIsPublic(res.isPublic);
        if (res.publicUrl) {
            toast.success(`Public URL: ${res.publicUrl}`);
        } else {
            toast.info('Tunnel stopped');
        }
    }
};
```

## Common Issues

### Port 4040 Busy
**Symptom**: Ngrok container fails to start
**Solution**: Automatic fallback to random port `-P`

### Tunnel Not Initializing
**Symptom**: Polling times out after 10 seconds
**Causes**:
- Invalid NGROK_AUTHTOKEN
- Network issues
- Docker daemon slow

**Debug**:
```bash
docker logs ngrok-<processId>
```

### Multiple Tunnels to Same Port
**Symptom**: Each process creates new tunnel
**Solution**: Use `getNgrokUrl()` to check for existing tunnel first

## Best Practices

1. **Always use ensure mode on start** - Prevents duplicate tunnels
2. **Poll with timeout** - Don't block forever
3. **Clean up on stop** - Remove tunnel containers
4. **Store in metadata** - Track tunnel state in database
5. **Fallback gracefully** - Continue without tunnel if it fails

## Related Files

- `src/app/processActions.ts` - Main tunnel logic
- `.env` - NGROK_AUTHTOKEN configuration
- `src/components/ProcessManager.tsx` - UI integration
