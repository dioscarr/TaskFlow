import { Task } from '@prisma/client';

export interface EmailPayload {
    from: string;
    subject: string;
    body: string;
    date?: Date;
}

export interface ParsedTaskData {
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    tags: string[];
    suggestedDueDate?: Date;
}

// Keyword mappings for "AI" categorization
const CATEGORY_KEYWORDS: Record<string, string[]> = {
    'Finance': ['invoice', 'receipt', 'payment', 'bill', 'subscription', '$', 'paid'],
    'Meeting': ['meeting', 'call', 'zoom', 'schedule', 'calendar', 'invite'],
    'Development': ['bug', 'feature', 'pr', 'pull request', 'deploy', 'error', 'exception'],
    'Marketing': ['campaign', 'social', 'post', 'ad', 'newsletter', 'analytics'],
    'Urgent': ['urgent', 'asap', 'immediate', 'emergency', 'deadline']
};

export function parseEmailToTask(email: EmailPayload): ParsedTaskData {
    const textToCheck = `${email.subject} ${email.body}`.toLowerCase();
    const tags: string[] = [];
    let priority: 'high' | 'medium' | 'low' = 'medium';

    // 1. Extract Tags based on keywords
    Object.entries(CATEGORY_KEYWORDS).forEach(([category, keywords]) => {
        if (keywords.some(k => textToCheck.includes(k))) {
            tags.push(category);
        }
    });

    // 2. Determine Priority
    if (tags.includes('Urgent') || textToCheck.includes('important')) {
        priority = 'high';
    }

    // 3. Simple Due Date Extraction (e.g., "due friday", "tomorrow")
    let suggestedDueDate: Date | undefined;
    if (textToCheck.includes('tomorrow')) {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        suggestedDueDate = d;
    } else if (textToCheck.includes('next week')) {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        suggestedDueDate = d;
    }

    return {
        title: email.subject,
        description: email.body,
        priority,
        tags,
        suggestedDueDate
    };
}
