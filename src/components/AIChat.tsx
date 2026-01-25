
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, X, Loader2, Paperclip, MessageSquare, Sparkles, BrainCircuit, FileText, Image as ImageIcon, ExternalLink, Settings, Plus, Check, Trash2, ChevronRight, Layout, Edit2, Pin, PinOff, Folder, Search, Receipt, DollarSign, Save } from 'lucide-react';
import { chatWithAI, getPrompts, createPrompt, updatePrompt, setActivePrompt, deletePrompt, generateSystemPrompt, getIntentRules, getWorkspaceFiles } from '@/app/actions';
import { createChatSession, getChatSessions, getChatSession, addChatMessage, updateChatSessionTitle } from '@/app/chatActions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TOOL_LIBRARY, DEFAULT_TOOLS } from '@/lib/toolLibrary';
import type { WorkspaceFile, AIPromptSet, IntentRule } from '@prisma/client';
import PromptEditorModal from './PromptEditorModal';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { normalizeMarkdown, hasMarkdownTable } from '@/utils/markdownUtils';

export type SelectedFile = {
    id: string;
    name: string;
    type: string;
};



export default function AIChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState<'chat' | 'prompts' | 'sessions'>('chat');
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string; files?: SelectedFile[]; toolUsed?: string }[]>([]);
    const [attachedFiles, setAttachedFiles] = useState<SelectedFile[]>([]);
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

    const scrollRef = useRef<HTMLDivElement>(null);

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

    const refreshPrompts = async () => {
        const p = await getPrompts();
        setPrompts(p);
    };

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

                    return (
                        <button
                            key={session.id}
                            onClick={() => openSession(session.id)}
                            className={cn(
                                "w-full p-4 rounded-2xl border transition-all text-left",
                                isActive ? "bg-blue-600/10 border-blue-500/30" : "bg-white/5 border-white/5 hover:border-white/10"
                            )}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-[12px] font-bold text-white truncate">{session.title || 'New Chat'}</span>
                                <span className="text-[10px] text-white/40">{messageCount}</span>
                            </div>
                            <p className="text-[10px] text-white/40 leading-relaxed line-clamp-2 mt-2">
                                {preview}
                            </p>
                        </button>
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
    }, [messages, isLoading]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() && attachedFiles.length === 0) return;

        let sessionId = activeSessionId;

        if (!sessionId) {
            const title = buildSessionTitle(input);
            const sessionRes = await createChatSession(title);
            if (!sessionRes.success || !sessionRes.session) {
                toast.error(sessionRes.message || 'Failed to create chat session');
                return;
            }
            sessionId = sessionRes.session.id;
            setActiveSessionId(sessionId);
            setActiveSessionTitle(sessionRes.session.title || title);
            setChatSessions(prev => [sessionRes.session, ...prev]);
        } else if (activeSessionTitle === 'New Chat') {
            const title = buildSessionTitle(input);
            await updateChatSessionTitle(sessionId, title);
            setActiveSessionTitle(title);
            setChatSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title } : s));
        }

        const userMsg = { role: 'user' as const, content: input, files: [...attachedFiles] };
        setMessages(prev => [...prev, userMsg]);
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

            console.log('📤 Sending to AI:', userMsg.content);
            console.log('📎 Files in context:', Array.from(allFileIds));
            const res = await chatWithAI(userMsg.content, Array.from(allFileIds), geminiHistory);
            console.log('📥 AI Response:', JSON.stringify(res, null, 2));
            console.log('📥 AI Response Text:', res.text);
            console.log('📥 AI Response Success:', res.success);

            if (res.success) {
                // Validate that we have text to display
                if (!res.text || res.text.trim() === '') {
                    console.error('⚠️ AI returned empty response');
                    toast.error('AI returned an empty response');
                    setMessages(prev => [...prev, {
                        role: 'ai',
                        content: 'I apologize, but I encountered an issue generating a response. Please try again.'
                    }]);
                } else {
                    setMessages(prev => [...prev, {
                        role: 'ai',
                        content: res.text as string,
                        toolUsed: (res as any).toolUsed
                    }]);

                    if (sessionId) {
                        await addChatMessage(sessionId, 'ai', res.text as string, [], (res as any).toolUsed);
                    }

                    if ((res as any).toolUsed) {
                        toast.success(`Action Executed: ${(res as any).toolUsed.replace('_', ' ')}`);
                        // Dispatch custom event to refresh file manager without reloading the page
                        window.dispatchEvent(new CustomEvent('refresh-file-manager'));
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

    const handleSavePrompt = async (data: { 
        name: string, 
        prompt: string, 
        description: string, 
        tools: string[],
        workflows?: any[]
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

        window.addEventListener('add-to-ai-chat', handleAddFile);
        window.addEventListener('preview-opened', handlePreview);

        return () => {
            window.removeEventListener('add-to-ai-chat', handleAddFile);
            window.removeEventListener('preview-opened', handlePreview);
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

    if (isPinned) {
        return (
            <>
                <div className="h-full w-[450px] border-l border-white/10 glass-card flex flex-col relative z-20 overflow-hidden">
                    {/* Header (Pinned) */}
                    <div className="p-6 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <BrainCircuit size={20} className="text-blue-400" />
                            <div>
                                <h3 className="font-bold text-white text-sm tracking-tight text-[12px] uppercase">TaskFlow Agent</h3>
                                <p className="text-[10px] text-white/40 uppercase tracking-widest font-black">
                                    {activePrompt?.name || "Autonomous Core"}
                                </p>
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
                                <div className="h-full flex flex-col">
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
                                                    <p className="text-white font-bold text-lg tracking-tight">Tactical Interface</p>
                                                    <p className="text-[10px] text-white/30 leading-relaxed uppercase tracking-widest font-black">
                                                        Agent Ready: <span className="text-blue-400">{activePrompt?.name || "Autonomous Core"}</span>
                                                    </p>
                                                </div>
                                                <div className="grid grid-cols-1 gap-2 w-full pt-4 relative z-10">
                                                    {[
                                                        "Analyze these Dominican receipts",
                                                        "Review my project files for security",
                                                        "Automate a workflow from these documents"
                                                    ].map((tip, ix) => (
                                                        <button
                                                            key={ix}
                                                            onClick={() => setInput(tip)}
                                                            className="p-3 bg-white/5 border border-white/5 rounded-xl text-left text-[11px] text-white/40 hover:bg-white/10 hover:text-white/80 transition-all active:scale-[0.98]"
                                                        >
                                                            "{tip}"
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {messages.map((msg, i) => (
                                            <div key={i} className={cn("flex flex-col gap-2 max-w-[95%]", msg.role === 'user' ? "ml-auto items-end" : "items-start")}>
                                                <div className={cn("px-4 py-3 rounded-2xl text-xs leading-relaxed shadow-lg", msg.role === 'user' ? "bg-blue-600 text-white rounded-tr-none" : "bg-white/5 text-white/90 rounded-tl-none border border-white/5")}>
                                                    <div className="markdown-content max-w-full overflow-x-auto">
                                                        <ReactMarkdown
                                                            remarkPlugins={[remarkGfm]}
                                                            components={{
                                                                table: ({ node, ...props }) => (
                                                                    <div className="table-container" style={{ display: 'block', width: '100%' }}>
                                                                        <table {...props} style={{ fontSize: '10px' }} />
                                                                    </div>
                                                                )
                                                            }}
                                                        >
                                                            {normalizeMarkdown(msg.content)}
                                                        </ReactMarkdown>
                                                    </div>
                                                    {msg.role === 'ai' && hasMarkdownTable(msg.content) && (
                                                        <div className="mt-4 pt-3 border-t border-white/5 flex justify-end">
                                                            <button
                                                                onClick={() => setInput("Export this table to a markdown file. Ask me about creating a new folder first.")}
                                                                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] text-white/40 hover:text-white transition-all border border-white/5"
                                                            >
                                                                <FileText size={12} className="text-blue-400" />
                                                                <span>Save as Markdown</span>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {isLoading && <div className="text-[10px] text-white/20 uppercase font-black tracking-widest animate-pulse">Computing...</div>}
                                    </div>
                                    <div className="p-5 border-t border-white/5 bg-black/20">
                                        {attachedFiles.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mb-4">
                                                {attachedFiles.map(f => (
                                                    <div key={f.id} className="relative group hover:scale-105 transition-transform cursor-default">
                                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[10px] text-blue-300">
                                                            {f.type === 'folder' ? <Folder size={12} className="text-blue-400" /> : (f.type === 'pdf' ? <FileText size={12} /> : <ImageIcon size={12} />)}
                                                            <span className="max-w-[100px] truncate font-medium">{f.name}</span>
                                                        </div>
                                                        <button
                                                            onClick={() => removeFile(f.id)}
                                                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-zinc-900 border border-white/10 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 shadow-xl"
                                                        >
                                                            <X size={10} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <form onSubmit={handleSend} className="relative">
                                            <textarea
                                                rows={1}
                                                value={input}
                                                onChange={(e) => setInput(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
                                                placeholder="Signal core..."
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-5 pr-12 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-all resize-none"
                                            />
                                            <button type="submit" disabled={isLoading} className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-blue-600 text-white rounded-xl shadow-lg active:scale-95">
                                                <Send size={16} />
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            ) : view === 'sessions' ? (
                                renderSessionsView()
                            ) : (
                                <div className="h-full p-6 space-y-4 overflow-y-auto custom-scrollbar">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-[10px] font-black uppercase text-white/30 tracking-widest">Archetypes</h4>
                                        <button onClick={() => { setEditingPromptId(null); setNewPrompt({ name: '', description: '', prompt: '', tools: DEFAULT_TOOLS }); setIsEditorOpen(true); }} className="p-2 bg-blue-600 rounded-lg text-white">
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
                    customIntents={intentRules}
                />
            </>
        );
    }
    return (
        <>
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
                            {/* Header */}
                            <div className="p-7 border-b border-white/10 bg-gradient-to-r from-blue-600/20 via-indigo-600/20 to-purple-600/20 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => setView('chat')}
                                        className={cn(
                                            "p-3 rounded-2xl transition-all shadow-xl shadow-blue-500/10",
                                            view === 'chat' ? "bg-gradient-to-br from-blue-500 to-indigo-600" : "bg-white/5 hover:bg-white/10"
                                        )}
                                    >
                                        <BrainCircuit size={22} className="text-white" />
                                    </button>
                                    <div>
                                        <h3 className="font-bold text-white text-lg tracking-tight">TaskFlow Agent</h3>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                            <p className="text-[11px] text-white/50 uppercase tracking-[0.2em] font-black">
                                                Role: {activePrompt?.name || "Autonomous Core"}
                                            </p>
                                        </div>
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
                                            className="h-full flex flex-col"
                                        >
                                            <div
                                                ref={scrollRef}
                                                className="flex-1 overflow-y-auto overflow-x-hidden p-7 space-y-8 custom-scrollbar bg-slate-950/20"
                                            >
                                                {messages.length === 0 && (
                                                    <div className="h-full flex flex-col items-center justify-center text-center space-y-6 px-12">
                                                        <div className="relative group">
                                                            <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full scale-150 group-hover:bg-blue-500/40 transition-all duration-1000" />
                                                            <div className="w-20 h-20 rounded-[2rem] bg-white/5 flex items-center justify-center border border-white/10 text-blue-400 relative z-10 shadow-2xl">
                                                                <Sparkles size={40} />
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2 relative z-10">
                                                            <p className="text-white font-bold text-2xl tracking-tight leading-tight">Tactical Interface</p>
                                                            <p className="text-sm text-white/30 leading-relaxed">
                                                                Currently operating as <span className="text-blue-400 font-bold">{activePrompt?.name || "Autonomous Core"}</span>.
                                                            </p>
                                                        </div>
                                                        <div className="grid grid-cols-1 gap-3 w-full pt-4 relative z-10">
                                                            {[
                                                                "Analyze these Dominican receipts",
                                                                "Review my project files for security",
                                                                "Automate a workflow from these documents"
                                                            ].map((tip, ix) => (
                                                                <button
                                                                    key={ix}
                                                                    onClick={() => setInput(tip)}
                                                                    className="p-4 bg-white/5 border border-white/5 rounded-2xl text-left text-xs text-white/50 hover:bg-white/10 hover:text-white/80 transition-all active:scale-[0.98]"
                                                                >
                                                                    "{tip}"
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {messages.map((msg, i) => (
                                                    <div
                                                        key={i}
                                                        className={cn(
                                                            "flex flex-col gap-3 max-w-[90%]",
                                                            msg.role === 'user' ? "ml-auto items-end" : "items-start"
                                                        )}
                                                    >
                                                        {msg.files && msg.files.length > 0 && (
                                                            <div className="flex flex-wrap gap-2 mb-1 justify-end">
                                                                {msg.files.map(f => (
                                                                    <div key={f.id} className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 rounded-xl text-[11px] text-blue-300 border border-blue-500/20 shadow-lg">
                                                                        {f.type === 'pdf' ? <FileText size={12} /> : <ImageIcon size={12} />}
                                                                        {f.name}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {msg.toolUsed && (
                                                            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg mb-1 transition-all">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                                <span className="text-[10px] font-black uppercase text-emerald-400 tracking-widest">
                                                                    Triggered: {msg.toolUsed.replace('_', ' ')}
                                                                </span>
                                                            </div>
                                                        )}

                                                        <div className={cn(
                                                            "px-5 py-4 rounded-[1.5rem] text-sm leading-relaxed shadow-xl",
                                                            msg.role === 'user'
                                                                ? "bg-blue-600 text-white rounded-tr-none shadow-blue-500/10"
                                                                : "bg-white/5 text-white/90 rounded-tl-none border border-white/5 backdrop-blur-xl"
                                                        )}>
                                                            <div className="markdown-content max-w-full overflow-x-hidden break-words">
                                                                <ReactMarkdown
                                                                    remarkPlugins={[remarkGfm]}
                                                                    components={{
                                                                        table: ({ node, ...props }) => (
                                                                            <div className="table-container">
                                                                                <table {...props} />
                                                                            </div>
                                                                        )
                                                                    }}
                                                                >
                                                                    {normalizeMarkdown(msg.content)}
                                                                </ReactMarkdown>
                                                            </div>

                                                            {/* Suggested Action Buttons */}
                                                            {msg.role === 'ai' && (
                                                                <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-2">
                                                                    {/* Show as Table button - appears when AI mentions needing info or analyzing */}
                                                                    {(msg.content.toLowerCase().includes('need') ||
                                                                        msg.content.toLowerCase().includes('information') ||
                                                                        msg.content.toLowerCase().includes('proceed') ||
                                                                        msg.toolUsed === 'verify_dgii_rnc') && !hasMarkdownTable(msg.content) && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    setInput("Display the extracted receipt data in a markdown table, including all fields (Date, Provider, RNC, NCF, Total Amount, ITBIS) and the business verification information from DGII.");
                                                                                    setActiveTool('extract_alegra_bill');
                                                                                }}
                                                                                className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 rounded-xl text-xs text-purple-200 hover:text-purple-100 transition-all border border-purple-500/30 shadow-lg shadow-purple-500/10"
                                                                            >
                                                                                <Receipt size={14} className="text-purple-400" />
                                                                                <span>Show as Table</span>
                                                                            </button>
                                                                        )}

                                                                    {/* Generate Markdown File button - appears when table exists */}
                                                                    {hasMarkdownTable(msg.content) && (
                                                                        <button
                                                                            onClick={() => setInput("Export this table as a markdown file. Please ask me if I want a new folder first.")}
                                                                            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs text-white/60 hover:text-white transition-all border border-white/5"
                                                                        >
                                                                            <FileText size={14} className="text-blue-400" />
                                                                            <span>Generate Markdown File</span>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}

                                                {isLoading && (
                                                    <div className="flex flex-col items-start gap-2">
                                                        <div className="bg-white/5 px-5 py-4 rounded-[1.5rem] text-white/40 flex items-center gap-3 rounded-tl-none border border-white/5 shadow-xl">
                                                            <div className="flex gap-1">
                                                                <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                                                                <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                                                                <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                                                            </div>
                                                            <span className="text-xs font-bold tracking-widest uppercase opacity-60">Computing</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Input Area */}
                                            <div className="p-7 bg-slate-950/40 border-t border-white/10 backdrop-blur-2xl">
                                                {/* Tool Shortcut Chips */}
                                                <div className="flex flex-wrap gap-2 mb-4">
                                                    {enabledToolIds.map((toolId) => {
                                                        const tool = TOOL_LIBRARY[toolId];
                                                        if (!tool) return null;

                                                        const isActive = activeTool === toolId;
                                                        const promptText = toolPromptById[toolId] || tool.description;

                                                        const Icon = toolId === 'verify_dgii_rnc'
                                                            ? Search
                                                            : toolId === 'extract_alegra_bill'
                                                                ? Receipt
                                                                : toolId === 'record_alegra_payment'
                                                                    ? DollarSign
                                                                    : toolId === 'create_markdown_file'
                                                                        ? Save
                                                                        : toolId === 'create_task'
                                                                            ? Check
                                                                            : Settings;

                                                        return (
                                                            <button
                                                                key={toolId}
                                                                type="button"
                                                                onClick={() => {
                                                                    setActiveTool(isActive ? null : toolId);
                                                                    setInput(isActive ? '' : promptText);
                                                                }}
                                                                className={cn(
                                                                    "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all",
                                                                    isActive
                                                                        ? "bg-blue-500/30 border border-blue-500/50 text-blue-200 shadow-lg shadow-blue-500/20"
                                                                        : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white/90"
                                                                )}
                                                            >
                                                                <Icon size={14} />
                                                                <span>{tool.name}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>

                                                {attachedFiles.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mb-5 animate-in fade-in slide-in-from-bottom-2">
                                                        {attachedFiles.map(f => (
                                                            <div key={f.id} className="relative group hover:scale-105 transition-transform cursor-default">
                                                                <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 border border-blue-500/30 rounded-2xl text-xs text-blue-200">
                                                                    {f.type === 'folder' ? <Folder size={14} className="text-blue-400" /> : (f.type === 'pdf' ? <FileText size={14} /> : <ImageIcon size={14} />)}
                                                                    <span className="max-w-[120px] truncate font-medium">{f.name}</span>
                                                                </div>
                                                                <button
                                                                    onClick={() => removeFile(f.id)}
                                                                    className="absolute -top-2 -right-2 w-6 h-6 bg-zinc-900 border border-white/20 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 shadow-xl"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                <form onSubmit={handleSend} className="relative flex items-center gap-3">
                                                    <div className="relative flex-1 group">
                                                        <textarea
                                                            rows={1}
                                                            value={input}
                                                            onChange={(e) => setInput(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                                    e.preventDefault();
                                                                    handleSend(e);
                                                                }
                                                            }}
                                                            placeholder="Signal core..."
                                                            className="w-full bg-white/5 border border-white/10 rounded-[1.75rem] py-5 pl-7 pr-16 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all placeholder:text-white/20 resize-none max-h-40 shadow-inner"
                                                        />
                                                        <button
                                                            type="submit"
                                                            disabled={isLoading || (!input.trim() && attachedFiles.length === 0)}
                                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-blue-600 hover:bg-blue-500 disabled:bg-white/5 disabled:text-white/10 text-white rounded-2xl transition-all shadow-xl active:scale-95"
                                                        >
                                                            <Send size={20} />
                                                        </button>
                                                    </div>
                                                </form>
                                                <div className="flex items-center justify-center gap-2 mt-5 opacity-20">
                                                    <Sparkles size={10} className="text-blue-400" />
                                                    <p className="text-[9px] font-black uppercase tracking-[0.3em]">
                                                        Gemini 2.0 Optical System
                                                    </p>
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
                                                        setNewPrompt({ name: '', description: '', prompt: '', tools: DEFAULT_TOOLS });
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
                < motion.button
                    layoutId="ai-trigger"
                    whileHover={{ scale: 1.05, y: -4 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsOpen(!isOpen)}
                    className={
                        cn(
                            "p-6 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center gap-4 transition-all border border-white/20 backdrop-blur-xl relative overflow-hidden group",
                            isOpen
                                ? "bg-zinc-900 text-white"
                                : "bg-gradient-to-br from-blue-600 to-indigo-700 text-white"
                        )
                    }
                >
                    {!isOpen && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 skew-x-12" />
                    )}
                    <div className="relative">
                        <Bot size={32} />
                        {attachedFiles.length > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-[10px] font-black rounded-full flex items-center justify-center animate-bounce shadow-xl ring-2 ring-white/20">
                                {attachedFiles.length}
                            </span>
                        )}
                    </div>
                    {
                        !isOpen && (
                            <div className="flex flex-col items-start pr-2">
                                <span className="font-black text-xs uppercase tracking-widest opacity-60">System</span>
                                <span className="font-bold tracking-tight text-lg leading-tight">Command Agent</span>
                            </div>
                        )
                    }
                </motion.button >

                <PromptEditorModal
                    isOpen={isEditorOpen}
                    onClose={() => {
                        setIsEditorOpen(false);
                        setEditingPromptId(null);
                    }}
                    onSave={handleSavePrompt}
                    initialData={editingPromptId ? newPrompt : undefined}
                    customIntents={intentRules}
                />
            </div >
        </>
    );
}
