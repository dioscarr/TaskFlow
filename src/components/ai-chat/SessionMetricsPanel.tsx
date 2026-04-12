
import React, { useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ScrollArea } from "@/components/ui/scroll-area";

interface ToolMetric {
    count: number;
    errors: number;
    totalLatencyMs: number;
}

interface SessionMetrics {
    sessionId: string;
    totalTurns: number;
    toolUsage: Record<string, ToolMetric>;
    errors: string[];
    aggregates: {
        totalLatency: number;
        totalToolCalls: number;
        totalErrors: number;
    };
    lastActive: number;
}

interface SessionMetricsPanelProps {
    sessionId: string | null;
    isOpen: boolean;
    onClose: () => void;
}

export default function SessionMetricsPanel({ sessionId, isOpen, onClose }: SessionMetricsPanelProps) {
    const [metrics, setMetrics] = useState<SessionMetrics | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!sessionId || !isOpen) return;

        const fetchMetrics = async () => {
            try {
                const res = await fetch(`/api/metrics/session/${sessionId}`);
                if (res.ok) {
                    const data = await res.json();
                    setMetrics(data);
                }
            } catch (e) {
                console.error("Failed to fetch session metrics", e);
            }
        };

        fetchMetrics();
        const interval = setInterval(fetchMetrics, 3000);

        return () => clearInterval(interval);
    }, [sessionId, isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="absolute top-16 right-4 z-50 w-80 bg-background/95 backdrop-blur border border-border rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[calc(100vh-100px)]"
                >
                    <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
                        <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-primary" />
                            <h3 className="text-sm font-medium">Session Metrics</h3>
                        </div>
                        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <ScrollArea className="flex-1 p-4">
                        {!metrics ? (
                            <div className="text-sm text-muted-foreground text-center py-4">Loading metrics...</div>
                        ) : (
                            <div className="space-y-6">
                                {/* Overview Stats */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-card p-2 rounded border border-border">
                                        <div className="text-xs text-muted-foreground mb-1">Total Turns</div>
                                        <div className="text-lg font-bold">{metrics.totalTurns}</div>
                                    </div>
                                    <div className="bg-card p-2 rounded border border-border">
                                        <div className="text-xs text-muted-foreground mb-1">Tool Calls</div>
                                        <div className="text-lg font-bold">{metrics.aggregates?.totalToolCalls || 0}</div>
                                    </div>
                                    <div className="bg-card p-2 rounded border border-border">
                                        <div className="text-xs text-muted-foreground mb-1">Errors</div>
                                        <div className={cn("text-lg font-bold", metrics.aggregates?.totalErrors > 0 ? "text-red-500" : "text-green-500")}>
                                            {metrics.aggregates?.totalErrors || 0}
                                        </div>
                                    </div>
                                    <div className="bg-card p-2 rounded border border-border">
                                        <div className="text-xs text-muted-foreground mb-1">Avg Latency</div>
                                        <div className="text-lg font-bold">
                                            {metrics.aggregates.totalToolCalls > 0
                                                ? Math.round(metrics.aggregates.totalLatency / metrics.aggregates.totalToolCalls)
                                                : 0}ms
                                        </div>
                                    </div>
                                </div>

                                {/* Tool Usage Breakdown */}
                                <div>
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Tool Usage</h4>
                                    <div className="space-y-2">
                                        {Object.entries(metrics.toolUsage || {}).length === 0 ? (
                                            <div className="text-xs text-muted-foreground italic">No tools used yet</div>
                                        ) : (
                                            Object.entries(metrics.toolUsage).sort(([, a], [, b]) => b.count - a.count).map(([name, data]) => (
                                                <div key={name} className="flex flex-col text-sm border border-border rounded p-2 bg-card/50">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="font-mono text-xs truncate max-w-[150px]" title={name}>{name}</span>
                                                        <span className="font-medium">{data.count} calls</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                                                        <span className="flex items-center gap-1">
                                                            {data.errors > 0 ? (
                                                                <span className="text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {data.errors} err</span>
                                                            ) : (
                                                                <span className="text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> 100%</span>
                                                            )}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {Math.round(data.totalLatencyMs / data.count)}ms avg
                                                        </span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Recent Errors */}
                                {metrics.errors && metrics.errors.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-2">Recent Errors</h4>
                                        <div className="space-y-1">
                                            {metrics.errors.slice(-3).reverse().map((err, i) => (
                                                <div key={i} className="text-xs bg-red-500/10 border border-red-500/20 text-red-200 p-2 rounded font-mono break-all">
                                                    {err.split(': ').slice(1).join(': ') || err}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </ScrollArea>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
