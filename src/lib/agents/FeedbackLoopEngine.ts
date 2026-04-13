import { PrismaClient } from '@prisma/client';
import { TOOL_LIBRARY } from '../toolLibrary';
import { ensureAgentWorkerAvailable } from '@/lib/agentWorkerBootstrap';

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

        const payload = job.payload && typeof job.payload === 'object' ? job.payload : {};
        const queryText = typeof (payload as { query?: unknown }).query === 'string'
            ? (payload as { query: string }).query
            : '';
        const requiresSelfReflection = /\b(app|web\s*app|website|scaffold|codegen|generate\s+app|build\s+app|e-?commerce)\b/i.test(queryText);

        // If the result itself contains a clear error, we need to iterate
        if (result?.success === false) {
            const errorMsg = (result.message || 'Unknown error').toLowerCase();

            // Self-healing recommendations
            if (errorMsg.includes('module not found') || errorMsg.includes('cannot find module')) {
                return {
                    success: false,
                    reachedGoal: false,
                    reasoning: `Deployment failed due to missing dependencies: ${result.message}.`,
                    nextStep: 'Try running "npm install" or "npm install <missing-module>" to resolve dependencies.',
                    suggestedTools: ['execute_command']
                };
            }

            if (errorMsg.includes('port') && errorMsg.includes('already in use')) {
                return {
                    success: false,
                    reachedGoal: false,
                    reasoning: `Port conflict detected: ${result.message}.`,
                    nextStep: 'Check for processes running on the target port and stop them, or use a different port.',
                    suggestedTools: ['observe_status', 'execute_command']
                };
            }

            return {
                success: false,
                reachedGoal: false,
                reasoning: `The tool execution failed: ${result.message || 'Unknown error'}. I need to try a different approach or fix the parameters.`,
                nextStep: 'Retry the previous step with corrected parameters.'
            };
        }

        // Heuristics for critical actions that require verification
        const toolUsed = result?.toolUsed || '';
        if (toolUsed === 'execute_command' || toolUsed === 'execute_command_in_app') {
            const cmd = (result?.toolArgs?.command || '').toLowerCase();
            if (cmd.includes('npm run dev') || cmd.includes('npm start') || cmd.includes('docker run')) {
                return {
                    success: false, // Mark as incomplete so we verify
                    reachedGoal: false,
                    reasoning: 'An application was started. I need to verify it is actually responsive and listening on the expected port.',
                    nextStep: 'Wait for 3 seconds and then check the port status.',
                    suggestedTools: ['wait', 'observe_status']
                };
            }
        }

        // Final verification check for create_html_file or create_file
        if (toolUsed === 'create_html_file' || toolUsed === 'create_file') {
            return {
                success: true,
                reachedGoal: false, // One more step to verify existence
                reasoning: 'The file was reported as created. I should verify it exists on disk for robustness.',
                nextStep: 'Observe if the file exists on the file system.',
                suggestedTools: ['observe_status']
            };
        }

        if (requiresSelfReflection) {
            const outputText = typeof result?.text === 'string' ? result.text : '';
            const hasSelfReflection = /self[-\s]?reflection/i.test(outputText);

            if (!hasSelfReflection) {
                return {
                    success: false,
                    reachedGoal: false,
                    reasoning: 'The response is missing the required Self-Reflection section for app/code generation tasks.',
                    nextStep: 'Append a Self-Reflection section with issues found, fixes applied, remaining risks, and a 0–1 confidence score.'
                };
            }
        }

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

        ensureAgentWorkerAvailable().catch(err => console.error('Worker bootstrap failed:', err));

        return nextJob;
    }
}
