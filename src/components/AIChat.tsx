
'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, X, Loader2, Paperclip, MessageSquare, Sparkles, BrainCircuit, FileText, Image as ImageIcon, ExternalLink, Settings, Plus, Check, Trash2, ChevronRight, Layout, Edit2, Pin, PinOff, Folder, Search, Receipt, DollarSign, Save, AlignLeft, Copy, ArrowDown } from 'lucide-react';
import { chatWithAI, getPrompts, createPrompt, updatePrompt, setActivePrompt, deletePrompt, generateSystemPrompt, getIntentRules, getWorkspaceFiles, getChatSessionAgentStatus, approveLatestAgentJob } from '@/app/actions';
import { createChatSession, getChatSessions, getChatSession, addChatMessage, updateChatSessionTitle, deleteChatSession } from '@/app/chatActions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TOOL_LIBRARY, DEFAULT_TOOLS } from '@/lib/toolLibrary';
import type { WorkspaceFile, AIPromptSet, IntentRule } from '@prisma/client';
import PromptEditorModal from './PromptEditorModal';
import ConfirmationModal from './ConfirmationModal';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { normalizeMarkdown, hasMarkdownTable } from '@/utils/markdownUtils';
import FileEditPreviewModal from './FileEditPreviewModal';
import EmojiCelebration from './EmojiCelebration';

export type SelectedFile = {
    id: string;
    name: string;
    type: string;
};

const ToolResultPreview = ({ tool, result }: { tool: string; result: any }) => {
    if (!result || !result.success) return null;

    if (tool === 'extract_receipt_info' && result.extractedData) {
        const data = result.extractedData;
        return (
            <div className="mt-4 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 space-y-4 shadow-inner">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-blue-400">
                        <Receipt size={14} />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Fiscal Intelligence</span>
                    </div>
                    {data.date && <span className="text-[9px] text-white/30 font-bold uppercase">{data.date}</span>}
                </div>

                <div className="grid grid-cols-2 gap-6 pb-2">
                    <div className="space-y-1">
                        <p className="text-[8px] text-white/20 uppercase font-black tracking-widest">Provider</p>
                        <p className="text-sm text-white font-bold truncate leading-none">{data.provider}</p>
                    </div>
                    <div className="space-y-1 text-right">
                        <p className="text-[8px] text-white/20 uppercase font-black tracking-widest">Total Amount</p>
                        <p className="text-xl text-emerald-400 font-black leading-none">${data.total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                    <div className="space-y-1">
                        <p className="text-[8px] text-white/20 uppercase font-black tracking-widest">RNC Identification</p>
                        <p className="text-[11px] text-white/60 font-mono">{data.rnc || 'N/A'}</p>
                    </div>
                    <div className="space-y-1 text-right">
                        <p className="text-[8px] text-white/20 uppercase font-black tracking-widest">NCF Sequence</p>
                        <p className="text-[11px] text-white/60 font-mono">{data.ncf || 'N/A'}</p>
                    </div>
                </div>

                <button
                    onClick={() => window.dispatchEvent(new CustomEvent('focus-workspace-item', { detail: { itemId: result.fileId } }))}
                    className="w-full py-2 mt-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] text-white/40 hover:text-white transition-all border border-white/5 flex items-center justify-center gap-2"
                >
                    <Search size={12} />
                    <span>View Original File</span>
                </button>
            </div>
        );
    }

    if (tool === 'summarize_file' && result.summary) {
        return (
            <div className="mt-4 p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 space-y-3 shadow-inner">
                <div className="flex items-center gap-2 text-indigo-400">
                    <AlignLeft size={14} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Abstract Summary</span>
                </div>
                <div className="relative">
                    <p className="text-xs text-white/70 italic leading-relaxed tracking-tight pl-4 border-l-2 border-indigo-500/30">
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

    if (tool === 'search_web') {
        if (result.type === 'image' && result.results) {
            return (
                <div className="mt-4 space-y-3">
                    <p className="text-[10px] uppercase font-bold text-white/40 tracking-widest pl-1">Image Result</p>
                    <div className="grid grid-cols-2 gap-2">
                        {result.results.map((img: any, i: number) => (
                            <div key={i} className="relative group overflow-hidden rounded-xl bg-black/20 aspect-video border border-white/5 hover:border-blue-500/50 transition-all">
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
                <div className="mt-4 space-y-3">
                    <p className="text-[10px] uppercase font-bold text-white/40 tracking-widest pl-1">Web Search Result</p>
                    <div className="space-y-2">
                        {result.results.map((item: any, i: number) => (
                            <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group">
                                <h4 className="text-xs font-bold text-blue-300 group-hover:text-blue-200 mb-1">{item.title}</h4>
                                <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-white/30 hover:text-white/50 mb-2 block truncate font-mono">{item.url}</a>
                                <p className="text-[11px] text-white/70 leading-relaxed line-clamp-2">{item.snippet}</p>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
    }

    return null;
}; const ThinkingProcess = ({ content }: { content: string }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="mb-4 overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] transition-all">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors group"
            >
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-400 group-hover:scale-110 transition-transform">
                        <BrainCircuit size={14} />
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 leading-none mb-1">Intelligence Trace</p>
                        <p className="text-[9px] text-white/20 font-bold uppercase truncate max-w-[200px]">
                            {isExpanded ? "Synthesizing full tactical plan..." : content.split('\n')[0].slice(0, 50) + "..."}
                        </p>
                    </div>
                </div>
                <div className={cn("transition-transform duration-300", isExpanded ? "rotate-90" : "")}>
                    <ChevronRight size={14} className="text-white/20" />
                </div>
            </button>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-4 pb-4"
                    >
                        <div className="pt-2 border-t border-white/5">
                            <p className="text-[11px] text-white/50 leading-relaxed font-mono whitespace-pre-wrap">
                                {content}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const AgentStepBadge = ({ tool, status }: { tool: string, status: 'executing' | 'done' | 'failed' }) => {
    return (
        <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all mb-2 w-fit",
            status === 'executing' ? "bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse" :
                status === 'done' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                    "bg-red-500/10 border-red-500/20 text-red-400"
        )}>
            {status === 'executing' ? <Loader2 size={12} className="animate-spin" /> :
                status === 'done' ? <Check size={12} /> : <X size={12} />}
            <span className="text-[10px] font-black uppercase tracking-widest">
                {status === 'executing' ? 'Analyzing' : 'Complete'}: {tool.replace(/_/g, ' ')}
            </span>
        </div>
    );
};

const MessageBubble = ({
    msg,
    attachedFiles,
    setInput,
    setActiveTool,
    isBackgroundBusy,
    onApprove,
    hasMarkdownTable,
    normalizeMarkdown,
    remarkGfm,
    ToolResultPreview
}: {
    msg: any,
    attachedFiles: SelectedFile[],
    setInput: (s: string) => void,
    setActiveTool: (s: string | null) => void,
    isBackgroundBusy: boolean,
    onApprove: () => void,
    hasMarkdownTable: (s: string) => boolean,
    normalizeMarkdown: (s: string) => string,
    remarkGfm: any,
    ToolResultPreview: any
}) => {
    const fileMeta = (() => {
        const file = msg?.toolResult?.file;
        if (file?.name) return { name: file.name as string, type: file.type as string | undefined };
        if (msg?.toolResult?.fileName) {
            const name = msg.toolResult.fileName as string;
            return { name, type: name.split('.').pop()?.toLowerCase() };
        }
        if (msg?.toolArgs?.filename) {
            const name = msg.toolArgs.filename as string;
            return { name, type: name.split('.').pop()?.toLowerCase() };
        }
        if (msg?.toolArgs?.fileId && typeof msg.toolArgs.fileId === 'string' && msg.toolArgs.fileId.includes('.')) {
            const name = msg.toolArgs.fileId as string;
            return { name, type: name.split('.').pop()?.toLowerCase() };
        }
        return null;
    })();

    const FileIcon = fileMeta?.type?.includes('pdf') ? FileText
        : (fileMeta?.type?.includes('png') || fileMeta?.type?.includes('jpg') || fileMeta?.type?.includes('jpeg') || fileMeta?.type?.includes('image')) ? ImageIcon
            : (fileMeta?.type?.includes('html') ? Layout : FileText);

    return (
        <div className={cn(
            "flex flex-col gap-2 max-w-[95%] w-full animate-in fade-in slide-in-from-bottom-2 duration-500",
            msg.role === 'user' ? "ml-auto items-end" : "items-start"
        )}>
            {msg.files && msg.files.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-1 justify-end">
                    {msg.files.map((f: any) => (
                        <div key={f.id} className="flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 rounded-lg text-[9px] text-blue-300 border border-blue-500/20 shadow-lg">
                            {f.type === 'pdf' ? <FileText size={10} /> : <ImageIcon size={10} />}
                            {f.name}
                        </div>
                    ))}
                </div>
            )}

            {msg.role === 'ai' && msg.thinking && (
                <ThinkingProcess content={msg.thinking} />
            )}

            {msg.role === 'ai' && msg.toolUsed && (
                <AgentStepBadge tool={msg.toolUsed} status="done" />
            )}

            <div className={cn(
                "px-6 py-5 rounded-[1.8rem] text-[13px] leading-relaxed relative group/msg transition-all duration-300",
                msg.role === 'user'
                    ? "bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 text-white rounded-tr-none shadow-2xl shadow-blue-500/20 hover:shadow-blue-500/30 border border-blue-400/20"
                    : "bg-gradient-to-br from-white/[0.05] to-white/[0.02] text-white/90 rounded-tl-none border border-white/10 backdrop-blur-xl shadow-2xl hover:bg-white/[0.08] hover:border-white/20 agent-bubble-glow"
            )}>
                {msg.role === 'ai' && (
                    <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none overflow-hidden">
                        <BrainCircuit size={80} className="neural-glow" />
                    </div>
                )}
                <div className="markdown-content max-w-full overflow-x-hidden break-words relative z-10">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            table: ({ node, ...props }: any) => (
                                <div className="table-container my-4 overflow-x-auto rounded-xl border border-white/5 bg-black/20">
                                    <table {...props} className="text-[11px] w-full border-collapse" />
                                </div>
                            ),
                            a: ({ node, ...props }: any) => (
                                <a {...props} className="text-blue-400 hover:text-blue-300 underline decoration-blue-500/30 underline-offset-4" target="_blank" rel="noopener noreferrer" />
                            ),
                            code: ({ node, ...props }: any) => (
                                <code {...props} className="bg-black/40 px-1.5 py-0.5 rounded text-blue-300 font-mono text-[11px]" />
                            ),
                            p: ({ node, ...props }: any) => (
                                <p {...props} className="mb-3 last:mb-0" />
                            )
                        }}
                    >
                        {normalizeMarkdown(msg.content)}
                    </ReactMarkdown>
                </div>

                {msg.role === 'ai' && msg.toolUsed && (
                    <div className="pt-2 border-t border-white/5 mt-4">
                        <ToolResultPreview tool={msg.toolUsed} result={msg.toolResult} />
                    </div>
                )}

                {msg.role === 'ai' && fileMeta && (
                    <div className="mt-3 flex items-center gap-2 text-[10px] text-white/40">
                        <FileIcon size={12} className="text-blue-300/70" />
                        <span className="truncate">{fileMeta.name}</span>
                    </div>
                )}

                {/* Premium Copy Button & Timestamp for AI messages */}
                {msg.role === 'ai' && (
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(msg.content);
                                    toast.success('Copied to clipboard!');
                                }}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/40 hover:text-white/80 transition-all duration-300 group"
                                title="Copy message"
                            >
                                <Copy size={11} className="group-hover:scale-110 transition-transform" />
                                <span className="text-[9px] font-medium uppercase tracking-wider">Copy</span>
                            </button>

                            {/* Quick Reactions */}
                            <div className="flex items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                                {['👍', '❤️', '🎉', '🤔'].map((emoji) => (
                                    <button
                                        key={emoji}
                                        onClick={() => {
                                            toast.success(`Reacted with ${emoji}`);
                                            if (typeof window !== 'undefined') {
                                                window.dispatchEvent(new CustomEvent('emoji-celebration', { detail: { emoji } }));
                                            }
                                        }}
                                        className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 flex items-center justify-center text-xs hover:scale-125 active:scale-95 transition-all duration-200"
                                        title={`React with ${emoji}`}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="text-[9px] text-white/20 font-mono">
                            {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                )}

                {msg.role === 'ai' && (
                    <div className="mt-4 flex flex-wrap gap-2">
                        {msg.toolUsed === 'enqueue_agent_job' && !isBackgroundBusy && (
                            <button
                                onClick={onApprove}
                                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl text-[10px] text-emerald-300 hover:text-white transition-all border border-emerald-500/20"
                                title="Approve and run the background job"
                            >
                                <Check size={12} />
                                <span>Approve</span>
                            </button>
                        )}
                        {(() => {
                            const planCue = /\b(plan|steps|strategy|approach|outline|proposed)\b/i.test(msg.content);
                            const queuedWork = msg.toolUsed === 'enqueue_agent_job';
                            return (planCue || queuedWork) && !isBackgroundBusy;
                        })() && (
                                <button
                                    onClick={() => {
                                        setInput('Please delegate to a UI/UX designer to review the frontend and visual design.');
                                        setActiveTool('agent_delegate');
                                    }}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl text-[10px] text-emerald-300 hover:text-white transition-all border border-emerald-500/20"
                                    title="Request a UI/UX design review"
                                >
                                    <Sparkles size={12} />
                                    <span>Request Design Review</span>
                                </button>
                            )}
                        {hasMarkdownTable(msg.content) && (
                            <button
                                onClick={() => setInput("Export this table as a markdown file. Please ask me if I want a new folder first.")}
                                className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 rounded-xl text-[10px] text-blue-300 hover:text-white transition-all border border-blue-500/20"
                            >
                                <FileText size={12} />
                                <span>Save as Report</span>
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};



export default function AIChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState<'chat' | 'prompts' | 'sessions'>('chat');
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isBackgroundBusy, setIsBackgroundBusy] = useState(false);
    const [backgroundJobLabel, setBackgroundJobLabel] = useState<string | null>(null);
    const [messages, setMessages] = useState<{
        id?: string;
        role: 'user' | 'ai';
        content: string;
        files?: SelectedFile[];
        toolUsed?: string;
        toolResult?: any;
        thinking?: string;
        toolArgs?: any;
    }[]>([]);
    const streamSpeedRef = useRef(14);
    const [attachedFiles, setAttachedFiles] = useState<SelectedFile[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [prompts, setPrompts] = useState<AIPromptSet[]>([]);
    const [intentRules, setIntentRules] = useState<IntentRule[]>([]);
    const [chatSessions, setChatSessions] = useState<any[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [activeSessionTitle, setActiveSessionTitle] = useState('New Chat');
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
    const [currentFolderContext, setCurrentFolderContext] = useState<{ id: string | null, name: string }>({ id: null, name: 'Root' });
    const [promptHistory, setPromptHistory] = useState<string[]>([]);
    const [activePreviewContext, setActivePreviewContext] = useState<{ id: string, name: string, parentId: string | null } | null>(null);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [celebration, setCelebration] = useState<{ emoji: string; timestamp: number } | null>(null);

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

    const scrollRef = useRef<HTMLDivElement>(null);
    const lastBackgroundBusyRef = useRef(false);
    const lastJobStatusRef = useRef<{ id?: string; updatedAt?: number; status?: string }>({});

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
        const res = await getChatSessionAgentStatus(sessionId);
        if (res.success) {
            setIsBackgroundBusy(!!res.busy);
            // Use latest activity title if available, otherwise fall back to job type
            const label = res.latestActivity?.title || res.latestJob?.type || null;
            setBackgroundJobLabel(label);
            return { busy: !!res.busy, latestJob: res.latestJob };
        }
        setIsBackgroundBusy(false);
        setBackgroundJobLabel(null);
        return { busy: false, latestJob: null };
    };

    const syncSessionMessages = async (sessionId: string) => {
        const session = await getChatSession(sessionId);
        if (!session) return;

        const fileIds = Array.from(new Set(session.messages.flatMap(m => m.fileIds || [])));
        const resolvedFiles = await resolveFilesByIds(fileIds);

        setMessages(session.messages.map(m => ({
            id: m.id,
            role: m.role === 'user' ? 'user' as const : 'ai' as const,
            content: m.content,
            files: (m.fileIds?.length ? resolvedFiles.filter(f => m.fileIds.includes(f.id)) : undefined),
            toolUsed: m.toolUsed || undefined
        })));
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
            }
            lastBackgroundBusyRef.current = isBusy;
            if (latestJob?.id) {
                lastJobStatusRef.current = {
                    id: latestJob.id,
                    status: latestJob.status,
                    updatedAt: latestUpdatedAt
                };
            }
        };

        tick();
        const interval = setInterval(tick, 3000);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [activeSessionId, isOpen]);

    const buildSessionTitle = (text: string) => {
        const trimmed = text.trim().replace(/\s+/g, ' ');
        if (!trimmed) return 'New Chat';
        return trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed;
    };

    const resolveFilesByIds = async (ids: string[]) => {
        const sourceFiles = workspaceFiles.length > 0 ? workspaceFiles : ((await getWorkspaceFiles()) as SelectedFile[]);
        const fileMap = new Map(sourceFiles.map(f => [f.id, f]));
        return ids.map(id => fileMap.get(id)).filter(Boolean) as SelectedFile[];
    };

    const openSession = async (sessionId: string) => {
        const session = await getChatSession(sessionId);
        if (!session) return;

        setActiveSessionId(session.id);
        setActiveSessionTitle(session.title || 'New Chat');

        const fileIds = Array.from(new Set(session.messages.flatMap(m => m.fileIds || [])));
        const resolvedFiles = await resolveFilesByIds(fileIds);

        setAttachedFiles(resolvedFiles);
        setMessages(session.messages.map(m => ({
            id: m.id,
            role: m.role === 'user' ? 'user' as const : 'ai' as const,
            content: m.content,
            files: (m.fileIds?.length ? resolvedFiles.filter(f => m.fileIds.includes(f.id)) : undefined),
            toolUsed: m.toolUsed || undefined
        })));

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

    const renderSessionsView = () => (
        <div className="h-full p-6 space-y-4 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-[10px] font-black uppercase text-white/30 tracking-widest">Chats</h4>
                <button
                    onClick={startNewChat}
                    className="p-2 bg-blue-600 rounded-lg text-white"
                    title="New Chat"
                >
                    <Plus size={16} />
                </button>
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
                                isActive ? "bg-blue-600/10 border-blue-500/30" : "bg-white/5 border-white/5 hover:border-white/10"
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
                                        className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
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

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading, isPinned, view]);

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

    const sendMessage = async (text: string) => {
        if (isBackgroundBusy) {
            toast.message('Background agent is working. Please wait for it to finish.');
            return;
        }
        if (!text.trim() && attachedFiles.length === 0) return;

        let sessionId = activeSessionId;

        if (!sessionId) {
            const title = buildSessionTitle(text);
            const sessionRes = await createChatSession(title);
            if (!sessionRes.success || !sessionRes.session) {
                toast.error(sessionRes.message || 'Failed to create chat session');
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

        const userMsg = { role: 'user' as const, content: text, files: [...attachedFiles] };
        setMessages(prev => [...prev, userMsg]);
        setPromptHistory(prev => [text, ...prev]);
        setInput('');
        setHistoryIndex(-1); // Reset history index on send
        // DON'T clear attachedFiles - keep them for context
        // setAttachedFiles([]);
        setActiveTool(null);
        setIsLoading(true);

        if (sessionId) {
            await addChatMessage(sessionId, 'user', userMsg.content, attachedFiles.map(f => f.id));
        }

        try {
            // Prepare history for Gemini format
            const geminiHistory = messages.map(m => ({
                role: m.role === 'user' ? 'user' as const : 'model' as const,
                parts: [{ text: m.content }]
            }));

            // Collect all file IDs from the entire conversation (including current message)
            const allFileIds = new Set<string>();
            [...messages, userMsg].forEach(msg => {
                if (msg.files) {
                    msg.files.forEach(f => allFileIds.add(f.id));
                }
            });

            const contextMsg = activePreviewContext
                ? `[CONTEXT: User is currently PREVIEWING file "${activePreviewContext.name}". Assume changes apply to this app/folder unless specified. If editing, look for files in the same folder as the previewed file.]\n${userMsg.content}`
                : userMsg.content;

            console.log('📤 Sending to AI:', userMsg.content);
            console.log('📎 Files in context:', Array.from(allFileIds));
            console.log('📂 Current Folder:', currentFolderContext.name, currentFolderContext.id);
            const res = await chatWithAI(
                contextMsg,
                Array.from(allFileIds),
                geminiHistory,
                currentFolderContext.name,
                currentFolderContext.id || undefined,
                { sessionId: sessionId || undefined, allowToolExecution: false }
            );
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
                        role: 'ai',
                        content: 'I apologize, but I encountered an issue generating a response. Please try again.'
                    }]);
                } else {
                    const text = res.text as string;
                    const thinkingMatch = text.match(/<thinking>([\s\S]*?)<\/thinking>/);
                    const thinking = thinkingMatch ? thinkingMatch[1].trim() : undefined;
                    const cleanText = text.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
                    const contentToStream = cleanText || text;

                    if (contentToStream) {
                        await streamAssistantMessage(contentToStream, {
                            toolUsed: (res as any).toolUsed,
                            toolResult: (res as any).toolResult,
                            thinking,
                            toolArgs: (res as any).toolArgs
                        });
                    } else {
                        setMessages(prev => [...prev, {
                            role: 'ai',
                            content: text,
                            toolUsed: (res as any).toolUsed,
                            toolResult: (res as any).toolResult,
                            thinking,
                            toolArgs: (res as any).toolArgs
                        }]);
                    }

                    // Auto-open preview for HTML files
                    if ((res as any).toolUsed === 'create_html_file' && (res as any).toolResult?.success && (res as any).toolResult?.file) {
                        console.log('🖼️ Auto-opening preview for HTML file');
                        window.dispatchEvent(new CustomEvent('open-preview-tab', { detail: (res as any).toolResult.file }));
                    }

                    if (sessionId) {
                        await addChatMessage(sessionId, 'ai', res.text as string, [], (res as any).toolUsed, (res as any).thinking);
                    }

                    if ((res as any).toolUsed) {
                        const badge = resolveToolBadge((res as any).toolUsed);
                        const label = badge ? badge.label : (res as any).toolUsed;
                        const prefix = badge?.type === 'workflow' ? 'Workflow Executed' : 'Action Executed';
                        toast.success(`${prefix}: ${label}`);

                        // Trigger edit preview if applicable
                        if ((res as any).toolUsed === 'edit_file' || (res as any).toolUsed === 'create_markdown_file') {
                            if ((res as any).toolArgs) {
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
                console.error('❌ AI Error:', res.message);
                toast.error(res.message || 'AI failed to respond');
                setMessages(prev => [...prev, { role: 'ai', content: `Error: ${res.message || 'Something went wrong.'}` }]);
            }
        } catch (error) {
            console.error('💥 Chat Error:', error);
            toast.error('Connection error');
            setMessages(prev => [...prev, {
                role: 'ai',
                content: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        await sendMessage(input);
    };

    const approveFromBubble = async () => {
        if (!activeSessionId) {
            await sendMessage('approve');
            return;
        }

        try {
            const approval = await approveLatestAgentJob(activeSessionId);
            if (approval.success) {
                const userMsg = { role: 'user' as const, content: 'approve', files: [] as SelectedFile[] };
                const aiMsg = { role: 'ai' as const, content: '✅ Approved. Background agent started.' };
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
        const res = await setActivePrompt(id);
        if (res.success) {
            toast.success('Tactical Context Updated');
            refreshPrompts();
        }
    };

    const handleDeletePrompt = async (id: string) => {
        const res = await deletePrompt(id);
        if (res.success) {
            toast.success('Prompt Purged');
            refreshPrompts();
        }
    };

    const startEditing = (p: AIPromptSet) => {
        setNewPrompt({
            name: p.name,
            description: p.description || '',
            prompt: p.prompt,
            tools: p.tools && p.tools.length > 0 ? p.tools : DEFAULT_TOOLS,
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
                return [...prev, { id: file.id, name: file.name, type: file.type }];
            });
            if (!isOpen) setIsOpen(true);
            toast.success(`Added ${file.name} to AI context`, {
                icon: <Paperclip size={14} className="text-blue-400" />
            });
        };

        const handlePreview = (e: any) => {
            const file = e.detail as WorkspaceFile;
            setAttachedFiles(prev => {
                if (prev.find(f => f.id === file.id)) return prev;
                return [...prev, { id: file.id, name: file.name, type: file.type }];
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

    const togglePin = () => {
        const next = !isPinned;
        setIsPinned(next);
        window.dispatchEvent(new CustomEvent('ai-chat-pin-changed', { detail: next }));
        if (next && !isOpen) setIsOpen(true);
    };

    const activePrompt = prompts.find(p => p.isActive);
    const enabledToolIds = (activePrompt?.tools && activePrompt.tools.length > 0)
        ? activePrompt.tools.filter(id => TOOL_LIBRARY[id])
        : DEFAULT_TOOLS.filter(id => TOOL_LIBRARY[id]);

    const toolPromptById: Record<string, string> = {
        verify_dgii_rnc: 'Verify this business with DGII',
        extract_alegra_bill: 'Extract this receipt to Alegra',
        record_alegra_payment: 'Record a payment for this bill',
        create_markdown_file: 'Save this as a markdown report',
        create_task: 'Create a task from this request'
    };

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

        return [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
    }, [activePrompt?.name]);

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

    if (isPinned) {
        return (
            <>
                <div className="h-full w-[450px] border-l border-white/10 glass-card flex flex-col relative z-20 overflow-hidden">
                    {/* Header (Pinned) */}
                    <div className="p-6 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <BrainCircuit size={20} className="text-blue-400" />
                            <div>
                                <h3 className="font-bold text-white text-xs tracking-tight uppercase">
                                    {activePrompt?.name || "TaskFlow Agent"}
                                </h3>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[8px] text-white/20 uppercase tracking-[0.2em] font-bold">System Online</span>
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
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setView(view === 'sessions' ? 'chat' : 'sessions')}
                                className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors"
                                title="Chat Sessions"
                            >
                                <MessageSquare size={18} />
                            </button>
                            <button
                                onClick={() => setView(view === 'prompts' ? 'chat' : 'prompts')}
                                className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors"
                                title="Agent Prompts"
                            >
                                <Settings size={18} />
                            </button>
                            <button
                                onClick={togglePin}
                                className="p-2 hover:bg-white/5 rounded-lg text-blue-400 transition-colors"
                                title="Unpin from UI"
                            >
                                <PinOff size={18} />
                            </button>
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
                                        <div className="absolute inset-0 z-[100] bg-blue-500/10 backdrop-blur-sm border-2 border-dashed border-blue-500/40 rounded-[2rem] flex flex-col items-center justify-center pointer-events-none m-4">
                                            <div className="bg-zinc-900 shadow-2xl p-6 rounded-[2rem] border border-white/10 flex flex-col items-center gap-4 animate-bounce">
                                                <div className="p-4 bg-blue-500/20 rounded-full text-blue-400 border border-blue-500/20">
                                                    <Paperclip size={32} />
                                                </div>
                                                <div className="space-y-1 text-center">
                                                    <h4 className="font-bold text-white text-lg">Drop to Attach</h4>
                                                    <p className="text-white/40 text-xs">Add context to your request</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-6 custom-scrollbar">
                                        {messages.length === 0 && (
                                            <div className="flex flex-col items-center justify-center text-center space-y-6 py-12 px-4 mt-8">
                                                <div className="relative group">
                                                    <div className="absolute inset-0 bg-blue-500/10 blur-2xl rounded-full scale-150 transition-all duration-1000" />
                                                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 text-blue-400 relative z-10">
                                                        <Sparkles size={32} />
                                                    </div>
                                                </div>
                                                <div className="space-y-1 relative z-10">
                                                    <p className="text-white/40 text-[10px] leading-relaxed uppercase tracking-[0.3em] font-bold">
                                                        Agent Ready
                                                    </p>
                                                </div>
                                                <div className="grid grid-cols-1 gap-2 w-full pt-4 relative z-10">
                                                    {quickTips.map((tip, ix) => (
                                                        <button
                                                            key={ix}
                                                            onClick={() => setInput(tip.text)}
                                                            className="p-3 bg-white/5 border border-white/5 rounded-xl text-left text-[11px] text-white/40 hover:bg-white/10 hover:text-white/80 transition-all active:scale-[0.98]"
                                                        >
                                                            "{tip.text}"
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {messages.map((msg, i) => (
                                            <MessageBubble
                                                key={i}
                                                msg={msg}
                                                attachedFiles={attachedFiles}
                                                setInput={setInput}
                                                setActiveTool={setActiveTool}
                                                isBackgroundBusy={isBackgroundBusy}
                                                onApprove={approveFromBubble}
                                                hasMarkdownTable={hasMarkdownTable}
                                                normalizeMarkdown={normalizeMarkdown}
                                                remarkGfm={remarkGfm}
                                                ToolResultPreview={ToolResultPreview}
                                            />
                                        ))}
                                        {isLoading && (
                                            <div className="flex flex-col gap-1">
                                                <div className="text-[10px] text-emerald-400 uppercase font-black tracking-widest animate-pulse">
                                                    {isBackgroundBusy ? (backgroundJobLabel || "Computing") : "Computing"}...
                                                </div>
                                                {isBackgroundBusy && backgroundJobLabel && (
                                                    <span className="text-[8px] text-white/20 uppercase tracking-widest font-bold ml-0.5">
                                                        Agent processing in background
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4 border-t border-white/5 bg-black/40">
                                        {/* Unified Context Bar */}
                                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 mb-2">
                                            {enabledToolIds.map((toolId) => {
                                                const tool = TOOL_LIBRARY[toolId];
                                                if (!tool) return null;

                                                const isActive = activeTool === toolId;


                                                return (
                                                    <button
                                                        key={toolId}
                                                        onClick={() => {
                                                            setActiveTool(isActive ? null : toolId);
                                                            setInput(isActive ? '' : (toolPromptById[toolId] || tool.description));
                                                        }}
                                                        className={cn(
                                                            "shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all",
                                                            isActive
                                                                ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                                                                : "bg-white/5 border-white/10 text-white/30 hover:text-white/60"
                                                        )}
                                                    >
                                                        {tool.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {attachedFiles.length > 0 && (
                                            <>
                                                <div className="w-px h-3 bg-white/10 shrink-0 mx-1" />
                                                {attachedFiles.map(f => (
                                                    <div key={f.id} className="relative shrink-0 group">
                                                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/5 border border-blue-500/10 rounded-full text-[10px] text-blue-400/60 group-hover:text-blue-400 transition-colors cursor-default">
                                                            {f.name}
                                                            <button onClick={() => removeFile(f.id)} className="hover:text-red-400 transition-colors ml-1">
                                                                <X size={10} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </>
                                        )}
                                        <div className="mt-3">
                                            <form onSubmit={handleSend} className="relative group/input">
                                                <textarea
                                                    rows={1}
                                                    value={input}
                                                    onChange={(e) => setInput(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                            e.preventDefault();
                                                            handleSend(e);
                                                        }
                                                        // History Navigation
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
                                                    }}
                                                    disabled={isLoading || isBackgroundBusy}
                                                    placeholder={isBackgroundBusy ? "Background agent working..." : "Ask anything..."}
                                                    className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-3 pl-4 pr-12 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500/30 focus:bg-white/[0.05] transition-all resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={isLoading || isBackgroundBusy}
                                                    className={cn(
                                                        "absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all",
                                                        input.trim() || attachedFiles.length > 0 ? "bg-blue-600 text-white shadow-lg" : "text-white/20"
                                                    )}
                                                >
                                                    <Send size={14} />
                                                </button>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                            ) : view === 'sessions' ? (
                                renderSessionsView()
                            ) : (
                                <div className="h-full p-6 space-y-4 overflow-y-auto custom-scrollbar">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-[10px] font-black uppercase text-white/30 tracking-widest">Archetypes</h4>
                                        <button onClick={() => { setEditingPromptId(null); setNewPrompt({ name: '', description: '', prompt: '', tools: DEFAULT_TOOLS, workflows: [], triggerKeywords: [] }); setIsEditorOpen(true); }} className="p-2 bg-blue-600 rounded-lg text-white">
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {prompts.map(p => (
                                            <div key={p.id} className={cn("p-4 rounded-2xl border transition-all", p.isActive ? "bg-blue-600/10 border-blue-500/30" : "bg-white/5 border-white/5")}>
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-[12px] font-bold text-white truncate">{p.name}</span>
                                                    <div className="flex gap-1 shrink-0">
                                                        {!p.isActive && <button onClick={() => handleSetActive(p.id)} className="p-1.5 bg-white/5 text-white/40 hover:text-white rounded-lg"><Check size={14} /></button>}
                                                        <button onClick={() => startEditing(p)} className="p-1.5 bg-white/5 text-white/40 hover:text-white rounded-lg"><Edit2 size={14} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
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
            </>
        );
    }

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

            <div className="fixed bottom-8 right-8 z-[9999] flex flex-col items-end gap-4 font-sans">
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 30, scale: 0.9, filter: 'blur(10px)' }}
                            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, y: 30, scale: 0.9, filter: 'blur(10px)' }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            className="glass-card w-[420px] md:w-[600px] h-[750px] flex flex-col shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] border border-white/20 rounded-[2.5rem] overflow-hidden backdrop-blur-3xl"
                        >
                            <div className="p-5 border-b border-white/5 bg-black/40 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
                                        <BrainCircuit size={18} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-xs tracking-tight uppercase">
                                            {activePrompt?.name || "TaskFlow Agent"}
                                        </h3>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <div className="w-1 h-1 rounded-full bg-emerald-500" />
                                            <span className="text-[8px] text-white/20 uppercase tracking-[0.2em] font-bold">Core Active</span>
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
                                        onClick={() => {
                                            setView(view === 'prompts' ? 'chat' : 'prompts');
                                            setIsCreatingPrompt(false);
                                            setEditingPromptId(null);
                                            setNewPrompt({
                                                name: '',
                                                description: '',
                                                prompt: '',
                                                tools: DEFAULT_TOOLS,
                                                workflows: [],
                                                triggerKeywords: []
                                            });
                                        }}
                                        className={cn(
                                            "p-2.5 rounded-full transition-all border",
                                            view === 'prompts'
                                                ? "bg-white/20 border-white/40 text-white"
                                                : "bg-white/5 border-white/5 text-white/40 hover:text-white"
                                        )}
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
                                                <div className="absolute inset-0 z-[100] bg-blue-500/10 backdrop-blur-sm border-2 border-dashed border-blue-500/40 rounded-[2rem] flex flex-col items-center justify-center pointer-events-none m-4">
                                                    <div className="bg-zinc-900 shadow-2xl p-6 rounded-[2rem] border border-white/10 flex flex-col items-center gap-4 animate-bounce">
                                                        <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-400">
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
                                                className="flex-1 overflow-y-auto overflow-x-hidden p-7 space-y-8 custom-scrollbar bg-slate-950/20 relative"
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
                                                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 blur-3xl rounded-full scale-150 group-hover:scale-[2] transition-all duration-1000" />
                                                            <motion.div
                                                                animate={{
                                                                    rotate: [0, 360],
                                                                    scale: [1, 1.05, 1]
                                                                }}
                                                                transition={{
                                                                    rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                                                                    scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                                                                }}
                                                                className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center border border-white/20 text-blue-400 relative z-10 shadow-2xl backdrop-blur-xl"
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
                                                            {quickTips.map((tip, ix) => (
                                                                <motion.button
                                                                    key={ix}
                                                                    initial={{ opacity: 0, x: -20 }}
                                                                    animate={{ opacity: 1, x: 0 }}
                                                                    transition={{ delay: 0.5 + ix * 0.1 }}
                                                                    onClick={() => setInput(tip.text)}
                                                                    className="group p-4 bg-gradient-to-br from-white/[0.08] to-white/[0.03] border border-white/10 rounded-2xl text-left text-xs text-white/50 hover:text-white/90 hover:border-white/20 hover:from-white/[0.12] hover:to-white/[0.06] transition-all duration-300 active:scale-[0.98] backdrop-blur-xl shadow-lg hover:shadow-xl relative overflow-hidden"
                                                                >
                                                                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-purple-500/5 to-pink-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
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
                                                        setInput={setInput}
                                                        setActiveTool={setActiveTool}
                                                        isBackgroundBusy={isBackgroundBusy}
                                                        onApprove={approveFromBubble}
                                                        hasMarkdownTable={hasMarkdownTable}
                                                        normalizeMarkdown={normalizeMarkdown}
                                                        remarkGfm={remarkGfm}
                                                        ToolResultPreview={ToolResultPreview}
                                                    />
                                                ))}

                                                {isLoading && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        className="flex flex-col items-start gap-2"
                                                    >
                                                        <div className="relative group">
                                                            {/* Glow effect */}
                                                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-[1.5rem] blur-xl opacity-60 group-hover:opacity-100 transition-opacity" />

                                                            <div className="relative bg-gradient-to-br from-white/[0.08] to-white/[0.03] px-6 py-5 rounded-[1.5rem] text-white/40 flex items-center gap-4 rounded-tl-none border border-white/10 backdrop-blur-xl shadow-2xl">
                                                                <div className="flex gap-1.5">
                                                                    <motion.span
                                                                        animate={{
                                                                            scale: [1, 1.3, 1],
                                                                            opacity: [0.3, 1, 0.3]
                                                                        }}
                                                                        transition={{ repeat: Infinity, duration: 1.2 }}
                                                                        className="w-2.5 h-2.5 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full shadow-lg shadow-blue-400/50"
                                                                    />
                                                                    <motion.span
                                                                        animate={{
                                                                            scale: [1, 1.3, 1],
                                                                            opacity: [0.3, 1, 0.3]
                                                                        }}
                                                                        transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }}
                                                                        className="w-2.5 h-2.5 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full shadow-lg shadow-purple-400/50"
                                                                    />
                                                                    <motion.span
                                                                        animate={{
                                                                            scale: [1, 1.3, 1],
                                                                            opacity: [0.3, 1, 0.3]
                                                                        }}
                                                                        transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }}
                                                                        className="w-2.5 h-2.5 bg-gradient-to-r from-pink-400 to-blue-400 rounded-full shadow-lg shadow-pink-400/50"
                                                                    />
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-bold tracking-widest uppercase bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
                                                                        {isBackgroundBusy ? (backgroundJobLabel || "Computing") : "Computing"}...
                                                                    </span>
                                                                    {isBackgroundBusy && backgroundJobLabel && (
                                                                        <span className="text-[8px] text-white/30 uppercase tracking-widest font-bold mt-0.5">
                                                                            Background Specialist Active
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
                                                        className="absolute bottom-24 right-8 z-20 p-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-full shadow-2xl shadow-blue-500/50 hover:shadow-blue-500/70 border border-white/20 backdrop-blur-xl transition-all duration-300 hover:scale-110 active:scale-95 group"
                                                        title="Scroll to bottom"
                                                    >
                                                        <ArrowDown size={20} className="text-white group-hover:animate-bounce" />
                                                        <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </motion.button>
                                                )}
                                            </AnimatePresence>

                                            {/* Input Area - Premium Design */}
                                            <div className="relative p-6 border-t border-white/10 bg-gradient-to-b from-black/20 to-black/60 backdrop-blur-xl">
                                                {/* Gradient accent line */}
                                                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

                                                <div className="flex flex-col gap-3">
                                                    {(enabledToolIds.length > 0 || attachedFiles.length > 0) && (
                                                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                                                            {enabledToolIds.map((toolId) => {
                                                                const tool = TOOL_LIBRARY[toolId];
                                                                if (!tool) return null;
                                                                const isActive = activeTool === toolId;

                                                                return (
                                                                    <button
                                                                        key={toolId}
                                                                        onClick={() => {
                                                                            setActiveTool(isActive ? null : toolId);
                                                                            setInput(isActive ? '' : (toolPromptById[toolId] || tool.description));
                                                                        }}
                                                                        className={cn(
                                                                            "shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all duration-300 hover:scale-105 active:scale-95",
                                                                            isActive
                                                                                ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-blue-500/40 text-blue-300 shadow-lg shadow-blue-500/20"
                                                                                : "bg-white/5 border-white/10 text-white/40 hover:text-white/70 hover:bg-white/10"
                                                                        )}
                                                                    >
                                                                        {tool.name}
                                                                    </button>
                                                                );
                                                            })}

                                                            {attachedFiles.length > 0 && (
                                                                <>
                                                                    <div className="w-px h-4 bg-gradient-to-b from-transparent via-white/20 to-transparent shrink-0 mx-1" />
                                                                    {attachedFiles.map(f => (
                                                                        <div key={f.id} className="relative shrink-0 group">
                                                                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-full text-[10px] text-blue-400/80 group-hover:text-blue-300 transition-all duration-300 cursor-default shadow-lg shadow-blue-500/10">
                                                                                <Paperclip size={10} className="opacity-60" />
                                                                                <span className="font-medium">{f.name}</span>
                                                                                <button
                                                                                    onClick={() => removeFile(f.id)}
                                                                                    className="hover:text-red-400 transition-colors ml-1 hover:scale-110 active:scale-90"
                                                                                >
                                                                                    <X size={10} />
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </>
                                                            )}
                                                        </div>
                                                    )}

                                                    <form onSubmit={handleSend} className="relative group/input">
                                                        {/* Glow effect on focus */}
                                                        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-[1.25rem] opacity-0 group-focus-within/input:opacity-100 blur-xl transition-opacity duration-500" />

                                                        <div className="relative">
                                                            <textarea
                                                                rows={1}
                                                                value={input}
                                                                onChange={(e) => setInput(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                                        e.preventDefault();
                                                                        handleSend(e);
                                                                    }
                                                                    // History Navigation
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
                                                                }}
                                                                disabled={isLoading || isBackgroundBusy}
                                                                placeholder={isBackgroundBusy ? "Background agent working..." : "Ask anything..."}
                                                                className="w-full bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-[1.25rem] py-4 pl-5 pr-14 text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/40 focus:bg-white/[0.08] transition-all duration-300 resize-none disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl shadow-black/20 font-medium"
                                                                style={{
                                                                    minHeight: '52px',
                                                                    maxHeight: '200px'
                                                                }}
                                                            />
                                                            <button
                                                                type="submit"
                                                                disabled={isLoading || isBackgroundBusy || (!input.trim() && attachedFiles.length === 0)}
                                                                className={cn(
                                                                    "absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-xl transition-all duration-300 shadow-lg",
                                                                    input.trim() || attachedFiles.length > 0
                                                                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-500 hover:to-purple-500 hover:scale-110 active:scale-95 shadow-blue-500/50"
                                                                        : "bg-white/5 text-white/20 cursor-not-allowed"
                                                                )}
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
                                            className="h-full flex flex-col p-7 overflow-y-auto custom-scrollbar bg-slate-950/40 space-y-6"
                                        >
                                            {renderSessionsView()}
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="prompts"
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 20 }}
                                            className="h-full flex flex-col p-7 overflow-y-auto custom-scrollbar bg-slate-950/40 space-y-6"
                                        >
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-white font-bold text-xl tracking-tight leading-none uppercase text-[12px] opacity-40 font-black">Agent Archetypes</h4>
                                                <button
                                                    onClick={() => {
                                                        setEditingPromptId(null);
                                                        setNewPrompt({ name: '', description: '', prompt: '', tools: DEFAULT_TOOLS, workflows: [], triggerKeywords: [] });
                                                        setIsEditorOpen(true);
                                                    }}
                                                    className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl shadow-xl shadow-blue-500/20 transition-all active:scale-95"
                                                >
                                                    <Plus size={20} />
                                                </button>
                                            </div>

                                            <div className="space-y-4 pb-20">
                                                {prompts.map(p => (
                                                    <div
                                                        key={p.id}
                                                        className={cn(
                                                            "group relative overflow-hidden p-6 rounded-[2.5rem] border transition-all",
                                                            p.isActive
                                                                ? "bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border-blue-500/40 shadow-xl shadow-blue-500/10"
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
                                                                            className="flex-1 py-1.5 px-3 bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white rounded-xl transition-all shadow-lg text-[9px] font-black uppercase tracking-widest"
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
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div >
                    )
                    }
                </AnimatePresence >

                {/* Float Button */}
                <motion.button
                    layoutId="ai-trigger"
                    whileHover={{ scale: 1.05, y: -4 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsOpen(!isOpen)}
                    className={cn(
                        "p-4 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center gap-3 transition-all border backdrop-blur-xl relative overflow-hidden group",
                        isOpen
                            ? "bg-zinc-900 border-white/10 text-white/50"
                            : "bg-gradient-to-br from-blue-600 to-indigo-700 border-blue-400/30 text-white"
                    )}
                >
                    <div className="relative">
                        <Bot size={24} className={cn(isOpen ? "rotate-90 opacity-40" : "animate-pulse")} />
                        {attachedFiles.length > 0 && (
                            <span className="absolute -top-2 -right-2 w-4 h-4 bg-emerald-500 text-[8px] font-black rounded-full flex items-center justify-center shadow-xl ring-2 ring-white/20">
                                {attachedFiles.length}
                            </span>
                        )}
                    </div>
                    {!isOpen && (
                        <div className="flex flex-col items-start pr-2">
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] leading-none mb-1 opacity-60">Signal</span>
                            <span className="text-sm font-bold tracking-tight">Agent Hub</span>
                        </div>
                    )}
                </motion.button>

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
                <FileEditPreviewModal
                    isOpen={isEditPreviewOpen}
                    onClose={() => setIsEditPreviewOpen(false)}
                    fileName={editPreviewData.fileName}
                    content={editPreviewData.content}
                />
            </div >
        </>
    );
}
