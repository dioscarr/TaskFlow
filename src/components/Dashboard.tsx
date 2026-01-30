
'use client';

import React, { useState } from 'react';
import Layout from '@/components/Layout';
import InboxTable from '@/components/InboxTable';
import FileManager from '@/components/FileManager';
import { Mail, Folder, Activity, Layout as LayoutIcon, X, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Task, WorkspaceFile } from '@prisma/client';

import CreateTaskModal from './CreateTaskModal';
import DevTools from './DevTools';
import AgentActivityFeed from './AgentActivityFeed'; // New Import
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

interface DashboardProps {
    tasks: Task[];
    files: WorkspaceFile[];
}

export default function Dashboard({ tasks, files }: DashboardProps) {
    const [activeTab, setActiveTab] = useState<'inbox' | 'files' | 'intelligence' | 'preview'>('inbox');
    const [previewContent, setPreviewContent] = useState<WorkspaceFile | null>(null);
    const searchParams = useSearchParams();
    const focusId = searchParams?.get('focus');

    useEffect(() => {
        // Notify others (like AIChat) about the active preview
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('preview-selection-changed', { detail: previewContent }));
        }
    }, [previewContent]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handleOpenPreview = (e: any) => {
            console.log('👀 Opening preview tab for:', e.detail);
            setPreviewContent(e.detail);
            setActiveTab('preview');
        };

        window.addEventListener('open-preview-tab', handleOpenPreview);
        return () => window.removeEventListener('open-preview-tab', handleOpenPreview);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (focusId) {
            setActiveTab('files');
            // Provide a small buffer for the FileManager to mount and initialize its listeners
            const timer = setTimeout(() => {
                window.dispatchEvent(new CustomEvent('focus-workspace-item', { detail: { itemId: focusId } }));
            }, 600);
            return () => clearTimeout(timer);
        }
    }, [focusId]);

    return (
        <Layout>
            <CreateTaskModal />
            {/* Tab Switcher */}
            <div className="flex items-center gap-2 mb-8 p-1 bg-white/5 w-fit rounded-lg border border-white/5">
                <button
                    onClick={() => setActiveTab('inbox')}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                        activeTab === 'inbox' ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white/80"
                    )}
                >
                    <Mail size={16} /> Inbox
                </button>
                <button
                    onClick={() => setActiveTab('files')}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                        activeTab === 'files' ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white/80"
                    )}
                >
                    <Folder size={16} /> Files
                </button>
                <button
                    onClick={() => setActiveTab('intelligence')}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                        activeTab === 'intelligence' ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white/80"
                    )}
                >
                    <Activity size={16} /> Intelligence
                </button>
                {activeTab === 'preview' && (
                    <div className="flex items-center bg-purple-500/10 text-purple-200 shadow-sm border border-purple-500/20 rounded-md overflow-hidden">
                        <button
                            onClick={() => setActiveTab('preview')}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all hover:bg-purple-500/5"
                        >
                            <LayoutIcon size={16} /> Preview
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setActiveTab('files');
                                setPreviewContent(null);
                            }}
                            className="p-2 hover:bg-purple-500/20 text-purple-300/50 hover:text-purple-200 transition-colors border-l border-purple-500/10"
                            title="Close Preview"
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}
            </div>

            <div className="mt-4">
                <div className={activeTab === 'inbox' ? 'block' : 'hidden'}>
                    <InboxTable tasks={tasks} />
                </div>
                <div className={activeTab === 'files' ? 'block' : 'hidden'}>
                    <FileManager files={files} />
                </div>
                {activeTab === 'intelligence' && (
                    <div className="h-[600px]">
                        <AgentActivityFeed />
                    </div>
                )}
                {activeTab === 'preview' && previewContent && (() => {
                    const currentFolderId = previewContent.parentId;

                    // Find Sub-Apps: Folders inside current folder that have index.html
                    const subApps = files
                        .filter(f => f.parentId === currentFolderId && f.type === 'folder')
                        .map(folder => ({
                            folder,
                            entry: files.find(f => f.parentId === folder.id && f.name === 'index.html')
                        }))
                        .filter(item => item.entry);

                    // Find Parent App: The index.html in the parent folder of the current folder
                    const currentFolder = files.find(f => f.id === currentFolderId);
                    const parentFolderId = currentFolder?.parentId;
                    const parentAppEntry = parentFolderId
                        ? files.find(f => f.parentId === parentFolderId && f.name === 'index.html')
                        : null;

                    return (
                        <div className="w-full h-[80vh] bg-white rounded-xl overflow-hidden shadow-2xl border border-white/10 animate-in fade-in zoom-in-95 duration-300 flex flex-col">
                            <div className="bg-gray-100 border-b px-4 py-2 flex items-center justify-between text-xs text-gray-500 shrink-0">
                                <span className="font-mono">{previewContent.name}</span>
                                <div className="flex items-center gap-3">
                                    <a
                                        href={`/uploads/${previewContent.storagePath || previewContent.name}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 px-2 py-1 bg-white hover:bg-blue-50 text-gray-500 hover:text-blue-600 rounded border border-gray-200 hover:border-blue-200 transition-colors"
                                        title="Open Full Site in New Tab"
                                    >
                                        <ExternalLink size={12} />
                                        <span className="font-bold uppercase tracking-wider text-[9px]">Open</span>
                                    </a>
                                    <div className="flex gap-1.5 border-l pl-3 border-gray-200">
                                        <button
                                            onClick={() => { setActiveTab('files'); setPreviewContent(null); }}
                                            className="w-2.5 h-2.5 rounded-full bg-red-400/50 hover:bg-red-500 transition-colors cursor-pointer"
                                            title="Close"
                                        />
                                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/50" />
                                        <div className="w-2.5 h-2.5 rounded-full bg-green-400/50" />
                                    </div>
                                </div>
                            </div>

                            {/* App Navigation Bar */}
                            {(subApps.length > 0 || parentAppEntry) && (
                                <div className="bg-white border-b px-4 py-2 flex items-center gap-2 overflow-x-auto shrink-0 shadow-sm">
                                    {parentAppEntry && (
                                        <button
                                            onClick={() => setPreviewContent(parentAppEntry)}
                                            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-xs font-medium text-gray-700 transition-colors"
                                        >
                                            <Folder size={12} className="rotate-180" /> {/* Fallback icon if ArrowUp not imported */}
                                            Parent App
                                        </button>
                                    )}
                                    {subApps.map(app => (
                                        <button
                                            key={app.folder.id}
                                            onClick={() => setPreviewContent(app.entry!)}
                                            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-50 hover:bg-blue-100 text-xs font-medium text-blue-700 transition-colors border border-blue-100"
                                        >
                                            <LayoutIcon size={12} />
                                            {app.folder.name}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <iframe
                                src={`/uploads/${previewContent.storagePath || previewContent.name}`}
                                className="w-full h-full border-none bg-white"
                                title="Preview"
                            />
                        </div>
                    );
                })()}
            </div>

            <DevTools />
        </Layout>
    );
}
