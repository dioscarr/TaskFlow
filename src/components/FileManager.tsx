'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Folder, FileText, Image as ImageIcon, UploadCloud, MoreVertical, Users, X, ChevronLeft, Maximize2, Edit2, Share2, Move, Trash2, Search, LayoutGrid, List, Bot } from 'lucide-react';
import type { WorkspaceFile } from '@prisma/client';
import { deleteFile, createFile, uploadFile, moveFile, renameFile, toggleFileShare, reorderFiles, getFileContent } from '@/app/actions';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ConfirmationModal from './ConfirmationModal';
import ContextMenu from './ContextMenu';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

interface FileManagerProps {
    files: WorkspaceFile[];
}

// Helper Component for Lazy Previews
const FilePreview = ({ file }: { file: WorkspaceFile }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const isImage = ['image', 'png', 'jpg', 'jpeg', 'webp', 'gif'].includes(file.type);

    if (!isImage) {
        return (
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-white/5 to-white/0 border border-white/5 flex items-center justify-center text-blue-300">
                {file.type === 'folder' && <Folder size={24} className="fill-blue-500/20 stroke-blue-400" />}
                {file.type === 'pdf' && <FileText size={24} className="text-red-400" />}
                {!['folder', 'pdf'].includes(file.type) && <FileText size={24} className="text-white/40" />}
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
                src={`/uploads/${file.name}`}
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
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
    const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
    const [previewFile, setPreviewFile] = useState<WorkspaceFile | null>(null);
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [movingFiles, setMovingFiles] = useState<WorkspaceFile[] | null>(null);
    const [renamingFile, setRenamingFile] = useState<WorkspaceFile | null>(null);
    const [newFolderName, setNewFolderName] = useState('');
    const [newNameValue, setNewNameValue] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
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

    useEffect(() => {
        if (previewFile && (previewFile.name.endsWith('.md') || previewFile.type === 'md' || previewFile.type === 'markdown')) {
            getFileContent(previewFile.name).then(res => {
                if (res.success) setPreviewContent(res.content || "");
            });
        } else {
            setPreviewContent(null);
        }
    }, [previewFile]);

    // Listen for file manager refresh events from AI Chat
    useEffect(() => {
        const handleRefresh = () => {
            console.log('🔄 Refreshing file manager...');
            router.refresh(); // Refresh server components to get updated file list
        };

        window.addEventListener('refresh-file-manager', handleRefresh);
        return () => window.removeEventListener('refresh-file-manager', handleRefresh);
    }, [router]);

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
        e.preventDefault();
        e.stopPropagation();

        if (targetFile.type === 'folder') {
            handleDragOver(e, targetFile);
            setReorderTarget(null);
            return;
        }

        e.dataTransfer.dropEffect = 'move';
        setIsGlobalDragActive(false);

        // Calculate drop position logic
        const rect = e.currentTarget.getBoundingClientRect();
        const isHorizontal = viewMode === 'grid'; // Grid drags left/right, List drags top/bottom usually

        // However, grid flows left-to-right, top-to-bottom.
        // Let's use a simple box logic:
        // Center 50% = Group
        // Left/Top 25% = Insert Before
        // Right/Bottom 25% = Insert After

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const w = rect.width;
        const h = rect.height;

        const isLeft = x < w * 0.25;
        const isRight = x > w * 0.75;
        const isTop = y < h * 0.25;
        const isBottom = y > h * 0.75;

        // Priority to Grouping if in center
        if (!isLeft && !isRight && !isTop && !isBottom) {
            if (dragOverFileId !== targetFile.id) setDragOverFileId(targetFile.id);
            setReorderTarget(null);
            return;
        }

        // Reorder logic
        setDragOverFileId(null); // Clear grouping highlight

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

        if (targetFile.type === 'folder') {
            handleDrop(e, targetFile);
            return;
        }

        setDragOverFileId(null);
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
                await reorderFiles(updates);
                toast.success('Reordered', { id: loadingToast });
                router.refresh();
                setReorderTarget(null);
                setSelectedFileIds(new Set());
            } catch (err) {
                toast.error('Failed to reorder', { id: loadingToast });
            }

        } else {
            // GROUPING ACTION (Existing Logic)
            setGroupingData({ sourceIds, targetId: targetFile.id });
            setNewFolderName(''); // Reset name
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
            setPreviewFile(null);
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
            <AnimatePresence>
                {isGlobalDragActive && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-10 bg-blue-600/10 backdrop-blur-sm border-2 border-blue-500 border-dashed rounded-3xl flex flex-col items-center justify-center pointer-events-none"
                    >
                        <div className="bg-zinc-900/90 p-6 rounded-2xl shadow-xl flex flex-col items-center animate-bounce">
                            <UploadCloud size={48} className="text-blue-400 mb-2" />
                            <h3 className="text-xl font-bold text-white">Drop to Upload</h3>
                            <p className="text-white/50">Add files to {currentFolderId ? (files.find(f => f.id === currentFolderId)?.name) : 'Root'}</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Overlay to catch the leave event triggers logic, but must not block folders.
                Actually we don't need a separate capture div if we use the parent div for Drop.
                But we do need to detect 'leave' from the parent.
             */}
            {isGlobalDragActive && (
                <div
                    className="absolute inset-0 z-0"
                    onDragLeave={() => setIsGlobalDragActive(false)}
                />
            )}


            <ConfirmationModal
                isOpen={!!deletingId}
                onClose={() => setDeletingId(null)}
                onConfirm={handleConfirmDelete}
                title="Delete File"
                message="Are you sure you want to delete this file? This action cannot be undone."
                confirmText="Delete File"
                isDanger
                isLoading={isDeleting}
            />
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {currentFolderId && (
                        <button
                            onClick={() => setCurrentFolderId(currentFolder?.parentId || null)}
                            className="p-2 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors"
                        >
                            <ChevronLeft size={20} />
                        </button>
                    )}
                    <h1 className="text-3xl font-bold text-white">
                        {searchQuery ? 'Search Results' : (currentFolderId ? currentFolder?.name : 'Files')}
                    </h1>
                </div>

                <div className="flex-1 max-w-md mx-8 hidden lg:block">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Search your files... (Ctrl+K)"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-white/20"
                        />
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors text-sm font-medium border border-white/10"
                    >
                        <Folder size={16} />
                        <span>New Folder</span>
                    </button>
                    <button
                        onClick={triggerUpload}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm font-medium shadow-lg shadow-blue-500/20"
                    >
                        <UploadCloud size={16} />
                        <span>Upload File</span>
                    </button>

                    <div className="flex items-center bg-white/5 rounded-lg border border-white/10 p-1 ml-2">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={cn(
                                "p-1.5 rounded-md transition-all",
                                viewMode === 'grid' ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/80"
                            )}
                            title="Grid View"
                        >
                            <LayoutGrid size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={cn(
                                "p-1.5 rounded-md transition-all",
                                viewMode === 'list' ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/80"
                            )}
                            title="List View"
                        >
                            <List size={18} />
                        </button>
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                    />
                </div>
            </div>

            {/* Drag Drop Zone (Keep it as explicit button/zone too) */}
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

            {/* Mobile Search */}
            <div className="lg:hidden relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                <input
                    type="text"
                    placeholder="Search your files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-white/20"
                />
            </div>

            {/* Path Breadcrumbs */}
            <div className="flex items-center gap-2 text-sm text-white/50 mb-2 overflow-x-auto pb-2">
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

            {/* File Grid */}
            {/* File Container */}
            <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" : "flex flex-col space-y-2"}>
                {filteredFiles.map((file, index) => (
                    <motion.div
                        key={file.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onContextMenu={(e) => handleContextMenu(e, file)}
                        draggable={true}
                        onDragStart={(e: any) => handleDragStart(e, file)}
                        onDragOver={(e) => handleDragOverFile(e, file)}
                        onDragLeave={(e) => {
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
                                setPreviewFile(file);
                            }
                        }}
                        className={cn(
                            "group relative cursor-pointer z-20 transition-all border",
                            viewMode === 'grid'
                                ? "p-4 rounded-xl"
                                : "px-4 py-3 rounded-lg flex items-center gap-4",
                            selectedFileIds.has(file.id)
                                ? "ring-2 ring-blue-500 bg-blue-500/20 border-blue-500/50"
                                : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10",
                            (dragOverFolderId === file.id || dragOverFileId === file.id) ? "ring-2 ring-blue-500 bg-blue-500/20 scale-[1.05] z-30 shadow-xl shadow-blue-500/20" : ""
                        )}
                    >
                        {/* Reorder Indicators */}
                        {reorderTarget?.id === file.id && reorderTarget.position === 'before' && (
                            <div className={cn(
                                "absolute bg-blue-500 z-50 rounded-full",
                                viewMode === 'grid' ? "left-0 top-0 bottom-0 w-1 shadow-[0_0_10px_#3b82f6]" : "top-0 left-0 right-0 h-1 shadow-[0_0_10px_#3b82f6]"
                            )} />
                        )}
                        {reorderTarget?.id === file.id && reorderTarget.position === 'after' && (
                            <div className={cn(
                                "absolute bg-blue-500 z-50 rounded-full",
                                viewMode === 'grid' ? "right-0 top-0 bottom-0 w-1 shadow-[0_0_10px_#3b82f6]" : "bottom-0 left-0 right-0 h-1 shadow-[0_0_10px_#3b82f6]"
                            )} />
                        )}

                        {viewMode === 'grid' ? (
                            // GRID VIEW CARD
                            <>
                                <div className="flex flex-col gap-3 mb-2">
                                    <div className="flex justify-between items-start">
                                        {file.type === 'folder' ? (
                                            <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 text-blue-400">
                                                <Folder size={24} className="fill-blue-500/20" />
                                            </div>
                                        ) : (
                                            <FilePreview file={file} />
                                        )}
                                        <div className={cn("relative z-30", file.type !== 'folder' ? "absolute top-4 right-4" : "")} onClick={(e) => e.stopPropagation()}>
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    setContextMenu({ x: rect.left, y: rect.bottom + 5, file });
                                                }}
                                                className="p-1.5 rounded-md bg-black/20 hover:bg-black/60 backdrop-blur-sm text-white/50 hover:text-white transition-colors border border-white/5"
                                            >
                                                <MoreVertical size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-sm font-medium text-white truncate px-1">{file.name}</h3>
                                    <div className="flex items-center justify-between text-xs text-white/40 px-1">
                                        <span>{file.type === 'folder' ? file.items : file.size}</span>
                                        {file.shared && (
                                            <div className="flex items-center gap-1 text-emerald-400/80 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                                <Users size={10} />
                                                <span>Shared</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            // LIST VIEW ROW
                            <>
                                {/* Icon Column */}
                                <div className="flex-shrink-0">
                                    {file.type === 'folder' ? (
                                        <div className="p-2 rounded-md bg-blue-500/10 text-blue-400">
                                            <Folder size={20} className="fill-blue-500/20" />
                                        </div>
                                    ) : (
                                        ['image', 'png', 'jpg', 'jpeg'].includes(file.type) ? (
                                            <div className="w-9 h-9 rounded-md overflow-hidden bg-white/5">
                                                <img src={`/uploads/${file.name}`} className="w-full h-full object-cover" alt="" />
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
                                    <h3 className="text-sm font-medium text-white truncate">{file.name}</h3>
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
                                <div className="flex-shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            setContextMenu({ x: rect.left, y: rect.bottom + 5, file });
                                        }}
                                        className="p-1.5 rounded-md hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                                    >
                                        <MoreVertical size={16} />
                                    </button>
                                </div>
                            </>
                        )}
                    </motion.div>
                ))}

                {/* Empty State */}
                {filteredFiles.length === 0 && (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center text-white/20">
                        <Folder size={48} className="mb-4 opacity-20" />
                        <p className="text-lg font-medium">No files found</p>
                        <p className="text-sm">{searchQuery ? 'Try a different search query' : 'This folder is empty'}</p>
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="mt-4 text-blue-400 hover:text-blue-300 text-sm font-medium"
                            >
                                Clear Search
                            </button>
                        )}
                    </div>
                )}
            </div>


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
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
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
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium shadow-lg shadow-blue-500/20"
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
                                <Move size={20} className="text-blue-400" />
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
                                            <div className="w-8 h-8 rounded bg-blue-500/10 flex items-center justify-center text-blue-400">
                                                <Folder size={16} className="fill-blue-500/20" />
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
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                />
                                <div className="flex justify-between items-center">
                                    <button
                                        type="button"
                                        onClick={() => setNewFolderName('Group ' + new Date().toISOString().split('T')[0])}
                                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
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
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium shadow-lg shadow-blue-500/20 disabled:opacity-50"
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
                                <Edit2 size={20} className="text-blue-400" />
                                Rename "{renamingFile.name}"
                            </h2>
                            <form onSubmit={handleRenameSubmit} className="space-y-4">
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="New Name"
                                    value={newNameValue}
                                    onChange={(e) => setNewNameValue(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
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
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium shadow-lg shadow-blue-500/20"
                                    >
                                        Rename
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Preview Modal */}
            <AnimatePresence>
                {previewFile && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/90 backdrop-blur-md"
                            onClick={() => setPreviewFile(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative w-full max-w-4xl bg-zinc-900 rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
                        >
                            <div className="flex items-center justify-between p-4 border-b border-white/5">
                                <h2 className="text-white font-medium">{previewFile.name}</h2>
                                <button
                                    onClick={() => setPreviewFile(null)}
                                    className="p-2 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-8 flex items-center justify-center min-h-[400px]">
                                {previewFile.type === 'image' || ['png', 'jpg', 'jpeg', 'webp'].includes(previewFile.type) ? (
                                    <img
                                        src={`/uploads/${previewFile.name}`}
                                        alt={previewFile.name}
                                        className="max-w-full max-h-[70vh] object-contain rounded-lg"
                                    />
                                ) : previewFile.type === 'pdf' ? (
                                    <iframe
                                        src={`/uploads/${previewFile.name}`}
                                        className="w-full h-[70vh] rounded-lg border-0 bg-white"
                                    />
                                ) : (previewFile.name.endsWith('.md') || previewFile.type === 'md' || previewFile.type === 'markdown') ? (
                                    <div className="w-full max-h-[70vh] overflow-y-auto p-8 bg-black/40 rounded-xl border border-white/5 custom-scrollbar">
                                        <div className="markdown-content max-w-none">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {previewContent || 'Loading content...'}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center space-y-4">
                                        <FileText size={64} className="mx-auto text-white/20" />
                                        <p className="text-white/50">Preview not available for this file type</p>
                                        <a
                                            href={`/uploads/${previewFile.name}`}
                                            download
                                            className="inline-block px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                                        >
                                            Download File
                                        </a>
                                    </div>
                                )}
                            </div>
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
                                        setCurrentFolderId(contextMenu.file.id);
                                    } else {
                                        setPreviewFile(contextMenu.file);
                                        window.dispatchEvent(new CustomEvent('preview-opened', { detail: contextMenu.file }));
                                    }
                                }
                            },
                            {
                                label: 'Ask AI about this',
                                icon: <Bot size={16} className="text-indigo-400" />,
                                onClick: () => {
                                    if (selectedFileIds.size > 1 && selectedFileIds.has(contextMenu.file.id)) {
                                        // Add all selected files
                                        files.filter(f => selectedFileIds.has(f.id)).forEach(f => {
                                            window.dispatchEvent(new CustomEvent('add-to-ai-chat', { detail: f }));
                                        });
                                    } else {
                                        window.dispatchEvent(new CustomEvent('add-to-ai-chat', { detail: contextMenu.file }));
                                    }
                                }
                            },
                            {
                                label: 'Rename',
                                icon: <Edit2 size={16} />,
                                onClick: () => startRename(contextMenu.file)
                            },
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
                            }
                        ]}
                    />
                )
            }
        </div >
    );
}
