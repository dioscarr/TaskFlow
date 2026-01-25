'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface UseKeyboardShortcutsProps {
    onEscape?: () => void;
    onDelete?: () => void;
    onNew?: () => void;
    onSearch?: () => void;
    enabled?: boolean;
}

export function useKeyboardShortcuts({
    onEscape,
    onDelete,
    onNew,
    onSearch,
    enabled = true,
}: UseKeyboardShortcutsProps) {
    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger shortcuts when typing in inputs
            const target = e.target as HTMLElement;
            const isTyping = ['INPUT', 'TEXTAREA'].includes(target.tagName);

            // Escape - always works
            if (e.key === 'Escape' && onEscape) {
                e.preventDefault();
                onEscape();
                return;
            }

            // Don't run other shortcuts while typing
            if (isTyping) return;

            // Ctrl/Cmd + K - Search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k' && onSearch) {
                e.preventDefault();
                onSearch();
                return;
            }

            // Delete key
            if (e.key === 'Delete' && onDelete) {
                e.preventDefault();
                onDelete();
                return;
            }

            // N - New task
            if (e.key === 'n' && onNew) {
                e.preventDefault();
                onNew();
                return;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [enabled, onEscape, onDelete, onNew, onSearch]);
}
