import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuid } from 'uuid';
import type {
  Project, Message, FileNode, Platform, Backend,
  BackendType, TechStack, Deployment,
  Skill, CustomTool, Integration, MemoryEntry, AgentLoop, ChannelConfig,
  StackConfig, AiraContext, ChannelBridge,
  TeamBus, BuilderStatus, CritiqueResult, TeamTask,
} from '../types';

// ─── CATALOGUE of built-in integrations ──────────────────────────────────────
const BUILTIN_INTEGRATIONS: Integration[] = [
  { id: 'github',      slug: 'github',      name: 'GitHub',      description: 'Push code, create PRs, manage issues',            category: 'devops',        icon: '🐙', color: '#24292e', status: 'disconnected', authType: 'oauth',    oauthUrl: 'https://github.com/login/oauth/authorize' },
  { id: 'supabase',    slug: 'supabase',    name: 'Supabase',    description: 'Postgres DB, Auth, Storage, Realtime',            category: 'database',      icon: '⚡', color: '#3ecf8e', status: 'disconnected', authType: 'url+key' },
  { id: 'stripe',      slug: 'stripe',      name: 'Stripe',      description: 'Payments, subscriptions, webhooks',               category: 'payments',      icon: '💳', color: '#635bff', status: 'disconnected', authType: 'apikey' },
  { id: 'openai',      slug: 'openai',      name: 'OpenAI',      description: 'GPT-4o, embeddings, DALL·E, Whisper',             category: 'ai',            icon: '🤖', color: '#10a37f', status: 'disconnected', authType: 'apikey' },
  { id: 'anthropic',   slug: 'anthropic',   name: 'Anthropic',   description: 'Claude claude-sonnet-4-6, Haiku, Opus models',              category: 'ai',            icon: '🧠', color: '#cc785c', status: 'disconnected', authType: 'apikey' },
  { id: 'firebase',    slug: 'firebase',    name: 'Firebase',    description: 'Firestore, Auth, Hosting, Functions',             category: 'database',      icon: '🔥', color: '#ff9800', status: 'disconnected', authType: 'url+key' },
  { id: 'vercel',      slug: 'vercel',      name: 'Vercel',      description: 'Deploy & host web apps instantly',                category: 'devops',        icon: '▲', color: '#000000',  status: 'disconnected', authType: 'oauth',    oauthUrl: 'https://vercel.com/oauth/authorize' },
  { id: 'resend',      slug: 'resend',      name: 'Resend',      description: 'Transactional email API',                        category: 'communication', icon: '📧', color: '#000000', status: 'disconnected', authType: 'apikey' },
  { id: 'twilio',      slug: 'twilio',      name: 'Twilio',      description: 'SMS, voice, WhatsApp messaging',                 category: 'communication', icon: '📱', color: '#f22f46', status: 'disconnected', authType: 'apikey' },
  { id: 'slack',       slug: 'slack',       name: 'Slack',       description: 'Send messages, create channels, read workspace', category: 'communication', icon: '💬', color: '#4a154b', status: 'disconnected', authType: 'oauth',    oauthUrl: 'https://slack.com/oauth/v2/authorize' },
  { id: 'discord',     slug: 'discord',     name: 'Discord',     description: 'Bot messages, webhooks, channel management',     category: 'communication', icon: '🎮', color: '#5865f2', status: 'disconnected', authType: 'apikey' },
  { id: 'planetscale', slug: 'planetscale', name: 'PlanetScale', description: 'Serverless MySQL-compatible database',           category: 'database',      icon: '🪐', color: '#f4f4f5', status: 'disconnected', authType: 'url+key' },
  { id: 'upstash',     slug: 'upstash',     name: 'Upstash',     description: 'Serverless Redis & Kafka',                       category: 'database',      icon: '🔴', color: '#00e9a3', status: 'disconnected', authType: 'url+key' },
  { id: 'cloudinary',  slug: 'cloudinary',  name: 'Cloudinary',  description: 'Image & video upload, transform, CDN',           category: 'storage',       icon: '☁️', color: '#3448c5', status: 'disconnected', authType: 'url+key' },
  { id: 'mixpanel',    slug: 'mixpanel',    name: 'Mixpanel',    description: 'Product analytics, user tracking',               category: 'analytics',     icon: '📊', color: '#7856ff', status: 'disconnected', authType: 'apikey' },
  { id: 'sentry',      slug: 'sentry',      name: 'Sentry',      description: 'Error tracking and performance monitoring',      category: 'devops',        icon: '🔍', color: '#f55951', status: 'disconnected', authType: 'apikey' },
  // MCP Servers
  { id: 'mcp-filesystem', slug: 'mcp-filesystem', name: 'MCP Filesystem',    description: 'Read/write files via MCP protocol',           category: 'mcp',       icon: '📁', color: '#888', status: 'disconnected', authType: 'none', mcpTransport: 'stdio', mcpUrl: '@modelcontextprotocol/server-filesystem' },
  { id: 'mcp-github',     slug: 'mcp-github',     name: 'MCP GitHub',        description: 'GitHub operations via MCP',                   category: 'mcp',       icon: '🐙', color: '#24292e', status: 'disconnected', authType: 'apikey', mcpTransport: 'sse',   mcpUrl: 'https://mcp.github.com' },
  { id: 'mcp-postgres',   slug: 'mcp-postgres',   name: 'MCP Postgres',      description: 'Query PostgreSQL databases via MCP',          category: 'mcp',       icon: '🐘', color: '#336791', status: 'disconnected', authType: 'url+key', mcpTransport: 'stdio', mcpUrl: '@modelcontextprotocol/server-postgres' },
  { id: 'mcp-custom',     slug: 'mcp-custom',     name: 'Custom MCP Server', description: 'Connect any MCP-compatible server',           category: 'mcp',       icon: '⚙️', color: '#6366f1', status: 'disconnected', authType: 'url+key', mcpTransport: 'sse' },
];

interface AppState {
  // Projects
  projects: Project[];
  activeProjectId: string | null;

  // UI state
  activeFileId: string | null;
  rightPanel: 'code' | 'preview' | 'deploy' | 'settings' | 'terminal' | 'skills' | 'tools' | 'integrations' | 'memory' | 'agents';
  isGenerating: boolean;
  streamingMessageId: string | null;
  sidebarOpen: boolean;
  previewUrl: string | null;
  showApiKeyModal: boolean;

  // Provider config
  provider: 'anthropic' | 'openai-compatible';
  apiKey: string;
  selectedModel: string;
  customApiKey: string;
  customBaseUrl: string;
  customModel: string;

  // Team AI config
  teamMode: 'three-ai' | 'single';
  communicatorModel: string; // '' = default (auto Haiku / main model)
  criticModel: string;       // '' = default (auto Haiku / main model)

  // ── NEW: Skills ──────────────────────────────────────────────────────────
  skills: Skill[];
  addSkill: (skill: Omit<Skill, 'id' | 'createdAt'>) => Skill;
  updateSkill: (id: string, updates: Partial<Skill>) => void;
  deleteSkill: (id: string) => void;
  toggleSkill: (id: string) => void;

  // ── NEW: Custom Tools ────────────────────────────────────────────────────
  customTools: CustomTool[];
  addTool: (tool: Omit<CustomTool, 'id' | 'createdAt'>) => CustomTool;
  updateTool: (id: string, updates: Partial<CustomTool>) => void;
  deleteTool: (id: string) => void;
  toggleTool: (id: string) => void;

  // ── NEW: Integrations ────────────────────────────────────────────────────
  integrations: Integration[];
  connectIntegration: (id: string, credentials: Record<string, string>) => void;
  disconnectIntegration: (id: string) => void;
  updateIntegration: (id: string, updates: Partial<Integration>) => void;

  // ── NEW: Memory / Knowledge ──────────────────────────────────────────────
  memories: MemoryEntry[];
  addMemory: (entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>) => MemoryEntry;
  updateMemory: (id: string, updates: Partial<MemoryEntry>) => void;
  deleteMemory: (id: string) => void;
  /** Returns memories applicable to the given project */
  getMemoriesForProject: (projectId: string) => MemoryEntry[];

  // ── NEW: Agent Loops ─────────────────────────────────────────────────────
  agentLoops: AgentLoop[];
  addAgentLoop: (loop: Omit<AgentLoop, 'id' | 'createdAt' | 'runLogs'>) => AgentLoop;
  updateAgentLoop: (id: string, updates: Partial<AgentLoop>) => void;
  deleteAgentLoop: (id: string) => void;
  appendLoopLog: (id: string, line: string) => void;
  setLoopStatus: (id: string, status: AgentLoop['status']) => void;

  // ── Channel Bridges (main Aira AI ↔ external platforms) ──────────────────
  channelBridges: ChannelBridge[];
  addChannelBridge: (bridge: Omit<ChannelBridge, 'id' | 'createdAt' | 'status'>) => ChannelBridge;
  updateChannelBridge: (id: string, updates: Partial<ChannelBridge>) => void;
  deleteChannelBridge: (id: string) => void;

  // ── Team Bus (three-AI coordination) ─────────────────────────────────────
  teamBus: TeamBus;
  enqueueTask: (task: Omit<TeamTask, 'id' | 'createdAt' | 'status'>) => TeamTask;
  updateTaskStatus: (taskId: string, status: TeamTask['status']) => void;
  setBuilderStatus: (status: Partial<BuilderStatus>) => void;
  setLastCritique: (critique: CritiqueResult | null) => void;
  addMilestone: (note: string) => void;
  clearTeamBus: () => void;

  // Computed
  activeProject: () => Project | null;
  activeFile: () => FileNode | null;

  // Project actions
  createProject: (name: string, platforms: Platform[], backendType: BackendType, description?: string, stackConfig?: StackConfig) => Project;
  updateProject: (id: string, updates: Partial<Project>) => void;
  updateAiraContext: (projectId: string, updates: Partial<AiraContext>) => void;
  deleteProject: (id: string) => void;
  setActiveProject: (id: string) => void;

  // File actions
  setActiveFile: (id: string | null) => void;
  upsertFile: (projectId: string, file: FileNode) => void;
  deleteFile: (projectId: string, fileId: string) => void;
  updateFileContent: (projectId: string, fileId: string, content: string) => void;

  // Undo
  undoSnapshots: Record<string, FileNode[][]>;
  snapshotForUndo: (projectId: string) => void;
  undoLastChange: (projectId: string) => void;
  canUndo: (projectId: string) => boolean;

  // Message actions
  addMessage: (projectId: string, msg: Message) => void;
  updateMessage: (projectId: string, msgId: string, updates: Partial<Message>) => void;
  appendToMessage: (projectId: string, msgId: string, text: string) => void;
  clearMessages: (projectId: string) => void;

  // Deployment
  addDeployment: (projectId: string, deployment: Deployment) => void;
  updateDeployment: (projectId: string, deployId: string, updates: Partial<Deployment>) => void;

  // UI actions
  setRightPanel: (panel: AppState['rightPanel']) => void;
  openTerminal: () => void;
  setGenerating: (val: boolean) => void;
  setStreamingMessageId: (id: string | null) => void;
  setSidebarOpen: (val: boolean) => void;
  setPreviewUrl: (url: string | null) => void;
  setShowApiKeyModal: (val: boolean) => void;

  // Provider setters
  setProvider: (p: AppState['provider']) => void;
  setApiKey: (key: string) => void;
  setSelectedModel: (model: string) => void;
  setCustomApiKey: (key: string) => void;
  setCustomBaseUrl: (url: string) => void;
  setCustomModel: (model: string) => void;
  setTeamMode: (mode: AppState['teamMode']) => void;
  setCommunicatorModel: (model: string) => void;
  setCriticModel: (model: string) => void;

  // Backend
  addBackend: (projectId: string, backend: Backend) => void;
  removeBackend: (projectId: string, backendId: string) => void;
}

function buildDefaultFiles(platforms: Platform[]): FileNode[] {
  const files: FileNode[] = [];

  if (platforms.includes('web') || platforms.includes('fullstack')) {
    files.push(
      {
        id: uuid(), name: 'src', path: '/src', type: 'folder',
        children: [
          { id: uuid(), name: 'App.tsx', path: '/src/App.tsx', type: 'file', language: 'typescriptreact', content: '// App.tsx - Generated by Aira\n' },
          { id: uuid(), name: 'main.tsx', path: '/src/main.tsx', type: 'file', language: 'typescriptreact', content: '// Entry point\n' },
          { id: uuid(), name: 'index.css', path: '/src/index.css', type: 'file', language: 'css', content: '/* Styles */\n' },
        ]
      },
      { id: uuid(), name: 'package.json', path: '/package.json', type: 'file', language: 'json', content: '{}' },
      { id: uuid(), name: 'vite.config.ts', path: '/vite.config.ts', type: 'file', language: 'typescript', content: '' },
      { id: uuid(), name: 'index.html', path: '/index.html', type: 'file', language: 'html', content: '' },
    );
  }
  if (platforms.includes('ios') || platforms.includes('android')) {
    files.push({
      id: uuid(), name: 'app', path: '/app', type: 'folder',
      children: [
        { id: uuid(), name: 'App.tsx', path: '/app/App.tsx', type: 'file', language: 'typescriptreact', content: '// React Native App\n' },
        { id: uuid(), name: 'app.json', path: '/app/app.json', type: 'file', language: 'json', content: '{}' },
      ]
    });
  }
  if (platforms.includes('extension')) {
    files.push({
      id: uuid(), name: 'extension', path: '/extension', type: 'folder',
      children: [
        { id: uuid(), name: 'manifest.json', path: '/extension/manifest.json', type: 'file', language: 'json', content: '{}' },
        { id: uuid(), name: 'background.ts', path: '/extension/background.ts', type: 'file', language: 'typescript', content: '' },
        { id: uuid(), name: 'popup.tsx', path: '/extension/popup.tsx', type: 'file', language: 'typescriptreact', content: '' },
      ]
    });
  }
  if (platforms.includes('desktop')) {
    files.push({
      id: uuid(), name: 'electron', path: '/electron', type: 'folder',
      children: [
        { id: uuid(), name: 'main.ts', path: '/electron/main.ts', type: 'file', language: 'typescript', content: '' },
        { id: uuid(), name: 'preload.ts', path: '/electron/preload.ts', type: 'file', language: 'typescript', content: '' },
      ]
    });
  }
  if (platforms.includes('api')) {
    files.push({
      id: uuid(), name: 'api', path: '/api', type: 'folder',
      children: [
        { id: uuid(), name: 'index.ts', path: '/api/index.ts', type: 'file', language: 'typescript', content: '' },
        { id: uuid(), name: 'routes.ts', path: '/api/routes.ts', type: 'file', language: 'typescript', content: '' },
      ]
    });
  }

  return files;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,
      activeFileId: null,
      undoSnapshots: {},
      rightPanel: 'code',
      isGenerating: false,
      streamingMessageId: null,
      sidebarOpen: true,
      previewUrl: null,
      showApiKeyModal: false,

      provider: 'anthropic',
      apiKey: '',
      selectedModel: 'claude-sonnet-4-6',
      customApiKey: '',
      customBaseUrl: 'https://api.openai.com/v1',
      customModel: 'gpt-4o',
      teamMode: 'three-ai',
      communicatorModel: '',
      criticModel: '',

      // ── Skills ─────────────────────────────────────────────────────────────
      skills: [],
      addSkill: (skill) => {
        const s: Skill = { ...skill, id: uuid(), createdAt: Date.now() };
        set(state => ({ skills: [...state.skills, s] }));
        return s;
      },
      updateSkill: (id, updates) => set(state => ({
        skills: state.skills.map(s => s.id === id ? { ...s, ...updates } : s),
      })),
      deleteSkill: (id) => set(state => ({ skills: state.skills.filter(s => s.id !== id) })),
      toggleSkill: (id) => set(state => ({
        skills: state.skills.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s),
      })),

      // ── Custom Tools ───────────────────────────────────────────────────────
      customTools: [],
      addTool: (tool) => {
        const t: CustomTool = { ...tool, id: uuid(), createdAt: Date.now() };
        set(state => ({ customTools: [...state.customTools, t] }));
        return t;
      },
      updateTool: (id, updates) => set(state => ({
        customTools: state.customTools.map(t => t.id === id ? { ...t, ...updates } : t),
      })),
      deleteTool: (id) => set(state => ({ customTools: state.customTools.filter(t => t.id !== id) })),
      toggleTool: (id) => set(state => ({
        customTools: state.customTools.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t),
      })),

      // ── Integrations ───────────────────────────────────────────────────────
      integrations: BUILTIN_INTEGRATIONS,
      connectIntegration: (id, credentials) => set(state => ({
        integrations: state.integrations.map(i =>
          i.id === id ? { ...i, status: 'connected', credentials, connectedAt: Date.now(), error: undefined } : i
        ),
      })),
      disconnectIntegration: (id) => set(state => ({
        integrations: state.integrations.map(i =>
          i.id === id ? { ...i, status: 'disconnected', credentials: undefined, connectedAt: undefined } : i
        ),
      })),
      updateIntegration: (id, updates) => set(state => ({
        integrations: state.integrations.map(i => i.id === id ? { ...i, ...updates } : i),
      })),

      // ── Memory ─────────────────────────────────────────────────────────────
      memories: [],
      addMemory: (entry) => {
        const m: MemoryEntry = { ...entry, id: uuid(), createdAt: Date.now(), updatedAt: Date.now() };
        set(state => ({ memories: [...state.memories, m] }));
        return m;
      },
      updateMemory: (id, updates) => set(state => ({
        memories: state.memories.map(m => m.id === id ? { ...m, ...updates, updatedAt: Date.now() } : m),
      })),
      deleteMemory: (id) => set(state => ({ memories: state.memories.filter(m => m.id !== id) })),
      getMemoriesForProject: (projectId) => {
        const { memories } = get();
        return memories.filter(m => m.projectIds.length === 0 || m.projectIds.includes(projectId));
      },

      // ── Agent Loops ────────────────────────────────────────────────────────
      agentLoops: [],
      addAgentLoop: (loop) => {
        const l: AgentLoop = { ...loop, id: uuid(), createdAt: Date.now(), runLogs: [] };
        set(state => ({ agentLoops: [...state.agentLoops, l] }));
        return l;
      },
      updateAgentLoop: (id, updates) => set(state => ({
        agentLoops: state.agentLoops.map(l => l.id === id ? { ...l, ...updates } : l),
      })),
      deleteAgentLoop: (id) => set(state => ({ agentLoops: state.agentLoops.filter(l => l.id !== id) })),
      appendLoopLog: (id, line) => set(state => ({
        agentLoops: state.agentLoops.map(l =>
          l.id === id ? { ...l, runLogs: [...l.runLogs.slice(-200), `${new Date().toISOString()} ${line}`] } : l
        ),
      })),
      setLoopStatus: (id, status) => set(state => ({
        agentLoops: state.agentLoops.map(l => l.id === id ? { ...l, status } : l),
      })),

      // ── Channel Bridges ────────────────────────────────────────────────────
      channelBridges: [],
      addChannelBridge: (bridge) => {
        const b: ChannelBridge = { ...bridge, id: uuid(), createdAt: Date.now(), status: 'disconnected' };
        set(state => ({ channelBridges: [...state.channelBridges, b] }));
        return b;
      },
      updateChannelBridge: (id, updates) => set(state => ({
        channelBridges: state.channelBridges.map(b => b.id === id ? { ...b, ...updates } : b),
      })),
      deleteChannelBridge: (id) => set(state => ({
        channelBridges: state.channelBridges.filter(b => b.id !== id),
      })),

      // ── Team Bus ───────────────────────────────────────────────────────────
      teamBus: {
        taskQueue: [],
        builderStatus: { phase: 'idle', detail: '', updatedAt: Date.now() },
        lastCritique: null,
        milestones: [],
      },
      enqueueTask: (task) => {
        const t: TeamTask = { ...task, id: uuid(), createdAt: Date.now(), status: 'queued' };
        set(state => ({ teamBus: { ...state.teamBus, taskQueue: [...state.teamBus.taskQueue, t] } }));
        return t;
      },
      updateTaskStatus: (taskId, status) => set(state => ({
        teamBus: {
          ...state.teamBus,
          taskQueue: state.teamBus.taskQueue.map(t => t.id === taskId ? { ...t, status } : t),
        },
      })),
      setBuilderStatus: (status) => set(state => ({
        teamBus: {
          ...state.teamBus,
          builderStatus: { ...state.teamBus.builderStatus, ...status, updatedAt: Date.now() },
        },
      })),
      setLastCritique: (critique) => set(state => ({
        teamBus: { ...state.teamBus, lastCritique: critique },
      })),
      addMilestone: (note) => set(state => ({
        teamBus: {
          ...state.teamBus,
          milestones: [...state.teamBus.milestones.slice(-19), note], // keep last 20
        },
      })),
      clearTeamBus: () => set(state => ({
        teamBus: {
          taskQueue: [],
          builderStatus: { phase: 'idle', detail: '', updatedAt: Date.now() },
          lastCritique: null,
          milestones: [],
        },
      })),

      // ── Computed ───────────────────────────────────────────────────────────
      activeProject: () => {
        const { projects, activeProjectId } = get();
        return projects.find(p => p.id === activeProjectId) ?? null;
      },

      activeFile: () => {
        const { activeFileId } = get();
        const project = get().activeProject();
        if (!project || !activeFileId) return null;
        const findFile = (files: FileNode[]): FileNode | null => {
          for (const f of files) {
            if (f.id === activeFileId) return f;
            if (f.children) {
              const found = findFile(f.children);
              if (found) return found;
            }
          }
          return null;
        };
        return findFile(project.files);
      },

      createProject: (name, platforms, backendType, description = '', stackConfig) => {
        const isMobile = platforms.includes('ios') || platforms.includes('android');
        const defaultTech: TechStack = {
          frontend: stackConfig?.frameworks[0] ?? (isMobile ? 'React Native + Expo' : 'React + Vite'),
          backend: backendType === 'none' ? 'None' : (stackConfig?.frameworks[1] ?? 'Node.js + Express'),
          database: backendType === 'none' ? 'None' : 'PostgreSQL',
          styling: isMobile ? 'StyleSheet' : 'Tailwind CSS',
          state: 'Zustand',
          extra: stackConfig?.services.map(s => s.name) ?? [],
        };

        const now = Date.now();
        const airaContext: AiraContext = {
          brief: [
            `# Project Brief: ${name}`,
            '',
            `**What:** ${description || name}`,
            `**Platforms:** ${platforms.join(', ')}`,
            `**Backend:** ${backendType}`,
            stackConfig ? `**Language:** ${stackConfig.language}` : '',
            stackConfig ? `**Frameworks:** ${stackConfig.frameworks.join(', ')}` : '',
            stackConfig ? `**Frontend hosting:** ${stackConfig.frontendHosting}` : '',
            stackConfig ? `**Backend hosting:** ${stackConfig.backendHosting}` : '',
            stackConfig?.summary ? `\n## Architecture\n${stackConfig.summary}` : '',
          ].filter(Boolean).join('\n'),
          plan: `# Plan: ${name}\n\n_To be generated by Aira during first build._\n`,
          tasks: `# Tasks: ${name}\n\n- [ ] Initial setup\n- [ ] Core feature implementation\n- [ ] Testing\n- [ ] Deployment\n`,
          liveDoc: `# Live Document: ${name}\n\n**Created:** ${new Date(now).toISOString()}\n\n## Status\n🟡 Not started\n\n## What's Built\n_Nothing yet._\n\n## What Needs Building\n_Full build pending._\n\n## Last Modified\n_Never._\n\n## Where We Left Off\n_Project just created._\n`,
          comms: `# Aira Communications Log: ${name}\n\n_This document is the shared communication channel between Aira and its subagents._\n\n---\n`,
          updatedAt: now,
        };

        const project: Project = {
          id: uuid(),
          name,
          description,
          platforms,
          backendType,
          backends: [],
          files: buildDefaultFiles(platforms),
          messages: [],
          createdAt: now,
          updatedAt: now,
          deployments: [],
          tech: defaultTech,
          settings: {
            aiModel: 'claude-sonnet-4-6',
            autoSave: true,
            formatOnSave: true,
            livePreview: true,
            theme: 'dark',
          },
          stackConfig,
          airaContext,
        };

        set(state => ({
          projects: [...state.projects, project],
          activeProjectId: project.id,
        }));

        return project;
      },

      updateProject: (id, updates) => set(state => ({
        projects: state.projects.map(p =>
          p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
        ),
      })),

      updateAiraContext: (projectId, updates) => set(state => ({
        projects: state.projects.map(p =>
          p.id === projectId
            ? { ...p, airaContext: { ...(p.airaContext ?? {} as AiraContext), ...updates, updatedAt: Date.now() } }
            : p
        ),
      })),

      deleteProject: (id) => set(state => ({
        projects: state.projects.filter(p => p.id !== id),
        activeProjectId: state.activeProjectId === id
          ? (state.projects.find(p => p.id !== id)?.id ?? null)
          : state.activeProjectId,
      })),

      setActiveProject: (id) => set({ activeProjectId: id }),

      setActiveFile: (id) => set({ activeFileId: id }),

      upsertFile: (projectId, file) => set(state => {
        const findByPath = (files: FileNode[], path: string): FileNode | null => {
          for (const f of files) {
            if (f.path === path) return f;
            if (f.children) { const found = findByPath(f.children, path); if (found) return found; }
          }
          return null;
        };

        const replaceByPath = (files: FileNode[], updated: FileNode): FileNode[] =>
          files.map(f => {
            if (f.path === updated.path) return updated;
            if (f.children) return { ...f, children: replaceByPath(f.children, updated) };
            return f;
          });

        const insertIntoTree = (files: FileNode[], parts: string[]): FileNode[] => {
          if (parts.length === 1) {
            return [...files.filter(f => f.path !== file.path), file];
          }
          const folderName = parts[0];
          const fileParts = file.path.split('/').filter(Boolean);
          const depth = fileParts.length - parts.length;
          const fPath = '/' + fileParts.slice(0, depth + 1).join('/');

          const existing = files.find(f => f.type === 'folder' && f.name === folderName);
          if (existing) {
            return files.map(f =>
              f.type === 'folder' && f.name === folderName
                ? { ...f, children: insertIntoTree(f.children ?? [], parts.slice(1)) }
                : f
            );
          }
          const newFolder: FileNode = {
            id: uuid(), name: folderName, path: fPath,
            type: 'folder', children: insertIntoTree([], parts.slice(1)),
          };
          return [...files, newFolder];
        };

        const project = state.projects.find(p => p.id === projectId);
        if (!project) return state;

        const existingByPath = findByPath(project.files, file.path);
        const newFiles = existingByPath
          ? replaceByPath(project.files, file)
          : (() => {
              const parts = file.path.split('/').filter(Boolean);
              if (parts.length <= 1) {
                return [...project.files.filter(f => f.path !== file.path), file];
              }
              return insertIntoTree(project.files, parts);
            })();

        return {
          projects: state.projects.map(p =>
            p.id === projectId
              ? { ...p, files: newFiles, updatedAt: Date.now() }
              : p
          ),
        };
      }),

      deleteFile: (projectId, fileId) => set(state => {
        const remove = (files: FileNode[]): FileNode[] =>
          files.filter(f => f.id !== fileId).map(f =>
            f.children ? { ...f, children: remove(f.children) } : f
          );
        return {
          projects: state.projects.map(p =>
            p.id === projectId
              ? { ...p, files: remove(p.files), updatedAt: Date.now() }
              : p
          ),
        };
      }),

      updateFileContent: (projectId, fileId, content) => set(state => {
        const update = (files: FileNode[]): FileNode[] =>
          files.map(f => {
            if (f.id === fileId) return { ...f, content, isDirty: true };
            if (f.children) return { ...f, children: update(f.children) };
            return f;
          });
        return {
          projects: state.projects.map(p =>
            p.id === projectId ? { ...p, files: update(p.files), updatedAt: Date.now() } : p
          ),
        };
      }),

      addMessage: (projectId, msg) => set(state => ({
        projects: state.projects.map(p =>
          p.id === projectId
            ? { ...p, messages: [...p.messages, msg], updatedAt: Date.now() }
            : p
        ),
      })),

      updateMessage: (projectId, msgId, updates) => set(state => ({
        projects: state.projects.map(p =>
          p.id === projectId
            ? { ...p, messages: p.messages.map(m => m.id === msgId ? { ...m, ...updates } : m) }
            : p
        ),
      })),

      appendToMessage: (projectId, msgId, text) => set(state => ({
        projects: state.projects.map(p =>
          p.id === projectId
            ? {
              ...p,
              messages: p.messages.map(m =>
                m.id === msgId ? { ...m, content: m.content + text } : m
              ),
            }
            : p
        ),
      })),

      clearMessages: (projectId) => set(state => ({
        projects: state.projects.map(p =>
          p.id === projectId ? { ...p, messages: [] } : p
        ),
      })),

      addDeployment: (projectId, deployment) => set(state => ({
        projects: state.projects.map(p =>
          p.id === projectId
            ? { ...p, deployments: [...p.deployments, deployment], updatedAt: Date.now() }
            : p
        ),
      })),

      updateDeployment: (projectId, deployId, updates) => set(state => ({
        projects: state.projects.map(p =>
          p.id === projectId
            ? {
              ...p,
              deployments: p.deployments.map(d =>
                d.id === deployId ? { ...d, ...updates } : d
              ),
            }
            : p
        ),
      })),

      snapshotForUndo: (projectId) => set(state => {
        const project = state.projects.find(p => p.id === projectId);
        if (!project) return state;
        const existing = state.undoSnapshots[projectId] ?? [];
        const stack = [...existing, JSON.parse(JSON.stringify(project.files))].slice(-5);
        return { undoSnapshots: { ...state.undoSnapshots, [projectId]: stack } };
      }),

      undoLastChange: (projectId) => set(state => {
        const stack = state.undoSnapshots[projectId];
        if (!stack || stack.length === 0) return state;
        const snapshot = stack[stack.length - 1];
        const newStack = stack.slice(0, -1);
        return {
          projects: state.projects.map(p =>
            p.id === projectId ? { ...p, files: snapshot, updatedAt: Date.now() } : p
          ),
          undoSnapshots: { ...state.undoSnapshots, [projectId]: newStack },
        };
      }),

      canUndo: (projectId) => {
        const stack = get().undoSnapshots[projectId];
        return !!stack && stack.length > 0;
      },

      setRightPanel: (panel) => set({ rightPanel: panel }),
      openTerminal: () => set({ rightPanel: 'terminal' }),
      setGenerating: (val) => set({ isGenerating: val }),
      setStreamingMessageId: (id) => set({ streamingMessageId: id }),
      setSidebarOpen: (val) => set({ sidebarOpen: val }),
      setPreviewUrl: (url) => set({ previewUrl: url }),
      setShowApiKeyModal: (val) => set({ showApiKeyModal: val }),

      setProvider: (p) => set({ provider: p }),
      setApiKey: (key) => set({ apiKey: key }),
      setSelectedModel: (model) => set({ selectedModel: model }),
      setCustomApiKey: (key) => set({ customApiKey: key }),
      setCustomBaseUrl: (url) => set({ customBaseUrl: url }),
      setCustomModel: (model) => set({ customModel: model }),
      setTeamMode: (mode) => set({ teamMode: mode }),
      setCommunicatorModel: (model) => set({ communicatorModel: model }),
      setCriticModel: (model) => set({ criticModel: model }),

      addBackend: (projectId, backend) => set(state => ({
        projects: state.projects.map(p =>
          p.id === projectId
            ? { ...p, backends: [...p.backends, backend], updatedAt: Date.now() }
            : p
        ),
      })),

      removeBackend: (projectId, backendId) => set(state => ({
        projects: state.projects.map(p =>
          p.id === projectId
            ? { ...p, backends: p.backends.filter(b => b.id !== backendId), updatedAt: Date.now() }
            : p
        ),
      })),
    }),
    {
      name: 'aira-builder-storage',
      partialize: (state) => ({
        projects: state.projects,
        activeProjectId: state.activeProjectId,
        sidebarOpen: state.sidebarOpen,
        provider: state.provider,
        apiKey: state.apiKey,
        selectedModel: state.selectedModel,
        customApiKey: state.customApiKey,
        customBaseUrl: state.customBaseUrl,
        customModel: state.customModel,
        teamMode: state.teamMode,
        communicatorModel: state.communicatorModel,
        criticModel: state.criticModel,
        // persist new slices
        skills: state.skills,
        customTools: state.customTools,
        integrations: state.integrations,
        memories: state.memories,
        agentLoops: state.agentLoops,
        channelBridges: state.channelBridges,
      }),
    }
  )
);
