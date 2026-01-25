'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MOCK_EMAILS, Email } from '@/lib/mockData';
import { useFocus } from './Layout';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { deleteTask, updateTaskStatus } from '@/app/actions';
import ConfirmationModal from './ConfirmationModal';
import ContextMenu from './ContextMenu';
import { Mail, Paperclip, ChevronRight, User, Trash2, CheckSquare, FileText } from 'lucide-react';
import { Task } from '@prisma/client';
import { cn } from '@/lib/utils';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

interface InboxTableProps {
    tasks: Task[];
}

export default function InboxTable({ tasks }: InboxTableProps) {
    const router = useRouter();
    const { setFocusedItem } = useFocus();
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<'All' | 'Unread' | 'Campaigns'>('All');

    // Context Menu & Modal State
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; task: Task } | null>(null);
    const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useKeyboardShortcuts({
        onSearch: () => searchInputRef.current?.focus(),
        onEscape: () => {
            setContextMenu(null);
            setDeletingTaskId(null);
        },
        enabled: !deletingTaskId
    });

    // Close menu when clicking outside
    React.useEffect(() => {
        const handleClickOutside = () => setContextMenu(null);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    const handleContextMenu = (e: React.MouseEvent, task: Task) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, task });
    };

    const handleDeleteRequest = (id: string) => {
        setDeletingTaskId(id);
        setContextMenu(null);
    };

    const handleConfirmDelete = async () => {
        if (!deletingTaskId) return;
        setIsDeleting(true);
        const loadingToast = toast.loading('Deleting task...');

        try {
            const result = await deleteTask(deletingTaskId);
            if (result.success) {
                toast.success('Task deleted', { id: loadingToast });
                router.refresh();
            } else {
                toast.error(result.error || 'Failed to delete', { id: loadingToast });
            }
        } catch (error) {
            toast.error('An error occurred', { id: loadingToast });
        } finally {
            setIsDeleting(false);
            setDeletingTaskId(null);
        }
    };

    const handleToggleStatus = async (task: Task) => {
        const newStatus = task.status === 'completed' ? 'pending' : 'completed';
        const loadingToast = toast.loading(newStatus === 'completed' ? 'Marking as done...' : 'Marking as pending...');

        try {
            const result = await updateTaskStatus(task.id, newStatus);
            if (result.success) {
                toast.success(newStatus === 'completed' ? 'Task completed' : 'Task marked as pending', { id: loadingToast });
                router.refresh();
            } else {
                toast.error(result.error || 'Failed to update', { id: loadingToast });
            }
        } finally {
            setContextMenu(null);
        }
    };

    const formatDate = (date: Date | string) => {
        try {
            const d = new Date(date);
            if (isNaN(d.getTime())) return 'Recently';
            return d.toLocaleDateString();
        } catch (e) {
            return 'Recently';
        }
    };

    // Helper to parse email source safely
    const getEmailData = (task: Task) => {
        try {
            if (!task.emailSource) return {};
            return JSON.parse(task.emailSource);
        } catch (e) {
            return {};
        }
    };

    // ... filtering logic preserved below by not including it in replacement ... 


    const filteredTasks = tasks.filter(task => {
        const fullTask = getEmailData(task);
        const senderName = fullTask.sender?.name || 'Unknown';
        const title = fullTask.title || task.title || '';
        const description = fullTask.description || task.description || '';

        // Search filter
        const matchesSearch =
            senderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            description.toLowerCase().includes(searchQuery.toLowerCase());

        if (!matchesSearch) return false;

        // Status/Category filter
        if (activeFilter === 'Unread') return task.status === 'unread';
        if (activeFilter === 'Campaigns') return (fullTask.tags && fullTask.tags.length > 0);

        return true;
    });

    return (
        <div className="w-full space-y-4">
            <ContextMenu
                isOpen={!!contextMenu}
                onClose={() => setContextMenu(null)}
                x={contextMenu?.x || 0}
                y={contextMenu?.y || 0}
                items={[
                    {
                        label: 'Open Task',
                        icon: <FileText size={14} />,
                        onClick: () => {
                            if (contextMenu) {
                                const fullTask = getEmailData(contextMenu.task);
                                setFocusedItem({ ...contextMenu.task, ...fullTask });
                            }
                        }
                    },
                    {
                        label: contextMenu?.task.status === 'completed' ? 'Mark as Pending' : 'Mark as Done',
                        icon: <CheckSquare size={14} />,
                        onClick: () => {
                            if (contextMenu) handleToggleStatus(contextMenu.task);
                        }
                    },
                    {
                        label: 'Delete',
                        icon: <Trash2 size={14} />,
                        danger: true,
                        onClick: () => {
                            if (contextMenu) handleDeleteRequest(contextMenu.task.id);
                        }
                    }
                ]}
            />
            <ConfirmationModal
                isOpen={!!deletingTaskId}
                onClose={() => setDeletingTaskId(null)}
                onConfirm={handleConfirmDelete}
                title="Delete Task"
                message="Are you sure you want to delete this task? This action cannot be undone."
                confirmText="Delete Task"
                isDanger
                isLoading={isDeleting}
            />
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Inbox</h1>
                    <p className="text-white/40 text-sm mt-1">Manage your active tasks and communications</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-center">
                    {/* Search Bar */}
                    <div className="relative w-full sm:w-64">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Search inbox... (Ctrl+K)"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-white/20"
                        />
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex p-1 bg-white/5 border border-white/10 rounded-xl">
                        {['All', 'Unread', 'Campaigns'].map((filter) => (
                            <button
                                key={filter}
                                onClick={() => setActiveFilter(filter as any)}
                                className={cn(
                                    "px-4 py-1.5 rounded-lg text-xs font-medium transition-all",
                                    activeFilter === filter
                                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                                        : "text-white/40 hover:text-white/70"
                                )}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <motion.div
                className="space-y-3"
                initial="hidden"
                animate="visible"
                variants={{
                    hidden: { opacity: 0 },
                    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
                }}
            >
                <AnimatePresence mode='popLayout'>
                    {filteredTasks.map((task) => {
                        const fullTask = getEmailData(task) || {};
                        const sender = fullTask.sender || { name: 'Unknown', email: '' };
                        const tags = fullTask.tags || [];

                        return (
                            <motion.div
                                layout
                                key={task.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                onContextMenu={(e) => handleContextMenu(e, task)}
                                onClick={() => setFocusedItem({
                                    ...task,
                                    ...fullTask
                                })}
                                className={cn(
                                    "group relative flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all duration-300 border border-white/5 hover:border-white/10",
                                    "bg-white/5 hover:bg-white/10 backdrop-blur-sm",
                                    task.status === 'unread' ? "shadow-[0_0_15px_-5px_theme(colors.blue.500/0.3)]" : ""
                                )}
                            >
                                {/* Status Indicator */}
                                <div className={cn("w-1.5 h-1.5 rounded-full", task.status === 'unread' ? "bg-blue-500" : "bg-white/20")} />

                                {/* Sender Avatar/Icon */}
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center text-indigo-300 border border-white/10 shrink-0">
                                    {sender.avatar ? (
                                        <User size={18} />
                                    ) : (
                                        <span className="font-semibold text-sm">{sender.name?.[0] || '?'}</span>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={cn("text-sm font-medium truncate", task.status === 'unread' ? "text-white" : "text-white/70")}>
                                            {sender.name}
                                        </span>
                                        {/* Attachment indicator placeholder */}
                                    </div>
                                    <div className="text-sm font-semibold text-white/90 truncate">{fullTask.title || task.title}</div>
                                    <div className="text-xs text-white/50 truncate mt-0.5">{fullTask.preview || fullTask.description || task.description}</div>
                                </div>

                                {/* Meta & Date */}
                                <div className="flex flex-col items-end gap-2 shrink-0">
                                    {/* Use createdAt or email date if available */}
                                    <span className="text-xs text-white/40 font-mono">
                                        {formatDate(task.createdAt)}
                                    </span>
                                    <div className="flex gap-1">
                                        {tags.slice(0, 1).map((tag: string) => (
                                            <span key={tag} className="px-2 py-0.5 rounded-md text-[10px] bg-white/5 border border-white/10 text-white/60">
                                                {tag}
                                            </span>
                                        ))}
                                        {tags.length > 1 && (
                                            <span className="px-2 py-0.5 rounded-md text-[10px] bg-white/5 text-white/40">+ {tags.length - 1}</span>
                                        )}
                                    </div>
                                </div>

                                {/* Hover Action */}
                                <div className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
                                    <ChevronRight className="text-white/50" />
                                </div>

                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </motion.div>
            {filteredTasks.length === 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="py-20 flex flex-col items-center justify-center text-white/20"
                >
                    <Mail size={48} className="mb-4 opacity-10" />
                    <p className="text-lg font-medium">No messages found</p>
                    <p className="text-sm">Try adjusting your search or filters</p>
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="mt-4 text-blue-400 hover:text-blue-300 text-sm font-medium"
                        >
                            Clear Search
                        </button>
                    )}
                </motion.div>
            )}
        </div>
    );
}
