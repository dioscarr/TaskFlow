
import { Task } from '@prisma/client';

export interface EmailMetadata {
    sender: {
        name: string;
        email: string;
        avatar?: string | null;
    };
    preview?: string;
    tags?: string[];
    body?: string; // If we store the full body later
}

export type TaskWithData = Task & EmailMetadata;
