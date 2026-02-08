'use client';

import React from 'react';
import { Terminal, Circle, CheckCircle2, AlertCircle, Info, ChevronRight, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TerminalViewProps {
    content: string;
    title?: string;
    isError?: boolean;
    className?: string;
    maxHeight?: string;
}

const GLYPH_MAP: Record<string, React.ReactNode> = {
    '◇': <Circle size={10} className="text-sky-400/60" />,
    '│': <div className="w-px h-full bg-foreground/10 mx-auto" />,
    '└': <div className="w-2 h-2 border-l border-b border-foreground/20 rounded-bl-sm -mt-2 ml-1" />,
    '√': <CheckCircle2 size={12} className="text-emerald-400" />,
    '✔': <CheckCircle2 size={12} className="text-emerald-400" />,
    '×': <XCircle size={12} className="text-red-400" />,
    '✖': <XCircle size={12} className="text-red-400" />,
    '⚠': <AlertCircle size={12} className="text-amber-400" />,
    'ℹ': <Info size={12} className="text-sky-400" />,
    '»': <ChevronRight size={12} className="text-muted-foreground/40" />,
};

// Simple ANSI color parser
const parseAnsi = (text: string) => {
    // This is a simplified parser for common terminal colors
    // Pattern: \u001b[ color_code m
    const parts = text.split(/(\u001b\[\d+m)/);
    let currentColorClass = '';

    return parts.map((part, i) => {
        if (part.startsWith('\u001b[')) {
            const code = part.match(/\d+/)?.[0];
            switch (code) {
                case '0': // Reset
                case '39':
                    currentColorClass = '';
                    break;
                case '31': // Red
                    currentColorClass = 'text-red-400';
                    break;
                case '32': // Green
                    currentColorClass = 'text-emerald-400';
                    break;
                case '33': // Yellow
                    currentColorClass = 'text-amber-400';
                    break;
                case '34': // Blue
                    currentColorClass = 'text-sky-400';
                    break;
                case '35': // Magenta
                    currentColorClass = 'text-amber-400';
                    break;
                case '36': // Cyan
                    currentColorClass = 'text-emerald-400';
                    break;
                case '90': // Grey
                    currentColorClass = 'text-muted-foreground/30';
                    break;
                case '1': // Bold
                    currentColorClass += ' font-bold';
                    break;
                default:
                    break;
            }
            return null;
        }

        if (!part) return null;

        // Process line by line to handle glyphs
        const lines = part.split('\n');
        return lines.map((line, lineIdx) => {
            // Check for leading glyphs
            let glyph: React.ReactNode = null;
            let restOfLine = line;

            for (const [char, icon] of Object.entries(GLYPH_MAP)) {
                if (line.trim().startsWith(char)) {
                    glyph = <span className="mr-2 inline-flex items-center translate-y-[1px]">{icon}</span>;
                    restOfLine = line.replace(char, '').trim();
                    break;
                }
            }

            return (
                <div key={`${i}-${lineIdx}`} className={cn("flex items-start min-h-[1.5em]", currentColorClass)}>
                    {glyph}
                    <span className="whitespace-pre-wrap flex-1">{restOfLine}</span>
                    {lineIdx < lines.length - 1 && <br />}
                </div>
            );
        });
    });
};

export default function TerminalView({
    content,
    title = 'Terminal',
    isError = false,
    className,
    maxHeight = '400px'
}: TerminalViewProps) {
    if (!content) return null;

    return (
        <div className={cn(
            "rounded-xl overflow-hidden border transition-all duration-300 shadow-2xl bg-[#0c0c14]/90 backdrop-blur-xl",
            isError ? "border-red-500/30" : "border-[color:var(--border)]",
            className
        )}>
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-foreground/5 border-b border-[color:var(--border)]">
                <div className="flex items-center gap-4">
                    <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                        <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                        <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
                    </div>
                    <div className="flex items-center gap-2">
                        <Terminal size={12} className={cn(isError ? "text-red-400" : "text-emerald-400")} />
                        <span className="text-[10px] font-mono font-bold text-muted-foreground/40 uppercase tracking-widest">{title}</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-mono text-muted-foreground/20 uppercase tracking-wider font-bold">Local Shell</span>
                </div>
            </div>

            {/* Terminal Body */}
            <div
                className="p-4 font-mono text-[11px] overflow-auto custom-scrollbar"
                style={{ maxHeight }}
            >
                <div className="space-y-0.5">
                    {parseAnsi(content)}
                </div>

                {/* Visual cursor at the end */}
                <div className="mt-2 flex items-center gap-2">
                    <span className="text-emerald-400/50">❯</span>
                    <div className="w-2 h-4 bg-sky-500/40 animate-pulse" />
                </div>
            </div>

            {/* Terminal Footer/Status */}
            <div className="px-4 py-1.5 bg-black/40 border-t border-[color:var(--border)] flex items-center justify-between text-[9px] font-mono text-muted-foreground/20">
                <div className="flex gap-4">
                    <span>UTF-8</span>
                    <span>Bash</span>
                </div>
                <div className="flex gap-4">
                    <span>Main Project</span>
                    <span className="text-emerald-500/40">● Active</span>
                </div>
            </div>
        </div>
    );
}
