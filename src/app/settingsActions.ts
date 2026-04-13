'use server';

import { PrismaClient } from '@prisma/client';
import { auth } from '@/auth';

const prisma = new PrismaClient();

// ============================================
// USER PROFILE ACTIONS
// ============================================

export interface UserProfileData {
    displayName?: string;
    avatarUrl?: string;
    bio?: string;
    timezone?: string;
    locale?: string;
    theme?: string;
    compactMode?: boolean;
    notifications?: {
        email: boolean;
        push: boolean;
        desktop: boolean;
    };
    aiPersonality?: string;
    defaultModel?: string;
    temperature?: number;
}

export async function getProfile() {
    const session = await auth();
    if (!session?.user?.email) {
        throw new Error('Not authenticated');
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: { profile: true }
    });

    if (!user) throw new Error('User not found');

    // Return profile or create default
    if (user.profile) {
        return user.profile;
    }

    // Create default profile
    const profile = await prisma.userProfile.create({
        data: {
            userId: user.id,
            displayName: user.name || user.email?.split('@')[0] || 'User',
            avatarUrl: user.image,
        }
    });

    return profile;
}

export async function updateProfile(data: UserProfileData) {
    const session = await auth();
    if (!session?.user?.email) {
        throw new Error('Not authenticated');
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
    });

    if (!user) throw new Error('User not found');

    const profile = await prisma.userProfile.upsert({
        where: { userId: user.id },
        update: {
            displayName: data.displayName,
            avatarUrl: data.avatarUrl,
            bio: data.bio,
            timezone: data.timezone,
            locale: data.locale,
            theme: data.theme,
            compactMode: data.compactMode,
            notifications: data.notifications as object,
            aiPersonality: data.aiPersonality,
            defaultModel: data.defaultModel,
            temperature: data.temperature,
        },
        create: {
            userId: user.id,
            displayName: data.displayName || user.name || 'User',
            avatarUrl: data.avatarUrl || user.image,
            bio: data.bio,
            timezone: data.timezone || 'UTC',
            locale: data.locale || 'en-US',
            theme: data.theme || 'system',
            compactMode: data.compactMode || false,
            notifications: data.notifications as object || { email: true, push: true, desktop: true },
            aiPersonality: data.aiPersonality || 'professional',
            defaultModel: data.defaultModel || 'gemini-2.0-flash',
            temperature: data.temperature || 0.7,
        }
    });

    return profile;
}

// ============================================
// APP SETTINGS ACTIONS
// ============================================

export interface SettingEntry {
    category: string;
    key: string;
    value: unknown;
    description?: string;
    isSecret?: boolean;
}

export async function getSettings(category?: string) {
    const session = await auth();
    if (!session?.user?.email) {
        throw new Error('Not authenticated');
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
    });

    if (!user) throw new Error('User not found');

    const where = category
        ? { userId: user.id, category }
        : { userId: user.id };

    const settings = await prisma.appSettings.findMany({
        where,
        orderBy: [{ category: 'asc' }, { key: 'asc' }]
    });

    return settings;
}

export async function getSetting(category: string, key: string) {
    const session = await auth();
    if (!session?.user?.email) {
        throw new Error('Not authenticated');
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
    });

    if (!user) throw new Error('User not found');

    const setting = await prisma.appSettings.findUnique({
        where: {
            userId_category_key: {
                userId: user.id,
                category,
                key
            }
        }
    });

    return setting;
}

export async function setSetting(entry: SettingEntry) {
    const session = await auth();
    if (!session?.user?.email) {
        throw new Error('Not authenticated');
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
    });

    if (!user) throw new Error('User not found');

    const setting = await prisma.appSettings.upsert({
        where: {
            userId_category_key: {
                userId: user.id,
                category: entry.category,
                key: entry.key
            }
        },
        update: {
            value: entry.value as object,
            description: entry.description,
            isSecret: entry.isSecret,
        },
        create: {
            userId: user.id,
            category: entry.category,
            key: entry.key,
            value: entry.value as object,
            description: entry.description,
            isSecret: entry.isSecret || false,
        }
    });

    return setting;
}

export async function deleteSetting(category: string, key: string) {
    const session = await auth();
    if (!session?.user?.email) {
        throw new Error('Not authenticated');
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
    });

    if (!user) throw new Error('User not found');

    await prisma.appSettings.delete({
        where: {
            userId_category_key: {
                userId: user.id,
                category,
                key
            }
        }
    });

    return { success: true };
}

// ============================================
// APP RESOURCE ACTIONS
// ============================================

export interface ResourceSpec {
    apiVersion?: string;
    kind?: string;
    metadata?: {
        labels?: Record<string, string>;
        annotations?: Record<string, string>;
    };
    spec?: {
        template?: {
            containers?: Array<{
                env?: Array<{ name: string; value: string }>;
                resources?: {
                    limits?: Record<string, string>;
                    requests?: Record<string, string>;
                };
            }>;
        };
        traffic?: Array<{ percent: number; tag?: string }>;
        scaling?: {
            minInstances?: number;
            maxInstances?: number;
        };
    };
}

export interface EnvVar {
    key: string;
    value: string;
    isSecret: boolean;
    scope: 'runtime' | 'build' | 'all';
}

export interface ResourceLimits {
    cpu?: string;
    memory?: string;
    timeoutSeconds?: number;
    maxRequestsPerContainer?: number;
    minInstances?: number;
    maxInstances?: number;
}

export interface EdiConfig {
    standard: 'X12' | 'EDIFACT';
    version: string;
    transactionSets: string[];
    interchange: {
        senderId: string;
        receiverId: string;
        qualifier: string;
    };
    validation: {
        strict: boolean;
        autoAck: boolean;
    };
}

export interface ResourceEndpoint {
    name: string;
    url: string;
    type: 'rest' | 'graphql' | 'grpc' | 'websocket' | 'webhook' | 'edi';
    auth?: 'none' | 'bearer' | 'api_key' | 'basic' | 'oauth2';
    events?: string[];
}

export interface CreateResourceData {
    name: string;
    slug: string;
    type: 'api' | 'database' | 'storage' | 'compute' | 'ai-model' | 'messaging' | 'edi' | 'custom';
    provider: string;
    description?: string;
    documentation?: string;
    icon?: string;
    tags?: string[];
    spec?: ResourceSpec;
    envVars?: EnvVar[];
    limits?: ResourceLimits;
    ediConfig?: EdiConfig;
    endpoints?: ResourceEndpoint[];
}

export interface UpdateResourceData extends Partial<CreateResourceData> {
    status?: 'pending' | 'active' | 'error' | 'disabled';
    healthStatus?: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
    linkedApps?: string[];
}

export async function getResources(type?: string, provider?: string) {
    const session = await auth();
    if (!session?.user?.email) {
        throw new Error('Not authenticated');
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
    });

    if (!user) throw new Error('User not found');

    const where: Record<string, unknown> = { userId: user.id };
    if (type) where.type = type;
    if (provider) where.provider = provider;

    const resources = await prisma.appResource.findMany({
        where,
        include: {
            credentials: {
                select: {
                    id: true,
                    name: true,
                    type: true,
                    isActive: true,
                    lastUsedAt: true,
                    expiresAt: true,
                    createdAt: true,
                }
            }
        },
        orderBy: [{ type: 'asc' }, { name: 'asc' }]
    });

    return resources;
}

export async function getResource(id: string) {
    const session = await auth();
    if (!session?.user?.email) {
        throw new Error('Not authenticated');
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
    });

    if (!user) throw new Error('User not found');

    const resource = await prisma.appResource.findFirst({
        where: { id, userId: user.id },
        include: {
            credentials: {
                select: {
                    id: true,
                    name: true,
                    type: true,
                    isActive: true,
                    lastUsedAt: true,
                    expiresAt: true,
                    scopes: true,
                    createdAt: true,
                }
            }
        }
    });

    return resource;
}

export async function createResource(data: CreateResourceData) {
    const session = await auth();
    if (!session?.user?.email) {
        throw new Error('Not authenticated');
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
    });

    if (!user) throw new Error('User not found');

    // Check if slug already exists
    const existing = await prisma.appResource.findFirst({
        where: { userId: user.id, slug: data.slug }
    });

    if (existing) {
        throw new Error(`Resource with slug "${data.slug}" already exists`);
    }

    const resource = await prisma.appResource.create({
        data: {
            userId: user.id,
            name: data.name,
            slug: data.slug,
            type: data.type,
            provider: data.provider,
            description: data.description,
            documentation: data.documentation,
            icon: data.icon,
            tags: data.tags || [],
            spec: (data.spec || {
                apiVersion: 'v1',
                kind: data.type,
                metadata: { labels: {}, annotations: {} },
                spec: {}
            }) as object,
            envVars: (data.envVars || []) as object[],
            limits: (data.limits || {}) as object,
            ediConfig: data.ediConfig as object,
            endpoints: (data.endpoints || []) as object[],
            status: 'pending',
        },
        include: {
            credentials: true
        }
    });

    return resource;
}

export async function updateResource(id: string, data: UpdateResourceData) {
    const session = await auth();
    if (!session?.user?.email) {
        throw new Error('Not authenticated');
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
    });

    if (!user) throw new Error('User not found');

    // Verify ownership
    const existing = await prisma.appResource.findFirst({
        where: { id, userId: user.id }
    });

    if (!existing) {
        throw new Error('Resource not found');
    }

    // Check slug uniqueness if changing
    if (data.slug && data.slug !== existing.slug) {
        const slugExists = await prisma.appResource.findFirst({
            where: { userId: user.id, slug: data.slug, id: { not: id } }
        });
        if (slugExists) {
            throw new Error(`Resource with slug "${data.slug}" already exists`);
        }
    }

    const resource = await prisma.appResource.update({
        where: { id },
        data: {
            name: data.name,
            slug: data.slug,
            type: data.type,
            provider: data.provider,
            status: data.status,
            healthStatus: data.healthStatus,
            description: data.description,
            documentation: data.documentation,
            icon: data.icon,
            tags: data.tags,
            spec: data.spec as object,
            envVars: data.envVars as object[],
            limits: data.limits as object,
            ediConfig: data.ediConfig as object,
            endpoints: data.endpoints as object[],
            linkedApps: data.linkedApps as object,
            lastSyncedAt: new Date(),
        },
        include: {
            credentials: true
        }
    });

    return resource;
}

export async function deleteResource(id: string) {
    const session = await auth();
    if (!session?.user?.email) {
        throw new Error('Not authenticated');
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
    });

    if (!user) throw new Error('User not found');

    // Verify ownership
    const existing = await prisma.appResource.findFirst({
        where: { id, userId: user.id }
    });

    if (!existing) {
        throw new Error('Resource not found');
    }

    await prisma.appResource.delete({
        where: { id }
    });

    return { success: true };
}

export async function syncResource(id: string) {
    const session = await auth();
    if (!session?.user?.email) {
        throw new Error('Not authenticated');
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
    });

    if (!user) throw new Error('User not found');

    const resource = await prisma.appResource.findFirst({
        where: { id, userId: user.id },
        include: { credentials: true }
    });

    if (!resource) {
        throw new Error('Resource not found');
    }

    // TODO: Implement actual sync logic based on provider
    // For now, just update the sync timestamp and set to active
    const updated = await prisma.appResource.update({
        where: { id },
        data: {
            status: 'active',
            healthStatus: 'healthy',
            lastSyncedAt: new Date(),
        }
    });

    return updated;
}

// ============================================
// RESOURCE CREDENTIAL ACTIONS
// ============================================

export interface CreateCredentialData {
    resourceId: string;
    name: string;
    type: 'api_key' | 'oauth2' | 'service_account' | 'basic_auth' | 'certificate';
    value: string;
    scopes?: string[];
    expiresAt?: Date;
}

export async function addCredential(data: CreateCredentialData) {
    const session = await auth();
    if (!session?.user?.email) {
        throw new Error('Not authenticated');
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
    });

    if (!user) throw new Error('User not found');

    // Verify resource ownership
    const resource = await prisma.appResource.findFirst({
        where: { id: data.resourceId, userId: user.id }
    });

    if (!resource) {
        throw new Error('Resource not found');
    }

    // TODO: Encrypt the value in production
    // For now, store as-is (should use something like libsodium or AWS KMS)
    const encryptedValue = Buffer.from(data.value).toString('base64');

    const credential = await prisma.resourceCredential.create({
        data: {
            resourceId: data.resourceId,
            userId: user.id,
            name: data.name,
            type: data.type,
            encryptedValue,
            scopes: data.scopes || [],
            expiresAt: data.expiresAt,
        }
    });

    return {
        id: credential.id,
        name: credential.name,
        type: credential.type,
        isActive: credential.isActive,
        expiresAt: credential.expiresAt,
        createdAt: credential.createdAt,
    };
}

export async function deleteCredential(id: string) {
    const session = await auth();
    if (!session?.user?.email) {
        throw new Error('Not authenticated');
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
    });

    if (!user) throw new Error('User not found');

    // Verify ownership
    const credential = await prisma.resourceCredential.findFirst({
        where: { id, userId: user.id }
    });

    if (!credential) {
        throw new Error('Credential not found');
    }

    await prisma.resourceCredential.delete({
        where: { id }
    });

    return { success: true };
}

export async function rotateCredential(id: string, newValue: string) {
    const session = await auth();
    if (!session?.user?.email) {
        throw new Error('Not authenticated');
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
    });

    if (!user) throw new Error('User not found');

    // Verify ownership
    const credential = await prisma.resourceCredential.findFirst({
        where: { id, userId: user.id }
    });

    if (!credential) {
        throw new Error('Credential not found');
    }

    // TODO: Encrypt in production
    const encryptedValue = Buffer.from(newValue).toString('base64');

    const updated = await prisma.resourceCredential.update({
        where: { id },
        data: {
            encryptedValue,
            updatedAt: new Date(),
        }
    });

    return {
        id: updated.id,
        name: updated.name,
        type: updated.type,
        isActive: updated.isActive,
        updatedAt: updated.updatedAt,
    };
}

// ============================================
// RESOURCE TEMPLATES
// ============================================

const RESOURCE_TEMPLATES = {
    firebase: {
        name: 'Firebase',
        type: 'api' as const,
        provider: 'firebase',
        icon: 'Flame',
        spec: {
            apiVersion: 'v1',
            kind: 'FirebaseProject',
            metadata: { labels: { platform: 'firebase' } },
            spec: {
                services: ['firestore', 'auth', 'storage', 'functions'],
            }
        },
        limits: {
            maxInstances: 1000,
            timeoutSeconds: 540,
        }
    },
    supabase: {
        name: 'Supabase',
        type: 'database' as const,
        provider: 'supabase',
        icon: 'Database',
        spec: {
            apiVersion: 'v1',
            kind: 'PostgresDatabase',
            metadata: { labels: { platform: 'supabase' } },
            spec: {
                services: ['postgres', 'auth', 'storage', 'realtime', 'edge-functions'],
            }
        },
        limits: {
            maxConnections: 60,
            storageGb: 8,
        }
    },
    openai: {
        name: 'OpenAI',
        type: 'ai-model' as const,
        provider: 'openai',
        icon: 'Brain',
        spec: {
            apiVersion: 'v1',
            kind: 'AIModel',
            metadata: { labels: { platform: 'openai' } },
            spec: {
                models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
            }
        },
        limits: {
            rateLimitRpm: 10000,
            rateLimitTpm: 1000000,
        }
    },
    anthropic: {
        name: 'Anthropic Claude',
        type: 'ai-model' as const,
        provider: 'anthropic',
        icon: 'MessageSquare',
        spec: {
            apiVersion: 'v1',
            kind: 'AIModel',
            metadata: { labels: { platform: 'anthropic' } },
            spec: {
                models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
            }
        },
        limits: {
            rateLimitRpm: 1000,
        }
    },
    gemini: {
        name: 'Google Gemini',
        type: 'ai-model' as const,
        provider: 'gcp',
        icon: 'Sparkles',
        spec: {
            apiVersion: 'v1',
            kind: 'AIModel',
            metadata: { labels: { platform: 'google' } },
            spec: {
                models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
            }
        },
        limits: {
            rateLimitRpm: 60,
        }
    },
    cloudrun: {
        name: 'Cloud Run Service',
        type: 'compute' as const,
        provider: 'gcp',
        icon: 'Cloud',
        spec: {
            apiVersion: 'serving.knative.dev/v1',
            kind: 'Service',
            metadata: { labels: {}, annotations: {} },
            spec: {
                template: {
                    containers: [{
                        env: [],
                        resources: {
                            limits: { cpu: '1000m', memory: '512Mi' },
                        }
                    }],
                },
                scaling: { minInstances: 0, maxInstances: 100 },
            }
        },
        limits: {
            cpu: '2000m',
            memory: '2Gi',
            timeoutSeconds: 300,
            maxInstances: 100,
            minInstances: 0,
        }
    },
    edi_x12: {
        name: 'EDI X12 Connection',
        type: 'edi' as const,
        provider: 'custom',
        icon: 'FileCode',
        spec: {
            apiVersion: 'v1',
            kind: 'EDIConnection',
            metadata: { labels: { standard: 'X12' } },
            spec: {}
        },
        ediConfig: {
            standard: 'X12' as const,
            version: '005010',
            transactionSets: ['850', '810', '856', '997'],
            interchange: {
                senderId: '',
                receiverId: '',
                qualifier: 'ZZ',
            },
            validation: { strict: true, autoAck: true },
        }
    },
    edi_edifact: {
        name: 'EDI EDIFACT Connection',
        type: 'edi' as const,
        provider: 'custom',
        icon: 'FileCode',
        spec: {
            apiVersion: 'v1',
            kind: 'EDIConnection',
            metadata: { labels: { standard: 'EDIFACT' } },
            spec: {}
        },
        ediConfig: {
            standard: 'EDIFACT' as const,
            version: 'D96A',
            transactionSets: ['ORDERS', 'INVOIC', 'DESADV', 'CONTRL'],
            interchange: {
                senderId: '',
                receiverId: '',
                qualifier: '14',
            },
            validation: { strict: true, autoAck: true },
        }
    },
    aws_s3: {
        name: 'AWS S3 Storage',
        type: 'storage' as const,
        provider: 'aws',
        icon: 'HardDrive',
        spec: {
            apiVersion: 'v1',
            kind: 'S3Bucket',
            metadata: { labels: { platform: 'aws' } },
            spec: {
                region: 'us-east-1',
            }
        },
        limits: {
            maxObjectSizeGb: 5,
        }
    },
    replit: {
        name: 'Replit Deployment',
        type: 'compute' as const,
        provider: 'replit',
        icon: 'Terminal',
        spec: {
            apiVersion: 'v1',
            kind: 'ReplitApp',
            metadata: { labels: { platform: 'replit' } },
            spec: {
                language: 'nodejs',
            }
        },
        limits: {
            memory: '512Mi',
            cpu: '500m',
        }
    },
};

export async function getResourceTemplates() {
    return RESOURCE_TEMPLATES;
}

// ============================================
// PREVIEW SETTINGS
// ============================================

export async function getPreviewAutoOpen(): Promise<boolean> {
    try {
        const setting = await getSetting('preview', 'autoOpen');
        if (!setting) return true; // Default to true (auto-open enabled)
        return setting.value as boolean;
    } catch (error) {
        console.error('Failed to get preview auto-open setting:', error);
        return true; // Default to true on error
    }
}

export async function setPreviewAutoOpen(enabled: boolean) {
    return await setSetting({
        category: 'preview',
        key: 'autoOpen',
        value: enabled,
        description: 'Automatically open preview links when available'
    });
}

