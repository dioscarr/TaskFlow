"use client";

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BrainCircuit, ChevronDown, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

const sectionMap = {
    plan: { color: 'text-sky-300', icon: BrainCircuit },
    retrieve: { color: 'text-emerald-300', icon: BrainCircuit },
    analyze: { color: 'text-amber-300', icon: BrainCircuit },
    verify: { color: 'text-rose-300', icon: BrainCircuit },
    reflect: { color: 'text-purple-300', icon: BrainCircuit }
};

type SectionIcon = React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;

type Section = {
    title: string;
    content: string;
    icon: SectionIcon;
    color: string;
};

const parseSections = (text: string): Section[] => {
    const lines = text.split('\n');
    const sections: Section[] = [];
    let currentSection: Section | null = null;

    for (const line of lines) {
        const trimmed = line.trim();
        const sectionMatch = trimmed.match(/^(plan|retrieve|analyze|verify|reflect|step)[:\s-]+(.+)/i);

        if (sectionMatch) {
            if (currentSection && currentSection.content.length > 0) {
                sections.push({
                    title: currentSection.title,
                    content: currentSection.content,
                    icon: currentSection.icon,
                    color: currentSection.color
                });
            }

            const key = sectionMatch[1].toLowerCase() as keyof typeof sectionMap;
            const sectionInfo = sectionMap[key] || { color: 'text-sky-400', icon: BrainCircuit };
            const title = sectionMatch[2].trim() || sectionMatch[1].toUpperCase();
            currentSection = {
                title,
                content: '',
                icon: sectionInfo.icon,
                color: sectionInfo.color
            };
        } else if (currentSection) {
            currentSection.content += (currentSection.content ? '\n' : '') + line;
        } else {
            if (!currentSection && trimmed) {
                currentSection = {
                    title: 'Cognitive Baseline',
                    content: line,
                    icon: BrainCircuit,
                    color: 'text-sky-400'
                };
            }
        }
    }

    if (currentSection && currentSection.content.length > 0) {
        sections.push({
            title: currentSection.title,
            content: currentSection.content,
            icon: currentSection.icon,
            color: currentSection.color
        });
    }

    return sections.length > 0
        ? sections
        : [{ title: 'Neural Reasoning', content: text, icon: BrainCircuit, color: 'text-sky-400' }];
};

export const ThinkingProcess = ({ content }: { content: string }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
    const sections = parseSections(content);

    useEffect(() => {
        setExpandedSections(new Set(sections.map((_, idx) => idx)));
    }, [sections.length]);

    const toggleSection = (idx: number) => {
        const newSet = new Set(expandedSections);
        if (newSet.has(idx)) newSet.delete(idx);
        else newSet.add(idx);
        setExpandedSections(newSet);
    };

    return (
        <div className="mb-4 group/thought">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full rounded-full border theme-border-subtle bg-foreground/[0.02] hover:bg-foreground/[0.04] transition-colors flex items-center justify-between px-3 py-1.5"
            >
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-2 py-1 rounded-full border theme-border-subtle bg-foreground/[0.03]">
                        <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400/80 animate-pulse" />
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80 animate-pulse" style={{ animationDelay: '120ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-300/80 animate-pulse" style={{ animationDelay: '240ms' }} />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground/60">
                            Thinking
                        </span>
                    </div>
                    <span className="text-[11px] text-foreground/80 font-medium">
                        {isExpanded ? `Hide reasoning (${sections.length})` : 'Show reasoning'}
                    </span>
                </div>
                <ChevronDown size={12} className={cn('theme-text-quaternary transition-transform duration-200', isExpanded && 'rotate-180')} />
            </button>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-1 border theme-border-subtle rounded-lg overflow-hidden"
                    >
                        <div className="p-2 space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar bg-foreground/[0.02]">
                            {sections.map((section, idx) => {
                                const Icon = section.icon;
                                const isOpen = expandedSections.has(idx);

                                return (
                                    <div key={idx} className="border theme-border-subtle rounded-md overflow-hidden bg-transparent">
                                        <button
                                            onClick={() => toggleSection(idx)}
                                            className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-foreground/[0.03] transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className={cn('p-1 rounded bg-foreground/5 border theme-border-subtle', section.color)}>
                                                    <Icon size={11} strokeWidth={2.4} />
                                                </div>
                                                <span className={cn('text-[10px] font-semibold uppercase tracking-[0.14em]', section.color)}>
                                                    {section.title}
                                                </span>
                                            </div>
                                            <ChevronRight
                                                size={11}
                                                className={cn('theme-text-quaternary transition-transform duration-150', isOpen && 'rotate-90')}
                                            />
                                        </button>

                                        <AnimatePresence>
                                            {isOpen && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="border-t theme-border-subtle bg-foreground/[0.015]"
                                                >
                                                    <div className="px-2.5 py-2 text-[11px] theme-text-secondary leading-relaxed space-y-1.5">
                                                        {section.content.split('\n').map((line, i) => {
                                                            const trimmed = line.trim();
                                                            if (!trimmed) return null;

                                                            const isBullet = trimmed.match(/^[-*•]\s+(.+)$/);
                                                            if (isBullet) {
                                                                return (
                                                                    <div key={i} className="flex items-start gap-2 ml-1">
                                                                        <div className="mt-2 w-1 h-1 rounded-full bg-sky-400/60" />
                                                                        <span className="flex-1 text-[11px]">{isBullet[1]}</span>
                                                                    </div>
                                                                );
                                                            }

                                                            return (
                                                                <p key={i} className={cn(line.startsWith('  ') && 'ml-4 theme-text-tertiary italic font-mono text-[10px]')}>
                                                                    {trimmed}
                                                                </p>
                                                            );
                                                        })}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ThinkingProcess;
