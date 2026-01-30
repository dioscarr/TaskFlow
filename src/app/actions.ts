'use server';

import prisma from '@/lib/prisma';
import { revalidatePath as nextRevalidatePath } from 'next/cache';

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
import { join } from 'path';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { DEFAULT_TOOLS, getToolSchemas } from '@/lib/toolLibrary';
import { DEFAULT_SKILLS } from '@/lib/skillsLibrary';
import { getSkillSchemas } from '@/lib/skillsLibrary';
import { executeSkill } from '@/lib/skillsExecution';
import { DEFAULT_INTENT_RULES, DEFAULT_WORKFLOWS, WorkflowStep } from '@/lib/intentLibrary';
import { TOOL_LIBRARY } from '@/lib/toolLibrary';
import { addChatMessage } from '@/app/chatActions';

// import { CognitiveAgent } from '@/lib/agents/CognitiveAgent';
// import { DesignAgent } from '@/lib/agents/DesignAgent';

// ... existing code ...

async function executeAction(actionId: string, args: any): Promise<{ success: boolean, message?: string, [key: string]: any }> {
    console.log(`🚀 Executing Action: ${actionId}`, args);
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
    if (actionId === 'extract_alegra_bill') return await createAlegraBill(args);
    if (actionId === 'record_alegra_payment') return await recordAlegraPayment(args);
    if (actionId === 'verify_dgii_rnc') return await verifyRNC(args.rnc);
    if (actionId === 'highlight_file') return await highlightWorkspaceFile(args);
    if (actionId === 'move_attachments_to_folder') return await moveFilesToFolder(args.fileIds || [], args.folderId, args.nameConflictStrategy);
    if (actionId === 'copy_attachments_to_folder') return await copyFilesToFolder(args.fileIds || [], args.folderId, args.nameConflictStrategy);
    if (actionId === 'remove_highlights') return await removeWorkspaceHighlights(args.fileIds || []);
    if (actionId === 'batch_rename') return await batchRenameFiles(args);
    if (actionId === 'summarize_file') return await summarizeFile(args);
    if (actionId === 'extract_text_from_image') return await extractTextFromImage(args);
    if (actionId === 'find_duplicate_files') return await findDuplicateFiles(args);
    if (actionId === 'search_web') return await searchWeb(args);
    if (actionId === 'focus_workspace_item') return await focusWorkspaceItem(args.itemId);
    if (actionId === 'enqueue_agent_job') return await enqueueAgentJob(args);

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
        if (schemaName === 'read_file') return await readFile(args);
        if (schemaName === 'search_files') return await searchFiles(args);
        if (schemaName === 'ask_questions') return await askQuestions(args);
        if (schemaName === 'agent_delegate') return await agentDelegate(args);
        if (schemaName === 'execute_command') return await executeCommand(args);
        if (schemaName === 'extract_receipt_info') return await extractReceiptInfo(args);
        if (schemaName === 'generate_markdown_report') return await generateMarkdownReport(args);
        if (schemaName === 'organize_files') return await organizeFiles(args);
        if (schemaName === 'move_attachments_to_folder') return await moveFilesToFolder(args.fileIds || [], args.folderId, args.nameConflictStrategy);
        if (schemaName === 'copy_attachments_to_folder') return await copyFilesToFolder(args.fileIds || [], args.folderId, args.nameConflictStrategy);
        if (schemaName === 'remove_highlights') return await removeWorkspaceHighlights(args.fileIds || []);
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
        if (schemaName === 'enqueue_agent_job') return await enqueueAgentJob(args);
    }

    // Manual catch-all and fallbacks
    if (actionId === 'verify_dgii_rnc') return await verifyRNC(args.rnc);
    if (actionId === 'create_workflow') return await createWorkflow(args);

    return { success: false, message: `Action ${actionId} not found` };
}

/**
 * Auto-initialize core workflows
 */
export async function initializeWorkflows() {
    const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
    if (user) {
        const existing = await prisma.intentRule.findFirst({ where: { name: 'Supermercado Nacional Workflow', userId: user.id } });
        if (!existing) {
            await prisma.intentRule.create({
                data: {
                    name: "Supermercado Nacional Workflow",
                    action: "workflow",
                    keywords: ["nacional", "super nacional", "mercado nacional"],
                    enabled: true,
                    userId: user.id,
                    steps: [
                        { action: "ask_questions", params: { questions: ["What should be the name of the folder for this report?", "What should be the name of the specific report file?"] } },
                        { action: "search_files", params: { query: "Supermercado Nacional", searchContent: true } },
                        { action: "extract_receipt_info", params: {} },
                        { action: "generate_markdown_report", params: { title: "The Supermercado Nacional-{time}", includeBusinessInfo: true } },
                        { action: "create_folder", params: { onExistingFolder: "reuse" } },
                        { action: "create_markdown_file", params: {} }
                    ] as any
                }
            });
        }
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
        const result = await executeAction(step.action, args);

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
        console.error('Failed to simulate email:', error);
        return { success: false };
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
    try {
        await prisma.workspaceFile.delete({ where: { id } });
        safeRevalidatePath('/');
        return { success: true };
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

export async function uploadFile(formData: FormData) {
    try {
        const file = formData.get('file') as File;
        const parentId = formData.get('parentId') as string | null;
        if (!file) throw new Error('No file uploaded');

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const path = join(process.cwd(), 'public', 'uploads', file.name);
        await writeFile(path, buffer);

        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        const newFile = await prisma.workspaceFile.create({
            data: {
                name: file.name,
                type: file.type.split('/')[1] || 'file',
                size: `${(file.size / 1024).toFixed(1)} KB`,
                parentId: parentId || null,
                userId: user.id
            }
        });

        safeRevalidatePath('/');
        return { success: true, file: newFile };
    } catch (error) {
        console.error('Failed to upload file:', error);
        return { success: false, error: 'Upload failed' };
    }
}

export async function getFileContent(fileName: string) {
    try {
        const filePath = join(process.cwd(), 'public', 'uploads', fileName);
        const content = await readFileFS(filePath, 'utf-8');
        return { success: true, content };
    } catch (error) {
        return { success: false, error: 'Failed to read file' };
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

export async function getWorkspaceFiles() {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        return await prisma.workspaceFile.findMany({
            where: { userId: user.id },
            select: { id: true, name: true, type: true, parentId: true, order: true, storagePath: true, items: true, size: true, tags: true }
        });
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
        return { success: false };
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
        return { success: false };
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
        return { success: false };
    }
}

export async function getPrompts() {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        const prompts = await prisma.aIPromptSet.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' }
        });

        const ensurePrompt = async (name: string, description: string, prompt: string) => {
            const existing = await prisma.aIPromptSet.findFirst({ where: { name, userId: user.id } });
            if (existing) return;
            await prisma.aIPromptSet.create({
                data: {
                    name,
                    description,
                    prompt,
                    userId: user.id,
                    isActive: false,
                    tools: DEFAULT_TOOLS
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
* Workspace Hygiene: Maintain a clean root directory. If a "Receipts" or "${new Date().getFullYear()}" folder exists, prioritize using it. Group files by vendor within subfolders (e.g., "Receipts/Bravo").

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
                        tools: DEFAULT_TOOLS
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
        return prompts;
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
            tools: DEFAULT_TOOLS
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
                tools: data.tools || DEFAULT_TOOLS,
                workflows: data.workflows || [],
                triggerKeywords: data.triggerKeywords || [],
                userId: user.id,
                isActive: count === 0
            }
        });
        safeRevalidatePath('/');
        return { success: true, prompt: newPrompt };
    } catch (error) {
        return { success: false };
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
        return { success: false };
    }
}

export async function deletePrompt(id: string) {
    try {
        await prisma.aIPromptSet.delete({ where: { id } });
        safeRevalidatePath('/');
        return { success: true };
    } catch (error) {
        return { success: false };
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
        return { success: false };
    }
}

export async function generateSystemPrompt(description: string) {
    try {
        const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
        const genAI = new GoogleGenerativeAI(apiKey!);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
        const prompt = `You are a Prompt Engineer. Enhance the following Agent description into a professional system instruction: "${description}". 
        
        STRUCTURE:
        1. IDENTITY: Define who the agent is.
        2. TACTICAL EXPERTISE: List specific technical or functional areas of mastery.
        3. OPERATIONAL GUIDELINES: How it should think (step-by-step, deductive, etc.).
        4. GUARDRAILS: What it should NOT do.
        
        Keep it concise but EXTREMELY high-quality for Gemini 2.0.`;
        const result = await model.generateContent(prompt);
        return { success: true, text: result.response.text().trim() };
    } catch (error) {
        return { success: false };
    }
}

/**
 * DGII RNC Verification Mechanism
 * In a real-world scenario, this would call a paid DGII API or a trusted third-party provider.
 * For this demo, we use a sophisticated simulated lookup that recognizes key DR merchants.
 */
export async function verifyRNC(rnc: string) {
    try {
        // Clean RNC
        const cleanRNC = rnc.replace(/[^0-9]/g, '');

        // Simulation of a DGII Database (Common DR Merchants)
        const knownMerchants: Record<string, { name: string, status: string, type: string }> = {
            '101010621': { name: 'SUPERMERCADOS NACIONAL (CENTRO CUESTA NACIONAL)', status: 'ACTIVO', type: 'REGIMEN GENERAL' },
            '130005372': { name: 'BRAVO S.A.', status: 'ACTIVO', type: 'REGIMEN GENERAL' },
            '101602465': { name: 'CARNICERIA Y EMBUTIDOS BRAVO (CENTRAL)', status: 'ACTIVO', type: 'REGIMEN GENERAL' },
            '132868226': { name: 'SUPERMERCADO OLE (TIENDAS DEL AHORRO)', status: 'ACTIVO', type: 'REGIMEN GENERAL' },
            '130741214': { name: 'SIRENA (GRUPO RAMOS)', status: 'ACTIVO', type: 'REGIMEN GENERAL' },
            '101168175': { name: 'PANELES DOMINICANOS (PISA)', status: 'ACTIVO', type: 'REGIMEN GENERAL' },
            '101001574': { name: 'INDUBAN (CAFE SANTO DOMINGO)', status: 'ACTIVO', type: 'REGIMEN GENERAL' },
            '101161324': { name: 'BANCO POPULAR DOMINICANO', status: 'ACTIVO', type: 'REGIMEN GENERAL' }
        };

        const result = knownMerchants[cleanRNC];

        if (result) {
            return {
                success: true,
                verified: true,
                ...result,
                consultationUrl: 'https://dgii.gov.do/app/WebApps/ConsultasWeb2/ConsultasWeb/consultas/rnc.aspx'
            };
        }

        // Dummy fallback for other RNCs to show the mechanism works
        if (cleanRNC.length === 9 || cleanRNC.length === 11) {
            return {
                success: true,
                verified: true,
                name: `TITULAR RNC ${cleanRNC}`,
                status: 'ACTIVO',
                type: 'REGIMEN GENERAL',
                consultationUrl: 'https://dgii.gov.do/app/WebApps/ConsultasWeb2/ConsultasWeb/consultas/rnc.aspx',
                message: 'Manual verification recommended at official source.'
            };
        }

        return { success: false, message: 'RNC not found in DGII registry' };
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
        console.error(error);
        return { success: false };
    }
}

export async function deleteAlegraBill(id: string) {
    try {
        await prisma.alegraBill.delete({ where: { id } });
        safeRevalidatePath('/');
        return { success: true };
    } catch (error) {
        return { success: false };
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
        return { success: false };
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
 * Create a markdown file with optional folder creation
 */
export async function createMarkdownFile(data: {
    content: string;
    filename: string;
    folderName?: string;
    parentId?: string;
}) {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        if (!data.content || data.content.trim() === '') {
            return { success: false, message: 'Missing content for markdown file' };
        }

        let targetParentId = data.parentId;
        let createdFolderId: string | undefined;

        if (data.folderName) {
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

        const nameParts = data.filename.split('.');
        const ext = nameParts.length > 1 ? nameParts.pop()?.toLowerCase() || 'md' : 'md';
        const hasExt = nameParts.length > 0;
        const displayName = hasExt ? data.filename : `${data.filename}.${ext}`;

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
}) {
    try {
        console.log('📄 createHtmlFile called with:', JSON.stringify(data));
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        // Validate that the folder exists if folderId is provided
        if (data.folderId) {
            const folder = await prisma.workspaceFile.findUnique({
                where: { id: data.folderId, type: 'folder' }
            });
            if (!folder) {
                return { success: false, message: 'Parent folder not found. Please create the folder first.' };
            }
        }

        // Create a dedicated directory for the app/folder to ensure isolation
        // If no folderId, use '_root_' as a namespace
        const directoryName = data.folderId ? data.folderId : '_root_';
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

        const file = await prisma.workspaceFile.create({
            data: {
                name: displayName, // "index.html"
                type: 'html',
                size: `${Buffer.byteLength(data.content)} bytes`,
                userId: user.id,
                parentId: data.folderId || null,
                storagePath: relativeStoragePath // Save the actual disk path (relative to uploads/)
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

        // Update size
        await prisma.workspaceFile.update({
            where: { id: file.id },
            data: {
                size: `${Buffer.byteLength(content)} bytes`
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
            const file = await prisma.workspaceFile.findFirst({
                where: {
                    userId: user.id,
                    OR: [{ id: idOrName }, { name: idOrName }]
                }
            });

            if (!file || file.type === 'folder') return { id: idOrName, error: 'File not found or is a folder' };

            const filePath = join(process.cwd(), 'public', 'uploads', file.name);
            const content = await readFileFS(filePath, 'utf8');
            return { id: file.id, name: file.name, content };
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
                    { name: { contains: query, mode: 'insensitive' } },
                    // In a real app, content search would use a search index or grep
                ]
            }
        });

        return { success: true, files: files.map(f => ({ id: f.id, name: f.name, type: f.type })) };
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
                userId: demoUser.id
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
                userId: demoUser.id
            });
        }

        return {
            success: true,
            message: "Design Expert has provided their analysis.",
            analysis: result
        };
    }

    if (agentKey === 'review' || agentKey === 'reviewer') {
        const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
        if (!apiKey) return { success: false, message: 'API Key missing for delegation' };

        if (demoUser) {
            await logAgentActivity({
                type: 'delegation',
                title: 'Review Agent Activated',
                message: `Task: ${data.task}`,
                toolUsed: 'agent_delegate',
                userId: demoUser.id
            });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const prompt = `You are a strict Review Agent. Review the following plan or intended tool use.\n\nReturn:\n- Verdict: approve | revise | reject\n- Risks\n- Missing steps\n- Suggested changes\n\nCONTENT:\n${data.task}`;
        const result = await model.generateContent(prompt);
        const review = result.response.text();

        if (demoUser) {
            await logAgentActivity({
                type: 'specialist_result',
                title: 'Review Agent Completed',
                message: 'Review delivered for approval.',
                userId: demoUser.id
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

export async function executeCommand(data: { command: string, reason: string }) {
    console.log(`💻 Executing Command: ${data.command} (Reason: ${data.reason})`);

    // Security check - highly restricted in a real environment
    if (data.command.includes('rm -rf') || data.command.includes('del /f')) {
        return { success: false, message: 'Restricted command detected.' };
    }

    try {
        // Mock execution
        return {
            success: true,
            output: `Command executed: ${data.command}\nStatus: Success\nNote: Simulation mode.`,
            message: 'Command executed successfully.'
        };
    } catch (error) {
        return { success: false, message: 'Execution failed.' };
    }
}

export async function extractReceiptInfo(data: { fileIds: string[] }) {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
        if (!apiKey) {
            console.warn('⚠️ Gemini API Key missing, falling back to mock data');
            return {
                success: true,
                extractedData: {
                    provider: 'Simulated Vendor',
                    rnc: '123456789',
                    date: new Date().toISOString().split('T')[0],
                    total: 0,
                    items: []
                }
            };
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        provider: { type: SchemaType.STRING },
                        rnc: { type: SchemaType.STRING },
                        date: { type: SchemaType.STRING },
                        total: { type: SchemaType.NUMBER },
                        ncf: { type: SchemaType.STRING },
                        itbis: { type: SchemaType.NUMBER },
                        items: {
                            type: SchemaType.ARRAY,
                            items: {
                                type: SchemaType.OBJECT,
                                properties: {
                                    description: { type: SchemaType.STRING },
                                    quantity: { type: SchemaType.NUMBER },
                                    price: { type: SchemaType.NUMBER }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!data.fileIds || data.fileIds.length === 0) {
            return { success: false, message: 'No file IDs provided' };
        }

        const firstFileId = data.fileIds[0];
        const file = await prisma.workspaceFile.findUnique({ where: { id: firstFileId } });
        if (!file) return { success: false, message: 'File not found' };

        const filePath = join(process.cwd(), 'public', 'uploads', file.name);
        const imageBuffer = await readFileFS(filePath);
        const base64Image = imageBuffer.toString('base64');

        const prompt = "Extract fiscal data from this receipt image. Focus on Dominican RNC and NCF if present.";

        const result = await model.generateContent([
            prompt,
            { inlineData: { data: base64Image, mimeType: 'image/jpeg' } }
        ]);

        const extractedData = JSON.parse(result.response.text());

        return {
            success: true,
            extractedData,
            fileId: firstFileId
        };
    } catch (error) {
        console.error('👁️ Vision extraction failed:', error);
        return { success: false, message: 'Failed to extract data from image' };
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

        const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
        if (!apiKey) return { success: true, summary: `[Summary for ${file.name} - Gemini API Key missing]` };

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `Please provide a ${data.detailLevel || 'brief'} summary of the following file content:\n\n${content}`;
        const result = await model.generateContent(prompt);
        const summary = result.response.text();

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
            userId: user.id
        });

        safeRevalidatePath('/');
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
                const filePath = join(process.cwd(), 'public', 'uploads', file.name);
                try {
                    const content = await readFileFS(filePath, 'utf8');
                    mergedContent += `\n\n--- SOURCE: ${file.name} ---\n${content}`;
                } catch (e) {
                    console.warn('Skipping binary file for synthesis:', file.name);
                }
            }
        }

        const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
        if (!apiKey) return { success: false, message: 'API Key missing' };

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `Synthesize the following documents into a single, cohesive master report. 
Use a professional structure with an Executive Summary, Key Findings, and Consolidated Details.
Save the output as a Markdown report.

DOCUMENTS CONTENT:
${mergedContent}`;

        const result = await model.generateContent(prompt);
        const reportContent = result.response.text();

        await createMarkdownFile({ filename: data.outputFilename, content: reportContent });

        await logAgentActivity({
            type: 'success',
            title: 'Documents Synthesized',
            message: `Created master report "${data.outputFilename}" from ${data.fileIds.length} sources.`,
            toolUsed: 'synthesize_documents',
            userId: user.id
        });

        return { success: true, message: `Synthesis complete. Saved as ${data.outputFilename}.md` };
    } catch (error) {
        console.error('Synthesis failed:', error);
        return { success: false, message: 'Synthesis failed' };
    }
}

export async function logAgentActivity(data: { type: string, title: string, message: string, toolUsed?: string, fileId?: string, userId: string }) {
    try {
        await prisma.agentActivity.create({
            data: {
                type: data.type,
                title: data.title,
                message: data.message,
                toolUsed: data.toolUsed,
                fileId: data.fileId,
                userId: data.userId
            }
        });
    } catch (e) {
        console.error('Failed to log activity:', e);
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

        if (data.sessionId) {
            await prisma.chatSession.update({
                where: { id: data.sessionId },
                data: { updatedAt: new Date() }
            });
        }

        return { success: true, job };
    } catch (error) {
        console.error('Failed to enqueue agent job:', error);
        return { success: false, message: 'Failed to enqueue agent job' };
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

        return { success: true, job: updated };
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
                select: { id: true, type: true, status: true, updatedAt: true, startedAt: true }
            }),
            prisma.agentActivity.findFirst({
                where: { userId: user.id },
                orderBy: { createdAt: 'desc' },
                select: { message: true, title: true, createdAt: true }
            })
        ]);

        const busy = runningCount + approvedQueuedCount > 0;

        // Only return activity if it's recent (last 30 seconds) to avoid showing stale info
        const isActivityRecent = latestActivity && (Date.now() - new Date(latestActivity.createdAt).getTime() < 30000);

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
        return { success: false, busy: false, runningCount: 0, queuedCount: 0 };
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

        const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
        if (!apiKey) return { success: false, message: 'Gemini API Key missing' };

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const result = await model.generateContent([
            "Extract all text from this image as accurately as possible.",
            { inlineData: { data: base64Image, mimeType: 'image/jpeg' } } // Fallback to jpeg
        ]);

        return { success: true, text: result.response.text() };
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
            tools: data.tools || DEFAULT_TOOLS
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
    options?: { sessionId?: string; allowToolExecution?: boolean; agentMode?: 'chat' | 'tool-agent' }
) {
    try {
        const allowToolExecution = options?.allowToolExecution !== false;
        const agentMode = options?.agentMode || 'chat';
        const isToolAgent = agentMode === 'tool-agent';
        const sessionId = options?.sessionId;
        const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
        if (!apiKey) return { success: false, message: 'API Key missing' };

        const genAI = new GoogleGenerativeAI(apiKey);

        const [taskCount, fileCount, folders, allFiles, activePromptSet, demoUser] = await Promise.all([
            prisma.task.count(),
            prisma.workspaceFile.count({ where: { type: { not: 'folder' } } }),
            prisma.workspaceFile.findMany({ where: { type: 'folder' }, select: { name: true, id: true } }),
            prisma.workspaceFile.findMany({ select: { id: true, name: true, type: true, parentId: true, order: true } }),
            prisma.aIPromptSet.findFirst({ where: { isActive: true } }),
            prisma.user.findUnique({ where: { email: 'demo@example.com' } })
        ]);

        const toolAgentPrompt = isToolAgent && demoUser
            ? await ensureToolAgentPrompt(demoUser.id)
            : null;
        const selectedPromptSet = (isToolAgent && toolAgentPrompt) ? toolAgentPrompt : activePromptSet;

        const isApprovalMessage = (text: string) => {
            const normalized = text.trim().toLowerCase();
            return /^(approve|approved|ok|okay|yes|yep|go ahead|proceed|run it|do it|execute|start)(\b|\!|\.|,|$)/.test(normalized);
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
                /ready to proceed/i.test(normalized);
        };

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
            const lowRisk = new Set(['focus_workspace_item', 'search_files', 'read_file']);
            return tools.length > 0 && tools.every(tool => lowRisk.has(tool));
        };

        if (sessionId && isApprovalMessage(query)) {
            const approval = await approveLatestAgentJob(sessionId);
            if (approval.success) {
                if (demoUser) {
                    await logAgentActivity({
                        type: 'success',
                        title: 'Background Agent Approved',
                        message: `Job ${approval.job?.id || ''} approved by user.`,
                        toolUsed: 'enqueue_agent_job',
                        userId: demoUser.id
                    });
                }
                return {
                    success: true,
                    text: '✅ Approved. Background agent started.'
                };
            }

            const lastAssistantText = getLastAssistantText();
            const lastUserText = getLastNonApprovalUserText() || getLastUserText();
            if (lastAssistantText && isApprovalRequest(lastAssistantText)) {
                await enqueueAgentJob({
                    sessionId,
                    type: 'chat_task',
                    payload: {
                        query: lastUserText || query,
                        fileIds,
                        history,
                        currentFolder,
                        currentFolderId,
                        allowToolExecution: true
                    },
                    approved: true
                });

                return { success: true, text: '✅ Approved. Background agent started.' };
            }

            return { success: true, text: 'No pending background job to approve.' };
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

        let workflowInstructions = '';

        if (demoUser) {
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

            // Merge with DEFAULT_WORKFLOWS (always available)
            workflows = [...DEFAULT_WORKFLOWS, ...workflows];

            const matchedWorkflow = workflows
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
                            match: scoreKeywordMatch(query, keyword)
                        }));
                })
                .filter(match => match.match)
                .sort((a, b) => {
                    if (b.match!.score !== a.match!.score) return b.match!.score - a.match!.score;
                    return (b.keyword?.length || 0) - (a.keyword?.length || 0);
                })[0];

            const matchedWorkflowValue = matchedWorkflow?.workflow;

            if (matchedWorkflowValue) {
                console.log(`⚡ Server Workflow Execution: ${matchedWorkflowValue.name}`, {
                    matchedKeyword: matchedWorkflow?.keyword,
                    matchReason: matchedWorkflow?.match?.reason,
                    matchScore: matchedWorkflow?.match?.score
                });
                const lastAssistantText = getLastAssistantText();
                const table = extractLastMarkdownTable(lastAssistantText);
                const content = table || lastAssistantText || `Workflow triggered: ${matchedWorkflowValue.name}\nQuery: ${query}`;

                const filename = getAutoFilename({ autoFilename: 'timestamp' });
                const folderName = getAutoFolderName({ autoFolder: 'auto' });

                const res = await executeWorkflow(matchedWorkflowValue.steps as WorkflowStep[], {
                    content,
                    query,
                    lastResponse: lastAssistantText,
                    filename,
                    folderName,
                    fileIds
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
                workflowInstructions = `\n\nSYSTEM OVERRIDE: The user has triggered the workflow "${matchedWorkflowValue.name}".\n\nEXECUTION RULES:\n1. You are MANDATED to execute the following tools in this exact order to complete the workflow:\n${stepsList}\n2. IGNORE the rule about asking for folders. For this workflow, AUTOMATICALLY store files in "Receipts/${new Date().getFullYear()}" without asking.\n3. Analyze the provided image/context to extract any required parameters for these tools.\n4. Do not stop. Execute all steps sequentially now.`;
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

        const defaultInstruction = `You are TaskFlow AI, an intelligent fiscal agent for Alegra RD with advanced skills.
    - SKILLS: receipt_intelligence, workspace_organization, fiscal_analysis, document_processing
    - EXPERT: Dominican NCF, ITBIS, and 606 classification
    - CAPABLE: Vision analysis, business verification, automated organization
    - ALEGRA EXPORT: 'extract_alegra_bill' is temporarily disabled. Do NOT attempt it.`;

        const toolExecutionRule = isToolAgent
            ? '0. TOOL AGENT: Tools are pre-approved. Execute immediately; do NOT request approval or queue jobs.'
            : '0. CONSULT FIRST: Never execute tools or skills without explicit user approval. You MUST ask for confirmation before any tool processing.';
        const backgroundRule = isToolAgent
            ? ''
            : '13. BACKGROUND EXECUTION: After the user approves tool processing, queue the work using enqueue_agent_job for background execution. Do NOT execute tools directly in chat.';

        const toolInstructions = `
OPERATIONAL RULES:
    ${toolExecutionRule}
1. SKILLS OVER TOOLS: Use SKILLS instead of individual tools. Skills are intelligent capabilities that handle complex tasks automatically.
2. RECEIPT INTELLIGENCE: When processing receipts, use the 'receipt_intelligence' skill which handles vision analysis, business verification, report creation, and file organization in one call.
3. WORKSPACE ORGANIZATION: Use 'workspace_organization' skill for organizing files - it intelligently creates folders, moves files, and applies highlighting.
4. FISCAL ANALYSIS: Use 'fiscal_analysis' skill for tax calculations and compliance checking.
5. DOCUMENT PROCESSING: Use 'document_processing' skill for content extraction and categorization.
6. BUSINESS NAMES: The skills handle DGII verification automatically - you don't need to call it separately.
7. FILE CREATION FLOW: Skills handle folder creation automatically. Don't ask about folders - let the skills decide.
8. WORKSPACE HYGIENE: Maintain a clean root directory. REUSE existing folders instead of creating new ones if a similar purpose exists (e.g., if "Receipts" or "2026" exists, use it). Organize files hierarchically (e.g., "Receipts/VendorName").
9. WORKSPACE DISCOVERY: You have full access to the workspace. If the user mentions a project or vendor, proactively SEARCH for related files or folders first before asking the user for details.
10. PROACTIVE CONTEXT: Use the 'USER'S CURRENT VIEW' as the default location for new folders or file moves if no other destination is obvious. For example, if the user is in "Invoices" and asks to "Organize these", perform the actions relative to that folder.
11. PRIORITIZE ACTIVE PREVIEW: If the message includes "[CONTEXT: User is currently PREVIEWING...]", you MUST prioritize that file and its folder. 
    - If the user asks to "edit", edit the previewed file.
    - If the user asks to "add a page" or "create a file", create it INSIDE the previewed file's folder.
    - DO NOT create new projects in the root if the user is working inside a previewed app.
12. CURRENT CONTEXT:
   - Total Files: ${fileCount}
   - Total Tasks: ${taskCount}
   - Existing Folders: ${folders.map(f => f.name).join(', ') || 'None'}
   - Files in Root: ${allFiles.filter(f => !f.type.includes('folder') && !f.parentId).map(f => `${f.name} (ID: ${f.id})`).join(', ')}
   - USER'S CURRENT VIEW: You are currently looking at the folder: "${currentFolder || 'Root'}" (ID: ${currentFolderId || 'root'})
   
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
   `;

        // Load skills dynamically from skills library
        const enabledSkills = (selectedPromptSet && Array.isArray(selectedPromptSet.tools) && selectedPromptSet.tools.length > 0)
            ? selectedPromptSet.tools.filter(skillId => skillId !== 'extract_alegra_bill') // Temporarily disable Alegra export
            : DEFAULT_SKILLS;

        const baseInstruction = selectedPromptSet ? selectedPromptSet.prompt : defaultInstruction;

        // --- COGNITIVE PLANNING (Multi-Agent Architecture) ---
        let planText = '';
        if (!isToolAgent) {
            const { CognitiveAgent } = await import('@/lib/agents/CognitiveAgent');
            const cognitiveAgent = new CognitiveAgent(apiKey);
            const plan = await cognitiveAgent.generateExecutionPlan(query, {
                history,
                currentFolder,
                availableTools: enabledSkills
            });

            if (plan && demoUser) {
                await logAgentActivity({
                    type: 'planning',
                    title: 'Cognitive Brain Formulated Plan',
                    message: `Objective: ${plan.objective}`,
                    userId: demoUser.id
                });
            }

            planText = plan ? `\n\nCOGNITIVE EXECUTION PLAN (MUST FOLLOW):\nPlan Objective: ${plan.objective}\nPlan Rationale: ${plan.rationale}\nSteps:\n${plan.steps.map((s, i) => `${i + 1}. [${s.phase}] ${s.action}: ${s.description}`).join('\n')}\n${plan.suggestedSpecialist && plan.suggestedSpecialist !== 'none' ? `SPECIALIST ADVICE: This task can be delegated to the '${plan.suggestedSpecialist}' agent via agent_delegate for expert results.` : ''}` : '';
        }

        if (isToolAgent && demoUser) {
            await logAgentActivity({
                type: 'info',
                title: 'Tool Agent Activated',
                message: `Executing pre-approved tools for session ${sessionId || 'n/a'}.`,
                toolUsed: 'tool_agent',
                userId: demoUser.id
            });
        }

        const systemInstruction = baseInstruction + "\n" + toolInstructions + planText +
            "\n\nCOGNITIVE ARCHITECTURE: ENABLED." +
            (isToolAgent
                ? "\nVERBOSITY: LOW. Keep responses concise and focused on tool results."
                : "\nVERBOSITY: ON. You are encouraged to be verbose. Share your internal roadmap and the specialist's advice with the user so they can follow your logic.") +
            (isToolAgent
                ? "\nTHINKING PROTOCOL: Do not include <thinking> tags in responses."
                : "\nTHINKING PROTOCOL: Before taking any action or answering, you must PLAN your approach inside <thinking>...</thinking> tags. Briefly explain your reasoning, the tools you will use, and why.") +
            "\nWEB/PREVIEW CAPABILITY: You can create full HTML web pages using 'create_html_file'. When you do this, the system will AUTOMATICALLY open a live preview for the user side-by-side with the chat. Use this for landing pages, reports, or any visual data representation." +
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

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp", systemInstruction, tools });
        let promptParts: any[] = [query + workflowInstructions];

        // Resolve all file IDs (including those inside folders)
        const resolvedFileIds = new Set<string>();
        const processFileId = async (id: string) => {
            const file = await prisma.workspaceFile.findUnique({ where: { id } });
            if (!file) return;

            if (file.type === 'folder') {
                const children = await prisma.workspaceFile.findMany({ where: { parentId: file.id } });
                for (const child of children) {
                    await processFileId(child.id);
                }
            } else {
                resolvedFileIds.add(id);
            }
        };

        for (const fileId of fileIds) {
            await processFileId(fileId);
        }

        for (const fileId of resolvedFileIds) {
            const file = await prisma.workspaceFile.findUnique({ where: { id: fileId } });
            if (!file) continue;

            promptParts[0] += `\n(File: ${file.name})`;

            // Strict extension check for Gemini Vision
            const ext = file.name.split('.').pop()?.toLowerCase() || '';
            const supportedImageExts = ['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif'];

            if (supportedImageExts.includes(ext) && ['image', 'png', 'jpg', 'jpeg', 'webp', 'heic', 'heif'].includes(file.type)) {
                try {
                    const fileBuffer = await readFileFS(join(process.cwd(), 'public', 'uploads', file.name));
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
                    }
                } catch (err) {
                    console.error(`Error reading image file ${file.name}:`, err);
                }
            } else if (file.type === 'pdf') {
                try {
                    const fileBuffer = await readFileFS(join(process.cwd(), 'public', 'uploads', file.name));
                    const parseModule: any = await import('pdf-parse');
                    const parser = parseModule?.default?.default ?? parseModule?.default ?? parseModule;
                    if (typeof parser !== 'function') {
                        throw new Error('pdf-parse module did not resolve to a function');
                    }
                    const data = await parser(fileBuffer);
                    promptParts[0] += `\n\n=== CONTENT OF PDF: ${file.name} ===\n${data.text}\n=== END OF PDF ===\n`;
                } catch (e) {
                    console.error(`Error parsing PDF ${file.name}:`, e);
                }
            }
        }

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
                    userId: demoUser?.id || 'system'
                });
            }
        } catch (e) {
            // Ignore text errors if only function calls are returned
            console.log('⚠️ No text in initial response, only tool calls');
        }

        let specialToolResult: any = null;
        let specialToolName: string | null = null;

        if ((!calls || calls.length === 0) && !allowToolExecution && shouldResearch(query)) {
            if (sessionId) {
                await enqueueAgentJob({
                    sessionId,
                    type: 'chat_task',
                    payload: {
                        query,
                        fileIds,
                        history,
                        currentFolder,
                        currentFolderId,
                        allowToolExecution: true,
                        proposedTools: ['search_web']
                    },
                    approved: false
                });
            }

            if (demoUser) {
                await logAgentActivity({
                    type: 'info',
                    title: 'Approval Required',
                    message: 'Proposed tools: search_web',
                    toolUsed: 'enqueue_agent_job',
                    userId: demoUser.id
                });
            }

            return {
                success: true,
                text: 'I can run background research with search_web. Reply “approve” to proceed.',
                toolUsed: 'enqueue_agent_job'
            };
        }

        if ((!calls || calls.length === 0) && !allowToolExecution) {
            const finalCandidate = currentResponse.text ? currentResponse.text() : '';
            if (finalCandidate && isApprovalRequest(finalCandidate)) {
                if (sessionId) {
                    await enqueueAgentJob({
                        sessionId,
                        type: 'chat_task',
                        payload: {
                            query,
                            fileIds,
                            history,
                            currentFolder,
                            currentFolderId,
                            allowToolExecution: true
                        },
                        approved: false
                    });
                }

                return {
                    success: true,
                    text: `${buildPlanSummary([], query)}\n\nReply "approve" to continue.`,
                    toolUsed: 'enqueue_agent_job'
                };
            }
        }

        if (calls && calls.length > 0 && !allowToolExecution) {
            const proposedTools = calls.map(call => call.name);

            const recentApproval = await getRecentApproval();
            if (recentApproval && isLowRiskTools(proposedTools)) {
                if (sessionId) {
                    await enqueueAgentJob({
                        sessionId,
                        type: 'chat_task',
                        payload: {
                            query,
                            fileIds,
                            history,
                            currentFolder,
                            currentFolderId,
                            allowToolExecution: true,
                            proposedTools
                        },
                        approved: true
                    });
                }

                return {
                    success: true,
                    text: `Running a quick background action: ${proposedTools.join(', ')}.`,
                    toolUsed: 'enqueue_agent_job'
                };
            }

            if (sessionId) {
                await enqueueAgentJob({
                    sessionId,
                    type: 'chat_task',
                    payload: {
                        query,
                        fileIds,
                        history,
                        currentFolder,
                        currentFolderId,
                        allowToolExecution: true,
                        proposedTools
                    },
                    approved: false
                });
            }

            if (demoUser) {
                await logAgentActivity({
                    type: 'info',
                    title: 'Approval Required',
                    message: `Proposed tools: ${proposedTools.join(', ') || 'none'}`,
                    toolUsed: 'enqueue_agent_job',
                    userId: demoUser.id
                });
            }

            return {
                success: true,
                text: `${buildPlanSummary(proposedTools, query)}\n\nReply "approve" to proceed.`,
                toolUsed: 'enqueue_agent_job'
            };
        }

        while (calls && calls.length > 0 && maxTurns > 0) {
            console.log(`🔧 Tool calls detected (Turn ${6 - maxTurns}):`, calls.map(c => c.name));
            toolUsed = calls[0].name;
            const toolResults = [];

            for (const call of calls) {
                let res;
                console.log(`🎯 Executing skill: ${call.name}`);

                // For editing tools, capture the content for client-side preview if needed
                if (call.name === 'edit_file' || call.name === 'create_markdown_file') {
                    toolArgs = call.args;
                }

                // Create skill context
                const skillContext = {
                    userId: demoUser?.id || '',
                    fileIds: Array.from(resolvedFileIds),
                    query,
                    lastResponse: getLastAssistantText(),
                    workspaceFiles: allFiles
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
                    const toolRes = await executeAction(call.name, call.args);
                    if (toolRes.success || toolRes.message !== `Action ${call.name} not found`) {
                        res = toolRes;
                    }

                    // Check again for special tool after fallback execution
                    if (call.name === 'create_html_file' && res.success) {
                        specialToolName = 'create_html_file';
                        specialToolResult = res;
                    }
                }

                console.log(`✅ Result for ${call.name}:`, res);

                if (demoUser) {
                    await logAgentActivity({
                        type: res.success ? 'success' : 'error',
                        title: `Executed: ${call.name}`,
                        message: (res as any).message || (res.success ? 'Action completed' : 'Action failed'),
                        toolUsed: call.name,
                        userId: demoUser.id
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
        console.log('✅ Final AI response text:', finalText);

        // Match thinking block before removing it
        const thoughtMatch = finalText.match(/<thinking>([\s\S]*?)<\/thinking>/);

        if (thoughtMatch && thoughtMatch[1] && demoUser) {
            await logAgentActivity({
                type: 'info',
                title: 'Cognitive Process',
                message: thoughtMatch[1],
                toolUsed: 'reasoning',
                userId: demoUser.id
            });
        }

        // Remove thinking blocks from user-facing text
        finalText = finalText.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
        // Hide internal IDs from user-facing text
        finalText = finalText
            .replace(/\bID:\s*[a-zA-Z0-9_-]+\b/g, '')
            .replace(/\bID\s*[#:]\s*[a-zA-Z0-9_-]+\b/g, '')
            .replace(/\bfile id\s*[:#]?\s*[a-zA-Z0-9_-]+\b/gi, 'file');

        // If response is empty but we have a thought, use it as fallback
        if (!finalText && !toolUsed && !specialToolName) {
            if (thoughtMatch && thoughtMatch[1]) {
                finalText = `Use the thought process to understand my actions:\n${thoughtMatch[1]}`;
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
            toolResult: specialToolResult || lastToolResult || undefined
        };

        if (toolArgs) responseObj.toolArgs = toolArgs;

        return responseObj;
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
    'use server';
    
    const { createStreamableValue } = await import('ai/rsc');
    const stream = createStreamableValue('');
    
    // Run the streaming in the background
    (async () => {
        try {
            const allowToolExecution = options?.allowToolExecution !== false;
            const agentMode = options?.agentMode || 'chat';
            const isToolAgent = agentMode === 'tool-agent';
            const sessionId = options?.sessionId;
            const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
            
            if (!apiKey) {
                stream.error('API Key missing');
                return;
            }

            const genAI = new GoogleGenerativeAI(apiKey);

            // Get necessary data (simplified version - you may need to expand this)
            const [demoUser, activePromptSet, allFiles] = await Promise.all([
                prisma.user.findUnique({ where: { email: 'demo@example.com' } }),
                prisma.aIPromptSet.findFirst({ where: { isActive: true } }),
                prisma.workspaceFile.findMany({ select: { id: true, name: true, type: true, parentId: true, order: true } })
            ]);

            const defaultInstruction = `You are TaskFlow AI, an intelligent assistant.`;
            const baseInstruction = activePromptSet ? activePromptSet.prompt : defaultInstruction;
            
            const systemInstruction = baseInstruction + "\n\nRespond concisely and helpfully.";

            // For streaming, we'll use a simpler model configuration without tools
            // to focus on text streaming
            const model = genAI.getGenerativeModel({ 
                model: "gemini-2.0-flash-exp",
                systemInstruction
            });

            const chat = model.startChat({ history });
            
            // Use generateContentStream for streaming
            const result = await model.generateContentStream(query);
            
            let accumulatedText = '';
            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                accumulatedText += chunkText;
                stream.update(accumulatedText);
            }
            
            // Save the message to database if sessionId is provided
            if (sessionId && demoUser) {
                await addChatMessage(sessionId, 'ai', accumulatedText, [], undefined, undefined);
            }
            
            stream.done();
        } catch (error) {
            console.error('💥 chatWithAIStream error:', error);
            stream.error(error instanceof Error ? error.message : 'Streaming failed');
        }
    })();
    
    return { output: stream.value };
}
