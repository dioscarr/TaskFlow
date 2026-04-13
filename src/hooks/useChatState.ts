import { useReducer, useCallback } from 'react';
import { DEFAULT_CHAT_MODEL } from '@/lib/modelCatalog';
import type { WorkspaceFile, AIPromptSet, IntentRule } from '@prisma/client';
import { ToolStatusEvent } from '@/components/ai-chat/ToolTimeline';
import { TruncationReport as TruncationReportType } from '@/lib/contextBudget';

// Re-export for consumer convenience
export type { TruncationReportType };

import { WorkflowDefinition } from '@/lib/intentLibrary';

/* ------------------------------------------------------------------ */
/*  Shared Types                                                       */
/* ------------------------------------------------------------------ */

export type SelectedFile = {
    id: string;
    name: string;
    type: string;
    parentId?: string | null;
    storagePath?: string;
    createdAt?: Date;
    updatedAt?: Date;
};

export type ChatMessage = {
    id?: string;
    role: 'user' | 'ai' | 'model';
    content: string;
    files?: SelectedFile[];
    fileIds?: string[];
    toolUsed?: string;
    toolResult?: unknown;
    thinking?: string;
    toolArgs?: unknown;
    appliedContext?: {
        agent?: { id?: string; name?: string; description?: string };
        scope?: { mode?: string; label?: string };
        workflows?: Array<{ name?: string; stepCount?: number }>;
    };
};

export type PromptDraft = {
    name: string;
    description: string;
    prompt: string;
    tools: string[];
    workflows: WorkflowDefinition[];
    triggerKeywords: string[];
};

// Re-export for consumer convenience
export type { WorkflowDefinition };

/* ------------------------------------------------------------------ */
/*  Cross-render state cache (module-level singleton)                   */
/* ------------------------------------------------------------------ */

export const aiChatStateCache = {
    messages: [] as ChatMessage[],
    attachedFiles: [] as SelectedFile[],
    activeSessionId: null as string | null,
    activeSessionTitle: 'New Chat',
    currentFolderContext: { id: null as string | null, name: 'Root' },
    activePreviewContext: null as { id: string; name: string; parentId: string | null } | null,
    activeAppContext: null as { name: string; path: string } | null,
    selectedModel: DEFAULT_CHAT_MODEL,
    activeScope: 'workspace' as 'workspace' | 'repo',
    scopeBySession: {} as Record<string, 'workspace' | 'repo'>,
    allowToolExecution: true,
    allowToolExecutionBySession: {} as Record<string, boolean>,
    allowHighRiskExecution: false,
    allowHighRiskExecutionBySession: {} as Record<string, boolean>,
};

/* ------------------------------------------------------------------ */
/*  State shape                                                        */
/* ------------------------------------------------------------------ */

export interface ChatState {
    ui: {
        isOpen: boolean;
        view: 'chat' | 'prompts' | 'sessions';
        isPinned: boolean;
        showScrollButton: boolean;
        isUserScrolling: boolean;
        shouldAutoScroll: boolean;
        isDragging: boolean;
    };

    chat: {
        input: string;
        messages: ChatMessage[];
        isLoading: boolean;
        streamingStatus: 'idle' | 'connecting' | 'streaming' | 'processing';
        streamProgress: number;
        aiActivity: string;
        selectedModel: string;
        chatScope: 'workspace' | 'repo';
        historyIndex: number;
        promptHistory: string[];
        activeTool: string | null;
        verbosity: 'concise' | 'normal' | 'verbose';
        manualStop: boolean;
    };

    session: {
        activeSessionId: string | null;
        activeSessionTitle: string;
        chatSessions: Array<{
            id: string;
            title?: string | null;
            messages?: Array<{ content?: string | null }>;
            _count?: { messages?: number };
        }>;
        renamingSessionId: string | null;
        renamingSessionTitle: string;
        isDeleteModalOpen: boolean;
        pendingDeleteSessionId: string | null;
        isDeletingSession: boolean;
        isClearAllModalOpen: boolean;
        isClearingAll: boolean;
    };

    files: {
        attachedFiles: SelectedFile[];
        workspaceFiles: SelectedFile[];
        currentFolderContext: { id: string | null; name: string };
        activePreviewContext: { id: string; name: string; parentId: string | null } | null;
        activeAppContext: { name: string; path: string } | null;
        isUploadingFiles: boolean;
    };

    streaming: {
        isBackgroundBusy: boolean;
        backgroundJobLabel: string | null;
        backgroundJobMessage: string | null;
        jobStartTime: number | null;
        elapsedTime: number;
        isSwitchingAgent: boolean;
        toolStatusEvents: ToolStatusEvent[];
        truncationReport: TruncationReportType | null;
    };

    modals: {
        isEditorOpen: boolean;
        isSettingsModalOpen: boolean;
        isEditPreviewOpen: boolean;
        editPreviewData: { fileName: string; content: string };
        isSuggestionsOpen: boolean;
        isCommandMenuOpen: boolean;
        isApprovalModalOpen: boolean;
        isMetricsPanelOpen: boolean;
    };

    prompts: {
        prompts: AIPromptSet[];
        intentRules: IntentRule[];
        isCreatingPrompt: boolean;
        editingPromptId: string | null;
        isGenerating: boolean;
        newPrompt: PromptDraft;
    };

    copy: {
        isCopyingCurrentChat: boolean;
        isCopyingAllChats: boolean;
    };

    commands: {
        activeCommandIndex: number;
    };

    settings: {
        showThinkingTrace: boolean;
        allowToolExecution: boolean;
        allowHighRiskExecution: boolean;
        allowHighRiskOnce: boolean;
        autoOpenPreview: boolean;
    };

    misc: {
        celebration: { emoji: string; timestamp: number } | null;
        dismissedQuestionId: string | null;
        proposedTools: string[];
        highRiskTools: string[];
        pendingApprovalRequest: unknown | null;
    };
}

/* ------------------------------------------------------------------ */
/*  Initial state factory                                              */
/* ------------------------------------------------------------------ */

export const createInitialState = (embedded: boolean): ChatState => ({
    ui: {
        isOpen: embedded,
        view: 'chat',
        isPinned: false,
        showScrollButton: false,
        isUserScrolling: false,
        shouldAutoScroll: true,
        isDragging: false,
    },
    chat: {
        input: '',
        messages: aiChatStateCache.messages.length ? [...aiChatStateCache.messages] : [],
        isLoading: false,
        streamingStatus: 'idle',
        streamProgress: 0,
        aiActivity: '',
        selectedModel: aiChatStateCache.selectedModel || DEFAULT_CHAT_MODEL,
        chatScope: aiChatStateCache.activeScope || 'workspace',
        historyIndex: -1,
        promptHistory: [],
        activeTool: null,
        verbosity: 'concise',
        manualStop: false,
    },
    session: {
        activeSessionId: aiChatStateCache.activeSessionId,
        activeSessionTitle: aiChatStateCache.activeSessionTitle || 'New Chat',
        chatSessions: [],
        renamingSessionId: null,
        renamingSessionTitle: '',
        isDeleteModalOpen: false,
        pendingDeleteSessionId: null,
        isDeletingSession: false,
        isClearAllModalOpen: false,
        isClearingAll: false,
    },
    files: {
        attachedFiles: aiChatStateCache.attachedFiles || [],
        workspaceFiles: [],
        currentFolderContext: aiChatStateCache.currentFolderContext,
        activePreviewContext: aiChatStateCache.activePreviewContext,
        activeAppContext: aiChatStateCache.activeAppContext,
        isUploadingFiles: false,
    },
    streaming: {
        isBackgroundBusy: false,
        backgroundJobLabel: null,
        backgroundJobMessage: null,
        jobStartTime: null,
        elapsedTime: 0,
        isSwitchingAgent: false,
        toolStatusEvents: [],
        truncationReport: null,
    },
    modals: {
        isEditorOpen: false,
        isSettingsModalOpen: false,
        isEditPreviewOpen: false,
        editPreviewData: { fileName: '', content: '' },
        isSuggestionsOpen: false,
        isCommandMenuOpen: false,
        isApprovalModalOpen: false,
        isMetricsPanelOpen: false,
    },
    prompts: {
        prompts: [],
        intentRules: [],
        isCreatingPrompt: false,
        editingPromptId: null,
        isGenerating: false,
        newPrompt: {
            name: '',
            description: '',
            prompt: '',
            tools: [],
            workflows: [],
            triggerKeywords: [],
        },
    },
    copy: {
        isCopyingCurrentChat: false,
        isCopyingAllChats: false,
    },
    commands: {
        activeCommandIndex: 0,
    },
    settings: {
        showThinkingTrace: false,
        allowToolExecution: true,
        allowHighRiskExecution: false,
        allowHighRiskOnce: false,
        autoOpenPreview: true,
    },
    misc: {
        celebration: null,
        dismissedQuestionId: null,
        proposedTools: [],
        highRiskTools: [],
        pendingApprovalRequest: null,
    },
});

/* ------------------------------------------------------------------ */
/*  Actions                                                            */
/* ------------------------------------------------------------------ */

export type ChatAction =
    | { type: 'UPDATE_UI'; payload: Partial<ChatState['ui']> }
    | { type: 'UPDATE_CHAT'; payload: Partial<ChatState['chat']> }
    | { type: 'UPDATE_SESSION'; payload: Partial<ChatState['session']> }
    | { type: 'UPDATE_FILES'; payload: Partial<ChatState['files']> }
    | { type: 'UPDATE_STREAMING'; payload: Partial<ChatState['streaming']> }
    | { type: 'UPDATE_MODALS'; payload: Partial<ChatState['modals']> }
    | { type: 'UPDATE_PROMPTS'; payload: Partial<ChatState['prompts']> }
    | { type: 'UPDATE_COPY'; payload: Partial<ChatState['copy']> }
    | { type: 'UPDATE_COMMANDS'; payload: Partial<ChatState['commands']> }
    | { type: 'UPDATE_SETTINGS'; payload: Partial<ChatState['settings']> }
    | { type: 'UPDATE_MISC'; payload: Partial<ChatState['misc']> }
    | { type: 'SET_MESSAGES'; payload: ChatMessage[] }
    | { type: 'ADD_MESSAGE'; payload: ChatMessage }
    | { type: 'UPDATE_MESSAGE'; payload: { id: string; update: Partial<ChatMessage> } }
    | { type: 'SET_MESSAGES_FN'; payload: (prev: ChatMessage[]) => ChatMessage[] }
    | { type: 'SET_ATTACHED_FILES_FN'; payload: (prev: SelectedFile[]) => SelectedFile[] }
    | { type: 'SET_CHAT_SESSIONS_FN'; payload: (prev: ChatState['session']['chatSessions']) => ChatState['session']['chatSessions'] }
    | { type: 'SET_INPUT_FN'; payload: (prev: string) => string }
    | { type: 'SET_WORKSPACE_FILES_FN'; payload: (prev: SelectedFile[]) => SelectedFile[] }
    | { type: 'UPDATE_STREAM_PROGRESS_FN'; payload: (prev: number) => number }
    | { type: 'APPEND_TOOL_STATUS_EVENT'; payload: ToolStatusEvent }
    | { type: 'PREPEND_PROMPT_HISTORY'; payload: string }
    | { type: 'TOGGLE_MODALS_FIELD'; payload: keyof ChatState['modals'] }
    | { type: 'TOGGLE_SETTINGS_FIELD'; payload: keyof ChatState['settings'] }
    | { type: 'UPDATE_COMMAND_INDEX_FN'; payload: (prev: number) => number }
    | { type: 'RESET_CHAT' };

/* ------------------------------------------------------------------ */
/*  Reducer                                                            */
/* ------------------------------------------------------------------ */

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
    switch (action.type) {
        case 'UPDATE_UI':
            return { ...state, ui: { ...state.ui, ...action.payload } };
        case 'UPDATE_CHAT':
            return { ...state, chat: { ...state.chat, ...action.payload } };
        case 'UPDATE_SESSION':
            return { ...state, session: { ...state.session, ...action.payload } };
        case 'UPDATE_FILES':
            return { ...state, files: { ...state.files, ...action.payload } };
        case 'UPDATE_STREAMING':
            return { ...state, streaming: { ...state.streaming, ...action.payload } };
        case 'UPDATE_MODALS':
            return { ...state, modals: { ...state.modals, ...action.payload } };
        case 'UPDATE_PROMPTS':
            return { ...state, prompts: { ...state.prompts, ...action.payload } };
        case 'UPDATE_COPY':
            return { ...state, copy: { ...state.copy, ...action.payload } };
        case 'UPDATE_COMMANDS':
            return { ...state, commands: { ...state.commands, ...action.payload } };
        case 'UPDATE_SETTINGS':
            return { ...state, settings: { ...state.settings, ...action.payload } };
        case 'UPDATE_MISC':
            return { ...state, misc: { ...state.misc, ...action.payload } };

        case 'SET_MESSAGES':
            return { ...state, chat: { ...state.chat, messages: action.payload } };
        case 'ADD_MESSAGE':
            return { ...state, chat: { ...state.chat, messages: [...state.chat.messages, action.payload] } };
        case 'UPDATE_MESSAGE':
            return {
                ...state,
                chat: {
                    ...state.chat,
                    messages: state.chat.messages.map(m =>
                        m.id === action.payload.id ? { ...m, ...action.payload.update } : m
                    ),
                },
            };
        case 'SET_MESSAGES_FN':
            return { ...state, chat: { ...state.chat, messages: action.payload(state.chat.messages) } };
        case 'SET_ATTACHED_FILES_FN':
            return { ...state, files: { ...state.files, attachedFiles: action.payload(state.files.attachedFiles) } };
        case 'SET_CHAT_SESSIONS_FN':
            return { ...state, session: { ...state.session, chatSessions: action.payload(state.session.chatSessions) } };
        case 'SET_INPUT_FN':
            return { ...state, chat: { ...state.chat, input: action.payload(state.chat.input) } };
        case 'SET_WORKSPACE_FILES_FN':
            return { ...state, files: { ...state.files, workspaceFiles: action.payload(state.files.workspaceFiles) } };

        case 'UPDATE_STREAM_PROGRESS_FN':
            return { ...state, chat: { ...state.chat, streamProgress: action.payload(state.chat.streamProgress) } };
        case 'APPEND_TOOL_STATUS_EVENT':
            return { ...state, streaming: { ...state.streaming, toolStatusEvents: [...state.streaming.toolStatusEvents, action.payload] } };
        case 'PREPEND_PROMPT_HISTORY':
            return { ...state, chat: { ...state.chat, promptHistory: [action.payload, ...state.chat.promptHistory] } };
        case 'TOGGLE_MODALS_FIELD': {
            const field = action.payload;
            const current = state.modals[field];
            return { ...state, modals: { ...state.modals, [field]: typeof current === 'boolean' ? !current : current } };
        }
        case 'TOGGLE_SETTINGS_FIELD': {
            const field = action.payload;
            const current = state.settings[field];
            return { ...state, settings: { ...state.settings, [field]: typeof current === 'boolean' ? !current : current } };
        }
        case 'UPDATE_COMMAND_INDEX_FN':
            return { ...state, commands: { ...state.commands, activeCommandIndex: action.payload(state.commands.activeCommandIndex) } };

        case 'RESET_CHAT':
            return {
                ...state,
                chat: {
                    ...state.chat,
                    messages: [],
                    input: '',
                    historyIndex: -1,
                    activeTool: null,
                    isLoading: false,
                    streamingStatus: 'idle',
                    streamProgress: 0,
                    aiActivity: '',
                },
                files: { ...state.files, attachedFiles: [] },
                streaming: { ...state.streaming, toolStatusEvents: [] },
            };

        default:
            return state;
    }
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useChatState(embedded: boolean) {
    const [state, dispatch] = useReducer(chatReducer, embedded, createInitialState);

    /* ---- UI ---- */
    const setIsOpen = useCallback((v: boolean) => dispatch({ type: 'UPDATE_UI', payload: { isOpen: v } }), []);
    const setView = useCallback((v: ChatState['ui']['view']) => dispatch({ type: 'UPDATE_UI', payload: { view: v } }), []);
    const setIsPinned = useCallback((v: boolean) => dispatch({ type: 'UPDATE_UI', payload: { isPinned: v } }), []);
    const setShowScrollButton = useCallback((v: boolean) => dispatch({ type: 'UPDATE_UI', payload: { showScrollButton: v } }), []);
    const setIsUserScrolling = useCallback((v: boolean) => dispatch({ type: 'UPDATE_UI', payload: { isUserScrolling: v } }), []);
    const setShouldAutoScroll = useCallback((v: boolean) => dispatch({ type: 'UPDATE_UI', payload: { shouldAutoScroll: v } }), []);
    const setIsDragging = useCallback((v: boolean) => dispatch({ type: 'UPDATE_UI', payload: { isDragging: v } }), []);

    /* ---- Chat ---- */
    const setInput = useCallback((v: string | ((prev: string) => string)) => {
        if (typeof v === 'function') {
            dispatch({ type: 'SET_INPUT_FN', payload: v });
        } else {
            dispatch({ type: 'UPDATE_CHAT', payload: { input: v } });
        }
    }, []);
    const setMessages = useCallback((v: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
        if (typeof v === 'function') {
            dispatch({ type: 'SET_MESSAGES_FN', payload: v });
        } else {
            dispatch({ type: 'SET_MESSAGES', payload: v });
        }
    }, []);
    const setIsLoading = useCallback((v: boolean) => dispatch({ type: 'UPDATE_CHAT', payload: { isLoading: v } }), []);
    const setStreamingStatus = useCallback((v: ChatState['chat']['streamingStatus']) => dispatch({ type: 'UPDATE_CHAT', payload: { streamingStatus: v } }), []);
    const setStreamProgress = useCallback((v: number | ((prev: number) => number)) => {
        if (typeof v === 'function') {
            dispatch({ type: 'UPDATE_STREAM_PROGRESS_FN', payload: v });
        } else {
            dispatch({ type: 'UPDATE_CHAT', payload: { streamProgress: v } });
        }
    }, []);
    const setAiActivity = useCallback((v: string) => dispatch({ type: 'UPDATE_CHAT', payload: { aiActivity: v } }), []);
    const setSelectedModel = useCallback((v: string) => dispatch({ type: 'UPDATE_CHAT', payload: { selectedModel: v } }), []);
    const setChatScope = useCallback((v: 'workspace' | 'repo') => dispatch({ type: 'UPDATE_CHAT', payload: { chatScope: v } }), []);
    const setHistoryIndex = useCallback((v: number) => dispatch({ type: 'UPDATE_CHAT', payload: { historyIndex: v } }), []);
    const setPromptHistory = useCallback((v: string[]) => {
        dispatch({ type: 'UPDATE_CHAT', payload: { promptHistory: v } });
    }, []);
    const prependPromptHistory = useCallback((text: string) => {
        dispatch({ type: 'PREPEND_PROMPT_HISTORY', payload: text });
    }, []);
    const setActiveTool = useCallback((v: string | null) => dispatch({ type: 'UPDATE_CHAT', payload: { activeTool: v } }), []);
    const setVerbosity = useCallback((v: 'concise' | 'normal' | 'verbose') => dispatch({ type: 'UPDATE_CHAT', payload: { verbosity: v } }), []);
    const setManualStop = useCallback((v: boolean) => dispatch({ type: 'UPDATE_CHAT', payload: { manualStop: v } }), []);

    /* ---- Session ---- */
    const setActiveSessionId = useCallback((v: string | null) => dispatch({ type: 'UPDATE_SESSION', payload: { activeSessionId: v } }), []);
    const setActiveSessionTitle = useCallback((v: string) => dispatch({ type: 'UPDATE_SESSION', payload: { activeSessionTitle: v } }), []);
    const setChatSessions = useCallback((v: ChatState['session']['chatSessions'] | ((prev: ChatState['session']['chatSessions']) => ChatState['session']['chatSessions'])) => {
        if (typeof v === 'function') {
            dispatch({ type: 'SET_CHAT_SESSIONS_FN', payload: v });
        } else {
            dispatch({ type: 'UPDATE_SESSION', payload: { chatSessions: v } });
        }
    }, []);
    const setRenamingSessionId = useCallback((v: string | null) => dispatch({ type: 'UPDATE_SESSION', payload: { renamingSessionId: v } }), []);
    const setRenamingSessionTitle = useCallback((v: string) => dispatch({ type: 'UPDATE_SESSION', payload: { renamingSessionTitle: v } }), []);
    const setIsDeleteModalOpen = useCallback((v: boolean) => dispatch({ type: 'UPDATE_SESSION', payload: { isDeleteModalOpen: v } }), []);
    const setPendingDeleteSessionId = useCallback((v: string | null) => dispatch({ type: 'UPDATE_SESSION', payload: { pendingDeleteSessionId: v } }), []);
    const setIsDeletingSession = useCallback((v: boolean) => dispatch({ type: 'UPDATE_SESSION', payload: { isDeletingSession: v } }), []);
    const setIsClearAllModalOpen = useCallback((v: boolean) => dispatch({ type: 'UPDATE_SESSION', payload: { isClearAllModalOpen: v } }), []);
    const setIsClearingAll = useCallback((v: boolean) => dispatch({ type: 'UPDATE_SESSION', payload: { isClearingAll: v } }), []);

    /* ---- Files ---- */
    const setAttachedFiles = useCallback((v: SelectedFile[] | ((prev: SelectedFile[]) => SelectedFile[])) => {
        if (typeof v === 'function') {
            dispatch({ type: 'SET_ATTACHED_FILES_FN', payload: v });
        } else {
            dispatch({ type: 'UPDATE_FILES', payload: { attachedFiles: v } });
        }
    }, []);
    const setWorkspaceFiles = useCallback((v: SelectedFile[] | ((prev: SelectedFile[]) => SelectedFile[])) => {
        if (typeof v === 'function') {
            dispatch({ type: 'SET_WORKSPACE_FILES_FN', payload: v });
        } else {
            dispatch({ type: 'UPDATE_FILES', payload: { workspaceFiles: v } });
        }
    }, []);
    const setCurrentFolderContext = useCallback((v: { id: string | null; name: string }) => dispatch({ type: 'UPDATE_FILES', payload: { currentFolderContext: v } }), []);
    const setActivePreviewContext = useCallback((v: { id: string; name: string; parentId: string | null } | null) => dispatch({ type: 'UPDATE_FILES', payload: { activePreviewContext: v } }), []);
    const setActiveAppContext = useCallback((v: { name: string; path: string } | null) => dispatch({ type: 'UPDATE_FILES', payload: { activeAppContext: v } }), []);
    const setIsUploadingFiles = useCallback((v: boolean) => dispatch({ type: 'UPDATE_FILES', payload: { isUploadingFiles: v } }), []);

    /* ---- Streaming ---- */
    const setIsBackgroundBusy = useCallback((v: boolean) => dispatch({ type: 'UPDATE_STREAMING', payload: { isBackgroundBusy: v } }), []);
    const setBackgroundJobLabel = useCallback((v: string | null) => dispatch({ type: 'UPDATE_STREAMING', payload: { backgroundJobLabel: v } }), []);
    const setBackgroundJobMessage = useCallback((v: string | null) => dispatch({ type: 'UPDATE_STREAMING', payload: { backgroundJobMessage: v } }), []);
    const setJobStartTime = useCallback((v: number | null) => dispatch({ type: 'UPDATE_STREAMING', payload: { jobStartTime: v } }), []);
    const setElapsedTime = useCallback((v: number) => dispatch({ type: 'UPDATE_STREAMING', payload: { elapsedTime: v } }), []);
    const setIsSwitchingAgent = useCallback((v: boolean) => dispatch({ type: 'UPDATE_STREAMING', payload: { isSwitchingAgent: v } }), []);
    const setToolStatusEvents = useCallback((v: ToolStatusEvent[]) => {
        dispatch({ type: 'UPDATE_STREAMING', payload: { toolStatusEvents: v } });
    }, []);
    const appendToolStatusEvent = useCallback((event: ToolStatusEvent) => {
        dispatch({ type: 'APPEND_TOOL_STATUS_EVENT', payload: event });
    }, []);
    const setTruncationReport = useCallback((v: TruncationReportType | null) => dispatch({ type: 'UPDATE_STREAMING', payload: { truncationReport: v } }), []);

    /* ---- Modals ---- */
    const setIsEditorOpen = useCallback((v: boolean) => dispatch({ type: 'UPDATE_MODALS', payload: { isEditorOpen: v } }), []);
    const setIsSettingsModalOpen = useCallback((v: boolean) => dispatch({ type: 'UPDATE_MODALS', payload: { isSettingsModalOpen: v } }), []);
    const setIsEditPreviewOpen = useCallback((v: boolean) => dispatch({ type: 'UPDATE_MODALS', payload: { isEditPreviewOpen: v } }), []);
    const setEditPreviewData = useCallback((v: { fileName: string; content: string }) => dispatch({ type: 'UPDATE_MODALS', payload: { editPreviewData: v } }), []);
    const setIsSuggestionsOpen = useCallback((v: boolean) => dispatch({ type: 'UPDATE_MODALS', payload: { isSuggestionsOpen: v } }), []);
    const setIsCommandMenuOpen = useCallback((v: boolean) => dispatch({ type: 'UPDATE_MODALS', payload: { isCommandMenuOpen: v } }), []);
    const setIsApprovalModalOpen = useCallback((v: boolean) => dispatch({ type: 'UPDATE_MODALS', payload: { isApprovalModalOpen: v } }), []);
    const setIsMetricsPanelOpen = useCallback((v: boolean) => {
        dispatch({ type: 'UPDATE_MODALS', payload: { isMetricsPanelOpen: v } });
    }, []);
    const toggleIsMetricsPanelOpen = useCallback(() => {
        dispatch({ type: 'TOGGLE_MODALS_FIELD', payload: 'isMetricsPanelOpen' });
    }, []);

    /* ---- Prompts ---- */
    const setPrompts = useCallback((v: AIPromptSet[]) => dispatch({ type: 'UPDATE_PROMPTS', payload: { prompts: v } }), []);
    const setIntentRules = useCallback((v: IntentRule[]) => dispatch({ type: 'UPDATE_PROMPTS', payload: { intentRules: v } }), []);
    const setIsCreatingPrompt = useCallback((v: boolean) => dispatch({ type: 'UPDATE_PROMPTS', payload: { isCreatingPrompt: v } }), []);
    const setEditingPromptId = useCallback((v: string | null) => dispatch({ type: 'UPDATE_PROMPTS', payload: { editingPromptId: v } }), []);
    const setIsGenerating = useCallback((v: boolean) => dispatch({ type: 'UPDATE_PROMPTS', payload: { isGenerating: v } }), []);
    const setNewPrompt = useCallback((v: PromptDraft) => dispatch({ type: 'UPDATE_PROMPTS', payload: { newPrompt: v } }), []);

    /* ---- Copy ---- */
    const setIsCopyingCurrentChat = useCallback((v: boolean) => dispatch({ type: 'UPDATE_COPY', payload: { isCopyingCurrentChat: v } }), []);
    const setIsCopyingAllChats = useCallback((v: boolean) => dispatch({ type: 'UPDATE_COPY', payload: { isCopyingAllChats: v } }), []);

    /* ---- Commands ---- */
    const setActiveCommandIndex = useCallback((v: number | ((prev: number) => number)) => {
        if (typeof v === 'function') {
            dispatch({ type: 'UPDATE_COMMAND_INDEX_FN', payload: v });
        } else {
            dispatch({ type: 'UPDATE_COMMANDS', payload: { activeCommandIndex: v } });
        }
    }, []);

    /* ---- Settings ---- */
    const setShowThinkingTrace = useCallback((v: boolean) => {
        dispatch({ type: 'UPDATE_SETTINGS', payload: { showThinkingTrace: v } });
    }, []);
    const toggleShowThinkingTrace = useCallback(() => {
        dispatch({ type: 'TOGGLE_SETTINGS_FIELD', payload: 'showThinkingTrace' });
    }, []);
    const setAllowToolExecution = useCallback((v: boolean) => {
        dispatch({ type: 'UPDATE_SETTINGS', payload: { allowToolExecution: v } });
    }, []);
    const toggleAllowToolExecution = useCallback(() => {
        dispatch({ type: 'TOGGLE_SETTINGS_FIELD', payload: 'allowToolExecution' });
    }, []);
    const setAllowHighRiskExecution = useCallback((v: boolean) => {
        dispatch({ type: 'UPDATE_SETTINGS', payload: { allowHighRiskExecution: v } });
    }, []);
    const setAllowHighRiskOnce = useCallback((v: boolean) => dispatch({ type: 'UPDATE_SETTINGS', payload: { allowHighRiskOnce: v } }), []);
    const setAutoOpenPreview = useCallback((v: boolean) => dispatch({ type: 'UPDATE_SETTINGS', payload: { autoOpenPreview: v } }), []);

    /* ---- Misc ---- */
    const setCelebration = useCallback((v: { emoji: string; timestamp: number } | null) => dispatch({ type: 'UPDATE_MISC', payload: { celebration: v } }), []);
    const setDismissedQuestionId = useCallback((v: string | null) => dispatch({ type: 'UPDATE_MISC', payload: { dismissedQuestionId: v } }), []);
    const setProposedTools = useCallback((v: string[]) => dispatch({ type: 'UPDATE_MISC', payload: { proposedTools: v } }), []);
    const setHighRiskTools = useCallback((v: string[]) => dispatch({ type: 'UPDATE_MISC', payload: { highRiskTools: v } }), []);
    const setPendingApprovalRequest = useCallback((v: unknown | null) => dispatch({ type: 'UPDATE_MISC', payload: { pendingApprovalRequest: v } }), []);

    return {
        state,
        dispatch,

        // UI
        setIsOpen,
        setView,
        setIsPinned,
        setShowScrollButton,
        setIsUserScrolling,
        setShouldAutoScroll,
        setIsDragging,

        // Chat
        setInput,
        setMessages,
        setIsLoading,
        setStreamingStatus,
        setStreamProgress,
        setAiActivity,
        setSelectedModel,
        setChatScope,
        setHistoryIndex,
        setPromptHistory,
        prependPromptHistory,
        setActiveTool,
        setVerbosity,
        setManualStop,

        // Session
        setActiveSessionId,
        setActiveSessionTitle,
        setChatSessions,
        setRenamingSessionId,
        setRenamingSessionTitle,
        setIsDeleteModalOpen,
        setPendingDeleteSessionId,
        setIsDeletingSession,
        setIsClearAllModalOpen,
        setIsClearingAll,

        // Files
        setAttachedFiles,
        setWorkspaceFiles,
        setCurrentFolderContext,
        setActivePreviewContext,
        setActiveAppContext,
        setIsUploadingFiles,

        // Streaming
        setIsBackgroundBusy,
        setBackgroundJobLabel,
        setBackgroundJobMessage,
        setJobStartTime,
        setElapsedTime,
        setIsSwitchingAgent,
        setToolStatusEvents,
        appendToolStatusEvent,
        setTruncationReport,

        // Modals
        setIsEditorOpen,
        setIsSettingsModalOpen,
        setIsEditPreviewOpen,
        setEditPreviewData,
        setIsSuggestionsOpen,
        setIsCommandMenuOpen,
        setIsApprovalModalOpen,
        setIsMetricsPanelOpen,
        toggleIsMetricsPanelOpen,

        // Prompts
        setPrompts,
        setIntentRules,
        setIsCreatingPrompt,
        setEditingPromptId,
        setIsGenerating,
        setNewPrompt,

        // Copy
        setIsCopyingCurrentChat,
        setIsCopyingAllChats,

        // Commands
        setActiveCommandIndex,

        // Settings
        setShowThinkingTrace,
        toggleShowThinkingTrace,
        setAllowToolExecution,
        toggleAllowToolExecution,
        setAllowHighRiskExecution,
        setAllowHighRiskOnce,
        setAutoOpenPreview,

        // Misc
        setCelebration,
        setDismissedQuestionId,
        setProposedTools,
        setHighRiskTools,
        setPendingApprovalRequest,
    };
}
