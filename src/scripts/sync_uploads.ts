
import { PrismaClient } from '@prisma/client';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';

const prisma = new PrismaClient();

async function syncUploads() {
    console.log("🔄 Starting File Sync...");

    // 1. Get User
    const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
    if (!user) {
        console.error("❌ Demo user not found");
        return;
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
                    let folderId = parentId;

                    // Special handling for _root_ - contents are "root" level (parentId: null)
                    if (item === '_root_' && parentId === null) {
                        // Don't create a folder record for _root_, just dive in with parentId=null
                        await processDirectory(fullPath, null, '_root_');
                    } else {
                        // Regular folder - check if exists in DB, else create
                        const dbFolder = await prisma.workspaceFile.upsert({
                            where: {
                                // We don't have a unique constraint on name+parentId, so findFirst/create pattern is safer usually,
                                // but for simplicity/speed let's assume we can query by ID if we knew it.
                                // Actually, we need to search by name + parentId.
                                // Since 'upsert' requires a unique compound key which we might not have, 
                                // let's do findFirst -> create/update.
                                id: "placeholder_to_force_error_if_logic_is_wrong"
                            },
                            update: {},
                            create: {
                                name: item,
                                type: 'folder',
                                userId: user.id,
                                parentId: parentId
                            }
                        }).catch(async () => {
                            // Fallback for non-ID upsert
                            let f = await prisma.workspaceFile.findFirst({
                                where: { name: item, parentId: parentId, userId: user.id, type: 'folder' }
                            });
                            if (!f) {
                                f = await prisma.workspaceFile.create({
                                    data: {
                                        name: item,
                                        type: 'folder',
                                        userId: user.id,
                                        parentId: parentId
                                    }
                                });
                                console.log(`📁 Created folder: ${item}`);
                            }
                            return f;
                        });

                        // Recurse
                        await processDirectory(fullPath, dbFolder.id, relativePrefix ? `${relativePrefix}/${item}` : item);
                    }
                } else {
                    // File
                    const extension = item.split('.').pop() || 'file';
                    const storagePath = relativePrefix ? `${relativePrefix}/${item}` : item;

                    const existing = await prisma.workspaceFile.findFirst({
                        where: {
                            name: item,
                            parentId: parentId,
                            userId: user.id
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
                        // console.log(`✅ Synced: ${item}`);
                    } else {
                        await prisma.workspaceFile.create({
                            data: {
                                name: item,
                                type: extension,
                                size: `${stats.size} bytes`,
                                userId: user.id,
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
    console.log("✅ Sync Complete.");
}

syncUploads()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
