import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnoseJobs() {
    console.log('\n🔍 Agent Job Queue Diagnostics\n' + '='.repeat(60));

    // Get counts by status
    const statuses = await prisma.agentJob.groupBy({
        by: ['status'],
        _count: true,
        orderBy: { status: 'asc' }
    });

    console.log('\n📊 Jobs by Status:');
    for (const s of statuses) {
        console.log(`   ${s.status.toUpperCase()}: ${s._count}`);
    }

    // Get recent jobs
    const recentJobs = await prisma.agentJob.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            type: true,
            status: true,
            approved: true,
            iteration: true,
            workerId: true,
            createdAt: true,
            startedAt: true,
            finishedAt: true,
            error: true
        }
    });

    console.log('\n📋 Recent Jobs:');
    console.log('─'.repeat(60));
    for (const job of recentJobs) {
        const elapsed = job.startedAt
            ? Math.round((Date.now() - job.startedAt.getTime()) / 1000)
            : null;
        console.log(`ID: ${job.id.slice(0, 8)} | ${job.type} | ${job.status.toUpperCase()}`);
        console.log(`   Approved: ${job.approved} | Iteration: ${job.iteration} | Worker: ${job.workerId || 'none'}`);
        if (elapsed) console.log(`   Running for: ${elapsed}s`);
        if (job.error) console.log(`   Error: ${job.error.slice(0, 100)}`);
        console.log('');
    }

    // Check for stuck jobs
    const stuckThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes
    const stuckJobs = await prisma.agentJob.findMany({
        where: {
            status: 'running',
            startedAt: { lt: stuckThreshold }
        }
    });

    if (stuckJobs.length > 0) {
        console.log(`\n⚠️  Found ${stuckJobs.length} potentially stuck jobs (running > 5min)`);
        for (const job of stuckJobs) {
            console.log(`   - ${job.id.slice(0, 8)} started at ${job.startedAt}`);
        }
    }

    // Check queued but unapproved
    const unapproved = await prisma.agentJob.count({
        where: { status: 'queued', approved: false }
    });

    if (unapproved > 0) {
        console.log(`\n⏸️  ${unapproved} jobs queued but not approved`);
    }

    console.log('\n' + '='.repeat(60) + '\n');
}

diagnoseJobs()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
