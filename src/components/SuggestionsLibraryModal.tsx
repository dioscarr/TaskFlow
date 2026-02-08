'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Sparkles, Loader2, Plus, ArrowRight, Layout, Check, Globe, Wand2, Compass, Bookmark, Lightbulb } from 'lucide-react';
import { generateSuggestions } from '@/app/actions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

interface TaskFlowStep {
    step: number;
    task: string;
    description: string;
}

interface Suggestion {
    id: string;
    title: string;
    category: string;
    description: string;
    flow: TaskFlowStep[];
    agentInstructions: string;
}

interface SuggestionsLibraryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (suggestion: Suggestion) => void;
    workflowContext?: any; // JSON context from the original request/plan
    workflowType?: string; // Type of workflow (e.g., 'content-generation', 'task-planning', 'code-editing')
}

export default function SuggestionsLibraryModal({ isOpen, onClose, onApply, workflowContext, workflowType }: SuggestionsLibraryModalProps) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);

    const handleSearch = async (e?: React.FormEvent) => {
        e?.preventDefault();
        // Allow empty search to reset/show defaults if desired, or keep specific validation
        if (!searchQuery.trim()) {
            // Optional: could just show all defaults
        }

        setIsLoading(true);
        try {
            // Include workflow context and type in the search
            const contextPayload = workflowContext ? JSON.stringify(workflowContext) : undefined;
            const res = await generateSuggestions(
                searchQuery,
                workflowType,
                contextPayload
            );
            if (res.success && res.suggestions) {
                // Keep the static suggestion if it matches the theme or just append it
                // For now, let's just replace results but we could merge.
                setSuggestions(res.suggestions);
                setSelectedSuggestion(null);
                toast.success(`Found ${res.suggestions.length} high-quality task flows`);
            } else {
                toast.error(res.error || "Failed to fetch suggestions");
            }
        } catch (error) {
            toast.error("Search failed. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const STATIC_SUGGESTIONS: Suggestion[] = [
        {
            id: 'project-planner-001',
            title: 'Project Planning Assistant',
            category: 'Productivity',
            description: 'Turn your conversation history into a structured launch plan with action items and owners.',
            flow: [
                { step: 1, task: 'Context Analysis', description: 'Analyze conversation history for goals and key decisions.' },
                { step: 2, task: 'Task Extraction', description: 'Identify action items and assign owners.' },
                { step: 3, task: 'Plan Generation', description: 'Create a structured project plan with timelines.' }
            ],
            agentInstructions: `You are an expert Project Manager. Your goal is to convert the ongoing conversation into a clear, actionable project plan.
1. **Analyze Context**: Read the entire conversation history to understand the project goals, requirements, and decisions made.
2. **Extract Tasks**: Identify every specific action item. If a person is mentioned in context of a task, assign it to them.
3. **Structure the Plan**: Group tasks by phase (e.g., Planning, Execution, Verification) or by Feature.
4. **Format Output**:
   - Use Markdown.
   - Create a table for "Action Items" (Task, Owner, Status, Priority).
   - Create a "Timeline" section if dates were mentioned.
   - Use the \`create_task\` tool for each identified task if you are able to.
   - If missing details, list them as "Open Questions".`
        }
    ];

    // Pre-populate with some default ideas
    useEffect(() => {
        if (isOpen && suggestions.length === 0) {
            // setSearchQuery('Premium SaaS and Fintech Solutions'); // Don't auto-fill search query to allow seeing static defaults
            setSuggestions(STATIC_SUGGESTIONS);
        }
    }, [isOpen]);

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 backdrop-blur-xl p-4 md:p-8">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="w-full h-full max-w-6xl bg-[#0a0a0b] border theme-border-medium rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-8 border-b theme-border-subtle flex items-center justify-between bg-white/[0.02]">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-sky-500/20 rounded-2xl text-sky-400 border border-sky-500/20 shadow-xl shadow-sky-500/10">
                                    <Compass size={24} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-white tracking-tight leading-none mb-1">Inspiration Library</h2>
                                    <p className="text-xs text-white/30 font-bold uppercase tracking-widest">Discover & Import Strategic Task Flows</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-3 theme-overlay-subtle hover:theme-overlay-medium theme-text-tertiary hover:text-white rounded-full transition-all"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Search Bar */}
                        <div className="px-8 py-6 bg-white/[0.01] border-b theme-border-subtle">
                            {/* Workflow Type Indicator */}
                            {workflowType && (
                                <div className="mb-4 flex items-center gap-2">
                                    <span className="px-3 py-1 bg-sky-500/10 text-sky-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-sky-500/10">
                                        {workflowType.replace(/-/g, ' ')}
                                    </span>
                                    {workflowContext && (
                                        <span className="text-[9px] text-white/30 uppercase tracking-wider font-bold">
                                            Context Attached
                                        </span>
                                    )}
                                </div>
                            )}
                            <form onSubmit={handleSearch} className="relative group">
                                <Search className="absolute left-6 top-1/2 -translate-y-1/2 theme-text-quaternary group-focus-within:text-sky-400 transition-colors" size={20} />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search for industries (e.g. Real Estate, Fintech, E-commerce) or themes..."
                                    className="w-full theme-overlay-subtle border theme-border-medium rounded-[1.8rem] pl-16 pr-44 py-5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500/30 transition-all placeholder:text-white/10 font-medium"
                                />
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 px-8 py-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-sky-500/20 transition-all active:scale-95"
                                >
                                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
                                    Explore Ideas
                                </button>
                            </form>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 flex overflow-hidden">
                            {/* Catalog */}
                            <div className="w-[400px] border-r theme-border-subtle overflow-y-auto p-8 space-y-4 custom-scrollbar bg-black/20">
                                {suggestions.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed theme-border-subtle rounded-[2.5rem]">
                                        <div className="w-16 h-16 theme-overlay-subtle rounded-full flex items-center justify-center mb-6 text-white/10">
                                            <Lightbulb size={32} />
                                        </div>
                                        <p className="text-sm font-bold theme-text-quaternary uppercase tracking-widest">No Flows Loaded</p>
                                        <p className="text-[11px] text-white/10 mt-2">Enter a theme above to discover new strategic workflows for your agent.</p>
                                    </div>
                                ) : (
                                    suggestions.map((s) => (
                                        <button
                                            key={s.id}
                                            onClick={() => setSelectedSuggestion(s)}
                                            className={cn(
                                                "w-full text-left p-6 rounded-[1.8rem] border transition-all duration-300 group relative overflow-hidden",
                                                selectedSuggestion?.id === s.id
                                                    ? "bg-sky-500/10 border-sky-500/30 shadow-xl shadow-sky-500/5"
                                                    : "bg-white/[0.02] theme-border-subtle hover:theme-border-medium hover:bg-white/5"
                                            )}
                                        >
                                            <div className="relative z-10">
                                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-sky-400/60 mb-2 block">{s.category}</span>
                                                <h4 className="text-sm font-bold text-white mb-2 group-hover:text-sky-300 transition-colors">{s.title}</h4>
                                                <p className="text-[11px] theme-text-tertiary line-clamp-2 leading-relaxed">{s.description}</p>
                                            </div>
                                            {selectedSuggestion?.id === s.id && (
                                                <div className="absolute top-0 right-0 p-4">
                                                    <Check size={14} className="text-sky-400" />
                                                </div>
                                            )}
                                        </button>
                                    ))
                                )}
                            </div>

                            {/* Details (Flow Preview) */}
                            <div className="flex-1 overflow-y-auto p-12 custom-scrollbar bg-slate-950/20">
                                {selectedSuggestion ? (
                                    <motion.div
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="max-w-3xl space-y-12"
                                    >
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3">
                                                <span className="px-3 py-1 bg-sky-500/10 text-sky-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-sky-500/10">
                                                    {selectedSuggestion.category}
                                                </span>
                                                <span className="text-[10px] font-bold theme-text-quaternary uppercase tracking-[0.2em]">Strategic Flow • ID: {selectedSuggestion.id}</span>
                                            </div>
                                            <h3 className="text-4xl font-black text-white tracking-tighter">{selectedSuggestion.title}</h3>
                                            <p className="text-lg text-white/60 leading-relaxed font-medium">{selectedSuggestion.description}</p>
                                        </div>

                                        {/* Task Steps */}
                                        <div className="space-y-6">
                                            <h5 className="text-[10px] font-black uppercase tracking-[0.3em] theme-text-quaternary border-b theme-border-subtle pb-4">Implementation Timeline</h5>
                                            <div className="space-y-4">
                                                {selectedSuggestion.flow.map((step) => (
                                                    <div key={step.step} className="flex gap-6 p-6 bg-white/[0.02] rounded-[1.8rem] border theme-border-subtle group hover:theme-border-medium transition-all">
                                                        <div className="h-10 w-10 shrink-0 bg-sky-500/10 rounded-xl flex items-center justify-center text-sky-400 text-xs font-black shadow-inner border border-sky-500/10 group-hover:scale-110 transition-transform">
                                                            {step.step}
                                                        </div>
                                                        <div>
                                                            <h6 className="text-[13px] font-bold text-white mb-1 group-hover:text-sky-300 transition-colors uppercase tracking-wide">{step.task}</h6>
                                                            <p className="text-[12px] theme-text-tertiary leading-relaxed font-medium">{step.description}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Agent Instruction Block */}
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between border-b theme-border-subtle pb-4">
                                                <h5 className="text-[10px] font-black uppercase tracking-[0.3em] theme-text-quaternary">Agent Instruction File</h5>
                                                <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-500/60 uppercase">
                                                    <Sparkles size={12} />
                                                    Optimized for Gemini 2.0
                                                </div>
                                            </div>
                                            <div className="p-8 bg-black/40 rounded-[2.5rem] border theme-border-subtle relative overflow-hidden group">
                                                <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                <div className="prose prose-invert prose-xs max-w-none text-white/60 relative z-10 font-mono tracking-tight leading-loose">
                                                    <ReactMarkdown>{selectedSuggestion.agentInstructions}</ReactMarkdown>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="pt-8 flex items-center gap-4">
                                            <button
                                                onClick={() => onApply(selectedSuggestion)}
                                                className="flex-1 flex items-center justify-center gap-3 px-8 py-5 bg-gradient-to-r from-sky-600 to-emerald-500 hover:from-sky-500 hover:to-emerald-400 text-white rounded-[1.8rem] text-sm font-black uppercase tracking-[0.2em] shadow-2xl shadow-sky-500/20 transition-all active:scale-95"
                                            >
                                                <Wand2 size={20} />
                                                Initialize Strategic Flow
                                                <ArrowRight size={20} />
                                            </button>
                                            <button
                                                className="px-8 py-5 theme-overlay-subtle hover:theme-overlay-medium theme-text-tertiary hover:text-white rounded-[1.8rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all border theme-border-subtle"
                                                onClick={() => toast.info("Flow bookmarked for later.")}
                                            >
                                                <Bookmark size={20} />
                                            </button>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-center text-white/10">
                                        <Layout size={64} className="mb-6 opacity-20" />
                                        <p className="text-lg font-bold uppercase tracking-[0.3em]">Select a Flow</p>
                                        <p className="text-xs mt-2 max-w-xs font-medium">Explore the library and select a strategic blueprint to view full task details.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-10 py-5 bg-white/[0.01] border-t theme-border-subtle flex items-center justify-between text-[10px] font-bold theme-text-quaternary uppercase tracking-[0.2em]">
                            <div className="flex items-center gap-6">
                                <span className="flex items-center gap-2">AI Engine: <span className="text-sky-400">Tactical Research Agent</span></span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span>Powered by Real-time Intelligence</span>
                                <span className="w-1 h-1 rounded-full bg-white/10" />
                                <span>v1.2.0</span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}

