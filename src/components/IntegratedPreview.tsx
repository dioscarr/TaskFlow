'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    RefreshCw,
    Globe,
    Monitor,
    Smartphone,
    Tablet,
    ExternalLink,
    Terminal,
    Activity,
    Zap,
    Shield,
    Cpu,
    ArrowLeft,
    RotateCcw,
    Maximize2,
    Settings,
    Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface IntegratedPreviewProps {
    isOpen: boolean;
    onClose: () => void;
    url?: string;
    appName?: string;
    status: 'idle' | 'starting' | 'ready' | 'error';
    logs?: string[];
    onRestart?: () => void;
    embedded?: boolean;
    children?: React.ReactNode;
}

const BOOT_STEPS = [
    "Allocating container resources...",
    "Pulling environment image...",
    "Mounting project filesystems...",
    "Initializing Node runtime (v20.11.0)...",
    "Resolving dependencies...",
    "Starting development server...",
    "Warming up hot-reload engine...",
    "Synchronizing workspace context..."
];

export default function IntegratedPreview({
    isOpen,
    onClose,
    url,
    appName,
    status,
    logs = [],
    onRestart,
    embedded = false,
    children
}: IntegratedPreviewProps) {
    const [viewMode, setViewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
    const [currentStep, setCurrentStep] = useState(0);
    const [showLogs, setShowLogs] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Simulated boot sequence progress
    useEffect(() => {
        if (status === 'starting') {
            const interval = setInterval(() => {
                setCurrentStep(prev => (prev < BOOT_STEPS.length - 1 ? prev + 1 : prev));
            }, 800);
            return () => clearInterval(interval);
        } else if (status === 'ready') {
            setCurrentStep(BOOT_STEPS.length - 1);
        } else {
            setCurrentStep(0);
        }
    }, [status]);

    const handleRefresh = () => {
        if (iframeRef.current) {
            iframeRef.current.src = iframeRef.current.src;
        }
    };

    const getViewWidth = () => {
        switch (viewMode) {
            case 'mobile': return '375px';
            case 'tablet': return '768px';
            default: return '100%';
        }
    };

    if (!isOpen && !embedded) return null;

    const content = (
        <div
            className={cn(
                "relative w-full h-full bg-[#0a0a0a] overflow-hidden flex flex-col transition-all duration-300",
                embedded ? "border-0 rounded-none shadow-none" : "rounded-3xl border border-white/10 shadow-2xl"
            )}
        >
            {/* Header Controls */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/40 backdrop-blur-md z-10">
                <div className="flex items-center gap-4">
                    {!embedded && (
                        <div className="flex gap-1.5 mr-2">
                            <div className="w-3 h-3 rounded-full bg-red-500/50" />
                            <div className="w-3 h-3 rounded-full bg-amber-500/50" />
                            <div className="w-3 h-3 rounded-full bg-emerald-500/50" />
                        </div>
                    )}
                    <div className="flex flex-col">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <Globe size={14} className="text-blue-400" />
                            {appName || 'Application Preview'}
                        </h3>
                        {status !== 'ready' && (
                            <div className="flex items-center gap-2">
                                <div className={cn(
                                    "w-2 h-2 rounded-full animate-pulse",
                                    status === 'ready' ? "bg-emerald-500" : status === 'starting' ? "bg-amber-500" : "bg-red-500"
                                )} />
                                <span className="text-[10px] uppercase font-bold tracking-widest text-white/40">
                                    {status === 'ready' ? 'Live System' : status === 'starting' ? 'Progressing' : 'Offline'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Responsive Toggles */}
                <div className="hidden md:flex items-center gap-1 bg-white/5 rounded-xl p-0.5 border border-white/10">
                    {[
                        { id: 'desktop', icon: Monitor },
                        { id: 'tablet', icon: Tablet },
                        { id: 'mobile', icon: Smartphone },
                    ].map((mode) => (
                        <button
                            key={mode.id}
                            onClick={() => setViewMode(mode.id as any)}
                            className={cn(
                                "p-1.5 rounded-lg transition-all",
                                viewMode === mode.id
                                    ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                                    : "text-white/40 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <mode.icon size={14} />
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleRefresh}
                        className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                        title="Refresh Preview"
                    >
                        <RefreshCw size={16} />
                    </button>
                    {status === 'ready' && (
                        <button
                            onClick={() => window.open(url, '_blank')}
                            className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                            title="Open in new tab"
                        >
                            <ExternalLink size={16} />
                        </button>
                    )}
                    {!embedded && (
                        <>
                            <div className="w-px h-6 bg-white/10 mx-1" />
                            <button
                                onClick={onClose}
                                className="p-2 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 relative bg-[#050505] flex items-center justify-center overflow-hidden">
                {/* Status: Starting / Building */}
                <AnimatePresence mode="wait">
                    {status === 'starting' && (
                        <motion.div
                            key="starting"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-20 flex flex-col items-center justify-center p-8 text-center"
                        >
                            {/* High-Tech Loader */}
                            <div className="relative mb-8 scale-75">
                                <motion.div
                                    animate={{
                                        rotate: 360,
                                        scale: [1, 1.1, 1],
                                    }}
                                    transition={{
                                        rotate: { duration: 10, repeat: Infinity, ease: "linear" },
                                        scale: { duration: 4, repeat: Infinity, ease: "easeInOut" }
                                    }}
                                    className="w-48 h-48 rounded-full border border-blue-500/20 border-t-blue-500/80 border-l-cyan-500/60 flex items-center justify-center relative"
                                >
                                    <div className="w-40 h-40 rounded-full border border-white/5 bg-gradient-to-br from-blue-500/10 to-transparent flex items-center justify-center">
                                        <Cpu size={48} className="text-blue-400 animate-pulse" />
                                    </div>
                                    {[...Array(4)].map((_, i) => (
                                        <motion.div
                                            key={i}
                                            animate={{ rotate: -360 }}
                                            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                                            className="absolute inset-0"
                                            style={{ rotate: i * 90 }}
                                        >
                                            <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.8)] absolute -top-1.5 left-1/2 -translate-x-1/2" />
                                        </motion.div>
                                    ))}
                                </motion.div>
                            </div>

                            <div className="max-w-md space-y-4">
                                <div className="space-y-1">
                                    <h2 className="text-xl font-black text-white tracking-tighter uppercase italic">
                                        Deploying <span className="text-blue-400">Context</span>
                                    </h2>
                                    <p className="text-white/40 text-[10px] font-medium tracking-wide">SYSTEM BOOT IN PROGRESS</p>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between text-[9px] font-bold text-white/50 uppercase tracking-widest">
                                        <span>{BOOT_STEPS[currentStep]}</span>
                                        <span>{Math.round(((currentStep + 1) / BOOT_STEPS.length) * 100)}%</span>
                                    </div>
                                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden border border-white/10 p-[1px]">
                                        <motion.div
                                            className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full shadow-[0_0_15px_rgba(0,194,255,0.5)]"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${((currentStep + 1) / BOOT_STEPS.length) * 100}%` }}
                                            transition={{ duration: 0.8 }}
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={() => setShowLogs(!showLogs)}
                                    className="text-[9px] font-bold text-white/30 hover:text-white transition-colors flex items-center gap-2 mx-auto"
                                >
                                    <Terminal size={10} />
                                    {showLogs ? 'HIDE LOGS' : 'VIEW LOGS'}
                                </button>
                            </div>

                            {/* Virtual Logs View */}
                            <AnimatePresence>
                                {showLogs && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="w-full max-w-lg mt-6 bg-black/40 border border-white/10 rounded-xl overflow-hidden text-left font-mono"
                                    >
                                        <div className="p-4 h-32 overflow-y-auto text-[10px] space-y-1 custom-scrollbar">
                                            {logs.length > 0 ? logs.map((log, i) => (
                                                <p key={i} className="text-zinc-500">
                                                    <span className="text-blue-500/50 mr-2">[{new Date().toLocaleTimeString()}]</span>
                                                    <span className="text-zinc-300">{log}</span>
                                                </p>
                                            )) : (
                                                <p className="text-zinc-500 italic">Initializing stream...</p>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}

                    {status === 'error' && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-8 text-center bg-red-950/10">
                            <RotateCcw size={32} className="text-red-500 mb-4" />
                            <h2 className="text-lg font-bold text-white mb-2 uppercase tracking-tight">Deployment Failed</h2>
                            <button
                                onClick={onRestart}
                                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-xs shadow-xl shadow-red-500/20 transition-all flex items-center gap-2"
                            >
                                <RefreshCw size={14} />
                                RETRY BOOT
                            </button>
                        </div>
                    )}

                    {status === 'ready' && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="w-full h-full flex flex-col items-center justify-center p-4 transition-all duration-500"
                        >
                            <div
                                className="preview-frame ring-1 ring-white/10 shadow-2xl overflow-hidden transition-all duration-500 ease-in-out relative flex flex-col"
                                style={{
                                    width: getViewWidth(),
                                    height: '100%',
                                    borderRadius: viewMode === 'desktop' ? '0px' : '24px',
                                    border: viewMode === 'desktop' ? 'none' : '8px solid #1a1a1a',
                                    backgroundColor: '#fff'
                                }}
                            >
                                {children ? (
                                    <div className="w-full h-full relative bg-white overflow-auto">
                                        {children}
                                    </div>
                                ) : url ? (
                                    <iframe
                                        ref={iframeRef}
                                        src={url}
                                        className="w-full h-full border-0"
                                        title="Live App Preview"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                                        <Loader2 size={32} className="text-blue-500 animate-spin" />
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );

    if (embedded) return content;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[150] flex items-center justify-center p-4 md:p-8"
            >
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/80 backdrop-blur-xl"
                    style={{
                        background: 'radial-gradient(circle at center, rgba(0, 194, 255, 0.1) 0%, rgba(0, 0, 0, 0.9) 100%)'
                    }}
                />

                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="w-full h-full max-w-7xl z-10"
                >
                    {content}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
