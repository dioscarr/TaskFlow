'use client';

import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import InboxTable from '@/components/InboxTable';
import FileManager from '@/components/FileManager';
import { Mail, Folder, Activity, Layout as LayoutIcon, X, ExternalLink, Columns, Monitor, Server } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Task, WorkspaceFile } from '@prisma/client';
import CreateTaskModal from './CreateTaskModal';
import DevTools from './DevTools';
import AgentActivityFeed from './AgentActivityFeed';
import { useSearchParams } from 'next/navigation';
import AIChat from './AIChat';
import ProcessManager from './ProcessManager';

interface DashboardProps {
    tasks: Task[];
    files: WorkspaceFile[];
}

export default function Dashboard({ tasks, files }: DashboardProps) {
    const [viewMode, setViewMode] = useState<'zen' | 'split' | 'classic'>('zen');
    const [activeTab, setActiveTab] = useState<'inbox' | 'files' | 'intelligence' | 'processes'>('inbox');
    const [previewContent, setPreviewContent] = useState<WorkspaceFile | null>(null);
    const searchParams = useSearchParams();
    const focusId = searchParams?.get('focus');

    // Notify others about preview
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('preview-selection-changed', { detail: previewContent }));
            if (previewContent && viewMode === 'zen') {
                setViewMode('split');
            }
        }
    }, [previewContent]);

    // Listen for preview open events
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handleOpenPreview = (e: any) => {
            console.log('👀 Opening preview tab for:', e.detail);
            setPreviewContent(e.detail);
            setViewMode('split');
        };

        window.addEventListener('open-preview-tab', handleOpenPreview);
        return () => window.removeEventListener('open-preview-tab', handleOpenPreview);
    }, []);

    // Handle focus params
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (focusId) {
            setViewMode('classic');
            setActiveTab('files');
            const timer = setTimeout(() => {
                window.dispatchEvent(new CustomEvent('focus-workspace-item', { detail: { itemId: focusId } }));
            }, 600);
            return () => clearTimeout(timer);
        }
    }, [focusId]);

    const renderPreview = () => {
        if (!previewContent) return null;

        const currentFolderId = previewContent.parentId;
        const subApps = files
            .filter(f => f.parentId === currentFolderId && f.type === 'folder')
            .map(folder => ({
                folder,
                entry: files.find(f => f.parentId === folder.id && f.name === 'index.html')
            }))
            .filter((item): item is { folder: WorkspaceFile, entry: WorkspaceFile } => !!item.entry);

        const currentFolder = files.find(f => f.id === currentFolderId);
        const parentFolderId = currentFolder?.parentId;
        const parentAppEntry = parentFolderId
            ? files.find(f => f.parentId === parentFolderId && f.name === 'index.html')
            : null;

        return (
            <div className="w-full h-full bg-[#1e1e1e] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                <div className="bg-[#2d2d2d] border-b border-white/5 px-4 py-3 flex items-center justify-between text-xs text-white/60 shrink-0">
                    <span className="font-mono text-white/80">{previewContent.name}</span>
                    <div className="flex items-center gap-3">
                        <a
                            href={`/uploads/${previewContent.storagePath || previewContent.name}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-2 py-1 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white rounded transition-colors"
                        >
                            <ExternalLink size={12} />
                            <span>Open</span>
                        </a>
                        <button
                            onClick={() => { setPreviewContent(null); if (viewMode === 'split') setViewMode('zen'); }}
                            className="hover:text-white transition-colors"
                            title="Close Preview"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>

                {(subApps.length > 0 || parentAppEntry) && (
                    <div className="bg-[#1e1e1e] border-b border-white/5 px-4 py-2 flex items-center gap-2 overflow-x-auto shrink-0 shadow-sm">
                        {parentAppEntry && (
                            <button
                                onClick={() => setPreviewContent(parentAppEntry)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-medium text-white/70 hover:text-white transition-colors"
                            >
                                <Folder size={12} className="rotate-180" />
                                Parent App
                            </button>
                        )}
                        {subApps.map(app => (
                            <button
                                key={app.folder.id}
                                onClick={() => setPreviewContent(app.entry)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-500/10 hover:bg-blue-500/20 text-xs font-medium text-blue-200 transition-colors border border-blue-500/20"
                            >
                                <LayoutIcon size={12} />
                                {app.folder.name}
                            </button>
                        ))}
                    </div>
                )}

                <iframe
                    src={`/uploads/${previewContent.storagePath || previewContent.name}`}
                    className="w-full flex-1 border-none bg-[#1e1e1e]"
                    title="Preview"
                />
            </div>
        );
    };

    return (
        <Layout>
            <CreateTaskModal />

            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 p-1 bg-black/40 backdrop-blur-md border border-white/5 rounded-lg shadow-xl">
                <button
                    onClick={() => setViewMode('zen')}
                    className={cn(
                        "p-2 rounded-md transition-all",
                        viewMode === 'zen' ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white"
                    )}
                    title="Zen Chat"
                >
                    <Monitor size={16} />
                </button>
                <button
                    onClick={() => setViewMode('split')}
                    className={cn(
                        "p-2 rounded-md transition-all",
                        viewMode === 'split' ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white"
                    )}
                    title="Split View"
                >
                    <Columns size={16} />
                </button>
                <button
                    onClick={() => setViewMode('classic')}
                    className={cn(
                        "p-2 rounded-md transition-all",
                        viewMode === 'classic' ? "bg-purple-500/20 text-purple-300 shadow-sm border border-purple-500/20" : "text-white/40 hover:text-white"
                    )}
                    title="Apps & Files"
                >
                    <LayoutIcon size={16} />
                </button>
            </div>

            {viewMode === 'zen' && (
                <div className="w-full h-full animate-in fade-in duration-500">
                    <AIChat embedded />
                </div>
            )}

            {viewMode === 'split' && (
                <div className="w-full h-full flex items-stretch animate-in fade-in duration-500">
                    <div className="w-1/2 border-r border-white/5 h-full">
                        <AIChat embedded />
                    </div>
                    <div className="w-1/2 h-full bg-black/50 relative">
                        {previewContent ? renderPreview() : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-white/20 gap-4">
                                <LayoutIcon size={48} className="opacity-50" />
                                <p className="font-medium">Select a file to preview</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {viewMode === 'classic' && (
                <div className="w-full h-full flex flex-col overflow-auto custom-scrollbar p-4 md:p-8 animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex items-center gap-2 mb-8 p-1 bg-white/5 w-fit rounded-lg border border-white/5">
                        <button onClick={() => setActiveTab('inbox')} className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all", activeTab === 'inbox' ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white/80")}>
                            <Mail size={16} /> Inbox
                        </button>
                        <button onClick={() => setActiveTab('files')} className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all", activeTab === 'files' ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white/80")}>
                            <Folder size={16} /> Files
                        </button>
                        <button onClick={() => setActiveTab('processes')} className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all", activeTab === 'processes' ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white/80")}>
                            <Server size={16} /> Processes
                        </button>
                        <button onClick={() => setActiveTab('intelligence')} className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all", activeTab === 'intelligence' ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white/80")}>
                            <Activity size={16} /> Intelligence
                        </button>
                    </div>

                    <div className="flex-1">
                        {activeTab === 'inbox' && <InboxTable tasks={tasks} />}
                        {activeTab === 'files' && <FileManager files={files} />}
                        {activeTab === 'processes' && <ProcessManager />}
                        {activeTab === 'intelligence' && <div className="h-[600px]"><AgentActivityFeed /></div>}
                    </div>

                    <AIChat />
                </div>
            )}

            <DevTools />
        </Layout>
    );
}
