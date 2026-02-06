'use client';

import React, { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { Code2, Save, Loader2, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StandaloneEditorProps {
    fileName: string;
    content: string;
    onChange: (value: string) => void;
    onSave?: () => void;
    isSaving?: boolean;
    onClose?: () => void;
    embedded?: boolean;
}

export default function StandaloneEditor({
    fileName,
    content,
    onChange,
    onSave,
    isSaving = false,
    onClose,
    embedded = false
}: StandaloneEditorProps) {
    const language = fileName.split('.').pop() || 'text';

    const codeTheme = useMemo(() => EditorView.theme({
        '&': {
            backgroundColor: '#050505',
            color: '#f0f0f0',
            height: '100%'
        },
        '.cm-content': {
            caretColor: '#00c2ff',
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
            color: '#00c2ff'
        },
        '.cm-selectionBackground': {
            backgroundColor: 'rgba(0, 194, 255, 0.25) !important'
        },
        '.cm-cursor': {
            borderLeftColor: '#00c2ff',
            borderLeftWidth: '2px'
        }
    }, { dark: true }), []);

    const codeHighlight = useMemo(() => HighlightStyle.define([
        { tag: tags.keyword, color: '#ff007a', fontWeight: 'bold' },
        { tag: [tags.string, tags.special(tags.string)], color: '#00ff9d' },
        { tag: [tags.number, tags.bool, tags.null], color: '#ff9d00' },
        { tag: [tags.comment, tags.lineComment], color: '#666666', fontStyle: 'italic' },
        { tag: tags.function(tags.variableName), color: '#00c2ff' },
        { tag: tags.typeName, color: '#bd00ff' },
        { tag: tags.tagName, color: '#ff007a' },
        { tag: tags.attributeName, color: '#00c2ff' },
        { tag: tags.variableName, color: '#ffffff' },
        { tag: tags.propertyName, color: '#00c2ff' },
        { tag: tags.operator, color: '#ffffff' },
        { tag: tags.className, color: '#00c2ff' }
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

    return (
        <div className={cn(
            "flex flex-col h-full bg-[#050505] overflow-hidden",
            embedded ? "border-x border-white/5" : "border border-white/10 rounded-xl"
        )}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#0a0a0a] border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-blue-500/10 rounded border border-blue-500/20">
                        <Code2 size={14} className="text-blue-400" />
                    </div>
                    <div>
                        <h3 className="text-xs font-medium text-white/90 truncate max-w-[150px]">{fileName}</h3>
                        <p className="text-[9px] text-white/40 font-mono uppercase tracking-widest">{language}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {onSave && (
                        <button
                            onClick={onSave}
                            disabled={isSaving}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                                isSaving
                                    ? "bg-blue-600/50 cursor-wait text-white/70"
                                    : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 active:scale-95"
                            )}
                        >
                            {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                            {isSaving ? 'Saving' : 'Save'}
                        </button>
                    )}
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-1.5 text-white/30 hover:text-red-400 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 overflow-hidden relative group">
                <CodeMirror
                    value={content}
                    onChange={onChange}
                    height="100%"
                    className="h-full"
                    extensions={[...baseExtensions, ...languageExtension]}
                    theme="dark"
                />

                {/* Floating status */}
                <div className="absolute bottom-4 right-4 px-2 py-1 bg-black/60 backdrop-blur-md rounded border border-white/5 text-[9px] text-white/40 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                    LN {content.split('\n').length} | UTF-8
                </div>
            </div>
        </div>
    );
}
