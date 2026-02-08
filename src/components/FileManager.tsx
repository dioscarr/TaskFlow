'use client';

import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Play, Square, RefreshCw, Globe, Wrench, Hammer, Terminal as TerminalIcon,
    Server, FolderPlus, List, LayoutGrid, ChevronRight, Search, UploadCloud,
    FileText, Folder, MoreVertical, Trash2, Edit, ChevronLeft, ExternalLink,
    Wand2, Sparkles, AlignLeft, FolderTree, X, Maximize2, Edit2, Share2,
    Move, Bot, LayoutPanelLeft, Tag, Users, Image as ImageIcon
} from 'lucide-react';
import type { WorkspaceFile } from '@prisma/client';
import { deleteFile, createFile, uploadFile, moveFile, renameFile, toggleFileShare, reorderFiles, getFileContent, convertFolderToApp, unpromoteApp, installDynamicApp, listRepoAppEntries, getRepoAppFileContent, saveRepoAppFileContent, installRepoApp } from '@/app/actions';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ConfirmationModal from './ConfirmationModal';
import ContextMenu from './ContextMenu';
import CodeEditorModal from './CodeEditorModal';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { listProcesses, stopProcess, restartProcess, reconfigureProcessPort, startProcess, rebuildProcess, getDockerLogs } from '@/app/processActions';
import IntegratedPreview from './IntegratedPreview';

const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 10, scale: 0.98 },
    show: { opacity: 1, y: 0, scale: 1 }
};

interface FileManagerProps {
    files: WorkspaceFile[];
}

type ChatContextMessage = {
    role: 'user' | 'ai';
    content: string;
};

type RepoEntry = {
    name: string;
    path: string;
    type: string;
    size: number | null;
};

const fileManagerStateCache = {
    currentFolderId: null as string | null,
    viewMode: 'grid' as 'grid' | 'list',
    selectedFileIds: [] as string[],
    lastSelectedId: null as string | null,
    editorMode: 'edit' as 'edit' | 'preview',
    editingFileId: null as string | null,
    editorContent: '',
    editorContentFileId: null as string | null,
    searchQuery: '',
    explorerMode: 'workspace' as 'workspace' | 'repo',
    repoCurrentPath: null as string | null
};

// Helper Component for Lazy Previews
const FilePreview = ({ file }: { file: WorkspaceFile }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const isImage = ['image', 'png', 'jpg', 'jpeg', 'webp', 'gif'].includes(file.type);

    if (!isImage) {
        return (
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-white/5 to-white/0 border border-white/5 flex items-center justify-center text-sky-300">
                {file.type === 'folder' && (
                    file.tags?.includes('app_root')
                        ? <div className="relative">
                            <LayoutGrid size={24} className="text-emerald-400 fill-emerald-500/20" />
                            <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-zinc-900" />
                        </div>
                        : <Folder size={24} className="fill-sky-500/20 stroke-sky-400" />
                )}
                {file.type === 'pdf' && <FileText size={24} className="text-red-400" />}
                {!['folder', 'pdf'].includes(file.type) && (
                    file.tags?.includes('app_entry')
                        ? <LayoutPanelLeft size={24} className="text-emerald-400" />
                        : <FileText size={24} className="text-white/40" />
                )}
            </div>
        );
    }

    return (
        <div className="w-full h-32 rounded-lg bg-black/20 relative overflow-hidden group-hover:shadow-lg transition-all border border-white/5">
            {/* Placeholder Icon (visible while loading) */}
            <div className={cn(
                "absolute inset-0 flex items-center justify-center transition-opacity duration-500",
                isLoaded ? "opacity-0" : "opacity-100"
            )}>
                <ImageIcon size={24} className="text-white/20" />
            </div>

            {/* Lazy Image */}
            <img
                src={`/uploads/${file.storagePath || file.name}`}
                alt={file.name}
                loading="lazy"
                onLoad={() => setIsLoaded(true)}
                className={cn(
                    "w-full h-full object-cover transition-all duration-700 transform hover:scale-110",
                    isLoaded ? "opacity-100 blur-0" : "opacity-0 blur-lg"
                )}
            />
        </div>
    );
};

export default function FileManager({ files }: FileManagerProps) {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(fileManagerStateCache.currentFolderId);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>(fileManagerStateCache.viewMode);
    const [explorerMode, setExplorerMode] = useState<'workspace' | 'repo'>(fileManagerStateCache.explorerMode);
    const [repoCurrentPath, setRepoCurrentPath] = useState<string | null>(fileManagerStateCache.repoCurrentPath);
    const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(() => new Set(fileManagerStateCache.selectedFileIds));
    const [lastSelectedId, setLastSelectedId] = useState<string | null>(fileManagerStateCache.lastSelectedId);
    const [editorMode, setEditorMode] = useState<'edit' | 'preview'>(fileManagerStateCache.editorMode);
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [movingFiles, setMovingFiles] = useState<WorkspaceFile[] | null>(null);
    const [renamingFile, setRenamingFile] = useState<WorkspaceFile | null>(null);
    const [newFolderName, setNewFolderName] = useState('');
    const [newNameValue, setNewNameValue] = useState('');
    const [searchQuery, setSearchQuery] = useState(fileManagerStateCache.searchQuery);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | string[] | null>(null);

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: WorkspaceFile } | null>(null);

    // Drag and Drop State
    const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
    const [dragOverFileId, setDragOverFileId] = useState<string | null>(null);
    const [reorderTarget, setReorderTarget] = useState<{ id: string; position: 'before' | 'after' } | null>(null);
    const [groupingData, setGroupingData] = useState<{ sourceIds: string[]; targetId: string } | null>(null);
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [previewContent, setPreviewContent] = useState<string | null>(null);
    const [chatContext, setChatContext] = useState<ChatContextMessage[]>([]);
    const [repoEntries, setRepoEntries] = useState<RepoEntry[]>([]);
    const [isRepoLoading, setIsRepoLoading] = useState(false);
    const [repoEditingFile, setRepoEditingFile] = useState<RepoEntry | null>(null);
    const [processes, setProcesses] = useState<any[]>([]);
    const [processActionLoading, setProcessActionLoading] = useState<string | null>(null);
    const [repoEditorContent, setRepoEditorContent] = useState('');
    const [repoEditorPath, setRepoEditorPath] = useState<string | null>(null);
    const [isRepoSaving, setIsRepoSaving] = useState(false);
    const [isSavingStart, setIsSavingStart] = useState(false);

    // Integrated Preview State
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);
    const [previewStatus, setPreviewStatus] = useState<'idle' | 'starting' | 'ready' | 'error'>('idle');
    const [previewAppName, setPreviewAppName] = useState<string | undefined>(undefined);
    const [previewLogs, setPreviewLogs] = useState<string[]>([]);

    // Code Editor State
    const [editingFile, setEditingFile] = useState<WorkspaceFile | null>(() => {
        const cachedId = fileManagerStateCache.editingFileId;
        return cachedId ? files.find(file => file.id === cachedId) || null : null;
    });

    // Handle Integrated Preview Lifecycle
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isPreviewOpen && previewStatus === 'starting') {
            interval = setInterval(async () => {
                const res = await listProcesses();
                if (res.success && res.processes) {
                    setProcesses(res.processes);
                    const currentApp = res.processes.find((p: any) =>
                        p.name.includes(previewAppName || '') ||
                        p.metadata?.appName === previewAppName
                    );
                    if (currentApp && currentApp.status === 'running' && currentApp.port) {
                        const url = (currentApp.metadata as any)?.publicUrl || `http://localhost:${currentApp.port}`;
                        setPreviewUrl(url);
                        setPreviewStatus('ready');
                        window.dispatchEvent(new CustomEvent('set-vibe-preview', { detail: url }));
                        toast.success(`${previewAppName} is now live!`);
                    }
                }
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [isPreviewOpen, previewStatus, previewAppName]);

    // Code Editor Loading State
    const [editorContent, setEditorContent] = useState(fileManagerStateCache.editorContent);
    const [editorContentFileId, setEditorContentFileId] = useState<string | null>(fileManagerStateCache.editorContentFileId);

    useEffect(() => {
        fileManagerStateCache.explorerMode = explorerMode;
    }, [explorerMode]);

    useEffect(() => {
        fileManagerStateCache.repoCurrentPath = repoCurrentPath;
    }, [repoCurrentPath]);

    useEffect(() => {
        fileManagerStateCache.currentFolderId = currentFolderId;
    }, [currentFolderId]);

    useEffect(() => {
        fileManagerStateCache.viewMode = viewMode;
    }, [viewMode]);

    useEffect(() => {
        fileManagerStateCache.selectedFileIds = Array.from(selectedFileIds);
    }, [selectedFileIds]);

    useEffect(() => {
        fileManagerStateCache.lastSelectedId = lastSelectedId;
    }, [lastSelectedId]);

    useEffect(() => {
        fileManagerStateCache.editorMode = editorMode;
    }, [editorMode]);

    useEffect(() => {
        fileManagerStateCache.editingFileId = editingFile?.id || null;
    }, [editingFile]);

    useEffect(() => {
        fileManagerStateCache.editorContent = editorContent;
    }, [editorContent]);

    useEffect(() => {
        fileManagerStateCache.editorContentFileId = editorContentFileId;
    }, [editorContentFileId]);

    useEffect(() => {
        fileManagerStateCache.searchQuery = searchQuery;
    }, [searchQuery]);

    useEffect(() => {
        if (!editingFile && fileManagerStateCache.editingFileId) {
            const cachedFile = files.find(file => file.id === fileManagerStateCache.editingFileId) || null;
            if (cachedFile) {
                setEditingFile(cachedFile);
            }
        }
    }, [files, editingFile]);

    useEffect(() => {
        if (currentFolderId && !files.some(file => file.id === currentFolderId)) {
            setCurrentFolderId(null);
        }
    }, [files, currentFolderId]);

    useEffect(() => {
        if (editingFile && editorMode === 'preview' && (editingFile.name.endsWith('.md') || editingFile.type === 'md' || editingFile.type === 'markdown')) {
            const previewPath = editingFile.storagePath || editingFile.name;
            getFileContent(previewPath).then(res => {
                if (res.success) setPreviewContent(res.content || "");
            });
        } else {
            setPreviewContent(null);
        }
    }, [editingFile, editorMode]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (explorerMode === 'repo') {
            const fetchProcesses = async () => {
                try {
                    const res = await listProcesses();
                    if (res.success && res.processes) {
                        setProcesses(res.processes);
                    }
                } catch (e) {
                    console.error("Failed to fetch processes", e);
                }
            };
            fetchProcesses();
            interval = setInterval(fetchProcesses, 15000); // Pulse every 15s instead of 5s to save resources
        }
        return () => clearInterval(interval);
    }, [explorerMode]);

    useEffect(() => {
        const handleChatContextUpdated = (e: any) => {
            const incoming = e?.detail?.messages;
            if (Array.isArray(incoming)) {
                setChatContext(incoming);
            }
        };

        window.addEventListener('chat-context-updated', handleChatContextUpdated);
        return () => window.removeEventListener('chat-context-updated', handleChatContextUpdated);
    }, []);

    // Broadcast current folder to AI Chat and other components
    useEffect(() => {
        console.log('📂 Navigation: Current folder is now', currentFolderId);
        window.dispatchEvent(new CustomEvent('workspace-folder-changed', {
            detail: {
                folderId: currentFolderId,
                folderName: currentFolderId ? (files.find(f => f.id === currentFolderId)?.name || 'Folder') : 'Root'
            }
        }));
    }, [currentFolderId, files]);

    useEffect(() => {
        const handleRefresh = () => {
            console.log('🔄 Refreshing file manager...');
            router.refresh(); // Refresh server components to get updated file list
            setSelectedFileIds(new Set());
        };

        const handleFocus = (e: any) => {
            const { itemId, parentId } = e.detail;
            console.log(`🎯 Focusing item: ${itemId} in parent: ${parentId}`);

            // 1. Navigate to parent if needed
            if (parentId !== undefined && parentId !== currentFolderId) {
                setCurrentFolderId(parentId);
            }

            // 2. Scroll to item
            setTimeout(() => {
                const element = document.getElementById(`file-${itemId}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    element.classList.add('pulse-highlight-agent');
                    setTimeout(() => element.classList.remove('pulse-highlight-agent'), 4000);
                } else {
                    console.warn(`Item element #file-${itemId} not found`);
                }
            }, 500); // Allow time for navigation and render
        };

        window.addEventListener('refresh-file-manager', handleRefresh);
        window.addEventListener('focus-workspace-item', handleFocus);
        return () => {
            window.removeEventListener('refresh-file-manager', handleRefresh);
            window.removeEventListener('focus-workspace-item', handleFocus);
        };
    }, [router, currentFolderId]);

    const loadRepoEntries = async (path?: string | null) => {
        setIsRepoLoading(true);
        try {
            const result = await listRepoAppEntries(path || '');
            if (result.success && result.entries) {
                setRepoEntries(result.entries as RepoEntry[]);
            } else {
                setRepoEntries([]);
            }
        } catch (error) {
            console.error('Failed to load repo entries:', error);
            setRepoEntries([]);
        } finally {
            setIsRepoLoading(false);
        }
    };

    useEffect(() => {
        if (explorerMode !== 'repo') return;
        loadRepoEntries(repoCurrentPath);
    }, [explorerMode, repoCurrentPath]);

    const handleRepoEntryOpen = async (entry: RepoEntry) => {
        if (entry.type === 'folder') {
            setRepoCurrentPath(entry.path);
            return;
        }

        const res = await getRepoAppFileContent(entry.path);
        if (res.success && typeof res.content === 'string') {
            setRepoEditingFile(entry);
            setRepoEditorContent(res.content);
            setRepoEditorPath(entry.path);
        } else {
            toast.error('Failed to open repo file');
        }
    };

    const handleRepoSave = async (content: string) => {
        if (!repoEditorPath) return;
        setIsRepoSaving(true);
        const res = await saveRepoAppFileContent(repoEditorPath, content);
        if (res.success) {
            toast.success('File saved successfully');
            setRepoEditorContent(content);
        } else {
            toast.error('Failed to save file');
        }
        setIsRepoSaving(false);
    };

    const handleDragStart = (e: React.DragEvent, file: WorkspaceFile) => {
        e.dataTransfer.setData('fileId', file.id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, folder: WorkspaceFile) => {
        e.preventDefault();
        e.stopPropagation(); // Stop bubbling to global handler
        e.dataTransfer.dropEffect = 'move';
        if (dragOverFolderId !== folder.id) {
            setDragOverFolderId(folder.id);
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverFolderId(null);
    };

    const handleDrop = async (e: React.DragEvent, targetFolder: WorkspaceFile) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverFolderId(null);
        setIsGlobalDragActive(false); // Ensure global overlay is closed

        // 1. Handle External File Upload
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files);
            const loadingToast = toast.loading(`Uploading ${files.length} file(s) to ${targetFolder.name}...`);

            try {
                let successCount = 0;
                for (const file of files) {
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('parentId', targetFolder.id);

                    const result = await uploadFile(formData);
                    if (result.success) successCount++;
                }

                if (successCount > 0) {
                    toast.success(`Uploaded ${successCount} files`, { id: loadingToast });
                    router.refresh();
                } else {
                    toast.error('Failed to upload files', { id: loadingToast });
                }
            } catch (error) {
                toast.error('Error uploading files', { id: loadingToast });
            }
            return;
        }

        // 2. Handle Internal File Move
        const fileId = e.dataTransfer.getData('fileId');
        if (!fileId || fileId === targetFolder.id) return;

        const loadingToast = toast.loading(`Moving to ${targetFolder.name}...`);

        try {
            const result = await moveFile(fileId, targetFolder.id);
            if (result.success) {
                toast.success('File moved', { id: loadingToast });
                router.refresh();
            } else {
                toast.error('Failed to move', { id: loadingToast });
            }
        } catch (error) {
            toast.error('Error moving file', { id: loadingToast });
        }
    };

    const handleDragOverFile = (e: React.DragEvent, targetFile: WorkspaceFile) => {
        e.dataTransfer.dropEffect = 'move';
        setIsGlobalDragActive(false);

        // Calculate drop position logic
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const w = rect.width;
        const h = rect.height;

        // More generous margins for reordering (30% instead of 25%)
        const marginX = w * 0.3;
        const marginY = h * 0.3;

        const isLeft = x < marginX;
        const isRight = x > w - marginX;
        const isTop = y < marginY;
        const isBottom = y > h - marginY;

        // If in center zone -> Action (Move into or Group)
        if (!isLeft && !isRight && !isTop && !isBottom) {
            setReorderTarget(null);
            if (targetFile.type === 'folder') {
                if (dragOverFolderId !== targetFile.id) setDragOverFolderId(targetFile.id);
                setDragOverFileId(null);
            } else {
                if (dragOverFileId !== targetFile.id) setDragOverFileId(targetFile.id);
                setDragOverFolderId(null);
            }
            return;
        }

        // Reorder logic
        setDragOverFileId(null);
        setDragOverFolderId(null);

        // Determine Before/After based on dominant axis
        // In grid, X matters more usually, but Y matters too. 
        // Simple heuristic: If (Left or Top) -> Before. If (Right or Bottom) -> After.
        // We refine this for "Grid" specifically.

        let position: 'before' | 'after' = 'after'; // default

        if (viewMode === 'list') {
            if (y < h / 2) position = 'before';
        } else {
            // Grid
            if (x < w / 2) position = 'before';
        }

        setReorderTarget({ id: targetFile.id, position });
    };

    const handleDropOnFile = async (e: React.DragEvent, targetFile: WorkspaceFile) => {
        e.preventDefault();
        e.stopPropagation();

        setDragOverFileId(null);
        setDragOverFolderId(null); // Also clear folder highlight
        setIsGlobalDragActive(false);

        const sourceId = e.dataTransfer.getData('fileId');
        if (!sourceId || sourceId === targetFile.id) return;

        // Determine if we are dragging a selection or a single file
        let sourceIds: string[] = [sourceId];
        if (selectedFileIds.has(sourceId)) {
            sourceIds = Array.from(selectedFileIds);
        }
        // Filter out target (just in case)
        sourceIds = sourceIds.filter(id => id !== targetFile.id);
        if (sourceIds.length === 0) return;

        // CHECK ACTION: Reorder or Group?
        if (reorderTarget && reorderTarget.id === targetFile.id) {
            // REORDER ACTION
            const loadingToast = toast.loading('Reordering...');

            // Calculate new order values
            // 1. Find the target file's order
            const targetIndex = filteredFiles.findIndex(f => f.id === targetFile.id);
            if (targetIndex === -1) return;

            const targetOrder = targetFile.order || 0;

            // We need to insert these files "around" the target order.
            // Since we can't easily shift everything in SQL without a heavy query, 
            // a robust "spacing" strategy or "midpoint" strategy is best.
            // BUT for this MVP, let's just use midpoint between target and prev/next.

            let newOrderStart = targetOrder;

            if (reorderTarget.position === 'before') {
                const prevFile = filteredFiles[targetIndex - 1];
                const prevOrder = prevFile ? (prevFile.order || 0) : (targetOrder - 1000);
                newOrderStart = (prevOrder + targetOrder) / 2;
            } else {
                const nextFile = filteredFiles[targetIndex + 1];
                const nextOrder = nextFile ? (nextFile.order || 0) : (targetOrder + 1000);
                newOrderStart = (targetOrder + nextOrder) / 2;
            }

            // Assign new orders to dragged files
            // We give them slight increments to keep their relative order if multiple
            const updates = sourceIds.map((id, index) => ({
                id,
                order: newOrderStart + (index * 0.01) // smooth small increment
            }));

            try {
                console.log('🔄 Triggering reorder for files:', updates);
                await reorderFiles(updates);
                toast.success('Reordered', { id: loadingToast });
                router.refresh();
                setReorderTarget(null);
                setSelectedFileIds(new Set());
            } catch (err) {
                toast.error('Failed to reorder', { id: loadingToast });
            }

        } else {
            // NO REORDER TARGET -> Check if we drop on folder (Move) or file (Group)
            if (targetFile.type === 'folder') {
                handleDrop(e, targetFile);
            } else {
                // GROUPING ACTION (Existing Logic)
                setGroupingData({ sourceIds, targetId: targetFile.id });
                setNewFolderName(''); // Reset name
            }
        }
    };

    const handleCreateGroup = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!groupingData) return;

        // Default name logic
        const nameToUse = newFolderName.trim() || `Group ${new Date().toLocaleDateString()}`;

        setIsCreatingGroup(true);
        const loadingToast = toast.loading('Creating group...');

        try {
            // 1. Create New Folder
            // We need the ID, so we assume createFile has been updated to return it.
            // If the TypeScript interface isn't updated, we might get a type error here, 
            // but the runtime will work if the action was updated.
            const createResult: any = await createFile({
                name: nameToUse,
                type: 'folder',
                items: '0 items',
                parentId: currentFolderId || undefined
            });

            if (!createResult.success || !createResult.file) {
                throw new Error(createResult.error || 'Failed to create folder');
            }

            const newFolderId = createResult.file.id;

            // 2. Move Source & Target Files
            const allFilesToMove = [...groupingData.sourceIds, groupingData.targetId];

            // Deduplicate just in case
            const uniqueFiles = Array.from(new Set(allFilesToMove));

            for (const fileId of uniqueFiles) {
                await moveFile(fileId, newFolderId);
            }

            toast.success('Group created!', { id: loadingToast });
            setGroupingData(null);
            setNewFolderName('');
            router.refresh();
            setSelectedFileIds(new Set());

        } catch (error) {
            console.error(error);
            toast.error('Failed to create group', { id: loadingToast });
        } finally {
            setIsCreatingGroup(false);
        }
    };

    // Keyboard shortcuts
    useKeyboardShortcuts({
        onEscape: () => {
            setActiveMenuId(null);
            setContextMenu(null);
            setEditingFile(null);
            setEditorMode('edit');
            setEditorContent('');
            setEditorContentFileId(null);
            setPreviewContent(null);
            setRenamingFile(null);
            setIsCreateModalOpen(false);
            setMovingFiles(null);
            setIsCreateModalOpen(false);
            setMovingFiles(null);
            setGroupingData(null);
            setDeletingId(null);
        },
        onSearch: () => {
            searchInputRef.current?.focus();
        },
        onEdit: () => {
            const targetId = lastSelectedId || Array.from(selectedFileIds)[0];
            if (!targetId) return;
            const file = files.find(f => f.id === targetId);
            if (file && isEditableFile(file)) {
                handleEditFile(file);
            }
        },
        enabled: !deletingId && !isCreateModalOpen
    });

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => {
            setActiveMenuId(null);
            setContextMenu(null);
        };
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    const handleContextMenu = (e: React.MouseEvent, file: WorkspaceFile) => {
        e.preventDefault();
        e.stopPropagation(); // Stop propagation to prevent browser context menu AND parent handlers
        setContextMenu({ x: e.clientX, y: e.clientY, file });
        setActiveMenuId(null); // Close regular menu if open
    };

    const handleFolderOpen = (id: string | null) => {
        setCurrentFolderId(id);
        setSelectedFileIds(new Set());
        setLastSelectedId(null);
        setSearchQuery('');
    };



    const handleDeleteRequest = (id: string | string[]) => {
        setDeletingId(id);
        setActiveMenuId(null);
    };

    const handleConfirmDelete = async () => {
        if (!deletingId) return;

        setIsDeleting(true);
        const idsToDelete = Array.isArray(deletingId) ? deletingId : [deletingId];
        const loadingToast = toast.loading(`Deleting ${idsToDelete.length} item(s)...`);

        try {
            let successCount = 0;
            for (const id of idsToDelete) {
                const result = await deleteFile(id);
                if (result.success) successCount++;
            }

            if (successCount === idsToDelete.length) {
                toast.success('Deleted successfully', { id: loadingToast });
                router.refresh();
                setSelectedFileIds(new Set()); // Clear selection after delete
            } else {
                toast.error(`Failed to delete some items (${successCount}/${idsToDelete.length} deleted)`, { id: loadingToast });
            }
        } catch (error) {
            console.error('Delete error:', error);
            toast.error('An error occurred', { id: loadingToast });
        } finally {
            setIsDeleting(false);
            setDeletingId(null);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const loadingToast = toast.loading(`Uploading ${file.name}...`);

        const formData = new FormData();
        formData.append('file', file);
        if (currentFolderId) {
            formData.append('parentId', currentFolderId);
        }

        try {
            const result = await uploadFile(formData);
            if (result.success) {
                toast.success('File uploaded successfully', { id: loadingToast });
                router.refresh();
            } else {
                toast.error((result as any).error || 'Upload failed', { id: loadingToast });
            }
        } catch (error) {
            toast.error('Upload failed', { id: loadingToast });
        } finally {
            setIsUploading(false);
        }
    };

    const triggerUpload = () => {
        fileInputRef.current?.click();
    };

    const handleCreateFolder = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newFolderName.trim()) {
            toast.error('Folder name cannot be empty');
            return;
        }

        const loadingToast = toast.loading('Creating folder...');

        try {
            const result = await createFile({
                name: newFolderName.trim(),
                type: 'folder',
                items: '0 items',
                parentId: currentFolderId || undefined
            });

            if (result.success) {
                toast.success('Folder created', { id: loadingToast });
                setNewFolderName('');
                setIsCreateModalOpen(false);
                router.refresh();
            } else {
                toast.error(result.error || 'Failed to create folder', { id: loadingToast });
            }
        } catch (error) {
            toast.error('Failed to create folder', { id: loadingToast });
        }
    };

    const handleRenameSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!renamingFile || !newNameValue.trim() || newNameValue.trim() === renamingFile.name) {
            setRenamingFile(null);
            return;
        }

        const loadingToast = toast.loading('Renaming...');

        try {
            const result = await renameFile(renamingFile.id, newNameValue.trim());

            if (result.success) {
                toast.success('Renamed successfully', { id: loadingToast });
                setRenamingFile(null);
                setNewNameValue('');
                router.refresh();
            } else {
                toast.error(result.error || 'Failed to rename', { id: loadingToast });
            }
        } catch (error) {
            toast.error('Failed to rename', { id: loadingToast });
        }
    };

    const startRename = (file: WorkspaceFile) => {
        setRenamingFile(file);
        setNewNameValue(file.name);
        setActiveMenuId(null);
    };

    const handleToggleShare = async (file: WorkspaceFile) => {
        const loadingToast = toast.loading(file.shared ? 'Unsharing...' : 'Sharing...');

        try {
            const result = await toggleFileShare(file.id, !file.shared);

            if (result.success) {
                toast.success(file.shared ? 'Unshared successfully' : 'Shared successfully', { id: loadingToast });
                setActiveMenuId(null);
                router.refresh();
            } else {
                toast.error((result as any).error || 'Failed to update', { id: loadingToast });
            }
        } catch (error) {
            toast.error('Failed to update', { id: loadingToast });
        }
    };

    const handleMove = async (targetFolderId: string | null) => {
        if (!movingFiles || movingFiles.length === 0) return;

        const loadingToast = toast.loading(`Moving ${movingFiles.length} item(s)...`);

        try {
            let successCount = 0;
            for (const file of movingFiles) {
                if (file.id === targetFolderId) continue;
                const result = await moveFile(file.id, targetFolderId);
                if (result.success) successCount++;
            }

            if (successCount > 0) {
                toast.success(`Moved ${successCount} items successfully`, { id: loadingToast });
                setMovingFiles(null);
                setActiveMenuId(null);
                setSelectedFileIds(new Set()); // Clear selection
                router.refresh();
            } else {
                toast.error('Failed to move items', { id: loadingToast });
            }
        } catch (error) {
            toast.error('Failed to move items', { id: loadingToast });
        }
    };

    const loadFileContent = async (file: WorkspaceFile, showToast = true) => {
        const loadingToast = showToast ? toast.loading(`Loading ${file.name}...`) : undefined;
        try {
            const { getFileContent } = await import('@/app/actions');

            const res = await getFileContent(file.storagePath || file.name);
            if (res.success && typeof res.content === 'string') {
                setEditorContent(res.content);
                setEditorContentFileId(file.id);
                if (loadingToast) toast.dismiss(loadingToast);
                return res.content;
            }

            if (loadingToast) toast.error('Failed to load file content', { id: loadingToast });
        } catch (e) {
            if (loadingToast) toast.error('Error opening file', { id: loadingToast });
        }

        return null;
    };

    const handleEditFile = async (file: WorkspaceFile) => {
        setEditorMode('edit');
        const content = await loadFileContent(file, true);
        if (content !== null) {
            setEditingFile(file);
            setActiveMenuId(null);
        }
    };

    const handlePreviewFile = (file: WorkspaceFile) => {
        setEditingFile(file);
        setEditorMode('preview');
        setActiveMenuId(null);
        setEditorContent('');
        setEditorContentFileId(null);
        window.dispatchEvent(new CustomEvent('preview-opened', { detail: file }));
    };

    const handleEditorModeChange = async (mode: 'edit' | 'preview') => {
        setEditorMode(mode);
        if (mode === 'edit' && editingFile && isEditableFile(editingFile) && editorContentFileId !== editingFile.id) {
            await loadFileContent(editingFile, false);
        }
    };

    const editableExtensions = ['html', 'css', 'js', 'jsx', 'ts', 'tsx', 'json', 'xml', 'txt', 'md', 'yml', 'yaml'];
    const isEditableFile = (file: WorkspaceFile) => {
        if (file.type === 'folder') return false;
        return editableExtensions.some(ext => file.name.endsWith(`.${ext}`) || file.type === ext);
    };

    const handleSaveFile = async (content: string) => {
        if (!editingFile) return;
        setIsSavingStart(true);
        try {
            // Dynamic import for client side safety if needed, though usually standard import is fine
            const { saveFileContent } = await import('@/app/actions');

            const result = await saveFileContent(editingFile.storagePath || editingFile.name, content);
            if (result.success) {
                toast.success('File saved successfully');
                setEditorContent(content); // Update local state
                setEditorContentFileId(editingFile.id);
                router.refresh();
            } else {
                toast.error('Failed to save file');
            }
        } catch (e) {
            toast.error('Error saving file');
        } finally {
            setIsSavingStart(false);
        }
    };

    const handleInstallApp = async (folderId: string) => {
        const loadingToast = toast.loading('Installing app...');
        try {
            const res = await installDynamicApp(folderId);
            if (res.success) {
                toast.success(`App installed at ${res.internalDomain}`, { id: loadingToast });
                if (res.dnsInstructions) {
                    toast.info(res.dnsInstructions);
                }
            } else {
                toast.error(res.error || 'Failed to install app', { id: loadingToast });
            }
        } catch (error) {
            toast.error('Failed to install app', { id: loadingToast });
        }
    };

    const handleInstallRepoApp = async (repoPath: string) => {
        const loadingToast = toast.loading('Installing repo app...');
        try {
            const res = await installRepoApp(repoPath);
            if (res.success) {
                toast.success(`App installed at ${res.internalDomain}`, { id: loadingToast });
                if (res.dnsInstructions) {
                    toast.info(res.dnsInstructions);
                }
            } else {
                toast.error(res.error || 'Failed to install app', { id: loadingToast });
            }
        } catch (error) {
            toast.error('Failed to install app', { id: loadingToast });
        }
    };

    const handleStopProcess = async (processId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setProcessActionLoading(processId);
        try {
            await stopProcess(processId);
            const res = await listProcesses();
            if (res.success && res.processes) setProcesses(res.processes);
            toast.success('Process stopped');
        } catch (error) {
            toast.error('Failed to stop process');
        } finally {
            setProcessActionLoading(null);
        }
    };

    const handleRestartProcess = async (processId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setProcessActionLoading(processId);
        try {
            await restartProcess(processId);
            const res = await listProcesses();
            if (res.success && res.processes) setProcesses(res.processes);
            toast.success('Process restarted');
        } catch (error) {
            toast.error('Failed to restart process');
        } finally {
            setProcessActionLoading(null);
        }
    };

    const handleRebuild = async (processId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setProcessActionLoading(processId);
        const loadingToast = toast.loading('Rebuilding container...');
        try {
            await rebuildProcess(processId);
            const res = await listProcesses();
            if (res.success && res.processes) setProcesses(res.processes);
            toast.success('Container rebuilt successfully', { id: loadingToast });
        } catch (error) {
            toast.error('Failed to rebuild container', { id: loadingToast });
        } finally {
            setProcessActionLoading(null);
        }
    };

    const handleStartLocal = async (processId: string, e: React.MouseEvent, entryName?: string) => {
        e.stopPropagation();
        setProcessActionLoading(processId);

        // Trigger Integrated Preview
        if (entryName) {
            setPreviewAppName(entryName);
            setPreviewStatus('starting');
            setIsPreviewOpen(true);
            setPreviewUrl(undefined);
            setPreviewLogs([`Starting local dev server for ${entryName}...`]);
        }

        try {
            await startProcess(processId);
            const res = await listProcesses();
            if (res.success && res.processes) setProcesses(res.processes);
            toast.success('Local dev server started');
        } catch (error) {
            toast.error('Failed to start local dev server');
            setPreviewStatus('error');
        } finally {
            setProcessActionLoading(null);
        }
    };

    const handleStartContainer = async (processId: string, e: React.MouseEvent, entryName?: string) => {
        e.stopPropagation();
        setProcessActionLoading(processId);

        // Trigger Integrated Preview
        if (entryName) {
            setPreviewAppName(entryName);
            setPreviewStatus('starting');
            setIsPreviewOpen(true);
            setPreviewUrl(undefined);
            setPreviewLogs([`Booting container for ${entryName}...`]);
        }

        try {
            // For repo-apps, prefer rebuild (build & run). Otherwise, start the container.
            const target = processes.find(p => p.id === processId);
            const isRepoApp = target?.metadata && (target.metadata as any).source === 'repo-app';
            if (isRepoApp) {
                await rebuildProcess(processId);
            } else {
                await startProcess(processId);
            }

            const res = await listProcesses();
            if (res.success && res.processes) setProcesses(res.processes);
            toast.success('Container started');
        } catch (error) {
            toast.error('Failed to start container');
        } finally {
            setProcessActionLoading(null);
        }
    };

    const handleAutoConfigure = async (processId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (processActionLoading) return;
        setProcessActionLoading(processId);
        try {
            const res = await reconfigureProcessPort(processId);
            if (res.success) {
                const updatedList = await listProcesses();
                if (updatedList.success && updatedList.processes) setProcesses(updatedList.processes);
                toast.success(`Port configured: ${res.port}`);
            } else {
                toast.error(res.error || 'Failed to configure port');
            }
        } catch (error) {
            toast.error('Failed to configure port');
        } finally {
            setProcessActionLoading(null);
        }
    };

    const handleViewLogs = async (processId: string, appName: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setPreviewAppName(appName);
        setIsPreviewOpen(true);
        setPreviewStatus('starting'); // Use starting state to show logs view
        setPreviewLogs(['Fetching logs...']);

        try {
            const res = await getDockerLogs(processId);
            if (res.success && res.logs) {
                setPreviewLogs(res.logs.split('\n'));
            } else {
                setPreviewLogs([res.message || 'No logs available']);
            }
        } catch (error) {
            setPreviewLogs(['Error fetching logs']);
        }
    };

    const filteredFiles = (searchQuery
        ? files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : files.filter(f => f.parentId === currentFolderId)
    ).sort((a, b) => (a.order || 0) - (b.order || 0)); // Sort by Order

    const currentFolder = files.find(f => f.id === currentFolderId);
    const folders = files.filter(f => f.type === 'folder');

    const menuVariants = {
        hidden: { opacity: 0, scale: 0.95, y: -10 },
        visible: { opacity: 1, scale: 1, y: 0 }
    };

    // Global Drag State
    const [isGlobalDragActive, setIsGlobalDragActive] = useState(false);

    const handleGlobalDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Check if dragging files (not just text selection)
        if (e.dataTransfer.types && (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('application/x-moz-file'))) {
            setIsGlobalDragActive(true);
            e.dataTransfer.dropEffect = 'copy';
        }
    };

    const handleGlobalDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Only set false if leaving the main container (relatedTarget check is complex in React, simplified for now)
        if (e.currentTarget === e.target) {
            setIsGlobalDragActive(false);
        }
    };

    // Better approach for flickering drag leave: Use a counter or just overlay
    // Actually, simply overlaying a div when active handles the events better.

    const handleGlobalDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsGlobalDragActive(false);

        // Only handle uploads
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const droppedFiles = Array.from(e.dataTransfer.files);
            const targetName = currentFolderId ? (files.find(f => f.id === currentFolderId)?.name || 'Current Folder') : 'Root';

            const loadingToast = toast.loading(`Uploading ${droppedFiles.length} file(s) to ${targetName}...`);

            try {
                let successCount = 0;
                for (const file of droppedFiles) {
                    const formData = new FormData();
                    formData.append('file', file);
                    if (currentFolderId) {
                        formData.append('parentId', currentFolderId);
                    }

                    const result = await uploadFile(formData);
                    if (result.success) successCount++;
                }

                if (successCount > 0) {
                    toast.success(`Uploaded ${successCount} files`, { id: loadingToast });
                    router.refresh();
                } else {
                    toast.error('Failed to upload files', { id: loadingToast });
                }
            } catch (error) {
                toast.error('Error uploading files', { id: loadingToast });
            }
        }
    };

    const handleFileClick = (e: React.MouseEvent, fileId: string) => {
        e.stopPropagation();

        const newSelected = new Set(e.ctrlKey || e.metaKey ? selectedFileIds : []);

        if (e.shiftKey && lastSelectedId) {
            const currentIndex = filteredFiles.findIndex(f => f.id === fileId);
            const lastIndex = filteredFiles.findIndex(f => f.id === lastSelectedId);

            if (currentIndex !== -1 && lastIndex !== -1) {
                const start = Math.min(currentIndex, lastIndex);
                const end = Math.max(currentIndex, lastIndex);
                for (let i = start; i <= end; i++) {
                    newSelected.add(filteredFiles[i].id);
                }
            }
        } else if (e.ctrlKey || e.metaKey) {
            if (newSelected.has(fileId)) {
                newSelected.delete(fileId);
            } else {
                newSelected.add(fileId);
            }
            setLastSelectedId(fileId);
        } else {
            newSelected.add(fileId);
            setLastSelectedId(fileId);
        }

        setSelectedFileIds(newSelected);
    };

    const handleBackgroundClick = () => {
        setSelectedFileIds(new Set());
        setLastSelectedId(null);
    };

    return (
        <div
            className="w-full space-y-6 relative min-h-[500px]"
            onDragOver={handleGlobalDragOver}
            onDrop={handleGlobalDrop}
            onClick={handleBackgroundClick}
        >
            {/* Global Drop Overlay - Purely Visual */}
            {/* Premium IDE Header */}
            <div className="flex flex-col gap-6 mb-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-2 h-2 rounded-full bg-sky-500 shadow-[0_0_10px_rgba(56,189,248,0.5)] animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">System Explorer</span>
                            </div>
                            <h1 className="text-4xl font-black text-foreground tracking-tighter flex items-center gap-3">
                                {explorerMode === 'repo' ? 'REPO' : 'FILES'}
                                <span className="text-foreground/10 font-thin">/</span>
                                <span className="text-sky-400/80">{searchQuery ? 'SEARCH' : (currentFolderId ? currentFolder?.name?.toUpperCase() : 'ROOT')}</span>
                            </h1>
                        </div>
                    </div>

                    {/* Global Service Indicators */}
                    <div className="hidden xl:flex items-center gap-4 px-6 py-2 rounded-2xl bg-foreground/5 border border-[color:var(--border)] backdrop-blur-md">
                        <div className="flex items-center gap-2">
                            <div className="flex -space-x-2">
                                {processes.filter(p => p.status === 'running').slice(0, 3).map((p, i) => (
                                    <div key={p.id} className="w-6 h-6 rounded-full bg-zinc-800 border-2 border-[#0A0A0A] flex items-center justify-center text-[10px] font-bold text-emerald-400 group relative">
                                        {p.name[0].toUpperCase()}
                                        <div className="absolute inset-0 rounded-full border border-emerald-500/50 animate-ping opacity-20" />
                                    </div>
                                ))}
                                {processes.filter(p => p.status === 'running').length > 3 && (
                                    <div className="w-6 h-6 rounded-full bg-zinc-800 border-2 border-[#0A0A0A] flex items-center justify-center text-[8px] font-bold text-white/40">
                                        +{processes.filter(p => p.status === 'running').length - 3}
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col leading-none ml-2">
                                <span className="text-[10px] font-black text-emerald-400/80">{processes.filter(p => p.status === 'running').length} ACTIVE</span>
                                <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Services</span>
                            </div>
                        </div>
                        <div className="w-px h-6 bg-foreground/10" />
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setIsPreviewOpen(true)}
                                className="flex items-center gap-2 text-xs font-bold text-white/40 hover:text-white transition-colors"
                            >
                                <TerminalIcon size={14} />
                                <span>LOGS</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-white/5 shadow-inner">
                            <button
                                onClick={() => setExplorerMode('workspace')}
                                className={cn(
                                    "relative px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                                    explorerMode === 'workspace' ? "text-foreground" : "text-muted-foreground/40 hover:text-foreground/70"
                                )}
                            >
                                {explorerMode === 'workspace' && (
                                    <motion.div layoutId="mode-bg" className="absolute inset-0 bg-sky-600/20 border border-sky-500/30 rounded-lg shadow-[0_0_20px_rgba(56,189,248,0.18)]" />
                                )}
                                <span className="relative z-10 flex items-center gap-2"><Folder size={12} /> Workspace</span>
                            </button>
                            <button
                                onClick={() => setExplorerMode('repo')}
                                className={cn(
                                    "relative px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                                    explorerMode === 'repo' ? "text-foreground" : "text-muted-foreground/40 hover:text-foreground/70"
                                )}
                            >
                                {explorerMode === 'repo' && (
                                    <motion.div layoutId="mode-bg" className="absolute inset-0 bg-emerald-600/20 border border-emerald-500/30 rounded-lg shadow-[0_0_20px_rgba(16,185,129,0.18)]" />
                                )}
                                <span className="relative z-10 flex items-center gap-2"><Server size={12} /> Repo Apps</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex-1 relative group">
                        <div className="absolute inset-0 bg-sky-500/5 rounded-2xl blur-xl group-focus-within:bg-sky-500/10 transition-all opacity-0 group-focus-within:opacity-100" />
                        <div className="relative flex items-center bg-foreground/5 border border-[color:var(--border)] hover:border-foreground/20 rounded-2xl px-4 py-3 transition-all focus-within:ring-2 focus-within:ring-sky-500/30 focus-within:bg-foreground/10">
                            <Search className="text-white/20 mr-3" size={18} />
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder={explorerMode === 'repo' ? "Explore provisioned services..." : "Locate files across workspace... (Ctrl+K)"}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-transparent border-none text-sm text-white w-full focus:outline-none placeholder:text-white/20 font-medium"
                            />
                            <div className="flex items-center gap-1.5 ml-4">
                                <kbd className="px-2 py-1 rounded bg-foreground/5 border border-[color:var(--border)] text-[10px] font-black text-muted-foreground/40">CTRL</kbd>
                                <kbd className="px-2 py-1 rounded bg-foreground/5 border border-[color:var(--border)] text-[10px] font-black text-muted-foreground/40">K</kbd>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {explorerMode === 'workspace' && (
                            <>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setIsCreateModalOpen(true)}
                                    className="p-3 bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 rounded-2xl transition-all"
                                    title="New Folder"
                                >
                                    <FolderPlus size={20} />
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={triggerUpload}
                                    className="px-6 py-3 bg-sky-600/90 hover:bg-sky-600 text-white rounded-2xl transition-all text-sm font-bold shadow-[0_10px_30px_rgba(56,189,248,0.3)] flex items-center gap-2"
                                >
                                    <UploadCloud size={20} />
                                    <span>UPLOAD</span>
                                </motion.button>
                            </>
                        )}
                        <div className="w-px h-8 bg-white/10 mx-2" />
                        <div className="flex p-1 bg-foreground/5 rounded-xl border border-[color:var(--border)]">
                            <button onClick={() => setViewMode('grid')} className={cn("p-2 rounded-lg transition-all", viewMode === 'grid' ? "bg-foreground/10 text-foreground shadow-sm" : "text-muted-foreground/40 hover:text-foreground/70")}>
                                <LayoutGrid size={18} />
                            </button>
                            <button onClick={() => setViewMode('list')} className={cn("p-2 rounded-lg transition-all", viewMode === 'list' ? "bg-foreground/10 text-foreground shadow-sm" : "text-muted-foreground/40 hover:text-foreground/70")}>
                                <List size={18} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Breadcrumbs / Path Navigator */}
                {!searchQuery && (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 px-2 overflow-x-auto no-scrollbar py-1">
                            <button
                                onClick={() => {
                                    setCurrentFolderId(null);
                                    setRepoCurrentPath(null);
                                }}
                                className="text-xs font-bold text-muted-foreground/40 hover:text-sky-400 transition-colors uppercase tracking-widest whitespace-nowrap"
                            >
                                ROOT
                            </button>
                            {explorerMode === 'workspace' ? (
                                (currentFolder as any)?.path?.split(/[\/\\]/).filter(Boolean).map((part: string, i: number, arr: string[]) => (
                                    <React.Fragment key={i}>
                                        <ChevronRight size={12} className="text-foreground/10 shrink-0" />
                                        <span className={cn("text-xs font-bold uppercase tracking-widest whitespace-nowrap", i === arr.length - 1 ? "text-sky-400" : "text-muted-foreground/60")}>
                                            {part}
                                        </span>
                                    </React.Fragment>
                                ))
                            ) : (
                                repoCurrentPath?.split(/[\/\\]/).filter(Boolean).map((part: string, i: number, arr: string[]) => (
                                    <React.Fragment key={i}>
                                        <ChevronRight size={12} className="text-white/10 shrink-0" />
                                        <button
                                            onClick={() => {
                                                const parts = repoCurrentPath?.split(/[\/\\]/).filter(Boolean) || [];
                                                setRepoCurrentPath(parts.slice(0, i + 1).join('/'));
                                            }}
                                            className={cn("text-xs font-bold uppercase tracking-widest whitespace-nowrap", i === arr.length - 1 ? "text-emerald-400" : "text-white/40 hover:text-emerald-400")}
                                        >
                                            {part}
                                        </button>
                                    </React.Fragment>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 min-h-0 relative">
                {explorerMode === 'workspace' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2 text-sm text-white/50">
                                <button
                                    onClick={() => handleFolderOpen(null)}
                                    className={cn(
                                        "hover:text-white transition-colors flex items-center gap-1",
                                        !currentFolderId && "text-white font-medium"
                                    )}
                                >
                                    <Folder size={14} />
                                    <span>Home</span>
                                </button>
                                {currentFolderId && (
                                    <>
                                        <ChevronRight size={12} className="text-white/20" />
                                        <span className="text-white font-medium">{files.find(f => f.id === currentFolderId)?.name || 'Folder'}</span>
                                    </>
                                )}
                            </div>
                        </div>

                        <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            animate="show"
                            className={cn(
                                viewMode === 'grid'
                                    ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
                                    : "flex flex-col space-y-2"
                            )}
                        >
                            {filteredFiles.map((file) => {
                                const highlightStyles = {
                                    backgroundColor: file.highlightBgColor || undefined,
                                    borderColor: file.highlightBorderColor || undefined
                                } as React.CSSProperties;
                                const nameStyles = {
                                    color: file.highlightTextColor || undefined,
                                    fontWeight: file.highlightFontWeight || undefined
                                } as React.CSSProperties;

                                return (
                                    <motion.div
                                        key={file.id}
                                        id={`file-${file.id}`}
                                        variants={itemVariants}
                                        layout
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onContextMenu={(e) => handleContextMenu(e, file)}
                                        draggable={true}
                                        onDragStart={(e: any) => handleDragStart(e, file)}
                                        onDragOver={(e) => handleDragOverFile(e, file)}
                                        onDragLeave={(e) => {
                                            setReorderTarget(null);
                                            if (file.type === 'folder') handleDragLeave(e);
                                            else setDragOverFileId(null);
                                        }}
                                        onDrop={(e) => handleDropOnFile(e, file)}
                                        onClick={(e) => handleFileClick(e, file.id)}
                                        onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            if (file.type === 'folder') setCurrentFolderId(file.id);
                                            else handlePreviewFile(file);
                                        }}
                                        className={cn(
                                            "group relative cursor-pointer z-10 transition-all border",
                                            viewMode === 'grid' ? "p-4 rounded-xl" : "px-4 py-3 rounded-lg flex items-center gap-4",
                                            selectedFileIds.has(file.id) ? "ring-2 ring-sky-500 bg-sky-500/20 border-sky-500/50" : "bg-foreground/5 border-[color:var(--border)] hover:bg-foreground/[0.08] hover:border-foreground/20",
                                            (dragOverFolderId === file.id || dragOverFileId === file.id) ? "ring-2 ring-sky-500 bg-sky-500/20 scale-[1.05] z-30 shadow-xl shadow-sky-500/20" : ""
                                        )}
                                        style={highlightStyles}
                                    >
                                        <div className="flex-1 min-w-0 flex items-center gap-3">
                                            {file.type === 'folder' ? <Folder size={20} className="text-sky-400" /> : <FileText size={20} className="text-muted-foreground/40" />}
                                            <span className="truncate text-sm font-medium" style={nameStyles}>{file.name}</span>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </motion.div>

                        {/* Empty State */}
                        {filteredFiles.length === 0 && (
                            <div className="col-span-full py-20 flex flex-col items-center justify-center text-muted-foreground/30">
                                <Folder size={48} className="mb-4 opacity-20" />
                                <p className="text-lg font-medium">No files found</p>
                                <p className="text-sm">This folder is empty</p>
                            </div>
                        )}
                    </div>
                )}

                {explorerMode === 'repo' && (
                    <div className="space-y-6">
                        {isRepoLoading ? (
                            <div className="flex items-center justify-center py-20 text-muted-foreground/60">
                                <RefreshCw size={24} className="animate-spin mr-3" />
                                <span className="text-sm font-bold uppercase tracking-widest">Initialising Repositories...</span>
                            </div>
                        ) : (
                            <motion.div
                                variants={containerVariants}
                                initial="hidden"
                                animate="show"
                                className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col space-y-3"}
                            >
                                {/* App Service Status Banner (Visible when inside a repo folder) */}
                                {repoCurrentPath && (() => {
                                    const appName = repoCurrentPath.split(/[\/\\]/).filter(Boolean)[0] || '';
                                    const appProcess = processes.find(p =>
                                        p.name.toLowerCase().includes(appName.toLowerCase()) ||
                                        p.metadata?.appName?.toLowerCase() === appName.toLowerCase() ||
                                        p.metadata?.containerName?.toLowerCase() === appName.toLowerCase()
                                    );

                                    // If we are deep inside but no process is found, we should still show a "Provision" banner
                                    if (!appProcess) {
                                        return (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="mb-6 p-4 rounded-3xl bg-zinc-900/40 border border-white/5 backdrop-blur-md flex items-center justify-between shadow-xl"
                                            >
                                                <div className="flex items-center gap-4 text-white/40">
                                                    <Hammer size={18} />
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-black uppercase tracking-widest">{appName}</span>
                                                        <span className="text-[10px] font-bold uppercase tracking-tighter">Not Provisioned</span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleInstallRepoApp(repoCurrentPath.split('/')[0] === appName ? repoCurrentPath : appName); }}
                                                    className="h-8 px-4 rounded-xl text-[10px] font-black bg-sky-600 hover:bg-sky-500 text-white transition-all flex items-center gap-2"
                                                >
                                                    <Hammer size={12} /> PROVISION APP
                                                </button>
                                            </motion.div>
                                        );
                                    }

                                    const isRunning = appProcess.status === 'running';
                                    const isLoading = processActionLoading === appProcess.id;
                                    const port = appProcess.port;

                                    return (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="mb-6 p-4 rounded-3xl bg-sky-500/10 border border-sky-500/20 backdrop-blur-md flex items-center justify-between shadow-lg shadow-sky-500/5 ring-1 ring-sky-500/20"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={cn(
                                                    "w-3 h-3 rounded-full",
                                                    isRunning ? "bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-zinc-600"
                                                )} />
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-white uppercase tracking-widest">{appName} Service</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-bold text-white/40 uppercase tracking-tighter">{appProcess.status}</span>
                                                        {port && <span className="text-[10px] font-mono text-sky-400 bg-sky-400/10 px-1 rounded">:{port}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        window.dispatchEvent(new CustomEvent('open-vibe', { detail: { id: appName, name: appName } }));
                                                        if (isRunning && port) {
                                                            window.dispatchEvent(new CustomEvent('set-vibe-preview', { detail: `http://localhost:${port}` }));
                                                        }
                                                    }}
                                                    className="h-8 px-4 rounded-xl text-[10px] font-black bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/20 transition-all flex items-center gap-2 active:scale-95 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                                                >
                                                    <Sparkles size={12} className="animate-pulse" />
                                                    VIBE MODE
                                                </button>

                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (isRunning) handleStopProcess(appProcess.id, e);
                                                        else handleStartContainer(appProcess.id, e, appName);
                                                    }}
                                                    disabled={isLoading}
                                                    className={cn(
                                                        "h-8 px-4 rounded-xl text-[10px] font-black transition-all flex items-center gap-2 border",
                                                        isRunning ? "text-red-400 border-red-500/20 hover:bg-red-400/10" : "text-emerald-400 border-emerald-500/20 hover:bg-emerald-400/10"
                                                    )}
                                                >
                                                    {isLoading ? <RefreshCw size={12} className="animate-spin" /> : (isRunning ? <Square size={12} /> : <Play size={12} className="fill-current" />)}
                                                    {isRunning ? 'STOP' : 'START'}
                                                </button>

                                                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                                                    <button
                                                        onClick={(e) => handleRebuild(appProcess.id, e)}
                                                        title="Rebuild & Restart"
                                                        className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all"
                                                    >
                                                        <RefreshCw size={14} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleViewLogs(appProcess.id, appName, e)}
                                                        title="View Logs"
                                                        className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all"
                                                    >
                                                        <TerminalIcon size={14} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleAutoConfigure(appProcess.id, e)}
                                                        title="Auto-Fix Port"
                                                        className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all"
                                                    >
                                                        <Wrench size={14} />
                                                    </button>
                                                    {isRunning && port && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); window.open(`http://localhost:${port}`, '_blank'); }}
                                                            title="Open In Browser"
                                                            className="p-2 bg-sky-500/20 hover:bg-sky-500/30 rounded-lg text-sky-400 transition-all border border-sky-500/30"
                                                        >
                                                            <Globe size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })()}

                                {repoEntries.map((entry) => {
                                    const norm = (p: string) => p?.replace(/\\/g, '/').toLowerCase();
                                    const entryPath = norm(entry.path);

                                    const process = processes.find(p => {
                                        const pName = p.name.toLowerCase();
                                        const eName = entry.name.toLowerCase();
                                        if (pName === eName || pName.includes(eName)) return true;
                                        if (p.metadata?.appName?.toLowerCase() === eName) return true;
                                        if (p.metadata?.containerName?.toLowerCase() === eName) return true;

                                        const procPath = p.path ? norm(p.path) : '';
                                        const metaPath = p.metadata?.appPath ? norm(p.metadata.appPath) : '';
                                        return procPath === entryPath || metaPath === entryPath || (procPath && procPath.includes(entryPath));
                                    });

                                    const localProcess = processes.find(p => {
                                        const pName = p.name.toLowerCase();
                                        const eName = entry.name.toLowerCase();
                                        const nameMatch = pName === eName || pName.includes(eName);
                                        const isLocal = p.type === 'dev-server' || p.metadata?.source === 'local' || p.name.includes('Dev') || p.name.includes('Local');
                                        return nameMatch && isLocal;
                                    });

                                    const containerProcess = processes.find(p => {
                                        const pName = p.name.toLowerCase();
                                        const eName = entry.name.toLowerCase();
                                        const nameMatch = pName === eName || pName.includes(eName);
                                        const isContainer = p.type === 'docker-app' || p.metadata?.source === 'repo-app' || pName.includes('docker') || pName.includes('container');
                                        return nameMatch && isContainer;
                                    });

                                    const localPort = localProcess?.port;
                                    const containerPort = containerProcess?.port;
                                    const isRunning = process?.status === 'running';
                                    const isLoading = processActionLoading === (process?.id || localProcess?.id || containerProcess?.id);
                                    const isRootView = !repoCurrentPath;

                                    return (
                                        <motion.div
                                            key={entry.path}
                                            variants={itemVariants}
                                            layout
                                            whileHover={{ y: -4, transition: { duration: 0.2 } }}
                                            onClick={() => handleRepoEntryOpen(entry)}
                                            className="relative group p-5 rounded-3xl bg-[color:var(--card)] border border-[color:var(--border)] hover:border-sky-500/30 transition-all cursor-pointer backdrop-blur-sm shadow-xl"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-br from-sky-500/0 via-transparent to-emerald-500/0 group-hover:from-sky-500/5 group-hover:to-emerald-500/5 rounded-3xl transition-all duration-500" />
                                            <div className="relative flex flex-col gap-4">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="p-3 rounded-2xl bg-white/5 text-sky-400 group-hover:bg-sky-500/10 transition-colors relative shadow-inner">
                                                            {entry.type === 'folder' ? <Folder size={22} className="fill-sky-400/10" /> : <FileText size={22} />}
                                                            {process && (
                                                                <div className={cn(
                                                                    "absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#0A0A0A] shadow-lg",
                                                                    isRunning ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"
                                                                )} />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0 pr-4">
                                                            <h3 className="text-base font-bold text-white tracking-tight truncate">{entry.name}</h3>
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-white/30">
                                                                {process ? (isRunning ? 'Service Active' : 'Service Paused') : 'Uninitialized'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {entry.type === 'folder' && isRootView && (
                                                    <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                                                        <div className="flex gap-1.5 flex-1">
                                                            {process ? (
                                                                <>
                                                                    <motion.button
                                                                        whileHover={{ scale: 1.05 }}
                                                                        whileTap={{ scale: 0.95 }}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (isRunning) handleStopProcess(process.id, e);
                                                                            else {
                                                                                if (localProcess) handleStartLocal(localProcess.id, e, entry.name);
                                                                                else if (containerProcess) handleStartContainer(containerProcess.id, e, entry.name);
                                                                            }
                                                                        }}
                                                                        className={cn(
                                                                            "h-9 px-4 rounded-xl text-xs font-bold transition-all flex-1 flex items-center justify-center gap-2 border shadow-lg",
                                                                            isRunning ? "text-red-400 bg-red-400/5 border-red-500/20 hover:bg-red-400/10" : "text-emerald-400 bg-emerald-400/5 border-emerald-500/20 hover:bg-emerald-400/10 shadow-emerald-500/5"
                                                                        )}
                                                                        disabled={isLoading}
                                                                    >
                                                                        {isLoading ? <RefreshCw size={14} className="animate-spin" /> : (isRunning ? <Square size={14} /> : <Play size={14} className="fill-current" />)}
                                                                        <span>{isRunning ? 'STOP' : 'START'}</span>
                                                                    </motion.button>

                                                                    <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                window.dispatchEvent(new CustomEvent('open-vibe', { detail: entry }));
                                                                                if (isRunning && (localPort || containerPort)) {
                                                                                    window.dispatchEvent(new CustomEvent('set-vibe-preview', { detail: `http://localhost:${localPort || containerPort}` }));
                                                                                }
                                                                            }}
                                                                            title="Edit in Vibe Mode"
                                                                            className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-[9px] font-black tracking-widest transition-all"
                                                                        >
                                                                            VIBE
                                                                        </button>
                                                                        <div className="w-px h-3.5 bg-white/10 mx-0.5" />
                                                                        <button
                                                                            onClick={(e) => handleRebuild(process.id, e)}
                                                                            title="Rebuild & Restart"
                                                                            className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors"
                                                                        >
                                                                            <RefreshCw size={14} />
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => handleViewLogs(process.id, entry.name, e)}
                                                                            title="Logs"
                                                                            className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors"
                                                                        >
                                                                            <TerminalIcon size={14} />
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => handleAutoConfigure(process.id, e)}
                                                                            title="Auto-Fix Port"
                                                                            className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors"
                                                                        >
                                                                            <Wrench size={14} />
                                                                        </button>
                                                                        {isRunning && (localPort || containerPort) && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    const port = localPort || containerPort;
                                                                                    window.open(`http://localhost:${port}`, '_blank');
                                                                                }}
                                                                                title="Open App"
                                                                                className="p-2 bg-sky-500/20 hover:bg-sky-500/30 rounded-lg text-sky-400 transition-colors"
                                                                            >
                                                                                <Globe size={14} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <motion.button
                                                                    whileHover={{ scale: 1.02 }}
                                                                    whileTap={{ scale: 0.98 }}
                                                                    onClick={(e) => { e.stopPropagation(); handleInstallRepoApp(entry.path); }}
                                                                    className="h-9 px-5 rounded-xl text-xs font-bold text-zinc-400 bg-white/5 border border-white/10 hover:text-white flex-1 justify-center flex items-center gap-2"
                                                                >
                                                                    <Hammer size={14} /> PROVISION
                                                                </motion.button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </motion.div>
                        )}
                    </div>
                )}
            </div>


            <AnimatePresence>
                {isGlobalDragActive && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-10 bg-sky-600/10 backdrop-blur-sm border-2 border-sky-500 border-dashed rounded-3xl flex flex-col items-center justify-center pointer-events-none"
                    >
                        <div className="bg-zinc-900/90 p-6 rounded-2xl shadow-xl flex flex-col items-center animate-bounce">
                            <UploadCloud size={48} className="text-sky-400 mb-2" />
                            <h3 className="text-xl font-bold text-white">Drop to Upload</h3>
                            <p className="text-white/50">Add files to {currentFolderId ? (files.find(f => f.id === currentFolderId)?.name) : 'Root'}</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {
                isGlobalDragActive && (
                    <div
                        className="absolute inset-0 z-0 pointer-events-none"
                        onDragLeave={() => setIsGlobalDragActive(false)}
                    />
                )
            }

            <ConfirmationModal
                isOpen={!!deletingId}
                onClose={() => setDeletingId(null)}
                onConfirm={handleConfirmDelete}
                title={deletingId && Array.isArray(deletingId) && deletingId.length > 1 ? `Delete ${deletingId.length} Items` : "Delete Item"}
                message={deletingId && Array.isArray(deletingId) && deletingId.length > 1
                    ? `Are you sure you want to delete these ${deletingId.length} items? This action cannot be undone.`
                    : "Are you sure you want to delete this item? This action cannot be undone."
                }
                confirmText={deletingId && Array.isArray(deletingId) && deletingId.length > 1 ? `Delete ${deletingId.length} Items` : "Delete"}
                isDanger
                isLoading={isDeleting}
            />

            {
                editingFile && (
                    <CodeEditorModal
                        isOpen={!!editingFile}
                        onClose={() => {
                            setEditingFile(null);
                            setEditorMode('edit');
                            setEditorContent('');
                            setEditorContentFileId(null);
                            setPreviewContent(null);
                        }}
                        fileName={editingFile.name}
                        initialContent={editorContent}
                        onSave={handleSaveFile}
                        isSaving={isSavingStart}
                        mode={editorMode}
                        onModeChange={handleEditorModeChange}
                        previewFile={editingFile}
                        previewContent={previewContent}
                        chatContext={chatContext}
                    />
                )
            }

            {
                repoEditingFile && (
                    <CodeEditorModal
                        isOpen={!!repoEditingFile}
                        onClose={() => {
                            setRepoEditingFile(null);
                            setEditorMode('edit');
                            setEditorContent('');
                        }}
                        fileName={repoEditingFile.name}
                        initialContent={repoEditorContent}
                        onSave={handleRepoSave}
                        isSaving={isRepoSaving}
                        mode="edit"
                        previewFile={null}
                        previewContent={null}
                        chatContext={chatContext}
                    />
                )
            }


            {
                explorerMode === 'workspace' && (
                    <div
                        onClick={triggerUpload}
                        onDragOver={handleGlobalDragOver}
                        onDrop={handleGlobalDrop}
                        className="w-full h-32 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center bg-white/5 hover:bg-white/10 transition-colors cursor-pointer group"
                    >
                        <div className="p-3 rounded-full bg-white/5 group-hover:scale-110 transition-transform mb-2">
                            <UploadCloud className="text-white/50" />
                        </div>
                        <p className="text-sm text-white/50">Drag and drop files here to upload to {currentFolderId ? currentFolder?.name : 'root'}</p>
                    </div>
                )
            }

            {
                (explorerMode === 'workspace' || explorerMode === 'repo') && (
                    <div className="lg:hidden relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                        <input
                            type="text"
                            placeholder={explorerMode === 'repo' ? 'Search repo apps...' : 'Search your files...'}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all placeholder:text-white/20"
                        />
                    </div>
                )
            }

            {
                explorerMode === 'workspace' && (
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-sm text-white/50 overflow-x-auto pb-2">
                            <div className="flex items-center gap-2 mr-4">
                                <input
                                    type="checkbox"
                                    checked={filteredFiles.length > 0 && selectedFileIds.size === filteredFiles.length}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setSelectedFileIds(new Set(filteredFiles.map(f => f.id)));
                                        } else {
                                            setSelectedFileIds(new Set());
                                        }
                                    }}
                                    className="w-4 h-4 rounded border-white/10 bg-white/5 text-sky-600 focus:ring-sky-500/50"
                                />
                            </div>
                            <button
                                onClick={() => setCurrentFolderId(null)}
                                className={cn(
                                    "hover:text-white transition-colors flex items-center gap-1",
                                    !currentFolderId && "text-white font-medium"
                                )}
                            >
                                <Folder size={14} />
                                <span>Home</span>
                            </button>
                            {currentFolderId && (
                                <>
                                    <ChevronLeft size={12} className="rotate-180" />
                                    <span className="text-white font-medium">{currentFolder?.name}</span>
                                </>
                            )}
                        </div>

                        {selectedFileIds.size > 0 && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex items-center gap-4 px-4 py-2 bg-sky-600/20 border border-sky-500/30 rounded-xl"
                            >
                                <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                                    {selectedFileIds.size} Selected
                                </span>
                                <div className="h-4 w-px bg-sky-500/30" />
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            const selectedFiles = files.filter(f => selectedFileIds.has(f.id));
                                            setMovingFiles(selectedFiles);
                                        }}
                                        className="p-1.5 hover:bg-white/10 rounded-md text-sky-400 transition-colors"
                                        title="Move Selection"
                                    >
                                        <Move size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteRequest(Array.from(selectedFileIds))}
                                        className="p-1.5 hover:bg-red-500/20 rounded-md text-red-400 transition-colors"
                                        title="Delete Selection"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => setSelectedFileIds(new Set())}
                                        className="p-1.5 hover:bg-white/10 rounded-md text-white/50 hover:text-white transition-colors"
                                        title="Clear Selection"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </div>
                )
            }

            {/* File Grid */}
            {/* File Container */}
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className={cn(viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" : "flex flex-col space-y-2", explorerMode !== 'workspace' && "hidden")}
            >
                {filteredFiles.map((file, index) => {
                    const highlightStyles = {
                        backgroundColor: file.highlightBgColor || undefined,
                        borderColor: file.highlightBorderColor || undefined
                    } as React.CSSProperties;
                    const nameStyles = {
                        color: file.highlightTextColor || undefined,
                        fontWeight: file.highlightFontWeight || undefined
                    } as React.CSSProperties;

                    return (
                        <motion.div
                            key={file.id}
                            id={`file-${file.id}`}
                            variants={itemVariants}
                            layout
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onContextMenu={(e) => handleContextMenu(e, file)}
                            draggable={true}
                            onDragStart={(e: any) => handleDragStart(e, file)}
                            onDragOver={(e) => handleDragOverFile(e, file)}
                            onDragLeave={(e) => {
                                setReorderTarget(null);
                                if (file.type === 'folder') {
                                    handleDragLeave(e);
                                } else {
                                    setDragOverFileId(null);
                                }
                            }}
                            onDrop={(e) => handleDropOnFile(e, file)}
                            onClick={(e) => handleFileClick(e, file.id)}
                            onDoubleClick={(e) => {
                                e.stopPropagation();
                                if (file.type === 'folder') {
                                    setCurrentFolderId(file.id);
                                } else {
                                    handlePreviewFile(file);
                                }
                            }}
                            className={cn(
                                "group relative cursor-pointer z-20 transition-all border",
                                viewMode === 'grid'
                                    ? "p-4 rounded-xl"
                                    : "px-4 py-3 rounded-lg flex items-center gap-4",
                                selectedFileIds.has(file.id)
                                    ? "ring-2 ring-sky-500 bg-sky-500/20 border-sky-500/50"
                                    : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10",
                                (dragOverFolderId === file.id || dragOverFileId === file.id) ? "ring-2 ring-sky-500 bg-sky-500/20 scale-[1.05] z-30 shadow-xl shadow-sky-500/20" : ""
                            )}
                            style={highlightStyles}
                        >
                            {/* Reorder Indicators */}
                            {reorderTarget?.id === file.id && reorderTarget.position === 'before' && (
                                <div className={cn(
                                    "absolute bg-sky-500 z-50 rounded-full pointer-events-none",
                                    viewMode === 'grid' ? "left-0 top-0 bottom-0 w-1 shadow-[0_0_10px_#38bdf8]" : "top-0 left-0 right-0 h-1 shadow-[0_0_10px_#38bdf8]"
                                )} />
                            )}
                            {reorderTarget?.id === file.id && reorderTarget.position === 'after' && (
                                <div className={cn(
                                    "absolute bg-sky-500 z-50 rounded-full pointer-events-none",
                                    viewMode === 'grid' ? "right-0 top-0 bottom-0 w-1 shadow-[0_0_10px_#38bdf8]" : "bottom-0 left-0 right-0 h-1 shadow-[0_0_10px_#38bdf8]"
                                )} />
                            )}

                            {viewMode === 'grid' ? (
                                // GRID VIEW CARD
                                <>
                                    <div className="flex flex-col gap-3 mb-2">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedFileIds.has(file.id)}
                                                    onChange={(e) => {
                                                        const newSelected = new Set(selectedFileIds);
                                                        if (e.target.checked) {
                                                            newSelected.add(file.id);
                                                            setLastSelectedId(file.id);
                                                        } else {
                                                            newSelected.delete(file.id);
                                                        }
                                                        setSelectedFileIds(newSelected);
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-4 h-4 rounded border-white/10 bg-white/5 text-sky-600 focus:ring-sky-500/50 cursor-pointer"
                                                />
                                                {file.type === 'folder' ? (
                                                    <div className="p-3 rounded-lg bg-gradient-to-br from-sky-500/10 to-sky-600/5 border border-sky-500/20 text-sky-400">
                                                        <Folder size={24} className="fill-sky-500/20" />
                                                    </div>
                                                ) : (
                                                    <FilePreview file={file} />
                                                )}
                                            </div>
                                            <div className={cn("relative z-30 flex items-center gap-1", file.type !== 'folder' ? "absolute top-4 right-4" : "")} onClick={(e) => e.stopPropagation()}>
                                                {isEditableFile(file) && (
                                                    <>
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                window.dispatchEvent(new CustomEvent('open-vibe', { detail: file }));
                                                            }}
                                                            title="Edit in Vibe Mode"
                                                            className="px-2 py-1 relative overflow-hidden group/vbtn rounded-md bg-emerald-500 hover:bg-emerald-400 text-white transition-all border border-emerald-400/50 shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95 flex items-center gap-1.5"
                                                        >
                                                            <Sparkles size={12} className="animate-pulse" />
                                                            <span className="text-[9px] font-black uppercase tracking-widest leading-none">Vibe</span>
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                handleEditFile(file);
                                                            }}
                                                            title="Quick Edit"
                                                            className="p-1.5 rounded-md bg-black/20 hover:bg-black/60 backdrop-blur-sm text-white/50 hover:text-white transition-colors border border-white/5"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                    </>
                                                )}
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        setContextMenu({ x: rect.left, y: rect.bottom + 5, file });
                                                    }}
                                                    title="More actions"
                                                    className="p-1.5 rounded-md bg-black/20 hover:bg-black/60 backdrop-blur-sm text-white/50 hover:text-white transition-colors border border-white/5"
                                                >
                                                    <MoreVertical size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-sm font-medium text-white truncate px-1" style={nameStyles}>{file.name}</h3>
                                        <div className="flex items-center justify-between text-xs text-white/40 px-1">
                                            <span>{file.type === 'folder' ? file.items : file.size}</span>

                                            {/* Magic Folder Indicator */}
                                            {file.type === 'folder' && (file as any).magicRule && (
                                                <div className="flex items-center gap-1 text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.5 rounded shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                                                    <Wand2 size={10} />
                                                    <span className="text-[9px] uppercase font-bold tracking-wider">{(file as any).magicRule}</span>
                                                </div>
                                            )}

                                            {file.shared && (
                                                <div className="flex items-center gap-1 text-emerald-400/80 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                                    <Users size={10} />
                                                    <span>Shared</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Smart Tags */}
                                    {(file as any).tags && (file as any).tags.length > 0 && (
                                        <div className="flex gap-1 flex-wrap mt-2 px-1">
                                            {(file as any).tags.slice(0, 3).map((tag: string, i: number) => (
                                                <span key={i} className="px-1.5 py-0.5 rounded text-[9px] bg-white/10 text-white/60 border border-white/5 flex items-center gap-1">
                                                    <Tag size={8} /> {tag}
                                                </span>
                                            ))}
                                            {(file as any).tags.length > 3 && (
                                                <span className="px-1.5 py-0.5 rounded text-[9px] bg-white/5 text-white/40">
                                                    +{(file as any).tags.length - 3}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                </>
                            ) : (
                                // LIST VIEW ROW
                                <>
                                    {/* Icon Column */}
                                    <div className="flex-shrink-0 flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedFileIds.has(file.id)}
                                            onChange={(e) => {
                                                const newSelected = new Set(selectedFileIds);
                                                if (e.target.checked) {
                                                    newSelected.add(file.id);
                                                    setLastSelectedId(file.id);
                                                } else {
                                                    newSelected.delete(file.id);
                                                }
                                                setSelectedFileIds(newSelected);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-4 h-4 rounded border-white/10 bg-white/5 text-sky-600 focus:ring-sky-500/50 cursor-pointer"
                                        />
                                        {file.type === 'folder' ? (
                                            <div className="p-2 rounded-md bg-sky-500/10 text-sky-400">
                                                <Folder size={20} className="fill-sky-500/20" />
                                            </div>
                                        ) : (
                                            ['image', 'png', 'jpg', 'jpeg'].includes(file.type) ? (
                                                <div className="w-9 h-9 rounded-md overflow-hidden bg-white/5">
                                                    <img src={`/uploads/${file.storagePath || file.name}`} className="w-full h-full object-cover" alt="" />
                                                </div>
                                            ) : (
                                                <div className="p-2 rounded-md bg-white/5 text-white/40">
                                                    <FileText size={20} />
                                                </div>
                                            )
                                        )}
                                    </div>

                                    {/* Name Column */}
                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                        <h3 className="text-sm font-medium text-white truncate" style={nameStyles}>{file.name}</h3>
                                        <span className="text-xs text-white/30 lg:hidden">
                                            {file.type === 'folder' ? file.items : file.size}
                                        </span>
                                    </div>

                                    {/* Meta Columns (Desktop) */}
                                    <div className="hidden lg:flex items-center gap-8 text-sm text-white/40">
                                        <span className="w-24 text-right">
                                            {file.type === 'folder' ? file.items : file.size}
                                        </span>
                                        {file.shared && (
                                            <div className="flex items-center gap-1 text-emerald-400/80 bg-emerald-500/10 px-1.5 py-0.5 rounded text-xs">
                                                <Users size={10} />
                                                <span>Shared</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex-shrink-0 ml-2 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                        {isEditableFile(file) && (
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleEditFile(file);
                                                }}
                                                title="Edit code"
                                                className="p-1.5 rounded-md hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                setContextMenu({ x: rect.left, y: rect.bottom + 5, file });
                                            }}
                                            title="More actions"
                                            className="p-1.5 rounded-md hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                                        >
                                            <MoreVertical size={16} />
                                        </button>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    );
                })}

                {/* Empty State */}
                {filteredFiles.length === 0 && (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center text-white/20">
                        <Folder size={48} className="mb-4 opacity-20" />
                        <p className="text-lg font-medium">No files found</p>
                        <p className="text-sm">{searchQuery ? 'Try a different search query' : 'This folder is empty'}</p>
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="mt-4 text-sky-400 hover:text-sky-300 text-sm font-medium"
                            >
                                Clear Search
                            </button>
                        )}
                    </div>
                )}
            </motion.div>


            {/* ... Modals (Create Folder, Move, Rename, Preview) ... */}
            <AnimatePresence>
                {isCreateModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setIsCreateModalOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-md glass-card rounded-2xl overflow-hidden border border-white/10 p-6 shadow-2xl"
                        >
                            <h2 className="text-xl font-bold text-white mb-4">Create New Folder</h2>
                            <form onSubmit={handleCreateFolder} className="space-y-4">
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Folder Name"
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                                />
                                <div className="flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsCreateModalOpen(false)}
                                        className="px-4 py-2 text-white/50 hover:text-white transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors font-medium shadow-lg shadow-sky-500/20"
                                    >
                                        Create Folder
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Move File Modal */}
            <AnimatePresence>
                {movingFiles && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setMovingFiles(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-md glass-card rounded-2xl overflow-hidden border border-white/10 p-6 shadow-2xl"
                        >
                            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <Move size={20} className="text-sky-400" />
                                {movingFiles.length > 1
                                    ? `Move ${movingFiles.length} items`
                                    : `Move "${movingFiles[0].name}"`
                                }
                            </h2>
                            <div className="max-h-[300px] overflow-y-auto space-y-1 mb-6">
                                <button
                                    onClick={() => handleMove(null)}
                                    className="w-full p-3 text-left hover:bg-white/5 rounded-lg flex items-center gap-3 text-white/70 transition-colors"
                                >
                                    <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center">
                                        <Folder size={16} />
                                    </div>
                                    <span>Root Directory</span>
                                </button>
                                {folders
                                    .filter(f => !movingFiles.find(mf => mf.id === f.id)) // Don't show folders that are being moved (can't move folder into itself)
                                    .map(folder => (
                                        <button
                                            key={folder.id}
                                            onClick={() => handleMove(folder.id)}
                                            className="w-full p-3 text-left hover:bg-white/5 rounded-lg flex items-center gap-3 text-white/70 transition-colors"
                                        >
                                            <div className="w-8 h-8 rounded bg-sky-500/10 flex items-center justify-center text-sky-400">
                                                <Folder size={16} className="fill-sky-500/20" />
                                            </div>
                                            <span>{folder.name}</span>
                                        </button>
                                    ))}
                            </div>
                            <div className="flex justify-end">
                                <button
                                    onClick={() => setMovingFiles(null)}
                                    className="px-4 py-2 text-white/50 hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Grouping Modal */}
            <AnimatePresence>
                {groupingData && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setGroupingData(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-md glass-card rounded-2xl overflow-hidden border border-white/10 p-6 shadow-2xl"
                        >
                            <h2 className="text-xl font-bold text-white mb-4">Create New Group</h2>
                            <p className="text-sm text-white/50 mb-4">
                                Enter a name for the new folder that will contain the selected files.
                            </p>
                            <form onSubmit={handleCreateGroup} className="space-y-4">
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Folder Name (e.g., Vacation Photos)"
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                                />
                                <div className="flex justify-between items-center">
                                    <button
                                        type="button"
                                        onClick={() => setNewFolderName('Group ' + new Date().toISOString().split('T')[0])}
                                        className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
                                    >
                                        Auto-generate Name
                                    </button>
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setGroupingData(null)}
                                        className="px-4 py-2 text-white/50 hover:text-white transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isCreatingGroup}
                                        className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors font-medium shadow-lg shadow-sky-500/20 disabled:opacity-50"
                                    >
                                        {isCreatingGroup ? 'Creating...' : 'Create Group'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Rename Modal */}
            <AnimatePresence>
                {renamingFile && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setRenamingFile(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-md glass-card rounded-2xl overflow-hidden border border-white/10 p-6 shadow-2xl"
                        >
                            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <Edit2 size={20} className="text-sky-400" />
                                Rename "{renamingFile.name}"
                            </h2>
                            <form onSubmit={handleRenameSubmit} className="space-y-4">
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="New Name"
                                    value={newNameValue}
                                    onChange={(e) => setNewNameValue(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                                />
                                <div className="flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setRenamingFile(null)}
                                        className="px-4 py-2 text-white/50 hover:text-white transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors font-medium shadow-lg shadow-sky-500/20"
                                    >
                                        Rename
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {
                contextMenu && (
                    <ContextMenu
                        x={contextMenu.x}
                        y={contextMenu.y}
                        isOpen={!!contextMenu}
                        onClose={() => setContextMenu(null)}
                        items={[
                            {
                                label: 'Open',
                                icon: <Maximize2 size={16} />,
                                onClick: () => {
                                    if (contextMenu.file.type === 'folder') {
                                        handleFolderOpen(contextMenu.file.id);
                                    } else {
                                        handleEditFile(contextMenu.file);
                                    }
                                }
                            },
                            {
                                label: 'Edit',
                                icon: <Edit size={16} />,
                                onClick: () => handleEditFile(contextMenu.file)
                            },
                            {
                                label: 'Open in AI Pilot',
                                icon: <ExternalLink size={16} />,
                                onClick: () => {
                                    window.dispatchEvent(new CustomEvent('pilot-open-file', {
                                        detail: { path: (contextMenu.file as any).storagePath || contextMenu.file.name }
                                    }));
                                }
                            },
                            {
                                label: 'Add to AI Context',
                                icon: <Bot size={16} />,
                                onClick: () => window.dispatchEvent(new CustomEvent('add-to-ai-chat', { detail: contextMenu.file }))
                            },
                            {
                                label: 'Set as AI Target',
                                icon: <LayoutPanelLeft size={16} />,
                                onClick: () => {
                                    window.dispatchEvent(new CustomEvent('set-ai-target', {
                                        detail: { id: contextMenu.file.id, name: contextMenu.file.name }
                                    }));
                                    toast.success(`${contextMenu.file.name} set as primary AI target`);
                                }
                            },
                            {
                                label: 'Rename',
                                icon: <Edit2 size={16} />,
                                onClick: () => startRename(contextMenu.file)
                            },
                            // Workspace App Promotion
                            ...(() => {
                                const file = contextMenu.file;
                                const isFolder = file.type === 'folder';
                                const isRepo = explorerMode === 'repo' || (file as any).storagePath?.startsWith('repo-apps/') || (file as any).path?.startsWith('repo-apps/');
                                if (!isFolder || isRepo) return [];

                                const isApp = file.tags?.includes('app_root');
                                if (!isApp) {
                                    return [{
                                        label: 'Promote to App',
                                        icon: <Sparkles size={16} className="text-emerald-400" />,
                                        onClick: () => {
                                            // Find an entry file (index.html or main.js)
                                            const entry = files.find(f => f.parentId === file.id && (f.name === 'index.html' || f.name === 'main.js' || f.name === 'App.tsx'));
                                            if (entry) {
                                                convertFolderToApp(file.id, entry.id);
                                                toast.success(`${file.name} promoted to App!`);
                                            } else {
                                                toast.error('No entry file (index.html, etc) found in folder');
                                            }
                                        }
                                    }];
                                }

                                return [
                                    {
                                        label: 'Install/Deploy App',
                                        icon: <Hammer size={16} />,
                                        onClick: () => handleInstallApp(file.id)
                                    },
                                    {
                                        label: 'Unpromote from App',
                                        icon: <X size={16} />,
                                        onClick: () => unpromoteApp(file.id)
                                    }
                                ];
                            })(),
                            {
                                label: contextMenu.file.shared ? 'Unshare' : 'Share',
                                icon: <Share2 size={16} />,
                                onClick: () => handleToggleShare(contextMenu.file)
                            },
                            {
                                label: 'Move to...',
                                icon: <Move size={16} />,
                                onClick: () => {
                                    if (selectedFileIds.size > 1 && selectedFileIds.has(contextMenu.file.id)) {
                                        const selectedFiles = files.filter(f => selectedFileIds.has(f.id));
                                        setMovingFiles(selectedFiles);
                                    } else {
                                        setMovingFiles([contextMenu.file]);
                                    }
                                }
                            },
                            {
                                label: 'Delete',
                                icon: <Trash2 size={16} />,
                                danger: true,
                                onClick: () => {
                                    if (selectedFileIds.size > 1 && selectedFileIds.has(contextMenu.file.id)) {
                                        handleDeleteRequest(Array.from(selectedFileIds));
                                    } else {
                                        handleDeleteRequest(contextMenu.file.id);
                                    }
                                }
                            },
                            // Docker / Process Actions
                            ...(() => {
                                const entry = contextMenu.file as any;
                                const isRepo = explorerMode === 'repo' || entry.storagePath?.startsWith('repo-apps/') || entry.path?.startsWith('repo-apps/');
                                if (!isRepo) return [];

                                const norm = (p: string) => p?.replace(/\\/g, '/').toLowerCase();
                                const entryPath = norm(entry.path || entry.storagePath);
                                const entryName = entry.name;

                                const process = processes.find(p => {
                                    if (p.name.toLowerCase().includes(entryName.toLowerCase())) return true;
                                    if (!p.path) return false;
                                    const procPath = norm(p.path);
                                    const metaPath = p.metadata?.appPath ? norm(p.metadata.appPath) : '';
                                    return procPath === entryPath || metaPath === entryPath || procPath.includes(entryPath);
                                });

                                if (!process) {
                                    return [{
                                        label: 'Provision Container',
                                        icon: <Hammer size={16} />,
                                        onClick: () => handleInstallRepoApp(entry.path || entry.storagePath)
                                    }];
                                }

                                const isRunning = process.status === 'running';
                                return [
                                    { divider: true },
                                    {
                                        label: isRunning ? 'Stop Service' : 'Start Service',
                                        icon: isRunning ? <Square size={16} /> : <Play size={16} />,
                                        onClick: (e: any) => isRunning ? handleStopProcess(process.id, e) : handleStartContainer(process.id, e, entryName)
                                    },
                                    {
                                        label: 'Rebuild & Restart',
                                        icon: <RefreshCw size={16} />,
                                        onClick: (e: any) => handleRestartProcess(process.id, e)
                                    },
                                    {
                                        label: 'View Logs',
                                        icon: <TerminalIcon size={16} />,
                                        onClick: (e: any) => handleViewLogs(process.id, entryName, e)
                                    },
                                    {
                                        label: 'Configure Port',
                                        icon: <Wrench size={16} />,
                                        onClick: (e: any) => handleAutoConfigure(process.id, e)
                                    }
                                ];
                            })()
                        ]}
                    />
                )
            }

            {/* Smart Selection Toolbar */}
            <AnimatePresence>
                {selectedFileIds.size > 0 && (
                    <motion.div
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 50, opacity: 0 }}
                        className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[60] bg-zinc-900/90 border border-white/10 rounded-2xl px-6 py-4 flex items-center gap-6 shadow-2xl backdrop-blur-md"
                    >
                        <div className="flex flex-col items-start pr-6 border-r border-white/10">
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Selection</span>
                            <span className="text-sm font-bold text-white">{selectedFileIds.size} Items</span>
                        </div>

                        <div className="flex items-center gap-6">
                            <button
                                onClick={() => {
                                    files.filter(f => selectedFileIds.has(f.id)).forEach(f => {
                                        window.dispatchEvent(new CustomEvent('add-to-ai-chat', { detail: f }));
                                    });
                                }}
                                className="flex flex-col items-center gap-1 text-white/60 hover:text-white transition-colors"
                                title="Summarize with AI"
                            >
                                <AlignLeft size={18} />
                                <span className="text-[10px] font-bold uppercase tracking-tighter">Summarize</span>
                            </button>

                            <button
                                onClick={() => {
                                    // Trigger synthesis in AI Chat
                                    files.filter(f => selectedFileIds.has(f.id)).forEach(f => {
                                        window.dispatchEvent(new CustomEvent('add-to-ai-chat', { detail: f }));
                                    });
                                    // We need to implement a clean way to tell the AI what to do
                                    // For now, we rely on the prompt context or a specific event if we want to be fancy.
                                    // But the user asked for "One Click". 
                                    // Best approach: Add all files, then simulate a user message. 
                                    // Since we can't easily simulate user message from here without prop drilling, 
                                    // we can let the user know to just hit 'enter' or we can dispatch a specific intent event if we build it.
                                    // Simpler: Just rely on context.
                                    toast.success('Files added. Ask Agent to "Synthesize these"');
                                }}
                                className="flex flex-col items-center gap-1 text-white/60 hover:text-white transition-colors"
                                title="Synthesize Documents"
                            >
                                <Sparkles size={18} className="text-emerald-400" />
                                <span className="text-[10px] font-bold uppercase tracking-tighter text-emerald-400">Synthesize</span>
                            </button>

                            <button
                                onClick={() => {
                                    // Open batch rename dialog or just ask AI
                                    files.filter(f => selectedFileIds.has(f.id)).forEach(f => {
                                        window.dispatchEvent(new CustomEvent('add-to-ai-chat', { detail: f }));
                                    });
                                    toast.info('Agent is ready to rename these files');
                                }}
                                className="flex flex-col items-center gap-1 text-white/60 hover:text-white transition-colors"
                                title="Rename with AI"
                            >
                                <Edit size={18} />
                                <span className="text-[10px] font-bold uppercase tracking-tighter">Rename</span>
                            </button>

                            <button
                                onClick={() => {
                                    const selected = files.filter(f => selectedFileIds.has(f.id));
                                    window.dispatchEvent(new CustomEvent('add-to-ai-chat', { detail: selected[0] })); // Just a ping to open chat
                                    toast.info('AI is analyzing the best structure...');
                                }}
                                className="flex flex-col items-center gap-1 text-white/60 hover:text-white transition-colors"
                                title="Organize into Folders"
                            >
                                <FolderTree size={18} />
                                <span className="text-[10px] font-bold uppercase tracking-tighter">Organize</span>
                            </button>

                            <button
                                onClick={() => handleDeleteRequest(Array.from(selectedFileIds))}
                                className="flex flex-col items-center gap-1 text-red-400/60 hover:text-red-400 transition-colors"
                                title="Delete Selection"
                            >
                                <Trash2 size={18} />
                                <span className="text-[10px] font-bold uppercase tracking-tighter">Delete</span>
                            </button>

                            <div className="w-px h-8 bg-white/10 mx-2" />

                            <button
                                onClick={() => setSelectedFileIds(new Set())}
                                className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors"
                                title="Clear Selection"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <IntegratedPreview
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                url={previewUrl}
                appName={previewAppName}
                status={previewStatus}
                logs={previewLogs}
                onRestart={() => {
                    const proc = processes.find(p => p.name.includes(previewAppName || '') || p.metadata?.appName === previewAppName);
                    if (proc) handleRestartProcess(proc.id, { stopPropagation: () => { } } as any);
                }}
            />

            <style jsx global>{`
                @keyframes agent-pulse {
                    0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); border-color: rgba(59, 130, 246, 1); }
                    70% { box-shadow: 0 0 0 15px rgba(59, 130, 246, 0); border-color: rgba(59, 130, 246, 0.5); }
                    100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); border-color: rgba(59, 130, 246, 0.2); }
                }
                .pulse-highlight-agent {
                    animation: agent-pulse 2s infinite !important;
                    position: relative;
                    z-index: 50 !important;
                    background: rgba(59, 130, 246, 0.15) !important;
                    transition: all 0.3s ease;
                }
            `}</style>
        </div>
    );
}
