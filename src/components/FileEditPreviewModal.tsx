
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, FileText, Check, Loader2, Edit3, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface FileEditPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    fileName: string;
    content: string;
    onComplete?: () => void;
}

export default function FileEditPreviewModal({
    isOpen,
    onClose,
    fileName,
    content,
    onComplete
}: FileEditPreviewModalProps) {
    const [displayedContent, setDisplayedContent] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [step, setStep] = useState<'initializing' | 'typing' | 'finishing' | 'done'>('initializing');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            setStep('initializing');
            setDisplayedContent('');

            // Start simulation
            const startTimeout = setTimeout(() => {
                setStep('typing');
                setIsTyping(true);
            }, 800);

            return () => clearTimeout(startTimeout);
        }
    }, [isOpen]);

    useEffect(() => {
        if (step === 'typing' && content) {
            let index = 0;
            const words = content.split(' ');
            const interval = setInterval(() => {
                if (index < words.length) {
                    setDisplayedContent(prev => prev + (index === 0 ? '' : ' ') + words[index]);
                    index++;

                    // Auto-scroll to bottom
                    if (scrollRef.current) {
                        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                    }
                } else {
                    clearInterval(interval);
                    setIsTyping(false);
                    setStep('finishing');

                    const endTimeout = setTimeout(() => {
                        setStep('done');
                        if (onComplete) onComplete();
                    }, 1000);

                    return () => clearTimeout(endTimeout);
                }
            }, 30); // Fast typing speed

            return () => clearInterval(interval);
        }
    }, [step, content]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="w-full max-w-4xl h-[70vh] bg-zinc-950 border theme-border-medium rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col relative"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-8 py-6 border-b theme-border-subtle bg-zinc-900/50 backdrop-blur-sm">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-sky-500/10 rounded-2xl border border-sky-500/20 shadow-lg shadow-sky-500/5">
                                <Edit3 className="text-sky-400" size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-[0.2em] theme-text-tertiary mb-0.5">Live File Modification</h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-lg font-bold text-white tracking-tight">{fileName}</span>
                                    <span className="px-2 py-0.5 theme-overlay-subtle rounded text-[10px] font-mono text-white/30 border theme-border-medium italic">MODIFIED</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-xl border text-[11px] font-black uppercase tracking-widest transition-all duration-500",
                                step === 'typing' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                    step === 'done' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                        "theme-overlay-subtle theme-text-tertiary theme-border-medium"
                            )}>
                                {step === 'initializing' && <><Loader2 size={12} className="animate-spin" /> Preparing Bridge</>}
                                {step === 'typing' && <><motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-2 h-2 rounded-full bg-amber-400" /> Writing Logic</>}
                                {step === 'finishing' && <><Check size={12} /> Persisting Stream</>}
                                {step === 'done' && <><Check size={12} /> Sync Complete</>}
                            </div>

                            <button
                                onClick={onClose}
                                className="p-3 theme-overlay-subtle hover:theme-overlay-medium text-white/60 hover:text-white rounded-2xl transition-all border border-transparent hover:theme-border-medium"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Content / Editor UI */}
                    <div className="flex-1 overflow-hidden flex flex-col bg-black/40">
                        {/* Fake Gutter */}
                        <div className="flex h-full">
                            <div className="w-16 h-full bg-zinc-950/50 border-r theme-border-subtle flex flex-col items-center py-6 select-none opacity-20 font-mono text-xs gap-3">
                                {Array.from({ length: 20 }).map((_, i) => (
                                    <span key={i}>{i + 1}</span>
                                ))}
                            </div>

                            <div
                                ref={scrollRef}
                                className="flex-1 p-8 overflow-y-auto custom-scrollbar font-mono text-sm leading-relaxed"
                            >
                                <div className="max-w-none text-sky-50/70 overflow-hidden rounded-lg">
                                    <SyntaxHighlighter
                                        language={fileName.split('.').pop() || 'text'}
                                        style={vscDarkPlus}
                                        customStyle={{
                                            margin: 0,
                                            padding: '1.5rem',
                                            fontSize: '13px',
                                            lineHeight: '1.6',
                                            backgroundColor: 'transparent',
                                            background: 'transparent',
                                        }}
                                        showLineNumbers={true}
                                        wrapLongLines={true}
                                    >
                                        {displayedContent}
                                    </SyntaxHighlighter>
                                    {isTyping && (
                                        <motion.span
                                            animate={{ opacity: [0, 1, 0] }}
                                            transition={{ repeat: Infinity, duration: 0.8 }}
                                            className="inline-block w-2.5 h-5 bg-sky-500 ml-4 mb-1 shadow-[0_0_10px_rgba(56,189,248,0.8)]"
                                        />
                                    )}
                                </div>
                                {step === 'initializing' && (
                                    <div className="flex flex-col items-center justify-center h-full gap-4 theme-text-quaternary uppercase tracking-[0.3em] font-black text-xs">
                                        <div className="w-48 h-1 theme-overlay-subtle rounded-full overflow-hidden">
                                            <motion.div
                                                className="h-full bg-sky-600 shadow-[0_0_20px_rgba(56,189,248,0.5)]"
                                                initial={{ width: 0 }}
                                                animate={{ width: "100%" }}
                                                transition={{ duration: 0.8 }}
                                            />
                                        </div>
                                        Connecting to File Core
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer / Status */}
                    <div className="px-8 py-4 bg-zinc-900/50 border-t theme-border-subtle flex items-center justify-between">
                        <div className="flex items-center gap-6 opacity-40">
                            <div className="flex items-center gap-2">
                                <Terminal size={14} />
                                <span className="text-[10px] font-bold tracking-widest uppercase">utf-8</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <FileText size={14} />
                                <span className="text-[10px] font-bold tracking-widest uppercase">{Math.ceil(displayedContent.length / 1024)} KB</span>
                            </div>
                        </div>

                        {step === 'done' && (
                            <motion.button
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                onClick={onClose}
                                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-emerald-900/20 active:scale-95 transition-all"
                            >
                                Back to Agent
                            </motion.button>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
