export type Platform =
  | 'web'
  | 'ios'
  | 'android'
  | 'desktop'
  | 'extension'
  | 'api'
  | 'fullstack';

export type BackendType = 'none' | 'single' | 'multiple' | 'hybrid';

export type DeployTarget =
  | 'vercel'
  | 'netlify'
  | 'appstore'
  | 'playstore'
  | 'electron'
  | 'chrome-store'
  | 'firebase'
  | 'supabase'
  | 'railway'
  | 'fly';

export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  content?: string;
  language?: string;
  children?: FileNode[];
  isNew?: boolean;
  isDirty?: boolean;
}

// Which member of the AI team produced this message
export type AiRole = 'communicator' | 'builder' | 'critic';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  isStreaming?: boolean;
  attachments?: Attachment[];
  metadata?: Record<string, unknown>;
  /** Which AI team member authored this message */
  aiRole?: AiRole;
}

// ─── Team Bus ─────────────────────────────────────────────────────────────────

export interface TeamTask {
  id: string;
  userMessage: string;
  projectId: string;
  createdAt: number;
  status: 'queued' | 'running' | 'done' | 'cancelled';
}

export interface BuilderStatus {
  phase: 'idle' | 'thinking' | 'writing' | 'running' | 'reviewing' | 'done';
  detail: string; // e.g. "Writing /src/auth/login.tsx"
  updatedAt: number;
}

export interface CritiqueResult {
  taskId: string;
  approved: boolean;
  issues: string[];
  suggestions: string[];
  round: number;
}

export interface TeamBus {
  // Communicator → Builder
  taskQueue: TeamTask[];
  // Builder → all
  builderStatus: BuilderStatus;
  // Critic results visible to UI
  lastCritique: CritiqueResult | null;
  // Accumulated milestone notes (readable in chat)
  milestones: string[];
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
  status: 'running' | 'done' | 'error';
}

export interface Attachment {
  type: 'image' | 'file' | 'url';
  name: string;
  content: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  platforms: Platform[];
  backendType: BackendType;
  backends: Backend[];
  files: FileNode[];
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  deployments: Deployment[];
  tech: TechStack;
  settings: ProjectSettings;
  /** Confirmed stack from the wizard */
  stackConfig?: StackConfig;
  /** Live context documents (.aira folder) */
  airaContext?: AiraContext;
}

export interface Backend {
  id: string;
  name: string;
  type: 'supabase' | 'firebase' | 'node' | 'python' | 'go' | 'custom';
  url?: string;
  apiKey?: string;
  config: Record<string, string>;
}

export interface Deployment {
  id: string;
  platform: Platform;
  target: DeployTarget;
  url?: string;
  status: 'pending' | 'building' | 'deployed' | 'failed';
  timestamp: number;
  logs: string[];
}

export interface TechStack {
  frontend: string;
  backend: string;
  database: string;
  styling: string;
  state: string;
  extra: string[];
}

export interface ProjectSettings {
  aiModel: string;
  autoSave: boolean;
  formatOnSave: boolean;
  livePreview: boolean;
  theme: 'dark' | 'light';
}

// ─── Stack Config (set during project wizard) ─────────────────────────────────

export type HostingTarget =
  | 'vercel' | 'netlify' | 'firebase' | 'supabase' | 'railway' | 'fly'
  | 'aws' | 'gcp' | 'azure' | 'cloudflare' | 'icp' | 'solana'
  | 'docker-self' | 'custom';

export type ServiceCategory = 'auth' | 'database' | 'storage' | 'payments' | 'maps' | 'ai' | 'email' | 'sms' | 'analytics' | 'cdn' | 'search' | 'push' | 'blockchain' | 'custom';

export interface RequiredService {
  id: string;
  name: string;
  category: ServiceCategory;
  /** short reason why it's needed */
  reason: string;
  /** env var key the user needs to provide */
  envKey: string;
  /** homepage/docs URL */
  url: string;
  /** user-provided value (api key / url / etc.) */
  value?: string;
  required: boolean;
  icon: string;
}

export interface StackConfig {
  /** Recommended primary language */
  language: string;
  /** Recommended framework(s) */
  frameworks: string[];
  /** Recommended hosting per layer */
  frontendHosting: HostingTarget;
  backendHosting: HostingTarget;
  /** Any 3rd-party services/APIs this project needs */
  services: RequiredService[];
  /** Free-form architecture summary from AI analysis */
  summary: string;
  /** Whether the user has confirmed this stack */
  confirmed: boolean;
}

// ─── Aira Context (live docs folder) ─────────────────────────────────────────

export interface AiraContext {
  /** What we're building, why, for whom */
  brief: string;
  /** Architecture + plan */
  plan: string;
  /** Task list markdown */
  tasks: string;
  /** Live doc: what's built, what's pending, last modified, where we left off */
  liveDoc: string;
  /** Shared AI ↔ subagent communication log */
  comms: string;
  updatedAt: number;
}

export interface PlatformConfig {
  id: Platform;
  label: string;
  icon: string;
  color: string;
  description: string;
  frameworks: string[];
  deployTargets: DeployTarget[];
  canPreview: boolean;
  previewType: 'iframe' | 'device' | 'terminal';
}

export interface AIModel {
  id: string;
  name: string;
  provider: 'anthropic' | 'openai' | 'google' | 'mistral';
  contextWindow: number;
  capabilities: string[];
  maxOutput: number;
}

// ─── Skills ───────────────────────────────────────────────────────────────────

export type SkillTrigger = 'manual' | 'on_message' | 'on_file_write' | 'on_build' | 'scheduled';

export interface Skill {
  id: string;
  name: string;
  description: string;
  /** The system prompt / behaviour injected when this skill is active */
  systemPrompt: string;
  /** Tools auto-attached when this skill is active */
  tools: string[];
  trigger: SkillTrigger;
  /** cron expression — only when trigger === 'scheduled' */
  schedule?: string;
  enabled: boolean;
  createdAt: number;
  /** Optional icon name from lucide-react */
  icon?: string;
  /** Colour accent for card */
  color?: string;
  /** Last run result summary */
  lastRun?: string;
  lastRunAt?: number;
}

// ─── Custom Tools ─────────────────────────────────────────────────────────────

export type ToolParamType = 'string' | 'number' | 'boolean' | 'array' | 'object';

export interface ToolParam {
  name: string;
  type: ToolParamType;
  description: string;
  required: boolean;
  default?: string;
}

export type ToolExecutor = 'http' | 'code' | 'mcp';

export interface CustomTool {
  id: string;
  name: string;
  description: string;
  params: ToolParam[];
  executor: ToolExecutor;
  /** For 'http': the URL template */
  httpUrl?: string;
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  httpHeaders?: Record<string, string>;
  /** For 'code': JS/TS snippet, receives params as args object */
  codeBody?: string;
  /** For 'mcp': server id from integrations */
  mcpServerId?: string;
  mcpToolName?: string;
  enabled: boolean;
  createdAt: number;
  icon?: string;
}

// ─── Integrations ─────────────────────────────────────────────────────────────

export type IntegrationCategory = 'database' | 'auth' | 'payments' | 'ai' | 'communication' | 'devops' | 'analytics' | 'storage' | 'mcp';

export type IntegrationStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface Integration {
  id: string;
  /** Slug e.g. 'github', 'supabase', 'stripe' */
  slug: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  icon: string;
  color: string;
  status: IntegrationStatus;
  /** OAuth or API-key based */
  authType: 'oauth' | 'apikey' | 'url+key' | 'none';
  /** OAuth callback URL */
  oauthUrl?: string;
  /** Stored credentials (api key / token) */
  credentials?: Record<string, string>;
  /** For MCP: server URL + transport */
  mcpUrl?: string;
  mcpTransport?: 'stdio' | 'sse' | 'http';
  /** Tools exposed by this integration */
  tools?: string[];
  connectedAt?: number;
  error?: string;
}

// ─── Memory / Knowledge ───────────────────────────────────────────────────────

export type MemoryType = 'note' | 'document' | 'snippet' | 'url' | 'fact';

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  title: string;
  content: string;
  tags: string[];
  /** which projects this memory applies to — empty = global */
  projectIds: string[];
  createdAt: number;
  updatedAt: number;
  /** embedding vector (small, stored as-is) */
  embedding?: number[];
}

// ─── Agent Loop / Cron / Heartbeat ────────────────────────────────────────────

export type AgentTriggerType = 'manual' | 'cron' | 'webhook' | 'event';
export type AgentLoopStatus = 'idle' | 'running' | 'paused' | 'error' | 'done';

export interface AgentLoop {
  id: string;
  name: string;
  description: string;
  /** system prompt override for this loop */
  systemPrompt: string;
  skillIds: string[];
  toolIds: string[];
  /** max autonomous steps per run */
  maxSteps: number;
  triggerType: AgentTriggerType;
  /** cron expression for scheduled triggers */
  cronSchedule?: string;
  /** webhook secret */
  webhookSecret?: string;
  status: AgentLoopStatus;
  enabled: boolean;
  createdAt: number;
  lastRunAt?: number;
  lastRunResult?: string;
  /** execution logs for last run */
  runLogs: string[];
  /** Which project this loop acts on */
  projectId?: string;
  /** delivery channels for results */
  channels: ChannelConfig[];
}

export interface ChannelConfig {
  type: 'console' | 'webhook' | 'slack' | 'discord' | 'telegram' | 'email';
  target: string; // URL / email / channel id
  enabled: boolean;
}

// ─── Channel Bridge (main Aira AI ↔ external platform) ───────────────────────

export type BridgeType = 'telegram' | 'discord' | 'slack' | 'webhook';
export type BridgeStatus = 'disconnected' | 'connecting' | 'active' | 'error';

export interface ChannelBridge {
  id: string;
  type: BridgeType;
  name: string;
  /** Telegram: BOT_TOKEN   Discord: webhook URL   Slack: webhook URL */
  token: string;
  /** Telegram: CHAT_ID to listen/send.  Discord/Slack: channel/webhook URL */
  chatId?: string;
  /** Incoming: inject external messages into Aira chat */
  incomingEnabled: boolean;
  /** Outgoing: forward Aira responses to this channel */
  outgoingEnabled: boolean;
  /** Send preview screenshots when ready */
  screenshotsEnabled: boolean;
  status: BridgeStatus;
  error?: string;
  /** Telegram: last update_id processed (for polling offset) */
  lastUpdateId?: number;
  createdAt: number;
}
