'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from '@/components/Layout';
import InboxTable from '@/components/InboxTable';
import FileManager from '@/components/FileManager';
import { Mail, Folder, Activity, Layout as LayoutIcon, X, ExternalLink, Columns, Monitor, Server, RefreshCw, Terminal, Loader2, Zap, Bot, GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Task, WorkspaceFile } from '@prisma/client';
import CreateTaskModal from './CreateTaskModal';
import DevTools from './DevTools';
import AgentActivityFeed from './AgentActivityFeed';
import WorkflowDesigner from './WorkflowDesigner';
import AgentBuilder from './AgentBuilder';
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

type PreviewTarget = WorkspaceFile | string;

type ProcessInfo = {
    id: string;
    name: string;
    status?: string;
    path?: string;
    port?: number;
    metadata?: { appPath?: string; appName?: string; publicUrl?: string };
};

export default function Dashboard({ tasks, files }: DashboardProps) {
    const [viewMode, setViewMode] = useState<'zen' | 'split' | 'classic' | 'vibe'>('zen');
    const [activeTab, setActiveTab] = useState<'inbox' | 'files' | 'intelligence' | 'processes' | 'workflows' | 'agents'>('inbox');
    const [previewContent, setPreviewContent] = useState<PreviewTarget | null>(null);
    const [vibeFile, setVibeFile] = useState<WorkspaceFile | null>(null);
    const [vibeContent, setVibeContent] = useState('');
    const [isVibeSaving, setIsVibeSaving] = useState(false);
    const [vibePreviewUrl, setVibePreviewUrl] = useState<string>('');
    const [showVibeTerminal, setShowVibeTerminal] = useState(false);
    const [vibeRepoEntry, setVibeRepoEntry] = useState<RepoEntry | null>(null);
    const [showExplorer, setShowExplorer] = useState(true);
    const [showVibeEditor, setShowVibeEditor] = useState(true);
    const searchParams = useSearchParams();
    const focusId = searchParams?.get('focus');
    const [customWorkflows, setCustomWorkflows] = useState<any[]>([]);

    // Notify others about preview
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('preview-selection-changed', { detail: previewContent }));
            if (previewContent && viewMode === 'zen') {
                setViewMode('split');
            }
        }
    }, [previewContent, viewMode]);

    // Listen for preview open events
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handleOpenPreview = (event: Event) => {
            const detail = (event as CustomEvent<PreviewTarget>).detail;
            console.log('👀 Opening preview tab for:', detail);
            setPreviewContent(detail);
            setViewMode('split');
        };

        window.addEventListener('open-preview-tab', handleOpenPreview);
        return () => window.removeEventListener('open-preview-tab', handleOpenPreview);
    }, []);

    // Listen for Vibe events
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handleOpenVibe = async (event: Event) => {
            const file = (event as CustomEvent<WorkspaceFile>).detail;
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

        const handleSetVibeUrl = (event: Event) => {
            setVibePreviewUrl((event as CustomEvent<string>).detail);
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

            // Project Switch Cleanup: If we moved to a new folder in apps/, stop previous processes
            const pathParts = vibeRepoEntry.path.split(/[\\/]/);
            const appsIdx = pathParts.indexOf('apps');
            if (appsIdx !== -1 && pathParts[appsIdx + 1]) {
                const projectRoot = pathParts.slice(0, appsIdx + 2).join('/');
                const windowWithVibe = window as Window & { _lastVibeRoot?: string };
                const lastRoot = windowWithVibe._lastVibeRoot;

                if (lastRoot && lastRoot !== projectRoot) {
                    console.log(`🔄 Project switch detected: ${lastRoot} -> ${projectRoot}. Cleaning up...`);
                    // We don't want to block, so we fire and forget
                    import('@/app/processActions').then(async ({ listProcesses, stopProcess }) => {
                        const { processes } = await listProcesses();
                        const processList = (processes || []) as ProcessInfo[];
                        // Find processes matching the old root
                        const toStop = processList.filter((p) =>
                            p.status === 'running' &&
                            (p.path?.includes(lastRoot) || p.metadata?.appPath?.includes(lastRoot))
                        );
                        for (const proc of toStop) {
                            console.log(`🛑 Auto-stopping ${proc.name} from previous project...`);
                            await stopProcess(proc.id);
                        }
                    });
                }
                windowWithVibe._lastVibeRoot = projectRoot;
            }

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
            <div className="w-full h-full flex flex-col overflow-hidden bg-[color:var(--card)]">
                {(subApps.length > 0 || parentAppEntry) && (
                    <div className="bg-[color:var(--card)] border-b border-[color:var(--border)] px-4 py-2 flex items-center gap-2 overflow-x-auto shrink-0 shadow-sm custom-scrollbar">
                        {parentAppEntry && (
                            <button
                                onClick={() => setPreviewContent(parentAppEntry || null)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-full theme-overlay-medium hover:theme-overlay-strong text-xs font-medium text-foreground/70 hover:text-foreground transition-colors"
                            >
                                <Folder size={12} className="rotate-180" />
                                Parent App
                            </button>
                        )}
                        {subApps.map(app => (
                            <button
                                key={app.folder.id}
                                onClick={() => setPreviewContent(app.entry)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-sky-500/10 hover:bg-sky-500/20 text-xs font-medium text-sky-200 transition-colors border border-sky-500/20"
                            >
                                <LayoutIcon size={12} />
                                {app.folder.name}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex-1 relative bg-[color:var(--background)]">
                    <iframe
                        src={previewUrl}
                        className="w-full h-full border-none"
                        title="Preview"
                    />
                </div>
            </div>
        );
    };

    const isZen = viewMode === 'zen';
    const isSplit = viewMode === 'split';
    const isVibe = viewMode === 'vibe';
    const isClassic = viewMode === 'classic';

    // Shared, always-mounted chat to avoid reloads between modes
    const chatPane = (
        <div className={cn(
            "min-w-0 h-full"
        )}>
            <AIChat
                embedded
                activeFile={isVibe && vibeRepoEntry ? {
                    id: vibeRepoEntry.path,
                    name: vibeRepoEntry.path.split('/').pop() || '',
                    type: 'file',
                    storagePath: vibeRepoEntry.path
                } as WorkspaceFile : (isVibe ? vibeFile : null)}
                activeApp={isVibe && vibeRepoEntry ? { name: vibeRepoEntry.path.split('/')[0] || 'App', path: vibeRepoEntry.path.split('/')[0] || '' } : null}
                headerRight={isVibe ? (
                    <div className="flex items-center gap-2 mr-4 border-r theme-border-subtle pr-4">
                        <button className="p-1 px-2 rounded bg-emerald-500/10 text-emerald-400 text-[8px] font-black uppercase tracking-widest border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">Voice Mode</button>
                        <Activity size={12} className="text-emerald-500/50" />
                    </div>
                ) : undefined}
            />
        </div>
    );

    const previewPane = (
        <div className={cn(
            "min-w-0 h-full bg-[color:var(--card)] relative transition-all",
            isVibe && "opacity-0 pointer-events-none absolute inset-0",
            !isSplit && !isVibe && "opacity-0 pointer-events-none absolute inset-0"
        )}>
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
                    {typeof previewContent !== 'string' && renderPreview()}
                </IntegratedPreview>
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center theme-text-quaternary gap-4">
                    <LayoutIcon size={48} className="opacity-50" />
                    <p className="font-medium">Select a file to preview</p>
                </div>
            )}
        </div>
    );

    const vibeEditorPane = (
        <div className={cn(
            "flex h-full overflow-hidden min-w-0 border-r theme-border-subtle transition-all duration-500 ease-in-out",
            (!isVibe || !showVibeEditor) && "opacity-0 pointer-events-none",
            !isVibe && "absolute inset-0"
        )}>
            <div className={cn("border-r theme-border-subtle bg-[#050505] transition-all duration-300 overflow-hidden flex flex-col", showExplorer ? "w-64 opacity-100" : "w-0 opacity-0")}>
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
                    <div className="px-4 py-3 bg-black/40 border-b theme-border-subtle flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                            <h3 className="text-[10px] font-black uppercase tracking-widest theme-text-tertiary">
                                {vibeRepoEntry ? vibeRepoEntry.name : (vibeFile ? vibeFile.name : 'Vibe Editor')}
                            </h3>
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setShowVibeTerminal(!showVibeTerminal)}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold transition-all",
                                    showVibeTerminal ? "bg-sky-500 theme-text-primary shadow-lg shadow-sky-500/20" : "theme-overlay-subtle theme-text-tertiary hover:theme-text-primary"
                                )}
                            >
                                <Terminal size={12} />
                                SHELL
                            </button>
                            <div className="w-px h-4 theme-border-medium" />
                            <button
                                onClick={() => setShowExplorer(!showExplorer)}
                                className={cn(
                                    "p-1.5 rounded-md transition-all",
                                    showExplorer ? "theme-overlay-medium theme-text-primary" : "theme-text-tertiary hover:theme-text-primary"
                                )}
                                title="Toggle Explorer"
                            >
                                <Folder size={12} />
                            </button>
                            {(vibeFile || vibeRepoEntry) && (
                                <button
                                    onClick={() => handleVibeSave()}
                                    disabled={isVibeSaving}
                                    className="px-4 py-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 theme-text-primary text-[10px] font-black uppercase tracking-widest rounded-full transition-all active:scale-95 shadow-lg shadow-emerald-500/20 flex items-center gap-2"
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
                            <div className="w-full h-full flex flex-col items-center justify-center theme-text-quaternary opacity-50 bg-[#050505] gap-6">
                                <div className="w-20 h-20 rounded-3xl border-2 border-dashed theme-border-subtle flex items-center justify-center">
                                    <Code2 size={32} className="opacity-20" />
                                </div>
                                <div className="text-center space-y-2">
                                    <p className="font-black text-[10px] uppercase tracking-widest theme-text-tertiary">Vibe Mode Ready</p>
                                    <p className="text-[10px] theme-text-quaternary">Select a file from the explorer to begin high-speed coding.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <AnimatePresence>
                    {showVibeTerminal && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: '35%', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t theme-border-subtle overflow-hidden"
                        >
                            <InteractiveTerminal
                                onClose={() => setShowVibeTerminal(false)}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );

    const vibePreviewPane = (
        <div className={cn(
            "h-full flex flex-col min-w-[350px] min-h-0 transition-all duration-500 ease-in-out",
            !isVibe && "opacity-0 pointer-events-none absolute inset-0"
        )}>
            <div className="flex-1 overflow-hidden">
                <IntegratedPreview
                    isOpen={true}
                    onClose={() => { }}
                    embedded
                    url={vibePreviewUrl}
                    appName={vibeRepoEntry ? 'App' : (vibeFile?.name || 'Vibecall')}
                    status={vibePreviewUrl ? 'ready' : 'idle'}
                    onViewModeChange={(mode) => {
                        if (mode === 'desktop' || mode === 'tablet') {
                            setShowVibeEditor(false);
                        } else {
                            setShowVibeEditor(true);
                        }
                    }}
                />
            </div>
        </div>
    );

    return (
        <Layout headerCenter={
            <div className="relative flex items-center gap-1 p-1.5 bg-[color:var(--card)] backdrop-blur-xl border border-[color:var(--border)] rounded-xl shadow-[0_20px_40px_rgba(0,0,0,0.45)] overflow-hidden max-w-full before:absolute before:inset-0 before:rounded-xl before:bg-gradient-to-r before:from-[var(--overlay-subtle)] before:via-transparent before:to-[var(--overlay-medium)] before:pointer-events-none">
                <button
                    onClick={() => setViewMode('zen')}
                    className={cn(
                        "p-2 rounded-lg transition-all group",
                        isZen ? "theme-overlay-strong text-foreground shadow-sm" : "text-foreground/40 hover:text-foreground hover:theme-overlay-subtle"
                    )}
                    title="Zen Chat"
                >
                    <Monitor size={16} />
                </button>
                <button
                    onClick={() => setViewMode('split')}
                    className={cn(
                        "p-2 rounded-lg transition-all",
                        isSplit ? "theme-overlay-strong text-foreground shadow-sm" : "text-foreground/40 hover:text-foreground hover:theme-overlay-subtle"
                    )}
                    title="Split View"
                >
                    <Columns size={16} />
                </button>
                <button
                    onClick={() => setViewMode('classic')}
                    className={cn(
                        "p-2 rounded-lg transition-all",
                        isClassic ? "theme-overlay-strong text-foreground shadow-sm border theme-border-strong" : "text-foreground/40 hover:text-foreground hover:theme-overlay-subtle"
                    )}
                    title="Apps & Files"
                >
                    <LayoutIcon size={16} />
                </button>
                <div className="w-px h-4 bg-[color:var(--border)] mx-1" />
                <button
                    onClick={() => setViewMode('vibe')}
                    className={cn(
                        "p-2 rounded-lg transition-all flex items-center gap-2",
                        isVibe ? "bg-emerald-500/20 text-emerald-200 shadow-sm border border-emerald-500/30" : "text-foreground/40 hover:text-foreground hover:theme-overlay-subtle"
                    )}
                    title="Vibe Mode (Full IDE)"
                >
                    <Sparkles size={16} className={isVibe ? "animate-pulse" : ""} />
                    {isVibe && <span className="text-[10px] font-bold uppercase tracking-widest mr-1">Vibe</span>}
                </button>
            </div>
        }>
            <CreateTaskModal />

            {/* Persistent multi-pane layout (chat + preview + vibe editor/preview). Hidden in classic mode but kept mounted. */}
            {!isClassic && (
                <div className="w-full h-full">
                    <div
                        className={cn("grid h-full w-full transition-all")}
                        style={{
                            gridTemplateColumns: isVibe
                                ? '30% 1fr 30%'
                                : isSplit
                                    ? '50% 50% 0'
                                    : '1fr 0 0'
                        }}
                    >
                        {/* Column 1: Chat (Embedded) */}
                        <div className="min-w-0 min-h-0 h-full">
                            <AIChat
                                embedded
                                activeFile={isVibe && vibeRepoEntry ? {
                                    id: vibeRepoEntry.path,
                                    name: vibeRepoEntry.path.split('/').pop() || '',
                                    type: 'file',
                                    storagePath: vibeRepoEntry.path
                                } as WorkspaceFile : (isVibe ? vibeFile : null)}
                                activeApp={isVibe && vibeRepoEntry ? { name: vibeRepoEntry.path.split('/')[0] || 'App', path: vibeRepoEntry.path.split('/')[0] || '' } : null}
                                headerRight={isVibe ? (
                                    <div className="flex items-center gap-2 mr-4 border-r theme-border-subtle pr-4">
                                        <button className="p-1 px-2 rounded bg-emerald-500/10 text-emerald-400 text-[8px] font-black uppercase tracking-widest border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">Voice Mode</button>
                                        <Activity size={12} className="text-emerald-500/50" />
                                    </div>
                                ) : undefined}
                            />
                        </div>

                        {/* Column 2: preview (split) and vibe editor (kept mounted) */}
                        <div className="relative min-w-0 min-h-0 h-full">
                            {previewPane}
                            {vibeEditorPane}
                        </div>

                        {/* Column 3: Vibe preview (kept mounted) */}
                        {vibePreviewPane}
                    </div>
                </div>
            )}

            {/* Classic view keeps its own layout while floating chat remains available */}
            {isClassic && (
                <>
                    <div className="w-full h-full flex flex-col overflow-auto custom-scrollbar p-4 md:p-8 animate-in fade-in zoom-in-95 duration-300 min-w-0">
                        <div className="flex items-center gap-2 mb-8 p-1.5 theme-overlay-subtle w-fit rounded-xl border theme-border-medium shadow-[inset_0_0_0_1px_var(--overlay-subtle)]">
                            <button onClick={() => setActiveTab('inbox')} className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all", activeTab === 'inbox' ? "theme-overlay-medium theme-text-primary shadow-sm" : "theme-text-tertiary hover:theme-text-secondary")}>
                                <Mail size={16} /> Inbox
                            </button>
                            <button onClick={() => setActiveTab('files')} className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all", activeTab === 'files' ? "theme-overlay-medium theme-text-primary shadow-sm" : "theme-text-tertiary hover:theme-text-secondary")}>
                                <Folder size={16} /> Files
                            </button>
                            <button onClick={() => setActiveTab('processes')} className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all", activeTab === 'processes' ? "theme-overlay-medium theme-text-primary shadow-sm" : "theme-text-tertiary hover:theme-text-secondary")}>
                                <Server size={16} /> Processes
                            </button>
                            <button onClick={() => setActiveTab('intelligence')} className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all", activeTab === 'intelligence' ? "theme-overlay-medium theme-text-primary shadow-sm" : "theme-text-tertiary hover:theme-text-secondary")}>
                                <Activity size={16} /> Intelligence
                            </button>
                            <button onClick={() => setActiveTab('workflows')} className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all", activeTab === 'workflows' ? "theme-overlay-medium theme-text-primary shadow-sm" : "theme-text-tertiary hover:theme-text-secondary")}>
                                <GitBranch size={16} /> Workflows
                            </button>
                            <button onClick={() => setActiveTab('agents')} className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all", activeTab === 'agents' ? "theme-overlay-medium theme-text-primary shadow-sm" : "theme-text-tertiary hover:theme-text-secondary")}>
                                <Bot size={16} /> Agents
                            </button>
                        </div>

                        <div className="flex-1">
                            {activeTab === 'inbox' && <InboxTable tasks={tasks} />}
                            {activeTab === 'files' && <FileManager files={files} />}
                            {activeTab === 'processes' && <ProcessManager />}
                            {activeTab === 'intelligence' && <div className="h-[600px]"><AgentActivityFeed /></div>}
                            {activeTab === 'workflows' && <div className="h-[700px]"><WorkflowDesigner workflows={customWorkflows} onChange={setCustomWorkflows} /></div>}
                            {activeTab === 'agents' && (
                                <div className="h-[700px]"><AgentBuilder embedded /></div>
                            )}
                        </div>
                    </div>
                    {/* Floating Chat for Classic Mode */}
                    <AIChat />
                </>
            )}

            <DevTools />
        </Layout>
    );
}
