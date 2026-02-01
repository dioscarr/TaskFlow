import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupJobs() {
    console.log('\n🧹 Cleaning up agent job queue...\n');

    // 1. Mark stuck "running" jobs as failed
    const stuckThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes
    const stuckJobs = await prisma.agentJob.updateMany({
        where: {
            status: 'running',
            startedAt: { lt: stuckThreshold }
        },
        data: {
            status: 'failed',
            finishedAt: new Date(),
            error: 'Job timed out or crashed (auto-cleanup)'
        }
    });

    console.log(`✅ Marked ${stuckJobs.count} stuck jobs as failed`);

    // 2. Remove old failed/succeeded jobs (older than 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oldCompleted = await prisma.agentJob.deleteMany({
        where: {
            status: { in: ['failed', 'succeeded'] },
            finishedAt: { lt: oneHourAgo }
        }
    });

    console.log(`🗑️  Deleted ${oldCompleted.count} old completed jobs`);

    // 3. Auto-approve all queued jobs OR delete unapproved ones
    const choice = process.argv[2];

    if (choice === '--approve-all') {
        const approved = await prisma.agentJob.updateMany({
            where: {
                status: 'queued',
                approved: false
            },
            data: { approved: true }
        });
        console.log(`✅ Auto-approved ${approved.count} queued jobs`);
    } else if (choice === '--delete-unapproved') {
        const deleted = await prisma.agentJob.deleteMany({
            where: {
                status: 'queued',
                approved: false
            }
        });
        console.log(`🗑️  Deleted ${deleted.count} unapproved jobs`);
    } else {
        const unapproved = await prisma.agentJob.count({
            where: { status: 'queued', approved: false }
        });
        console.log(`⚠️  ${unapproved} unapproved jobs remain. Use:`);
        console.log(`   --approve-all      to approve all queued jobs`);
        console.log(`   --delete-unapproved to delete unapproved jobs`);
    }

    // Show final stats
    const stats = await prisma.agentJob.groupBy({
        by: ['status'],
        _count: true
    });

    console.log('\n📊 Current Job Queue:');
    for (const s of stats) {
        console.log(`   ${s.status.toUpperCase()}: ${s._count}`);
    }

    console.log('\n✨ Cleanup complete!\n');
}

cleanupJobs()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
