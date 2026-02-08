'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowDownCircle, ArrowUpCircle, Search } from 'lucide-react';

interface LogEntry {
    log: string;
    timestamp: string;
    level: 'info' | 'error';
    container: string;
}

interface ContainerLogsProps {
    containerName: string;
    onClose: () => void;
    autoScroll?: boolean;
}

export default function ContainerLogs({ containerName, onClose, autoScroll = true }: ContainerLogsProps) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState('');
    const [showInfo, setShowInfo] = useState(true);
    const [showError, setShowError] = useState(true);
    const [isPaused, setIsPaused] = useState(false);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const eventSourceRef = useRef<EventSource | null>(null);
    const logsContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Connect to log stream
        const eventSource = new EventSource(`/api/docker/logs-stream?container=${encodeURIComponent(containerName)}`);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
            setIsConnected(true);
            setError(null);
        };

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'connected') {
                    console.log('Connected to log stream for', data.container);
                    return;
                }

                if (data.type === 'error') {
                    setError(data.error);
                    setIsConnected(false);
                    return;
                }

                // Regular log entry
                if (data.log) {
                    setLogs(prev => {
                        const newLogs = [...prev, data as LogEntry];
                        // Keep last 1000 logs to prevent memory issues
                        if (newLogs.length > 1000) {
                            return newLogs.slice(-1000);
                        }
                        return newLogs;
                    });
                }
            } catch (err) {
                console.error('Failed to parse log event:', err);
            }
        };

        eventSource.onerror = (err) => {
            console.error('EventSource error:', err);
            setIsConnected(false);
            setError('Connection lost to log stream');
            eventSource.close();
        };

        return () => {
            eventSource.close();
        };
    }, [containerName]);

    // Auto-scroll to bottom when new logs arrive
    useEffect(() => {
        if (autoScroll && !isPaused && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, autoScroll, isPaused]);

    const filteredLogs = logs.filter(log => {
        // Filter by level
        if (!showInfo && log.level === 'info') return false;
        if (!showError && log.level === 'error') return false;

        // Filter by search term
        if (filter && !log.log.toLowerCase().includes(filter.toLowerCase())) {
            return false;
        }

        return true;
    });

    const handleClearLogs = () => {
        setLogs([]);
    };

    const handleScrollToBottom = () => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleScrollToTop = () => {
        logsContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-gray-900 rounded-lg shadow-2xl w-full max-w-6xl h-[80vh] flex flex-col"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full animate-pulse" style={{
                            backgroundColor: isConnected ? '#10b981' : (error ? '#ef4444' : '#6b7280')
                        }}></div>
                        <h2 className="text-xl font-semibold text-white">Container Logs: {containerName}</h2>
                        <span className="text-sm text-gray-400">
                            {filteredLogs.length} / {logs.length} logs
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2 p-3 border-b border-gray-700 bg-gray-800/50">
                    {/* Search */}
                    <div className="flex-1 relative">
                        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Filter logs..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Level Filters */}
                    <button
                        onClick={() => setShowInfo(!showInfo)}
                        className={`px-3 py-2 rounded-lg transition-colors ${showInfo ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}
                    >
                        Info
                    </button>
                    <button
                        onClick={() => setShowError(!showError)}
                        className={`px-3 py-2 rounded-lg transition-colors ${showError ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-400'}`}
                    >
                        Errors
                    </button>

                    {/* Pause / Resume */}
                    <button
                        onClick={() => setIsPaused(!isPaused)}
                        className={`px-3 py-2 rounded-lg transition-colors ${isPaused ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                    >
                        {isPaused ? 'Paused' : 'Live'}
                    </button>

                    {/* Clear */}
                    <button
                        onClick={handleClearLogs}
                        className="px-3 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                    >
                        Clear
                    </button>

                    {/* Scroll Controls */}
                    <button
                        onClick={handleScrollToTop}
                        className="p-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                        title="Scroll to top"
                    >
                        <ArrowUpCircle className="w-5 h-5" />
                    </button>
                    <button
                        onClick={handleScrollToBottom}
                        className="p-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                        title="Scroll to bottom"
                    >
                        <ArrowDownCircle className="w-5 h-5" />
                    </button>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="px-4 py-2 bg-red-900/50 border-b border-red-800 text-red-200 text-sm">
                        {error}
                    </div>
                )}

                {/* Logs Display */}
                <div
                    ref={logsContainerRef}
                    className="flex-1 overflow-y-auto bg-black font-mono text-sm p-4 space-y-1"
                >
                    {filteredLogs.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">
                            {logs.length === 0 ? 'Waiting for logs...' : 'No logs match your filter'}
                        </div>
                    ) : (
                        filteredLogs.map((log, idx) => (
                            <div key={idx} className="flex gap-3 hover:bg-gray-900/50 px-2 py-1 rounded">
                                <span className="text-gray-500 text-xs whitespace-nowrap">
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                </span>
                                <span
                                    className={`text-xs uppercase whitespace-nowrap ${log.level === 'error' ? 'text-red-400' : 'text-blue-400'}`}
                                >
                                    {log.level}
                                </span>
                                <span className={`flex-1 ${log.level === 'error' ? 'text-red-300' : 'text-green-300'}`}>
                                    {log.log}
                                </span>
                            </div>
                        ))
                    )}
                    <div ref={logsEndRef} />
                </div>

                {/* Footer Stats */}
                <div className="flex items-center justify-between p-3 border-t border-gray-700 bg-gray-800/50 text-sm text-gray-400">
                    <div>
                        {isConnected ? (
                            <span className="text-green-400">● Connected</span>
                        ) : (
                            <span className="text-red-400">● Disconnected</span>
                        )}
                    </div>
                    <div>
                        {isPaused && (
                            <span className="text-yellow-400">Scroll paused (new logs still recording)</span>
                        )}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
