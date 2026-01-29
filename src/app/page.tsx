
import Dashboard from '@/components/Dashboard';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
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
}
