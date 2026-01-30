import { PrismaClient } from '@prisma/client';
import { TOOL_LIBRARY } from '../toolLibrary';

const prisma = new PrismaClient() as any;

export interface FeedbackAnalysis {
    success: boolean;
    reachedGoal: boolean;
    reasoning: string;
    nextStep?: string;
    suggestedTools?: string[];
}

export class FeedbackLoopEngine {
    /**
     * Analyzes the result of an agent job and determines if the task is complete 
     * or if another iteration is needed.
     */
    async analyzeResult(jobId: string, result: any): Promise<FeedbackAnalysis> {
        const job = await prisma.agentJob.findUnique({
            where: { id: jobId },
            include: { messages: true }
        });

        if (!job) throw new Error(`Job not found: ${jobId}`);

        console.log(`🧠 Analyzing result for job ${jobId} (Iteration ${job.iteration})`);

        // If the result itself contains a clear error, we need to iterate
        if (result?.success === false) {
            return {
                success: false,
                reachedGoal: false,
                reasoning: `The tool execution failed: ${result.message || 'Unknown error'}. I need to try a different approach or fix the parameters.`,
                nextStep: 'Retry the previous step with corrected parameters.'
            };
        }

        // Logic to determine if we should continue based on the type of task
        // For now, let's implement a simple heuristic:
        // If it was a file creation task, verify if the file exists and has content.

        // This is where we would call the LLM to analyze the output vs the goal.
        // For the MVP, we assume a single pass is successful unless an error occurred,
        // but we lay the ground for iterative refinement.

        return {
            success: true,
            reachedGoal: true,
            reasoning: 'The task appears to have been completed successfully.'
        };
    }

    /**
     * Determines if the agent should continue iterating.
     */
    async shouldContinue(jobId: string): Promise<boolean> {
        const job = await prisma.agentJob.findUnique({
            where: { id: jobId }
        });

        if (!job) return false;

        // Termination conditions
        if (job.status === 'succeeded' && !job.nextAction) return false;
        if (job.iteration >= job.maxIterations) {
            console.log(`⚠️ Job ${jobId} reached max iterations (${job.maxIterations})`);
            return false;
        }

        return true;
    }

    /**
     * Creates a child job for the next iteration of a task.
     */
    async createIterationJob(parentJobId: string, nextAction: string, payload: any): Promise<any> {
        const parentJob = await prisma.agentJob.findUnique({
            where: { id: parentJobId }
        });

        if (!parentJob) throw new Error(`Parent job not found: ${parentJobId}`);

        const iteration = parentJob.iteration + 1;

        console.log(`🔄 Creating iteration ${iteration} for job ${parentJobId}`);

        const nextJob = await prisma.agentJob.create({
            data: {
                type: parentJob.type,
                payload: {
                    ...payload,
                    query: nextAction, // The next step becomes the new query
                },
                status: 'queued',
                userId: parentJob.userId,
                sessionId: parentJob.sessionId,
                approved: true, // Auto-approve iterations if autonomy is high
                parentJobId: parentJobId,
                iteration: iteration,
                maxIterations: parentJob.maxIterations,
                autonomyLevel: parentJob.autonomyLevel,
                requiresReview: parentJob.autonomyLevel === 'manual'
            }
        });

        return nextJob;
    }
}
