#!/usr/bin/env node
/**
 * TaskFlow Interactive Shell
 * A premium CLI for commanding the Omni-Agent Army
 */

import readline from 'readline';
import { exec } from 'child_process';
import { promisify } from 'util';
import prisma from '@/lib/prisma';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';

const execAsync = promisify(exec);

interface Command {
    name: string;
    description: string;
    usage: string;
    handler: (args: string[]) => Promise<void>;
}

class TaskFlowShell {
    private rl: readline.Interface;
    private commands: Map<string, Command> = new Map();
    private history: string[] = [];
    private historyIndex: number = -1;

    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: chalk.cyan.bold('TaskFlow> '),
            completer: this.completer.bind(this)
        });

        this.registerCommands();
        this.setupEventHandlers();
    }

    private registerCommands() {
        // Agent Commands
        this.commands.set('agent', {
            name: 'agent',
            description: 'Deploy an agent to execute a task',
            usage: 'agent <objective>',
            handler: this.handleAgent.bind(this)
        });

        this.commands.set('jobs', {
            name: 'jobs',
            description: 'List all agent jobs',
            usage: 'jobs [--status <status>] [--limit <n>]',
            handler: this.handleJobs.bind(this)
        });

        this.commands.set('job', {
            name: 'job',
            description: 'Get details of a specific job',
            usage: 'job <job-id>',
            handler: this.handleJob.bind(this)
        });

        // Workflow Commands
        this.commands.set('workflows', {
            name: 'workflows',
            description: 'List available workflows',
            usage: 'workflows',
            handler: this.handleWorkflows.bind(this)
        });

        this.commands.set('workflow', {
            name: 'workflow',
            description: 'Execute a workflow',
            usage: 'workflow <name> [args...]',
            handler: this.handleWorkflow.bind(this)
        });

        // App Management
        this.commands.set('apps', {
            name: 'apps',
            description: 'List all apps in the apps/ folder',
            usage: 'apps',
            handler: this.handleApps.bind(this)
        });

        this.commands.set('scaffold', {
            name: 'scaffold',
            description: 'Scaffold a new Vite app',
            usage: 'scaffold <project-name>',
            handler: this.handleScaffold.bind(this)
        });

        // Database Commands
        this.commands.set('db', {
            name: 'db',
            description: 'Execute raw SQL query',
            usage: 'db <query>',
            handler: this.handleDb.bind(this)
        });

        this.commands.set('users', {
            name: 'users',
            description: 'List all users',
            usage: 'users',
            handler: this.handleUsers.bind(this)
        });

        // System Commands
        this.commands.set('status', {
            name: 'status',
            description: 'Show system status',
            usage: 'status',
            handler: this.handleStatus.bind(this)
        });

        this.commands.set('clear', {
            name: 'clear',
            description: 'Clear the terminal',
            usage: 'clear',
            handler: this.handleClear.bind(this)
        });

        this.commands.set('help', {
            name: 'help',
            description: 'Show available commands',
            usage: 'help [command]',
            handler: this.handleHelp.bind(this)
        });

        this.commands.set('exit', {
            name: 'exit',
            description: 'Exit the shell',
            usage: 'exit',
            handler: this.handleExit.bind(this)
        });
    }

    private setupEventHandlers() {
        this.rl.on('line', async (line) => {
            const trimmed = line.trim();
            if (!trimmed) {
                this.rl.prompt();
                return;
            }

            this.history.push(trimmed);
            this.historyIndex = this.history.length;

            await this.executeCommand(trimmed);
            this.rl.prompt();
        });

        this.rl.on('close', () => {
            console.log(chalk.yellow('\n👋 Goodbye!'));
            process.exit(0);
        });

        // Handle Ctrl+C
        this.rl.on('SIGINT', () => {
            console.log(chalk.yellow('\n(To exit, type "exit" or press Ctrl+D)'));
            this.rl.prompt();
        });
    }

    private completer(line: string): [string[], string] {
        const completions = Array.from(this.commands.keys());
        const hits = completions.filter((c) => c.startsWith(line));
        return [hits.length ? hits : completions, line];
    }

    private async executeCommand(input: string) {
        const [commandName, ...args] = input.split(/\s+/);
        const command = this.commands.get(commandName);

        if (!command) {
            console.log(chalk.red(`❌ Unknown command: ${commandName}`));
            console.log(chalk.gray('Type "help" for available commands'));
            return;
        }

        try {
            await command.handler(args);
        } catch (error: any) {
            console.log(chalk.red(`❌ Error: ${error.message}`));
        }
    }

    // ==================== COMMAND HANDLERS ====================

    private async handleAgent(args: string[]) {
        if (args.length === 0) {
            console.log(chalk.yellow('Usage: agent <objective>'));
            return;
        }

        const objective = args.join(' ');
        const spinner = ora(`Deploying agent for: ${objective}`).start();

        try {
            const { enqueueAgentJob } = await import('../app/actions');

            const user = await prisma.user.findFirst();
            if (!user) {
                spinner.fail('No user found. Please create a user first.');
                return;
            }

            const job = await enqueueAgentJob({
                type: 'chat_task',
                payload: { objective, query: objective },
                approved: true
            });

            spinner.succeed(`Agent deployed! Job ID: ${chalk.cyan(job.id)}`);
            console.log(chalk.gray(`Track progress with: job ${job.id}`));
        } catch (error: any) {
            spinner.fail(`Failed to deploy agent: ${error.message}`);
        }
    }

    private async handleJobs(args: string[]) {
        const spinner = ora('Fetching jobs...').start();

        try {
            const jobs = await prisma.agentJob.findMany({
                take: 20,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    type: true,
                    status: true,
                    createdAt: true,
                    finishedAt: true
                }
            });

            spinner.stop();

            if (jobs.length === 0) {
                console.log(chalk.yellow('No jobs found'));
                return;
            }

            const table = new Table({
                head: ['ID', 'Type', 'Status', 'Created', 'Duration'].map(h => chalk.cyan(h)),
                colWidths: [30, 15, 12, 20, 12]
            });

            jobs.forEach(job => {
                const duration = job.finishedAt
                    ? `${Math.round((job.finishedAt.getTime() - job.createdAt.getTime()) / 1000)}s`
                    : 'running';

                const statusColor = job.status === 'succeeded' ? chalk.green
                    : job.status === 'failed' ? chalk.red
                        : chalk.yellow;

                table.push([
                    job.id.substring(0, 28),
                    job.type,
                    statusColor(job.status),
                    job.createdAt.toLocaleString(),
                    duration
                ]);
            });

            console.log(table.toString());
        } catch (error: any) {
            spinner.fail(`Failed to fetch jobs: ${error.message}`);
        }
    }

    private async handleJob(args: string[]) {
        if (args.length === 0) {
            console.log(chalk.yellow('Usage: job <job-id>'));
            return;
        }

        const jobId = args[0];
        const spinner = ora(`Fetching job ${jobId}...`).start();

        try {
            const job = await prisma.agentJob.findUnique({
                where: { id: jobId },
                include: { messages: true }
            });

            spinner.stop();

            if (!job) {
                console.log(chalk.red(`Job not found: ${jobId}`));
                return;
            }

            console.log(chalk.cyan.bold('\n📋 Job Details\n'));
            console.log(`${chalk.bold('ID:')} ${job.id}`);
            console.log(`${chalk.bold('Type:')} ${job.type}`);
            console.log(`${chalk.bold('Status:')} ${job.status}`);
            console.log(`${chalk.bold('Created:')} ${job.createdAt.toLocaleString()}`);
            if (job.finishedAt) {
                console.log(`${chalk.bold('Finished:')} ${job.finishedAt.toLocaleString()}`);
            }
            console.log(`${chalk.bold('Payload:')} ${JSON.stringify(job.payload, null, 2)}`);

            if (job.result) {
                console.log(`${chalk.bold('Result:')} ${JSON.stringify(job.result, null, 2)}`);
            }

            if (job.messages.length > 0) {
                console.log(chalk.cyan.bold('\n💬 Messages\n'));
                job.messages.forEach(msg => {
                    console.log(`[${msg.createdAt.toLocaleTimeString()}] ${msg.content}`);
                });
            }
        } catch (error: any) {
            spinner.fail(`Failed to fetch job: ${error.message}`);
        }
    }

    private async handleWorkflows(args: string[]) {
        const spinner = ora('Scanning workflows...').start();

        try {
            const { readdir } = await import('fs/promises');
            const workflows = await readdir('.agent/workflows');

            spinner.stop();

            console.log(chalk.cyan.bold('\n📂 Available Workflows\n'));
            workflows.forEach(file => {
                if (file.endsWith('.md')) {
                    const name = file.replace('.md', '');
                    console.log(`  ${chalk.green('/')}${name}`);
                }
            });
        } catch (error: any) {
            spinner.fail(`Failed to list workflows: ${error.message}`);
        }
    }

    private async handleWorkflow(args: string[]) {
        if (args.length === 0) {
            console.log(chalk.yellow('Usage: workflow <name> [args...]'));
            return;
        }

        const workflowName = args[0];
        const workflowArgs = args.slice(1);

        console.log(chalk.cyan(`Executing workflow: ${workflowName}`));
        console.log(chalk.gray(`Args: ${workflowArgs.join(' ')}`));

        // TODO: Implement workflow execution
        console.log(chalk.yellow('Workflow execution not yet implemented'));
    }

    private async handleApps(args: string[]) {
        const spinner = ora('Scanning apps folder...').start();

        try {
            const { readdir } = await import('fs/promises');
            const apps = await readdir('apps', { withFileTypes: true });
            const directories = apps.filter(dirent => dirent.isDirectory());

            spinner.stop();

            console.log(chalk.cyan.bold(`\n📱 Apps (${directories.length})\n`));
            directories.forEach(dir => {
                console.log(`  ${chalk.green('•')} ${dir.name}`);
            });
        } catch (error: any) {
            spinner.fail(`Failed to list apps: ${error.message}`);
        }
    }

    private async handleScaffold(args: string[]) {
        if (args.length === 0) {
            console.log(chalk.yellow('Usage: scaffold <project-name>'));
            return;
        }

        const projectName = args[0];
        const spinner = ora(`Scaffolding ${projectName}...`).start();

        try {
            const { executeScaffoldVite } = await import('../app/actions');
            const result = await executeScaffoldVite({ projectName });

            if (result.success) {
                spinner.succeed(`Scaffolded ${projectName} successfully!`);
                console.log(chalk.gray(`Location: apps/${projectName}`));
            } else {
                spinner.fail(`Failed to scaffold: ${result.message}`);
            }
        } catch (error: any) {
            spinner.fail(`Failed to scaffold: ${error.message}`);
        }
    }

    private async handleDb(args: string[]) {
        if (args.length === 0) {
            console.log(chalk.yellow('Usage: db <query>'));
            return;
        }

        const query = args.join(' ');
        const spinner = ora('Executing query...').start();

        try {
            const result = await prisma.$queryRawUnsafe(query);
            spinner.stop();
            console.log(JSON.stringify(result, null, 2));
        } catch (error: any) {
            spinner.fail(`Query failed: ${error.message}`);
        }
    }

    private async handleUsers(args: string[]) {
        const spinner = ora('Fetching users...').start();

        try {
            const users = await prisma.user.findMany({
                select: {
                    id: true,
                    email: true,
                    name: true,
                    createdAt: true
                }
            });

            spinner.stop();

            const table = new Table({
                head: ['ID', 'Email', 'Name', 'Created'].map(h => chalk.cyan(h))
            });

            users.forEach(user => {
                table.push([
                    user.id.substring(0, 28),
                    user.email || 'N/A',
                    user.name || 'N/A',
                    user.createdAt.toLocaleDateString()
                ]);
            });

            console.log(table.toString());
        } catch (error: any) {
            spinner.fail(`Failed to fetch users: ${error.message}`);
        }
    }

    private async handleStatus(args: string[]) {
        const spinner = ora('Checking system status...').start();

        try {
            const [userCount, jobCount, runningJobs] = await Promise.all([
                prisma.user.count(),
                prisma.agentJob.count(),
                prisma.agentJob.count({ where: { status: 'running' } })
            ]);

            spinner.stop();

            console.log(chalk.cyan.bold('\n⚡ TaskFlow System Status\n'));
            console.log(`${chalk.bold('Users:')} ${userCount}`);
            console.log(`${chalk.bold('Total Jobs:')} ${jobCount}`);
            console.log(`${chalk.bold('Running Jobs:')} ${runningJobs}`);
            console.log(`${chalk.bold('Omni-Agent Army:')} ${chalk.green('OPERATIONAL')}`);
        } catch (error: any) {
            spinner.fail(`Failed to get status: ${error.message}`);
        }
    }

    private async handleClear(args: string[]) {
        console.clear();
    }

    private async handleHelp(args: string[]) {
        if (args.length > 0) {
            const commandName = args[0];
            const command = this.commands.get(commandName);

            if (!command) {
                console.log(chalk.red(`Unknown command: ${commandName}`));
                return;
            }

            console.log(chalk.cyan.bold(`\n${command.name}\n`));
            console.log(`${chalk.bold('Description:')} ${command.description}`);
            console.log(`${chalk.bold('Usage:')} ${command.usage}\n`);
            return;
        }

        console.log(chalk.cyan.bold('\n🚀 TaskFlow Interactive Shell\n'));
        console.log(chalk.gray('Available commands:\n'));

        const table = new Table({
            head: ['Command', 'Description'].map(h => chalk.cyan(h)),
            colWidths: [20, 60]
        });

        this.commands.forEach(cmd => {
            table.push([chalk.green(cmd.name), cmd.description]);
        });

        console.log(table.toString());
        console.log(chalk.gray('\nType "help <command>" for detailed usage\n'));
    }

    private async handleExit(args: string[]) {
        this.rl.close();
    }

    public start() {
        console.clear();
        console.log(chalk.cyan.bold('╔════════════════════════════════════════════╗'));
        console.log(chalk.cyan.bold('║   TaskFlow Interactive Shell v1.0          ║'));
        console.log(chalk.cyan.bold('║   Omni-Agent Army Command Center          ║'));
        console.log(chalk.cyan.bold('╚════════════════════════════════════════════╝\n'));
        console.log(chalk.gray('Type "help" for available commands\n'));
        this.rl.prompt();
    }
}

// Start the shell
const shell = new TaskFlowShell();
shell.start();
