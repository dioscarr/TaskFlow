'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Play, Square, Trash2, RefreshCw, CheckCircle2, AlertCircle, Clock, Loader2, Zap } from 'lucide-react';
import { List } from 'react-window';
import TerminalView from './TerminalView';
import { listProcesses, stopProcess, startProcess, checkProcessHealth, discoverProcesses, deleteProcess, restartProcess, rebuildProcess, getDockerLogs, reconfigureProcessPort, refreshProcesses } from '@/app/processActions';
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

    const handleManualRefresh = React.useCallback(async () => {
        const loadingToast = toast.loading('Syncing processes...');
        try {
            const result = await refreshProcesses();
            if (result.success && result.processes) {
                setProcesses(result.processes as Process[]);
                toast.success('Processes synced!', { id: loadingToast });
            } else {
                toast.error('Failed to refresh', { id: loadingToast });
            }
        } catch (error) {
            toast.error('Refresh failed', { id: loadingToast });
        }
    }, []);

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

        const port = Number((global as any).process?.env?.NEXT_PUBLIC_PROCESS_WS_PORT) || 4001;
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

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                        <Activity size={20} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black theme-text-primary uppercase tracking-wider">
                            Process Manager
                        </h1>
                        <p className="text-xs theme-text-tertiary font-medium">
                            Monitor and control all running processes
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 theme-overlay-subtle rounded-lg p-1">
                        <button onClick={() => setFilter('all')} className={cn("px-3 py-1 rounded-lg text-xs", filter === 'all' ? 'theme-overlay-medium theme-text-primary' : 'theme-text-secondary hover:theme-text-primary')}>All</button>
                        <button onClick={() => setFilter('local')} className={cn("px-3 py-1 rounded-lg text-xs", filter === 'local' ? 'bg-emerald-500/10 text-emerald-300' : 'theme-text-secondary hover:theme-text-primary')}>Local</button>
                        <button onClick={() => setFilter('container')} className={cn("px-3 py-1 rounded-lg text-xs", filter === 'container' ? 'bg-sky-500/10 text-sky-300' : 'theme-text-secondary hover:theme-text-primary')}>Container</button>
                    </div>
                    <button
                        onClick={() => { handleDiscover(); }}
                        className="flex items-center gap-2 px-3 py-2 theme-overlay-subtle hover:theme-overlay-medium rounded-xl text-xs theme-text-tertiary hover:theme-text-primary border theme-border-medium hover:theme-border-strong transition-all"
                    >
                        <RefreshCw size={14} />
                        <span>Discover</span>
                    </button>
                    <button
                        onClick={() => loadProcesses({ showLoading: true })}
                        className="flex items-center gap-2 px-3 py-2 bg-sky-500/10 hover:bg-sky-500/20 rounded-xl text-xs text-sky-400 border border-sky-500/20 transition-all"
                    >
                        <RefreshCw size={14} />
                        <span>Refresh</span>
                    </button>

                    {/* Auto-refresh & Live Controls */}
                    <div className="flex items-center gap-2 theme-overlay-subtle rounded-lg p-1 px-2">
                        <button
                            onClick={() => setAutoRefreshEnabled(v => !v)}
                            className={cn("px-2 py-1 rounded-md text-xs font-medium transition-all", autoRefreshEnabled ? 'bg-emerald-500/10 text-emerald-300' : 'theme-text-secondary')}
                            title="Toggle Auto Refresh"
                        >
                            {autoRefreshEnabled ? 'Auto: On' : 'Auto: Off'}
                        </button>

                        <button
                            onClick={() => setLiveEnabled(v => !v)}
                            className={cn("px-2 py-1 rounded-md text-xs font-medium transition-all", liveEnabled ? 'bg-sky-500/10 text-sky-300' : 'theme-text-secondary')}
                            title="Toggle Live Updates"
                        >
                            {liveEnabled ? 'Live: On' : 'Live: Off'}
                        </button>

                        <button
                            onClick={handleManualRefresh}
                            className="px-3 py-1 rounded-md text-xs font-medium transition-all bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 flex items-center gap-1.5"
                            title="Force sync with containers and repos"
                        >
                            <RefreshCw size={12} />
                            Sync
                        </button>

                        <span className="ml-2 flex items-center gap-2">
                            <span className={cn("w-2 h-2 rounded-full", connState === 'open' ? 'bg-emerald-400' : connState === 'connecting' ? 'bg-yellow-400' : 'bg-red-400')}></span>
                            <span className="text-xs theme-text-tertiary">{connState === 'open' ? 'Connected' : connState === 'connecting' ? 'Connecting' : 'Disconnected'}</span>
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
                                    className="ml-2 px-2 py-1 rounded-md text-xs theme-overlay-subtle hover:theme-overlay-medium"
                                >
                                    Reconnect
                                </button>
                            )}
                        </span>

                        <select
                            value={refreshInterval}
                            onChange={(e) => setRefreshInterval(Number(e.target.value))}
                            className="bg-transparent text-xs theme-text-tertiary outline-none"
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
                    <Loader2 className="animate-spin theme-text-quaternary" size={32} />
                </div>
            ) : processes.length === 0 ? (
                <div className="text-center py-20 space-y-4">
                    <div className="theme-text-quaternary">
                        <Activity size={64} className="mx-auto mb-4" />
                    </div>
                    <p className="theme-text-tertiary text-sm">No processes registered</p>
                    <button
                        onClick={handleDiscover}
                        className="px-4 py-2 bg-sky-500/10 hover:bg-sky-500/20 rounded-xl text-sm text-sky-400 border border-sky-500/20 transition-all"
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
                            rowComponent={RowRenderer}
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
                            className="w-full max-w-4xl max-h-[80vh] bg-[#0c0c0c] border theme-border-medium rounded-2xl overflow-hidden shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between p-4 border-b theme-border-medium theme-overlay-subtle">
                                <div className="flex items-center gap-2">
                                    <Activity size={16} className="text-sky-400" />
                                    <h2 className="text-sm font-bold theme-text-primary uppercase tracking-wider">Container Logs</h2>
                                </div>
                                <div className="flex items-center gap-2">
                                    {logs && processes.find(p => p.id === logs.id) && (() => {
                                        const p = processes.find(p => p.id === logs.id)!;
                                        const internal = p.metadata?.internalDomain as string | undefined;
                                        const url = p.port ? `http://localhost:${p.port}` : (internal ? `http://${internal}` : undefined);
                                        return url ? (
                                            <button
                                                onClick={() => window.open(url, '_blank')}
                                                className="px-2 py-1 rounded-md text-xs bg-sky-500/10 text-sky-300 border border-sky-500/20 hover:bg-sky-500/20 transition-colors"
                                            >
                                                Open App
                                            </button>
                                        ) : null;
                                    })()}
                                    <button
                                        onClick={() => setIsShowingLogs(false)}
                                        className="p-1 hover:theme-overlay-medium rounded-md theme-text-tertiary hover:theme-text-primary transition-colors"
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

/**
 * Stable Row Renderer for react-window
 */
function RowRenderer({ index, style, rowProps }: any) {
    const process = rowProps?.processes?.[index];
    if (!process) return <div style={style} />;

    return (
        <div style={style}>
            <ProcessRowWrapper
                process={process}
                isActioning={rowProps.actioningId === process.id}
                onStop={rowProps.onStop}
                onStartLocal={rowProps.onStartLocal}
                onStartContainer={rowProps.onStartContainer}
                onRestart={rowProps.onRestart}
                onRebuild={rowProps.onRebuild}
                onFixPort={rowProps.onFixPort}
                onGetLogs={rowProps.onGetLogs}
                onHealthCheck={rowProps.onHealthCheck}
                onDelete={rowProps.onDelete}
            />
        </div>
    );
}

/**
 * Memoized Process Row Component
 */
const ProcessRowWrapper = React.memo(function ProcessRowWrapper({
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
}: any) {
    const isRunning = process.status === 'running' || process.status === 'healthy';
    const isError = process.status === 'error' || process.status === 'unhealthy';

    return (
        <div className="px-0 pb-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={cn(
                    "group relative p-6 rounded-[1.5rem] bg-slate-950/40 border transition-all duration-300 overflow-hidden",
                    isRunning ? "border-emerald-500/20 shadow-[0_0_20px_-10px_rgba(16,185,129,0.2)]" :
                        isError ? "border-red-500/20 shadow-[0_0_20px_-10px_rgba(239,68,68,0.2)]" :
                            "theme-border-subtle"
                )}
            >
                {/* Immersive background glow */}
                <div className={cn(
                    "absolute -top-24 -right-24 w-48 h-48 blur-[80px] opacity-10 transition-opacity duration-1000",
                    isRunning ? "bg-emerald-500" : isError ? "bg-red-500" : "bg-sky-500"
                )} />

                <div className="relative z-10 space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                            <div className="flex items-center flex-wrap gap-2">
                                <h3 className="text-lg font-black theme-text-primary tracking-tight">{process.name}</h3>
                                <div className="flex items-center gap-2">
                                    <span className={cn(
                                        "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border",
                                        process.type === 'docker-app' ? "bg-sky-500/10 text-sky-400 border-sky-500/20" :
                                            process.type === 'dev-server' ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" :
                                                "theme-overlay-subtle theme-text-tertiary theme-border-medium"
                                    )}>
                                        {process.type === 'docker-app' ? 'Container' : process.type === 'dev-server' ? 'Local' : 'External'}
                                    </span>
                                    {process.port && (
                                        <span className="px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-[10px] text-sky-400 font-black font-mono">
                                            :{process.port}
                                        </span>
                                    )}
                                </div>
                                <div className={cn(
                                    "flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest shadow-lg",
                                    getStatusColor(process.status)
                                )}>
                                    <StatusIcon status={process.status} />
                                    <span>{process.status}</span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-0.5">
                                <span className="text-[11px] theme-text-secondary font-mono truncate max-w-xl opacity-60">
                                    {process.path}
                                </span>
                            </div>
                        </div>

                        {/* Control Actions */}
                        <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-2xl border theme-border-subtle backdrop-blur-xl">
                            <button onClick={() => onHealthCheck(process.id)} className="p-2 theme-overlay-subtle hover:theme-overlay-medium rounded-lg theme-text-tertiary hover:theme-text-primary transition-all" title="Check Health"><RefreshCw size={14} /></button>

                            {process.type === 'docker-app' && (
                                <>
                                    <button onClick={() => onRebuild(process.id)} disabled={isActioning} className="p-2 bg-sky-500/5 hover:bg-sky-500/10 rounded-lg text-sky-400 border border-sky-500/10 transition-all disabled:opacity-50" title="Rebuild System"><RefreshCw size={14} /></button>
                                    <button onClick={() => onGetLogs(process.id)} disabled={isActioning} className="p-2 theme-overlay-subtle hover:theme-overlay-medium rounded-lg theme-text-tertiary hover:theme-text-primary transition-all disabled:opacity-50" title="System Logs"><Activity size={14} /></button>
                                </>
                            )}

                            <div className="w-[1px] h-6 theme-overlay-medium mx-1" />

                            <button
                                onClick={() => isRunning ? onStop(process.id) : (process.type === 'dev-server' ? onStartLocal(process.id) : onStartContainer(process.id))}
                                disabled={isActioning}
                                className={cn(
                                    "h-9 px-4 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all min-w-[110px] flex items-center justify-center gap-2",
                                    isRunning ? "text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20" :
                                        "text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/10 shadow-emerald-500/10"
                                )}
                            >
                                {isActioning ? <Loader2 className="animate-spin" size={12} /> : (isRunning ? 'Stop' : 'Start')}
                            </button>

                            <button onClick={() => onDelete(process.id)} disabled={isActioning} className="p-2 theme-overlay-subtle hover:bg-red-500/10 rounded-lg theme-text-quaternary hover:text-red-400 transition-all" title="Purge Record"><Trash2 size={14} /></button>
                        </div>
                    </div>

                    {/* Performance & Status Metrics */}
                    {isRunning && (
                        <div className="flex items-center gap-6 pt-4 border-t theme-border-subtle">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[9px] theme-text-quaternary font-black uppercase tracking-widest">Uptime</span>
                                <div className="flex items-center gap-1.5 text-[11px] theme-text-secondary font-mono font-bold">
                                    <Clock size={10} className="text-emerald-400" />
                                    {formatUptime(process.startedAt)}
                                </div>
                            </div>
                            {process.responseTime !== null && process.responseTime !== undefined && (
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[9px] theme-text-quaternary font-black uppercase tracking-widest">Latency</span>
                                    <div className="flex items-center gap-1.5 text-[11px] theme-text-secondary font-mono font-bold">
                                        <Zap size={10} className="text-amber-400" />
                                        {process.responseTime}ms
                                    </div>
                                </div>
                            )}
                            <div className="flex flex-col gap-0.5 ml-auto items-end">
                                <span className="text-[9px] theme-text-quaternary font-black uppercase tracking-widest">Last Check</span>
                                <div className="flex items-center gap-1.5 text-[10px] theme-text-tertiary font-mono italic">
                                    {process.lastHealthCheck ? new Date(process.lastHealthCheck).toLocaleTimeString() : '...'}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}, (a, b) => {
    const pA = a.process;
    const pB = b.process;
    return pA.id === pB.id && pA.status === pB.status && pA.port === pB.port && pA.responseTime === pB.responseTime && pA.lastHealthCheck === pB.lastHealthCheck && a.isActioning === b.isActioning;
});

// Helper Components
function StatusIcon({ status }: { status: string }) {
    switch (status) {
        case 'running':
        case 'healthy':
            return <CheckCircle2 size={12} />;
        case 'stopped':
            return <Square size={12} />;
        case 'error':
        case 'unhealthy':
            return <AlertCircle size={12} />;
        default:
            return <Clock size={12} />;
    }
}

function getStatusColor(status: string) {
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
}

function formatUptime(startedAt: Date) {
    if (!startedAt) return '...';
    try {
        const now = new Date().getTime();
        const start = new Date(startedAt).getTime();
        const diff = now - start;

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    } catch (e) {
        return '...';
    }
}
