
import { NextRequest, NextResponse } from 'next/server';
import { sessionMetricStore } from '@/lib/observability';

type RouteContext = {
    params: Promise<{ sessionId: string }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
    const { sessionId } = await params;

    if (!sessionId) {
        return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    try {
        const metrics = sessionMetricStore.getMetrics(sessionId);

        // Calculate aggregate stats for easy consumption
        const totalLatency = Object.values(metrics.toolUsage).reduce((acc, curr) => acc + curr.totalLatencyMs, 0);
        const totalToolCalls = Object.values(metrics.toolUsage).reduce((acc, curr) => acc + curr.count, 0);
        const totalErrors = Object.values(metrics.toolUsage).reduce((acc, curr) => acc + curr.errors, 0) + metrics.errors.length;

        return NextResponse.json({
            ...metrics,
            aggregates: {
                totalLatency,
                totalToolCalls,
                totalErrors
            }
        });
    } catch (e) {
        return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
    }
}
