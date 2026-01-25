'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface ContextMenuItem {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    danger?: boolean;
    className?: string; // Add className property to ContextMenuItem interface
}

interface ContextMenuProps {
    x: number;
    y: number;
    isOpen: boolean;
    onClose: () => void;
    items: ContextMenuItem[];
}

export default function ContextMenu({ x, y, isOpen, onClose, items }: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            window.addEventListener('click', handleClickOutside);
            window.addEventListener('contextmenu', (e) => {
                // Close if clicking right click elsewhere
                if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                    onClose();
                }
            });
        }

        return () => {
            window.removeEventListener('click', handleClickOutside);
            window.removeEventListener('contextmenu', handleClickOutside);
        };
    }, [isOpen, onClose]);

    // Prevent menu from going off-screen
    const style = {
        top: Math.min(y, typeof window !== 'undefined' ? window.innerHeight - 300 : y),
        left: Math.min(x, typeof window !== 'undefined' ? window.innerWidth - 200 : x),
    };

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={menuRef}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.1 }}
                    style={{ position: 'fixed', top: style.top, left: style.left, zIndex: 9999 }}
                    className="min-w-[180px] bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden py-1"
                >
                    {items.map((item, index) => (
                        <button
                            key={index}
                            onClick={(e) => {
                                e.stopPropagation();
                                item.onClick();
                                onClose();
                            }}
                            className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 transition-colors ${item.danger
                                ? 'text-red-400 hover:bg-red-500/10'
                                : 'text-white/80 hover:text-white hover:bg-white/10'
                                } ${item.className || ''}`}
                        >
                            {item.icon && <span className="opacity-70">{item.icon}</span>}
                            {item.label}
                        </button>
                    ))}
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}
