import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

interface AgentBrain {
    lessons: string[];
    successfulCommands: string[];
    failedCommands: string[];
    environmentFacts: Record<string, string>;
    jobSummaries: Record<string, string>; // jobId -> concise summary
}

interface MemoryManifest {
    summaries: Record<string, string>; // filename -> summary
}

const MEMORY_DIR = path.join(process.cwd(), 'data', 'agent_memory');
const MANIFEST_FILE = path.join(MEMORY_DIR, 'index.json');

export class AgentMemory {
    private currentBrain: AgentBrain = this.createEmptyBrain();
    private manifest: MemoryManifest = { summaries: {} };
    private currentFile: string = '';

    constructor() {
        this.init();
    }

    private createEmptyBrain(): AgentBrain {
        return {
            lessons: [],
            successfulCommands: [],
            failedCommands: [],
            environmentFacts: {},
            jobSummaries: {}
        };
    }

    private getWeekId(): string {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 1);
        const days = Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
        const weekNumber = Math.ceil((now.getDay() + 1 + days) / 7);
        return `${now.getFullYear()}_W${weekNumber.toString().padStart(2, '0')}`;
    }

    private async init() {
        try {
            await mkdir(MEMORY_DIR, { recursive: true });
            this.currentFile = path.join(MEMORY_DIR, `${this.getWeekId()}.json`);
            await this.loadManifest();
            await this.loadBrain();
        } catch (e) {
            console.error("Failed to init memory", e);
        }
    }

    private async loadManifest() {
        try {
            const data = await readFile(MANIFEST_FILE, 'utf-8');
            this.manifest = JSON.parse(data);
        } catch {
            this.manifest = { summaries: {} };
        }
    }

    private async loadBrain() {
        try {
            const data = await readFile(this.currentFile, 'utf-8');
            this.currentBrain = JSON.parse(data);
            if (!this.currentBrain.jobSummaries) this.currentBrain.jobSummaries = {};
        } catch {
            this.currentBrain = this.createEmptyBrain();
        }
    }

    private async save() {
        try {
            await mkdir(MEMORY_DIR, { recursive: true });
            await writeFile(this.currentFile, JSON.stringify(this.currentBrain, null, 2));
            await writeFile(MANIFEST_FILE, JSON.stringify(this.manifest, null, 2));
        } catch (e) {
            console.error("Failed to save partitioned memory", e);
        }
    }

    // --- Public API ---

    async addLesson(lesson: string) {
        if (!this.currentFile) await this.init();
        if (!this.currentBrain.lessons.includes(lesson)) {
            this.currentBrain.lessons.push(lesson);
            await this.save();
        }
    }

    async recordCommandResult(command: string, success: boolean) {
        if (!this.currentFile) await this.init();
        const cmd = command.split(' ')[0];
        if (success) {
            if (!this.currentBrain.successfulCommands.includes(cmd)) {
                this.currentBrain.successfulCommands.push(cmd);
                await this.save();
            }
        } else {
            if (!this.currentBrain.failedCommands.includes(cmd)) {
                this.currentBrain.failedCommands.push(cmd);
                await this.save();
            }
        }
    }

    async addJobSummary(jobId: string, summary: string) {
        if (!this.currentFile) await this.init();
        this.currentBrain.jobSummaries[jobId] = summary;
        await this.save();
    }

    async updateSummary(filename: string, summary: string) {
        this.manifest.summaries[filename] = summary;
        await this.save();
    }

    getContext(): string {
        const archives = Object.entries(this.manifest.summaries)
            .map(([file, sum]) => `- [Archive ${file}]: ${sum}`)
            .join('\n');

        const recentJobs = Object.values(this.currentBrain.jobSummaries || {}).slice(-5).map(s => `• ${s}`).join('\n');

        const current = `
[CURRENT WEEK MEMORY (${path.basename(this.currentFile)})]
- Lessons: ${this.currentBrain.lessons.join('; ')}
- Proven Commands: ${this.currentBrain.successfulCommands.join(', ')}
- Failed Commands: ${this.currentBrain.failedCommands.join(', ')}
- Recent Activity:
${recentJobs}
        `.trim();

        return `
[SYSTEM LONG-TERM MEMORY]
${archives || "(No archives yet)"}

${current}
        `.trim();
    }
}

export const memory = new AgentMemory();
