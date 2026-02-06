'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from '@/components/Layout';
import InboxTable from '@/components/InboxTable';
import FileManager from '@/components/FileManager';
import { Mail, Folder, Activity, Layout as LayoutIcon, X, ExternalLink, Columns, Monitor, Server, RefreshCw, Terminal, Loader2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Task, WorkspaceFile } from '@prisma/client';
import CreateTaskModal from './CreateTaskModal';
import DevTools from './DevTools';
import AgentActivityFeed from './AgentActivityFeed';
import { useSearchParams } from 'next/navigation';
import AIChat from './AIChat';
import ProcessManager from './ProcessManager';
import StandaloneEditor from './StandaloneEditor';
import IntegratedPreview from './IntegratedPreview';
import InteractiveTerminal from './InteractiveTerminal';
import { Sparkles, Save as SaveIcon, Code2 } from 'lucide-react';
import { getFileContent, saveFileContent, getRepoAppFileContent, saveRepoAppFileContent } from '@/app/actions';
import { toast } from 'sonner';
import VibeFileExplorer, { RepoEntry } from '@/components/VibeFileExplorer';

interface DashboardProps {
    tasks: Task[];
    files: WorkspaceFile[];
}

export default function Dashboard({ tasks, files }: DashboardProps) {
    const [viewMode, setViewMode] = useState<'zen' | 'split' | 'classic' | 'vibe'>('zen');
    const [activeTab, setActiveTab] = useState<'inbox' | 'files' | 'intelligence' | 'processes'>('inbox');
    const [previewContent, setPreviewContent] = useState<WorkspaceFile | null>(null);
    const [vibeFile, setVibeFile] = useState<WorkspaceFile | null>(null);
    const [vibeContent, setVibeContent] = useState('');
    const [isVibeSaving, setIsVibeSaving] = useState(false);
    const [vibePreviewUrl, setVibePreviewUrl] = useState<string>('');
    const [showVibeTerminal, setShowVibeTerminal] = useState(false);
    const [vibeRepoEntry, setVibeRepoEntry] = useState<RepoEntry | null>(null);
    const [showExplorer, setShowExplorer] = useState(true);
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

    // Listen for Vibe events
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handleOpenVibe = async (e: any) => {
            const file = e.detail;
            setVibeFile(file);
            setViewMode('vibe');

            try {
                const res = await getFileContent(file.id);
                if (res.success && res.content !== undefined) {
                    setVibeContent(res.content);
                }
            } catch (err) {
                toast.error('Failed to load file content');
            }
        };

        const handleSetVibeUrl = (e: any) => {
            setVibePreviewUrl(e.detail);
            // Auto-switch to vibe mode if not already there, to ensure visibility
            setViewMode('vibe');
        };

        window.addEventListener('open-vibe', handleOpenVibe);
        window.addEventListener('set-vibe-preview', handleSetVibeUrl);
        return () => {
            window.removeEventListener('open-vibe', handleOpenVibe);
            window.removeEventListener('set-vibe-preview', handleSetVibeUrl);
        };
    }, []);

    const handleVibeSave = async () => {
        if (vibeRepoEntry) {
            handleRepoSave();
            return;
        }
        if (!vibeFile) return;
        setIsVibeSaving(true);
        try {
            const res = await saveFileContent(vibeFile.id, vibeContent);
            if (res.success) {
                toast.success('File saved successfully');
            } else {
                toast.error('Failed to save file');
            }
        } catch (err) {
            toast.error('Error saving file');
        } finally {
            setIsVibeSaving(false);
        }
    };

    const handleRepoSave = async () => {
        if (!vibeRepoEntry) return;
        setIsVibeSaving(true);
        try {
            const res = await saveRepoAppFileContent(vibeRepoEntry.path, vibeContent);
            if (res.success) {
                toast.success('File saved successfully');
            } else {
                toast.error('Failed to save file');
            }
        } catch (err) {
            toast.error('Error saving file');
        } finally {
            setIsVibeSaving(false);
        }
    };

    // Load Repo Content
    useEffect(() => {
        const loadRepoContent = async () => {
            if (!vibeRepoEntry) return;
            try {
                const res = await getRepoAppFileContent(vibeRepoEntry.path);
                if (res.success && typeof res.content === 'string') {
                    setVibeContent(res.content);
                }
            } catch (err) {
                toast.error('Failed to load repo file');
            }
        };
        loadRepoContent();
    }, [vibeRepoEntry]);

    // Auto-connect preview for known apps
    useEffect(() => {
        if (vibeRepoEntry && vibeRepoEntry.path.startsWith('apps/call') && !vibePreviewUrl) {
            setVibePreviewUrl('http://localhost:3000');
            toast.success('Connected to local preview at :3000');
        }
    }, [vibeRepoEntry, vibePreviewUrl]);

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

        // Check if previewContent is a string (direct URL) or a WorkspaceFile object
        const isUrl = typeof previewContent === 'string';
        const previewUrl = isUrl
            ? previewContent
            : (previewContent.storagePath?.startsWith('http')
                ? previewContent.storagePath
                : `/uploads/${previewContent.storagePath || previewContent.name}`);

        const currentFolderId = !isUrl ? previewContent.parentId : null;
        const subApps = !isUrl ? files
            .filter(f => f.parentId === currentFolderId && f.type === 'folder')
            .map(folder => ({
                folder,
                entry: files.find(f => f.parentId === folder.id && f.name === 'index.html')
            }))
            .filter((item): item is { folder: WorkspaceFile, entry: WorkspaceFile } => !!item.entry) : [];

        const currentFolder = !isUrl ? files.find(f => f.id === currentFolderId) : null;
        const parentFolderId = currentFolder?.parentId;
        const parentAppEntry = parentFolderId
            ? files.find(f => f.parentId === parentFolderId && f.name === 'index.html')
            : null;

        return (
            <div className="w-full h-full flex flex-col overflow-hidden bg-white">
                {(subApps.length > 0 || parentAppEntry) && (
                    <div className="bg-[#1e1e1e] border-b border-white/5 px-4 py-2 flex items-center gap-2 overflow-x-auto shrink-0 shadow-sm custom-scrollbar">
                        {parentAppEntry && (
                            <button
                                onClick={() => setPreviewContent(parentAppEntry as any)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-medium text-white/70 hover:text-white transition-colors"
                            >
                                <Folder size={12} className="rotate-180" />
                                Parent App
                            </button>
                        )}
                        {subApps.map(app => (
                            <button
                                key={app.folder.id}
                                onClick={() => setPreviewContent(app.entry as any)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-500/10 hover:bg-blue-500/20 text-xs font-medium text-blue-200 transition-colors border border-blue-500/20"
                            >
                                <LayoutIcon size={12} />
                                {app.folder.name}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex-1 relative bg-white">
                    <iframe
                        src={previewUrl}
                        className="w-full h-full border-none"
                        title="Preview"
                    />
                </div>
            </div>
        );
    };

    return (
        <Layout>
            <CreateTaskModal />

            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 p-1 bg-black/40 backdrop-blur-md border border-white/5 rounded-lg shadow-xl overflow-hidden max-w-full">
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
                        viewMode === 'classic' ? "bg-white/10 text-white shadow-sm border border-white/10" : "text-white/40 hover:text-white"
                    )}
                    title="Apps & Files"
                >
                    <LayoutIcon size={16} />
                </button>
                <div className="w-px h-4 bg-white/10 mx-1" />
                <button
                    onClick={() => setViewMode('vibe')}
                    className={cn(
                        "p-2 rounded-md transition-all flex items-center gap-2",
                        viewMode === 'vibe' ? "bg-emerald-500/20 text-emerald-300 shadow-sm border border-emerald-500/20" : "text-white/40 hover:text-white"
                    )}
                    title="Vibe Mode (Full IDE)"
                >
                    <Sparkles size={16} className={viewMode === 'vibe' ? "animate-pulse" : ""} />
                    {viewMode === 'vibe' && <span className="text-[10px] font-bold uppercase tracking-widest mr-1">Vibe</span>}
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
                        {previewContent ? (
                            <IntegratedPreview
                                isOpen={true}
                                onClose={() => {
                                    setPreviewContent(null);
                                    setViewMode('zen');
                                }}
                                embedded
                                url={typeof previewContent === 'string' ? previewContent : undefined}
                                appName={typeof previewContent === 'string' ? 'Preview' : previewContent.name}
                                status={'ready'}
                            >
                                {/* Pass file content logic if needed, but IntegratedPreview focuses on URL mostly. 
                                    If previewContent is a file, we might need a different viewer or IntegratedPreview needs to handle static content.
                                    For now, we'll assume IntegratedPreview handles URL. 
                                    If it's a static file (image/pdf), IntegratedPreview might not be the best fit yet, 
                                    BUT we want unification. Let's see if renderPreview logic can be passed as children or handled content.
                                */}
                                {typeof previewContent !== 'string' && renderPreview()}
                            </IntegratedPreview>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-white/20 gap-4">
                                <LayoutIcon size={48} className="opacity-50" />
                                <p className="font-medium">Select a file to preview</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {viewMode === 'vibe' && (
                <div className="w-full h-full flex items-stretch animate-in fade-in duration-700 bg-[#050505]">
                    {/* Column 1: Chat */}
                    <div className="w-[30%] border-r border-white/5 h-full flex flex-col min-w-[350px]">
                        <div className="px-4 py-3 bg-black/40 border-b border-white/5 flex items-center justify-between">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40">AI Architect</h3>
                            <div className="flex items-center gap-2">
                                <button className="p-1 px-2 rounded bg-emerald-500/10 text-emerald-400 text-[8px] font-black uppercase tracking-widest border border-emerald-500/20">Voice Mode</button>
                                <Activity size={12} className="text-emerald-500/50" />
                            </div>
                        </div>
                        <div className="flex-1 overflow-hidden relative">
                            <AIChat
                                embedded
                                activeFile={vibeRepoEntry || vibeFile}
                                activeApp={vibeRepoEntry ? { name: vibeRepoEntry.path.split('/')[0] || 'App', path: vibeRepoEntry.path.split('/')[0] || '' } : null}
                            />
                        </div>
                    </div>

                    {/* Column 2: Editor & Terminal */}
                    <div className="flex-1 flex min-w-0 border-r border-white/5">
                        {/* File Explorer Side Panel */}
                        <div className={cn("border-r border-white/5 bg-[#050505] transition-all duration-300 overflow-hidden flex flex-col", showExplorer ? "w-64 opacity-100" : "w-0 opacity-0")}>
                            <VibeFileExplorer
                                onFileSelect={(file) => {
                                    if (file.type !== 'folder') {
                                        setVibeRepoEntry(file);
                                        setVibeFile(null);
                                    }
                                }}
                                activeFile={vibeRepoEntry}
                            />
                        </div>

                        <div className="flex-1 flex flex-col min-w-0">
                            <div className="flex-1 overflow-hidden relative flex flex-col">
                                <div className="px-4 py-3 bg-black/40 border-b border-white/5 flex items-center justify-between shrink-0">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                        <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40">
                                            {vibeRepoEntry ? vibeRepoEntry.name : (vibeFile ? vibeFile.name : 'Vibe Editor')}
                                        </h3>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={() => setShowVibeTerminal(!showVibeTerminal)}
                                            className={cn(
                                                "flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold transition-all",
                                                showVibeTerminal ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "bg-white/5 text-white/40 hover:text-white"
                                            )}
                                        >
                                            <Terminal size={12} />
                                            SHELL
                                        </button>
                                        <div className="w-px h-4 bg-white/10" />
                                        <button
                                            onClick={() => setShowExplorer(!showExplorer)}
                                            className={cn(
                                                "p-1.5 rounded-md transition-all",
                                                showExplorer ? "bg-white/10 text-white" : "text-white/40 hover:text-white"
                                            )}
                                            title="Toggle Explorer"
                                        >
                                            <Folder size={12} />
                                        </button>
                                        {(vibeFile || vibeRepoEntry) && (
                                            <button
                                                onClick={() => handleVibeSave()}
                                                disabled={isVibeSaving}
                                                className="px-4 py-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded-full transition-all active:scale-95 shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                                            >
                                                {isVibeSaving ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
                                                {isVibeSaving ? 'Deploying...' : 'Quick Deploy'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    {vibeFile || vibeRepoEntry ? (
                                        <StandaloneEditor
                                            fileName={vibeRepoEntry ? vibeRepoEntry.name : vibeFile?.name || ''}
                                            content={vibeContent}
                                            onChange={setVibeContent}
                                            onSave={handleVibeSave}
                                            isSaving={isVibeSaving}
                                            embedded
                                        />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-white/10 bg-[#050505] gap-6">
                                            <div className="w-20 h-20 rounded-3xl border-2 border-dashed border-white/5 flex items-center justify-center">
                                                <Code2 size={32} className="opacity-20" />
                                            </div>
                                            <div className="text-center space-y-2">
                                                <p className="font-black text-[10px] uppercase tracking-widest text-white/40">Vibe Mode Ready</p>
                                                <p className="text-[10px] text-white/20">Select a file from the explorer to begin high-speed coding.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Resizable Terminal Pane */}
                            <AnimatePresence>
                                {showVibeTerminal && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: '35%', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="border-t border-white/5 overflow-hidden"
                                    >
                                        <InteractiveTerminal onClose={() => setShowVibeTerminal(false)} />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Column 3: Preview */}
                    <div className="w-[30%] h-full flex flex-col min-w-[350px]">
                        <div className="px-4 py-3 bg-black/40 border-b border-white/5 flex items-center justify-between">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40">Live Preview</h3>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[8px] font-bold text-emerald-500/80 uppercase tracking-widest">Active</span>
                            </div>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <IntegratedPreview
                                isOpen={true}
                                onClose={() => { }}
                                embedded
                                url={vibePreviewUrl}
                                appName={vibeRepoEntry ? 'App' : (vibeFile?.name || 'Vibecall')}
                                status={vibePreviewUrl ? 'ready' : 'idle'}
                            />
                        </div>
                    </div>
                </div>
            )}
            {viewMode === 'classic' && (
                <div className="w-full h-full flex flex-col overflow-auto custom-scrollbar p-4 md:p-8 animate-in fade-in zoom-in-95 duration-300 min-w-0">
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
