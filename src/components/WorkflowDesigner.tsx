'use client';

import React, { useState, useEffect } from 'react';
import { motion, Reorder, AnimatePresence } from 'framer-motion';
import { Plus, GripVertical, Trash2, Settings2, Play, ChevronRight, Zap, MessageSquare, X, List, Edit3, Save } from 'lucide-react';
import { getAllActions, ActionDefinition } from '@/lib/actionRegistry';
import { cn } from '@/lib/utils';
import { WorkflowStep, IntentRuleDefinition, IntentAction, WorkflowDefinition } from '@/lib/intentLibrary';

interface WorkflowDesignerProps {
    workflows: WorkflowDefinition[];
    onChange: (workflows: WorkflowDefinition[]) => void;
    customIntents?: IntentRuleDefinition[];
}

export default function WorkflowDesigner({ 
    workflows = [], 
    onChange, 
    customIntents = []
}: WorkflowDesignerProps) {
    const [availableActions, setAvailableActions] = useState<ActionDefinition[]>([]);
    const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
    const [isAddingStep, setIsAddingStep] = useState(false);
    const [keywordInput, setKeywordInput] = useState('');

    useEffect(() => {
        setAvailableActions(getAllActions(customIntents));
        if (workflows.length > 0 && !activeWorkflowId) {
            setActiveWorkflowId(workflows[0].id);
        }
    }, [customIntents, workflows, activeWorkflowId]);

    const activeWorkflow = workflows.find(w => w.id === activeWorkflowId);

    const addWorkflow = () => {
        const newWorkflow: WorkflowDefinition = {
            id: Math.random().toString(36).substr(2, 9),
            name: `New Workflow ${workflows.length + 1}`,
            triggerKeywords: [],
            steps: []
        };
        onChange([...workflows, newWorkflow]);
        setActiveWorkflowId(newWorkflow.id);
    };

    const updateActiveWorkflow = (updates: Partial<WorkflowDefinition>) => {
        if (!activeWorkflowId) return;
        onChange(workflows.map(w => w.id === activeWorkflowId ? { ...w, ...updates } : w));
    };

    const deleteWorkflow = (id: string) => {
        const newWorkflows = workflows.filter(w => w.id !== id);
        onChange(newWorkflows);
        if (activeWorkflowId === id) {
            setActiveWorkflowId(newWorkflows.length > 0 ? newWorkflows[0].id : null);
        }
    };

    const handleAddKeyword = (e: React.KeyboardEvent) => {
        if (!activeWorkflow) return;
        if (e.key === 'Enter' && keywordInput.trim()) {
            e.preventDefault();
            const kw = keywordInput.trim().toLowerCase();
            if (!activeWorkflow.triggerKeywords.includes(kw)) {
                updateActiveWorkflow({ triggerKeywords: [...activeWorkflow.triggerKeywords, kw] });
            }
            setKeywordInput('');
        }
    };

    const removeKeyword = (kw: string) => {
        if (!activeWorkflow) return;
        updateActiveWorkflow({ triggerKeywords: activeWorkflow.triggerKeywords.filter(k => k !== kw) });
    };

    const addStep = (action: ActionDefinition) => {
        if (!activeWorkflow) return;
        const newStep: WorkflowStep = {
            id: Math.random().toString(36).substr(2, 9),
            action: action.id,
            params: {}
        };
        updateActiveWorkflow({ steps: [...activeWorkflow.steps, newStep] });
        setIsAddingStep(false);
    };

    const removeStep = (stepId: string) => {
        if (!activeWorkflow) return;
        updateActiveWorkflow({ steps: activeWorkflow.steps.filter(s => s.id !== stepId) });
    };

    const getActionInfo = (id: string) => {
        return availableActions.find(a => a.id === id) || { 
            name: id, 
            description: 'Unknown Action', 
            type: 'tool' 
        };
    };

    return (
        <div className="flex gap-6 h-full min-h-[500px]">
            {/* Sidebar List */}
            <div className="w-1/4 flex flex-col gap-2 border-r border-white/10 pr-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40">Workflows</h3>
                    <button 
                        onClick={addWorkflow}
                        className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-all"
                    >
                        <Plus size={14} />
                    </button>
                </div>
                
                <div className="flex flex-col gap-1 overflow-y-auto max-h-[600px] pr-2">
                    {workflows.map(w => (
                        <div key={w.id} className="relative group">
                            <button
                                onClick={() => setActiveWorkflowId(w.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 p-3 rounded-2xl border transition-all text-left",
                                    activeWorkflowId === w.id 
                                        ? "bg-blue-600/10 border-blue-500/30 text-blue-400"
                                        : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:border-white/10"
                                )}
                            >
                                <List size={14} className={activeWorkflowId === w.id ? "text-blue-500" : "text-white/20"} />
                                <span className="text-xs font-bold truncate pr-6">{w.name}</span>
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); deleteWorkflow(w.id); }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-white/0 group-hover:text-red-400/50 hover:text-red-500 transition-all"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}
                    {workflows.length === 0 && (
                        <div className="text-[10px] text-white/20 text-center py-8">No workflows defined</div>
                    )}
                </div>
            </div>

            {/* Main Editor */}
            <div className="flex-1 overflow-y-auto max-h-[700px] pr-2 custom-scrollbar">
                {activeWorkflow ? (
                    <div className="space-y-6">
                        {/* Header/Name */}
                        <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-400 mb-1 ml-1 group-focus-within:text-blue-400 transition-colors">Workflow Identity</label>
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                                            <Edit3 size={16} />
                                        </div>
                                        <input
                                            value={activeWorkflow.name}
                                            onChange={e => updateActiveWorkflow({ name: e.target.value })}
                                            className="bg-white/5 border border-white/10 focus:border-blue-500/50 focus:bg-white/10 px-4 py-2 rounded-xl text-lg font-bold text-white outline-none transition-all flex-1"
                                            placeholder="Name your automation flow (e.g. Dominican Receipt Sync)..."
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <MessageSquare size={14} className="text-blue-400" />
                                            <h3 className="text-[10px] font-black uppercase tracking-widest text-white/60">Execution Triggers</h3>
                                        </div>
                                        <span className="text-[8px] text-white/30 uppercase font-bold">Press Enter or click Add</span>
                                    </div>
                                    <div className="bg-black/20 border border-white/5 rounded-2xl p-3">
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {activeWorkflow.triggerKeywords.length > 0 ? (
                                                activeWorkflow.triggerKeywords.map(kw => (
                                                    <span key={kw} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl text-[10px] font-bold transition-all group">
                                                        {kw}
                                                        <button onClick={() => removeKeyword(kw)} className="hover:text-white transition-colors">
                                                            <X size={10} />
                                                        </button>
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-[10px] text-white/20 italic px-2">No keywords defined yet...</span>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                value={keywordInput}
                                                onChange={e => setKeywordInput(e.target.value)}
                                                onKeyDown={handleAddKeyword}
                                                placeholder="e.g. sync, process, verify..."
                                                className="bg-white/5 border border-white/5 hover:border-white/10 focus:border-blue-500/50 px-4 py-2 rounded-xl text-xs text-white placeholder:text-white/10 outline-none transition-all flex-1"
                                            />
                                            <button 
                                                onClick={() => {
                                                    if (keywordInput.trim()) {
                                                        const kw = keywordInput.trim().toLowerCase();
                                                        if (!activeWorkflow.triggerKeywords.includes(kw)) {
                                                            updateActiveWorkflow({ triggerKeywords: [...activeWorkflow.triggerKeywords, kw] });
                                                        }
                                                        setKeywordInput('');
                                                    }
                                                }}
                                                className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/20 rounded-xl text-[10px] font-black uppercase transition-all"
                                            >
                                                Add Keyword
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Steps */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Zap size={16} className="text-yellow-400" />
                                    <h3 className="text-sm font-bold text-white uppercase tracking-widest">Execution Sequence</h3>
                                </div>
                                <button
                                    onClick={() => setIsAddingStep(true)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/20 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    <Plus size={14} />
                                    Add Step
                                </button>
                            </div>

                            <Reorder.Group 
                                axis="y" 
                                values={activeWorkflow.steps} 
                                onReorder={(newSteps) => updateActiveWorkflow({ steps: newSteps })} 
                                className="space-y-3"
                            >
                                {activeWorkflow.steps.map((step, index) => {
                                    const info = getActionInfo(step.action);
                                    return (
                                        <Reorder.Item
                                            key={step.id}
                                            value={step}
                                            className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 group hover:border-white/20 transition-all"
                                        >
                                            <div className="cursor-grab active:cursor-grabbing text-white/20 group-hover:text-white/40">
                                                <GripVertical size={20} />
                                            </div>
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-black text-white/40">
                                                {index + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className={cn(
                                                        "text-[8px] font-black uppercase px-1.5 py-0.5 rounded",
                                                        info.type === 'tool' ? "bg-purple-500/20 text-purple-400" : "bg-blue-500/20 text-blue-400"
                                                    )}>
                                                        {info.type}
                                                    </span>
                                                    <h4 className="text-sm font-bold text-white truncate">{info.name}</h4>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => removeStep(step.id)}
                                                className="p-2 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </Reorder.Item>
                                    );
                                })}

                                {activeWorkflow.steps.length === 0 && !isAddingStep && (
                                    <div className="py-12 border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center text-white/10">
                                        <Play size={32} className="mb-4 opacity-20" />
                                        <p className="text-xs font-bold">No steps in this flow</p>
                                    </div>
                                )}
                            </Reorder.Group>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-white/10 py-20 bg-white/[0.02] border border-dashed border-white/5 rounded-3xl">
                        <Edit3 size={48} className="mb-4 opacity-20" />
                        <h4 className="text-sm font-bold uppercase tracking-widest mb-2">Workspace Empty</h4>
                        <p className="text-[10px]">Select or create a workflow to begin configuring.</p>
                        <button onClick={addWorkflow} className="mt-6 flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl text-xs font-bold hover:bg-blue-500/20 transition-all">
                            <Plus size={16} />
                            Create First Flow
                        </button>
                    </div>
                )}
            </div>

            {/* Selection Modal */}
            <AnimatePresence>
                {isAddingStep && (
                    <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-zinc-900 border border-white/10 rounded-3xl p-8 shadow-2xl w-full max-w-2xl"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-white/40">Select Process or Tool</h4>
                                <button onClick={() => setIsAddingStep(false)} className="text-white/20 hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {availableActions.map(action => (
                                    <button
                                        key={action.id}
                                        onClick={() => addStep(action)}
                                        className="flex flex-col items-start p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-yellow-500/30 transition-all text-left group"
                                    >
                                        <div className="flex items-center justify-between w-full mb-1">
                                            <span className={cn(
                                                "text-[8px] font-black uppercase px-1.5 py-0.5 rounded",
                                                action.type === 'tool' ? "bg-purple-500/20 text-purple-400" : "bg-blue-500/20 text-blue-400"
                                            )}>
                                                {action.type}
                                            </span>
                                            <ChevronRight size={14} className="text-white/0 group-hover:text-yellow-500 transition-all outline-none" />
                                        </div>
                                        <div className="text-xs font-bold text-white mb-1">{action.name}</div>
                                        <div className="text-[10px] text-white/30 truncate w-full">{action.description}</div>
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

