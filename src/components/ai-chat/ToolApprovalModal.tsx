/**
 * Tool Approval Modal - P1-APPROVAL-UX
 * Shows proposed tools with risk levels and approval actions
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Shield, ShieldCheck, X } from 'lucide-react';
import { getToolRisk } from '@/lib/toolLibrary';

export interface ToolApprovalModalProps {
    isOpen: boolean;
    proposedTools: string[];
    highRiskTools?: string[];
    onApprove: (mode: 'once' | 'session') => void;
    onDeny: () => void;
}

const RISK_COLORS = {
    high: {
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
        text: 'text-red-400',
        icon: AlertTriangle,
    },
    medium: {
        bg: 'bg-yellow-500/10',
        border: 'border-yellow-500/30',
        text: 'text-yellow-400',
        icon: Shield,
    },
    low: {
        bg: 'bg-green-500/10',
        border: 'border-green-500/30',
        text: 'text-green-400',
        icon: ShieldCheck,
    },
};

export default function ToolApprovalModal({
    isOpen,
    proposedTools,
    highRiskTools = [],
    onApprove,
    onDeny,
}: ToolApprovalModalProps) {
    if (!isOpen) return null;

    const hasHighRisk = highRiskTools.length > 0;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={onDeny}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-lg bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="relative px-6 py-5 border-b border-slate-700/50">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${hasHighRisk ? 'bg-red-500/20' : 'bg-blue-500/20'}`}>
                                        <AlertTriangle className={`w-5 h-5 ${hasHighRisk ? 'text-red-400' : 'text-blue-400'}`} />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold text-white">
                                            Tool Approval Required
                                        </h2>
                                        <p className="text-sm text-slate-400">
                                            {hasHighRisk ? 'High-risk tools detected' : 'Review proposed tools'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={onDeny}
                                    className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5 text-slate-400" />
                                </button>
                            </div>
                        </div>

                        {/* Tool List */}
                        <div className="px-6 py-4 max-h-96 overflow-y-auto">
                            <div className="space-y-2">
                                {proposedTools.map((toolName, index) => {
                                    const risk = getToolRisk(toolName);
                                    const riskConfig = RISK_COLORS[risk];
                                    const RiskIcon = riskConfig.icon;

                                    return (
                                        <motion.div
                                            key={toolName}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            className={`flex items-center gap-3 p-3 rounded-lg border ${riskConfig.bg} ${riskConfig.border}`}
                                        >
                                            <RiskIcon className={`w-4 h-4 ${riskConfig.text} flex-shrink-0`} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-white truncate">
                                                    {toolName}
                                                </p>
                                                <p className={`text-xs ${riskConfig.text} capitalize`}>
                                                    {risk} risk
                                                </p>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>

                            {/* Warning for high-risk tools */}
                            {hasHighRisk && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: proposedTools.length * 0.05 + 0.1 }}
                                    className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg"
                                >
                                    <div className="flex gap-3">
                                        <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-medium text-red-400">
                                                High-Risk Tools Detected
                                            </p>
                                            <p className="text-xs text-red-300/80 mt-1">
                                                These tools can modify system state, delete files, or execute commands.
                                                Please review carefully before approving.
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="px-6 py-4 border-t border-slate-700/50 bg-slate-900/50">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={onDeny}
                                    className="flex-1 px-4 py-2.5 bg-slate-700/50 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium text-sm"
                                >
                                    Deny
                                </button>
                                <button
                                    onClick={() => onApprove('once')}
                                    className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium text-sm"
                                >
                                    Allow Once
                                </button>
                                <button
                                    onClick={() => onApprove('session')}
                                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-colors font-medium text-sm"
                                >
                                    Always Allow
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 mt-2 text-center">
                                &quot;Always Allow&quot; will enable tools for this session only
                            </p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
