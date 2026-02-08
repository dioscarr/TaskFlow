'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Bot, Command, Copy, CornerDownLeft, Eye, File, FileCode, FileText, Image, Layout, Loader2, MessageSquare, MoreHorizontal, Paperclip, Play, Plus, RefreshCw, Send, Settings, Sparkles, Terminal, Trash2, X, Maximize2, Minimize2, CheckCircle2, ChevronDown, List, FolderOpen, Folder, FileJson, Square, BrainCircuit, Image as ImageIcon, ExternalLink, Check, ChevronRight, Edit2, Pin, PinOff, Search, Receipt, DollarSign, Save, AlignLeft, Lightbulb, Compass, Activity, Zap, ArrowDown, AlertTriangle, Globe, Monitor, GitBranch, Split } from 'lucide-react';
import { chatWithAI, chatWithAIStream, getPrompts, createPrompt, updatePrompt, setActivePrompt, deletePrompt, generateSystemPrompt, getIntentRules, getWorkspaceFiles, getChatSessionAgentStatus, approveLatestAgentJob, getAgentActivitiesForSession, cancelAllAgentJobs } from '@/app/actions';
import { createChatSession, getChatSessions, getChatSession, addChatMessage, updateChatSessionTitle, deleteChatSession, deleteAllChatSessions } from '@/app/chatActions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TOOL_LIBRARY } from '@/lib/toolLibrary';
import { DEFAULT_SKILLS, SKILLS_LIBRARY } from '@/lib/skillsLibrary';
import { DEFAULT_CHAT_MODEL, MODEL_CATALOG } from '@/lib/modelCatalog';
import type { WorkspaceFile, AIPromptSet, IntentRule } from '@prisma/client';
import PromptEditorModal from './PromptEditorModal';
import QuestionWizard from './QuestionWizard';
import TerminalView from './TerminalView';
import SuggestionsLibraryModal from './SuggestionsLibraryModal';
import ConfirmationModal from './ConfirmationModal';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { normalizeMarkdown, hasMarkdownTable } from '@/utils/markdownUtils';
import FileEditPreviewModal from './FileEditPreviewModal';
import EmojiCelebration from './EmojiCelebration';
import { readStreamableValue } from 'ai/rsc';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export type SelectedFile = {
    id: string;
    name: string;
    type: string;
    parentId?: string | null;
    storagePath?: string;
};

const aiChatStateCache = {
    messages: [] as {
        id?: string;
        role: 'user' | 'ai';
        content: string;
        files?: SelectedFile[];
        toolUsed?: string;
        toolResult?: any;
        thinking?: string;
        toolArgs?: any;
    }[],
    attachedFiles: [] as SelectedFile[],
    activeSessionId: null as string | null,
    activeSessionTitle: 'New Chat',
    currentFolderContext: { id: null as string | null, name: 'Root' },
    activePreviewContext: null as { id: string, name: string, parentId: string | null } | null,
    activeAppContext: null as { name: string; path: string } | null,
    selectedModel: DEFAULT_CHAT_MODEL,
    activeScope: 'workspace' as 'workspace' | 'repo',
    scopeBySession: {} as Record<string, 'workspace' | 'repo'>
};

const CodeBlock = ({ language, code, fileName }: { language: string, code: string, fileName?: string }) => {
    const [isCollapsed, setIsCollapsed] = useState(code.split('\n').length > 20);
    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(code);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
        toast.success("Code copied to clipboard");
    };

    return (
        <div className="rounded-xl overflow-hidden border border-[color:var(--border)] bg-[#0d0d12] my-4 group shadow-2xl">
            <div className="flex items-center justify-between px-4 py-2 bg-foreground/5 border-b border-[color:var(--border)] backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/40 border border-red-500/30" />
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/40 border border-amber-500/30" />
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/40 border border-emerald-500/30" />
                    </div>
                    {fileName && (
                        <div className="flex items-center gap-2 px-2 py-0.5 rounded bg-foreground/5 border border-[color:var(--border)]">
                            <FileCode size={10} className="text-sky-400" />
                            <span className="text-[10px] font-mono text-muted-foreground/70 truncate max-w-[200px]">{fileName}</span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground/30 tracking-widest font-mono">{language}</span>
                    <div className="flex items-center gap-1 border-l border-[color:var(--border)] pl-3">
                        <button
                            onClick={handleCopy}
                            className="p-1.5 hover:bg-foreground/10 rounded-md text-muted-foreground/40 hover:text-foreground transition-all active:scale-90"
                            title="Copy code"
                        >
                            {isCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={13} />}
                        </button>
                        {code.split('\n').length > 20 && (
                            <button
                                onClick={() => setIsCollapsed(!isCollapsed)}
                                className="p-1.5 hover:bg-foreground/10 rounded-md text-muted-foreground/40 hover:text-foreground transition-all"
                                title={isCollapsed ? "Expand code" : "Collapse code"}
                            >
                                {isCollapsed ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
                            </button>
                        )}
                    </div>
                </div>
            </div>
            <div className={cn(
                "relative overflow-hidden transition-all duration-500 ease-in-out",
                isCollapsed ? "max-h-[300px]" : "max-h-[2000px]"
            )}>
                <SyntaxHighlighter
                    language={language.toLowerCase()}
                    style={vscDarkPlus}
                    customStyle={{
                        margin: 0,
                        padding: '1.25rem',
                        fontSize: '12px',
                        lineHeight: '1.6',
                        backgroundColor: 'transparent',
                        background: 'transparent',
                    }}
                    showLineNumbers={true}
                    lineNumberStyle={{
                        minWidth: '2.5em',
                        paddingRight: '1em',
                        color: '#343b4d',
                        textAlign: 'right',
                        userSelect: 'none',
                    }}
                >
                    {code}
                </SyntaxHighlighter>

                {isCollapsed && (
                    <div
                        className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0d0d12] via-[#0d0d12]/80 to-transparent flex items-end justify-center pb-4 cursor-pointer group/expand"
                        onClick={() => setIsCollapsed(false)}
                    >
                        <div className="px-4 py-1.5 bg-foreground/10 hover:bg-foreground/20 border border-[color:var(--border)] rounded-full backdrop-blur-md text-[10px] font-bold text-muted-foreground/50 group-hover/expand:text-foreground transition-all transform group-hover/expand:translate-y-[-2px]">
                            EXPAND {code.split('\n').length} LINES
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const extractThinkingFromText = (text: string) => {
    if (!text) return { cleanText: text, thinking: undefined as string | undefined };

    const xmlRegex = /<thinking>([\s\S]*?)<\/thinking>/gi;
    const mdRegex = /```thinking\s*([\s\S]*?)```/gi;
    const thoughts: string[] = [];

    let match: RegExpExecArray | null = null;
    while ((match = xmlRegex.exec(text)) !== null) {
        const content = match[1]?.trim();
        if (content) thoughts.push(content);
    }

    while ((match = mdRegex.exec(text)) !== null) {
        const content = match[1]?.trim();
        if (content) thoughts.push(content);
    }

    const cleanText = text.replace(xmlRegex, '').replace(mdRegex, '').trim();
    const thinking = thoughts.length ? thoughts.join('\n\n') : undefined;

    return { cleanText, thinking };
};
const TraceLabel = ({ icon: Icon, label, colorClass, dotColor }: { icon: any, label: string, colorClass: string, dotColor: string }) => (
    <div className="flex items-center gap-3 mb-2 group/trace">
        <div className={cn("w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)] transition-all duration-500 group-hover/trace:scale-125", dotColor)} />
        <div className="flex items-center gap-2">
            <Icon size={12} className={cn("opacity-80", colorClass)} />
            <span className={cn("text-[10px] font-black uppercase tracking-[0.2em] opacity-60 group-hover/trace:opacity-100 transition-opacity", colorClass)}>
                {label}
            </span>
        </div>
    </div>
);

const ToolResultPreview = ({ tool, result }: { tool: string; result: any }) => {
    if (!result || !result.success) return null;

    if (tool === 'view_file' && result.content) {
        return (
            <div className="mt-2">
                <TraceLabel
                    icon={FileCode}
                    label="File Read Result"
                    colorClass="text-sky-400"
                    dotColor="bg-sky-500"
                />
                <CodeBlock
                    language={result.path?.split('.').pop() || 'text'}
                    code={result.content}
                    fileName={result.path}
                />
                {result.meta && (
                    <div className="text-[9px] text-muted-foreground/30 font-mono mt-1 flex justify-end">
                        {result.meta.viewingLines}
                    </div>
                )}
            </div>
        );
    }

    if (tool === 'manage_app_lifecycle' && result.previewUrl) {
        return (
            <div className="mt-3">
                <TraceLabel
                    icon={Play}
                    label="Application Controller"
                    colorClass="text-emerald-400"
                    dotColor="bg-emerald-500"
                />
                <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] overflow-hidden shadow-xl p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                <Activity className="text-emerald-400" size={20} />
                            </div>
                            <div>
                                <h4 className="text-foreground font-medium text-sm">Application Running</h4>
                                <a href={result.previewUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground/40 text-xs hover:text-muted-foreground/60 transition-colors flex items-center gap-1">
                                    {result.previewUrl}
                                    <ExternalLink size={10} />
                                </a>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                window.dispatchEvent(new CustomEvent('set-vibe-preview', { detail: result.previewUrl }));
                                toast.success('Preview updated');
                            }}
                            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs rounded-lg transition-colors flex items-center gap-2"
                        >
                            <Monitor size={12} />
                            Open in Dashboard
                        </button>
                    </div>
                    {result.message && (
                        <div className="mt-3 pt-3 border-t border-[color:var(--border)] text-xs text-muted-foreground/60">
                            {result.message}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (tool === 'list_dir' && result.entries) {
        return (
            <div className="mt-3">
                <TraceLabel
                    icon={FolderOpen}
                    label="Directory Discovery"
                    colorClass="text-amber-400"
                    dotColor="bg-amber-500"
                />
                <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] overflow-hidden shadow-xl">
                    <div className="px-3 py-2 bg-foreground/5 border-b border-[color:var(--border)] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-mono text-muted-foreground/30 uppercase tracking-widest font-bold">Filesystem Node</span>
                        </div>
                        <span className="text-[9px] text-muted-foreground/30 font-mono">{result.total} items</span>
                    </div>
                    <div className="max-h-[240px] overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
                        {result.entries.map((e: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 group px-2 py-1.5 rounded-lg hover:bg-foreground/5 transition-colors cursor-default">
                                {e.type === 'dir'
                                    ? <Folder size={12} className="text-amber-500/80 group-hover:text-amber-400" />
                                    : <File size={12} className="text-sky-400/60 group-hover:text-sky-300" />
                                }
                                <span className="text-[11px] text-muted-foreground/60 font-mono group-hover:text-foreground/90 truncate">{e.name}</span>
                                <span className="ml-auto text-[9px] text-muted-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {e.type === 'dir' ? 'DIR' : e.size || 'FILE'}
                                </span>
                            </div>
                        ))}
                        {result.isTruncated && (
                            <div className="px-2 py-1 text-[10px] text-white/30 italic">
                                ... {result.total - result.entries.length} more items hidden
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (tool === 'run_terminal_command') {
        const isError = !!result.stderr;
        return (
            <div className="mt-3">
                <TraceLabel
                    icon={Terminal}
                    label="Command Execution"
                    colorClass={isError ? "text-red-400" : "text-emerald-400"}
                    dotColor={isError ? "bg-red-500" : "bg-emerald-500"}
                />
                <TerminalView
                    content={result.stdout || ''}
                    isError={isError}
                    title="Shell Output"
                />
                {result.stderr && (
                    <div className="mt-2">
                        <TerminalView
                            content={result.stderr}
                            isError={true}
                            title="Error Output"
                        />
                    </div>
                )}
                {!result.stdout && !result.stderr && (
                    <div className="mt-3 rounded-xl border border-[color:var(--border)] bg-foreground/5 p-4 text-center">
                        <div className="text-muted-foreground/30 italic text-[10px]">Command completed with no visible output.</div>
                    </div>
                )}
            </div>
        );
    }

    if (tool === 'replace_in_file' || tool === 'search_codebase') {
        const isReplace = tool === 'replace_in_file';
        return (
            <div className="mt-3">
                <TraceLabel
                    icon={isReplace ? Edit2 : Search}
                    label={isReplace ? "File Modification" : "Codebase Search"}
                    colorClass={isReplace ? "text-emerald-400" : "text-sky-400"}
                    dotColor={isReplace ? "bg-emerald-500" : "bg-sky-500"}
                />
                <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 flex flex-col gap-3 shadow-xl">
                    <div className="flex items-center gap-4">
                        <div className={cn(
                            "p-3 rounded-full",
                            isReplace ? "bg-emerald-500/10 text-emerald-400" : "bg-sky-500/10 text-sky-400"
                        )}>
                            {isReplace ? <Edit2 size={16} /> : <Search size={16} />}
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase text-muted-foreground/40 tracking-wider mb-1">
                                {isReplace ? 'Patch Applied' : 'Index Result'}
                            </p>
                            <p className="text-xs text-foreground/90 font-mono leading-relaxed">
                                {tool === 'replace_in_file' ? result.message : `Found ${result.count} matches in codebase.`}
                            </p>
                        </div>
                    </div>
                    {isReplace && result.diffs && result.diffs.length > 0 && (
                        <div className="mt-2 space-y-4 border-t border-white/5 pt-4">
                            {result.diffs.map((diff: any, idx: number) => (
                                <div key={idx} className="space-y-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Split size={10} className="text-white/20" />
                                        <span className="text-[9px] font-mono text-white/20 uppercase tracking-widest">Change #{idx + 1}</span>
                                    </div>
                                    <div className="rounded-lg overflow-hidden border border-white/5 flex flex-col">
                                        <div className="bg-red-500/10 p-2 text-[11px] font-mono border-b border-red-500/10 flex gap-2">
                                            <span className="text-red-400/50 select-none">-</span>
                                            <code className="text-red-300/80 line-through truncate whitespace-pre">{diff.target}</code>
                                        </div>
                                        <div className="bg-emerald-500/10 p-2 text-[11px] font-mono flex gap-2">
                                            <span className="text-emerald-400/50 select-none">+</span>
                                            <code className="text-emerald-300 whitespace-pre">{diff.replacement}</code>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (tool === 'apply_batch' || tool === 'applyBatch') {
        const diffs = result.diffs || [];
        return (
            <div className="mt-3">
                <TraceLabel
                    icon={Layers}
                    label="Batch File Edit"
                    colorClass="text-emerald-400"
                    dotColor="bg-emerald-500"
                />
                <div className="rounded-xl border border-white/10 bg-[#1e1e1e] overflow-hidden shadow-xl">
                    <div className="p-4 bg-white/5 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                                <Split size={16} />
                            </div>
                            <div>
                                <h4 className="text-white font-medium text-sm">Batch Patch Applied</h4>
                                <p className="text-white/30 text-[10px] font-mono truncate max-w-[200px]">{result.filePath}</p>
                            </div>
                        </div>
                        <div className="text-[10px] text-white/30 font-mono">
                            {diffs.length} EDITS
                        </div>
                    </div>

                    <div className="max-h-[400px] overflow-y-auto p-4 space-y-4 custom-scrollbar bg-black/20">
                        {diffs.map((diff: any, idx: number) => (
                            <div key={idx} className="space-y-2">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Variation {idx + 1}</span>
                                </div>
                                <div className="rounded-xl overflow-hidden border border-white/10 bg-[#0a0a0a] flex flex-col group shadow-lg">
                                    <div className="relative">
                                        <div className="bg-red-500/5 px-4 py-3 text-[11px] font-mono border-b border-white/5 flex gap-3 group-hover:bg-red-500/10 transition-colors">
                                            <span className="text-red-500/40 select-none font-bold">-</span>
                                            <code className="text-red-400/70 whitespace-pre scrollbar-none overflow-x-auto">{diff.target}</code>
                                        </div>
                                        <div className="bg-emerald-500/10 px-4 py-3 text-[11px] font-mono flex gap-3 group-hover:bg-emerald-500/20 transition-colors">
                                            <span className="text-emerald-400 select-none font-bold">+</span>
                                            <code className="text-emerald-300 whitespace-pre scrollbar-none overflow-x-auto">{diff.replacement}</code>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {result.message && (
                        <div className="px-4 py-2 bg-emerald-500/5 text-emerald-400/70 text-[10px] italic border-t border-white/5">
                            {result.message}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (tool === 'search_web') {
        if (result.type === 'image' && result.results) {
            return (
                <div className="mt-4 space-y-3">
                    <p className="text-[10px] uppercase font-bold text-white/40 tracking-widest pl-1">Image Result</p>
                    <div className="grid grid-cols-2 gap-2">
                        {result.results.map((img: any, i: number) => (
                            <div key={i} className="relative group overflow-hidden rounded-xl bg-black/20 aspect-video border border-white/5 hover:border-sky-500/50 transition-all">
                                <img
                                    src={img.url}
                                    alt={img.alt}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                                    <span className="text-[9px] text-white/80 line-clamp-1">{img.alt}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        if (result.type === 'web' && result.results) {
            return (
                <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 px-1">
                        <Globe size={12} className="text-sky-400" />
                        <span className="text-[10px] font-bold uppercase text-white/40 tracking-widest">Web Research</span>
                    </div>
                    {result.results.map((item: any, i: number) => (
                        <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h4 className="text-xs font-semibold text-sky-300 group-hover:text-sky-200 mb-1">{item.title}</h4>
                                    <p className="text-[11px] text-white/60 leading-relaxed line-clamp-2">{item.snippet}</p>
                                </div>
                                {item.url && <ExternalLink size={12} className="text-white/20 group-hover:text-white/40 flex-shrink-0 mt-1" />}
                            </div>
                        </div>
                    ))}
                </div>
            );
        }
    }

    // Legacy / Specific Tools (Receipts, etc)
    if (tool === 'extract_receipt_info' && result.extractedData) {
        const data = result.extractedData;
        return (
            <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-sky-900/20 to-emerald-900/20 border border-sky-500/20 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-sky-400">
                        <Receipt size={14} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Fiscal Intelligence</span>
                    </div>
                    {data.date && <span className="text-[10px] text-white/40 font-mono">{data.date}</span>}
                </div>
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <p className="text-[9px] text-white/30 uppercase font-bold tracking-wider mb-1">Provider</p>
                        <p className="text-sm text-white font-semibold truncate">{data.provider}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[9px] text-white/30 uppercase font-bold tracking-wider mb-1">Total</p>
                        <p className="text-lg text-emerald-400 font-bold font-mono">${data.total?.toLocaleString()}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (tool === 'summarize_file' && result.summary) {
        return (
            <div className="mt-4 p-4 rounded-2xl bg-sky-500/5 border border-sky-500/10 space-y-3 shadow-inner">
                <div className="flex items-center gap-2 text-sky-400">
                    <AlignLeft size={14} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Abstract Summary</span>
                </div>
                <div className="relative">
                    <p className="text-xs text-white/70 italic leading-relaxed tracking-tight pl-4 border-l-2 border-sky-500/30">
                        {result.summary}
                    </p>
                </div>
                {result.fileName && (
                    <div className="pt-2 text-[9px] text-white/20 font-bold uppercase tracking-widest flex justify-end">
                        Source: {result.fileName}
                    </div>
                )}
            </div>
        );
    }

    if (tool === 'find_duplicate_files' && result.duplicates) {
        return (
            <div className="mt-4 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 space-y-3 shadow-inner">
                <div className="flex items-center gap-2 text-amber-400">
                    <Plus size={14} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Efficiency Audit</span>
                </div>
                <p className="text-xs text-white/50">I detected <span className="text-amber-300 font-bold">{result.count}</span> potential duplicate pairs.</p>
                <div className="space-y-1 max-h-[120px] overflow-y-auto no-scrollbar">
                    {result.duplicates.slice(0, 3).map((d: any, ix: number) => (
                        <div key={ix} className="p-2 rounded-lg bg-white/5 flex items-center justify-between gap-3 border border-white/5">
                            <span className="text-[10px] text-white/60 truncate">{d.duplicate.name}</span>
                            <span className="text-[9px] text-red-400/60 font-bold px-1.5 py-0.5 bg-red-400/10 rounded uppercase">Duplicate</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Fallback JSON renderer for any tool result
    return (
        <div className="mt-3">
            <div className="flex items-center gap-2 mb-2 px-1">
                <div className="w-1.5 h-1.5 rounded-full bg-sky-500/40" />
                <span className="text-[9px] font-bold uppercase text-white/30 tracking-widest">Execution Trace</span>
            </div>
            <CodeBlock
                language="json"
                code={JSON.stringify(result, null, 2)}
            />
        </div>
    );
};

const ThinkingProcess = ({ content }: { content: string }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));

    const parseSections = (text: string) => {
        const lines = text.split('\n');
        const sections: { title: string; content: string; icon: any; color: string }[] = [];
        let currentSection: { title: string; content: string[]; icon: any; color: string } | null = null;

        const sectionTypes: Record<string, { icon: any; color: string }> = {
            'research': { icon: Search, color: 'text-cyan-400' },
            'analysis': { icon: Activity, color: 'text-amber-400' },
            'coding': { icon: FileCode, color: 'text-sky-400' },
            'plan': { icon: List, color: 'text-emerald-400' },
            'execution': { icon: Zap, color: 'text-emerald-400' },
            'reasoning': { icon: BrainCircuit, color: 'text-amber-400' }
        };

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('###') || (trimmed.startsWith('**') && trimmed.endsWith('**'))) {
                if (currentSection) {
                    sections.push({
                        title: currentSection.title,
                        content: currentSection.content.join('\n'),
                        icon: currentSection.icon,
                        color: currentSection.color
                    });
                }
                const title = trimmed.replace(/###|\*\*/g, '').trim();
                const titleLower = title.toLowerCase();
                const matchedType = Object.keys(sectionTypes).find(key => titleLower.includes(key));
                const sectionInfo = matchedType ? sectionTypes[matchedType] : { icon: FileText, color: 'text-white/40' };

                currentSection = {
                    title,
                    content: [],
                    icon: sectionInfo.icon,
                    color: sectionInfo.color
                };
            } else if (currentSection) {
                currentSection.content.push(line);
            } else {
                if (!currentSection && trimmed) {
                    currentSection = {
                        title: 'Cognitive Baseline',
                        content: [line],
                        icon: BrainCircuit,
                        color: 'text-sky-400'
                    };
                }
            }
        }

        if (currentSection && currentSection.content.length > 0) {
            sections.push({
                title: currentSection.title,
                content: currentSection.content.join('\n'),
                icon: currentSection.icon,
                color: currentSection.color
            });
        }

        return sections.length > 0 ? sections : [{
            title: 'Neural Reasoning',
            content: text,
            icon: BrainCircuit,
            color: 'text-sky-400'
        }];
    };

    const sections = parseSections(content);
    const toggleSection = (idx: number) => {
        const newSet = new Set(expandedSections);
        if (newSet.has(idx)) newSet.delete(idx);
        else newSet.add(idx);
        setExpandedSections(newSet);
    };

    return (
        <div className="mb-8 group/thought">
            <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.6)] animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Thinking</span>
            </div>

            <div className="overflow-hidden rounded-[1.5rem] border border-[color:var(--border)] bg-foreground/[0.02] backdrop-blur-xl transition-all shadow-3xl hover:border-foreground/10 group-hover/thought:bg-foreground/[0.05]">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full h-12 px-5 flex items-center justify-between transition-colors hover:bg-white/[0.02]"
                >
                    <div className="flex items-center gap-4">
                        <div className="flex -space-x-2">
                            {sections.slice(0, 4).map((s, i) => {
                                const Icon = s.icon;
                                return (
                                    <div key={i} className={cn("w-6 h-6 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center shadow-xl", s.color)}>
                                        <Icon size={11} strokeWidth={2.5} />
                                    </div>
                                );
                            })}
                        </div>
                        <span className="text-[11px] text-white/60 font-bold uppercase tracking-wider">
                            {isExpanded ? `Thinking (${sections.length})` : "Show thinking"}
                        </span>
                    </div>
                    <ChevronDown size={16} className={cn("text-white/20 transition-transform duration-500", isExpanded && "rotate-180")} />
                </button>

                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-white/5 overflow-hidden"
                        >
                            <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar bg-black/40">
                                {sections.map((section, idx) => {
                                    const Icon = section.icon;
                                    const isOpen = expandedSections.has(idx);

                                    return (
                                        <div key={idx} className="border border-white/5 rounded-2xl overflow-hidden bg-white/[0.01]">
                                            <button
                                                onClick={() => toggleSection(idx)}
                                                className="w-full flex items-center justify-between p-4 hover:bg-white/[0.03] transition-colors group/section"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={cn("p-2 rounded-xl bg-slate-900 border border-white/5 shadow-inner", section.color)}>
                                                        <Icon size={14} strokeWidth={2.5} />
                                                    </div>
                                                    <span className={cn("text-[12px] font-black uppercase tracking-widest", section.color)}>
                                                        {section.title}
                                                    </span>
                                                </div>
                                                <ChevronRight
                                                    size={14}
                                                    className={cn(
                                                        "text-white/20 transition-transform duration-300",
                                                        isOpen && "rotate-90"
                                                    )}
                                                />
                                            </button>

                                            <AnimatePresence>
                                                {isOpen && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                                        className="border-t border-[color:var(--border)] bg-foreground/[0.02]"
                                                    >
                                                        <div className="p-5 text-[13px] text-white/70 leading-relaxed font-medium space-y-3">
                                                            {section.content.split('\n').map((line, i) => {
                                                                const trimmed = line.trim();
                                                                if (!trimmed) return null;

                                                                const isBullet = trimmed.match(/^[-*•]\s+(.+)$/);
                                                                if (isBullet) {
                                                                    return (
                                                                        <div key={i} className="flex items-start gap-4 ml-1 group/line">
                                                                            <div className="mt-2.5 w-1.5 h-1.5 rounded-full bg-sky-400/50 group-hover/line:bg-sky-300 transition-colors" />
                                                                            <span className="flex-1 opacity-90">{isBullet[1]}</span>
                                                                        </div>
                                                                    );
                                                                }

                                                                return <p key={i} className={cn(line.startsWith('  ') && "ml-5 text-white/40 italic font-mono text-[11px] leading-loose")}>{trimmed}</p>;
                                                            })}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

const CognitiveTimeline = ({ activities }: { activities: any[] }) => {
    if (!activities || activities.length === 0) return null;

    return (
        <div className="my-3 pl-3 pr-2 border-l-2 border-white/5 space-y-3">
            <div className="flex items-center gap-2 mb-2">
                <Activity size={12} className="text-amber-400 opacity-60" />
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/30">Live Agent Activity</h3>
            </div>

            <div className="space-y-4">
                {activities.map((activity, idx) => (
                    <div key={activity.id} className="relative pl-4 group/item">
                        {/* Minimal Dot */}
                        <div className={cn(
                            "absolute left-[-5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-[#1e1e1e] transition-all duration-500",
                            activity.type === 'error' ? "bg-red-500" :
                                activity.type === 'thinking' ? "bg-sky-500" : "bg-amber-500 opacity-60"
                        )} />

                        <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                                <span className={cn(
                                    "text-[10px] font-bold uppercase tracking-wide",
                                    activity.type === 'error' ? "text-red-400" :
                                        activity.type === 'thinking' ? "text-sky-400" : "text-amber-400/80"
                                )}>
                                    {activity.title}
                                </span>
                            </div>
                            <div className={cn(
                                "text-[11px] leading-relaxed p-3 rounded-xl border backdrop-blur-md shadow-2xl transition-all",
                                activity.type === 'error' ? "text-red-300 bg-red-500/5 border-red-500/20" :
                                    activity.type === 'thinking' ? "text-sky-100/90 bg-sky-500/5 border-sky-500/10" :
                                        "text-zinc-300 bg-white/[0.02] border-white/5"
                            )}>
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        code: ({ node, className, children, ...props }: any) => {
                                            const match = /language-(\w+)/.exec(className || '');
                                            const codeString = String(children).replace(/\n$/, '');
                                            if (!match && !codeString.includes('\n')) {
                                                return <code className="bg-white/10 px-1 py-0.5 rounded text-sky-400 font-mono" {...props}>{children}</code>;
                                            }
                                            return <CodeBlock language={match?.[1] || 'text'} code={codeString} />;
                                        },
                                        p: ({ node, ...props }: any) => <p {...props} className="mb-2 last:mb-0" />,
                                        ul: ({ node, ...props }: any) => <ul {...props} className="list-disc pl-4 mb-2 space-y-1" />,
                                    }}
                                >
                                    {(() => {
                                        // Auto-format JSON strings in activities
                                        const trimmed = activity.message.trim();
                                        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                                            try {
                                                const parsed = JSON.parse(trimmed);
                                                return "```json\n" + JSON.stringify(parsed, null, 2) + "\n```";
                                            } catch (e) {
                                                return activity.message;
                                            }
                                        }
                                        return activity.message;
                                    })()}
                                </ReactMarkdown>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const AgentStepBadge = ({ tool, status }: { tool: string, status: 'executing' | 'done' | 'failed' }) => {
    return (
        <div className="mb-6 animate-in fade-in slide-in-from-left-4 duration-700">
            <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.6)] animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Neural Execution</span>
            </div>

            <div className={cn(
                "inline-flex items-center gap-4 px-5 py-3 rounded-2xl border transition-all shadow-2xl backdrop-blur-3xl",
                status === 'executing' ? "bg-amber-500/10 border-amber-500/30 text-amber-300 animate-[agentic-glow_3s_infinite]" :
                    status === 'done' ? "bg-[color:var(--card)] border-[color:var(--border)] text-foreground/90" :
                        "bg-red-500/10 border-red-500/30 text-red-300"
            )}>
                <div className={cn(
                    "p-2 rounded-xl bg-foreground/5 border border-[color:var(--border)] shadow-inner",
                    status === 'executing' ? "text-amber-400" : status === 'done' ? "text-cyan-400" : "text-red-400"
                )}>
                    {status === 'executing' ? <Loader2 size={16} className="animate-spin" /> :
                        status === 'done' ? <Zap size={16} fill="currentColor" /> : <X size={16} />}
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground/30 font-black uppercase tracking-[0.2em] leading-none mb-1.5">Action Dispatched</span>
                    <span className="text-[13px] font-mono font-black text-white tracking-tight">
                        {tool.replace(/_/g, ' ')}
                    </span>
                </div>
            </div>
        </div>
    );
};

const MessageBubble = ({
    msg,
    attachedFiles,
    showThinking,
    onApprove,
    setInput,
    setActiveTool
}: {
    msg: any,
    attachedFiles: SelectedFile[],
    showThinking: boolean,
    onApprove: (jobId?: string) => void,
    setInput: (s: string) => void,
    setActiveTool: (s: string | null) => void
}) => {
    // Helper to determine file type for icons
    const fileMeta = (() => {
        const file = msg?.toolResult?.file;
        if (file?.name) return { name: file.name as string, type: file.type as string | undefined };
        if (msg?.toolResult?.fileName) return { name: msg.toolResult.fileName as string, type: msg.toolResult.fileName.split('.').pop()?.toLowerCase() };
        if (msg?.toolArgs?.filename) return { name: msg.toolArgs.filename as string, type: msg.toolArgs.filename.split('.').pop()?.toLowerCase() };
        if (msg?.toolArgs?.fileId && typeof msg.toolArgs.fileId === 'string' && msg.toolArgs.fileId.includes('.')) {
            return { name: msg.toolArgs.fileId as string, type: msg.toolArgs.fileId.split('.').pop()?.toLowerCase() };
        }
        return null;
    })();

    const FileIcon = fileMeta?.type?.includes('pdf') ? FileText
        : (fileMeta?.type?.includes('png') || fileMeta?.type?.includes('jpg') || fileMeta?.type?.includes('jpeg') || fileMeta?.type?.includes('image')) ? ImageIcon
            : (fileMeta?.type?.includes('html') ? Layout : FileText);

    const isUser = msg.role === 'user';
    const isApproval = msg.toolResult?.requiresApproval && !msg.toolResult.approved;

    return (
        <div className={cn(
            "flex flex-col gap-2 max-w-[88%] w-full animate-in fade-in slide-in-from-bottom-2 duration-500",
            isUser ? "ml-auto items-end pr-1" : "items-start"
        )}>
            {/* User Attachments */}
            {msg.files && msg.files.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-1 justify-end">
                    {msg.files.map((f: any) => (
                        <div key={f.id} className="flex items-center gap-1.5 px-2 py-1 bg-foreground/5 rounded-lg text-[10px] text-foreground/60 border border-[color:var(--border)]">
                            {f.type === 'pdf' ? <FileText size={10} /> : <ImageIcon size={10} />}
                            <span className="truncate max-w-[150px]">{f.name}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* AI Thinking & Trace */}
            <div className="relative pl-6 border-l border-[color:var(--border)] space-y-2">
                {!isUser && showThinking && msg.thinking && (
                    <ThinkingProcess content={msg.thinking} />
                )}

                {!isUser && msg.toolUsed && (
                    <AgentStepBadge tool={msg.toolUsed} status="done" />
                )}
            </div>

            <div className={cn(
                "relative group/msg transition-all duration-500 rounded-[2rem] p-0 overflow-hidden shadow-3xl",
                isUser
                    ? "bg-gradient-to-br from-sky-500 via-emerald-500 to-teal-400 text-white rounded-tr-none border border-white/20"
                    : "bg-[color:var(--card)] border border-[color:var(--border)] text-foreground/90 rounded-tl-none backdrop-blur-3xl"
            )}>
                {/* Immersive background glow for AI messages */}
                {!isUser && (
                    <div className="absolute inset-0 bg-gradient-to-tr from-sky-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-1000 pointer-events-none" />
                )}
                {/* Message Content */}
                <div className={cn("px-6 py-5 text-[14px] leading-[1.8] tracking-tight",
                    isUser ? "text-white/95 font-medium" : "text-foreground/90 font-normal")}>
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            table: ({ node, ...props }: any) => (
                                <div className="table-container my-6 overflow-x-auto rounded-[1rem] border border-white/10 bg-black/40 shadow-2xl">
                                    <table {...props} className="text-[12px] w-full border-collapse" />
                                </div>
                            ),
                            thead: ({ node, ...props }: any) => <thead {...props} className="bg-foreground/5 text-muted-foreground/40 uppercase text-[10px] font-bold tracking-widest border-b border-[color:var(--border)]" />,
                            th: ({ node, ...props }: any) => <th {...props} className="px-5 py-3 text-left" />,
                            td: ({ node, ...props }: any) => <td {...props} className="px-5 py-3 border-t border-[color:var(--border)]" />,
                            a: ({ node, ...props }: any) => (
                                <a {...props} className="text-sky-400 hover:text-sky-300 underline underline-offset-4 decoration-sky-500/30 font-medium transition-colors" target="_blank" rel="noopener noreferrer" />
                            ),
                            code: ({ node, className, children, ...props }: any) => {
                                const match = /language-(\w+)/.exec(className || '');
                                const codeString = String(children).replace(/\n$/, '');
                                const isInline = !match && !codeString.includes('\n');

                                if (isInline) {
                                    return (
                                        <code className="bg-white/10 px-1.5 py-0.5 rounded-md font-mono text-[11px] text-sky-300 border border-white/5 mx-0.5" {...props}>
                                            {children}
                                        </code>
                                    );
                                }

                                return (
                                    <CodeBlock
                                        language={match?.[1] || 'text'}
                                        code={codeString}
                                    />
                                );
                            },
                            p: ({ node, ...props }: any) => <p {...props} className="mb-5 last:mb-0 opacity-90" />,
                            ul: ({ node, ...props }: any) => <ul {...props} className="list-none pl-1 mb-5 space-y-2.5" />,
                            ol: ({ node, ...props }: any) => <ol {...props} className="list-none pl-1 mb-5 space-y-2.5" />,
                            li: ({ node, ...props }: any) => {
                                const isInsideOl = node.parent?.tagName === 'ol';
                                const index = node.parent?.children.indexOf(node) + 1;
                                return (
                                    <li {...props} className="flex items-start gap-4">
                                        <div className="mt-2 flex-shrink-0 flex items-center justify-center">
                                            {isInsideOl ? (
                                                <span className="text-[10px] font-black text-sky-400/70 w-5 h-5 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                                                    {index}
                                                </span>
                                            ) : (
                                                <div className="w-1.5 h-1.5 rounded-full bg-sky-500/40 border border-sky-500/20" />
                                            )}
                                        </div>
                                        <div className="flex-1 opacity-90">{props.children}</div>
                                    </li>
                                );
                            },
                            h1: ({ node, ...props }: any) => <h1 {...props} className="text-xl font-black text-white mb-4 mt-8 pb-3 border-b border-white/10 tracking-tight" />,
                            h2: ({ node, ...props }: any) => <h2 {...props} className="text-lg font-bold text-white mb-3 mt-8 tracking-tight flex items-center gap-2 before:w-1 before:h-4 before:bg-sky-500 before:rounded-full" />,
                            h3: ({ node, ...props }: any) => <h3 {...props} className="text-[15px] font-bold text-white mb-2 mt-6 tracking-tight" />,
                            blockquote: ({ node, ...props }: any) => (
                                <blockquote {...props} className="border-l-4 border-sky-500/40 pl-6 py-1 italic text-white/50 my-6 bg-white/[0.02] rounded-r-xl" />
                            ),
                        }}
                    >
                        {normalizeMarkdown(msg.content)}
                    </ReactMarkdown>

                    {/* Tool Result Preview */}
                    {!isUser && msg.toolUsed && (
                        <div className="pt-2 border-t border-white/5 mt-4">
                            <ToolResultPreview tool={msg.toolUsed} result={msg.toolResult} />
                        </div>
                    )}

                    {/* File Meta */}
                    {!isUser && fileMeta && (
                        <div className="mt-3 flex items-center gap-2 text-[10px] text-white/40 bg-white/5 p-2 rounded-lg inline-flex">
                            <FileIcon size={12} className="text-sky-300" />
                            <span className="truncate">{fileMeta.name}</span>
                        </div>
                    )}
                </div>

                {/* Footer / Actions */}
                {!isUser && (
                    <div className="px-3 py-2 bg-black/20 border-t border-white/5 flex items-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(msg.content);
                                toast.success('Copied!');
                            }}
                            className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors"
                            title="Copy Message"
                        >
                            <Copy size={12} />
                        </button>

                        {isApproval && (
                            <button
                                onClick={() => onApprove(msg.toolResult?.jobId)}
                                className="ml-auto flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg text-[10px] text-emerald-400 border border-emerald-500/20 animate-pulse transition-all"
                            >
                                <Check size={12} />
                                <span className="font-bold">Approve Action</span>
                            </button>
                        )}

                        {!isApproval && (
                            <div className="ml-auto text-[10px] text-white/20 font-mono">
                                AI Assistant
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default function AIChat({
    embedded = false,
    activeFile = null,
    activeApp = null,
    headerRight
}: {
    embedded?: boolean;
    activeFile?: WorkspaceFile | null,
    activeApp?: { name: string, path: string } | null,
    headerRight?: React.ReactNode
}) {
    const [isOpen, setIsOpen] = useState(embedded);
    const [view, setView] = useState<'chat' | 'prompts' | 'sessions'>('chat');
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isBackgroundBusy, setIsBackgroundBusy] = useState(false);
    const [backgroundJobLabel, setBackgroundJobLabel] = useState<string | null>(null);
    const [backgroundJobMessage, setBackgroundJobMessage] = useState<string | null>(null);
    const [streamingStatus, setStreamingStatus] = useState<'idle' | 'connecting' | 'streaming' | 'processing'>('idle');
    const [streamProgress, setStreamProgress] = useState(0);
    const [aiActivity, setAiActivity] = useState<string>('');
    const [showActivityPanel, setShowActivityPanel] = useState(false);
    const [activityLog, setActivityLog] = useState<Array<{ time: string; agent: string; message: string }>>([]);
    const [jobStartTime, setJobStartTime] = useState<number | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [messages, setMessages] = useState<{
        id?: string;
        role: 'user' | 'ai';
        content: string;
        files?: SelectedFile[];
        toolUsed?: string;
        toolResult?: any;
        thinking?: string;
        toolArgs?: any;
    }[]>(() => (aiChatStateCache.messages.length ? [...aiChatStateCache.messages] : []));
    const streamSpeedRef = useRef(14);
    const [attachedFiles, setAttachedFiles] = useState<SelectedFile[]>(() => aiChatStateCache.attachedFiles || []);
    const [isDragging, setIsDragging] = useState(false);
    const [prompts, setPrompts] = useState<AIPromptSet[]>([]);
    const [intentRules, setIntentRules] = useState<IntentRule[]>([]);
    const [chatSessions, setChatSessions] = useState<any[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(aiChatStateCache.activeSessionId);
    const [activeSessionTitle, setActiveSessionTitle] = useState(aiChatStateCache.activeSessionTitle || 'New Chat');
    const [workspaceFiles, setWorkspaceFiles] = useState<SelectedFile[]>([]);
    const [isCreatingPrompt, setIsCreatingPrompt] = useState(false);
    const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [newPrompt, setNewPrompt] = useState({
        name: '',
        description: '',
        prompt: '',
        tools: [] as string[],
        workflows: [] as any[],
        triggerKeywords: [] as string[]
    });
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [isPinned, setIsPinned] = useState(false);
    const [activeTool, setActiveTool] = useState<string | null>(null);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
    const [renamingSessionTitle, setRenamingSessionTitle] = useState('');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [pendingDeleteSessionId, setPendingDeleteSessionId] = useState<string | null>(null);
    const [isDeletingSession, setIsDeletingSession] = useState(false);
    const [isEditPreviewOpen, setIsEditPreviewOpen] = useState(false);
    const [editPreviewData, setEditPreviewData] = useState({ fileName: '', content: '' });
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isSwitchingAgent, setIsSwitchingAgent] = useState(false);
    const [currentFolderContext, setCurrentFolderContext] = useState<{ id: string | null, name: string }>(aiChatStateCache.currentFolderContext);
    const [promptHistory, setPromptHistory] = useState<string[]>([]);
    const [activePreviewContext, setActivePreviewContext] = useState<{ id: string, name: string, parentId: string | null } | null>(aiChatStateCache.activePreviewContext);
    const [activeAppContext, setActiveAppContext] = useState<{ name: string; path: string } | null>(aiChatStateCache.activeAppContext);
    const [selectedModel, setSelectedModel] = useState<string>(aiChatStateCache.selectedModel || DEFAULT_CHAT_MODEL);
    const [chatScope, setChatScope] = useState<'workspace' | 'repo'>(aiChatStateCache.activeScope || 'workspace');
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [isUserScrolling, setIsUserScrolling] = useState(false);
    const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
    const [celebration, setCelebration] = useState<{ emoji: string; timestamp: number } | null>(null);
    const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
    const [sessionActivities, setSessionActivities] = useState<any[]>([]);
    const [manualStop, setManualStop] = useState(false);
    const [verbosity, setVerbosity] = useState<'concise' | 'normal' | 'verbose'>('concise');
    const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
    const [activeCommandIndex, setActiveCommandIndex] = useState(0);
    const [dismissedQuestionId, setDismissedQuestionId] = useState<string | null>(null);
    const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
    const [isClearingAll, setIsClearingAll] = useState(false);
    const [showThinkingTrace, setShowThinkingTrace] = useState(true);

    // Sync Props to State
    useEffect(() => {
        if (activeApp) {
            setActiveAppContext(activeApp);
            aiChatStateCache.activeAppContext = activeApp;
            setChatScope('repo');
        }
    }, [activeApp]);

    useEffect(() => {
        if (activeFile) {
            const context = {
                id: activeFile.path || activeFile.id,
                name: activeFile.name,
                parentId: activeFile.parentId || null
            };
            setActivePreviewContext(context);
            aiChatStateCache.activePreviewContext = context;
        }
    }, [activeFile]);

    // Calculate active wizard state
    const activeQuestions = useMemo(() => {
        // Find the most recent message from AI
        const lastAiMessage = [...messages].reverse().find(m => m.role === 'ai');

        // Check if it used 'ask_questions'
        if (lastAiMessage && lastAiMessage.toolUsed === 'ask_questions' && lastAiMessage.toolResult) {
            // Check if user has already replied AFTER this message
            const aiMsgIndex = messages.findIndex(m => m.id === lastAiMessage.id);
            const subsequentUserMsg = messages.slice(aiMsgIndex + 1).find(m => m.role === 'user');

            if (!subsequentUserMsg && lastAiMessage.id !== dismissedQuestionId) {
                return (lastAiMessage.toolResult.questions || []) as string[];
            }
        }
        return [];
    }, [messages, dismissedQuestionId]);

    const handleQuestionSubmit = async (answers: string[]) => {
        // Format the answers into a single message
        const responseText = `Here are the answers to your questions:\n\n${answers.map((ans, i) => `${i + 1}. ${ans}`).join('\n')}`;
        await sendMessage(responseText);
    };

    // Force open if embedded
    useEffect(() => {
        if (embedded) setIsOpen(true);
    }, [embedded]);

    useEffect(() => {
        aiChatStateCache.messages = messages;
    }, [messages]);

    useEffect(() => {
        aiChatStateCache.attachedFiles = attachedFiles;
    }, [attachedFiles]);

    useEffect(() => {
        aiChatStateCache.activeSessionId = activeSessionId;
    }, [activeSessionId]);

    useEffect(() => {
        aiChatStateCache.activeSessionTitle = activeSessionTitle;
    }, [activeSessionTitle]);

    useEffect(() => {
        aiChatStateCache.currentFolderContext = currentFolderContext;
    }, [currentFolderContext]);

    useEffect(() => {
        aiChatStateCache.activePreviewContext = activePreviewContext;
    }, [activePreviewContext]);

    useEffect(() => {
        aiChatStateCache.activeAppContext = activeAppContext;
    }, [activeAppContext]);

    useEffect(() => {
        aiChatStateCache.selectedModel = selectedModel;
    }, [selectedModel]);

    useEffect(() => {
        if (!activeSessionId) return;
        const savedScope = aiChatStateCache.scopeBySession[activeSessionId];
        if (savedScope && savedScope !== chatScope) {
            setChatScope(savedScope);
        }
    }, [activeSessionId, chatScope]);

    useEffect(() => {
        aiChatStateCache.activeScope = chatScope;
        if (activeSessionId) {
            aiChatStateCache.scopeBySession[activeSessionId] = chatScope;
        }
    }, [chatScope, activeSessionId]);

    // Listen for preview changes
    useEffect(() => {
        const handlePreviewChange = (e: any) => {
            const file = e.detail;
            if (file) {
                setActivePreviewContext({ id: file.id, name: file.name, parentId: file.parentId });
            } else {
                setActivePreviewContext(null);
            }
        };
        window.addEventListener('preview-selection-changed', handlePreviewChange);
        return () => window.removeEventListener('preview-selection-changed', handlePreviewChange);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const recentMessages = messages
            .filter(m => m.content && m.content.trim().length > 0)
            .slice(-5)
            .map(m => ({ role: m.role, content: m.content }));

        window.dispatchEvent(new CustomEvent('chat-context-updated', {
            detail: { messages: recentMessages }
        }));
    }, [messages]);

    const scrollRef = useRef<HTMLDivElement>(null);
    const lastBackgroundBusyRef = useRef(false);
    const lastJobStatusRef = useRef<{ id?: string; updatedAt?: number; status?: string }>({});
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isNearBottomRef = useRef(true);

    const resolveToolBadge = (toolUsed?: string) => {
        if (!toolUsed) return null;
        if (toolUsed === 'workflow') {
            return {
                label: 'Workflow',
                type: 'workflow' as const
            };
        }
        if (toolUsed.startsWith('workflow:')) {
            const name = toolUsed.replace(/^workflow:/, '').trim();
            return {
                label: name || 'Workflow',
                type: 'workflow' as const
            };
        }

        const toolMeta = TOOL_LIBRARY[toolUsed];
        const label = toolMeta?.name || toolUsed.replace(/_/g, ' ');
        return {
            label,
            type: 'action' as const
        };
    };

    // Initial load
    useEffect(() => {
        if (isOpen) {
            refreshData();
            // Cleanup: Ensure no stale jobs are pending on load/mount
            cancelAllAgentJobs().catch(e => console.error("Failed to cleanup jobs on load", e));
        }
    }, [isOpen]);

    const refreshData = async () => {
        const [p, rules, sessions, files] = await Promise.all([
            getPrompts(),
            getIntentRules(),
            getChatSessions(),
            getWorkspaceFiles()
        ]);
        setPrompts(p);
        setIntentRules(rules);
        setChatSessions(sessions || []);
        setWorkspaceFiles((files || []) as SelectedFile[]);
    };

    const refreshAgentStatus = async (sessionId: string) => {
        const [res, activityRes] = await Promise.all([
            getChatSessionAgentStatus(sessionId),
            getAgentActivitiesForSession(sessionId)
        ]);

        if (activityRes.success) {
            setSessionActivities(activityRes.activities);
        }

        if (res.success) {
            if (manualStop) {
                setIsBackgroundBusy(false);
                setBackgroundJobLabel(null);
                return { busy: false, latestJob: res.latestJob };
            }

            setIsBackgroundBusy(!!res.busy);
            // Use latest activity title if available, otherwise fall back to job type
            const label = res.latestActivity?.title || res.latestJob?.type || null;
            setBackgroundJobLabel(label);
            const message = (res.latestActivity as any)?.message || res.latestJob?.error || null;
            setBackgroundJobMessage(message);

            // Add to activity log if there's new activity
            if (message && label) {
                setActivityLog(prev => {
                    const newEntry = {
                        time: new Date().toLocaleTimeString(),
                        agent: label,
                        message: message
                    };
                    // Only add if it's different from the last entry
                    if (prev.length === 0 || prev[prev.length - 1].message !== message) {
                        return [...prev.slice(-9), newEntry]; // Keep last 10 entries
                    }
                    return prev;
                });
            }

            return { busy: !!res.busy, latestJob: res.latestJob };
        }
        setIsBackgroundBusy(false);
        setBackgroundJobLabel(null);
        setBackgroundJobMessage(null);
        return { busy: false, latestJob: null };
    };

    const syncSessionMessages = async (sessionId: string) => {
        const session = await getChatSession(sessionId);
        if (!session) return;

        const fileIds = Array.from(new Set(session.messages.flatMap(m => m.fileIds || [])));
        const resolvedFiles = await resolveFilesByIds(fileIds);

        setMessages(session.messages.map(m => {
            const isUser = m.role === 'user';
            const rawContent = m.content || '';
            const extracted = !isUser ? extractThinkingFromText(rawContent) : { cleanText: rawContent, thinking: undefined as string | undefined };
            const content = !isUser ? (extracted.cleanText || rawContent) : rawContent;
            const thinking = (m as any).thinking || extracted.thinking || undefined;

            return {
                id: m.id,
                role: isUser ? 'user' as const : 'ai' as const,
                content,
                files: (m.fileIds?.length ? resolvedFiles.filter(f => m.fileIds.includes(f.id)) : undefined),
                toolUsed: m.toolUsed || undefined,
                toolResult: (m as any).toolResult || undefined,
                toolArgs: (m as any).toolArgs || undefined,
                thinking
            };
        }));
    };

    const refreshPrompts = async () => {
        const p = await getPrompts();
        setPrompts(p);
    };

    useEffect(() => {
        if (!activeSessionId || !isOpen) {
            setIsBackgroundBusy(false);
            setBackgroundJobLabel(null);
            return;
        }

        let cancelled = false;
        let pollInterval = 2000; // Start at 2 seconds
        let idleCount = 0;
        let timeoutId: NodeJS.Timeout;

        const tick = async () => {
            if (cancelled) return;
            const status = await refreshAgentStatus(activeSessionId);
            const wasBusy = lastBackgroundBusyRef.current;
            const isBusy = !!status?.busy;
            const latestJob = status?.latestJob as { id?: string; status?: string; updatedAt?: string } | null;
            const latestUpdatedAt = latestJob?.updatedAt ? new Date(latestJob.updatedAt).getTime() : undefined;
            const hasNewJobState = !!latestJob?.id && (
                lastJobStatusRef.current.id !== latestJob.id ||
                (latestUpdatedAt && lastJobStatusRef.current.updatedAt !== latestUpdatedAt)
            );

            if (hasNewJobState && (latestJob?.status === 'succeeded' || latestJob?.status === 'failed')) {
                await syncSessionMessages(activeSessionId);
                toast.success('Background agent finished. You can continue.');
            }

            if (wasBusy && !isBusy) {
                await syncSessionMessages(activeSessionId);
                toast.success('Background agent finished. You can continue.');
                setJobStartTime(null);
                setElapsedTime(0);
            }

            // Start timer when job begins
            if (!wasBusy && isBusy) {
                setJobStartTime(Date.now());
            }

            lastBackgroundBusyRef.current = isBusy;
            if (latestJob?.id) {
                lastJobStatusRef.current = {
                    id: latestJob.id,
                    status: latestJob.status,
                    updatedAt: latestUpdatedAt
                };
            }

            // Adaptive polling: fast when busy, slow when idle
            if (isBusy || isLoading) {
                pollInterval = 1500; // Poll faster when active (1.5s)
                idleCount = 0;
            } else {
                idleCount++;
                // Exponential backoff: 2s → 4s → 8s (max)
                pollInterval = Math.min(2000 * Math.pow(2, Math.min(idleCount, 2)), 8000);
            }

            // Schedule next tick
            if (!cancelled) {
                timeoutId = setTimeout(tick, pollInterval);
            }
        };

        tick();

        return () => {
            cancelled = true;
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [activeSessionId, isOpen, manualStop, isLoading]);

    // Timer for elapsed time during background jobs
    useEffect(() => {
        if (!jobStartTime) return;

        const updateElapsed = () => {
            setElapsedTime(Math.floor((Date.now() - jobStartTime) / 1000));
        };

        updateElapsed();
        const timer = setInterval(updateElapsed, 1000);

        return () => clearInterval(timer);
    }, [jobStartTime]);

    // Listen for set-active-app event from FileManager
    useEffect(() => {
        const handleSetActiveApp = async (event: CustomEvent) => {
            const { name, path } = event.detail;

            // Find the folder in workspace files
            let appFolder = workspaceFiles.find(f =>
                f.type === 'folder' &&
                (f.name === name || f.storagePath === path)
            );

            // If not found in workspace files, create a virtual folder entry for repo apps
            if (!appFolder) {
                appFolder = {
                    id: `repo-app-${name}`,
                    name: name,
                    type: 'folder',
                    storagePath: path,
                    parentId: null,
                    createdAt: new Date(),
                    updatedAt: new Date()
                } as any;
            }

            // Add folder to attached files if not already attached
            setAttachedFiles(prev => {
                if (prev.find(f => f.id === appFolder!.id)) {
                    toast.info(`${name} is already in context`);
                    return prev;
                }
                toast.success(`Added ${name} to chat context`, {
                    description: 'The AI will now work within this app folder'
                });
                return [...prev, {
                    id: appFolder!.id,
                    name: appFolder!.name,
                    type: 'folder',
                    parentId: appFolder!.parentId,
                    storagePath: path
                }];
            });

            setChatScope('repo');

            // Also add a system message to the input to inform the AI
            setInput(prev => {
                const systemMsg = `[SYSTEM: Active app selected: "${name}" at path "${path}".

                            CRITICAL: This is a REPO APP located at "apps/${path}/" (NOT the main TaskFlow codebase).
                            When creating/editing files or running commands for this app, you MUST:
                            1. Use the full path starting with "apps/${path}/" for ALL file operations and terminal commands
                            2. For terminal commands (npm, vite, etc), use cwd: "apps/${path}"
                            3. This is a SEPARATE application with its own src/, public/, and package.json
                            4. DO NOT edit files in the main TaskFlow src/ directory
                            5. ALWAYS check if the directory exists before running commands

                            Example correct paths:
                            - File operations: "apps/${path}/src/App.tsx", "apps/${path}/package.json"
                            - Terminal cwd: "apps/${path}"
                            - List directory: "apps/${path}/src"

                            WRONG: cwd: "${path}" or path: "${path}/src/App.tsx"
                            CORRECT: cwd: "apps/${path}" or path: "apps/${path}/src/App.tsx"

                            Keep ALL edits and file operations within this app unless user explicitly says otherwise.]\n\n`;
                // Only add if not already present
                if (prev.includes('[SYSTEM: Active app selected:')) {
                    // Replace existing system message
                    return prev.replace(/\[SYSTEM: Active app selected:[\s\S]*?\]\n\n/, systemMsg);
                }
                return systemMsg + prev;
            });
        };

        window.addEventListener('set-active-app', handleSetActiveApp as EventListener);

        return () => {
            window.removeEventListener('set-active-app', handleSetActiveApp as EventListener);
        };
    }, [workspaceFiles]);


    const buildSessionTitle = (text: string) => {
        const trimmed = text.trim().replace(/\s+/g, ' ');
        if (!trimmed) return 'New Chat';
        return trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed;
    };

    const resolveFilesByIds = async (ids: string[]) => {
        const sourceFiles = workspaceFiles.length > 0 ? workspaceFiles : ((await getWorkspaceFiles()) as any[] as SelectedFile[]);
        const fileMap = new Map(sourceFiles.map(f => [f.id, f]));
        return ids.map(id => fileMap.get(id)).filter(Boolean) as SelectedFile[];
    };

    const genMsgId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const MAX_CONTEXT_FILE_IDS = 50;

    const expandFileIdsWithFolders = async (ids: string[]) => {
        if (!ids.length) return [] as string[];

        const sourceFiles = workspaceFiles.length > 0 ? workspaceFiles : ((await getWorkspaceFiles()) as any[] as SelectedFile[]);
        const fileMap = new Map(sourceFiles.map(f => [f.id, f]));
        const childrenMap = new Map<string, string[]>();

        sourceFiles.forEach(file => {
            if (file.parentId) {
                const list = childrenMap.get(file.parentId) || [];
                list.push(file.id);
                childrenMap.set(file.parentId, list);
            }
        });

        const resolved = new Set<string>();
        const queue = Array.from(new Set(ids));

        while (queue.length && resolved.size < MAX_CONTEXT_FILE_IDS) {
            const id = queue.shift();
            if (!id) continue;
            const file = fileMap.get(id);
            if (!file) continue;

            if (file.type === 'folder') {
                const children = childrenMap.get(file.id) || [];
                children.forEach(childId => queue.push(childId));
            } else {
                resolved.add(file.id);
            }
        }

        return Array.from(resolved).slice(0, MAX_CONTEXT_FILE_IDS);
    };

    const openSession = async (sessionId: string) => {
        const session = await getChatSession(sessionId);
        if (!session) return;

        setActiveSessionId(session.id);
        setActiveSessionTitle(session.title || 'New Chat');

        const fileIds = Array.from(new Set(session.messages.flatMap(m => m.fileIds || [])));
        const resolvedFiles = await resolveFilesByIds(fileIds);

        setAttachedFiles(resolvedFiles);
        setMessages(session.messages.map(m => {
            const isUser = m.role === 'user';
            const rawContent = m.content || '';
            const extracted = !isUser ? extractThinkingFromText(rawContent) : { cleanText: rawContent, thinking: undefined as string | undefined };
            const content = !isUser ? (extracted.cleanText || rawContent) : rawContent;
            const thinking = (m as any).thinking || extracted.thinking || undefined;

            return {
                id: m.id,
                role: isUser ? 'user' as const : 'ai' as const,
                content,
                files: (m.fileIds?.length ? resolvedFiles.filter(f => m.fileIds.includes(f.id)) : undefined),
                toolUsed: m.toolUsed || undefined,
                toolResult: (m as any).toolResult || undefined,
                toolArgs: (m as any).toolArgs || undefined,
                thinking
            };
        }));

        setView('chat');
        setInput('');
        setHistoryIndex(-1);
        setActiveTool(null);
    };

    const startNewChat = async () => {
        const res = await createChatSession('New Chat');
        if (!res.success || !res.session) {
            toast.error(res.message || 'Failed to create chat session');
            return;
        }
        setActiveSessionId(res.session.id);
        setActiveSessionTitle(res.session.title || 'New Chat');
        setMessages([]);
        setAttachedFiles([]);
        setInput('');
        setHistoryIndex(-1);
        setView('chat');
        setChatSessions(prev => [res.session, ...prev]);
    };

    const handleRenameSession = async (sessionId: string) => {
        if (!renamingSessionTitle.trim()) {
            toast.error('Title cannot be empty');
            return;
        }
        await updateChatSessionTitle(sessionId, renamingSessionTitle);
        setChatSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: renamingSessionTitle } : s));
        if (activeSessionId === sessionId) {
            setActiveSessionTitle(renamingSessionTitle);
        }
        setRenamingSessionId(null);
        setRenamingSessionTitle('');
        toast.success('Chat renamed');
    };

    const handleDeleteSession = (sessionId: string) => {
        setPendingDeleteSessionId(sessionId);
        setIsDeleteModalOpen(true);
    };

    const confirmDeleteSession = async () => {
        if (!pendingDeleteSessionId) return;
        setIsDeletingSession(true);
        try {
            await deleteChatSession(pendingDeleteSessionId);
            setChatSessions(prev => prev.filter(s => s.id !== pendingDeleteSessionId));
            if (activeSessionId === pendingDeleteSessionId) {
                setActiveSessionId(null);
                setMessages([]);
                setActiveSessionTitle('New Chat');
            }
            toast.success('Chat deleted');
        } finally {
            setIsDeletingSession(false);
            setIsDeleteModalOpen(false);
            setPendingDeleteSessionId(null);
        }
    };

    const confirmClearAllSessions = async () => {
        setIsClearingAll(true);
        try {
            await deleteAllChatSessions();
            setChatSessions([]);
            setActiveSessionId(null);
            setMessages([]);
            setActiveSessionTitle('New Chat');
            toast.success('All chats cleared');
        } catch (error) {
            toast.error('Failed to clear chats');
        } finally {
            setIsClearingAll(false);
            setIsClearAllModalOpen(false);
        }
    };

    const handleStopAgents = async () => {
        try {
            await cancelAllAgentJobs();
            setIsBackgroundBusy(false);
            setBackgroundJobLabel(null);
            setBackgroundJobMessage(null);
            toast.success('All agent activities stopped.');
        } catch (error) {
            toast.error('Failed to stop agents');
        }
    };

    const renderSessionsView = () => (
        <div className="h-full p-6 space-y-4 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-[10px] font-black uppercase text-white/30 tracking-widest">Chats</h4>
                <div className="flex items-center gap-2">
                    {chatSessions.length > 0 && (
                        <button
                            onClick={() => setIsClearAllModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-lg transition-all text-[10px] font-bold uppercase tracking-wider"
                        >
                            <Trash2 size={12} />
                            Clear All
                        </button>
                    )}
                    <button
                        onClick={startNewChat}
                        className="p-2 bg-sky-600 hover:bg-sky-500 rounded-lg text-white transition-all shadow-lg shadow-sky-500/30 active:scale-95"
                        title="New Chat"
                    >
                        <Plus size={16} />
                    </button>
                </div>
            </div>
            <div className="space-y-3">
                {chatSessions.length === 0 && (
                    <div className="text-xs text-white/40">No previous chats yet.</div>
                )}
                {chatSessions.map((session) => {
                    const preview = session.messages?.[0]?.content || 'No messages yet';
                    const messageCount = session._count?.messages ?? 0;
                    const isActive = session.id === activeSessionId;
                    const isRenaming = session.id === renamingSessionId;

                    return (
                        <div
                            key={session.id}
                            className={cn(
                                "w-full p-4 rounded-2xl border transition-all group",
                                isActive ? "bg-sky-600/10 border-sky-500/30" : "bg-white/5 border-white/5 hover:border-white/10"
                            )}
                        >
                            {isRenaming ? (
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={renamingSessionTitle}
                                        onChange={(e) => setRenamingSessionTitle(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleRenameSession(session.id);
                                            if (e.key === 'Escape') {
                                                setRenamingSessionId(null);
                                                setRenamingSessionTitle('');
                                            }
                                        }}
                                        placeholder="Enter new title..."
                                        className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                                        autoFocus
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleRenameSession(session.id)}
                                            className="flex-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold transition-all"
                                        >
                                            Save
                                        </button>
                                        <button
                                            onClick={() => {
                                                setRenamingSessionId(null);
                                                setRenamingSessionTitle('');
                                            }}
                                            className="flex-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg text-[10px] font-bold transition-all"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <button
                                            onClick={() => openSession(session.id)}
                                            className="flex-1 text-left"
                                        >
                                            <span className="text-[12px] font-bold text-white truncate">{session.title || 'New Chat'}</span>
                                        </button>
                                        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => {
                                                    setRenamingSessionId(session.id);
                                                    setRenamingSessionTitle(session.title || 'New Chat');
                                                }}
                                                className="p-1.5 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white rounded-lg transition-all"
                                                title="Rename"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteSession(session.id)}
                                                className="p-1.5 bg-red-500/10 hover:bg-red-500 text-red-300 hover:text-white rounded-lg transition-all"
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] text-white/40 leading-relaxed line-clamp-2 flex-1">
                                            {preview}
                                        </p>
                                        <span className="text-[10px] text-white/40 ml-2 shrink-0">{messageCount}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );

    // Smart auto-scroll - only when user is at bottom
    useEffect(() => {
        if (scrollRef.current && shouldAutoScroll && isNearBottomRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading, isPinned, view, sessionActivities, shouldAutoScroll]);

    // Check if user is near bottom on mount
    useEffect(() => {
        const checkPosition = () => {
            if (scrollRef.current) {
                const { scrollHeight, scrollTop, clientHeight } = scrollRef.current;
                const isNear = scrollHeight - scrollTop - clientHeight < 150;
                isNearBottomRef.current = isNear;
            }
        };
        checkPosition();
    }, []);

    const streamAssistantMessage = (content: string, meta: { toolUsed?: string; toolResult?: any; thinking?: string; toolArgs?: any }) => {
        const messageId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

        setMessages(prev => [...prev, {
            id: messageId,
            role: 'ai',
            content: '',
            toolUsed: meta.toolUsed,
            toolResult: meta.toolResult,
            thinking: meta.thinking,
            toolArgs: meta.toolArgs
        }]);

        return new Promise<void>((resolve) => {
            let cursor = 0;
            const step = () => {
                cursor = Math.min(content.length, cursor + 4);
                setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: content.slice(0, cursor) } : m));

                if (cursor < content.length) {
                    setTimeout(step, streamSpeedRef.current);
                    return;
                }

                resolve();
            };

            if (content.length > 0) {
                step();
            } else {
                resolve();
            }
        });
    };

    const createStreamingMessage = (meta: { toolUsed?: string; toolResult?: any; thinking?: string; toolArgs?: any } = {}) => {
        const messageId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

        setMessages(prev => [...prev, {
            id: messageId,
            role: 'ai',
            content: '',
            toolUsed: meta.toolUsed,
            toolResult: meta.toolResult,
            thinking: meta.thinking,
            toolArgs: meta.toolArgs
        }]);

        return messageId;
    };

    const updateStreamingContent = (id: string, content: string) => {
        setMessages(prev => prev.map(m => m.id === id ? { ...m, content } : m));
    };

    const updateStreamingMeta = (id: string, meta: { toolUsed?: string; toolResult?: any; thinking?: string; toolArgs?: any }) => {
        setMessages(prev => prev.map(m => m.id === id ? { ...m, ...meta } : m));
    };

    const sendMessage = async (text: string) => {
        setManualStop(false);
        if (isBackgroundBusy) {
            // Non-blocking warning/toast instead of return
            // toast.message('Background agent is active. You can continue chatting.');
        }
        if (!text.trim() && attachedFiles.length === 0) return;

        setIsLoading(true);

        const userMsg = { id: genMsgId(), role: 'user' as const, content: text, files: [...attachedFiles] };
        setMessages(prev => [...prev, userMsg]);
        setPromptHistory(prev => [text, ...prev]);
        setInput('');
        setHistoryIndex(-1);
        setActiveTool(null);
        // DON'T clear attachedFiles - keep them for context

        let sessionId = activeSessionId;

        try {
            if (!sessionId) {
                const title = buildSessionTitle(text);
                const sessionRes = await createChatSession(title);
                if (!sessionRes.success || !sessionRes.session) {
                    toast.error(sessionRes.message || 'Failed to create chat session');
                    setIsLoading(false);
                    return;
                }
                sessionId = sessionRes.session.id;
                setActiveSessionId(sessionId);
                setActiveSessionTitle(sessionRes.session.title || title);
                setChatSessions(prev => [sessionRes.session, ...prev]);
                await refreshAgentStatus(sessionId);
            } else if (activeSessionTitle === 'New Chat') {
                const title = buildSessionTitle(text);
                await updateChatSessionTitle(sessionId, title);
                setActiveSessionTitle(title);
                setChatSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title } : s));
            }

            // Optimistic update done above

            if (sessionId) {
                await addChatMessage(sessionId, 'user', userMsg.content, attachedFiles.map(f => f.id));
            }

            // Prepare history for Gemini format
            // Prepare history for Gemini format with tool context
            const geminiHistory = messages.map(m => {
                let content = m.content;
                if (m.role === 'ai' && m.toolResult && m.toolResult.success !== false) {
                    try {
                        let resultStr = '';
                        if (typeof m.toolResult === 'string') resultStr = m.toolResult;
                        else if (m.toolResult.output) resultStr = typeof m.toolResult.output === 'string' ? m.toolResult.output : JSON.stringify(m.toolResult.output);
                        else resultStr = JSON.stringify(m.toolResult);

                        // Truncate extremely long outputs to save context
                        if (resultStr.length > 8000) {
                            resultStr = resultStr.slice(0, 8000) + '... (truncated)';
                        }

                        // Append tool output as a system note in the history
                        if (resultStr && resultStr !== '{ }') {
                            content += `\n\n[System: Tool '${m.toolUsed}' output: ${resultStr}]`;
                        }
                    } catch (e) {
                        // Ignore serialization errors
                    }
                }

                return {
                    role: m.role === 'user' ? 'user' as const : 'model' as const,
                    parts: [{ text: content || ' ' }] // Ensure no empty text parts
                };
            });

            // Collect all file IDs from the entire conversation (including current message)
            const allFileIds = new Set<string>();
            [...messages, userMsg].forEach(msg => {
                if (msg.files) {
                    msg.files.forEach(f => allFileIds.add(f.id));
                }
            });

            const expandedFileIds = await expandFileIdsWithFolders(Array.from(allFileIds));

            // Warn if context is very large
            if (expandedFileIds.length > 30) {
                toast.warning(`Large context detected (${expandedFileIds.length} files). This may cause connection issues.`);
            }

            // Build system context to help AI understand current state
            const systemContext = [];

            // Background job context
            if (isBackgroundBusy && backgroundJobLabel) {
                systemContext.push(`[SYSTEM: Background agent is currently running: "${backgroundJobLabel}"]`);
            }

            systemContext.push(
                chatScope === 'repo'
                    ? '[SYSTEM: Scope set to REPO APPS (apps/*). Prefer edits and commands within apps/; avoid workspace file tools unless explicitly requested.]'
                    : '[SYSTEM: Scope set to FILE MANAGER. Prefer workspace files and IDs; avoid apps/* unless explicitly requested.]'
            );

            if (activeAppContext?.name && activeAppContext?.path) {
                systemContext.push(`[SYSTEM: Active app selected: "${activeAppContext.name}" at path "apps/${activeAppContext.path}". Use "apps/${activeAppContext.path}" as the base path for all file operations and terminal commands (cwd). Keep edits within this app unless user explicitly says otherwise.]`);
            }

            // Folder context
            if (currentFolderContext.name !== 'Root') {
                systemContext.push(`[SYSTEM: User is currently in folder: "${currentFolderContext.name}"]`);
            }

            // File preview context
            if (activePreviewContext) {
                systemContext.push(`[SYSTEM: User is currently PREVIEWING file "${activePreviewContext.name}" (id: ${activePreviewContext.id}). If user says "this file" or "run this", they likely mean this file.]`);
            }

            if (attachedFiles.length > 0) {
                const fileList = attachedFiles
                    .slice(0, 12)
                    .map(file => {
                        const pathInfo = file.storagePath ? `, path: ${file.storagePath}` : '';
                        return `${file.name} (id: ${file.id}${pathInfo})`;
                    })
                    .join('; ');
                systemContext.push(`[SYSTEM: Attached files (${attachedFiles.length}). Use these IDs or names for file tools like view_file/read_file: ${fileList}]`);
            }

            // Terminal/App running hint - based on domain knowledge
            // Note: We can't directly detect terminals from the frontend, but we can provide smart guidance
            // REMOVED: System guidance polluting the context. Moved to backend system instruction if needed.

            const contextMsg = systemContext.length > 0
                ? `${systemContext.join('\\n')}\\n\\n${userMsg.content}`
                : userMsg.content;

            console.log('📤 Sending to AI:', userMsg.content);
            console.log('🧠 System Context:', systemContext.length > 0 ? systemContext : 'None');
            console.log('📎 Files in context:', expandedFileIds.length, 'files');
            console.log('📂 Current Folder:', currentFolderContext.name, currentFolderContext.id);
            let usedStream = false;
            let streamedMessageId: string | null = null;
            let streamedThinking: string | undefined;
            let res: any = null;

            try {
                // Create AbortController with timeout to prevent hanging requests
                const abortController = new AbortController();
                const timeoutId = setTimeout(() => abortController.abort(), 5 * 60 * 1000); // 5 minute timeout

                setStreamingStatus('connecting');
                setAiActivity('Sending request to AI...');

                const streamResponse = await fetch('/api/chat/stream', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: contextMsg,
                        fileIds: expandedFileIds,
                        history: geminiHistory,
                        currentFolder: currentFolderContext.name,
                        currentFolderId: currentFolderContext.id || undefined,
                        sessionId: sessionId || undefined,
                        verbosity: verbosity, // Pass current verbosity setting
                        activeAppName: activeAppContext?.name,
                        activeAppPath: activeAppContext?.path,
                        model: selectedModel
                    }),
                    signal: abortController.signal
                });

                clearTimeout(timeoutId);

                if (!streamResponse.ok || !streamResponse.body) {
                    throw new Error('Streaming unavailable');
                }

                setStreamingStatus('streaming');
                setAiActivity('Receiving response...');

                usedStream = true;
                streamedMessageId = createStreamingMessage();

                const reader = streamResponse.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let accumulated = '';
                let finalMeta: { toolUsed?: string; toolResult?: any; thinking?: string; toolArgs?: any } = {};
                let chunkCount = 0;

                // Add timeout for stream reading to prevent infinite hangs
                const streamTimeout = setTimeout(() => {
                    reader.cancel();
                    throw new Error('Stream reading timeout');
                }, 4 * 60 * 1000); // 4 minute timeout for reading

                try {
                    while (true) {
                        const { value, done } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        const parts = buffer.split('\n\n');
                        buffer = parts.pop() || '';

                        for (const part of parts) {
                            const line = part.split('\n').find(l => l.startsWith('data:'));
                            if (!line) continue;
                            const data = line.replace(/^data:\s*/, '').trim();
                            if (!data) continue;

                            const payload = JSON.parse(data);
                            if (payload.type === 'delta' && typeof payload.text === 'string') {
                                accumulated += payload.text;
                                chunkCount++;
                                setStreamProgress(prev => Math.min(prev + 5, 95));
                                setAiActivity(`Streaming response... (${chunkCount} chunks)`);
                                if (streamedMessageId) {
                                    const { cleanText, thinking } = extractThinkingFromText(accumulated);
                                    if (thinking && thinking !== streamedThinking) {
                                        streamedThinking = thinking;
                                        updateStreamingMeta(streamedMessageId, { thinking });
                                    }
                                    const displayText = cleanText || (thinking ? '' : accumulated);
                                    updateStreamingContent(streamedMessageId, displayText);
                                }
                            }
                            if (payload.type === 'done') {
                                finalMeta = {
                                    toolUsed: payload.toolUsed,
                                    toolResult: payload.toolResult,
                                    thinking: payload.thinking,
                                    toolArgs: payload.toolArgs
                                };
                            }
                            if (payload.type === 'error') {
                                throw new Error(payload.message || 'Streaming failed');
                            }
                        }
                    }
                } finally {
                    clearTimeout(streamTimeout);
                    setStreamingStatus('processing');
                    setAiActivity('Finalizing response...');
                    setStreamProgress(100);
                }

                res = {
                    success: true,
                    text: accumulated,
                    ...finalMeta
                };
            } catch (streamError) {
                const errorMessage = streamError instanceof Error ? streamError.message : String(streamError);
                const isAbortError = errorMessage.includes('abort');
                const isConnectionError = errorMessage.includes('ECONNRESET') || errorMessage.includes('aborted');

                if (isAbortError) {
                    console.warn('⚠️ Request timeout - context may be too large:', streamError);
                    toast.error('Request timed out. Try reducing the number of attached files.');
                } else if (isConnectionError) {
                    console.warn('⚠️ Connection reset - likely due to large context:', streamError);
                    toast.warning('Connection interrupted. Retrying with fallback method...');
                } else {
                    console.warn('⚠️ Stream failed, falling back to direct API:', streamError);
                }

                usedStream = false;

                // Reduce context size for fallback to prevent same error
                const reducedFileIds = expandedFileIds.slice(0, 20); // Limit to 20 files for fallback
                if (reducedFileIds.length < expandedFileIds.length) {
                    toast.info(`Reducing context from ${expandedFileIds.length} to ${reducedFileIds.length} files for retry`);
                }

                res = await chatWithAI(
                    contextMsg,
                    reducedFileIds,
                    geminiHistory,
                    currentFolderContext.name,
                    currentFolderContext.id || undefined,
                    { sessionId: sessionId || undefined, allowToolExecution: false, verbosity: verbosity, model: selectedModel }
                );
                console.log('📥 Fallback chatWithAI response:', JSON.stringify(res, null, 2));
            }
            const normalizedRes = (res && typeof res === 'object')
                ? res
                : { success: false, message: 'AI returned an empty response.' };

            if (typeof (normalizedRes as any).success !== 'boolean') {
                (normalizedRes as any).success = false;
                (normalizedRes as any).message = (normalizedRes as any).message || 'AI returned an empty response.';
            }

            res = normalizedRes;

            console.log('📥 AI Response:', JSON.stringify(res, null, 2));
            console.log('📥 AI Response Text:', res.text);
            console.log('📥 AI Response Success:', res.success);

            if (res.success) {
                // Validate that we have text to display OR a tool/skill was used
                const hasText = res.text && res.text.trim() !== '';
                const hasTool = (res as any).toolUsed || (res as any).toolResult;

                if (!hasText && !hasTool) {
                    console.error('⚠️ AI returned empty response');
                    toast.error('AI returned an empty response');
                    setMessages(prev => [...prev, {
                        id: genMsgId(),
                        role: 'ai',
                        content: 'I apologize, but I encountered an issue generating a response. Please try again.'
                    }]);
                } else {
                    const text = res.text as string;
                    const { cleanText, thinking } = extractThinkingFromText(text);
                    const contentToStream = cleanText || (thinking ? '' : text);

                    if (usedStream && streamedMessageId) {
                        updateStreamingMeta(streamedMessageId, {
                            toolUsed: (res as any).toolUsed,
                            toolResult: (res as any).toolResult,
                            thinking: (res as any).thinking || thinking,
                            toolArgs: (res as any).toolArgs
                        });
                        if (!contentToStream) {
                            updateStreamingContent(streamedMessageId, text);
                        }
                    } else if (contentToStream) {
                        await streamAssistantMessage(contentToStream, {
                            toolUsed: (res as any).toolUsed,
                            toolResult: (res as any).toolResult,
                            thinking: (res as any).thinking || thinking,
                            toolArgs: (res as any).toolArgs
                        });
                    } else {
                        setMessages(prev => [...prev, {
                            id: genMsgId(),
                            role: 'ai',
                            content: text,
                            toolUsed: (res as any).toolUsed,
                            toolResult: (res as any).toolResult,
                            thinking: (res as any).thinking || thinking,
                            toolArgs: (res as any).toolArgs
                        }]);
                    }

                    // Auto-open preview for HTML files
                    if ((res as any).toolUsed === 'create_html_file' && (res as any).toolResult?.success && (res as any).toolResult?.file) {
                        console.log('🖼️ Auto-opening preview for HTML file');
                        const createdFile = (res as any).toolResult.file;
                        window.dispatchEvent(new CustomEvent('open-preview-tab', { detail: createdFile }));

                        // Auto-register file in context (User Request)
                        setAttachedFiles(prev => {
                            if (prev.find(f => f.id === createdFile.id)) return prev;
                            toast.success(`Registered ${createdFile.name} in context`);
                            return [...prev, { id: createdFile.id, name: createdFile.name, type: createdFile.type || 'html', parentId: createdFile.parentId }];
                        });
                    }

                    // Auto-open live preview for local URLs mentioned in text (dev servers)
                    // Matches http://localhost:PORT or http://*.example.com (for potential internal domains)
                    const urlMatch = res.text?.match(/http:\/\/(localhost:\d+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(\/[^\s]*)?/);
                    if (urlMatch && !res.text?.includes('http://preview-not-ready')) {
                        const url = urlMatch[0];
                        // Don't auto-open if it's already a WorkspaceFile tool use (handled above)
                        if ((res as any).toolUsed !== 'create_html_file') {
                            console.log('🌐 Auto-opening live preview for URL:', url);
                            window.dispatchEvent(new CustomEvent('open-preview-tab', { detail: url }));
                        }
                    }

                    // Auto-register created Folders
                    if ((res as any).toolUsed === 'create_folder' && (res as any).toolResult?.success && (res as any).toolResult?.folder) {
                        const folder = (res as any).toolResult.folder;
                        setAttachedFiles(prev => {
                            if (prev.find(f => f.id === folder.id)) return prev;
                            toast.success(`Registered folder ${folder.name} in context`);
                            return [...prev, { id: folder.id, name: folder.name, type: 'folder', parentId: folder.parentId }];
                        });
                    }

                    // Auto-register created Files (Markdown/Text)
                    if (((res as any).toolUsed === 'create_file' || (res as any).toolUsed === 'create_markdown_file') && (res as any).toolResult?.success && (res as any).toolResult?.file) {
                        const file = (res as any).toolResult.file;
                        setAttachedFiles(prev => {
                            if (prev.find(f => f.id === file.id)) return prev;
                            toast.success(`Registered ${file.name} in context`);
                            return [...prev, { id: file.id, name: file.name, type: file.type || 'file', parentId: file.parentId }];
                        });
                    }

                    // Explicit Preview URL from Tool Result (e.g., manage_app_lifecycle)
                    if ((res as any).toolResult?.previewUrl) {
                        console.log('🔗 Auto-opening explicit preview URL:', (res as any).toolResult.previewUrl);
                        window.dispatchEvent(new CustomEvent('open-preview-tab', { detail: (res as any).toolResult.previewUrl }));
                    }

                    // @ts-ignore
                    if (sessionId) {
                        await addChatMessage(sessionId, 'ai', res.text as string, [], (res as any).toolUsed, (res as any).thinking, (res as any).toolResult, (res as any).toolArgs);
                    }

                    if ((res as any).toolUsed) {
                        const badge = resolveToolBadge((res as any).toolUsed);
                        const label = badge ? badge.label : (res as any).toolUsed;
                        const prefix = badge?.type === 'workflow' ? 'Workflow Executed' : 'Action Executed';
                        toast.success(`${prefix}: ${label}`);

                        // Trigger edit preview if applicable
                        if ((res as any).toolUsed === 'edit_file' || (res as any).toolUsed === 'create_markdown_file') {
                            if ((res as any).toolArgs) {
                                // If it's an HTML file, also trigger the live preview split view
                                const targetName = (res as any).toolArgs.fileId || (res as any).toolArgs.filename || '';
                                if (targetName.toLowerCase().endsWith('.html')) {
                                    // Try to find the file in available workspace files to get full object
                                    const fileObj = workspaceFiles.find(f =>
                                        f.id === targetName || f.name === targetName || f.storagePath?.endsWith(targetName)
                                    );
                                    if (fileObj) {
                                        window.dispatchEvent(new CustomEvent('open-preview-tab', { detail: fileObj }));
                                    }
                                }

                                setEditPreviewData({
                                    fileName: (res as any).toolArgs.fileId || (res as any).toolArgs.filename || 'Resource System',
                                    content: (res as any).toolArgs.content || ''
                                });
                                setIsEditPreviewOpen(true);
                            }
                        }

                        // Specific handling for focus_workspace_item
                        if ((res as any).toolUsed === 'focus_workspace_item' && (res as any).toolResult?.itemId) {
                            window.dispatchEvent(new CustomEvent('focus-workspace-item', {
                                detail: { itemId: (res as any).toolResult.itemId, parentId: (res as any).toolResult.parentId }
                            }));
                        }

                        // Dispatch custom event to refresh file manager without reloading the page
                        window.dispatchEvent(new CustomEvent('refresh-file-manager'));
                        setTimeout(() => refreshData(), 100);
                    }
                }
            } else {
                const errorMessage = res.message || res.text || 'AI failed to respond';
                console.error('❌ AI Error:', { success: res.success, message: res.message, text: res.text, fullResponse: res });
                toast.error(errorMessage);
                setMessages(prev => [...prev, { id: genMsgId(), role: 'ai', content: `Error: ${errorMessage}` }]);
            }
        } catch (error) {
            console.error('💥 Chat Error:', error);
            toast.error('Connection error');
            setMessages(prev => [...prev, {
                id: genMsgId(),
                role: 'ai',
                content: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`
            }]);
        } finally {
            setIsLoading(false);
            setStreamingStatus('idle');
            setStreamProgress(0);
            setAiActivity('');
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLoading) return;
        await sendMessage(input);
    };

    const approveFromBubble = async () => {
        setManualStop(false);
        if (!activeSessionId) {
            await sendMessage('approve');
            return;
        }

        try {
            const approval = await approveLatestAgentJob(activeSessionId);
            if (approval.success) {
                const userMsg = { id: genMsgId(), role: 'user' as const, content: 'approve', files: [] as SelectedFile[] };
                const aiMsg = { id: genMsgId(), role: 'ai' as const, content: '✅ Approved. Background agent started.' };
                setMessages(prev => [...prev, userMsg, aiMsg]);
                await addChatMessage(activeSessionId, 'user', userMsg.content, []);
                await addChatMessage(activeSessionId, 'ai', aiMsg.content, [], 'enqueue_agent_job');
                await refreshAgentStatus(activeSessionId);
                toast.success('Approved. Background agent started.');
                return;
            }
        } catch (error) {
            console.error('Approve failed:', error);
        }

        await sendMessage('approve');
    };

    const handleSavePrompt = async (data: {
        name: string,
        prompt: string,
        description: string,
        tools: string[],
        workflows?: any[],
        triggerKeywords?: string[]
    }) => {
        let res;
        if (editingPromptId) {
            // @ts-ignore
            res = await import('@/app/actions').then(a => a.updatePrompt(editingPromptId, data));
        } else {
            res = await createPrompt(data);
        }

        if (res.success) {
            toast.success(editingPromptId ? 'Archetype Updated' : 'System Prompt Created');
            refreshPrompts();
            setEditingPromptId(null);
            setIsEditorOpen(false);
        }
    };

    const handleSetActive = async (id: string) => {
        if (!id || isSwitchingAgent) return;
        setIsSwitchingAgent(true);
        try {
            const res = await setActivePrompt(id);
            if (res.success) {
                toast.success('Tactical Context Updated');
                refreshPrompts();
            } else {
                toast.error('Failed to switch agent');
            }
        } catch (error) {
            toast.error('Failed to switch agent');
        } finally {
            setIsSwitchingAgent(false);
        }
    };

    const handleDeletePrompt = async (id: string) => {
        const res = await deletePrompt(id);
        if (res.success) {
            toast.success('Prompt Purged');
            refreshPrompts();
        }
    };

    const handleApplySuggestion = async (suggestion: any) => {
        setIsSuggestionsOpen(false);
        const text = `Initialize strategic flow: ${suggestion.title}. \n\n${suggestion.agentInstructions}`;
        setInput(text);

        // Auto-send if it's a new chat, otherwise just set input
        if (messages.length === 0 && !isLoading) {
            // Give a small delay for the modal to close and state to update
            setTimeout(() => {
                sendMessage(text);
            }, 300);
        }

        toast.success(`Loaded "${suggestion.title}" into agent context`);
    };

    const startEditing = (p: AIPromptSet) => {
        setNewPrompt({
            name: p.name,
            description: p.description || '',
            prompt: p.prompt,
            tools: p.tools && p.tools.length > 0 ? p.tools : DEFAULT_SKILLS,
            // @ts-ignore
            workflows: p.workflows || [],
            // @ts-ignore
            triggerKeywords: p.triggerKeywords || []
        });
        setEditingPromptId(p.id);
        setIsEditorOpen(true);
    };

    const removeFile = (id: string) => {
        setAttachedFiles(prev => prev.filter(f => f.id !== id));
    };

    // Listen for custom event to add files to chat
    useEffect(() => {
        const handleAddFile = (e: any) => {
            const file = e.detail as WorkspaceFile;
            setAttachedFiles(prev => {
                if (prev.find(f => f.id === file.id)) return prev;
                return [...prev, { id: file.id, name: file.name, type: file.type, parentId: (file as any).parentId }];
            });
            if (!isOpen) setIsOpen(true);
            toast.success(`Added ${file.name} to AI context`, {
                icon: <Paperclip size={14} className="text-sky-400" />
            });
        };

        const handlePreview = (e: any) => {
            const file = e.detail as WorkspaceFile;
            setAttachedFiles(prev => {
                if (prev.find(f => f.id === file.id)) return prev;
                return [...prev, { id: file.id, name: file.name, type: file.type, parentId: (file as any).parentId }];
            });
        };

        const handleFolderChange = (e: any) => {
            const { folderId, folderName } = e.detail;
            setCurrentFolderContext({ id: folderId, name: folderName });
        };

        window.addEventListener('add-to-ai-chat', handleAddFile);
        window.addEventListener('preview-opened', handlePreview);
        window.addEventListener('workspace-folder-changed', handleFolderChange);

        return () => {
            window.removeEventListener('add-to-ai-chat', handleAddFile);
            window.removeEventListener('preview-opened', handlePreview);
            window.removeEventListener('workspace-folder-changed', handleFolderChange);
        };
    }, [isOpen]);

    const handleApproveJob = async (jobId?: string) => {
        if (!jobId) {
            toast.error("No Job ID associated with this approval.");
            return;
        }

        const toastId = toast.loading("Approving job...");
        try {
            // @ts-ignore
            const { approveAgentJob } = await import('@/app/actions');
            const res = await approveAgentJob(jobId);

            if (res.success) {
                toast.success("Job Approved! Running...", { id: toastId });
                setMessages(prev => prev.map(m => {
                    if (m.toolResult?.jobId === jobId) {
                        return {
                            ...m,
                            toolResult: { ...m.toolResult, approved: true, requiresApproval: false }
                        };
                    }
                    return m;
                }));
                if (activeSessionId) refreshAgentStatus(activeSessionId);
            } else {
                toast.error("Failed to approve job", { id: toastId });
            }
        } catch (e) {
            toast.error("Error approving job", { id: toastId });
        }
    };

    const togglePin = () => {
        const next = !isPinned;
        setIsPinned(next);
        window.dispatchEvent(new CustomEvent('ai-chat-pin-changed', { detail: next }));
        if (next && !isOpen) setIsOpen(true);
    };

    const activePrompt = prompts.find(p => p.isActive);
    const getPromptCapabilityStats = (prompt: AIPromptSet | null) => {
        const ids = prompt?.tools && prompt.tools.length > 0 ? prompt.tools : DEFAULT_SKILLS;
        const toolIds = ids.filter(id => TOOL_LIBRARY[id]);
        const skillIds = ids.filter(id => SKILLS_LIBRARY[id]);
        return { toolIds, skillIds };
    };
    const activeAgentId = activePrompt?.id || '';
    const enabledToolIds = (activePrompt?.tools && activePrompt.tools.length > 0)
        ? activePrompt.tools.filter(id => TOOL_LIBRARY[id])
        : DEFAULT_SKILLS.filter(id => TOOL_LIBRARY[id]);

    const toolPromptById: Record<string, string> = {
        verify_dgii_rnc: 'Verify this business with DGII',
        extract_alegra_bill: 'Extract this receipt to Alegra',
        record_alegra_payment: 'Record a payment for this bill',
        create_markdown_file: 'Save this as a markdown report',
        create_task: 'Create a task from this request'
    };

    const slashCommands = useMemo(() => ([
        {
            command: '/v1',
            label: 'Cognitive Brain',
            description: 'Activate advanced reasoning and planning mode.',
            template: '/v1 '
        },
        {
            command: '/scaffold-vite',
            label: 'Scaffold Vite app',
            description: 'Create a new Vite React app template.',
            template: '/scaffold-vite '
        },
        {
            command: '/vite',
            label: 'Scaffold Vite app (alias)',
            description: 'Alias for creating a new Vite React app template.',
            template: '/vite '
        },
        {
            command: '/viteapp',
            label: 'Scaffold Vite app (alias)',
            description: 'Alias for creating a new Vite React app template.',
            template: '/viteapp '
        },
        {
            command: '/scaffolde-vite',
            label: 'Scaffold Vite app (alias)',
            description: 'Alias for creating a new Vite React app template.',
            template: '/scaffolde-vite '
        },
        {
            command: '/install-docker',
            label: 'Install to Docker',
            description: 'Build and run the app in a Docker container.'
        },
        {
            command: '/open-processes',
            label: 'Open Processes',
            description: 'Show running processes and deployments.'
        }
    ]), []);

    const commandQuery = input.startsWith('/') ? input.slice(1).toLowerCase() : '';
    const filteredCommands = useMemo(() => {
        if (!input.startsWith('/')) return [];
        if (!commandQuery) return slashCommands;
        return slashCommands.filter(cmd =>
            cmd.command.toLowerCase().includes(commandQuery) ||
            cmd.label.toLowerCase().includes(commandQuery)
        );
    }, [commandQuery, input, slashCommands]);

    useEffect(() => {
        const shouldOpen = input.startsWith('/');
        setIsCommandMenuOpen(shouldOpen);
        if (shouldOpen) {
            setActiveCommandIndex(0);
        }
    }, [input]);

    const quickTips = useMemo(() => {
        const defaultTips = [
            { text: 'Organize these files into a clean structure', icon: '🗂️' },
            { text: 'Summarize the attached document with key points', icon: '📝' },
            { text: 'Create a workflow for this recurring task', icon: '⚡' }
        ];
        const receiptTips = [
            { text: 'Analyze these Dominican receipts and extract ITBIS', icon: '🧾' },
            { text: 'Verify RNC and NCF for this receipt', icon: '🔎' },
            { text: 'Generate a markdown report from receipt data', icon: '📊' }
        ];
        const codeTips = [
            { text: 'Review this code for security and performance issues', icon: '🔒' },
            { text: 'Find bugs and suggest optimizations', icon: '🛠️' },
            { text: 'Refactor this module with best practices', icon: '🧠' }
        ];
        const webTips = [
            { text: 'Design a premium SaaS landing page for a new product', icon: '✨' },
            { text: 'Create a marketing site for a fintech startup', icon: '💸' },
            { text: 'Build a portfolio site concept with dark mode glassmorphism', icon: '🌙' },
            { text: 'Create a product launch microsite with a hero and features', icon: '🚀' },
            { text: 'Design a CRM dashboard UI with charts and tables', icon: '📈' }
        ];

        const name = (activePrompt?.name || '').toLowerCase();
        let pool = defaultTips;
        if (name.includes('receipt') || name.includes('fiscal')) pool = receiptTips;
        if (name.includes('code') || name.includes('review')) pool = codeTips;
        if (name.includes('web') || name.includes('architect') || name.includes('ui') || name.includes('ux')) pool = webTips;

        // Deterministic shuffle based on active prompt name so SSR and CSR match
        const seededHash = (s: string) => {
            let h = 2166136261;
            for (let i = 0; i < s.length; i++) {
                h ^= s.charCodeAt(i);
                h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
            }
            return h >>> 0;
        };

        const mulberry32 = (a: number) => {
            return () => {
                let t = a += 0x6D2B79F5;
                t = Math.imul(t ^ (t >>> 15), t | 1);
                t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
                return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
            };
        };

        const deterministicShuffle = <T,>(arr: T[], seedStr: string) => {
            const seed = seededHash(seedStr || 'default');
            const rnd = mulberry32(seed);
            const a = [...arr];
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(rnd() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        };

        const shuffled = deterministicShuffle(pool, activePrompt?.name || 'default');
        return shuffled.slice(0, 3);
    }, [activePrompt?.name]);

    const applyCommand = (command: string) => {
        const matched = slashCommands.find(cmd => cmd.command === command);
        const nextValue = matched?.template || `${command} `;
        setInput(nextValue);
        setIsCommandMenuOpen(false);
        setActiveCommandIndex(0);
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (isCommandMenuOpen && filteredCommands.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveCommandIndex((prev) => (prev + 1) % filteredCommands.length);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveCommandIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
                return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                const selected = filteredCommands[activeCommandIndex];
                if (selected) applyCommand(selected.command);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setIsCommandMenuOpen(false);
                return;
            }
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (isLoading) return;
            handleSend(e);
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            const nextIndex = historyIndex + 1;
            if (nextIndex < promptHistory.length) {
                setHistoryIndex(nextIndex);
                setInput(promptHistory[nextIndex]);
            }
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const prevIndex = historyIndex - 1;
            if (prevIndex >= 0) {
                setHistoryIndex(prevIndex);
                setInput(promptHistory[prevIndex]);
            } else {
                setHistoryIndex(-1);
                setInput('');
            }
        }
    };

    // Listen for emoji celebration events
    useEffect(() => {
        const handleCelebration = (e: any) => {
            const emoji = e.detail?.emoji;
            if (emoji) {
                setCelebration({ emoji, timestamp: Date.now() });
            }
        };

        window.addEventListener('emoji-celebration', handleCelebration);
        return () => window.removeEventListener('emoji-celebration', handleCelebration);
    }, []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!event.shiftKey || event.key !== ',') return;
            const target = event.target as HTMLElement | null;
            const tagName = target?.tagName?.toLowerCase();
            if (tagName === 'input' || tagName === 'textarea' || target?.isContentEditable) return;
            event.preventDefault();
            setIsSettingsModalOpen(true);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <>
            {/* Emoji Celebration Animation */}
            <AnimatePresence>
                {celebration && (
                    <EmojiCelebration
                        emoji={celebration.emoji}
                        onComplete={() => setCelebration(null)}
                    />
                )}
            </AnimatePresence>

            {isPinned || embedded ? (
                <div className={cn(
                    "h-full border-[color:var(--border)] glass-card flex flex-col relative z-20 overflow-hidden",
                    embedded ? "w-full border-r" : "w-[450px] border-l"
                )}>
                    {/* Header (Pinned) */}
                    <div className={cn("border-b border-[color:var(--border)] bg-[color:var(--card)]", embedded ? "p-3" : "p-6")}>
                        <div className={cn("flex items-center justify-between", embedded ? "max-w-3xl mx-auto w-full" : "w-full")}>
                            <div className="flex items-center gap-3">
                                <BrainCircuit size={20} className="text-sky-400" />
                                <div>
                                    <h3 className="font-bold text-foreground text-xs tracking-tight uppercase">
                                        {activePrompt?.name || "TaskFlow Agent"}
                                    </h3>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-[8px] text-muted-foreground uppercase tracking-[0.2em] font-bold">System Online</span>
                                    </div>
                                    {isBackgroundBusy && (
                                        <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg animate-pulse">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-lg shadow-amber-400/50" />
                                                    <span className="text-[10px] text-amber-300 uppercase tracking-wider font-bold">
                                                        {backgroundJobLabel || 'Processing'}
                                                    </span>
                                                </div>
                                                {elapsedTime > 0 && (
                                                    <span className="text-[9px] font-mono text-muted-foreground">
                                                        {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
                                                    </span>
                                                )}
                                            </div>
                                            {backgroundJobMessage && (
                                                <p className="text-[10px] text-foreground/70 leading-relaxed pl-4">
                                                    {backgroundJobMessage}
                                                </p>
                                            )}
                                            <button
                                                onClick={() => setShowActivityPanel(!showActivityPanel)}
                                                className="mt-1 text-[9px] text-amber-400/70 hover:text-amber-300 flex items-center gap-1 pl-4 transition-colors"
                                            >
                                                <Activity size={10} />
                                                View Live Activity Log
                                            </button>
                                        </div>
                                    )}

                                    {activeAppContext && (
                                        <div className="mt-1 inline-flex items-center gap-2 text-[10px] text-sky-200 bg-sky-500/10 border border-sky-500/20 rounded-lg px-2 py-1 w-fit">
                                            <FolderOpen size={12} className="text-sky-300" />
                                            <span className="truncate max-w-[160px]" title={activeAppContext.path}>
                                                {activeAppContext.name}
                                            </span>
                                            <button
                                                onClick={() => {
                                                    setActiveAppContext(null);
                                                    setChatScope('workspace');
                                                }}
                                                className="p-1 text-white/50 hover:text-white/80"
                                                title="Clear active app context"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    )}
                                    <div className={cn(
                                        "mt-1 inline-flex items-center gap-2 text-[10px] rounded-lg px-2 py-1 w-fit border",
                                        chatScope === 'repo'
                                            ? "text-emerald-200 bg-emerald-500/10 border-emerald-500/20"
                                            : "text-sky-200 bg-sky-500/10 border-sky-500/20"
                                    )}>
                                        {chatScope === 'repo' ? <GitBranch size={12} className="text-emerald-300" /> : <Folder size={12} className="text-sky-300" />}
                                        <span className="uppercase tracking-wider font-bold">
                                            {chatScope === 'repo' ? 'Repo Apps' : 'File Manager'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-1">
                                {headerRight}
                                <button
                                    onClick={() => setIsSuggestionsOpen(true)}
                                    className="p-2 hover:bg-sky-500/10 rounded-lg text-sky-400/70 hover:text-sky-300 transition-colors"
                                    title="Browse Ideas Library"
                                >
                                    <Lightbulb size={18} />
                                </button>
                                <button
                                    onClick={() => setView(view === 'sessions' ? 'chat' : 'sessions')}
                                    className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors"
                                    title="Chat Sessions"
                                >
                                    <MessageSquare size={18} />
                                </button>
                                <button
                                    onClick={() => setIsSettingsModalOpen(true)}
                                    className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors"
                                    title="Chat Settings"
                                >
                                    <Settings size={18} />
                                </button>
                                {!embedded && (
                                    <button
                                        onClick={togglePin}
                                        className="p-2 hover:bg-white/5 rounded-lg text-sky-400 transition-colors"
                                        title="Unpin from UI"
                                    >
                                        <PinOff size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Content Area (Pinned) */}
                    <div className="flex-1 overflow-hidden relative">
                        <AnimatePresence mode="wait">
                            {view === 'chat' ? (
                                <div
                                    className="h-full flex flex-col relative"
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        setIsDragging(true);
                                    }}
                                    onDragLeave={() => setIsDragging(false)}
                                    onDrop={async (e) => {
                                        e.preventDefault();
                                        setIsDragging(false);
                                        const fileId = e.dataTransfer.getData('fileId');
                                        if (fileId) {
                                            const file = workspaceFiles.find(f => f.id === fileId);
                                            if (file) {
                                                setAttachedFiles(prev => {
                                                    if (prev.find(f => f.id === file.id)) return prev;
                                                    return [...prev, file];
                                                });
                                                toast.success(`Attached ${file.name}`);
                                            }
                                        }
                                    }}
                                >
                                    {isDragging && (
                                        <div className="absolute inset-0 z-[100] bg-sky-500/10 backdrop-blur-sm border-2 border-dashed border-sky-500/40 rounded-[2rem] flex flex-col items-center justify-center pointer-events-none m-4">
                                            <div className="bg-[color:var(--card)] shadow-2xl p-6 rounded-[2rem] border border-[color:var(--border)] flex flex-col items-center gap-4 animate-bounce">
                                                <div className="p-4 bg-sky-500/10 rounded-2xl text-sky-400">
                                                    <Paperclip size={32} />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-white font-bold">Drop to Attach</p>
                                                    <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest mt-1">Context Injection</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div
                                        ref={scrollRef}
                                        className="flex-1 overflow-y-auto overflow-x-hidden p-6 custom-scrollbar relative"
                                        onScroll={(e) => {
                                            const target = e.target as HTMLDivElement;
                                            const { scrollHeight, scrollTop, clientHeight } = target;
                                            const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;

                                            isNearBottomRef.current = isNearBottom;
                                            setShowScrollButton(!isNearBottom && messages.length > 3);

                                            // User is scrolling up - lock auto-scroll
                                            if (!isNearBottom) {
                                                setShouldAutoScroll(false);
                                                setIsUserScrolling(true);
                                            } else {
                                                // Back at bottom - re-enable auto-scroll
                                                setShouldAutoScroll(true);
                                                setIsUserScrolling(false);
                                            }

                                            // Clear any pending scroll timeout
                                            if (scrollTimeoutRef.current) {
                                                clearTimeout(scrollTimeoutRef.current);
                                            }

                                            // Debounce scroll state
                                            scrollTimeoutRef.current = setTimeout(() => {
                                                setIsUserScrolling(false);
                                            }, 150);
                                        }}
                                    >
                                        <div className={cn("space-y-8 pb-8", embedded ? "max-w-3xl mx-auto" : "")}>
                                            {messages.length === 0 && (
                                                <div className="flex flex-col items-center justify-center text-center space-y-6 py-12 px-4 mt-8 relative">
                                                    <div className="relative group">
                                                        <div className="absolute inset-0 bg-gradient-to-r from-sky-500/20 via-emerald-500/20 to-amber-400/20 blur-3xl rounded-full scale-150 group-hover:scale-[2] transition-all duration-1000" />
                                                        <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center border border-white/20 text-sky-400 relative z-10 shadow-2xl backdrop-blur-xl">
                                                            <Sparkles size={48} className="drop-shadow-2xl" />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2 relative z-10">
                                                        <p className="text-white/60 text-sm font-semibold">
                                                            Premium AI Assistant
                                                        </p>
                                                        <p className="text-white/40 text-[10px] leading-relaxed uppercase tracking-[0.3em] font-bold">
                                                            Agent Ready
                                                        </p>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-3 w-full pt-4 relative z-10">
                                                        <button
                                                            onClick={() => setIsSuggestionsOpen(true)}
                                                            className="group p-5 bg-sky-600/10 border border-sky-500/20 rounded-2xl text-left transition-all hover:bg-sky-600/20 hover:border-sky-500/30 shadow-xl shadow-sky-500/5 backdrop-blur-xl relative overflow-hidden"
                                                        >
                                                            <div className="absolute inset-0 bg-gradient-to-r from-sky-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            <div className="relative flex items-center gap-4">
                                                                <div className="p-3 bg-sky-600/20 rounded-xl text-sky-400 group-hover:scale-110 transition-transform">
                                                                    <Compass size={22} />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <h4 className="text-[11px] font-black text-white uppercase tracking-widest mb-1">Explore Idea Library</h4>
                                                                    <p className="text-[10px] text-white/40 leading-relaxed font-medium">Browse high-quality strategic flows and multi-step task instructions.</p>
                                                                </div>
                                                                <ChevronRight size={18} className="text-white/20 group-hover:translate-x-1 group-hover:text-sky-400 transition-all" />
                                                            </div>
                                                        </button>

                                                        <div className="grid grid-cols-1 gap-2 pt-2">
                                                            {quickTips.map((tip, ix) => (
                                                                <button
                                                                    key={ix}
                                                                    onClick={() => setInput(prev => {
                                                                        const text = tip.text;
                                                                        if (!prev.trim()) return text;
                                                                        return `${prev.trim()} ${text}`;
                                                                    })}
                                                                    className="group p-4 bg-gradient-to-br from-white/[0.08] to-white/[0.03] border border-white/10 rounded-2xl text-left text-xs text-white/50 hover:text-white/90 hover:border-white/20 hover:from-white/[0.12] hover:to-white/[0.06] transition-all duration-300 active:scale-[0.98] backdrop-blur-xl shadow-lg hover:shadow-xl relative overflow-hidden"
                                                                >
                                                                    <div className="absolute inset-0 bg-gradient-to-r from-sky-500/0 via-emerald-500/5 to-amber-400/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                                                    <div className="relative flex items-center gap-3">
                                                                        <span className="text-2xl">{tip.icon}</span>
                                                                        <span className="flex-1 font-medium">{tip.text}</span>
                                                                        <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            {messages.map((msg, i) => (
                                                <MessageBubble
                                                    key={msg.id || `${msg.role}-${i}-${String(msg.content || '').slice(0, 30)}`}
                                                    msg={msg}
                                                    attachedFiles={attachedFiles}
                                                    showThinking={showThinkingTrace}
                                                    onApprove={handleApproveJob}
                                                    setInput={setInput}
                                                    setActiveTool={setActiveTool}
                                                />
                                            ))}

                                            {sessionActivities.length > 0 && (
                                                <CognitiveTimeline activities={sessionActivities} />
                                            )}

                                            {isLoading && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="flex flex-col items-start gap-3"
                                                >
                                                    <div className="relative group w-full max-w-xl">
                                                        <div className="absolute inset-0 bg-gradient-to-r from-sky-500/20 via-emerald-500/20 to-amber-400/20 rounded-[1.5rem] blur-xl opacity-60 group-hover:opacity-100 transition-opacity" />
                                                        <div className="relative bg-gradient-to-br from-white/[0.08] to-white/[0.03] px-6 py-5 rounded-[1.5rem] rounded-tl-none border border-white/10 backdrop-blur-xl shadow-2xl">
                                                            <div className="flex items-start gap-4">
                                                                <div className="flex gap-1.5 pt-1">
                                                                    <div className="w-2.5 h-2.5 bg-gradient-to-r from-sky-400 to-emerald-400 rounded-full shadow-lg shadow-sky-400/50 animate-pulse" />
                                                                    <div className="w-2.5 h-2.5 bg-gradient-to-r from-emerald-400 to-amber-300 rounded-full shadow-lg shadow-emerald-400/50 animate-pulse" style={{ animationDelay: '150ms' }} />
                                                                    <div className="w-2.5 h-2.5 bg-gradient-to-r from-amber-300 to-sky-400 rounded-full shadow-lg shadow-amber-300/50 animate-pulse" style={{ animationDelay: '300ms' }} />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <span className="text-xs font-bold tracking-wider uppercase bg-gradient-to-r from-sky-300 via-emerald-300 to-amber-300 bg-clip-text text-transparent">
                                                                            {streamingStatus === 'connecting' && 'Connecting to AI...'}
                                                                            {streamingStatus === 'streaming' && 'Receiving Response'}
                                                                            {streamingStatus === 'processing' && 'Finalizing'}
                                                                            {streamingStatus === 'idle' && (isBackgroundBusy ? (backgroundJobLabel || 'Processing') : 'Thinking')}
                                                                        </span>
                                                                        {streamingStatus === 'streaming' && (
                                                                            <span className="text-[10px] text-sky-400/60 font-mono">
                                                                                {streamProgress}%
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {aiActivity && (
                                                                        <motion.div
                                                                            initial={{ opacity: 0, x: -10 }}
                                                                            animate={{ opacity: 1, x: 0 }}
                                                                            className="text-[11px] text-muted-foreground/60 font-medium mb-2"
                                                                        >
                                                                            {aiActivity}
                                                                        </motion.div>
                                                                    )}
                                                                    {streamingStatus !== 'idle' && (
                                                                        <div className="w-full h-1 bg-foreground/5 rounded-full overflow-hidden">
                                                                            <motion.div
                                                                                className="h-full bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-400"
                                                                                initial={{ width: '0%' }}
                                                                                animate={{ width: `${streamProgress}%` }}
                                                                                transition={{ duration: 0.3 }}
                                                                            />
                                                                        </div>
                                                                    )}
                                                                    {isBackgroundBusy && backgroundJobLabel && (
                                                                        <div className="text-[8px] text-muted-foreground/50 uppercase tracking-widest font-bold mt-2 flex items-center gap-1.5">
                                                                            <div className="w-1.5 h-1.5 bg-emerald-400/70 rounded-full animate-pulse" />
                                                                            Background Agent Active
                                                                        </div>
                                                                    )}

                                                                    {/* Live Activity Log */}
                                                                    {(isBackgroundBusy || activityLog.length > 0) && (
                                                                        <div className="mt-3 pt-3 border-t border-[color:var(--border)]">
                                                                            <button
                                                                                onClick={() => setShowActivityPanel(!showActivityPanel)}
                                                                                className="flex items-center gap-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors mb-2 group"
                                                                            >
                                                                                <Activity size={12} className="group-hover:text-sky-400 transition-colors" />
                                                                                <span>Live Activity Log ({activityLog.length})</span>
                                                                                <ChevronRight size={12} className={cn(
                                                                                    "transition-transform",
                                                                                    showActivityPanel && "rotate-90"
                                                                                )} />
                                                                            </button>

                                                                            <AnimatePresence>
                                                                                {showActivityPanel && (
                                                                                    <motion.div
                                                                                        initial={{ opacity: 0, height: 0 }}
                                                                                        animate={{ opacity: 1, height: 'auto' }}
                                                                                        exit={{ opacity: 0, height: 0 }}
                                                                                        className="mt-2"
                                                                                    >
                                                                                        <TerminalView
                                                                                            title="Agent Timeline"
                                                                                            content={activityLog.length > 0
                                                                                                ? activityLog.map(log => `[${log.time}] ${log.agent}: ${log.message}`).join('\n')
                                                                                                : "Waiting for agent activity..."
                                                                                            }
                                                                                            isError={false}
                                                                                        />
                                                                                    </motion.div>
                                                                                )}
                                                                            </AnimatePresence>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground/30 italic px-2">
                                                        💡 You can continue typing below while I work...
                                                    </div>
                                                </motion.div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Premium Scroll Button */}
                                    <AnimatePresence>
                                        {showScrollButton && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                                                className="absolute bottom-32 right-8 z-20 flex flex-col items-end gap-2"
                                            >
                                                {(isLoading || isBackgroundBusy) && (
                                                    <motion.div
                                                        initial={{ opacity: 0, x: 20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        className="px-3 py-1.5 bg-sky-500/20 border border-sky-500/30 rounded-full text-[10px] text-sky-300 font-medium backdrop-blur-xl shadow-lg flex items-center gap-2"
                                                    >
                                                        <div className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-pulse" />
                                                        New activity below
                                                    </motion.div>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        setShouldAutoScroll(true);
                                                        setIsUserScrolling(false);
                                                        scrollRef.current?.scrollTo({
                                                            top: scrollRef.current.scrollHeight,
                                                            behavior: 'smooth'
                                                        });
                                                    }}
                                                    className="p-3 bg-gradient-to-r from-sky-600 to-emerald-500 hover:from-sky-500 hover:to-emerald-400 rounded-full shadow-2xl shadow-sky-500/50 hover:shadow-sky-500/70 border border-white/20 backdrop-blur-xl transition-all duration-300 hover:scale-110 active:scale-95 group"
                                                    title="Resume auto-scroll"
                                                >
                                                    <ArrowDown size={20} className="text-white group-hover:animate-bounce" />
                                                </button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div className="relative z-50 p-6 border-t border-[color:var(--border)] bg-[color:var(--card)] backdrop-blur-xl">
                                        <div className={cn(embedded ? "max-w-3xl mx-auto" : "w-full")}>
                                            {activeQuestions.length > 0 && (
                                                <QuestionWizard
                                                    questions={activeQuestions}
                                                    onSubmit={handleQuestionSubmit}
                                                    onCancel={() => setDismissedQuestionId(messages[messages.length - 1]?.id || null)}
                                                />
                                            )}
                                            <div className="flex flex-col gap-3">
                                                <form onSubmit={handleSend} className="relative group/input">
                                                    <div className="absolute -inset-0.5 bg-gradient-to-r from-sky-500/20 via-emerald-500/20 to-amber-400/20 rounded-[1.25rem] opacity-0 group-focus-within/input:opacity-100 blur-xl transition-opacity duration-500" />
                                                    <div className="relative">
                                                        <div className="mb-2 flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 font-bold">Agent</span>
                                                                {isSwitchingAgent && <Loader2 size={12} className="animate-spin text-sky-400" />}
                                                            </div>
                                                            <select
                                                                value={activeAgentId}
                                                                onChange={(e) => handleSetActive(e.target.value)}
                                                                disabled={prompts.length === 0 || isSwitchingAgent}
                                                                className="bg-foreground/5 border border-[color:var(--border)] rounded-xl px-3 py-1.5 text-[10px] text-foreground/80 focus:outline-none focus:border-sky-500/40"
                                                                title="Switch agent"
                                                            >
                                                                {prompts.length === 0 && <option value="">No agents</option>}
                                                                {prompts.map(p => (
                                                                    <option key={p.id} value={p.id} className="bg-[color:var(--card)] text-foreground">
                                                                        {p.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <textarea
                                                            rows={1}
                                                            value={input}
                                                            onChange={(e) => setInput(e.target.value)}
                                                            onKeyDown={handleInputKeyDown}
                                                            placeholder={isLoading ? "AI is working above... you can queue another message" : (isBackgroundBusy ? "Background agent active. You can continue chatting..." : "Ask anything...")}
                                                            className={cn(
                                                                "relative z-20 w-full bg-foreground/[0.03] backdrop-blur-xl border border-[color:var(--border)] rounded-[1.25rem] py-4 pl-5 pr-14 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-sky-500/40 focus:bg-foreground/[0.05] transition-all duration-300 resize-none shadow-2xl shadow-black/5 font-medium",
                                                                isLoading && "border-sky-500/20 bg-white/[0.03]"
                                                            )}
                                                            style={{ minHeight: '52px', maxHeight: '200px' }}
                                                        />
                                                        {isCommandMenuOpen && filteredCommands.length > 0 && (
                                                            <div className="absolute bottom-full mb-3 left-0 w-full z-50 bg-[color:var(--card)] border border-[color:var(--border)] rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl">
                                                                <div className="text-[10px] text-white/40 px-4 py-2 border-b border-white/5 uppercase tracking-widest">Commands</div>
                                                                <div className="max-h-52 overflow-y-auto">
                                                                    {filteredCommands.map((cmd, idx) => (
                                                                        <button
                                                                            key={cmd.command}
                                                                            onClick={() => applyCommand(cmd.command)}
                                                                            className={cn(
                                                                                "w-full text-left px-4 py-2 flex items-center justify-between text-xs transition-colors",
                                                                                idx === activeCommandIndex ? "bg-white/10 text-white" : "text-white/60 hover:text-white hover:bg-white/5"
                                                                            )}
                                                                        >
                                                                            <div>
                                                                                <div className="font-mono text-[11px]">{cmd.command}</div>
                                                                                <div className="text-[10px] text-white/40">{cmd.description}</div>
                                                                            </div>
                                                                            <span className="text-[10px] text-white/30">{cmd.label}</span>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        <button
                                                            type="submit"
                                                            disabled={!input.trim() && attachedFiles.length === 0}
                                                            className={cn(
                                                                "absolute right-2 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-xl transition-all duration-300 shadow-lg",
                                                                input.trim() || attachedFiles.length > 0
                                                                    ? isLoading
                                                                        ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 hover:scale-110 active:scale-95 shadow-emerald-500/50"
                                                                        : "bg-gradient-to-r from-sky-600 to-emerald-500 text-white hover:from-sky-500 hover:to-emerald-400 hover:scale-110 active:scale-95 shadow-sky-500/50"
                                                                    : "bg-white/5 text-white/20 cursor-not-allowed"
                                                            )}
                                                            title={isLoading ? "Queue next message" : "Send message"}
                                                        >
                                                            <Send size={16} className={(input.trim() || attachedFiles.length > 0) && !isLoading ? "animate-pulse" : ""} />
                                                        </button>
                                                    </div>
                                                    {input.length > 0 && (
                                                        <div className="absolute -top-6 right-0 text-[9px] text-white/30 font-mono">
                                                            {input.length} chars
                                                        </div>
                                                    )}
                                                </form>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : view === 'sessions' ? (
                                renderSessionsView()
                            ) : (
                                <div className="h-full p-6 overflow-y-auto custom-scrollbar">
                                    <div className={cn("space-y-4", embedded ? "max-w-3xl mx-auto" : "")}>
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-[10px] font-black uppercase text-white/30 tracking-widest">Archetypes</h4>
                                            <button onClick={() => { setEditingPromptId(null); setNewPrompt({ name: '', description: '', prompt: '', tools: DEFAULT_SKILLS, workflows: [], triggerKeywords: [] }); setIsEditorOpen(true); }} className="p-2 bg-sky-500/80 hover:bg-sky-500 rounded-lg text-white transition-colors">
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                        <div className="space-y-3">
                                            {prompts.map(p => {
                                                const stats = getPromptCapabilityStats(p);
                                                return (
                                                    <div key={p.id} className={cn("p-4 rounded-2xl border transition-all", p.isActive ? "bg-sky-500/10 border-sky-400/30" : "bg-white/5 border-white/5")}>
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-[12px] font-bold text-white truncate">{p.name}</span>
                                                            <div className="flex gap-1 shrink-0">
                                                                {!p.isActive && <button onClick={() => handleSetActive(p.id)} className="p-1.5 bg-white/5 text-white/40 hover:text-white rounded-lg"><Check size={14} /></button>}
                                                                <button onClick={() => startEditing(p)} className="p-1.5 bg-white/5 text-white/40 hover:text-white rounded-lg"><Edit2 size={14} /></button>
                                                            </div>
                                                        </div>
                                                        <div className="mt-2 flex items-center gap-2 text-[9px] text-white/30">
                                                            <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10">Tools {stats.toolIds.length}</span>
                                                            <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10">Skills {stats.skillIds.length}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                </div >
            ) : (
                <div className="fixed bottom-8 right-8 z-[9999] flex flex-col items-end gap-4 font-sans">
                    <AnimatePresence>
                        {isOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 30, scale: 0.9, filter: 'blur(10px)' }}
                                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                                exit={{ opacity: 0, y: 30, scale: 0.9, filter: 'blur(10px)' }}
                                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                className="glass-card w-[500px] md:w-[800px] xl:w-[1100px] h-[85vh] flex flex-col shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] border border-white/20 rounded-[2.5rem] overflow-hidden backdrop-blur-3xl"
                            >
                                <div className="p-5 border-b border-[color:var(--border)] bg-[color:var(--card)] flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-sky-500/10 rounded-xl text-sky-400">
                                            <BrainCircuit size={18} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-foreground text-xs tracking-tight uppercase">
                                                {activePrompt?.name || "TaskFlow Agent"}
                                            </h3>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <div className="w-1 h-1 rounded-full bg-emerald-500" />
                                                <span className="text-[8px] text-muted-foreground uppercase tracking-[0.2em] font-bold">Core Active</span>
                                            </div>
                                            {isBackgroundBusy && (
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <div className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
                                                    <span className="text-[8px] text-amber-200/80 uppercase tracking-[0.2em] font-bold">
                                                        Background Agent Active{backgroundJobLabel ? `: ${backgroundJobLabel}` : ''}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setIsSuggestionsOpen(true)}
                                            className="p-2.5 hover:bg-sky-500/10 rounded-full transition-all text-sky-400/70 hover:text-sky-300"
                                            title="Browse Ideas Library"
                                        >
                                            <Lightbulb size={20} />
                                        </button>
                                        <button
                                            onClick={togglePin}
                                            className="p-2.5 hover:bg-white/10 rounded-full transition-all text-white/40 hover:text-white"
                                            title="Pin to Dashboard"
                                        >
                                            <Pin size={20} />
                                        </button>
                                        <button
                                            onClick={() => setView(view === 'sessions' ? 'chat' : 'sessions')}
                                            className="p-2.5 rounded-full transition-all border bg-white/5 border-white/5 text-white/40 hover:text-white"
                                            title="Chat Sessions"
                                        >
                                            <MessageSquare size={20} />
                                        </button>
                                        <button
                                            onClick={() => setIsSettingsModalOpen(true)}
                                            className="p-2.5 rounded-full transition-all border bg-white/5 border-white/5 text-white/40 hover:text-white"
                                            title="Chat Settings"
                                        >
                                            <Settings size={20} />
                                        </button>
                                        <button
                                            onClick={() => setIsOpen(false)}
                                            className="p-2.5 hover:bg-white/10 rounded-full transition-all text-white/40 hover:text-white hover:scale-110 active:scale-95"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>
                                </div>

                                {/* Content Area */}
                                <div className="flex-1 overflow-hidden relative">
                                    <AnimatePresence mode="wait">
                                        {view === 'chat' ? (
                                            <motion.div
                                                key="chat"
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                className="h-full flex flex-col relative"
                                                onDragOver={(e) => {
                                                    e.preventDefault();
                                                    setIsDragging(true);
                                                }}
                                                onDragLeave={() => setIsDragging(false)}
                                                onDrop={async (e) => {
                                                    e.preventDefault();
                                                    setIsDragging(false);
                                                    const fileId = e.dataTransfer.getData('fileId');
                                                    if (fileId) {
                                                        const file = workspaceFiles.find(f => f.id === fileId);
                                                        if (file) {
                                                            setAttachedFiles(prev => {
                                                                if (prev.find(f => f.id === file.id)) return prev;
                                                                return [...prev, file];
                                                            });
                                                            toast.success(`Attached ${file.name}`);
                                                        }
                                                    }
                                                }}
                                            >
                                                {isDragging && (
                                                    <div className="absolute inset-0 z-[100] bg-sky-500/10 backdrop-blur-sm border-2 border-dashed border-sky-500/40 rounded-[2rem] flex flex-col items-center justify-center pointer-events-none m-4">
                                                        <div className="bg-[color:var(--card)] shadow-2xl p-6 rounded-[2rem] border border-[color:var(--border)] flex flex-col items-center gap-4 animate-bounce">
                                                            <div className="p-4 bg-sky-500/10 rounded-2xl text-sky-400">
                                                                <Paperclip size={32} />
                                                            </div>
                                                            <div className="text-center">
                                                                <p className="text-white font-bold">Drop to Attach</p>
                                                                <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest mt-1">Context Injection</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                <div
                                                    ref={scrollRef}
                                                    className="flex-1 overflow-y-auto overflow-x-hidden p-7 space-y-8 custom-scrollbar bg-foreground/[0.02] relative"
                                                    onScroll={(e) => {
                                                        const target = e.target as HTMLDivElement;
                                                        const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 100;
                                                        setShowScrollButton(!isNearBottom && messages.length > 3);
                                                    }}
                                                >
                                                    {messages.length === 0 && (
                                                        <div className="h-full flex flex-col items-center justify-center text-center space-y-6 px-12 relative">
                                                            {/* Animated gradient background */}
                                                            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                                                                <motion.div
                                                                    animate={{
                                                                        background: [
                                                                            'radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.15) 0%, transparent 50%)',
                                                                            'radial-gradient(circle at 80% 50%, rgba(139, 92, 246, 0.15) 0%, transparent 50%)',
                                                                            'radial-gradient(circle at 50% 80%, rgba(236, 72, 153, 0.15) 0%, transparent 50%)',
                                                                            'radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.15) 0%, transparent 50%)',
                                                                        ]
                                                                    }}
                                                                    transition={{
                                                                        duration: 10,
                                                                        repeat: Infinity,
                                                                        ease: "linear"
                                                                    }}
                                                                    className="absolute inset-0"
                                                                />
                                                            </div>

                                                            <div className="relative group">
                                                                <div className="absolute inset-0 bg-gradient-to-r from-sky-500/20 via-emerald-500/20 to-amber-400/20 blur-3xl rounded-full scale-150 group-hover:scale-[2] transition-all duration-1000" />
                                                                <motion.div
                                                                    animate={{
                                                                        rotate: [0, 360],
                                                                        scale: [1, 1.05, 1]
                                                                    }}
                                                                    transition={{
                                                                        rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                                                                        scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                                                                    }}
                                                                    className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center border border-white/20 text-sky-400 relative z-10 shadow-2xl backdrop-blur-xl"
                                                                >
                                                                    <Sparkles size={48} className="drop-shadow-2xl" />
                                                                </motion.div>
                                                            </div>
                                                            <div className="space-y-2 relative z-10">
                                                                <motion.p
                                                                    initial={{ opacity: 0, y: 10 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    transition={{ delay: 0.2 }}
                                                                    className="text-white/60 text-sm font-semibold"
                                                                >
                                                                    Premium AI Assistant
                                                                </motion.p>
                                                                <motion.p
                                                                    initial={{ opacity: 0, y: 10 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    transition={{ delay: 0.3 }}
                                                                    className="text-white/40 text-[10px] leading-relaxed uppercase tracking-[0.3em] font-bold"
                                                                >
                                                                    Agent Ready
                                                                </motion.p>
                                                            </div>
                                                            <motion.div
                                                                initial={{ opacity: 0, y: 20 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ delay: 0.4 }}
                                                                className="grid grid-cols-1 gap-3 w-full pt-4 relative z-10"
                                                            >
                                                                <motion.button
                                                                    onClick={() => setInput('/scaffold-vite')}
                                                                    className="group p-5 bg-sky-600/10 border border-sky-500/20 rounded-2xl text-left transition-all hover:bg-sky-600/20 hover:border-sky-500/30 shadow-xl shadow-sky-500/5 backdrop-blur-xl relative overflow-hidden"
                                                                >
                                                                    <div className="absolute inset-0 bg-gradient-to-r from-sky-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                    <div className="relative flex items-center gap-4">
                                                                        <div className="p-3 bg-sky-600/20 rounded-xl text-sky-400 group-hover:scale-110 transition-transform">
                                                                            <Compass size={22} />
                                                                        </div>
                                                                        <div className="flex-1">
                                                                            <h4 className="text-[11px] font-black text-white uppercase tracking-widest mb-1">Create New App or Feature</h4>
                                                                            <p className="text-[10px] text-white/40 leading-relaxed font-medium">Scaffold a modern app stack from scratch with one click.</p>
                                                                        </div>
                                                                        <ChevronRight size={18} className="text-white/20 group-hover:translate-x-1 group-hover:text-sky-400 transition-all" />
                                                                    </div>
                                                                </motion.button>

                                                                {quickTips.map((tip, ix) => (
                                                                    <motion.button
                                                                        key={ix}
                                                                        initial={{ opacity: 0, x: -20 }}
                                                                        animate={{ opacity: 1, x: 0 }}
                                                                        transition={{ delay: 0.5 + ix * 0.1 }}
                                                                        onClick={() => setInput(tip.text)}
                                                                        className="group p-4 bg-gradient-to-br from-white/[0.08] to-white/[0.03] border border-white/10 rounded-2xl text-left text-xs text-white/50 hover:text-white/90 hover:border-white/20 hover:from-white/[0.12] hover:to-white/[0.06] transition-all duration-300 active:scale-[0.98] backdrop-blur-xl shadow-lg hover:shadow-xl relative overflow-hidden"
                                                                    >
                                                                        <div className="absolute inset-0 bg-gradient-to-r from-sky-500/0 via-emerald-500/5 to-amber-400/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                                                        <div className="relative flex items-center gap-3">
                                                                            <span className="text-2xl">{tip.icon}</span>
                                                                            <span className="flex-1 font-medium">{tip.text}</span>
                                                                            <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                        </div>
                                                                    </motion.button>
                                                                ))}
                                                            </motion.div>
                                                        </div>
                                                    )}

                                                    {messages.map((msg, i) => (
                                                        <MessageBubble
                                                            key={i}
                                                            msg={msg}
                                                            attachedFiles={attachedFiles}
                                                            showThinking={showThinkingTrace}
                                                            onApprove={handleApproveJob}
                                                            setInput={setInput}
                                                            setActiveTool={setActiveTool}
                                                        />
                                                    ))}

                                                    {sessionActivities.length > 0 && (
                                                        <CognitiveTimeline activities={sessionActivities} />
                                                    )}

                                                    {isLoading && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            className="flex flex-col items-start gap-2"
                                                        >
                                                            <div className="relative group">
                                                                {/* Glow effect */}
                                                                <div className="absolute inset-0 bg-gradient-to-r from-sky-500/20 via-emerald-500/20 to-amber-400/20 rounded-[1.5rem] blur-xl opacity-60 group-hover:opacity-100 transition-opacity" />

                                                                <div className="relative bg-gradient-to-br from-white/[0.08] to-white/[0.03] px-6 py-5 rounded-[1.5rem] text-white/40 flex items-center gap-4 rounded-tl-none border border-white/10 backdrop-blur-xl shadow-2xl">
                                                                    <div className="flex gap-1.5">
                                                                        <motion.span
                                                                            animate={{
                                                                                scale: [1, 1.3, 1],
                                                                                opacity: [0.3, 1, 0.3]
                                                                            }}
                                                                            transition={{ repeat: Infinity, duration: 1.2 }}
                                                                            className="w-2.5 h-2.5 bg-gradient-to-r from-sky-400 to-emerald-400 rounded-full shadow-lg shadow-sky-400/50"
                                                                        />
                                                                        <motion.span
                                                                            animate={{
                                                                                scale: [1, 1.3, 1],
                                                                                opacity: [0.3, 1, 0.3]
                                                                            }}
                                                                            transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }}
                                                                            className="w-2.5 h-2.5 bg-gradient-to-r from-emerald-400 to-amber-300 rounded-full shadow-lg shadow-emerald-400/50"
                                                                        />
                                                                        <motion.span
                                                                            animate={{
                                                                                scale: [1, 1.3, 1],
                                                                                opacity: [0.3, 1, 0.3]
                                                                            }}
                                                                            transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }}
                                                                            className="w-2.5 h-2.5 bg-gradient-to-r from-amber-300 to-sky-400 rounded-full shadow-lg shadow-amber-300/50"
                                                                        />
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                        <span className="text-xs font-bold tracking-widest uppercase bg-gradient-to-r from-sky-300 via-emerald-300 to-amber-300 bg-clip-text text-transparent">
                                                                            {isBackgroundBusy ? (backgroundJobLabel || "Computing") : "Computing"}...
                                                                        </span>
                                                                        {isBackgroundBusy && backgroundJobLabel && (
                                                                            <span className="text-[8px] text-white/30 uppercase tracking-widest font-bold mt-0.5">
                                                                                Background Specialist Active
                                                                            </span>
                                                                        )}
                                                                        {backgroundJobMessage && (
                                                                            <span className="text-[10px] text-white/50 mt-1 italic max-w-[300px] truncate block font-mono">
                                                                                {backgroundJobMessage}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </div>

                                                {/* Premium Scroll to Bottom Button */}
                                                <AnimatePresence>
                                                    {showScrollButton && (
                                                        <motion.button
                                                            initial={{ opacity: 0, y: 20, scale: 0.8 }}
                                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                                            exit={{ opacity: 0, y: 20, scale: 0.8 }}
                                                            onClick={() => {
                                                                scrollRef.current?.scrollTo({
                                                                    top: scrollRef.current.scrollHeight,
                                                                    behavior: 'smooth'
                                                                });
                                                            }}
                                                            className="absolute bottom-24 right-8 z-20 p-3 bg-gradient-to-r from-sky-600 to-emerald-500 hover:from-sky-500 hover:to-emerald-400 rounded-full shadow-2xl shadow-sky-500/50 hover:shadow-sky-500/70 border border-white/20 backdrop-blur-xl transition-all duration-300 hover:scale-110 active:scale-95 group"
                                                            title="Scroll to bottom"
                                                        >
                                                            <ArrowDown size={20} className="text-white group-hover:animate-bounce" />
                                                            <div className="absolute inset-0 bg-gradient-to-r from-sky-400/20 to-emerald-400/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </motion.button>
                                                    )}
                                                </AnimatePresence>

                                                {/* Input Area - Premium Design */}
                                                <div className="relative p-6 border-t border-white/10 bg-gradient-to-b from-black/20 to-black/60 backdrop-blur-xl">
                                                    {/* Gradient accent line */}
                                                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sky-500/50 to-transparent" />

                                                    {activeQuestions.length > 0 && (
                                                        <QuestionWizard
                                                            questions={activeQuestions}
                                                            onSubmit={handleQuestionSubmit}
                                                            onCancel={() => setDismissedQuestionId(messages[messages.length - 1]?.id || null)}
                                                        />
                                                    )}

                                                    <div className="flex flex-col gap-3">
                                                        <form onSubmit={handleSend} className="relative group/input">
                                                            {/* Glow effect on focus */}
                                                            <div className="absolute -inset-0.5 bg-gradient-to-r from-sky-500/20 via-emerald-500/20 to-amber-400/20 rounded-[1.25rem] opacity-0 group-focus-within/input:opacity-100 blur-xl transition-opacity duration-500" />

                                                            <div className="relative">
                                                                <div className="mb-2 flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[9px] uppercase tracking-[0.2em] text-white/30 font-bold">Agent</span>
                                                                        {isSwitchingAgent && <Loader2 size={12} className="animate-spin text-sky-400" />}
                                                                    </div>
                                                                    <select
                                                                        value={activeAgentId}
                                                                        onChange={(e) => handleSetActive(e.target.value)}
                                                                        disabled={prompts.length === 0 || isSwitchingAgent}
                                                                        className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-[10px] text-white/80 focus:outline-none focus:border-sky-500/40"
                                                                        title="Switch agent"
                                                                    >
                                                                        {prompts.length === 0 && <option value="">No agents</option>}
                                                                        {prompts.map(p => (
                                                                            <option key={p.id} value={p.id} className="bg-[color:var(--card)] text-foreground">
                                                                                {p.name}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                <textarea
                                                                    rows={1}
                                                                    value={input}
                                                                    onChange={(e) => setInput(e.target.value)}
                                                                    onKeyDown={handleInputKeyDown}
                                                                    placeholder={isBackgroundBusy ? "Background agent active. You can continue chatting..." : "Ask anything..."}
                                                                    className={cn(
                                                                        "relative z-20 w-full bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-[1.25rem] py-4 pl-5 text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:border-sky-500/40 focus:bg-white/[0.08] transition-all duration-300 resize-none shadow-2xl shadow-black/20 font-medium",
                                                                        isBackgroundBusy ? "pr-24" : "pr-14"
                                                                    )}
                                                                    style={{
                                                                        minHeight: '52px',
                                                                        maxHeight: '200px'
                                                                    }}
                                                                />
                                                                {isCommandMenuOpen && filteredCommands.length > 0 && (
                                                                    <div className="absolute bottom-full mb-3 left-0 w-full z-10 bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                                                                        <div className="text-[10px] text-white/40 px-4 py-2 border-b border-white/5 uppercase tracking-widest">Commands</div>
                                                                        <div className="max-h-52 overflow-y-auto">
                                                                            {filteredCommands.map((cmd, idx) => (
                                                                                <button
                                                                                    key={cmd.command}
                                                                                    onClick={() => applyCommand(cmd.command)}
                                                                                    className={cn(
                                                                                        "w-full text-left px-4 py-2 flex items-center justify-between text-xs transition-colors",
                                                                                        idx === activeCommandIndex ? "bg-white/10 text-white" : "text-white/60 hover:text-white hover:bg-white/5"
                                                                                    )}
                                                                                >
                                                                                    <div>
                                                                                        <div className="font-mono text-[11px]">{cmd.command}</div>
                                                                                        <div className="text-[10px] text-white/40">{cmd.description}</div>
                                                                                    </div>
                                                                                    <span className="text-[10px] text-white/30">{cmd.label}</span>
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {isBackgroundBusy && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={handleStopAgents}
                                                                        className="absolute right-14 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all duration-300 shadow-xl shadow-red-500/40 group/stop"
                                                                        title="Stop all agent activity"
                                                                    >
                                                                        <Square size={14} fill="white" className="group-hover:scale-110 transition-transform" />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    type="submit"
                                                                    disabled={!input.trim() && attachedFiles.length === 0}
                                                                    className={cn(
                                                                        "absolute right-2 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-xl transition-all duration-300 shadow-lg",
                                                                        input.trim() || attachedFiles.length > 0
                                                                            ? isLoading
                                                                                ? "bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-500 hover:to-emerald-500 hover:scale-110 active:scale-95 shadow-green-500/50"
                                                                                : "bg-gradient-to-r from-sky-600 to-emerald-500 text-white hover:from-sky-500 hover:to-emerald-400 hover:scale-110 active:scale-95 shadow-sky-500/50"
                                                                            : "bg-white/5 text-white/20 cursor-not-allowed"
                                                                    )}
                                                                    title={isLoading ? "Queue next message" : "Send message"}
                                                                >
                                                                    <Send size={16} className={input.trim() || attachedFiles.length > 0 ? "animate-pulse" : ""} />
                                                                </button>
                                                            </div>

                                                            {/* Character count / hint */}
                                                            {input.length > 0 && (
                                                                <motion.div
                                                                    initial={{ opacity: 0, y: -10 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    className="absolute -top-6 right-0 text-[9px] text-white/30 font-mono"
                                                                >
                                                                    {input.length} chars
                                                                </motion.div>
                                                            )}
                                                        </form>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ) : view === 'sessions' ? (
                                            <motion.div
                                                key="sessions"
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 20 }}
                                                className="h-full flex flex-col p-7 overflow-y-auto custom-scrollbar bg-foreground/[0.02] space-y-6"
                                            >
                                                {renderSessionsView()}
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                key="prompts"
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 20 }}
                                                className="h-full flex flex-col p-7 overflow-y-auto custom-scrollbar bg-foreground/[0.02] space-y-6"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-white font-bold text-xl tracking-tight leading-none uppercase text-[12px] opacity-40 font-black">Agent Archetypes</h4>
                                                    <button
                                                        onClick={() => {
                                                            setEditingPromptId(null);
                                                            setNewPrompt({ name: '', description: '', prompt: '', tools: DEFAULT_SKILLS, workflows: [], triggerKeywords: [] });
                                                            setIsEditorOpen(true);
                                                        }}
                                                        className="p-3 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl shadow-xl shadow-sky-500/20 transition-all active:scale-95"
                                                    >
                                                        <Plus size={20} />
                                                    </button>
                                                </div>

                                                <div className="space-y-4 pb-20">
                                                    {prompts.map(p => {
                                                        const stats = getPromptCapabilityStats(p);
                                                        return (
                                                            <div
                                                                key={p.id}
                                                                className={cn(
                                                                    "group relative overflow-hidden p-6 rounded-[2.5rem] border transition-all",
                                                                    p.isActive
                                                                        ? "bg-gradient-to-br from-sky-600/20 to-emerald-600/20 border-sky-500/40 shadow-xl shadow-sky-500/10"
                                                                        : "bg-white/5 border-white/5 hover:border-white/10"
                                                                )}
                                                            >
                                                                <div className="flex items-start justify-between relative z-10 gap-4">
                                                                    <div className="space-y-1 flex-1">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-white font-bold text-lg leading-tight">{p.name}</span>
                                                                            {p.isActive && (
                                                                                <div className="px-2 py-0.5 bg-emerald-500 rounded-full text-[8px] font-black uppercase text-white shadow-lg tracking-widest">
                                                                                    Tactical
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-xs text-white/40 leading-relaxed max-w-[280px] line-clamp-2">
                                                                            {p.description || "Experimental prompt template."}
                                                                        </p>
                                                                        <div className="mt-2 flex items-center gap-2 text-[9px] text-white/30">
                                                                            <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10">Tools {stats.toolIds.length}</span>
                                                                            <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10">Skills {stats.skillIds.length}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex flex-col gap-2 shrink-0">
                                                                        <div className="flex gap-2">
                                                                            <button
                                                                                onClick={() => startEditing(p)}
                                                                                className="p-2.5 bg-white/5 text-white/40 hover:bg-white/20 hover:text-white rounded-xl transition-all border border-white/5"
                                                                                title="Edit Instructions"
                                                                            >
                                                                                <Edit2 size={16} />
                                                                            </button>
                                                                        </div>
                                                                        <div className="flex gap-2 items-center">
                                                                            {!p.isActive && (
                                                                                <button
                                                                                    onClick={() => handleSetActive(p.id)}
                                                                                    className="flex-1 py-1.5 px-3 bg-sky-500/20 text-sky-400 hover:bg-sky-500 hover:text-white rounded-xl transition-all shadow-lg text-[9px] font-black uppercase tracking-widest"
                                                                                >
                                                                                    Deploy
                                                                                </button>
                                                                            )}
                                                                            <button
                                                                                onClick={() => handleDeletePrompt(p.id)}
                                                                                className="p-2.5 bg-red-500/10 text-red-100/20 hover:bg-red-500 hover:text-white rounded-xl transition-all border border-red-500/10"
                                                                            >
                                                                                <Trash2 size={16} />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Preview snippet */}
                                                                <div className="mt-4 p-4 bg-black/40 rounded-2xl border border-white/5 text-[10px] text-white/30 font-mono line-clamp-2 leading-relaxed italic">
                                                                    {p.prompt}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </motion.div>
                        )
                        }
                    </AnimatePresence>

                    {/* Float Button */}
                    <motion.button
                        layoutId="ai-trigger"
                        whileHover={{ scale: 1.05, y: -4 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsOpen(!isOpen)}
                        className={
                            cn(
                                "p-4 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center gap-3 transition-all border backdrop-blur-xl relative overflow-hidden group",
                                isOpen
                                    ? "bg-zinc-900 border-white/10 text-white/50"
                                    : "bg-gradient-to-br from-sky-600 to-emerald-600 border-sky-400/30 text-white"
                            )
                        }
                    >
                        <div className="relative">
                            <Bot size={24} className={cn(isOpen ? "rotate-90 opacity-40" : "animate-pulse")} />
                            {attachedFiles.length > 0 && (
                                <span className="absolute -top-2 -right-2 w-4 h-4 bg-emerald-500 text-[8px] font-black rounded-full flex items-center justify-center shadow-xl ring-2 ring-white/20">
                                    {attachedFiles.length}
                                </span>
                            )}
                        </div>
                        {
                            !isOpen && (
                                <div className="flex flex-col items-start pr-2">
                                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] leading-none mb-1 opacity-60">Signal</span>
                                    <span className="text-sm font-bold tracking-tight">Agent Hub</span>
                                </div>
                            )
                        }
                    </motion.button>
                </div>
            )
            }

            {/* Global Modals - Rendered outside of layout containers to avoid clipping */}
            {isSettingsModalOpen && (
                <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                        onClick={() => setIsSettingsModalOpen(false)}
                    />
                    <div className="relative w-full max-w-2xl rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] shadow-2xl backdrop-blur-2xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[color:var(--border)]">
                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Chat Settings</h3>
                                <p className="text-[11px] text-muted-foreground">Configure scope, model, and response behavior.</p>
                            </div>
                            <button
                                onClick={() => setIsSettingsModalOpen(false)}
                                className="p-2 rounded-lg hover:bg-white/5 text-foreground/60 hover:text-foreground transition-colors"
                                title="Close settings"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="space-y-2">
                                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Scope</div>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => setChatScope('workspace')}
                                        className={cn(
                                            "px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-colors border",
                                            chatScope === 'workspace' ? "bg-sky-500/20 text-sky-200 border-sky-500/30" : "text-white/50 border-white/10 hover:text-white"
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Folder size={14} />
                                            File Manager
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => setChatScope('repo')}
                                        className={cn(
                                            "px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-colors border",
                                            chatScope === 'repo' ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/30" : "text-white/50 border-white/10 hover:text-white"
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <GitBranch size={14} />
                                            Repo Apps
                                        </div>
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Model</div>
                                <div className="flex items-center gap-3 rounded-xl border border-[color:var(--border)] bg-white/5 px-3 py-2">
                                    <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Model</span>
                                    <select
                                        value={selectedModel}
                                        onChange={(e) => setSelectedModel(e.target.value)}
                                        className="bg-transparent text-[12px] text-foreground/80 font-semibold tracking-wide focus:outline-none w-full"
                                        title="Select model"
                                    >
                                        {MODEL_CATALOG.map(model => (
                                            <option key={model.id} value={model.id} className="bg-[color:var(--card)] text-foreground">
                                                {model.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold">Thinking Trace</div>
                                    <button
                                        onClick={() => setShowThinkingTrace(prev => !prev)}
                                        className={cn(
                                            "w-full px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-colors border flex items-center justify-between",
                                            showThinkingTrace ? "bg-sky-500/20 text-sky-200 border-sky-500/30" : "text-white/50 border-white/10 hover:text-white"
                                        )}
                                    >
                                        <span>{showThinkingTrace ? 'Shown' : 'Hidden'}</span>
                                        <Eye size={16} />
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold">Verbosity</div>
                                    <div className="flex items-center gap-2">
                                        {(['concise', 'normal', 'verbose'] as const).map(level => (
                                            <button
                                                key={level}
                                                onClick={() => setVerbosity(level)}
                                                className={cn(
                                                    "flex-1 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors border",
                                                    verbosity === level
                                                        ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/30"
                                                        : "text-white/50 border-white/10 hover:text-white"
                                                )}
                                            >
                                                {level}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[color:var(--border)]">
                                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                                    Shortcut: Shift + ,
                                </div>
                                <button
                                    onClick={() => {
                                        setView('prompts');
                                        setIsCreatingPrompt(false);
                                        setEditingPromptId(null);
                                        setNewPrompt({
                                            name: '',
                                            description: '',
                                            prompt: '',
                                            tools: DEFAULT_SKILLS,
                                            workflows: [],
                                            triggerKeywords: []
                                        });
                                        setIsSettingsModalOpen(false);
                                    }}
                                    className="px-4 py-2 rounded-xl bg-white/5 border border-[color:var(--border)] text-[11px] font-bold uppercase tracking-wider text-foreground/70 hover:text-foreground hover:bg-white/10 transition-colors"
                                >
                                    Manage Prompts
                                </button>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setIsSettingsModalOpen(false)}
                                        className="px-4 py-2 rounded-xl bg-sky-500/80 hover:bg-sky-500 text-[11px] font-bold uppercase tracking-wider text-white transition-colors"
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <PromptEditorModal
                isOpen={isEditorOpen}
                onClose={() => {
                    setIsEditorOpen(false);
                    setEditingPromptId(null);
                }}
                onSave={handleSavePrompt}
                initialData={editingPromptId ? newPrompt : undefined}
                customIntents={intentRules as unknown as import('@/lib/intentLibrary').IntentRuleDefinition[]}
            />
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    if (isDeletingSession) return;
                    setIsDeleteModalOpen(false);
                    setPendingDeleteSessionId(null);
                }}
                onConfirm={confirmDeleteSession}
                title="Delete chat?"
                message="Deleting chats is a premium feature. This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                isDanger
                isLoading={isDeletingSession}
            />
            <ConfirmationModal
                isOpen={isClearAllModalOpen}
                onClose={() => {
                    if (isClearingAll) return;
                    setIsClearAllModalOpen(false);
                }}
                onConfirm={confirmClearAllSessions}
                title="Clear all chats?"
                message="This will permanently delete all your chat history. This action cannot be undone."
                confirmText="Clear All"
                cancelText="Cancel"
                isDanger
                isLoading={isClearingAll}
            />
            <FileEditPreviewModal
                isOpen={isEditPreviewOpen}
                onClose={() => setIsEditPreviewOpen(false)}
                fileName={editPreviewData.fileName}
                content={editPreviewData.content}
            />
            <SuggestionsLibraryModal
                isOpen={isSuggestionsOpen}
                onClose={() => setIsSuggestionsOpen(false)}
                onApply={handleApplySuggestion}
                workflowContext={{
                    messages: messages.slice(-10), // Last 10 messages
                    attachedFiles: attachedFiles.map(f => ({ id: f.id, name: f.name, type: f.type })),
                    activePrompt: activePrompt ? { name: activePrompt.name, description: activePrompt.description } : undefined
                }}
                workflowType="task-planning"
            />
        </>
    );
}
