'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, FileText, Image as ImageIcon, Layout } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { getToolRisk } from '@/lib/toolLibrary';
import { normalizeMarkdown } from '@/utils/markdownUtils';

import { SelectedFile } from './types';
import AgentStepBadge from './AgentStepBadge';
import ThinkingProcess from './ThinkingProcess';
import ToolResultPreview from './ToolResultPreview';
import CodeBlock from './CodeBlock';

type ToolArgs = unknown;
type ToolResult = unknown;

type BubbleMessage = {
    role: 'user' | 'ai' | 'model';
    content: string;
    files?: SelectedFile[];
    toolUsed?: string;
    toolResult?: ToolResult;
    toolArgs?: ToolArgs;
    thinking?: string;
    appliedContext?: {
        agent?: { id?: string; name?: string; description?: string };
        scope?: { mode?: string; label?: string };
        workflows?: Array<{ name?: string; stepCount?: number }>;
    };
};

type MarkdownCodeProps = React.ComponentProps<'code'> & { inline?: boolean; className?: string; children?: React.ReactNode };
type MarkdownPreProps = React.ComponentProps<'pre'>;
type MarkdownTableProps = React.ComponentProps<'table'>;
type MarkdownTableSectionProps = React.ComponentProps<'thead'>;
type MarkdownTableCellProps = React.ComponentProps<'th'>;
type MarkdownTableDataProps = React.ComponentProps<'td'>;
type MarkdownAnchorProps = React.ComponentProps<'a'>;
type MarkdownParagraphProps = React.ComponentProps<'p'>;
type MarkdownListProps = React.ComponentProps<'ul'>;
type MarkdownOrderedListProps = React.ComponentProps<'ol'>;
type MarkdownListItemProps = React.ComponentProps<'li'> & { node?: unknown };
type MarkdownHeadingProps = React.ComponentProps<'h1'>;
type MarkdownHeading2Props = React.ComponentProps<'h2'>;
type MarkdownHeading3Props = React.ComponentProps<'h3'>;
type MarkdownBlockquoteProps = React.ComponentProps<'blockquote'>;

const toRecord = (value: unknown): Record<string, unknown> => (
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
);

const extractThinkingBlocks = (text: string) => {
    if (!text) return { cleaned: text, thinking: undefined as string | undefined };

    const thoughts: string[] = [];
    const xmlRegex = /<thinking>([\s\S]*?)<\/thinking>/gi;
    const mdRegex = /```thinking\s*([\s\S]*?)```/gi;

    let cleaned = text.replace(xmlRegex, (_, content: string) => {
        const trimmed = String(content || '').trim();
        if (trimmed) thoughts.push(trimmed);
        return '';
    });

    cleaned = cleaned.replace(mdRegex, (_, content: string) => {
        const trimmed = String(content || '').trim();
        if (trimmed) thoughts.push(trimmed);
        return '';
    });

    return {
        cleaned: cleaned.trim(),
        thinking: thoughts.length ? thoughts.join('\n\n') : undefined
    };
};

export type MessageBubbleProps = {
    msg: BubbleMessage;
    attachedFiles: SelectedFile[];
    showThinking: boolean;
    setInput: (s: string) => void;
    setActiveTool: (s: string | null) => void;
    onApproveOnce?: () => void;
    onApproveAlways?: () => void;
};

export const MessageBubble = ({ msg, attachedFiles, showThinking, setInput, setActiveTool, onApproveOnce, onApproveAlways }: MessageBubbleProps) => {
    const toolResultRecord = toRecord(msg.toolResult);
    const toolArgsRecord = toRecord(msg.toolArgs);
    const fileMeta = (() => {
        const file = toRecord(toolResultRecord.file);
        if (typeof file.name === 'string') return { name: file.name, type: typeof file.type === 'string' ? file.type : undefined };
        if (typeof toolResultRecord.fileName === 'string') return { name: toolResultRecord.fileName, type: toolResultRecord.fileName.split('.').pop()?.toLowerCase() };
        if (typeof toolArgsRecord.filename === 'string') return { name: toolArgsRecord.filename, type: toolArgsRecord.filename.split('.').pop()?.toLowerCase() };
        if (typeof toolArgsRecord.fileId === 'string' && toolArgsRecord.fileId.includes('.')) {
            return { name: toolArgsRecord.fileId, type: toolArgsRecord.fileId.split('.').pop()?.toLowerCase() };
        }
        return null;
    })();

    const FileIcon = fileMeta?.type?.includes('pdf')
        ? FileText
        : fileMeta?.type?.includes('png') || fileMeta?.type?.includes('jpg') || fileMeta?.type?.includes('jpeg') || fileMeta?.type?.includes('image')
            ? ImageIcon
            : fileMeta?.type?.includes('html')
                ? Layout
                : FileText;

    const isUser = msg.role === 'user';
    const requiresApproval = toolResultRecord.requiresApproval === true;
    const proposedTools = Array.isArray(toolResultRecord.proposedTools)
        ? toolResultRecord.proposedTools.filter((tool): tool is string => typeof tool === 'string')
        : [];
    const riskByTool = proposedTools.map((tool) => ({
        tool,
        risk: getToolRisk(tool)
    }));
    const extracted = extractThinkingBlocks(msg.content);
    const thinkingContent = msg.thinking || extracted.thinking;
    const displayContent = thinkingContent ? extracted.cleaned : msg.content;
    const appliedAgentName = typeof msg.appliedContext?.agent?.name === 'string' ? msg.appliedContext.agent.name : '';
    const appliedScopeLabel = typeof msg.appliedContext?.scope?.label === 'string' ? msg.appliedContext.scope.label : '';
    const appliedWorkflowNames = Array.isArray(msg.appliedContext?.workflows)
        ? msg.appliedContext.workflows
            .map((workflow) => typeof workflow?.name === 'string' ? workflow.name : '')
            .filter(Boolean)
        : [];

    const hasToolPreview = !isUser && msg.toolUsed && !requiresApproval;
    const hasApprovalPanel = !isUser && requiresApproval;
    const hasRenderableContent = displayContent.trim().length > 0 || hasToolPreview || hasApprovalPanel;

    return (
        <div
            className={cn(
                'flex flex-col gap-2 max-w-[88%] w-full min-w-0 animate-in fade-in slide-in-from-bottom-2 duration-500',
                isUser ? 'ml-auto items-end pr-1' : 'items-start'
            )}
        >
            {msg.files && msg.files.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2 justify-end">
                    {msg.files.map((f) => {
                        const isImage = /^(image|png|jpg|jpeg|gif|webp|heic|heif)$/i.test(f.type || '');
                        const imgSrc = isImage && f.storagePath
                            ? `/${f.storagePath.replace(/^public\//, '')}`
                            : null;
                        return (
                            <div key={f.id} className={cn(
                                "rounded-lg border border-[color:var(--border)] overflow-hidden",
                                imgSrc ? "w-32 bg-black/20" : "flex items-center gap-1.5 px-2 py-1 bg-foreground/5 text-[10px] text-foreground/60"
                            )}>
                                {imgSrc ? (
                                    <div className="flex flex-col">
                                        <img src={imgSrc} alt={f.name} className="w-full h-24 object-cover" />
                                        <span className="px-1.5 py-0.5 text-[9px] text-foreground/50 truncate">{f.name}</span>
                                    </div>
                                ) : (
                                    <>
                                        {f.type === 'pdf' ? <FileText size={10} /> : <ImageIcon size={10} />}
                                        <span className="truncate max-w-[150px]">{f.name}</span>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="relative pl-6 border-l border-[color:var(--border)] space-y-2">
                {!isUser && showThinking && thinkingContent && <ThinkingProcess content={thinkingContent} />}
                {!isUser && msg.toolUsed && <AgentStepBadge tool={msg.toolUsed} status="done" />}
                {!isUser && (appliedAgentName || appliedScopeLabel || appliedWorkflowNames.length > 0) && (
                    <div className="flex flex-wrap gap-1.5">
                        {appliedAgentName && (
                            <span className="px-2 py-1 rounded-lg text-[10px] font-bold border bg-sky-500/10 border-sky-500/20 text-sky-300">
                                {appliedAgentName}
                            </span>
                        )}
                        {appliedScopeLabel && (
                            <span className="px-2 py-1 rounded-lg text-[10px] font-bold border bg-emerald-500/10 border-emerald-500/20 text-emerald-300">
                                {appliedScopeLabel}
                            </span>
                        )}
                        {appliedWorkflowNames.slice(0, 2).map((workflowName) => (
                            <span key={workflowName} className="px-2 py-1 rounded-lg text-[10px] font-bold border bg-amber-500/10 border-amber-500/20 text-amber-200">
                                {workflowName}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {hasRenderableContent && (
                <div
                    className={cn(
                        'relative group/msg transition-all duration-500 rounded-[2rem] p-0 shadow-3xl min-w-0',
                        isUser
                            ? 'bg-gradient-to-br from-sky-500 via-emerald-500 to-teal-400 text-white rounded-tr-none border border-white/20'
                            : 'bg-[color:var(--card)] border border-[color:var(--border)] text-foreground/90 rounded-tl-none backdrop-blur-3xl'
                    )}
                >
                    {!isUser && (
                        <div className="absolute inset-0 bg-gradient-to-tr from-sky-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-1000 pointer-events-none" />
                    )}

                    <div
                        className={cn(
                            'px-6 py-5 text-[14px] leading-[1.8] tracking-tight break-words wrap-anywhere markdown-content min-w-0',
                            isUser ? 'text-white/95 font-medium' : 'text-foreground/90 font-normal'
                        )}
                    >
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                pre: ({ children, ...props }: MarkdownPreProps) => {
                                    const codeElement = React.Children.toArray(children).find((child) => (child as { props?: { node?: { tagName?: string } } })?.props?.node?.tagName === 'code');
                                    if (codeElement) return <div className="not-prose my-4">{codeElement}</div>;
                                    return <pre {...props} className="my-4 overflow-x-auto">{children}</pre>;
                                },
                                table: (props: MarkdownTableProps) => (
                                    <div className="table-container my-6 overflow-x-auto rounded-[1rem] border theme-border-medium bg-black/40 shadow-2xl">
                                        <table {...props} className="text-[12px] w-full border-collapse" />
                                    </div>
                                ),
                                thead: (props: MarkdownTableSectionProps) => <thead {...props} className="bg-foreground/5 text-muted-foreground/40 uppercase text-[10px] font-bold tracking-widest border-b border-[color:var(--border)]" />,
                                th: (props: MarkdownTableCellProps) => <th {...props} className="px-5 py-3 text-left" />,
                                td: (props: MarkdownTableDataProps) => <td {...props} className="px-5 py-3 border-t border-[color:var(--border)]" />,
                                a: (props: MarkdownAnchorProps) => (
                                    <a
                                        {...props}
                                        className="text-sky-400 hover:text-sky-300 underline underline-offset-4 decoration-sky-500/30 font-medium transition-colors break-all"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    />
                                ),
                                code: ({ className, children, inline, ...props }: MarkdownCodeProps) => {
                                    const match = /language-(\w+)/.exec(className || '');
                                    const codeString = String(children).replace(/\n$/, '');
                                    const isInline = inline || (!match && !codeString.includes('\n'));

                                    if (isInline) {
                                        return (
                                            <code
                                                className="theme-overlay-medium px-1.5 py-0.5 rounded-md font-mono text-[11px] text-sky-300 border theme-border-subtle mx-0.5 break-all"
                                                {...props}
                                            >
                                                {children}
                                            </code>
                                        );
                                    }

                                    return <CodeBlock language={match?.[1] || 'text'} code={codeString} />;
                                },
                                p: (props: MarkdownParagraphProps) => <p {...props} className="mb-5 last:mb-0 opacity-90 break-words" />,
                                ul: (props: MarkdownListProps) => <ul {...props} className="list-none pl-1 mb-5 space-y-2.5" />,
                                ol: (props: MarkdownOrderedListProps) => <ol {...props} className="list-none pl-1 mb-5 space-y-2.5" />,
                                li: (props) => {
                                    const { node, ...rest } = props as React.ComponentProps<'li'> & { node?: { parent?: { tagName?: string; children?: unknown[] } } };
                                    const nodeInfo = node as { parent?: { tagName?: string; children?: unknown[] } } | undefined;
                                    const isInsideOl = nodeInfo?.parent?.tagName === 'ol';
                                    const index = nodeInfo?.parent?.children && Array.isArray(nodeInfo.parent.children)
                                        ? nodeInfo.parent.children.indexOf(nodeInfo as unknown as object) + 1
                                        : 0;
                                    return (
                                        <li {...rest} className="flex items-start gap-4">
                                            <div className="mt-2 flex-shrink-0 flex items-center justify-center">
                                                {isInsideOl ? (
                                                    <span className="text-[10px] font-black text-sky-400/70 w-5 h-5 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                                                        {index}
                                                    </span>
                                                ) : (
                                                    <div className="w-1.5 h-1.5 rounded-full bg-sky-500/40 border border-sky-500/20" />
                                                )}
                                            </div>
                                            <div className="flex-1 opacity-90 break-words">{props.children}</div>
                                        </li>
                                    );
                                },
                                h1: (props: MarkdownHeadingProps) => (
                                    <h1 {...props} className="text-xl font-black theme-text-primary mb-4 mt-8 pb-3 border-b theme-border-medium tracking-tight break-words" />
                                ),
                                h2: (props: MarkdownHeading2Props) => (
                                    <h2 {...props} className="text-lg font-bold theme-text-primary mb-3 mt-8 tracking-tight flex items-center gap-2 before:w-1 before:h-4 before:bg-sky-500 before:rounded-full break-words" />
                                ),
                                h3: (props: MarkdownHeading3Props) => <h3 {...props} className="text-[15px] font-bold theme-text-primary mb-2 mt-6 tracking-tight break-words" />,
                                blockquote: (props: MarkdownBlockquoteProps) => (
                                    <blockquote
                                        {...props}
                                        className="border-l-4 border-sky-500/40 pl-6 py-1 italic theme-text-secondary my-6 theme-overlay-subtle rounded-r-xl break-words"
                                    />
                                ),
                            }}
                        >
                            {normalizeMarkdown(displayContent)}
                        </ReactMarkdown>

                        {hasToolPreview && (
                            <div className="pt-2 border-t theme-border-subtle mt-4">
                                <ToolResultPreview tool={msg.toolUsed as string} result={msg.toolResult} />
                            </div>
                        )}

                        {hasApprovalPanel && (
                            <div className="mt-4 p-4 rounded-2xl border theme-border-medium theme-overlay-subtle space-y-3">
                                <div className="text-[11px] uppercase tracking-widest font-bold text-foreground/70">Approval Required</div>
                                <div className="text-[12px] text-foreground/80">
                                    The assistant wants to run tools. Approve to continue.
                                </div>
                                {riskByTool.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {riskByTool.map(({ tool, risk }) => (
                                            <span
                                                key={tool}
                                                className={cn(
                                                    "px-2 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase border",
                                                    risk === 'high'
                                                        ? "bg-red-500/10 border-red-500/30 text-red-200"
                                                        : risk === 'medium'
                                                            ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                                                            : "bg-foreground/5 border theme-border-subtle text-foreground/70"
                                                )}
                                            >
                                                {tool}{risk !== 'low' ? ` (${risk})` : ''}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <div className="flex flex-wrap gap-2 pt-1">
                                    <button
                                        onClick={() => onApproveOnce?.()}
                                        className="px-3 py-2 rounded-xl bg-sky-500/80 hover:bg-sky-500 text-[11px] font-bold uppercase tracking-wider text-white transition-colors"
                                    >
                                        Allow once
                                    </button>
                                    <button
                                        onClick={() => onApproveAlways?.()}
                                        className="px-3 py-2 rounded-xl theme-overlay-subtle border theme-border-medium text-[11px] font-bold uppercase tracking-wider text-foreground/80 hover:text-foreground hover:theme-overlay-medium transition-colors"
                                    >
                                        Always allow
                                    </button>
                                </div>
                            </div>
                        )}
                        {fileMeta && (
                            <div className="mt-3 flex items-center gap-2 text-[10px] theme-text-tertiary theme-overlay-subtle p-2 rounded-lg inline-flex">
                                <FileIcon size={12} className="text-sky-300" />
                                <span className="truncate">{fileMeta.name}</span>
                            </div>
                        )}
                    </div>

                    {!isUser && (
                        <div className="px-3 py-2 bg-black/20 border-t theme-border-subtle flex items-center gap-2 opacity-50 group-hover/msg:opacity-100 transition-opacity">
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(msg.content);
                                    toast.success('Copied!');
                                }}
                                className="p-1.5 hover:theme-overlay-medium rounded-lg theme-text-tertiary hover:theme-text-primary transition-colors"
                                title="Copy Message"
                            >
                                <Copy size={12} />
                            </button>

                            <div className="ml-auto text-[10px] theme-text-quaternary font-mono uppercase tracking-widest text-[9px] font-black">AI Assistant</div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MessageBubble;
