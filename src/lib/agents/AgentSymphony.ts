
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

import { AgentModel, SymphonyOptions, Logger } from './symphony/types';
import { PlanSchema, ReviewSchema, Plan, ReviewResult, WorkerOutputSchema } from './symphony/schemas';
import { callAgentWithEscalation } from './symphony/utils';
import { memory } from './symphony/memory';
import { SOFTWARE_ARCHITECT_PROMPT, ORCHESTRATOR_AGENT_PROMPT, WORKER_AGENT_PROMPT, RESEARCHER_PROMPT, DEVELOPER_PROMPT, REVIEWER_PROMPT } from './prompts';



export type AgentRole = 'researcher' | 'analyst' | 'writer' | 'critic' | 'orchestrator' | 'developer' | 'qa' | 'generic';

export interface SymphonyState {
    objective: string;
    plan: Plan | null;
    workerResults: Record<string, unknown>;
    criticFeedback: ReviewResult | null;
    status: 'planning' | 'executing' | 'reviewing' | 'completed' | 'needs_revision' | 'error';
    finalOutput?: string;
}

export class AgentSymphony {
    private orchestrator: AgentModel;
    private critic: AgentModel;
    private workers: Partial<Record<AgentRole, AgentModel>>;
    private options: SymphonyOptions;

    constructor(args: {
        orchestrator: AgentModel;
        critic: AgentModel;
        workers: Partial<Record<AgentRole, AgentModel>>;
        options?: SymphonyOptions;
    }) {
        this.orchestrator = args.orchestrator;
        this.critic = args.critic;
        this.workers = args.workers;
        this.options = args.options || { maxRetries: 2, maxIterations: 2 };
    }

    private log(message: string, type: 'info' | 'thinking' | 'error' = 'info') {
        if (this.options.logger) {
            this.options.logger(message, type);
        }
    }

    async run(objective: string, preferredStrategy?: string, jobId?: string): Promise<SymphonyState> {
        const state: SymphonyState = {
            objective,
            plan: null,
            workerResults: {},
            criticFeedback: null,
            status: 'planning'
        };

        const maxIterations = this.options.maxIterations ?? 2;

        try {
            for (let iteration = 0; iteration < maxIterations; iteration++) {
                // 1. Planning Phase
                if (!state.plan || state.status === 'needs_revision') {
                    this.log(`🎼 Symphony: Planning Phase (Iteration ${iteration + 1})...`, 'info');
                    state.status = 'planning';
                    state.plan = await this.createPlan(objective, state.criticFeedback, preferredStrategy);
                }

                // ... execution ...


                // 2. Execution Phase
                this.log(`🎼 Symphony: Execution Phase...`, 'info');
                state.status = 'executing';
                state.workerResults = await this.executePlan(state.plan!);

                // 3. Review Phase
                // 3. Review Phase
                this.log(`🎼 Symphony: Review Phase...`, 'info');
                state.status = 'reviewing';
                const review = await this.reviewResults(objective, state.workerResults);
                state.criticFeedback = review;

                if (review.status === 'PASS') {
                    state.status = 'completed';
                    state.finalOutput = await this.synthesizeFinal(objective, state.workerResults);

                    // AUTO-SUMMARY for Memory
                    if (jobId) {
                        try {
                            const summaryPrompt = `
                            [SYSTEM TASK]
                            Summarize the OUTCOME of this job ID ${jobId} in one technically dense sentence.
                            Focus on files created, bugs fixed, or key decisions.
                            Format as a checklist item.
                            No chatter.
                            
                            OBJECTIVE: ${objective}
                            RESULTS: ${JSON.stringify(state.workerResults)}
                            `.trim();
                            const summary = await this.orchestrator.complete(summaryPrompt);
                            await memory.addJobSummary(jobId, summary);
                            this.log(`🎼 Symphony: Stored job summary in memory.`, 'info');
                        } catch (e) {
                            this.log(`[Memory] Failed to summarize: ${e}`, 'error');
                        }
                    }

                    return state;
                }

                this.log(`🎼 Symphony: Review Failed. Feedback: ${review.feedback}`, 'info');
                state.status = 'needs_revision';
            }

            state.status = 'error'; // Max iterations reached
            return state;

        } catch (error) {
            this.log(`🎼 Symphony: Fatal Error: ${error}`, 'error');
            state.status = 'error';
            return state;
        }
    }

    private async createPlan(objective: string, feedback: ReviewResult | null, preferredStrategy?: string): Promise<Plan> {
        let prompt = [
            ORCHESTRATOR_AGENT_PROMPT,
            '',
            '═══════════════════════════════════════════════════════════════════',
            'PLANNING TASK',
            '═══════════════════════════════════════════════════════════════════',
            `OBJECTIVE: ${objective}`,
            preferredStrategy ? `STRATEGY DIRECTION: ${preferredStrategy}` : '',
            'Create a detailed execution plan breaking this objective into sub-tasks for specialized agents.',
            'Available Agents: ' + Object.keys(this.workers).join(', '),
            'IMPORTANT: Start with a <thinking> block to explain your reasoning.',
            'THEN: Output the plan as a SINGLE valid JSON object wrapped in ```json code blocks.',
            'The JSON must match this structure: { tasks: [{ id (string), agentType (enum), description (string), priority (number 1-5), dependencies? (string[]) }], reasoning (string) }',
            'Examples: priority: 5 (NOT "5" or "High"), agentType: "developer" (NOT "Developer").'
        ].join('\n');

        if (feedback) {
            prompt += `\n\nPREVIOUS PLAN FAILED REVIEW.\nCRITIC FEEDBACK: ${feedback.feedback}\nPlease revise the plan to address these issues.`;
        }

        return await callAgentWithEscalation(
            this.orchestrator,
            this.options.escalationModel,
            prompt,
            PlanSchema,
            this.options.maxRetries,
            this.options.logger
        );
    }

    private async executePlan(plan: Plan): Promise<Record<string, unknown>> {
        const results: Record<string, unknown> = {};
        const completedTaskIds = new Set<string>();

        // Group tasks by dependency layers for simple topological execution
        // 1. Independent tasks
        // 2. Tasks dependent on finished tasks
        // For this MVP, we will use a simple multi-pass loop

        let pendingTasks = [...plan.tasks];
        let stuckCounter = 0;

        while (pendingTasks.length > 0) {
            const executableTasks = pendingTasks.filter(task => {
                if (!task.dependencies || task.dependencies.length === 0) return true;
                return task.dependencies.every(depId => completedTaskIds.has(depId));
            });

            if (executableTasks.length === 0) {
                stuckCounter++;
                if (stuckCounter > 3) {
                    console.warn("🎼 Symphony execution stuck on cyclic dependencies. Forcing execution of remaining tasks.");
                    // Break deadlocks by executing everything remaining
                    executableTasks.push(...pendingTasks);
                } else {
                    await new Promise(r => setTimeout(r, 100)); // Small yield
                    continue;
                }
            }

            this.log(`🎼 Symphony: Executing batch of ${executableTasks.length} tasks...`, 'info');

            await Promise.all(executableTasks.map(async (task) => {
                const agentKey = task.agentType as AgentRole;
                const worker = this.workers[agentKey] || this.workers['generic'];

                if (!worker) {
                    results[task.id] = { error: `No registered worker for agent type: ${task.agentType}` };
                    completedTaskIds.add(task.id);
                    return;
                }

                // Inject context from dependencies
                let dependencyContext = "";
                if (task.dependencies) {
                    dependencyContext = "\nCONTEXT FROM PREVIOUS STEPS:\n" +
                        task.dependencies.map(depId => `[Task ${depId} Output]: ${JSON.stringify(results[depId])}`).join("\n");
                }

                this.log(`🎼 Symphony: Delegating task "${task.description}" to ${worker.name}...`, 'info');

                let basePrompt = WORKER_AGENT_PROMPT;
                if (task.agentType === 'researcher') basePrompt = RESEARCHER_PROMPT;
                if (task.agentType === 'developer') basePrompt = DEVELOPER_PROMPT;
                if (task.agentType === 'critic' || task.agentType === 'qa') basePrompt = REVIEWER_PROMPT;

                const workerPrompt = `
${basePrompt}
${memory.getContext()}

═══════════════════════════════════════════════════════════════════
ASSIGNED TASK
═══════════════════════════════════════════════════════════════════
ROLE: Specialized ${task.agentType} agent
TASK: ${task.description}
PRIORITY: ${task.priority}
${dependencyContext}

OUTPUT REQUIREMENTS:
1. First, explain your approach inside <thinking> tags.
2. Then provide the content using clear markdown formatting.
3. For code, use proper code blocks with language identifiers.
4. Include file paths for any code snippets.
5. If editing files, show +/- line change indicators.
                `.trim();

                try {
                    let currentPrompt = workerPrompt;
                    let output = '';
                    let iterations = 0;

                    // Execution Loop (Allows agent to run commands)
                    while (iterations < 5) {
                        output = await worker.complete(currentPrompt);

                        const execMatch = output.match(/<execute>([\s\S]*?)<\/execute>/);
                        if (execMatch) {
                            let cmd = execMatch[1].trim();
                            // Sanitize: start/end backticks or code blocks
                            cmd = cmd.replace(/^```\w*\s*/, '').replace(/```$/, '').replace(/^`/, '').replace(/`$/, '').trim();

                            this.log(`[${worker.name}] Executing: ${cmd}`, 'info');
                            try {
                                const { stdout, stderr } = await execAsync(cmd);
                                const result = (stdout + stderr).trim() || "(No output)";
                                this.log(`[${worker.name}] Result: ${result.substring(0, 100)}...`, 'info');
                                await memory.recordCommandResult(cmd, true);

                                currentPrompt += `\n\n[SYSTEM] COMMAND EXECUTION RESULT:\n${result}\n\nContinue with your task.`;
                                iterations++;
                            } catch (e: any) {
                                this.log(`[${worker.name}] Command Error: ${e.message}`, 'error');
                                await memory.recordCommandResult(cmd, false);
                                currentPrompt += `\n\n[SYSTEM] COMMAND FAILED:\n${e.message}\n\nTry a different command or proceed.`;
                                iterations++;
                            }
                        } else {
                            break; // Done
                        }
                    }

                    // Extract and log thinking from worker
                    const thinkingMatch = output.match(/<thinking>([\s\S]*?)<\/thinking>/);
                    if (thinkingMatch) {
                        this.log(`[${worker.name}] Thinking:\n${thinkingMatch[1].trim()}`, 'thinking');
                    }

                    results[task.id] = output;
                } catch (err) {
                    this.log(`🎼 Symphony: Task failed. Activating DEBUGGER for task "${task.id}"...`, 'error');

                    try {
                        // DEBUGGER INTERVENTION
                        const debuggerPrompt = `
                        You are an AI Debugger & Recovery Specialist.
                        The following task failed execution. Analyze the error and generate a corrected instruction.
                        
                        ORIGINAL TASK: ${task.description}
                        ERROR ERROR: ${String(err)}
                        
                        Provide a new, corrected prompt/instruction for the worker to succeed. 
                        If the error suggests a missing tool, specificy a workaround.
                        Return ONLY the corrected instruction text.
                        `.trim();

                        // We use the orchestrator model (higher intelligence) as the debugger
                        const correctedInstruction = await this.orchestrator.complete(debuggerPrompt);

                        this.log(`🎼 Symphony: Debugger provided fix. Retrying...`, 'info');
                        const retryOutput = await worker.complete(workerPrompt + "\n\nDEBUGGER CORRECTION/HINT: " + correctedInstruction);
                        results[task.id] = retryOutput;

                    } catch (retryErr) {
                        this.log(`🎼 Symphony: Debugger failed to recover task.`, 'error');
                        results[task.id] = { error: String(err), retryError: String(retryErr) };
                    }
                }

                completedTaskIds.add(task.id);
            }));

            // Remove executed tasks from pending
            pendingTasks = pendingTasks.filter(t => !completedTaskIds.has(t.id));
        }

        return results;
    }

    private async reviewResults(objective: string, results: Record<string, unknown>): Promise<ReviewResult> {
        const prompt = `
    You are the Compliance and Logic Reviewer.
    OBJECTIVE: ${objective}
    WORKER RESULTS: ${JSON.stringify(results, null, 2)}

    Review the results for accuracy, completeness, and alignment with the objective.
    If there are errors or missing information, fail the review and provide constructive feedback.
    
    CRITICAL OUTPUT REQUIREMENTS:
    1. First, think critically inside <thinking> tags to explain your analysis.
    2. Then, output the JSON review OBJECT inside \`\`\`json code blocks.
    3. The JSON must strictly follow the schema: { status: "PASS" | "FAIL", feedback: string, errorCategory: string }
    Do not add any text outside the JSON block and Thinking block.
        `.trim();

        return await callAgentWithEscalation(
            this.critic,
            this.options.escalationModel,
            prompt,
            ReviewSchema,
            this.options.maxRetries,
            this.options.logger
        );
    }

    private async synthesizeFinal(objective: string, results: Record<string, unknown>): Promise<string> {
        const prompt = `
You are the Lead Orchestrator.
OBJECTIVE: ${objective}
RESULTS: ${JSON.stringify(results)}

Synthesize these findings into a concise, high-quality final report for the user.
The report must be well-detailed for stakeholders, using paragraphs and bullet points where needed.
Include a clear summary of what was done.
Wrap your thought process in <thinking> tags before the final report.
        `.trim();

        return await this.orchestrator.complete(prompt);
    }
}
