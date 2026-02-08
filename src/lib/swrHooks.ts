/**
 * SWR hooks for client-side data fetching with caching
 * Provides real-time data updates with automatic revalidation
 */

'use client';

import useSWR, { mutate } from 'swr';
import type { Task } from '@prisma/client';

// Fetcher function for SWR
const fetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch');
  }
  return res.json();
};

/**
 * SWR configuration defaults
 */
export const swrConfig = {
  revalidateOnFocus: false, // Don't revalidate on window focus by default
  revalidateOnReconnect: true, // Revalidate when reconnecting
  dedupingInterval: 5000, // Dedupe requests within 5 seconds
  focusThrottleInterval: 10000, // Throttle focus revalidation to 10s
  errorRetryCount: 3, // Retry failed requests 3 times
  errorRetryInterval: 5000, // Wait 5s between retries
  shouldRetryOnError: true
};

/**
 * Hook to fetch user tasks with SWR caching
 */
export function useTasks(userId?: string, initialData?: Task[]) {
  const { data, error, isLoading, mutate: mutateTasks } = useSWR(
    userId ? `/api/tasks?userId=${userId}` : null,
    fetcher<Task[]>,
    {
      ...swrConfig,
      fallbackData: initialData,
      revalidateOnMount: !initialData, // Don't revalidate immediately if we have initial data
    }
  );

  return {
    tasks: data,
    isLoading,
    isError: error,
    mutate: mutateTasks
  };
}

/**
 * Hook to fetch workspace files with SWR caching
 */
export function useWorkspaceFiles(userId?: string, initialData?: any[]) {
  const { data, error, isLoading, mutate: mutateFiles } = useSWR(
    userId ? `/api/files?userId=${userId}` : null,
    fetcher<any[]>,
    {
      ...swrConfig,
      fallbackData: initialData,
      revalidateOnMount: !initialData,
    }
  );

  return {
    files: data,
    isLoading,
    isError: error,
    mutate: mutateFiles
  };
}

/**
 * Hook to fetch a single task
 */
export function useTask(taskId?: string, userId?: string) {
  const { data, error, isLoading } = useSWR(
    taskId && userId ? `/api/tasks/${taskId}?userId=${userId}` : null,
    fetcher<Task>,
    swrConfig
  );

  return {
    task: data,
    isLoading,
    isError: error
  };
}

/**
 * Hook to fetch chat sessions
 */
export function useChatSessions(userId?: string) {
  const { data, error, isLoading, mutate: mutateSessions } = useSWR(
    userId ? `/api/chat/sessions?userId=${userId}` : null,
    fetcher<any[]>,
    {
      ...swrConfig,
      refreshInterval: 30000, // Auto-refresh every 30s
    }
  );

  return {
    sessions: data,
    isLoading,
    isError: error,
    mutate: mutateSessions
  };
}

/**
 * Hook to fetch a single chat session with messages
 */
export function useChatSession(sessionId?: string, userId?: string) {
  const { data, error, isLoading, mutate: mutateSession } = useSWR(
    sessionId && userId ? `/api/chat/sessions/${sessionId}?userId=${userId}` : null,
    fetcher<any>,
    {
      ...swrConfig,
      refreshInterval: 10000, // Auto-refresh every 10s for active chats
    }
  );

  return {
    session: data,
    isLoading,
    isError: error,
    mutate: mutateSession
  };
}

/**
 * Optimistic update helper for tasks
 */
export async function updateTaskOptimistic(
  userId: string,
  taskId: string,
  updates: Partial<Task>,
  serverAction: () => Promise<void>
) {
  const key = `/api/tasks?userId=${userId}`;

  // Optimistically update the UI
  await mutate(
    key,
    async (currentTasks?: Task[]) => {
      if (!currentTasks) return currentTasks;
      return currentTasks.map(task =>
        task.id === taskId ? { ...task, ...updates } : task
      );
    },
    false // Don't revalidate immediately
  );

  try {
    // Execute server action
    await serverAction();
    // Revalidate to sync with server
    await mutate(key);
  } catch (error) {
    // Rollback on error
    await mutate(key);
    throw error;
  }
}

/**
 * Optimistic update helper for files
 */
export async function updateFileOptimistic(
  userId: string,
  fileId: string,
  updates: Partial<any>,
  serverAction: () => Promise<void>
) {
  const key = `/api/files?userId=${userId}`;

  await mutate(
    key,
    async (currentFiles?: any[]) => {
      if (!currentFiles) return currentFiles;
      return currentFiles.map(file =>
        file.id === fileId ? { ...file, ...updates } : file
      );
    },
    false
  );

  try {
    await serverAction();
    await mutate(key);
  } catch (error) {
    await mutate(key);
    throw error;
  }
}

/**
 * Invalidate all caches
 */
export function invalidateAll() {
  mutate(() => true, undefined, { revalidate: true });
}

/**
 * Invalidate tasks cache
 */
export function invalidateTasks(userId: string) {
  mutate(`/api/tasks?userId=${userId}`);
}

/**
 * Invalidate files cache
 */
export function invalidateFiles(userId: string) {
  mutate(`/api/files?userId=${userId}`);
}
