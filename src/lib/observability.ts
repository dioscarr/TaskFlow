
import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export interface ToolMetric {
    count: number;
    errors: number;
    totalLatencyMs: number;
}

export interface SessionMetrics {
    sessionId: string;
    startTime: number;
    lastActive: number;
    totalTurns: number;
    totalTokensInput: number; // Placeholder for now if we don't have exact counts
    totalTokensOutput: number; // Placeholder
    toolUsage: Record<string, ToolMetric>;
    errors: string[];
}

class SessionMetricStore {
    private metrics: Map<string, SessionMetrics> = new Map();
    private readonly storagePath = join(process.cwd(), '.agent', 'metrics');
    private readonly storageFile = join(this.storagePath, 'session_metrics.json');
    private initialized = false;

    constructor() {
        this.init();
    }

    private async init() {
        if (this.initialized) return;
        try {
            if (!existsSync(this.storagePath)) {
                await mkdir(this.storagePath, { recursive: true });
            }
            if (existsSync(this.storageFile)) {
                const data = await readFile(this.storageFile, 'utf-8');
                const raw = JSON.parse(data);
                Object.values(raw).forEach((m: any) => this.metrics.set(m.sessionId, m));
            }
        } catch (e) {
            console.error('Failed to load session metrics:', e);
        }
        this.initialized = true;
    }

    private async persist() {
        try {
            const data = Object.fromEntries(this.metrics);
            await writeFile(this.storageFile, JSON.stringify(data, null, 2));
        } catch (e) {
            console.error('Failed to persist session metrics:', e);
        }
    }

    public getMetrics(sessionId: string): SessionMetrics {
        if (!this.metrics.has(sessionId)) {
            this.metrics.set(sessionId, {
                sessionId,
                startTime: Date.now(),
                lastActive: Date.now(),
                totalTurns: 0,
                totalTokensInput: 0,
                totalTokensOutput: 0,
                toolUsage: {},
                errors: []
            });
        }
        return this.metrics.get(sessionId)!;
    }

    public recordTurn(sessionId: string) {
        const m = this.getMetrics(sessionId);
        m.totalTurns++;
        m.lastActive = Date.now();
        this.persist();
    }

    public recordToolUsage(sessionId: string, toolName: string, success: boolean, latencyMs: number) {
        const m = this.getMetrics(sessionId);
        if (!m.toolUsage[toolName]) {
            m.toolUsage[toolName] = { count: 0, errors: 0, totalLatencyMs: 0 };
        }
        m.toolUsage[toolName].count++;
        m.toolUsage[toolName].totalLatencyMs += latencyMs;
        if (!success) {
            m.toolUsage[toolName].errors++;
        }
        m.lastActive = Date.now();
        this.persist();
    }

    public recordError(sessionId: string, error: string) {
        const m = this.getMetrics(sessionId);
        // Limit error history
        if (m.errors.length >= 50) m.errors.shift();
        m.errors.push(`${new Date().toISOString()}: ${error}`);
        this.persist();
    }
}

export const sessionMetricStore = new SessionMetricStore();
