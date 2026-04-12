"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, FileCode, Maximize2, Minimize2 } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';

// Cache collapse state per code block so user expand/collapse persists across re-renders/remounts.
const codeCollapseState = new Map<string, boolean>();

export const CodeBlock = ({ language, code, fileName }: { language: string; code: string; fileName?: string }) => {
    const cacheKey = useMemo(() => `${fileName || 'code'}::${code.length}::${code.slice(0, 32)}`, [code, fileName]);
    const defaultCollapsed = useMemo(() => code.split('\n').length > 20, [code]);
    const [, forceUpdate] = useState(0);
    const cached = codeCollapseState.get(cacheKey);
    const isCollapsed = cached !== undefined ? cached : defaultCollapsed;

    useEffect(() => {
        if (!codeCollapseState.has(cacheKey)) {
            codeCollapseState.set(cacheKey, defaultCollapsed);
        }
    }, [cacheKey, defaultCollapsed]);

    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(code);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
        toast.success('Code copied to clipboard');
    };

    const normalizeLanguage = (lang: string): string => {
        const normalized = lang.toLowerCase().trim();
        const languageMap: Record<string, string> = {
            js: 'javascript',
            ts: 'typescript',
            jsx: 'jsx',
            tsx: 'tsx',
            py: 'python',
            rb: 'ruby',
            sh: 'bash',
            shell: 'bash',
            yml: 'yaml',
            md: 'markdown',
            html: 'markup',
            xml: 'markup',
            svg: 'markup',
        };
        return languageMap[normalized] || normalized || 'text';
    };

    const displayLang = normalizeLanguage(language);

    return (
        <div className="rounded-xl overflow-hidden border border-[color:var(--border)] bg-[#0d0d12] my-4 group shadow-2xl w-full max-w-full">
            <div className="flex items-center justify-between px-4 py-2 bg-foreground/5 border-b border-[color:var(--border)] backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/40 border border-red-500/30" />
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/40 border border-amber-500/30" />
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/40 border border-emerald-500/30" />
                    </div>
                    {fileName && (
                        <div className="flex items-center gap-2 px-2 py-0.5 rounded bg-foreground/5 border border-[color:var(--border)]">
                            <FileCode size={10} className="text-sky-400" />
                            <span className="text-[10px] font-mono text-muted-foreground/70 truncate max-w-[200px]">{fileName}</span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground/30 tracking-widest font-mono">{displayLang}</span>
                    <div className="flex items-center gap-1 border-l border-[color:var(--border)] pl-3">
                        <button
                            onClick={handleCopy}
                            className="p-1.5 hover:bg-foreground/10 rounded-md text-muted-foreground/40 hover:text-foreground transition-all active:scale-90"
                            title="Copy code"
                        >
                            {isCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={13} />}
                        </button>
                        {code.split('\n').length > 20 && (
                            <button
                                onClick={() => {
                                    const next = !isCollapsed;
                                    codeCollapseState.set(cacheKey, next);
                                    forceUpdate((count) => count + 1);
                                }}
                                className="p-1.5 hover:bg-foreground/10 rounded-md text-muted-foreground/40 hover:text-foreground transition-all"
                                title={isCollapsed ? 'Expand code' : 'Collapse code'}
                            >
                                {isCollapsed ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
                            </button>
                        )}
                    </div>
                </div>
            </div>
            <div className={cn(
                'relative overflow-x-auto overflow-y-hidden transition-all duration-500 ease-in-out',
                isCollapsed ? 'max-h-[300px]' : 'max-h-[2000px]'
            )}>
                <SyntaxHighlighter
                    language={displayLang}
                    style={vscDarkPlus}
                    customStyle={{
                        width: '100%',
                        maxWidth: '100%',
                        margin: 0,
                        padding: '1.25rem',
                        fontSize: '12px',
                        lineHeight: '1.6',
                        backgroundColor: 'transparent',
                        background: 'transparent',
                        overflowX: 'auto',
                    }}
                    showLineNumbers
                    wrapLongLines={false}
                    lineNumberStyle={{
                        minWidth: '2.5em',
                        paddingRight: '1em',
                        color: '#343b4d',
                        textAlign: 'right',
                        userSelect: 'none',
                    }}
                    PreTag="div"
                >
                    {code}
                </SyntaxHighlighter>

                {isCollapsed && (
                    <div
                        className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0d0d12] via-[#0d0d12]/80 to-transparent flex items-end justify-center pb-4 cursor-pointer group/expand"
                        onClick={() => {
                            codeCollapseState.set(cacheKey, false);
                            forceUpdate((count) => count + 1);
                        }}
                    >
                        <div className="px-4 py-1.5 bg-foreground/10 hover:bg-foreground/20 border border-[color:var(--border)] rounded-full backdrop-blur-md text-[10px] font-bold text-muted-foreground/50 group-hover/expand:text-foreground transition-all transform group-hover/expand:translate-y-[-2px]">
                            EXPAND {code.split('\n').length} LINES
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CodeBlock;
