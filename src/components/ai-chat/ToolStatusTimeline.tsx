"use client";

import React from 'react';
import { Wrench, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ToolStatusEvent {
    tool: string;
    phase: 'start' | 'finish';
    timestamp: number;
    elapsedMs?: number;
}

interface ToolStatusTimelineProps {
    events: ToolStatusEvent[];
}

export const ToolStatusTimeline: React.FC<ToolStatusTimelineProps> = ({ events }) => {
    if (!events || events.length === 0) return null;

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

    const formatElapsedTime = (ms: number): string => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    };

    return (
        <div className="my-3 pl-3 pr-2 border-l-2 border-amber-500/20 space-y-2">
            <div className="flex items-center gap-2 mb-2">
                <Wrench size={12} className="text-amber-400 opacity-60" />
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/30">
                    Tool Execution Timeline
                </h3>
            </div>

            <div className="space-y-2">
                {Array.from(toolGroups.entries()).map(([toolName, group], index) => {
                    const isComplete = !!group.finish;
                    const elapsedMs = group.finish?.elapsedMs;

                    return (
                        <div key={`${toolName}-${index}`} className="relative pl-4 group/item">
                            <div
                                className={cn(
                                    'absolute left-[-5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-[#1e1e1e] transition-all duration-500',
                                    isComplete ? 'bg-green-500' : 'bg-amber-500 animate-pulse'
                                )}
                            />

                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    {isComplete ? (
                                        <CheckCircle2 size={12} className="text-green-400" />
                                    ) : (
                                        <Clock size={12} className="text-amber-400 animate-pulse" />
                                    )}
                                    <span className="text-[11px] font-mono text-zinc-300">
                                        {toolName}
                                    </span>
                                </div>

                                {elapsedMs !== undefined && (
                                    <span className="text-[10px] font-mono text-zinc-500">
                                        {formatElapsedTime(elapsedMs)}
                                    </span>
                                )}
                            </div>

                            {!isComplete && (
                                <div className="mt-1 text-[10px] text-amber-400/60 font-medium">
                                    Executing...
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ToolStatusTimeline;
