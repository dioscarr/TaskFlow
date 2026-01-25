'use client';

import { TaskWithData } from '@/lib/types';
import { Calendar, FileText, Share2, MoreVertical, X, CheckSquare, Clock, User, Trash2 } from 'lucide-react';
import { deleteTask, updateTaskStatus } from '@/app/actions';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import ConfirmationModal from './ConfirmationModal';
import { useState } from 'react';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export default function TaskDetail({ task, onClose }: { task: TaskWithData; onClose: () => void }) {
    const router = useRouter();
    const sender = task.sender || { name: 'Unknown', email: 'unknown@example.com' };
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDeleteClick = () => {
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        setIsDeleting(true);
        const loadingToast = toast.loading('Deleting task...');

        try {
            console.log('Deleting task:', task.id);
            const result = await deleteTask(task.id);

            if (result.success) {
                toast.success('Task deleted', { id: loadingToast });
                router.refresh();
                onClose();
            } else {
                toast.error(result.error || 'Failed to delete', { id: loadingToast });
            }
        } catch (error) {
            console.error('Delete error:', error);
            toast.error('An error occurred', { id: loadingToast });
        } finally {
            setIsDeleting(false);
            setIsDeleteModalOpen(false);
        }
    };

    useKeyboardShortcuts({
        onEscape: onClose,
        onDelete: handleDeleteClick,
        enabled: !isDeleteModalOpen
    });

    return (
        <>
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Delete Task"
                message="Are you sure you want to delete this task? This action cannot be undone."
                confirmText="Delete Task"
                isDanger
                isLoading={isDeleting}
            />

            <div className="flex flex-col h-full text-foreground">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10 glass bg-white/5">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                            <FileText size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold leading-none">{task.title}</h2>
                            <p className="text-sm text-muted-foreground mt-1">From: {sender.name} &lt;{sender.email}&gt;</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDeleteClick}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors text-red-400"
                            title="Delete Task (Delete)"
                        >
                            <Trash2 size={20} />
                        </button>
                        <button
                            onClick={async () => {
                                const loadingToast = toast.loading('Updating task...');

                                try {
                                    const result = await updateTaskStatus(task.id, 'completed');
                                    if (result.success) {
                                        toast.success('Task marked as done', { id: loadingToast });
                                        router.refresh();
                                        onClose();
                                    } else {
                                        toast.error(result.error || 'Failed to update', { id: loadingToast });
                                    }
                                } catch (error) {
                                    console.error('Update error:', error);
                                    toast.error('An error occurred', { id: loadingToast });
                                }
                            }}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors text-emerald-400"
                            title="Mark as Done"
                        >
                            <CheckSquare size={20} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-8 relative">
                    {/* Metadata Badges */}
                    <div className="flex gap-2 mb-6">
                        {task.tags?.map(tag => (
                            <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-white/70">
                                {tag}
                            </span>
                        ))}
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 border border-blue-500/20 text-blue-300 flex items-center gap-1">
                            <Calendar size={12} /> {(() => {
                                try {
                                    const d = new Date(task.createdAt);
                                    return isNaN(d.getTime()) ? 'Recently' : d.toLocaleDateString();
                                } catch (e) {
                                    return 'Recently';
                                }
                            })()}
                        </span>
                        <span className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1",
                            task.status === 'completed' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-zinc-500/10 border-zinc-500/20 text-zinc-400"
                        )}>
                            {task.status === 'completed' ? <CheckSquare size={12} /> : <Clock size={12} />}
                            {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                        </span>
                    </div>

                    <div className="prose prose-invert max-w-none text-white/80">
                        <p className="whitespace-pre-wrap leading-relaxed">{task.description || task.preview}</p>
                    </div>

                    {/* Mock Actions Area - "Workflow Triggers" */}
                    <div className="mt-12 p-6 rounded-xl border border-dashed border-white/20 bg-white/5">
                        <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">Suggested Workflows</h3>

                        <div className="flex gap-4">
                            <button className="flex items-center gap-3 px-4 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-all group">
                                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                                    <FileText size={16} />
                                </div>
                                <div className="text-left">
                                    <div className="text-sm font-semibold text-emerald-100">Create Sheet Task</div>
                                    <div className="text-xs text-emerald-400/60">Using AI Summary</div>
                                </div>
                            </button>

                            <button className="flex items-center gap-3 px-4 py-3 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-lg transition-all group">
                                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                                    <Calendar size={16} />
                                </div>
                                <div className="text-left">
                                    <div className="text-sm font-semibold text-purple-100">Schedule Meeting</div>
                                    <div className="text-xs text-purple-400/60">Find time in Calendar</div>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </>
    );
}
