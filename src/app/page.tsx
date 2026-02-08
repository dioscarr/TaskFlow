
import Dashboard from '@/components/Dashboard';
import { getCachedDemoUser, getCachedUserTasks, getCachedWorkspaceFiles } from '@/lib/dataCache';

// Incremental Static Regeneration: revalidate every 60 seconds
// This means the page will be cached and regenerated in the background
export const revalidate = 60;

export default async function Home() {
  try {
    // Use cached data fetching functions
    const user = await getCachedDemoUser();

    if (!user) return <div>User not found</div>;

    // Parallel data fetching with automatic request deduplication
    const [tasks, files] = await Promise.all([
      getCachedUserTasks(user.id),
      getCachedWorkspaceFiles(user.id)
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
