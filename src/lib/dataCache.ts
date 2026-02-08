/**
 * Cached data fetching utilities for performance optimization
 * Uses React cache() for request deduplication and Next.js revalidation
 */

import { cache } from 'react';
import prisma from '@/lib/prisma';
import type { Task, User } from '@prisma/client';

/**
 * Get demo user with caching
 * Cached for the duration of the request
 */
export const getCachedDemoUser = cache(async () => {
  const user = await prisma.user.findUnique({
    where: { email: 'demo@example.com' },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      updatedAt: true
    }
  });
  return user;
});

/**
 * Get user tasks with caching
 * Cached for the duration of the request
 */
export const getCachedUserTasks = cache(async (userId: string) => {
  const tasks = await prisma.task.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    // Add pagination later
    take: 100 // Limit to avoid loading too much data
  });
  return tasks;
});

/**
 * Get workspace files with caching
 * Only selects necessary fields to reduce payload size
 */
export const getCachedWorkspaceFiles = cache(async (userId: string) => {
  const files = await (prisma as any).workspaceFile.findMany({
    where: { userId },
    orderBy: [
      { order: 'asc' },
      { createdAt: 'desc' }
    ],
    select: {
      id: true,
      name: true,
      type: true,
      size: true,
      items: true,
      shared: true,
      order: true,
      parentId: true,
      userId: true,
      highlightBgColor: true,
      highlightTextColor: true,
      highlightBorderColor: true,
      highlightFontWeight: true,
      tags: true,
      storagePath: true,
      magicRule: true,
      createdAt: true,
      updatedAt: true
    },
    // Add pagination later
    take: 500 // Limit to avoid loading too many files
  });
  return files;
});

/**
 * Get single task with caching
 */
export const getCachedTask = cache(async (taskId: string, userId: string) => {
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId }
  });
  return task;
});

/**
 * Get single workspace file with caching
 */
export const getCachedWorkspaceFile = cache(async (fileId: string, userId: string) => {
  const file = await (prisma as any).workspaceFile.findFirst({
    where: { id: fileId, userId }
  });
  return file;
});

/**
 * Get chat session with messages (with caching)
 */
export const getCachedChatSession = cache(async (sessionId: string, userId: string) => {
  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        take: 50 // Limit initial load, implement pagination for older messages
      }
    }
  });
  return session;
});

/**
 * Get all user chat sessions (preview only)
 */
export const getCachedChatSessions = cache(async (userId: string) => {
  const sessions = await prisma.chatSession.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      userId: true,
      _count: {
        select: { messages: true }
      }
    },
    take: 20 // Limit to recent sessions
  });
  return sessions;
});

/**
 * Batch fetch multiple tasks efficiently
 */
export const getCachedTasksBatch = cache(async (taskIds: string[], userId: string) => {
  const tasks = await prisma.task.findMany({
    where: {
      id: { in: taskIds },
      userId
    }
  });
  return tasks;
});

/**
 * Batch fetch multiple files efficiently
 */
export const getCachedFilesBatch = cache(async (fileIds: string[], userId: string) => {
  const files = await (prisma as any).workspaceFile.findMany({
    where: {
      id: { in: fileIds },
      userId
    }
  });
  return files;
});
