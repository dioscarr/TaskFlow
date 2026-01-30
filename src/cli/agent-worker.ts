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
};

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

async function logActivity(userId: string, title: string, message: string, toolUsed?: string) {
    try {
        await prisma.agentActivity.create({
            data: {
                type: 'info',
                title,
                message,
                toolUsed,
                userId
            }
        });
    } catch (error) {
        console.error('Failed to log agent activity:', error);
    }
}

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
        await finalizeJob(job.id, 'failed', null, `Unknown job type: ${job.type}`);
        return;
    }

    const payload = (job.payload && typeof job.payload === 'object' ? job.payload : {}) as Partial<ChatJobPayload>;
    if (!payload.query || typeof payload.query !== 'string') {
        await finalizeJob(job.id, 'failed', null, 'Missing query in job payload');
        return;
    }

    await logActivity(job.userId, 'Background Agent Started', `Processing job ${job.id} (Iteration ${job.iteration || 0})`, 'agent_worker');

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
                        toolUsed: result.toolUsed || undefined
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
                await logActivity(job.userId, 'Iteration Created', `Task requires more work: ${analysis.reasoning}`, result.toolUsed);
            } else {
                await finalizeJob(job.id, 'succeeded', result);
                await logActivity(job.userId, 'Background Agent Completed', `Job ${job.id} finished successfully.`, result.toolUsed);
            }
            // ---------------------------

        } else {
            // Handle Tool/AI Failure
            await finalizeJob(job.id, 'failed', result, result.message || 'Background agent failed');
            await logActivity(job.userId, 'Background Agent Failed', `Job ${job.id} failed: ${result.message}`, result.toolUsed);

            // Auto-retry if enabled and within limits
            if (job.iteration < (job.maxIterations || 5)) {
                console.log(`🩹 Attempting auto-recovery for failed job ${job.id}`);
                await feedbackEngine.createIterationJob(job.id, `The previous attempt failed with: ${result.message}. Please try an alternative approach.`, payload);
            }
        }
    } catch (error: any) {
        console.error('Fatal job error:', error);
        await finalizeJob(job.id, 'failed', null, error.message);
        await logActivity(job.userId, 'Background Agent Fatal Error', error.message, 'system');
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
