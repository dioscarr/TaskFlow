'use client';

import React, { useState, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { TaskWithData } from '@/lib/types';
import TaskDetail from './TaskDetail';
import AIChat from './AIChat';
import { useEffect } from 'react';

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

export default function Layout({ children }: { children: React.ReactNode }) {
    const [focusedItem, setFocusedItemState] = useState<TaskWithData | null>(null);

    const isFocused = !!focusedItem;

    const [isChatPinned, setIsChatPinned] = useState(false);

    const setFocusedItem = (item: TaskWithData | null) => {
        setFocusedItemState(item);
    };

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handlePinChange = (e: any) => setIsChatPinned(e.detail);
        window.addEventListener('ai-chat-pin-changed', handlePinChange);
        return () => window.removeEventListener('ai-chat-pin-changed', handlePinChange);
    }, []);

    return (
        <FocusContext.Provider value={{ isFocused, focusedItem, setFocusedItem }}>
            <div className="relative min-h-screen overflow-hidden bg-background text-foreground transition-colors duration-500 font-sans selection:bg-primary/30">

                {/* Background Ambient Glows */}
                <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] opacity-40 animate-pulse" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px] opacity-40 animate-pulse delay-1000" />
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
                <div className="flex h-screen overflow-hidden">
                    {/* Main Content Layer */}
                    <div className={cn(
                        "flex-1 relative z-10 transition-all duration-700 h-full flex flex-col",
                        isFocused ? "scale-90 opacity-40 pointer-events-none blur-sm" : "opacity-100"
                    )}>
                        {/* Navbar */}
                        <header className="flex items-center justify-between px-8 py-6 sticky top-0 z-20">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 shadow-lg shadow-blue-500/20 flex items-center justify-center font-bold text-white">
                                    T
                                </div>
                                <span className="text-lg font-bold tracking-tight text-white">TaskFlow</span>
                            </div>

                            <div className="flex items-center gap-6">
                                <nav className="hidden md:flex gap-6 text-sm font-medium text-white/60">
                                    <a href="#" className="hover:text-white transition-colors">Dashboard</a>
                                    <a href="#" className="text-white transition-colors">Inbox</a>
                                    <a href="#" className="hover:text-white transition-colors">Calendar</a>
                                </nav>
                                <div className="w-px h-6 bg-white/10" />
                                <div className="w-8 h-8 rounded-full bg-white/10 border border-white/10 hover:border-white/30 transition-colors cursor-pointer" />
                            </div>
                        </header>

                        <main className={cn(
                            "flex-1 overflow-auto p-4 md:p-8 w-full transition-all",
                            isChatPinned ? "px-10" : "max-w-6xl mx-auto px-4 md:px-8"
                        )}>
                            {children}
                        </main>
                    </div>

                    <AIChat />
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
