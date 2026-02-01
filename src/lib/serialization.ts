/**
 * Utility functions to ensure values are JSON-serializable
 * Fixes "Failed to fetch" errors in Next.js Server Actions
 */

/**
 * Recursively serialize an object to remove non-serializable values
 */
export function serializeValue(value: any): any {
    if (value === null || value === undefined) {
        return value;
    }

    // Handle Date objects
    if (value instanceof Date) {
        return value.toISOString();
    }

    // Handle BigInt
    if (typeof value === 'bigint') {
        return value.toString();
    }

    // Handle functions and symbols
    if (typeof value === 'function' || typeof value === 'symbol') {
        return undefined;
    }

    // Handle arrays
    if (Array.isArray(value)) {
        return value.map(item => serializeValue(item));
    }

    // Handle objects
    if (typeof value === 'object' && value !== null) {
        // Skip circular references by checking for toJSON method (used by many classes)
        if (value.toJSON && typeof value.toJSON === 'function') {
            try {
                return value.toJSON();
            } catch {
                // Fallback if toJSON fails
            }
        }

        const serialized: Record<string, any> = {};
        for (const key in value) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                const serializedVal = serializeValue(value[key]);
                // Skip undefined values to keep response clean
                if (serializedVal !== undefined) {
                    serialized[key] = serializedVal;
                }
            }
        }
        return serialized;
    }

    // Return primitives as-is
    return value;
}

/**
 * Deep clone and serialize an object
 */
export function deepSerialize<T = any>(obj: T): T {
    return serializeValue(obj) as T;
}

/**
 * Sanitize an object for server action responses
 */
export function sanitizeForResponse<T extends Record<string, any>>(obj: T): Partial<T> {
    const result: any = {};

    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key];
            // Skip large or problematic fields
            if (
                key.startsWith('_') ||
                key === 'password' ||
                key === 'secret' ||
                typeof value === 'function'
            ) {
                continue;
            }
            result[key] = serializeValue(value);
        }
    }

    return result;
}
