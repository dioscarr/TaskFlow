
import Dashboard from '@/components/Dashboard';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'demo@example.com' }
    });

    if (!user) return <div>User not found</div>;

    const [tasks, files] = await Promise.all([
      prisma.task.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
      (prisma as any).workspaceFile.findMany({
        where: { userId: user.id },
        orderBy: [
          { order: 'asc' },
          { createdAt: 'desc' }
        ],
        select: {
          id: true,
          name: true,
          type: true,
          size: true,
          items: true,
          shared: true,
          order: true,
          parentId: true,
          userId: true,
          highlightBgColor: true,
          highlightTextColor: true,
          highlightBorderColor: true,
          highlightFontWeight: true,
          tags: true,
          storagePath: true,
          magicRule: true,
          createdAt: true,
          updatedAt: true
        }
      })
    ]);

    return (
      <Dashboard tasks={tasks} files={files as any} />
    );
  } catch (err) {
    // Prisma failed to initialize or connect (e.g., DATABASE_URL unreachable).
    // Fall back to demo data so the app remains usable in local dev.
    console.error('Prisma connection failed — using demo fallback data', err);

    const demoUser = { id: 'demo-id', email: 'demo@example.com', name: 'Demo User' } as any;

    const demoTasks = [
      {
        id: 'task-1',
        title: 'Welcome to TaskFlow',
        description: 'This is a demo task because the database is unreachable.',
        status: 'pending',
        dueDate: null,
        emailId: null,
        emailSource: null,
        userId: demoUser.id,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    const demoFiles = [
      {
        id: 'file-1',
        name: 'Demo App',
        type: 'folder',
        size: '0',
        items: null,
        shared: false,
        order: 0,
        parentId: null,
        userId: demoUser.id,
        highlightBgColor: null,
        highlightTextColor: null,
        highlightBorderColor: null,
        highlightFontWeight: null,
        tags: [],
        storagePath: null,
        magicRule: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    return <Dashboard tasks={demoTasks as any} files={demoFiles as any} />;
  }
}
