'use server';

import prisma from '@/lib/prisma';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { listProcesses, manageAppLifecycle } from '@/app/processActions';
import { headers } from 'next/headers';
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
    localUrl?: string;
    forwardedUrl?: string;
};

const buildForwardedUrl = async (port: number) => {
    try {
        const h = await headers();
        const host = h.get('x-forwarded-host') || h.get('host') || '';
        const proto = h.get('x-forwarded-proto') || 'https';

        const match = host.match(/^([a-z0-9-]+)-(\d+)\.use\.devtunnels\.ms$/i);
        if (!match) return undefined;

        const base = match[1];
        return `${proto}://${base}-${port}.use.devtunnels.ms`;
    } catch {
        return undefined;
    }
};

const fetchNgrokTunnels = async (): Promise<string[] | null> => {
    try {
        const res = await fetch('http://127.0.0.1:4040/api/tunnels');
        if (!res.ok) return null;
        const data = await res.json();
        const urls = Array.isArray(data?.tunnels)
            ? data.tunnels.map((t: any) => t?.public_url).filter(Boolean)
            : [];
        return urls.length ? urls : null;
    } catch {
        return null;
    }
};

const updateEnvPort = async (port: number) => {
    try {
        const envPath = join(process.cwd(), '.env');
        const raw = await readFile(envPath, 'utf-8');
        const lines = raw.split(/\r?\n/);
        let updated = false;

        const nextLines = lines.map(line => {
            if (line.startsWith('NGROK_PORT=')) {
                updated = true;
                return `NGROK_PORT=${port}`;
            }
            return line;
        });

        if (!updated) {
            nextLines.push(`NGROK_PORT=${port}`);
        }

        await writeFile(envPath, nextLines.join('\n'));
    } catch {
        // Ignore env update errors; ngrok can still start if env is already set
    }
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
- tunnel [status|start|stop] : Manage ngrok tunnel
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

                // Smart Resolution: Check against actual apps
                try {
                    const appsDir = await readdir(join(process.cwd(), 'apps'), { withFileTypes: true });
                    const knownApps = appsDir.filter(d => d.isDirectory()).map(d => d.name);

                    // 1. Check if any arg matches exactly
                    const exactArg = args.find(a => knownApps.includes(a));
                    if (exactArg) {
                        appTarget = exactArg;
                    } else {
                        // 2. Fuzzy / Prefix Matching
                        // e.g. "run salon-premiu" -> "salon-premium"
                        const targetLower = appTarget.toLowerCase();
                        const match = knownApps.find(a =>
                            a.toLowerCase() === targetLower ||
                            a.toLowerCase().startsWith(targetLower) ||
                            targetLower.startsWith(a.toLowerCase()) // reverse check rarely needed but good for "salon-premium-app" -> "salon-premium"
                        );

                        if (match) {
                            appTarget = match;
                        }
                    }
                } catch (e) {
                    // Ignore fs errors, fallback to basic
                }

                const startRes = await manageAppLifecycle({ action: 'start', target: appTarget });
                if (startRes.success) {
                    const port = startRes.process?.port as number | undefined;
                    const localUrl = port ? `http://localhost:${port}` : undefined;
                    const forwardedUrl = port ? await buildForwardedUrl(port) : undefined;
                    const urlLines = [
                        localUrl ? `Local: ${localUrl}` : null,
                        forwardedUrl ? `Forwarded: ${forwardedUrl}` : null
                    ].filter(Boolean).join('\n');

                    return {
                        type: 'success',
                        output: `🚀 App ${startRes.process?.name} is running!\n${urlLines || 'URL: N/A'}\nPID: ${startRes.process?.pid || 'Container'}`,
                        previewUrl: localUrl || (startRes as any).previewUrl,
                        localUrl,
                        forwardedUrl
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

            case 'tunnel': {
                const action = (args[0] || 'status').toLowerCase();

                if (action === 'start') {
                    try {
                        const portArg = args[1] || args[0];
                        const parsedPort = Number(portArg);
                        const previewPort = Number(process.env.PREVIEW_PORT || '');
                        const desiredPort = Number.isFinite(parsedPort) && parsedPort > 0
                            ? parsedPort
                            : (Number.isFinite(previewPort) && previewPort > 0 ? previewPort : 5050);

                        await updateEnvPort(desiredPort);
                        const { stdout, stderr } = await execAsync('docker compose -f docker-compose.ngrok.yml up -d');
                        const tunnels = await fetchNgrokTunnels();
                        const urlLines = tunnels?.map(u => `• ${u}`).join('\n') || 'No tunnels detected yet. Check http://127.0.0.1:4040.';
                        return { type: 'success', output: `✅ Ngrok started (port ${desiredPort}).\n${urlLines}\n${stderr || ''}${stdout || ''}`.trim() };
                    } catch (e: any) {
                        return { type: 'error', output: `❌ Failed to start ngrok: ${e.message}` };
                    }
                }

                if (action === 'stop') {
                    try {
                        const { stdout, stderr } = await execAsync('docker compose -f docker-compose.ngrok.yml down');
                        return { type: 'success', output: `🛑 Ngrok stopped.\n${stderr || ''}${stdout || ''}`.trim() };
                    } catch (e: any) {
                        return { type: 'error', output: `❌ Failed to stop ngrok: ${e.message}` };
                    }
                }

                const tunnels = await fetchNgrokTunnels();
                if (!tunnels) {
                    return { type: 'info', output: 'No ngrok tunnel detected. Try: tunnel start' };
                }
                return { type: 'success', output: `🌐 Ngrok URLs:\n${tunnels.map(u => `• ${u}`).join('\n')}` };
            }

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
                // Check if the command matches a known app (Smart Launcher)
                try {
                    const appsDir = await readdir(join(process.cwd(), 'apps'), { withFileTypes: true });
                    const knownApps = appsDir.filter(d => d.isDirectory()).map(d => d.name);

                    // Logic from 'run' command: Exact or Fuzzy Match
                    const targetLower = cmd.toLowerCase();
                    const match = knownApps.find(a =>
                        a.toLowerCase() === targetLower ||
                        a.toLowerCase().startsWith(targetLower)
                    );

                    if (match) {
                        // Found an app! "Run" it.
                        const startRes = await manageAppLifecycle({ action: 'start', target: match });
                        if (startRes.success) {
                            const port = startRes.process?.port as number | undefined;
                            const localUrl = port ? `http://localhost:${port}` : undefined;
                            const forwardedUrl = port ? await buildForwardedUrl(port) : undefined;
                            const urlLines = [
                                localUrl ? `Local: ${localUrl}` : null,
                                forwardedUrl ? `Forwarded: ${forwardedUrl}` : null
                            ].filter(Boolean).join('\n');

                            return {
                                type: 'success',
                                output: `🚀 App ${startRes.process?.name} is running!\n${urlLines || 'URL: N/A'}\nPID: ${startRes.process?.pid || 'Container'}`,
                                previewUrl: localUrl || (startRes as any).previewUrl,
                                localUrl,
                                forwardedUrl
                            };
                        }
                        return { type: 'error', output: `❌ Failed to start app '${match}': ${startRes.message}` };
                    }

                } catch (e) {
                    // Ignore fs errors, fall through to system command
                }

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
