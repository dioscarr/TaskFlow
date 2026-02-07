'use client';

import React, { useState, useEffect } from 'react';
import { Folder, FileCode, ChevronRight, Loader2, RefreshCw, LayoutGrid } from 'lucide-react';
import { listRepoAppEntries } from '@/app/actions';
import { listProcesses, manageAppLifecycle } from '@/app/processActions';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export type RepoEntry = {
    name: string;
    path: string; // Relative path from apps root
    type: string;
    size: number | null;
};

interface VibeFileExplorerProps {
    onFileSelect: (file: RepoEntry) => void;
    activeFile?: RepoEntry | null;
}

export default function VibeFileExplorer({ onFileSelect, activeFile }: VibeFileExplorerProps) {
    const [entries, setEntries] = useState<RepoEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [processes, setProcesses] = useState<any[]>([]);

    const loadEntries = async (path: string = '') => {
        setIsLoading(true);
        try {
            // Step 1: Load file entries first for immediate UI feedback
            const filesRes = await listRepoAppEntries(path);

            if (filesRes.success && filesRes.entries) {
                const sorted = (filesRes.entries as RepoEntry[]).sort((a, b) => {
                    if (a.type === b.type) return a.name.localeCompare(b.name);
                    return a.type === 'folder' ? -1 : 1;
                });
                setEntries(sorted);
                // If we have entries, we can hide the main loader even if processes are still loading
                setIsLoading(false);
            }

            // Step 2: Load processes in background to avoid blocking the file list
            const procRes = await listProcesses();
            if (procRes.success && procRes.processes) {
                setProcesses(procRes.processes);
            }
        } catch (error) {
            console.error('Failed to load data:', error);
            // toast.error('Failed to load explorer data');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadEntries('');
    }, []);

    const handleToggleApp = async (appName: string, currentStatus: string) => {
        if (currentStatus === 'running') {
            toast.info(`Stopping ${appName}...`);
            await manageAppLifecycle({ action: 'stop', target: appName });
            await loadEntries(); // Refresh status
            return;
        }

        // Check for other running apps
        const otherRunning = processes.find(p => p.status === 'running' && p.type !== 'system' && !p.name.toLowerCase().includes('ngrok'));
        let stopOthers = false;

        if (otherRunning) {
            const confirmed = window.confirm(`App "${otherRunning.name}" is currently running. Stop it and start "${appName}"?`);
            if (!confirmed) return;
            stopOthers = true;
        }

        toast.info(stopOthers ? `Stopping others and starting ${appName}...` : `Starting ${appName}...`);
        const res = await manageAppLifecycle({ action: 'start', target: appName, stopOthers }) as any;

        if (res.success) {
            toast.success(`Started ${appName}`);
            if (res.previewUrl) {
                window.dispatchEvent(new CustomEvent('set-vibe-preview', { detail: res.previewUrl }));
            }
        } else {
            toast.error(`Failed to start: ${res.message || 'Unknown error'}`);
        }
        await loadEntries(); // Refresh
    };

    return (
        <div className="flex flex-col h-full bg-[#050505] border-r border-white/5 w-64 min-w-[200px]">
            <div className="p-3 border-b border-white/5 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Explorer</span>
                <button
                    onClick={() => loadEntries('')}
                    className="p-1 hover:bg-white/10 rounded-md text-white/30 hover:text-white transition-colors"
                >
                    <RefreshCw size={12} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                {isLoading && entries.length === 0 ? (
                    <div className="flex justify-center p-4">
                        <Loader2 size={16} className="animate-spin text-white/20" />
                    </div>
                ) : (
                    <div className="space-y-0.5">
                        <FileTree
                            path=""
                            level={0}
                            onSelect={onFileSelect}
                            activeFilePath={activeFile?.path}
                            processes={processes}
                            onToggleApp={handleToggleApp}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

const FileTree = ({ path, level, onSelect, activeFilePath, processes, onToggleApp }: {
    path: string,
    level: number,
    onSelect: (f: RepoEntry) => void,
    activeFilePath?: string,
    processes: any[],
    onToggleApp: (name: string, status: string) => void
}) => {
    const [items, setItems] = useState<RepoEntry[]>([]);
    const [isOpen, setIsOpen] = useState(level === 0);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && !hasLoaded) loadChildren();
    }, [isOpen]);

    const loadChildren = async () => {
        setLoading(true);
        try {
            const result = await listRepoAppEntries(path);
            if (result.success && result.entries) {
                const sorted = (result.entries as RepoEntry[]).sort((a: any, b: any) => {
                    if (a.type === b.type) return a.name.localeCompare(b.name);
                    return a.type === 'folder' ? -1 : 1;
                });
                setItems(sorted);
                setHasLoaded(true);
            }
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    if (level > 0 && !isOpen) return null;

    return (
        <div className="flex flex-col">
            {level === 0 ? (
                items.map(item => (
                    <FileTreeItem
                        key={item.path}
                        item={item}
                        level={level}
                        onSelect={onSelect}
                        activeFilePath={activeFilePath}
                        processes={processes}
                        onToggleApp={onToggleApp}
                    />
                ))
            ) : null}
        </div>
    );
}

const FileTreeItem = ({ item, level, onSelect, activeFilePath, processes, onToggleApp }: {
    item: RepoEntry,
    level: number,
    onSelect: (f: RepoEntry) => void,
    activeFilePath?: string,
    processes: any[],
    onToggleApp: (name: string, status: string) => void
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [children, setChildren] = useState<RepoEntry[]>([]);
    const [loadState, setLoadState] = useState({ loading: false, loaded: false });

    // Identify if this folder corresponds to a running process
    // We match process name or path
    const isAppRoot = level === 0 && item.type === 'folder';
    const relatedProcess = isAppRoot ? processes.find(p => {
        if (!p.path) return false;
        const normalizedP = p.path.replace(/\\/g, '/');
        // Check if process path ends with the app folder name
        return normalizedP.endsWith(`/${item.name}`) ||
            normalizedP.endsWith(`/${item.path}`) ||
            p.name === item.name ||
            p.name === `Repo App ${item.name}` ||
            p.metadata?.appName === item.name;
    }) : undefined;

    const isRunning = relatedProcess?.status === 'running';

    const toggleOpen = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (item.type !== 'folder') return;
        const nextOpen = !isOpen;
        setIsOpen(nextOpen);
        if (nextOpen && !loadState.loaded) {
            setLoadState(s => ({ ...s, loading: true }));
            const result = await listRepoAppEntries(item.path);
            if (result.success && result.entries) {
                const sorted = (result.entries as RepoEntry[]).sort((a: any, b: any) => {
                    if (a.type === b.type) return a.name.localeCompare(b.name);
                    return a.type === 'folder' ? -1 : 1;
                });
                setChildren(sorted);
                setLoadState(s => ({ ...s, loaded: true, loading: false }));
            } else {
                setLoadState(s => ({ ...s, loading: false }));
            }
        }
    };

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (item.type === 'folder') toggleOpen(e);
        else onSelect(item);
    };

    return (
        <div>
            <div
                onClick={handleClick}
                className={cn(
                    "group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors text-white/60 hover:text-white hover:bg-white/5 select-none",
                    activeFilePath === item.path ? "bg-blue-500/10 text-blue-300" : ""
                )}
                style={{ paddingLeft: `${level * 12 + 8}px` }}
            >
                <div className="shrink-0 w-4 h-4 flex items-center justify-center">
                    {item.type === 'folder' && (
                        loadState.loading ? <Loader2 size={10} className="animate-spin" /> :
                            <ChevronRight size={12} className={cn("transition-transform", isOpen ? "rotate-90" : "")} />
                    )}
                </div>

                <div className="shrink-0">
                    {item.type === 'folder' ? (
                        isAppRoot ? <LayoutGrid size={14} className="text-emerald-400" /> :
                            <Folder size={14} className={isOpen ? "text-white" : "text-white/40"} />
                    ) : (
                        <FileCode size={14} className="text-blue-400/60" />
                    )}
                </div>

                <span className="text-xs truncate flex-1">{item.name}</span>

                {isAppRoot && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => onToggleApp(item.name, isRunning ? 'running' : 'stopped')}
                            className={cn(
                                "p-1 rounded hover:bg-white/20 transition-all",
                                isRunning ? "text-red-400 hover:text-red-300" : "text-emerald-400 hover:text-emerald-300"
                            )}
                            title={isRunning ? "Stop App" : "Start App"}
                        >
                            {isRunning ? (
                                <div className="w-2 h-2 bg-current rounded-sm" />
                            ) : (
                                <div className="w-0 h-0 border-l-[6px] border-l-current border-y-[4px] border-y-transparent border-r-0" />
                            )}
                        </button>
                        {isRunning && (
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        )}
                    </div>
                )}
            </div>

            {isOpen && item.type === 'folder' && (
                <div>
                    {children.map(child => (
                        <FileTreeItem
                            key={child.path}
                            item={child}
                            level={level + 1}
                            onSelect={onSelect}
                            activeFilePath={activeFilePath}
                            processes={processes}
                            onToggleApp={onToggleApp}
                        />
                    ))}
                    {children.length === 0 && !loadState.loading && (
                        <div className="py-1 px-4 text-[10px] text-white/20 italic" style={{ paddingLeft: `${(level + 1) * 12 + 24}px` }}>
                            Empty
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
