/**
 * API route for fetching tasks
 * Uses cached data layer for optimal performance
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCachedUserTasks } from '@/lib/dataCache';

export const runtime = 'edge'; // Use Edge runtime for faster responses
export const dynamic = 'force-dynamic'; // Always fresh data

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
    }

    const tasks = await getCachedUserTasks(userId);

    return NextResponse.json(tasks, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}
