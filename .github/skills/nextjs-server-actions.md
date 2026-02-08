# Next.js Server Actions Pattern

## Purpose
Best practices for writing Next.js Server Actions in this codebase, including common pitfalls and solutions.

## The 'use server' Directive

### Rule: Only Export Async Functions
Files marked with `'use server'` can ONLY export async functions, not objects, constants, or types.

```typescript
// ❌ WRONG - Will cause build error
'use server';

export const CONFIG = { api: 'https://...' };

export async function getData() { ... }
```

```typescript
// ✅ CORRECT - Only async functions exported
'use server';

const CONFIG = { api: 'https://...' }; // No export

export async function getConfig() {
    return CONFIG; // Expose via function
}

export async function getData() { ... }
```

### Common Error
```
Error: A "use server" file can only export async functions, found object.
```

**Solution**: Remove `export` from constants/objects, or wrap them in async functions.

## Type Exports Pattern

### Interfaces and Types
You can export types, but they must be explicitly marked:

```typescript
'use server';

// ✅ CORRECT - Explicit type export
export type { ProcessInput };
export interface CreateResourceData { ... }

// ❌ WRONG - Will be treated as value export
export const ResourceType = { ... }; // Object, not type
```

## Authentication Pattern

### Standard Auth Check
```typescript
import { auth } from '@/auth';

export async function myAction() {
    const session = await auth();
    if (!session?.user?.email) {
        throw new Error('Not authenticated');
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email }
    });

    if (!user) throw new Error('User not found');

    // Continue with authenticated logic
}
```

## Database Query Patterns

### Serialization
Always serialize Prisma results before returning (handles Date objects):

```typescript
import { deepSerialize } from '@/lib/serialization';

export async function getProcesses() {
    const processes = await prisma.processRegistry.findMany({
        where: { userId: user.id }
    });

    // ✅ Serialize before returning
    return {
        success: true,
        processes: deepSerialize(processes)
    };
}
```

### Pagination
```typescript
export async function listItems(page = 1, limit = 100) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
        prisma.item.findMany({
            where: { userId: user.id },
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' }
        }),
        prisma.item.count({ where: { userId: user.id } })
    ]);

    return {
        success: true,
        items: deepSerialize(items),
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    };
}
```

## Error Handling

### Standard Response Format
```typescript
export async function myAction(input: SomeInput) {
    try {
        // Main logic
        const result = await doSomething(input);

        return {
            success: true,
            message: 'Operation completed',
            data: deepSerialize(result)
        };
    } catch (error: any) {
        console.error('Error in myAction:', error);
        return {
            success: false,
            message: error.message
        };
    }
}
```

### Client-Side Usage
```typescript
'use client';

import { myAction } from '@/app/actions';

const handleClick = async () => {
    const res = await myAction(input);

    if (res.success) {
        toast.success(res.message);
        // Use res.data
    } else {
        toast.error(res.message);
    }
};
```

## Metadata Handling

### Prisma JSON Fields
Prisma's `Json` type needs explicit casting:

```typescript
// Writing
await prisma.processRegistry.create({
    data: {
        metadata: {
            containerName,
            imageName,
            mode: 'docker'
        } as object  // Cast to object
    }
});

// Reading
const process = await prisma.processRegistry.findUnique({ ... });
const meta = process.metadata as any;
const containerName = meta?.containerName as string | undefined;
```

## Common Patterns

### Upsert Pattern
```typescript
export async function setSetting(key: string, value: unknown) {
    const user = await getDemoUser();

    const setting = await prisma.appSettings.upsert({
        where: {
            userId_category_key: {
                userId: user.id,
                category: 'app',
                key
            }
        },
        update: {
            value: value as object,
            updatedAt: new Date()
        },
        create: {
            userId: user.id,
            category: 'app',
            key,
            value: value as object
        }
    });

    return { success: true, setting };
}
```

### Find or Create
```typescript
export async function getOrCreateProfile() {
    const user = await getDemoUser();

    let profile = await prisma.userProfile.findUnique({
        where: { userId: user.id }
    });

    if (!profile) {
        profile = await prisma.userProfile.create({
            data: {
                userId: user.id,
                displayName: user.name || 'User',
                // ... defaults
            }
        });
    }

    return profile;
}
```

### Batch Operations
```typescript
export async function batchUpdate(ids: string[], status: string) {
    const user = await getDemoUser();

    const result = await prisma.processRegistry.updateMany({
        where: {
            id: { in: ids },
            userId: user.id  // Security: only own records
        },
        data: { status }
    });

    return {
        success: true,
        updated: result.count
    };
}
```

## Security Patterns

### Always Filter by User
```typescript
// ❌ WRONG - Anyone can access any record
export async function getProcess(id: string) {
    return await prisma.processRegistry.findUnique({
        where: { id }
    });
}

// ✅ CORRECT - Only own records
export async function getProcess(id: string) {
    const user = await getDemoUser();

    return await prisma.processRegistry.findFirst({
        where: {
            id,
            userId: user.id  // Security check
        }
    });
}
```

### Ownership Verification
```typescript
export async function updateResource(id: string, data: UpdateData) {
    const user = await getDemoUser();

    // Verify ownership first
    const existing = await prisma.appResource.findFirst({
        where: { id, userId: user.id }
    });

    if (!existing) {
        throw new Error('Resource not found');
    }

    // Then update
    const updated = await prisma.appResource.update({
        where: { id },
        data
    });

    return updated;
}
```

## File Organization

### Separate by Domain
```
src/app/
  actions.ts         - General workspace/file actions
  processActions.ts  - Process management
  settingsActions.ts - User settings & resources
  terminalActions.ts - Terminal operations
```

### Import Pattern
```typescript
// Client component
'use client';

import { listProcesses, startProcess } from '@/app/processActions';
import { getSettings } from '@/app/settingsActions';
```

## Performance Tips

1. **Use Promise.all for parallel queries**
   ```typescript
   const [users, posts, comments] = await Promise.all([
       prisma.user.findMany(),
       prisma.post.findMany(),
       prisma.comment.findMany()
   ]);
   ```

2. **Select only needed fields**
   ```typescript
   const users = await prisma.user.findMany({
       select: {
           id: true,
           name: true,
           email: true
           // Exclude large fields
       }
   });
   ```

3. **Use includes wisely**
   ```typescript
   const resource = await prisma.appResource.findUnique({
       where: { id },
       include: {
           credentials: {
               select: {  // Don't expose sensitive data
                   id: true,
                   name: true,
                   type: true
                   // Exclude encryptedValue
               }
           }
       }
   });
   ```

## Common Pitfalls

1. **Exporting non-async values** - Wrap in async function
2. **Forgetting deepSerialize** - Dates won't serialize properly
3. **Missing auth checks** - Always verify user
4. **Not filtering by userId** - Security vulnerability
5. **Blocking operations** - Use background tasks for slow ops

## Related Files

- `src/lib/serialization.ts` - deepSerialize helper
- `src/auth.ts` - Auth configuration
- `next.config.ts` - Next.js config
