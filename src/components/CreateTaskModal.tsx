'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Loader2 } from 'lucide-react';
import { createTask } from '@/app/actions';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export default function CreateTaskModal() {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');

    useKeyboardShortcuts({
        onNew: () => setIsOpen(true),
        onEscape: () => setIsOpen(false),
        enabled: true
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            toast.error('Task title is required');
            return;
        }

        setIsLoading(true);
        const loadingToast = toast.loading('Creating task...');

        try {
            const result = await createTask({ title, description });

            if (result.success) {
                toast.success('Task created successfully', { id: loadingToast });
                setIsOpen(false);
                setTitle('');
                setDescription('');
                router.refresh();
            } else {
                toast.error(result.error || 'Failed to create task', { id: loadingToast });
            }
        } catch (error) {
            toast.error('An error occurred', { id: loadingToast });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-8 right-8 p-4 bg-sky-600 hover:bg-sky-500 text-white rounded-full shadow-lg hover:shadow-sky-500/20 transition-all active:scale-95 group z-30"
            >
                <Plus size={24} className="group-hover:rotate-90 transition-transform" />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="w-full max-w-lg bg-[color:var(--card)] border theme-border-medium rounded-2xl p-6 shadow-2xl relative z-10"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold theme-text-primary">New Task</h2>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-2 hover:theme-overlay-medium rounded-full transition-colors theme-text-secondary hover:theme-text-primary"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium theme-text-tertiary mb-1">Title</label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="What needs to be done?"
                                        className="w-full px-4 py-2 theme-overlay-subtle border theme-border-medium rounded-lg theme-text-primary placeholder:theme-text-quaternary focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium theme-text-tertiary mb-1">Description</label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Add details..."
                                        rows={4}
                                        className="w-full px-4 py-2 theme-overlay-subtle border theme-border-medium rounded-lg theme-text-primary placeholder:theme-text-quaternary focus:outline-none focus:ring-2 focus:ring-sky-500/50 resize-none"
                                    />
                                </div>

                                <div className="flex justify-end gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setIsOpen(false)}
                                        className="px-4 py-2 text-sm font-medium theme-text-tertiary hover:theme-text-primary transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isLoading || !title.trim()}
                                        className="px-6 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all flex items-center gap-2"
                                    >
                                        {isLoading && <Loader2 size={16} className="animate-spin" />}
                                        Create Task
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
