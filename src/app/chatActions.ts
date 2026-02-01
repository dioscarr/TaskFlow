'use server';

import prisma from '@/lib/prisma';
import { deepSerialize } from '@/lib/serialization';

/**
 * Create a new chat session
 */
export async function createChatSession(title?: string) {
    const chatSession = await prisma.chatSession.create({
        data: {
            title: title || 'New Chat'
        }
    });

    return { success: true, session: deepSerialize(chatSession), message: undefined };
}

/**
 * Get all chat sessions for the current user
 */
export async function getChatSessions() {
    const chatSessions = await prisma.chatSession.findMany({
        orderBy: { updatedAt: 'desc' },
        include: {
            messages: {
                take: 1,
                orderBy: { createdAt: 'desc' }
            },
            _count: {
                select: { messages: true }
            }
        }
    });

    return deepSerialize(chatSessions);
}

/**
 * Get a specific chat session with all messages
 */
export async function getChatSession(sessionId: string) {
    const chatSession = await prisma.chatSession.findFirst({
        where: {
            id: sessionId
        },
        include: {
            messages: {
                orderBy: { createdAt: 'asc' }
            }
        }
    });

    return deepSerialize(chatSession);
}

/**
 * Add a message to a chat session
 */
export async function addChatMessage(
    sessionId: string,
    role: 'user' | 'ai',
    content: string,
    fileIds?: string[],
    toolUsed?: string,
    thinking?: string,
    toolResult?: any,
    toolArgs?: any
) {
    // Append tool result to content for persistence/context since we can't reliably update prisma client
    let finalContent = content;
    if (toolResult && toolResult !== '{}') {
        const resultStr = typeof toolResult === 'string'
            ? toolResult
            : (toolResult.output ? (typeof toolResult.output === 'string' ? toolResult.output : JSON.stringify(toolResult.output)) : JSON.stringify(toolResult));

        if (resultStr.length > 0) {
            // Check if content already contains it to avoid duplication if called multiple times
            if (!finalContent.includes(resultStr.substring(0, 50))) {
                finalContent += `\n\n[System: Tool '${toolUsed}' Result: ${resultStr}]`;
            }
        }
    }

    const message = await prisma.chatMessage.create({
        data: {
            sessionId,
            role,
            content: finalContent,
            fileIds: fileIds || [],
            toolUsed,
            thinking,
            toolResult: toolResult && toolResult !== '{}' ? toolResult : undefined,
            toolArgs: toolArgs || undefined
        }
    });

    // Update session's updatedAt timestamp
    await prisma.chatSession.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() }
    });

    return { success: true, message: deepSerialize(message) };
}

/**
 * Update chat session title
 */
export async function updateChatSessionTitle(sessionId: string, title: string) {
    await prisma.chatSession.update({
        where: {
            id: sessionId
        },
        data: { title }
    });

    return { success: true };
}

/**
 * Delete a chat session
 */
export async function deleteChatSession(sessionId: string) {
    await prisma.chatSession.delete({
        where: {
            id: sessionId
        }
    });

    return { success: true };
}

/**
 * Clear all messages from a chat session (but keep the session)
 */
export async function clearChatSession(sessionId: string) {
    await prisma.chatMessage.deleteMany({
        where: { sessionId }
    });

    return { success: true };
}
