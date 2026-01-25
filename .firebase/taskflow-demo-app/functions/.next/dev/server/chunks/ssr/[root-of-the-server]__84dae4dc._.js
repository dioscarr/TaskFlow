module.exports = [
"[project]/src/lib/prisma.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__ = __turbopack_context__.i("[externals]/@prisma/client [external] (@prisma/client, cjs, [project]/node_modules/@prisma/client)");
;
const prismaClientSingleton = ()=>{
    return new __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__["PrismaClient"]();
};
const prisma = globalThis.prisma ?? prismaClientSingleton();
const __TURBOPACK__default__export__ = prisma;
if ("TURBOPACK compile-time truthy", 1) globalThis.prisma = prisma;
}),
"[externals]/fs/promises [external] (fs/promises, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("fs/promises", () => require("fs/promises"));

module.exports = mod;
}),
"[project]/src/lib/email-processor.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "parseEmailToTask",
    ()=>parseEmailToTask
]);
// Keyword mappings for "AI" categorization
const CATEGORY_KEYWORDS = {
    'Finance': [
        'invoice',
        'receipt',
        'payment',
        'bill',
        'subscription',
        '$',
        'paid'
    ],
    'Meeting': [
        'meeting',
        'call',
        'zoom',
        'schedule',
        'calendar',
        'invite'
    ],
    'Development': [
        'bug',
        'feature',
        'pr',
        'pull request',
        'deploy',
        'error',
        'exception'
    ],
    'Marketing': [
        'campaign',
        'social',
        'post',
        'ad',
        'newsletter',
        'analytics'
    ],
    'Urgent': [
        'urgent',
        'asap',
        'immediate',
        'emergency',
        'deadline'
    ]
};
function parseEmailToTask(email) {
    const textToCheck = `${email.subject} ${email.body}`.toLowerCase();
    const tags = [];
    let priority = 'medium';
    // 1. Extract Tags based on keywords
    Object.entries(CATEGORY_KEYWORDS).forEach(([category, keywords])=>{
        if (keywords.some((k)=>textToCheck.includes(k))) {
            tags.push(category);
        }
    });
    // 2. Determine Priority
    if (tags.includes('Urgent') || textToCheck.includes('important')) {
        priority = 'high';
    }
    // 3. Simple Due Date Extraction (e.g., "due friday", "tomorrow")
    let suggestedDueDate;
    if (textToCheck.includes('tomorrow')) {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        suggestedDueDate = d;
    } else if (textToCheck.includes('next week')) {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        suggestedDueDate = d;
    }
    return {
        title: email.subject,
        description: email.body,
        priority,
        tags,
        suggestedDueDate
    };
}
}),
"[project]/src/app/actions.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"4000960904e166730c01c0fc76606c1ac94f3e570f":"createTask","401c0a725fc3780f50e6bbcc64ad9211da5fed6535":"uploadFile","404c94fdde79678f687fe6e145c9125183a0492331":"deleteFile","404e54b06f011516ded8f500f3d2d71a9e27eb0829":"simulateIncomingEmail","406ce59f5ef05e22b2405e9e02b09ea415009e7f41":"reorderFiles","409eaf763d3b720c6ceee864a801211fdabfb9328f":"deleteTask","40e53ee1e528cbd6712c61e6d14deaa5a8dcdc2cc3":"toggleFileShare","40f88b9485509e0f3578873a851e23b7febe4d423a":"createFile","6036adab841a1208210e6b77555fb31f86fccc8de0":"updateTaskStatus","60ac834eb5dc13ecb9420d1033c6aa7b175515deae":"moveFile","60ebd62f829cb1a1ba299aa2f77c3948a8042b0507":"renameFile"},"",""] */ __turbopack_context__.s([
    "createFile",
    ()=>createFile,
    "createTask",
    ()=>createTask,
    "deleteFile",
    ()=>deleteFile,
    "deleteTask",
    ()=>deleteTask,
    "moveFile",
    ()=>moveFile,
    "renameFile",
    ()=>renameFile,
    "reorderFiles",
    ()=>reorderFiles,
    "simulateIncomingEmail",
    ()=>simulateIncomingEmail,
    "toggleFileShare",
    ()=>toggleFileShare,
    "updateTaskStatus",
    ()=>updateTaskStatus,
    "uploadFile",
    ()=>uploadFile
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/prisma.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/cache.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$fs$2f$promises__$5b$external$5d$__$28$fs$2f$promises$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/fs/promises [external] (fs/promises, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/path [external] (path, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$email$2d$processor$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/email-processor.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
;
;
async function updateTaskStatus(id, status) {
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"].task.update({
            where: {
                id
            },
            data: {
                status
            }
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/');
        return {
            success: true
        };
    } catch (error) {
        console.error('Failed to update task status:', error);
        return {
            success: false,
            error: 'Failed to update task status'
        };
    }
}
async function deleteTask(id) {
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"].task.delete({
            where: {
                id
            }
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/');
        return {
            success: true
        };
    } catch (error) {
        console.error('Failed to delete task:', error);
        return {
            success: false,
            error: 'Failed to delete task'
        };
    }
}
async function createTask(data) {
    try {
        const user = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"].user.findUnique({
            where: {
                email: 'demo@example.com'
            }
        });
        console.log('CreatesTask - Found User:', user);
        if (!user) throw new Error('User not found');
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"].task.create({
            data: {
                title: data.title,
                description: data.description,
                status: 'pending',
                userId: user.id,
                emailSource: JSON.stringify({
                    sender: {
                        name: 'Manual Task',
                        email: ''
                    },
                    preview: data.description || 'No description',
                    tags: [
                        'Manual'
                    ]
                })
            }
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/');
        return {
            success: true
        };
    } catch (error) {
        console.error('Failed to create task:', error);
        return {
            success: false,
            error: 'Failed to create task'
        };
    }
}
// Helper to recount items in a folder
async function updateFolderItemCount(folderId) {
    if (!folderId) return;
    try {
        const count = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"].workspaceFile.count({
            where: {
                parentId: folderId
            }
        });
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"].workspaceFile.update({
            where: {
                id: folderId
            },
            data: {
                items: `${count} items`
            }
        });
    } catch (e) {
        console.error('Failed to update folder count:', e);
    }
}
// Helper to get next order value
async function getNextOrderValue(parentId) {
    const lastFile = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"].workspaceFile.findFirst({
        where: {
            parentId
        },
        orderBy: {
            order: 'desc'
        }
    });
    return (lastFile?.order || 0) + 1000;
}
async function createFile(data) {
    try {
        const user = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"].user.findUnique({
            where: {
                email: 'demo@example.com'
            }
        });
        if (!user) throw new Error('User not found');
        const nextOrder = await getNextOrderValue(data.parentId || null);
        const newFile = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"].workspaceFile.create({
            data: {
                name: data.name,
                type: data.type,
                size: data.size,
                items: data.items,
                parentId: data.parentId,
                userId: user.id,
                shared: false,
                order: nextOrder
            }
        });
        if (data.parentId) {
            await updateFolderItemCount(data.parentId);
        }
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/');
        return {
            success: true,
            file: newFile
        };
    } catch (error) {
        console.error('Failed to create file:', error);
        return {
            success: false,
            error: 'Failed to create file'
        };
    }
}
async function reorderFiles(items) {
    try {
        // Run in transaction for safety
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"].$transaction(items.map((item)=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"].workspaceFile.update({
                where: {
                    id: item.id
                },
                data: {
                    order: item.order
                }
            })));
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/');
        return {
            success: true
        };
    } catch (error) {
        console.error('Failed to reorder files:', error);
        return {
            success: false,
            error: 'Failed to reorder files'
        };
    }
}
async function deleteFile(id) {
    try {
        // Get file first to check parent
        const file = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"].workspaceFile.findUnique({
            where: {
                id
            }
        });
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"].workspaceFile.delete({
            where: {
                id
            }
        });
        if (file?.parentId) {
            await updateFolderItemCount(file.parentId);
        }
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/');
        return {
            success: true
        };
    } catch (error) {
        console.error('Failed to delete file:', error);
        return {
            success: false,
            error: 'Failed to delete file'
        };
    }
}
async function uploadFile(formData) {
    try {
        const file = formData.get('file');
        const parentId = formData.get('parentId');
        if (!file) throw new Error('No file uploaded');
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const fileName = file.name;
        const uploadDir = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__["join"])(process.cwd(), 'public', 'uploads');
        // mkdir -p public/uploads is already done but let's be safe
        const filePath = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__["join"])(uploadDir, fileName);
        await (0, __TURBOPACK__imported__module__$5b$externals$5d2f$fs$2f$promises__$5b$external$5d$__$28$fs$2f$promises$2c$__cjs$29$__["writeFile"])(filePath, buffer);
        const sizeInMb = file.size / (1024 * 1024);
        const sizeStr = sizeInMb < 0.1 ? `${(file.size / 1024).toFixed(1)} KB` : `${sizeInMb.toFixed(1)} MB`;
        const ext = fileName.split('.').pop()?.toLowerCase() || 'file';
        let type = ext;
        if ([
            'jpg',
            'jpeg',
            'png',
            'webp',
            'gif'
        ].includes(ext)) type = 'image';
        if (ext === 'pdf') type = 'pdf';
        // Reuse createFile which handles the count update
        return await createFile({
            name: fileName,
            type: type,
            size: sizeStr,
            parentId: parentId || undefined
        });
    } catch (error) {
        console.error('Failed to upload file:', error);
        return {
            success: false,
            error: 'Failed to upload file'
        };
    }
}
async function moveFile(id, parentId) {
    try {
        const file = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"].workspaceFile.findUnique({
            where: {
                id
            }
        });
        const oldParentId = file?.parentId;
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"].workspaceFile.update({
            where: {
                id
            },
            data: {
                parentId
            }
        });
        if (oldParentId) await updateFolderItemCount(oldParentId);
        if (parentId) await updateFolderItemCount(parentId);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/');
        return {
            success: true
        };
    } catch (error) {
        console.error('Failed to move file:', error);
        return {
            success: false,
            error: 'Failed to move file'
        };
    }
}
async function renameFile(id, name) {
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"].workspaceFile.update({
            where: {
                id
            },
            data: {
                name
            }
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/');
        return {
            success: true
        };
    } catch (error) {
        console.error('Failed to rename file:', error);
        return {
            success: false,
            error: 'Failed to rename file'
        };
    }
}
async function toggleFileShare(id) {
    try {
        const file = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"].workspaceFile.findUnique({
            where: {
                id
            }
        });
        if (!file) throw new Error('File not found');
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"].workspaceFile.update({
            where: {
                id
            },
            data: {
                shared: !file.shared
            }
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/');
        return {
            success: true
        };
    } catch (error) {
        console.error('Failed to toggle share:', error);
        return {
            success: false,
            error: 'Failed to toggle share'
        };
    }
}
;
async function simulateIncomingEmail(payload) {
    try {
        const user = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"].user.findUnique({
            where: {
                email: 'demo@example.com'
            }
        });
        if (!user) throw new Error('User not found');
        // Parse the email "intelligently"
        const parsedData = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$email$2d$processor$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseEmailToTask"])(payload);
        // Create the task
        const newTask = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"].task.create({
            data: {
                title: parsedData.title,
                description: parsedData.description,
                status: 'unread',
                userId: user.id,
                emailSource: JSON.stringify({
                    sender: {
                        name: payload.from.split('@')[0],
                        email: payload.from
                    },
                    preview: parsedData.description.substring(0, 100) + (parsedData.description.length > 100 ? '...' : ''),
                    tags: parsedData.tags,
                    priority: parsedData.priority
                })
            }
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/');
        return {
            success: true,
            task: newTask
        };
    } catch (error) {
        console.error('Failed to process email:', error);
        return {
            success: false,
            error: 'Failed to process email'
        };
    }
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    updateTaskStatus,
    deleteTask,
    createTask,
    createFile,
    reorderFiles,
    deleteFile,
    uploadFile,
    moveFile,
    renameFile,
    toggleFileShare,
    simulateIncomingEmail
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(updateTaskStatus, "6036adab841a1208210e6b77555fb31f86fccc8de0", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(deleteTask, "409eaf763d3b720c6ceee864a801211fdabfb9328f", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(createTask, "4000960904e166730c01c0fc76606c1ac94f3e570f", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(createFile, "40f88b9485509e0f3578873a851e23b7febe4d423a", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(reorderFiles, "406ce59f5ef05e22b2405e9e02b09ea415009e7f41", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(deleteFile, "404c94fdde79678f687fe6e145c9125183a0492331", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(uploadFile, "401c0a725fc3780f50e6bbcc64ad9211da5fed6535", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(moveFile, "60ac834eb5dc13ecb9420d1033c6aa7b175515deae", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(renameFile, "60ebd62f829cb1a1ba299aa2f77c3948a8042b0507", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(toggleFileShare, "40e53ee1e528cbd6712c61e6d14deaa5a8dcdc2cc3", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(simulateIncomingEmail, "404e54b06f011516ded8f500f3d2d71a9e27eb0829", null);
}),
"[project]/.next-internal/server/app/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/app/actions.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions.ts [app-rsc] (ecmascript)");
;
;
;
;
;
;
;
;
;
;
;
}),
"[project]/.next-internal/server/app/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/app/actions.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "4000960904e166730c01c0fc76606c1ac94f3e570f",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createTask"],
    "401c0a725fc3780f50e6bbcc64ad9211da5fed6535",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["uploadFile"],
    "404c94fdde79678f687fe6e145c9125183a0492331",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["deleteFile"],
    "404e54b06f011516ded8f500f3d2d71a9e27eb0829",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["simulateIncomingEmail"],
    "406ce59f5ef05e22b2405e9e02b09ea415009e7f41",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["reorderFiles"],
    "409eaf763d3b720c6ceee864a801211fdabfb9328f",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["deleteTask"],
    "40e53ee1e528cbd6712c61e6d14deaa5a8dcdc2cc3",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["toggleFileShare"],
    "40f88b9485509e0f3578873a851e23b7febe4d423a",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createFile"],
    "6036adab841a1208210e6b77555fb31f86fccc8de0",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["updateTaskStatus"],
    "60ac834eb5dc13ecb9420d1033c6aa7b175515deae",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["moveFile"],
    "60ebd62f829cb1a1ba299aa2f77c3948a8042b0507",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["renameFile"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i('[project]/.next-internal/server/app/page/actions.js { ACTIONS_MODULE0 => "[project]/src/app/actions.ts [app-rsc] (ecmascript)" } [app-rsc] (server actions loader, ecmascript) <locals>');
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions.ts [app-rsc] (ecmascript)");
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__84dae4dc._.js.map