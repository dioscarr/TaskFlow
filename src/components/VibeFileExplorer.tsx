'use client';

import React, { useState, useEffect } from 'react';
import { Folder, FileCode, ChevronRight, ChevronDown, Loader2, RefreshCw, FileText, LayoutGrid, LayoutPanelLeft } from 'lucide-react';
import { listRepoAppEntries } from '@/app/actions';
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
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [currentPath, setCurrentPath] = useState<string>('');

    const loadEntries = async (path: string = '') => {
        setIsLoading(true);
        try {
            const result = await listRepoAppEntries(path);
            if (result.success && result.entries) {
                // Sort: Folders first, then files
                const sorted = (result.entries as RepoEntry[]).sort((a, b) => {
                    if (a.type === b.type) return a.name.localeCompare(b.name);
                    return a.type === 'folder' ? -1 : 1;
                });
                setEntries(sorted);
            } else {
                setEntries([]);
            }
        } catch (error) {
            console.error('Failed to load repo entries:', error);
            toast.error('Failed to load files');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadEntries('');
    }, []);

    // Helper to check if a file is currently active
    const isActive = (path: string) => activeFile?.path === path;

    // Recursive component for folder tree could be better, but flat list with "currentPath" navigation 
    // is simpler for "File Manager" style. 
    // But for "IDE" style (VS Code), we want a tree.
    // However, listRepoAppEntries takes a path and returns children.
    // So we need a tree structure where each folder loads its content.

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
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

const FileTree = ({ path, level, onSelect, activeFilePath }: { path: string, level: number, onSelect: (f: RepoEntry) => void, activeFilePath?: string }) => {
    const [items, setItems] = useState<RepoEntry[]>([]);
    const [isOpen, setIsOpen] = useState(level === 0); // Root open by default
    const [hasLoaded, setHasLoaded] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && !hasLoaded) {
            loadChildren();
        }
    }, [isOpen]);

    const loadChildren = async () => {
        setLoading(true);
        try {
            const result = await listRepoAppEntries(path);
            if (result.success && result.entries) {
                const sorted = (result.entries as RepoEntry[]).sort((a, b) => {
                    if (a.type === b.type) return a.name.localeCompare(b.name);
                    return a.type === 'folder' ? -1 : 1;
                });
                setItems(sorted);
                setHasLoaded(true);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (level > 0 && !isOpen) return null;

    return (
        <div className="flex flex-col">
            {level === 0 ? (
                // Root Level: Render children directly (assuming root is just the container)
                items.map(item => (
                    <FileTreeItem
                        key={item.path}
                        item={item}
                        level={level}
                        onSelect={onSelect}
                        activeFilePath={activeFilePath}
                    />
                ))
            ) : null}
        </div>
    );
}

const FileTreeItem = ({ item, level, onSelect, activeFilePath }: { item: RepoEntry, level: number, onSelect: (f: RepoEntry) => void, activeFilePath?: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [children, setChildren] = useState<RepoEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);

    const toggleOpen = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (item.type !== 'folder') return;

        const nextOpen = !isOpen;
        setIsOpen(nextOpen);

        if (nextOpen && !loaded) {
            setLoading(true);
            const result = await listRepoAppEntries(item.path);
            if (result.success && result.entries) {
                const sorted = (result.entries as RepoEntry[]).sort((a, b) => {
                    if (a.type === b.type) return a.name.localeCompare(b.name);
                    return a.type === 'folder' ? -1 : 1;
                });
                setChildren(sorted);
                setLoaded(true);
            }
            setLoading(false);
        }
    };

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (item.type === 'folder') {
            toggleOpen(e);
        } else {
            onSelect(item);
        }
    };

    const isAppRoot = level === 0 && item.type === 'folder';

    return (
        <div>
            <div
                onClick={handleClick}
                className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors text-white/60 hover:text-white hover:bg-white/5 select-none",
                    activeFilePath === item.path ? "bg-blue-500/10 text-blue-300" : ""
                )}
                style={{ paddingLeft: `${level * 12 + 8}px` }}
            >
                <div className="shrink-0 w-4 h-4 flex items-center justify-center">
                    {item.type === 'folder' && (
                        loading ? <Loader2 size={10} className="animate-spin" /> :
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

                <span className="text-xs truncate">{item.name}</span>
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
                        />
                    ))}
                    {children.length === 0 && !loading && (
                        <div className="py-1 px-4 text-[10px] text-white/20 italic" style={{ paddingLeft: `${(level + 1) * 12 + 24}px` }}>
                            Empty
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
