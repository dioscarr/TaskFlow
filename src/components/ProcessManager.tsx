'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Play, Square, Trash2, RefreshCw, CheckCircle2, AlertCircle, Clock, Loader2 } from 'lucide-react';
import { listProcesses, stopProcess, startProcess, checkProcessHealth, discoverProcesses, deleteProcess, restartProcess, rebuildProcess, getDockerLogs } from '@/app/processActions';
import { toast } from 'sonner';

interface Process {
    id: string;
    name: string;
    type: string;
    port?: number;
    pid?: number;
    path: string;
    command: string;
    status: string;
    healthStatus?: string;
    responseTime?: number;
    startedAt: Date;
    lastHealthCheck?: Date;
    metadata?: any;
}

export default function ProcessManager() {
    const [processes, setProcesses] = useState<Process[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actioningId, setActioningId] = useState<string | null>(null);
    const [logs, setLogs] = useState<{ id: string; content: string } | null>(null);
    const [isShowingLogs, setIsShowingLogs] = useState(false);

    const loadProcesses = async () => {
        setIsLoading(true);
        const result = await listProcesses();
        if (result.success && result.processes) {
            setProcesses(result.processes as Process[]);
        }
        setIsLoading(false);
    };

    const handleStop = async (id: string) => {
        setActioningId(id);
        const result = await stopProcess(id);
        if (result.success) {
            toast.success('Process stopped');
            await loadProcesses();
        } else {
            toast.error(result.message || 'Failed to stop process');
        }
        setActioningId(null);
    };

    const handleStart = async (id: string) => {
        setActioningId(id);
        const result = await startProcess(id);
        if (result.success) {
            toast.success('Process started');
            await loadProcesses();
        } else {
            toast.error(result.message || 'Failed to start process');
        }
        setActioningId(null);
    };

    const handleRestart = async (id: string) => {
        setActioningId(id);
        const result = await restartProcess(id);
        if (result.success) {
            toast.success('Process restarted');
            await loadProcesses();
        } else {
            toast.error(result.message || 'Failed to restart process');
        }
        setActioningId(null);
    };

    const handleRebuild = async (id: string) => {
        const loadingToast = toast.loading('Rebuilding and starting container...');
        setActioningId(id);
        const result = await rebuildProcess(id);
        if (result.success) {
            toast.success('Process rebuilt and started', { id: loadingToast });
            await loadProcesses();
        } else {
            toast.error(result.message || 'Failed to rebuild process', { id: loadingToast });
        }
        setActioningId(null);
    };

    const handleGetLogs = async (id: string) => {
        setActioningId(id);
        const result = await getDockerLogs(id);
        if (result.success && result.logs) {
            setLogs({ id, content: result.logs });
            setIsShowingLogs(true);
        } else {
            toast.error(result.message || 'Failed to fetch logs');
        }
        setActioningId(null);
    };

    const handleHealthCheck = async (id: string) => {
        const result = await checkProcessHealth(id);
        if (result.success) {
            toast.success(`Health: ${result.health?.status}`);
            await loadProcesses();
        } else {
            toast.error('Health check failed');
        }
    };

    const handleDiscover = async () => {
        const result = await discoverProcesses();
        if (result.success && result.discovered) {
            toast.success(`Discovered ${result.discovered.length} process(es)`);
            await loadProcesses();
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to remove this process from the registry?')) return;

        setActioningId(id);
        const result = await deleteProcess(id);
        if (result.success) {
            toast.success('Process removed');
            await loadProcesses();
        } else {
            toast.error('Failed to remove process');
        }
        setActioningId(null);
    };

    useEffect(() => {
        loadProcesses();

        // Auto-refresh every 30 seconds
        const interval = setInterval(loadProcesses, 30000);
        return () => clearInterval(interval);
    }, []);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'running':
            case 'healthy':
                return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
            case 'stopped':
                return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
            case 'error':
            case 'unhealthy':
                return 'text-red-400 bg-red-500/10 border-red-500/20';
            default:
                return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'running':
            case 'healthy':
                return <CheckCircle2 size={14} />;
            case 'stopped':
                return <Square size={14} />;
            case 'error':
            case 'unhealthy':
                return <AlertCircle size={14} />;
            default:
                return <Clock size={14} />;
        }
    };

    const formatUptime = (startedAt: Date) => {
        const now = new Date().getTime();
        const start = new Date(startedAt).getTime();
        const diff = now - start;

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                        <Activity size={20} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white uppercase tracking-wider">
                            Process Manager
                        </h1>
                        <p className="text-xs text-white/40 font-medium">
                            Monitor and control all running processes
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleDiscover}
                        className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs text-white/60 hover:text-white border border-white/10 hover:border-white/20 transition-all"
                    >
                        <RefreshCw size={14} />
                        <span>Discover</span>
                    </button>
                    <button
                        onClick={loadProcesses}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 rounded-xl text-xs text-blue-400 border border-blue-500/20 transition-all"
                    >
                        <RefreshCw size={14} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* Process List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="animate-spin text-white/20" size={32} />
                </div>
            ) : processes.length === 0 ? (
                <div className="text-center py-20 space-y-4">
                    <div className="text-white/20">
                        <Activity size={64} className="mx-auto mb-4" />
                    </div>
                    <p className="text-white/40 text-sm">No processes registered</p>
                    <button
                        onClick={handleDiscover}
                        className="px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 rounded-xl text-sm text-blue-400 border border-blue-500/20 transition-all"
                    >
                        Discover Running Processes
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    <AnimatePresence>
                        {processes.map((process) => {
                            const internalDomain = process.metadata?.internalDomain as string | undefined;
                            const appUrl = process.port
                                ? `http://localhost:${process.port}`
                                : (internalDomain ? `http://${internalDomain}` : null);

                            return (
                                <motion.div
                                    key={process.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-all space-y-4"
                                >
                                    {/* Header */}
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-base font-bold text-white">{process.name}</h3>
                                                {process.port && (
                                                    <span className="px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 font-mono">
                                                        :{process.port}
                                                    </span>
                                                )}
                                                <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-xs font-bold uppercase tracking-wider ${getStatusColor(process.status)}`}>
                                                    {getStatusIcon(process.status)}
                                                    <span>{process.status}</span>
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-4 text-xs text-white/40">
                                                <span className="font-mono truncate max-w-md">{process.path}</span>
                                                {process.pid && <span className="font-mono">PID: {process.pid}</span>}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2">
                                            {process.status === 'running' && (
                                                <>
                                                    <button
                                                        onClick={() => handleHealthCheck(process.id)}
                                                        className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white border border-white/10 hover:border-white/20 transition-all"
                                                        title="Check Health"
                                                    >
                                                        <RefreshCw size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleRestart(process.id)}
                                                        disabled={actioningId === process.id}
                                                        className="p-2 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg text-blue-400 border border-blue-500/20 hover:border-blue-500/30 transition-all disabled:opacity-50"
                                                        title="Restart Process"
                                                    >
                                                        <RefreshCw size={14} className={actioningId === process.id ? "animate-spin" : ""} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleStop(process.id)}
                                                        disabled={actioningId === process.id}
                                                        className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-400 border border-red-500/20 hover:border-red-500/30 transition-all disabled:opacity-50"
                                                        title="Stop Process"
                                                    >
                                                        {actioningId === process.id ? (
                                                            <Loader2 size={14} className="animate-spin" />
                                                        ) : (
                                                            <Square size={14} />
                                                        )}
                                                    </button>
                                                </>
                                            )}
                                            {process.status !== 'running' && (
                                                <button
                                                    onClick={() => handleStart(process.id)}
                                                    disabled={actioningId === process.id}
                                                    className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/30 transition-all disabled:opacity-50"
                                                    title="Start Process"
                                                >
                                                    {actioningId === process.id ? (
                                                        <Loader2 size={14} className="animate-spin" />
                                                    ) : (
                                                        <Play size={14} />
                                                    )}
                                                </button>
                                            )}
                                            {process.type === 'docker-app' && (
                                                <>
                                                    <button
                                                        onClick={() => handleRebuild(process.id)}
                                                        disabled={actioningId === process.id}
                                                        className="p-2 bg-purple-500/10 hover:bg-purple-500/20 rounded-lg text-purple-400 border border-purple-500/20 hover:border-purple-500/30 transition-all disabled:opacity-50"
                                                        title="Rebuild & Start"
                                                    >
                                                        <RefreshCw size={14} className={actioningId === process.id ? "animate-spin" : ""} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleGetLogs(process.id)}
                                                        disabled={actioningId === process.id}
                                                        className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white border border-white/10 hover:border-white/20 transition-all disabled:opacity-50"
                                                        title="View Logs"
                                                    >
                                                        <Activity size={14} />
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                onClick={() => handleDelete(process.id)}
                                                disabled={actioningId === process.id}
                                                className="p-2 bg-white/5 hover:bg-red-500/20 rounded-lg text-white/40 hover:text-red-400 border border-white/10 hover:border-red-500/20 transition-all"
                                                title="Remove from Registry"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Metrics */}
                                    {process.status === 'running' && (
                                        <div className="flex items-center gap-6 pt-3 border-t border-white/5 text-xs">
                                            <div className="flex items-center gap-2 text-white/40">
                                                <Clock size={12} />
                                                <span>Uptime: <span className="text-white/60 font-mono">{formatUptime(process.startedAt)}</span></span>
                                            </div>
                                            {process.responseTime !== null && process.responseTime !== undefined && (
                                                <div className="flex items-center gap-2 text-white/40">
                                                    <CheckCircle2 size={12} />
                                                    <span>Response: <span className="text-white/60 font-mono">{process.responseTime}ms</span></span>
                                                </div>
                                            )}
                                            {process.lastHealthCheck && (
                                                <div className="flex items-center gap-2 text-white/40">
                                                    <Activity size={12} />
                                                    <span>Last check: <span className="text-white/60 font-mono">{new Date(process.lastHealthCheck).toLocaleTimeString()}</span></span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Command */}
                                    <div className="pt-2 space-y-2">
                                        <p className="text-[10px] text-white/20 uppercase tracking-wider font-bold">Command</p>
                                        <p className="text-xs text-white/40 font-mono bg-black/20 p-2 rounded-lg border border-white/5">
                                            {process.command}
                                        </p>
                                        {appUrl && (
                                            <div className="flex items-center gap-2 text-xs">
                                                <button
                                                    onClick={() => window.open(appUrl, '_blank', 'noopener,noreferrer')}
                                                    className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 rounded-lg border border-emerald-500/20 transition-colors"
                                                >
                                                    Open App
                                                </button>
                                                <button
                                                    onClick={() => navigator.clipboard.writeText(appUrl)}
                                                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg border border-white/10 transition-colors"
                                                >
                                                    Copy URL
                                                </button>
                                                <span className="text-white/30 font-mono truncate">{appUrl}</span>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}

            {/* Logs Modal */}
            <AnimatePresence>
                {isShowingLogs && logs && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setIsShowingLogs(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="w-full max-w-4xl max-h-[80vh] bg-[#0c0c0c] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                                <div className="flex items-center gap-2">
                                    <Activity size={16} className="text-blue-400" />
                                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">Container Logs</h2>
                                </div>
                                <button
                                    onClick={() => setIsShowingLogs(false)}
                                    className="p-1 hover:bg-white/10 rounded-md text-white/40 hover:text-white transition-colors"
                                >
                                    <Square size={16} fill="currentColor" />
                                </button>
                            </div>
                            <div className="p-4 overflow-auto max-h-[calc(80vh-64px)] font-mono text-xs text-white/60 bg-black/40">
                                <pre className="whitespace-pre-wrap">
                                    {logs.content || "No logs available"}
                                </pre>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
