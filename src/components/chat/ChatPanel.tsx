import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Square, Sparkles, Loader2, RotateCcw, Copy, Check, ArrowUp,
  ChevronDown, ChevronRight, TerminalSquare, FileCode2, Trash2,
  List, Settings2, Eye, Undo2, ExternalLink, Camera, Radio,
} from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { useAppStore } from '../../store';
import {
  runAISession, pathToFileNode, initAiraContextOnDisk,
  runCommunicatorCall, runCriticCall,
  type AIEngineCallbacks,
} from '../../lib/aiEngine';
import {
  startBridgePolling, bridgeSendToAll, bridgeSendScreenshot,
} from '../../lib/channelBridge';
import type { Message, ToolCall, FileNode } from '../../types';

const SUGGESTIONS = [
  'Build a landing page with hero and pricing sections',
  'Add Supabase authentication (email + OAuth)',
  'Create an analytics dashboard with charts',
  'Add Stripe payment integration',
  'Build a REST API with validation and auth',
  'Add real-time features with WebSockets',
  'Create a mobile bottom tab navigator',
  'Build a CRUD data table with search and filters',
];

// ─── Language badge colour map ────────────────────────────────────────────────
const LANG_COLOR: Record<string, string> = {
  tsx: '#61dafb', ts: '#3178c6', jsx: '#61dafb', js: '#f7df1e',
  css: '#264de4', scss: '#c6538c', html: '#e34c26', json: '#a8c050',
  py: '#3572a5', go: '#00add8', rs: '#dea584', md: '#888', sh: '#89e051',
  env: '#888', yaml: '#cb171e', toml: '#9c4221',
};
function getLangFromPath(p: string): string {
  return p.split('.').pop()?.toLowerCase() ?? '';
}
function langColor(p: string): string {
  return LANG_COLOR[getLangFromPath(p)] ?? '#888';
}

// ─── ToolCallCard ─────────────────────────────────────────────────────────────
function ToolCallCard({ call }: { call: ToolCall }) {
  const { setRightPanel } = useAppStore();
  const [expanded, setExpanded] = useState(false);

  const inp = call.input as Record<string, string>;
  const isRunning = call.status === 'running';
  const isDone    = call.status === 'done';
  const isError   = call.status === 'error';

  /* ── write_file ── */
  if (call.name === 'write_file') {
    const filePath = inp.path ?? '';
    const lang = getLangFromPath(filePath);
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '5px 10px', borderRadius: 8,
        background: isDone ? 'rgba(52,211,153,0.05)' : isRunning ? 'var(--bg-3)' : 'rgba(248,113,113,0.05)',
        border: `1px solid ${isDone ? 'rgba(52,211,153,0.18)' : isRunning ? 'var(--border-1)' : 'rgba(248,113,113,0.18)'}`,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* shimmer when running */}
        {isRunning && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.06) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.4s infinite',
          }} />
        )}
        {isRunning
          ? <Loader2 size={11} strokeWidth={2} style={{ color: 'var(--accent)', flexShrink: 0, animation: 'spin 0.8s linear infinite' }} />
          : <FileCode2 size={11} strokeWidth={1.5} style={{ color: isDone ? 'var(--green)' : 'var(--red)', flexShrink: 0 }} />
        }
        <span style={{ fontSize: 11, color: 'var(--text-1)', fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {filePath}
        </span>
        {lang && (
          <span style={{
            fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 4,
            background: `${langColor(filePath)}22`, color: langColor(filePath),
            border: `1px solid ${langColor(filePath)}44`, fontFamily: 'monospace',
            textTransform: 'uppercase', flexShrink: 0,
          }}>{lang}</span>
        )}
      </div>
    );
  }

  /* ── run_command ── */
  if (call.name === 'run_command') {
    const cmd = inp.command ?? '';
    const output = call.output ?? '';
    const hasOutput = !!output && output !== '[OK]' && !output.startsWith('[exec error');
    const lines = output.split('\n').filter(Boolean);
    const preview = lines.slice(0, 3).join('\n');

    return (
      <div style={{
        borderRadius: 8, overflow: 'hidden',
        border: `1px solid ${isError ? 'rgba(248,113,113,0.2)' : isDone ? 'var(--border-1)' : 'var(--border-1)'}`,
        background: 'var(--bg-2)',
      }}>
        {/* header row */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '5px 10px', cursor: hasOutput ? 'pointer' : 'default',
            background: isRunning ? 'var(--bg-3)' : 'transparent',
          }}
          onClick={() => hasOutput && setExpanded(v => !v)}
        >
          {isRunning
            ? <Loader2 size={11} strokeWidth={2} style={{ color: 'var(--green)', flexShrink: 0, animation: 'spin 0.8s linear infinite' }} />
            : <TerminalSquare size={11} strokeWidth={1.5} style={{ color: isDone ? 'var(--green)' : 'var(--red)', flexShrink: 0 }} />
          }
          <span style={{ fontSize: 11, color: 'var(--text-1)', fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {cmd}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <button
              onClick={e => { e.stopPropagation(); setRightPanel('terminal'); }}
              title="Open Terminal"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', color: 'var(--text-3)', borderRadius: 4, transition: 'color 0.1s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--green)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
            >
              <ExternalLink size={9} strokeWidth={1.5} />
            </button>
            {hasOutput && (
              expanded
                ? <ChevronDown size={11} strokeWidth={1.5} style={{ color: 'var(--text-3)' }} />
                : <ChevronRight size={11} strokeWidth={1.5} style={{ color: 'var(--text-3)' }} />
            )}
          </div>
        </div>
        {/* output block */}
        {hasOutput && !expanded && (
          <div style={{
            padding: '4px 10px 6px',
            fontSize: 10, color: 'var(--text-3)', fontFamily: 'monospace',
            lineHeight: 1.5, borderTop: '1px solid var(--border-0)',
            whiteSpace: 'pre', overflow: 'hidden', maxHeight: 46,
          }}>
            {preview}
            {lines.length > 3 && <span style={{ color: 'var(--text-3)' }}>{` … +${lines.length - 3} lines`}</span>}
          </div>
        )}
        {expanded && (
          <div style={{
            padding: '6px 10px 8px',
            fontSize: 10, color: 'var(--text-2)', fontFamily: 'monospace',
            lineHeight: 1.6, borderTop: '1px solid var(--border-0)',
            whiteSpace: 'pre-wrap', maxHeight: 260, overflowY: 'auto',
            background: 'var(--bg-1)',
          }}>
            {output}
          </div>
        )}
      </div>
    );
  }

  /* ── set_preview ── */
  if (call.name === 'set_preview') {
    const url = inp.url ?? '';
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '5px 10px', borderRadius: 8,
        background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)',
      }}>
        <Eye size={11} strokeWidth={1.5} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: 'var(--text-1)', fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {url}
        </span>
        <a href={url} target="_blank" rel="noreferrer" style={{ display: 'flex', color: 'var(--accent)' }}>
          <ExternalLink size={9} strokeWidth={1.5} />
        </a>
      </div>
    );
  }

  /* ── delete_file ── */
  if (call.name === 'delete_file') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '5px 10px', borderRadius: 8,
        background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)',
      }}>
        {isRunning
          ? <Loader2 size={11} strokeWidth={2} style={{ color: 'var(--red)', flexShrink: 0, animation: 'spin 0.8s linear infinite' }} />
          : <Trash2 size={11} strokeWidth={1.5} style={{ color: 'var(--red)', flexShrink: 0 }} />
        }
        <span style={{ fontSize: 11, color: 'var(--text-2)', fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {inp.path ?? 'delete file'}
        </span>
      </div>
    );
  }

  /* ── update_tech_stack ── */
  if (call.name === 'update_tech_stack') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '5px 10px', borderRadius: 8,
        background: 'var(--bg-3)', border: '1px solid var(--border-1)',
      }}>
        <Settings2 size={11} strokeWidth={1.5} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: 'var(--text-2)' }}>updating tech stack</span>
      </div>
    );
  }

  /* ── list_files / read_file / fallback ── */
  const fallbackLabel: Record<string, string> = {
    list_files: 'list files',
    read_file: inp.path ?? 'read file',
  };
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 9px', borderRadius: 7,
      background: 'var(--bg-3)', border: '1px solid var(--border-1)',
    }}>
      {isRunning
        ? <Loader2 size={9} strokeWidth={2} style={{ color: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
        : <List size={9} strokeWidth={1.5} style={{ color: 'var(--text-3)' }} />
      }
      <span style={{ fontSize: 11, color: 'var(--text-2)', fontFamily: 'monospace' }}>
        {fallbackLabel[call.name] ?? call.name}
      </span>
    </div>
  );
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const out: React.ReactNode[] = [];
  let inCode = false;
  let codeLines: string[] = [];
  let codeLang = '';
  let k = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      if (!inCode) {
        inCode = true; codeLang = line.slice(3).trim(); codeLines = [];
      } else {
        inCode = false;
        out.push(
          <div key={k++} style={{
            margin: '8px 0', borderRadius: 8, overflow: 'hidden',
            border: '1px solid var(--border-1)',
          }}>
            {codeLang && (
              <div style={{
                padding: '5px 12px', background: 'var(--bg-3)',
                borderBottom: '1px solid var(--border-0)',
                fontSize: 10, color: 'var(--text-3)', fontFamily: 'monospace',
              }}>
                {codeLang}
              </div>
            )}
            <pre style={{
              padding: 12, background: 'var(--bg-1)', margin: 0,
              fontSize: 11, color: 'var(--text-1)', overflowX: 'auto', lineHeight: 1.7,
            }}>
              <code>{codeLines.join('\n')}</code>
            </pre>
          </div>
        );
      }
      continue;
    }
    if (inCode) { codeLines.push(line); continue; }

    const inline = (t: string) => t
      .replace(/`([^`]+)`/g, `<code style="background:var(--bg-3);border:1px solid var(--border-1);padding:1px 5px;border-radius:4px;font-size:11px;font-family:monospace;color:var(--text-0)">$1</code>`)
      .replace(/\*\*([^*]+)\*\*/g, '<strong style="font-weight:600;color:var(--text-0)">$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');

    if (!line.trim()) { out.push(<div key={k++} style={{ height: 6 }} />); continue; }

    if (line.startsWith('### ')) {
      out.push(<p key={k++} style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-0)', margin: '10px 0 4px' }} dangerouslySetInnerHTML={{ __html: inline(line.slice(4)) }} />);
    } else if (line.startsWith('## ')) {
      out.push(<p key={k++} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-0)', margin: '12px 0 4px' }} dangerouslySetInnerHTML={{ __html: inline(line.slice(3)) }} />);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      out.push(
        <div key={k++} style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
          <span style={{ color: 'var(--text-3)', marginTop: 1, flexShrink: 0 }}>–</span>
          <span style={{ fontSize: 12, color: 'var(--text-1)', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: inline(line.slice(2)) }} />
        </div>
      );
    } else if (/^\d+\. /.test(line)) {
      const m = line.match(/^(\d+)\. (.+)$/);
      if (m) out.push(
        <div key={k++} style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0, minWidth: 16, marginTop: 1 }}>{m[1]}.</span>
          <span style={{ fontSize: 12, color: 'var(--text-1)', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: inline(m[2]) }} />
        </div>
      );
    } else {
      out.push(<p key={k++} style={{ fontSize: 12, color: 'var(--text-1)', lineHeight: 1.7, marginBottom: 1 }} dangerouslySetInnerHTML={{ __html: inline(line) }} />);
    }
  }
  return out;
}

// ─── Message component ────────────────────────────────────────────────────────

// AI team member visual config
const AI_ROLE_CONFIG = {
  communicator: {
    label: 'Aira',
    avatar: 'linear-gradient(135deg, #6366f1, #818cf8)',
    badge: null, // primary voice — no badge needed
  },
  builder: {
    label: 'Builder',
    avatar: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
    badge: { text: 'building', color: '#0ea5e9', bg: 'rgba(14,165,233,0.08)' },
  },
  critic: {
    label: 'Critic',
    avatar: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
    badge: { text: 'review', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
  },
} as const;

function MessageBubble({ msg }: { msg: Message }) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === 'user';
  const aiRole = msg.aiRole ?? 'communicator';
  const roleConfig = AI_ROLE_CONFIG[aiRole];

  const copy = async () => {
    await navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (isUser) {
    return (
      <div className="anim-fade-up" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <div style={{
          maxWidth: '80%', padding: '8px 12px', borderRadius: 12,
          background: 'var(--bg-4)', border: '1px solid var(--border-1)',
          fontSize: 13, color: 'var(--text-0)', lineHeight: 1.6,
        }}>
          {msg.content}
        </div>
      </div>
    );
  }

  if (msg.role !== 'assistant') return null;

  return (
    <div className="anim-fade-up" style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
      <div style={{
        width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
        background: roleConfig.avatar,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700, color: 'white',
      }}>{aiRole === 'builder' ? '⚙' : aiRole === 'critic' ? '🔍' : 'A'}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Role label — only show for builder/critic to keep communicator clean */}
        {aiRole !== 'communicator' && roleConfig.badge && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
            <span style={{
              fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
              background: roleConfig.badge.bg, color: roleConfig.badge.color,
              border: `1px solid ${roleConfig.badge.color}33`,
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>{roleConfig.label}</span>
          </div>
        )}
        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
            {msg.toolCalls.map(tc => <ToolCallCard key={tc.id} call={tc} />)}
          </div>
        )}
        {msg.content && (
          <div style={{ position: 'relative' }}>
            <div>{renderMarkdown(msg.content)}</div>
            {msg.isStreaming && (
              <span className="cursor" />
            )}
            {!msg.isStreaming && msg.content && (
              <button
                onClick={copy}
                style={{
                  marginTop: 6, display: 'flex', alignItems: 'center', gap: 4,
                  padding: '3px 8px', border: '1px solid var(--border-1)', borderRadius: 6,
                  background: 'transparent', cursor: 'pointer', color: 'var(--text-3)',
                  fontSize: 11, transition: 'all 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-2)'; e.currentTarget.style.borderColor = 'var(--border-2)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.borderColor = 'var(--border-1)'; }}
              >
                {copied ? <Check size={10} strokeWidth={2} style={{ color: 'var(--green)' }} /> : <Copy size={10} strokeWidth={1.5} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ChatPanel ────────────────────────────────────────────────────────────────

export function ChatPanel() {
  const {
    activeProjectId,
    provider, apiKey, selectedModel,
    customApiKey, customBaseUrl, customModel,
    teamMode, communicatorModel, criticModel,
    isGenerating, setGenerating, setStreamingMessageId,
    addMessage, updateMessage, appendToMessage, updateProject,
    setPreviewUrl, setRightPanel, setShowApiKeyModal, clearMessages,
    snapshotForUndo, undoLastChange, canUndo,
    channelBridges, updateChannelBridge,
    teamBus, setBuilderStatus, setLastCritique, addMilestone, clearTeamBus,
  } = useAppStore();
  const activeProject = useAppStore(s => s.activeProject());
  const previewUrl = useAppStore(s => s.previewUrl);

  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [tokenUsed, setTokenUsed] = useState(0);
  const [tokenLimit, setTokenLimit] = useState(0);
  const [tokenPct, setTokenPct] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [screenshotting, setScreenshotting] = useState(false);
  const [bridgeNotif, setBridgeNotif] = useState<string | null>(null);
  // Builder running in background (separate from Communicator)
  const [builderRunning, setBuilderRunning] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<(() => void) | null>(null);
  // Queue of pending builder tasks while builder is busy
  const pendingTasksRef = useRef<string[]>([]);
  const activeBridges = channelBridges.filter(b => b.status === 'active');

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeProject?.messages]);

  // ── Bridge polling: Telegram incoming messages ─────────────────────────────
  useEffect(() => {
    const stopPolling = startBridgePolling(
      () => useAppStore.getState().channelBridges,
      (bridgeId, offset) => updateChannelBridge(bridgeId, { lastUpdateId: offset }),
      (bridgeId, text, from) => {
        // Show notification
        setBridgeNotif(`📩 ${from}: ${text.slice(0, 60)}`);
        setTimeout(() => setBridgeNotif(null), 4000);

        // Inject as user message into active project
        const { activeProjectId: pid, addMessage: am } = useAppStore.getState();
        if (!pid) return;
        const msgId = crypto.randomUUID();
        am(pid, {
          id: msgId, role: 'user',
          content: `[via ${useAppStore.getState().channelBridges.find(b => b.id === bridgeId)?.name ?? 'channel'}] ${text}`,
          timestamp: Date.now(),
        });
        // Trigger generation
        setTimeout(() => handleSend(`[via channel] ${text}`), 100);
      },
    );
    return stopPolling;
  }, []); // starts once on mount

  useEffect(() => {
    if (!activeProject || isGenerating || builderRunning) return;
    const msgs = activeProject.messages;
    // Auto-start builder when project is created with an initial user message
    if (msgs.length === 1 && msgs[0].role === 'user') {
      const pid = activeProject.id;
      const text = msgs[0].content;
      // Small delay so store settles
      setTimeout(() => {
        const providerConfig = getProviderConfig();
        launchBuilder(pid, text, providerConfig);
      }, 50);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject?.id]);

  // ── Builder callbacks — use a ref so closures are always fresh ──────────
  const stateRef = useRef({
    provider, apiKey, selectedModel, customApiKey, customBaseUrl, customModel,
    teamMode, communicatorModel, criticModel,
    activeProjectId,
  });
  useEffect(() => {
    stateRef.current = { provider, apiKey, selectedModel, customApiKey, customBaseUrl, customModel, teamMode, communicatorModel, criticModel, activeProjectId };
  });

  const makeBuilderCallbacks = (
    pid: string,
    builderMsgId: string,
    abortedRef: { current: boolean },
    isCriticFixRound = false,
  ): AIEngineCallbacks => {
    const finishBuilder = () => {
      updateMessage(pid, builderMsgId, { isStreaming: false });
      setStreamingMessageId(null);
      setGenerating(false);
      setBuilderRunning(false);
      setStatusMsg('');
      setBuilderStatus({ phase: 'idle', detail: '' });

      // Forward to bridges
      const finalMsg = useAppStore.getState().projects.find(p => p.id === pid)?.messages.find(m => m.id === builderMsgId);
      const bridges = useAppStore.getState().channelBridges;
      if (finalMsg?.content && bridges.some(b => b.outgoingEnabled && b.status === 'active')) {
        const preview = useAppStore.getState().previewUrl;
        const snippet = finalMsg.content.slice(0, 800) + (finalMsg.content.length > 800 ? '…' : '');
        bridgeSendToAll(bridges, `🤖 Aira:\n${snippet}`).catch(() => {});
        if (preview) bridgeSendScreenshot(bridges, preview).catch(() => {});
      }

      // Run Critic once (skip if this was already a critic-fix round, or single-AI mode)
      if (!isCriticFixRound && stateRef.current.teamMode !== 'single') {
        const lastTask = pendingTasksRef.current[0] ?? '';
        const store = useAppStore.getState();
        const proj = store.projects.find(p => p.id === pid);
        if (proj && lastTask) {
          const builtFiles = proj.files.map(f => f.path).join(', ').slice(0, 400);
          const milestones = store.teamBus.milestones.slice(-3).join(' | ');
          const summary = `Files: ${builtFiles}\nMilestones: ${milestones}`;
          const { provider: prov, apiKey: ak, selectedModel: sm, customApiKey: cak, customBaseUrl: cbu, customModel: cm, criticModel: crim } = stateRef.current;
          runCriticCall({ provider: prov, apiKey: ak, model: sm, customApiKey: cak, customBaseUrl: cbu, customModel: cm },
            proj, lastTask, summary, 1, crim || undefined
          ).then(critique => {
            setLastCritique({ ...critique, taskId: pid });
            if (!critique.approved && critique.issues.length > 0) {
              const fixBrief = `Fix these issues found during review:\n${critique.issues.map((iss, n) => `${n + 1}. ${iss}`).join('\n')}\n\nSuggested fixes:\n${critique.suggestions.join('\n')}`;
              const fixMsgId = uuid();
              const store2 = useAppStore.getState();
              store2.addMessage(pid, { id: fixMsgId, role: 'assistant', content: '', timestamp: Date.now(), toolCalls: [], isStreaming: true, aiRole: 'builder' });
              setStreamingMessageId(fixMsgId);
              setGenerating(true);
              setBuilderRunning(true);
              const fixAborted = { current: false };
              abortRef.current = () => { fixAborted.current = true; };
              const fixCallbacks = makeBuilderCallbacks(pid, fixMsgId, fixAborted, true);
              const fixProject = useAppStore.getState().projects.find(p => p.id === pid)!;
              const { provider: prov2, apiKey: ak2, selectedModel: sm2, customApiKey: cak2, customBaseUrl: cbu2, customModel: cm2 } = stateRef.current;
              runAISession(ak2, sm2, fixProject, fixBrief,
                fixProject.messages.filter(m => m.id !== fixMsgId),
                fixCallbacks, { provider: prov2, apiKey: ak2, model: sm2, customApiKey: cak2, customBaseUrl: cbu2, customModel: cm2 }
              ).catch(() => fixCallbacks.onError('Critic fix failed'));
            }
          }).catch(() => {/* non-fatal */});
        }
      }
    };

    return {
      onToken: tok => { if (!abortedRef.current) appendToMessage(pid, builderMsgId, tok); },

      onToolCall: tc => {
        if (abortedRef.current) return;
        const cur = useAppStore.getState().projects.find(p => p.id === pid)?.messages.find(m => m.id === builderMsgId);
        updateMessage(pid, builderMsgId, { toolCalls: [...(cur?.toolCalls ?? []), tc] });
      },

      onToolResult: (toolId, res) => {
        if (abortedRef.current) return;
        const cur = useAppStore.getState().projects.find(p => p.id === pid)?.messages.find(m => m.id === builderMsgId);
        if (cur?.toolCalls) {
          updateMessage(pid, builderMsgId, {
            toolCalls: cur.toolCalls.map(tc => tc.id === toolId ? { ...tc, status: 'done', output: res } : tc),
          });
        }
      },

      onFileWrite: (path, content) => {
        if (abortedRef.current) return;
        const p = useAppStore.getState().activeProject();
        if (!p) return;
        const node = pathToFileNode(path, content);
        const find = (files: FileNode[]): FileNode | null => {
          for (const f of files) {
            if (f.path === path) return f;
            if (f.children) { const found = find(f.children); if (found) return found; }
          }
          return null;
        };
        const existing = find(p.files);
        if (existing) useAppStore.getState().updateFileContent(pid, existing.id, content);
        else useAppStore.getState().upsertFile(pid, node);
        setRightPanel('code');
        useAppStore.getState().setActiveFile(existing?.id ?? node.id);
      },

      onFileDelete: (path) => {
        if (abortedRef.current) return;
        const p = useAppStore.getState().activeProject();
        const find = (files: FileNode[]): FileNode | null => {
          for (const f of files) {
            if (f.path === path) return f;
            if (f.children) { const found = find(f.children); if (found) return found; }
          }
          return null;
        };
        const file = find(p?.files ?? []);
        if (file) useAppStore.getState().deleteFile(pid, file.id);
      },

      onPreviewUrl: url => { if (!abortedRef.current) { setPreviewUrl(url); setRightPanel('preview'); } },

      onTechStackUpdate: tech => {
        if (!abortedRef.current) {
          const proj = useAppStore.getState().activeProject();
          if (proj) updateProject(pid, { tech: { ...proj.tech, ...tech } });
        }
      },

      onTokenUsage: (used, limit, pct) => {
        if (!abortedRef.current) { setTokenUsed(used); setTokenLimit(limit); setTokenPct(pct); }
      },

      onStatusUpdate: status => { if (!abortedRef.current) setStatusMsg(status); },

      onBuilderStatus: (phase, detail) => {
        if (!abortedRef.current) setBuilderStatus({ phase: phase as Parameters<typeof setBuilderStatus>[0]['phase'], detail });
      },

      onMilestone: note => { if (!abortedRef.current) addMilestone(note); },

      onComplete: () => { if (!abortedRef.current) finishBuilder(); },

      onError: err => {
        if (!abortedRef.current) {
          updateMessage(pid, builderMsgId, { content: `⚠️ ${err}`, isStreaming: false });
          setStreamingMessageId(null);
          setGenerating(false);
          setBuilderRunning(false);
          setStatusMsg('');
          setBuilderStatus({ phase: 'idle', detail: '' });
        }
      },
    };
  };

  // ── Launch builder directly (no Communicator) for auto-triggered sends ────
  const launchBuilder = (pid: string, taskBrief: string, providerConfig: ReturnType<typeof getProviderConfig>) => {
    snapshotForUndo(pid);
    setGenerating(true);
    setBuilderRunning(true);
    clearTeamBus();
    pendingTasksRef.current = [taskBrief];
    setTokenUsed(0); setTokenLimit(0); setTokenPct(0); setStatusMsg('');

    const builderMsgId = uuid();
    useAppStore.getState().addMessage(pid, {
      id: builderMsgId, role: 'assistant', content: '', timestamp: Date.now(),
      toolCalls: [], isStreaming: true, aiRole: 'builder',
    });
    setStreamingMessageId(builderMsgId);

    const abortedRef = { current: false };
    abortRef.current = () => { abortedRef.current = true; };
    const callbacks = makeBuilderCallbacks(pid, builderMsgId, abortedRef);
    const freshProject = useAppStore.getState().projects.find(p => p.id === pid)!;

    runAISession(providerConfig.apiKey ?? '', providerConfig.model ?? '', freshProject, taskBrief,
      freshProject.messages.filter(m => m.id !== builderMsgId),
      callbacks, providerConfig,
    ).catch(err => { if (!abortedRef.current) callbacks.onError(err instanceof Error ? err.message : String(err)); });
  };

  const getProviderConfig = () => ({
    provider, apiKey, model: selectedModel, customApiKey, customBaseUrl, customModel,
    teamMode, communicatorModel, criticModel,
  } as const);

  // ── Main send handler ─────────────────────────────────────────────────────
  const handleSend = useCallback(async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || !activeProjectId) return;

    const hasKey = provider === 'openai-compatible' ? !!customApiKey : !!apiKey;
    if (!hasKey) { setShowApiKeyModal(true); return; }

    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    // Init .aira context on first message
    const currentProject = useAppStore.getState().activeProject();
    if (currentProject?.airaContext && currentProject.messages.filter(m => m.role === 'user').length === 0) {
      initAiraContextOnDisk(currentProject).catch(() => {});
    }

    const providerConfig = getProviderConfig();
    const isBuilderActive = builderRunning;

    if (!override) {
      addMessage(activeProjectId, { id: uuid(), role: 'user', content: text, timestamp: Date.now() });
    }

    // Refresh project after message add
    const project = useAppStore.getState().activeProject()!;
    const history = project.messages.slice(-40);

    // ── Single AI mode: skip Communicator, go straight to Builder ─────────
    if (teamMode === 'single') {
      if (isBuilderActive) {
        pendingTasksRef.current.push(text);
        setGenerating(false);
        return;
      }
      launchBuilder(activeProjectId, text, providerConfig);
      return;
    }

    // ── Step 1: Communicator responds INSTANTLY ───────────────────────────
    const commMsgId = uuid();
    addMessage(activeProjectId, {
      id: commMsgId, role: 'assistant', content: '', timestamp: Date.now(),
      isStreaming: true, aiRole: 'communicator',
    });
    setStreamingMessageId(commMsgId);
    setGenerating(true);

    let commResult = { reply: '', action: 'none' as 'build' | 'queue' | 'none', brief: text };
    try {
      commResult = await runCommunicatorCall(
        providerConfig, project, text, history,
        isBuilderActive,
        useAppStore.getState().teamBus.milestones.slice(-1)[0] ?? '',
        communicatorModel || undefined,
      );
    } catch {
      commResult = { reply: "On it.", action: 'build', brief: text };
    }

    updateMessage(activeProjectId, commMsgId, { content: commResult.reply, isStreaming: false });
    setStreamingMessageId(null);

    // ── Step 2: If build task → queue or start Builder ────────────────────
    const willBuild = commResult.action === 'build' || commResult.action === 'queue';
    if (!willBuild && !isBuilderActive) {
      // Pure conversational reply — nothing more to do
      setGenerating(false);
      return;
    }

    if (willBuild) {
      const taskBrief = commResult.brief || text;
      if (isBuilderActive) {
        pendingTasksRef.current.push(taskBrief);
        return;
      }
      launchBuilder(activeProjectId, taskBrief, providerConfig);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, activeProjectId, apiKey, selectedModel, customApiKey, customBaseUrl, customModel, teamMode, communicatorModel, builderRunning]);

  const handleStop = () => {
    abortRef.current?.();
    setGenerating(false);
    setStreamingMessageId(null);
    if (activeProjectId) {
      const msgs = useAppStore.getState().activeProject()?.messages ?? [];
      const streaming = msgs.find(m => m.isStreaming);
      if (streaming) {
        updateMessage(activeProjectId, streaming.id, { isStreaming: false });
      }
    }
  };

  const grow = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  };

  const handleSendScreenshot = async () => {
    if (!previewUrl || activeBridges.length === 0) return;
    setScreenshotting(true);
    await bridgeSendScreenshot(channelBridges, previewUrl);
    setScreenshotting(false);
    setBridgeNotif('📸 Screenshot sent to channels');
    setTimeout(() => setBridgeNotif(null), 3000);
  };

  /* Empty state */
  if (!activeProject) {
    return (
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 24,
        padding: 32, background: 'var(--bg-0)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 700, color: 'white',
          }}>A</div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-0)', letterSpacing: '-0.3px', marginBottom: 6 }}>
            Aira Builder
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, maxWidth: 260, margin: '0 auto' }}>
            Build iOS, Android, Web, Desktop apps and Browser Extensions — all from chat.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, width: '100%', maxWidth: 280 }}>
          {['Web App', 'iOS + Android', 'Desktop', 'Extension'].map(p => (
            <div key={p} style={{
              padding: '8px 12px', borderRadius: 8, textAlign: 'center',
              border: '1px solid var(--border-1)', background: 'var(--bg-2)',
              fontSize: 12, color: 'var(--text-2)',
            }}>{p}</div>
          ))}
        </div>
      </div>
    );
  }

  const messages = activeProject.messages;
  const projectCanUndo = activeProjectId ? canUndo(activeProjectId) : false;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-0)' }}>
      {/* Header */}
      <div style={{
        padding: '0 16px', height: 44, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexShrink: 0,
        borderBottom: '1px solid var(--border-0)',
        background: 'var(--bg-1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeProject.name}
          </span>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {activeProject.platforms.map(p => (
              <span key={p} style={{
                fontSize: 10, padding: '2px 6px', borderRadius: 4,
                background: 'var(--bg-3)', color: 'var(--text-2)',
                border: '1px solid var(--border-1)',
              }}>
                {p}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* Builder live status pill */}
          {builderRunning && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '3px 8px', borderRadius: 99,
              background: 'rgba(14,165,233,0.07)',
              border: '1px solid rgba(14,165,233,0.2)',
              maxWidth: 220, overflow: 'hidden',
            }}>
              {/* phase icon */}
              {teamBus.builderStatus.phase === 'writing' && <FileCode2 size={9} style={{ color: '#0ea5e9', flexShrink: 0 }} />}
              {teamBus.builderStatus.phase === 'running' && <TerminalSquare size={9} style={{ color: '#0ea5e9', flexShrink: 0 }} />}
              {(teamBus.builderStatus.phase === 'thinking' || teamBus.builderStatus.phase === 'reviewing') && (
                <Loader2 size={9} style={{ color: '#0ea5e9', flexShrink: 0, animation: 'spin 0.8s linear infinite' }} />
              )}
              {teamBus.builderStatus.phase === 'done' && <Check size={9} style={{ color: '#0ea5e9', flexShrink: 0 }} />}
              <span style={{
                fontSize: 10, color: '#0ea5e9', fontFamily: 'monospace',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {teamBus.builderStatus.detail || 'Building...'}
              </span>
            </div>
          )}
          {/* Token bar — shown while builder is active */}
          {builderRunning && tokenLimit > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} title={`${tokenUsed.toLocaleString()} / ${tokenLimit.toLocaleString()} tokens`}>
              <div style={{ width: 36, height: 3, borderRadius: 2, background: 'var(--bg-4)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  width: `${Math.min(tokenPct, 100)}%`,
                  background: tokenPct >= 80 ? 'var(--yellow)' : 'var(--accent)',
                  transition: 'width 0.3s, background 0.3s',
                }} />
              </div>
              <span style={{ fontSize: 10, color: tokenPct >= 80 ? 'var(--yellow)' : 'var(--text-3)', fontFamily: 'monospace' }}>
                {tokenPct}%
              </span>
            </div>
          )}
          {/* Communicator thinking dots (only when NOT building) */}
          {isGenerating && !builderRunning && (
            <div style={{ display: 'flex', gap: 3 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 3, height: 3, borderRadius: '50%',
                  background: 'var(--accent)',
                  animation: `pulse 1.2s ease infinite ${i * 0.15}s`,
                }} />
              ))}
            </div>
          )}
          {/* Undo button */}
          {projectCanUndo && !isGenerating && (
            <button
              onClick={() => activeProjectId && undoLastChange(activeProjectId)}
              title="Undo last generation"
              style={{
                width: 28, height: 28, border: '1px solid var(--border-1)', background: 'transparent',
                cursor: 'pointer', color: 'var(--text-3)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', borderRadius: 6,
                transition: 'all 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent-border)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.borderColor = 'var(--border-1)'; }}
            >
              <Undo2 size={13} strokeWidth={1.5} />
            </button>
          )}
          {/* Bridge status pill */}
          {activeBridges.length > 0 && (
            <div
              title={`${activeBridges.length} channel${activeBridges.length > 1 ? 's' : ''} connected: ${activeBridges.map(b => b.name).join(', ')}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '3px 7px', borderRadius: 99,
                background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.2)',
                cursor: 'default',
              }}
            >
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80', animation: 'pulse 2s ease infinite' }} />
              <Radio size={10} strokeWidth={1.5} style={{ color: '#4ade80' }} />
              <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 500 }}>{activeBridges.length}</span>
            </div>
          )}
          {/* Screenshot to channels */}
          {previewUrl && activeBridges.some(b => b.screenshotsEnabled) && (
            <button
              onClick={handleSendScreenshot}
              disabled={screenshotting}
              title="Send preview screenshot to channels"
              style={{
                width: 28, height: 28, border: '1px solid var(--border-1)', background: 'transparent',
                cursor: screenshotting ? 'wait' : 'pointer', color: 'var(--text-3)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', borderRadius: 6,
                transition: 'all 0.1s', opacity: screenshotting ? 0.5 : 1,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.color = 'var(--text-0)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-3)'; }}
            >
              {screenshotting ? <Loader2 size={12} strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite' }} /> : <Camera size={12} strokeWidth={1.5} />}
            </button>
          )}
          <button
            onClick={() => clearMessages(activeProjectId!)}
            style={{
              width: 28, height: 28, border: 'none', background: 'transparent',
              cursor: 'pointer', color: 'var(--text-3)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', borderRadius: 6,
              transition: 'all 0.1s',
            }}
            title="Clear chat"
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.color = 'var(--text-1)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-3)'; }}
          >
            <RotateCcw size={13} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Bridge notification toast */}
      {bridgeNotif && (
        <div style={{
          position: 'absolute', top: 52, left: 12, right: 12, zIndex: 20,
          padding: '8px 12px', borderRadius: 8,
          background: 'var(--bg-3)', border: '1px solid var(--border-2)',
          boxShadow: 'var(--shadow-md)', fontSize: 12, color: 'var(--text-0)',
          display: 'flex', alignItems: 'center', gap: 8,
          animation: 'fadeIn 0.2s ease',
        }}>
          <Radio size={12} strokeWidth={1.5} style={{ color: '#4ade80', flexShrink: 0 }} />
          {bridgeNotif}
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 8px' }}>
        {messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6,
                background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: 'white',
              }}>A</div>
              <span style={{ fontSize: 12, color: 'var(--text-1)', fontWeight: 500 }}>Ready to build</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7, paddingLeft: 32 }}>
              Describe what you want to build. I'll write complete, production-ready code and set up the full project structure.
            </p>
            <div style={{ paddingLeft: 32, display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
              {SUGGESTIONS.slice(0, 5).map(s => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  style={{
                    padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border-1)',
                    background: 'var(--bg-2)', color: 'var(--text-2)', fontSize: 12,
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.color = 'var(--text-1)'; e.currentTarget.style.background = 'var(--bg-3)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-1)'; e.currentTarget.style.color = 'var(--text-2)'; e.currentTarget.style.background = 'var(--bg-2)'; }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)
        )}
        <div ref={endRef} />
      </div>

      {/* Suggestion bar */}
      {showSuggestions && (
        <div style={{
          margin: '0 12px 6px',
          borderRadius: 10, overflow: 'hidden',
          background: 'var(--bg-2)', border: '1px solid var(--border-1)',
          boxShadow: 'var(--shadow-md)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px', borderBottom: '1px solid var(--border-0)',
          }}>
            <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>Suggestions</span>
            <button onClick={() => setShowSuggestions(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}>
              <ChevronDown size={12} strokeWidth={1.5} />
            </button>
          </div>
          <div style={{ padding: 4 }}>
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => { setInput(s); setShowSuggestions(false); textareaRef.current?.focus(); }}
                style={{
                  width: '100%', padding: '7px 10px', border: 'none',
                  background: 'transparent', color: 'var(--text-2)',
                  fontSize: 12, cursor: 'pointer', textAlign: 'left',
                  borderRadius: 6, transition: 'all 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.color = 'var(--text-1)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)'; }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '8px 12px 12px', flexShrink: 0 }}>
        <div style={{
          borderRadius: 12, background: 'var(--bg-2)',
          border: `1px solid ${isGenerating ? 'var(--accent-border)' : 'var(--border-1)'}`,
          transition: 'border-color 0.15s',
          boxShadow: isGenerating ? '0 0 0 3px rgba(99,102,241,0.06)' : 'none',
        }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => { setInput(e.target.value); grow(); }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!isGenerating) handleSend(); } }}
            placeholder={isGenerating ? '' : 'Ask Aira to build something...'}
            disabled={isGenerating}
            rows={1}
            style={{
              width: '100%', padding: '12px 14px 6px',
              background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text-0)', fontSize: 13, resize: 'none',
              lineHeight: 1.6, minHeight: 44, maxHeight: 180,
              fontFamily: 'inherit',
            }}
          />
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '4px 10px 10px',
          }}>
            <button
              onClick={() => setShowSuggestions(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 8px', borderRadius: 6, border: 'none',
                background: showSuggestions ? 'var(--bg-4)' : 'transparent',
                color: 'var(--text-3)', fontSize: 11, cursor: 'pointer',
                transition: 'all 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.color = 'var(--text-2)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = showSuggestions ? 'var(--bg-4)' : 'transparent'; e.currentTarget.style.color = 'var(--text-3)'; }}
            >
              <Sparkles size={11} strokeWidth={1.5} />
              Ideas
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {!isGenerating && (
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  ⏎ send
                </span>
              )}
              {isGenerating ? (
                <button
                  onClick={handleStop}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border-2)',
                    background: 'var(--bg-3)', color: 'var(--text-1)',
                    fontSize: 12, cursor: 'pointer', transition: 'all 0.1s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.color = 'var(--text-1)'; }}
                >
                  <Square size={10} fill="currentColor" strokeWidth={0} />
                  Stop
                </button>
              ) : (
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim()}
                  style={{
                    width: 30, height: 30, borderRadius: 8, border: 'none',
                    background: input.trim() ? 'var(--accent)' : 'var(--bg-4)',
                    color: input.trim() ? 'white' : 'var(--text-3)',
                    cursor: input.trim() ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.1s',
                  }}
                  onMouseEnter={e => { if (input.trim()) e.currentTarget.style.opacity = '0.85'; }}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  <ArrowUp size={14} strokeWidth={2} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Shimmer keyframe */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
