
'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { DEFAULT_TOOLS } from '@/lib/toolLibrary';
import { DEFAULT_SKILLS } from '@/lib/skillsLibrary';
import { getSkillSchemas } from '@/lib/skillsLibrary';
import { executeSkill } from '@/lib/skillsExecution';
import { DEFAULT_INTENT_RULES, matchesIntentRule, WorkflowStep } from '@/lib/intentLibrary';
import { TOOL_LIBRARY } from '@/lib/toolLibrary';

// ... existing code ...

async function executeAction(actionId: string, args: any): Promise<{ success: boolean, message?: string, [key: string]: any }> {
    console.log(`🚀 Executing Action: ${actionId}`, args);
    // Temporary bypass: skip Alegra export until pipeline is ready
    if (actionId === 'extract_alegra_bill') {
        return { success: true, skipped: true, silent: true, message: 'Alegra export temporarily disabled' };
    }
    
    // Internal Intents
    if (actionId === 'create_markdown_file') return await createMarkdownFile(args);
    if (actionId === 'create_task') return await createTask(args);
    if (actionId === 'create_folder') return await createFolder(args);
    if (actionId === 'extract_alegra_bill') return await createAlegraBill(args);
    if (actionId === 'record_alegra_payment') return await recordAlegraPayment(args);
    if (actionId === 'verify_dgii_rnc') return await verifyRNC(args.rnc);
    if (actionId === 'highlight_file') return await highlightWorkspaceFile(args);
    if (actionId === 'move_attachments_to_folder') return await moveFilesToFolder(args.fileIds || [], args.folderId);
    if (actionId === 'copy_attachments_to_folder') return await copyFilesToFolder(args.fileIds || [], args.folderId);

    // Tools from library
    const tool = TOOL_LIBRARY[actionId];
    if (tool) {
        // Many tools map to the same internal actions
        if (tool.schema.name === 'verify_dgii_rnc') return await verifyRNC(args.rnc);
        if (tool.schema.name === 'extract_alegra_bill') return await createAlegraBill(args);
        if (tool.schema.name === 'create_markdown_file') return await createMarkdownFile(args);
    }

    return { success: false, message: `Action ${actionId} not found` };
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

        if (mode === 'move') {
            console.log('🚚 Moving files...');
            const moveResult = await moveFilesToFolder(fileIds, folderId);
            console.log('🚚 Move result:', moveResult);
            context.filesMoved = moveResult;
            // Update context with moved file IDs for subsequent steps
            if (moveResult.movedFileIds && moveResult.movedFileIds.length > 0) {
                context.lastProcessedFileIds = moveResult.movedFileIds;
            }
            return moveResult;
        }

        console.log('📎 Copying files...');
        const copyResult = await copyFilesToFolder(fileIds, folderId);
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

        // If an action was skipped silently (e.g., Alegra export), avoid treating it as a user-facing tool use
        if (result.silent) {
            context.lastSkippedAction = step.action;
        }

        // Handle folder creation for subsequent steps
        if (step.action === 'create_folder' && result.success && result.folder) {
            console.log('✅ Folder created:', result.folder.name);
            // Set context.folderId for use in later steps like move_attachments_to_folder
            context.folderId = result.folder.id;
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
        revalidatePath('/');
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
        revalidatePath('/');
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
        revalidatePath('/');
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
        revalidatePath('/');
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

        revalidatePath('/');
        return { success: true, file: newFile };
    } catch (error) {
        console.error('Failed to create file:', error);
        return { success: false, error: 'Failed to create file' };
    }
}

export async function deleteFile(id: string) {
    try {
        await prisma.workspaceFile.delete({ where: { id } });
        revalidatePath('/');
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
        revalidatePath('/');
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

        revalidatePath('/');
        return { success: true, file: newFile };
    } catch (error) {
        console.error('Failed to upload file:', error);
        return { success: false, error: 'Upload failed' };
    }
}

export async function getFileContent(fileName: string) {
    try {
        const filePath = join(process.cwd(), 'public', 'uploads', fileName);
        const content = await readFile(filePath, 'utf-8');
        return { success: true, content };
    } catch (error) {
        return { success: false, error: 'Failed to read file' };
    }
}

export async function getWorkspaceFiles() {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        return await prisma.workspaceFile.findMany({
            where: { userId: user.id },
            select: { id: true, name: true, type: true }
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
        revalidatePath('/');
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
        revalidatePath('/');
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
        revalidatePath('/');
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

        if (prompts.length === 0) {
            const defaults = [
                {
                    name: "Dominican Receipt Expert",
                    description: "Analyzes DR receipts (Bravo, Nacional, etc.) for ITBIS, NCF, and RNC. Handles blurry and multi-part images.",
                    prompt: `**1. IDENTITY:** You are TaskFlow AI, an expert AI assistant specializing in precise data extraction from "Comprobantes Fiscales" (tax receipts) issued in the Dominican Republic. Your purpose is to identify and extract specific data points, nothing more.

**2. TACTICAL EXPERTISE:** You possess the following core capabilities:

*   **ITBIS Extraction:** Accurately identify and extract the *total* Impuesto sobre Transferencia de Bienes Industrializados y Servicios (ITBIS) amount from the document.
*   **Valid NCF Code Identification:** Locate and extract *only valid* Número de Comprobante Fiscal (NCF) codes. Valid codes *must* begin with one of the following prefixes: B01, B02, B11, B13, or E31.
*   **RNC/Cédula Extraction:** Identify and extract either the Registro Nacional de Contribuyentes (RNC) *or* the Cédula (personal ID) number. The extracted number *must* be exactly 9 or 11 digits in length.
*   **Official Business Verification:** When an RNC is detected, you must provide the official DGII verification link to confirm the business's legal name: https://dgii.gov.do/app/WebApps/ConsultasWeb2/ConsultasWeb/consultas/rnc.aspx.

**3. OPERATIONAL GUIDELINES:**

*   **Accuracy First:** Prioritize the accurate extraction of the specified data points above all else.
*   **Contextual Validation:** Leverage surrounding text and data fields within the document to confirm the accuracy of extracted values *before* outputting them.
*   **Verification Authority:** Treat the official DGII "Consulta RNC" portal as the ultimate source of truth. Always suggest that the user verify the "Razón Social" (Legal Name) using the provided URL to ensure the information matches the tax authority's records.
*   **Concise Output:** Present extracted data in a clear, structured, and easily digestible format. If a value cannot be definitively extracted, indicate "N/A".

**4. GUARDRAILS:**

*   **No Interpretation or Inference:** You are strictly prohibited from interpreting the meaning or purpose of the "Comprobante Fiscal" beyond the defined data extraction tasks.
*   **Document Type Restriction:** Focus *exclusively* on "Comprobantes Fiscales" from the Dominican Republic. Do not attempt to process any other document types.
*   **No Financial Advice:** Under no circumstances should you provide financial advice or opinions. Your sole function is data extraction.
*   **Data Privacy:** You are strictly forbidden from storing or sharing the contents of the analyzed documents outside the immediate scope of this task. Data privacy is paramount.`
                },
                {
                    name: "Code Reviewer",
                    description: "Analyzes code files for bugs, security, and optimization.",
                    prompt: `You are TaskFlow AI, a Senior Staff Engineer. Analyze technical files for architecture, security, and performance.`
                }
            ];

            for (const d of defaults) {
                await prisma.aIPromptSet.create({
                    // @ts-ignore
                    data: { ...d, userId: user.id, isActive: d.name.includes("Receipt"), workflows: [] }
                });
            }
            return await prisma.aIPromptSet.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
        }
        return prompts;
    } catch (error) {
        console.error('Failed to get prompts:', error);
        return [];
    }
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
        revalidatePath('/');
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
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        return { success: false };
    }
}

export async function deletePrompt(id: string) {
    try {
        await prisma.aIPromptSet.delete({ where: { id } });
        revalidatePath('/');
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
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        return { success: false };
    }
}

export async function generateSystemPrompt(description: string) {
    try {
        const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
        const genAI = new GoogleGenerativeAI(apiKey!);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
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
        revalidatePath('/');
        return { success: true, bill };
    } catch (error) {
        console.error(error);
        return { success: false };
    }
}

export async function deleteAlegraBill(id: string) {
    try {
        await prisma.alegraBill.delete({ where: { id } });
        revalidatePath('/');
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
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        return { success: false };
    }
}

export async function createFolder(data: { name?: string, parentId?: string, autoName?: boolean, prefix?: string }) {
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

        const folder = await prisma.workspaceFile.create({
            data: {
                name: folderName,
                type: 'folder',
                userId: user.id,
                parentId: data.parentId || null
            }
        });

        revalidatePath('/');
        return { success: true, folder };
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

        const fileName = data.filename.endsWith('.md') ? data.filename : `${data.filename}.md`;
        const filePath = join(process.cwd(), 'public', 'uploads', fileName);
        await writeFile(filePath, data.content);

        const file = await prisma.workspaceFile.create({
            data: {
                name: fileName,
                type: 'md',
                size: `${Buffer.byteLength(data.content)} bytes`,
                userId: user.id,
                parentId: targetParentId || null
            }
        });

        revalidatePath('/');
        return { success: true, file, createdFolder: !!data.folderName, folderId: createdFolderId };
    } catch (error) {
        console.error(error);
        return { success: false, message: 'Failed to create markdown file' };
    }
}

/**
 * Move multiple files to a target folder
 */
export async function moveFilesToFolder(fileIds: string[], targetFolderId: string) {
    try {
        if (!fileIds.length) {
            return { success: true, moved: 0, movedFileIds: [], message: 'No files to move' };
        }

        const results = await Promise.all(
            fileIds.map(id => 
                prisma.workspaceFile.update({
                    where: { id },
                    data: { parentId: targetFolderId }
                }).catch(() => null)
            )
        );

        const movedFiles = results.filter(r => r !== null);
        const movedCount = movedFiles.length;
        const movedFileIds = movedFiles.map(f => f!.id);
        
        revalidatePath('/');
        return { success: true, moved: movedCount, movedFileIds, message: `Moved ${movedCount} file(s) to target folder` };
    } catch (error) {
        console.error('Failed to move files:', error);
        return { success: false, moved: 0, movedFileIds: [], message: 'Failed to move files' };
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

        revalidatePath('/');
        return { success: true, file: updated };
    } catch (error) {
        console.error('Failed to highlight file:', error);
        return { success: false, message: 'Failed to highlight file' };
    }
}

/**
 * Copy multiple files to a target folder (preserves originals)
 */
export async function copyFilesToFolder(fileIds: string[], targetFolderId: string) {
    try {
        if (!fileIds.length) {
            return { success: true, copied: 0, copiedFileIds: [], message: 'No files to copy' };
        }

        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        const copies = await Promise.all(
            fileIds.map(async (id) => {
                const original = await prisma.workspaceFile.findUnique({ where: { id } });
                if (!original || original.type === 'folder') return null;

                const newName = `${original.name.split('.')[0]} (copy).${original.name.split('.').pop()}`;
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
        
        revalidatePath('/');
        return { success: true, copied: copiedCount, copiedFileIds, message: `Copied ${copiedCount} file(s) to target folder` };
    } catch (error) {
        console.error('Failed to copy files:', error);
        return { success: false, copied: 0, copiedFileIds: [], message: 'Failed to copy files' };
    }
}



export async function chatWithAI(query: string, fileIds: string[] = [], history: { role: 'user' | 'model'; parts: { text: string }[] }[] = []) {
    try {
        const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
        if (!apiKey) return { success: false, message: 'API Key missing' };

        const genAI = new GoogleGenerativeAI(apiKey);

        const [taskCount, fileCount, folders, allFiles, activePromptSet, demoUser] = await Promise.all([
            prisma.task.count(),
            prisma.workspaceFile.count({ where: { type: { not: 'folder' } } }),
            prisma.workspaceFile.findMany({ where: { type: 'folder' }, select: { name: true } }),
            prisma.workspaceFile.findMany({ select: { id: true, name: true, type: true } }),
            prisma.aIPromptSet.findFirst({ where: { isActive: true } }),
            prisma.user.findUnique({ where: { email: 'demo@example.com' } })
        ]);

        const getLastAssistantText = () => {
            const lastAssistant = [...history].reverse().find(m => m.role === 'model');
            if (!lastAssistant) return '';
            return (lastAssistant.parts || []).map(p => p.text || '').join('').trim();
        };

        const extractLastMarkdownTable = (text: string) => {
            const tableRegex = /(^|\n)\|[^\n]*\|\n\|[-\s|:]+\|\n(?:\|[^\n]*\|\n?)+/m;
            const match = text.match(tableRegex);
            return match ? match[0].trim() : '';
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

        let workflowInstructions = '';

        if (demoUser) {
            await ensureIntentRules(demoUser.id);
            const rules = await prisma.intentRule.findMany({ where: { userId: demoUser.id, enabled: true } });
            
            // Check if input matches any of the AGENT'S custom trigger keywords
            const rawWorkflows = activePromptSet?.workflows as unknown;
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
                    triggerKeywords: (activePromptSet?.triggerKeywords as string[]) || [],
                    steps: workflows
                }];
            }

            const normalizedQuery = query.toLowerCase();
            const matchedWorkflow = workflows.find(wf => {
                const keywords = Array.isArray(wf.triggerKeywords) ? wf.triggerKeywords : [];
                const fallbackKeywords = wf.name ? [wf.name] : [];
                return [...keywords, ...fallbackKeywords].some((kw: string) =>
                    normalizedQuery.includes(kw.toLowerCase())
                );
            });

            if (matchedWorkflow) {
                console.log(`⚡ Server Workflow Execution: ${matchedWorkflow.name}`);
                const lastAssistantText = getLastAssistantText();
                const table = extractLastMarkdownTable(lastAssistantText);
                const content = table || lastAssistantText;

                const filename = getAutoFilename({ autoFilename: 'timestamp' });
                const folderName = getAutoFolderName({ autoFolder: 'year' });

                const res = await executeWorkflow(matchedWorkflow.steps as WorkflowStep[], {
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

                    const alegraSkipped = res.context?.lastSkippedAction === 'extract_alegra_bill';
                    const toolUsed = alegraSkipped ? undefined : 'workflow';
                    const text = alegraSkipped
                        ? `✅ Workflow **${matchedWorkflow.name}** executed successfully (Alegra export disabled).${extra}`
                        : `✅ Workflow **${matchedWorkflow.name}** executed successfully.${extra ? `\n${extra}` : ''}`;

                    return {
                        success: true,
                        text,
                        toolUsed
                    };
                }

                // Fallback to injection instructions if server workflow fails
                const stepsList = matchedWorkflow.steps.map((s: any, i: number) => `${i+1}. Tool: "${s.action}"`).join('\n');
                workflowInstructions = `\n\nSYSTEM OVERRIDE: The user has triggered the workflow "${matchedWorkflow.name}".\n\nEXECUTION RULES:\n1. You are MANDATED to execute the following tools in this exact order to complete the workflow:\n${stepsList}\n2. IGNORE the rule about asking for folders. For this workflow, AUTOMATICALLY store files in "Receipts/${new Date().getFullYear()}" without asking.\n3. Analyze the provided image/context to extract any required parameters for these tools.\n4. Do not stop. Execute all steps sequentially now.`;
            } else {
                const rules = await prisma.intentRule.findMany({ where: { userId: demoUser.id, enabled: true } });
                const matchedRule = rules.find(rule => matchesIntentRule(query, rule.keywords));
                
                if (matchedRule) {
                    console.log(`⚡ Intent Rule Triggered: ${matchedRule.name}`);
                    const lastAssistantText = getLastAssistantText();
                    const table = extractLastMarkdownTable(lastAssistantText);
                    const content = table || lastAssistantText;

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

                const toolInstructions = `
OPERATIONAL RULES:
1. SKILLS OVER TOOLS: Use SKILLS instead of individual tools. Skills are intelligent capabilities that handle complex tasks automatically.
2. RECEIPT INTELLIGENCE: When processing receipts, use the 'receipt_intelligence' skill which handles vision analysis, business verification, report creation, and file organization in one call.
3. WORKSPACE ORGANIZATION: Use 'workspace_organization' skill for organizing files - it intelligently creates folders, moves files, and applies highlighting.
4. FISCAL ANALYSIS: Use 'fiscal_analysis' skill for tax calculations and compliance checking.
5. DOCUMENT PROCESSING: Use 'document_processing' skill for content extraction and categorization.
6. BUSINESS NAMES: The skills handle DGII verification automatically - you don't need to call it separately.
7. FILE CREATION FLOW: Skills handle folder creation automatically. Don't ask about folders - let the skills decide.
8. CONTEXT: Current workspace has ${fileCount} files and ${taskCount} tasks.`;

        const baseInstruction = activePromptSet ? activePromptSet.prompt : defaultInstruction;
        const systemInstruction = baseInstruction + "\n" + toolInstructions;

        // Load skills dynamically from skills library
        const enabledSkills = (activePromptSet && Array.isArray(activePromptSet.tools) && activePromptSet.tools.length > 0)
            ? activePromptSet.tools.filter(skillId => skillId !== 'extract_alegra_bill') // Temporarily disable Alegra export
            : DEFAULT_SKILLS;

        console.log('🧠 Loading skills for agent:', enabledSkills);
        let tools = getSkillSchemas(enabledSkills);

        // Fallback: if enabledSkills are legacy tool ids, load default skills
        if (!tools.length) {
            console.warn('⚠️ No skill schemas found for enabled tools. Falling back to default skills.');
            tools = getSkillSchemas(DEFAULT_SKILLS);
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", systemInstruction, tools });
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

            if (['image', 'png', 'jpg', 'jpeg', 'webp'].includes(file.type)) {
                const fileBuffer = await readFile(join(process.cwd(), 'public', 'uploads', file.name));
                promptParts.push({ inlineData: { data: fileBuffer.toString('base64'), mimeType: "image/jpeg" } });
                promptParts[0] += `\n(File: ${file.name}, ID: ${file.id})`;
            } else if (file.type === 'pdf') {
                try {
                    const fileBuffer = await readFile(join(process.cwd(), 'public', 'uploads', file.name));
                    const parseModule: any = await import('pdf-parse');
                    const data = await (parseModule.default ?? parseModule)(fileBuffer);
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
        let maxTurns = 5; // Prevent infinite loops

        while (calls && calls.length > 0 && maxTurns > 0) {
            console.log(`🔧 Tool calls detected (Turn ${6 - maxTurns}):`, calls.map(c => c.name));
            toolUsed = calls[0].name;
            const toolResults = [];
            
            for (const call of calls) {
                let res;
                console.log(`🎯 Executing skill: ${call.name}`);
                
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
                
                console.log(`✅ Skill result for ${call.name}:`, res);

                toolResults.push({ functionResponse: { name: call.name, response: res } } as any);
            }
            
            console.log('📨 Sending tool results back to AI...');
            currentState = await chat.sendMessage(toolResults as any);
            currentResponse = await currentState.response;
            calls = currentResponse.functionCalls();
            maxTurns--;
        }

        const finalText = currentResponse.text();
        console.log('✅ Final AI response text:', finalText);

        if (!finalText || finalText.trim() === '') {
             return { success: true, text: '✅ Workflow steps completed successfully.', toolUsed };
        }

        return { success: true, text: finalText, toolUsed: toolUsed || undefined };
    } catch (error) {
        console.error('💥 chatWithAI error:', error);
        return { success: false, message: error instanceof Error ? error.message : 'AI failed' };
    }
}
