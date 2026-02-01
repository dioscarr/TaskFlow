import 'dotenv/config';

import { PrismaClient } from '@prisma/client';
import { chatWithAI } from '../app/actions';
import { FeedbackLoopEngine } from '../lib/agents/FeedbackLoopEngine';
import { AgentCommunicator } from '../lib/agents/AgentCommunicator';

type AgentJobRecord = {
    id: string;
    type: string;
    payload: unknown;
    sessionId: string | null;
    userId: string;
    iteration: number;
    maxIterations: number;
    autonomyLevel: string;
};

const prisma = new PrismaClient();

type ChatJobPayload = {
    query: string;
    fileIds?: string[];
    history?: { role: 'user' | 'model'; parts: { text: string }[] }[];
    currentFolder?: string;
    currentFolderId?: string;
    allowToolExecution?: boolean;
    proposedTools?: string[];
};

type ChatResult = {
    success: boolean;
    text?: string;
    toolUsed?: string;
    message?: string;
    toolResult?: any;
    toolArgs?: any;
};

type ActivityType = 'info' | 'success' | 'warning' | 'error';

const workerId = process.env.AGENT_WORKER_ID || `worker-${process.pid}`;
const pollMs = Number(process.env.AGENT_POLL_MS || 2000);

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function claimNextJob() {
    console.log(`🔍 Checking for approved jobs...`);
    try {
        return await prisma.$transaction(async (tx) => {
            const totalRemaining = await tx.agentJob.count({ where: { status: 'queued', approved: true } });
            const job = await tx.agentJob.findFirst({
                where: { status: 'queued', approved: true },
                orderBy: { createdAt: 'asc' }
            });

            if (!job) {
                // console.log('📭 No jobs found.');
                return null;
            }

            console.log(`🚩 Found job ${job.id}. Claiming...`);
            return await tx.agentJob.update({
                where: { id: job.id },
                data: {
                    status: 'running',
                    workerId,
                    startedAt: new Date(),
                    attempts: { increment: 1 }
                }
            });
        });
    } catch (error) {
        console.error('❌ Error claiming job:', error);
        return null;
    }
}

async function logActivity(
    userId: string,
    title: string,
    message: string,
    options?: { type?: ActivityType; toolUsed?: string; sessionId?: string; fileId?: string }
) {
    try {
        await prisma.agentActivity.create({
            data: {
                type: options?.type || 'info',
                title,
                message,
                toolUsed: options?.toolUsed,
                sessionId: options?.sessionId,
                fileId: options?.fileId,
                userId
            }
        });
    } catch (error) {
        console.error('Failed to log agent activity:', error);
    }
}

const buildQueryPreview = (query?: string) => {
    if (!query) return 'n/a';
    const normalized = query.replace(/\s+/g, ' ').trim();
    return normalized.length > 200 ? `${normalized.slice(0, 200)}…` : normalized;
};

const formatFailureDetails = (message?: string, error?: unknown, jobId?: string, iteration?: number) => {
    const safeMessage = message || 'Unknown error';
    const errorMessage = error instanceof Error ? error.message : error ? String(error) : '';
    const errorStack = error instanceof Error ? error.stack : '';
    const stackPreview = errorStack ? errorStack.split('\n').slice(0, 6).join('\n') : '';
    const parts = [
        jobId ? `Job: ${jobId}` : undefined,
        iteration !== undefined ? `Iteration: ${iteration}` : undefined,
        `Reason: ${safeMessage}`,
        errorMessage && errorMessage !== safeMessage ? `Error: ${errorMessage}` : undefined,
        stackPreview ? `Stack:\n${stackPreview}` : undefined
    ].filter(Boolean);
    return parts.join('\n');
};

const isFatalFailure = (message?: string) => {
    if (!message) return false;
    const lowered = message.toLowerCase();
    return lowered.includes('api key missing') || lowered.includes('gemini api key missing');
};

async function finalizeJob(jobId: string, status: 'succeeded' | 'failed', result: unknown, error?: string) {
    await prisma.agentJob.update({
        where: { id: jobId },
        data: {
            status,
            finishedAt: new Date(),
            result: result as any,
            error: error || null
        }
    });
}

const feedbackEngine = new FeedbackLoopEngine();
const communicator = new AgentCommunicator();

async function runJob(job: AgentJobRecord) {
    if (job.type !== 'chat_task') {
        const failureMessage = `Unknown job type: ${job.type}`;
        await finalizeJob(job.id, 'failed', null, failureMessage);
        await logActivity(job.userId, 'Background Agent Failed', formatFailureDetails(failureMessage, null, job.id, job.iteration), {
            type: 'error',
            toolUsed: 'agent_worker',
            sessionId: job.sessionId || undefined
        });
        return;
    }

    const payload = (job.payload && typeof job.payload === 'object' ? job.payload : {}) as Partial<ChatJobPayload>;
    if (!payload.query || typeof payload.query !== 'string') {
        const failureMessage = 'Missing query in job payload';
        await finalizeJob(job.id, 'failed', null, failureMessage);
        await logActivity(job.userId, 'Background Agent Failed', formatFailureDetails(failureMessage, null, job.id, job.iteration), {
            type: 'error',
            toolUsed: 'agent_worker',
            sessionId: job.sessionId || undefined
        });
        return;
    }

    await logActivity(job.userId, 'Background Agent Started', `Processing job ${job.id} (Iteration ${job.iteration || 0})\nQuery: ${buildQueryPreview(payload.query)}`, {
        type: 'info',
        toolUsed: 'agent_worker',
        sessionId: job.sessionId || undefined
    });

    try {
        const result = await chatWithAI(
            payload.query,
            payload.fileIds || [],
            payload.history || [],
            payload.currentFolder,
            payload.currentFolderId,
            { sessionId: job.sessionId || undefined, allowToolExecution: true, agentMode: 'tool-agent' }
        ) as ChatResult;

        if (result.success) {
            // Handle Chat Success
            if (job.sessionId) {
                await prisma.chatMessage.create({
                    data: {
                        sessionId: job.sessionId,
                        role: 'ai',
                        content: result.text || 'Background task completed.',
                        toolUsed: result.toolUsed || undefined,
                        toolResult: result.toolResult || undefined,
                        toolArgs: result.toolArgs || undefined
                    }
                });

                await prisma.chatSession.update({
                    where: { id: job.sessionId },
                    data: { updatedAt: new Date() }
                });
            }

            // --- FEEDBACK LOOP LOGIC ---
            const analysis = await feedbackEngine.analyzeResult(job.id, result);

            await prisma.agentJob.update({
                where: { id: job.id },
                data: { feedback: analysis as any }
            });

            if (!analysis.reachedGoal && job.iteration < (job.maxIterations || 5)) {
                console.log(`🔄 Task not fully complete. Creating iteration job...`);
                const nextAction = analysis.nextStep || 'Continue with the task based on the previous result.';

                await communicator.sendMessage({
                    jobId: job.id,
                    fromAgent: workerId,
                    messageType: 'feedback',
                    content: { analysis, nextAction }
                });

                await feedbackEngine.createIterationJob(job.id, nextAction, payload);
                await logActivity(job.userId, 'Iteration Created', `Task requires more work: ${analysis.reasoning}`, {
                    type: 'info',
                    toolUsed: result.toolUsed,
                    sessionId: job.sessionId || undefined
                });
            } else {
                await finalizeJob(job.id, 'succeeded', result);
                await logActivity(job.userId, 'Background Agent Completed', `Job ${job.id} finished successfully.`, {
                    type: 'success',
                    toolUsed: result.toolUsed,
                    sessionId: job.sessionId || undefined
                });
            }
            // ---------------------------

        } else {
            // Handle Tool/AI Failure
            const failureMessage = result.message || 'Background agent failed';
            await finalizeJob(job.id, 'failed', result, failureMessage);
            await logActivity(job.userId, 'Background Agent Failed', formatFailureDetails(failureMessage, null, job.id, job.iteration), {
                type: 'error',
                toolUsed: result.toolUsed,
                sessionId: job.sessionId || undefined
            });

            // Auto-retry if enabled and within limits
            if (job.iteration < (job.maxIterations || 5) && !isFatalFailure(failureMessage)) {
                console.log(`🩹 Attempting auto-recovery for failed job ${job.id}`);
                await feedbackEngine.createIterationJob(job.id, `The previous attempt failed with: ${result.message}. Please try an alternative approach.`, payload);
            }
        }
    } catch (error: any) {
        console.error('Fatal job error:', error);
        const failureMessage = error?.message || 'Fatal job error';
        await finalizeJob(job.id, 'failed', null, failureMessage);
        await logActivity(job.userId, 'Background Agent Fatal Error', formatFailureDetails(failureMessage, error, job.id, job.iteration), {
            type: 'error',
            toolUsed: 'system',
            sessionId: job.sessionId || undefined
        });
    }
}

async function startWorker() {
    console.log(`🧠 Background agent worker started (${workerId})`);

    while (true) {
        try {
            const job = await claimNextJob();
            if (!job) {
                await sleep(pollMs);
                continue;
            }

            console.log(`⚡ Processing job ${job.id} (${job.type})`);
            await runJob(job);
        } catch (error) {
            console.error('Worker loop error:', error);
            await sleep(pollMs);
        }
    }
}

startWorker()
    .catch((error) => {
        console.error('Worker crashed:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
