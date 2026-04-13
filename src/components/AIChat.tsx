'use client';

import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { useChatState, aiChatStateCache, ChatMessage, PromptDraft } from '@/hooks/useChatState';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Bot, Command, Copy, CornerDownLeft, Eye, File, FileText, Image, Layout, Layers, Loader2, MessageSquare, MoreHorizontal, Paperclip, Play, Plus, RefreshCw, Send, Settings, Sparkles, Terminal, Trash2, X, CheckCircle2, ChevronDown, List, FolderOpen, Folder, FileJson, Square, BrainCircuit, Image as ImageIcon, ExternalLink, Check, ChevronRight, Edit2, Pin, PinOff, Search, Receipt, DollarSign, Save, AlignLeft, Lightbulb, Compass, Activity, Zap, ArrowDown, AlertTriangle, Globe, Monitor, GitBranch, Split } from 'lucide-react';
import { chatWithAI, chatWithAIStream, getPrompts, createPrompt, updatePrompt, setActivePrompt, deletePrompt, generateSystemPrompt, getIntentRules, getWorkspaceFiles, getChatSessionAgentStatus, cancelAllAgentJobs, uploadFile } from '@/app/actions';
import { createChatSession, getChatSessions, getChatSession, addChatMessage, updateChatSessionTitle, deleteChatSession, deleteAllChatSessions } from '@/app/chatActions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TOOL_LIBRARY } from '@/lib/toolLibrary';
import { DEFAULT_SKILLS, SKILLS_LIBRARY } from '@/lib/skillsLibrary';
import { DEFAULT_CHAT_MODEL, MODEL_CATALOG } from '@/lib/modelCatalog';
import type { WorkspaceFile, AIPromptSet, IntentRule } from '@prisma/client';
import { IntentRuleDefinition, WorkflowDefinition } from '@/lib/intentLibrary';
import PromptEditorModal from './PromptEditorModal';
import QuestionWizard from './QuestionWizard';
import SuggestionsLibraryModal from './SuggestionsLibraryModal';
import ConfirmationModal from './ConfirmationModal';
import { normalizeMarkdown, hasMarkdownTable } from '@/utils/markdownUtils';
import FileEditPreviewModal from './FileEditPreviewModal';
import SessionMetricsPanel from './ai-chat/SessionMetricsPanel';
import EmojiCelebration from './EmojiCelebration';
import { readStreamableValue } from 'ai/rsc';
import MessageBubble from './ai-chat/MessageBubble';
import ToolTimeline, { ToolStatusEvent } from './ai-chat/ToolTimeline';
import ToolApprovalModal from './ai-chat/ToolApprovalModal';
import { SelectedFile } from './ai-chat/types';
import TruncationReport from './ai-chat/TruncationReport';
import { TruncationReport as TruncationReportType } from '@/lib/contextBudget';

type ToolMeta = {
    toolUsed?: string;
    toolResult?: unknown;
    thinking?: string;
    toolArgs?: unknown;
    truncationReport?: TruncationReportType;
    appliedContext?: {
        agent?: { id?: string; name?: string; description?: string };
        scope?: { mode?: string; label?: string };
        workflows?: Array<{ name?: string; stepCount?: number }>;
    };
};

// ChatMessage type moved to useChatState hook

type ChatSessionSummary = {
    id: string;
    title?: string | null;
    messages?: Array<{ content?: string | null }>;
    _count?: { messages?: number };
};

type AgentActivity = { title?: string; message?: string };

type AgentStatusResponse = {
    success: boolean;
    busy?: boolean;
    latestJob?: { id?: string; type?: string; error?: string; status?: string; updatedAt?: string };
    latestActivity?: AgentActivity;
};


type ChatResponse = {
    success?: boolean;
    message?: string;
    error?: string;
    reason?: string;
    text?: string;
    content?: string;
    toolUsed?: string;
    toolResult?: unknown;
    thinking?: string;
    toolArgs?: unknown;
    truncationReport?: TruncationReportType;
    appliedContext?: {
        agent?: { id?: string; name?: string; description?: string };
        scope?: { mode?: string; label?: string };
        workflows?: Array<{ name?: string; stepCount?: number }>;
    };
};

type TranscriptMessage = {
    role?: string;
    content?: string;
    files?: Array<{ id: string; name?: string }>;
    fileIds?: string[];
    toolUsed?: string;
    toolArgs?: unknown;
    thinking?: string;
};

// PromptDraft type moved to useChatState hook

type Suggestion = {
    title: string;
    agentInstructions: string;
};

const toRecord = (value: unknown): Record<string, unknown> => (
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
);

const getMessageMeta = (value: unknown): { thinking?: string; toolResult?: unknown; toolArgs?: unknown } => {
    const record = toRecord(value);
    return {
        thinking: typeof record.thinking === 'string' ? record.thinking : undefined,
        toolResult: record.toolResult,
        toolArgs: record.toolArgs
    };
};

const normalizeChatResponse = (value: unknown): ChatResponse & { success: boolean; message?: string } => {
    if (!value || typeof value !== 'object') {
        return { success: false, message: 'AI returned an empty response.' };
    }
    const record = value as ChatResponse;
    const text = typeof record.text === 'string'
        ? record.text
        : typeof record.content === 'string'
            ? record.content
            : undefined;
    const hasVisibleOutput = Boolean(
        (typeof text === 'string' && text.trim().length > 0)
        || (typeof record.thinking === 'string' && record.thinking.trim().length > 0)
        || typeof record.toolUsed === 'string'
        || typeof record.toolResult !== 'undefined'
    );
    const success = typeof record.success === 'boolean' ? record.success : hasVisibleOutput;
    const message = typeof record.message === 'string' && record.message.trim().length > 0
        ? record.message
        : typeof record.error === 'string' && record.error.trim().length > 0
            ? record.error
            : typeof record.reason === 'string' && record.reason.trim().length > 0
                ? record.reason
                : success
                    ? undefined
                    : 'AI returned an empty response.';
    return { ...record, text, success, message };
};

// aiChatStateCache moved to useChatState hook

const extractThinkingFromText = (text: string) => {
    if (!text) return { cleanText: text, thinking: undefined as string | undefined };

    const xmlRegex = /<thinking>([\s\S]*?)<\/thinking>/gi;
    const mdRegex = /```thinking\s*([\s\S]*?)```/gi;
    const thoughts: string[] = [];

    let match: RegExpExecArray | null = null;
    while ((match = xmlRegex.exec(text)) !== null) {
        const content = match[1]?.trim();
        if (content) thoughts.push(content);
    }

    while ((match = mdRegex.exec(text)) !== null) {
        const content = match[1]?.trim();
        if (content) thoughts.push(content);
    }

    const cleanText = text.replace(xmlRegex, '').replace(mdRegex, '').trim();
    const thinking = thoughts.length ? thoughts.join('\n\n') : undefined;

    return { cleanText, thinking };
};

const createThinkingStreamParser = () => {
    let buffer = '';
    let display = '';
    let thinking = '';
    let mode: 'xml' | 'md' | null = null;

    const consume = (chunk: string) => {
        buffer += chunk;

        while (buffer.length > 0) {
            if (!mode) {
                const xmlIndex = buffer.indexOf('<thinking>');
                const mdIndex = buffer.indexOf('```thinking');
                const nextIsXml = xmlIndex !== -1 && (mdIndex === -1 || xmlIndex < mdIndex);
                const nextIsMd = mdIndex !== -1 && (xmlIndex === -1 || mdIndex < xmlIndex);

                if (!nextIsXml && !nextIsMd) {
                    display += buffer;
                    buffer = '';
                    break;
                }

                const nextIndex = nextIsXml ? xmlIndex : mdIndex;
                const startToken = nextIsXml ? '<thinking>' : '```thinking';

                if (nextIndex > 0) {
                    display += buffer.slice(0, nextIndex);
                }

                buffer = buffer.slice(nextIndex + startToken.length);
                if (!nextIsXml && buffer.startsWith('\n')) {
                    buffer = buffer.slice(1);
                }
                mode = nextIsXml ? 'xml' : 'md';
                continue;
            }

            const endToken = mode === 'xml' ? '</thinking>' : '```';
            const endIndex = buffer.indexOf(endToken);

            if (endIndex === -1) {
                thinking += buffer;
                buffer = '';
                break;
            }

            thinking += buffer.slice(0, endIndex);
            buffer = buffer.slice(endIndex + endToken.length);
            if (mode === 'md' && buffer.startsWith('\n')) {
                buffer = buffer.slice(1);
            }
            mode = null;
        }

        return { display, thinking };
    };

    return {
        consume,
        getState: () => ({ display, thinking })
    };
};

export default function AIChat({
    embedded = false,
    activeFile = null,
    activeApp = null,
    headerRight
}: {
    embedded?: boolean;
    activeFile?: WorkspaceFile | null,
    activeApp?: { name: string, path: string } | null,
    headerRight?: React.ReactNode
}) {
    const contentWidthClass = embedded ? "max-w-3xl mx-auto w-full min-w-0" : "max-w-4xl mx-auto w-full min-w-0";
    const {
        state, dispatch,
        setIsOpen, setView, setIsPinned, setShowScrollButton, setIsUserScrolling,
        setShouldAutoScroll, setIsDragging,
        setInput, setMessages, setIsLoading, setStreamingStatus, setStreamProgress,
        setAiActivity, setSelectedModel, setChatScope, setHistoryIndex, setPromptHistory,
        prependPromptHistory, setActiveTool, setVerbosity, setManualStop,
        setActiveSessionId, setActiveSessionTitle, setChatSessions, setRenamingSessionId,
        setRenamingSessionTitle, setIsDeleteModalOpen, setPendingDeleteSessionId,
        setIsDeletingSession, setIsClearAllModalOpen, setIsClearingAll,
        setAttachedFiles, setWorkspaceFiles, setCurrentFolderContext,
        setActivePreviewContext, setActiveAppContext, setIsUploadingFiles,
        setIsBackgroundBusy, setBackgroundJobLabel, setBackgroundJobMessage,
        setJobStartTime, setElapsedTime, setIsSwitchingAgent, setToolStatusEvents,
        appendToolStatusEvent, setTruncationReport,
        setIsEditorOpen, setIsSettingsModalOpen, setIsEditPreviewOpen,
        setEditPreviewData, setIsSuggestionsOpen, setIsCommandMenuOpen,
        setIsApprovalModalOpen, setIsMetricsPanelOpen, toggleIsMetricsPanelOpen,
        setPrompts, setIntentRules, setIsCreatingPrompt, setEditingPromptId,
        setIsGenerating, setNewPrompt,
        setIsCopyingCurrentChat, setIsCopyingAllChats,
        setActiveCommandIndex,
        setShowThinkingTrace, toggleShowThinkingTrace, setAllowToolExecution,
        toggleAllowToolExecution, setAllowHighRiskExecution, setAllowHighRiskOnce,
        setAutoOpenPreview,
        setCelebration, setDismissedQuestionId, setProposedTools, setHighRiskTools,
        setPendingApprovalRequest,
    } = useChatState(embedded);

    // Destructure frequently-used state for readability
    const { messages, input, isLoading } = state.chat;
    const { attachedFiles, workspaceFiles, currentFolderContext, activePreviewContext, activeAppContext, isUploadingFiles } = state.files;
    const { activeSessionId, activeSessionTitle, chatSessions, renamingSessionId, renamingSessionTitle, isDeleteModalOpen, pendingDeleteSessionId, isDeletingSession, isClearAllModalOpen, isClearingAll } = state.session;
    const { isBackgroundBusy, backgroundJobLabel, backgroundJobMessage, elapsedTime, jobStartTime, isSwitchingAgent, toolStatusEvents, truncationReport } = state.streaming;
    const { isOpen, view, isPinned, isDragging, showScrollButton, shouldAutoScroll, isUserScrolling } = state.ui;
    const { chatScope, selectedModel, activeTool, historyIndex, promptHistory, verbosity, streamingStatus, streamProgress, manualStop, aiActivity } = state.chat;
    const { prompts, intentRules, editingPromptId, newPrompt, isCreatingPrompt, isGenerating } = state.prompts;
    const { isEditorOpen, isSettingsModalOpen, isEditPreviewOpen, editPreviewData, isSuggestionsOpen, isCommandMenuOpen, isApprovalModalOpen, isMetricsPanelOpen } = state.modals;
    const { isCopyingCurrentChat, isCopyingAllChats } = state.copy;
    const { activeCommandIndex } = state.commands;
    const { showThinkingTrace, allowToolExecution, allowHighRiskExecution, allowHighRiskOnce, autoOpenPreview } = state.settings;
    const { celebration, dismissedQuestionId, proposedTools, highRiskTools, pendingApprovalRequest } = state.misc;
    const streamSpeedRef = useRef(14);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Sync Props to State
    useEffect(() => {
        if (activeApp) {
            setActiveAppContext(activeApp);
            aiChatStateCache.activeAppContext = activeApp;
            setChatScope('repo');
        }
    }, [activeApp]);

    useEffect(() => {
        if (activeFile) {
            const context = {
                id: activeFile.id,
                name: activeFile.name,
                parentId: activeFile.parentId || null
            };
            setActivePreviewContext(context);
            aiChatStateCache.activePreviewContext = context;
        }
    }, [activeFile]);

    // Calculate active wizard state
    const activeQuestions = useMemo(() => {
        // Find the most recent message from AI
        const lastAiMessage = [...messages].reverse().find(m => m.role === 'ai');

        // Check if it used 'ask_questions'
        if (lastAiMessage && lastAiMessage.toolUsed === 'ask_questions' && lastAiMessage.toolResult) {
            // Check if user has already replied AFTER this message
            const aiMsgIndex = messages.findIndex(m => m.id === lastAiMessage.id);
            const subsequentUserMsg = messages.slice(aiMsgIndex + 1).find(m => m.role === 'user');

            if (!subsequentUserMsg && lastAiMessage.id !== dismissedQuestionId) {
                const toolResultRecord = toRecord(lastAiMessage.toolResult);
                return (Array.isArray(toolResultRecord.questions) ? toolResultRecord.questions : []) as string[];
            }
        }
        return [];
    }, [messages, dismissedQuestionId]);

    const handleQuestionSubmit = async (answers: string[]) => {
        // Format the answers into a single message
        const responseText = `Here are the answers to your questions:\n\n${answers.map((ans, i) => `${i + 1}. ${ans}`).join('\n')}`;
        await sendMessage(responseText);
    };

    // Force open if embedded
    useEffect(() => {
        if (embedded) setIsOpen(true);
    }, [embedded]);

    useEffect(() => {
        aiChatStateCache.messages = messages;
    }, [messages]);

    useEffect(() => {
        aiChatStateCache.attachedFiles = attachedFiles;
    }, [attachedFiles]);

    useEffect(() => {
        aiChatStateCache.activeSessionId = activeSessionId;
    }, [activeSessionId]);

    useEffect(() => {
        aiChatStateCache.activeSessionTitle = activeSessionTitle;
    }, [activeSessionTitle]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const raw = window.localStorage.getItem('aiChatSessionToolPolicy');
            const highRiskRaw = window.localStorage.getItem('aiChatSessionHighRiskPolicy');

            if (raw) {
                const parsed = JSON.parse(raw) as Record<string, boolean>;
                if (parsed && typeof parsed === 'object') {
                    aiChatStateCache.allowToolExecutionBySession = parsed;
                }
            }

            if (highRiskRaw) {
                const parsedHighRisk = JSON.parse(highRiskRaw) as Record<string, boolean>;
                if (parsedHighRisk && typeof parsedHighRisk === 'object') {
                    aiChatStateCache.allowHighRiskExecutionBySession = parsedHighRisk;
                }
            }

            if (activeSessionId) {
                const savedTool = aiChatStateCache.allowToolExecutionBySession[activeSessionId];
                const savedHighRisk = aiChatStateCache.allowHighRiskExecutionBySession[activeSessionId];
                if (typeof savedTool === 'boolean') setAllowToolExecution(savedTool);
                if (typeof savedHighRisk === 'boolean') setAllowHighRiskExecution(savedHighRisk);
            }
        } catch (error) {
            console.warn('Failed to load tool execution settings:', error);
        }
    }, []);

    useEffect(() => {
        aiChatStateCache.currentFolderContext = currentFolderContext;
    }, [currentFolderContext]);

    useEffect(() => {
        aiChatStateCache.activePreviewContext = activePreviewContext;
    }, [activePreviewContext]);

    useEffect(() => {
        aiChatStateCache.activeAppContext = activeAppContext;
    }, [activeAppContext]);

    useEffect(() => {
        aiChatStateCache.selectedModel = selectedModel;
    }, [selectedModel]);

    useEffect(() => {
        if (!activeSessionId) return;
        const savedScope = aiChatStateCache.scopeBySession[activeSessionId];
        if (savedScope && savedScope !== chatScope) {
            setChatScope(savedScope);
        }
    }, [activeSessionId, chatScope]);

    useEffect(() => {
        aiChatStateCache.activeScope = chatScope;
        if (activeSessionId) {
            aiChatStateCache.scopeBySession[activeSessionId] = chatScope;
        }
    }, [chatScope, activeSessionId]);

    useEffect(() => {
        if (!activeSessionId) return;
        const saved = aiChatStateCache.allowToolExecutionBySession[activeSessionId];
        if (typeof saved === 'boolean') {
            setAllowToolExecution(saved);
        }
    }, [activeSessionId]);

    useEffect(() => {
        if (!activeSessionId) return;
        const saved = aiChatStateCache.allowHighRiskExecutionBySession[activeSessionId];
        if (typeof saved === 'boolean') {
            setAllowHighRiskExecution(saved);
        }
    }, [activeSessionId]);

    useEffect(() => {
        aiChatStateCache.allowToolExecution = allowToolExecution;
        if (!activeSessionId) return;
        aiChatStateCache.allowToolExecutionBySession[activeSessionId] = allowToolExecution;
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(
                'aiChatSessionToolPolicy',
                JSON.stringify(aiChatStateCache.allowToolExecutionBySession)
            );
        }
    }, [allowToolExecution, activeSessionId]);

    useEffect(() => {
        aiChatStateCache.allowHighRiskExecution = allowHighRiskExecution;
        if (!activeSessionId) return;
        aiChatStateCache.allowHighRiskExecutionBySession[activeSessionId] = allowHighRiskExecution;
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(
                'aiChatSessionHighRiskPolicy',
                JSON.stringify(aiChatStateCache.allowHighRiskExecutionBySession)
            );
        }
    }, [allowHighRiskExecution, activeSessionId]);

    // Listen for preview changes
    useEffect(() => {
        const handlePreviewChange = (event: Event) => {
            const file = (event as CustomEvent<WorkspaceFile | null>).detail;
            if (file) {
                setActivePreviewContext({ id: file.id, name: file.name, parentId: file.parentId });
            } else {
                setActivePreviewContext(null);
            }
        };
        window.addEventListener('preview-selection-changed', handlePreviewChange);
        return () => window.removeEventListener('preview-selection-changed', handlePreviewChange);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const recentMessages = messages
            .filter(m => m.content && m.content.trim().length > 0)
            .slice(-5)
            .map(m => ({ role: m.role, content: m.content }));

        window.dispatchEvent(new CustomEvent('chat-context-updated', {
            detail: { messages: recentMessages }
        }));
    }, [messages]);

    const scrollRef = useRef<HTMLDivElement>(null);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isNearBottomRef = useRef(true);

    const resolveToolBadge = (toolUsed?: string) => {
        if (!toolUsed) return null;
        if (toolUsed === 'workflow') {
            return {
                label: 'Workflow',
                type: 'workflow' as const
            };
        }
        if (toolUsed.startsWith('workflow:')) {
            const name = toolUsed.replace(/^workflow:/, '').trim();
            return {
                label: name || 'Workflow',
                type: 'workflow' as const
            };
        }

        const toolMeta = TOOL_LIBRARY[toolUsed];
        const label = toolMeta?.name || toolUsed.replace(/_/g, ' ');
        return {
            label,
            type: 'action' as const
        };
    };

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        // Avoid redundant state updates that can trigger React's update depth guard in strict mode
        setInput(prev => (prev === val ? prev : val));
    }, []);

    // Initial load
    useEffect(() => {
        if (isOpen) {
            refreshData();
            // Cleanup: Ensure no stale jobs are pending on load/mount
            cancelAllAgentJobs().catch(e => console.error("Failed to cleanup jobs on load", e));
        }
    }, [isOpen]);

    const refreshData = async () => {
        const [p, rules, sessions, files] = await Promise.all([
            getPrompts(),
            getIntentRules(),
            getChatSessions(),
            getWorkspaceFiles()
        ]);
        setPrompts(p);
        setIntentRules(rules);
        setChatSessions(sessions || []);
        setWorkspaceFiles((files || []) as SelectedFile[]);
    };


    const syncSessionMessages = async (sessionId: string) => {
        const session = await getChatSession(sessionId);
        if (!session) return;

        const fileIds = Array.from(new Set(session.messages.flatMap(m => m.fileIds || [])));
        const resolvedFiles = await resolveFilesByIds(fileIds);

        setMessages(session.messages.map(m => {
            const isUser = m.role === 'user';
            const rawContent = m.content || '';
            const extracted = !isUser ? extractThinkingFromText(rawContent) : { cleanText: rawContent, thinking: undefined as string | undefined };
            const hasClean = !!(extracted.cleanText && extracted.cleanText.trim());
            const content = isUser ? rawContent : (hasClean ? extracted.cleanText : '');
            const meta = getMessageMeta(m);
            const thinking = meta.thinking || extracted.thinking || undefined;

            return {
                id: m.id,
                role: isUser ? 'user' as const : 'ai' as const,
                content,
                files: (m.fileIds?.length ? resolvedFiles.filter(f => m.fileIds.includes(f.id)) : undefined),
                toolUsed: m.toolUsed || undefined,
                toolResult: meta.toolResult || undefined,
                toolArgs: meta.toolArgs || undefined,
                thinking
            };
        }));
    };

    const refreshPrompts = async () => {
        const p = await getPrompts();
        setPrompts(p);
    };


    // Timer for elapsed time during background jobs
    useEffect(() => {
        if (!jobStartTime) return;

        const updateElapsed = () => {
            setElapsedTime(Math.floor((Date.now() - jobStartTime) / 1000));
        };

        updateElapsed();
        const timer = setInterval(updateElapsed, 1000);

        return () => clearInterval(timer);
    }, [jobStartTime]);

    // Listen for set-active-app event from FileManager
    useEffect(() => {
        const handleSetActiveApp = async (event: Event) => {
            const customEvent = event as CustomEvent;
            const { name, path } = customEvent.detail;

            // Find the folder in workspace files
            let appFolder = workspaceFiles.find(f =>
                f.type === 'folder' &&
                (f.name === name || f.storagePath === path)
            );

            // If not found in workspace files, create a virtual folder entry for repo apps
            if (!appFolder) {
                appFolder = {
                    id: `repo-app-${name}`,
                    name: name,
                    type: 'folder',
                    storagePath: path,
                    parentId: null,
                    createdAt: new Date(),
                    updatedAt: new Date()
                } as WorkspaceFile;
            }

            // Add folder to attached files if not already attached
            setAttachedFiles(prev => {
                if (prev.find(f => f.id === appFolder!.id)) {
                    toast.info(`${name} is already in context`);
                    return prev;
                }
                toast.success(`Added ${name} to chat context`, {
                    description: 'The AI will now work within this app folder'
                });
                return [...prev, {
                    id: appFolder!.id,
                    name: appFolder!.name,
                    type: 'folder',
                    parentId: appFolder!.parentId,
                    storagePath: path
                }];
            });

            setChatScope('repo');

            // Also add a system message to the input to inform the AI
            setInput(prev => {
                const systemMsg = `[SYSTEM: Active app selected: "${name}" at path "${path}".

                            CRITICAL: This is a REPO APP located at "apps/${path}/" (NOT the main TaskFlow codebase).
                            When creating/editing files or running commands for this app, you MUST:
                            1. Use the full path starting with "apps/${path}/" for ALL file operations and terminal commands
                            2. For terminal commands (npm, vite, etc), use cwd: "apps/${path}"
                            3. This is a SEPARATE application with its own src/, public/, and package.json
                            4. DO NOT edit files in the main TaskFlow src/ directory
                            5. ALWAYS check if the directory exists before running commands

                            Example correct paths:
                            - File operations: "apps/${path}/src/App.tsx", "apps/${path}/package.json"
                            - Terminal cwd: "apps/${path}"
                            - List directory: "apps/${path}/src"

                            WRONG: cwd: "${path}" or path: "${path}/src/App.tsx"
                            CORRECT: cwd: "apps/${path}" or path: "apps/${path}/src/App.tsx"

                            Keep ALL edits and file operations within this app unless user explicitly says otherwise.]\n\n`;
                // Only add if not already present
                if (prev.includes('[SYSTEM: Active app selected:')) {
                    // Replace existing system message
                    return prev.replace(/\[SYSTEM: Active app selected:[\s\S]*?\]\n\n/, systemMsg);
                }
                return systemMsg + prev;
            });
        };

        window.addEventListener('set-active-app', handleSetActiveApp);

        return () => {
            window.removeEventListener('set-active-app', handleSetActiveApp);
        };
    }, [workspaceFiles]);


    const buildSessionTitle = (text: string) => {
        const trimmed = text.trim().replace(/\s+/g, ' ');
        if (!trimmed) return 'New Chat';
        return trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed;
    };

    const resolveFilesByIds = async (ids: string[]) => {
        const sourceFiles = workspaceFiles.length > 0 ? workspaceFiles : (await getWorkspaceFiles() as SelectedFile[]);
        const fileMap = new Map(sourceFiles.map(f => [f.id, f]));
        return ids.map(id => fileMap.get(id)).filter(Boolean) as SelectedFile[];
    };

    const genMsgId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const MAX_CONTEXT_FILE_IDS = 50;

    const expandFileIdsWithFolders = async (ids: string[]) => {
        if (!ids.length) return [] as string[];

        const sourceFiles = workspaceFiles.length > 0 ? workspaceFiles : (await getWorkspaceFiles() as SelectedFile[]);
        const fileMap = new Map(sourceFiles.map(f => [f.id, f]));
        const childrenMap = new Map<string, string[]>();

        sourceFiles.forEach(file => {
            if (file.parentId) {
                const list = childrenMap.get(file.parentId) || [];
                list.push(file.id);
                childrenMap.set(file.parentId, list);
            }
        });

        const resolved = new Set<string>();
        const queue = Array.from(new Set(ids));

        while (queue.length && resolved.size < MAX_CONTEXT_FILE_IDS) {
            const id = queue.shift();
            if (!id) continue;
            const file = fileMap.get(id);
            if (!file) continue;

            if (file.type === 'folder') {
                const children = childrenMap.get(file.id) || [];
                children.forEach(childId => queue.push(childId));
            } else {
                resolved.add(file.id);
            }
        }

        return Array.from(resolved).slice(0, MAX_CONTEXT_FILE_IDS);
    };

    const openSession = async (sessionId: string) => {
        const session = await getChatSession(sessionId);
        if (!session) return;

        setActiveSessionId(session.id);
        setActiveSessionTitle(session.title || 'New Chat');
        setToolStatusEvents([]);

        const fileIds = Array.from(new Set(session.messages.flatMap(m => m.fileIds || [])));
        const resolvedFiles = await resolveFilesByIds(fileIds);

        setAttachedFiles(resolvedFiles);
        setMessages(session.messages.map(m => {
            const isUser = m.role === 'user';
            const rawContent = m.content || '';
            const extracted = !isUser ? extractThinkingFromText(rawContent) : { cleanText: rawContent, thinking: undefined as string | undefined };
            const hasClean = !!(extracted.cleanText && extracted.cleanText.trim());
            const content = isUser ? rawContent : (hasClean ? extracted.cleanText : '');
            const meta = getMessageMeta(m);
            const thinking = meta.thinking || extracted.thinking || undefined;

            return {
                id: m.id,
                role: isUser ? 'user' as const : 'ai' as const,
                content,
                files: (m.fileIds?.length ? resolvedFiles.filter(f => m.fileIds.includes(f.id)) : undefined),
                toolUsed: m.toolUsed || undefined,
                toolResult: meta.toolResult || undefined,
                toolArgs: meta.toolArgs || undefined,
                thinking
            };
        }));

        setView('chat');
        setInput('');
        setHistoryIndex(-1);
        setActiveTool(null);
    };

    const startNewChat = async () => {
        const res = await createChatSession('New Chat');
        if (!res.success || !res.session) {
            toast.error(res.message || 'Failed to create chat session');
            return;
        }
        setActiveSessionId(res.session.id);
        setActiveSessionTitle(res.session.title || 'New Chat');
        setMessages([]);
        setAttachedFiles([]);
        setInput('');
        setHistoryIndex(-1);
        setView('chat');
        setToolStatusEvents([]);
        setChatSessions(prev => [res.session, ...prev]);
    };

    const handleRenameSession = async (sessionId: string) => {
        if (!renamingSessionTitle.trim()) {
            toast.error('Title cannot be empty');
            return;
        }
        await updateChatSessionTitle(sessionId, renamingSessionTitle);
        setChatSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: renamingSessionTitle } : s));
        if (activeSessionId === sessionId) {
            setActiveSessionTitle(renamingSessionTitle);
        }
        setRenamingSessionId(null);
        setRenamingSessionTitle('');
        toast.success('Chat renamed');
    };

    const handleDeleteSession = (sessionId: string) => {
        setPendingDeleteSessionId(sessionId);
        setIsDeleteModalOpen(true);
    };

    const confirmDeleteSession = async () => {
        if (!pendingDeleteSessionId) return;
        setIsDeletingSession(true);
        try {
            await deleteChatSession(pendingDeleteSessionId);
            setChatSessions(prev => prev.filter(s => s.id !== pendingDeleteSessionId));
            if (activeSessionId === pendingDeleteSessionId) {
                setActiveSessionId(null);
                setMessages([]);
                setActiveSessionTitle('New Chat');
            }
            toast.success('Chat deleted');
        } finally {
            setIsDeletingSession(false);
            setIsDeleteModalOpen(false);
            setPendingDeleteSessionId(null);
        }
    };

    const confirmClearAllSessions = async () => {
        setIsClearingAll(true);
        try {
            await deleteAllChatSessions();
            setChatSessions([]);
            setActiveSessionId(null);
            setMessages([]);
            setActiveSessionTitle('New Chat');
            toast.success('All chats cleared');
        } catch (error) {
            toast.error('Failed to clear chats');
        } finally {
            setIsClearingAll(false);
            setIsClearAllModalOpen(false);
        }
    };

    const handleStopAgents = async () => {
        try {
            await cancelAllAgentJobs();
            setIsBackgroundBusy(false);
            setBackgroundJobLabel(null);
            setBackgroundJobMessage(null);
            toast.success('All agent activities stopped.');
        } catch (error) {
            toast.error('Failed to stop agents');
        }
    };

    const buildTranscript = (title: string, msgs: TranscriptMessage[]) => {
        const lines: string[] = [`Chat: ${title || 'Untitled Chat'}`];

        msgs.forEach((m, idx) => {
            const roleLabel = m.role === 'user' ? 'User' : (m.role === 'model' ? 'Assistant' : (m.role || 'Assistant'));
            const attachments = m.files?.length
                ? `Attachments: ${m.files.map((f) => f.name || f.id).join(', ')}`
                : (m.fileIds?.length ? `Attachments: ${m.fileIds.join(', ')}` : null);
            const toolInfo = m.toolUsed ? `Tool: ${m.toolUsed}${m.toolArgs ? ` args=${JSON.stringify(m.toolArgs)}` : ''}` : null;
            const thinking = m.thinking ? `Thinking:\n${m.thinking}` : null;

            lines.push(
                [
                    `\n${idx + 1}. ${roleLabel}`,
                    m.content || '',
                    attachments,
                    toolInfo,
                    thinking
                ].filter(Boolean).join('\n')
            );
        });

        return lines.join('\n');
    };

    const copyCurrentChatTranscript = async () => {
        if (!messages.length) {
            toast.error('No messages to copy yet');
            return;
        }
        setIsCopyingCurrentChat(true);
        try {
            const transcript = buildTranscript(activeSessionTitle || 'Current Chat', messages);
            await navigator.clipboard.writeText(transcript);
            toast.success('Current chat copied');
        } catch (error) {
            console.error('Failed to copy current chat', error);
            toast.error('Could not copy current chat');
        } finally {
            setIsCopyingCurrentChat(false);
        }
    };

    const copyAllChatsTranscripts = async () => {
        if (!chatSessions.length) {
            toast.error('No chats to copy');
            return;
        }
        setIsCopyingAllChats(true);
        try {
            const transcripts: string[] = [];
            for (const session of chatSessions) {
                const full = await getChatSession(session.id);
                if (full?.messages?.length) {
                    transcripts.push(buildTranscript(full.title || session.title || 'Chat', full.messages));
                }
            }

            if (!transcripts.length) {
                toast.error('No chat messages available to copy');
                return;
            }

            await navigator.clipboard.writeText(transcripts.join('\n\n-----\n\n'));
            toast.success('All chats copied');
        } catch (error) {
            console.error('Failed to copy all chats', error);
            toast.error('Could not copy chats');
        } finally {
            setIsCopyingAllChats(false);
        }
    };

    const renderSessionsView = () => (
        <div className="h-full p-6 space-y-4 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-[10px] font-black uppercase theme-text-quaternary tracking-widest">Chats</h4>
                <div className="flex items-center gap-2">
                    {chatSessions.length > 0 && (
                        <button
                            onClick={() => setIsClearAllModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-lg transition-all text-[10px] font-bold uppercase tracking-wider"
                        >
                            <Trash2 size={12} />
                            Clear All
                        </button>
                    )}
                    <button
                        onClick={startNewChat}
                        className="p-2 bg-sky-600 hover:bg-sky-500 rounded-lg text-white transition-all shadow-lg shadow-sky-500/30 active:scale-95"
                        title="New Chat"
                    >
                        <Plus size={16} />
                    </button>
                </div>
            </div>
            <div className="space-y-3">
                {chatSessions.length === 0 && (
                    <div className="text-xs theme-text-tertiary">No previous chats yet.</div>
                )}
                {chatSessions.map((session) => {
                    const preview = session.messages?.[0]?.content || 'No messages yet';
                    const messageCount = session._count?.messages ?? 0;
                    const isActive = session.id === activeSessionId;
                    const isRenaming = session.id === renamingSessionId;

                    return (
                        <div
                            key={session.id}
                            className={cn(
                                "w-full p-4 rounded-2xl border transition-all group",
                                isActive ? "bg-sky-600/10 border-sky-500/30" : "theme-overlay-subtle theme-border-subtle hover:theme-border-medium"
                            )}
                        >
                            {isRenaming ? (
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={renamingSessionTitle}
                                        onChange={(e) => setRenamingSessionTitle(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleRenameSession(session.id);
                                            if (e.key === 'Escape') {
                                                setRenamingSessionId(null);
                                                setRenamingSessionTitle('');
                                            }
                                        }}
                                        placeholder="Enter new title..."
                                        className="w-full theme-overlay-subtle border theme-border-medium rounded-lg px-3 py-2 text-xs theme-text-primary focus:outline-none focus:ring-1 focus:ring-sky-500"
                                        autoFocus
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleRenameSession(session.id)}
                                            className="flex-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold transition-all"
                                        >
                                            Save
                                        </button>
                                        <button
                                            onClick={() => {
                                                setRenamingSessionId(null);
                                                setRenamingSessionTitle('');
                                            }}
                                            className="flex-1 px-3 py-1.5 theme-overlay-subtle hover:theme-overlay-medium theme-text-tertiary rounded-lg text-[10px] font-bold transition-all"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <button
                                            onClick={() => openSession(session.id)}
                                            className="flex-1 text-left"
                                        >
                                            <span className="text-[12px] font-bold theme-text-primary truncate">{session.title || 'New Chat'}</span>
                                        </button>
                                        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => {
                                                    setRenamingSessionId(session.id);
                                                    setRenamingSessionTitle(session.title || 'New Chat');
                                                }}
                                                className="p-1.5 theme-overlay-subtle hover:theme-overlay-medium theme-text-tertiary hover:theme-text-primary rounded-lg transition-all"
                                                title="Rename"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteSession(session.id)}
                                                className="p-1.5 bg-red-500/10 hover:bg-red-500 text-red-300 hover:text-white rounded-lg transition-all"
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] theme-text-tertiary leading-relaxed line-clamp-2 flex-1">
                                            {preview}
                                        </p>
                                        <span className="text-[10px] theme-text-tertiary ml-2 shrink-0">{messageCount}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );

    // Smart auto-scroll - only when user is at bottom
    useEffect(() => {
        if (scrollRef.current && shouldAutoScroll && isNearBottomRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading, isPinned, view, shouldAutoScroll]);

    // Check if user is near bottom on mount
    useEffect(() => {
        const checkPosition = () => {
            if (scrollRef.current) {
                const { scrollHeight, scrollTop, clientHeight } = scrollRef.current;
                const isNear = scrollHeight - scrollTop - clientHeight < 150;
                isNearBottomRef.current = isNear;
            }
        };
        checkPosition();
    }, []);

    const streamAssistantMessage = (content: string, meta: ToolMeta) => {
        const messageId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

        setMessages(prev => [...prev, {
            id: messageId,
            role: 'ai',
            content: '',
            toolUsed: meta.toolUsed,
            toolResult: meta.toolResult,
            thinking: meta.thinking,
            toolArgs: meta.toolArgs,
            appliedContext: meta.appliedContext
        }]);

        return new Promise<void>((resolve) => {
            let cursor = 0;
            const step = () => {
                cursor = Math.min(content.length, cursor + 4);
                setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: content.slice(0, cursor) } : m));

                if (cursor < content.length) {
                    setTimeout(step, streamSpeedRef.current);
                    return;
                }

                resolve();
            };

            if (content.length > 0) {
                step();
            } else {
                resolve();
            }
        });
    };

    const createStreamingMessage = (meta: ToolMeta = {}) => {
        const messageId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

        setMessages(prev => [...prev, {
            id: messageId,
            role: 'ai',
            content: '',
            toolUsed: meta.toolUsed,
            toolResult: meta.toolResult,
            thinking: meta.thinking,
            toolArgs: meta.toolArgs,
            appliedContext: meta.appliedContext
        }]);

        return messageId;
    };

    const updateStreamingContent = (id: string, content: string) => {
        setMessages(prev => prev.map(m => m.id === id ? { ...m, content } : m));
    };

    const updateStreamingMeta = (id: string, meta: ToolMeta) => {
        setMessages(prev => prev.map(m => m.id === id ? { ...m, ...meta } : m));
    };

    const sendMessage = async (text: string) => {
        setManualStop(false);
        setTruncationReport(null); // P3-CONTEXT-BUDGET: Clear previous report
        if (isBackgroundBusy) {
            // Non-blocking warning/toast instead of return
            // toast.message('Background agent is active. You can continue chatting.');
        }
        if (!text.trim() && attachedFiles.length === 0) return;

        const requestText = text;
        setIsLoading(true);

        const userMsg = { id: genMsgId(), role: 'user' as const, content: text, files: [...attachedFiles] };
        setMessages(prev => [...prev, userMsg]);
        setToolStatusEvents([]);
        prependPromptHistory(text);
        setInput('');
        setHistoryIndex(-1);
        setActiveTool(null);
        // DON'T clear attachedFiles - keep them for context

        let sessionId = activeSessionId;

        try {
            if (!sessionId) {
                const title = buildSessionTitle(text);
                const sessionRes = await createChatSession(title);
                if (!sessionRes.success || !sessionRes.session) {
                    toast.error(sessionRes.message || 'Failed to create chat session');
                    setIsLoading(false);
                    return;
                }
                sessionId = sessionRes.session.id;
                setActiveSessionId(sessionId);
                setActiveSessionTitle(sessionRes.session.title || title);
                setChatSessions(prev => [sessionRes.session, ...prev]);
            } else if (activeSessionTitle === 'New Chat') {
                const title = buildSessionTitle(text);
                await updateChatSessionTitle(sessionId, title);
                setActiveSessionTitle(title);
                setChatSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title } : s));
            }

            // Optimistic update done above

            if (sessionId) {
                await addChatMessage(sessionId, 'user', userMsg.content, attachedFiles.map(f => f.id));
            }

            // Prepare history for Gemini format
            // Prepare history for Gemini format with tool context
            const geminiHistory = messages.map(m => {
                let content = m.content;
                const toolResultRecord = m.toolResult ? toRecord(m.toolResult) : null;
                if (m.role === 'ai' && toolResultRecord && toolResultRecord.success !== false) {
                    try {
                        let resultStr = '';
                        if (typeof m.toolResult === 'string') resultStr = m.toolResult;
                        else if (toolResultRecord.output) resultStr = typeof toolResultRecord.output === 'string' ? toolResultRecord.output : JSON.stringify(toolResultRecord.output);
                        else resultStr = JSON.stringify(m.toolResult);

                        // Truncate extremely long outputs to save context
                        if (resultStr.length > 8000) {
                            resultStr = resultStr.slice(0, 8000) + '... (truncated)';
                        }

                        // Append tool output as a system note in the history
                        if (resultStr && resultStr !== '{ }') {
                            content += `\n\n[System: Tool '${m.toolUsed}' output: ${resultStr}]`;
                        }
                    } catch (e) {
                        // Ignore serialization errors
                    }
                }

                return {
                    role: m.role === 'user' ? 'user' as const : 'model' as const,
                    parts: [{ text: content || ' ' }] // Ensure no empty text parts
                };
            });

            // Collect all file IDs from the entire conversation (including current message)
            const allFileIds = new Set<string>();
            [...messages, userMsg].forEach(msg => {
                if (msg.files) {
                    msg.files.forEach(f => allFileIds.add(f.id));
                }
            });

            const expandedFileIds = await expandFileIdsWithFolders(Array.from(allFileIds));

            // Warn if context is very large
            if (expandedFileIds.length > 30) {
                toast.warning(`Large context detected (${expandedFileIds.length} files). This may cause connection issues.`);
            }

            // Build system context to help AI understand current state
            const systemContext = [];

            // Background job context
            if (isBackgroundBusy && backgroundJobLabel) {
                systemContext.push(`[SYSTEM: Background agent is currently running: "${backgroundJobLabel}"]`);
            }

            systemContext.push(
                chatScope === 'repo'
                    ? '[SYSTEM: Scope set to REPO APPS (apps/*). Prefer edits and commands within apps/; avoid workspace file tools unless explicitly requested.]'
                    : '[SYSTEM: Scope set to FILE MANAGER. Prefer workspace files and IDs; avoid apps/* unless explicitly requested.]'
            );

            if (activePrompt?.name) {
                const descriptor = activePrompt.description ? ` Description: ${activePrompt.description}.` : '';
                systemContext.push(`[SYSTEM: Selected specialist agent: "${activePrompt.name}".${descriptor} Behave as this agent and acknowledge it if asked.]`);
            }

            if (activeWorkflows.length > 0) {
                const workflowSummary = activeWorkflows
                    .slice(0, 3)
                    .map((workflow) => {
                        const workflowRecord = workflow as unknown as Record<string, unknown>;
                        const name = typeof workflowRecord.name === 'string'
                            ? workflowRecord.name
                            : typeof workflowRecord.title === 'string'
                                ? workflowRecord.title
                                : 'Workflow';
                        const steps = Array.isArray(workflowRecord.steps) ? workflowRecord.steps.length : 0;
                        return `${name}${steps > 0 ? ` (${steps} steps)` : ''}`;
                    })
                    .join('; ');
                systemContext.push(`[SYSTEM: Agent workflows available: ${workflowSummary}. Prefer these structured flows when relevant instead of generic answers.]`);
            }

            if (activeAppContext?.name && activeAppContext?.path) {
                systemContext.push(`[SYSTEM: Active app selected: "${activeAppContext.name}" at path "apps/${activeAppContext.path}". Use "apps/${activeAppContext.path}" as the base path for all file operations and terminal commands (cwd). Keep edits within this app unless user explicitly says otherwise.]`);
            }

            // Folder context
            if (currentFolderContext.name !== 'Root') {
                systemContext.push(`[SYSTEM: User is currently in folder: "${currentFolderContext.name}"]`);
            }

            // File preview context
            if (activePreviewContext) {
                systemContext.push(`[SYSTEM: User is currently PREVIEWING file "${activePreviewContext.name}" (id: ${activePreviewContext.id}). If user says "this file" or "run this", they likely mean this file.]`);
            }

            if (attachedFiles.length > 0) {
                const fileList = attachedFiles
                    .slice(0, 12)
                    .map(file => {
                        const pathInfo = file.storagePath ? `, path: ${file.storagePath}` : '';
                        return `${file.name} (id: ${file.id}${pathInfo})`;
                    })
                    .join('; ');
                systemContext.push(`[SYSTEM: Attached files (${attachedFiles.length}). Use these IDs or names for file tools like view_file/read_file: ${fileList}]`);
            }

            // Terminal/App running hint - based on domain knowledge
            // Note: We can't directly detect terminals from the frontend, but we can provide smart guidance
            // REMOVED: System guidance polluting the context. Moved to backend system instruction if needed.

            const contextMsg = systemContext.length > 0
                ? `${systemContext.join('\\n')}\\n\\n${userMsg.content}`
                : userMsg.content;

            console.log('📤 Sending to AI:', userMsg.content);
            console.log('🧠 System Context:', systemContext.length > 0 ? systemContext : 'None');
            console.log('📎 Files in context:', expandedFileIds.length, 'files');
            console.log('📂 Current Folder:', currentFolderContext.name, currentFolderContext.id);
            let usedStream = false;
            let streamedMessageId: string | null = null;
            let streamedThinking: string | undefined;
            let res: ChatResponse | null = null;

            const allowToolsForRequest = allowToolExecution || allowHighRiskExecution || allowHighRiskOnce;
            const allowHighRiskExecutionForRequest = allowHighRiskExecution || allowHighRiskOnce;

            try {
                // Create AbortController with timeout to prevent hanging requests
                const abortController = new AbortController();
                const timeoutId = setTimeout(() => abortController.abort(), 5 * 60 * 1000); // 5 minute timeout

                setStreamingStatus('connecting');
                setAiActivity('Sending request to AI...');

                const streamResponse = await fetch('/api/chat/stream', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: contextMsg,
                        fileIds: expandedFileIds,
                        history: geminiHistory,
                        currentFolder: currentFolderContext.name,
                        currentFolderId: currentFolderContext.id || undefined,
                        sessionId: sessionId || undefined,
                        verbosity: verbosity, // Pass current verbosity setting
                        activeAppName: activeAppContext?.name,
                        activeAppPath: activeAppContext?.path,
                        model: selectedModel,
                        enabledToolIds,
                        enabledCapabilityIds: enabledToolIds,
                        allowToolExecution: allowToolsForRequest,
                        allowHighRiskExecution: allowHighRiskExecutionForRequest,
                        chatScope,
                        activePromptId: activePrompt?.id,
                        activePromptName: activePrompt?.name,
                        activePromptDescription: activePrompt?.description,
                        activePromptPrompt: activePrompt?.prompt,
                        activePromptWorkflows: activeWorkflows
                    }),
                    signal: abortController.signal
                });

                clearTimeout(timeoutId);

                if (!streamResponse.ok || !streamResponse.body) {
                    throw new Error('Streaming unavailable');
                }

                setStreamingStatus('streaming');
                setAiActivity('Receiving response...');

                usedStream = true;
                streamedMessageId = createStreamingMessage();

                const reader = streamResponse.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let accumulated = '';
                let finalMeta: ToolMeta = {};
                let chunkCount = 0;
                const streamParser = createThinkingStreamParser();

                // Add timeout for stream reading to prevent infinite hangs
                const streamTimeout = setTimeout(() => {
                    reader.cancel();
                    throw new Error('Stream reading timeout');
                }, 4 * 60 * 1000); // 4 minute timeout for reading

                try {
                    while (true) {
                        const { value, done } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        const parts = buffer.split('\n\n');
                        buffer = parts.pop() || '';

                        for (const part of parts) {
                            const line = part.split('\n').find(l => l.startsWith('data:'));
                            if (!line) continue;
                            const data = line.replace(/^data:\s*/, '').trim();
                            if (!data) continue;

                            const payload = JSON.parse(data);

                            // Handle tool status events
                            if (payload.type === 'tool_status') {
                                appendToolStatusEvent({
                                    tool: payload.tool,
                                    phase: payload.phase,
                                    timestamp: payload.timestamp,
                                    elapsedMs: payload.elapsedMs
                                });
                            }

                            // Handle retry status
                            if (payload.type === 'status' && payload.phase === 'retry') {
                                setAiActivity(payload.message || 'Retrying...');
                                toast.info(payload.message || 'Connection interrupted. Retrying...');
                            }

                            // P3-TOOL-ROUTING/OBSERVABILITY: Debug logs from server (suppressed in production)
                            if (payload.type === 'debug' && process.env.NODE_ENV === 'development') {
                                // Only log trace IDs and important debug, not per-token noise
                                if (payload.message?.startsWith?.('Trace ID:') || payload.message?.startsWith?.('Context Budget:')) {
                                    console.log('🐞 Server Debug:', payload.message);
                                }
                            }

                            if (payload.type === 'context' && payload.appliedContext) {
                                finalMeta = {
                                    ...finalMeta,
                                    appliedContext: payload.appliedContext
                                };
                            }

                            if (payload.type === 'delta' && typeof payload.text === 'string') {
                                accumulated += payload.text;
                                chunkCount++;
                                setStreamProgress(prev => Math.min(prev + 5, 95));
                                setAiActivity(`Streaming response... (${chunkCount} chunks)`);
                                if (streamedMessageId) {
                                    const parsed = streamParser.consume(payload.text);
                                    if (parsed.thinking && parsed.thinking !== streamedThinking) {
                                        streamedThinking = parsed.thinking;
                                        updateStreamingMeta(streamedMessageId, { thinking: parsed.thinking });
                                    }
                                    updateStreamingContent(streamedMessageId, parsed.display);
                                }
                            }
                            if (payload.type === 'done') {
                                finalMeta = {
                                    toolUsed: payload.toolUsed,
                                    toolResult: payload.toolResult,
                                    thinking: payload.thinking,
                                    toolArgs: payload.toolArgs,
                                    truncationReport: payload.truncationReport,
                                    appliedContext: payload.appliedContext
                                };
                            }
                            if (payload.type === 'error') {
                                // Check if partial content is available
                                if (payload.partialContent) {
                                    toast.warning('Stream interrupted. Showing partial response.');
                                    accumulated = payload.partialContent;
                                }
                                throw new Error(payload.message || 'Streaming failed');
                            }
                        }
                    }
                } finally {
                    clearTimeout(streamTimeout);
                    setStreamingStatus('processing');
                    setAiActivity('Finalizing response...');
                    setStreamProgress(100);
                }

                res = {
                    success: true,
                    text: accumulated,
                    ...finalMeta
                };
                if (streamedMessageId && !finalMeta.thinking) {
                    const finalThinking = streamParser.getState().thinking.trim();
                    if (finalThinking) {
                        updateStreamingMeta(streamedMessageId, { thinking: finalThinking });
                    }
                }
            } catch (streamError) {
                const errorMessage = streamError instanceof Error ? streamError.message : String(streamError);
                const isAbortError = errorMessage.includes('abort');
                const isConnectionError = errorMessage.includes('ECONNRESET') || errorMessage.includes('aborted');

                if (isAbortError) {
                    console.warn('⚠️ Request timeout - context may be too large:', streamError);
                    toast.error('Request timed out. Try reducing the number of attached files.');
                } else if (isConnectionError) {
                    console.warn('⚠️ Connection reset - likely due to large context:', streamError);
                    toast.warning('Connection interrupted. Retrying with fallback method...');
                } else {
                    console.warn('⚠️ Stream failed, falling back to direct API:', streamError);
                }

                usedStream = false;

                // Reduce context size for fallback to prevent same error
                const reducedFileIds = expandedFileIds.slice(0, 20); // Limit to 20 files for fallback
                if (reducedFileIds.length < expandedFileIds.length) {
                    toast.info(`Reducing context from ${expandedFileIds.length} to ${reducedFileIds.length} files for retry`);
                }

                res = await chatWithAI(
                    contextMsg,
                    reducedFileIds,
                    geminiHistory,
                    currentFolderContext.name,
                    currentFolderContext.id || undefined,
                    { sessionId: sessionId || undefined, allowToolExecution: allowToolsForRequest, allowHighRiskExecution: allowHighRiskExecutionForRequest, verbosity: verbosity, model: selectedModel, enabledToolIds }
                );
                console.log('📥 Fallback chatWithAI response:', JSON.stringify(res, null, 2));
            }
            const response = normalizeChatResponse(res);
            res = response;

            console.log('📥 AI Response:', JSON.stringify(response, null, 2));
            console.log('📥 AI Response Text:', response.text);
            console.log('📥 AI Response Success:', response.success);

            if (response.success) {
                // P3-CONTEXT-BUDGET: Handle truncation report
                if (response.truncationReport) {
                    setTruncationReport(response.truncationReport);
                }

                // Validate that we have text to display OR a tool/skill was used
                const hasText = response.text && response.text.trim() !== '';
                const hasTool = response.toolUsed || response.toolResult;

                if (!hasText && !hasTool) {
                    console.error('⚠️ AI returned empty response');
                    toast.error('AI returned an empty response');
                    setMessages(prev => [...prev, {
                        id: genMsgId(),
                        role: 'ai',
                        content: 'I apologize, but I encountered an issue generating a response. Please try again.'
                    }]);
                } else {
                    const responseText = response.text as string;
                    const toolArgsRecord = toRecord(response.toolArgs);
                    const toolResultRecord = toRecord(response.toolResult);
                    const requiresApproval = toolResultRecord.requiresApproval === true;
                    const pendingTools = Array.isArray(toolResultRecord.proposedTools)
                        ? toolResultRecord.proposedTools.filter((tool): tool is string => typeof tool === 'string')
                        : [];
                    const pendingHighRiskTools = Array.isArray(toolResultRecord.highRiskTools)
                        ? toolResultRecord.highRiskTools.filter((tool): tool is string => typeof tool === 'string')
                        : [];

                    if (requiresApproval) {
                        setPendingApprovalRequest({
                            replayText: requestText,
                            proposedTools: pendingTools,
                            highRiskTools: pendingHighRiskTools
                        });
                        setProposedTools(pendingTools);
                        setHighRiskTools(pendingHighRiskTools);
                    } else {
                        setPendingApprovalRequest(null);
                        setProposedTools([]);
                        setHighRiskTools([]);
                        setIsApprovalModalOpen(false);
                    }

                    const { cleanText, thinking } = extractThinkingFromText(responseText);
                    // Avoid re-showing thinking tags as a code block when there is no user-facing text
                    const safeContent = cleanText || (thinking ? '' : responseText);
                    const contentToStream = safeContent;

                    if (usedStream && streamedMessageId) {
                        updateStreamingMeta(streamedMessageId, {
                            toolUsed: response.toolUsed,
                            toolResult: response.toolResult,
                            thinking: response.thinking || thinking,
                            toolArgs: response.toolArgs,
                            appliedContext: response.appliedContext
                        });
                        if (!contentToStream) {
                            updateStreamingContent(streamedMessageId, safeContent);
                        }
                    } else if (contentToStream) {
                        await streamAssistantMessage(contentToStream, {
                            toolUsed: response.toolUsed,
                            toolResult: response.toolResult,
                            thinking: response.thinking || thinking,
                            toolArgs: response.toolArgs,
                            appliedContext: response.appliedContext
                        });
                    } else {
                        setMessages(prev => [...prev, {
                            id: genMsgId(),
                            role: 'ai',
                            content: safeContent,
                            toolUsed: response.toolUsed,
                            toolResult: response.toolResult,
                            thinking: response.thinking || thinking,
                            toolArgs: response.toolArgs,
                            appliedContext: response.appliedContext
                        }]);
                    }

                    // Auto-open preview for HTML files (respects user setting)
                    const toolResultFile = toolResultRecord.file;
                    const toolResultFolder = toolResultRecord.folder;
                    const toolResultFileRecord = (toolResultFile && typeof toolResultFile === 'object') ? (toolResultFile as Record<string, unknown>) : null;
                    const toolResultFolderRecord = (toolResultFolder && typeof toolResultFolder === 'object') ? (toolResultFolder as Record<string, unknown>) : null;

                    if (response.toolUsed === 'create_html_file' && toolResultRecord.success === true && toolResultFileRecord) {
                        const createdFile = {
                            id: typeof toolResultFileRecord.id === 'string' ? toolResultFileRecord.id : '',
                            name: typeof toolResultFileRecord.name === 'string' ? toolResultFileRecord.name : 'Untitled',
                            type: typeof toolResultFileRecord.type === 'string' ? toolResultFileRecord.type : undefined,
                            parentId: typeof toolResultFileRecord.parentId === 'string' ? toolResultFileRecord.parentId : null
                        };

                        if (autoOpenPreview) {
                            console.log('🖼️ Auto-opening preview for HTML file');
                            window.dispatchEvent(new CustomEvent('open-preview-tab', { detail: createdFile }));
                        } else {
                            toast.success(`Created ${createdFile.name}. Click to open preview.`, {
                                action: {
                                    label: 'Open Preview',
                                    onClick: () => window.dispatchEvent(new CustomEvent('open-preview-tab', { detail: createdFile }))
                                }
                            });
                        }

                        // Auto-register file in context (User Request)
                        setAttachedFiles(prev => {
                            if (prev.find(f => f.id === createdFile.id)) return prev;
                            toast.success(`Registered ${createdFile.name} in context`);
                            return [...prev, { id: createdFile.id, name: createdFile.name, type: createdFile.type || 'html', parentId: createdFile.parentId }];
                        });
                    }

                    // Auto-open live preview for local URLs mentioned in text (dev servers)
                    // Matches http://localhost:PORT or http://*.example.com (for potential internal domains)
                    const urlMatch = response.text?.match(/http:\/\/(localhost:\d+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(\/[^\s]*)?/);
                    if (urlMatch && !response.text?.includes('http://preview-not-ready')) {
                        const url = urlMatch[0];
                        // Don't auto-open if it's already a WorkspaceFile tool use (handled above)
                        if (response.toolUsed !== 'create_html_file') {
                            if (autoOpenPreview) {
                                console.log('🌐 Auto-opening live preview for URL:', url);
                                window.dispatchEvent(new CustomEvent('open-preview-tab', { detail: url }));
                            } else {
                                toast.success(`Server running at ${url}`, {
                                    action: {
                                        label: 'Open Preview',
                                        onClick: () => window.dispatchEvent(new CustomEvent('open-preview-tab', { detail: url }))
                                    }
                                });
                            }
                        }
                    }

                    // Auto-register created Folders
                    if (response.toolUsed === 'create_folder' && toolResultRecord.success === true && toolResultFolderRecord) {
                        const folder = {
                            id: typeof toolResultFolderRecord.id === 'string' ? toolResultFolderRecord.id : '',
                            name: typeof toolResultFolderRecord.name === 'string' ? toolResultFolderRecord.name : 'Folder',
                            parentId: typeof toolResultFolderRecord.parentId === 'string' ? toolResultFolderRecord.parentId : null
                        };
                        setAttachedFiles(prev => {
                            if (prev.find(f => f.id === folder.id)) return prev;
                            toast.success(`Registered folder ${folder.name} in context`);
                            return [...prev, { id: folder.id, name: folder.name, type: 'folder', parentId: folder.parentId }];
                        });
                    }

                    // Auto-register created Files (Markdown/Text)
                    if ((response.toolUsed === 'create_file' || response.toolUsed === 'create_markdown_file') && toolResultRecord.success === true && toolResultFileRecord) {
                        const file = {
                            id: typeof toolResultFileRecord.id === 'string' ? toolResultFileRecord.id : '',
                            name: typeof toolResultFileRecord.name === 'string' ? toolResultFileRecord.name : 'File',
                            type: typeof toolResultFileRecord.type === 'string' ? toolResultFileRecord.type : undefined,
                            parentId: typeof toolResultFileRecord.parentId === 'string' ? toolResultFileRecord.parentId : null
                        };
                        setAttachedFiles(prev => {
                            if (prev.find(f => f.id === file.id)) return prev;
                            toast.success(`Registered ${file.name} in context`);
                            return [...prev, { id: file.id, name: file.name, type: file.type || 'file', parentId: file.parentId }];
                        });
                    }

                    // Explicit Preview URL from Tool Result (e.g., manage_app_lifecycle)
                    const explicitPreviewUrl = typeof toolResultRecord.previewUrl === 'string' ? toolResultRecord.previewUrl : undefined;
                    if (explicitPreviewUrl) {
                        console.log('🔗 Auto-opening explicit preview URL:', explicitPreviewUrl);
                        window.dispatchEvent(new CustomEvent('open-preview-tab', { detail: explicitPreviewUrl }));
                    }

                    if (sessionId) {
                        await addChatMessage(sessionId, 'ai', response.text || '', [], response.toolUsed, response.thinking, response.toolResult, response.toolArgs);
                    }

                    if (response.toolUsed) {
                        const badge = resolveToolBadge(response.toolUsed);
                        const label = badge ? badge.label : response.toolUsed;
                        const prefix = badge?.type === 'workflow' ? 'Workflow Executed' : 'Action Executed';
                        toast.success(`${prefix}: ${label}`);

                        // Trigger edit preview if applicable
                        if (response.toolUsed === 'edit_file' || response.toolUsed === 'create_markdown_file') {
                            if (response.toolArgs) {
                                // If it's an HTML file, also trigger the live preview split view
                                const targetName = (typeof toolArgsRecord.fileId === 'string' ? toolArgsRecord.fileId : '')
                                    || (typeof toolArgsRecord.filename === 'string' ? toolArgsRecord.filename : '');
                                if (targetName.toLowerCase().endsWith('.html')) {
                                    // Try to find the file in available workspace files to get full object
                                    const fileObj = workspaceFiles.find(f =>
                                        f.id === targetName || f.name === targetName || f.storagePath?.endsWith(targetName)
                                    );
                                    if (fileObj) {
                                        window.dispatchEvent(new CustomEvent('open-preview-tab', { detail: fileObj }));
                                    }
                                }

                                setEditPreviewData({
                                    fileName: (typeof toolArgsRecord.fileId === 'string' ? toolArgsRecord.fileId : '')
                                        || (typeof toolArgsRecord.filename === 'string' ? toolArgsRecord.filename : '')
                                        || 'Resource System',
                                    content: typeof toolArgsRecord.content === 'string' ? toolArgsRecord.content : ''
                                });
                                setIsEditPreviewOpen(true);
                            }
                        }

                        // Specific handling for focus_workspace_item
                        if (response.toolUsed === 'focus_workspace_item' && typeof toolResultRecord.itemId === 'string') {
                            window.dispatchEvent(new CustomEvent('focus-workspace-item', {
                                detail: {
                                    itemId: toolResultRecord.itemId,
                                    parentId: typeof toolResultRecord.parentId === 'string' ? toolResultRecord.parentId : undefined
                                }
                            }));
                        }

                        // Dispatch custom event to refresh file manager without reloading the page
                        window.dispatchEvent(new CustomEvent('refresh-file-manager'));
                        setTimeout(() => refreshData(), 100);
                    }
                }
            } else {
                const errorMessage = response.message || response.error || response.reason || response.text || 'AI failed to respond';
                console.error('❌ AI Error:', { success: response.success, message: response.message, error: response.error, reason: response.reason, text: response.text, keys: Object.keys(response || {}), fullResponse: response });
                toast.error(errorMessage);
                setMessages(prev => [...prev, { id: genMsgId(), role: 'ai', content: `Error: ${errorMessage}` }]);
            }
        } catch (error) {
            console.error('💥 Chat Error:', error);
            toast.error('Connection error');
            setMessages(prev => [...prev, {
                id: genMsgId(),
                role: 'ai',
                content: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`
            }]);
        } finally {
            setIsLoading(false);
            setStreamingStatus('idle');
            setStreamProgress(0);
            setAiActivity('');
            setAllowHighRiskOnce(false);
            setToolStatusEvents([]);
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLoading) return;
        await sendMessage(input);
    };

    const approveFromBubble = async (allowAlways = false) => {
        setManualStop(false);
        if (allowAlways) {
            setAllowToolExecution(true);
            setAllowHighRiskExecution(true);
        }
        setAllowHighRiskOnce(true);
        const pendingRecord = toRecord(pendingApprovalRequest);
        const replayText = typeof pendingRecord.replayText === 'string' ? pendingRecord.replayText : '';
        const fallbackMessage = [...messages]
            .slice()
            .reverse()
            .find((message) => message.role === 'user' && (message.content.trim().length > 0 || (message.files?.length ?? 0) > 0))
            ?.content || '';

        const textToReplay = replayText.trim().length > 0 ? replayText : fallbackMessage;
        if (!textToReplay.trim() && attachedFiles.length === 0) {
            toast.error('No pending approval action in this chat.');
            return;
        }

        toast.info('Approval granted. Replaying the last request with tool execution enabled.');
        await sendMessage(textToReplay);
    };

    const handleSavePrompt = async (data: {
        name: string,
        prompt: string,
        description: string,
        tools: string[],
        workflows?: unknown[],
        triggerKeywords?: string[]
    }) => {
        let res: { success: boolean; message?: string };
        if (editingPromptId) {
            const actions = await import('@/app/actions');
            const updatePromptFn = actions.updatePrompt as (id: string, payload: typeof data) => Promise<{ success: boolean; message?: string }>;
            res = await updatePromptFn(editingPromptId, data);
        } else {
            res = await createPrompt(data);
        }

        if (res.success) {
            toast.success(editingPromptId ? 'Archetype Updated' : 'System Prompt Created');
            refreshPrompts();
            setEditingPromptId(null);
            setIsEditorOpen(false);
        }
    };

    const handleSetActive = async (id: string) => {
        if (!id || isSwitchingAgent) return;
        setIsSwitchingAgent(true);
        try {
            const res = await setActivePrompt(id);
            if (res.success) {
                toast.success('Tactical Context Updated');
                refreshPrompts();
            } else {
                toast.error('Failed to switch agent');
            }
        } catch (error) {
            toast.error('Failed to switch agent');
        } finally {
            setIsSwitchingAgent(false);
        }
    };

    const handleDeletePrompt = async (id: string) => {
        const res = await deletePrompt(id);
        if (res.success) {
            toast.success('Prompt Purged');
            refreshPrompts();
        }
    };

    const handleApplySuggestion = async (suggestion: Suggestion) => {
        setIsSuggestionsOpen(false);
        const text = `Initialize strategic flow: ${suggestion.title}. \n\n${suggestion.agentInstructions}`;
        setInput(text);

        // Auto-send if it's a new chat, otherwise just set input
        if (messages.length === 0 && !isLoading) {
            // Give a small delay for the modal to close and state to update
            setTimeout(() => {
                sendMessage(text);
            }, 300);
        }

        toast.success(`Loaded "${suggestion.title}" into agent context`);
    };

    const startEditing = (p: AIPromptSet) => {
        const rawWorkflows = (p as { workflows?: unknown }).workflows;
        const rawTriggerKeywords = (p as { triggerKeywords?: unknown }).triggerKeywords;
        const workflows = Array.isArray(rawWorkflows) ? rawWorkflows : [];
        const triggerKeywords = Array.isArray(rawTriggerKeywords)
            ? rawTriggerKeywords.filter((item): item is string => typeof item === 'string')
            : [];
        setNewPrompt({
            name: p.name,
            description: p.description || '',
            prompt: p.prompt,
            tools: p.tools && p.tools.length > 0 ? p.tools : DEFAULT_SKILLS,
            workflows,
            triggerKeywords
        });
        setEditingPromptId(p.id);
        setIsEditorOpen(true);
    };

    const removeFile = (id: string) => {
        setAttachedFiles(prev => prev.filter(f => f.id !== id));
    };

    const upsertAttachedFile = useCallback((file: SelectedFile, options?: { silent?: boolean }) => {
        let added = false;
        setAttachedFiles(prev => {
            if (prev.find(existing => existing.id === file.id)) return prev;
            added = true;
            return [...prev, file];
        });

        if (added && !options?.silent) {
            toast.success(`Attached ${file.name}`, {
                description: 'Added to chat context for analysis and tool use.'
            });
        }

        return added;
    }, []);

    const mergeWorkspaceFile = useCallback((file: SelectedFile) => {
        setWorkspaceFiles(prev => {
            if (prev.find(existing => existing.id === file.id)) return prev;
            return [...prev, file];
        });
    }, []);

    const handleNativeFilesAdded = useCallback(async (incomingFiles: FileList | File[]) => {
        const files = Array.from(incomingFiles).filter((f): f is File => typeof f === 'object' && f !== null && 'name' in f && 'size' in f);
        if (files.length === 0) return;

        setIsUploadingFiles(true);
        const loadingToast = toast.loading(
            files.length === 1 ? `Uploading ${files[0].name}...` : `Uploading ${files.length} files...`
        );

        const uploaded: SelectedFile[] = [];
        const failedFiles: string[] = [];

        try {
            for (const file of files) {
                const formData = new FormData();
                formData.append('file', file);

                if (currentFolderContext.id) {
                    formData.append('parentId', currentFolderContext.id);
                }

                const result = await uploadFile(formData);
                if (result.success && result.file) {
                    uploaded.push({
                        id: result.file.id,
                        name: result.file.name,
                        type: result.file.type,
                        parentId: result.file.parentId ?? null,
                        storagePath: result.file.storagePath ?? undefined
                    });
                } else {
                    failedFiles.push(file.name);
                }
            }

            uploaded.forEach(file => {
                mergeWorkspaceFile(file);
                upsertAttachedFile(file, { silent: true });
            });

            if (uploaded.length > 0) {
                if (!isOpen) setIsOpen(true);
                toast.success(
                    uploaded.length === 1 ? `Attached ${uploaded[0].name}` : `Attached ${uploaded.length} files to chat context`,
                    {
                        id: loadingToast,
                        description: 'Ready for chat, summarization, and vision analysis.'
                    }
                );
            } else {
                toast.error('Failed to upload files', { id: loadingToast });
            }

            if (failedFiles.length > 0) {
                toast.error(`Some files failed to upload: ${failedFiles.join(', ')}`);
            }
        } catch (error) {
            toast.error('Failed to upload files', { id: loadingToast });
        } finally {
            setIsUploadingFiles(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    }, [currentFolderContext.id, isOpen, mergeWorkspaceFile, upsertAttachedFile]);

    const handleComposerDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            await handleNativeFilesAdded(e.dataTransfer.files);
            return;
        }

        const fileId = e.dataTransfer.getData('fileId');
        if (!fileId) return;

        const file = workspaceFiles.find(item => item.id === fileId);
        if (file) {
            upsertAttachedFile(file);
        }
    }, [handleNativeFilesAdded, upsertAttachedFile, workspaceFiles]);

    const renderAttachedContextTray = (variant: 'pinned' | 'floating' = 'pinned') => {
        const isFloating = variant === 'floating';
        const secondaryText = isFloating ? 'text-white/50' : 'theme-text-tertiary';
        const chipClass = isFloating
            ? 'border-white/10 bg-white/5 text-white/80 hover:border-white/20'
            : 'theme-border-medium theme-overlay-subtle theme-text-secondary hover:theme-text-primary';
        const buttonClass = isFloating
            ? 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
            : 'border-[color:var(--border)] bg-foreground/[0.03] theme-text-secondary hover:theme-text-primary hover:border-sky-500/30';

        return (
            <div className="mb-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                    <div className={cn('text-[10px] uppercase tracking-[0.2em] font-bold', secondaryText)}>
                        Chat Context
                    </div>
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingFiles}
                        className={cn(
                            'inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[11px] font-semibold transition-colors',
                            buttonClass,
                            isUploadingFiles && 'cursor-wait opacity-70'
                        )}
                        title="Upload files into chat context"
                    >
                        {isUploadingFiles ? <Loader2 size={13} className="animate-spin" /> : <Paperclip size={13} />}
                        {isUploadingFiles ? 'Uploading...' : 'Attach files'}
                    </button>
                </div>
                <div className={cn('text-[11px]', secondaryText)}>
                    Drop from your desktop or the file manager. Images and PDFs stay in context for vision and receipt analysis.
                </div>
                {attachedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {attachedFiles.map(file => {
                            const FileIcon = file.type === 'pdf'
                                ? FileText
                                : ['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif', 'gif', 'image'].includes(file.type)
                                    ? ImageIcon
                                    : File;

                            return (
                                <div
                                    key={file.id}
                                    className={cn(
                                        'inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[11px] transition-colors',
                                        chipClass
                                    )}
                                >
                                    <FileIcon size={13} className="text-sky-400" />
                                    <span className="max-w-[180px] truncate font-medium">{file.name}</span>
                                    <button
                                        type="button"
                                        onClick={() => removeFile(file.id)}
                                        className="rounded-full p-0.5 text-inherit opacity-70 transition-opacity hover:opacity-100"
                                        title={`Remove ${file.name} from chat context`}
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    // Listen for custom event to add files to chat
    useEffect(() => {
        const handleAddFile = (event: Event) => {
            const file = (event as CustomEvent<WorkspaceFile>).detail;
            upsertAttachedFile({ id: file.id, name: file.name, type: file.type, parentId: file.parentId ?? null }, { silent: true });
            if (!isOpen) setIsOpen(true);
            toast.success(`Added ${file.name} to AI context`, {
                icon: <Paperclip size={14} className="text-sky-400" />
            });
        };

        const handlePreview = (event: Event) => {
            const file = (event as CustomEvent<WorkspaceFile>).detail;
            upsertAttachedFile({ id: file.id, name: file.name, type: file.type, parentId: file.parentId ?? null }, { silent: true });
        };

        const handleFolderChange = (event: Event) => {
            const { folderId, folderName } = (event as CustomEvent<{ folderId: string | null; folderName: string }>).detail;
            setCurrentFolderContext({ id: folderId, name: folderName });
        };

        window.addEventListener('add-to-ai-chat', handleAddFile);
        window.addEventListener('preview-opened', handlePreview);
        window.addEventListener('workspace-folder-changed', handleFolderChange);

        return () => {
            window.removeEventListener('add-to-ai-chat', handleAddFile);
            window.removeEventListener('preview-opened', handlePreview);
            window.removeEventListener('workspace-folder-changed', handleFolderChange);
        };
    }, [isOpen, upsertAttachedFile]);

    const togglePin = () => {
        const next = !isPinned;
        setIsPinned(next);
        window.dispatchEvent(new CustomEvent('ai-chat-pin-changed', { detail: next }));
        if (next && !isOpen) setIsOpen(true);
    };

    const activePrompt = prompts.find(p => p.isActive);
    const getPromptCapabilityStats = (prompt: AIPromptSet | null) => {
        const ids = prompt?.tools && prompt.tools.length > 0 ? prompt.tools : DEFAULT_SKILLS;
        const toolIds = ids.filter(id => TOOL_LIBRARY[id]);
        const skillIds = ids.filter(id => SKILLS_LIBRARY[id]);
        return { toolIds, skillIds };
    };
    const activeAgentId = activePrompt?.id || '';
    const enabledToolIds = (activePrompt?.tools && activePrompt.tools.length > 0)
        ? activePrompt.tools.filter(id => TOOL_LIBRARY[id] || SKILLS_LIBRARY[id])
        : DEFAULT_SKILLS.filter(id => TOOL_LIBRARY[id] || SKILLS_LIBRARY[id]);
    const activeWorkflows = Array.isArray((activePrompt as { workflows?: unknown } | undefined)?.workflows)
        ? ((((activePrompt as unknown as { workflows?: WorkflowDefinition[] } | undefined)?.workflows) || []))
        : [];

    const toolPromptById: Record<string, string> = {
        verify_dgii_rnc: 'Verify this business with DGII',
        extract_alegra_bill: 'Extract this receipt to Alegra',
        record_alegra_payment: 'Record a payment for this bill',
        create_markdown_file: 'Save this as a markdown report',
        create_task: 'Create a task from this request'
    };

    const slashCommands = useMemo(() => ([
        {
            command: '/v1',
            label: 'Cognitive Brain',
            description: 'Activate advanced reasoning and planning mode.',
            template: '/v1 '
        },
        {
            command: '/scaffold-vite',
            label: 'Scaffold Vite app',
            description: 'Create a new Vite React app template.',
            template: '/scaffold-vite '
        },
        {
            command: '/vite',
            label: 'Scaffold Vite app (alias)',
            description: 'Alias for creating a new Vite React app template.',
            template: '/vite '
        },
        {
            command: '/viteapp',
            label: 'Scaffold Vite app (alias)',
            description: 'Alias for creating a new Vite React app template.',
            template: '/viteapp '
        },
        {
            command: '/scaffolde-vite',
            label: 'Scaffold Vite app (alias)',
            description: 'Alias for creating a new Vite React app template.',
            template: '/scaffolde-vite '
        },
        {
            command: '/install-docker',
            label: 'Install to Docker',
            description: 'Build and run the app in a Docker container.'
        },
        {
            command: '/open-processes',
            label: 'Open Processes',
            description: 'Show running processes and deployments.'
        }
    ]), []);

    const commandQuery = input.startsWith('/') ? input.slice(1).toLowerCase() : '';
    const filteredCommands = useMemo(() => {
        if (!input.startsWith('/')) return [];
        if (!commandQuery) return slashCommands;
        return slashCommands.filter(cmd =>
            cmd.command.toLowerCase().includes(commandQuery) ||
            cmd.label.toLowerCase().includes(commandQuery)
        );
    }, [commandQuery, input, slashCommands]);

    useEffect(() => {
        const shouldOpen = input.startsWith('/');
        setIsCommandMenuOpen(shouldOpen);
        if (shouldOpen) {
            setActiveCommandIndex(0);
        }
    }, [input]);

    const quickTips = useMemo(() => {
        const defaultTips = [
            { text: 'Organize these files into a clean structure', icon: '🗂️' },
            { text: 'Summarize the attached document with key points', icon: '📝' },
            { text: 'Create a workflow for this recurring task', icon: '⚡' }
        ];
        const receiptTips = [
            { text: 'Analyze these Dominican receipts and extract ITBIS', icon: '🧾' },
            { text: 'Verify RNC and NCF for this receipt', icon: '🔎' },
            { text: 'Generate a markdown report from receipt data', icon: '📊' }
        ];
        const codeTips = [
            { text: 'Review this code for security and performance issues', icon: '🔒' },
            { text: 'Find bugs and suggest optimizations', icon: '🛠️' },
            { text: 'Refactor this module with best practices', icon: '🧠' }
        ];
        const webTips = [
            { text: 'Design a premium SaaS landing page for a new product', icon: '✨' },
            { text: 'Create a marketing site for a fintech startup', icon: '💸' },
            { text: 'Build a portfolio site concept with dark mode glassmorphism', icon: '🌙' },
            { text: 'Create a product launch microsite with a hero and features', icon: '🚀' },
            { text: 'Design a CRM dashboard UI with charts and tables', icon: '📈' }
        ];

        const name = (activePrompt?.name || '').toLowerCase();
        let pool = defaultTips;
        if (name.includes('receipt') || name.includes('fiscal')) pool = receiptTips;
        if (name.includes('code') || name.includes('review')) pool = codeTips;
        if (name.includes('web') || name.includes('architect') || name.includes('ui') || name.includes('ux')) pool = webTips;

        // Deterministic shuffle based on active prompt name so SSR and CSR match
        const seededHash = (s: string) => {
            let h = 2166136261;
            for (let i = 0; i < s.length; i++) {
                h ^= s.charCodeAt(i);
                h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
            }
            return h >>> 0;
        };

        const mulberry32 = (a: number) => {
            return () => {
                let t = a += 0x6D2B79F5;
                t = Math.imul(t ^ (t >>> 15), t | 1);
                t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
                return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
            };
        };

        const deterministicShuffle = <T,>(arr: T[], seedStr: string) => {
            const seed = seededHash(seedStr || 'default');
            const rnd = mulberry32(seed);
            const a = [...arr];
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(rnd() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        };

        const shuffled = deterministicShuffle(pool, activePrompt?.name || 'default');
        return shuffled.slice(0, 3);
    }, [activePrompt?.name]);

    const applyCommand = (command: string) => {
        const matched = slashCommands.find(cmd => cmd.command === command);
        const nextValue = matched?.template || `${command} `;
        setInput(nextValue);
        setIsCommandMenuOpen(false);
        setActiveCommandIndex(0);
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (isCommandMenuOpen && filteredCommands.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveCommandIndex((prev) => (prev + 1) % filteredCommands.length);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveCommandIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
                return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                const selected = filteredCommands[activeCommandIndex];
                if (selected) applyCommand(selected.command);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setIsCommandMenuOpen(false);
                return;
            }
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (isLoading) return;
            handleSend(e);
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            const nextIndex = historyIndex + 1;
            if (nextIndex < promptHistory.length) {
                setHistoryIndex(nextIndex);
                setInput(promptHistory[nextIndex]);
            }
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const prevIndex = historyIndex - 1;
            if (prevIndex >= 0) {
                setHistoryIndex(prevIndex);
                setInput(promptHistory[prevIndex]);
            } else {
                setHistoryIndex(-1);
                setInput('');
            }
        }
    };

    // Listen for emoji celebration events
    useEffect(() => {
        const handleCelebration = (event: Event) => {
            const emoji = (event as CustomEvent<{ emoji?: string }>).detail?.emoji;
            if (emoji) {
                setCelebration({ emoji, timestamp: Date.now() });
            }
        };

        window.addEventListener('emoji-celebration', handleCelebration);
        return () => window.removeEventListener('emoji-celebration', handleCelebration);
    }, []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!event.shiftKey || event.key !== ',') return;
            const target = event.target as HTMLElement | null;
            const tagName = target?.tagName?.toLowerCase();
            if (tagName === 'input' || tagName === 'textarea' || target?.isContentEditable) return;
            event.preventDefault();
            setIsSettingsModalOpen(true);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <>
            {/* Emoji Celebration Animation */}
            <AnimatePresence>
                {celebration && (
                    <EmojiCelebration
                        emoji={celebration.emoji}
                        onComplete={() => setCelebration(null)}
                    />
                )}
            </AnimatePresence>

            {isPinned || embedded ? (
                <div className={cn(
                    "h-full border-[color:var(--border)] glass-card flex flex-col relative z-20 overflow-hidden min-w-0",
                    embedded ? "w-full border-r" : "w-[450px] border-l"
                )}>
                    {/* Header (Pinned) */}
                    <div className={cn("border-b border-[color:var(--border)] bg-[color:var(--card)]", embedded ? "p-3" : "p-6")}>
                        <div className={cn("flex items-center justify-between", contentWidthClass)}>
                            <div className="flex items-center gap-3">
                                <BrainCircuit size={20} className="text-sky-400" />
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                                            <span className="text-[8px] text-muted-foreground uppercase tracking-[0.2em] font-bold">System Online</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setChatScope(chatScope === 'repo' ? 'workspace' : 'repo')}
                                            className={cn(
                                                "inline-flex items-center gap-2 text-[10px] rounded-lg px-2 py-1 border transition-colors",
                                                chatScope === 'repo'
                                                    ? "text-emerald-200 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20"
                                                    : "text-sky-200 bg-sky-500/10 border-sky-500/20 hover:bg-sky-500/20"
                                            )}
                                            title={chatScope === 'repo' ? 'Switch to File Manager scope' : 'Switch to Repo Apps scope'}
                                        >
                                            {chatScope === 'repo' ? <GitBranch size={12} className="text-emerald-300" /> : <Folder size={12} className="text-sky-300" />}
                                            <span className="uppercase tracking-wider font-bold">
                                                {chatScope === 'repo' ? 'Repo Apps' : 'File Manager'}
                                            </span>
                                        </button>
                                        {activeAppContext && (
                                            <div className="inline-flex items-center gap-2 text-[10px] text-sky-200 bg-sky-500/10 border border-sky-500/20 rounded-lg px-2 py-1 w-fit">
                                                <FolderOpen size={12} className="text-sky-300" />
                                                <span className="truncate max-w-[160px]" title={activeAppContext.path}>
                                                    {activeAppContext.name}
                                                </span>
                                                <button
                                                    onClick={() => {
                                                        setActiveAppContext(null);
                                                        setChatScope('workspace');
                                                    }}
                                                    className="p-1 theme-text-secondary hover:theme-text-secondary/80"
                                                    title="Clear active app context"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    {isBackgroundBusy && (
                                        <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg animate-pulse">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-lg shadow-amber-400/50" />
                                                    <span className="text-[10px] text-amber-300 uppercase tracking-wider font-bold">
                                                        {backgroundJobLabel || 'Processing'}
                                                    </span>
                                                </div>
                                                {elapsedTime > 0 && (
                                                    <span className="text-[9px] font-mono text-muted-foreground">
                                                        {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
                                                    </span>
                                                )}
                                            </div>
                                            {backgroundJobMessage && (
                                                <p className="text-[10px] text-foreground/70 leading-relaxed pl-4">
                                                    {backgroundJobMessage}
                                                </p>
                                            )}
                                            <div className="mt-1 text-[9px] text-amber-400/70 flex items-center gap-1 pl-4">
                                                <Activity size={10} />
                                                Background activity
                                            </div>
                                        </div>
                                    )}

                                    {/* activeAppContext pill now inline above */}
                                </div>
                            </div>

                            <div className="flex items-center gap-1">
                                {headerRight}
                                <button
                                    onClick={copyAllChatsTranscripts}
                                    disabled={isCopyingAllChats}
                                    className="p-2 hover:theme-overlay-subtle rounded-lg theme-text-tertiary hover:theme-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Copy all chats"
                                >
                                    {isCopyingAllChats ? <Loader2 size={18} className="animate-spin" /> : <Layers size={18} />}
                                </button>
                                <button
                                    onClick={copyCurrentChatTranscript}
                                    disabled={isCopyingCurrentChat}
                                    className="p-2 hover:theme-overlay-subtle rounded-lg theme-text-tertiary hover:theme-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Copy current chat"
                                >
                                    {isCopyingCurrentChat ? <Loader2 size={18} className="animate-spin" /> : <Copy size={18} />}
                                </button>
                                <button
                                    onClick={() => setIsSuggestionsOpen(true)}
                                    className="p-2 hover:bg-sky-500/10 rounded-lg text-sky-400/70 hover:text-sky-300 transition-colors"
                                    title="Browse Ideas Library"
                                >
                                    <Lightbulb size={18} />
                                </button>
                                <button
                                    onClick={() => setView(view === 'sessions' ? 'chat' : 'sessions')}
                                    className="p-2 hover:theme-overlay-subtle rounded-lg theme-text-tertiary hover:theme-text-primary transition-colors"
                                    title="Chat Sessions"
                                >
                                    <MessageSquare size={18} />
                                </button>
                                <button
                                    onClick={() => setIsSettingsModalOpen(true)}
                                    className="p-2 hover:theme-overlay-subtle rounded-lg theme-text-tertiary hover:theme-text-primary transition-colors"
                                    title="Chat Settings"
                                >
                                    <Settings size={18} />
                                </button>
                                <button
                                    onClick={() => toggleIsMetricsPanelOpen()}
                                    className={cn(
                                        "p-2 rounded-lg transition-colors relative",
                                        isMetricsPanelOpen ? "bg-purple-500/10 text-purple-400" : "hover:theme-overlay-subtle theme-text-tertiary hover:theme-text-primary"
                                    )}
                                    title="Session Metrics"
                                >
                                    <Activity size={18} />
                                </button>
                                {!embedded && (
                                    <button
                                        onClick={togglePin}
                                        className="p-2 hover:theme-overlay-subtle rounded-lg text-sky-400 transition-colors"
                                        title="Unpin from UI"
                                    >
                                        <PinOff size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Content Area (Pinned) */}
                    <div className="flex-1 overflow-hidden relative min-w-0 min-h-0">
                        <AnimatePresence mode="wait">
                            {view === 'chat' ? (
                                <div
                                    className="h-full flex flex-col relative min-w-0 min-h-0 overflow-hidden"
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        setIsDragging(true);
                                    }}
                                    onDragLeave={() => setIsDragging(false)}
                                    onDrop={handleComposerDrop}
                                >
                                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                        <motion.div
                                            className="absolute -left-24 -top-32 w-2/3 h-2/3 bg-gradient-to-br from-cyan-500/12 via-sky-500/10 to-indigo-600/8 blur-3xl rounded-full"
                                            animate={{ x: [0, 25, -15, 0], y: [0, -20, 10, 0] }}
                                            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
                                        />
                                        <motion.div
                                            className="absolute -right-16 bottom-[-15%] w-2/3 h-2/3 bg-gradient-to-tr from-emerald-500/10 via-cyan-500/12 to-sky-400/10 blur-3xl rounded-full"
                                            animate={{ x: [0, -20, 15, 0], y: [0, 18, -12, 0] }}
                                            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
                                        />
                                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(56,189,248,0.08),transparent_45%),radial-gradient(circle_at_80%_20%,rgba(94,234,212,0.08),transparent_40%),radial-gradient(circle_at_50%_80%,rgba(14,165,233,0.05),transparent_45%)]" />
                                    </div>
                                    {isDragging && (
                                        <div className="absolute inset-0 z-[100] bg-sky-500/10 backdrop-blur-sm border-2 border-dashed border-sky-500/40 rounded-[2rem] flex flex-col items-center justify-center pointer-events-none m-4">
                                            <div className="bg-[color:var(--card)] shadow-2xl p-6 rounded-[2rem] border border-[color:var(--border)] flex flex-col items-center gap-4 animate-bounce">
                                                <div className="p-4 bg-sky-500/10 rounded-2xl text-sky-400">
                                                    <Paperclip size={32} />
                                                </div>
                                                <div className="text-center">
                                                    <p className="theme-text-primary font-bold">Drop to Attach</p>
                                                    <p className="theme-text-tertiary text-[10px] uppercase font-bold tracking-widest mt-1">Context Injection</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div
                                        ref={scrollRef}
                                        className="flex-1 overflow-y-auto overflow-x-hidden p-6 custom-scrollbar relative min-w-0 min-h-0"
                                        onScroll={(e) => {
                                            const target = e.target as HTMLDivElement;
                                            const { scrollHeight, scrollTop, clientHeight } = target;
                                            const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;

                                            isNearBottomRef.current = isNearBottom;
                                            setShowScrollButton(!isNearBottom && messages.length > 3);

                                            // User is scrolling up - lock auto-scroll
                                            if (!isNearBottom) {
                                                setShouldAutoScroll(false);
                                                setIsUserScrolling(true);
                                            } else {
                                                // Back at bottom - re-enable auto-scroll
                                                setShouldAutoScroll(true);
                                                setIsUserScrolling(false);
                                            }

                                            // Clear any pending scroll timeout
                                            if (scrollTimeoutRef.current) {
                                                clearTimeout(scrollTimeoutRef.current);
                                            }

                                            // Debounce scroll state
                                            scrollTimeoutRef.current = setTimeout(() => {
                                                setIsUserScrolling(false);
                                            }, 150);
                                        }}
                                    >
                                        <div className={cn("space-y-8 pb-8", contentWidthClass)}>
                                            {messages.length === 0 && (
                                                <div className="flex flex-col items-center justify-center text-center space-y-6 py-12 px-4 mt-8 relative overflow-hidden">
                                                    <div className="pointer-events-none absolute inset-0 opacity-70">
                                                        <div className="absolute -left-24 -top-12 w-2/3 h-2/3 bg-gradient-to-br from-cyan-500/8 via-sky-500/6 to-indigo-700/8 blur-3xl rounded-full" />
                                                        <div className="absolute -right-10 bottom-[-15%] w-1/2 h-1/2 bg-gradient-to-tr from-emerald-500/10 via-cyan-500/10 to-sky-400/8 blur-3xl rounded-full" />
                                                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(56,189,248,0.06),transparent_45%),radial-gradient(circle_at_75%_25%,rgba(94,234,212,0.05),transparent_40%),radial-gradient(circle_at_50%_80%,rgba(14,165,233,0.04),transparent_45%)]" />
                                                        <motion.div
                                                            className="absolute left-1/4 bottom-1/3 w-2 h-2 rounded-full bg-cyan-200/70"
                                                            animate={{ y: [10, -70], opacity: [0.9, 0.2] }}
                                                            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                                                        />
                                                        <motion.div
                                                            className="absolute right-1/3 bottom-1/4 w-2.5 h-2.5 rounded-full bg-emerald-200/70"
                                                            animate={{ y: [20, -60], opacity: [0.85, 0.15] }}
                                                            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
                                                        />
                                                        <motion.div
                                                            className="absolute left-1/2 bottom-1/4 w-1.5 h-1.5 rounded-full bg-sky-300/70"
                                                            animate={{ y: [12, -65], opacity: [0.8, 0.1] }}
                                                            transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
                                                        />
                                                    </div>
                                                    <div className="relative group">
                                                        <div className="absolute inset-0 bg-gradient-to-r from-sky-500/20 via-emerald-500/20 to-amber-400/20 blur-3xl rounded-full scale-150 group-hover:scale-[2] transition-all duration-1000" />
                                                        <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center border border-white/20 text-sky-400 relative z-10 shadow-2xl backdrop-blur-xl">
                                                            <Sparkles size={48} className="drop-shadow-2xl" />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2 relative z-10">
                                                        <p className="theme-text-tertiary text-[10px] leading-relaxed uppercase tracking-[0.3em] font-bold">
                                                            Agent Ready
                                                        </p>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-3 w-full pt-4 relative z-10">
                                                        <button
                                                            onClick={() => setIsSuggestionsOpen(true)}
                                                            className="group p-5 bg-sky-600/10 border border-sky-500/20 rounded-2xl text-left transition-all hover:bg-sky-600/20 hover:border-sky-500/30 shadow-xl shadow-sky-500/5 backdrop-blur-xl relative overflow-hidden"
                                                        >
                                                            <div className="absolute inset-0 bg-gradient-to-r from-sky-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            <div className="relative flex items-center gap-4">
                                                                <div className="p-3 bg-sky-600/20 rounded-xl text-sky-400 group-hover:scale-110 transition-transform">
                                                                    <Compass size={22} />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <h4 className="text-[11px] font-black theme-text-primary uppercase tracking-widest mb-1">Explore Idea Library</h4>
                                                                    <p className="text-[10px] theme-text-tertiary leading-relaxed font-medium">Browse high-quality strategic flows and multi-step task instructions.</p>
                                                                </div>
                                                                <ChevronRight size={18} className="theme-text-quaternary group-hover:translate-x-1 group-hover:text-sky-400 transition-all" />
                                                            </div>
                                                        </button>

                                                        <div className="grid grid-cols-1 gap-2 pt-2">
                                                            {quickTips.map((tip, ix) => (
                                                                <button
                                                                    key={ix}
                                                                    onClick={() => setInput(prev => {
                                                                        const text = tip.text;
                                                                        if (!prev.trim()) return text;
                                                                        return `${prev.trim()} ${text}`;
                                                                    })}
                                                                    className="group p-4 theme-overlay-subtle border theme-border-medium rounded-2xl text-left text-xs theme-text-secondary hover:theme-text-primary hover:theme-border-strong hover:theme-overlay-medium transition-all duration-300 active:scale-[0.98] backdrop-blur-xl shadow-lg hover:shadow-xl relative overflow-hidden"
                                                                >
                                                                    <div className="absolute inset-0 bg-gradient-to-r from-sky-500/0 via-emerald-500/5 to-amber-400/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                                                    <div className="relative flex items-center gap-3">
                                                                        <span className="text-2xl">{tip.icon}</span>
                                                                        <span className="flex-1 font-medium">{tip.text}</span>
                                                                        <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            {messages.map((msg, i) => (
                                                <MessageBubble
                                                    key={msg.id || `${msg.role}-${i}-${String(msg.content || '').slice(0, 30)}`}
                                                    msg={msg}
                                                    attachedFiles={attachedFiles}
                                                    showThinking={showThinkingTrace}
                                                    setInput={setInput}
                                                    setActiveTool={setActiveTool}
                                                    onApproveOnce={() => approveFromBubble(false)}
                                                    onApproveAlways={() => approveFromBubble(true)}
                                                />
                                            ))}


                                            {toolStatusEvents.length > 0 && (
                                                <ToolTimeline events={toolStatusEvents} className="pt-2" />
                                            )}

                                            {isLoading && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="flex flex-col items-start gap-3"
                                                >
                                                    <div className="relative group w-full max-w-xl">
                                                        <div className="absolute inset-0 bg-gradient-to-r from-sky-500/20 via-emerald-500/20 to-amber-400/20 rounded-[1.5rem] blur-xl opacity-60 group-hover:opacity-100 transition-opacity" />
                                                        <div className="relative theme-overlay-medium px-6 py-5 rounded-[1.5rem] rounded-tl-none border theme-border-medium backdrop-blur-xl shadow-2xl">
                                                            <div className="flex items-start gap-4">
                                                                <div className="flex gap-1.5 pt-1">
                                                                    <div className="w-2.5 h-2.5 bg-gradient-to-r from-sky-400 to-emerald-400 rounded-full shadow-lg shadow-sky-400/50 animate-pulse" />
                                                                    <div className="w-2.5 h-2.5 bg-gradient-to-r from-emerald-400 to-amber-300 rounded-full shadow-lg shadow-emerald-400/50 animate-pulse" style={{ animationDelay: '150ms' }} />
                                                                    <div className="w-2.5 h-2.5 bg-gradient-to-r from-amber-300 to-sky-400 rounded-full shadow-lg shadow-amber-300/50 animate-pulse" style={{ animationDelay: '300ms' }} />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <span className="text-xs font-bold tracking-wider uppercase bg-gradient-to-r from-sky-300 via-emerald-300 to-amber-300 bg-clip-text text-transparent">
                                                                            {streamingStatus === 'connecting' && 'Connecting to AI...'}
                                                                            {streamingStatus === 'streaming' && 'Receiving Response'}
                                                                            {streamingStatus === 'processing' && 'Finalizing'}
                                                                            {streamingStatus === 'idle' && (isBackgroundBusy ? (backgroundJobLabel || 'Processing') : 'Thinking')}
                                                                        </span>
                                                                        {streamingStatus === 'streaming' && (
                                                                            <span className="text-[10px] text-sky-400/60 font-mono">
                                                                                {streamProgress}%
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {aiActivity && (
                                                                        <motion.div
                                                                            initial={{ opacity: 0, x: -10 }}
                                                                            animate={{ opacity: 1, x: 0 }}
                                                                            className="text-[11px] text-muted-foreground/60 font-medium mb-2"
                                                                        >
                                                                            {aiActivity}
                                                                        </motion.div>
                                                                    )}
                                                                    {streamingStatus !== 'idle' && (
                                                                        <div className="w-full h-1 bg-foreground/5 rounded-full overflow-hidden">
                                                                            <motion.div
                                                                                className="h-full bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-400"
                                                                                initial={{ width: '0%' }}
                                                                                animate={{ width: `${streamProgress}%` }}
                                                                                transition={{ duration: 0.3 }}
                                                                            />
                                                                        </div>
                                                                    )}
                                                                    {isBackgroundBusy && backgroundJobLabel && (
                                                                        <div className="text-[8px] text-muted-foreground/50 uppercase tracking-widest font-bold mt-2 flex items-center gap-1.5">
                                                                            <div className="w-1.5 h-1.5 bg-emerald-400/70 rounded-full animate-pulse" />
                                                                            Background Agent Active
                                                                        </div>
                                                                    )}

                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground/30 italic px-2">
                                                        💡 You can continue typing below while I work...
                                                    </div>
                                                </motion.div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Premium Scroll Button */}
                                    <AnimatePresence>
                                        {showScrollButton && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                                                className="absolute bottom-32 right-8 z-20 flex flex-col items-end gap-2"
                                            >
                                                {(isLoading || isBackgroundBusy) && (
                                                    <motion.div
                                                        initial={{ opacity: 0, x: 20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        className="px-3 py-1.5 bg-sky-500/20 border border-sky-500/30 rounded-full text-[10px] text-sky-300 font-medium backdrop-blur-xl shadow-lg flex items-center gap-2"
                                                    >
                                                        <div className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-pulse" />
                                                        New activity below
                                                    </motion.div>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        setShouldAutoScroll(true);
                                                        setIsUserScrolling(false);
                                                        scrollRef.current?.scrollTo({
                                                            top: scrollRef.current.scrollHeight,
                                                            behavior: 'smooth'
                                                        });
                                                    }}
                                                    className="p-3 bg-gradient-to-r from-sky-600 to-emerald-500 hover:from-sky-500 hover:to-emerald-400 rounded-full shadow-2xl shadow-sky-500/50 hover:shadow-sky-500/70 border border-white/20 backdrop-blur-xl transition-all duration-300 hover:scale-110 active:scale-95 group"
                                                    title="Resume auto-scroll"
                                                >
                                                    <ArrowDown size={20} className="text-white group-hover:animate-bounce" />
                                                </button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div className="relative z-50 p-6 border-t border-[color:var(--border)] bg-[color:var(--card)] backdrop-blur-xl">
                                        <div className={cn(contentWidthClass)}>
                                            {activeQuestions.length > 0 && (
                                                <QuestionWizard
                                                    questions={activeQuestions}
                                                    onSubmit={handleQuestionSubmit}
                                                    onCancel={() => setDismissedQuestionId(messages[messages.length - 1]?.id || null)}
                                                />
                                            )}
                                            <div className="flex flex-col gap-3">
                                                <form onSubmit={handleSend} className="relative group/input">
                                                    <div className="absolute -inset-0.5 bg-gradient-to-r from-sky-500/20 via-emerald-500/20 to-amber-400/20 rounded-[1.25rem] opacity-0 group-focus-within/input:opacity-100 blur-xl transition-opacity duration-500" />
                                                    <div className="relative">
                                                        {renderAttachedContextTray('pinned')}
                                                        <div className="flex flex-col sm:flex-row-reverse items-start sm:items-center gap-3 w-full min-w-0">
                                                            <div className="w-full sm:w-64 max-w-xs min-w-0 flex flex-col gap-1 sm:h-full sm:justify-center">
                                                                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                                                                    <div className="flex items-center gap-2 shrink-0">
                                                                        <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 font-bold">Agent</span>
                                                                        {isSwitchingAgent && <Loader2 size={12} className="animate-spin text-sky-400" />}
                                                                    </div>
                                                                    <div className="relative group/underwater sm:flex-1">
                                                                        {/* Underwater wave animation */}
                                                                        <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none opacity-0 group-hover/underwater:opacity-100 transition-opacity duration-500">
                                                                            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-blue-500/30 to-cyan-500/20 animate-[wave_3s_ease-in-out_infinite]"
                                                                                style={{
                                                                                    backgroundSize: '200% 100%',
                                                                                    animation: 'wave 3s ease-in-out infinite'
                                                                                }}
                                                                            />
                                                                            {/* Floating bubbles */}
                                                                            <div className="absolute bottom-0 left-[20%] w-1 h-1 rounded-full bg-cyan-300/60 animate-[bubble_2s_ease-in_infinite]" />
                                                                            <div className="absolute bottom-0 left-[50%] w-1.5 h-1.5 rounded-full bg-blue-200/50 animate-[bubble_2.5s_ease-in_infinite_0.5s]" />
                                                                            <div className="absolute bottom-0 left-[75%] w-1 h-1 rounded-full bg-cyan-400/70 animate-[bubble_3s_ease-in_infinite_1s]" />
                                                                        </div>
                                                                        <select
                                                                            value={activeAgentId}
                                                                            onChange={(e) => handleSetActive(e.target.value)}
                                                                            disabled={prompts.length === 0 || isSwitchingAgent}
                                                                            className="relative w-full h-11 bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-cyan-400/10 border border-cyan-500/30 rounded-xl px-3 pr-8 text-[10px] text-cyan-100/90 focus:outline-none focus:border-cyan-400/60 focus:shadow-[0_0_20px_rgba(6,182,212,0.3)] backdrop-blur-xl transition-all duration-300 hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] hover:border-cyan-400/50 cursor-pointer appearance-none bg-right bg-no-repeat"
                                                                            title="Switch agent"
                                                                            style={{
                                                                                backgroundImage: `linear-gradient(to bottom, transparent 0%, rgba(6, 182, 212, 0.1) 100%)`,
                                                                                textShadow: '0 0 10px rgba(6, 182, 212, 0.5)'
                                                                            }}
                                                                        >
                                                                            {prompts.length === 0 && <option value="">No agents</option>}
                                                                            {prompts.map(p => (
                                                                                <option key={p.id} value={p.id} className="bg-[color:var(--card)] text-foreground">
                                                                                    {p.name}
                                                                                </option>
                                                                            ))}
                                                                        </select>
                                                                        {/* Dropdown arrow with underwater effect */}
                                                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                                                            <ChevronDown size={14} className="text-cyan-300/70 group-hover/underwater:text-cyan-200 transition-colors" />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div
                                                                className="relative flex-1 w-full min-w-0"
                                                                suppressHydrationWarning
                                                            >
                                                                <textarea
                                                                    rows={1}
                                                                    value={input}
                                                                    onChange={handleInputChange}
                                                                    onKeyDown={handleInputKeyDown}
                                                                    spellCheck={false}
                                                                    data-grammarly="false"
                                                                    data-grammarly-editor="false"
                                                                    data-enable-grammarly="false"
                                                                    placeholder={isLoading ? "AI is working above... you can queue another message" : (isBackgroundBusy ? "Background agent active. You can continue chatting..." : "Ask anything...")}
                                                                    className={cn(
                                                                        "relative z-20 w-full bg-foreground/[0.03] backdrop-blur-xl border border-[color:var(--border)] rounded-[1.25rem] py-4 pl-5 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-sky-500/40 focus:bg-foreground/[0.05] transition-all duration-300 resize-none shadow-2xl shadow-black/5 font-medium",
                                                                        isBackgroundBusy ? "pr-28" : "pr-16",
                                                                        isLoading && "border-sky-500/20 theme-overlay-subtle"
                                                                    )}
                                                                    style={{ minHeight: '52px', maxHeight: '200px' }}
                                                                />
                                                                {isCommandMenuOpen && filteredCommands.length > 0 && (
                                                                    <div className="absolute bottom-full mb-3 left-0 w-full z-50 bg-[color:var(--card)] border border-[color:var(--border)] rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl">
                                                                        <div className="text-[10px] theme-text-tertiary px-4 py-2 border-b theme-border-subtle uppercase tracking-widest">Commands</div>
                                                                        <div className="max-h-52 overflow-y-auto">
                                                                            {filteredCommands.map((cmd, idx) => (
                                                                                <button
                                                                                    key={cmd.command}
                                                                                    onClick={() => applyCommand(cmd.command)}
                                                                                    className={cn(
                                                                                        "w-full text-left px-4 py-2 flex items-center justify-between text-xs transition-colors",
                                                                                        idx === activeCommandIndex ? "theme-overlay-medium theme-text-primary" : "theme-text-tertiary hover:theme-text-primary hover:theme-overlay-subtle"
                                                                                    )}
                                                                                >
                                                                                    <div>
                                                                                        <div className="font-mono text-[11px]">{cmd.command}</div>
                                                                                        <div className="text-[10px] theme-text-tertiary">{cmd.description}</div>
                                                                                    </div>
                                                                                    <span className="text-[10px] theme-text-quaternary">{cmd.label}</span>
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {isBackgroundBusy && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={handleStopAgents}
                                                                        className="absolute right-16 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all duration-300 shadow-xl shadow-red-500/40 group/stop"
                                                                        title="Stop all agent activity"
                                                                    >
                                                                        <Square size={14} fill="white" className="group-hover:scale-110 transition-transform" />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    type="submit"
                                                                    disabled={!input.trim() && attachedFiles.length === 0}
                                                                    className={cn(
                                                                        "absolute right-3 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-xl transition-all duration-300 shadow-lg",
                                                                        input.trim() || attachedFiles.length > 0
                                                                            ? isLoading
                                                                                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 hover:scale-110 active:scale-95 shadow-emerald-500/50"
                                                                                : "bg-gradient-to-r from-sky-600 to-emerald-500 text-white hover:from-sky-500 hover:to-emerald-400 hover:scale-110 active:scale-95 shadow-sky-500/50"
                                                                            : "theme-overlay-subtle theme-text-quaternary cursor-not-allowed"
                                                                    )}
                                                                    title={isLoading ? "Queue next message" : "Send message"}
                                                                >
                                                                    <Send size={16} className={(input.trim() || attachedFiles.length > 0) && !isLoading ? "animate-pulse" : ""} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {input.length > 0 && (
                                                        <div className="absolute -top-6 right-0 text-[9px] theme-text-quaternary font-mono">
                                                            {input.length} chars
                                                        </div>
                                                    )}
                                                </form>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : view === 'sessions' ? (
                                renderSessionsView()
                            ) : (
                                <div className="h-full p-6 overflow-y-auto custom-scrollbar">
                                    <div className={cn("space-y-4", embedded ? "max-w-3xl mx-auto" : "")}>
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-[10px] font-black uppercase theme-text-quaternary tracking-widest">Archetypes</h4>
                                            <button onClick={() => { setEditingPromptId(null); setNewPrompt({ name: '', description: '', prompt: '', tools: DEFAULT_SKILLS, workflows: [], triggerKeywords: [] }); setIsEditorOpen(true); }} className="p-2 bg-sky-500/80 hover:bg-sky-500 rounded-lg text-white transition-colors">
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                        <div className="space-y-3">
                                            {prompts.map(p => {
                                                const stats = getPromptCapabilityStats(p);
                                                return (
                                                    <div key={p.id} className={cn("p-4 rounded-2xl border transition-all", p.isActive ? "bg-sky-500/10 border-sky-400/30" : "theme-overlay-subtle theme-border-subtle")}>
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-[12px] font-bold theme-text-primary truncate">{p.name}</span>
                                                            <div className="flex gap-1 shrink-0">
                                                                {!p.isActive && <button onClick={() => handleSetActive(p.id)} className="p-1.5 theme-overlay-subtle theme-text-tertiary hover:theme-text-primary rounded-lg"><Check size={14} /></button>}
                                                                <button onClick={() => startEditing(p)} className="p-1.5 theme-overlay-subtle theme-text-tertiary hover:theme-text-primary rounded-lg"><Edit2 size={14} /></button>
                                                            </div>
                                                        </div>
                                                        <div className="mt-2 flex items-center gap-2 text-[9px] theme-text-quaternary">
                                                            <span className="px-2 py-0.5 rounded-full theme-overlay-subtle border theme-border-medium">Tools {stats.toolIds.length}</span>
                                                            <span className="px-2 py-0.5 rounded-full theme-overlay-subtle border theme-border-medium">Skills {stats.skillIds.length}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                    <SessionMetricsPanel
                        sessionId={activeSessionId}
                        isOpen={isMetricsPanelOpen}
                        onClose={() => setIsMetricsPanelOpen(false)}
                    />
                </div >
            ) : (
                <div className="fixed bottom-8 right-8 z-[9999] flex flex-col items-end gap-4 font-sans">
                    <AnimatePresence>
                        {isOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 30, scale: 0.9, filter: 'blur(10px)' }}
                                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                                exit={{ opacity: 0, y: 30, scale: 0.9, filter: 'blur(10px)' }}
                                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                className="glass-card w-full sm:w-[500px] md:w-[800px] xl:w-[1100px] max-w-[calc(100vw-2rem)] h-[85vh] min-w-0 flex flex-col shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] border border-white/20 rounded-[2.5rem] overflow-hidden backdrop-blur-3xl relative"
                            >
                                <div className="p-5 border-b border-[color:var(--border)] bg-[color:var(--card)] flex items-center justify-between min-w-0">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-sky-500/10 rounded-xl text-sky-400">
                                            <BrainCircuit size={18} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-1 h-1 rounded-full bg-emerald-500" />
                                                    <span className="text-[8px] text-muted-foreground uppercase tracking-[0.2em] font-bold">Core Active</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setChatScope(chatScope === 'repo' ? 'workspace' : 'repo')}
                                                    className={cn(
                                                        "inline-flex items-center gap-2 text-[10px] rounded-lg px-2 py-1 border transition-colors",
                                                        chatScope === 'repo'
                                                            ? "text-emerald-200 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20"
                                                            : "text-sky-200 bg-sky-500/10 border-sky-500/20 hover:bg-sky-500/20"
                                                    )}
                                                    title={chatScope === 'repo' ? 'Switch to File Manager scope' : 'Switch to Repo Apps scope'}
                                                >
                                                    {chatScope === 'repo' ? <GitBranch size={12} className="text-emerald-300" /> : <Folder size={12} className="text-sky-300" />}
                                                    <span className="uppercase tracking-wider font-bold">
                                                        {chatScope === 'repo' ? 'Repo Apps' : 'File Manager'}
                                                    </span>
                                                </button>
                                                {activeAppContext && (
                                                    <div className="inline-flex items-center gap-2 text-[10px] text-sky-200 bg-sky-500/10 border border-sky-500/20 rounded-lg px-2 py-1 w-fit">
                                                        <FolderOpen size={12} className="text-sky-300" />
                                                        <span className="truncate max-w-[160px]" title={activeAppContext.path}>
                                                            {activeAppContext.name}
                                                        </span>
                                                        <button
                                                            onClick={() => {
                                                                setActiveAppContext(null);
                                                                setChatScope('workspace');
                                                            }}
                                                            className="p-1 theme-text-secondary hover:theme-text-secondary/80"
                                                            title="Clear active app context"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            {isBackgroundBusy && (
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <div className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
                                                    <span className="text-[8px] text-amber-200/80 uppercase tracking-[0.2em] font-bold">
                                                        Background Agent Active{backgroundJobLabel ? `: ${backgroundJobLabel}` : ''}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={copyAllChatsTranscripts}
                                            disabled={isCopyingAllChats}
                                            className="p-2.5 rounded-full transition-all theme-overlay-subtle theme-border-subtle border theme-text-tertiary hover:theme-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Copy all chats"
                                        >
                                            {isCopyingAllChats ? <Loader2 size={18} className="animate-spin" /> : <Layers size={18} />}
                                        </button>
                                        <button
                                            onClick={copyCurrentChatTranscript}
                                            disabled={isCopyingCurrentChat}
                                            className="p-2.5 rounded-full transition-all theme-overlay-subtle theme-border-subtle border theme-text-tertiary hover:theme-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Copy current chat"
                                        >
                                            {isCopyingCurrentChat ? <Loader2 size={18} className="animate-spin" /> : <Copy size={18} />}
                                        </button>
                                        <button
                                            onClick={() => setIsSuggestionsOpen(true)}
                                            className="p-2.5 hover:bg-sky-500/10 rounded-full transition-all text-sky-400/70 hover:text-sky-300"
                                            title="Browse Ideas Library"
                                        >
                                            <Lightbulb size={20} />
                                        </button>
                                        <button
                                            onClick={togglePin}
                                            className="p-2.5 hover:theme-overlay-medium rounded-full transition-all theme-text-tertiary hover:theme-text-primary"
                                            title="Pin to Dashboard"
                                        >
                                            <Pin size={20} />
                                        </button>
                                        <button
                                            onClick={() => setView(view === 'sessions' ? 'chat' : 'sessions')}
                                            className="p-2.5 rounded-full transition-all border theme-overlay-subtle theme-border-subtle theme-text-tertiary hover:theme-text-primary"
                                            title="Chat Sessions"
                                        >
                                            <MessageSquare size={20} />
                                        </button>
                                        <button
                                            onClick={() => setIsSettingsModalOpen(true)}
                                            className="p-2.5 rounded-full transition-all border theme-overlay-subtle theme-border-subtle theme-text-tertiary hover:theme-text-primary"
                                            title="Chat Settings"
                                        >
                                            <Settings size={20} />
                                        </button>
                                        <button
                                            onClick={() => toggleIsMetricsPanelOpen()}
                                            className={cn(
                                                "p-2.5 rounded-full transition-all border theme-overlay-subtle theme-border-subtle",
                                                isMetricsPanelOpen ? "bg-purple-500/10 text-purple-400 border-purple-500/20" : "theme-text-tertiary hover:theme-text-primary"
                                            )}
                                            title="Session Metrics"
                                        >
                                            <Activity size={20} />
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (isPinned) setIsPinned(false);
                                                setIsOpen(false);
                                            }}
                                            className={cn(
                                                "p-2.5 hover:theme-overlay-medium rounded-full transition-all theme-text-tertiary hover:theme-text-primary hover:scale-110 active:scale-95",
                                                embedded && "hidden"
                                            )}
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>
                                </div>
                                <SessionMetricsPanel
                                    sessionId={activeSessionId}
                                    isOpen={isMetricsPanelOpen}
                                    onClose={() => setIsMetricsPanelOpen(false)}
                                />

                                {/* Content Area */}
                                <div className="flex-1 overflow-hidden relative min-w-0 min-h-0">
                                    <AnimatePresence mode="wait">
                                        {view === 'chat' ? (
                                            <motion.div
                                                key="chat"
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                className="h-full flex flex-col relative min-w-0 min-h-0 overflow-hidden"
                                                onDragOver={(e) => {
                                                    e.preventDefault();
                                                    setIsDragging(true);
                                                }}
                                                onDragLeave={() => setIsDragging(false)}
                                                onDrop={handleComposerDrop}
                                            >
                                                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                                    <motion.div
                                                        className="absolute -left-24 -top-32 w-2/3 h-2/3 bg-gradient-to-br from-cyan-500/12 via-sky-500/10 to-indigo-600/8 blur-3xl rounded-full"
                                                        animate={{ x: [0, 25, -15, 0], y: [0, -20, 10, 0] }}
                                                        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
                                                    />
                                                    <motion.div
                                                        className="absolute -right-16 bottom-[-15%] w-2/3 h-2/3 bg-gradient-to-tr from-emerald-500/10 via-cyan-500/12 to-sky-400/10 blur-3xl rounded-full"
                                                        animate={{ x: [0, -20, 15, 0], y: [0, 18, -12, 0] }}
                                                        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
                                                    />
                                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(56,189,248,0.08),transparent_45%),radial-gradient(circle_at_80%_20%,rgba(94,234,212,0.08),transparent_40%),radial-gradient(circle_at_50%_80%,rgba(14,165,233,0.05),transparent_45%)]" />
                                                </div>
                                                {isDragging && (
                                                    <div className="absolute inset-0 z-[100] bg-sky-500/10 backdrop-blur-sm border-2 border-dashed border-sky-500/40 rounded-[2rem] flex flex-col items-center justify-center pointer-events-none m-4">
                                                        <div className="bg-[color:var(--card)] shadow-2xl p-6 rounded-[2rem] border border-[color:var(--border)] flex flex-col items-center gap-4 animate-bounce">
                                                            <div className="p-4 bg-sky-500/10 rounded-2xl text-sky-400">
                                                                <Paperclip size={32} />
                                                            </div>
                                                            <div className="text-center">
                                                                <p className="theme-text-primary font-bold">Drop to Attach</p>
                                                                <p className="theme-text-tertiary text-[10px] uppercase font-bold tracking-widest mt-1">Context Injection</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                <div
                                                    ref={scrollRef}
                                                    className="flex-1 overflow-y-auto overflow-x-hidden p-7 custom-scrollbar bg-foreground/[0.02] relative min-w-0 min-h-0"
                                                    onScroll={(e) => {
                                                        const target = e.target as HTMLDivElement;
                                                        const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 100;
                                                        setShowScrollButton(!isNearBottom && messages.length > 3);
                                                    }}
                                                >
                                                    <div className={cn("space-y-8 pb-8 min-h-full", contentWidthClass)}>
                                                        {messages.length === 0 && (
                                                            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 px-12 relative overflow-hidden">
                                                                <div className="pointer-events-none absolute inset-0 opacity-70">
                                                                    <div className="absolute -left-24 -top-12 w-2/3 h-2/3 bg-gradient-to-br from-cyan-500/8 via-sky-500/6 to-indigo-700/8 blur-3xl rounded-full" />
                                                                    <div className="absolute -right-10 bottom-[-15%] w-1/2 h-1/2 bg-gradient-to-tr from-emerald-500/10 via-cyan-500/10 to-sky-400/8 blur-3xl rounded-full" />
                                                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(56,189,248,0.06),transparent_45%),radial-gradient(circle_at_75%_25%,rgba(94,234,212,0.05),transparent_40%),radial-gradient(circle_at_50%_80%,rgba(14,165,233,0.04),transparent_45%)]" />
                                                                    <motion.div
                                                                        className="absolute left-1/4 bottom-1/3 w-2 h-2 rounded-full bg-cyan-200/70"
                                                                        animate={{ y: [10, -70], opacity: [0.9, 0.2] }}
                                                                        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                                                                    />
                                                                    <motion.div
                                                                        className="absolute right-1/3 bottom-1/4 w-2.5 h-2.5 rounded-full bg-emerald-200/70"
                                                                        animate={{ y: [20, -60], opacity: [0.85, 0.15] }}
                                                                        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
                                                                    />
                                                                    <motion.div
                                                                        className="absolute left-1/2 bottom-1/4 w-1.5 h-1.5 rounded-full bg-sky-300/70"
                                                                        animate={{ y: [12, -65], opacity: [0.8, 0.1] }}
                                                                        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
                                                                    />
                                                                </div>

                                                                <div className="relative group">
                                                                    <div className="absolute inset-0 bg-gradient-to-r from-sky-500/20 via-emerald-500/20 to-amber-400/20 blur-3xl rounded-full scale-150 group-hover:scale-[2] transition-all duration-1000" />
                                                                    <motion.div
                                                                        animate={{
                                                                            rotate: [0, 360],
                                                                            scale: [1, 1.05, 1]
                                                                        }}
                                                                        transition={{
                                                                            rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                                                                            scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                                                                        }}
                                                                        className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center border border-white/20 text-sky-400 relative z-10 shadow-2xl backdrop-blur-xl"
                                                                    >
                                                                        <Sparkles size={48} className="drop-shadow-2xl" />
                                                                    </motion.div>
                                                                </div>
                                                                <div className="space-y-2 relative z-10">
                                                                    <motion.p
                                                                        initial={{ opacity: 0, y: 10 }}
                                                                        animate={{ opacity: 1, y: 0 }}
                                                                        transition={{ delay: 0.3 }}
                                                                        className="theme-text-tertiary text-[10px] leading-relaxed uppercase tracking-[0.3em] font-bold"
                                                                    >
                                                                        Agent Ready
                                                                    </motion.p>
                                                                </div>
                                                                <motion.div
                                                                    initial={{ opacity: 0, y: 20 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    transition={{ delay: 0.4 }}
                                                                    className="grid grid-cols-1 gap-3 w-full pt-4 relative z-10"
                                                                >
                                                                    <motion.button
                                                                        onClick={() => setInput('/scaffold-vite')}
                                                                        className="group p-5 bg-sky-600/10 border border-sky-500/20 rounded-2xl text-left transition-all hover:bg-sky-600/20 hover:border-sky-500/30 shadow-xl shadow-sky-500/5 backdrop-blur-xl relative overflow-hidden"
                                                                    >
                                                                        <div className="absolute inset-0 bg-gradient-to-r from-sky-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                        <div className="relative flex items-center gap-4">
                                                                            <div className="p-3 bg-sky-600/20 rounded-xl text-sky-400 group-hover:scale-110 transition-transform">
                                                                                <Compass size={22} />
                                                                            </div>
                                                                            <div className="flex-1">
                                                                                <h4 className="text-[11px] font-black theme-text-primary uppercase tracking-widest mb-1">Create New App or Feature</h4>
                                                                                <p className="text-[10px] theme-text-tertiary leading-relaxed font-medium">Scaffold a modern app stack from scratch with one click.</p>
                                                                            </div>
                                                                            <ChevronRight size={18} className="theme-text-quaternary group-hover:translate-x-1 group-hover:text-sky-400 transition-all" />
                                                                        </div>
                                                                    </motion.button>

                                                                    {quickTips.map((tip, ix) => (
                                                                        <motion.button
                                                                            key={ix}
                                                                            initial={{ opacity: 0, x: -20 }}
                                                                            animate={{ opacity: 1, x: 0 }}
                                                                            transition={{ delay: 0.5 + ix * 0.1 }}
                                                                            onClick={() => setInput(tip.text)}
                                                                            className="group p-4 theme-overlay-subtle border theme-border-medium rounded-2xl text-left text-xs theme-text-secondary hover:theme-text-primary hover:theme-border-strong hover:theme-overlay-medium transition-all duration-300 active:scale-[0.98] backdrop-blur-xl shadow-lg hover:shadow-xl relative overflow-hidden"
                                                                        >
                                                                            <div className="absolute inset-0 bg-gradient-to-r from-sky-500/0 via-emerald-500/5 to-amber-400/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                                                            <div className="relative flex items-center gap-3">
                                                                                <span className="text-2xl">{tip.icon}</span>
                                                                                <span className="flex-1 font-medium">{tip.text}</span>
                                                                                <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                            </div>
                                                                        </motion.button>
                                                                    ))}
                                                                </motion.div>
                                                            </div>
                                                        )}

                                                        {truncationReport && (
                                                            <div className="mb-4 px-4 sticky top-0 z-10">
                                                                <TruncationReport
                                                                    report={truncationReport}
                                                                    onDismiss={() => setTruncationReport(null)}
                                                                />
                                                            </div>
                                                        )}

                                                        {messages.map((msg, i) => (
                                                            <MessageBubble
                                                                key={i}
                                                                msg={msg}
                                                                attachedFiles={attachedFiles}
                                                                showThinking={showThinkingTrace}
                                                                setInput={setInput}
                                                                setActiveTool={setActiveTool}
                                                                onApproveOnce={() => approveFromBubble(false)}
                                                                onApproveAlways={() => approveFromBubble(true)}
                                                            />
                                                        ))}


                                                        {isLoading && (
                                                            <motion.div
                                                                initial={{ opacity: 0, y: 10 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                className="flex flex-col items-start gap-2"
                                                            >
                                                                <div className="relative group">
                                                                    {/* Glow effect */}
                                                                    <div className="absolute inset-0 bg-gradient-to-r from-sky-500/20 via-emerald-500/20 to-amber-400/20 rounded-[1.5rem] blur-xl opacity-60 group-hover:opacity-100 transition-opacity" />

                                                                    <div className="relative theme-overlay-medium px-6 py-5 rounded-[1.5rem] theme-text-tertiary flex items-center gap-4 rounded-tl-none border theme-border-medium backdrop-blur-xl shadow-2xl">
                                                                        <div className="flex gap-1.5">
                                                                            <motion.span
                                                                                animate={{
                                                                                    scale: [1, 1.3, 1],
                                                                                    opacity: [0.3, 1, 0.3]
                                                                                }}
                                                                                transition={{ repeat: Infinity, duration: 1.2 }}
                                                                                className="w-2.5 h-2.5 bg-gradient-to-r from-sky-400 to-emerald-400 rounded-full shadow-lg shadow-sky-400/50"
                                                                            />
                                                                            <motion.span
                                                                                animate={{
                                                                                    scale: [1, 1.3, 1],
                                                                                    opacity: [0.3, 1, 0.3]
                                                                                }}
                                                                                transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }}
                                                                                className="w-2.5 h-2.5 bg-gradient-to-r from-emerald-400 to-amber-300 rounded-full shadow-lg shadow-emerald-400/50"
                                                                            />
                                                                            <motion.span
                                                                                animate={{
                                                                                    scale: [1, 1.3, 1],
                                                                                    opacity: [0.3, 1, 0.3]
                                                                                }}
                                                                                transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }}
                                                                                className="w-2.5 h-2.5 bg-gradient-to-r from-amber-300 to-sky-400 rounded-full shadow-lg shadow-amber-300/50"
                                                                            />
                                                                        </div>
                                                                        <div className="flex flex-col">
                                                                            <span className="text-xs font-bold tracking-widest uppercase bg-gradient-to-r from-sky-300 via-emerald-300 to-amber-300 bg-clip-text text-transparent">
                                                                                {isBackgroundBusy ? (backgroundJobLabel || "Computing") : "Computing"}...
                                                                            </span>
                                                                            {isBackgroundBusy && backgroundJobLabel && (
                                                                                <span className="text-[8px] theme-text-quaternary uppercase tracking-widest font-bold mt-0.5">
                                                                                    Background Specialist Active
                                                                                </span>
                                                                            )}
                                                                            {backgroundJobMessage && (
                                                                                <span className="text-[10px] theme-text-secondary mt-1 italic max-w-[300px] truncate block font-mono">
                                                                                    {backgroundJobMessage}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </div>

                                                    {/* Premium Scroll to Bottom Button */}
                                                    <AnimatePresence>
                                                        {showScrollButton && (
                                                            <motion.button
                                                                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                                                                onClick={() => {
                                                                    scrollRef.current?.scrollTo({
                                                                        top: scrollRef.current.scrollHeight,
                                                                        behavior: 'smooth'
                                                                    });
                                                                }}
                                                                className="absolute bottom-24 right-8 z-20 p-3 bg-gradient-to-r from-sky-600 to-emerald-500 hover:from-sky-500 hover:to-emerald-400 rounded-full shadow-2xl shadow-sky-500/50 hover:shadow-sky-500/70 border border-white/20 backdrop-blur-xl transition-all duration-300 hover:scale-110 active:scale-95 group"
                                                                title="Scroll to bottom"
                                                            >
                                                                <ArrowDown size={20} className="text-white group-hover:animate-bounce" />
                                                                <div className="absolute inset-0 bg-gradient-to-r from-sky-400/20 to-emerald-400/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            </motion.button>
                                                        )}
                                                    </AnimatePresence>
                                                </div>

                                                {/* Input Area - Premium Design */}
                                                <div className="relative p-6 border-t theme-border-medium bg-gradient-to-b from-black/20 to-black/60 backdrop-blur-xl">
                                                    {/* Gradient accent line */}
                                                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sky-500/50 to-transparent" />

                                                    {activeQuestions.length > 0 && (
                                                        <QuestionWizard
                                                            questions={activeQuestions}
                                                            onSubmit={handleQuestionSubmit}
                                                            onCancel={() => setDismissedQuestionId(messages[messages.length - 1]?.id || null)}
                                                        />
                                                    )}

                                                    <div className={cn(contentWidthClass)}>
                                                        <div className="flex flex-col gap-3">
                                                            <form onSubmit={handleSend} className="relative group/input">
                                                                {/* Glow effect on focus */}
                                                                <div className="absolute -inset-0.5 bg-gradient-to-r from-sky-500/20 via-emerald-500/20 to-amber-400/20 rounded-[1.25rem] opacity-0 group-focus-within/input:opacity-100 blur-xl transition-opacity duration-500" />

                                                                <div className="relative">
                                                                    {renderAttachedContextTray('floating')}
                                                                    <div className="flex flex-col sm:flex-row items-start gap-3 w-full min-w-0">
                                                                        <div className="w-full sm:w-64 max-w-xs min-w-0 flex flex-col gap-1">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-[9px] uppercase tracking-[0.2em] theme-text-quaternary font-bold">Agent</span>
                                                                                {isSwitchingAgent && <Loader2 size={12} className="animate-spin text-sky-400" />}
                                                                            </div>
                                                                            <div className="relative group/underwater">
                                                                                {/* Underwater wave animation */}
                                                                                <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none opacity-0 group-hover/underwater:opacity-100 transition-opacity duration-500">
                                                                                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-blue-500/30 to-cyan-500/20"
                                                                                        style={{
                                                                                            backgroundSize: '200% 100%',
                                                                                            animation: 'wave 3s ease-in-out infinite'
                                                                                        }}
                                                                                    />
                                                                                    {/* Floating bubbles */}
                                                                                    <div className="absolute bottom-0 left-[20%] w-1 h-1 rounded-full bg-cyan-300/60 animate-[bubble_2s_ease-in_infinite]" />
                                                                                    <div className="absolute bottom-0 left-[50%] w-1.5 h-1.5 rounded-full bg-blue-200/50 animate-[bubble_2.5s_ease-in_infinite_0.5s]" />
                                                                                    <div className="absolute bottom-0 left-[75%] w-1 h-1 rounded-full bg-cyan-400/70 animate-[bubble_3s_ease-in_infinite_1s]" />
                                                                                </div>
                                                                                <select
                                                                                    value={activeAgentId}
                                                                                    onChange={(e) => handleSetActive(e.target.value)}
                                                                                    disabled={prompts.length === 0 || isSwitchingAgent}
                                                                                    className="relative w-full bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-cyan-400/10 border border-cyan-500/30 rounded-xl px-3 py-1.5 text-[10px] text-cyan-100/90 focus:outline-none focus:border-cyan-400/60 focus:shadow-[0_0_20px_rgba(6,182,212,0.3)] backdrop-blur-xl transition-all duration-300 hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] hover:border-cyan-400/50 cursor-pointer appearance-none pr-8"
                                                                                    title="Switch agent"
                                                                                    style={{
                                                                                        backgroundImage: `linear-gradient(to bottom, transparent 0%, rgba(6, 182, 212, 0.1) 100%)`,
                                                                                        textShadow: '0 0 10px rgba(6, 182, 212, 0.5)'
                                                                                    }}
                                                                                >
                                                                                    {prompts.length === 0 && <option value="">No agents</option>}
                                                                                    {prompts.map(p => (
                                                                                        <option key={p.id} value={p.id} className="bg-[color:var(--card)] text-foreground">
                                                                                            {p.name}
                                                                                        </option>
                                                                                    ))}
                                                                                </select>
                                                                                {/* Dropdown arrow with underwater effect */}
                                                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                                                                    <ChevronDown size={14} className="text-cyan-300/70 group-hover/underwater:text-cyan-200 transition-colors" />
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        <div className="relative flex-1 w-full min-w-0">
                                                                            <textarea
                                                                                rows={1}
                                                                                value={input}
                                                                                onChange={handleInputChange}
                                                                                onKeyDown={handleInputKeyDown}
                                                                                placeholder={isBackgroundBusy ? "Background agent active. You can continue chatting..." : "Ask anything..."}
                                                                                className={cn(
                                                                                    "relative z-20 w-full theme-overlay-subtle backdrop-blur-xl border theme-border-medium rounded-[1.25rem] py-4 pl-5 text-[13px] theme-text-primary placeholder:theme-text-quaternary focus:outline-none focus:border-sky-500/40 focus:theme-overlay-medium transition-all duration-300 resize-none shadow-2xl shadow-black/20 font-medium",
                                                                                    isBackgroundBusy ? "pr-28" : "pr-16"
                                                                                )}
                                                                                style={{
                                                                                    minHeight: '52px',
                                                                                    maxHeight: '200px'
                                                                                }}
                                                                                spellCheck={false}
                                                                                data-gramm="false"
                                                                                data-lt-active="false"
                                                                                suppressHydrationWarning
                                                                            />
                                                                            {isCommandMenuOpen && filteredCommands.length > 0 && (
                                                                                <div className="absolute bottom-full mb-3 left-0 w-full z-10 bg-[#0f172a] border theme-border-medium rounded-2xl shadow-2xl overflow-hidden">
                                                                                    <div className="text-[10px] theme-text-tertiary px-4 py-2 border-b theme-border-subtle uppercase tracking-widest">Commands</div>
                                                                                    <div className="max-h-52 overflow-y-auto">
                                                                                        {filteredCommands.map((cmd, idx) => (
                                                                                            <button
                                                                                                key={cmd.command}
                                                                                                onClick={() => applyCommand(cmd.command)}
                                                                                                className={cn(
                                                                                                    "w-full text-left px-4 py-2 flex items-center justify-between text-xs transition-colors",
                                                                                                    idx === activeCommandIndex ? "theme-overlay-medium theme-text-primary" : "theme-text-tertiary hover:theme-text-primary hover:theme-overlay-subtle"
                                                                                                )}
                                                                                            >
                                                                                                <div>
                                                                                                    <div className="font-mono text-[11px]">{cmd.command}</div>
                                                                                                    <div className="text-[10px] theme-text-tertiary">{cmd.description}</div>
                                                                                                </div>
                                                                                                <span className="text-[10px] theme-text-quaternary">{cmd.label}</span>
                                                                                            </button>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                            {isBackgroundBusy && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={handleStopAgents}
                                                                                    className="absolute right-16 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all duration-300 shadow-xl shadow-red-500/40 group/stop"
                                                                                    title="Stop all agent activity"
                                                                                >
                                                                                    <Square size={14} fill="white" className="group-hover:scale-110 transition-transform" />
                                                                                </button>
                                                                            )}
                                                                            <button
                                                                                type="submit"
                                                                                disabled={!input.trim() && attachedFiles.length === 0}
                                                                                className={cn(
                                                                                    "absolute right-3 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-xl transition-all duration-300 shadow-lg",
                                                                                    input.trim() || attachedFiles.length > 0
                                                                                        ? isLoading
                                                                                            ? "bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-500 hover:to-emerald-500 hover:scale-110 active:scale-95 shadow-green-500/50"
                                                                                            : "bg-gradient-to-r from-sky-600 to-emerald-500 text-white hover:from-sky-500 hover:to-emerald-400 hover:scale-110 active:scale-95 shadow-sky-500/50"
                                                                                        : "theme-overlay-subtle theme-text-quaternary cursor-not-allowed"
                                                                                )}
                                                                                title={isLoading ? "Queue next message" : "Send message"}
                                                                            >
                                                                                <Send size={16} className={input.trim() || attachedFiles.length > 0 ? "animate-pulse" : ""} />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Character count / hint */}
                                                                {input.length > 0 && (
                                                                    <motion.div
                                                                        initial={{ opacity: 0, y: -10 }}
                                                                        animate={{ opacity: 1, y: 0 }}
                                                                        className="absolute -top-6 right-0 text-[9px] text-white/30 font-mono"
                                                                    >
                                                                        {input.length} chars
                                                                    </motion.div>
                                                                )}
                                                            </form>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ) : view === 'sessions' ? (
                                            <motion.div
                                                key="sessions"
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 20 }}
                                                className="h-full flex flex-col p-7 overflow-y-auto custom-scrollbar bg-foreground/[0.02] space-y-6"
                                            >
                                                {renderSessionsView()}
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                key="prompts"
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 20 }}
                                                className="h-full flex flex-col p-7 overflow-y-auto custom-scrollbar bg-foreground/[0.02] space-y-6"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <h4 className="theme-text-primary font-bold text-xl tracking-tight leading-none uppercase text-[12px] opacity-40 font-black">Agent Archetypes</h4>
                                                    <button
                                                        onClick={() => {
                                                            setEditingPromptId(null);
                                                            setNewPrompt({ name: '', description: '', prompt: '', tools: DEFAULT_SKILLS, workflows: [], triggerKeywords: [] });
                                                            setIsEditorOpen(true);
                                                        }}
                                                        className="p-3 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl shadow-xl shadow-sky-500/20 transition-all active:scale-95"
                                                    >
                                                        <Plus size={20} />
                                                    </button>
                                                </div>

                                                <div className="space-y-4 pb-20">
                                                    {prompts.map(p => {
                                                        const stats = getPromptCapabilityStats(p);
                                                        return (
                                                            <div
                                                                key={p.id}
                                                                className={cn(
                                                                    "group relative overflow-hidden p-6 rounded-[2.5rem] border transition-all",
                                                                    p.isActive
                                                                        ? "bg-gradient-to-br from-sky-600/20 to-emerald-600/20 border-sky-500/40 shadow-xl shadow-sky-500/10"
                                                                        : "theme-overlay-subtle theme-border-subtle hover:theme-border-medium"
                                                                )}
                                                            >
                                                                <div className="flex items-start justify-between relative z-10 gap-4">
                                                                    <div className="space-y-1 flex-1">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="theme-text-primary font-bold text-lg leading-tight">{p.name}</span>
                                                                            {p.isActive && (
                                                                                <div className="px-2 py-0.5 bg-emerald-500 rounded-full text-[8px] font-black uppercase text-white shadow-lg tracking-widest">
                                                                                    Tactical
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-xs theme-text-tertiary leading-relaxed max-w-[280px] line-clamp-2">
                                                                            {p.description || "Experimental prompt template."}
                                                                        </p>
                                                                        <div className="mt-2 flex items-center gap-2 text-[9px] theme-text-quaternary">
                                                                            <span className="px-2 py-0.5 rounded-full theme-overlay-subtle border theme-border-medium">Tools {stats.toolIds.length}</span>
                                                                            <span className="px-2 py-0.5 rounded-full theme-overlay-subtle border theme-border-medium">Skills {stats.skillIds.length}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex flex-col gap-2 shrink-0">
                                                                        <div className="flex gap-2">
                                                                            <button
                                                                                onClick={() => startEditing(p)}
                                                                                className="p-2.5 theme-overlay-subtle theme-text-tertiary hover:theme-overlay-medium hover:theme-text-primary rounded-xl transition-all border theme-border-subtle"
                                                                                title="Edit Instructions"
                                                                            >
                                                                                <Edit2 size={16} />
                                                                            </button>
                                                                        </div>
                                                                        <div className="flex gap-2 items-center">
                                                                            {!p.isActive && (
                                                                                <button
                                                                                    onClick={() => handleSetActive(p.id)}
                                                                                    className="flex-1 py-1.5 px-3 bg-sky-500/20 text-sky-400 hover:bg-sky-500 hover:text-white rounded-xl transition-all shadow-lg text-[9px] font-black uppercase tracking-widest"
                                                                                >
                                                                                    Deploy
                                                                                </button>
                                                                            )}
                                                                            <button
                                                                                onClick={() => handleDeletePrompt(p.id)}
                                                                                className="p-2.5 bg-red-500/10 text-red-100/20 hover:bg-red-500 hover:text-white rounded-xl transition-all border border-red-500/10"
                                                                            >
                                                                                <Trash2 size={16} />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Preview snippet */}
                                                                <div className="mt-4 p-4 bg-black/40 rounded-2xl border theme-border-subtle text-[10px] theme-text-quaternary font-mono line-clamp-2 leading-relaxed italic">
                                                                    {p.prompt}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </motion.div>
                        )
                        }
                    </AnimatePresence>

                    {/* Float Button */}
                    <motion.button
                        layoutId="ai-trigger"
                        whileHover={{ scale: 1.05, y: -4 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsOpen(!isOpen)}
                        className={
                            cn(
                                "p-4 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center gap-3 transition-all border backdrop-blur-xl relative overflow-hidden group",
                                isOpen
                                    ? "bg-[color:var(--card)] theme-border-medium theme-text-secondary"
                                    : "bg-gradient-to-br from-sky-600 to-emerald-600 border-sky-400/30 text-white"
                            )
                        }
                    >
                        <div className="relative">
                            <Bot size={24} className={cn(isOpen ? "rotate-90 opacity-40" : "animate-pulse")} />
                            {attachedFiles.length > 0 && (
                                <span className="absolute -top-2 -right-2 w-4 h-4 bg-emerald-500 text-[8px] font-black rounded-full flex items-center justify-center shadow-xl ring-2 ring-white/20">
                                    {attachedFiles.length}
                                </span>
                            )}
                        </div>
                        {
                            !isOpen && (
                                <div className="flex flex-col items-start pr-2">
                                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] leading-none mb-1 opacity-60">Signal</span>
                                    <span className="text-sm font-bold tracking-tight">Agent Hub</span>
                                </div>
                            )
                        }
                    </motion.button>
                </div>
            )
            }

            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.txt,.md,.json,.csv,.log,.doc,.docx,.xls,.xlsx"
                className="hidden"
                onChange={async (event) => {
                    if (event.target.files?.length) {
                        await handleNativeFilesAdded(event.target.files);
                    }
                }}
            />

            {/* Global Modals - Rendered outside of layout containers to avoid clipping */}
            {isSettingsModalOpen && (
                <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                        onClick={() => setIsSettingsModalOpen(false)}
                    />
                    <div className="relative w-full max-w-2xl rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] shadow-2xl backdrop-blur-2xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[color:var(--border)]">
                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Chat Settings</h3>
                                <p className="text-[11px] text-muted-foreground">Configure scope, model, and response behavior.</p>
                            </div>
                            <button
                                onClick={() => setIsSettingsModalOpen(false)}
                                className="p-2 rounded-lg hover:theme-overlay-subtle text-foreground/60 hover:text-foreground transition-colors"
                                title="Close settings"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="space-y-2">
                                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Scope</div>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => setChatScope('workspace')}
                                        className={cn(
                                            "relative px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-300 border overflow-hidden group/scope-ws",
                                            chatScope === 'workspace'
                                                ? "bg-gradient-to-br from-cyan-500/20 via-blue-500/15 to-cyan-400/20 text-cyan-100 border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                                                : "theme-text-secondary theme-border-medium hover:text-cyan-200 hover:border-cyan-500/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                                        )}
                                    >
                                        {/* Underwater wave animation */}
                                        <div className="absolute inset-0 opacity-0 group-hover/scope-ws:opacity-100 transition-opacity duration-500 pointer-events-none">
                                            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-blue-500/30 to-cyan-500/20"
                                                style={{
                                                    backgroundSize: '200% 100%',
                                                    animation: 'wave 3s ease-in-out infinite'
                                                }}
                                            />
                                            <div className="absolute bottom-0 left-[30%] w-1 h-1 rounded-full bg-cyan-300/60 animate-[bubble_2s_ease-in_infinite]" />
                                            <div className="absolute bottom-0 left-[65%] w-1 h-1 rounded-full bg-blue-200/50 animate-[bubble_2.5s_ease-in_infinite_0.5s]" />
                                        </div>
                                        <div className="flex items-center gap-2 relative z-10">
                                            <Folder size={14} />
                                            File Manager
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => setChatScope('repo')}
                                        className={cn(
                                            "relative px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-300 border overflow-hidden group/scope-repo",
                                            chatScope === 'repo'
                                                ? "bg-gradient-to-br from-cyan-500/20 via-blue-500/15 to-cyan-400/20 text-cyan-100 border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                                                : "theme-text-secondary theme-border-medium hover:text-cyan-200 hover:border-cyan-500/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                                        )}
                                    >
                                        {/* Underwater wave animation */}
                                        <div className="absolute inset-0 opacity-0 group-hover/scope-repo:opacity-100 transition-opacity duration-500 pointer-events-none">
                                            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-blue-500/30 to-cyan-500/20"
                                                style={{
                                                    backgroundSize: '200% 100%',
                                                    animation: 'wave 3s ease-in-out infinite'
                                                }}
                                            />
                                            <div className="absolute bottom-0 left-[25%] w-1 h-1 rounded-full bg-cyan-300/60 animate-[bubble_2s_ease-in_infinite]" />
                                            <div className="absolute bottom-0 left-[70%] w-1 h-1 rounded-full bg-blue-200/50 animate-[bubble_2.5s_ease-in_infinite_0.5s]" />
                                        </div>
                                        <div className="flex items-center gap-2 relative z-10">
                                            <GitBranch size={14} />
                                            Repo Apps
                                        </div>
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Model</div>
                                <div className="relative group/underwater">
                                    {/* Underwater wave animation */}
                                    <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none opacity-0 group-hover/underwater:opacity-100 transition-opacity duration-500">
                                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-blue-500/30 to-cyan-500/20"
                                            style={{
                                                backgroundSize: '200% 100%',
                                                animation: 'wave 3s ease-in-out infinite'
                                            }}
                                        />
                                        {/* Floating bubbles */}
                                        <div className="absolute bottom-0 left-[20%] w-1 h-1 rounded-full bg-cyan-300/60 animate-[bubble_2s_ease-in_infinite]" />
                                        <div className="absolute bottom-0 left-[50%] w-1.5 h-1.5 rounded-full bg-blue-200/50 animate-[bubble_2.5s_ease-in_infinite_0.5s]" />
                                        <div className="absolute bottom-0 left-[75%] w-1 h-1 rounded-full bg-cyan-400/70 animate-[bubble_3s_ease-in_infinite_1s]" />
                                    </div>
                                    <div className="flex items-center gap-3 rounded-xl border border-cyan-500/40 bg-gradient-to-br from-cyan-500/20 via-blue-500/15 to-cyan-400/20 backdrop-blur-xl px-3 py-2 shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all duration-300 group-hover/underwater:shadow-[0_0_30px_rgba(6,182,212,0.5)] group-hover/underwater:border-cyan-400/60">
                                        <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-200 font-bold">Model</span>
                                        <select
                                            value={selectedModel}
                                            onChange={(e) => setSelectedModel(e.target.value)}
                                            className="bg-transparent text-[12px] text-cyan-100 font-bold tracking-wide focus:outline-none w-full cursor-pointer appearance-none pr-4 [&>option]:bg-[#020617] [&>option]:text-cyan-100"
                                            title="Select model"
                                            style={{
                                                textShadow: '0 0 10px rgba(6, 182, 212, 0.5)'
                                            }}
                                        >
                                            {MODEL_CATALOG.map(model => (
                                                <option key={model.id} value={model.id} className="bg-[#020617] text-cyan-100 hover:bg-cyan-900/30">
                                                    {model.label}
                                                </option>
                                            ))}
                                        </select>
                                        {/* Dropdown arrow with underwater effect */}
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                            <ChevronDown size={14} className="text-cyan-300 group-hover/underwater:text-cyan-100 transition-colors drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <div className="text-[10px] uppercase tracking-[0.2em] theme-text-tertiary font-bold">Thinking Trace</div>
                                    <button
                                        onClick={() => toggleShowThinkingTrace()}
                                        className={cn(
                                            "relative w-full px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-300 border flex items-center justify-between overflow-hidden group/thinking",
                                            showThinkingTrace
                                                ? "bg-gradient-to-br from-cyan-500/20 via-blue-500/15 to-cyan-400/20 text-cyan-100 border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                                                : "theme-text-secondary theme-border-medium hover:text-cyan-200 hover:border-cyan-500/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                                        )}
                                    >
                                        {/* Underwater wave animation */}
                                        <div className="absolute inset-0 opacity-0 group-hover/thinking:opacity-100 transition-opacity duration-500 pointer-events-none">
                                            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-blue-500/30 to-cyan-500/20"
                                                style={{
                                                    backgroundSize: '200% 100%',
                                                    animation: 'wave 3s ease-in-out infinite'
                                                }}
                                            />
                                            <div className="absolute bottom-0 left-[35%] w-1 h-1 rounded-full bg-cyan-300/60 animate-[bubble_2s_ease-in_infinite]" />
                                            <div className="absolute bottom-0 left-[65%] w-1 h-1 rounded-full bg-blue-200/50 animate-[bubble_2.5s_ease-in_infinite_0.5s]" />
                                        </div>
                                        <span className="relative z-10">{showThinkingTrace ? 'Shown' : 'Hidden'}</span>
                                        <Eye size={16} className="relative z-10" />
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    <div className="text-[10px] uppercase tracking-[0.2em] theme-text-tertiary font-bold">Verbosity</div>
                                    <div className="flex items-center gap-2">
                                        {(['concise', 'normal', 'verbose'] as const).map(level => (
                                            <button
                                                key={level}
                                                onClick={() => setVerbosity(level)}
                                                className={cn(
                                                    "relative flex-1 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-300 border overflow-hidden group/verb",
                                                    verbosity === level
                                                        ? "bg-gradient-to-br from-cyan-500/20 via-blue-500/15 to-cyan-400/20 text-cyan-100 border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                                                        : "theme-text-secondary theme-border-medium hover:text-cyan-200 hover:border-cyan-500/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                                                )}
                                            >
                                                {/* Underwater wave animation */}
                                                <div className="absolute inset-0 opacity-0 group-hover/verb:opacity-100 transition-opacity duration-500 pointer-events-none">
                                                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-blue-500/30 to-cyan-500/20"
                                                        style={{
                                                            backgroundSize: '200% 100%',
                                                            animation: 'wave 3s ease-in-out infinite'
                                                        }}
                                                    />
                                                    <div className="absolute bottom-0 left-[40%] w-1 h-1 rounded-full bg-cyan-300/60 animate-[bubble_2s_ease-in_infinite]" />
                                                </div>
                                                <span className="relative z-10">{level}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="text-[10px] uppercase tracking-[0.2em] theme-text-tertiary font-bold">Tool Execution</div>
                                <button
                                    onClick={() => toggleAllowToolExecution()}
                                    className={cn(
                                        "relative w-full px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-300 border flex items-center justify-between overflow-hidden group/tools",
                                        allowToolExecution
                                            ? "bg-gradient-to-br from-emerald-500/20 via-green-500/15 to-emerald-400/20 text-emerald-100 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                                            : "theme-text-secondary theme-border-medium hover:text-emerald-200 hover:border-emerald-500/30 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                                    )}
                                >
                                    <div className="absolute inset-0 opacity-0 group-hover/tools:opacity-100 transition-opacity duration-500 pointer-events-none">
                                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-green-500/30 to-emerald-500/20"
                                            style={{
                                                backgroundSize: '200% 100%',
                                                animation: 'wave 3s ease-in-out infinite'
                                            }}
                                        />
                                        <div className="absolute bottom-0 left-[35%] w-1 h-1 rounded-full bg-emerald-300/60 animate-[bubble_2s_ease-in_infinite]" />
                                        <div className="absolute bottom-0 left-[65%] w-1 h-1 rounded-full bg-green-200/50 animate-[bubble_2.5s_ease-in_infinite_0.5s]" />
                                    </div>
                                    <span className="relative z-10">{allowToolExecution ? 'Allowed' : 'Require approval'}</span>
                                    <Check size={16} className="relative z-10" />
                                </button>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[color:var(--border)]">
                                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                                    Shortcut: Shift + ,
                                </div>
                                <button
                                    onClick={() => {
                                        setView('prompts');
                                        setIsCreatingPrompt(false);
                                        setEditingPromptId(null);
                                        setNewPrompt({
                                            name: '',
                                            description: '',
                                            prompt: '',
                                            tools: DEFAULT_SKILLS,
                                            workflows: [],
                                            triggerKeywords: []
                                        });
                                        setIsSettingsModalOpen(false);
                                    }}
                                    className="px-4 py-2 rounded-xl theme-overlay-subtle border border-[color:var(--border)] text-[11px] font-bold uppercase tracking-wider text-foreground/70 hover:text-foreground hover:theme-overlay-medium transition-colors"
                                >
                                    Manage Prompts
                                </button>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setIsSettingsModalOpen(false)}
                                        className="px-4 py-2 rounded-xl bg-sky-500/80 hover:bg-sky-500 text-[11px] font-bold uppercase tracking-wider text-white transition-colors"
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <PromptEditorModal
                isOpen={isEditorOpen}
                onClose={() => {
                    setIsEditorOpen(false);
                    setEditingPromptId(null);
                }}
                onSave={handleSavePrompt}
                initialData={editingPromptId ? { ...newPrompt, workflows: newPrompt.workflows as WorkflowDefinition[] } : undefined}
                customIntents={intentRules as unknown as IntentRuleDefinition[]}
            />
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    if (isDeletingSession) return;
                    setIsDeleteModalOpen(false);
                    setPendingDeleteSessionId(null);
                }}
                onConfirm={confirmDeleteSession}
                title="Delete chat?"
                message="Deleting chats is a premium feature. This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                isDanger
                isLoading={isDeletingSession}
            />
            <ConfirmationModal
                isOpen={isClearAllModalOpen}
                onClose={() => {
                    if (isClearingAll) return;
                    setIsClearAllModalOpen(false);
                }}
                onConfirm={confirmClearAllSessions}
                title="Clear all chats?"
                message="This will permanently delete all your chat history. This action cannot be undone."
                confirmText="Clear All"
                cancelText="Cancel"
                isDanger
                isLoading={isClearingAll}
            />
            <FileEditPreviewModal
                isOpen={isEditPreviewOpen}
                onClose={() => setIsEditPreviewOpen(false)}
                fileName={editPreviewData.fileName}
                content={editPreviewData.content}
            />
            <SuggestionsLibraryModal
                isOpen={isSuggestionsOpen}
                onClose={() => setIsSuggestionsOpen(false)}
                onApply={handleApplySuggestion}
                workflowContext={{
                    messages: messages.slice(-10), // Last 10 messages
                    attachedFiles: attachedFiles.map(f => ({ id: f.id, name: f.name, type: f.type })),
                    activePrompt: activePrompt ? { name: activePrompt.name, description: activePrompt.description } : undefined
                }}
                workflowType="task-planning"
            />
        </>
    );
}

