import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Build Metrics API
 *
 * Track Docker build performance metrics:
 * - Build duration
 * - Success/failure rate
 * - App-specific statistics
 * - Trends over time
 */

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { appName, imageName, duration, success, stage, error } = body;

        // Store metric in database
        await prisma.buildMetric.create({
            data: {
                appName,
                imageName,
                durationMs: duration,
                success,
                stage: stage || 'complete',
                errorMessage: error || null
            }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Failed to record metric:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const appName = searchParams.get('app');

        // Get metrics with aggregation
        const where = appName ? { appName } : {};

        const metrics = await prisma.buildMetric.groupBy({
            by: ['appName'],
            where,
            _count: { id: true },
            _avg: {
                durationMs: true
            },
            _min: {
                durationMs: true
            },
            _max: {
                durationMs: true
            }
        });

        // Get success counts separately
        const successCounts = await prisma.buildMetric.groupBy({
            by: ['appName'],
            where: { ...where, success: true },
            _count: { id: true }
        });

        // Merge the results
        const result = metrics.map(metric => {
            const successCount = successCounts.find(s => s.appName === metric.appName)?._count.id || 0;
            return {
                app_name: metric.appName,
                total_builds: metric._count.id,
                successful_builds: successCount,
                avg_build_time: metric._avg.durationMs,
                fastest_build: metric._min.durationMs,
                slowest_build: metric._max.durationMs
            };
        });

        return NextResponse.json({ success: true, metrics: result });
    } catch (error: any) {
        console.error('Failed to fetch metrics:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
