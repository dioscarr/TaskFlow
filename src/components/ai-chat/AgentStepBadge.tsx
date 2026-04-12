"use client";

import React from 'react';
import { Loader2, X, Zap } from 'lucide-react';

import { cn } from '@/lib/utils';

export const AgentStepBadge = ({ tool, status }: { tool: string; status: 'executing' | 'done' | 'failed' }) => {
    return (
        <div className="mb-6 animate-in fade-in slide-in-from-left-4 duration-700">
            <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.6)] animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Neural Execution</span>
            </div>

            <div
                className={cn(
                    'inline-flex items-center gap-4 px-5 py-3 rounded-2xl border transition-all shadow-2xl backdrop-blur-3xl',
                    status === 'executing'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 animate-[agentic-glow_3s_infinite]'
                        : status === 'done'
                            ? 'bg-[color:var(--card)] border-[color:var(--border)] text-foreground/90'
                            : 'bg-red-500/10 border-red-500/30 text-red-300'
                )}
            >
                <div
                    className={cn(
                        'p-2 rounded-xl bg-foreground/5 border border-[color:var(--border)] shadow-inner',
                        status === 'executing' ? 'text-amber-400' : status === 'done' ? 'text-cyan-400' : 'text-red-400'
                    )}
                >
                    {status === 'executing' ? <Loader2 size={16} className="animate-spin" /> : status === 'done' ? <Zap size={16} fill="currentColor" /> : <X size={16} />}
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground/30 font-black uppercase tracking-[0.2em] leading-none mb-1.5">Action Dispatched</span>
                    <span className="text-[13px] font-mono font-black theme-text-primary tracking-tight">{tool.replace(/_/g, ' ')}</span>
                </div>
            </div>
        </div>
    );
};

export default AgentStepBadge;
