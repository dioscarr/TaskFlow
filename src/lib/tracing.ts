/**
 * Tracing Module - P3-OBSERVABILITY
 * Provides lightweight trace ID generation and context management
 * for tracking AI agent operations across server and client.
 */

export function generateTraceId(): string {
    // timestamp + random suffix (base36)
    return `trc_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
}

export function generateSpanId(): string {
    return `spn_${Math.random().toString(36).substr(2, 7)}`;
}

export interface TraceContext {
    traceId: string;
    sessionId?: string;
    parentSpanId?: string;
}

/**
 * Structured logger that includes trace context
 */
export function logWithTrace(context: TraceContext | string, message: string, data?: any) {
    const traceId = typeof context === 'string' ? context : context.traceId;
    const sessionId = typeof context === 'object' ? context.sessionId : undefined;

    const entry = {
        timestamp: new Date().toISOString(),
        level: 'info',
        traceId,
        sessionId,
        message,
        data: data ? JSON.stringify(data) : undefined
    };

    // In Vercel, console.log of JSON is automatically parsed as structured log
    console.log(JSON.stringify(entry));
}
