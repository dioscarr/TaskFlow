'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from './Layout';
import {
    getProfile, updateProfile, getSettings, setSetting,
    getResources, createResource, updateResource, deleteResource,
    addCredential, deleteCredential, RESOURCE_TEMPLATES,
    type UserProfileData, type CreateResourceData, type EnvVar
} from '@/app/settingsActions';

type TabType = 'profile' | 'general' | 'ai' | 'resources' | 'security';

interface Resource {
    id: string;
    name: string;
    slug: string;
    type: string;
    provider: string;
    status: string;
    healthStatus?: string;
    description?: string;
    icon?: string;
    envVars: EnvVar[];
    limits?: Record<string, unknown>;
    ediConfig?: {
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
    };
    endpoints?: Array<{
        name: string;
        url: string;
        type: string;
        auth?: string;
    }>;
    credentials: Array<{ id: string; name: string; type: string; isActive: boolean; createdAt?: string }>;
}


const TABS: { id: TabType; label: string; icon: string }[] = [
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'general', label: 'General', icon: '⚙️' },
    { id: 'ai', label: 'AI Settings', icon: '🤖' },
    { id: 'resources', label: 'Resources', icon: '🔗' },
    { id: 'security', label: 'Security', icon: '🔒' },
];

export default function Settings() {
    const [activeTab, setActiveTab] = useState<TabType>('profile');
    const [profile, setProfile] = useState<UserProfileData | null>(null);
    const [resources, setResources] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showResourceModal, setShowResourceModal] = useState(false);
    const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [profileData, resourcesData] = await Promise.all([
                getProfile(),
                getResources()
            ]);
            setProfile(profileData);
            setResources(resourcesData as Resource[]);
        } catch (err) {
            console.error('Failed to load settings:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleProfileSave = async () => {
        if (!profile) return;
        setSaving(true);
        try {
            await updateProfile(profile);
        } catch (err) {
            console.error('Failed to save profile:', err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Layout>
            <div className="h-full overflow-auto p-8">
                <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold mb-2">Settings</h1>
                        <p className="text-white/50">Manage your profile, preferences, and resources</p>
                    </div>

                    <div className="flex gap-8">
                        {/* Sidebar Tabs */}
                        <div className="w-56 shrink-0">
                            <nav className="glass-card rounded-2xl p-2 space-y-1">
                                {TABS.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${activeTab === tab.id
                                            ? 'bg-white/10 text-white'
                                            : 'text-white/50 hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        <span className="text-lg">{tab.icon}</span>
                                        <span className="font-medium">{tab.label}</span>
                                    </button>
                                ))}
                            </nav>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeTab}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="glass-card rounded-2xl p-6"
                                >
                                    {loading ? (
                                        <div className="flex items-center justify-center py-20">
                                            <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                                        </div>
                                    ) : (
                                        <>
                                            {activeTab === 'profile' && (
                                                <ProfileTab profile={profile} setProfile={setProfile} onSave={handleProfileSave} saving={saving} />
                                            )}
                                            {activeTab === 'general' && <GeneralTab />}
                                            {activeTab === 'ai' && <AITab profile={profile} setProfile={setProfile} onSave={handleProfileSave} saving={saving} />}
                                            {activeTab === 'resources' && (
                                                <ResourcesTab
                                                    resources={resources}
                                                    onRefresh={loadData}
                                                    onAddNew={() => setShowResourceModal(true)}
                                                    onSelectResource={setSelectedResource}
                                                />
                                            )}
                                            {activeTab === 'security' && <SecurityTab />}
                                        </>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </div>

            {showResourceModal && (
                <ResourceModal onClose={() => setShowResourceModal(false)} onCreated={loadData} />
            )}

            {selectedResource && (
                <ResourceDetailModal
                    resource={selectedResource}
                    onClose={() => setSelectedResource(null)}
                    onSave={loadData}
                />
            )}
        </Layout>
    );
}


function ProfileTab({ profile, setProfile, onSave, saving }: {
    profile: UserProfileData | null;
    setProfile: (p: UserProfileData | null) => void;
    onSave: () => void;
    saving: boolean;
}) {
    if (!profile) return null;

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Profile Settings</h2>

            <div className="grid grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm text-white/50 mb-2">Display Name</label>
                    <input
                        type="text"
                        value={profile.displayName || ''}
                        onChange={e => setProfile({ ...profile, displayName: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sky-400"
                    />
                </div>
                <div>
                    <label className="block text-sm text-white/50 mb-2">Timezone</label>
                    <select
                        value={profile.timezone || 'UTC'}
                        onChange={e => setProfile({ ...profile, timezone: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sky-400"
                    >
                        <option value="UTC">UTC</option>
                        <option value="America/New_York">Eastern Time</option>
                        <option value="America/Chicago">Central Time</option>
                        <option value="America/Denver">Mountain Time</option>
                        <option value="America/Los_Angeles">Pacific Time</option>
                        <option value="America/Santo_Domingo">Atlantic (DR)</option>
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-sm text-white/50 mb-2">Bio</label>
                <textarea
                    value={profile.bio || ''}
                    onChange={e => setProfile({ ...profile, bio: e.target.value })}
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sky-400 resize-none"
                />
            </div>

            <div>
                <label className="block text-sm text-white/50 mb-2">Theme</label>
                <div className="flex gap-3">
                    {['system', 'light', 'dark'].map(theme => (
                        <button
                            key={theme}
                            onClick={() => setProfile({ ...profile, theme })}
                            className={`px-4 py-2 rounded-lg capitalize ${profile.theme === theme ? 'bg-sky-500 text-white' : 'bg-white/5 text-white/70'
                                }`}
                        >
                            {theme}
                        </button>
                    ))}
                </div>
            </div>

            <button
                onClick={onSave}
                disabled={saving}
                className="px-6 py-3 bg-gradient-to-r from-sky-500 to-emerald-500 rounded-xl font-medium hover:opacity-90 disabled:opacity-50"
            >
                {saving ? 'Saving...' : 'Save Changes'}
            </button>
        </div>
    );
}

function GeneralTab() {
    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">General Settings</h2>
            <div className="space-y-4">
                <ToggleSetting label="Compact Mode" description="Use a more condensed UI layout" defaultChecked={false} />
                <ToggleSetting label="Email Notifications" description="Receive email updates" defaultChecked={true} />
                <ToggleSetting label="Desktop Notifications" description="Show desktop alerts" defaultChecked={true} />
            </div>
        </div>
    );
}

function AITab({ profile, setProfile, onSave, saving }: {
    profile: UserProfileData | null;
    setProfile: (p: UserProfileData | null) => void;
    onSave: () => void;
    saving: boolean;
}) {
    if (!profile) return null;

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">AI Settings</h2>

            <div>
                <label className="block text-sm text-white/50 mb-2">Default Model</label>
                <select
                    value={profile.defaultModel || 'gemini-2.0-flash'}
                    onChange={e => setProfile({ ...profile, defaultModel: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3"
                >
                    <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                </select>
            </div>

            <div>
                <label className="block text-sm text-white/50 mb-2">AI Personality</label>
                <div className="flex gap-3">
                    {['professional', 'casual', 'technical'].map(p => (
                        <button
                            key={p}
                            onClick={() => setProfile({ ...profile, aiPersonality: p })}
                            className={`px-4 py-2 rounded-lg capitalize ${profile.aiPersonality === p ? 'bg-sky-500 text-white' : 'bg-white/5 text-white/70'
                                }`}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <label className="block text-sm text-white/50 mb-2">Temperature: {profile.temperature || 0.7}</label>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={profile.temperature || 0.7}
                    onChange={e => setProfile({ ...profile, temperature: parseFloat(e.target.value) })}
                    className="w-full accent-sky-500"
                />
            </div>

            <button onClick={onSave} disabled={saving} className="px-6 py-3 bg-gradient-to-r from-sky-500 to-emerald-500 rounded-xl font-medium">
                {saving ? 'Saving...' : 'Save Changes'}
            </button>
        </div>
    );
}

function ResourcesTab({ resources, onRefresh, onAddNew, onSelectResource }: {
    resources: Resource[];
    onRefresh: () => void;
    onAddNew: () => void;
    onSelectResource: (r: Resource) => void;
}) {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-emerald-500';
            case 'error': return 'bg-red-500';
            case 'disabled': return 'bg-gray-500';
            default: return 'bg-amber-500';
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'api': return '🔌';
            case 'database': return '💾';
            case 'edi': return '📄';
            case 'compute': return '⚡';
            case 'storage': return '📦';
            default: return '☁️';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold">Resources</h2>
                    <p className="text-white/50 text-sm mt-1">
                        Configure external services, APIs, databases, and EDI connections.
                    </p>
                </div>
                <button onClick={onAddNew} className="px-4 py-2 bg-sky-500 rounded-lg font-medium hover:bg-sky-600 flex items-center gap-2">
                    <span>+</span> Add Resource
                </button>
            </div>

            {resources.length === 0 ? (
                <div className="text-center py-12 text-white/40 bg-white/5 rounded-xl border border-dashed border-white/20">
                    <p className="text-4xl mb-4">🔗</p>
                    <p className="font-medium">No resources configured yet</p>
                    <p className="text-sm mt-1 mb-4">Add APIs, databases, or EDI connections to get started</p>
                    <button onClick={onAddNew} className="text-sky-400 hover:underline">Add your first resource →</button>
                </div>
            ) : (
                <div className="space-y-3">
                    {resources.map(resource => (
                        <button
                            key={resource.id}
                            onClick={() => onSelectResource(resource)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4 hover:bg-white/10 hover:border-white/20 transition-all text-left group"
                        >
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center text-2xl shadow-lg">
                                {resource.icon || getTypeIcon(resource.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-white">{resource.name}</div>
                                <div className="text-sm text-white/50 flex items-center gap-2">
                                    <span>{resource.provider}</span>
                                    <span className="w-1 h-1 bg-white/30 rounded-full" />
                                    <span className="capitalize">{resource.type}</span>
                                    {resource.envVars?.length > 0 && (
                                        <>
                                            <span className="w-1 h-1 bg-white/30 rounded-full" />
                                            <span>{resource.envVars.length} env vars</span>
                                        </>
                                    )}
                                    {resource.credentials?.length > 0 && (
                                        <>
                                            <span className="w-1 h-1 bg-white/30 rounded-full" />
                                            <span>{resource.credentials.length} credentials</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${getStatusColor(resource.status)}`} />
                                    <span className="text-xs text-white/50 capitalize">{resource.status}</span>
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity text-white/50">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="9,18 15,12 9,6" />
                                    </svg>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {resources.length > 0 && (
                <div className="pt-4 border-t border-white/10 flex items-center justify-between text-sm">
                    <span className="text-white/40">{resources.length} resource{resources.length !== 1 ? 's' : ''} configured</span>
                    <button onClick={onRefresh} className="text-sky-400 hover:text-sky-300 flex items-center gap-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="23,4 23,10 17,10" />
                            <path d="M20.49,15a9,9,0,1,1-2.12-9.36L23,10" />
                        </svg>
                        Refresh
                    </button>
                </div>
            )}
        </div>
    );
}

function SecurityTab() {
    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Security</h2>
            <div className="space-y-4">
                <ToggleSetting label="Two-Factor Authentication" description="Add an extra layer of security" defaultChecked={false} />
                <ToggleSetting label="Session Timeout" description="Auto-logout after inactivity" defaultChecked={true} />
            </div>
            <div className="pt-4 border-t border-white/10">
                <button className="text-red-400 hover:text-red-300">Sign out of all devices</button>
            </div>
        </div>
    );
}

function ToggleSetting({ label, description, defaultChecked }: { label: string; description: string; defaultChecked: boolean }) {
    const [enabled, setEnabled] = useState(defaultChecked);
    return (
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
            <div>
                <div className="font-medium">{label}</div>
                <div className="text-sm text-white/50">{description}</div>
            </div>
            <button
                onClick={() => setEnabled(!enabled)}
                className={`w-12 h-6 rounded-full transition-colors ${enabled ? 'bg-sky-500' : 'bg-white/20'}`}
            >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
        </div>
    );
}

function ResourceModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const [step, setStep] = useState<'template' | 'config'>('template');
    const [selected, setSelected] = useState<string | null>(null);
    const [formData, setFormData] = useState<CreateResourceData>({ name: '', slug: '', type: 'api', provider: 'custom' });
    const [saving, setSaving] = useState(false);

    const templates = Object.entries(RESOURCE_TEMPLATES);

    const handleCreate = async () => {
        setSaving(true);
        try {
            await createResource(formData);
            onCreated();
            onClose();
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-2xl glass-card rounded-2xl p-6"
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">Add Resource</h2>
                    <button onClick={onClose} className="text-white/50 hover:text-white">✕</button>
                </div>

                {step === 'template' ? (
                    <div className="space-y-4">
                        <p className="text-white/50">Choose a template or start from scratch:</p>
                        <div className="grid grid-cols-3 gap-3 max-h-80 overflow-auto">
                            {templates.map(([key, tpl]) => (
                                <button
                                    key={key}
                                    onClick={() => {
                                        setSelected(key);
                                        const template = tpl as Record<string, unknown>;
                                        setFormData({
                                            name: tpl.name,
                                            slug: key.replace(/_/g, '-'),
                                            type: tpl.type,
                                            provider: tpl.provider,
                                            icon: tpl.icon,
                                            spec: template.spec as CreateResourceData['spec'],
                                            limits: template.limits as CreateResourceData['limits'],
                                            ediConfig: template.ediConfig as CreateResourceData['ediConfig'],
                                        });
                                    }}
                                    className={`p-4 rounded-xl text-left border ${selected === key ? 'border-sky-400 bg-sky-400/10' : 'border-white/10 bg-white/5'
                                        }`}
                                >
                                    <div className="font-medium">{tpl.name}</div>
                                    <div className="text-xs text-white/50">{tpl.type}</div>
                                </button>
                            ))}
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <button onClick={onClose} className="px-4 py-2 text-white/50">Cancel</button>
                            <button
                                onClick={() => setStep('config')}
                                disabled={!selected}
                                className="px-4 py-2 bg-sky-500 rounded-lg disabled:opacity-50"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-white/50 mb-1">Name</label>
                            <input
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-white/50 mb-1">Slug (URL-safe ID)</label>
                            <input
                                value={formData.slug}
                                onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-white/50 mb-1">Description</label>
                            <textarea
                                value={formData.description || ''}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                rows={2}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 resize-none"
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <button onClick={() => setStep('template')} className="px-4 py-2 text-white/50">Back</button>
                            <button onClick={handleCreate} disabled={saving} className="px-4 py-2 bg-sky-500 rounded-lg disabled:opacity-50">
                                {saving ? 'Creating...' : 'Create Resource'}
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
}

// ============================================
// RESOURCE DETAIL MODAL - Full Configuration
// ============================================

type ResourceDetailTab = 'overview' | 'envvars' | 'credentials' | 'edi' | 'endpoints';

function ResourceDetailModal({ resource, onClose, onSave }: {
    resource: Resource;
    onClose: () => void;
    onSave: () => void;
}) {
    const [activeTab, setActiveTab] = useState<ResourceDetailTab>('overview');
    const [localResource, setLocalResource] = useState(resource);
    const [saving, setSaving] = useState(false);
    const [newEnvVar, setNewEnvVar] = useState({ key: '', value: '', isSecret: false });
    const [showNewEnvVarForm, setShowNewEnvVarForm] = useState(false);
    const [newCredential, setNewCredential] = useState({ name: '', type: 'api_key', value: '' });
    const [showNewCredentialForm, setShowNewCredentialForm] = useState(false);

    const tabs: { id: ResourceDetailTab; label: string; icon: string; show: boolean }[] = [
        { id: 'overview', label: 'Overview', icon: '📋', show: true },
        { id: 'envvars', label: 'Environment', icon: '🔐', show: true },
        { id: 'credentials', label: 'Credentials', icon: '🔑', show: true },
        { id: 'endpoints', label: 'Endpoints', icon: '🌐', show: resource.type === 'api' || resource.type === 'compute' },
        { id: 'edi', label: 'EDI Config', icon: '📄', show: resource.type === 'edi' },
    ];

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateResource(localResource.id, {
                name: localResource.name,
                description: localResource.description,
                status: localResource.status,
                envVars: localResource.envVars,
            });
            onSave();
            onClose();
        } catch (err) {
            console.error('Failed to save:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleAddEnvVar = () => {
        if (!newEnvVar.key) return;
        setLocalResource({
            ...localResource,
            envVars: [...(localResource.envVars || []), { ...newEnvVar }]
        });
        setNewEnvVar({ key: '', value: '', isSecret: false });
        setShowNewEnvVarForm(false);
    };

    const handleRemoveEnvVar = (key: string) => {
        setLocalResource({
            ...localResource,
            envVars: localResource.envVars.filter(e => e.key !== key)
        });
    };

    const handleAddCredential = async () => {
        if (!newCredential.name) return;
        try {
            await addCredential(localResource.id, {
                name: newCredential.name,
                type: newCredential.type,
                value: newCredential.value
            });
            onSave();
            setNewCredential({ name: '', type: 'api_key', value: '' });
            setShowNewCredentialForm(false);
        } catch (err) {
            console.error('Failed to add credential:', err);
        }
    };

    const handleDeleteCredential = async (credId: string) => {
        try {
            await deleteCredential(credId);
            setLocalResource({
                ...localResource,
                credentials: localResource.credentials.filter(c => c.id !== credId)
            });
        } catch (err) {
            console.error('Failed to delete credential:', err);
        }
    };

    const handleDelete = async () => {
        if (!confirm(`Delete resource "${localResource.name}"? This action cannot be undone.`)) return;
        try {
            await deleteResource(localResource.id);
            onSave();
            onClose();
        } catch (err) {
            console.error('Failed to delete:', err);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="w-full max-w-4xl max-h-[85vh] glass-card rounded-2xl flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-400/20 to-emerald-400/20 flex items-center justify-center text-2xl">
                            {localResource.icon || (localResource.type === 'api' ? '🔌' : localResource.type === 'database' ? '💾' : localResource.type === 'edi' ? '📄' : '☁️')}
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold">{localResource.name}</h2>
                            <p className="text-sm text-white/50">{localResource.provider} • {localResource.slug}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white">
                        ✕
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/10 px-6">
                    {tabs.filter(t => t.show).map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === tab.id
                                    ? 'border-sky-400 text-white'
                                    : 'border-transparent text-white/50 hover:text-white'
                                }`}
                        >
                            <span>{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                        >
                            {activeTab === 'overview' && (
                                <OverviewPanel resource={localResource} setResource={setLocalResource} />
                            )}
                            {activeTab === 'envvars' && (
                                <EnvVarsPanel
                                    envVars={localResource.envVars || []}
                                    newEnvVar={newEnvVar}
                                    setNewEnvVar={setNewEnvVar}
                                    showForm={showNewEnvVarForm}
                                    setShowForm={setShowNewEnvVarForm}
                                    onAdd={handleAddEnvVar}
                                    onRemove={handleRemoveEnvVar}
                                />
                            )}
                            {activeTab === 'credentials' && (
                                <CredentialsPanel
                                    credentials={localResource.credentials || []}
                                    newCredential={newCredential}
                                    setNewCredential={setNewCredential}
                                    showForm={showNewCredentialForm}
                                    setShowForm={setShowNewCredentialForm}
                                    onAdd={handleAddCredential}
                                    onDelete={handleDeleteCredential}
                                />
                            )}
                            {activeTab === 'edi' && <EDIConfigPanel resource={localResource} setResource={setLocalResource} />}
                            {activeTab === 'endpoints' && <EndpointsPanel resource={localResource} />}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-white/10 bg-white/5">
                    <button onClick={handleDelete} className="px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors">
                        Delete Resource
                    </button>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-white/50 hover:text-white">Cancel</button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-2 bg-gradient-to-r from-sky-500 to-emerald-500 rounded-lg font-medium disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

// Overview Panel
function OverviewPanel({ resource, setResource }: { resource: Resource; setResource: (r: Resource) => void }) {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm text-white/50 mb-2">Name</label>
                    <input
                        type="text"
                        value={resource.name}
                        onChange={e => setResource({ ...resource, name: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sky-400"
                    />
                </div>
                <div>
                    <label className="block text-sm text-white/50 mb-2">Status</label>
                    <select
                        value={resource.status}
                        onChange={e => setResource({ ...resource, status: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3"
                    >
                        <option value="active">Active</option>
                        <option value="disabled">Disabled</option>
                        <option value="pending">Pending</option>
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-sm text-white/50 mb-2">Description</label>
                <textarea
                    value={resource.description || ''}
                    onChange={e => setResource({ ...resource, description: e.target.value })}
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 resize-none"
                />
            </div>

            <div className="grid grid-cols-3 gap-4 p-4 bg-white/5 rounded-xl">
                <div>
                    <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Type</div>
                    <div className="font-medium capitalize">{resource.type}</div>
                </div>
                <div>
                    <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Provider</div>
                    <div className="font-medium">{resource.provider}</div>
                </div>
                <div>
                    <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Slug</div>
                    <div className="font-mono text-sm">{resource.slug}</div>
                </div>
            </div>

            {resource.limits && (
                <div>
                    <h3 className="font-medium mb-3">Resource Limits</h3>
                    <div className="grid grid-cols-2 gap-3">
                        {Object.entries(resource.limits).map(([key, value]) => (
                            <div key={key} className="flex justify-between p-3 bg-white/5 rounded-lg">
                                <span className="text-white/50 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                                <span className="font-mono">{String(value)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// Environment Variables Panel
function EnvVarsPanel({ envVars, newEnvVar, setNewEnvVar, showForm, setShowForm, onAdd, onRemove }: {
    envVars: EnvVar[];
    newEnvVar: { key: string; value: string; isSecret: boolean };
    setNewEnvVar: (v: { key: string; value: string; isSecret: boolean }) => void;
    showForm: boolean;
    setShowForm: (s: boolean) => void;
    onAdd: () => void;
    onRemove: (key: string) => void;
}) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-medium">Environment Variables</h3>
                    <p className="text-sm text-white/50">Configure secrets and environment variables (Replit-style)</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="px-3 py-1.5 bg-sky-500/20 text-sky-400 rounded-lg text-sm hover:bg-sky-500/30"
                >
                    + Add Variable
                </button>
            </div>

            {showForm && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-3"
                >
                    <div className="grid grid-cols-2 gap-3">
                        <input
                            type="text"
                            placeholder="KEY_NAME"
                            value={newEnvVar.key}
                            onChange={e => setNewEnvVar({ ...newEnvVar, key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 font-mono text-sm"
                        />
                        <input
                            type={newEnvVar.isSecret ? 'password' : 'text'}
                            placeholder="value"
                            value={newEnvVar.value}
                            onChange={e => setNewEnvVar({ ...newEnvVar, value: e.target.value })}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2"
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={newEnvVar.isSecret}
                                onChange={e => setNewEnvVar({ ...newEnvVar, isSecret: e.target.checked })}
                                className="rounded"
                            />
                            <span className="text-white/70">Secret (hidden in logs)</span>
                        </label>
                        <div className="flex gap-2">
                            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-white/50 text-sm">Cancel</button>
                            <button onClick={onAdd} className="px-3 py-1.5 bg-sky-500 rounded-lg text-sm">Add</button>
                        </div>
                    </div>
                </motion.div>
            )}

            {envVars.length === 0 && !showForm ? (
                <div className="text-center py-8 text-white/40 bg-white/5 rounded-xl border border-dashed border-white/20">
                    <p className="text-2xl mb-2">🔐</p>
                    <p>No environment variables configured</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {envVars.map(env => (
                        <div key={env.key} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg group">
                            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-sm">
                                {env.isSecret ? '🔒' : '📝'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-mono text-sm font-medium">{env.key}</div>
                                <div className="text-xs text-white/40 truncate">
                                    {env.isSecret ? '••••••••••••' : env.value}
                                </div>
                            </div>
                            <button
                                onClick={() => onRemove(env.key)}
                                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 p-1"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// Credentials Panel
function CredentialsPanel({ credentials, newCredential, setNewCredential, showForm, setShowForm, onAdd, onDelete }: {
    credentials: Array<{ id: string; name: string; type: string; isActive: boolean; createdAt?: string }>;
    newCredential: { name: string; type: string; value: string };
    setNewCredential: (c: { name: string; type: string; value: string }) => void;
    showForm: boolean;
    setShowForm: (s: boolean) => void;
    onAdd: () => void;
    onDelete: (id: string) => void;
}) {
    const credentialTypes = [
        { value: 'api_key', label: 'API Key' },
        { value: 'oauth2', label: 'OAuth 2.0 Token' },
        { value: 'service_account', label: 'Service Account' },
        { value: 'basic_auth', label: 'Basic Auth' },
        { value: 'certificate', label: 'Certificate' },
    ];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-medium">Credentials</h3>
                    <p className="text-sm text-white/50">Manage API keys, tokens, and authentication</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="px-3 py-1.5 bg-sky-500/20 text-sky-400 rounded-lg text-sm hover:bg-sky-500/30"
                >
                    + Add Credential
                </button>
            </div>

            {showForm && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-3"
                >
                    <div className="grid grid-cols-2 gap-3">
                        <input
                            type="text"
                            placeholder="Credential name"
                            value={newCredential.name}
                            onChange={e => setNewCredential({ ...newCredential, name: e.target.value })}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2"
                        />
                        <select
                            value={newCredential.type}
                            onChange={e => setNewCredential({ ...newCredential, type: e.target.value })}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2"
                        >
                            {credentialTypes.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                    </div>
                    <textarea
                        placeholder="Paste your credential value (will be encrypted)"
                        value={newCredential.value}
                        onChange={e => setNewCredential({ ...newCredential, value: e.target.value })}
                        rows={3}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 font-mono text-sm resize-none"
                    />
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-white/50 text-sm">Cancel</button>
                        <button onClick={onAdd} className="px-3 py-1.5 bg-sky-500 rounded-lg text-sm">Add Credential</button>
                    </div>
                </motion.div>
            )}

            {credentials.length === 0 && !showForm ? (
                <div className="text-center py-8 text-white/40 bg-white/5 rounded-xl border border-dashed border-white/20">
                    <p className="text-2xl mb-2">🔑</p>
                    <p>No credentials configured</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {credentials.map(cred => (
                        <div key={cred.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg group">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${cred.isActive ? 'bg-emerald-500/20' : 'bg-white/10'}`}>
                                🔑
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-medium">{cred.name}</div>
                                <div className="text-xs text-white/40 flex items-center gap-2">
                                    <span className="capitalize">{cred.type.replace('_', ' ')}</span>
                                    {cred.createdAt && (
                                        <>
                                            <span className="w-1 h-1 bg-white/30 rounded-full" />
                                            <span>Added {new Date(cred.createdAt).toLocaleDateString()}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className={`px-2 py-0.5 rounded text-xs ${cred.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-white/50'}`}>
                                {cred.isActive ? 'Active' : 'Inactive'}
                            </div>
                            <button
                                onClick={() => onDelete(cred.id)}
                                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 p-1"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// EDI Configuration Panel
function EDIConfigPanel({ resource, setResource }: { resource: Resource; setResource: (r: Resource) => void }) {
    const ediConfig = resource.ediConfig || {
        standard: 'X12' as const,
        version: '5010',
        transactionSets: [],
        interchange: { senderId: '', receiverId: '', qualifier: 'ZZ' },
        validation: { strict: true, autoAck: true }
    };

    const updateEDI = (updates: Partial<typeof ediConfig>) => {
        setResource({ ...resource, ediConfig: { ...ediConfig, ...updates } });
    };

    const transactionSetOptions = [
        { code: '810', name: 'Invoice' },
        { code: '850', name: 'Purchase Order' },
        { code: '855', name: 'PO Acknowledgment' },
        { code: '856', name: 'Advance Ship Notice' },
        { code: '997', name: 'Functional Acknowledgment' },
        { code: '999', name: 'Implementation Acknowledgment' },
        { code: '270', name: 'Healthcare Eligibility Inquiry' },
        { code: '271', name: 'Healthcare Eligibility Response' },
        { code: '837', name: 'Healthcare Claim' },
    ];

    return (
        <div className="space-y-6">
            <div className="p-4 bg-gradient-to-r from-sky-500/10 to-emerald-500/10 rounded-xl border border-sky-500/20">
                <div className="flex items-center gap-2 text-sky-400 mb-2">
                    <span>📄</span>
                    <span className="font-medium">EDI Configuration (X12 / EDIFACT)</span>
                </div>
                <p className="text-sm text-white/50">Configure your Electronic Data Interchange settings for B2B document exchange</p>
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm text-white/50 mb-2">Standard</label>
                    <select
                        value={ediConfig.standard}
                        onChange={e => updateEDI({ standard: e.target.value as 'X12' | 'EDIFACT' })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3"
                    >
                        <option value="X12">ANSI X12 (North America)</option>
                        <option value="EDIFACT">UN/EDIFACT (International)</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm text-white/50 mb-2">Version</label>
                    <select
                        value={ediConfig.version}
                        onChange={e => updateEDI({ version: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3"
                    >
                        {ediConfig.standard === 'X12' ? (
                            <>
                                <option value="4010">4010 (Legacy)</option>
                                <option value="5010">5010 (Current HIPAA)</option>
                                <option value="7030">7030 (Latest)</option>
                            </>
                        ) : (
                            <>
                                <option value="D96A">D96A</option>
                                <option value="D01B">D01B</option>
                                <option value="D19A">D19A</option>
                            </>
                        )}
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-sm text-white/50 mb-2">Transaction Sets</label>
                <div className="grid grid-cols-3 gap-2">
                    {transactionSetOptions.map(ts => (
                        <label key={ts.code} className="flex items-center gap-2 p-2 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10">
                            <input
                                type="checkbox"
                                checked={ediConfig.transactionSets.includes(ts.code)}
                                onChange={e => {
                                    const sets = e.target.checked
                                        ? [...ediConfig.transactionSets, ts.code]
                                        : ediConfig.transactionSets.filter(s => s !== ts.code);
                                    updateEDI({ transactionSets: sets });
                                }}
                                className="rounded"
                            />
                            <span className="text-sm">
                                <span className="font-mono">{ts.code}</span>
                                <span className="text-white/50 ml-1">- {ts.name}</span>
                            </span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="p-4 bg-white/5 rounded-xl space-y-4">
                <h4 className="font-medium">Interchange Settings</h4>
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs text-white/50 mb-1">Sender ID (ISA06)</label>
                        <input
                            type="text"
                            value={ediConfig.interchange.senderId}
                            onChange={e => updateEDI({ interchange: { ...ediConfig.interchange, senderId: e.target.value } })}
                            placeholder="Your ID"
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 font-mono text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-white/50 mb-1">Receiver ID (ISA08)</label>
                        <input
                            type="text"
                            value={ediConfig.interchange.receiverId}
                            onChange={e => updateEDI({ interchange: { ...ediConfig.interchange, receiverId: e.target.value } })}
                            placeholder="Partner ID"
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 font-mono text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-white/50 mb-1">Qualifier</label>
                        <select
                            value={ediConfig.interchange.qualifier}
                            onChange={e => updateEDI({ interchange: { ...ediConfig.interchange, qualifier: e.target.value } })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2"
                        >
                            <option value="ZZ">Mutually Defined (ZZ)</option>
                            <option value="01">DUNS Number (01)</option>
                            <option value="08">UCC EDI ID (08)</option>
                            <option value="12">Phone Number (12)</option>
                            <option value="14">DUNS+4 (14)</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="flex gap-6">
                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={ediConfig.validation.strict}
                        onChange={e => updateEDI({ validation: { ...ediConfig.validation, strict: e.target.checked } })}
                        className="rounded"
                    />
                    <span>Strict Validation</span>
                </label>
                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={ediConfig.validation.autoAck}
                        onChange={e => updateEDI({ validation: { ...ediConfig.validation, autoAck: e.target.checked } })}
                        className="rounded"
                    />
                    <span>Auto-generate 997/999 Acknowledgments</span>
                </label>
            </div>
        </div>
    );
}

// Endpoints Panel
function EndpointsPanel({ resource }: { resource: Resource }) {
    const endpoints = resource.endpoints || [];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-medium">Endpoints</h3>
                    <p className="text-sm text-white/50">API endpoints and connection URLs</p>
                </div>
                <button className="px-3 py-1.5 bg-sky-500/20 text-sky-400 rounded-lg text-sm hover:bg-sky-500/30">
                    + Add Endpoint
                </button>
            </div>

            {endpoints.length === 0 ? (
                <div className="text-center py-8 text-white/40 bg-white/5 rounded-xl border border-dashed border-white/20">
                    <p className="text-2xl mb-2">🌐</p>
                    <p>No endpoints configured</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {endpoints.map((ep, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-sm">
                                🌐
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-medium">{ep.name}</div>
                                <div className="text-xs text-white/40 font-mono truncate">{ep.url}</div>
                            </div>
                            <span className="px-2 py-0.5 bg-white/10 rounded text-xs uppercase">{ep.type}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
