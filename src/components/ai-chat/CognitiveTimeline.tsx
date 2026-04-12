"use client";

import React from 'react';
import { Activity } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { cn } from '@/lib/utils';

import CodeBlock from './CodeBlock';

type ActivityItem = {
    id: string;
    title: string;
    message: string;
    type?: 'error' | 'thinking' | string;
};

type MarkdownCodeProps = React.ComponentProps<'code'> & { inline?: boolean };
type MarkdownParagraphProps = React.ComponentProps<'p'>;
type MarkdownListProps = React.ComponentProps<'ul'>;

export const CognitiveTimeline = ({ activities }: { activities: ActivityItem[] }) => {
    if (!activities || activities.length === 0) return null;

    return (
        <div className="my-3 pl-3 pr-2 border-l-2 theme-border-subtle space-y-3">
            <div className="flex items-center gap-2 mb-2">
                <Activity size={12} className="text-amber-400 opacity-60" />
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/30">Live Agent Activity</h3>
            </div>

            <div className="space-y-4">
                {activities.map((activity) => (
                    <div key={activity.id} className="relative pl-4 group/item">
                        <div
                            className={cn(
                                'absolute left-[-5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-[#1e1e1e] transition-all duration-500',
                                activity.type === 'error' ? 'bg-red-500' : activity.type === 'thinking' ? 'bg-sky-500' : 'bg-amber-500 opacity-60'
                            )}
                        />

                        <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                                <span
                                    className={cn(
                                        'text-[10px] font-bold uppercase tracking-wide',
                                        activity.type === 'error' ? 'text-red-400' : activity.type === 'thinking' ? 'text-sky-400' : 'text-amber-400/80'
                                    )}
                                >
                                    {activity.title}
                                </span>
                            </div>
                            <div
                                className={cn(
                                    'text-[11px] leading-relaxed p-3 rounded-xl border backdrop-blur-md shadow-2xl transition-all',
                                    activity.type === 'error'
                                        ? 'text-red-300 bg-red-500/5 border-red-500/20'
                                        : activity.type === 'thinking'
                                            ? 'text-sky-100/90 bg-sky-500/5 border-sky-500/10'
                                            : 'text-zinc-300 theme-overlay-subtle theme-border-subtle'
                                )}
                            >
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        code: ({ className, children, ...props }: MarkdownCodeProps) => {
                                            const match = /language-(\w+)/.exec(className || '');
                                            const codeString = String(children).replace(/\n$/, '');
                                            if (!match && !codeString.includes('\n')) {
                                                return (
                                                    <code className="theme-overlay-medium px-1 py-0.5 rounded text-sky-400 font-mono" {...props}>
                                                        {children}
                                                    </code>
                                                );
                                            }
                                            return <CodeBlock language={match?.[1] || 'text'} code={codeString} />;
                                        },
                                        p: (props: MarkdownParagraphProps) => <p {...props} className="mb-2 last:mb-0" />,
                                        ul: (props: MarkdownListProps) => <ul {...props} className="list-disc pl-4 mb-2 space-y-1" />,
                                    }}
                                >
                                    {(() => {
                                        const trimmed = activity.message.trim();
                                        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                                            try {
                                                const parsed = JSON.parse(trimmed);
                                                return '```json\n' + JSON.stringify(parsed, null, 2) + '\n```';
                                            } catch (e) {
                                                return activity.message;
                                            }
                                        }
                                        return activity.message;
                                    })()}
                                </ReactMarkdown>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CognitiveTimeline;
