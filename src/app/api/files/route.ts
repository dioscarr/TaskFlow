/**
 * API route for fetching workspace files
 * Uses cached data layer for optimal performance
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCachedWorkspaceFiles } from '@/lib/dataCache';

export const runtime = 'edge'; // Use Edge runtime for faster responses
export const dynamic = 'force-dynamic'; // Always fresh data

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
    }

    const files = await getCachedWorkspaceFiles(userId);

    return NextResponse.json(files, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 });
  }
}
