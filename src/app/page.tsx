
import Dashboard from '@/components/Dashboard';
import prisma from '@/lib/prisma';

export default async function Home() {
  const user = await prisma.user.findUnique({
    where: { email: 'demo@example.com' }
  });

  if (!user) return <div>User not found</div>;

  const [tasks, files, alegraBills] = await Promise.all([
    prisma.task.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
    prisma.workspaceFile.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
    prisma.alegraBill.findMany({
      where: { userId: user.id },
      include: { file: true },
      orderBy: { createdAt: 'desc' }
    })
  ]);

  return (
    <Dashboard tasks={tasks} files={files} alegraBills={alegraBills} />
  );
}
