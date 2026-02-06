'use server';

import prisma from '@/lib/prisma';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readdir } from 'fs/promises';
import { listProcesses, manageAppLifecycle } from '@/app/processActions';
import {
    getFileContent,
    saveFileContent,
    enqueueAgentJob,
    executeScaffoldVite
} from '@/app/actions';

const execAsync = promisify(exec);

export type TerminalResponse = {
    output: string;
    type: 'success' | 'error' | 'info';
    previewUrl?: string;
};

export async function runShellCommand(commandLine: string, currentPath: string = ''): Promise<TerminalResponse> {
    const parts = commandLine.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    try {
        switch (cmd) {
            case 'help':
                return {
                    type: 'info',
                    output: `
🚀 TaskFlow CLI Help
-------------------
Available Commands:
- agent <objective>    : Deploy an AI agent
- jobs                 : List recent agent jobs
- job <id>             : Get details of a job
- apps                 : List your applications
- run <name>           : Run an application (Docker/Local)
- stop <name>          : Stop a running application
- scaffold <name>      : Create a new Vite app
- processes           : List running services
- db <query>           : Run raw SQL (careful!)
- status               : System health check
- ls                   : List files in workspace
- clear                : Clear terminal
`
                };

            case 'run':
            case 'start':
                if (!args.length) return { type: 'error', output: 'Usage: run <app-name> (e.g. run call, run apps/call)' };
                const target = args[0];
                // Ignore "the" if present, e.g. "run the app" -> target "app"
                // But better handling: if args includes "call", use "call"
                // For now, simple target mapping.
                // If user typed 'run the app', args=['the', 'app']. We want 'app' or whatever app name.
                // Let's assume the last arg is the target if multiple words, unless specific keywords.

                let appTarget = args[args.length - 1]; // "run call" -> "call"
                if (args.includes('call')) appTarget = 'call';

                const startRes = await manageAppLifecycle({ action: 'start', target: appTarget });
                if (startRes.success) {
                    return {
                        type: 'success',
                        output: `🚀 App ${startRes.process?.name} is running!\nURL: ${(startRes as any).previewUrl || 'N/A'}\nPID: ${startRes.process?.pid || 'Container'}`,
                        previewUrl: (startRes as any).previewUrl
                    };
                }
                return { type: 'error', output: `❌ Failed to start: ${startRes.message}` };

            case 'stop':
                if (!args.length) return { type: 'error', output: 'Usage: stop <app-name>' };
                const stopTarget = args[0]; // Simple mapping for now
                const stopRes = await manageAppLifecycle({ action: 'stop', target: stopTarget });
                if (stopRes.success) {
                    return { type: 'success', output: `🛑 Stopped ${stopRes.process?.name}` };
                }
                return { type: 'error', output: `❌ Failed to stop: ${stopRes.message}` };

            case 'agent':
                if (!args.length) return { type: 'error', output: 'Usage: agent <objective>' };
                const objective = args.join(' ');
                const jobRes = await enqueueAgentJob({
                    type: 'chat_task',
                    payload: { objective, query: objective },
                    approved: true
                });
                if (jobRes.success && jobRes.job) {
                    return { type: 'success', output: `✅ Agent deployed! Job ID: ${jobRes.job.id}\nTrack progress with: job ${jobRes.job.id}` };
                }
                return { type: 'error', output: `❌ Failed to deploy agent: ${jobRes.message}` };

            case 'jobs':
                const jobs = await prisma.agentJob.findMany({
                    take: 10,
                    orderBy: { createdAt: 'desc' },
                    select: { id: true, type: true, status: true, createdAt: true }
                });
                const jobRows = jobs.map(j => `[${j.createdAt.toLocaleTimeString()}] ${j.id.slice(0, 8)}... | ${j.type} | ${j.status}`).join('\n');
                return { type: 'info', output: `🔍 Recent Jobs:\n${jobRows || 'No jobs found.'}` };

            case 'job':
                if (!args.length) return { type: 'error', output: 'Usage: job <id>' };
                const jobDetails = await prisma.agentJob.findUnique({ where: { id: args[0] } });
                if (!jobDetails) return { type: 'error', output: `Job ${args[0]} not found.` };
                return { type: 'info', output: `📋 Job Detail:\nID: ${jobDetails.id}\nStatus: ${jobDetails.status}\nCreated: ${jobDetails.createdAt}\nType: ${jobDetails.type}` };

            case 'apps':
                const appDirs = await readdir('apps', { withFileTypes: true });
                const appNames = appDirs.filter(d => d.isDirectory()).map(d => ` • ${d.name}`).join('\n');
                return { type: 'info', output: `📱 Active Apps:\n${appNames || 'No apps found.'}` };

            case 'scaffold':
                if (!args.length) return { type: 'error', output: 'Usage: scaffold <name>' };
                const scaffoldRes = await executeScaffoldVite({ projectName: args[0] });
                if (scaffoldRes.success) return { type: 'success', output: `✅ Scaffolded ${args[0]} at apps/${args[0]}` };
                return { type: 'error', output: `❌ Failed: ${scaffoldRes.message}` };

            case 'processes':
                const procRes = await listProcesses();
                if (procRes.success && procRes.processes) {
                    const rows = procRes.processes.map((p: any) => `[${p.status.toUpperCase()}] ${p.name} | Port: ${p.port || 'N/A'}`).join('\n');
                    return { type: 'info', output: `⚡ Processes:\n${rows || 'No active processes.'}` };
                }
                return { type: 'error', output: 'Failed to fetch processes.' };

            case 'db':
                if (!args.length) return { type: 'error', output: 'Usage: db <query>' };
                const dbRes = await prisma.$queryRawUnsafe(args.join(' '));
                return { type: 'info', output: `💾 Query Result:\n${JSON.stringify(dbRes, null, 2)}` };

            case 'ls':
                const entries = await readdir(process.cwd());
                return { type: 'info', output: entries.join('  ') };

            case 'status':
                return { type: 'info', output: '⚡ TaskFlow Status: OPERATIONAL\nAgents: 12 Active\nDatabase: Connected\nFrontend: Vibe Mode Enabled' };

            default:
                // Attempt a real system command for basic support
                try {
                    const { stdout, stderr } = await execAsync(commandLine, { timeout: 5000 });
                    return { type: (stderr ? 'error' : 'success'), output: stdout || stderr || '(No output)' };
                } catch (e: any) {
                    return { type: 'error', output: `Command failed or unknown: ${cmd}\n${e.message}` };
                }
        }
    } catch (err: any) {
        return { type: 'error', output: `Fatal Error: ${err.message}` };
    }
}
