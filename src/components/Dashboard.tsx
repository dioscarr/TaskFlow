
'use client';

import React, { useState } from 'react';
import Layout from '@/components/Layout';
import InboxTable from '@/components/InboxTable';
import FileManager from '@/components/FileManager';
import AlegraProcessor from '@/components/AlegraProcessor';
import { Mail, Folder, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Task, WorkspaceFile, AlegraBill } from '@prisma/client';

import CreateTaskModal from './CreateTaskModal';
import DevTools from './DevTools';

interface DashboardProps {
    tasks: Task[];
    files: WorkspaceFile[];
    alegraBills: (AlegraBill & { file: WorkspaceFile | null })[];
}

export default function Dashboard({ tasks, files, alegraBills }: DashboardProps) {
    const [activeTab, setActiveTab] = useState<'inbox' | 'files' | 'alegra'>('inbox');

    return (
        <Layout>
            <CreateTaskModal />
            {/* Tab Switcher */}
            <div className="flex items-center gap-2 mb-8 p-1 bg-white/5 w-fit rounded-lg border border-white/5">
                <button
                    onClick={() => setActiveTab('inbox')}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                        activeTab === 'inbox' ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white/80"
                    )}
                >
                    <Mail size={16} /> Inbox
                </button>
                <button
                    onClick={() => setActiveTab('files')}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                        activeTab === 'files' ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white/80"
                    )}
                >
                    <Folder size={16} /> Files
                </button>
                <button
                    onClick={() => setActiveTab('alegra')}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all relative",
                        activeTab === 'alegra' ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white/80"
                    )}
                >
                    <DollarSign size={16} />
                    <span>Alegra OCR</span>
                    {alegraBills.some(b => b.status === 'draft') && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-lg shadow-blue-500/50" />
                    )}
                </button>
            </div>

            <div className="mt-4">
                {activeTab === 'inbox' && <InboxTable tasks={tasks} />}
                {activeTab === 'files' && <FileManager files={files} />}
                {activeTab === 'alegra' && <AlegraProcessor bills={alegraBills} />}
            </div>

            <DevTools />
        </Layout>
    );
}
