'use client';

import React, { useState, useEffect } from 'react';
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
}

export default function SuggestionsLibraryModal({ isOpen, onClose, onApply }: SuggestionsLibraryModalProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);

    const handleSearch = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!searchQuery.trim()) {
            toast.error("Please enter a research theme or industry");
            return;
        }

        setIsLoading(true);
        try {
            const res = await generateSuggestions(searchQuery);
            if (res.success && res.suggestions) {
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

    // Pre-populate with some default ideas
    useEffect(() => {
        if (isOpen && suggestions.length === 0) {
            setSearchQuery('Premium SaaS and Fintech Solutions');
            // We don't auto-search to let user see empty state or they can search themselves
        }
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 backdrop-blur-xl p-4 md:p-8">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="w-full h-full max-w-6xl bg-[#0a0a0b] border border-white/10 rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-600/20 rounded-2xl text-blue-400 border border-blue-500/20 shadow-xl shadow-blue-500/10">
                                    <Compass size={24} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-white tracking-tight leading-none mb-1">Inspiration Library</h2>
                                    <p className="text-xs text-white/30 font-bold uppercase tracking-widest">Discover & Import Strategic Task Flows</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-3 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white rounded-full transition-all"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Search Bar */}
                        <div className="px-8 py-6 bg-white/[0.01] border-b border-white/5">
                            <form onSubmit={handleSearch} className="relative group">
                                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-blue-400 transition-colors" size={20} />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search for industries (e.g. Real Estate, Fintech, E-commerce) or themes..."
                                    className="w-full bg-white/5 border border-white/10 rounded-[1.8rem] pl-16 pr-44 py-5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/30 transition-all placeholder:text-white/10 font-medium"
                                />
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 transition-all active:scale-95"
                                >
                                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
                                    Explore Ideas
                                </button>
                            </form>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 flex overflow-hidden">
                            {/* Catalog */}
                            <div className="w-[400px] border-r border-white/5 overflow-y-auto p-8 space-y-4 custom-scrollbar bg-black/20">
                                {suggestions.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-white/5 rounded-[2.5rem]">
                                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6 text-white/10">
                                            <Lightbulb size={32} />
                                        </div>
                                        <p className="text-sm font-bold text-white/20 uppercase tracking-widest">No Flows Loaded</p>
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
                                                    ? "bg-blue-600/10 border-blue-500/30 shadow-xl shadow-blue-500/5"
                                                    : "bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/5"
                                            )}
                                        >
                                            <div className="relative z-10">
                                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-400/60 mb-2 block">{s.category}</span>
                                                <h4 className="text-sm font-bold text-white mb-2 group-hover:text-blue-300 transition-colors">{s.title}</h4>
                                                <p className="text-[11px] text-white/40 line-clamp-2 leading-relaxed">{s.description}</p>
                                            </div>
                                            {selectedSuggestion?.id === s.id && (
                                                <div className="absolute top-0 right-0 p-4">
                                                    <Check size={14} className="text-blue-400" />
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
                                                <span className="px-3 py-1 bg-blue-600/10 text-blue-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-500/10">
                                                    {selectedSuggestion.category}
                                                </span>
                                                <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Strategic Flow • ID: {selectedSuggestion.id}</span>
                                            </div>
                                            <h3 className="text-4xl font-black text-white tracking-tighter">{selectedSuggestion.title}</h3>
                                            <p className="text-lg text-white/60 leading-relaxed font-medium">{selectedSuggestion.description}</p>
                                        </div>

                                        {/* Task Steps */}
                                        <div className="space-y-6">
                                            <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 border-b border-white/5 pb-4">Implementation Timeline</h5>
                                            <div className="space-y-4">
                                                {selectedSuggestion.flow.map((step) => (
                                                    <div key={step.step} className="flex gap-6 p-6 bg-white/[0.02] rounded-[1.8rem] border border-white/5 group hover:border-white/10 transition-all">
                                                        <div className="h-10 w-10 shrink-0 bg-blue-600/10 rounded-xl flex items-center justify-center text-blue-400 text-xs font-black shadow-inner border border-blue-500/10 group-hover:scale-110 transition-transform">
                                                            {step.step}
                                                        </div>
                                                        <div>
                                                            <h6 className="text-[13px] font-bold text-white mb-1 group-hover:text-blue-300 transition-colors uppercase tracking-wide">{step.task}</h6>
                                                            <p className="text-[12px] text-white/40 leading-relaxed font-medium">{step.description}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Agent Instruction Block */}
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between border-b border-white/5 pb-4">
                                                <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Agent Instruction File</h5>
                                                <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-500/60 uppercase">
                                                    <Sparkles size={12} />
                                                    Optimized for Gemini 2.0
                                                </div>
                                            </div>
                                            <div className="p-8 bg-black/40 rounded-[2.5rem] border border-white/5 relative overflow-hidden group">
                                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                <div className="prose prose-invert prose-xs max-w-none text-white/60 relative z-10 font-mono tracking-tight leading-loose">
                                                    <ReactMarkdown>{selectedSuggestion.agentInstructions}</ReactMarkdown>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="pt-8 flex items-center gap-4">
                                            <button
                                                onClick={() => onApply(selectedSuggestion)}
                                                className="flex-1 flex items-center justify-center gap-3 px-8 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-[1.8rem] text-sm font-black uppercase tracking-[0.2em] shadow-2xl shadow-blue-500/20 transition-all active:scale-95"
                                            >
                                                <Wand2 size={20} />
                                                Initialize Strategic Flow
                                                <ArrowRight size={20} />
                                            </button>
                                            <button
                                                className="px-8 py-5 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white rounded-[1.8rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all border border-white/5"
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
                        <div className="px-10 py-5 bg-white/[0.01] border-t border-white/5 flex items-center justify-between text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">
                            <div className="flex items-center gap-6">
                                <span className="flex items-center gap-2">AI Engine: <span className="text-blue-400">Tactical Research Agent</span></span>
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
        </AnimatePresence>
    );
}

