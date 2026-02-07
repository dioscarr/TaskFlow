'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Play, Square, Trash2, RefreshCw, CheckCircle2, AlertCircle, Clock, Loader2, Zap } from 'lucide-react';
import { List } from 'react-window';
import TerminalView from './TerminalView';
import { listProcesses, stopProcess, startProcess, checkProcessHealth, discoverProcesses, deleteProcess, restartProcess, rebuildProcess, getDockerLogs, reconfigureProcessPort } from '@/app/processActions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
    const [filter, setFilter] = useState<'all' | 'local' | 'container'>('all');
    const [logs, setLogs] = useState<{ id: string; content: string } | null>(null);
    const [isShowingLogs, setIsShowingLogs] = useState(false);

    const isFetchingRef = React.useRef(false);

    // Stable load function (memoized) to avoid recreating closures
    const loadProcesses = React.useCallback(async ({ showLoading = true }: { showLoading?: boolean } = {}) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        if (showLoading) setIsLoading(true);

        try {
            const result = await listProcesses();
            if (result.success && result.processes) {
                // Only update state if processes changed to avoid UI jitter
                setProcesses((prev) => {
                    // Quick shallow compare of ids and statuses to minimize updates
                    const prevKey = prev.map((p) => `${p.id}:${p.status}:${p.port || ''}`).join('|');
                    const nextKey = (result.processes as Process[]).map((p) => `${p.id}:${p.status}:${p.port || ''}`).join('|');
                    if (prevKey === nextKey) return prev;
                    return result.processes as Process[];
                });
            }
        } finally {
            if (showLoading) setIsLoading(false);
            isFetchingRef.current = false;
        }
    }, []);

    const handleStop = React.useCallback(async (id: string) => {
        setActioningId(id);
        const result = await stopProcess(id);
        if (result.success) {
            toast.success('Process stopped');
            await loadProcesses({ showLoading: false });
        } else {
            toast.error(result.message || 'Failed to stop process');
        }
        setActioningId(null);
    }, [loadProcesses]);

    const handleStart = React.useCallback(async (id: string) => {
        setActioningId(id);
        const result = await startProcess(id);
        if (result.success) {
            toast.success('Process started');
            await loadProcesses({ showLoading: false });
        } else {
            toast.error(result.message || 'Failed to start process');
        }
        setActioningId(null);
    }, [loadProcesses]);

    const handleRestart = React.useCallback(async (id: string) => {
        setActioningId(id);
        const result = await restartProcess(id);
        if (result.success) {
            toast.success('Process restarted');
            await loadProcesses({ showLoading: false });
        } else {
            toast.error(result.message || 'Failed to restart process');
        }
        setActioningId(null);
    }, [loadProcesses]);

    const handleRebuild = React.useCallback(async (id: string) => {
        const loadingToast = toast.loading('Rebuilding and starting container...');
        setActioningId(id);
        const result = await rebuildProcess(id);
        if (result.success) {
            toast.success('Process rebuilt and started', { id: loadingToast });
            await loadProcesses({ showLoading: false });
        } else {
            toast.error(result.message || 'Failed to rebuild process', { id: loadingToast });
        }
        setActioningId(null);
    }, [loadProcesses]);

    const handleFixPort = React.useCallback(async (id: string) => {
        setActioningId(id);
        const loadingToast = toast.loading('Attempting to fix port conflict...');
        const result = await reconfigureProcessPort(id);
        if (result.success) {
            toast.success(`Port fixed! New port: ${result.port}`, { id: loadingToast });
            await loadProcesses({ showLoading: false });
        } else {
            toast.error(result.error || 'Failed to fix port', { id: loadingToast });
        }
        setActioningId(null);
    }, [loadProcesses]);

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

    const handleStartLocal = async (id: string) => {
        setActioningId(id);
        const result = await startProcess(id);
        if (result.success) {
            toast.success('Local dev server started');
            await loadProcesses({ showLoading: false });
        } else {
            toast.error(result.message || 'Failed to start local server');
        }
        setActioningId(null);
    };

    const handleStartContainer = async (id: string) => {
        setActioningId(id);
        const proc = processes.find(p => p.id === id);
        const isRepo = proc?.metadata?.source === 'repo-app';
        if (isRepo) {
            // Rebuild handles build & start for repo apps
            const res = await rebuildProcess(id);
            if (res && res.success) {
                toast.success('Container rebuilt and started');
                await loadProcesses({ showLoading: false });
            } else {
                toast.error(res?.message || 'Failed to rebuild container');
            }
            setActioningId(null);
            return;
        }

        const result = await startProcess(id);
        if (result.success) {
            toast.success('Container started');
            await loadProcesses({ showLoading: false });
        } else {
            toast.error(result.message || 'Failed to start container');
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
            await loadProcesses({ showLoading: true });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to remove this process from the registry?')) return;

        setActioningId(id);
        const result = await deleteProcess(id);
        if (result.success) {
            toast.success('Process removed');
            await loadProcesses({ showLoading: false });
        } else {
            toast.error('Failed to remove process');
        }
        setActioningId(null);
    };

    // Auto-refresh controls
    const [autoRefreshEnabled, setAutoRefreshEnabled] = React.useState(true);
    const [refreshInterval, setRefreshInterval] = React.useState<number>(30000);

    // List virtualization height
    const [listHeight, setListHeight] = React.useState<number>(Math.min(600, typeof window !== 'undefined' ? window.innerHeight - 300 : 600));

    // Live WebSocket updates
    const [liveEnabled, setLiveEnabled] = React.useState(true);
    const wsRef = React.useRef<WebSocket | null>(null);
    const retryRef = React.useRef<number>(0);
    const reconnectTimerRef = React.useRef<number | null>(null);
    const failedAttemptsRef = React.useRef<number>(0);
    const MAX_FAILED_ATTEMPTS = 5;
    // Connection state for status indicator
    const [connState, setConnState] = React.useState<'connecting' | 'open' | 'closed'>('closed');

    React.useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!liveEnabled) {
            // If disabling live updates, close socket and clear timers
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
            return;
        }

        const port = Number(process.env.NEXT_PUBLIC_PROCESS_WS_PORT) || 4001;
        const host = window.location.hostname || 'localhost';
        let cancelled = false;

        const scheduleReconnect = () => {
            if (!liveEnabled) return;
            const delay = Math.min(30000, 1000 * Math.pow(2, retryRef.current) + Math.floor(Math.random() * 500));
            retryRef.current++;
            reconnectTimerRef.current = window.setTimeout(() => {
                connect();
            }, delay);
        };

        function connect() {
            if (!liveEnabled) return;
            try {
                setConnState('connecting');
                wsRef.current = new WebSocket(`ws://${host}:${port}`);
            } catch (e) {
                setConnState('closed');
                scheduleReconnect();
                return;
            }

            wsRef.current.onopen = () => {
                retryRef.current = 0;
                failedAttemptsRef.current = 0;
                setConnState('open');
            };

            wsRef.current.onmessage = (ev) => {
                try {
                    const msg = JSON.parse(ev.data as string);
                    if (msg.type === 'processes' && Array.isArray(msg.data)) {
                        const incoming = msg.data as Process[];
                        setProcesses((prev) => {
                            const prevKey = prev.map((p) => `${p.id}:${p.status}:${p.port || ''}`).join('|');
                            const nextKey = incoming.map((p: any) => `${p.id}:${p.status}:${p.port || ''}`).join('|');
                            if (prevKey === nextKey) return prev;
                            return incoming as Process[];
                        });
                    }
                } catch (e) {
                    // ignore malformed messages
                }
            };

            wsRef.current.onclose = () => {
                setConnState('closed');
                failedAttemptsRef.current++;
                // If repeated failures occur, fallback to polling
                if (failedAttemptsRef.current >= MAX_FAILED_ATTEMPTS) {
                    // Turn off Live and enable auto-refresh polling
                    setLiveEnabled(false);
                    setAutoRefreshEnabled(true);
                    // Notify the user
                    try { toast.error('Live updates unavailable — falling back to polling'); } catch (e) { /* ignore */ }
                    return; // don't schedule more reconnects
                }
                if (!cancelled) scheduleReconnect();
            };

            wsRef.current.onerror = () => {
                setConnState('closed');
                failedAttemptsRef.current++;
                // On error, close to trigger onclose and fallback logic
                wsRef.current?.close();
            };
        }

        connect();

        return () => {
            cancelled = true;
            wsRef.current?.close();
            wsRef.current = null;
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
        };
    }, [liveEnabled]);

    // When live updates are enabled, prime the list once so UI is current
    React.useEffect(() => {
        if (liveEnabled) {
            loadProcesses({ showLoading: false });
        }
    }, [liveEnabled, loadProcesses]);

    React.useEffect(() => {
        // Initial load with loader
        loadProcesses({ showLoading: true });

        // Resize-aware list height
        const onResize = () => {
            const h = Math.min(600, Math.max(300, window.innerHeight - 300));
            setListHeight(h);
        };
        window.addEventListener('resize', onResize);
        onResize();

        // Visibility-aware auto-refresh using user-controlled interval
        let intervalId: ReturnType<typeof setInterval> | null = null;
        const startInterval = () => {
            if (!autoRefreshEnabled) return;
            if (liveEnabled) return; // when live websocket updates are enabled, skip periodic polling
            if (intervalId) return;
            intervalId = setInterval(() => {
                if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
                    loadProcesses({ showLoading: false });
                }
            }, refreshInterval);
        };
        const stopInterval = () => {
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        };

        const onVisibility = () => {
            if (typeof document === 'undefined') return;
            if (document.visibilityState === 'visible') {
                loadProcesses({ showLoading: false });
                startInterval();
            } else {
                stopInterval();
            }
        };

        // Start only when visible & enabled
        if (typeof document !== 'undefined') {
            if (document.visibilityState === 'visible') startInterval();
            document.addEventListener('visibilitychange', onVisibility);
        }

        return () => {
            stopInterval();
            window.removeEventListener('resize', onResize);
            if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [loadProcesses, autoRefreshEnabled, refreshInterval, liveEnabled]);

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

    const filteredProcesses = React.useMemo(() => {
        return processes.filter((process) => {
            if (filter === 'all') return true;
            const isContainer = process.type === 'docker-app' || ['docker', 'repo-app', 'deployment'].includes(process.metadata?.source);
            const isLocal = process.type === 'dev-server' && process.metadata?.source === 'local';
            if (filter === 'local') return isLocal;
            if (filter === 'container') return isContainer;
            return true;
        });
    }, [processes, filter]);

    // Memoized row component to reduce re-renders
    const ProcessRow = React.memo(function ProcessRow({
        process,
        isActioning,
        onStop,
        onStartLocal,
        onStartContainer,
        onRestart,
        onRebuild,
        onFixPort,
        onGetLogs,
        onHealthCheck,
        onDelete
    }: {
        process: Process;
        isActioning: boolean;
        onStop: (id: string) => void;
        onStartLocal: (id: string) => void;
        onStartContainer: (id: string) => void;
        onRestart: (id: string) => void;
        onRebuild: (id: string) => void;
        onFixPort: (id: string) => void;
        onGetLogs: (id: string) => void;
        onHealthCheck: (id: string) => void;
        onDelete: (id: string) => void;
    }) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -10 }}
                key={process.id}
                className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-all space-y-4"
            >
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                            <h3 className="text-base font-bold text-white">{process.name}</h3>
                            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${process.type === 'docker-app' ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20' : process.type === 'dev-server' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-white/5 text-white/40 border border-white/10'}`}>{process.type === 'docker-app' ? 'Container' : process.type === 'dev-server' ? 'Local' : (process.metadata?.source || 'Unknown')}</span>
                            {process.port && (
                                <span className="px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 font-mono">:{process.port}</span>
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
                        <button onClick={() => onHealthCheck(process.id)} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white border border-white/10 hover:border-white/20 transition-all" title="Check Health"><RefreshCw size={14} /></button>
                        {((process.port) || process.metadata?.internalDomain) && (
                            <button onClick={() => { const url = process.port ? `http://localhost:${process.port}` : `http://${process.metadata?.internalDomain}`; window.open(url, '_blank', 'noopener,noreferrer'); }} className="p-2 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg text-blue-300 border border-blue-500/20 transition-all" title="Open App"><Activity size={14} /></button>
                        )}
                        {process.type === 'docker-app' && (
                            <>
                                <button onClick={() => onRebuild(process.id)} disabled={isActioning} className="p-2 bg-purple-500/10 hover:bg-purple-500/20 rounded-lg text-purple-400 border border-purple-500/20 hover:border-purple-500/30 transition-all disabled:opacity-50" title="Rebuild & Start"><RefreshCw size={14} /></button>
                                <button onClick={() => onFixPort(process.id)} disabled={isActioning} className="p-2 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg text-amber-400 border border-amber-500/20 hover:border-amber-500/30 transition-all disabled:opacity-50" title="Fix Port Conflict"><Zap size={14} /></button>
                                <button onClick={() => onGetLogs(process.id)} disabled={isActioning} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white border border-white/10 hover:border-white/20 transition-all disabled:opacity-50" title="View Logs"><Activity size={14} /></button>
                            </>
                        )}

                        {/* Per-type start/stop */}
                        {process.type === 'dev-server' && (
                            <button onClick={() => process.status === 'running' ? onStop(process.id) : onStartLocal(process.id)} disabled={isActioning} className={cn("h-9 px-4 text-sm font-semibold rounded-2xl transition-all min-w-[120px] flex items-center justify-center gap-2", process.status === 'running' ? 'text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20' : 'text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20')}>{isActioning ? <Loader2 className="animate-spin" size={14} /> : (process.status === 'running' ? 'Stop Dev' : 'Start Dev')}</button>
                        )}

                        {(['docker-app', 'repo-app', 'deployment'].includes(process.type) || ['docker', 'repo-app', 'deployment'].includes(process.metadata?.source)) && (
                            <button onClick={() => process.status === 'running' ? onStop(process.id) : onStartContainer(process.id)} disabled={isActioning} className={cn("h-9 px-4 text-sm font-semibold rounded-2xl transition-all min-w-[120px] flex items-center justify-center gap-2", process.status === 'running' ? 'text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20' : 'text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20')}>{isActioning ? <Loader2 className="animate-spin" size={14} /> : (process.status === 'running' ? 'Stop Ctnr' : 'Start Ctnr')}</button>
                        )}

                        <button onClick={() => onDelete(process.id)} disabled={isActioning} className="p-2 bg-white/5 hover:bg-red-500/20 rounded-lg text-white/40 hover:text-red-400 border border-white/10 hover:border-red-500/20 transition-all" title="Remove from Registry"><Trash2 size={14} /></button>
                    </div>
                </div>

                {/* Metrics */}
                {process.status === 'running' && (
                    <div className="flex items-center gap-6 pt-3 border-t border-white/5 text-xs">
                        <div className="flex items-center gap-2 text-white/40"><Clock size={12} /><span>Uptime: <span className="text-white/60 font-mono">{formatUptime(process.startedAt)}</span></span></div>
                        {process.responseTime !== null && process.responseTime !== undefined && (<div className="flex items-center gap-2 text-white/40"><CheckCircle2 size={12} /><span>Response: <span className="text-white/60 font-mono">{process.responseTime}ms</span></span></div>)}
                        {process.lastHealthCheck && (<div className="flex items-center gap-2 text-white/40"><Activity size={12} /><span>Last check: <span className="text-white/60 font-mono">{new Date(process.lastHealthCheck).toLocaleTimeString()}</span></span></div>)}
                    </div>
                )}
            </motion.div>
        );
    }, (a, b) => {
        // Custom compare: only re-render when relevant properties change
        const pA = a.process;
        const pB = b.process;
        return pA.id === pB.id && pA.status === pB.status && pA.port === pB.port && pA.responseTime === pB.responseTime && pA.lastHealthCheck === pB.lastHealthCheck && a.isActioning === b.isActioning;
    });

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
                    <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
                        <button onClick={() => setFilter('all')} className={cn("px-3 py-1 rounded-lg text-xs", filter === 'all' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white')}>All</button>
                        <button onClick={() => setFilter('local')} className={cn("px-3 py-1 rounded-lg text-xs", filter === 'local' ? 'bg-emerald-500/10 text-emerald-300' : 'text-white/50 hover:text-white')}>Local</button>
                        <button onClick={() => setFilter('container')} className={cn("px-3 py-1 rounded-lg text-xs", filter === 'container' ? 'bg-purple-500/10 text-purple-300' : 'text-white/50 hover:text-white')}>Container</button>
                    </div>
                    <button
                        onClick={() => { handleDiscover(); }}
                        className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs text-white/60 hover:text-white border border-white/10 hover:border-white/20 transition-all"
                    >
                        <RefreshCw size={14} />
                        <span>Discover</span>
                    </button>
                    <button
                        onClick={() => loadProcesses({ showLoading: true })}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 rounded-xl text-xs text-blue-400 border border-blue-500/20 transition-all"
                    >
                        <RefreshCw size={14} />
                        <span>Refresh</span>
                    </button>

                    {/* Auto-refresh & Live Controls */}
                    <div className="flex items-center gap-2 bg-white/5 rounded-lg p-1 px-2">
                        <button
                            onClick={() => setAutoRefreshEnabled(v => !v)}
                            className={cn("px-2 py-1 rounded-md text-xs font-medium transition-all", autoRefreshEnabled ? 'bg-emerald-500/10 text-emerald-300' : 'text-white/50')}
                            title="Toggle Auto Refresh"
                        >
                            {autoRefreshEnabled ? 'Auto: On' : 'Auto: Off'}
                        </button>

                        <button
                            onClick={() => setLiveEnabled(v => !v)}
                            className={cn("px-2 py-1 rounded-md text-xs font-medium transition-all", liveEnabled ? 'bg-blue-500/10 text-blue-300' : 'text-white/50')}
                            title="Toggle Live Updates"
                        >
                            {liveEnabled ? 'Live: On' : 'Live: Off'}
                        </button>

                        <span className="ml-2 flex items-center gap-2">
                            <span className={cn("w-2 h-2 rounded-full", connState === 'open' ? 'bg-emerald-400' : connState === 'connecting' ? 'bg-yellow-400' : 'bg-red-400')}></span>
                            <span className="text-xs text-white/60">{connState === 'open' ? 'Connected' : connState === 'connecting' ? 'Connecting' : 'Disconnected'}</span>
                            {connState !== 'open' && (
                                <button
                                    onClick={() => {
                                        // quick reconnect: toggle live off/on to restart connection logic
                                        if (!liveEnabled) {
                                            setLiveEnabled(true);
                                        } else {
                                            setLiveEnabled(false);
                                            setTimeout(() => setLiveEnabled(true), 250);
                                        }
                                    }}
                                    className="ml-2 px-2 py-1 rounded-md text-xs bg-white/5 hover:bg-white/10"
                                >
                                    Reconnect
                                </button>
                            )}
                        </span>

                        <select
                            value={refreshInterval}
                            onChange={(e) => setRefreshInterval(Number(e.target.value))}
                            className="bg-transparent text-xs text-white/60 outline-none"
                            title="Refresh Interval"
                        >
                            <option value={15000}>15s</option>
                            <option value={30000}>30s</option>
                            <option value={60000}>60s</option>
                        </select>
                    </div>
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
                    <div className="w-full">
                        {/* Use react-window v2 List API (rowComponent + rowProps) */}
                        {/* Row renderer forwards index/style and a rowProps object */}
                        <List
                            style={{ width: '100%' }}
                            rowCount={filteredProcesses.length}
                            rowHeight={160}
                            defaultHeight={listHeight}
                            overscanCount={3}
                            rowComponent={function RowRenderer({ index, style, rowProps }: any) {
                                // Use the provided rowProps if available (react-window v2),
                                // but fall back to the local `filteredProcesses` and handlers
                                // to defend against cases where `rowProps` may be undefined.
                                const process = (rowProps?.processes && rowProps.processes[index]) || filteredProcesses[index];
                                if (!process) {
                                    return <div style={style} className="px-0" />;
                                }
                                return (
                                    <div style={style} className="px-0">
                                        <ProcessRow
                                            key={process.id}
                                            process={process}
                                            isActioning={actioningId === process.id}
                                            onStop={handleStop}
                                            onStartLocal={handleStart}
                                            onStartContainer={handleStartContainer}
                                            onRestart={handleRestart}
                                            onRebuild={handleRebuild}
                                            onFixPort={handleFixPort}
                                            onGetLogs={handleGetLogs}
                                            onHealthCheck={handleHealthCheck}
                                            onDelete={handleDelete}
                                        />
                                    </div>
                                );
                            }}
                            rowProps={{
                                processes: filteredProcesses,
                                handleStop,
                                handleStart,
                                handleStartContainer,
                                handleRestart,
                                handleRebuild,
                                handleFixPort,
                                handleGetLogs,
                                handleHealthCheck,
                                handleDelete
                            }}
                        />
                    </div>
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
                                <div className="flex items-center gap-2">
                                    {logs && processes.find(p => p.id === logs.id) && (() => {
                                        const p = processes.find(p => p.id === logs.id)!;
                                        const internal = p.metadata?.internalDomain as string | undefined;
                                        const url = p.port ? `http://localhost:${p.port}` : (internal ? `http://${internal}` : undefined);
                                        return url ? (
                                            <button
                                                onClick={() => window.open(url, '_blank')}
                                                className="px-2 py-1 rounded-md text-xs bg-blue-500/10 text-blue-300 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                                            >
                                                Open App
                                            </button>
                                        ) : null;
                                    })()}
                                    <button
                                        onClick={() => setIsShowingLogs(false)}
                                        className="p-1 hover:bg-white/10 rounded-md text-white/40 hover:text-white transition-colors"
                                    >
                                        <Square size={16} fill="currentColor" />
                                    </button>
                                </div>
                            </div>
                            <div className="p-4 bg-black/40">
                                <TerminalView
                                    content={logs.content || "No logs available"}
                                    title="System Logs"
                                    maxHeight="calc(80vh - 120px)"
                                />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
