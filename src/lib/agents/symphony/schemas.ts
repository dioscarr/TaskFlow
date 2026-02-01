
import { z } from "zod";

// The Orchestrator's plan must be an array of specific tasks
export const PlanSchema = z.object({
    tasks: z.array(z.object({
        id: z.string(),
        agentType: z.enum(["researcher", "analyst", "writer", "critic", "orchestrator", "developer", "qa", "generic"]),
        description: z.string(),
        priority: z.number().min(1).max(5),
        dependencies: z.array(z.string()).optional() // Added dependencies for sequential execution
    })),
    reasoning: z.string()
});

export type Plan = z.infer<typeof PlanSchema>;

// The Worker's output schema (Flexible but structured)
export const WorkerOutputSchema = z.object({
    data: z.any(),
    meta: z.object({
        source: z.string().optional(),
        confidence: z.number().optional()
    }).optional()
});

export type WorkerOutput = z.infer<typeof WorkerOutputSchema>;

// The Critic's evaluation schema
export const ReviewSchema = z.object({
    status: z.enum(["PASS", "FAIL"]),
    feedback: z.string().optional(),
    errorCategory: z.enum(["logic", "formatting", "accuracy", "none", "inconsistency", "completeness", "safety", "deviation"]),
    nextAction: z.enum(["continue", "revision", "human_review"]).optional()
});

export type ReviewResult = z.infer<typeof ReviewSchema>;
