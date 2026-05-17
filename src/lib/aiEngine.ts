import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { v4 as uuid } from 'uuid';
import type { Project, FileNode, Message, ToolCall, Skill, MemoryEntry, CustomTool, AiraContext, CritiqueResult } from '../types';
import { getLanguageFromFilename } from './platforms';
import { useAppStore } from '../store';

// ─── Shared tool definitions ──────────────────────────────────────────────────

const TOOL_DEFS = [
  {
    name: 'write_file',
    description: 'Create or overwrite a file with complete, production-ready code.',
    parameters: {
      type: 'object' as const,
      properties: {
        path:        { type: 'string', description: 'Absolute file path e.g. /src/App.tsx' },
        content:     { type: 'string', description: 'Complete file content' },
        description: { type: 'string', description: 'What this file does' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'read_file',
    description: 'Read an existing project file.',
    parameters: {
      type: 'object' as const,
      properties: { path: { type: 'string' } },
      required: ['path'],
    },
  },
  {
    name: 'delete_file',
    description: 'Delete a file from the project.',
    parameters: {
      type: 'object' as const,
      properties: { path: { type: 'string' } },
      required: ['path'],
    },
  },
  {
    name: 'list_files',
    description: 'List all files in the project.',
    parameters: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'run_command',
    description: 'Run a terminal command in the project workspace (install, build, start server). Commands execute in the isolated project folder.',
    parameters: {
      type: 'object' as const,
      properties: {
        command:     { type: 'string', description: 'Command to run' },
        description: { type: 'string', description: 'What this command does' },
      },
      required: ['command'],
    },
  },
  {
    name: 'update_tech_stack',
    description: 'Update the project technology stack metadata.',
    parameters: {
      type: 'object' as const,
      properties: {
        frontend: { type: 'string' },
        backend:  { type: 'string' },
        database: { type: 'string' },
        styling:  { type: 'string' },
        state:    { type: 'string' },
        extra:    { type: 'array', items: { type: 'string' } },
      },
      required: [],
    },
  },
  {
    name: 'set_preview',
    description: 'Set the live preview URL after the dev server is running.',
    parameters: {
      type: 'object' as const,
      properties: {
        url:  { type: 'string', description: 'URL to show in preview iframe' },
        type: { type: 'string', enum: ['iframe', 'device', 'qr'] },
      },
      required: ['url'],
    },
  },
  {
    name: 'update_aira_context',
    description: 'Update the project live document (.aira folder) — what is built, what is pending, architecture decisions, where we left off. Call this after completing major milestones.',
    parameters: {
      type: 'object' as const,
      properties: {
        plan:    { type: 'string', description: 'Updated architecture and plan' },
        tasks:   { type: 'string', description: 'Updated task list in markdown checklist format' },
        liveDoc: { type: 'string', description: 'Updated live document: what is built, what needs building, last modified, where we left off' },
        comms:   { type: 'string', description: 'Append a note to the communications log' },
      },
      required: [],
    },
  },
];

const ANTHROPIC_TOOLS: Anthropic.Messages.Tool[] = TOOL_DEFS.map(t => ({
  name: t.name,
  description: t.description,
  input_schema: t.parameters,
}));

const OPENAI_TOOLS: OpenAI.Chat.ChatCompletionTool[] = TOOL_DEFS.map(t => ({
  type: 'function' as const,
  function: { name: t.name, description: t.description, parameters: t.parameters },
}));

// ─── Token limits ─────────────────────────────────────────────────────────────
// Context window per model family. Conservative for safety.
// Actual context windows per model family (2025).
// Compression triggers at TOKEN_COMPRESS_AT (78%) of these values.
const TOKEN_LIMITS: Record<string, number> = {
  // Anthropic Claude
  'claude-opus-4':         200000,
  'claude-sonnet-4':       200000,
  'claude-haiku-4':        200000,
  'claude-3-5-sonnet':     200000,
  'claude-3-5-haiku':      200000,
  'claude-3-opus':         200000,

  // OpenAI
  'gpt-4.1':               1047576, // GPT-4.1 ~1M
  'gpt-4o':                128000,
  'gpt-4-turbo':           128000,
  'gpt-4':                  8192,
  'gpt-3.5-turbo-16k':     16384,
  'gpt-3.5':                4096,
  'o3':                    200000,
  'o1':                    200000,
  'o4-mini':               200000,

  // StepFun
  'step-3.6':              262144,   // 256k (confirmed by user)
  'step-3.5-flash-2603':   262144,   // 256k — same family as step-3.5-flash
  'step-3.5-flash':        262144,   // 256k confirmed by user
  'step-3':                 64000,   // 64k per official overview
  'step-2-16k-exp':         16000,
  'step-2-16k':             16000,
  'step-2-mini':            32000,
  'step-1-256k':           262144,   // 256k
  'step-1-32k':             32000,
  'step-1-8k':               8000,

  // Meta Llama
  'llama-4':               524288, // Llama 4 Scout 10M, Maverick 1M — use conservative 512k
  'llama-3.3':             131072,
  'llama-3.2':             131072,
  'llama-3.1':             131072,
  'llama3':                 8192,

  // Mistral / Codestral
  'mistral-large':         131072,
  'codestral':             262144,
  'mistral-medium':         32000,
  'mistral-small':          32000,
  'mixtral':                32768,

  // DeepSeek
  'deepseek-r1':           128000,
  'deepseek-chat':          64000,
  'deepseek-reasoner':     128000,

  // Groq-hosted (same models, just fast)
  'gemma2':                  8192,
  'gemma':                   8192,

  // xAI Grok
  'grok-3':                131072,
  'grok-2':                131072,

  // Cerebras
  'llama-4-scout':          131072,

  // Together AI (model-specific, fallback handles rest)
  'qwen2.5':               131072,
  'qwen':                   32768,
};

function getTokenLimit(model: string): number {
  const lower = model.toLowerCase();
  // Longest-match first to avoid 'gpt-4' matching 'gpt-4o'
  const sorted = Object.entries(TOKEN_LIMITS).sort((a, b) => b[0].length - a[0].length);
  for (const [key, limit] of sorted) {
    if (lower.includes(key)) return limit;
  }
  return 32000; // safe fallback for unknown models
}

// ─── System prompt ────────────────────────────────────────────────────────────

function getStoreExtras(projectId: string): SystemPromptExtras {
  const state = useAppStore.getState();
  const project = state.projects.find(p => p.id === projectId);
  return {
    skills:      state.skills,
    memories:    state.getMemoriesForProject(projectId),
    tools:       state.customTools,
    airaContext: project?.airaContext,
  };
}

interface SystemPromptExtras {
  skills?: Skill[];
  memories?: MemoryEntry[];
  tools?: CustomTool[];
  airaContext?: AiraContext;
  resumeContext?: string;
}

function buildSystemPrompt(project: Project, extras: SystemPromptExtras = {}): string {
  const { skills = [], memories = [], tools = [], airaContext, resumeContext } = extras;
  const fileList = flattenFiles(project.files).map(f => f.path).join('\n');

  // Stack config from wizard
  const stackInfo = project.stackConfig
    ? `Language: ${project.stackConfig.language}\nFrameworks: ${project.stackConfig.frameworks.join(', ')}\nFrontend hosting: ${project.stackConfig.frontendHosting}\nBackend hosting: ${project.stackConfig.backendHosting}`
    : `Stack: ${JSON.stringify(project.tech)}`;

  const servicesInfo = project.stackConfig?.services.length
    ? `\nRequired services/APIs:\n${project.stackConfig.services.map(s => `  • ${s.name} (${s.envKey})${s.value ? ` ✓ key configured` : ' ⚠ key not set'}`).join('\n')}`
    : '';

  const base = `You are Aira — an elite AI developer agent. You build COMPLETE, PRODUCTION-READY applications. No placeholders. No TODOs. Real, working code only.

Project: ${project.name}${project.description ? `\nDescription: ${project.description}` : ''}
Platforms: ${project.platforms.join(', ')}
Backend: ${project.backendType}
${stackInfo}${servicesInfo}

Files already written:
${fileList || 'None'}

Rules:
- Write COMPLETE files — every function fully implemented
- Use latest stable tech, modern patterns, proper TypeScript
- Production quality — error handling, loading states, edge cases
- Web: React + Vite + TypeScript + Tailwind, React Router v6
- Mobile: Expo SDK 52+, Expo Router v4, NativeWind; start with "npx expo start --web" for preview
- Desktop: Electron + Vite + React
- Extension: Manifest V3, WXT framework
- API: Hono or Express, Zod, JWT, Drizzle ORM
- Full-stack: Next.js 15 App Router, Prisma, server actions

Workflow (follow strictly):
1. write_file for EVERY file — complete code, no skipping
2. run_command "npm install" after all files are written
3. run_command to start the dev server (npm run dev / npx expo start)
4. set_preview with the running URL when server is up
5. NEVER stop mid-project — keep writing files until everything is complete

After completing a major milestone, call update_aira_context to update the live document.

CRITICAL: Do NOT stop with end_turn until the ENTIRE project is built, installed, server started, and preview set.`;

  // ── Aira context (live docs) ──────────────────────────────────────────────
  const airaSection = airaContext
    ? `\n\n─── PROJECT CONTEXT ───\n${airaContext.brief}\n\n${airaContext.liveDoc}\n─────────────────────`
    : '';

  // ── Active skills ──────────────────────────────────────────────────────────
  const activeSkills = skills.filter(s => s.enabled && (s.trigger === 'on_message' || s.trigger === 'manual'));
  const skillsSection = activeSkills.length > 0
    ? `\n\n─── ACTIVE SKILLS ───\n${activeSkills.map(s => `[${s.name}]: ${s.systemPrompt}`).join('\n\n')}\n────────────────────`
    : '';

  // ── Memory / Knowledge context ─────────────────────────────────────────────
  const memSection = memories.length > 0
    ? `\n\n─── KNOWLEDGE BASE ───\n${memories.map(m => `[${m.type.toUpperCase()} — ${m.title}]: ${m.content}${m.tags.length ? ` (tags: ${m.tags.join(', ')})` : ''}`).join('\n')}\n──────────────────────`
    : '';

  // ── Custom tools ───────────────────────────────────────────────────────────
  const activeTools = tools.filter(t => t.enabled);
  const toolsSection = activeTools.length > 0
    ? `\n\n─── CUSTOM TOOLS AVAILABLE ───\n${activeTools.map(t => `• ${t.name}: ${t.description} (executor: ${t.executor})`).join('\n')}\n──────────────────────────────`
    : '';

  const full = `${base}${airaSection}${skillsSection}${memSection}${toolsSection}`;

  if (resumeContext) {
    return `${full}\n\n─── RESUME CONTEXT ───\n${resumeContext}\n─────────────────────`;
  }
  return full;
}

function buildContinuationPrompt(writtenFiles: string[], lastAction: string, previewSet: boolean): string {
  const fileList = writtenFiles.length > 0
    ? `Files written so far (${writtenFiles.length}):\n${writtenFiles.join('\n')}`
    : 'No files written yet.';

  if (previewSet) {
    return `The project is running. Review the files and check if anything is missing or incomplete. If everything is done, confirm with a brief summary.`;
  }

  return `Continue building. You stopped before finishing.

${fileList}

Last action: ${lastAction || 'none'}

What you MUST still do:
${!writtenFiles.some(f => f.includes('package.json')) ? '- Write package.json\n' : ''}\
${writtenFiles.length < 3 ? '- Write all remaining source files\n' : '- Write any remaining files\n'}\
- run_command "npm install"
- run_command to start the dev server
- set_preview with the running localhost URL

Continue immediately. Do not explain — just keep building.`;
}

function buildContextSummary(writtenFiles: string[], tokenUsed: number, tokenLimit: number): string {
  return `[AUTO-SUMMARY: Context at ${Math.round((tokenUsed / tokenLimit) * 100)}% capacity]

Progress so far:
- Files written (${writtenFiles.length}): ${writtenFiles.slice(0, 30).join(', ')}${writtenFiles.length > 30 ? ` ... and ${writtenFiles.length - 30} more` : ''}
- Installation: ${writtenFiles.length > 5 ? 'likely done' : 'not yet'}
- Dev server: unknown — check and start if needed

Continue building from where you left off. Write any missing files, ensure npm install ran, start the dev server, and call set_preview.`;
}

// ─── Tool executor ────────────────────────────────────────────────────────────

async function executeToolCall(
  name: string,
  input: Record<string, unknown>,
  project: Project,
  callbacks: AIEngineCallbacks,
  sessionState: SessionState,
): Promise<string> {
  switch (name) {
    case 'write_file': {
      const { path, content } = input as { path: string; content: string };
      callbacks.onBuilderStatus('writing', `Writing ${path}`);
      callbacks.onFileWrite(path, content);
      await writeFileToDisk(project.id, project.name, path, content);
      sessionState.writtenFiles.add(path);
      sessionState.lastAction = `write_file ${path}`;
      return `Written: ${path}`;
    }
    case 'read_file': {
      const { path } = input as { path: string };
      callbacks.onBuilderStatus('thinking', `Reading ${path}`);
      const file = findFileByPath(project.files, path);
      sessionState.lastAction = `read_file ${path}`;
      return file?.content ?? `File not found: ${path}`;
    }
    case 'delete_file': {
      const { path } = input as { path: string };
      callbacks.onFileDelete(path);
      sessionState.lastAction = `delete_file ${path}`;
      return `Deleted: ${path}`;
    }
    case 'list_files':
      callbacks.onBuilderStatus('thinking', 'Scanning project files');
      return flattenFiles(project.files).map(f => f.path).join('\n') || 'No files';
    case 'run_command': {
      const { command } = input as { command: string };
      callbacks.onBuilderStatus('running', `$ ${command.slice(0, 60)}`);
      sessionState.lastAction = `run_command: ${command}`;
      if (command.includes('install')) sessionState.installRan = true;
      const output = await execInWorkspace(project.id, project.name, command);
      return output || '[OK]';
    }
    case 'update_tech_stack':
      callbacks.onTechStackUpdate(input as Partial<Project['tech']>);
      return 'Tech stack updated';
    case 'set_preview': {
      const { url } = input as { url: string };
      callbacks.onBuilderStatus('done', `Preview live at ${url}`);
      callbacks.onPreviewUrl(url);
      sessionState.previewSet = true;
      sessionState.lastAction = `set_preview ${url}`;
      const milestone = `Preview live: ${url} (${sessionState.writtenFiles.size} files written)`;
      callbacks.onMilestone(milestone);
      return `Preview: ${url}`;
    }
    case 'update_aira_context': {
      const updates = input as { plan?: string; tasks?: string; liveDoc?: string; comms?: string };
      const store = useAppStore.getState();
      const existing = store.projects.find(p => p.id === project.id)?.airaContext;
      const contextUpdates: Record<string, string | number> = {};
      if (updates.plan)    contextUpdates.plan    = updates.plan;
      if (updates.tasks)   contextUpdates.tasks   = updates.tasks;
      if (updates.liveDoc) contextUpdates.liveDoc = updates.liveDoc;
      if (updates.comms && existing?.comms) {
        const ts = new Date().toISOString();
        contextUpdates.comms = `${existing.comms}\n[${ts}] ${updates.comms}`;
      }
      if (Object.keys(contextUpdates).length > 0) {
        store.updateAiraContext(project.id, contextUpdates as Parameters<typeof store.updateAiraContext>[1]);
        // Also write to disk so subagents can read them
        if (updates.liveDoc) await writeFileToDisk(project.id, project.name, '/.aira/live.md', updates.liveDoc);
        if (updates.tasks)   await writeFileToDisk(project.id, project.name, '/.aira/tasks.md', updates.tasks);
        if (updates.plan)    await writeFileToDisk(project.id, project.name, '/.aira/plan.md', updates.plan);
        if (updates.comms)   await writeFileToDisk(project.id, project.name, '/.aira/comms.md', contextUpdates.comms as string ?? updates.comms);
      }
      sessionState.lastAction = 'update_aira_context';
      if (updates.liveDoc) callbacks.onMilestone(updates.liveDoc.split('\n')[0] ?? 'Context updated');
      return 'Aira context updated';
    }
    default:
      return 'Unknown tool';
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function flattenFiles(files: FileNode[]): FileNode[] {
  const result: FileNode[] = [];
  for (const f of files) {
    if (f.type === 'file') result.push(f);
    if (f.children) result.push(...flattenFiles(f.children));
  }
  return result;
}

function findFileByPath(files: FileNode[], path: string): FileNode | null {
  for (const f of files) {
    if (f.path === path) return f;
    if (f.children) {
      const found = findFileByPath(f.children, path);
      if (found) return found;
    }
  }
  return null;
}

// ─── Session state tracker ────────────────────────────────────────────────────

interface SessionState {
  writtenFiles: Set<string>;
  lastAction: string;
  previewSet: boolean;
  installRan: boolean;
  totalInputTokens: number;
  totalOutputTokens: number;
  continuationCount: number;
  summarizationCount: number;
}

// ─── Callbacks ────────────────────────────────────────────────────────────────

export interface AIEngineCallbacks {
  onToken: (token: string) => void;
  onToolCall: (tool: ToolCall) => void;
  onToolResult: (toolId: string, result: string) => void;
  onFileWrite: (path: string, content: string) => void;
  onFileDelete: (path: string) => void;
  onPreviewUrl: (url: string) => void;
  onTechStackUpdate: (tech: Partial<Project['tech']>) => void;
  onTokenUsage: (used: number, limit: number, percent: number) => void;
  onStatusUpdate: (status: string) => void;
  onBuilderStatus: (phase: string, detail: string) => void;
  onMilestone: (note: string) => void;
  onComplete: (finalText: string) => void;
  onError: (err: string) => void;
}

// ─── Workspace helpers ────────────────────────────────────────────────────────

/** Write all .aira context files to disk for a fresh project */
export async function initAiraContextOnDisk(project: Project): Promise<void> {
  if (!project.airaContext) return;
  const { brief, plan, tasks, liveDoc, comms } = project.airaContext;
  await Promise.all([
    writeFileToDisk(project.id, project.name, '/.aira/brief.md', brief),
    writeFileToDisk(project.id, project.name, '/.aira/plan.md', plan),
    writeFileToDisk(project.id, project.name, '/.aira/tasks.md', tasks),
    writeFileToDisk(project.id, project.name, '/.aira/live.md', liveDoc),
    writeFileToDisk(project.id, project.name, '/.aira/comms.md', comms),
  ]);
}

async function writeFileToDisk(projectId: string, projectName: string, filePath: string, content: string): Promise<void> {
  try {
    await fetch('/api/workspace/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, projectName, path: filePath, content }),
    });
  } catch { /* non-fatal */ }
}

// Detect if a command starts a long-running server
function isServerStartCommand(command: string): boolean {
  const lower = command.toLowerCase();
  return (
    /\bnpm run dev\b/.test(lower) ||
    /\bnpm run start\b/.test(lower) ||
    /\bnpm start\b/.test(lower) ||
    /\bexpo start\b/.test(lower) ||
    /\bnpx expo\b/.test(lower) ||
    /\bpnpm dev\b/.test(lower) ||
    /\bbun dev\b/.test(lower) ||
    /\bvite\b/.test(lower) ||
    /\bnext dev\b/.test(lower) ||
    /\bnuxt dev\b/.test(lower) ||
    /\bng serve\b/.test(lower) ||
    /\bserve\b/.test(lower)
  );
}

async function execInWorkspace(projectId: string, projectName: string, command: string): Promise<string> {
  try {
    // Long-running server commands use /start endpoint
    if (isServerStartCommand(command)) {
      const res = await fetch('/api/workspace/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, projectName, command, preferredPort: '5174' }),
      });
      const data = await res.json() as { ok: boolean; url: string; port: number; output: string; error?: string };
      if (data.error) return `[Server error: ${data.error}]`;
      // data.url is already the public tunnel URL from the server
      return `Server started at ${data.url}\nNOW call set_preview with URL: ${data.url}\n${data.output?.slice(-300) ?? ''}`;
    }

    const res = await fetch('/api/workspace/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, projectName, command }),
    });
    const data = await res.json() as { ok: boolean; stdout: string; stderr: string; exitCode: number };
    const out = [data.stdout, data.stderr].filter(Boolean).join('\n').trim();
    return out || (data.ok ? '[OK]' : `[exit ${data.exitCode}]`);
  } catch (e) {
    return `[exec error: ${e}]`;
  }
}

export interface ProviderConfig {
  provider: 'anthropic' | 'openai-compatible';
  apiKey?: string;
  model?: string;
  customApiKey?: string;
  customBaseUrl?: string;
  customModel?: string;
}

// ─── Anthropic session ────────────────────────────────────────────────────────

const MAX_CONTINUATIONS = 12;   // max auto-continue rounds
const MAX_SUMMARIZATIONS = 4;   // max context compressions
const TOKEN_COMPRESS_AT = 0.78; // compress when 78% full

async function runAnthropicSession(
  config: ProviderConfig,
  project: Project,
  userMessage: string,
  history: Message[],
  callbacks: AIEngineCallbacks,
): Promise<void> {
  const client = new Anthropic({ apiKey: config.apiKey!, dangerouslyAllowBrowser: true });
  const tokenLimit = getTokenLimit(config.model ?? '');
  const state: SessionState = {
    writtenFiles: new Set(),
    lastAction: '',
    previewSet: false,
    installRan: false,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    continuationCount: 0,
    summarizationCount: 0,
  };

  let messages: Anthropic.Messages.MessageParam[] = history
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  messages.push({ role: 'user', content: userMessage });

  let finalText = '';
  let keepGoing = true;
  callbacks.onBuilderStatus('thinking', 'Planning approach...');

  while (keepGoing) {
    const response = await client.messages.create({
      model: config.model!,
      max_tokens: 16384,
      system: buildSystemPrompt(project, getStoreExtras(project.id)),
      tools: ANTHROPIC_TOOLS,
      messages,
    });

    // Track tokens
    state.totalInputTokens += response.usage.input_tokens;
    state.totalOutputTokens += response.usage.output_tokens;
    const totalUsed = state.totalInputTokens + state.totalOutputTokens;
    const pct = totalUsed / tokenLimit;
    callbacks.onTokenUsage(totalUsed, tokenLimit, Math.round(pct * 100));

    messages.push({ role: 'assistant', content: response.content });
    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        finalText += block.text;
        callbacks.onToken(block.text);
      } else if (block.type === 'tool_use') {
        const tc: ToolCall = { id: block.id, name: block.name, input: block.input as Record<string, unknown>, status: 'running' };
        callbacks.onToolCall(tc);
        const result = await executeToolCall(block.name, block.input as Record<string, unknown>, project, callbacks, state);
        callbacks.onToolResult(block.id, result);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
      }
    }

    if (toolResults.length > 0) {
      messages.push({ role: 'user', content: toolResults });
    }

    // ── Decide whether to continue ──────────────────────────────────────────

    if (response.stop_reason === 'tool_use') {
      // Model called tools — always continue
      keepGoing = true;

    } else if (response.stop_reason === 'end_turn') {
      // Model thinks it's done — check if project is actually complete
      const isDone = state.previewSet || state.continuationCount >= MAX_CONTINUATIONS;

      if (!isDone) {
        state.continuationCount++;
        const contPrompt = buildContinuationPrompt(
          Array.from(state.writtenFiles),
          state.lastAction,
          state.previewSet,
        );
        callbacks.onStatusUpdate(`⟳ Continuing (${state.continuationCount}/${MAX_CONTINUATIONS})...`);
        callbacks.onToken(`\n\n---\n*Continuing build...*\n\n`);
        messages.push({ role: 'user', content: contPrompt });
        keepGoing = true;
      } else {
        keepGoing = false;
      }
    } else {
      keepGoing = false;
    }

    // ── Context compression at ~78% tokens ──────────────────────────────────
    if (pct >= TOKEN_COMPRESS_AT && state.summarizationCount < MAX_SUMMARIZATIONS) {
      state.summarizationCount++;
      const summary = buildContextSummary(Array.from(state.writtenFiles), totalUsed, tokenLimit);
      callbacks.onStatusUpdate(`📝 Compressing context (${Math.round(pct * 100)}% used)...`);
      callbacks.onToken(`\n\n---\n*Context compressed — continuing from checkpoint...*\n\n`);

      // Keep only the original user message + summary + last 2 exchanges
      const lastTwo = messages.slice(-4);
      messages = [
        { role: 'user', content: userMessage },
        { role: 'assistant', content: `[Context summary]\n${summary}` },
        ...lastTwo,
      ];
      // Reset token counters after compression
      state.totalInputTokens = 0;
      state.totalOutputTokens = 0;
      keepGoing = true;
    }
  }

  callbacks.onBuilderStatus('done', `Done — ${state.writtenFiles.size} files`);
  callbacks.onComplete(finalText);
}

// ─── OpenAI-compatible session ────────────────────────────────────────────────

async function proxyFetch(targetUrl: string, apiKey: string, body: unknown): Promise<Response> {
  return fetch('/api/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      targetUrl,
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    }),
  });
}

async function runOpenAISession(
  config: ProviderConfig,
  project: Project,
  userMessage: string,
  history: Message[],
  callbacks: AIEngineCallbacks,
): Promise<void> {
  const baseURL = (config.customBaseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
  const apiKey = config.customApiKey || 'sk-placeholder';
  const model = config.customModel || 'gpt-4o';
  const tokenLimit = getTokenLimit(model);

  const state: SessionState = {
    writtenFiles: new Set(),
    lastAction: '',
    previewSet: false,
    installRan: false,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    continuationCount: 0,
    summarizationCount: 0,
  };

  let messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(project, getStoreExtras(project.id)) },
    ...history
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: userMessage },
  ];

  let finalText = '';
  let keepGoing = true;
  callbacks.onBuilderStatus('thinking', 'Planning approach...');

  while (keepGoing) {
    const requestBody = { model, messages, tools: OPENAI_TOOLS, tool_choice: 'auto', max_tokens: 16384 };
    const httpRes = await proxyFetch(`${baseURL}/chat/completions`, apiKey, requestBody);
    const data = await httpRes.json() as OpenAI.Chat.ChatCompletion & { error?: { message: string } };

    if (!httpRes.ok || data.error) throw new Error(data.error?.message ?? `HTTP ${httpRes.status}`);

    // Track tokens
    const usage = data.usage;
    if (usage) {
      state.totalInputTokens += usage.prompt_tokens ?? 0;
      state.totalOutputTokens += usage.completion_tokens ?? 0;
    }
    const totalUsed = state.totalInputTokens + state.totalOutputTokens;
    const pct = totalUsed / tokenLimit;
    callbacks.onTokenUsage(totalUsed, tokenLimit, Math.round(pct * 100));

    const choice = data.choices[0];
    const msg = choice.message;
    messages.push(msg);

    if (msg.content) {
      finalText += msg.content;
      callbacks.onToken(msg.content);
    }

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      const toolResultMsgs: OpenAI.Chat.ChatCompletionToolMessageParam[] = [];
      for (const tc of msg.tool_calls) {
        let input: Record<string, unknown> = {};
        try { input = JSON.parse(tc.function.arguments); } catch { /* ignore */ }

        const toolCall: ToolCall = { id: tc.id, name: tc.function.name, input, status: 'running' };
        callbacks.onToolCall(toolCall);
        const result = await executeToolCall(tc.function.name, input, project, callbacks, state);
        callbacks.onToolResult(tc.id, result);
        toolResultMsgs.push({ role: 'tool', tool_call_id: tc.id, content: result });
      }
      messages.push(...toolResultMsgs);
      keepGoing = true;

    } else {
      // No tool calls — check if project is done
      const finishReason = choice.finish_reason;
      const isDone = state.previewSet || state.continuationCount >= MAX_CONTINUATIONS;

      if (!isDone && finishReason === 'stop') {
        state.continuationCount++;
        const contPrompt = buildContinuationPrompt(Array.from(state.writtenFiles), state.lastAction, state.previewSet);
        callbacks.onStatusUpdate(`⟳ Continuing (${state.continuationCount}/${MAX_CONTINUATIONS})...`);
        callbacks.onToken(`\n\n---\n*Continuing build...*\n\n`);
        messages.push({ role: 'user', content: contPrompt });
        keepGoing = true;
      } else {
        keepGoing = false;
      }
    }

    // Context compression
    if (pct >= TOKEN_COMPRESS_AT && state.summarizationCount < MAX_SUMMARIZATIONS) {
      state.summarizationCount++;
      const summary = buildContextSummary(Array.from(state.writtenFiles), totalUsed, tokenLimit);
      callbacks.onStatusUpdate(`📝 Compressing context (${Math.round(pct * 100)}% used)...`);
      callbacks.onToken(`\n\n---\n*Context compressed — continuing...*\n\n`);

      const lastTwo = messages.slice(-4);
      messages = [
        { role: 'system', content: buildSystemPrompt(project, getStoreExtras(project.id)) },
        { role: 'user', content: userMessage },
        { role: 'assistant', content: `[Context summary]\n${summary}` },
        ...lastTwo,
      ];
      state.totalInputTokens = 0;
      state.totalOutputTokens = 0;
      keepGoing = true;
    }
  }

  callbacks.onBuilderStatus('done', `Done — ${state.writtenFiles.size} files`);
  callbacks.onComplete(finalText);
}

// ─── Communicator system prompt ───────────────────────────────────────────────

function buildCommunicatorPrompt(project: Project, builderBusy: boolean, lastMilestone: string): string {
  return `You are the Communicator — the friendly, natural voice of Aira AI. You talk directly with the user.

Project: "${project.name}" | Platforms: ${project.platforms.join(', ')}

Your job:
- Understand what the user wants (intent, not just literal words)
- Respond naturally, like a human colleague would — warm, direct, no jargon
- Tell the user what is happening with the build in plain language
- If the user asks a question while building is in progress, answer it without stopping the build
- Keep responses SHORT unless the user asks for detail
- NEVER say "I am an AI" or use robotic phrases
- Use first person: "I'm", "I've", "Let me", "Just finished..."

Current build state: ${builderBusy ? `Builder is actively working. Last milestone: "${lastMilestone || 'starting...'}"` : 'No build running.'}

When user sends a message:
1. If it's a BUILD request (new app, add feature, fix bug, change something):
   - Reply acknowledging what you're doing ("On it — building the auth system now")
   - Output JSON on the LAST line: {"action":"build","brief":"<clear task description for Builder>"}
2. If it's a QUESTION or CONVERSATION (how does X work, what did you just do, etc.):
   - Just answer naturally. No JSON needed.
3. If user wants to CHANGE direction mid-build:
   - Acknowledge and note it will be picked up ("Got it, I'll make it dark theme once the current step finishes")
   - Output JSON: {"action":"queue","brief":"<what to add to queue>"}
4. If it's FEEDBACK on finished work (looks good, try again, etc.):
   - Respond naturally and output JSON if action needed: {"action":"build","brief":"..."}

Respond naturally first. If action needed, put the JSON on the very last line only.`;
}

// ─── Critic system prompt ─────────────────────────────────────────────────────

function buildCriticPrompt(project: Project, taskBrief: string, builtSummary: string, round: number): string {
  return `You are the Critic — the QA brain of Aira AI. You review Builder's work silently and report issues.

Project: "${project.name}" | Task: "${taskBrief}"
Review round: ${round}/2

What Builder just completed:
${builtSummary}

Your job — check for:
1. Missing files or incomplete implementations (TODOs, placeholder functions)
2. Logic errors or incorrect algorithms
3. Security issues (exposed keys, no auth checks, SQL injection risk)
4. UI/UX problems (inaccessible, broken layout, wrong platform conventions)
5. Integration errors (wrong API calls, missing env vars, wrong endpoints)
6. Unfinished tasks the user asked for that weren't addressed
7. Performance issues (N+1 queries, missing indexes, blocking calls)

Be decisive. Only flag REAL problems, not style preferences.

Respond with valid JSON only:
{
  "approved": true/false,
  "issues": ["specific issue 1", "specific issue 2"],
  "suggestions": ["how to fix issue 1", "how to fix issue 2"]
}

If approved is true, issues and suggestions should be empty arrays.`;
}

// ─── Communicator session ─────────────────────────────────────────────────────

export interface CommunicatorResult {
  reply: string;
  action: 'build' | 'queue' | 'none';
  brief: string;
}

async function runCommunicatorCall(
  config: ProviderConfig,
  project: Project,
  userMessage: string,
  history: Message[],
  builderBusy: boolean,
  lastMilestone: string,
  modelOverride?: string,
): Promise<CommunicatorResult> {
  const systemPrompt = buildCommunicatorPrompt(project, builderBusy, lastMilestone);

  // Build a condensed history (last 6 exchanges max — Communicator is fast/cheap)
  const recent = history
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .slice(-12);

  try {
    let rawReply = '';

    if (config.provider === 'anthropic') {
      const client = new Anthropic({ apiKey: config.apiKey!, dangerouslyAllowBrowser: true });
      // Use override model if set, else Haiku for speed
      const commModel = modelOverride && modelOverride.trim()
        ? modelOverride.trim()
        : config.model?.includes('opus') ? 'claude-haiku-4-5-20251001'
        : config.model?.includes('sonnet') ? 'claude-haiku-4-5-20251001'
        : (config.model ?? 'claude-haiku-4-5-20251001');

      const msgs: Anthropic.Messages.MessageParam[] = [
        ...recent.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user', content: userMessage },
      ];

      const res = await client.messages.create({
        model: commModel,
        max_tokens: 512,
        system: systemPrompt,
        messages: msgs,
      });
      rawReply = res.content.filter(b => b.type === 'text').map(b => (b as Anthropic.Messages.TextBlock).text).join('');

    } else {
      // OpenAI-compatible — use override model if set, else configured model
      const baseURL = (config.customBaseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
      const apiKey = config.customApiKey || 'sk-placeholder';
      const model = (modelOverride && modelOverride.trim()) ? modelOverride.trim() : (config.customModel || 'gpt-4o');

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...recent.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user', content: userMessage },
      ];

      const httpRes = await proxyFetch(`${baseURL}/chat/completions`, apiKey, {
        model, messages, max_tokens: 512,
      });
      const data = await httpRes.json() as OpenAI.Chat.ChatCompletion & { error?: { message: string } };
      if (!httpRes.ok || data.error) throw new Error(data.error?.message ?? `HTTP ${httpRes.status}`);
      rawReply = data.choices[0]?.message?.content ?? '';
    }

    // Parse optional JSON action from last line
    const lines = rawReply.trim().split('\n');
    const lastLine = lines[lines.length - 1].trim();
    let action: CommunicatorResult['action'] = 'none';
    let brief = '';
    let reply = rawReply.trim();

    if (lastLine.startsWith('{') && lastLine.endsWith('}')) {
      try {
        const parsed = JSON.parse(lastLine) as { action?: string; brief?: string };
        if (parsed.action === 'build' || parsed.action === 'queue') {
          action = parsed.action;
          brief = parsed.brief ?? '';
          reply = lines.slice(0, -1).join('\n').trim();
        }
      } catch { /* not JSON — treat as plain reply */ }
    }

    // If Communicator didn't set an action but this looks like a task (not a pure question),
    // default to build so the Builder always fires when in doubt
    if (action === 'none' && !builderBusy) {
      const lc = userMessage.toLowerCase();
      const likelyTask = lc.includes('build') || lc.includes('create') || lc.includes('make') ||
        lc.includes('add') || lc.includes('fix') || lc.includes('change') || lc.includes('update') ||
        lc.includes('implement') || lc.includes('app') || lc.includes('feature') ||
        (userMessage.length > 30 && !lc.endsWith('?'));
      if (likelyTask) {
        action = 'build';
        brief = userMessage;
      }
    }

    return { reply, action, brief };
  } catch {
    // If Communicator fails completely, fall back and always build
    return {
      reply: "On it — working on that now.",
      action: 'build',
      brief: userMessage,
    };
  }
}

// ─── Critic session ───────────────────────────────────────────────────────────

async function runCriticCall(
  config: ProviderConfig,
  project: Project,
  taskBrief: string,
  builtSummary: string,
  round: number,
  modelOverride?: string,
): Promise<CritiqueResult> {
  const systemPrompt = buildCriticPrompt(project, taskBrief, builtSummary, round);

  const fallback: CritiqueResult = { taskId: '', approved: true, issues: [], suggestions: [], round };

  try {
    let rawReply = '';

    if (config.provider === 'anthropic') {
      const client = new Anthropic({ apiKey: config.apiKey!, dangerouslyAllowBrowser: true });
      const criticModel = (modelOverride && modelOverride.trim())
        ? modelOverride.trim()
        : config.model?.includes('opus') ? 'claude-haiku-4-5-20251001'
        : config.model?.includes('sonnet') ? 'claude-haiku-4-5-20251001'
        : (config.model ?? 'claude-haiku-4-5-20251001');

      const res = await client.messages.create({
        model: criticModel,
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: 'user', content: 'Review the work and respond with JSON only.' }],
      });
      rawReply = res.content.filter(b => b.type === 'text').map(b => (b as Anthropic.Messages.TextBlock).text).join('');

    } else {
      const baseURL = (config.customBaseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
      const apiKey = config.customApiKey || 'sk-placeholder';
      const model = (modelOverride && modelOverride.trim()) ? modelOverride.trim() : (config.customModel || 'gpt-4o');

      const httpRes = await proxyFetch(`${baseURL}/chat/completions`, apiKey, {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Review the work and respond with JSON only.' },
        ],
        max_tokens: 600,
      });
      const data = await httpRes.json() as OpenAI.Chat.ChatCompletion & { error?: { message: string } };
      if (!httpRes.ok || data.error) return fallback;
      rawReply = data.choices[0]?.message?.content ?? '';
    }

    // Extract JSON (may be wrapped in ```json ... ```)
    const jsonMatch = rawReply.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;
    const parsed = JSON.parse(jsonMatch[0]) as { approved?: boolean; issues?: string[]; suggestions?: string[] };
    return {
      taskId: '',
      approved: parsed.approved ?? true,
      issues: parsed.issues ?? [],
      suggestions: parsed.suggestions ?? [],
      round,
    };
  } catch {
    return fallback;
  }
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function runAISession(
  _legacyApiKey: string,
  _legacyModel: string,
  project: Project,
  userMessage: string,
  history: Message[],
  callbacks: AIEngineCallbacks,
  providerConfig?: ProviderConfig,
): Promise<void> {
  const config: ProviderConfig = providerConfig ?? {
    provider: 'anthropic',
    apiKey: _legacyApiKey,
    model: _legacyModel,
  };

  try {
    if (config.provider === 'openai-compatible') {
      await runOpenAISession(config, project, userMessage, history, callbacks);
    } else {
      await runAnthropicSession(config, project, userMessage, history, callbacks);
    }
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    let friendly = raw;
    if (raw.toLowerCase().includes('failed to fetch') || raw.toLowerCase().includes('networkerror') || raw.toLowerCase().includes('connection error')) {
      friendly = `Connection error — ${config.provider === 'openai-compatible' ? `"${config.customBaseUrl}" may block browser requests (CORS).` : 'check your network and API key.'}`;
    } else if (raw.includes('401') || raw.toLowerCase().includes('unauthorized') || raw.toLowerCase().includes('invalid api key')) {
      friendly = 'Invalid API key — open Settings and verify your key.';
    } else if (raw.includes('404')) {
      friendly = `Model not found — check the model name "${config.customModel}" and base URL.`;
    }
    callbacks.onError(friendly);
  }
}

// ─── Public exports for team AI calls ────────────────────────────────────────

export { runCommunicatorCall, runCriticCall };

export function pathToFileNode(path: string, content: string): FileNode {
  const parts = path.split('/').filter(Boolean);
  const name = parts[parts.length - 1];
  return {
    id: uuid(),
    name,
    path,
    type: 'file',
    content,
    language: getLanguageFromFilename(name),
    isNew: true,
    isDirty: false,
  };
}
