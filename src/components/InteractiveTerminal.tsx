'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Send, ChevronRight, X, Trash2, Maximize2 } from 'lucide-react';
import { runShellCommand, TerminalResponse } from '@/app/terminalActions';
import { cn } from '@/lib/utils';
import TerminalView from './TerminalView';

interface TerminalEntry {
    type: 'command' | 'response';
    content: string;
    style?: 'success' | 'error' | 'info' | 'default';
}

export default function InteractiveTerminal({ onClose, initialCommand }: { onClose?: () => void, initialCommand?: string }) {
    const [history, setHistory] = useState<TerminalEntry[]>([
        { type: 'response', content: 'TaskFlow Interactive Shell v1.2', style: 'info' },
        { type: 'response', content: 'Type "help" to see available commands.', style: 'default' }
    ]);
    const [input, setInput] = useState('');
    const [isExecuting, setIsExecuting] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const hasRunInitial = useRef(false);

    useEffect(() => {
        if (initialCommand && !hasRunInitial.current) {
            hasRunInitial.current = true;
            // Small delay to allow render
            setTimeout(() => {
                handleExecute(undefined, initialCommand);
            }, 500);
        }
    }, [initialCommand]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [history]);

    const handleExecute = async (e?: React.FormEvent, commandOverride?: string) => {
        if (e) e.preventDefault();

        const cmd = commandOverride || input.trim();
        if (!cmd || isExecuting) return;

        if (!commandOverride) setInput('');
        setHistory(prev => [...prev, { type: 'command', content: cmd }]);
        setIsExecuting(true);

        if (cmd === 'clear') {
            setHistory([]);
            setIsExecuting(false);
            return;
        }

        try {
            const res: TerminalResponse = await runShellCommand(cmd);
            setHistory(prev => [...prev, {
                type: 'response',
                content: res.output,
                style: res.type as any
            }]);

            // Dispatch preview event if URL returned
            if (res.previewUrl) {
                window.dispatchEvent(new CustomEvent('set-vibe-preview', { detail: res.previewUrl }));
            }
        } catch (err) {
            setHistory(prev => [...prev, {
                type: 'response',
                content: 'Failed to execute command.',
                style: 'error'
            }]);
        } finally {
            setIsExecuting(false);
            // Re-focus input after execution
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#08080c] border border-white/10 rounded-xl overflow-hidden shadow-2xl relative">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/5 backdrop-blur-md z-10">
                <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
                    </div>
                    <div className="h-4 w-px bg-white/10 mx-1" />
                    <div className="flex items-center gap-2">
                        <Terminal size={12} className="text-sky-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/50">Omni-Shell</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setHistory([])}
                        className="p-1.5 hover:bg-white/5 rounded-md text-white/20 hover:text-white/60 transition-all"
                        title="Clear History"
                    >
                        <Trash2 size={12} />
                    </button>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-red-500/10 rounded-md text-white/20 hover:text-red-400 transition-all"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Terminal Body */}
            <div
                ref={scrollRef}
                className="flex-1 p-4 font-mono text-[11px] overflow-y-auto custom-scrollbar bg-black/20"
            >
                {history.map((entry, i) => (
                    <div key={i} className={cn(
                        "mb-2 break-words",
                        entry.type === 'command' ? "flex items-start gap-2 text-white/90" : "whitespace-pre-wrap pl-4",
                        entry.style === 'error' ? "text-red-400" :
                            entry.style === 'success' ? "text-emerald-400" :
                                entry.style === 'info' ? "text-cyan-400" : "text-white/60"
                    )}>
                        {entry.type === 'command' && (
                            <span className="text-sky-500 font-bold shrink-0">❯</span>
                        )}
                        <span>{entry.content}</span>
                    </div>
                ))}

                {isExecuting && (
                    <div className="flex items-center gap-2 text-white/30 italic ml-4">
                        <div className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping" />
                        <span>Processing...</span>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <form
                onSubmit={handleExecute}
                className="px-4 py-3 bg-black/40 border-t border-white/5 flex items-center gap-3"
            >
                <ChevronRight size={14} className="text-sky-400 shrink-0" />
                <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isExecuting}
                    placeholder="Enter command (e.g. status, agent, jobs)..."
                    className="flex-1 bg-transparent border-none outline-none text-white/90 font-mono text-[11px] placeholder:text-white/10"
                    autoFocus
                />
                <button
                    type="submit"
                    disabled={isExecuting || !input.trim()}
                    className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 disabled:opacity-30 disabled:hover:bg-sky-500/10 transition-all"
                >
                    <Send size={12} />
                </button>
            </form>

            {/* Status Bar */}
            <div className="px-4 py-1.5 bg-black/60 border-t border-white/5 flex items-center justify-between text-[8px] font-black uppercase tracking-[0.2em] text-white/20">
                <div className="flex gap-6">
                    <span className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/40" />
                        Server: Ready
                    </span>
                    <span>Bash (WSL)</span>
                </div>
                <span>Session: Active</span>
            </div>
        </div>
    );
}
