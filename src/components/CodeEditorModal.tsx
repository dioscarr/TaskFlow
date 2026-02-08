
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Loader2, Code2, Maximize2, Minimize2, Copy, FileText, Sparkles, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SuggestionsLibraryModal from './SuggestionsLibraryModal';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';

type PreviewFile = {
    name: string;
    type: string;
    storagePath?: string | null;
};

interface CodeEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    fileName: string;
    initialContent: string;
    onSave: (content: string) => Promise<void>;
    isSaving?: boolean;
    mode?: 'edit' | 'preview';
    onModeChange?: (mode: 'edit' | 'preview') => void;
    previewFile?: PreviewFile | null;
    previewContent?: string | null;
    chatContext?: { role: 'user' | 'ai'; content: string }[];
}

type IdeaSuggestion = {
    id: string;
    title: string;
    category: string;
    description: string;
    flow: { step: number; task: string; description: string }[];
    agentInstructions: string;
};

export default function CodeEditorModal({
    isOpen,
    onClose,
    fileName,
    initialContent,
    onSave,
    isSaving = false,
    mode = 'edit',
    onModeChange,
    previewFile,
    previewContent,
    chatContext
}: CodeEditorModalProps) {
    const [content, setContent] = useState(initialContent);
    const [isMaximized, setIsMaximized] = useState(false);
    const [activeMode, setActiveMode] = useState<'edit' | 'preview'>(mode);
    const [isMagicOpen, setIsMagicOpen] = useState(false);
    const [magicGoal, setMagicGoal] = useState('');
    const [magicResult, setMagicResult] = useState<string | null>(null);
    const [isMagicGenerating, setIsMagicGenerating] = useState(false);
    const [isMagicApplying, setIsMagicApplying] = useState(false);
    const [magicSuggestions, setMagicSuggestions] = useState<string[]>([]);
    const [isMagicSuggesting, setIsMagicSuggesting] = useState(false);
    const [isIdeasOpen, setIsIdeasOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        setContent(initialContent);
    }, [initialContent, isOpen]);

    useEffect(() => {
        setActiveMode(mode);
    }, [mode, isOpen]);

    useEffect(() => {
        if (!isOpen) {
            setIsMagicOpen(false);
            setMagicGoal('');
            setMagicResult(null);
            setIsMagicGenerating(false);
            setIsMagicApplying(false);
            setMagicSuggestions([]);
            setIsMagicSuggesting(false);
            setIsIdeasOpen(false);
        }
    }, [isOpen]);


    const handleSave = async () => {
        await onSave(content);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        toast.success('Copied to clipboard');
    };

    const handleOpenMagic = () => {
        setIsMagicOpen(true);
        setMagicResult(null);
    };

    const handleGenerateMagic = async () => {
        if (!magicGoal.trim()) {
            toast.error('Add a goal for the AI update');
            return;
        }
        setIsMagicGenerating(true);
        try {
            const { generateMagicContent } = await import('@/app/actions');
            const res = await generateMagicContent({
                fileName,
                content,
                goal: magicGoal.trim(),
                chatContext: chatContext && chatContext.length > 0 ? chatContext : undefined
            });
            if (res.success && typeof res.text === 'string') {
                setMagicResult(res.text);
            } else {
                toast.error('Failed to generate content');
            }
        } catch (error) {
            toast.error('Magic generation failed');
        } finally {
            setIsMagicGenerating(false);
        }
    };

    const handleGenerateSuggestions = async () => {
        if (!magicGoal.trim()) {
            toast.error('Add a description to generate suggestions');
            return;
        }
        setIsMagicSuggesting(true);
        try {
            const { generateMagicSuggestions } = await import('@/app/actions');
            const res = await generateMagicSuggestions({
                fileName,
                description: magicGoal.trim()
            });
            if (res.success && Array.isArray(res.suggestions)) {
                setMagicSuggestions(res.suggestions.slice(0, 5));
            } else {
                toast.error('Failed to generate suggestions');
            }
        } catch (error) {
            toast.error('Suggestion generation failed');
        } finally {
            setIsMagicSuggesting(false);
        }
    };

    const handleApplyMagic = async () => {
        if (!magicResult) return;
        setIsMagicApplying(true);
        try {
            setContent(magicResult);
            setActiveMode('edit');
            onModeChange?.('edit');
            await onSave(magicResult);
            toast.success('Magic content applied');
            setIsMagicOpen(false);
            setMagicResult(null);
            setMagicGoal('');
            setMagicSuggestions([]);
        } catch (error) {
            toast.error('Failed to apply content');
        } finally {
            setIsMagicApplying(false);
        }
    };

    const handleApplyIdea = (suggestion: IdeaSuggestion) => {
        setMagicGoal(suggestion.agentInstructions || suggestion.description || suggestion.title);
        setIsIdeasOpen(false);
        toast.success('Idea loaded into Magic Content');
    };

    const lines = content.split('\n').length;
    const language = fileName.split('.').pop() || 'text';
    const previewPath = previewFile ? (previewFile.storagePath || previewFile.name) : '';
    const isMarkdown = previewFile && (previewFile.name.endsWith('.md') || previewFile.type === 'md' || previewFile.type === 'markdown');
    const isImage = previewFile && (previewFile.type === 'image' || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(previewFile.type));
    const isHtml = previewFile && (previewFile.name.endsWith('.html') || previewFile.type === 'html');

    const codeTheme = useMemo(() => EditorView.theme({
        '&': {
            backgroundColor: '#050505', // Deep premium dark
            color: '#f0f0f0', // High contrast white
            height: '100%'
        },
        '.cm-content': {
            caretColor: '#38bdf8', // Neon sky
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: '13px'
        },
        '.cm-gutters': {
            backgroundColor: '#050505',
            color: '#4a4a4a',
            borderRight: '1px solid #1a1a1a'
        },
        '.cm-activeLine': {
            backgroundColor: 'rgba(255, 255, 255, 0.03)'
        },
        '.cm-activeLineGutter': {
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            color: '#38bdf8'
        },
        '.cm-selectionBackground': {
            backgroundColor: 'rgba(56, 189, 248, 0.25) !important'
        },
        '.cm-cursor': {
            borderLeftColor: '#38bdf8',
            borderLeftWidth: '2px'
        }
    }, { dark: true }), []);

    const codeHighlight = useMemo(() => HighlightStyle.define([
        { tag: tags.keyword, color: '#ff007a', fontWeight: 'bold' }, // Neon Pink for keywords
        { tag: [tags.string, tags.special(tags.string)], color: '#00ff9d' }, // Neon Green for strings
        { tag: [tags.number, tags.bool, tags.null], color: '#ff9d00' }, // Neon Orange for constants
        { tag: [tags.comment, tags.lineComment], color: '#666666', fontStyle: 'italic' }, // Muted gray for comments
        { tag: tags.function(tags.variableName), color: '#38bdf8' }, // Neon Sky for functions
        { tag: tags.typeName, color: '#34d399' }, // Emerald for types
        { tag: tags.tagName, color: '#ff007a' }, // Neon Pink for HTML tags
        { tag: tags.attributeName, color: '#38bdf8' }, // Neon Sky for attributes
        { tag: tags.variableName, color: '#ffffff' }, // White for variables
        { tag: tags.propertyName, color: '#38bdf8' }, // Neon Sky for properties
        { tag: tags.operator, color: '#ffffff' },
        { tag: tags.className, color: '#38bdf8' }
    ]), []);

    const languageExtension = useMemo(() => {
        const ext = fileName.split('.').pop()?.toLowerCase();
        if (!ext) return [];
        if (['js', 'jsx'].includes(ext)) return [javascript({ jsx: true })];
        if (['ts', 'tsx'].includes(ext)) return [javascript({ jsx: true, typescript: true })];
        if (ext === 'html') return [html()];
        if (ext === 'css') return [css()];
        if (ext === 'json') return [json()];
        if (['md', 'markdown'].includes(ext)) return [markdown()];
        return [];
    }, [fileName]);

    const baseExtensions = useMemo(() => [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        codeTheme,
        syntaxHighlighting(codeHighlight)
    ], [codeTheme, codeHighlight]);

    if (!isOpen || !mounted) return null;

    return createPortal(
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{
                        scale: 1,
                        opacity: 1,
                        y: 0,
                        width: isMaximized ? '98vw' : '100%',
                        height: isMaximized ? '95vh' : '80vh',
                        maxWidth: isMaximized ? 'none' : '64rem'
                    }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className="bg-[#050505] border theme-border-medium rounded-xl shadow-[0_0_50px_rgba(0,194,255,0.1)] overflow-hidden flex flex-col relative"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-[#0a0a0a] border-b theme-border-subtle select-none relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-sky-500/5 via-transparent to-transparent pointer-events-none" />
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="p-2 bg-sky-500/10 rounded-lg border border-sky-500/20 shadow-[0_0_15px_rgba(56,189,248,0.2)]">
                                <Code2 className="text-sky-400" size={18} />
                            </div>
                            <div>
                                <h3 className="text-sm font-medium text-white/90">{fileName}</h3>
                                <p className="text-[10px] theme-text-tertiary font-mono uppercase tracking-wider">{language}</p>
                            </div>
                            <div className="flex items-center gap-1 theme-overlay-subtle rounded-lg p-1 border theme-border-subtle">
                                <button
                                    onClick={() => {
                                        setActiveMode('edit');
                                        onModeChange?.('edit');
                                    }}
                                    className={cn(
                                        "px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-colors",
                                        activeMode === 'edit' ? "bg-sky-500/20 text-sky-200" : "theme-text-secondary hover:text-white"
                                    )}
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => {
                                        setActiveMode('preview');
                                        onModeChange?.('preview');
                                    }}
                                    disabled={!previewFile}
                                    className={cn(
                                        "px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-colors",
                                        activeMode === 'preview' ? "bg-emerald-500/20 text-emerald-200" : "theme-text-secondary hover:text-white",
                                        !previewFile && "opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    Preview
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {activeMode === 'edit' && (
                                <button
                                    onClick={handleCopy}
                                    className="p-2 hover:theme-overlay-medium text-white/60 hover:text-white rounded-lg transition-colors"
                                    title="Copy Content"
                                >
                                    <Copy size={16} />
                                </button>
                            )}
                            <button
                                onClick={handleOpenMagic}
                                className="flex items-center gap-2 px-3 py-2 theme-overlay-subtle hover:theme-overlay-medium text-white/70 hover:text-white rounded-lg transition-colors border theme-border-subtle hover:border-emerald-500/30 group"
                                title="AI Magic Content"
                            >
                                <Sparkles size={14} className="text-emerald-400 group-hover:animate-pulse" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Magic</span>
                            </button>
                            <button
                                onClick={() => setIsMaximized(!isMaximized)}
                                className="p-2 hover:theme-overlay-medium text-white/60 hover:text-white rounded-lg transition-colors"
                                title={isMaximized ? "Restore" : "Maximize"}
                            >
                                {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                            </button>
                            {activeMode === 'edit' && (
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all",
                                        isSaving
                                            ? "bg-sky-600/50 cursor-wait text-white/70"
                                            : "bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-500/20 active:scale-95"
                                    )}
                                >
                                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    {isSaving ? 'Saving...' : 'Save'}
                                </button>
                            )}
                            <div className="w-px h-6 theme-overlay-medium mx-1" />
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-red-500/20 theme-text-tertiary hover:text-red-400 rounded-lg transition-colors"
                                title="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {activeMode === 'edit' ? (
                        <>
                            {/* Editor Area */}
                            <div className="flex-1 overflow-hidden bg-[#050505]">
                                <CodeMirror
                                    value={content}
                                    onChange={(value) => setContent(value)}
                                    height="100%"
                                    className="h-full"
                                    extensions={[...baseExtensions, ...languageExtension]}
                                    aria-label="Code editor"
                                />
                            </div>

                            {/* Footer */}
                            <div className="px-4 py-2 bg-[#38bdf8] text-black text-[10px] font-bold flex items-center justify-between pointer-events-none shadow-[0_-4px_20px_rgba(56,189,248,0.3)]">
                                <div className="flex gap-4 uppercase tracking-tighter">
                                    <span>Ln {lines}, Col {content.length}</span>
                                    <span>UTF-8</span>
                                </div>
                                <span className="uppercase tracking-widest">{language}</span>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 p-6 bg-[#050505] overflow-hidden">
                            <div className="w-full h-full rounded-xl border theme-border-subtle bg-black/20 overflow-hidden flex items-center justify-center">
                                {isImage ? (
                                    <img
                                        src={`/uploads/${previewPath}`}
                                        alt={previewFile?.name || fileName}
                                        className="max-w-full max-h-[70vh] object-contain"
                                    />
                                ) : previewFile?.type === 'pdf' ? (
                                    <iframe
                                        src={`/uploads/${previewPath}`}
                                        className="w-full h-full border-0 bg-[#1e1e1e]"
                                        title={previewFile?.name || fileName}
                                    />
                                ) : isHtml ? (
                                    <iframe
                                        src={`/uploads/${previewPath}`}
                                        className="w-full h-full border-0 bg-[#1e1e1e]"
                                        title={previewFile?.name || fileName}
                                    />
                                ) : isMarkdown ? (
                                    <div className="w-full h-full overflow-y-auto p-8 custom-scrollbar">
                                        <div className="markdown-content max-w-none">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {previewContent || 'Loading content...'}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center space-y-4">
                                        <FileText size={64} className="mx-auto theme-text-quaternary" />
                                        <p className="theme-text-secondary">Preview not available for this file type</p>
                                        {previewPath && (
                                            <a
                                                href={`/uploads/${previewPath}`}
                                                download
                                                className="inline-block px-6 py-2 theme-overlay-medium hover:bg-white/20 text-white rounded-lg transition-colors"
                                            >
                                                Download File
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <AnimatePresence>
                        {isMagicOpen && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 z-10 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
                                onClick={() => setIsMagicOpen(false)}
                            >
                                <motion.div
                                    initial={{ scale: 0.95, opacity: 0, y: 10 }}
                                    animate={{ scale: 1, opacity: 1, y: 0 }}
                                    exit={{ scale: 0.95, opacity: 0, y: 10 }}
                                    className="w-full max-w-2xl bg-[#050505] border theme-border-medium rounded-2xl shadow-2xl overflow-hidden"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="flex items-center justify-between px-5 py-4 bg-[#0a0a0a] border-b theme-border-subtle">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-emerald-500/10 rounded-lg">
                                                <Sparkles size={16} className="text-emerald-300" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-semibold text-white/90">AI Magic Content</h3>
                                                <p className="text-[11px] theme-text-tertiary">Update {fileName} with a clear goal</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setIsMagicOpen(false)}
                                            className="p-2 hover:bg-red-500/20 theme-text-tertiary hover:text-red-400 rounded-lg transition-colors"
                                            title="Close Magic Content"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>

                                    <div className="p-5 space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-wider theme-text-secondary">Description</label>
                                            <textarea
                                                value={magicGoal}
                                                onChange={(e) => setMagicGoal(e.target.value)}
                                                placeholder="Describe what you want changed (e.g., improve layout, add CTA, refine copy)"
                                                className="w-full h-24 rounded-xl bg-black/30 border theme-border-medium p-3 text-sm text-white/80 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 custom-scrollbar"
                                                aria-label="Magic content goal"
                                            />
                                            {chatContext && chatContext.length > 0 && (
                                                <p className="text-[10px] theme-text-tertiary">
                                                    Using last {Math.min(chatContext.length, 5)} chat messages as context.
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between gap-3">
                                            <button
                                                onClick={() => setIsIdeasOpen(true)}
                                                className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all theme-overlay-medium hover:bg-white/20 text-white"
                                            >
                                                <span className="flex items-center gap-2">
                                                    <Lightbulb size={12} />
                                                    Ideas Library
                                                </span>
                                            </button>
                                            <button
                                                onClick={handleGenerateSuggestions}
                                                disabled={isMagicSuggesting}
                                                className={cn(
                                                    "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                                                    isMagicSuggesting
                                                        ? "theme-overlay-medium theme-text-tertiary cursor-wait"
                                                        : "theme-overlay-medium hover:bg-white/20 text-white"
                                                )}
                                            >
                                                {isMagicSuggesting ? 'Suggesting...' : 'Get 5 Suggestions'}
                                            </button>
                                            <button
                                                onClick={handleGenerateMagic}
                                                disabled={isMagicGenerating}
                                                className={cn(
                                                    "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                                                    isMagicGenerating
                                                        ? "bg-emerald-600/40 text-white/60 cursor-wait"
                                                        : "bg-emerald-600 hover:bg-emerald-500 text-white"
                                                )}
                                            >
                                                {isMagicGenerating ? 'Generating...' : 'Generate'}
                                            </button>
                                        </div>

                                        {magicSuggestions.length > 0 && (
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold uppercase tracking-wider theme-text-secondary">Suggestions</label>
                                                <div className="grid gap-2">
                                                    {magicSuggestions.map((suggestion, index) => (
                                                        <button
                                                            key={`${suggestion}-${index}`}
                                                            onClick={async () => {
                                                                setMagicGoal(suggestion);
                                                                await handleGenerateMagic();
                                                            }}
                                                            className="text-left w-full rounded-xl border theme-border-medium bg-black/30 hover:theme-overlay-subtle px-4 py-3 text-xs text-white/70 hover:text-white transition-colors"
                                                        >
                                                            {suggestion}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {magicResult && (
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold uppercase tracking-wider theme-text-secondary">Preview</label>
                                                <div className="max-h-60 overflow-y-auto rounded-xl border theme-border-medium bg-black/40 p-3 text-xs text-white/70 custom-scrollbar whitespace-pre-wrap">
                                                    {magicResult}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="px-5 py-4 bg-[#0a0a0a] border-t theme-border-subtle flex items-center justify-between">
                                        <button
                                            onClick={() => setIsMagicOpen(false)}
                                            className="px-3 py-2 text-xs font-bold uppercase tracking-wider theme-text-secondary hover:text-white transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleApplyMagic}
                                            disabled={!magicResult || isMagicApplying}
                                            className={cn(
                                                "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                                                !magicResult
                                                    ? "theme-overlay-subtle text-white/30 cursor-not-allowed"
                                                    : isMagicApplying
                                                        ? "bg-emerald-600/40 text-white/70 cursor-wait"
                                                        : "bg-emerald-600 hover:bg-emerald-500 text-white"
                                            )}
                                        >
                                            {isMagicApplying ? 'Applying...' : 'Apply to File'}
                                        </button>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <SuggestionsLibraryModal
                        isOpen={isIdeasOpen}
                        onClose={() => setIsIdeasOpen(false)}
                        onApply={handleApplyIdea}
                        workflowContext={{
                            fileName,
                            currentContent: content,
                            magicGoal: magicGoal,
                            chatContext: chatContext && chatContext.length > 0 ? chatContext.slice(-5) : undefined
                        }}
                        workflowType="content-generation"
                    />
                </motion.div>
            </motion.div>
        </AnimatePresence>
        , document.body);
}
