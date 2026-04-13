'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Bot, Sparkles, ChevronDown, ChevronRight, Save, Play, Rocket,
  Settings2, Brain, Wrench, Shield, Eye, Zap, FileText, Folder, Search,
  Terminal, Globe, Receipt, Calculator, FolderTree, Code, Layers, Edit3,
  Trash2, Copy, RotateCcw, Send, X, CheckCircle2, AlertTriangle, Info,
  User, Palette, BookOpen, ClipboardCheck, Package,
} from 'lucide-react';
import { TOOL_LIBRARY } from '@/lib/toolLibrary';
import { SKILLS_LIBRARY } from '@/lib/skillsLibrary';
import { createAgent } from '@/app/actions';
import { AGENT_ROLES } from '@/lib/agents/prompts';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentConfig {
  id?: string;
  name: string;
  description: string;
  systemPrompt: string;
  persona: string;
  model: string;
  tools: string[];
  skills: string[];
  autonomyLevel: 'supervised' | 'semi-autonomous' | 'autonomous';
  maxIterations: number;
  temperature: number;
  scope: 'repo' | 'workspace' | 'both';
}

interface AgentBuilderProps {
  onSave?: (config: AgentConfig) => void;
  agents?: AgentConfig[];
  embedded?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_AGENT: AgentConfig = {
  name: '',
  description: '',
  systemPrompt: '',
  persona: 'custom',
  model: 'gpt-5.4',
  tools: [],
  skills: [],
  autonomyLevel: 'semi-autonomous',
  maxIterations: 10,
  temperature: 0.3,
  scope: 'workspace',
};

const MODELS = [
  { id: 'gpt-5.4', name: 'GPT-5.4', provider: 'OpenAI' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'Google' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google' },
  { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'Anthropic' },
];

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  FileText, Folder, Search, Terminal, Globe, Receipt, Calculator,
  FolderTree, Code, Layers, Edit3, Bot, Brain, Wrench, Shield,
  Eye, Zap, Sparkles, Package, BookOpen, ClipboardCheck, Palette, User,
};

const AUTONOMY_OPTIONS: { value: AgentConfig['autonomyLevel']; label: string; description: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { value: 'supervised', label: 'Supervised', description: 'Asks before every tool use', icon: Eye },
  { value: 'semi-autonomous', label: 'Semi-Autonomous', description: 'Asks for high-risk actions only', icon: Shield },
  { value: 'autonomous', label: 'Autonomous', description: 'Executes freely without approval', icon: Zap },
];

const SCOPE_OPTIONS: { value: AgentConfig['scope']; label: string; description: string }[] = [
  { value: 'repo', label: 'Repository', description: 'Code & version control' },
  { value: 'workspace', label: 'Workspace', description: 'Files & folders' },
  { value: 'both', label: 'Both', description: 'Full access' },
];

const PERSONA_OPTIONS = [
  ...Object.entries(AGENT_ROLES).map(([key, val]) => ({
    value: key,
    label: val.name,
    description: val.description,
  })),
  { value: 'custom', label: 'Custom', description: 'Define your own persona' },
];

const AGENT_TEMPLATES: AgentConfig[] = [
  {
    name: 'Dominican Receipt Expert',
    description: 'Extracts and verifies Dominican fiscal documents (RNC, NCF, ITBIS)',
    systemPrompt: 'You are an expert in Dominican Republic fiscal compliance. You specialize in extracting data from receipts (facturas), verifying RNC numbers against DGII, validating NCF sequences, calculating ITBIS tax amounts, and organizing fiscal documents. Always output structured data with all fiscal fields clearly labeled.',
    persona: 'fiscal_analyst',
    model: 'gpt-5.4',
    tools: ['extract_receipt_info', 'verify_dgii_rnc', 'create_file', 'move_attachments_to_folder'],
    skills: ['receipt_intelligence'],
    autonomyLevel: 'semi-autonomous',
    maxIterations: 10,
    temperature: 0.1,
    scope: 'workspace',
  },
  {
    name: 'Code Reviewer',
    description: 'Reviews code changes for bugs, security issues, and best practices',
    systemPrompt: 'You are a senior code reviewer with expertise in TypeScript, React, and Node.js. You focus on identifying bugs, security vulnerabilities, performance issues, and violations of best practices. Provide clear, actionable feedback with code examples when suggesting fixes.',
    persona: 'reviewer',
    model: 'gpt-5.4',
    tools: ['read_file', 'search_codebase', 'list_dir', 'view_file', 'find_symbol_references'],
    skills: [],
    autonomyLevel: 'supervised',
    maxIterations: 5,
    temperature: 0.3,
    scope: 'repo',
  },
  {
    name: 'App Scaffolder',
    description: 'Creates new applications from templates and requirements',
    systemPrompt: 'You are an expert app scaffolder. Given a project description, you create complete application structures with proper folder layouts, configuration files, boilerplate code, and documentation. You follow modern best practices for the target framework and ensure all generated code is production-ready.',
    persona: 'architect',
    model: 'gpt-5.4',
    tools: ['create_file', 'create_folder', 'edit_file', 'run_in_terminal', 'execute_scaffold_vite'],
    skills: [],
    autonomyLevel: 'semi-autonomous',
    maxIterations: 20,
    temperature: 0.5,
    scope: 'workspace',
  },
  {
    name: 'Workspace Organizer',
    description: 'Organizes files, creates folder structures, and applies naming conventions',
    systemPrompt: 'You are a workspace organization expert. You analyze file structures, suggest and implement optimal folder hierarchies, rename files following consistent conventions, remove duplicates, and create an organized, easy-to-navigate workspace. Always explain your organization rationale.',
    persona: 'organizer',
    model: 'gpt-5.4',
    tools: ['list_dir', 'move_attachments_to_folder', 'create_folder', 'rename_file', 'highlight_file', 'batch_rename', 'find_duplicate_files'],
    skills: ['workspace_organization'],
    autonomyLevel: 'semi-autonomous',
    maxIterations: 15,
    temperature: 0.2,
    scope: 'workspace',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToolsByCategory() {
  const categories: Record<string, { id: string; name: string; description: string; icon: string }[]> = {};
  for (const [, tool] of Object.entries(TOOL_LIBRARY)) {
    const cat = tool.category;
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push({ id: tool.id, name: tool.name, description: tool.description, icon: tool.icon });
  }
  return categories;
}

function getSkillsByCategory() {
  const categories: Record<string, { id: string; name: string; description: string; icon: string; capabilities: string[] }[]> = {};
  for (const [, skill] of Object.entries(SKILLS_LIBRARY)) {
    const cat = skill.category;
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      icon: skill.icon,
      capabilities: skill.capabilities,
    });
  }
  return categories;
}

const CATEGORY_LABELS: Record<string, string> = {
  workspace: 'Workspace & Files',
  task: 'Tasks & Execution',
  fiscal: 'Fiscal & Compliance',
  verification: 'Verification',
  receipt_processing: 'Receipt Processing',
  file_management: 'File Management',
  fiscal_operations: 'Fiscal Operations',
  workspace_organization: 'Workspace Organization',
};

const CATEGORY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  workspace: Folder,
  task: Terminal,
  fiscal: Receipt,
  verification: CheckCircle2,
  receipt_processing: Receipt,
  file_management: FileText,
  fiscal_operations: Calculator,
  workspace_organization: FolderTree,
};

// ─── Sub-Components ───────────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = true,
  children,
  badge,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-white/[0.06] rounded-2xl overflow-hidden bg-white/[0.02]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.03] transition-colors"
      >
        <Icon size={16} className="text-sky-400 shrink-0" />
        <span className="text-xs font-semibold text-white/90 uppercase tracking-wider flex-1 text-left">{title}</span>
        {badge && (
          <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400">
            {badge}
          </span>
        )}
        {open ? <ChevronDown size={14} className="text-white/40" /> : <ChevronRight size={14} className="text-white/40" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1 space-y-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TestChatPanel({ config, onClose }: { config: AgentConfig; onClose: () => void }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'agent'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    // Simulate agent response based on config
    setTimeout(() => {
      const response = `[${config.name}] I received your message: "${userMsg}"\n\nI'm configured with ${config.tools.length} tools, ${config.skills.length} skills, and ${config.autonomyLevel} autonomy. Model: ${config.model}.\n\nThis is a test preview — deploy me to get real AI responses.`;
      setMessages(prev => [...prev, { role: 'agent', text: response }]);
      setIsLoading(false);
    }, 800);
  }, [input, isLoading, config]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-slate-950/95 border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[600px]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Bot size={18} className="text-sky-400" />
            <span className="text-sm font-semibold text-white/90">Test: {config.name || 'Untitled Agent'}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
            <X size={16} className="text-white/50" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-white/30 gap-2 py-10">
              <Bot size={32} />
              <p className="text-xs">Send a message to test your agent</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-3.5 py-2.5 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-sky-500/20 text-sky-100 border border-sky-500/20'
                  : 'bg-white/[0.04] text-white/80 border border-white/[0.06]'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/[0.06]">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Type a test message..."
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white/90 placeholder-white/30 outline-none focus:border-sky-500/40 transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="px-4 py-2.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 border border-sky-500/20 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AgentBuilder({ onSave, agents: externalAgents, embedded = false }: AgentBuilderProps) {
  const [agents, setAgents] = useState<AgentConfig[]>(externalAgents || []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [config, setConfig] = useState<AgentConfig>({ ...EMPTY_AGENT });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showTestChat, setShowTestChat] = useState(false);
  const [deployed, setDeployed] = useState(false);
  const [expandedToolCats, setExpandedToolCats] = useState<Record<string, boolean>>({});

  const toolsByCategory = useMemo(() => getToolsByCategory(), []);
  const skillsByCategory = useMemo(() => getSkillsByCategory(), []);

  const updateConfig = useCallback(<K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  const toggleTool = useCallback((toolId: string) => {
    setConfig(prev => ({
      ...prev,
      tools: prev.tools.includes(toolId)
        ? prev.tools.filter(t => t !== toolId)
        : [...prev.tools, toolId],
    }));
  }, []);

  const toggleSkill = useCallback((skillId: string) => {
    setConfig(prev => ({
      ...prev,
      skills: prev.skills.includes(skillId)
        ? prev.skills.filter(s => s !== skillId)
        : [...prev.skills, skillId],
    }));
  }, []);

  const handleNewAgent = useCallback(() => {
    setSelectedId(null);
    setConfig({ ...EMPTY_AGENT });
    setDeployed(false);
    setSaveSuccess(false);
  }, []);

  const handleSelectAgent = useCallback((agent: AgentConfig) => {
    setSelectedId(agent.id || null);
    setConfig({ ...agent });
    setDeployed(false);
    setSaveSuccess(false);
  }, []);

  const handleLoadTemplate = useCallback((template: AgentConfig) => {
    setSelectedId(null);
    setConfig({ ...template, id: undefined });
    setDeployed(false);
    setSaveSuccess(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!config.name.trim()) return;
    setSaving(true);
    setSaveSuccess(false);

    try {
      const result = await createAgent({
        name: config.name,
        systemPrompt: config.systemPrompt,
        description: config.description,
        tools: [...config.tools, ...config.skills],
      });

      if (result.success) {
        const savedConfig = { ...config, id: result.agentId || `agent-${Date.now()}` };
        setConfig(savedConfig);
        setSelectedId(savedConfig.id!);
        setAgents(prev => {
          const existing = prev.findIndex(a => a.id === savedConfig.id);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = savedConfig;
            return updated;
          }
          return [...prev, savedConfig];
        });
        setSaveSuccess(true);
        onSave?.(savedConfig);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch {
      // Error handled silently — saving state resets
    } finally {
      setSaving(false);
    }
  }, [config, onSave]);

  const handleDuplicate = useCallback(() => {
    setConfig(prev => ({ ...prev, id: undefined, name: `${prev.name} (Copy)` }));
    setSelectedId(null);
  }, []);

  const handleDelete = useCallback(() => {
    if (!selectedId) return;
    setAgents(prev => prev.filter(a => a.id !== selectedId));
    handleNewAgent();
  }, [selectedId, handleNewAgent]);

  const toggleToolCategory = useCallback((cat: string) => {
    setExpandedToolCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  }, []);

  const isValid = config.name.trim().length > 0;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={`flex ${embedded ? 'h-full' : 'h-full min-h-[600px]'} bg-slate-950/30 backdrop-blur-xl ${embedded ? '' : 'border border-white/[0.06] rounded-2xl'} overflow-hidden`}>

      {/* ── Left Sidebar: Agent List ── */}
      <div className="w-[250px] shrink-0 flex flex-col border-r border-white/[0.06] bg-white/[0.01]">
        <div className="p-4 border-b border-white/[0.06]">
          <button
            onClick={handleNewAgent}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 border border-sky-500/20 rounded-xl transition-all text-xs font-medium"
          >
            <Plus size={14} />
            New Agent
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin scrollbar-thumb-white/10">
          {/* Saved agents */}
          {agents.length > 0 && (
            <div className="mb-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-white/30 px-2 mb-2">Saved Agents</p>
              {agents.map(agent => (
                <button
                  key={agent.id}
                  onClick={() => handleSelectAgent(agent)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left ${
                    selectedId === agent.id
                      ? 'bg-sky-500/10 border border-sky-500/30 text-sky-400'
                      : 'hover:bg-white/[0.04] border border-transparent text-white/70'
                  }`}
                >
                  <Bot size={14} className={selectedId === agent.id ? 'text-sky-400' : 'text-white/40'} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{agent.name}</p>
                    <p className="text-[10px] text-white/40 truncate">{agent.description || 'No description'}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Templates */}
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-white/30 px-2 mb-2">Templates</p>
            {AGENT_TEMPLATES.map(template => (
              <button
                key={template.name}
                onClick={() => handleLoadTemplate(template)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] border border-transparent transition-all text-left group"
              >
                <Sparkles size={14} className="text-amber-400/60 group-hover:text-amber-400 transition-colors" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white/70 group-hover:text-white/90 truncate transition-colors">{template.name}</p>
                  <p className="text-[10px] text-white/30 truncate">{template.tools.length} tools · {template.scope}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Configuration Panel ── */}
      <div className="flex-1 min-w-0 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Settings2 size={20} className="text-sky-400" />
            <h2 className="text-sm font-bold text-white/90">
              {selectedId ? 'Edit Agent' : 'Create Agent'}
            </h2>
          </div>
          {selectedId && (
            <div className="flex items-center gap-2">
              <button onClick={handleDuplicate} className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors text-white/40 hover:text-white/70" title="Duplicate">
                <Copy size={14} />
              </button>
              <button onClick={handleDelete} className="p-2 rounded-lg hover:bg-red-500/10 transition-colors text-white/40 hover:text-red-400" title="Delete">
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Section: Identity */}
        <CollapsibleSection title="Identity" icon={User}>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-1.5 block">Name</label>
              <input
                value={config.name}
                onChange={e => updateConfig('name', e.target.value)}
                placeholder="My Custom Agent"
                className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-sky-500/50 px-4 py-2.5 rounded-xl text-xs text-white/90 placeholder-white/25 outline-none transition-all"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-1.5 block">Persona / Role</label>
              <select
                value={config.persona}
                onChange={e => updateConfig('persona', e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-sky-500/50 px-4 py-2.5 rounded-xl text-xs text-white/90 outline-none transition-all appearance-none cursor-pointer"
              >
                {PERSONA_OPTIONS.map(p => (
                  <option key={p.value} value={p.value} className="bg-slate-900 text-white">{p.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-1.5 block">Description</label>
            <textarea
              value={config.description}
              onChange={e => updateConfig('description', e.target.value)}
              placeholder="Describe what this agent does..."
              rows={2}
              className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-sky-500/50 px-4 py-2.5 rounded-xl text-xs text-white/90 placeholder-white/25 outline-none transition-all resize-none"
            />
          </div>
        </CollapsibleSection>

        {/* Section: Instructions */}
        <CollapsibleSection title="Instructions" icon={BookOpen}>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">System Prompt</label>
              <button
                onClick={() => {
                  if (!config.systemPrompt.trim()) return;
                  updateConfig('systemPrompt', config.systemPrompt + '\n\nBe precise, thorough, and always explain your reasoning before taking actions.');
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 rounded-lg transition-all"
              >
                <Sparkles size={10} />
                Enhance with AI
              </button>
            </div>
            <textarea
              value={config.systemPrompt}
              onChange={e => updateConfig('systemPrompt', e.target.value)}
              placeholder="You are an expert in..."
              rows={10}
              className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-sky-500/50 px-4 py-3 rounded-xl text-xs text-white/90 placeholder-white/25 outline-none transition-all resize-none font-mono leading-relaxed"
            />
            <div className="flex gap-2 mt-2 flex-wrap">
              {[
                { label: 'Code Expert', prompt: 'You are a senior software engineer with deep expertise in TypeScript, React, and Node.js. You write clean, efficient, well-tested code and always follow best practices.' },
                { label: 'Data Analyst', prompt: 'You are a data analyst who extracts insights from structured and unstructured data. You create clear summaries, identify patterns, and present findings in organized formats.' },
                { label: 'Task Executor', prompt: 'You are a focused task executor. You break down complex requests into steps, execute them methodically, and report progress clearly. You verify each step before proceeding.' },
              ].map(tmpl => (
                <button
                  key={tmpl.label}
                  onClick={() => updateConfig('systemPrompt', tmpl.prompt)}
                  className="px-2.5 py-1 text-[10px] font-medium text-white/50 hover:text-white/80 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-lg transition-all"
                >
                  {tmpl.label}
                </button>
              ))}
            </div>
          </div>
        </CollapsibleSection>

        {/* Section: Capabilities */}
        <CollapsibleSection
          title="Capabilities"
          icon={Wrench}
          badge={`${config.tools.length} tools · ${config.skills.length} skills`}
        >
          {/* Tools */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Tools</label>
              <div className="flex gap-2">
                <button
                  onClick={() => updateConfig('tools', Object.keys(TOOL_LIBRARY))}
                  className="text-[9px] font-medium text-sky-400 hover:text-sky-300 transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={() => updateConfig('tools', [])}
                  className="text-[9px] font-medium text-white/40 hover:text-white/60 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="space-y-1">
              {Object.entries(toolsByCategory).map(([category, tools]) => {
                const CatIcon = CATEGORY_ICONS[category] || Wrench;
                const isExpanded = expandedToolCats[category] !== false;
                const selectedCount = tools.filter(t => config.tools.includes(t.id)).length;
                return (
                  <div key={category} className="border border-white/[0.04] rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleToolCategory(category)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.03] transition-colors"
                    >
                      <CatIcon size={12} className="text-white/40" />
                      <span className="text-[10px] font-medium text-white/60 flex-1 text-left">
                        {CATEGORY_LABELS[category] || category}
                      </span>
                      {selectedCount > 0 && (
                        <span className="px-1.5 py-0.5 text-[9px] font-medium rounded-full bg-sky-500/10 text-sky-400">
                          {selectedCount}
                        </span>
                      )}
                      {isExpanded ? <ChevronDown size={12} className="text-white/30" /> : <ChevronRight size={12} className="text-white/30" />}
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-2 grid grid-cols-2 gap-1">
                        {tools.map(tool => {
                          const ToolIcon = ICON_MAP[tool.icon] || Wrench;
                          const isSelected = config.tools.includes(tool.id);
                          return (
                            <button
                              key={tool.id}
                              onClick={() => toggleTool(tool.id)}
                              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all ${
                                isSelected
                                  ? 'bg-sky-500/10 border border-sky-500/25 text-sky-400'
                                  : 'bg-white/[0.02] border border-transparent hover:bg-white/[0.04] text-white/50 hover:text-white/70'
                              }`}
                              title={tool.description}
                            >
                              <ToolIcon size={11} className="shrink-0" />
                              <span className="text-[10px] font-medium truncate">{tool.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Skills */}
          <div>
            <label className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2 block">Skills</label>
            <div className="space-y-1">
              {Object.entries(skillsByCategory).map(([category, skills]) => {
                const CatIcon = CATEGORY_ICONS[category] || Brain;
                return (
                  <div key={category}>
                    <div className="flex items-center gap-2 px-1 mb-1">
                      <CatIcon size={11} className="text-white/30" />
                      <span className="text-[9px] font-medium text-white/40 uppercase tracking-wider">
                        {CATEGORY_LABELS[category] || category}
                      </span>
                    </div>
                    {skills.map(skill => {
                      const isSelected = config.skills.includes(skill.id);
                      const SkillIcon = ICON_MAP[skill.icon] || Brain;
                      return (
                        <button
                          key={skill.id}
                          onClick={() => toggleSkill(skill.id)}
                          className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all mb-1 ${
                            isSelected
                              ? 'bg-emerald-500/10 border border-emerald-500/25'
                              : 'bg-white/[0.02] border border-transparent hover:bg-white/[0.04]'
                          }`}
                        >
                          <SkillIcon size={14} className={isSelected ? 'text-emerald-400 mt-0.5' : 'text-white/40 mt-0.5'} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-medium ${isSelected ? 'text-emerald-400' : 'text-white/70'}`}>{skill.name}</p>
                            <p className="text-[10px] text-white/35 mt-0.5">{skill.description}</p>
                            <div className="flex gap-1 mt-1.5 flex-wrap">
                              {skill.capabilities.map(cap => (
                                <span key={cap} className="px-1.5 py-0.5 text-[8px] font-medium rounded bg-white/[0.04] text-white/30">{cap.replace(/_/g, ' ')}</span>
                              ))}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scope */}
          <div>
            <label className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2 block">Scope</label>
            <div className="flex gap-2">
              {SCOPE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => updateConfig('scope', opt.value)}
                  className={`flex-1 flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl transition-all ${
                    config.scope === opt.value
                      ? 'bg-sky-500/10 border border-sky-500/25 text-sky-400'
                      : 'bg-white/[0.02] border border-white/[0.06] text-white/50 hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="text-xs font-medium">{opt.label}</span>
                  <span className="text-[9px] text-white/30">{opt.description}</span>
                </button>
              ))}
            </div>
          </div>
        </CollapsibleSection>

        {/* Section: Behavior */}
        <CollapsibleSection title="Behavior" icon={Brain}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-1.5 block">Model</label>
              <select
                value={config.model}
                onChange={e => updateConfig('model', e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-sky-500/50 px-4 py-2.5 rounded-xl text-xs text-white/90 outline-none transition-all appearance-none cursor-pointer"
              >
                {MODELS.map(m => (
                  <option key={m.id} value={m.id} className="bg-slate-900 text-white">{m.name} ({m.provider})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-1.5 block">Max Iterations</label>
              <input
                type="number"
                min={1}
                max={20}
                value={config.maxIterations}
                onChange={e => updateConfig('maxIterations', Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-sky-500/50 px-4 py-2.5 rounded-xl text-xs text-white/90 outline-none transition-all"
              />
            </div>
          </div>

          {/* Autonomy Level */}
          <div>
            <label className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2 block">Autonomy Level</label>
            <div className="space-y-1.5">
              {AUTONOMY_OPTIONS.map(opt => {
                const AutIcon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => updateConfig('autonomyLevel', opt.value)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left ${
                      config.autonomyLevel === opt.value
                        ? 'bg-sky-500/10 border border-sky-500/25'
                        : 'bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04]'
                    }`}
                  >
                    <AutIcon size={16} className={config.autonomyLevel === opt.value ? 'text-sky-400' : 'text-white/40'} />
                    <div className="flex-1">
                      <p className={`text-xs font-medium ${config.autonomyLevel === opt.value ? 'text-sky-400' : 'text-white/70'}`}>{opt.label}</p>
                      <p className="text-[10px] text-white/35">{opt.description}</p>
                    </div>
                    {config.autonomyLevel === opt.value && (
                      <CheckCircle2 size={14} className="text-sky-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Temperature */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Temperature</label>
              <span className="text-xs font-mono text-sky-400">{config.temperature.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={config.temperature}
              onChange={e => updateConfig('temperature', parseFloat(e.target.value))}
              className="w-full accent-sky-500 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-sky-400 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-sky-600 [&::-webkit-slider-thumb]:shadow-lg"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-white/25">Precise (0.0)</span>
              <span className="text-[9px] text-white/25">Creative (1.0)</span>
            </div>
          </div>
        </CollapsibleSection>

        {/* Section: Test & Deploy */}
        <CollapsibleSection title="Test & Deploy" icon={Rocket}>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowTestChat(true)}
              disabled={!isValid}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white/90 border border-white/[0.08] rounded-xl transition-all text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Play size={14} />
              Test Agent
            </button>
            <button
              onClick={handleSave}
              disabled={!isValid || saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 border border-sky-500/20 rounded-xl transition-all text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? (
                <div className="w-3.5 h-3.5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
              ) : saveSuccess ? (
                <CheckCircle2 size={14} />
              ) : (
                <Save size={14} />
              )}
              {saving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Agent'}
            </button>
            <button
              onClick={() => setDeployed(!deployed)}
              disabled={!selectedId}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed ${
                deployed
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                  : 'bg-white/[0.04] hover:bg-white/[0.08] text-white/70 border border-white/[0.08]'
              }`}
            >
              <Rocket size={14} />
              {deployed ? 'Deployed ✓' : 'Deploy'}
            </button>
          </div>
          {!selectedId && (
            <div className="flex items-center gap-2 text-[10px] text-white/35">
              <Info size={12} />
              Save the agent first to enable deployment
            </div>
          )}
        </CollapsibleSection>
      </div>

      {/* ── Right Sidebar: Preview ── */}
      {!embedded && (
        <div className="w-[280px] shrink-0 border-l border-white/[0.06] bg-white/[0.01] p-5 flex flex-col gap-5">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-3">Live Preview</p>
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                  <Bot size={18} className="text-sky-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white/90 truncate">{config.name || 'Untitled Agent'}</p>
                  <p className="text-[10px] text-white/40 truncate">{config.description || 'No description'}</p>
                </div>
              </div>

              <div className="flex gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 text-[9px] font-medium rounded-lg bg-sky-500/10 border border-sky-500/15 text-sky-400">
                  {config.tools.length} tools
                </span>
                {config.skills.length > 0 && (
                  <span className="px-2 py-0.5 text-[9px] font-medium rounded-lg bg-emerald-500/10 border border-emerald-500/15 text-emerald-400">
                    {config.skills.length} skills
                  </span>
                )}
                <span className="px-2 py-0.5 text-[9px] font-medium rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/50">
                  {config.scope}
                </span>
                {deployed && (
                  <span className="px-2 py-0.5 text-[9px] font-medium rounded-lg bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 animate-pulse">
                    LIVE
                  </span>
                )}
              </div>

              <div className="border-t border-white/[0.06] pt-3 space-y-1.5">
                <div className="flex justify-between text-[10px]">
                  <span className="text-white/30">Model</span>
                  <span className="text-white/60 font-medium">{config.model}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-white/30">Autonomy</span>
                  <span className="text-white/60 font-medium capitalize">{config.autonomyLevel.replace('-', ' ')}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-white/30">Temperature</span>
                  <span className="text-white/60 font-medium">{config.temperature.toFixed(1)}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-white/30">Max iterations</span>
                  <span className="text-white/60 font-medium">{config.maxIterations}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-white/30">Persona</span>
                  <span className="text-white/60 font-medium capitalize">{PERSONA_OPTIONS.find(p => p.value === config.persona)?.label || config.persona}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-3">Configuration</p>
            <div className="space-y-2">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] ${
                config.name.trim() ? 'bg-emerald-500/5 border border-emerald-500/15 text-emerald-400' : 'bg-white/[0.02] border border-white/[0.06] text-white/30'
              }`}>
                {config.name.trim() ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                {config.name.trim() ? 'Identity configured' : 'Name required'}
              </div>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] ${
                config.systemPrompt.trim() ? 'bg-emerald-500/5 border border-emerald-500/15 text-emerald-400' : 'bg-white/[0.02] border border-white/[0.06] text-white/30'
              }`}>
                {config.systemPrompt.trim() ? <CheckCircle2 size={12} /> : <Info size={12} />}
                {config.systemPrompt.trim() ? 'Instructions set' : 'Add system prompt'}
              </div>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] ${
                config.tools.length > 0 ? 'bg-emerald-500/5 border border-emerald-500/15 text-emerald-400' : 'bg-white/[0.02] border border-white/[0.06] text-white/30'
              }`}>
                {config.tools.length > 0 ? <CheckCircle2 size={12} /> : <Info size={12} />}
                {config.tools.length > 0 ? `${config.tools.length} tools selected` : 'Select tools'}
              </div>
            </div>
          </div>

          {/* Reset button */}
          <button
            onClick={handleNewAgent}
            className="flex items-center justify-center gap-2 px-4 py-2 mt-auto text-[10px] font-medium text-white/30 hover:text-white/60 hover:bg-white/[0.04] rounded-xl transition-all"
          >
            <RotateCcw size={12} />
            Reset Configuration
          </button>
        </div>
      )}

      {/* ── Test Chat Modal ── */}
      <AnimatePresence>
        {showTestChat && (
          <TestChatPanel config={config} onClose={() => setShowTestChat(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
