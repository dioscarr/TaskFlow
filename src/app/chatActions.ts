'use server';

import prisma from '@/lib/prisma';

/**
 * Create a new chat session
 */
export async function createChatSession(title?: string) {
    const chatSession = await prisma.chatSession.create({
        data: {
            title: title || 'New Chat'
        }
    });

    return { success: true, session: chatSession, message: undefined };
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

    return chatSessions;
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

    return chatSession;
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
    thinking?: string
) {
    const message = await (prisma.chatMessage as any).create({
        data: {
            sessionId,
            role,
            content,
            fileIds: fileIds || [],
            toolUsed,
            thinking
        }
    });

    // Update session's updatedAt timestamp
    await prisma.chatSession.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() }
    });

    return { success: true, message };
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
