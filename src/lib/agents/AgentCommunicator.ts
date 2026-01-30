import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient() as any;

export class AgentCommunicator {
    /**
     * Sends a message from one agent component to another.
     */
    async sendMessage(data: {
        jobId: string;
        fromAgent: string;
        toAgent?: string;
        messageType: 'request' | 'response' | 'feedback' | 'error';
        content: any;
    }) {
        console.log(`✉️ Agent Message: ${data.fromAgent} -> ${data.toAgent || 'ALL'} [${data.messageType}]`);

        return await prisma.agentMessage.create({
            data: {
                jobId: data.jobId,
                fromAgent: data.fromAgent,
                toAgent: data.toAgent || null,
                messageType: data.messageType,
                content: data.content
            }
        });
    }

    /**
     * Retrieves messages for a specific agent/worker.
     */
    async getMessages(agentId: string, unreadOnly: boolean = true) {
        return await prisma.agentMessage.findMany({
            where: {
                OR: [
                    { toAgent: agentId },
                    { toAgent: null }
                ],
                ...(unreadOnly ? { read: false } : {})
            },
            orderBy: { createdAt: 'asc' }
        });
    }

    /**
     * Marks a message as read.
     */
    async markAsRead(messageId: string) {
        return await prisma.agentMessage.update({
            where: { id: messageId },
            data: { read: true }
        });
    }

    /**
     * Specialized broadcast to log system-level agent events.
     */
    async logEvent(jobId: string, event: string, details: any) {
        return await this.sendMessage({
            jobId,
            fromAgent: 'system',
            messageType: 'feedback',
            content: { event, details, timestamp: new Date().toISOString() }
        });
    }
}
