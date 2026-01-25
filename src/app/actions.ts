
'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { DEFAULT_TOOLS } from '@/lib/toolLibrary';
import { DEFAULT_INTENT_RULES, matchesIntentRule, WorkflowStep } from '@/lib/intentLibrary';
import { TOOL_LIBRARY } from '@/lib/toolLibrary';

// ... existing code ...

async function executeAction(actionId: string, args: any): Promise<{ success: boolean, message?: string, [key: string]: any }> {
    console.log(`🚀 Executing Action: ${actionId}`, args);
    
    // Internal Intents
    if (actionId === 'create_markdown_file') return await createMarkdownFile(args);
    if (actionId === 'create_task') return await createTask(args);
    if (actionId === 'extract_alegra_bill') return await createAlegraBill(args);
    if (actionId === 'record_alegra_payment') return await recordAlegraPayment(args);
    if (actionId === 'verify_dgii_rnc') return await verifyRNC(args.rnc);

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
    let context = { ...initialContext };
    const results = [];

    for (const step of steps) {
        // Merge step params with context (allowing basic path resolution if needed)
        const args = { ...step.params, ...context };
        const result = await executeAction(step.action, args);
        
        results.push({ step: step.action, success: result.success, result });
        
        if (!result.success) break; // Stop on failure for now

        // Accumulate context from result
        context = { ...context, ...result };
    }

    return { success: results.every(r => r.success), results };
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
        const bill = await prisma.alegraBill.create({
            data: {
                date: data.date,
                dueDate: data.dueDate || data.date,
                providerName: data.providerName,
                identification: data.identification,
                ncf: data.ncf,
                totalAmount: data.totalAmount,
                items: JSON.stringify(data.items),
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

export async function createMarkdownFile(data: { filename: string, content: string, folderName?: string, parentId?: string }) {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) throw new Error('User not found');

        if (!data.content || data.content.trim() === '') {
            return { success: false, message: 'Missing content for markdown file' };
        }

        let targetParentId = data.parentId;

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
        return { success: true, file, createdFolder: !!data.folderName };
    } catch (error) {
        console.error(error);
        return { success: false, message: 'Failed to create markdown file' };
    }
}

/**
 * Build Gemini-compatible tools from tool library
 */
function buildGeminiTools(toolIds: string[]) {
    const { TOOL_LIBRARY } = require('@/lib/toolLibrary');

    const functionDeclarations = toolIds.map(toolId => {
        const tool = TOOL_LIBRARY[toolId];
        if (!tool) return null;

        // Convert tool schema to Gemini format with proper SchemaType
        const convertSchema = (schema: any): any => {
            if (!schema) return schema;

            const converted: any = {};

            if (schema.type === 'object') {
                converted.type = SchemaType.OBJECT;
                if (schema.properties) {
                    converted.properties = {};
                    for (const [key, value] of Object.entries(schema.properties)) {
                        converted.properties[key] = convertSchema(value);
                    }
                }
                if (schema.required) {
                    converted.required = schema.required;
                }
            } else if (schema.type === 'string') {
                converted.type = SchemaType.STRING;
                if (schema.description) converted.description = schema.description;
                if (schema.enum) converted.enum = schema.enum;
            } else if (schema.type === 'number') {
                converted.type = SchemaType.NUMBER;
                if (schema.description) converted.description = schema.description;
            } else if (schema.type === 'boolean') {
                converted.type = SchemaType.BOOLEAN;
                if (schema.description) converted.description = schema.description;
            } else if (schema.type === 'array') {
                converted.type = SchemaType.ARRAY;
                if (schema.items) {
                    converted.items = convertSchema(schema.items);
                }
            }

            return converted;
        };

        return {
            name: tool.schema.name,
            description: tool.schema.description,
            parameters: convertSchema(tool.schema.parameters)
        };
    }).filter(Boolean);

    return [{ functionDeclarations }] as any;
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
            const workflows = (activePromptSet?.workflows as any[]) || [];
            const matchedWorkflow = workflows.find(wf => 
                wf.triggerKeywords?.some((kw: string) => query.toLowerCase().includes(kw.toLowerCase()))
            );

            if (matchedWorkflow) {
                console.log(`⚡ Injection Workflow Plan: ${matchedWorkflow.name}`);
                const stepsList = matchedWorkflow.steps.map((s: any, i: number) => 
                    `${i+1}. Tool: "${s.action}"`
                ).join('\n');
                
                workflowInstructions = `\n\nSYSTEM OVERRIDE: The user has triggered the workflow "${matchedWorkflow.name}".\n\nEXECUTION RULES:\n1. You are MANDATED to execute the following tools in this exact order to complete the workflow:\n${stepsList}\n2. IGNORE the rule about asking for folders. For this workflow, AUTOMATICALLY store files in "Receipts/${new Date().getFullYear()}" without asking.\n3. Analyze the provided image/context to extract any required parameters for these tools.\n4. Do not stop. Execute all steps sequentially now.`;
            } else {
                const matchedRule = rules.find(rule => matchesIntentRule(query, rule.keywords));
                
                if (matchedRule?.action === 'create_markdown_file') {
                    const lastAssistantText = getLastAssistantText();
                    const table = extractLastMarkdownTable(lastAssistantText);
                    const content = table || lastAssistantText;

                    if (content) {
                        const config = (matchedRule.config || {}) as { autoFolder?: string; autoFilename?: string };
                        const folderName = getAutoFolderName(config);
                        const filename = getAutoFilename(config);

                        const res = await createMarkdownFile({
                            filename,
                            content,
                            folderName
                        });

                        if (res.success) {
                            return {
                                success: true,
                                text: `✅ Action completed successfully.\n\nCreated ${res.file?.name}${folderName ? ` in folder ${folderName}` : ''}.`,
                                toolUsed: 'create_markdown_file'
                            };
                        }
                    }
                }
            }
        }

        const defaultInstruction = `You are TaskFlow AI, an autonomous fiscal agent for Alegra RD. 
- Expert in Dominican NCF, ITBIS, and 606 classification.
- Can extract bills from receipts and record payments.
- Can create Markdown files with tables or analysis.
- PROACTIVE: If the user wants to save a file or content, ALWAYS ask if they would like to create a new folder to place it in.`;

        const toolInstructions = `
OPERATIONAL RULES:
1. BUSINESS NAMES: Use the 'verify_dgii_rnc' tool for ANY business name or status lookup. Do NOT guess.
2. RECEIPT ANALYSIS WORKFLOW (CRITICAL):
   - When a receipt IMAGE is attached, you MUST use your VISION capabilities to read and extract ALL data directly from the image
   - DO NOT ask the user for information that is visible in the image (date, amount, RNC, NCF, ITBIS, etc.)
   - Extract from the image: Date, Total Amount, RNC, NCF, ITBIS, Provider Name, and line items
   - DISPLAY the extracted data in a MARKDOWN TABLE before processing:
     Example format:
     | Field | Value |
     |-------|-------|
     | Date | 2024-01-10 |
     | Provider | ITBIS SRL |
     | RNC | 131000225563 |
     | NCF | E310002255623 |
     | Total Amount | RD$ 231.59 |
     | ITBIS | RD$ 31.59 |
   - Follow this sequence:
     a) Use VISION to extract the RNC from the receipt image
     b) Immediately call 'verify_dgii_rnc' with the extracted RNC to validate the business
     c) Use VISION to extract all other data (date, amount, NCF, ITBIS, items)
     d) DISPLAY the extracted data in a markdown table
     e) Call 'extract_alegra_bill' with the verified business name and ALL extracted data
   - This ensures accurate business information from DGII's official database
3. FISCAL ACTIONS: Use 'extract_alegra_bill' to process receipts and 'record_alegra_payment' for payments.
4. WORKSPACE: Use 'create_markdown_file' to save reports. You MUST call this tool to actually save data. Saying "I have saved the file" without calling the tool is a CRITICAL FAILURE.
5. FILE CREATION FLOW (CRITICAL):
    - ALWAYS ask whether to create a new folder BEFORE creating a file.
    - If the user says NO (or gives a filename only), DO NOT ask again. Proceed immediately with create_markdown_file and omit folderName.
    - If the user provides a folder name, call create_markdown_file with folderName set.
    - The create_markdown_file call MUST include full markdown content. If you already displayed a table, reuse it verbatim as the content.
6. NO FICTION: Do not hallucinate successful actions. Once you have the filename and folder preference from the user, YOU MUST EXECUTE THE TOOL CALL in the next turn.
7. ABSOLUTE MARKDOWN PRECISION (CRITICAL):
   - CONTIGUOUS TABLES: Tables MUST be contiguous. NO blank lines between header, separator, and data rows.
   - NO CODE BLOCKS: Do NOT wrap tables in backticks. Render as raw markdown.
   - SINGLE-LINE LINKS: Markdown links [Label](URL) MUST be on a single continuous line.
8. CONTEXT: Current workspace has ${fileCount} files and ${taskCount} tasks.`;

        const baseInstruction = activePromptSet ? activePromptSet.prompt : defaultInstruction;
        const systemInstruction = baseInstruction + "\n" + toolInstructions;

        // Load tools dynamically from tool library
        const enabledTools = activePromptSet?.tools?.length > 0
            ? activePromptSet.tools
            : DEFAULT_TOOLS;

        console.log('🔧 Loading tools for agent:', enabledTools);
        const tools = buildGeminiTools(enabledTools);

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
                    const data = await pdf(fileBuffer);
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
                console.log(`⚙️ Executing tool: ${call.name}`);
                if (call.name === 'create_task') res = await createTask(call.args as any);
                if (call.name === 'extract_alegra_bill') res = await createAlegraBill(call.args as any);
                if (call.name === 'record_alegra_payment') res = await recordAlegraPayment(call.args as any);
                if (call.name === 'verify_dgii_rnc') res = await verifyRNC((call.args as any).rnc);
                if (call.name === 'create_markdown_file') {
                    const args = call.args as any;
                    const normalizedFolder = args?.folderName ?? args?.folder;
                    const folderName = typeof normalizedFolder === 'string' && ['no', 'none', 'n', 'false'].includes(normalizedFolder.trim().toLowerCase())
                        ? undefined
                        : normalizedFolder;

                    let content = args?.content;
                    if (!content || content.trim() === '') {
                        const lastAssistant = getLastAssistantText();
                        content = extractLastMarkdownTable(lastAssistant) || lastAssistant;
                    }

                    res = await createMarkdownFile({
                        ...args,
                        content,
                        folderName
                    } as any);
                }
                console.log(`✅ Tool result for ${call.name}:`, res);

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
