
'use server';

import { readdir, stat, unlink, rm } from 'fs/promises';
import { join, resolve } from 'path';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createServer } from 'net';

import prisma from '@/lib/prisma';
import { revalidatePath as nextRevalidatePath } from 'next/cache';
import { memory } from '@/lib/agents/memory';
import { ensureAgentWorkerAvailable } from '@/lib/agentWorkerBootstrap';
import { getAvailablePort, isPortAvailable, checkDockerAvailability, isDockerProcess, getDemoUser as getCoreDemoUser } from '@/lib/processActionsCore';
import { manageAppLifecycle } from '@/app/processActions';
import type { TruncationReport, TruncationResult } from '@/lib/contextBudget';

/**
 * Safe wrapper for revalidatePath that doesn't crash in background/CLI contexts
 */
function safeRevalidatePath(path: string, type?: 'layout' | 'page') {
    try {
        nextRevalidatePath(path, type);
    } catch (e) {
        // Ignore "Invariant: static generation store missing" in background scripts
    }
}
import { writeFile, readFile as readFileFS, rename, copyFile, mkdir } from 'fs/promises';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getToolSchemas } from '@/lib/toolLibrary';
import { getToolRisk } from '@/lib/toolLibrary';
import { DEFAULT_SKILLS, SKILLS_LIBRARY } from '@/lib/skillsLibrary';
import { getSkillSchemas } from '@/lib/skillsLibrary';
import { executeSkill } from '@/lib/skillsExecution';
import { DEFAULT_INTENT_RULES, DEFAULT_WORKFLOWS, WorkflowStep } from '@/lib/intentLibrary';
import { parseMarkdownWorkflow } from '@/lib/workflowParser';
import { TOOL_LIBRARY } from '@/lib/toolLibrary';
import { addChatMessage } from '@/app/chatActions';
import { SOFTWARE_ARCHITECT_PROMPT, AGENT_ROLES, ORCHESTRATOR_AGENT_PROMPT, WORKER_AGENT_PROMPT } from '@/lib/agents/prompts';
import { GeminiAgentAdapter } from '@/lib/agents/adapters';
import AI_CONFIG, { getProviderDefaultModel } from '@/lib/aiConfig';
import { resolveModelId } from '@/lib/modelCatalog';
import { serializeValue, deepSerialize } from '@/lib/serialization';
import { generateTraceId, logWithTrace, TraceContext } from '@/lib/tracing';
import { createConfiguredModel } from '@/lib/llm/factory';
import { normalizeFunctionDeclarations } from '@/lib/llm/tool-schema-mapper';
import { sendCopilotMessage } from '@/lib/llm/providers/copilot';
import { generateAIText, generateAIContent, SchemaType } from '@/lib/aiModelFactory';

// import { CognitiveAgent } from '@/lib/agents/CognitiveAgent';
// import { DesignAgent } from '@/lib/agents/DesignAgent';
const MAX_ATTACHMENT_CONTEXT_IDS = 50;

const resolveAttachmentFileIds = async (userId: string, inputIds: string[] = []) => {
    if (!inputIds.length) return [] as string[];

    const resolvedIds = new Set<string>();
    const visited = new Set<string>();
    const queue = Array.from(new Set(inputIds));

    while (queue.length && resolvedIds.size < MAX_ATTACHMENT_CONTEXT_IDS) {
        const batch = queue.splice(0, 50);
        batch.forEach(id => visited.add(id));

        const files = await prisma.workspaceFile.findMany({
            where: { userId, id: { in: batch } },
            select: { id: true, type: true }
        });

        const folderIds = files.filter(f => f.type === 'folder').map(f => f.id);
        files.filter(f => f.type !== 'folder').forEach(f => resolvedIds.add(f.id));

        if (folderIds.length && resolvedIds.size < MAX_ATTACHMENT_CONTEXT_IDS) {
            const children = await prisma.workspaceFile.findMany({
                where: { userId, parentId: { in: folderIds } },
                select: { id: true, type: true }
            });

            for (const child of children) {
                if (!visited.has(child.id)) {
                    queue.push(child.id);
                }
            }
        }
    }

    return Array.from(resolvedIds).slice(0, MAX_ATTACHMENT_CONTEXT_IDS);
};

const getWorkspaceFilePath = (file: { storagePath?: string | null; name: string }) => {
    return join(process.cwd(), 'public', 'uploads', file.storagePath || file.name);
};

const getWorkspaceFolderPath = (folderId: string) => {
    return join(process.cwd(), 'public', 'uploads', folderId);
};

const execAsync = promisify(exec);

const writeProxyConfig = async (internalDomain: string, port: number) => {
    const proxyDir = join(process.cwd(), 'proxy-config', 'nginx');
    await mkdir(proxyDir, { recursive: true });
    const configPath = join(proxyDir, `${internalDomain}.conf`);
    const config = `server {\n    listen 80;\n    server_name ${internalDomain};\n\n    location / {\n        proxy_pass http://127.0.0.1:${port};\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n    }\n}\n`;
    await writeFile(configPath, config);
    return configPath;
};

async function executeAction(actionId: string, args: any): Promise<{ success: boolean, message?: string, [key: string]: any }> {
    console.log(`🚀 Executing Action: ${actionId}`, args);
    if (Array.isArray(args?.fileIds) && args.fileIds.length > 0) {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (user) {
            args.fileIds = await resolveAttachmentFileIds(user.id, args.fileIds);
        }
    }

    if (SKILLS_LIBRARY[actionId]) {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        const userId = user?.id || 'demo';
        // Hydrate workspace files so skills have access to the user's file context
        let workspaceFiles: Array<{ id: string; name: string; type: string; storagePath?: string }> = [];
        try {
            const files = await prisma.file.findMany({
                where: { userId },
                select: { id: true, name: true, type: true, storagePath: true },
                take: 100,
                orderBy: { updatedAt: 'desc' }
            });
            workspaceFiles = files.map(f => ({
                id: f.id,
                name: f.name,
                type: f.type,
                storagePath: f.storagePath ?? undefined
            }));
        } catch { /* DB unavailable — proceed with empty */ }
        return await executeSkill(actionId, args, {
            userId,
            fileIds: Array.isArray(args?.fileIds) ? args.fileIds : [],
            query: typeof args?.query === 'string' ? args.query : '',
            workspaceFiles
        });
    }

    // Temporary bypass: skip Alegra export until pipeline is ready
    if (actionId === 'extract_alegra_bill') {
        return { success: true, skipped: true, silent: true, message: 'Alegra export temporarily disabled' };
    }

    // Internal Intents
    if (actionId === 'create_file') return await createMarkdownFile(args);
    if (actionId === 'create_markdown_file') return await createMarkdownFile(args);
    if (actionId === 'edit_file') return await editFile(args);
    if (actionId === 'create_task') return await createTask(args);
    if (actionId === 'create_folder') return await createFolder(args);
    if (actionId === 'create_html_file') return await createHtmlFile(args as any);
    if (actionId === 'repo_context_pack') return await getRepoContextPack(args || {});
    if (actionId === 'find_symbol_references') return await findSymbolReferences(args || {});
    if (actionId === 'delete_file') {
        if (!args?.confirm) return { success: false, message: 'Deletion requires confirm=true' };
        return await deleteWorkspaceItem(args.fileId || args.id, true);
    }
    if (actionId === 'rename_file') return await renameFile(args.fileId || args.id, args.name);

    if (actionId === 'extract_alegra_bill') return await createAlegraBill(args);
    if (actionId === 'record_alegra_payment') return await recordAlegraPayment(args);
    if (actionId === 'verify_dgii_rnc') return await verifyRNC(args.rnc);
    if (actionId === 'restart_process') {
        const { restartProcess } = await import('./processActions');
        return await restartProcess(args.id);
    }
    if (actionId === 'rebuild_process') {
        const { rebuildProcess } = await import('./processActions');
        return await rebuildProcess(args.id);
    }
    if (actionId === 'get_docker_logs') {
        const { getDockerLogs } = await import('./processActions');
        return await getDockerLogs(args.id);
    }
    if (actionId === 'stop_process') {
        const { stopProcess } = await import('./processActions');
        return await stopProcess(args.id);
    }
    if (actionId === 'start_process') {
        const { startProcess } = await import('./processActions');
        return await startProcess(args.id);
    }
    if (actionId === 'delete_process') {
        const { deleteProcess } = await import('./processActions');
        return await deleteProcess(args.id);
    }
    if (actionId === 'cancel_all_jobs') return await cancelAllAgentJobs();
    if (actionId === 'stop_all_agents') return await cancelAllAgentJobs();
    if (actionId === 'execute_command_in_app') return await executeCommandInApp(args);
    if (actionId === 'get_app_logs') return await getAppLogs(args);
    if (actionId === 'wait') return await wait(args as any);
    if (actionId === 'observe_status') return await observeStatus(args as any);
    if (actionId === 'apply_batch') return await applyBatch(args);
    if (actionId === 'highlight_file') return await highlightWorkspaceFile(args);
    if (actionId === 'move_attachments_to_folder') return await moveFilesToFolder(args.fileIds || [], args.folderId, args.nameConflictStrategy);
    if (actionId === 'copy_attachments_to_folder') return await copyFilesToFolder(args.fileIds || [], args.folderId, args.nameConflictStrategy);
    if (actionId === 'remove_highlights') return await removeWorkspaceHighlights(args.fileIds || []);
    if (actionId === 'delete_root_markdown_files') return await deleteRootMarkdownFiles(args);
    if (actionId === 'sync_workspace_files') return await syncWorkspaceFiles();
    if (actionId === 'suggest_strategies') return await suggestStrategies(args);
    if (actionId === 'agent_delegate') return await agentDelegate({ ...args, sessionId: args.sessionId });
    if (actionId === 'configure_magic_folder') return await configureMagicFolder({ ...args, sessionId: args.sessionId });
    if (actionId === 'synthesize_documents') return await synthesizeDocuments({ ...args, sessionId: args.sessionId });
    if (actionId === 'run_agent_orchestration' || actionId === 'run_agent_symphony') {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });

        // prepare tools
        const toolSchemas = Object.values(TOOL_LIBRARY).map(t => t.schema);
        const model = createConfiguredModel({
            purpose: 'smart',
            systemInstruction: SOFTWARE_ARCHITECT_PROMPT,
            tools: normalizeFunctionDeclarations(toolSchemas)
        });

        const logger = async (msg: string, type: 'info' | 'thinking' | 'error' = 'info') => {
            console.log(`[Agent] ${type}: ${msg}`);
            if (user) {
                try {
                    await logAgentActivity({
                        type: type === 'error' ? 'error' : (type === 'thinking' ? 'info' : 'success'),
                        title: type === 'thinking' ? '🧠 Agent Thought' : '⚡ Agent Action',
                        message: msg,
                        toolUsed: actionId,
                        userId: user.id,
                        sessionId: args.sessionId
                    });
                } catch (e) {
                    console.error('Failed to log agent activity', e);
                }
            }
        };

        const toolExecutor = async (name: string, args: any) => {
            try {
                return await executeAction(name, args);
            } catch (e: any) {
                return { success: false, error: e.message };
            }
        };

        const agent = new GeminiAgentAdapter(
            "Lead Architect",
            model,
            { userId: user?.id || 'demo', query: args.objective, fileIds: [] },
            toolExecutor,
            logger
        );

        try {
            console.log(`🧠 Starting Agent Orchestration for objective: ${args.objective}`);
            const finalOutput = await agent.complete(args.objective);

            return {
                success: true,
                message: finalOutput,
                agentOutput: finalOutput
            };
        } catch (err: any) {
            console.error("Agent Orchestration Error:", err);
            return { success: false, message: `Agent Error: ${err.message}` };
        }
    }
    if (actionId === 'batch_rename') return await batchRenameFiles(args);
    if (actionId === 'summarize_file') return await summarizeFile(args);
    if (actionId === 'extract_text_from_image') return await extractTextFromImage(args);
    if (actionId === 'find_duplicate_files') return await findDuplicateFiles(args);
    if (actionId === 'search_web') return await searchWeb(args);
    if (actionId === 'focus_workspace_item') return await focusWorkspaceItem(args.itemId);
    if (actionId === 'execute_scaffold_vite') return await executeScaffoldVite(args);

    // New High-Fidelity Tools
    if (actionId === 'view_file') return await viewFile(args);
    if (actionId === 'list_dir') return await listDir(args);
    if (actionId === 'apply_patch') return await applyPatch(args);
    if (actionId === 'replace_in_file') return await replaceInFile(args);
    if (actionId === 'search_codebase') return await searchCodebase(args);
    if (actionId === 'run_in_terminal') return await runTerminalCommand(args);
    if (actionId === 'manage_app_lifecycle') return await manageAppLifecycle(args);

    // Tools from library
    const tool = TOOL_LIBRARY[actionId];
    if (tool) {
        const schemaName = tool.schema.name;
        console.log(`🛠️ Tool Schema Match: ${schemaName}`);

        if (schemaName === 'verify_dgii_rnc') return await verifyRNC(args.rnc);
        if (schemaName === 'search_web') return await searchWeb(args);
        if (schemaName === 'extract_alegra_bill') return await createAlegraBill(args);
        if (schemaName === 'create_file') return await createMarkdownFile(args);
        if (schemaName === 'create_markdown_file') return await createMarkdownFile(args);
        if (schemaName === 'edit_file') return await editFile(args);
        if (schemaName === 'repo_context_pack') return await getRepoContextPack(args || {});
        if (schemaName === 'find_symbol_references') return await findSymbolReferences(args || {});
        if (schemaName === 'delete_file') {
            if (!args?.confirm) return { success: false, message: 'Deletion requires confirm=true' };
            return await deleteWorkspaceItem(args.fileId || args.id, true);
        }
        if (schemaName === 'rename_file') return await renameFile(args.fileId || args.id, args.name);
        if (schemaName === 'read_file') return await readFile(args);
        if (schemaName === 'search_files') return await searchFiles(args);
        if (schemaName === 'ask_questions') return await askQuestions(args);
        if (schemaName === 'agent_delegate') return await agentDelegate(args);
        if (schemaName === 'execute_command') return await runTerminalCommand(args);
        if (schemaName === 'run_in_terminal') return await runTerminalCommand(args);
        if (schemaName === 'extract_receipt_info') return await extractReceiptInfo(args);
        if (schemaName === 'generate_markdown_report') return await generateMarkdownReport(args);
        if (schemaName === 'organize_files') return await organizeFiles(args);
        if (schemaName === 'move_attachments_to_folder') return await moveFilesToFolder(args.fileIds || [], args.folderId, args.nameConflictStrategy);
        if (schemaName === 'copy_attachments_to_folder') return await copyFilesToFolder(args.fileIds || [], args.folderId, args.nameConflictStrategy);
        if (schemaName === 'remove_highlights') return await removeWorkspaceHighlights(args.fileIds || []);
        if (schemaName === 'delete_root_markdown_files') return await deleteRootMarkdownFiles(args);
        if (schemaName === 'batch_rename') return await batchRenameFiles(args);
        if (schemaName === 'summarize_file') return await summarizeFile(args);
        if (schemaName === 'extract_text_from_image') return await extractTextFromImage(args);
        if (schemaName === 'find_duplicate_files') return await findDuplicateFiles(args);
        if (schemaName === 'focus_workspace_item') return await focusWorkspaceItem(args.itemId);
        if (schemaName === 'create_workflow') return await createWorkflow(args);
        if (schemaName === 'create_agent') return await createAgent(args);
        if (schemaName === 'configure_agent') return await updateAgent(args);
        if (schemaName === 'manage_data_table') return await manageDataTable(args);
        if (schemaName === 'configure_magic_folder') return await configureMagicFolder(args);
        if (schemaName === 'set_file_tags') return await setFileTags(args);
        if (schemaName === 'synthesize_documents') return await synthesizeDocuments(args);
        if (schemaName === 'get_agent_activity') return await getAgentActivity(args);
        if (schemaName === 'create_html_file') return await createHtmlFile(args);

        // New Schema Mappings
        if (schemaName === 'view_file') return await viewFile(args);
        if (schemaName === 'list_dir') return await listDir(args);
        if (schemaName === 'apply_patch') return await applyPatch(args);
        if (schemaName === 'replace_in_file') return await replaceInFile(args);
        if (schemaName === 'search_codebase') return await searchCodebase(args);
        if (schemaName === 'run_in_terminal') return await runTerminalCommand(args);
        if (schemaName === 'execute_command_in_app') return await executeCommandInApp(args);
        if (schemaName === 'get_app_logs') return await getAppLogs(args);
        if (schemaName === 'apply_batch') return await applyBatch(args);
    }

    // Manual catch-all and fallbacks
    if (actionId === 'verify_dgii_rnc') return await verifyRNC(args.rnc);
    if (actionId === 'create_workflow') return await createWorkflow(args);

    return { success: false, message: `Action ${actionId} not found` };
}

/**
 * Executes an action with a small automatic retry policy and structured logging.
 * Uses AI_CONFIG.toolAutoRetry for retry attempts.
 */
export async function executeWithRetry(actionId: string, args: any, context?: TraceContext) {
    const maxRetries = Number(AI_CONFIG.toolAutoRetry ?? 1);
    let attempt = 0;
    let lastResult: any = null;

    while (attempt <= maxRetries) {
        attempt++;
        if (context) {
            const traceId = typeof context === 'string' ? context : context.traceId;
            console.log(`🧩 Executing tool (${actionId}) attempt ${attempt}/${maxRetries + 1} [Trace: ${traceId}]`);
        } else {
            console.log(`🧩 Executing tool (${actionId}) attempt ${attempt}/${maxRetries + 1}`);
        }
        try {
            const res = await executeAction(actionId, args);
            if (res && res.success) {
                if (attempt > 1) console.log(`✅ Tool ${actionId} succeeded after ${attempt} attempts`);
                return res;
            }
            lastResult = res;
            const msg = (res && res.message) ? String(res.message).toLowerCase() : '';
            if (msg.includes('missing api key') || msg.includes('api key missing')) {
                console.warn(`⚠️ Fatal tool failure for ${actionId}: ${res.message}`);
                return res;
            }
            if (attempt <= maxRetries) {
                console.log(`🔁 Retrying tool ${actionId} due to failure: ${res.message || 'unknown'}`);
                continue;
            } else {
                return res;
            }
        } catch (err) {
            lastResult = { success: false, message: (err as any)?.message || String(err) };
            if (attempt <= maxRetries) {
                console.log(`🔁 Retrying tool ${actionId} after exception: ${err}`);
                continue;
            }
            return lastResult;
        }
    }

    return lastResult || { success: false, message: 'Unknown failure' };
}

/**
 * Auto-initialize core workflows
 */

/**
 * Load workflows defined as markdown files in .agent/workflows
 */
async function loadFileSystemWorkflows() {
    const workflowsDir = join(process.cwd(), '.agent', 'workflows');
    try {
        const files = await readdir(workflowsDir);
        const mdFiles = files.filter(f => f.endsWith('.md'));

        const workflows = [];

        for (const file of mdFiles) {
            const filePath = join(workflowsDir, file);
            const content = await readFileFS(filePath, 'utf-8');

            // Basic Frontmatter parsing
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
            let description = '';

            if (frontmatterMatch) {
                const frontmatter = frontmatterMatch[1];
                const descMatch = frontmatter.match(/description:\s*(.*)/);
                if (descMatch) description = descMatch[1].trim();
            }

            const name = file.replace('.md', '');
            const command = `/${name}`;

            workflows.push({
                id: `file-${name}`,
                name: command, // Use slash command as name for matching
                description,
                triggerKeywords: [command, name.replace(/-/g, ' ')],
                steps: parseMarkdownWorkflow(content),
                content: content
            });
        }

        return workflows;

    } catch (error) {
        // Silently skip if directory doesn't exist
        return [];
    }
}

export async function executeWorkflow(steps: WorkflowStep[], initialContext: any = {}) {
    console.log('🔄 executeWorkflow START', { stepsCount: steps.length, hasFileIds: !!initialContext.fileIds, fileIdsCount: initialContext.fileIds?.length });
    let context = { ...initialContext };
    const results = [];
    let lastMarkdownFolderId: string | undefined;
    let lastMarkdownParams: Record<string, any> | undefined;
    let movementAttempted = false;

    const resolveAttachmentIds = async (sourceContext: any, allowRecovery: boolean) => {
        let fileIds = sourceContext?.fileIds || initialContext.fileIds || [];

        if (!fileIds.length && allowRecovery) {
            console.log('⚠️ No fileIds provided. Attempting to find recent orphaned files...');
            try {
                const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
                if (user) {
                    const recentFiles = await prisma.workspaceFile.findMany({
                        where: {
                            userId: user.id,
                            parentId: null,
                            type: { in: ['jpg', 'jpeg', 'png', 'pdf', 'image'] },
                            createdAt: { gt: new Date(Date.now() - 1000 * 60 * 60) }
                        },
                        select: { id: true, name: true }
                    });

                    if (recentFiles.length > 0) {
                        console.log(`🔎 Found ${recentFiles.length} recent orphaned files to move:`, recentFiles.map(f => f.name));
                        fileIds = recentFiles.map(f => f.id);
                        context.fileIds = fileIds;
                    }
                }
            } catch (err) {
                console.error('Failed search for orphaned files:', err);
            }
        }

        return fileIds;
    };

    const transferAttachments = async (
        mode: 'move' | 'copy',
        folderId: string,
        sourceContext: any,
        allowRecovery: boolean
    ) => {
        const fileIds = await resolveAttachmentIds(sourceContext, allowRecovery);

        console.log('📂 transferAttachments called', { mode, folderId, fileIdsCount: fileIds.length, fileIds });

        if (!fileIds.length) {
            console.log('⚠️ No fileIds to move/copy');
            return null;
        }

        const nameConflictStrategy = sourceContext?.nameConflictStrategy || context.nameConflictStrategy;

        if (mode === 'move') {
            console.log('🚚 Moving files...');
            const moveResult = await moveFilesToFolder(fileIds, folderId, nameConflictStrategy);
            console.log('🚚 Move result:', moveResult);
            context.filesMoved = moveResult;
            // Update context with moved file IDs for subsequent steps
            if (moveResult.movedFileIds && moveResult.movedFileIds.length > 0) {
                context.lastProcessedFileIds = moveResult.movedFileIds;
            }
            return moveResult;
        }

        console.log('📎 Copying files...');
        const copyResult = await copyFilesToFolder(fileIds, folderId, nameConflictStrategy);
        context.filesCopied = copyResult;
        // Update context with copied file IDs for subsequent steps
        if (copyResult.copiedFileIds && copyResult.copiedFileIds.length > 0) {
            context.lastProcessedFileIds = copyResult.copiedFileIds;
        }
        return copyResult;
    };

    for (const step of steps) {
        console.log(`👣 Step: ${step.action}`);
        // Merge step params with context (allowing basic path resolution if needed)
        const args = { ...step.params, ...context };

        if (step.action === 'extract_alegra_bill') {
            console.log('⏸️ Skipping Alegra export (disabled)');
            context.lastSkippedAction = 'extract_alegra_bill';
            results.push({ step: step.action, success: true, result: { success: true, skipped: true, silent: true } });
            continue;
        }

        if (step.action === 'move_attachments_to_folder' || step.action === 'copy_attachments_to_folder') {
            const useLast = (step.params as any)?.useLastMarkdownFolder ?? true;
            if (useLast && lastMarkdownFolderId && !args.folderId) {
                args.folderId = lastMarkdownFolderId;
            }
            // Fallback to context.folderId if no folderId specified (e.g., from create_folder step)
            if (!args.folderId && context.folderId) {
                args.folderId = context.folderId;
            }

            if (!args.nameConflictStrategy && context.nameConflictStrategy) {
                args.nameConflictStrategy = context.nameConflictStrategy;
            }

            if (!args.fileIds || !Array.isArray(args.fileIds) || args.fileIds.length === 0) {
                args.fileIds = await resolveAttachmentIds(context, true);
            }
        }

        if (step.action === 'highlight_file') {
            if (!args.fileId) {
                // Priority 1: Use the file created in the previous step (e.g. Markdown report)
                if (context.file?.id) {
                    console.log('🎨 Highlighting newly created file:', context.file.name);
                    args.fileId = context.file.id;
                }
                // Priority 2: Use the files that were just moved/copied (e.g. attachments)
                else if (context.lastProcessedFileIds && context.lastProcessedFileIds.length > 0) {
                    console.log('🎨 Highlighting last processed file:', context.lastProcessedFileIds[0]);
                    args.fileId = context.lastProcessedFileIds[0];
                } else {
                    // Fallback to resolving from initial context
                    const resolved = await resolveAttachmentIds(context, true);
                    args.fileId = resolved[0];
                    console.log('🎨 Highlighting resolved attachment:', args.fileId);
                }
            }
        }

        if (step.action === 'create_folder') {
            if (!args.name && !args.autoName) {
                if (context.folderName) {
                    args.name = context.folderName;
                } else {
                    args.autoName = true;
                    args.prefix = args.prefix || 'Receipts';
                }
            }
        }

        if (step.action === 'create_markdown_file') {
            // If a folder was already created in this workflow, reuse it instead of creating a duplicate
            if (context.folderId) {
                args.parentId = context.folderId;
                delete args.folderName;
            }
            lastMarkdownParams = step.params || {};
        }

        // Handle HTML file creation with folder context
        if (step.action === 'create_html_file') {
            // If useLastFolder is true and we have a folder from a previous step, use it
            if ((step.params as any)?.useLastFolder && context.folderId) {
                args.folderId = context.folderId;
                console.log('📂 Using last created folder for HTML file:', context.folderId);
            }
            // Ensure filename from workflow params is used
            if ((step.params as any)?.filename && !args.filename) {
                args.filename = (step.params as any).filename;
                console.log('📝 Using workflow filename:', args.filename);
            }
            // Merge content from context if available, or use default HTML template
            if (!args.content) {
                if (context.content) {
                    args.content = context.content;
                } else {
                    // Default HTML template for web apps
                    args.content = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
        }
        .container {
            text-align: center;
            padding: 2rem;
        }
        h1 {
            font-size: 3rem;
            margin-bottom: 1rem;
            font-weight: 800;
        }
        p {
            font-size: 1.25rem;
            opacity: 0.9;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Welcome to Your Web App</h1>
        <p>Start building something amazing!</p>
    </div>
</body>
</html>`;
                }
            }
        }

        if (step.action === 'execute_command' && typeof args.command === 'string' && args.command.includes('<project-name>')) {
            if (context.scaffoldViteAppName) {
                args.command = args.command.replace(/<project-name>/g, context.scaffoldViteAppName);
            } else {
                results.push({
                    step: step.action,
                    success: false,
                    result: {
                        success: false,
                        message: 'Missing project name for Vite scaffold command. Use "/vite <name>".'
                    }
                });
                break;
            }
        }
        const result = await executeWithRetry(step.action, args);

        results.push({ step: step.action, success: result.success, result });

        if (!result.success) {
            console.log(`❌ Step failed: ${step.action}`);
            if (!movementAttempted && lastMarkdownFolderId && lastMarkdownParams) {
                console.log('🚑 Attempting recovery transfer...');
                if (lastMarkdownParams.moveToFolder) {
                    const transfer = await transferAttachments('move', lastMarkdownFolderId, context, true);
                    if (transfer) movementAttempted = true;
                } else if (lastMarkdownParams.copyToFolder) {
                    const transfer = await transferAttachments('copy', lastMarkdownFolderId, context, true);
                    if (transfer) movementAttempted = true;
                }
            }
            break; // Stop on failure for now
        }

        // Accumulate context from result
        context = { ...context, ...result };

        if (step.action === 'move_attachments_to_folder') {
            movementAttempted = true;
            context.filesMoved = result;
            if (result?.movedFileIds && result.movedFileIds.length > 0) {
                context.lastProcessedFileIds = result.movedFileIds;
            }
        }

        if (step.action === 'copy_attachments_to_folder') {
            movementAttempted = true;
            context.filesCopied = result;
            if (result?.copiedFileIds && result.copiedFileIds.length > 0) {
                context.lastProcessedFileIds = result.copiedFileIds;
            }
        }

        // If an action was skipped silently (e.g., Alegra export), avoid treating it as a user-facing tool use
        if (result.silent) {
            context.lastSkippedAction = step.action;
        }

        // Handle folder creation for subsequent steps
        if (step.action === 'create_folder' && result.success && result.folder) {
            if (result.needsConfirmation) {
                context.workflowPaused = true;
                context.workflowPausedMessage = result.message || 'Folder already exists. User confirmation required.';
                context.pendingFolderId = result.folder.id;
                context.pendingFolderName = result.folder.name;
                break;
            }

            console.log('✅ Folder created:', result.folder.name);
            // Set context.folderId for use in later steps like move_attachments_to_folder
            context.folderId = result.folder.id;
            // Use this folder for markdown placement and attachment transfers
            lastMarkdownFolderId = result.folder.id;

            if ((step.params as any)?.nameConflictStrategy) {
                context.nameConflictStrategy = (step.params as any).nameConflictStrategy;
            }
        }

        if (step.action === 'create_markdown_file' && result.success) {
            if (result.folderId) {
                lastMarkdownFolderId = result.folderId;
            } else if (context.folderId) {
                lastMarkdownFolderId = context.folderId;
            }
        }

        // Handle HTML file creation with folder context
        if (step.action === 'create_html_file' && result.success) {
            console.log('✅ HTML file created:', result.file?.name);
            // Track the folder for potential additional files
            if (result.file?.parentId) {
                lastMarkdownFolderId = result.file.parentId;
            } else if (context.folderId) {
                lastMarkdownFolderId = context.folderId;
            }
        }
    }

    if (!movementAttempted && lastMarkdownFolderId) {
        console.log('🏁 Workflow end, ensuring transfer...');
        if (lastMarkdownParams?.moveToFolder) {
            const transfer = await transferAttachments('move', lastMarkdownFolderId, context, true);
            if (transfer) movementAttempted = true;
        } else if (lastMarkdownParams?.copyToFolder) {
            const transfer = await transferAttachments('copy', lastMarkdownFolderId, context, true);
            if (transfer) movementAttempted = true;
        } else if (context.fileIds && context.fileIds.length > 0) {
            // Fallback: auto-move any provided chat attachments into the markdown folder
            const transfer = await transferAttachments('move', lastMarkdownFolderId, context, true);
            if (transfer) movementAttempted = true;
        }
    }

    return { success: results.every(r => r.success), results, context };
}

export async function updateTaskStatus(id: string, status: string) {
    try {
        await prisma.task.update({
            where: { id },
            data: { status },
        });
        safeRevalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Failed to update task status:', error);
        return { success: false, error: 'Failed to update task status' };
    }
}

export async function deleteTask(id: string) {
    try {
        await prisma.task.delete({
            where: { id },
        });
        safeRevalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Failed to delete task:', error);
        return { success: false, error: 'Failed to delete task' };
    }
}

export async function createTask(data: { title: string; description?: string }) {
    try {
        const user = await prisma.user.findUnique({
            where: { email: 'demo@example.com' }
        });

        if (!user) throw new Error('User not found');

        await prisma.task.create({
            data: {
                title: data.title,
                description: data.description,
                status: 'pending',
                userId: user.id,
                emailSource: JSON.stringify({
                    sender: { name: 'Manual Task', email: '' },
                    preview: data.description || 'No description',
                    tags: ['Manual']
                })
            },
        });
        safeRevalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Failed to create task:', error);
        return { success: false, error: 'Failed to create task' };
    }
}

export async function simulateIncomingEmail(data: { from: string, subject: string, body: string }) {
    try {
        const user = await prisma.user.findUnique({
            where: { email: 'demo@example.com' }
        });

        if (!user) throw new Error('User not found');

        await prisma.task.create({
            data: {
                title: data.subject,
                description: data.body,
                status: 'unread',
                userId: user.id,
                emailSource: JSON.stringify({
                    sender: { name: data.from.split('@')[0], email: data.from },
                    preview: data.body.substring(0, 150),
                    tags: ['Inbound', 'Urgent']
                })
            },
        });
        safeRevalidatePath('/');
        return { success: true };
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to simulate email:', msg);
        return { success: false, message: msg };
    }
}

export async function createFile(data: { name: string, type: string, size?: string, items?: string, parentId?: string }) {
    try {
        const user = await prisma.user.findUnique({
            where: { email: 'demo@example.com' }
        });
        if (!user) throw new Error('User not found');

        const newFile = await prisma.workspaceFile.create({
            data: {
                name: data.name,
                type: data.type,
                size: data.size,
                items: data.items,
                parentId: data.parentId,
                userId: user.id,
            }
        });

        safeRevalidatePath('/');
        return { success: true, file: newFile };
    } catch (error) {
        console.error('Failed to create file:', error);
        return { success: false, error: 'Failed to create file' };
    }
}

export async function deleteFile(id: string) {
    return await deleteWorkspaceItem(id, true);
}

async function deleteWorkspaceItem(id: string, recursive: boolean = true) {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        const item = await prisma.workspaceFile.findFirst({ where: { id, userId: user.id } });
        if (!item) {
            return { success: false, message: `File or folder not found: ${id}` };
        }

        // If folder and recursive, delete children first
        if (item.type === 'folder' && recursive) {
            const children = await prisma.workspaceFile.findMany({ where: { parentId: id, userId: user.id } });
            for (const child of children) {
                await deleteWorkspaceItem(child.id, true);
            }

            // Remove folder directory if it exists on disk
            const folderPath = getWorkspaceFolderPath(id);
            try {
                await rm(folderPath, { recursive: true, force: true });
            } catch (e) {
                // ignore if folder does not exist
            }
        }

        // Delete physical file if stored
        if (item.storagePath) {
            const filePath = getWorkspaceFilePath(item);
            try {
                await unlink(filePath);
            } catch (e) {
                // ignore missing file on disk
            }
        }

        await prisma.workspaceFile.delete({ where: { id } });
        safeRevalidatePath('/');
        return { success: true, message: `${item.type === 'folder' ? 'Folder' : 'File'} deleted`, deletedId: id };
    } catch (error) {
        console.error('Failed to delete file:', error);
        return { success: false, error: 'Failed to delete file' };
    }
}

export async function renameFile(id: string, name: string) {
    try {
        await prisma.workspaceFile.update({
            where: { id },
            data: { name }
        });
        safeRevalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Failed to rename file:', error);
        return { success: false, error: 'Failed to rename file' };
    }
}

const REPO_IGNORE_DIRS = new Set([
    'node_modules', '.next', '.git', '.turbo', '.cache', '.vercel', 'dist', 'build', 'out', '.idea', '.vscode', 'coverage', 'public/uploads'
]);

async function getRepoContextPack(opts: { depth?: number; maxEntries?: number; root?: string; appName?: string }) {
    const depth = Number.isFinite(opts.depth) ? Math.max(1, Math.floor(opts.depth as number)) : 3;
    const maxEntries = Number.isFinite(opts.maxEntries) ? Math.max(20, Math.floor(opts.maxEntries as number)) : 200;

    // Determine root: explicit root > appName under apps/ > apps/ if exists > project root
    const appsRoot = join(process.cwd(), 'apps');
    const hasApps = fs.existsSync(appsRoot);
    let rootDir = opts.root ? resolve(process.cwd(), opts.root) : null;

    if (!rootDir && opts.appName) {
        const candidate = join(appsRoot, opts.appName);
        if (hasApps && fs.existsSync(candidate)) {
            rootDir = candidate;
        }
    }

    if (!rootDir && hasApps) {
        rootDir = appsRoot;
    }

    if (!rootDir) {
        rootDir = resolve(process.cwd(), '.');
    }

    const treeLines: string[] = [];
    let count = 0;

    const walk = async (dir: string, currentDepth: number, prefix: string) => {
        if (currentDepth < 0 || count >= maxEntries) return;
        let entries: fs.Dirent[] = [];
        try {
            entries = await readdir(dir, { withFileTypes: true });
        } catch (e) {
            return;
        }

        entries = entries
            .filter(e => !REPO_IGNORE_DIRS.has(e.name))
            .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));

        for (let i = 0; i < entries.length && count < maxEntries; i++) {
            const entry = entries[i];
            const isLast = i === entries.length - 1;
            const connector = isLast ? '└─ ' : '├─ ';
            const nextPrefix = prefix + (isLast ? '   ' : '│  ');
            treeLines.push(`${prefix}${connector}${entry.name}${entry.isDirectory() ? '/' : ''}`);
            count++;
            if (entry.isDirectory() && currentDepth > 0) {
                await walk(join(dir, entry.name), currentDepth - 1, nextPrefix);
            }
        }
    };

    await walk(rootDir, depth, '');

    let pkg: any = null;
    try {
        const pkgRaw = await readFileFS(join(process.cwd(), 'package.json'), 'utf-8');
        pkg = JSON.parse(pkgRaw);
    } catch {
        /* ignore */
    }

    const deps = pkg?.dependencies || {};
    const devDeps = pkg?.devDependencies || {};
    const scripts = pkg?.scripts || {};
    const frameworks: string[] = [];
    const depKeys = new Set<string>([...Object.keys(deps), ...Object.keys(devDeps)]);
    if (depKeys.has('next')) frameworks.push('next');
    if (depKeys.has('react')) frameworks.push('react');
    if (depKeys.has('vite')) frameworks.push('vite');
    if (depKeys.has('express')) frameworks.push('express');

    const keyPaths = ['src/app', 'src/pages', 'src/routes', 'src/components', 'src/lib', 'apps']
        .filter(p => fs.existsSync(join(process.cwd(), p)));

    return {
        success: true,
        tree: treeLines.join('\n'),
        entries: count,
        packageJson: pkg ? {
            name: pkg.name,
            scripts,
            dependencies: deps,
            devDependencies: devDeps
        } : null,
        frameworks,
        keyPaths,
        root: rootDir.replace(process.cwd() + path.sep, '')
    };
}

async function findSymbolReferences(opts: { symbols?: string[] | string; dir?: string; maxResults?: number }) {
    const symbols = Array.isArray(opts.symbols) ? opts.symbols.filter(Boolean) : (opts.symbols ? [opts.symbols] : []);
    if (!symbols.length) return { success: false, message: 'No symbols provided' };

    const baseDir = resolve(process.cwd(), opts.dir || 'src');
    const maxResults = Number.isFinite(opts.maxResults) ? Math.max(1, Math.floor(opts.maxResults as number)) : 80;
    const matches: { file: string; line: number; preview: string; symbol: string }[] = [];

    const walk = async (dir: string) => {
        if (matches.length >= maxResults) return;
        let entries: fs.Dirent[] = [];
        try {
            entries = await readdir(dir, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            if (REPO_IGNORE_DIRS.has(entry.name)) continue;
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
                await walk(fullPath);
                if (matches.length >= maxResults) return;
            } else {
                let stats;
                try { stats = await stat(fullPath); } catch { continue; }
                if (stats.size > 512 * 1024) continue; // skip large files
                let content: string;
                try { content = await readFileFS(fullPath, 'utf-8'); } catch { continue; }
                if (content.includes('\0')) continue; // likely binary
                const lines = content.split(/\r?\n/);
                symbols.forEach(sym => {
                    if (matches.length >= maxResults) return;
                    lines.forEach((line, idx) => {
                        if (matches.length >= maxResults) return;
                        if (line.includes(sym)) {
                            matches.push({
                                file: fullPath.replace(process.cwd() + path.sep, ''),
                                line: idx + 1,
                                preview: line.trim(),
                                symbol: sym
                            });
                        }
                    });
                });
            }
        }
    };

    await walk(baseDir);

    return {
        success: true,
        matches: matches.slice(0, maxResults),
        truncated: matches.length >= maxResults
    };
}

export async function uploadFile(formData: FormData) {
    try {
        const file = formData.get('file') as File;
        const parentId = formData.get('parentId') as string | null;
        if (!file) throw new Error('No file uploaded');

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const directoryName = parentId ? parentId : '_root_';
        const uploadsDir = join(process.cwd(), 'public', 'uploads', directoryName);
        await mkdir(uploadsDir, { recursive: true });

        const storagePath = `${directoryName}/${file.name}`;
        const path = join(uploadsDir, file.name);
        await writeFile(path, buffer);

        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        const newFile = await prisma.workspaceFile.create({
            data: {
                name: file.name,
                type: file.type.split('/')[1] || 'file',
                size: `${(file.size / 1024).toFixed(1)} KB`,
                parentId: parentId || null,
                userId: user.id,
                storagePath
            }
        });

        safeRevalidatePath('/');
        return { success: true, file: newFile };
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Upload failed';
        console.error('Failed to upload file:', msg);
        return { success: false, error: msg, message: msg };
    }
}

/**
 * Pause execution for a specified duration
 */
export async function wait(args: { ms: number }) {
    const duration = args.ms || 1000;
    console.log(`⏳ Waiting for ${duration}ms...`);
    await new Promise(resolve => setTimeout(resolve, duration));
    return { success: true, waitedMs: duration };
}

/**
 * Observe if a resource (port, file, URL) is available
 */
export async function observeStatus(args: { type: 'port' | 'file' | 'url' | 'process', target: string, timeout?: number }) {
    const type = args.type;
    const target = args.target;
    const timeout = args.timeout || 5000;
    const interval = 500;
    const start = Date.now();

    console.log(`👀 Observing ${type}: ${target} (timeout: ${timeout}ms)`);

    try {
        while (Date.now() - start < timeout) {
            if (type === 'port') {
                const port = parseInt(target);
                if (!isNaN(port)) {
                    const available = await isPortAvailable(port);
                    // If available is false, it means something IS listening on that port (port is in use)
                    // In this context, "success" usually means the app is up, so available === false
                    if (!available) {
                        return { success: true, message: `Port ${port} is active (something is listening).` };
                    }
                }
            } else if (type === 'file') {
                const isAbsolute = path.isAbsolute(target);
                const resolvedPath = isAbsolute ? target : resolve(process.cwd(), target);
                if (fs.existsSync(resolvedPath)) {
                    return { success: true, message: `File exists: ${resolvedPath}` };
                }
            } else if (type === 'url') {
                try {
                    const response = await fetch(target, { method: 'HEAD' });
                    if (response.ok) {
                        return { success: true, message: `URL is accessible: ${target}` };
                    }
                } catch (e) {
                    // Ignore and retry
                }
            } else if (type === 'process') {
                try {
                    const { stdout } = await execAsync(`tasklist /fi "imagename eq ${target}"`);
                    if (stdout.toLowerCase().includes(target.toLowerCase())) {
                        return { success: true, message: `Process found: ${target}` };
                    }
                } catch (e) {
                    // Ignore and retry
                }
            }

            await new Promise(resolve => setTimeout(resolve, interval));
        }

        return { success: false, message: `Observation timed out for ${type}: ${target}` };
    } catch (e: any) {
        return { success: false, message: `Observation error: ${e.message}` };
    }
}


export async function getFileContent(fileName: string) {
    try {
        if (fileName.includes('..')) {
            throw new Error('Invalid filename');
        }

        const filePath = join(process.cwd(), 'public', 'uploads', fileName);
        const content = await readFileFS(filePath, 'utf-8');
        return { success: true, content };
    } catch (error) {
        return { success: false, error: 'Failed to read file' };
    }
}

const getRepoAppsRoot = () => join(process.cwd(), 'apps');

const resolveRepoAppsPath = (relativePath: string) => {
    const root = resolve(getRepoAppsRoot());
    const sanitized = relativePath.replace(/^[/\\]+/, '');
    const fullPath = resolve(join(root, sanitized));
    if (!fullPath.startsWith(root)) {
        throw new Error('Invalid path');
    }
    return fullPath;
};

const resolveStartScript = (scripts?: Record<string, string> | null) => {
    if (!scripts) return null;
    if (scripts.start) return 'start';
    if (scripts.preview) return 'preview';
    if (scripts.dev) return 'dev';
    return null;
};

const REPO_IGNORE = ['node_modules', '.git', '.next', 'dist', 'build', '.agent'];

// Cache for repo listings (significantly speeds up repeated access)
const repoListingCache = new Map<string, { data: any; timestamp: number }>();
const REPO_CACHE_TTL = 60000; // 1 minute cache

export async function listRepoAppEntries(relativePath = '', options: { skipCache?: boolean } = {}) {
    try {
        const cacheKey = relativePath || 'root';

        // Check cache first (unless explicitly skipped)
        if (!options.skipCache) {
            const cached = repoListingCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < REPO_CACHE_TTL) {
                return cached.data;
            }
        }

        const root = getRepoAppsRoot();
        const targetPath = relativePath ? resolveRepoAppsPath(relativePath) : root;
        const entries = await readdir(targetPath, { withFileTypes: true });

        const mapped = await Promise.all(
            entries
                .filter(entry => !REPO_IGNORE.includes(entry.name))
                .map(async (entry) => {
                    const name = entry.name;
                    const entryPath = relativePath ? `${relativePath}/${name}` : name;
                    if (entry.isDirectory()) {
                        return { name, path: entryPath, type: 'folder' as const, size: null };
                    }
                    const filePath = resolveRepoAppsPath(entryPath);
                    const fileStat = await stat(filePath);
                    const ext = name.includes('.') ? name.split('.').pop() || 'file' : 'file';
                    return { name, path: entryPath, type: ext, size: fileStat.size };
                })
        );

        const result = { success: true, entries: mapped };

        // Cache the result
        repoListingCache.set(cacheKey, { data: result, timestamp: Date.now() });

        // Cleanup old cache entries (keep cache size manageable)
        if (repoListingCache.size > 100) {
            const now = Date.now();
            for (const [key, value] of repoListingCache.entries()) {
                if (now - value.timestamp > REPO_CACHE_TTL) {
                    repoListingCache.delete(key);
                }
            }
        }

        return result;
    } catch (error) {
        console.error('Failed to list repo app entries:', error);
        return { success: false, error: 'Failed to list repo app entries' };
    }
}

/**
 * Clear repo listing cache (useful after creating/deleting files)
 */
export async function clearRepoListingCache(relativePath?: string) {
    if (relativePath) {
        repoListingCache.delete(relativePath);
        repoListingCache.delete('root'); // Also clear root as structure changed
    } else {
        repoListingCache.clear();
    }
    return { success: true };
}

export async function getRepoAppFileContent(relativePath: string) {
    try {
        if (!relativePath) throw new Error('Missing path');
        const filePath = resolveRepoAppsPath(relativePath);
        const content = await readFileFS(filePath, 'utf-8');
        return { success: true, content };
    } catch (error) {
        console.error('Failed to read repo app file:', error);
        return { success: false, error: 'Failed to read repo app file' };
    }
}

export async function saveRepoAppFileContent(relativePath: string, content: string) {
    try {
        if (!relativePath) throw new Error('Missing path');
        const filePath = resolveRepoAppsPath(relativePath);
        await writeFile(filePath, content);
        return { success: true };
    } catch (error) {
        console.error('Failed to save repo app file:', error);
        return { success: false, error: 'Failed to save repo app file' };
    }
}

export async function installRepoApp(relativePath: string) {
    try {
        if (!relativePath) throw new Error('Missing path');
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        const appPath = resolveRepoAppsPath(relativePath);
        const folderName = relativePath.split('/').pop() || relativePath;
        const packageJsonPath = join(appPath, 'package.json');
        let packageJson: { scripts?: Record<string, string> } | null = null;

        try {
            const pkgRaw = await readFileFS(packageJsonPath, 'utf-8');
            packageJson = JSON.parse(pkgRaw);
        } catch (error) {
            return { success: false, error: 'Missing or invalid package.json in app folder' };
        }

        const startScript = resolveStartScript(packageJson?.scripts || null);
        if (!startScript) {
            return { success: false, error: 'package.json is missing a start/preview/dev script' };
        }

        const dockerIsUp = await checkDockerAvailability();
        if (!dockerIsUp) {
            return { success: false, error: 'Docker daemon is unavailable. Local installation not yet implemented for this path.' };
        }

        const safeName = folderName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
        const internalDomain = `repo-${safeName}.internal`;
        const imageName = safeName;
        const containerName = safeName;

        let internalPort = 3000;
        let dockerFileName = 'Dockerfile.taskflow';
        let useExistingDockerfile = false;

        // Check if a custom Dockerfile exists
        try {
            const existingDockerfileContent = await readFileFS(join(appPath, 'Dockerfile'), 'utf-8');
            useExistingDockerfile = true;
            dockerFileName = 'Dockerfile';

            // Try to detect exposed port
            const exposeMatch = existingDockerfileContent.match(/EXPOSE\s+(\d+)/);
            if (exposeMatch) {
                internalPort = parseInt(exposeMatch[1]);
            } else if (existingDockerfileContent.includes('nginx')) {
                internalPort = 80;
            }
        } catch {
            // No existing Dockerfile, proceed with generation logic
        }

        if (!useExistingDockerfile) {
            const dockerfile = `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
ENV NODE_ENV=production
ENV PORT=3000
RUN npm run build --if-present
EXPOSE 3000
CMD ["npm", "run", "${startScript}"]
`;
            await writeFile(join(appPath, 'Dockerfile.taskflow'), dockerfile);
        }

        const port = await getAvailablePort();
        console.log(`🔌 Allocated port ${port} for ${containerName}`);
        const dockerfilePath = join(appPath, dockerFileName);

        try {
            await execAsync(`docker rm -f ${containerName}`);
        } catch {
            // ignore if container doesn't exist
        }

        console.log(`🐳 Building Docker image: ${imageName}`);
        await execAsync(`docker build -t ${imageName} -f "${dockerfilePath}" "${appPath}"`);
        console.log(`🚀 Running Docker container: ${containerName} on port ${port}:${internalPort}`);
        await execAsync(`docker run -d --name ${containerName} -p ${port}:${internalPort} ${imageName}`);

        const proxyConfigPath = await writeProxyConfig(internalDomain, port);
        const dnsInstructions = `Add a hosts/DNS entry for ${internalDomain} -> 127.0.0.1 and reload your reverse proxy.`;

        const processName = `Repo App ${folderName}`;
        const existingProcess = await prisma.processRegistry.findFirst({
            where: { userId: user.id, name: processName }
        });

        const processData = {
            name: processName,
            type: 'docker-app',
            port,
            path: appPath,
            command: `docker run -d --name ${containerName} -p ${port}:${internalPort} ${imageName}`,
            status: 'running',
            healthCheckType: 'port',
            healthInterval: 30000,
            startedAt: new Date(),
            stoppedAt: null,
            metadata: {
                containerName,
                imageName,
                internalDomain,
                appName: folderName,
                appPath,
                startScript,
                source: 'repo-app'
            }
        };

        if (existingProcess) {
            await prisma.processRegistry.update({
                where: { id: existingProcess.id },
                data: processData
            });
        } else {
            await prisma.processRegistry.create({
                data: { ...processData, userId: user.id }
            });
        }

        safeRevalidatePath('/');
        return { success: true, internalDomain, port, proxyConfigPath, dnsInstructions };
    } catch (error: any) {
        console.error('Failed to install repo app:', error);
        return { success: false, error: error?.message || 'Failed to install repo app' };
    }
}

export async function saveFileContent(fileName: string, content: string) {
    try {
        // Enhance security: prevent directory traversal
        if (fileName.includes('..')) {
            throw new Error('Invalid filename');
        }

        const filePath = join(process.cwd(), 'public', 'uploads', fileName);
        await writeFile(filePath, content);

        // Update size in DB if file exists
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (user) {
            const file = await prisma.workspaceFile.findFirst({
                where: { userId: user.id, storagePath: fileName } // Try storagePath first
            }) || await prisma.workspaceFile.findFirst({
                where: { userId: user.id, name: fileName } // Fallback to name
            });

            if (file) {
                await prisma.workspaceFile.update({
                    where: { id: file.id },
                    data: {
                        size: `${Buffer.byteLength(content)} bytes`,
                        updatedAt: new Date()
                    }
                });
            }
        }

        safeRevalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Failed to save file:', error);
        return { success: false, error: 'Failed to save file' };
    }
}

/**
 * Execute Vite + React scaffold with user-provided details
 */
export async function executeScaffoldVite(args: { projectName: string; description?: string; features?: string[] }) {
    const { projectName, description, features } = args;

    // Validate project name
    if (!projectName || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(projectName)) {
        return {
            success: false,
            message: 'Invalid project name. Use kebab-case (lowercase with hyphens), e.g., "my-app"'
        };
    }

    const appPath = path.join(process.cwd(), 'apps', projectName);
    const execAsync = promisify(exec);
    let logs: string[] = [];

    try {
        // STEP 1: CREATE/REUSE FOLDER
        const folderExists = fs.existsSync(appPath);
        if (!folderExists) {
            fs.mkdirSync(appPath, { recursive: true });
            logs.push(`✅ Created folder: apps/${projectName}`);
        } else {
            logs.push(`ℹ️ Folder already exists: apps/${projectName}`);
        }

        // STEP 2: RUN VITE SCAFFOLD (idempotent handling)
        const packageJsonPath = path.join(appPath, 'package.json');
        const hasPackageJson = fs.existsSync(packageJsonPath);
        const visibleEntries = fs.existsSync(appPath)
            ? fs.readdirSync(appPath).filter(name => !name.startsWith('.'))
            : [];

        if (hasPackageJson) {
            logs.push('ℹ️ Detected existing package.json, skipping scaffold step.');
        } else if (visibleEntries.length === 0 || (visibleEntries.length === 1 && visibleEntries[0] === 'node_modules')) {
            // Safe to recreate scaffold if folder is empty or only has node_modules
            logs.push('ℹ️ Folder is empty (or only node_modules). Recreating scaffold.');

            // Remove the folder entirely so the PowerShell script doesn't abort on existing dir
            fs.rmSync(appPath, { recursive: true, force: true });
            fs.mkdirSync(appPath, { recursive: true });

            const scaffoldScript = path.join(process.cwd(), 'scripts', 'scaffold-vite.ps1');
            const scaffoldCmd = `powershell -ExecutionPolicy Bypass -File "${scaffoldScript}" -AppName ${projectName}`;
            console.log(`🔧 Running: ${scaffoldCmd}`);
            const { stdout: scaffoldOut } = await execAsync(scaffoldCmd, {
                cwd: process.cwd(),
                maxBuffer: 10 * 1024 * 1024,
                shell: 'powershell.exe'
            });
            logs.push(`✅ Vite + React + TypeScript scaffolded`);
        } else {
            throw new Error(`apps/${projectName} already exists and is not empty. Please choose a new app name or remove the folder.`);
        }

        // STEP 3: COPY DESIGN SYSTEM
        const templatesPath = path.join(process.cwd(), '.agent', 'workflows', 'templates');
        const designPath = path.join(appPath, 'src', 'styles');
        fs.mkdirSync(designPath, { recursive: true });
        fs.copyFileSync(
            path.join(templatesPath, 'design-system.css'),
            path.join(designPath, 'design-system.css')
        );
        logs.push(`✅ Design system installed`);

        // STEP 4: COPY SEO CONFIG
        const libPath = path.join(appPath, 'src', 'lib');
        fs.mkdirSync(libPath, { recursive: true });
        fs.copyFileSync(
            path.join(templatesPath, 'seo-config.ts'),
            path.join(libPath, 'seo-config.ts')
        );
        logs.push(`✅ SEO configuration installed`);

        // STEP 5: COPY COMPONENTS
        const compPath = path.join(appPath, 'src', 'components');
        fs.mkdirSync(compPath, { recursive: true });
        fs.copyFileSync(
            path.join(templatesPath, 'component-template.tsx'),
            path.join(compPath, 'Button.tsx')
        );
        logs.push(`✅ Sample components installed`);

        // STEP 6: INSTALL REACT-HELMET-ASYNC
        const npmCmd = `Set-Location "${appPath}"; npm install react-helmet-async --legacy-peer-deps`;
        console.log(`🔧 Running: ${npmCmd}`);
        const { stdout: npmOut } = await execAsync(npmCmd, {
            cwd: process.cwd(),
            maxBuffer: 20 * 1024 * 1024,
            shell: 'powershell.exe'
        });
        logs.push(`✅ react-helmet-async installed`);

        // STEP 7: INITIALIZE GIT
        const gitInitCmd = `Set-Location "${appPath}"; git init; Copy-Item -Force -Path "..\\..\\..\\.agent\\workflows\\templates\\app-gitignore" -Destination ".gitignore"; git add .; git commit -m "Initial Vite + React scaffold"`;
        console.log(`🔧 Initializing git...`);
        const { stdout: gitOut } = await execAsync(gitInitCmd, {
            cwd: process.cwd(),
            maxBuffer: 5 * 1024 * 1024,
            shell: 'powershell.exe'
        });
        logs.push(`✅ Git initialized with initial commit`);

        // STEP 8: SETUP GITHUB ACTIONS
        const githubPath = path.join(appPath, '.github', 'workflows');
        fs.mkdirSync(githubPath, { recursive: true });
        fs.copyFileSync(
            path.join(templatesPath, 'github-ci.yml'),
            path.join(githubPath, 'ci.yml')
        );
        fs.copyFileSync(
            path.join(templatesPath, 'github-deploy.yml'),
            path.join(githubPath, 'deploy.yml')
        );
        const gitHubCmd = `Set-Location "${appPath}"; git add .github; git commit -m "Add CI/CD workflows"`;
        await execAsync(gitHubCmd, {
            cwd: process.cwd(),
            maxBuffer: 5 * 1024 * 1024,
            shell: 'powershell.exe'
        });
        logs.push(`✅ GitHub Actions CI/CD configured`);

        // STEP 9: INSTALL DEPENDENCIES
        const installCmd = `Set-Location "${appPath}"; npm install --legacy-peer-deps`;
        console.log(`🔧 Installing dependencies (this may take a minute)...`);
        const { stdout: installOut } = await execAsync(installCmd, {
            cwd: process.cwd(),
            maxBuffer: 20 * 1024 * 1024,
            shell: 'powershell.exe',
            timeout: 120000
        });
        logs.push(`✅ Dependencies installed`);

        // STEP 10: BUILD FOR DOCKER
        const buildCmd = `Set-Location "${appPath}"; npm run build`;
        console.log(`🔧 Building production version...`);
        const { stdout: buildOut } = await execAsync(buildCmd, {
            cwd: process.cwd(),
            maxBuffer: 20 * 1024 * 1024,
            shell: 'powershell.exe',
            timeout: 120000
        });
        logs.push(`✅ Production build created`);

        // STEP 11: COPY DOCKER CONFIG
        fs.copyFileSync(
            path.join(templatesPath, 'Dockerfile.vite'),
            path.join(appPath, 'Dockerfile')
        );
        fs.copyFileSync(
            path.join(templatesPath, 'nginx-spa.conf'),
            path.join(appPath, 'nginx.conf')
        );
        const dockerCmd = `Set-Location "${appPath}"; git add Dockerfile nginx.conf; git commit -m "Add Docker configuration"`;
        await execAsync(dockerCmd, {
            cwd: process.cwd(),
            maxBuffer: 5 * 1024 * 1024,
            shell: 'powershell.exe'
        });
        logs.push(`✅ Docker configuration added`);

        // SUCCESS: Full boilerplate complete
        const descriptionText = description ? `\n**Description:** ${description}` : '';
        const featuresText = features && features.length > 0 ? `\n**Features:** ${features.join(', ')}` : '';

        return {
            success: true,
            message: `🎉 **VITE + REACT BOILERPLATE COMPLETE!**\n\n${logs.map(l => '  ' + l).join('\n')}\n\n**Project:** ${projectName}${descriptionText}${featuresText}\n**Location:** \`apps/${projectName}\`\n**Dev Server:** \`npm run dev\` (runs at localhost:5173)\n**Build:** \`npm run build\` (already completed for Docker)\n\nNext steps:\n1. Navigate to the project: \`cd apps/${projectName}\`\n2. Run dev server: \`npm run dev\`\n3. Edit files in \`src/\` to customize\n\nUse separate \`/\` commands for domain-specific customization (colors, features, APIs, etc.).`
        };

    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const failedStep = logs.length > 0 ? logs[logs.length - 1] : 'folder creation';
        return {
            success: false,
            message: `❌ **Boilerplate Failed at:** ${failedStep}\n\n**Error:** ${errorMsg}\n\n**Logs:**\n${logs.map(l => '  ' + l).join('\n')}\n\nCheck the server console for more details.`
        };
    }
}




export async function convertFolderToApp(folderId: string, entryFileId: string) {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        // 1. Mark the folder as an app root
        await prisma.workspaceFile.update({
            where: { id: folderId },
            data: {
                tags: { push: 'app_root' },
                highlightBgColor: 'rgba(16, 185, 129, 0.2)', // Emerald tint
                highlightBorderColor: 'rgba(16, 185, 129, 0.5)'
            }
        });

        // 2. Mark the entry file
        await prisma.workspaceFile.update({
            where: { id: entryFileId },
            data: {
                tags: { push: 'app_entry' }
            }
        });

        safeRevalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Failed to convert folder to app:', error);
        return { success: false, error: 'Failed to convert folder to app' };
    }
}

export async function unpromoteApp(folderId: string) {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        // 1. Unmark folder
        // We need to fetch current tags first to safely remove one? 
        // Or Prisma 'set' acts as overwrite. 
        // Let's just filter out 'app_root'.
        const folder = await prisma.workspaceFile.findUnique({ where: { id: folderId } });
        if (!folder) throw new Error('Folder not found');

        const newTags = folder.tags.filter(t => t !== 'app_root');

        await prisma.workspaceFile.update({
            where: { id: folderId },
            data: {
                tags: newTags,
                highlightBgColor: null,
                highlightBorderColor: null
            }
        });

        // 2. Unmark child entry files
        await prisma.workspaceFile.updateMany({
            where: { parentId: folderId, tags: { has: 'app_entry' } },
            data: { tags: { set: [] } } // This might be too aggressive if they have other tags.
            // Better: just fetch them and remove 'app_entry'. For now, assuming only this tag matters.
        });

        // REFACTOR: Use a raw query or loop if tags need preservation.
        // For MVP, wiping tags on the entry file is acceptable as we don't use other tags yet.

        // 3. Destroy Data
        // 3. Destroy Data (Skipped: prototypeData model removed)
        // await prisma.prototypeData.deleteMany({
        // where: { appId: folderId }
        // });

        safeRevalidatePath('/');
        return { success: true, message: 'App destroyed. Data wiped 🗑️' };
    } catch (error) {
        console.error('Failed to unpromote app:', error);
        return { success: false, error: 'Failed to destroy app' };
    }
}

export async function installDynamicApp(folderId: string) {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        const folder = await prisma.workspaceFile.findFirst({
            where: { id: folderId, type: 'folder', userId: user.id }
        });

        if (!folder) {
            return { success: false, error: 'App folder not found' };
        }

        const appPath = getWorkspaceFolderPath(folderId);
        const packageJsonPath = join(appPath, 'package.json');

        let packageJson: { scripts?: Record<string, string> } | null = null;
        try {
            const pkgRaw = await readFileFS(packageJsonPath, 'utf-8');
            packageJson = JSON.parse(pkgRaw);
        } catch (error) {
            return { success: false, error: 'Missing or invalid package.json in app folder' };
        }

        const startScript = resolveStartScript(packageJson?.scripts || null);
        if (!startScript) {
            return { success: false, error: 'package.json is missing a start/preview/dev script' };
        }

        await execAsync('docker version');

        const internalDomain = `app-${folderId}.internal`;
        const imageName = `taskflow-app-${folderId}`;
        const containerName = `taskflow-app-${folderId}`;

        let internalPort = 3000;
        let dockerFileName = 'Dockerfile.taskflow';
        let useExistingDockerfile = false;

        // Check if a custom Dockerfile exists
        try {
            const existingDockerfileContent = await readFileFS(join(appPath, 'Dockerfile'), 'utf-8');
            useExistingDockerfile = true;
            dockerFileName = 'Dockerfile';

            // Try to detect exposed port
            const exposeMatch = existingDockerfileContent.match(/EXPOSE\s+(\d+)/);
            if (exposeMatch) {
                internalPort = parseInt(exposeMatch[1]);
            } else if (existingDockerfileContent.includes('nginx')) {
                internalPort = 80;
            }
        } catch {
            // No existing Dockerfile, proceed with generation logic
        }

        if (!useExistingDockerfile) {
            const dockerfile = `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
ENV NODE_ENV=production
ENV PORT=3000
RUN npm run build --if-present
EXPOSE 3000
CMD ["npm", "run", "${startScript}"]
`;
            await writeFile(join(appPath, 'Dockerfile.taskflow'), dockerfile);
        }

        const existingDeployment = await prisma.appDeployment.findFirst({
            where: { appId: folderId, userId: user.id }
        });

        const port = await getAvailablePort();
        const dockerfilePath = join(appPath, dockerFileName);

        try {
            await execAsync(`docker rm -f ${containerName}`);
        } catch {
            // ignore if container doesn't exist
        }

        await execAsync(`docker build -t ${imageName} -f "${dockerfilePath}" "${appPath}"`);
        await execAsync(`docker run -d --name ${containerName} -p ${port}:${internalPort} ${imageName}`);

        const proxyConfigPath = await writeProxyConfig(internalDomain, port);
        const dnsInstructions = `Add a hosts/DNS entry for ${internalDomain} -> 127.0.0.1 and reload your reverse proxy.`;

        const deployment = existingDeployment
            ? await prisma.appDeployment.update({
                where: { id: existingDeployment.id },
                data: {
                    internalDomain,
                    port,
                    containerName,
                    imageName,
                    status: 'running',
                    logs: null
                }
            })
            : await prisma.appDeployment.create({
                data: {
                    appId: folderId,
                    internalDomain,
                    port,
                    containerName,
                    imageName,
                    status: 'running',
                    userId: user.id
                }
            });

        const processName = `Docker App ${folderId}`;
        const existingProcess = await prisma.processRegistry.findFirst({
            where: { userId: user.id, name: processName }
        });

        if (existingProcess) {
            await prisma.processRegistry.update({
                where: { id: existingProcess.id },
                data: {
                    type: 'docker-app',
                    port,
                    path: appPath,
                    command: `docker run -d --name ${containerName} -p ${port}:${internalPort} ${imageName}`,
                    status: 'running',
                    healthCheckType: 'port',
                    healthInterval: 30000,
                    startedAt: new Date(),
                    stoppedAt: null,
                    metadata: {
                        containerName,
                        imageName,
                        internalDomain,
                        appId: folderId,
                        startScript
                    }
                }
            });
        } else {
            await prisma.processRegistry.create({
                data: {
                    name: processName,
                    type: 'docker-app',
                    port,
                    path: appPath,
                    command: `docker run -d --name ${containerName} -p ${port}:${internalPort} ${imageName}`,
                    status: 'running',
                    healthCheckType: 'port',
                    healthInterval: 30000,
                    metadata: {
                        containerName,
                        imageName,
                        internalDomain,
                        appId: folderId,
                        startScript
                    },
                    userId: user.id
                }
            });
        }

        safeRevalidatePath('/');
        return { success: true, deployment, internalDomain, port, proxyConfigPath, dnsInstructions };
    } catch (error: any) {
        console.error('Failed to install app:', error);
        return { success: false, error: error?.message || 'Failed to install app' };
    }
}

export async function getWorkspaceFiles() {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        const files = await prisma.workspaceFile.findMany({
            where: { userId: user.id },
            select: { id: true, name: true, type: true, parentId: true, order: true, items: true, size: true, tags: true }
        });

        return deepSerialize(files);
    } catch (error) {
        console.error('Failed to get workspace files:', error);
        return [];
    }
}

export async function moveFile(id: string, parentId: string | null) {
    try {
        await prisma.workspaceFile.update({
            where: { id },
            data: { parentId }
        });
        safeRevalidatePath('/');
        return { success: true };
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error('moveFile failed:', msg);
        return { success: false, message: msg };
    }
}

export async function toggleFileShare(id: string, shared: boolean) {
    try {
        await prisma.workspaceFile.update({
            where: { id },
            data: { shared }
        });
        safeRevalidatePath('/');
        return { success: true };
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error('toggleFileShare failed:', msg);
        return { success: false, message: msg };
    }
}

export async function reorderFiles(items: { id: string, order: number }[]) {
    try {
        await prisma.$transaction(
            items.map(item => prisma.workspaceFile.update({
                where: { id: item.id },
                data: { order: item.order }
            }))
        );
        safeRevalidatePath('/');
        return { success: true };
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error('reorderFiles failed:', msg);
        return { success: false, message: msg };
    }
}

export async function getPrompts() {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        const FULLSTACK_DEFAULT_TOOLS = [
            'list_dir',
            'read_file',
            'view_file',
            'search_codebase',
            'repo_context_pack',
            'find_symbol_references',
            'apply_patch',
            'apply_batch',
            'replace_in_file',
            'edit_file',
            'create_file',
            'create_folder',
            'rename_file',
            'delete_file',
            'manage_app_lifecycle',
            'run_in_terminal',
            'run_app_command',
            'execute_command_in_app',
            'get_app_logs',
            'search_web'
        ];

        const prompts = await prisma.aIPromptSet.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' }
        });

        const ensurePrompt = async (name: string, description: string, prompt: string, tools?: string[]) => {
            const existing = await prisma.aIPromptSet.findFirst({ where: { name, userId: user.id } });
            if (existing) return;
            await prisma.aIPromptSet.create({
                data: {
                    name,
                    description,
                    prompt,
                    userId: user.id,
                    isActive: false,
                    tools: tools || DEFAULT_SKILLS
                }
            });
        };

        if (prompts.length === 0) {
            const defaults = [
                {
                    name: "Dominican Receipt Expert",
                    description: "Analyzes DR receipts (Bravo, Nacional, etc.) for ITBIS, NCF, and RNC. Handles blurry and multi-part images.",
                    prompt: `**1. IDENTITY:** You are TaskFlow AI, an expert AI assistant specializing in precise data extraction from "Comprobantes Fiscales" (tax receipts) issued in the Dominican Republic.

**2. TACTICAL EXPERTISE:**
* ITBIS Extraction: Accurately identify and extract total ITBIS.
* Valid NCF Code Identification: Locate and extract valid NCF codes (B01, B02, B11, B13, or E31).
* RNC/Cédula Extraction: Identify and extract RNC or Cédula (9 or 11 digits).
* Official Business Verification: Provide DGII verification links.

**3. OPERATIONAL GUIDELINES:**
* Accuracy First: Prioritize accuracy above all else.
* System Architect: You can create specialized Agents (create_agent) and architect complex Workflows (create_workflow). Proactively suggest workflows for repetitive tasks.
* Micro-Tool Composition: Use granular tools (extract_receipt_info, generate_markdown_report, organize_files) in sequence.
* Workspace Hygiene: Maintain a clean root directory. Organize receipts into Receipts/{Year}/{Month} hierarchy (e.g., "Receipts/2025/06 - June"). Reuse existing folders.

**4. GUARDRAILS:**
* No Interpretation: Strictly data extraction only.
* Document Type Restriction: Focus exclusively on DR receipts.
* Data Privacy: Paramount importance.`
                },
                {
                    name: "Review Agent",
                    description: "Reviews plans, tool usage, and outputs for correctness, safety, and completeness before execution.",
                    prompt: "You are TaskFlow AI, a rigorous Review Agent. Your job is to review plans and intended tool use, identify risks or missing steps, and request clarification when needed. You do not execute tools. You only approve, reject, or request changes with concise reasoning."
                },
                {
                    name: "Code Reviewer",
                    description: "Analyzes code files for bugs, security, and optimization.",
                    prompt: "You are TaskFlow AI, a Senior Staff Engineer. Analyze technical files for architecture, security, and performance."
                },
                {
                    name: "Software Architect",
                    description: "Builds production-grade features with clean architecture, safe edits, and clear execution steps.",
                    prompt: "You are TaskFlow AI, a senior software architect and implementer.\n\nGOALS:\n- Deliver correct, maintainable code with minimal churn.\n- Prefer small, safe edits and reuse existing patterns.\n- Ask concise clarification questions only when necessary.\n\nEXECUTION:\n- Inspect relevant files before editing.\n- Use available tests or mention missing coverage.\n- Explain tradeoffs briefly and keep responses tight."
                },
                {
                    name: "Full Stack Developer",
                    description: "Autonomous full-stack builder that explores, edits, and validates end-to-end changes across frontend and backend.",
                    prompt: "You are TaskFlow AI, a senior full-stack developer focused on end-to-end delivery.\n\nAUTONOMY:\n- Act without asking for permission on routine edits.\n- Always explore before editing: list dirs, read files, search.\n- Use apply_patch for targeted edits. Avoid large rewrites.\n\nAPP CONTEXT:\n- If an active app exists, only work inside apps/<activeApp>.\n- Find theme entrypoints (index.css, App.css, tailwind.config, globals, theme tokens).\n- Update the site holistically: layout, colors, typography, spacing.\n\nTOOLS:\n- Use list_dir/read_file/search_codebase to locate files.\n- Use apply_patch/edit_file to implement changes.\n- Run build/lint if present.\n\nOUTPUT:\n- Show what changed and why, keep it brief."
                },
                {
                    name: "Product Design Lead",
                    description: "Crafts bold, premium UI direction with strong typography, color systems, and responsive layout guidance.",
                    prompt: "You are TaskFlow AI, a product design lead focused on distinctive, high-clarity interfaces.\n\nPRIORITIES:\n- Define visual direction: typography, color palette, spacing, and layout grid.\n- Create clear hierarchy and strong composition.\n- Use CSS variables for theme tokens.\n- Ensure responsive behavior and accessible contrast.\n\nSTYLE:\n- Avoid generic layouts and safe defaults.\n- Be explicit about interaction states and motion where relevant."
                }
            ];

            for (const d of defaults) {
                await prisma.aIPromptSet.create({
                    data: {
                        name: d.name,
                        description: d.description,
                        prompt: d.prompt,
                        userId: user.id,
                        isActive: d.name.includes("Receipt"),
                        tools: d.name === "Full Stack Developer" ? FULLSTACK_DEFAULT_TOOLS : DEFAULT_SKILLS
                    }
                });
            }
            return await prisma.aIPromptSet.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
        }

        await ensurePrompt(
            "Review Agent",
            "Reviews plans, tool usage, and outputs for correctness, safety, and completeness before execution.",
            "You are TaskFlow AI, a rigorous Review Agent. Your job is to review plans and intended tool use, identify risks or missing steps, and request clarification when needed. You do not execute tools. You only approve, reject, or request changes with concise reasoning."
        );
        await ensurePrompt(
            "Tool Agent",
            "Executes pre-approved tools reliably and reports results back to the main agent.",
            "You are TaskFlow AI's Tool Agent. Your sole job is to execute pre-approved tools and return concise results. Do not ask for approval. Do not re-plan. If a tool fails, report the failure and stop."
        );
        await ensurePrompt(
            "Software Architect",
            "Builds production-grade features with clean architecture, safe edits, and clear execution steps.",
            "You are TaskFlow AI, a senior software architect and implementer.\n\nGOALS:\n- Deliver correct, maintainable code with minimal churn.\n- Prefer small, safe edits and reuse existing patterns.\n- Ask concise clarification questions only when necessary.\n\nEXECUTION:\n- Inspect relevant files before editing.\n- Use available tests or mention missing coverage.\n- Explain tradeoffs briefly and keep responses tight."
        );
        await ensurePrompt(
            "Full Stack Developer",
            "Autonomous full-stack builder that explores, edits, and validates end-to-end changes across frontend and backend.",
            "You are TaskFlow AI, a senior full-stack developer focused on end-to-end delivery.\n\nAUTONOMY:\n- Act without asking for permission on routine edits.\n- Always explore before editing: list dirs, read files, search.\n- Use apply_patch for targeted edits. Avoid large rewrites.\n\nAPP CONTEXT:\n- If an active app exists, only work inside apps/<activeApp>.\n- Find theme entrypoints (index.css, App.css, tailwind.config, globals, theme tokens).\n- Update the site holistically: layout, colors, typography, spacing.\n\nTOOLS:\n- Use list_dir/read_file/search_codebase to locate files.\n- Use apply_patch/edit_file to implement changes.\n- Run build/lint if present.\n\nOUTPUT:\n- Show what changed and why, keep it brief.",
            FULLSTACK_DEFAULT_TOOLS
        );
        await ensurePrompt(
            "Product Design Lead",
            "Crafts bold, premium UI direction with strong typography, color systems, and responsive layout guidance.",
            "You are TaskFlow AI, a product design lead focused on distinctive, high-clarity interfaces.\n\nPRIORITIES:\n- Define visual direction: typography, color palette, spacing, and layout grid.\n- Create clear hierarchy and strong composition.\n- Use CSS variables for theme tokens.\n- Ensure responsive behavior and accessible contrast.\n\nSTYLE:\n- Avoid generic layouts and safe defaults.\n- Be explicit about interaction states and motion where relevant."
        );
        return deepSerialize(prompts);
    } catch (error) {
        console.error('Failed to get prompts:', error);
        return [];
    }
}

async function ensureToolAgentPrompt(userId: string) {
    const existing = await prisma.aIPromptSet.findFirst({
        where: { name: 'Tool Agent', userId }
    });
    if (existing) return existing;

    return prisma.aIPromptSet.create({
        data: {
            name: 'Tool Agent',
            description: 'Executes pre-approved tools reliably and reports results back to the main agent.',
            prompt: "You are TaskFlow AI's Tool Agent. Your sole job is to execute pre-approved tools and return concise results. Do not ask for approval. Do not re-plan. If a tool fails, report the failure and stop.",
            userId,
            isActive: false,
            tools: DEFAULT_SKILLS
        }
    });
}

export async function getIntentRules() {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');
        return await prisma.intentRule.findMany({
            where: { userId: user.id },
            orderBy: { name: 'asc' }
        });
    } catch (error) {
        return [];
    }
}

export async function createPrompt(data: {
    name: string,
    prompt: string,
    description?: string,
    tools?: string[],
    workflows?: any[],
    triggerKeywords?: string[]
}) {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');
        const count = await prisma.aIPromptSet.count({ where: { userId: user.id } });
        const newPrompt = await prisma.aIPromptSet.create({
            data: {
                ...data,
                tools: data.tools || DEFAULT_SKILLS,
                workflows: data.workflows || [],
                triggerKeywords: data.triggerKeywords || [],
                userId: user.id,
                isActive: count === 0
            }
        });
        nextRevalidatePath('/');
        return { success: true, prompt: newPrompt };
    } catch (e) {
        return { success: false, error: 'Failed' };
    }
}

export async function setActivePrompt(id: string) {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');
        await prisma.$transaction([
            prisma.aIPromptSet.updateMany({ where: { userId: user.id }, data: { isActive: false } }),
            prisma.aIPromptSet.update({ where: { id }, data: { isActive: true } })
        ]);
        safeRevalidatePath('/');
        return { success: true };
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error('setActivePrompt failed:', msg);
        return { success: false, message: msg };
    }
}

export async function deletePrompt(id: string) {
    try {
        await prisma.aIPromptSet.delete({ where: { id } });
        safeRevalidatePath('/');
        return { success: true };
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error('deletePrompt failed:', msg);
        return { success: false, message: msg };
    }
}

export async function updatePrompt(id: string, data: {
    name?: string,
    prompt?: string,
    description?: string,
    tools?: string[],
    workflows?: any[],
    triggerKeywords?: string[]
}) {
    try {
        await prisma.aIPromptSet.update({
            where: { id },
            data: {
                ...data,
                // Ensure array types for Json fields if provided
                tools: data.tools,
                workflows: data.workflows,
                triggerKeywords: data.triggerKeywords
            }
        });
        safeRevalidatePath('/');
        return { success: true };
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error('updatePrompt failed:', msg);
        return { success: false, message: msg };
    }
}

export async function generateSystemPrompt(description: string) {
    try {
        const prompt = `You are a Prompt Engineer. Enhance the following Agent description into a professional system instruction: "${description}". 
        
        STRUCTURE:
        1. IDENTITY: Define who the agent is.
        2. TACTICAL EXPERTISE: List specific technical or functional areas of mastery.
        3. OPERATIONAL GUIDELINES: How it should think (step-by-step, deductive, etc.).
        4. GUARDRAILS: What it should NOT do.
        
        Keep it concise but EXTREMELY high-quality.`;
        const text = await generateAIText(prompt, { purpose: 'smart' });
        return { success: true, text: text.trim() };
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error('generateSystemPrompt failed:', msg);
        return { success: false, message: msg };
    }
}

export async function generateMagicContent(params: { fileName: string; content: string; goal: string; chatContext?: { role: 'user' | 'ai'; content: string }[] }) {
    try {
        const recentContext = params.chatContext
            ?.filter(m => m.content && m.content.trim().length > 0)
            .slice(-5)
            .map(m => `- ${m.role.toUpperCase()}: ${m.content.trim()}`)
            .join('\n');
        const prompt = `You are an expert front-end engineer and technical writer.
Update the following file based on the goal. Return ONLY the updated file content with no code fences or commentary.

File Name: ${params.fileName}
Goal: ${params.goal}

    ${recentContext ? `Recent Chat Context:\n${recentContext}\n\n` : ''}Current Content:
${params.content}
`;

        const rawText = await generateAIText(prompt, { purpose: 'fast' });
        const cleaned = rawText.trim().replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
        return { success: true, text: cleaned };
    } catch (error) {
        console.error('Failed to generate magic content:', error);
        return { success: false, error: 'Failed to generate magic content' };
    }
}

export async function generateMagicSuggestions(params: { fileName: string; description: string }) {
    try {
        const prompt = `You are a senior product designer and front-end copywriter.
Generate exactly 5 concise, high-quality content update suggestions for the file below based on the description.
Return ONLY a JSON array of 5 strings. No extra text.

File Name: ${params.fileName}
Description: ${params.description}
`;

        const text = await generateAIText(prompt, { purpose: 'fast' });
        const trimmed = text.trim();
        const jsonMatch = trimmed.match(/\[[\s\S]*\]/);
        const suggestions = JSON.parse(jsonMatch ? jsonMatch[0] : trimmed);
        return { success: true, suggestions };
    } catch (error) {
        console.error('Failed to generate magic suggestions:', error);
        return { success: false, error: 'Failed to generate magic suggestions' };
    }
}

export async function generateSuggestions(
    query: string,
    workflowType?: string,
    contextPayload?: string
) {
    try {
        // Parse context if provided
        let contextString = '';
        if (contextPayload) {
            try {
                const context = JSON.parse(contextPayload);
                contextString = `\n\nCONTEXT FROM USER'S REQUEST:\n${JSON.stringify(context, null, 2)}\n\nUse this context to generate more relevant and specific task flows.`;
            } catch (e) {
                // If parsing fails, just ignore context
                console.warn('Failed to parse context payload:', e);
            }
        }

        const workflowTypeHint = workflowType
            ? `\n\nFOCUS AREA: This is for ${workflowType.replace(/-/g, ' ')} workflows. Tailor suggestions accordingly.`
            : '';

        const prompt = `You are a visionary product architect and prompt engineer. Generate 5 unique, high-quality "Task Flows" for an AI agent based on this research theme or search query: "${query}".${workflowTypeHint}${contextString}
        
        Each flow must be a comprehensive multi-step instruction set that an agent can consume to build a premium product or perform a complex task.
        
        Return a JSON array of objects with this structure (NO OTHER TEXT, JUST THE JSON):
        [
            {
                "id": "unique-slug",
                "title": "Stunning Title",
                "category": "e.g. Fintech, E-commerce, Marketing",
                "description": "Short 1-sentence teaser",
                "flow": [
                    { "step": 1, "task": "Name of task", "description": "What to do" }
                ],
                "agentInstructions": "A detailed, paragraph-based instruction block in Markdown format. This should be a direct prompt for the agent, starting with 'You are a [Expert]...' and detailing the full structure, aesthetics, and technical requirements. This is the 'Instruction File' for the agent."
            }
        ]
        
        Focus on: Premium aesthetics, Glassmorphism, Sophisticated functionality, and detailed technical steps.
        `;

        const text = await generateAIText(prompt, { purpose: 'smart' });

        // Extract JSON
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        const suggestions = JSON.parse(jsonMatch ? jsonMatch[0] : text);

        return { success: true, suggestions };
    } catch (error) {
        console.error('Failed to generate suggestions:', error);
        return { success: false, error: 'Failed to generate suggestions' };
    }
}

/**
 * DGII RNC Verification via MegaPlus free API with local cache fallback.
 * Validates checksum (Luhn-10 for 9-digit RNC, mod-11 for 11-digit cédula)
 * then queries the live API with a 3-second timeout.
 */
export async function verifyRNC(rnc: string) {
    try {
        const cleanRNC = rnc.replace(/[^0-9]/g, '');

        // Checksum validation
        const isValidChecksum = (digits: string): boolean => {
            if (digits.length === 9) {
                // Luhn-10 for 9-digit RNC
                const weights = [7, 9, 8, 6, 5, 4, 3, 2];
                let sum = 0;
                for (let i = 0; i < 8; i++) {
                    sum += parseInt(digits[i]) * weights[i];
                }
                const remainder = sum % 11;
                const check = remainder === 0 ? 2 : remainder === 1 ? 1 : 11 - remainder;
                return check === parseInt(digits[8]);
            }
            if (digits.length === 11) {
                // Mod-11 for 11-digit cédula
                const weights = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2];
                let sum = 0;
                for (let i = 0; i < 10; i++) {
                    let product = parseInt(digits[i]) * weights[i];
                    if (product >= 10) product = Math.floor(product / 10) + (product % 10);
                    sum += product;
                }
                const check = (10 - (sum % 10)) % 10;
                return check === parseInt(digits[10]);
            }
            return false;
        };

        if (cleanRNC.length !== 9 && cleanRNC.length !== 11) {
            return { success: false, message: 'RNC must be 9 or 11 digits' };
        }

        const checksumValid = isValidChecksum(cleanRNC);

        // Fallback cache of known merchants
        const knownMerchants: Record<string, { name: string; status: string; type: string; commercialName?: string; economicActivity?: string }> = {
            '101010621': { name: 'CENTRO CUESTA NACIONAL, SAS', commercialName: 'SUPERMERCADOS NACIONAL', status: 'ACTIVO', type: 'REGIMEN GENERAL', economicActivity: 'COMERCIO AL POR MENOR' },
            '130005372': { name: 'BRAVO S.A.', commercialName: 'BRAVO', status: 'ACTIVO', type: 'REGIMEN GENERAL', economicActivity: 'COMERCIO AL POR MENOR' },
            '101602465': { name: 'CARNICERIA Y EMBUTIDOS BRAVO (CENTRAL)', status: 'ACTIVO', type: 'REGIMEN GENERAL', economicActivity: 'COMERCIO AL POR MENOR' },
            '132868226': { name: 'TIENDAS DEL AHORRO SRL', commercialName: 'SUPERMERCADO OLE', status: 'ACTIVO', type: 'REGIMEN GENERAL', economicActivity: 'COMERCIO AL POR MENOR' },
            '130741214': { name: 'GRUPO RAMOS S.A.', commercialName: 'SIRENA / APREZIO', status: 'ACTIVO', type: 'REGIMEN GENERAL', economicActivity: 'COMERCIO AL POR MENOR' },
            '101168175': { name: 'PANELES DOMINICANOS (PISA)', status: 'ACTIVO', type: 'REGIMEN GENERAL', economicActivity: 'MANUFACTURA' },
            '101001574': { name: 'INDUBAN S.A.', commercialName: 'CAFE SANTO DOMINGO', status: 'ACTIVO', type: 'REGIMEN GENERAL', economicActivity: 'MANUFACTURA' },
            '101161324': { name: 'BANCO POPULAR DOMINICANO S.A.', commercialName: 'BANCO POPULAR', status: 'ACTIVO', type: 'REGIMEN GENERAL', economicActivity: 'INTERMEDIACION FINANCIERA' },
        };

        // Try live API with 3-second timeout
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);

            const response = await fetch(
                `https://rnc.megaplus.com.do/api/consulta?rnc=${cleanRNC}`,
                { signal: controller.signal }
            );
            clearTimeout(timeout);

            if (response.ok) {
                const apiData = await response.json();
                if (apiData && (apiData.nombre || apiData.name)) {
                    return {
                        success: true,
                        verified: true,
                        name: apiData.nombre || apiData.name || '',
                        commercialName: apiData.nombre_comercial || apiData.commercialName || '',
                        status: apiData.estado || apiData.status || 'ACTIVO',
                        type: apiData.regimen_pagos || apiData.type || 'REGIMEN GENERAL',
                        economicActivity: apiData.actividad_economica || apiData.economicActivity || '',
                        checksumValid,
                        source: 'megaplus_api',
                        consultationUrl: 'https://dgii.gov.do/app/WebApps/ConsultasWeb2/ConsultasWeb/consultas/rnc.aspx',
                    };
                }
            }
        } catch {
            // API unavailable — fall through to cache
        }

        // Fallback to local cache
        const cached = knownMerchants[cleanRNC];
        if (cached) {
            return {
                success: true,
                verified: true,
                ...cached,
                checksumValid,
                source: 'local_cache',
                consultationUrl: 'https://dgii.gov.do/app/WebApps/ConsultasWeb2/ConsultasWeb/consultas/rnc.aspx',
            };
        }

        // Unknown RNC but valid length — return with checksum info
        if (checksumValid) {
            return {
                success: true,
                verified: false,
                name: `TITULAR RNC ${cleanRNC}`,
                status: 'DESCONOCIDO',
                type: 'PENDIENTE VERIFICACION',
                checksumValid,
                source: 'checksum_only',
                consultationUrl: 'https://dgii.gov.do/app/WebApps/ConsultasWeb2/ConsultasWeb/consultas/rnc.aspx',
                message: 'RNC checksum valid but not found in API or cache. Manual verification recommended.',
            };
        }

        return { success: false, message: 'RNC not found and checksum invalid', checksumValid };
    } catch (error) {
        return { success: false, message: 'Verification service unavailable' };
    }
}

export async function getAlegraBills() {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');
        return await prisma.alegraBill.findMany({
            where: { userId: user.id },
            include: { file: true },
            orderBy: { createdAt: 'desc' }
        });
    } catch (error) {
        return [];
    }
}

export async function createAlegraBill(data: any) {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');
        const providerName = (data.providerName || data.verifiedName || data.businessName || data.vendor || '').toString().trim();
        if (!providerName) {
            return { success: false, message: 'Missing providerName for Alegra bill' };
        }
        const rawTotal = data.totalAmount ?? data.total ?? data.amount ?? data.grandTotal;
        const numericTotal = typeof rawTotal === 'string'
            ? Number(rawTotal.replace(/[^0-9.-]/g, ''))
            : Number(rawTotal);
        if (Number.isNaN(numericTotal)) {
            return { success: false, message: 'Missing or invalid totalAmount for Alegra bill' };
        }
        const itemsPayload = Array.isArray(data.items)
            ? JSON.stringify(data.items)
            : (typeof data.items === 'string' && data.items.trim() !== ''
                ? data.items
                : JSON.stringify([]));
        const dateValue = data.date || new Date().toISOString().slice(0, 10);
        const dueDateValue = data.dueDate || dateValue;

        const bill = await prisma.alegraBill.create({
            data: {
                date: dateValue,
                dueDate: dueDateValue,
                providerName,
                identification: data.identification,
                ncf: data.ncf,
                totalAmount: numericTotal,
                items: itemsPayload,
                status: 'draft',
                userId: user.id,
                fileId: data.fileId,
                // @ts-ignore
                ncfType: data.ncfType,
                isVerified: data.isVerified || false,
                verifiedName: data.verifiedName,
                observations: data.observations
            }
        });
        safeRevalidatePath('/');
        return { success: true, bill };
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error('createAlegraBill failed:', msg);
        return { success: false, message: msg };
    }
}

export async function deleteAlegraBill(id: string) {
    try {
        await prisma.alegraBill.delete({ where: { id } });
        safeRevalidatePath('/');
        return { success: true };
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error('deleteAlegraBill failed:', msg);
        return { success: false, message: msg };
    }
}

export async function recordAlegraPayment(data: any) {
    // In a real app, this would hit Alegra API
    // For now, we update the status of the draft bill
    try {
        await prisma.alegraBill.update({
            where: { id: data.billId },
            data: { status: 'exported' }
        });
        safeRevalidatePath('/');
        return { success: true };
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error('recordAlegraPayment failed:', msg);
        return { success: false, message: msg };
    }
}

export async function createFolder(data: {
    name?: string;
    parentId?: string;
    autoName?: boolean;
    prefix?: string;
    onExistingFolder?: 'reuse' | 'ask' | 'create_unique';
}) {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        let folderName = data.name;
        if (data.autoName || folderName === 'auto') {
            const prefix = data.prefix || 'Folder';
            folderName = `${prefix}-${Date.now()}`;
        }

        if (!folderName) {
            return { success: false, message: 'Folder name is required' };
        }

        const parentId = data.parentId || null;
        const onExisting = data.onExistingFolder || 'reuse';

        const existingFolder = await prisma.workspaceFile.findFirst({
            where: {
                userId: user.id,
                parentId,
                type: 'folder',
                name: folderName
            }
        });

        if (existingFolder) {
            if (onExisting === 'ask') {
                return {
                    success: true,
                    needsConfirmation: true,
                    message: `Folder "${folderName}" already exists. Confirm whether to use it or create a new one.`,
                    folder: existingFolder
                };
            }

            if (onExisting === 'reuse') {
                safeRevalidatePath('/');
                return { success: true, folder: existingFolder, reused: true };
            }

            if (onExisting === 'create_unique') {
                const now = new Date();
                const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
                const uniqueName = `${folderName}-${timestamp}`;
                const folder = await prisma.workspaceFile.create({
                    data: {
                        name: uniqueName,
                        type: 'folder',
                        userId: user.id,
                        parentId
                    }
                });
                safeRevalidatePath('/');
                return { success: true, folder, createdFromExisting: true };
            }
        }

        const folder = await prisma.workspaceFile.create({
            data: {
                name: folderName,
                type: 'folder',
                userId: user.id,
                parentId
            }
        });

        safeRevalidatePath('/');
        return {
            success: true,
            folder,
            message: `Folder "${folder.name}" created (ID: ${folder.id}). IMPORTANT: Use this ID now to create files inside it.`
        };
    } catch (error) {
        console.error('Failed to create folder:', error);
        return { success: false, message: 'Failed to create folder' };
    }
}

/**
 * Ensure a nested folder path exists, creating any missing levels.
 * e.g. ["Receipts", "2025", "06 - June"] → creates Receipts > 2025 > 06 - June
 * Returns the leaf folder ID.
 */
export async function ensureNestedFolderPath(pathSegments: string[]): Promise<{ success: boolean; folderId?: string; folderName?: string; message?: string }> {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');
        if (!pathSegments.length) return { success: false, message: 'Empty path' };

        let currentParentId: string | null = null;

        for (const segment of pathSegments) {
            if (!segment) continue;

            const existing = await prisma.workspaceFile.findFirst({
                where: {
                    userId: user.id,
                    parentId: currentParentId,
                    type: 'folder',
                    name: segment
                }
            });

            if (existing) {
                currentParentId = existing.id;
            } else {
                const created = await prisma.workspaceFile.create({
                    data: {
                        name: segment,
                        type: 'folder',
                        userId: user.id,
                        parentId: currentParentId
                    }
                });
                currentParentId = created.id;
            }
        }

        safeRevalidatePath('/');
        return { success: true, folderId: currentParentId!, folderName: pathSegments[pathSegments.length - 1] };
    } catch (error) {
        console.error('ensureNestedFolderPath failed:', error);
        return { success: false, message: 'Failed to create nested folder path' };
    }
}

/**
 * Create a markdown file with optional folder creation
 */
export async function createMarkdownFile(data: {
    content: string;
    filename: string;
    folderName?: string;
    parentId?: string;
    folderId?: string; // Add support for folderId
}) {
    try {
        console.log('📄 createMarkdownFile called with:', JSON.stringify({ filename: data.filename, folderId: data.folderId, folderName: data.folderName }));
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        if (!data.content || data.content.trim() === '') {
            return { success: false, message: 'Missing content for markdown file' };
        }

        let targetParentId = data.parentId || data.folderId; // Use folderId if parentId is missing
        let createdFolderId: string | undefined;

        // If we have a targetParentId, verify it exists
        if (targetParentId) {
            const existingFolder = await prisma.workspaceFile.findFirst({
                where: { id: targetParentId, type: 'folder', userId: user.id }
            });
            if (existingFolder) {
                targetParentId = existingFolder.id;
            } else {
                // If ID provided but not found, fall back to folderName or root
                console.warn(`Folder with ID ${targetParentId} not found, falling back.`);
                targetParentId = undefined;
            }
        }

        if (!targetParentId && data.folderName) {
            // Use existing folder logic instead of blind creation
            const folderRes = await createFolder({
                name: data.folderName,
                parentId: data.parentId,
                onExistingFolder: 'reuse'
            });

            if (folderRes.success && folderRes.folder) {
                targetParentId = folderRes.folder.id;
                createdFolderId = folderRes.folder.id;
            } else {
                // Fallback to manual creation if needed, but try to be safe
                const folder = await prisma.workspaceFile.create({
                    data: {
                        name: data.folderName,
                        type: 'folder',
                        userId: user.id,
                        parentId: data.parentId || null
                    }
                });
                targetParentId = folder.id;
                createdFolderId = folder.id;
            }
        }

        // Handle paths in filename (e.g., "app/Dialer.tsx" or "src\components\Button.tsx")
        let finalFilename = data.filename;
        let pathParts: string[] = [];

        // Normalize path separators and split
        if (data.filename.includes('/') || data.filename.includes('\\')) {
            pathParts = data.filename.replace(/\\/g, '/').split('/');
            finalFilename = pathParts.pop() || data.filename;

            // Create folder structure if path is provided
            if (pathParts.length > 0 && !targetParentId) {
                let currentParentId = data.parentId || null;

                for (const folderName of pathParts) {
                    if (!folderName) continue;

                    // Check if folder exists
                    const existing = await prisma.workspaceFile.findFirst({
                        where: {
                            name: folderName,
                            type: 'folder',
                            userId: user.id,
                            parentId: currentParentId
                        }
                    });

                    if (existing) {
                        currentParentId = existing.id;
                    } else {
                        // Create the folder
                        const newFolder = await prisma.workspaceFile.create({
                            data: {
                                name: folderName,
                                type: 'folder',
                                userId: user.id,
                                parentId: currentParentId
                            }
                        });
                        currentParentId = newFolder.id;
                    }
                }

                targetParentId = currentParentId ?? undefined;
            }
        }

        const nameParts = finalFilename.split('.');
        const ext = nameParts.length > 1 ? nameParts.pop()?.toLowerCase() || 'md' : 'md';
        const hasExt = nameParts.length > 0;
        const displayName = hasExt ? finalFilename : `${finalFilename}.${ext}`;

        // Use unique ID to prevent collisions (e.g. app.json in different folders)
        const uniqueId = Math.random().toString(36).substring(2, 15);
        const diskFileName = `${uniqueId}_${displayName}`;

        const filePath = join(process.cwd(), 'public', 'uploads', diskFileName);
        await writeFile(filePath, data.content);

        const file = await prisma.workspaceFile.create({
            data: {
                name: displayName,
                type: ext, // Store actual extension as type
                size: `${Buffer.byteLength(data.content)} bytes`,
                userId: user.id,
                parentId: targetParentId || null,
                storagePath: diskFileName
            }
        });

        safeRevalidatePath('/');
        return { success: true, file, createdFolder: !!data.folderName, folderId: createdFolderId };
    } catch (error) {
        console.error(error);
        return { success: false, message: 'Failed to create markdown file' };
    }
}

export async function createHtmlFile(data: {
    content: string;
    filename: string;
    folderId?: string;
    folderName?: string;
}) {
    try {
        console.log('📄 createHtmlFile called with:', JSON.stringify(data));
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        let resolvedFolderId = data.folderId;

        if (resolvedFolderId) {
            const folder = await prisma.workspaceFile.findFirst({
                where: {
                    userId: user.id,
                    OR: [
                        { id: resolvedFolderId },
                        { name: resolvedFolderId }
                    ],
                    type: 'folder'
                }
            });

            if (folder) {
                resolvedFolderId = folder.id;
            } else if (data.folderName) {
                const folderRes = await createFolder({
                    name: data.folderName,
                    onExistingFolder: 'reuse'
                });
                if (!folderRes.success || !folderRes.folder) {
                    return { success: false, message: 'Parent folder not found. Please create the folder first.' };
                }
                resolvedFolderId = folderRes.folder.id;
            } else {
                return { success: false, message: 'Parent folder not found. Please create the folder first.' };
            }
        } else if (data.folderName) {
            const folderRes = await createFolder({
                name: data.folderName,
                onExistingFolder: 'reuse'
            });
            if (!folderRes.success || !folderRes.folder) {
                return { success: false, message: 'Failed to create or reuse the target folder.' };
            }
            resolvedFolderId = folderRes.folder.id;
        }

        // Create a dedicated directory for the app/folder to ensure isolation
        // If no folderId, use '_root_' as a namespace
        const directoryName = resolvedFolderId ? resolvedFolderId : '_root_';
        const uploadsDir = join(process.cwd(), 'public', 'uploads', directoryName);

        // Ensure directory exists
        await mkdir(uploadsDir, { recursive: true });

        const displayName = data.filename.endsWith('.html') ? data.filename : `${data.filename}.html`;

        // We can just use the filename directly now because of folder isolation
        // But to be extra safe against overwriting same-name files within the same folder (if users want versions),
        // we could keep a prefix. However, for "web app" behavior, overwriting index.html IS usually desired.
        // Let's stick to simple filenames for clean URLs unless strictly necessary.
        // Actually, let's keep it simple: strict isolation means folder is the boundary.
        const diskFileName = displayName;

        const filePath = join(uploadsDir, diskFileName);
        await writeFile(filePath, data.content);

        // storagePath needs to be the relative path from 'uploads/' so the frontend can construct the URL
        // e.g., 'folderId/index.html'
        const relativeStoragePath = `${directoryName}/${diskFileName}`;


        const cssLinkMatch = data.content.match(/<link[^>]+href=["']([^"']+\.css)["'][^>]*>/i);
        if (cssLinkMatch) {
            const cssHref = cssLinkMatch[1];
            if (!/^(https?:)?\/\//i.test(cssHref)) {
                const cssFileName = cssHref.split('/').pop();
                if (cssFileName) {
                    const cssPath = join(uploadsDir, cssFileName);
                    try {
                        await stat(cssPath);
                    } catch {
                        const cssContent = `:root {\n  color-scheme: light;\n}\n\nbody {\n  margin: 0;\n  font-family: Arial, sans-serif;\n  color: #111;\n  background: #ffffff;\n}\n`;
                        await writeFile(cssPath, cssContent);

                        const cssStoragePath = `${directoryName}/${cssFileName}`;
                        const existingCss = await prisma.workspaceFile.findFirst({
                            where: {
                                userId: user.id,
                                name: cssFileName,
                                parentId: resolvedFolderId || null,
                                type: 'css'
                            }
                        });

                        if (existingCss) {
                            await prisma.workspaceFile.update({
                                where: { id: existingCss.id },
                                data: {
                                    size: `${Buffer.byteLength(cssContent)} bytes`,
                                    storagePath: cssStoragePath,
                                    updatedAt: new Date()
                                }
                            });
                        } else {
                            await prisma.workspaceFile.create({
                                data: {
                                    name: cssFileName,
                                    type: 'css',
                                    size: `${Buffer.byteLength(cssContent)} bytes`,
                                    userId: user.id,
                                    parentId: resolvedFolderId || null,
                                    storagePath: cssStoragePath
                                }
                            });
                        }
                    }
                }
            }
        }

        const existingFile = await prisma.workspaceFile.findFirst({
            where: {
                userId: user.id,
                name: displayName,
                parentId: resolvedFolderId || null,
                type: 'html'
            }
        });

        const file = existingFile
            ? await prisma.workspaceFile.update({
                where: { id: existingFile.id },
                data: {
                    size: `${Buffer.byteLength(data.content)} bytes`,
                    storagePath: relativeStoragePath,
                    updatedAt: new Date()
                }
            })
            : await prisma.workspaceFile.create({
                data: {
                    name: displayName, // "index.html"
                    type: 'html',
                    size: `${Buffer.byteLength(data.content)} bytes`,
                    userId: user.id,
                    parentId: resolvedFolderId || null,
                    storagePath: relativeStoragePath
                }
            });

        safeRevalidatePath('/');
        return { success: true, file };
    } catch (error) {
        console.error(error);
        return { success: false, message: 'Failed to create HTML file' };
    }
}


/**
 * Move multiple files to a target folder
 */
const splitName = (fileName: string) => {
    const lastDot = fileName.lastIndexOf('.');
    if (lastDot <= 0) return { base: fileName, ext: '' };
    return { base: fileName.slice(0, lastDot), ext: fileName.slice(lastDot) };
};

const makeTimestampedName = (fileName: string) => {
    const { base, ext } = splitName(fileName);
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    return `${base}-${stamp}${ext}`;
};

export async function moveFilesToFolder(
    fileIds: string[],
    targetFolderId: string,
    nameConflictStrategy?: 'timestamp'
) {
    const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
    if (!user) return { success: false, message: 'User not found' };

    console.log(`🚚 moveFilesToFolder: Moving ${fileIds.length} files to ${targetFolderId}`);

    try {
        if (!fileIds || fileIds.length === 0) {
            return { success: true, moved: 0, movedFileIds: [], message: 'No files to move' };
        }

        // Clean white-space from IDs 
        const cleanFileIds = fileIds.map(id => id.trim()).filter(Boolean);

        let targetFolder = await prisma.workspaceFile.findUnique({
            where: { id: targetFolderId, userId: user.id }
        });

        // If not found by ID, try finding by Name in the root
        if (!targetFolder || targetFolder.type !== 'folder') {
            targetFolder = await prisma.workspaceFile.findFirst({
                where: { name: targetFolderId, type: 'folder', userId: user.id }
            });
        }

        if (!targetFolder || targetFolder.type !== 'folder') {
            return { success: false, moved: 0, message: 'Target folder not found' };
        }

        const files = await prisma.workspaceFile.findMany({
            where: { id: { in: cleanFileIds }, userId: user.id }
        });

        if (files.length === 0) {
            return { success: false, moved: 0, message: 'No source files found' };
        }

        const existingNames = new Set<string>();
        if (nameConflictStrategy === 'timestamp') {
            const existing = await prisma.workspaceFile.findMany({
                where: { parentId: targetFolderId, userId: user.id },
                select: { name: true }
            });
            existing.forEach(item => existingNames.add(item.name));
        }

        // Use individual updates to handle physical file moves if renamed
        const results = await Promise.all(
            files.map(async file => {
                let nextName = file.name;
                if (nameConflictStrategy === 'timestamp' && existingNames.has(nextName)) {
                    nextName = makeTimestampedName(nextName);
                }
                existingNames.add(nextName);

                // Rename on disk if name changed and not a folder
                if (nextName !== file.name && file.type !== 'folder') {
                    const oldPath = join(process.cwd(), 'public', 'uploads', file.name);
                    const newPath = join(process.cwd(), 'public', 'uploads', nextName);
                    try {
                        await rename(oldPath, newPath);
                    } catch (e) {
                        console.error(`Failed to rename file on disk: ${file.name} -> ${nextName}`, e);
                    }
                }

                return prisma.workspaceFile.update({
                    where: { id: file.id },
                    data: {
                        parentId: targetFolderId,
                        name: nextName,
                        updatedAt: new Date()
                    }
                });
            })
        );

        console.log(`✅ Successfully moved ${results.length} files to folder "${targetFolder.name}"`);

        safeRevalidatePath('/');
        safeRevalidatePath('/', 'layout');
        safeRevalidatePath('/', 'page');

        return {
            success: true,
            moved: results.length,
            movedFileIds: results.map(r => r.id),
            message: `Moved ${results.length} item(s) to "${targetFolder.name}"`
        };
    } catch (error) {
        console.error('💥 Move failed:', error);
        return { success: false, moved: 0, message: 'Internal move error' };
    }
}

export async function highlightWorkspaceFile(data: {
    fileId: string;
    backgroundColor?: string;
    textColor?: string;
    borderColor?: string;
    fontWeight?: string;
}) {
    try {
        if (!data.fileId) return { success: false, message: 'Missing fileId for highlight' };

        const updated = await prisma.workspaceFile.update({
            where: { id: data.fileId },
            data: {
                highlightBgColor: data.backgroundColor || null,
                highlightTextColor: data.textColor || null,
                highlightBorderColor: data.borderColor || null,
                highlightFontWeight: data.fontWeight || null
            }
        });

        safeRevalidatePath('/');
        return { success: true, file: updated };
    } catch (error) {
        console.error('Failed to highlight file:', error);
        return { success: false, message: 'Failed to highlight file' };
    }
}

export async function removeWorkspaceHighlights(fileIds: string[]) {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) return { success: false, message: 'User not found' };

        if (!fileIds.length) {
            // Remove from all user files if none provided (clear all)
            await prisma.workspaceFile.updateMany({
                where: { userId: user.id },
                data: {
                    highlightBgColor: null,
                    highlightTextColor: null,
                    highlightBorderColor: null,
                    highlightFontWeight: null
                }
            });
            safeRevalidatePath('/');
            return { success: true, message: 'Cleared all workspace highlights' };
        }

        await prisma.workspaceFile.updateMany({
            where: { id: { in: fileIds }, userId: user.id },
            data: {
                highlightBgColor: null,
                highlightTextColor: null,
                highlightBorderColor: null,
                highlightFontWeight: null
            }
        });

        safeRevalidatePath('/');
        return { success: true, message: `Cleared highlights for ${fileIds.length} file(s)` };
    } catch (error) {
        return { success: false, message: 'Failed to remove highlights' };
    }
}

export async function deleteRootMarkdownFiles(data: { dryRun?: boolean } = {}) {
    try {
        const rootPath = process.cwd();
        const entries = await readdir(rootPath, { withFileTypes: true });
        const markdownFiles = entries
            .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
            .map(entry => entry.name);

        if (data.dryRun) {
            return { success: true, deleted: 0, files: markdownFiles, dryRun: true };
        }

        await Promise.all(
            markdownFiles.map(async fileName => {
                const filePath = join(rootPath, fileName);
                await unlink(filePath);
            })
        );

        return { success: true, deleted: markdownFiles.length, files: markdownFiles, dryRun: false };
    } catch (error) {
        console.error('Failed to delete root markdown files:', error);
        return { success: false, message: 'Failed to delete root markdown files' };
    }
}

export async function batchRenameFiles(data: {
    fileIds: string[];
    prefix?: string;
    suffix?: string;
    find?: string;
    replace?: string;
}) {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) return { success: false, message: 'User not found' };

        const files = await prisma.workspaceFile.findMany({
            where: { id: { in: data.fileIds }, userId: user.id }
        });

        const updates = files.map(async file => {
            let newName = file.name;
            const { base, ext } = splitName(file.name);

            if (data.find && data.replace !== undefined) {
                // Perform find and replace on the base name
                const replacedBase = base.split(data.find).join(data.replace);
                newName = replacedBase + (ext || '');
            }

            if (data.prefix) {
                newName = data.prefix + newName;
            }

            if (data.suffix) {
                const { base: b2, ext: e2 } = splitName(newName);
                newName = b2 + data.suffix + (e2 || '');
            }

            // Rename on disk if name changed and not a folder
            if (newName !== file.name && file.type !== 'folder') {
                const oldPath = join(process.cwd(), 'public', 'uploads', file.name);
                const newPath = join(process.cwd(), 'public', 'uploads', newName);
                try {
                    await rename(oldPath, newPath);
                } catch (e) {
                    console.error(`Failed to rename file on disk during batch: ${file.name} -> ${newName}`, e);
                }
            }

            return prisma.workspaceFile.update({
                where: { id: file.id },
                data: { name: newName, updatedAt: new Date() }
            });
        });

        const results = await Promise.all(updates);
        safeRevalidatePath('/');
        return { success: true, renamed: results.length, message: `Successfully renamed ${results.length} files` };
    } catch (error) {
        console.error('Batch rename failed:', error);
        return { success: false, message: 'Batch rename failed' };
    }
}

/**
 * Search the web or images (Mocked for Prototype)
 */
export async function searchWeb(args: { query: string; type?: 'web' | 'image' }) {
    console.log('🔍 Searching Web:', args);
    const { query, type = 'web' } = args;

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (type === 'image') {
        // Return 4 distinct image placeholders from LoremFlickr
        // Use random lock to ensure they are different
        const keywords = query.split(' ').join(',');
        return {
            success: true,
            type: 'image',
            query,
            results: [
                { url: `https://loremflickr.com/800/600/${encodeURIComponent(keywords)}?lock=1`, alt: `Image 1 for ${query}` },
                { url: `https://loremflickr.com/800/600/${encodeURIComponent(keywords)}?lock=2`, alt: `Image 2 for ${query}` },
                { url: `https://loremflickr.com/800/600/${encodeURIComponent(keywords)}?lock=3`, alt: `Image 3 for ${query}` },
                { url: `https://loremflickr.com/800/600/${encodeURIComponent(keywords)}?lock=4`, alt: `Image 4 for ${query}` }
            ]
        };
    }

    // Web Search Mock
    return {
        success: true,
        type: 'web',
        query,
        results: [
            {
                title: `${query} - Official Site`,
                url: `https://example.com/search?q=${encodeURIComponent(query)}`,
                snippet: `Comprehensive information about ${query}. This is a simulated search result for demonstration purposes.`
            },
            {
                title: `Wikipedia: ${query}`,
                url: `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`,
                snippet: `${query} is a topic of interest. Read more about its history, definitions, and modern applications.`
            },
            {
                title: `Latest News on ${query}`,
                url: `https://news.example.com/${encodeURIComponent(query)}`,
                snippet: `Breaking news and updates regarding ${query}. Stay informed with the latest developments.`
            }
        ]
    };
}

/**
 * Copy multiple files to a target folder (preserves originals)
 */
export async function copyFilesToFolder(
    fileIds: string[],
    targetFolderId: string,
    nameConflictStrategy?: 'timestamp'
) {
    try {
        if (!fileIds.length) {
            return { success: true, copied: 0, copiedFileIds: [], message: 'No files to copy' };
        }

        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        const existingNames = new Set<string>();
        if (nameConflictStrategy === 'timestamp') {
            const existing = await prisma.workspaceFile.findMany({
                where: { parentId: targetFolderId },
                select: { name: true }
            });
            existing.forEach(item => existingNames.add(item.name));
        }

        const copies = await Promise.all(
            fileIds.map(async (id) => {
                const original = await prisma.workspaceFile.findUnique({ where: { id } });
                if (!original || original.type === 'folder') return null;

                const { base, ext } = splitName(original.name);
                let newName = ext ? `${base} (copy)${ext}` : `${base} (copy)`;
                if (nameConflictStrategy === 'timestamp' && existingNames.has(newName)) {
                    newName = makeTimestampedName(original.name);
                }
                existingNames.add(newName);

                // Copy on disk if not a folder
                if (original.type !== 'folder') {
                    const oldPath = join(process.cwd(), 'public', 'uploads', original.name);
                    const newPath = join(process.cwd(), 'public', 'uploads', newName);
                    try {
                        await copyFile(oldPath, newPath);
                    } catch (e) {
                        console.error(`Failed to copy file on disk: ${original.name} -> ${newName}`, e);
                    }
                }

                return await prisma.workspaceFile.create({
                    data: {
                        name: newName,
                        type: original.type,
                        size: original.size,
                        userId: user.id,
                        parentId: targetFolderId
                    }
                }).catch(() => null);
            })
        );

        const copiedFiles = copies.filter(c => c !== null);
        const copiedCount = copiedFiles.length;
        const copiedFileIds = copiedFiles.map(f => f!.id);

        safeRevalidatePath('/');
        return { success: true, copied: copiedCount, copiedFileIds, message: `Copied ${copiedCount} file(s) to target folder` };
    } catch (error) {
        console.error('Failed to copy files:', error);
        return { success: false, copied: 0, copiedFileIds: [], message: 'Failed to copy files' };
    }
}

export async function editFile(data: { fileId: string; content: string }) {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        const { fileId, content } = data;

        // Try to find by ID first, then by Name
        let file = await prisma.workspaceFile.findFirst({
            where: {
                userId: user.id,
                OR: [
                    { id: fileId },
                    { name: fileId }
                ]
            }
        });

        if (!file) {
            return { success: false, message: `File not found with ID or Name: ${fileId}` };
        }

        // Security check: Don't edit folders
        if (file.type === 'folder') {
            return { success: false, message: 'Cannot edit a folder content directly.' };
        }

        // Create a dedicated directory for the app/folder to ensure isolation
        const directoryName = file.parentId ? file.parentId : '_root_';
        const uploadsDir = join(process.cwd(), 'public', 'uploads', directoryName);
        await mkdir(uploadsDir, { recursive: true });

        const filePath = join(uploadsDir, file.name);
        await writeFile(filePath, content);

        // Update size and ensure storagePath is correct (legacy fix)
        const relativeStoragePath = `${directoryName}/${file.name}`;
        await prisma.workspaceFile.update({
            where: { id: file.id },
            data: {
                size: `${Buffer.byteLength(content)} bytes`,
                storagePath: relativeStoragePath
            }
        });

        safeRevalidatePath('/');
        return { success: true, file, message: `File ${file.name} updated successfully.` };

    } catch (error) {
        console.error('Failed to edit file:', error);
        return { success: false, message: 'Failed to edit file' };
    }
}

export async function readFile(data: { fileIds: string[] }) {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        const results = await Promise.all(data.fileIds.map(async (idOrName) => {
            const fileById = await prisma.workspaceFile.findFirst({
                where: { userId: user.id, id: idOrName }
            });

            const file = fileById || await prisma.workspaceFile.findFirst({
                where: { userId: user.id, name: idOrName }
            });

            if (!file || file.type === 'folder') return { id: idOrName, error: 'File not found or is a folder' };

            const filePath = getWorkspaceFilePath(file);
            const content = await readFileFS(filePath, 'utf8');
            return { id: file.id, name: file.name, storagePath: file.storagePath || null, content };
        }));

        return { success: true, files: results };
    } catch (error) {
        console.error('Failed to read files:', error);
        return { success: false, message: 'Failed to read files' };
    }
}

export async function searchFiles(data: { query: string, searchContent?: boolean }) {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        const { query, searchContent = true } = data;

        // Simple search logic
        const files = await prisma.workspaceFile.findMany({
            where: {
                userId: user.id,
                OR: [
                    { id: query },
                    { name: { contains: query, mode: 'insensitive' } },
                    // In a real app, content search would use a search index or grep
                ]
            }
        });

        return {
            success: true,
            files: files.map(f => ({
                id: f.id,
                name: f.name,
                type: f.type,
                parentId: f.parentId,
                storagePath: f.storagePath || null
            }))
        };
    } catch (error) {
        console.error('Failed to search files:', error);
        return { success: false, message: 'Failed to search files' };
    }
}

export async function askQuestions(data: { questions: string[] }) {
    // This tool primarily signals the UI/Model to wait for user interaction
    console.log('❓ Agent asking questions:', data.questions);
    return {
        success: true,
        message: 'Questions sent to user. Please wait for coordinates.',
        isAwaitingInput: true,
        questions: data.questions
    };
}

export async function agentDelegate(data: { agentType: string, task: string }) {
    console.log(`🤖 Delegating to ${data.agentType}: ${data.task}`);

    const demoUser = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
    const agentKey = data.agentType.toLowerCase();

    if (agentKey === 'designer' || agentKey === 'design') {
        const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
        if (!apiKey) return { success: false, message: 'API Key missing for delegation' };

        if (demoUser) {
            await logAgentActivity({
                type: 'delegation',
                title: 'Design Specialist Activated',
                message: `Task: ${data.task}`,
                toolUsed: 'agent_delegate',
                userId: demoUser.id,
                sessionId: (data as any).sessionId
            });
        }

        const { DesignAgent } = await import('@/lib/agents/DesignAgent');
        const designer = new DesignAgent(apiKey);
        const result = await designer.generateDesignSpec(data.task, searchWeb);

        if (demoUser) {
            await logAgentActivity({
                type: 'specialist_result',
                title: 'Design Expert Analysis Complete',
                message: 'Specialist has returned design advice and code snippets.',
                userId: demoUser.id,
                sessionId: (data as any).sessionId
            });
        }

        // Memory
        try {
            await memory.addJobSummary(`magic_design_${Date.now()}`, `Generated Design Spec for: "${data.task}"`);
        } catch (e) { console.error('Memory failed', e); }

        return {
            success: true,
            message: "Design Expert has provided their analysis.",
            analysis: result
        };
    }

    if (agentKey === 'review' || agentKey === 'reviewer') {
        if (demoUser) {
            await logAgentActivity({
                type: 'delegation',
                title: 'Review Agent Activated',
                message: `Task: ${data.task}`,
                toolUsed: 'agent_delegate',
                userId: demoUser.id,
                sessionId: (data as any).sessionId
            });
        }

        const prompt = `You are a strict Review Agent. Review the following plan or intended tool use.\n\nReturn:\n- Verdict: approve | revise | reject\n- Risks\n- Missing steps\n- Suggested changes\n\nCONTENT:\n${data.task}`;
        const review = await generateAIText(prompt, { purpose: 'smart' });

        if (demoUser) {
            await logAgentActivity({
                type: 'specialist_result',
                title: 'Review Agent Completed',
                message: 'Review delivered for approval.',
                userId: demoUser.id,
                sessionId: (data as any).sessionId
            });
        }

        return {
            success: true,
            message: 'Review Agent has provided feedback.',
            analysis: review
        };
    }

    return {
        success: true,
        message: `Task delegated to ${data.agentType}. Analysis in progress.`,
        status: 'delegated'
    };
}



export async function extractReceiptInfo(data: { fileIds: string[] }) {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        if (!data.fileIds || data.fileIds.length === 0) {
            return { success: false, message: 'No file IDs provided', extractions: [] };
        }

        const detectMimeType = (fileName: string): string => {
            const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
            const mimeMap: Record<string, string> = {
                jpg: 'image/jpeg', jpeg: 'image/jpeg',
                png: 'image/png', webp: 'image/webp',
                pdf: 'application/pdf',
            };
            return mimeMap[ext] || 'image/jpeg';
        };

        const prompt = `You are an expert Dominican Republic fiscal document analyst.
Analyze this receipt/invoice image and extract ALL data with high precision.

DOCUMENT TYPE IDENTIFICATION:
- B01 = Factura de Crédito Fiscal
- B02 = Factura de Consumo
- B03 = Nota de Débito
- B04 = Nota de Crédito
- B11 = Comprobante de Compras (Proveedor Informal)
- B13 = Gastos Menores
- B14 = Régimen Especial de Tributación
- B15 = Comprobante Gubernamental
- B16 = Exportaciones
- B17 = Compras Extraordinarias
- E31/E32/E33/E34 = Electronic (e-CF) equivalents
Identify by the NCF prefix.

RNC EXTRACTION:
- Format: XXX-XXXXXX-X (with dashes) or 9 consecutive digits, or 11 digits for cédulas
- Usually labeled "RNC:" or "R.N.C." on the document

NCF EXTRACTION:
- Valid prefixes: B01, B02, B03, B04, B11, B13, B14, B15, B16, B17, E31, E32, E33, E34, E41, E43, E44, E45, E46, E47
- Format: prefix + sequential number (11 chars for B-series, 13 chars for E-series)

ITBIS (Tax):
- Standard rate is 18%
- Some items may be exempt (basic goods)
- Extract both total ITBIS and note which items had ITBIS applied

ADDITIONAL FIELDS:
- Payment method (Efectivo/Cash, Tarjeta/Card, Transferencia, etc.)
- Currency (DOP or USD)
- All line items with description, quantity, unit price, and line total

Handle both Spanish and English text. If a field is not visible, use empty string for text or 0 for numbers.
Assign a confidence score (0.0 to 1.0) for the overall extraction quality.`;

        const responseSchema = {
            type: SchemaType.OBJECT,
            properties: {
                documentType: { type: SchemaType.STRING, description: 'Type of fiscal document (e.g. Factura de Consumo B02)' },
                provider: { type: SchemaType.STRING, description: 'Merchant/business name' },
                rnc: { type: SchemaType.STRING, description: 'RNC number' },
                ncf: { type: SchemaType.STRING, description: 'NCF (Número de Comprobante Fiscal)' },
                date: { type: SchemaType.STRING, description: 'Transaction date' },
                currency: { type: SchemaType.STRING, description: 'Currency code (DOP or USD)' },
                subtotal: { type: SchemaType.NUMBER, description: 'Subtotal before tax' },
                itbisAmount: { type: SchemaType.NUMBER, description: 'ITBIS tax amount' },
                total: { type: SchemaType.NUMBER, description: 'Total amount' },
                paymentMethod: { type: SchemaType.STRING, description: 'Payment method' },
                items: {
                    type: SchemaType.ARRAY,
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            description: { type: SchemaType.STRING },
                            quantity: { type: SchemaType.NUMBER },
                            unitPrice: { type: SchemaType.NUMBER },
                            total: { type: SchemaType.NUMBER },
                            itbisApplied: { type: SchemaType.BOOLEAN },
                        },
                        required: ['description', 'quantity', 'unitPrice', 'total', 'itbisApplied'],
                    },
                },
                confidence: { type: SchemaType.NUMBER, description: 'Overall extraction confidence 0.0-1.0' },
            },
            required: ['documentType', 'provider', 'rnc', 'ncf', 'date', 'currency', 'subtotal', 'itbisAmount', 'total', 'paymentMethod', 'items', 'confidence'],
        };

        const extractions: Array<{ fileId: string; fileName: string; data: any }> = [];

        for (const fileId of data.fileIds) {
            try {
                const file = await prisma.workspaceFile.findUnique({ where: { id: fileId } });
                if (!file) {
                    extractions.push({ fileId, fileName: 'unknown', data: null });
                    continue;
                }

                const filePath = getWorkspaceFilePath(file);
                const imageBuffer = await readFileFS(filePath);
                const base64Image = imageBuffer.toString('base64');
                const mimeType = detectMimeType(file.name);

                const text = await generateAIContent([
                    prompt,
                    { inlineData: { data: base64Image, mimeType } }
                ], {
                    purpose: 'vision',
                    generationConfig: {
                        responseMimeType: 'application/json',
                        responseSchema,
                        temperature: 0.1,
                    },
                });

                const extractedData = JSON.parse(text);
                extractions.push({ fileId, fileName: file.name, data: extractedData });
            } catch (fileError) {
                console.error(`👁️ Vision extraction failed for file ${fileId}:`, fileError);
                extractions.push({ fileId, fileName: 'unknown', data: null });
            }
        }

        return {
            success: true,
            extractions,
            extractedData: extractions[0]?.data,   // backward compat
            fileId: extractions[0]?.fileId,         // backward compat
        };
    } catch (error) {
        console.error('👁️ Vision extraction failed:', error);
        return { success: false, message: 'Failed to extract data from image', extractions: [] };
    }
}

export async function generateMarkdownReport(data: { data: any, title?: string, includeBusinessInfo?: boolean }) {
    // Robustly extract the data object. Supports nested 'data', 'extractedData', or direct properties.
    const raw = data.data || (data as any).extractedData || ((data as any).provider ? data : undefined);
    const { title = 'Financial Report', includeBusinessInfo = true } = data;

    if (!raw) {
        console.error('❌ generateMarkdownReport: No data provided', data);
        return { success: false, message: 'Missing data for report' };
    }

    let markdown = `# ${title}\n\n`;

    if (includeBusinessInfo && (raw as any).provider) {
        markdown += `## Business Information\n`;
        markdown += `- **Vendor:** ${(raw as any).provider}\n`;
        markdown += `- **RNC:** ${(raw as any).rnc || 'N/A'}\n`;
        markdown += `- **Verified:** ✅\n\n`;
    }

    markdown += `## Itemized Breakdown\n\n`;
    markdown += `| Description | Qty | Price | Total |\n`;
    markdown += `| :--- | :--- | :--- | :--- |\n`;

    const items = Array.isArray((raw as any).items) ? (raw as any).items : [];
    items.forEach((item: any) => {
        const itemTotal = (item.quantity || 1) * (item.price || 0);
        markdown += `| ${item.description || 'Item'} | ${item.quantity || 1} | RD$ ${item.price?.toLocaleString() || 0} | RD$ ${itemTotal.toLocaleString()} |\n`;
    });

    if ((raw as any).total) {
        markdown += `\n**Grand Total: RD$ ${(raw as any).total.toLocaleString()}**\n`;
    }

    return { success: true, markdown };
}

export async function focusWorkspaceItem(itemId: string) {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        const item = await prisma.workspaceFile.findFirst({
            where: { userId: user.id, OR: [{ id: itemId }, { name: itemId }] }
        });

        if (!item) return { success: false, message: 'Item not found' };

        return { success: true, itemId: item.id, parentId: item.parentId, message: `Focusing on ${item.name}` };
    } catch (error) {
        return { success: false, message: 'Focus failed' };
    }
}

export async function summarizeFile(data: { fileId: string; detailLevel?: 'brief' | 'detailed' }) {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        const file = await prisma.workspaceFile.findFirst({
            where: { userId: user.id, OR: [{ id: data.fileId }, { name: data.fileId }] }
        });

        if (!file || file.type === 'folder') return { success: false, message: 'File not found' };

        const filePath = join(process.cwd(), 'public', 'uploads', file.name);
        const content = await readFileFS(filePath, 'utf8');

        const prompt = `Please provide a ${data.detailLevel || 'brief'} summary of the following file content:\n\n${content}`;
        const summary = await generateAIText(prompt, { purpose: 'fast' });

        return { success: true, summary, fileName: file.name };
    } catch (error) {
        return { success: false, message: 'Summary failed' };
    }
}

export async function configureMagicFolder(data: { folderId: string, rule: string }) {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        const folder = await prisma.workspaceFile.findFirst({
            where: { userId: user.id, OR: [{ id: data.folderId }, { name: data.folderId }] }
        });

        if (!folder || folder.type !== 'folder') return { success: false, message: 'Folder not found' };

        await prisma.workspaceFile.update({
            where: { id: folder.id },
            // @ts-ignore - Schema update pending
            data: { magicRule: data.rule }
        });

        await logAgentActivity({
            type: 'success',
            title: 'Magic Rule Configured',
            message: `Folder "${folder.name}" is now set to "${data.rule}" mode.`,
            toolUsed: 'configure_magic_folder',
            fileId: folder.id,
            userId: user.id,
            sessionId: (data as any).sessionId
        });

        safeRevalidatePath('/');

        // Memorize manual magic action
        try {
            await memory.addJobSummary(`magic_rule_${Date.now()}`, `Configured Magic Rule: "${data.rule}" on folder "${folder.name}"`);
        } catch (e) { console.error('Memory failed', e); }

        return { success: true, message: `Magic rule "${data.rule}" applied to folder "${folder.name}"` };
    } catch (error) {
        return { success: false, message: 'Failed to configure magic folder' };
    }
}

export async function setFileTags(data: { fileId: string, tags: string[] }) {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        const file = await prisma.workspaceFile.findFirst({
            where: { userId: user.id, OR: [{ id: data.fileId }, { name: data.fileId }] }
        });

        if (!file) return { success: false, message: 'File not found' };

        await prisma.workspaceFile.update({
            where: { id: file.id },
            // @ts-ignore - Schema update pending
            data: { tags: data.tags }
        });

        return { success: true, message: `Tags updated for ${file.name}` };
    } catch (error) {
        return { success: false, message: 'Failed to set tags' };
    }
}

export async function synthesizeDocuments(data: { fileIds: string[], outputFilename: string }) {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        let mergedContent = '';
        for (const fid of data.fileIds) {
            const file = await prisma.workspaceFile.findUnique({ where: { id: fid } });
            if (file) {
                const filePath = getWorkspaceFilePath(file);
                try {
                    const content = await readFileFS(filePath, 'utf8');
                    mergedContent += `\n\n--- SOURCE: ${file.name} ---\n${content}`;
                } catch (e) {
                    console.warn('Skipping binary file for synthesis:', file.name);
                }
            }
        }

        const prompt = `Synthesize the following documents into a single, cohesive master report. 
Use a professional structure with an Executive Summary, Key Findings, and Consolidated Details.
Save the output as a Markdown report.

DOCUMENTS CONTENT:
${mergedContent}`;

        const reportContent = await generateAIText(prompt, { purpose: 'smart' });

        await createMarkdownFile({ filename: data.outputFilename, content: reportContent });

        await logAgentActivity({
            type: 'success',
            title: 'Documents Synthesized',
            message: `Created master report "${data.outputFilename}" from ${data.fileIds.length} sources.`,
            toolUsed: 'synthesize_documents',
            userId: user.id,
            sessionId: (data as any).sessionId
        });

        // Memorize synthesis
        try {
            await memory.addJobSummary(`magic_synth_${Date.now()}`, `Synthesized ${data.fileIds.length} docs into ${data.outputFilename}`);
        } catch (e) { console.error('Memory failed', e); }

        return { success: true, message: `Synthesis complete. Saved as ${data.outputFilename}.md` };
    } catch (error) {
        console.error('Synthesis failed:', error);
        return { success: false, message: 'Synthesis failed' };
    }
}

export async function logAgentActivity(data: { type: string, title: string, message: string, toolUsed?: string, fileId?: string, userId: string, sessionId?: string }) {
    try {
        await prisma.agentActivity.create({
            data: {
                type: data.type,
                title: data.title,
                message: data.message,
                toolUsed: data.toolUsed,
                fileId: data.fileId,
                userId: data.userId,
                sessionId: data.sessionId
            }
        });
    } catch (e) {
        console.error('Failed to log activity:', e);
    }
}

export async function getAgentActivitiesForSession(sessionId: string, limit: number = 50) {
    try {
        if (!sessionId) return { success: false, activities: [] };
        const activities = await prisma.agentActivity.findMany({
            where: { sessionId },
            orderBy: { createdAt: 'desc' },
            take: limit
        });
        return { success: true, activities: activities.reverse() }; // Chronological
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to fetch session activity:', msg);
        return { success: false, activities: [], message: msg };
    }
}

export async function getAgentActivity(data: { limit?: number }) {
    try {
        const limit = data.limit || 10;
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) return { success: false, activities: [] };

        const activities = await prisma.agentActivity.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
            take: limit
        });

        return { success: true, activities };
    } catch (error) {
        return { success: false, message: 'Failed to fetch activity' };
    }
}

export async function enqueueAgentJob(data: {
    sessionId?: string;
    type: string;
    payload: any;
    approved?: boolean;
    autonomyLevel?: 'manual' | 'semi' | 'full';
    maxIterations?: number;
    parentJobId?: string;
}) {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) return { success: false, message: 'User not found' };

        if (Array.isArray(data.payload?.fileIds) && data.payload.fileIds.length > 0) {
            data.payload.fileIds = await resolveAttachmentFileIds(user.id, data.payload.fileIds);
        }

        const approved = !!data.approved || data.autonomyLevel === 'full';

        const job = await prisma.agentJob.create({
            data: {
                type: data.type,
                payload: data.payload || {},
                status: 'queued',
                sessionId: data.sessionId || null,
                userId: user.id,
                approved,
                approvedAt: approved ? new Date() : null,
                autonomyLevel: data.autonomyLevel || 'manual',
                maxIterations: data.maxIterations ?? 5,
                parentJobId: data.parentJobId || null,
                iteration: 0
            }
        });

        ensureAgentWorkerAvailable().catch(err => console.error('Worker bootstrap failed:', err));

        if (data.sessionId) {
            await prisma.chatSession.update({
                where: { id: data.sessionId },
                data: { updatedAt: new Date() }
            });
        }

        // Trigger execution if approved
        if (job.approved) {
            if (AI_CONFIG.toolExecutionMode === 'synchronous') {
                console.log(`🔁 Synchronous mode: executing job ${job.id} inline`);
                try {
                    const processed = await processAgentJob(job.id);
                    return { success: true, job: processed || job, executed: true };
                } catch (err) {
                    console.error('Synchronous job execution failed:', err);
                    // Fallback to background trigger
                    processAgentJob(job.id).catch(e => console.error('Background job trigger failed:', e));
                }
            } else {
                processAgentJob(job.id).catch(err => console.error('Background job trigger failed:', err));
            }
        }

        return { success: true, job };
    } catch (error) {
        console.error('Failed to enqueue agent job:', error);
        return { success: false, message: 'Failed to enqueue agent job' };
    }
}

export async function processAgentJob(jobId: string) {
    console.log(`⚙️ Processing agent job ${jobId}...`);
    try {
        const job = await prisma.agentJob.findUnique({ where: { id: jobId } });
        if (!job) return;

        await prisma.agentJob.update({
            where: { id: jobId },
            data: { status: 'running', startedAt: new Date() }
        });

        // Initialize Skills and Tools for background agents
        const payload = job.payload as any;
        const enabledSkills = payload?.proposedTools || DEFAULT_SKILLS;
        const skillDecls = getSkillSchemas(enabledSkills)[0]?.functionDeclarations || [];
        const toolDecls = getToolSchemas(enabledSkills);
        const allDecls = [...skillDecls, ...toolDecls].filter((v, i, a) => a.findIndex(t => t.name === v.name) === i);
        const tools = allDecls.length > 0 ? [{ functionDeclarations: allDecls }] : undefined;

        // WORKSPACE ISOLATION: Detect active repo app from attached files
        let activeRepoApp: string | null = null;
        if (payload?.fileIds && payload.fileIds.length > 0) {
            // Check if any attached file is a repo app (has storagePath starting with repo app name)
            const files = await prisma.workspaceFile.findMany({
                where: { id: { in: payload.fileIds } }
            });

            for (const file of files) {
                // Check if this is a virtual repo app folder (id starts with 'repo-app-')
                if (file.id.startsWith('repo-app-')) {
                    activeRepoApp = file.id.replace('repo-app-', '');
                    console.log(`🔒 WORKSPACE ISOLATION ACTIVE: Restricting to repo app "${activeRepoApp}"`);
                    break;
                }
                // Also check storagePath for repo apps
                if (file.storagePath && !file.storagePath.includes('/') && !file.storagePath.includes('\\')) {
                    // This might be a repo app name
                    const potentialAppName = file.storagePath;
                    const appsPath = join(process.cwd(), 'apps', potentialAppName);
                    try {
                        const stats = await stat(appsPath);
                        if (stats.isDirectory()) {
                            activeRepoApp = potentialAppName;
                            console.log(`🔒 WORKSPACE ISOLATION ACTIVE: Restricting to repo app "${activeRepoApp}"`);
                            break;
                        }
                    } catch (e) {
                        // Not a valid repo app directory
                    }
                }
            }
        }

        // Shared context for tool execution
        const skillContext = {
            userId: job.userId,
            sessionId: job.sessionId || undefined,
            fileIds: payload?.fileIds || [],
            query: payload?.query || '',
            activeRepoApp // Add to context
        };


        // Workspace validator for repo apps
        const validateWorkspace = (toolName: string, args: any): { valid: boolean; error?: string } => {
            if (!activeRepoApp) return { valid: true }; // No restriction if no repo app is active

            // List of file operation tools that need validation
            const fileOperationTools = [
                'create_file', 'edit_file', 'replace_in_file', 'view_file',
                'delete_file', 'move_file', 'copy_file', 'write_file',
                'createMarkdownFile' // Also check our custom action
            ];

            if (!fileOperationTools.includes(toolName)) {
                return { valid: true }; // Non-file operations are allowed
            }

            // Extract file path from arguments
            let filePath: string | undefined;
            if (args.fileId) filePath = args.fileId;
            else if (args.path) filePath = args.path;
            else if (args.filename) filePath = args.filename;
            else if (args.file) filePath = args.file;
            else if (args.targetFile) filePath = args.targetFile;

            if (!filePath) {
                // If we can't find a file path, allow it (might be a different tool)
                return { valid: true };
            }

            // Normalize path
            const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();

            // Check if path is within the allowed repo app
            const allowedPrefixes = [
                `${activeRepoApp}/`,
                `apps/${activeRepoApp}/`,
                `./${activeRepoApp}/`,
                `./apps/${activeRepoApp}/`
            ];

            const isAllowed = allowedPrefixes.some(prefix => normalizedPath.startsWith(prefix.toLowerCase()));

            if (!isAllowed) {
                return {
                    valid: false,
                    error: `🚫 WORKSPACE VIOLATION: Cannot edit "${filePath}". Active repo app is "${activeRepoApp}". All file operations must be within "apps/${activeRepoApp}/" or "${activeRepoApp}/". Example: "${activeRepoApp}/src/App.tsx"`
                };
            }

            return { valid: true };
        };

        const skillExecutor = async (name: string, args: any) => {
            // WORKSPACE ISOLATION: Validate file operations
            const validation = validateWorkspace(name, args);
            if (!validation.valid) {
                console.error(`❌ ${validation.error}`);
                await logger(validation.error!, 'error');
                return { success: false, error: validation.error };
            }

            // First try specialized skills
            const result = await executeSkill(name, args, skillContext);
            if (result.success !== false || result.error !== `Unknown skill: ${name}`) {
                return result;
            }

            // Fallback: Execute as atomic tool (e.g. run_in_terminal, list_dir)
            try {
                // Reuse the main action router which contains all tool implementations
                const actionResult = await executeAction(name, args);

                // If executeAction returns a valid object, it was handled
                if (actionResult && (actionResult.success !== undefined || Object.keys(actionResult).length > 0)) {
                    return actionResult;
                }
            } catch (err: any) {
                console.error(`Tool execution failed for ${name}:`, err);
                return { success: false, error: `Failed to execute tool ${name}: ${err.message}` };
            }

            return { success: false, error: `Tool ${name} not yet implemented in agent bridge.` };
        };

        // Initialize Gemini Models with System Instructions and Tools
        // Add workspace restriction to system prompt if repo app is active
        let systemInstruction = SOFTWARE_ARCHITECT_PROMPT;
        if (activeRepoApp) {
            systemInstruction = `${SOFTWARE_ARCHITECT_PROMPT}

🔒 CRITICAL WORKSPACE RESTRICTION 🔒
You are currently working on the REPO APP: "${activeRepoApp}"

ABSOLUTE RULES:
1. ALL file operations MUST use paths starting with "apps/${activeRepoApp}/"
2. ALL terminal commands MUST use cwd: "apps/${activeRepoApp}"
3. ALWAYS check if "apps/${activeRepoApp}" exists using list_dir BEFORE any operations
4. You are FORBIDDEN from editing ANY files in:
   - src/ (TaskFlow core)
   - components/ (TaskFlow core)
   - app/ (TaskFlow core)
   - lib/ (TaskFlow core)
   - Any other TaskFlow directories
5. This is a SEPARATE application located at "apps/${activeRepoApp}/"
6. The repo app has its own src/, public/, package.json, etc.

CORRECT file path examples:
✅ apps/${activeRepoApp}/src/App.tsx
✅ apps/${activeRepoApp}/src/components/Button.tsx
✅ apps/${activeRepoApp}/package.json
✅ apps/${activeRepoApp}/README.md

CORRECT terminal command examples:
✅ {command: "npm run dev", cwd: "apps/${activeRepoApp}"}
✅ {command: "npm install", cwd: "apps/${activeRepoApp}"}
✅ {command: "vite build", cwd: "apps/${activeRepoApp}"}

FORBIDDEN examples:
❌ ${activeRepoApp}/src/App.tsx (missing "apps/" prefix)
❌ {command: "npm run dev", cwd: "${activeRepoApp}"} (missing "apps/" prefix)
❌ src/components/Dashboard.tsx (TaskFlow core)
❌ components/AIChat.tsx (TaskFlow core)
❌ app/actions.ts (TaskFlow core)
❌ Dashboard.tsx (no path prefix)

BEFORE ANY OPERATION:
1. Run list_dir to verify "apps/${activeRepoApp}" exists
2. If it doesn't exist, inform the user and offer to scaffold it
3. NEVER assume a directory exists without checking

If you attempt to edit files outside "apps/${activeRepoApp}/", your operation will be REJECTED.
Always prefix file paths with "apps/${activeRepoApp}/" and use cwd: "apps/${activeRepoApp}" for terminal commands.`;
        }

        const workerModel = createConfiguredModel({
                purpose: 'fast',
                systemInstruction,
                tools: normalizeFunctionDeclarations(allDecls)
            });

        const logger = async (msg: string, type: 'info' | 'thinking' | 'error' = 'info') => {
            const logEntry = `[${new Date().toISOString()}] [Job ${jobId}] [${type.toUpperCase()}] ${msg}\n`;
            console.log(`[Job ${jobId}] ${type}: ${msg}`);

            // Hook into live terminal (Persistent Log)
            try {
                await mkdir('logs', { recursive: true });
                await writeFile('logs/agent.log', logEntry, { flag: 'a' });
            } catch (e) {
                // Ignore logging errors to prevent crash
            }

            if (job.sessionId) {
                await logAgentActivity({
                    sessionId: job.sessionId,
                    userId: job.userId,
                    type,
                    title: type === 'thinking' ? '🧠 Agent Thought' : '⚡ Agent Action',
                    message: msg
                });
            }
        };

        // Initialize Primary Agent
        const agent = new GeminiAgentAdapter(
            AGENT_ROLES.developer.name,
            workerModel,
            skillContext,
            skillExecutor,
            logger
        );

        // Parse payload for objective
        const objective = (job.payload as any).objective || (job.payload as any).query || JSON.stringify(job.payload);

        // WORKFLOW DETECTION: Check if the objective matches any existing workflows
        let workflowMatched = false;
        let workflowResult: any = null;

        try {
            // TODO: Fix - matchWorkflow function is not defined
            const matchedWorkflow: any = null; // await matchWorkflow(objective);

            if (matchedWorkflow?.workflow) {
                console.log(`🎯 Background job matched workflow: ${matchedWorkflow.workflow.name}`);

                // If it's a scaffold-vite workflow, use the optimized script
                if (matchedWorkflow.workflow.name?.toLowerCase().includes('scaffold') &&
                    matchedWorkflow.workflow.name?.toLowerCase().includes('vite')) {

                    // Extract project name from objective
                    const projectNameMatch = objective.match(/(?:scaffold|create|build|new)\s+(?:vite\s+)?(?:app\s+)?(?:called\s+)?["\']?([a-z0-9-]+)["\']?/i);
                    const projectName = projectNameMatch ? projectNameMatch[1] : `vite-app-${Date.now()}`;

                    console.log(`🚀 Executing scaffold-vite workflow for: ${projectName}`);

                    // Execute the scaffold function directly (it's in this file)
                    workflowResult = await executeScaffoldVite({ projectName });
                    workflowMatched = true;

                    await logger(`Workflow executed: ${matchedWorkflow.workflow.name} for project "${projectName}"`, 'info');
                }
            }
        } catch (err: any) {
            console.error('Workflow detection failed:', err);
            // Continue with normal agent execution
        }

        let finalOutput: string;

        if (workflowMatched && workflowResult) {
            // Use the workflow result as the final output
            finalOutput = workflowResult.message || workflowResult.output ||
                `✅ Workflow completed successfully: ${workflowResult.success ? 'Success' : 'Failed'}`;
        } else {
            // Execute the agent task normally
            finalOutput = await agent.complete(objective);
        }

        const result = {
            objective,
            status: 'completed',
            finalOutput
        };

        await prisma.agentJob.update({
            where: { id: jobId },
            data: {
                status: 'succeeded',
                finishedAt: new Date(),
                result: result as any
            }
        });

        if (job.sessionId) {
            // Add a completion message to the chat
            if (result.finalOutput) {
                await prisma.chatMessage.create({
                    data: {
                        sessionId: job.sessionId,
                        role: 'ai',
                        content: result.finalOutput,
                        toolUsed: 'agent_result'
                    }
                });
            }

            // Refresh UI status
            // (Client polls, so this is passive)
        }

        // Return the final job record for synchronous callers
        const updatedJob = await prisma.agentJob.findUnique({ where: { id: jobId } });
        return updatedJob;

    } catch (error) {
        console.error(`❌ Job ${jobId} failed:`, error);
        await prisma.agentJob.update({
            where: { id: jobId },
            data: {
                status: 'failed',
                finishedAt: new Date(),
                error: String(error)
            }
        });

        // Return the failed job record for synchronous callers
        return await prisma.agentJob.findUnique({ where: { id: jobId } });
    }
}

export async function approveLatestAgentJob(sessionId: string) {
    try {
        if (!sessionId) return { success: false, message: 'Missing sessionId' };
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) return { success: false, message: 'User not found' };

        const job = await prisma.agentJob.findFirst({
            where: { sessionId, userId: user.id, status: 'queued', approved: false },
            orderBy: { createdAt: 'desc' }
        });

        if (!job) return { success: false, message: 'No pending job to approve' };

        const updated = await prisma.agentJob.update({
            where: { id: job.id },
            data: { approved: true, approvedAt: new Date() }
        });

        ensureAgentWorkerAvailable().catch(err => console.error('Worker bootstrap failed:', err));

        // Trigger execution (synchronous or background depending on config)
        if (AI_CONFIG.toolExecutionMode === 'synchronous') {
            console.log(`🔁 Synchronous mode: executing approved job ${job.id} inline`);
            try {
                const processed = await processAgentJob(job.id);
                return { success: true, job: processed || updated, executed: true };
            } catch (err) {
                console.error('Synchronous job execution failed:', err);
                // Fallback to background trigger
                processAgentJob(job.id).catch(e => console.error('Background job trigger failed:', e));
                return { success: true, job: updated, executed: false };
            }
        } else {
            processAgentJob(job.id).catch(err => console.error('Background job trigger failed:', err));
            return { success: true, job: updated };
        }
    } catch (error) {
        return { success: false, message: 'Failed to approve job' };
    }
}

export async function getChatSessionAgentStatus(sessionId: string) {
    try {
        if (!sessionId) return { success: false, busy: false, runningCount: 0, queuedCount: 0 };
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) return { success: false, busy: false, runningCount: 0, queuedCount: 0 };

        const [runningCount, queuedCount, approvedQueuedCount, latestJob, latestActivity] = await Promise.all([
            prisma.agentJob.count({ where: { sessionId, userId: user.id, status: 'running' } }),
            prisma.agentJob.count({ where: { sessionId, userId: user.id, status: 'queued' } }),
            prisma.agentJob.count({ where: { sessionId, userId: user.id, status: 'queued', approved: true } }),
            prisma.agentJob.findFirst({
                where: { sessionId, userId: user.id },
                orderBy: { updatedAt: 'desc' },
                select: { id: true, type: true, status: true, updatedAt: true, startedAt: true, error: true }
            }),
            prisma.agentActivity.findFirst({
                where: { userId: user.id, sessionId },
                orderBy: { createdAt: 'desc' },
                select: { message: true, title: true, createdAt: true }
            })
        ]);

        // Only return activity if it's recent (last 30 seconds) to avoid showing stale info
        const isActivityRecent = latestActivity && (Date.now() - new Date(latestActivity.createdAt).getTime() < 30000);

        const busy = (runningCount + approvedQueuedCount > 0) || !!isActivityRecent;

        return {
            success: true,
            busy,
            runningCount,
            queuedCount,
            approvedQueuedCount,
            latestJob,
            latestActivity: isActivityRecent ? latestActivity : null
        };
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error('getChatSessionAgentStatus failed:', msg);
        return { success: false, busy: false, runningCount: 0, queuedCount: 0, message: msg };
    }
}

export async function extractTextFromImage(data: { fileId: string }) {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        const file = await prisma.workspaceFile.findFirst({
            where: { userId: user.id, OR: [{ id: data.fileId }, { name: data.fileId }] }
        });

        if (!file) return { success: false, message: 'File not found' };

        const filePath = join(process.cwd(), 'public', 'uploads', file.name);
        const imageBuffer = await readFileFS(filePath);
        const base64Image = imageBuffer.toString('base64');

        const text = await generateAIContent([
            "Extract all text from this image as accurately as possible.",
            { inlineData: { data: base64Image, mimeType: 'image/jpeg' } }
        ], { purpose: 'vision' });

        return { success: true, text };
    } catch (error) {
        console.error('OCR failed:', error);
        return { success: false, message: 'OCR failed' };
    }
}

export async function findDuplicateFiles(data: { similarityThreshold?: number }) {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        const files = await prisma.workspaceFile.findMany({
            where: { userId: user.id, type: { not: 'folder' } }
        });

        const duplicates = [];
        const seen = new Map<string, any>(); // Key: size-name

        for (const file of files) {
            const key = `${file.size}-${file.name.replace(/\(\d+\)/, '').trim()}`;
            if (seen.has(key)) {
                duplicates.push({ original: seen.get(key), duplicate: file });
            } else {
                seen.set(key, file);
            }
        }

        return { success: true, duplicates, count: duplicates.length };
    } catch (error) {
        return { success: false, message: 'Search for duplicates failed' };
    }
}

export async function organizeFiles(data: { fileIds: string[], suggestedName?: string }) {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        let folderName = data.suggestedName;
        if (!folderName && data.fileIds.length > 0) {
            const firstFile = await prisma.workspaceFile.findUnique({ where: { id: data.fileIds[0] } });
            folderName = firstFile?.name.split('.')[0] || 'Organized-Files';
        }

        const folderRes = await createFolder({
            name: folderName,
            onExistingFolder: 'reuse'
        });

        if (folderRes.success && folderRes.folder) {
            const moveResult = await moveFilesToFolder(data.fileIds, folderRes.folder.id);
            return {
                success: moveResult.success,
                folderId: folderRes.folder.id,
                folderName: folderRes.folder.name,
                moved: moveResult.moved,
                message: moveResult.message
            };
        }

        return { success: false, message: folderRes.message || 'Organization failed' };
    } catch (err) {
        return { success: false, message: 'Organization failed' };
    }
}

export async function createWorkflow(data: { name: string, triggerKeywords?: string[], steps: any[] }) {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        const rule = await prisma.intentRule.create({
            data: {
                name: data.name,
                action: 'workflow',
                keywords: data.triggerKeywords || [],
                enabled: true,
                steps: data.steps as any,
                userId: user.id
            }
        });

        safeRevalidatePath('/');
        return {
            success: true,
            message: `Workflow "${data.name}" architected and saved successfully. Trigger: ${data.triggerKeywords?.join(', ') || 'Manual only'}`,
            rule
        };
    } catch (error) {
        console.error('Failed to create workflow:', error);
        return { success: false, message: 'Failed to create workflow' };
    }
}

export async function createAgent(data: { name: string, systemPrompt: string, description?: string, tools?: string[] }) {
    try {
        const res = await createPrompt({
            name: data.name,
            prompt: data.systemPrompt,
            description: data.description || `Specialized agent: ${data.name}`,
            tools: data.tools || DEFAULT_SKILLS
        });

        if (res.success && res.prompt) {
            return {
                success: true,
                message: `Specialized Agent "${data.name}" has been created and initialized.`,
                agentId: res.prompt.id
            };
        }
        return { success: false, message: 'Failed to create agent' };
    } catch (error) {
        return { success: false, message: 'Error during agent creation' };
    }
}

export async function updateAgent(data: { agentId: string, systemPrompt?: string, tools?: string[], isActive?: boolean }) {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        // Find by name or ID
        const agent = await prisma.aIPromptSet.findFirst({
            where: {
                userId: user.id,
                OR: [{ id: data.agentId }, { name: data.agentId }]
            }
        });

        if (!agent) return { success: false, message: `Agent not found: ${data.agentId}` };

        const updateData: any = {};
        if (data.systemPrompt) updateData.prompt = data.systemPrompt;
        if (data.tools) updateData.tools = data.tools;

        await prisma.aIPromptSet.update({
            where: { id: agent.id },
            data: updateData
        });

        if (data.isActive) {
            await setActivePrompt(agent.id);
        }

        safeRevalidatePath('/');
        return { success: true, message: `Agent "${agent.name}" configuration updated successfully.` };
    } catch (error) {
        return { success: false, message: 'Error configuring agent' };
    }
}

export async function manageDataTable(data: {
    fileId: string,
    action: 'create' | 'add_row' | 'update_row',
    headers?: string[],
    row?: any,
    searchKey?: string,
    searchValue?: string
}) {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        const { fileId, action, headers, row, searchKey, searchValue } = data;

        if (action === 'create') {
            if (!headers || !headers.length) return { success: false, message: 'Headers required for creation' };
            const tableContent = `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n`;
            return await createMarkdownFile({ filename: fileId, content: tableContent });
        }

        // For modification, find existing file
        const file = await prisma.workspaceFile.findFirst({
            where: {
                userId: user.id,
                OR: [{ id: fileId }, { name: fileId }]
            }
        });

        if (!file) return { success: false, message: `File not found: ${fileId}` };
        const filePath = join(process.cwd(), 'public', 'uploads', file.name);
        let content = await readFileFS(filePath, 'utf8');

        if (action === 'add_row' && row) {
            const lines = content.trim().split('\n');
            // Simple append to the end of the last table found
            const rowText = `| ${Object.values(row).join(' | ')} |`;
            content = content.trim() + '\n' + rowText + '\n';
        } else if (action === 'update_row' && searchKey && searchValue && row) {
            const lines = content.split('\n');
            content = lines.map(line => {
                if (line.includes(`| ${searchValue} |`) || line.includes(`|${searchValue}|`)) {
                    return `| ${Object.values(row).join(' | ')} |`;
                }
                return line;
            }).join('\n');
        }

        await editFile({ fileId: file.id, content });
        return { success: true, message: `Table in ${file.name} updated successfully.` };

    } catch (error) {
        console.error('Failed to manage table:', error);
        return { success: false, message: 'Table management failed' };
    }
}





export async function chatWithAI(
    query: string,
    fileIds: string[] = [],
    history: { role: 'user' | 'model'; parts: { text: string }[] }[] = [],
    currentFolder?: string,
    currentFolderId?: string,
    options?: {
        sessionId?: string;
        allowToolExecution?: boolean;
        agentMode?: 'chat' | 'tool-agent';
        verbosity?: 'concise' | 'normal' | 'verbose';
        activeAppPath?: string;
        activeAppName?: string;
        model?: string;
        enabledToolIds?: string[];
        allowHighRiskExecution?: boolean;
    }
) {
    try {
        const traceId = generateTraceId();
        const traceContext: TraceContext = { traceId, sessionId: options?.sessionId };
        logWithTrace(traceContext, `chatWithAI request`, { query });

        console.log(`💬 chatWithAI called with query: "${query}" [Trace: ${traceId}]`);
        let allowToolExecution = options?.allowToolExecution !== false;
        let allowHighRiskExecution = options?.allowHighRiskExecution === true;
        const agentMode = options?.agentMode || 'chat';
        const verbosity = options?.verbosity || 'concise'; // Default to concise
        const isToolAgent = agentMode === 'tool-agent';
        const sessionId = options?.sessionId;
        const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
        if (!apiKey && AI_CONFIG.provider !== 'github-copilot') return { success: false, message: 'API Key missing' };

        const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

        const [taskCount, fileCount, folders, allFiles, activePromptSet, demoUser, processesRes] = await Promise.all([
            prisma.task.count(),
            prisma.workspaceFile.count({ where: { type: { not: 'folder' } } }),
            prisma.workspaceFile.findMany({ where: { type: 'folder' }, select: { name: true, id: true } }),
            prisma.workspaceFile.findMany({ select: { id: true, name: true, type: true, parentId: true, order: true } }),
            prisma.aIPromptSet.findFirst({ where: { isActive: true } }),
            prisma.user.findUnique({ where: { email: 'demo@example.com' } }),
            prisma.processRegistry.findMany({ where: { status: 'running' } })
        ]);

        const activeProcesses = processesRes || [];

        const contextFileIds = demoUser
            ? await resolveAttachmentFileIds(demoUser.id, fileIds)
            : fileIds;

        fileIds = contextFileIds;

        const toolAgentPrompt = isToolAgent && demoUser
            ? await ensureToolAgentPrompt(demoUser.id)
            : null;
        const selectedPromptSet = (isToolAgent && toolAgentPrompt) ? toolAgentPrompt : activePromptSet;

        // Extract App DNA if activeAppPath is provided
        let appContextDNA: any = null;
        if (options?.activeAppPath) {
            try {
                // Ensure path is absolute; options.activeAppPath is usually absolute from frontend
                const pkgPath = options.activeAppPath.includes(process.cwd())
                    ? join(options.activeAppPath, 'package.json')
                    : resolve(process.cwd(), options.activeAppPath, 'package.json');

                // Only try to read if it exists to avoid error logs
                if (await stat(pkgPath).then(() => true).catch(() => false)) {
                    const pkgContent = await readFileFS(pkgPath, 'utf-8');
                    const pkg = JSON.parse(pkgContent);
                    appContextDNA = {
                        name: pkg.name,
                        scripts: pkg.scripts,
                        dependencies: pkg.dependencies ? Object.keys(pkg.dependencies) : [],
                        devDependencies: pkg.devDependencies ? Object.keys(pkg.devDependencies) : [],
                        main: pkg.main
                    };
                    console.log('🧬 App DNA extracted:', pkg.name);
                }
            } catch (e) {
                console.warn('Failed to read App DNA package.json (ignoring):', e);
            }
        }

        const isApprovalMessage = (text: string) => {
            const normalized = text.trim().toLowerCase();
            return /^(approve|approved|ok|okay|yes|yep|go ahead|proceed|run it|do it|execute|start)(\b|\!|\.|,|$)/.test(normalized);
        };

        const normalizeAppRoot = (activeAppPath?: string, activeAppName?: string) => {
            const raw = activeAppPath || activeAppName;
            if (!raw) return null;
            const cleaned = raw.replace(/\\/g, '/').replace(/^\.\/?/, '').replace(/\/+$/, '');
            if (!cleaned) return null;
            return cleaned.startsWith('apps/') ? cleaned : `apps/${cleaned}`;
        };

        const normalizeRelativePath = (value: string) => {
            return value.replace(/\\/g, '/').replace(/^\.\/?/, '').replace(/\/+$/, '');
        };

        const coerceAppPath = (value: string | undefined, appRoot: string) => {
            if (!value || value.trim() === '' || value.trim() === '.') {
                return { path: appRoot };
            }

            if (path.isAbsolute(value)) {
                const normalized = normalizeRelativePath(value);
                const normalizedRoot = normalizeRelativePath(appRoot);
                if (normalized.includes(`${normalizedRoot}/`) || normalized.endsWith(`/${normalizedRoot}`)) {
                    return { path: value };
                }
                return { error: `Workspace scope violation: "${value}" is outside ${appRoot}. Use paths under ${appRoot}/...` };
            }

            const rel = normalizeRelativePath(value);
            const normalizedRoot = normalizeRelativePath(appRoot);

            if (rel === normalizedRoot || rel.startsWith(`${normalizedRoot}/`)) {
                return { path: rel };
            }

            if (rel.startsWith('apps/') && !rel.startsWith(`${normalizedRoot}/`)) {
                return { error: `Workspace scope violation: "${value}" is outside ${appRoot}. Use paths under ${appRoot}/...` };
            }

            return { path: `${normalizedRoot}/${rel}` };
        };

        const scopeToolArgsForActiveApp = (toolName: string, args: any, appRoot: string | null) => {
            if (!appRoot) return { args };
            const scoped = { ...(args || {}) };

            const applyPath = (key: string) => {
                const current = typeof scoped[key] === 'string' ? scoped[key] : undefined;
                const coerced = coerceAppPath(current, appRoot);
                if (coerced.error) return coerced;
                scoped[key] = coerced.path;
                return { path: coerced.path };
            };

            if (toolName === 'list_dir') {
                const result = applyPath('path');
                return result.error ? { args: scoped, error: result.error } : { args: scoped };
            }

            if (toolName === 'view_file' || toolName === 'replace_in_file' || toolName === 'apply_batch') {
                const result = applyPath('fileId');
                return result.error ? { args: scoped, error: result.error } : { args: scoped };
            }

            if (toolName === 'apply_patch') {
                const result = applyPath('filePath');
                return result.error ? { args: scoped, error: result.error } : { args: scoped };
            }

            if (toolName === 'search_codebase') {
                if (!scoped.dir || scoped.dir === './src' || scoped.dir === 'src') {
                    scoped.dir = `${appRoot}/src`;
                    return { args: scoped };
                }
                const result = applyPath('dir');
                return result.error ? { args: scoped, error: result.error } : { args: scoped };
            }

            if (toolName === 'run_in_terminal') {
                if (!scoped.cwd) {
                    scoped.cwd = appRoot;
                    return { args: scoped };
                }
                const result = applyPath('cwd');
                return result.error ? { args: scoped, error: result.error } : { args: scoped };
            }

            return { args: scoped };
        };

        const normalizeKeyword = (value: string) => value.toLowerCase().trim();
        const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const scoreKeywordMatch = (inputText: string, keyword: string) => {

            const text = normalizeKeyword(inputText);
            const normalized = normalizeKeyword(keyword);
            if (!normalized) return null;
            if (text === normalized) return { score: 100, matched: normalized, reason: 'exact' as const };
            if (text.startsWith(`${normalized} `)) return { score: 90, matched: normalized, reason: 'prefix' as const };
            const regex = new RegExp(`\\b${escapeRegex(normalized)}\\b`, 'i');
            if (regex.test(text)) return { score: 80, matched: normalized, reason: 'word' as const };
            if (text.includes(normalized)) return { score: 60, matched: normalized, reason: 'substring' as const };
            return null;
        };

        const getLastAssistantText = () => {
            const lastAssistant = [...history].reverse().find(m => m.role === 'model');
            if (!lastAssistant) return '';
            return (lastAssistant.parts || []).map(p => p.text || '').join('').trim();
        };

        const getLastUserText = () => {
            const lastUser = [...history].reverse().find(m => m.role === 'user');
            if (!lastUser) return '';
            return (lastUser.parts || []).map(p => p.text || '').join('').trim();
        };

        const getLastNonApprovalUserText = () => {
            const lastUser = [...history].reverse().find(m => {
                if (m.role !== 'user') return false;
                const text = (m.parts || []).map(p => p.text || '').join('').trim();
                return !!text && !isApprovalMessage(text);
            });
            if (!lastUser) return '';
            return (lastUser.parts || []).map(p => p.text || '').join('').trim();
        };

        const isApprovalRequest = (text: string) => {
            const normalized = text.toLowerCase();
            return /are you (ok|okay) with/i.test(normalized) ||
                /are you (okay|ok) with/i.test(normalized) ||
                /can i (proceed|go ahead|start)/i.test(normalized) ||
                /would you like me to/i.test(normalized) ||
                /do you want me to/i.test(normalized) ||
                /before i start/i.test(normalized) ||
                /need your approval/i.test(normalized) ||
                /ready to proceed/i.test(normalized) ||
                /i will use/i.test(normalized) ||
                /plan:|steps:|approach:/i.test(normalized);
        };

        // Greeting detector: short, casual messages (e.g., "hi", "hello") should be
        // handled inline and not trigger workflows or background agents. This prevents
        // noisy orchestration for trivial conversational turns.
        const isCasualGreeting = (text: string) => {
            if (!text) return false;
            const normalized = text.trim().toLowerCase();
            if (normalized.length > 50) return false; // too long to be a simple greeting
            // Common greetings (strict start match)
            return /^(hi|hello|hey|hiya|yo|sup|howdy|good\s(morning|afternoon|evening|day))([!.,\s]*(\?|!)?|$)/i.test(normalized) &&
                !normalized.includes("run") &&
                !normalized.includes("create") &&
                !normalized.includes("start");
        };

        // Sanitize Query: Remove [SYSTEM] prefixes injected by frontend (e.g. background agent status)
        // This prevents approval messages like "approve" from being missed because they are prefixed with "[SYSTEM: ...]"
        let cleanQuery = query;
        if (cleanQuery.startsWith('[SYSTEM:')) {
            // Find the end of the system block(s) - handle multiple if necessary
            // Format is usually [SYSTEM: ...]\n\nUser Content
            // or just [SYSTEM: ...] if no user content? (Unlikely for chat)

            // Simple approach: split by double newline first
            const parts = cleanQuery.split('\n\n');
            // If the first part is a system message, take the rest
            if (parts.length > 1 && parts[0].startsWith('[SYSTEM:')) {
                cleanQuery = parts.slice(1).join('\n\n').trim();
            } else if (cleanQuery.includes(']')) {
                // Fallback for single line or different formatting
                cleanQuery = cleanQuery.substring(cleanQuery.lastIndexOf(']') + 1).trim();
            }
        }

        // Use cleanQuery for logic checks, but keep original query for context if needed (though usually we want the user's actual intent)
        const isCasual = isCasualGreeting(cleanQuery);
        const isApprove = isApprovalMessage(cleanQuery);
        const isShort = (cleanQuery || '').trim().length <= 50;

        console.log(`🔎 Greeting Check: "${cleanQuery}" (Original: "${query.substring(0, 50)}...") -> isCasual=${isCasual}, isApprove=${isApprove}, isShort=${isShort}`);

        // Command detection: /v1 triggers the heavy Cognitive Architecture
        const isCognitiveCommand = cleanQuery.trim().startsWith('/v1');
        const effectiveQuery = isCognitiveCommand ? cleanQuery.replace('/v1', '').trim() : cleanQuery;
        const activeAppRoot = normalizeAppRoot(options?.activeAppPath, options?.activeAppName);

        // Short-circuit casual greetings: quick in-session response, no tools or background work
        if (!isCognitiveCommand && isShort && isCasual && !isApprove) {
            console.log('👋 Fast-pathing casual greeting');
            return {
                success: true,
                text: "Hi there! 👋 I'm ready to help. You can ask me to run an app, create files, or explore the codebase. Just let me know what you need."
            };
        }

        const buildPlanSummary = (tools: string[], query: string) => {
            // If no tools, provide generic but clear plan
            if (!tools.length) {
                return `Plan:\n1. Analyze your request\n2. Execute the work\n3. Provide results\n\nI can run this in the background.`;
            }

            // Build detailed steps based on tools
            const steps: string[] = [];
            const details: string[] = [];

            // Analyze what we're doing based on tools
            const hasFileCreation = tools.some(t => t.includes('create') || t.includes('write'));
            const hasFileSearch = tools.some(t => t.includes('search') || t.includes('find'));
            const hasFileRead = tools.some(t => t.includes('read') || t.includes('view'));

            // Add context-aware steps
            if (hasFileCreation) {
                const queryLower = query.toLowerCase();

                // Detect what's being created
                if (queryLower.includes('microsite') || queryLower.includes('landing') || queryLower.includes('website')) {
                    steps.push('1. Create project folder structure');
                    steps.push('2. Generate HTML with semantic structure');
                    steps.push('3. Add premium CSS styling (glassmorphism, gradients)');
                    steps.push('4. Implement JavaScript for interactions');
                    steps.push('5. Provide file locations and preview instructions');

                    details.push('📁 Will create: HTML, CSS, and JS files');
                    details.push('🎨 Design: Modern, premium, responsive');
                    details.push('✨ Features: Animations, glassmorphism, dark mode');
                } else if (queryLower.includes('dashboard') || queryLower.includes('crm')) {
                    steps.push('1. Create project folder');
                    steps.push('2. Build dashboard HTML structure');
                    steps.push('3. Add data visualization components');
                    steps.push('4. Style with glassmorphic design');
                    steps.push('5. Add interactivity and charts');

                    details.push('📁 Will create: Dashboard application');
                    details.push('📊 Features: Charts, metrics, data tables');
                    details.push('🎨 Design: Glassmorphic, professional');
                } else if (queryLower.includes('app') || queryLower.includes('application')) {
                    steps.push('1. Set up project structure');
                    steps.push('2. Create main application files');
                    steps.push('3. Implement core functionality');
                    steps.push('4. Add styling and UX polish');
                    steps.push('5. Test and provide access instructions');

                    details.push('📁 Will create: Full application');
                    details.push('⚡ Features: Based on your requirements');
                    details.push('🎨 Design: Modern and intuitive');
                } else {
                    // Generic file creation
                    steps.push('1. Create necessary files');
                    steps.push('2. Add content and structure');
                    steps.push('3. Apply styling and formatting');
                    steps.push('4. Provide file locations');
                }
            } else if (hasFileSearch) {
                steps.push('1. Search workspace for relevant files');
                steps.push('2. Analyze search results');
                steps.push('3. Provide findings');
            } else if (hasFileRead) {
                steps.push('1. Read requested files');
                steps.push('2. Analyze content');
                steps.push('3. Provide insights');
            } else {
                // Fallback to tool-based steps
                tools.forEach((tool, idx) => {
                    const toolName = tool.replace(/_/g, ' ');
                    steps.push(`${idx + 1}. ${toolName.charAt(0).toUpperCase() + toolName.slice(1)}`);
                });
            }

            const planText = steps.join('\n');
            const detailsText = details.length > 0 ? '\n\n' + details.join('\n') : '';

            return `Plan:\n${planText}${detailsText}\n\nI can run this in the background.`;
        };

        const getRecentApproval = async () => {
            if (!sessionId || !demoUser) return null;
            return prisma.agentJob.findFirst({
                where: {
                    sessionId,
                    userId: demoUser.id,
                    approved: true,
                    approvedAt: { gte: new Date(Date.now() - 1000 * 60 * 2) }
                },
                orderBy: { approvedAt: 'desc' },
                select: { id: true, approvedAt: true }
            });
        };

        const isLowRiskTools = (tools: string[]) => {
            const lowRisk = new Set(['focus_workspace_item', 'search_files', 'read_file', 'ask_questions', 'create_task', 'list_files', 'get_agent_activity']);
            return tools.length > 0 && tools.every(tool => lowRisk.has(tool));
        };

        const isHtmlCreateOnly = (tools: string[]) => {
            const htmlSafe = new Set(['create_html_file', 'create_folder', 'focus_workspace_item']);
            return tools.length > 0 && tools.every(tool => htmlSafe.has(tool));
        };

        const isSafeEditOnly = (tools: string[]) => {
            const safe = new Set(['edit_file', 'create_file', 'create_markdown_file', 'highlight_file']);
            return tools.length > 0 && tools.every(tool => safe.has(tool));
        };

        if (sessionId && isApprovalMessage(cleanQuery)) {
            // Treat explicit approval as consent to run tools inline; no background queueing.
            allowToolExecution = true;
            allowHighRiskExecution = true;
        }

        const extractLastMarkdownTable = (text: string) => {
            const tableRegex = /(^|\n)\|[^\n]*\|\n\|[-\s|:]+\|\n(?:\|[^\n]*\|\n?)+/m;
            const match = text.match(tableRegex);
            return match ? match[0].trim() : '';
        };

        const stripThinking = (text: string) => {
            return text.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
        };

        const ensureIntentRules = async (userId: string) => {
            const existing = await prisma.intentRule.count({ where: { userId } });
            if (existing > 0) return;

            await prisma.intentRule.createMany({
                data: DEFAULT_INTENT_RULES.map(rule => ({
                    name: rule.name,
                    action: rule.action,
                    keywords: rule.keywords,
                    enabled: rule.enabled ?? true,
                    config: rule.config ?? {},
                    userId
                }))
            });
        };

        const getAutoFolderName = (ruleConfig?: { autoFolder?: string }) => {
            if (!ruleConfig?.autoFolder || ruleConfig.autoFolder === 'none') return undefined;
            if (ruleConfig.autoFolder === 'year') return `${new Date().getFullYear()}`;
            if (ruleConfig.autoFolder === 'auto') return undefined; // Let the workflow handle auto-naming
            return undefined;
        };

        const getAutoFilename = (ruleConfig?: { autoFilename?: string }) => {
            if (!ruleConfig?.autoFilename) return `report-${Date.now()}`;
            if (ruleConfig.autoFilename === 'short') return `report-${new Date().toISOString().slice(0, 10)}`;
            if (ruleConfig.autoFilename === 'file') {
                const firstFile = allFiles.find(f => f.id === fileIds[0]);
                if (firstFile?.name) {
                    return firstFile.name.replace(/\.[^/.]+$/, '');
                }
            }
            return `report-${Date.now()}`;
        };

        const shouldResearch = (text: string) => {
            const normalized = text.toLowerCase();
            return /\bresearch|investigate|find sources|look up|search\b/.test(normalized);
        };

        const generateScaffoldViteDefaultName = () => `vite-app-${Date.now()}`;

        const parseScaffoldViteAppName = (text: string) => {
            // Normalize spacing and separators
            const normalized = text.trim().toLowerCase().replace(/\\/g, '/');

            // Remove leading command token and common prefixes
            const withoutCommand = normalized.replace(/^\/(scaffold-vite|viteapp|vite|scaffolde-vite)\s+/, '');

            // If a path like "apps/premium-shopping-app" is provided, keep only the last segment
            const lastSegment = withoutCommand.split('/').filter(Boolean).pop();
            if (!lastSegment) return undefined;

            // Extract the candidate and ensure kebab-case characters only
            const kebabMatch = lastSegment.match(/[a-z0-9-]+/);
            if (!kebabMatch) return undefined;
            const candidate = kebabMatch[0];

            const stopWords = new Set([
                'create', 'a', 'an', 'vite', 'react', 'ts', 'typescript', 'app', 'application', 'web', 'site', 'named'
            ]);
            const reserved = new Set(['uploads', 'upload', 'public']);
            if (stopWords.has(candidate) || reserved.has(candidate)) return undefined;

            return candidate;
        };

        let workflowInstructions = '';

        // Standard Flow: Check for deterministic regex/intent matches
        // /v1 (Cognitive Mode) skips this to allow full LLM planning
        if (!isCognitiveCommand && demoUser) {
            await ensureIntentRules(demoUser.id);
            const rules = await prisma.intentRule.findMany({ where: { userId: demoUser.id, enabled: true } });

            // Check if input matches any of the AGENT'S custom trigger keywords
            const rawWorkflows = selectedPromptSet?.workflows as unknown;
            let workflows: any[] = [];

            if (Array.isArray(rawWorkflows)) {
                workflows = rawWorkflows;
            } else if (typeof rawWorkflows === 'string') {
                try {
                    workflows = JSON.parse(rawWorkflows);
                } catch {
                    workflows = [];
                }
            }

            // Backward compatibility: if workflows is an array of steps (old structure)
            if (workflows.length > 0 && !('steps' in workflows[0])) {
                workflows = [{
                    id: 'default',
                    name: 'Main Flow',
                    triggerKeywords: (selectedPromptSet?.triggerKeywords as string[]) || [],
                    steps: workflows
                }];
            }

            // Merge with DEFAULT_WORKFLOWS and File System Workflows
            const fsWorkflows = await loadFileSystemWorkflows();
            workflows = [...DEFAULT_WORKFLOWS, ...workflows, ...fsWorkflows];

            const keywordCandidates = workflows
                .flatMap(wf => {
                    const rawKeywords = Array.isArray(wf.triggerKeywords) ? wf.triggerKeywords : [];
                    const keywords = rawKeywords.length > 0
                        ? rawKeywords
                        : (wf.name ? [wf.name] : []);
                    return keywords
                        .filter(Boolean)
                        .map((keyword: string) => ({
                            workflow: wf,
                            keyword,
                            normalized: normalizeKeyword(keyword)
                        }));
                });

            const slashTokenMatch = query.trim().match(/^\/(\S+)/);
            const slashToken = slashTokenMatch ? `/${slashTokenMatch[1].toLowerCase()}` : undefined;
            let matchedWorkflow: { workflow: any; keyword: string; match: { score: number; matched: string; reason: string } } | undefined;

            if (slashToken) {
                const candidate = keywordCandidates.find(item => item.normalized === slashToken);
                if (candidate) {
                    matchedWorkflow = {
                        workflow: candidate.workflow,
                        keyword: candidate.keyword,
                        match: { score: 200, matched: candidate.keyword, reason: 'slash' as const }
                    };
                } else {
                    console.warn(`⚠️ Slash command not matched: ${slashToken}`);
                }
            }

            if (!matchedWorkflow) {
                matchedWorkflow = keywordCandidates
                    .map(candidate => {
                        const match = scoreKeywordMatch(query, candidate.keyword);
                        return {
                            workflow: candidate.workflow,
                            keyword: candidate.keyword,
                            match
                        };
                    })
                    .filter(item => item.match !== null)
                    .sort((a, b) => {
                        const scoreA = a.match ? a.match.score : 0;
                        const scoreB = b.match ? b.match.score : 0;
                        return scoreB - scoreA;
                    })[0] as unknown as { workflow: any; keyword: string; match: { score: number; matched: string; reason: string } };
            }

            const matchedWorkflowValue = matchedWorkflow?.workflow;

            if (matchedWorkflowValue) {
                console.log(`⚡ Server Workflow Execution: ${matchedWorkflowValue.name}`, {
                    matchedKeyword: matchedWorkflow?.keyword,
                    matchReason: matchedWorkflow?.match?.reason,
                    matchScore: matchedWorkflow?.match?.score
                });
                const lastAssistantText = getLastAssistantText();
                const table = extractLastMarkdownTable(lastAssistantText);
                const content = table || lastAssistantText || `Workflow triggered: ${matchedWorkflowValue.name}\nQuery: ${cleanQuery}`;

                const filename = getAutoFilename({ autoFilename: 'timestamp' });
                const folderName = getAutoFolderName({ autoFolder: 'auto' });

                if (matchedWorkflowValue.content) {
                    // Not a scaffold-vite workflow, proceed normally
                    let workflowContent = matchedWorkflowValue.content;
                    workflowInstructions = `\n\n═══════════════════════════════════════════════════════════════════\nSYSTEM OVERRIDE: ACTIVE WORKFLOW: ${matchedWorkflowValue.name}\n═══════════════════════════════════════════════════════════════════\n${workflowContent}\n\nFOLLOW THESE INSTRUCTIONS EXACTLY TO COMPLETE THE WORKFLOW.`;

                    if (demoUser) {
                        await logAgentActivity({
                            type: 'info',
                            title: `🚀 Triggered Workflow: ${matchedWorkflowValue.name}`,
                            message: matchedWorkflowValue.description || 'Executing file-based workflow',
                            userId: demoUser.id,
                            sessionId: sessionId
                        });
                    }
                } else {
                    const scaffoldViteAppName = parseScaffoldViteAppName(cleanQuery) || generateScaffoldViteDefaultName();
                    const res = await executeWorkflow(matchedWorkflowValue.steps as WorkflowStep[], {
                        content,
                        query: cleanQuery,
                        lastResponse: lastAssistantText,
                        filename,
                        folderName,
                        fileIds,
                        scaffoldViteAppName
                    });

                    if (res.success) {
                        let extra = '';
                        if (res.context?.filesMoved?.moved) {
                            extra += `\n• Moved ${res.context.filesMoved.moved} file(s) to folder.`;
                        }
                        if (res.context?.filesCopied?.copied) {
                            extra += `\n• Copied ${res.context.filesCopied.copied} file(s) to folder.`;
                        }

                        if (res.context?.workflowPaused) {
                            const pausedText = res.context.workflowPausedMessage || 'Folder already exists. Update the workflow setting or confirm to proceed.';
                            return {
                                success: true,
                                text: `⏸️ Workflow **${matchedWorkflowValue.name}** paused.\n${pausedText}`,
                                toolUsed: undefined
                            };
                        }

                        const alegraSkipped = res.context?.lastSkippedAction === 'extract_alegra_bill';
                        const toolUsed = alegraSkipped ? undefined : `workflow:${matchedWorkflowValue.name}`;
                        let text = alegraSkipped
                            ? `✅ Workflow **${matchedWorkflowValue.name}** executed successfully (Alegra export disabled).${extra}`
                            : `✅ Workflow **${matchedWorkflowValue.name}** executed successfully.${extra ? `\n${extra}` : ''}`;

                        // If the workflow generated a report or content, show it.
                        if (res.context?.markdown) {
                            text += `\n\n${res.context.markdown}`;
                        } else if (res.context?.content && res.context.content !== content) {
                            text += `\n\n${res.context.content}`;
                        }

                        return {
                            success: true,
                            text,
                            toolUsed,
                            workflowName: matchedWorkflowValue.name
                        };
                    }

                    // Fallback to injection instructions if server workflow fails
                    const stepsList = matchedWorkflowValue.steps.map((s: any, i: number) => `${i + 1}. Tool: "${s.action}"`).join('\n');
                    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                    const now = new Date();
                    const monthLabel = `${String(now.getMonth() + 1).padStart(2, '0')} - ${monthNames[now.getMonth()]}`;
                    workflowInstructions = `\n\nSYSTEM OVERRIDE: The user has triggered the workflow "${matchedWorkflowValue.name}".\n\nEXECUTION RULES:\n1. You are MANDATED to execute the following tools in this exact order to complete the workflow:\n${stepsList}\n2. IGNORE the rule about asking for folders. For this workflow, AUTOMATICALLY store files in "Receipts/${now.getFullYear()}/${monthLabel}" without asking.\n3. Analyze the provided image/context to extract any required parameters for these tools.\n4. Do not stop. Execute all steps sequentially now.`;
                }
            } else {
                const rules = await prisma.intentRule.findMany({ where: { userId: demoUser.id, enabled: true } });
                const matchedRule = rules
                    .map(rule => ({
                        rule,
                        keywordMatch: (rule.keywords || [])
                            .map(keyword => ({ keyword, match: scoreKeywordMatch(query, keyword) }))
                            .filter(entry => entry.match)
                            .sort((a, b) => {
                                if (b.match!.score !== a.match!.score) return b.match!.score - a.match!.score;
                                return (b.keyword?.length || 0) - (a.keyword?.length || 0);
                            })[0]
                    }))
                    .filter(entry => entry.keywordMatch)
                    .sort((a, b) => {
                        if (b.keywordMatch!.match!.score !== a.keywordMatch!.match!.score) {
                            return b.keywordMatch!.match!.score - a.keywordMatch!.match!.score;
                        }
                        return (b.keywordMatch!.keyword?.length || 0) - (a.keywordMatch!.keyword?.length || 0);
                    })[0]?.rule;

                if (matchedRule) {
                    console.log(`⚡ Intent Rule Triggered: ${matchedRule.name}`);
                    const lastAssistantText = getLastAssistantText();
                    const table = extractLastMarkdownTable(lastAssistantText);
                    const content = table || lastAssistantText || `Intent triggered: ${matchedRule.name}\nQuery: ${query}`;

                    const config = (matchedRule.config || {}) as any;
                    const folderName = getAutoFolderName(config);
                    const filename = getAutoFilename(config);

                    // If the rule has explicit steps, execute them as a workflow
                    // Otherwise, simulate a workflow with the single action
                    const steps = (matchedRule.steps as unknown as WorkflowStep[]) || [
                        {
                            id: 'auto-step-1',
                            action: matchedRule.action,
                            params: {
                                ...config,
                                folderName,
                                filename,
                                content
                            }
                        }
                    ];

                    const res = await executeWorkflow(steps, {
                        content,
                        query,
                        lastResponse: lastAssistantText,
                        filename,
                        folderName,
                        fileIds
                    });

                    if (res.success) {
                        let extra = '';
                        if (res.context?.filesMoved?.moved) extra += `\n• Moved ${res.context.filesMoved.moved} file(s) to folder.`;
                        if (res.context?.filesCopied?.copied) extra += `\n• Copied ${res.context.filesCopied.copied} file(s) to folder.`;

                        if (res.context?.workflowPaused) {
                            const pausedText = res.context.workflowPausedMessage || 'Folder already exists. Update the workflow setting or confirm to proceed.';
                            return {
                                success: true,
                                text: `⏸️ Workflow paused.\n${pausedText}`,
                                toolUsed: undefined
                            };
                        }

                        const alegraSkip = matchedRule.action === 'extract_alegra_bill';
                        const text = alegraSkip
                            ? `✅ Workflow completed. Alegra export is currently disabled.${extra}`
                            : `✅ Action **${matchedRule.name}** completed successfully.${extra}`;

                        return {
                            success: true,
                            text,
                            toolUsed: alegraSkip ? undefined : matchedRule.action
                        };
                    }
                }
            }
        }

        const defaultInstruction = `${SOFTWARE_ARCHITECT_PROMPT}

═══════════════════════════════════════════════════════════════════
TASKFLOW AI - SPECIALIZED CAPABILITIES
═══════════════════════════════════════════════════════════════════
You are TaskFlow AI, an intelligent fiscal agent for Alegra RD with advanced skills.
- SKILLS: receipt_intelligence, workspace_organization, fiscal_analysis, document_processing
- EXPERT: Dominican NCF, ITBIS, and 606 classification
- CAPABLE: Vision analysis, business verification, automated organization
- ALEGRA EXPORT: 'extract_alegra_bill' is temporarily disabled. Do NOT attempt it.`;

        const toolExecutionRule = isToolAgent
            ? '0. TOOL AGENT: Tools are pre-approved. Execute immediately; do NOT request approval or queue jobs.'
            : allowToolExecution
                ? '0. TOOL EXECUTION: Tools are allowed. Execute directly when needed. Ask clarifying questions only if required arguments are missing. For high-risk tools, request approval when required.'
                : '0. CONSULT FIRST: Never execute tools or skills without explicit user approval. You MUST ask for confirmation before any tool processing.';
        const backgroundRule = isToolAgent
            ? ''
            : '13. BACKGROUND EXECUTION: Do NOT use enqueue_agent_job. For normal edits (UI tweaks, single-file changes, quick fixes), run tools directly (read/apply_patch/run_in_terminal/manage_app_lifecycle). Only queue work if the user explicitly asks to schedule/queue it.';

        const toolInstructions = `
OPERATIONAL RULES:
    ${toolExecutionRule}
0.5. DIRECT RESPONSE FIRST: For simple questions, greetings, explanations, or information requests, ALWAYS respond directly with text. DO NOT queue a background job for simple conversational responses. Only use tools when the user explicitly asks for file operations, code generation, or complex tasks.
    0.6. TOOL CALLING: When a tool is needed, call it directly using the tool name and JSON arguments that match its schema. Do NOT guess results. Wait for tool output, then continue. Do not queue work unless the user explicitly asks to schedule it.
    0.7. TOOL CLARITY: If required arguments are missing, ask a short clarifying question. Prefer reading/searching the workspace over asking for file IDs.
1. SKILLS OVER TOOLS: Use SKILLS instead of individual tools. Skills are intelligent capabilities that handle complex tasks automatically.
2. RECEIPT INTELLIGENCE: When processing receipts, use the 'receipt_intelligence' skill which handles vision analysis, business verification, report creation, and file organization in one call.
3. WORKSPACE ORGANIZATION: Use 'workspace_organization' skill for organizing files - it intelligently creates folders, moves files, and applies highlighting.
4. FISCAL ANALYSIS: Use 'fiscal_analysis' skill for tax calculations and compliance checking.
5. DOCUMENT PROCESSING: Use 'document_processing' skill for content extraction and categorization.
6. BUSINESS NAMES: The skills handle DGII verification automatically - you don't need to call it separately.
7. FILE CREATION FLOW: Skills handle folder creation automatically. Don't ask about folders - let the skills decide.
8. WORKSPACE HYGIENE: Maintain a clean root directory. REUSE existing folders instead of creating new ones if a similar purpose exists. Organize receipts hierarchically by Year then Month (e.g., "Receipts/2025/06 - June"). The receipt_intelligence skill handles this automatically.
9. WORKSPACE DISCOVERY: You have full access to the workspace. If the user mentions a project or vendor, proactively SEARCH for related files or folders first before asking the user for details.
10. PROACTIVE CONTEXT: Use the 'USER'S CURRENT VIEW' as the default location for new folders or file moves if no other destination is obvious. For example, if the user is in "Invoices" and asks to "Organize these", perform the actions relative to that folder.
11. PRIORITIZE ACTIVE PREVIEW: If the message includes "[CONTEXT: User is currently PREVIEWING...]", you MUST prioritize that file and its folder. 
    - If the user asks to "edit", edit the previewed file.
    - If the user asks to "add a page" or "create a file", create it INSIDE the previewed file's folder.
    - DO NOT create new projects in the root if the user is working inside a previewed app.
12. CURRENT WORKSPACE CONTEXT (JSON):
    Treat the following as the source of truth for the workspace state:
    \`\`\`json
    {
       "stats": {
         "totalFiles": ${fileCount},
         "totalTasks": ${taskCount}
       },
       "hierarchy": {
         "existingFolders": ${JSON.stringify(folders.map(f => ({ name: f.name, id: f.id })))},
         "rootFiles": ${JSON.stringify(allFiles.filter(f => !f.type.includes('folder') && !f.parentId).map(f => ({ name: f.name, id: f.id, type: f.type })))}
       },
       "viewContext": {
         "currentFolder": "${currentFolder || 'Root'}",
         "currentFolderId": "${currentFolderId || 'root'}"
       }
    }
    \`\`\`

13. WEB APP DEVELOPMENT & ISOLATION:
     - ISOLATION: Web apps must live in their own folder. ALWAYS create a dedicated folder for a new web project if one doesn't exist.
     - FILE NAMING: Use standard names (\`index.html\`, \`about.html\`, \`app.js\`) inside these folders. DO NOT add random prefixes; the folder structure provides the uniqueness.
     - RELATIVE LINKING: Files within the same app folder can link to each other using simple relative paths (e.g., \`<a href="about.html">\`).
     - CONTEXT AWARENESS: If the user is currently inside a folder (see 'USER'S CURRENT VIEW'), create the app files INSIDE that folder by passing its ID to the creation tool.
     - PRE-FLIGHT CHECKLIST (Before finishing a web app, verify):
         1. All HTML files are in the same folder.
         2. Links use relative paths, not absolute or storage IDs.
         3. An 'index.html' entry point exists.
     ${backgroundRule}
14. COMMAND EXECUTION: For terminal commands (npm, docker, npx, git, etc.), use 'run_in_terminal' (or 'execute_command' when required by the tool list).

15. LIVE SERVERS & PREVIEWS:
    - PREVIEWING: If a dev server or container is running (see 'activeProcesses'), you can tell the user to "Open the Preview tab" to see the live site at the provided URL.
    - AUTO-START: If the user creates or modifies a project and wants to see it, and no process is running, suggest starting the dev server via 'manage_app_lifecycle'.
    - PREMIUM EXPERIENCE: If you make a visual change (CSS/UI), proactively mention that the preview is available.

ACTIVE PROCESSES (LIVE):
${JSON.stringify(activeProcesses.map(p => ({
            name: p.name,
            type: p.type,
            port: p.port,
            url: p.port ? `http://localhost:${p.port}` : undefined
        })))}

ACTIVE APP DNA (CONTEXT):
${appContextDNA ? JSON.stringify(appContextDNA) : 'None'}
   `;

        // Load skills dynamically from skills library
        const toolRegistryIds = Object.keys(TOOL_LIBRARY);

        const initialTools = Array.isArray(options?.enabledToolIds) && options.enabledToolIds.length > 0
            ? options.enabledToolIds.filter(id => toolRegistryIds.includes(id))
            : (selectedPromptSet && Array.isArray(selectedPromptSet.tools) && selectedPromptSet.tools.length > 0
                ? selectedPromptSet.tools.filter(id => toolRegistryIds.includes(id))
                : DEFAULT_SKILLS);

        // P3-TOOL-ROUTING: Intent-based filtering
        let routedTools = initialTools;
        const explicitToolsRequested = options?.enabledToolIds && options.enabledToolIds.length > 0;

        // Only route if using default configuration (no explicit tools, no custom prompt set)
        if (!explicitToolsRequested && !selectedPromptSet) {
            const { classifyIntent, getToolsForIntent } = await import('@/lib/toolRouting');
            // We use fileIds for count but don't have types yet. classifyIntent handles empty types gracefully.
            const intentResult = classifyIntent(cleanQuery, fileIds, []);
            console.log(`🧭 Intent: ${intentResult.intent} (${(intentResult.confidence * 100).toFixed(0)}%)`);

            const allowedTools = new Set(getToolsForIntent(intentResult.intent));
            routedTools = initialTools.filter(t => allowedTools.has(t));

            // Generous Fallback: If routing stripped too much, revert to general chat
            if (routedTools.length < 3) {
                console.log('⚠️ Routing too restrictive, falling back to general chat tools');
                const general = new Set(getToolsForIntent('general_chat'));
                routedTools = initialTools.filter(t => general.has(t));
            }

            if (initialTools.length !== routedTools.length) {
                console.log(`📉 Tool Reduction: ${initialTools.length} -> ${routedTools.length} tools`);
            }
        }

        const enabledSkills = routedTools
            .filter(skillId => skillId !== 'extract_alegra_bill'); // Temporarily disable Alegra export

        const baseInstruction = selectedPromptSet ? selectedPromptSet.prompt : defaultInstruction;
        const enabledToolsList = enabledSkills.length > 0 ? enabledSkills.join(', ') : 'None';

        // --- COGNITIVE PLANNING (Multi-Agent Architecture) ---
        // Only active if explicitly requested via /v1 command
        let planText = '';
        if (!isToolAgent && isCognitiveCommand) {
            const { CognitiveAgent } = await import('@/lib/agents/CognitiveAgent');
            const cognitiveAgent = new CognitiveAgent(apiKey);
            const plan = await cognitiveAgent.generateExecutionPlan(effectiveQuery, {
                history,
                currentFolder,
                availableTools: enabledSkills
            });

            if (plan && demoUser) {
                // CONSULTATION: Provide constructive critique to strengthen the plan
                const doubts = await cognitiveAgent.critiquePlan(plan, effectiveQuery);
                plan.doubts = [...(plan.doubts || []), ...doubts];

                await logAgentActivity({
                    type: 'planning',
                    title: 'Cognitive Brain Formulated Plan',
                    message: `Objective: ${plan.objective}`,
                    userId: demoUser.id,
                    sessionId: sessionId
                });

                if (doubts.length > 0) {
                    await logAgentActivity({
                        type: 'thinking',
                        title: 'Team Consultation (Constructive Review)',
                        message: `The team has identified improvement opportunities: ${doubts.join(', ')}`,
                        userId: demoUser.id,
                        sessionId: sessionId
                    });
                }
            }

            planText = plan ? `\n\n═══════════════════════════════════════════════════════════════════
COGNITIVE TEAM ROADMAP (ROADMAP TO SUCCESS)
═══════════════════════════════════════════════════════════════════
- OBJECTIVE: ${plan.objective}
- RATIONALE: ${plan.rationale}
- CONFIDENCE: ${(plan.confidenceScore * 100).toFixed(0)}%

- CONSULTATION & CRITIQUE (Team Brainstorming):
${plan.doubts?.map(d => `  ${d.startsWith('✅') || d.startsWith('🔍') ? '' : '✅ '}${d}`).join('\n') || '  No critical improvements identified.'}

- RESEARCH QUESTIONS (Consult with Tool Agent/User):
${plan.researchQuestions?.map(q => `  🔍 Research: ${q}`).join('\n') || '  No preliminary research needed.'}

- EXECUTION STEPS:
${plan.steps.map((s, i) => `  ${i + 1}. [${s.phase}] ${s.action}: ${s.description}`).join('\n')}

${plan.suggestedSpecialist && plan.suggestedSpecialist !== 'none' ? `SPECIALIST ADVICE: This task should be handled by the '${plan.suggestedSpecialist}' agent submodule.` : ''}
═══════════════════════════════════════════════════════════════════` : '';
        }

        if (isToolAgent && demoUser) {
            await logAgentActivity({
                type: 'info',
                title: 'Tool Agent Activated',
                message: `Executing pre-approved tools for session ${sessionId || 'n/a'}.`,
                toolUsed: 'tool_agent',
                userId: demoUser.id,
                sessionId: sessionId
            });
        }

        let systemInstruction = "";

        if (isCognitiveCommand) {
            // --- HEAVY /v1 MODE: Full Cognitive Architecture ---
            systemInstruction = baseInstruction + "\n" + toolInstructions + planText +
                "\n\nCOGNITIVE ARCHITECTURE: ENABLED." +
                (isToolAgent
                    ? "\nVERBOSITY: LOW. Keep responses concise and focused on tool results."
                    : verbosity === 'verbose'
                        ? "\nVERBOSITY: HIGH. Be detailed. Share your internal roadmap and reasoning explicitly."
                        : verbosity === 'concise'
                            ? "\nVERBOSITY: LOW. Be straight to the point. Minimal explanation, focus on action and results. Do not repeat the plan if it's obvious."
                            : "\nVERBOSITY: NORMAL. Provide reasonable context but avoid excessive fluff.") +
                (isToolAgent
                    ? "\nTHINKING PROTOCOL: Do not include <thinking> tags in responses."
                    : `
═══════════════════════════════════════════════════════════════════
THINKING PROTOCOL (MANDATORY)
═══════════════════════════════════════════════════════════════════
You MUST include a <thinking>...</thinking> block at the START of EVERY response.
This block should contain:
1. Your analysis of the user's request
2. Your approach/strategy
3. Tools or skills you plan to use (if any)
4. Potential challenges or considerations
Example format:
<thinking>
The user wants me to [understand request].
My approach:
- Step 1: [action]
- Step 2: [action]
I will use [tool/skill] because [reason].
</thinking>
[Your actual response here]
IMPORTANT: The thinking block helps users understand your reasoning process.
═══════════════════════════════════════════════════════════════════
`);
        } else {
            // --- STANDARD MODE: Clean, Direct, Tool-Capable ---
            // We still include instructions and tools, but remove the "Cognitive Brain" branding and forced thinking blocks.
            // This relies on the model's native ability to decide when to use tools.
            systemInstruction = baseInstruction + "\n" + toolInstructions +
                "\n\nMODE: STANDARD ASSISTANT." +
                "\nRESPONSE STYLE: Direct, helpful, and concise. You have access to tools and should use them when requested or necessary, but you do not need to over-explain your planning process unless asked." +
                "\n\nNOTE: If the user asks for complex multi-step planning, suggest they use the '/v1' command to activate the Cognitive Brain.";
        }

        systemInstruction += `\n\nENABLED TOOLS: ${enabledToolsList}`;

        // Shared capabilities for both modes
        systemInstruction += "\nWEB/PREVIEW CAPABILITY: You can create full HTML web pages using 'create_html_file'. When you do this, the system will AUTOMATICALLY open a live preview for the user side-by-side with the chat. Use this for landing pages, reports, or any visual data representation." +
            "\nPROACTIVE SEARCH RULE: Always use 'search_files' if you are unsure which files to use for a report or task. Never ask the user for file IDs if you can find them yourself.";

        console.log('🧠 Loading capabilities for agent:', enabledSkills);

        // Load both Skills and Tools
        const skillDecls = getSkillSchemas(enabledSkills)[0]?.functionDeclarations || [];
        const toolDecls = getToolSchemas(enabledSkills);

        // Merge and deduplicate by name
        const allDecls = [...skillDecls, ...toolDecls].filter((v, i, a) => a.findIndex(t => t.name === v.name) === i);

        let tools: any[] = [];
        if (allDecls.length > 0) {
            tools = [{ functionDeclarations: allDecls }];
        }

        // Fallback: Check if they are Tools instead of Skills (legacy support or pure tool mode)
        if (!tools.length || (tools[0]?.functionDeclarations?.length === 0)) {
            if (toolDecls.length > 0) {
                tools = [{ functionDeclarations: toolDecls }];
            }
        }

        // Fallback: if no schemas found, load default skills
        if (!tools.length || (tools[0]?.functionDeclarations?.length === 0)) {
            console.warn('⚠️ No schemas found for enabled tools. Falling back to default skills.');
            tools = getSkillSchemas(DEFAULT_SKILLS);
        }

        const selectedModel = resolveModelId(options?.model, AI_CONFIG.fastModel);
        let promptParts: any[] = [effectiveQuery + workflowInstructions];

        // P3-CONTEXT-BUDGET: Intelligent context budget with model-aware limits and smart truncation
        const { getContextBudget, prioritizeFiles, getTruncationStrategy, generateTruncationReport } = await import('@/lib/contextBudget');

        const maxContextChars = getContextBudget(selectedModel, promptParts[0].length);
        let remainingContext = Math.max(0, maxContextChars - promptParts[0].length);
        const truncationResults: TruncationResult[] = [];

        console.log(`📊 Context Budget: ${maxContextChars} chars available (model: ${selectedModel})`);

        const appendToPrompt = (text: string) => {
            if (remainingContext <= 0) return false;
            const slice = text.slice(0, remainingContext);
            promptParts[0] += slice;
            remainingContext -= slice.length;
            return slice.length === text.length;
        };

        // Resolve all file IDs (including those inside folders)
        const resolvedFileIds = new Set<string>(fileIds);

        // P3-CONTEXT-BUDGET: Fetch all files and prioritize them
        const allFilesToProcess = await Promise.all(
            Array.from(resolvedFileIds).map(id =>
                prisma.workspaceFile.findUnique({ where: { id } })
            )
        );

        const validFiles = allFilesToProcess.filter(f => f !== null) as any[];
        const userSelectedIds = new Set(fileIds); // All provided fileIds are user-selected
        const prioritizedFiles = prioritizeFiles(validFiles, userSelectedIds);

        console.log(`📁 Processing ${prioritizedFiles.length} files (prioritized by relevance)`);

        for (const prioritizedFile of prioritizedFiles) {
            const file = prioritizedFile;

            appendToPrompt(`\n(File: ${file.name})`);

            // Strict extension check for Gemini Vision
            const ext = file.name.split('.').pop()?.toLowerCase() || '';
            const supportedImageExts = ['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif'];

            if (supportedImageExts.includes(ext) && ['image', 'png', 'jpg', 'jpeg', 'webp', 'heic', 'heif'].includes(file.type)) {
                try {
                    const fileBuffer = await readFileFS(getWorkspaceFilePath(file));
                    if (fileBuffer.length > 0) {
                        let mimeType = "image/jpeg";
                        if (ext === 'png') mimeType = "image/png";
                        if (ext === 'webp') mimeType = "image/webp";
                        if (ext === 'heic') mimeType = "image/heic";
                        if (ext === 'heif') mimeType = "image/heif";

                        promptParts.push({
                            inlineData: {
                                data: fileBuffer.toString('base64'),
                                mimeType
                            }
                        });

                        // Track as non-truncated (images don't count against text budget)
                        truncationResults.push({
                            filename: file.name,
                            originalSize: fileBuffer.length,
                            truncatedSize: fileBuffer.length,
                            truncated: false,
                            percentage: 100,
                            strategy: 'image'
                        });
                    }
                } catch (err) {
                    console.error(`Error reading image file ${file.name}:`, err);
                }
            } else if (file.type === 'pdf') {
                try {
                    if (remainingContext <= 0) {
                        appendToPrompt(`\n[Context budget exhausted - PDF skipped: ${file.name}]`);
                        truncationResults.push({
                            filename: file.name,
                            originalSize: 0,
                            truncatedSize: 0,
                            truncated: true,
                            percentage: 0,
                            strategy: 'skipped'
                        });
                        continue;
                    }
                    const fileBuffer = await readFileFS(getWorkspaceFilePath(file));
                    const parseModule: any = await import('pdf-parse');
                    const parser = parseModule?.default?.default ?? parseModule?.default ?? parseModule;
                    if (typeof parser !== 'function') {
                        throw new Error('pdf-parse module did not resolve to a function');
                    }
                    const data = await parser(fileBuffer);
                    const pdfText = data.text;
                    const pdfBlock = `\n\n=== CONTENT OF PDF: ${file.name} ===\n${pdfText}\n=== END OF PDF ===\n`;

                    // P3-CONTEXT-BUDGET: Apply smart truncation if needed
                    const strategy = getTruncationStrategy('pdf');
                    const availableSpace = remainingContext - 100; // Reserve space for markers

                    if (pdfBlock.length > availableSpace) {
                        const result = strategy.truncate(pdfText, availableSpace);
                        const truncatedBlock = `\n\n=== CONTENT OF PDF: ${file.name} (truncated) ===\n${result.content}\n=== END OF PDF ===\n`;
                        appendToPrompt(truncatedBlock);

                        truncationResults.push({
                            filename: file.name,
                            originalSize: pdfText.length,
                            truncatedSize: result.content.length,
                            truncated: result.truncated,
                            percentage: result.percentage,
                            strategy: strategy.name
                        });
                    } else {
                        appendToPrompt(pdfBlock);
                        truncationResults.push({
                            filename: file.name,
                            originalSize: pdfText.length,
                            truncatedSize: pdfText.length,
                            truncated: false,
                            percentage: 100,
                            strategy: 'none'
                        });
                    }
                } catch (e) {
                    console.error(`Error parsing PDF ${file.name}:`, e);
                }
            } else {
                const textLikeExts = new Set([
                    'txt', 'md', 'markdown', 'json', 'jsonl', 'csv', 'log',
                    'ts', 'tsx', 'js', 'jsx', 'css', 'scss', 'html', 'xml',
                    'yml', 'yaml'
                ]);
                const textLikeTypes = new Set([
                    'text', 'markdown', 'md', 'json', 'jsonl', 'csv', 'log',
                    'ts', 'tsx', 'js', 'jsx', 'css', 'scss', 'html', 'xml',
                    'yml', 'yaml'
                ]);

                if (textLikeExts.has(ext) || textLikeTypes.has(file.type)) {
                    try {
                        if (remainingContext <= 0) {
                            appendToPrompt(`\n[Context budget exhausted - file skipped: ${file.name}]`);
                            truncationResults.push({
                                filename: file.name,
                                originalSize: 0,
                                truncatedSize: 0,
                                truncated: true,
                                percentage: 0,
                                strategy: 'skipped'
                            });
                            continue;
                        }
                        const textContent = await readFileFS(getWorkspaceFilePath(file), 'utf-8');
                        const block = `\n\n=== CONTENT OF FILE: ${file.name} ===\n${textContent}\n=== END OF FILE ===\n`;

                        // P3-CONTEXT-BUDGET: Apply smart truncation based on file type
                        const strategy = getTruncationStrategy(ext);
                        const availableSpace = remainingContext - 100; // Reserve space for markers

                        if (block.length > availableSpace) {
                            const result = strategy.truncate(textContent, availableSpace);
                            const truncatedBlock = `\n\n=== CONTENT OF FILE: ${file.name} (truncated via ${strategy.name} strategy) ===\n${result.content}\n=== END OF FILE ===\n`;
                            appendToPrompt(truncatedBlock);

                            truncationResults.push({
                                filename: file.name,
                                originalSize: textContent.length,
                                truncatedSize: result.content.length,
                                truncated: result.truncated,
                                percentage: result.percentage,
                                strategy: strategy.name
                            });

                            console.log(`✂️ Truncated ${file.name} using ${strategy.name} strategy (${result.percentage}% retained)`);
                        } else {
                            appendToPrompt(block);
                            truncationResults.push({
                                filename: file.name,
                                originalSize: textContent.length,
                                truncatedSize: textContent.length,
                                truncated: false,
                                percentage: 100,
                                strategy: 'none'
                            });
                        }
                    } catch (e) {
                        console.error(`Error reading file ${file.name}:`, e);
                    }
                }
            }
        }

        // P3-CONTEXT-BUDGET: Generate truncation report
        const truncationReport = generateTruncationReport(truncationResults);
        if (truncationReport.truncatedFiles.length > 0) {
            console.log(`📊 Truncation Report: ${truncationReport.truncatedFiles.length}/${truncationReport.totalFiles} files truncated`);
            console.log(`   Average retention: ${100 - truncationReport.totalTruncatedPercentage}%`);
            if (truncationReport.recommendation) {
                console.log(`   💡 ${truncationReport.recommendation}`);
            }
        }

        if (AI_CONFIG.provider === 'github-copilot') {
            const copilotTools = normalizeFunctionDeclarations(tools[0]?.functionDeclarations || []);
            const copilotAttachments = (await Promise.all(
                Array.from(new Set(fileIds)).map(id => prisma.workspaceFile.findUnique({ where: { id } }))
            ))
                .filter((file): file is NonNullable<typeof file> => Boolean(file))
                .filter(file => file.type !== 'folder')
                .map(file => ({
                    type: 'file' as const,
                    path: getWorkspaceFilePath(file),
                    displayName: file.name
                }));

            const deniedToolReasons = new Map<string, 'tool-execution-disabled' | 'high-risk'>();
            let toolUsed = '';
            let toolArgs: Record<string, unknown> | undefined;
            let lastToolResult: unknown;

            const runCopilot = async (toolExecutionAllowed: boolean) => sendCopilotMessage({
                model: resolveModelId(options?.model, getProviderDefaultModel('fast')),
                prompt: typeof promptParts[0] === 'string' ? promptParts[0] : effectiveQuery,
                systemInstruction,
                attachments: copilotAttachments,
                tools: copilotTools,
                availableToolNames: copilotTools.map(tool => tool.name),
                workingDirectory: process.cwd(),
                allowToolExecution: toolExecutionAllowed,
                allowHighRiskExecution,
                isHighRiskTool: (toolName) => getToolRisk(toolName) === 'high',
                executeTool: async (name, args) => executeAction(name, args),
                onDeniedTool: (toolName, reason) => {
                    if (!deniedToolReasons.has(toolName)) {
                        deniedToolReasons.set(toolName, reason);
                    }
                },
                onEvent: (event) => {
                    if (event.type === 'tool.execution_complete') {
                        toolUsed = typeof event.data.toolName === 'string' ? event.data.toolName : '';
                        toolArgs = event.data.arguments && typeof event.data.arguments === 'object'
                            ? event.data.arguments as Record<string, unknown>
                            : undefined;
                        lastToolResult = event.data.result;
                    }
                }
            });

            let assistantMessage = await runCopilot(allowToolExecution);
            const deniedTools = Array.from(deniedToolReasons.keys());

            if (!allowToolExecution && deniedTools.length > 0) {
                if (isHtmlCreateOnly(deniedTools) || isSafeEditOnly(deniedTools) || isLowRiskTools(deniedTools)) {
                    deniedToolReasons.clear();
                    assistantMessage = await runCopilot(true);
                }
            }

            const finalDeniedTools = Array.from(deniedToolReasons.keys());
            if (finalDeniedTools.length > 0) {
                const highRiskTools = finalDeniedTools.filter(tool => deniedToolReasons.get(tool) === 'high-risk');
                return {
                    success: true,
                    text: `${buildPlanSummary(finalDeniedTools, effectiveQuery)}\n\nReply "yes" to approve running: ${finalDeniedTools.join(', ') || 'these tools'}.`,
                    toolResult: {
                        requiresApproval: true,
                        proposedTools: finalDeniedTools,
                        highRiskTools: highRiskTools.length > 0 ? highRiskTools : undefined
                    }
                };
            }

            return {
                success: true,
                text: assistantMessage?.data?.content || '',
                toolUsed: toolUsed || undefined,
                toolArgs,
                toolResult: lastToolResult ? deepSerialize(lastToolResult) : undefined
            };
        }

        if (!genAI) return { success: false, message: 'API Key missing' };
        const model = genAI.getGenerativeModel({ model: selectedModel, systemInstruction, tools });
        const chat = model.startChat({
            history: history
        });

        let currentState = await chat.sendMessage(promptParts);
        let currentResponse = await currentState.response;
        let calls = currentResponse.functionCalls();
        let toolUsed = '';
        let toolArgs: any = null;
        let lastToolResult: any = null;
        let maxTurns = 5; // Prevent infinite loops

        // COGNITIVE LAYER: Capture initial thoughts
        try {
            const initialText = currentResponse.text();
            console.log('🧠 Initial AI Response:', initialText);
            const thoughtMatch = initialText.match(/<thinking>([\s\S]*?)<\/thinking>/);
            if (thoughtMatch && thoughtMatch[1]) {
                const thoughtContent = thoughtMatch[1].trim();
                await logAgentActivity({
                    type: 'info',
                    title: '🤔 Cognitive Process',
                    message: thoughtContent.length > 300 ? thoughtContent.substring(0, 300) + '...' : thoughtContent,
                    userId: demoUser?.id || 'system',
                    sessionId: sessionId
                });
            }
        } catch (e) {
            // Ignore text errors if only function calls are returned
            console.log('⚠️ No text in initial response, only tool calls');
        }

        let specialToolResult: any = null;
        let specialToolName: string | null = null;

        if ((!calls || calls.length === 0) && !allowToolExecution && shouldResearch(query)) {
            return {
                success: true,
                text: 'I can run search_web to gather context. Reply "yes" to allow tool use, or provide more details.',
                toolResult: { requiresApproval: true, proposedTools: ['search_web'] }
            };
        }

        // Detect simple conversations (greetings/questions) vs actions
        const isSimpleConversation = (q: string, hasFiles: boolean) => {
            if (hasFiles) return false;
            const lower = q.toLowerCase();
            const startsWithIntro = /^(hi|hello|hey|greetings|what|how|why|who|when|where|can you|could you|tell me|explain|help|are you)\b/i.test(lower);
            const containsAction = /\b(create|build|make|generate|write|edit|update|delete|organize|move|copy|analyze|search|find|extract|calculate|review)\b/i.test(lower);

            // "How do I create..." is simple info. "Create..." is an action.
            if (startsWithIntro && /explain|how to|what is|why is/i.test(lower)) return true;
            return startsWithIntro && !containsAction;
        };

        if ((!calls || calls.length === 0) && !allowToolExecution && !isSimpleConversation(query, fileIds.length > 0)) {
            const finalCandidate = currentResponse.text ? currentResponse.text() : '';
            // If it's an action query but no tools called, ask for approval instead of queueing.
            const isQuestion = finalCandidate.trim().endsWith('?') || /\b(which|where|do you want|should i)\b/i.test(finalCandidate.toLowerCase());

            if (finalCandidate && (isApprovalRequest(finalCandidate) || !isQuestion)) {
                return {
                    success: true,
                    text: `${buildPlanSummary([], query)}\n\nReply "yes" to let me execute the plan now.`,
                    toolResult: { requiresApproval: true }
                };
            }
        }

        if (calls && calls.length > 0) {
            const proposedTools = calls.map(call => call.name);
            const highRiskTools = proposedTools.filter(tool => getToolRisk(tool) === 'high');

            if (highRiskTools.length > 0 && !allowHighRiskExecution) {
                return {
                    success: true,
                    text: `${buildPlanSummary(proposedTools, effectiveQuery)}\n\nReply "yes" to approve running: ${highRiskTools.join(', ') || 'these tools'}.`,
                    toolResult: { requiresApproval: true, proposedTools, highRiskTools }
                };
            }

            if (!allowToolExecution) {
                if (isHtmlCreateOnly(proposedTools) || isSafeEditOnly(proposedTools) || isLowRiskTools(proposedTools)) {
                    allowToolExecution = true;
                } else {
                    return {
                        success: true,
                        text: `${buildPlanSummary(proposedTools, effectiveQuery)}\n\nReply "yes" to approve running: ${proposedTools.join(', ') || 'these tools'}.`,
                        toolResult: { requiresApproval: true, proposedTools }
                    };
                }
            }
        }


        while (calls && calls.length > 0 && maxTurns > 0) {
            console.log(`🔧 Tool calls detected (Turn ${6 - maxTurns}):`, calls.map(c => c.name));
            toolUsed = calls[0].name;
            const toolResults = [];

            for (const call of calls) {
                const scoped = scopeToolArgsForActiveApp(call.name, call.args, activeAppRoot);
                if (scoped.error) {
                    const scopedError = { success: false, message: scoped.error };
                    toolResults.push({ functionResponse: { name: call.name, response: scopedError } } as any);
                    lastToolResult = scopedError;
                    continue;
                }

                call.args = scoped.args;
                let res;
                logWithTrace(traceContext, `Tool execution started: ${call.name}`, { args: call.args });
                console.log(`🎯 Executing skill: ${call.name} [Trace: ${traceId}]`);

                // For editing tools, capture the content for client-side preview if needed
                if (call.name === 'edit_file' || call.name === 'create_markdown_file') {
                    toolArgs = call.args;
                }

                // Create skill context
                const skillContext = {
                    userId: demoUser?.id || '',
                    fileIds: Array.from(resolvedFileIds),
                    query: effectiveQuery,
                    lastResponse: getLastAssistantText(),
                    workspaceFiles: allFiles,
                    traceId // Added P3-OBSERVABILITY traceId
                };

                // Execute skill with intelligent context
                res = await executeSkill(call.name, call.args, skillContext);
                lastToolResult = res;

                // Capture special tools to force UI triggers (like HTML preview)
                if (call.name === 'create_html_file' && res.success) {
                    specialToolName = 'create_html_file';
                    specialToolResult = res;
                }

                // If skill unknown, try basic tool execution
                if (!res.success && res.error && res.error.includes('Unknown skill')) {
                    console.log(`🔧 Skill not found, attempting tool execution: ${call.name}`);
                    const toolRes = await executeWithRetry(call.name, call.args, traceContext);
                    if (toolRes.success || toolRes.message !== `Action ${call.name} not found`) {
                        res = toolRes;
                    }

                    // Check again for special tool after fallback execution
                    if (call.name === 'create_html_file' && res.success) {
                        specialToolName = 'create_html_file';
                        specialToolResult = res;
                    }
                }

                const resultSummary = {
                    success: res.success,
                    message: (typeof (res as any).message === 'string' && (res as any).message.length > 500)
                        ? (res as any).message.substring(0, 500) + '...'
                        : (res as any).message,
                    error: res.error
                };
                logWithTrace(traceContext, `Tool execution finished: ${call.name}`, resultSummary);
                console.log(`✅ Result for ${call.name} [Trace: ${traceId}]:`, resultSummary);

                if (demoUser) {
                    await logAgentActivity({
                        type: res.success ? 'success' : 'error',
                        title: `Executed: ${call.name}`,
                        message: (res as any).message || (res.success ? 'Action completed' : 'Action failed'),
                        toolUsed: call.name,
                        userId: demoUser.id,
                        sessionId: sessionId
                    });
                }

                toolResults.push({ functionResponse: { name: call.name, response: res } } as any);
            }

            console.log('📨 Sending tool results back to AI...');
            try {
                currentState = await chat.sendMessage(toolResults as any);
                currentResponse = await currentState.response;
                calls = currentResponse.functionCalls();
                maxTurns--;
            } catch (err: any) {
                console.error('💥 AI Error during tool feedback loop:', err);

                // graceful recovery: if tools were executed successfully, we should not fail the whole request
                if (toolResults.length > 0) {
                    console.log('⚠️ Recovering from AI error because tools were executed.');
                    maxTurns = 0; // Stop loop
                    calls = undefined;
                    // Provide a fallback response so the UI knows work was done
                    return {
                        success: true,
                        text: `✅ Actions executed successfully (Files created/modified).\n\n(Note: The AI session timed out during confirmation, but your changes are saved.)`,
                        toolUsed: toolResults[0]?.functionResponse?.name || toolUsed,
                        toolResult: specialToolResult || toolResults[0]?.functionResponse?.response,
                        agentActivity: true
                    };
                }
                throw err;
            }
        }

        let finalText = currentResponse.text();

        // Match thinking block (Support XML, Markdown, and common headers)
        const thoughtMatch = finalText.match(/(?:<thinking>|```thinking|Intelligence Trace:)\n?([\s\S]*?)(?:<\/thinking>|```|$)/i);

        if (thoughtMatch && thoughtMatch[1] && demoUser) {
            await logAgentActivity({
                type: 'info',
                title: 'Cognitive Process',
                message: thoughtMatch[1].trim(),
                toolUsed: 'reasoning',
                userId: demoUser.id,
                sessionId: sessionId
            });
        }

        // Clean output: Remove all thinking markers
        finalText = finalText.replace(/(?:<thinking>|```thinking|Intelligence Trace:)[\s\S]*?(?:<\/thinking>|```|$)/gi, '').trim();
        // Hide internal IDs from user-facing text
        finalText = finalText
            .replace(/\bID:\s*[a-zA-Z0-9_-]+\b/g, '')
            .replace(/\bID\s*[#:]\s*[a-zA-Z0-9_-]+\b/g, '')
            .replace(/\bfile id\s*[:#]?\s*[a-zA-Z0-9_-]+\b/gi, 'file');

        // If response is empty but we have a thought, use it as fallback
        if (!finalText && !toolUsed && !specialToolName) {
            if (thoughtMatch && thoughtMatch[1]) {
                finalText = "I've analyzed your request and prepared a plan. You can see my reasoning in the Intelligence Trace above.";
            } else {
                finalText = 'I have completed the processing step.';
            }
        }

        // Sanitize response: filter out malformed responses like a single closing brace 
        // which sometimes happens when the model hallucinates a JSON termination
        if (finalText.trim() === '}' || finalText.trim() === ']]>') {
            console.warn('⚠️ AI returned malformed termination character. Using fallback success message.');
            finalText = '✅ Processing complete. Task has been organized as requested.';
        }

        // Send the thought block separately for UI rendering
        const responseObj: any = {
            success: true,
            text: (finalText && finalText.trim() !== '') ? finalText : '',
            thinking: thoughtMatch && thoughtMatch[1] ? thoughtMatch[1].trim() : undefined,
            toolUsed: specialToolName || toolUsed || undefined,
            toolResult: deepSerialize(specialToolResult || lastToolResult || undefined)
        };

        if (toolArgs) responseObj.toolArgs = deepSerialize(toolArgs);

        // P3-CONTEXT-BUDGET: Include truncation report if available
        if (typeof truncationReport !== 'undefined' && truncationReport && truncationReport.truncatedFiles.length > 0) {
            responseObj.truncationReport = truncationReport;
        }

        return deepSerialize(responseObj);
    } catch (error) {
        console.error('💥 chatWithAI error:', error);
        return { success: false, message: error instanceof Error ? error.message : 'AI failed' };
    }
}

/**
 * Streaming version of chatWithAI using Vercel AI SDK
 * Returns a streamable value that can be consumed on the client
 */
export async function chatWithAIStream(
    query: string,
    fileIds: string[] = [],
    history: { role: 'user' | 'model'; parts: { text: string }[] }[] = [],
    currentFolder?: string,
    currentFolderId?: string,
    options?: { sessionId?: string; allowToolExecution?: boolean; agentMode?: 'chat' | 'tool-agent' }
) {
    return {
        success: false,
        message: 'Streaming is not enabled in this build. Use chatWithAI for responses.'
    };
}

export async function syncWorkspaceFiles() {
    console.log("🔄 Starting File Sync...");

    // 1. Get User
    const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
    if (!user) {
        return { success: false, message: "Demo user not found" };
    }

    const uploadsDir = join(process.cwd(), 'public', 'uploads');

    // Helper to process a directory
    async function processDirectory(dirPath: string, parentId: string | null = null, relativePrefix: string = '') {
        try {
            const items = await readdir(dirPath);

            for (const item of items) {
                // Skip system files
                if (item.startsWith('.')) continue;

                const fullPath = join(dirPath, item);
                const stats = await stat(fullPath);

                if (stats.isDirectory()) {
                    // Special handling for _root_ - contents are "root" level (parentId: null)
                    if (item === '_root_' && parentId === null) {
                        // Don't create a folder record for _root_, just dive in with parentId=null
                        await processDirectory(fullPath, null, '_root_');
                    } else {
                        // Regular folder - check if exists in DB, else create
                        // Fallback for non-ID upsert
                        let f = await prisma.workspaceFile.findFirst({
                            where: { name: item, parentId: parentId, userId: user!.id, type: 'folder' }
                        });

                        if (!f) {
                            f = await prisma.workspaceFile.create({
                                data: {
                                    name: item,
                                    type: 'folder',
                                    userId: user!.id,
                                    parentId: parentId
                                }
                            });
                            console.log(`📁 Created folder: ${item}`);
                        }

                        // Recurse
                        await processDirectory(fullPath, f.id, relativePrefix ? `${relativePrefix}/${item}` : item);
                    }
                } else {
                    // File
                    const extension = item.split('.').pop() || 'file';
                    const storagePath = relativePrefix ? `${relativePrefix}/${item}` : item;

                    const existing = await prisma.workspaceFile.findFirst({
                        where: {
                            name: item,
                            parentId: parentId,
                            userId: user!.id
                        }
                    });

                    if (existing) {
                        // Update stats
                        await prisma.workspaceFile.update({
                            where: { id: existing.id },
                            data: {
                                size: `${stats.size} bytes`,
                                storagePath: storagePath,
                                type: extension // Ensure type is correct
                            }
                        });
                    } else {
                        await prisma.workspaceFile.create({
                            data: {
                                name: item,
                                type: extension,
                                size: `${stats.size} bytes`,
                                userId: user!.id,
                                parentId: parentId,
                                storagePath: storagePath
                            }
                        });
                        console.log(`🆕 Registered New File: ${item}`);
                    }
                }
            }
        } catch (e) {
            // Directory might not exist or permission error
            // console.warn(`Skipping ${dirPath}:`, e.message);
        }
    }

    await processDirectory(uploadsDir, null, '');
    safeRevalidatePath('/');
    return { success: true, message: "Workspace files synced successfully." };
}

export async function suggestStrategies(data: { objective: string }) {
    try {
        const prompt = `
        You are a Strategic Planning AI.
        OBJECTIVE: ${data.objective}

        Propose 3 distinct, valid strategies to achieve this objective.
        1. **Fast / MVP**: The quickest way to get a result.
        2. **Robust / Best Practice**: The high-quality, professional engineering approach.
        3. **Creative / Innovation**: An alternative approach that uses unique tools or lateral thinking.

        Ensure tools mentioned actually exist in our library (search_web, create_file, etc.).

        Return ONLY valid JSON with this exact structure (no extra text):
        {"strategies":[{"id":"string","name":"string","description":"string","pros":["string"],"cons":["string"],"riskLevel":"string","estimatedDuration":"string","keyTools":["string"]}]}
        `;

        const text = await generateAIText(prompt, { purpose: 'smart' });
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const suggestion = JSON.parse(jsonMatch ? jsonMatch[0] : text);

        return {
            success: true,
            message: "Generated 3 strategic paths. Please select one to proceed.",
            strategies: suggestion.strategies,
            isAwaitingInput: true, // Signal UI to show selection
            inputContext: {
                type: 'strategy_selection',
                objective: data.objective
            }
        };

    } catch (error) {
        console.error('Strategy generation failed:', error);
        return { success: false, message: 'Failed to generate strategies' };
    }
}

export async function approveAgentJob(jobId: string) {
    try {
        await prisma.agentJob.update({
            where: { id: jobId },
            data: {
                approved: true,
                approvedAt: new Date(),
                status: 'queued' // Ensure it's ready for pickup
            }
        });
        ensureAgentWorkerAvailable().catch(err => console.error('Worker bootstrap failed:', err));
        return { success: true };
    } catch (error) {
        console.error('Failed to approve job:', error);
        return { success: false, message: 'Failed to approve job' };
    }
}

export async function cancelAllAgentJobs() {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        await prisma.agentJob.updateMany({
            where: {
                userId: user.id,
                status: { in: ['queued', 'running'] }
            },
            data: {
                status: 'failed',
                error: 'Cancelled by user'
            }
        });

        // Log the activity
        await prisma.agentActivity.create({
            data: {
                type: 'warning',
                title: 'Agents Halted',
                message: 'All active and queued agent jobs were manually cancelled by the user.',
                userId: user.id
            }
        });

        return { success: true };
    } catch (error) {
        console.error('Failed to cancel jobs:', error);
        return { success: false, message: 'Failed to cancel agent jobs' };
    }
}

// ------------------------------------------------------------------
// NEW ANTIGRAVITY TOOLS IMPLEMENTATION
// ------------------------------------------------------------------

async function resolvePath(input: string, useAbsolute: boolean): Promise<string> {
    if (useAbsolute || input.includes('/') || input.includes('\\')) {
        return resolve(input);
    }
    // Fallback: try to resolve as File ID (Legacy support)
    // For now, if we can't find a DB record, we assume it's a relative path from cwd
    return resolve(process.cwd(), input);
}

export async function viewFile(args: { fileId: string, startLine?: number, endLine?: number, useAbsolutePath?: boolean }) {
    try {
        const filePath = await resolvePath(args.fileId, args.useAbsolutePath || false);
        const content = await readFileFS(filePath, 'utf-8');
        const lines = content.split('\n');

        const start = (args.startLine || 1) - 1;
        const end = args.endLine ? args.endLine : (start + 500); // 500 line default limit

        const snippet = lines.slice(start, end).join('\n');
        const totalLines = lines.length;

        return {
            success: true,
            path: filePath,
            content: snippet,
            meta: {
                totalLines,
                viewingLines: `${start + 1}-${Math.min(end, totalLines)}`
            }
        };
    } catch (e: any) {
        return { success: false, message: `Failed to read file: ${e.message}` };
    }
}

export async function listDir(args: { path: string, recursive?: boolean }) {
    try {
        const targetPath = resolve(process.cwd(), args.path);
        const entries = await readdir(targetPath, { withFileTypes: true });

        const result = entries.map(e => ({
            name: e.name,
            type: e.isDirectory() ? 'dir' : 'file',
            path: join(args.path, e.name)
        }));

        // Limit to 100 entries to avoid token explosion
        const truncated = result.slice(0, 100);

        return {
            success: true,
            entries: truncated,
            total: result.length,
            isTruncated: result.length > 100
        };
    } catch (e: any) {
        return { success: false, message: `Failed to list directory: ${e.message}` };
    }
}

export async function replaceInFile(args: { fileId: string, target: string, replacement: string, useAbsolutePath?: boolean }) {
    try {
        const filePath = await resolvePath(args.fileId, args.useAbsolutePath || false);
        const content = await readFileFS(filePath, 'utf-8');

        if (content.indexOf(args.target) === -1) {
            return { success: false, message: `Target text not found in file: ${filePath}. Please verify whitespace.` };
        }

        // Exact replacement
        if (content.split(args.target).length > 2) {
            return { success: false, message: `Target text is not unique (found multiple times). Please provide more context in the target string.` };
        }

        const newContent = content.replace(args.target, args.replacement);
        await writeFile(filePath, newContent);

        return { success: true, message: `Successfully updated ${filePath}` };
    } catch (e: any) {
        return { success: false, message: `Editor error: ${e.message}` };
    }
}

export async function searchCodebase(args: { query: string, dir?: string, extensions?: string[] }) {
    try {
        // Naive Node implementation for portability
        const rootDir = resolve(process.cwd(), args.dir || './src');
        const results: any[] = [];

        async function walk(dir: string) {
            if (results.length > 20) return; // Hard limit
            const list = await readdir(dir, { withFileTypes: true });
            for (const item of list) {
                const fullPath = join(dir, item.name);
                if (item.isDirectory()) {
                    if (item.name !== 'node_modules' && item.name !== '.git') {
                        await walk(fullPath);
                    }
                } else {
                    if (args.extensions && !args.extensions.some(ext => item.name.endsWith(ext))) continue;

                    const content = await readFileFS(fullPath, 'utf-8');
                    if (content.includes(args.query) || new RegExp(args.query).test(content)) {
                        results.push({
                            file: fullPath.replace(process.cwd(), ''),
                            match: 'Found pattern' // simplified for now
                        });
                    }
                }
            }
        }

        await walk(rootDir);
        return { success: true, count: results.length, matches: results };

    } catch (e: any) {
        return { success: false, message: `Search failed: ${e.message}` };
    }
}

export async function runTerminalCommand(args: { command: string, cwd?: string, background?: boolean }) {
    try {
        const targetCwd = args.cwd ? resolve(process.cwd(), args.cwd) : process.cwd();

        // Validate directory exists
        const fs = require('fs');
        if (!fs.existsSync(targetCwd)) {
            return {
                success: false,
                stdout: '',
                stderr: `Directory does not exist: ${targetCwd}`,
                message: `Directory does not exist: ${targetCwd}. Check if the path is correct. For apps in the 'apps/' folder, use 'apps/appname' as the cwd.`
            };
        }

        const options: any = {
            cwd: targetCwd,
            shell: true, // Required for Windows to properly spawn cmd.exe
            windowsHide: true
        };
        console.log(`$> Running: ${args.command} in ${options.cwd}`);

        if (args.background) {
            exec(args.command, options); // Fire and forget
            return { success: true, message: "Command execution started in background." };
        }

        const { stdout, stderr } = await execAsync(args.command, options);
        return {
            success: true,
            stdout,
            stderr
        };
    } catch (e: any) {
        return { success: false, stdout: e.stdout || '', stderr: e.stderr || '', message: `Command failed: ${e.message}` };
    }
}

export async function executeCommandInApp(args: { appName: string, command: string, background?: boolean }) {
    try {
        const user = await getCoreDemoUser();
        // Search by name (Repo App adev, Docker Container adev, etc.)
        const proc = await prisma.processRegistry.findFirst({
            where: {
                userId: user.id,
                OR: [
                    { name: { contains: args.appName } },
                    { path: { contains: args.appName } }
                ]
            }
        });

        if (!proc) return { success: false, message: `Application "${args.appName}" not found in process registry.` };

        if (isDockerProcess(proc)) {
            const containerName = (proc.metadata as any)?.containerName;
            if (!containerName) return { success: false, message: "Container name not found in app metadata" };

            // For Docker, we use 'docker exec' to run inside the container
            const dockerCmd = `docker exec ${containerName} ${args.command}`;
            console.log(`🐳 Executing in Docker Container (${containerName}): ${args.command}`);
            return await runTerminalCommand({ command: dockerCmd, background: args.background });
        } else {
            // For Local apps, we use the app's path as CWD
            console.log(`💻 Executing in Local App (${proc.name}) at ${proc.path}: ${args.command}`);
            return await runTerminalCommand({ command: args.command, cwd: proc.path, background: args.background });
        }
    } catch (e: any) {
        return { success: false, message: `Failed to execute command in app: ${e.message}` };
    }
}

export async function getAppLogs(args: { appName: string, limit?: number }) {
    try {
        const user = await getCoreDemoUser();
        const proc = await prisma.processRegistry.findFirst({
            where: {
                userId: user.id,
                OR: [
                    { name: { contains: args.appName } },
                    { path: { contains: args.appName } }
                ]
            }
        });

        if (!proc) return { success: false, message: `Application "${args.appName}" not found.` };

        if (isDockerProcess(proc)) {
            const containerName = (proc.metadata as any)?.containerName;
            if (!containerName) return { success: false, message: "Container name not found in metadata" };

            const { stdout, stderr } = await execAsync(`docker logs --tail ${args.limit || 100} ${containerName}`);
            return { success: true, logs: stdout + stderr };
        } else {
            // Local logs - if we don't have a log file, we might not be able to get them easily
            // unless they were captured by a manager. For now, return a placeholder or try to read from a standard location if known.
            return { success: false, message: "Log retrieval for local (non-docker) processes is not yet implemented." };
        }
    } catch (e: any) {
        return { success: false, message: `Failed to get logs: ${e.message}` };
    }
}

export async function applyBatch(args: { fileId: string, edits: { target: string, replacement: string }[], useAbsolutePath?: boolean }) {
    try {
        const filePath = await resolvePath(args.fileId, args.useAbsolutePath || false);
        const originalContent = await readFileFS(filePath, 'utf-8');
        let currentContent = originalContent;
        const diffs = [];

        for (const edit of args.edits) {
            if (currentContent.indexOf(edit.target) === -1) {
                return { success: false, message: `Target text not found for edit: "${edit.target.substring(0, 50)}..." in ${filePath}` };
            }

            if (currentContent.split(edit.target).length > 2) {
                return { success: false, message: `Target text is not unique for edit: "${edit.target.substring(0, 50)}..."` };
            }

            currentContent = currentContent.replace(edit.target, edit.replacement);
            diffs.push({
                target: edit.target,
                replacement: edit.replacement
            });
        }

        await writeFile(filePath, currentContent);

        return {
            success: true,
            message: `Successfully applied ${args.edits.length} edits to ${filePath}`,
            filePath,
            diffs
        };
    } catch (e: any) {
        return { success: false, message: `Batch editor error: ${e.message}` };
    }
}

type UnifiedHunk = {
    oldStart: number;
    oldCount: number;
    newStart: number;
    newCount: number;
    lines: string[];
};

const parseUnifiedDiff = (patch: string): UnifiedHunk[] => {
    const lines = patch.split('\n');
    const hunks: UnifiedHunk[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const match = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/.exec(line);
        if (!match) {
            i += 1;
            continue;
        }

        const oldStart = Number(match[1]);
        const oldCount = Number(match[2] || '1');
        const newStart = Number(match[3]);
        const newCount = Number(match[4] || '1');

        i += 1;
        const hunkLines: string[] = [];
        while (i < lines.length && !lines[i].startsWith('@@')) {
            hunkLines.push(lines[i]);
            i += 1;
        }

        hunks.push({ oldStart, oldCount, newStart, newCount, lines: hunkLines });
    }

    return hunks;
};

const applyUnifiedDiff = (content: string, patch: string): { content: string; error?: string } => {
    const hunks = parseUnifiedDiff(patch);
    if (!hunks.length) {
        return { content, error: 'No hunks found in patch.' };
    }

    const originalLines = content.split('\n');
    let offset = 0;

    for (const hunk of hunks) {
        const startIndex = Math.max(0, hunk.oldStart - 1 + offset);
        let ptr = startIndex;
        const replacement: string[] = [];

        for (const line of hunk.lines) {
            if (line.startsWith('\\')) {
                continue; // Ignore "\ No newline" markers
            }
            const marker = line[0];
            const text = line.slice(1);

            if (marker === ' ') {
                if (originalLines[ptr] !== text) {
                    return { content, error: `Patch context mismatch at line ${ptr + 1}.` };
                }
                replacement.push(text);
                ptr += 1;
            } else if (marker === '-') {
                if (originalLines[ptr] !== text) {
                    return { content, error: `Patch removal mismatch at line ${ptr + 1}.` };
                }
                ptr += 1;
            } else if (marker === '+') {
                replacement.push(text);
            }
        }

        originalLines.splice(startIndex, ptr - startIndex, ...replacement);
        offset += replacement.length - (ptr - startIndex);
    }

    return { content: originalLines.join('\n') };
};

export async function applyPatch(args: { filePath: string, patch: string }) {
    try {
        if (!args?.filePath || !args?.patch) {
            return { success: false, message: 'filePath and patch are required.' };
        }

        const isAbsolute = path.isAbsolute(args.filePath);
        const resolvedPath = isAbsolute ? args.filePath : resolve(process.cwd(), args.filePath);
        const originalContent = await readFileFS(resolvedPath, 'utf-8');
        const result = applyUnifiedDiff(originalContent, args.patch);

        if (result.error) {
            return { success: false, message: result.error };
        }

        await writeFile(resolvedPath, result.content);
        return { success: true, message: `Patch applied to ${resolvedPath}`, filePath: resolvedPath };
    } catch (e: any) {
        return { success: false, message: `Patch apply error: ${e.message}` };
    }
}
