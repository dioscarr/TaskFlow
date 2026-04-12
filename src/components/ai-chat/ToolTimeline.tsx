'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckCircle2, Loader2 } from 'lucide-react';

export interface ToolStatusEvent {
    tool: string;
    phase: 'start' | 'finish';
    timestamp: number;
    elapsedMs?: number;
}

interface ToolTimelineProps {
    events: ToolStatusEvent[];
    className?: string;
}

export default function ToolTimeline({ events, className = '' }: ToolTimelineProps) {
    // Group events by tool to show start/finish pairs
    const toolGroups = new Map<string, { start?: ToolStatusEvent; finish?: ToolStatusEvent }>();

    events.forEach(event => {
        if (!toolGroups.has(event.tool)) {
            toolGroups.set(event.tool, {});
        }
        const group = toolGroups.get(event.tool)!;
        if (event.phase === 'start') {
            group.start = event;
        } else {
            group.finish = event;
        }
    });

    if (toolGroups.size === 0) {
        return null;
    }

    return (
        <div className={`space-y-2 ${className}`}>
            <h4 className="text-[10px] font-black uppercase theme-text-quaternary tracking-widest mb-2">
                Tool Execution Timeline
            </h4>
            <AnimatePresence mode="popLayout">
                {Array.from(toolGroups.entries()).map(([toolName, { start, finish }]) => {
                    const isComplete = !!finish;
                    const elapsedMs = finish?.elapsedMs;
                    const elapsedSec = elapsedMs ? (elapsedMs / 1000).toFixed(2) : null;

                    return (
                        <motion.div
                            key={toolName}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg theme-overlay-subtle border theme-border-subtle"
                        >
                            <div className="shrink-0">
                                {isComplete ? (
                                    <CheckCircle2 size={16} className="text-emerald-400" />
                                ) : (
                                    <Loader2 size={16} className="text-sky-400 animate-spin" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold theme-text-primary truncate">
                                    {toolName}
                                </div>
                                {elapsedSec && (
                                    <div className="flex items-center gap-1 text-[10px] theme-text-tertiary">
                                        <Clock size={10} />
                                        <span>{elapsedSec}s</span>
                                    </div>
                                )}
                            </div>
                            {isComplete && (
                                <div className="shrink-0 text-[10px] font-bold text-emerald-400">
                                    Done
                                </div>
                            )}
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}
