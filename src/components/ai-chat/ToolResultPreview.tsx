"use client";

import React from 'react';
import { Activity, Copy, ExternalLink, FolderTree, ListTree, Monitor, Play } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';

import CodeBlock from './CodeBlock';

type TraceIcon = React.ComponentType<{ size?: number; className?: string }>;

const toRecord = (value: unknown): Record<string, unknown> => (
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
);

const TraceLabel = ({ icon: Icon, label, colorClass, dotColor }: { icon: TraceIcon; label: string; colorClass: string; dotColor: string }) => (
    <div className="flex items-center gap-3 mb-2 group/trace">
        <div className={cn('w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)] transition-all duration-500 group-hover/trace:scale-125', dotColor)} />
        <div className="flex items-center gap-2">
            <Icon size={12} className={cn('opacity-80', colorClass)} />
            <span className={cn('text-[10px] font-black uppercase tracking-[0.2em] opacity-60 group-hover/trace:opacity-100 transition-opacity', colorClass)}>
                {label}
            </span>
        </div>
    </div>
);

export const ToolResultPreview = ({ tool, result }: { tool: string; result: unknown }) => {
    const resultRecord = toRecord(result);
    if (resultRecord.success !== true) return null;

    const content = typeof resultRecord.content === 'string' ? resultRecord.content : undefined;
    const path = typeof resultRecord.path === 'string' ? resultRecord.path : undefined;
    const meta = toRecord(resultRecord.meta);
    const previewUrl = typeof resultRecord.previewUrl === 'string' ? resultRecord.previewUrl : undefined;
    const message = typeof resultRecord.message === 'string' ? resultRecord.message : undefined;

    if (tool === 'view_file' && content) {
        return (
            <div className="mt-2">
                <TraceLabel icon={Activity} label="File Read Result" colorClass="text-sky-400" dotColor="bg-sky-500" />
                <CodeBlock language={path?.split('.').pop() || 'text'} code={content} fileName={path} />
                {typeof meta.viewingLines === 'string' && (
                    <div className="text-[9px] text-muted-foreground/30 font-mono mt-1 flex justify-end">{meta.viewingLines}</div>
                )}
            </div>
        );
    }

    if (tool === 'manage_app_lifecycle' && previewUrl) {
        return (
            <div className="mt-3">
                <TraceLabel icon={Play} label="Application Controller" colorClass="text-emerald-400" dotColor="bg-emerald-500" />
                <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] overflow-hidden shadow-xl p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                <Activity className="text-emerald-400" size={20} />
                            </div>
                            <div>
                                <h4 className="text-foreground font-medium text-sm">Application Running</h4>
                                <a
                                    href={previewUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-muted-foreground/40 text-xs hover:text-muted-foreground/60 transition-colors flex items-center gap-1"
                                >
                                    {previewUrl}
                                    <ExternalLink size={10} />
                                </a>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                window.dispatchEvent(new CustomEvent('set-vibe-preview', { detail: previewUrl }));
                                toast.success('Preview updated');
                            }}
                            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs rounded-lg transition-colors flex items-center gap-2"
                        >
                            <Monitor size={12} />
                            Open in Dashboard
                        </button>
                    </div>
                    {message && <div className="mt-3 pt-3 border-t border-[color:var(--border)] text-xs text-muted-foreground/60">{message}</div>}
                </div>
            </div>
        );
    }

    if (tool === 'repo_context_pack' && typeof resultRecord.tree === 'string') {
        const packageJson = toRecord(resultRecord.packageJson);
        const scripts = toRecord(packageJson.scripts);
        const deps = Object.keys(toRecord(packageJson.dependencies));
        const devDeps = Object.keys(toRecord(packageJson.devDependencies));
        const topDeps = [...deps.slice(0, 6), ...devDeps.slice(0, 4)].slice(0, 8);
        const frameworks = Array.isArray(resultRecord.frameworks)
            ? resultRecord.frameworks.filter((fw): fw is string => typeof fw === 'string')
            : [];
        const root = typeof resultRecord.root === 'string' ? resultRecord.root : undefined;
        const entries = typeof resultRecord.entries === 'number' ? resultRecord.entries : undefined;

        const copySummary = async () => {
            const summary = `Tree:\n${resultRecord.tree}\n\nDeps:${topDeps.map(d => ` ${d}`).join('')}\nScripts:${Object.keys(scripts)
                .slice(0, 6)
                .map(k => ` ${k}=${scripts[k]}`)
                .join('')}`;
            try {
                await navigator.clipboard.writeText(summary);
                toast.success('Repo context copied');
            } catch {
                toast.error('Could not copy');
            }
        };

        return (
            <div className="mt-3">
                <TraceLabel icon={FolderTree} label="Repo Context" colorClass="text-sky-300" dotColor="bg-sky-400" />
                <div className="rounded-xl border theme-border-medium bg-[color:var(--card)]/90 shadow-xl overflow-hidden">
                    <div className="px-3 py-2 border-b theme-border-subtle flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[11px] font-semibold text-foreground/80">
                            <ListTree size={14} className="text-sky-300" />
                            <span>Repo sitemap</span>
                            {root && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-foreground/5 border theme-border-subtle text-muted-foreground/70">{root}</span>
                            )}
                            {entries ? <span className="text-[9px] text-muted-foreground/40 font-mono">{entries} entries</span> : null}
                        </div>
                        <div className="flex items-center gap-2">
                            {frameworks.map((fw) => (
                                    <span
                                        key={fw}
                                        className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[0.15em] bg-sky-500/10 text-sky-200 border border-sky-500/20"
                                    >
                                        {fw}
                                    </span>
                                ))}
                            <button
                                onClick={copySummary}
                                className="text-[11px] px-2 py-1 rounded-lg border theme-border-subtle text-muted-foreground/70 hover:text-foreground hover:border-foreground/30 transition-colors flex items-center gap-1"
                            >
                                <Copy size={12} /> Copy
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-0">
                        <div className="md:col-span-3 border-r theme-border-subtle bg-[color:var(--card)]/60">
                            <pre className="p-3 font-mono text-[11px] leading-relaxed text-sky-50/90 max-h-72 overflow-auto custom-scrollbar whitespace-pre">{resultRecord.tree}</pre>
                        </div>
                        <div className="md:col-span-2 p-3 space-y-3">
                            <div>
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">Key Paths</h4>
                                <div className="text-[11px] theme-text-secondary leading-relaxed whitespace-pre-wrap bg-foreground/[0.03] rounded-lg p-2 border theme-border-subtle">
                                    {(Array.isArray(resultRecord.keyPaths) ? resultRecord.keyPaths : []).slice(0, 6).map((p, idx: number) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400/60" />
                                            <span className="truncate" title={String(p)}>
                                                {String(p)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">Scripts</h4>
                                <div className="flex flex-wrap gap-1.5">
                                    {Object.entries(scripts)
                                        .slice(0, 8)
                                        .map(([k, v]) => (
                                            <div key={k} className="px-2 py-1 rounded-lg text-[11px] theme-overlay-subtle border theme-border-subtle flex items-center gap-1">
                                                <span className="font-mono text-sky-200">{k}</span>
                                                <span className="text-muted-foreground/60 text-[10px]">{String(v).slice(0, 60)}</span>
                                            </div>
                                        ))}
                                </div>
                            </div>
                            <div>
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">Top Deps</h4>
                                <div className="flex flex-wrap gap-1.5">
                                    {topDeps.map(dep => (
                                        <span key={dep} className="px-2 py-1 rounded-lg text-[11px] bg-foreground/5 border theme-border-subtle text-muted-foreground/70">
                                            {dep}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return null;
};

export default ToolResultPreview;
