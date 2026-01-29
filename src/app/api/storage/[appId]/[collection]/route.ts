
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ appId: string; collection: string }> }
) {
    const { appId, collection } = await params;

    try {
        const data = await prisma.prototypeData.findMany({
            where: {
                appId,
                collection
            },
            orderBy: { createdAt: 'desc' }
        });

        // Transform to standard JSON array with _id
        const result = data.map(item => {
            const payload = item.data && typeof item.data === 'object' ? item.data : {};
            return {
                _id: item.id,
                ...payload,
                _createdAt: item.createdAt
            };
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error('API GET Error:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ appId: string; collection: string }> }
) {
    const { appId, collection } = await params;

    try {
        const body = await request.json();
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const record = await prisma.prototypeData.create({
            data: {
                appId,
                collection,
                userId: user.id,
                data: body
            }
        });

        return NextResponse.json({
            success: true,
            _id: record.id,
            ...body
        });
    } catch (error) {
        console.error('API POST Error:', error);
        return NextResponse.json({ error: 'Failed to save data' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ appId: string; collection: string }> }
) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    try {
        await prisma.prototypeData.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
}
