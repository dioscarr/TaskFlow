/**
 * Reset Docker Process State
 *
 * This script cleans up stale Docker process records from the database
 * and forces a fresh sync with actual Docker container status.
 *
 * Use this when:
 * - Docker Desktop was restarted
 * - Processes show "error" status but containers are actually running
 * - Database is out of sync with actual Docker state
 *
 * Usage: npx tsx scripts/reset_docker_state.ts
 */

import prisma from '../src/lib/prisma';
import { execAsync } from '../src/lib/processActionsCore';

async function resetDockerState() {
    console.log('🔍 Checking Docker daemon status...');

    try {
        // Check if Docker is running
        await execAsync('docker info', { timeout: 10000 });
        console.log('✅ Docker daemon is running\n');
    } catch (error: any) {
        if (error.killed || error.signal === 'SIGTERM') {
            console.error('❌ Docker is taking too long to respond (timeout)');
            console.error('   Try restarting Docker Desktop and run this script again.');
        } else {
            console.error('❌ Docker daemon is not available');
            console.error('   Start Docker Desktop before running this script.');
        }
        process.exit(1);
    }

    console.log('📦 Fetching actual Docker container status...');

    let containerMap: Map<string, any>;
    try {
        const { stdout } = await execAsync('docker ps -a --format "{{.Names}}|{{.Status}}|{{.Ports}}"', { timeout: 10000 });
        containerMap = new Map(stdout.split('\n').filter(Boolean).map(line => {
            const [name, status, ports] = line.trim().split('|');
            return [name, {
                status: status?.startsWith('Up') ? 'running' : 'stopped',
                rawStatus: status,
                ports
            }];
        }));
        console.log(`✅ Found ${containerMap.size} Docker containers\n`);
    } catch (error) {
        console.error('❌ Failed to fetch container list:', error);
        process.exit(1);
    }

    console.log('🗄️  Fetching database process records...');
    const processes = await prisma.processRegistry.findMany({
        where: {
            type: 'docker-app'
        },
        orderBy: { createdAt: 'desc' }
    });
    console.log(`✅ Found ${processes.length} Docker process records in database\n`);

    console.log('🔄 Syncing database with actual Docker state...\n');

    let updated = 0;
    let deleted = 0;
    let unchanged = 0;

    for (const process of processes) {
        const containerName = process.metadata?.containerName;

        if (!containerName) {
            console.log(`⚠️  "${process.name}" has no containerName in metadata - skipping`);
            unchanged++;
            continue;
        }

        const actualStatus = containerMap.get(containerName);

        if (!actualStatus) {
            // Container doesn't exist anymore - delete from database
            console.log(`🗑️  "${process.name}" (${containerName}) - container not found, deleting record`);
            await prisma.processRegistry.delete({ where: { id: process.id } });
            deleted++;
        } else if (process.status !== actualStatus.status) {
            // Status mismatch - update database
            console.log(`🔄 "${process.name}" (${containerName})`);
            console.log(`   DB: ${process.status} → Docker: ${actualStatus.status}`);

            await prisma.processRegistry.update({
                where: { id: process.id },
                data: {
                    status: actualStatus.status,
                    stoppedAt: actualStatus.status === 'running' ? null : new Date(),
                    startedAt: actualStatus.status === 'running' ? new Date() : process.startedAt
                }
            });
            updated++;
        } else {
            // Status matches - no change needed
            unchanged++;
        }
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   🗑️  Deleted: ${deleted}`);
    console.log(`   ⏭️  Unchanged: ${unchanged}`);
    console.log(`   📦 Total: ${processes.length}`);

    console.log('\n✅ Docker state reset complete!');
    console.log('   Next time you open VibeFileExplorer, it will show the correct status.');
}

resetDockerState()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
