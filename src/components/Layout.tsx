'use client';

import React, { useState, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { TaskWithData } from '@/lib/types';
import TaskDetail from './TaskDetail';
import { useEffect } from 'react';
import Link from 'next/link';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeProvider';

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

function ProfileMenu() {
    const [open, setOpen] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-400/30 to-emerald-400/30 border theme-border-medium hover:theme-border-strong transition-all cursor-pointer shadow-[0_0_16px_var(--overlay-medium)] flex items-center justify-center theme-text-primary font-bold text-sm"
            >
                U
            </button>

            <AnimatePresence>
                {open && (
                    <>
                        <div className="fixed inset-0 z-[99998]" onClick={() => setOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.95 }}
                            className="absolute right-0 top-12 z-[99999] w-56 bg-[color:var(--card)] backdrop-blur-xl border theme-border-medium rounded-xl shadow-2xl overflow-hidden"
                        >
                            <div className="p-3 border-b theme-border-medium">
                                <div className="font-medium theme-text-primary">User</div>
                                <div className="text-xs theme-text-tertiary">user@example.com</div>
                            </div>

                            <div className="p-2">
                                <Link
                                    href="/settings"
                                    onClick={() => setOpen(false)}
                                    className="flex items-center gap-3 px-3 py-2 rounded-lg theme-text-secondary hover:theme-text-primary hover:theme-overlay-medium transition-colors"
                                >
                                    <span>⚙️</span>
                                    <span>Settings</span>
                                </Link>
                                <Link
                                    href="/settings"
                                    onClick={() => setOpen(false)}
                                    className="flex items-center gap-3 px-3 py-2 rounded-lg theme-text-secondary hover:theme-text-primary hover:theme-overlay-medium transition-colors"
                                >
                                    <span>👤</span>
                                    <span>Profile</span>
                                </Link>
                                <Link
                                    href="/settings"
                                    onClick={() => setOpen(false)}
                                    className="flex items-center gap-3 px-3 py-2 rounded-lg theme-text-secondary hover:theme-text-primary hover:theme-overlay-medium transition-colors"
                                >
                                    <span>🔗</span>
                                    <span>Resources</span>
                                </Link>
                            </div>

                            <div className="p-2 border-t theme-border-medium">
                                <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">
                                    <span>🚪</span>
                                    <span>Sign Out</span>
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}


export default function Layout({ children, headerCenter }: { children: React.ReactNode, headerCenter?: React.ReactNode }) {
    const [focusedItem, setFocusedItemState] = useState<TaskWithData | null>(null);
    const { theme, toggleTheme } = useTheme();

    const isFocused = !!focusedItem;

    const setFocusedItem = (item: TaskWithData | null) => {
        setFocusedItemState(item);
    };

    return (
        <FocusContext.Provider value={{ isFocused, focusedItem, setFocusedItem }}>
            <div className="relative min-h-screen overflow-hidden bg-background text-foreground transition-colors duration-500 font-sans selection:bg-primary/30 selection:text-primary-foreground">

                {/* Background Ambient Glows - Nano Banana Influence */}
                <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                    <div className="absolute top-[-18%] left-[-12%] w-[62%] h-[62%] bg-sky-500/12 rounded-full blur-[160px] opacity-40 animate-[neural-pulse_8s_infinite_ease-in-out] pointer-events-none" />
                    <div className="absolute bottom-[-16%] right-[-12%] w-[54%] h-[54%] bg-emerald-500/10 rounded-full blur-[150px] opacity-35 animate-[neural-pulse_12s_infinite_ease-in-out_delay-1000] pointer-events-none" />
                    <div className="absolute top-[32%] left-[34%] w-[28%] h-[28%] bg-amber-400/10 rounded-full blur-[120px] opacity-25 animate-pulse" />
                    <div className="absolute inset-0 ambient-grid opacity-[0.06]" />
                </div>

                {/* Focus Mode Overlay Backdrop */}
                <AnimatePresence>
                    {isFocused && (
                        <motion.div
                            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                            animate={{ opacity: 1, backdropFilter: 'blur(32px)' }}
                            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                            className="fixed inset-0 z-40 bg-slate-950/60 pointer-events-none"
                        />
                    )}
                </AnimatePresence>

                {/* Content Area Wrapper */}
                <div className="flex h-screen overflow-hidden min-w-0">
                    {/* Main Content Layer */}
                    <div className={cn(
                        "flex-1 relative z-10 transition-all duration-700 h-full flex flex-col",
                        isFocused ? "scale-[0.98] opacity-20 pointer-events-none blur-xl" : "opacity-100"
                    )}>
                        {/* Navbar - Premium High-Blur */}
                        <header className="relative flex items-center justify-between px-8 py-5 sticky top-0 z-[9000] border-b border-[color:var(--border)] bg-[color:var(--card)] backdrop-blur-3xl overflow-visible max-w-full after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-foreground/20 after:to-transparent">
                            <Link href="/" className="flex items-center gap-4 group cursor-pointer">
                                <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-400 via-emerald-400 to-cyan-300 shadow-[0_0_28px_rgba(56,189,248,0.35)] ring-1 theme-border-medium flex items-center justify-center font-black theme-text-primary text-xl transition-all group-hover:scale-110 group-active:scale-95">
                                    <div className="absolute inset-0 theme-overlay-medium blur-sm rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-300/80 shadow-[0_0_10px_rgba(251,191,36,0.6)]" />
                                    T
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xl font-black tracking-[-0.03em] text-foreground leading-none">TaskFlow</span>
                                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground leading-none mt-1">Intelligence OS</span>
                                </div>
                            </Link>

                            {/* Centered Content Injection */}
                            {headerCenter && (
                                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[9010]">
                                    {headerCenter}
                                </div>
                            )}

                            <div className="flex items-center gap-6">
                                <nav className="hidden md:flex items-center gap-5 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground bg-foreground/5 border border-[color:var(--border)] rounded-full px-4 py-2">
                                    <a href="#" className="hover:text-foreground transition-colors">Dashboard</a>
                                    <a href="#" className="text-foreground transition-colors">Inbox</a>
                                    <Link href="/processes" className="hover:text-foreground transition-colors flex items-center gap-2">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="2" y="3" width="20" height="14" rx="2" />
                                            <line x1="8" y1="21" x2="16" y2="21" />
                                            <line x1="12" y1="17" x2="12" y2="21" />
                                        </svg>
                                        Processes
                                    </Link>
                                </nav>
                                <div className="w-px h-6 bg-foreground/10" />
                                <button
                                    onClick={toggleTheme}
                                    className="p-2 rounded-full border border-[color:var(--border)] bg-foreground/5 text-foreground/70 hover:text-foreground hover:bg-foreground/10 transition-colors"
                                    title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                                >
                                    {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                                </button>

                                {/* Profile Menu */}
                                <ProfileMenu />
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
                                className="w-full max-w-5xl h-full max-h-[85vh] glass-card rounded-3xl overflow-hidden shadow-2xl ring-1 ring-foreground/10 relative"
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
