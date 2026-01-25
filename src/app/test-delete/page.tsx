import prisma from '@/lib/prisma';
import DeleteTestClient from './DeleteTestClient';

export default async function TestDeletePage() {
    // Fetch real data from the database
    const tasks = await prisma.task.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' }
    });

    const files = await prisma.workspaceFile.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' }
    });

    return (
        <DeleteTestClient
            tasks={tasks.map((t: any) => ({ id: t.id, title: t.title }))}
            files={files.map((f: any) => ({ id: f.id, name: f.name, type: f.type }))}
        />
    );
}
