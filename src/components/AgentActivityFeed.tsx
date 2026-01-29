'use client';

import React, { useEffect, useState } from 'react';
import { Activity, CheckCircle, AlertTriangle, FileText, Sparkles, Tag } from 'lucide-react';
import { getAgentActivity } from '@/app/actions';

interface ActivityItem {
    id: string;
    type: 'info' | 'success' | 'warning' | 'error' | 'planning' | 'delegation' | 'specialist_result';
    title: string;
    message: string;
    toolUsed?: string;
    createdAt: Date;
}

export default function AgentActivityFeed() {
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchActivity = async () => {
        const res = await getAgentActivity({ limit: 20 });
        if (res.success && res.activities) {
            setActivities(res.activities as any);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchActivity();

        // Poll every 10 seconds for new activity
        const interval = setInterval(fetchActivity, 10000);
        return () => clearInterval(interval);
    }, []);

    const getIcon = (type: string, tool: string) => {
        if (tool === 'configure_magic_folder') return <Sparkles size={16} className="text-purple-400" />;
        if (tool === 'set_file_tags') return <Tag size={16} className="text-blue-400" />;
        if (tool === 'synthesize_documents') return <FileText size={16} className="text-green-400" />;

        switch (type) {
            case 'success': return <CheckCircle size={16} className="text-emerald-400" />;
            case 'warning': return <AlertTriangle size={16} className="text-amber-400" />;
            case 'error': return <AlertTriangle size={16} className="text-red-400" />;
            default: return <Activity size={16} className="text-slate-400" />;
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-slate-950/30 backdrop-blur-xl border border-slate-800/50 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-2">
                    <Activity size={18} className="text-indigo-400" />
                    <h3 className="text-sm font-semibold text-white/90">Intelligence Command Center</h3>
                </div>
                <div className="flex items-center gap-2">
                    <div className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 animate-pulse">
                        LIVE
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {loading && activities.length === 0 ? (
                    <div className="text-center py-10 text-white/20 text-xs">Connecting to Agent Neural Log...</div>
                ) : activities.length === 0 ? (
                    <div className="text-center py-10 text-white/20 text-xs">No recent agent activity recorded.</div>
                ) : (
                    activities.map((item) => (
                        <div key={item.id} className="group relative pl-6 border-l border-white/10 pb-2 last:pb-0">
                            {/* Timeline Node */}
                            <div className="absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full bg-slate-900 border border-white/20 group-hover:border-indigo-400 group-hover:bg-indigo-500/20 transition-all"></div>

                            <div className="flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {getIcon(item.type, item.toolUsed || '')}
                                        <span className="text-xs font-medium text-white/80 group-hover:text-white transition-colors">
                                            {item.title}
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-white/30 font-mono">
                                        {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <p className="text-[11px] text-white/50 leading-relaxed group-hover:text-white/60 transition-colors">
                                    {item.message}
                                </p>
                                {item.toolUsed && (
                                    <div className="mt-1 flex gap-1">
                                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-white/5 border border-white/5 text-white/30 font-mono">
                                            {item.toolUsed}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
