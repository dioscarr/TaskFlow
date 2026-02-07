'use client';

import React, { useState, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { TaskWithData } from '@/lib/types';
import TaskDetail from './TaskDetail';
import { useEffect } from 'react';
import Link from 'next/link';

type FocusContextType = {
    isFocused: boolean;
    focusedItem: TaskWithData | null;
    setFocusedItem: (item: TaskWithData | null) => void;
};

const FocusContext = createContext<FocusContextType | undefined>(undefined);

export function useFocus() {
    const context = useContext(FocusContext);
    if (!context) {
        throw new Error('useFocus must be used within a FocusProvider');
    }
    return context;
}

export default function Layout({ children, headerCenter }: { children: React.ReactNode, headerCenter?: React.ReactNode }) {
    const [focusedItem, setFocusedItemState] = useState<TaskWithData | null>(null);

    const isFocused = !!focusedItem;

    const setFocusedItem = (item: TaskWithData | null) => {
        setFocusedItemState(item);
    };

    return (
        <FocusContext.Provider value={{ isFocused, focusedItem, setFocusedItem }}>
            <div className="relative min-h-screen overflow-hidden bg-background text-foreground transition-colors duration-500 font-sans selection:bg-primary/30">

                {/* Background Ambient Glows */}
                <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] max-w-[100vw] bg-blue-600/10 rounded-full blur-[120px] opacity-40 animate-pulse pointer-events-none" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] max-w-[100vw] bg-purple-600/10 rounded-full blur-[120px] opacity-40 animate-pulse delay-1000 pointer-events-none" />
                    <div className="absolute top-[40%] left-[40%] w-[20%] h-[20%] bg-emerald-500/5 rounded-full blur-[100px] opacity-30" />
                </div>

                {/* Focus Mode Overlay Backdrop */}
                <AnimatePresence>
                    {isFocused && (
                        <motion.div
                            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                            animate={{ opacity: 1, backdropFilter: 'blur(16px)' }}
                            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                            className="fixed inset-0 z-40 bg-background/80 pointer-events-none"
                        />
                    )}
                </AnimatePresence>

                {/* Content Area Wrapper */}
                <div className="flex h-screen overflow-hidden min-w-0">
                    {/* Main Content Layer */}
                    <div className={cn(
                        "flex-1 relative z-10 transition-all duration-700 h-full flex flex-col",
                        isFocused ? "scale-90 opacity-40 pointer-events-none blur-sm" : "opacity-100"
                    )}>
                        {/* Navbar */}
                        <header className="relative flex items-center justify-between px-6 py-4 sticky top-0 z-20 border-b border-white/5 bg-black/5 backdrop-blur-sm overflow-hidden max-w-full">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 shadow-lg shadow-blue-500/20 flex items-center justify-center font-bold text-white">
                                    T
                                </div>
                                <span className="text-lg font-bold tracking-tight text-white">TaskFlow</span>
                            </div>

                            {/* Centered Content Injection */}
                            {headerCenter && (
                                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
                                    {headerCenter}
                                </div>
                            )}

                            <div className="flex items-center gap-6">
                                <nav className="hidden md:flex gap-6 text-sm font-medium text-white/60">
                                    <a href="#" className="hover:text-white transition-colors">Dashboard</a>
                                    <a href="#" className="text-white transition-colors">Inbox</a>
                                    <Link href="/processes" className="hover:text-white transition-colors flex items-center gap-1.5">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="2" y="3" width="20" height="14" rx="2" />
                                            <line x1="8" y1="21" x2="16" y2="21" />
                                            <line x1="12" y1="17" x2="12" y2="21" />
                                        </svg>
                                        Processes
                                    </Link>
                                </nav>
                                <div className="w-px h-6 bg-white/10" />
                                <div className="w-8 h-8 rounded-full bg-white/10 border border-white/10 hover:border-white/30 transition-colors cursor-pointer" />
                            </div>
                        </header>

                        <main className="flex-1 w-full h-full relative overflow-hidden min-w-0">

                            {children}
                        </main>
                    </div>
                </div>

                {/* Focus Mode Modal Layer */}
                <AnimatePresence>
                    {focusedItem && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-12">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 40 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 40 }}
                                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                                className="w-full max-w-5xl h-full max-h-[85vh] glass-card rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10 relative"
                            >
                                <TaskDetail task={focusedItem} onClose={() => setFocusedItem(null)} />
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </FocusContext.Provider >
    );
}
