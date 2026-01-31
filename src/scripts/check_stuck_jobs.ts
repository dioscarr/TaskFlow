
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Checking for stuck background jobs...');

    const stuckJobs = await prisma.agentJob.findMany({
        where: {
            status: {
                in: ['running', 'queued', 'pending']
            }
        },
        orderBy: {
            createdAt: 'desc'
        },
        include: {
            user: {
                select: { email: true }
            }
        }
    });

    if (stuckJobs.length === 0) {
        console.log('✅ No stuck jobs found. The queue is clear.');
    } else {
        console.log(`⚠️ Found ${stuckJobs.length} active/stuck jobs:`);
        stuckJobs.forEach(job => {
            const duration = (new Date().getTime() - new Date(job.createdAt).getTime()) / 1000 / 60; // minutes
            console.log(`- [${job.status.toUpperCase()}] ID: ${job.id} | Type: ${job.type}`);
            console.log(`  Created: ${job.createdAt.toISOString()} (${duration.toFixed(1)} mins ago)`);
            console.log(`  User: ${job.user.email}`);
            if (job.error) console.log(`  Last Error: ${job.error}`);
            console.log('---');
        });

        // Determine if we should suggest clearing them
        const oldJobs = stuckJobs.filter(j => {
            const age = (new Date().getTime() - new Date(j.createdAt).getTime()) / 1000 / 60;
            return age > 5; // Older than 5 minutes
        });

        if (oldJobs.length > 0) {
            console.log(`\n💡 Recommendation: There are ${oldJobs.length} jobs older than 5 minutes. You might want to clear them.`);
            // Attempt to clear specific stuck job if it's very old?
            // For now, just reporting.
        }
    }

    await prisma.$disconnect();
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
