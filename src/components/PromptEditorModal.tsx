'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Loader2, Save, Eye, Edit3, Command, Wand2, Wrench, Layout, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { generateSystemPrompt } from '@/app/actions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TOOL_LIBRARY, DEFAULT_TOOLS, getToolsByCategory } from '@/lib/toolLibrary';
import WorkflowDesigner from './WorkflowDesigner';
import { WorkflowStep, IntentRuleDefinition, WorkflowDefinition } from '@/lib/intentLibrary';

interface PromptEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: {
        name: string,
        prompt: string,
        description: string,
        tools: string[],
        workflows?: WorkflowDefinition[],
        triggerKeywords?: string[]
    }) => Promise<void>;
    initialData?: {
        name: string;
        prompt: string;
        description: string;
        tools?: string[];
        workflows?: WorkflowDefinition[];
        triggerKeywords?: string[];
    };
    customIntents?: IntentRuleDefinition[];
}

export default function PromptEditorModal({ isOpen, onClose, onSave, initialData, customIntents }: PromptEditorModalProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [prompt, setPrompt] = useState('');
    const [selectedTools, setSelectedTools] = useState<string[]>(DEFAULT_TOOLS);
    const [view, setView] = useState<'split' | 'edit' | 'preview' | 'workflow'>('split');
    const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
    const [triggerKeywords, setTriggerKeywords] = useState<string[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showToolsSidebar, setShowToolsSidebar] = useState(true);

    useEffect(() => {
        if (initialData) {
            setName(initialData.name || '');
            setDescription(initialData.description || '');
            setPrompt(initialData.prompt || '');
            setSelectedTools(initialData.tools || DEFAULT_TOOLS);

            // Handle migration from steps array to named workflows array if needed
            const rawWorkflows = initialData.workflows || [];
            if (rawWorkflows.length > 0 && !('steps' in rawWorkflows[0])) {
                // It's the old structure (WorkflowStep[])
                setWorkflows([{
                    id: 'default',
                    name: 'Main Flow',
                    triggerKeywords: initialData.triggerKeywords || [],
                    steps: rawWorkflows as unknown as WorkflowStep[]
                }]);
            } else {
                setWorkflows(rawWorkflows as WorkflowDefinition[]);
            }

            setTriggerKeywords(initialData.triggerKeywords || []);
        } else {
            setName('');
            setDescription('');
            setPrompt('');
            setSelectedTools(DEFAULT_TOOLS);
            setWorkflows([]);
            setTriggerKeywords([]);
        }
    }, [initialData, isOpen]);

    const handleMagicRefine = async () => {
        const seed = prompt || description || name;
        if (!seed) {
            toast.error("Enter a name, description, or manual draft first");
            return;
        }
        setIsGenerating(true);
        try {
            const res = await generateSystemPrompt(seed);
            if (res.success) {
                setPrompt(res.text as string);
                toast.success("Prompt Refined by AI", {
                    icon: <Sparkles size={14} className="text-blue-400" />,
                    description: "Structured with Identity, Expertise, and Guardrails."
                });
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = async () => {
        if (!name.trim() || !prompt.trim()) {
            toast.error("Name and Prompt instructions are required");
            return;
        }
        setIsSaving(true);
        try {
            await onSave({
                name,
                description,
                prompt,
                tools: selectedTools,
                workflows,
                triggerKeywords
            });
            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 md:p-8">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 30 }}
                        className="w-full h-full max-w-[1400px] bg-zinc-950 border border-white/10 rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden"
                    >
                        {/* Toolbar Header */}
                        <div className="p-6 md:px-10 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/[0.02]">
                            <div className="flex items-center gap-4">
                                {/* Tools Toggle Button */}
                                <button
                                    onClick={() => setShowToolsSidebar(!showToolsSidebar)}
                                    className={cn(
                                        "p-3 rounded-2xl border transition-all",
                                        showToolsSidebar
                                            ? "bg-purple-600/20 text-purple-400 border-purple-500/20 shadow-xl shadow-purple-500/10"
                                            : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10"
                                    )}
                                >
                                    <Wrench size={24} />
                                </button>

                                <div className="p-3 bg-blue-600/20 rounded-2xl text-blue-400 border border-blue-500/20 shadow-xl shadow-blue-500/10">
                                    <Command size={24} />
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-[8px] font-bold uppercase tracking-[0.2em] text-white/20 mb-1 ml-1">Agent Name</label>
                                    <input
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="Name your agent..."
                                        className="bg-transparent border-none focus:ring-0 px-1 py-1 text-xl font-bold text-white focus:outline-none placeholder:text-white/10 transition-all min-w-[300px]"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2 bg-white/5 p-1 rounded-2xl border border-white/5 self-start md:self-center">
                                {[
                                    { id: 'edit', label: 'Edit', icon: <Edit3 size={16} /> },
                                    { id: 'split', label: 'Split View', icon: <Layout size={16} /> },
                                    { id: 'preview', label: 'Preview', icon: <Eye size={16} /> },
                                    { id: 'workflow', label: 'Workflow', icon: <Zap size={16} /> }
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setView(tab.id as any)}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                                            view === tab.id ? "bg-white/10 text-white shadow-lg" : "text-white/40 hover:text-white"
                                        )}
                                    >
                                        {tab.icon}
                                        <span className="hidden md:inline">{tab.label}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={onClose}
                                    className="px-6 py-2.5 rounded-xl text-sm font-bold text-white/40 hover:text-white hover:bg-white/5 transition-all"
                                >
                                    Discard
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-xl shadow-blue-500/20 transition-all active:scale-95"
                                >
                                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                    Commit Changes
                                </button>
                                <button
                                    onClick={onClose}
                                    className="p-2.5 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white rounded-full transition-all"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Editor Workspace with Sidebar */}
                        <div className="flex-1 flex overflow-hidden">
                            {/* Tools Sidebar */}
                            <AnimatePresence>
                                {showToolsSidebar && (
                                    <motion.div
                                        initial={{ width: 0, opacity: 0 }}
                                        animate={{ width: 280, opacity: 1 }}
                                        exit={{ width: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="border-r border-white/5 bg-black/20 overflow-hidden"
                                    >
                                        <div className="w-[280px] h-full overflow-y-auto p-6">
                                            <div className="flex items-center gap-2 mb-4">
                                                <Wrench size={14} className="text-purple-400" />
                                                <label className="text-[10px] font-black uppercase tracking-widest text-white/30">Available Tools</label>
                                            </div>
                                            <div className="text-[9px] text-white/20 mb-4">{selectedTools.length} selected</div>

                                            <div className="space-y-4">
                                                {Object.entries(getToolsByCategory()).map(([category, tools]) => (
                                                    <div key={category}>
                                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2 capitalize">{category}</h4>
                                                        <div className="space-y-2">
                                                            {tools.map(tool => (
                                                                <label
                                                                    key={tool.id}
                                                                    className="flex items-start gap-2 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-all group"
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedTools.includes(tool.id)}
                                                                        onChange={(e) => {
                                                                            if (e.target.checked) {
                                                                                setSelectedTools([...selectedTools, tool.id]);
                                                                            } else {
                                                                                setSelectedTools(selectedTools.filter(id => id !== tool.id));
                                                                            }
                                                                        }}
                                                                        className="mt-0.5 w-4 h-4 rounded border-2 border-white/20 bg-white/5 checked:bg-purple-500 checked:border-purple-500 focus:ring-2 focus:ring-purple-500/50 cursor-pointer flex-shrink-0"
                                                                    />
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="text-[11px] font-medium text-white/70 group-hover:text-white transition-colors">
                                                                            {tool.name}
                                                                        </div>
                                                                        <div className="text-[9px] text-white/20 mt-0.5 line-clamp-1 group-hover:line-clamp-none transition-all">
                                                                            {tool.description}
                                                                        </div>
                                                                    </div>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Editor Side */}
                            {(view === 'edit' || view === 'split') && (
                                <div className={cn(
                                    "flex-1 flex flex-col min-w-0 border-r border-white/5 bg-black/20",
                                    view === 'edit' ? "px-10 py-8" : "p-6"
                                )}>
                                    <div className="flex items-center justify-between mb-4 px-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-white/30">Markdown Instructions</label>
                                        <button
                                            onClick={handleMagicRefine}
                                            disabled={isGenerating}
                                            className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-indigo-500/20"
                                        >
                                            {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                                            AI Refinement
                                        </button>
                                    </div>
                                    <textarea
                                        value={prompt}
                                        onChange={e => setPrompt(e.target.value)}
                                        placeholder="Define the behavior, personality, and expertise of this agent using Markdown..."
                                        className="flex-1 bg-transparent text-white font-mono text-sm leading-relaxed resize-none focus:outline-none p-4 rounded-3xl border border-white/5 hover:border-white/10 transition-colors shadow-inner"
                                    />
                                    <div className="mt-6">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-white/30 block mb-2 px-2">Internal Metadata (Optional)</label>
                                        <input
                                            value={description}
                                            onChange={e => setDescription(e.target.value)}
                                            placeholder="Short summary for the archetype list..."
                                            className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/10"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Preview Side */}
                            {(view === 'preview' || view === 'split') && (
                                <div className={cn(
                                    "flex-1 overflow-y-auto bg-slate-950/20",
                                    view === 'preview' ? "px-10 py-12" : "p-8"
                                )}>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-blue-400/50 mb-6 block">Real-time Preview</label>
                                    <div className="prose prose-invert max-w-none text-white/80 prose-headings:text-white prose-strong:text-blue-400 prose-code:text-indigo-300 prose-code:bg-white/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:border prose-code:border-white/5">
                                        {prompt ? (
                                            <ReactMarkdown>{prompt}</ReactMarkdown>
                                        ) : (
                                            <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[3rem] text-white/10 italic">
                                                Instructions are empty.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Workflow Side */}
                            {view === 'workflow' && (
                                <div className="flex-1 overflow-y-auto p-10 bg-black/40">
                                    <div className="max-w-4xl mx-auto">
                                        <div className="mb-8">
                                            <h2 className="text-2xl font-bold text-white mb-2">Multi-Workflow Designer</h2>
                                            <p className="text-sm text-white/40">Create different automation chains and trigger them with specific keywords.</p>
                                        </div>
                                        <WorkflowDesigner
                                            workflows={workflows}
                                            onChange={setWorkflows}
                                            customIntents={customIntents}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Status */}
                        <div className="px-10 py-4 bg-white/[0.01] border-t border-white/10 flex items-center justify-between text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">
                            <div className="flex items-center gap-6">
                                <span className="flex items-center gap-2">System Status: <span className="text-emerald-500">Ready</span></span>
                                <span className="flex items-center gap-2">Model: <span className="text-indigo-400">Gemini 2.0 Optical</span></span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span>Chars: {prompt.length}</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-white/10" />
                                <span>Words: {prompt.split(/\s+/).filter(Boolean).length}</span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
