
import { listRepoAppEntries } from './src/app/actions';
import { listProcesses } from './src/app/processActions';

async function runTest() {
    console.log('--- Performance Test ---');

    // Baseline
    const start1 = Date.now();
    await listRepoAppEntries('');
    console.log(`listRepoAppEntries took: ${Date.now() - start1}ms`);

    const start2 = Date.now();
    await listProcesses();
    console.log(`listProcesses (initial) took: ${Date.now() - start2}ms`);

    // Cached/Steady State
    const start3 = Date.now();
    await listProcesses();
    console.log(`listProcesses (cached) took: ${Date.now() - start3}ms`);

    const start4 = Date.now();
    await listProcesses();
    console.log(`listProcesses (third run) took: ${Date.now() - start4}ms`);
}

runTest().catch(console.error);
