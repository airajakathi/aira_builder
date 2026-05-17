import { useState, useRef, useEffect } from 'react';
import {
  Plus, Trash2, ChevronRight, ChevronDown,
  FileText, Folder, Settings, Key, X, Check,
  LayoutGrid, ChevronsLeft,
} from 'lucide-react';
import { useAppStore } from '../../store';
import { AI_MODELS } from '../../lib/platforms';
import type { FileNode } from '../../types';
import {
  SkillsPage, ToolsPage, IntegrationsPage, MemoryPage, ChannelBridgesPage,
} from '../editor/ProjectSettingsPanel';

interface Props { onNewProject: () => void; }

const PLATFORM_ICONS: Record<string, string> = {
  web: '⌘', ios: '', android: '◎', desktop: '□',
  extension: '◈', api: '∿', fullstack: '⚡',
};

export function Sidebar({ onNewProject }: Props) {
  const {
    projects, activeProjectId, setActiveProject, deleteProject,
    activeFileId, setActiveFile, sidebarOpen, setSidebarOpen,
    provider, setProvider,
    apiKey, setApiKey, selectedModel, setSelectedModel,
    customApiKey, setCustomApiKey,
    customBaseUrl, setCustomBaseUrl,
    customModel, setCustomModel,
    teamMode, setTeamMode,
    communicatorModel, setCommunicatorModel,
    criticModel, setCriticModel,
  } = useAppStore();

  const activeProject = useAppStore(s => s.activeProject());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const [hoverProject, setHoverProject] = useState<string | null>(null);

  // local form state
  const [tmpAnthropicKey, setTmpAnthropicKey] = useState(apiKey);
  const [tmpCustomKey, setTmpCustomKey] = useState(customApiKey);
  const [tmpBaseUrl, setTmpBaseUrl] = useState(customBaseUrl);
  const [tmpModel, setTmpModel] = useState(customModel);
  const [activeTab, setActiveTab] = useState<'anthropic' | 'custom'>(provider === 'openai-compatible' ? 'custom' : 'anthropic');
  const [tmpTeamMode, setTmpTeamMode] = useState<'three-ai' | 'single'>(teamMode);
  const [tmpCommunicatorModel, setTmpCommunicatorModel] = useState(communicatorModel);
  const [tmpCriticModel, setTmpCriticModel] = useState(criticModel);

  const openSettings = () => {
    setTmpAnthropicKey(apiKey);
    setTmpCustomKey(customApiKey);
    setTmpBaseUrl(customBaseUrl);
    setTmpModel(customModel);
    setActiveTab(provider === 'openai-compatible' ? 'custom' : 'anthropic');
    setTmpTeamMode(teamMode);
    setTmpCommunicatorModel(communicatorModel);
    setTmpCriticModel(criticModel);
    setShowSettings(true);
  };

  const saveSettings = () => {
    setApiKey(tmpAnthropicKey);
    setCustomApiKey(tmpCustomKey);
    setCustomBaseUrl(tmpBaseUrl);
    setCustomModel(tmpModel);
    setProvider(activeTab === 'custom' ? 'openai-compatible' : 'anthropic');
    setTeamMode(tmpTeamMode);
    setCommunicatorModel(tmpCommunicatorModel);
    setCriticModel(tmpCriticModel);
    setShowSettings(false);
  };

  const toggleFolder = (id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const renderTree = (files: FileNode[], depth = 0): React.ReactNode => files.map(f => {
    const isActive = f.id === activeFileId;
    const isOpen = expandedFolders.has(f.id);
    const indent = depth * 12 + 16;

    if (f.type === 'folder') {
      return (
        <div key={f.id}>
          <button
            onClick={() => toggleFolder(f.id)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              gap: 4, paddingLeft: indent, paddingRight: 12,
              height: 26, cursor: 'pointer', border: 'none',
              background: 'transparent', color: 'var(--text-2)',
              fontSize: 12, textAlign: 'left',
              transition: 'color 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-1)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-2)')}
          >
            {isOpen
              ? <ChevronDown size={11} strokeWidth={1.5} />
              : <ChevronRight size={11} strokeWidth={1.5} />}
            <Folder size={11} strokeWidth={1.5} style={{ flexShrink: 0, color: 'var(--text-2)' }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
          </button>
          {isOpen && f.children && renderTree(f.children, depth + 1)}
        </div>
      );
    }

    return (
      <button
        key={f.id}
        onClick={() => setActiveFile(f.id)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          gap: 5, paddingLeft: indent + 16, paddingRight: 12,
          height: 26, cursor: 'pointer', border: 'none',
          background: isActive ? 'var(--bg-4)' : 'transparent',
          color: isActive ? 'var(--text-0)' : 'var(--text-2)',
          fontSize: 12, textAlign: 'left',
          transition: 'all 0.1s',
          borderRadius: 0,
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-1)'; }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-2)'; }}
      >
        <FileText size={11} strokeWidth={1.5} style={{ flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 11 }}>{f.name}</span>
        {f.isDirty && (
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginLeft: 'auto' }} />
        )}
      </button>
    );
  });

  if (!sidebarOpen) {
    return (
      <div
        style={{
          width: 40, flexShrink: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', paddingTop: 12, gap: 2,
          borderRight: '1px solid var(--border-0)', background: 'var(--bg-1)',
        }}
      >
        <button
          onClick={() => setSidebarOpen(true)}
          style={{
            width: 28, height: 28, display: 'flex', alignItems: 'center',
            justifyContent: 'center', border: 'none', background: 'transparent',
            color: 'var(--text-2)', cursor: 'pointer', borderRadius: 6,
            transition: 'color 0.1s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-1)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-2)')}
        >
          <LayoutGrid size={14} strokeWidth={1.5} />
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column',
          overflow: 'hidden', background: 'var(--bg-1)',
          borderRight: '1px solid var(--border-0)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 8px 0 16px', height: 44, flexShrink: 0,
            borderBottom: '1px solid var(--border-0)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 20, height: 20, borderRadius: 5,
                background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: 'white', flexShrink: 0,
              }}
            >A</div>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-0)', letterSpacing: '-0.2px' }}>Aira</span>
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            <button
              onClick={onNewProject}
              style={{
                width: 24, height: 24, border: 'none', background: 'transparent',
                cursor: 'pointer', color: 'var(--text-2)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', borderRadius: 5,
                transition: 'all 0.1s',
              }}
              title="New Project"
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.color = 'var(--text-0)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)'; }}
            >
              <Plus size={13} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              style={{
                width: 24, height: 24, border: 'none', background: 'transparent',
                cursor: 'pointer', color: 'var(--text-2)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', borderRadius: 5,
                transition: 'all 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.color = 'var(--text-0)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)'; }}
            >
              <ChevronsLeft size={13} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* No API key nudge */}
        {!apiKey && !(provider === 'openai-compatible' && customApiKey) && (
          <button
            onClick={() => setShowSettings(true)}
            style={{
              margin: '8px 10px', padding: '6px 10px', border: 'none',
              borderRadius: 8, cursor: 'pointer', textAlign: 'left',
              background: 'rgba(251,191,36,0.06)',
              outline: '1px solid rgba(251,191,36,0.15)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Key size={11} strokeWidth={1.5} style={{ color: 'var(--yellow)', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--yellow)' }}>Add API key to generate code</span>
            </div>
          </button>
        )}

        {/* Projects */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ padding: '8px 16px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
              Projects
            </span>
          </div>
          <div style={{ paddingBottom: 4 }}>
            {projects.length === 0 ? (
              <p style={{ padding: '8px 16px', fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
                No projects
              </p>
            ) : projects.map(p => {
              const isActive = p.id === activeProjectId;
              const isHover = hoverProject === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setActiveProject(p.id)}
                  onMouseEnter={() => setHoverProject(p.id)}
                  onMouseLeave={() => setHoverProject(null)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '0 10px 0 14px', height: 30,
                    background: isActive ? 'var(--bg-3)' : 'transparent',
                    cursor: 'pointer', transition: 'background 0.1s',
                  }}
                >
                  <div
                    style={{
                      width: 16, height: 16, borderRadius: 4,
                      background: isActive ? 'var(--accent-subtle)' : 'var(--bg-3)',
                      border: `1px solid ${isActive ? 'var(--accent-border)' : 'var(--border-1)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 8, color: isActive ? 'var(--accent-hover)' : 'var(--text-3)',
                      flexShrink: 0, transition: 'all 0.1s',
                    }}
                  >
                    {PLATFORM_ICONS[p.platforms[0]] ?? '●'}
                  </div>
                  <span
                    style={{
                      flex: 1, fontSize: 12, fontWeight: isActive ? 500 : 400,
                      color: isActive ? 'var(--text-0)' : 'var(--text-1)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    {p.name}
                  </span>
                  {isHover && (
                    <button
                      onClick={e => { e.stopPropagation(); deleteProject(p.id); }}
                      style={{
                        width: 18, height: 18, border: 'none', background: 'var(--bg-4)',
                        borderRadius: 4, cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        color: 'var(--text-2)', flexShrink: 0, transition: 'color 0.1s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-2)')}
                    >
                      <Trash2 size={10} strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* File tree */}
        {activeProject && activeProject.files.length > 0 && (
          <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid var(--border-0)' }}>
            <div style={{ padding: '8px 16px 4px' }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
                Files
              </span>
            </div>
            {renderTree(activeProject.files)}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            borderTop: '1px solid var(--border-0)', padding: '0 8px',
            height: 40, display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--text-3)', paddingLeft: 8 }}>
            {provider === 'openai-compatible' ? customModel || 'Custom' : selectedModel.includes('opus') ? 'Opus' : selectedModel.includes('haiku') ? 'Haiku' : 'Sonnet'}
          </span>
          <button
            onClick={openSettings}
            style={{
              width: 28, height: 28, border: 'none', background: 'transparent',
              cursor: 'pointer', color: 'var(--text-2)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', borderRadius: 6,
              transition: 'all 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.color = 'var(--text-0)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)'; }}
          >
            <Settings size={13} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tmpAnthropicKey={tmpAnthropicKey}
          setTmpAnthropicKey={setTmpAnthropicKey}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          tmpCustomKey={tmpCustomKey}
          setTmpCustomKey={setTmpCustomKey}
          tmpBaseUrl={tmpBaseUrl}
          setTmpBaseUrl={setTmpBaseUrl}
          tmpModel={tmpModel}
          setTmpModel={setTmpModel}
          tmpTeamMode={tmpTeamMode}
          setTmpTeamMode={setTmpTeamMode}
          tmpCommunicatorModel={tmpCommunicatorModel}
          setTmpCommunicatorModel={setTmpCommunicatorModel}
          tmpCriticModel={tmpCriticModel}
          setTmpCriticModel={setTmpCriticModel}
          onSave={saveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  );
}

const POPULAR_PROVIDERS = [
  { label: 'OpenAI',        baseUrl: 'https://api.openai.com/v1',          models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o1-mini'] },
  { label: 'Groq',          baseUrl: 'https://api.groq.com/openai/v1',     models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768', 'gemma2-9b-it'] },
  { label: 'Together AI',   baseUrl: 'https://api.together.xyz/v1',        models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'Qwen/Qwen2.5-72B-Instruct-Turbo'] },
  { label: 'Ollama (local)',baseUrl: 'http://localhost:11434/v1',           models: ['llama3.3', 'mistral', 'qwen2.5-coder:32b', 'deepseek-r1:14b'] },
  { label: 'Mistral',       baseUrl: 'https://api.mistral.ai/v1',          models: ['mistral-large-latest', 'codestral-latest', 'mistral-medium-latest'] },
  { label: 'DeepSeek',      baseUrl: 'https://api.deepseek.com/v1',        models: ['deepseek-chat', 'deepseek-reasoner'] },
  { label: 'xAI (Grok)',    baseUrl: 'https://api.x.ai/v1',               models: ['grok-3-beta', 'grok-3-mini-beta'] },
  { label: 'StepFun',       baseUrl: 'https://api.stepfun.ai/step_plan/v1', models: ['step-3.6', 'step-3.5-flash', 'step-3.5-flash-2603', 'step-3', 'step-2-mini', 'step-2-16k', 'step-1-32k', 'step-1-8k'] },
  { label: 'Cerebras',      baseUrl: 'https://api.cerebras.ai/v1',         models: ['llama-4-scout-17b-16e-instruct', 'llama3.1-70b'] },
  { label: 'Fireworks',     baseUrl: 'https://api.fireworks.ai/inference/v1', models: ['accounts/fireworks/models/llama-v3p3-70b-instruct', 'accounts/fireworks/models/deepseek-r1'] },
];

type GlobalSettingsTab = 'ai' | 'skills' | 'tools' | 'integrations' | 'memory' | 'channels';

const GLOBAL_TABS: { id: GlobalSettingsTab; label: string; icon: string }[] = [
  { id: 'ai',           label: 'AI',           icon: '🧠' },
  { id: 'skills',       label: 'Skills',       icon: '⚡' },
  { id: 'tools',        label: 'Tools',        icon: '🔧' },
  { id: 'integrations', label: 'Integrations', icon: '🔌' },
  { id: 'memory',       label: 'Memory',       icon: '💾' },
  { id: 'channels',     label: 'Channels',     icon: '📡' },
];

interface SettingsModalProps {
  activeTab: 'anthropic' | 'custom';
  setActiveTab: (t: 'anthropic' | 'custom') => void;
  tmpAnthropicKey: string;
  setTmpAnthropicKey: (v: string) => void;
  selectedModel: string;
  setSelectedModel: (v: string) => void;
  tmpCustomKey: string;
  setTmpCustomKey: (v: string) => void;
  tmpBaseUrl: string;
  setTmpBaseUrl: (v: string) => void;
  tmpModel: string;
  setTmpModel: (v: string) => void;
  tmpTeamMode: 'three-ai' | 'single';
  setTmpTeamMode: (v: 'three-ai' | 'single') => void;
  tmpCommunicatorModel: string;
  setTmpCommunicatorModel: (v: string) => void;
  tmpCriticModel: string;
  setTmpCriticModel: (v: string) => void;
  onSave: () => void;
  onClose: () => void;
}

type TestStatus = 'idle' | 'testing' | 'ok' | 'error';

async function testConnection(
  activeTab: 'anthropic' | 'custom',
  tmpAnthropicKey: string,
  selectedModel: string,
  tmpCustomKey: string,
  tmpBaseUrl: string,
  tmpModel: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    if (activeTab === 'anthropic') {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: tmpAnthropicKey, dangerouslyAllowBrowser: true });
      await client.messages.create({
        model: selectedModel,
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Hi' }],
      });
      return { ok: true, message: 'Connected successfully' };
    } else {
      const baseURL = (tmpBaseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl: `${baseURL}/chat/completions`,
          method: 'POST',
          headers: { Authorization: `Bearer ${tmpCustomKey || 'sk-placeholder'}` },
          body: JSON.stringify({
            model: tmpModel || 'gpt-4o',
            max_tokens: 16,
            messages: [{ role: 'user', content: 'Hi' }],
          }),
        }),
      });
      const data = await res.json() as { error?: { message: string }; choices?: unknown[] };
      if (!res.ok || data.error) throw new Error(data.error?.message ?? `HTTP ${res.status}`);
      return { ok: true, message: 'Connected successfully' };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Improve CORS / network error messaging
    if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('networkerror') || msg.toLowerCase().includes('connection error')) {
      return {
        ok: false,
        message: 'Network/CORS error — this provider may block browser requests. Try a proxy or use a CORS-friendly provider.',
      };
    }
    if (msg.includes('401') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('invalid api key')) {
      return { ok: false, message: 'Invalid API key — check and try again.' };
    }
    if (msg.includes('404') || msg.toLowerCase().includes('not found')) {
      return { ok: false, message: 'Model not found or wrong Base URL.' };
    }
    return { ok: false, message: msg };
  }
}

function InputField({ label, value, onChange, placeholder, mono = false, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; mono?: boolean; type?: string;
}) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-2)', display: 'block', marginBottom: 5 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '7px 10px',
          background: 'var(--bg-1)', border: '1px solid var(--border-1)',
          borderRadius: 7, color: 'var(--text-0)', fontSize: 12,
          fontFamily: mono ? 'monospace' : 'inherit',
          outline: 'none', transition: 'border-color 0.15s',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
        onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-1)')}
      />
    </div>
  );
}

// ─── Team AI Section (embedded in AI tab) ────────────────────────────────────

function TeamAISection({
  tmpTeamMode, setTmpTeamMode,
  tmpCommunicatorModel, setTmpCommunicatorModel,
  tmpCriticModel, setTmpCriticModel,
  activeTab,
  mainModel,
}: {
  tmpTeamMode: 'three-ai' | 'single';
  setTmpTeamMode: (v: 'three-ai' | 'single') => void;
  tmpCommunicatorModel: string;
  setTmpCommunicatorModel: (v: string) => void;
  tmpCriticModel: string;
  setTmpCriticModel: (v: string) => void;
  activeTab: 'anthropic' | 'custom';
  mainModel: string;
}) {
  const isThree = tmpTeamMode === 'three-ai';
  const defaultLabel = activeTab === 'anthropic'
    ? 'claude-haiku-4-5 (default)'
    : `${mainModel || 'main model'} (default)`;

  return (
    <div style={{
      marginTop: 6,
      borderTop: '1px solid var(--border-0)',
      paddingTop: 18,
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-0)' }}>AI Team Mode</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, lineHeight: 1.5 }}>
            {isThree
              ? 'Communicator + Builder + Critic working in parallel'
              : 'Single AI handles everything sequentially'}
          </div>
        </div>
        {/* Toggle */}
        <button
          onClick={() => setTmpTeamMode(isThree ? 'single' : 'three-ai')}
          style={{
            position: 'relative', width: 44, height: 24, borderRadius: 12,
            border: 'none', cursor: 'pointer', flexShrink: 0,
            background: isThree ? 'var(--accent)' : 'var(--bg-4)',
            transition: 'background 0.2s',
          }}
          title={isThree ? 'Switch to Single AI' : 'Switch to Three-AI Team'}
        >
          <span style={{
            position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%',
            background: 'white', transition: 'left 0.2s',
            left: isThree ? 23 : 3,
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }} />
        </button>
      </div>

      {/* Mode cards */}
      <div style={{ display: 'flex', gap: 8 }}>
        {(['three-ai', 'single'] as const).map(mode => {
          const sel = tmpTeamMode === mode;
          return (
            <button
              key={mode}
              onClick={() => setTmpTeamMode(mode)}
              style={{
                flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
                border: `1px solid ${sel ? 'var(--accent-border)' : 'var(--border-1)'}`,
                background: sel ? 'var(--accent-subtle)' : 'var(--bg-1)',
                textAlign: 'left', transition: 'all 0.1s',
              }}
              onMouseEnter={e => { if (!sel) e.currentTarget.style.borderColor = 'var(--border-2)'; }}
              onMouseLeave={e => { if (!sel) e.currentTarget.style.borderColor = 'var(--border-1)'; }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: sel ? 'var(--accent-hover)' : 'var(--text-1)', marginBottom: 3 }}>
                {mode === 'three-ai' ? '🧠🔨🔍 Three-AI Team' : '🤖 Single AI'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', lineHeight: 1.5 }}>
                {mode === 'three-ai'
                  ? 'Communicator + Builder + Critic. Highest quality, always responsive.'
                  : 'One AI does it all. Simpler, fewer API calls.'}
              </div>
            </button>
          );
        })}
      </div>

      {/* Per-role model overrides — only shown in Three-AI mode */}
      {isThree && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-2)', marginBottom: 2 }}>
            Subagent Models <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>(leave blank to use default)</span>
          </div>

          {/* Builder */}
          <div style={{
            padding: '10px 12px', borderRadius: 8,
            border: '1px solid var(--border-1)', background: 'var(--bg-1)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-1)', marginBottom: 1 }}>
                🔨 Builder
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-3)' }}>
                {mainModel || 'main model'} · Does all the actual building
              </div>
            </div>
            <span style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 4,
              background: 'rgba(99,102,241,0.1)', color: 'var(--accent)',
              border: '1px solid rgba(99,102,241,0.2)',
            }}>
              Main model
            </span>
          </div>

          {/* Communicator */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-1)' }}>🗣 Communicator</span>
              <span style={{ fontSize: 10, color: 'var(--text-3)' }}>— instant user replies</span>
            </div>
            <input
              value={tmpCommunicatorModel}
              onChange={e => setTmpCommunicatorModel(e.target.value)}
              placeholder={defaultLabel}
              style={{
                width: '100%', padding: '7px 10px',
                background: 'var(--bg-1)', border: '1px solid var(--border-1)',
                borderRadius: 7, color: 'var(--text-0)', fontSize: 12,
                fontFamily: 'monospace', outline: 'none', transition: 'border-color 0.15s',
                boxSizing: 'border-box',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-1)')}
            />
          </div>

          {/* Critic */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-1)' }}>🔍 Critic</span>
              <span style={{ fontSize: 10, color: 'var(--text-3)' }}>— reviews Builder output</span>
            </div>
            <input
              value={tmpCriticModel}
              onChange={e => setTmpCriticModel(e.target.value)}
              placeholder={defaultLabel}
              style={{
                width: '100%', padding: '7px 10px',
                background: 'var(--bg-1)', border: '1px solid var(--border-1)',
                borderRadius: 7, color: 'var(--text-0)', fontSize: 12,
                fontFamily: 'monospace', outline: 'none', transition: 'border-color 0.15s',
                boxSizing: 'border-box',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-1)')}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Settings Modal ─────────────────────────────────────────────────────────

function SettingsModal({
  activeTab, setActiveTab,
  tmpAnthropicKey, setTmpAnthropicKey,
  selectedModel, setSelectedModel,
  tmpCustomKey, setTmpCustomKey,
  tmpBaseUrl, setTmpBaseUrl,
  tmpModel, setTmpModel,
  tmpTeamMode, setTmpTeamMode,
  tmpCommunicatorModel, setTmpCommunicatorModel,
  tmpCriticModel, setTmpCriticModel,
  onSave, onClose,
}: SettingsModalProps) {
  const [globalTab, setGlobalTab] = useState<GlobalSettingsTab>('ai');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState('');

  // ── Drag & resize state ───────────────────────────────────────────────────
  const defaultW = () => globalTab === 'ai' ? Math.min(480, window.innerWidth - 32) : Math.min(860, window.innerWidth - 32);
  const defaultH = () => globalTab === 'ai' ? Math.min(720, window.innerHeight - 32) : Math.min(960, window.innerHeight - 32);

  const [pos,  setPos]  = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const dragRef  = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; ow: number; oh: number } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Centre on first render
  useEffect(() => {
    const w = defaultW();
    const h = defaultH();
    setSize({ w, h });
    setPos({ x: (window.innerWidth - w) / 2, y: (window.innerHeight - h) / 2 });
  }, []);

  // Resize modal when switching AI ↔ global if not manually resized
  const userResized = useRef(false);
  useEffect(() => {
    if (userResized.current) return;
    const w = defaultW();
    const h = defaultH();
    setSize({ w, h });
    if (pos) setPos({ x: (window.innerWidth - w) / 2, y: (window.innerHeight - h) / 2 });
  }, [globalTab]);

  const onDragStart = (e: React.MouseEvent) => {
    if (!pos) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, ox: pos.x, oy: pos.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const nx = dragRef.current.ox + ev.clientX - dragRef.current.startX;
      const ny = dragRef.current.oy + ev.clientY - dragRef.current.startY;
      const w = size?.w ?? defaultW();
      const h = size?.h ?? defaultH();
      setPos({
        x: Math.max(0, Math.min(nx, window.innerWidth  - w)),
        y: Math.max(0, Math.min(ny, window.innerHeight - h)),
      });
    };
    const onUp = () => { dragRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    userResized.current = true;
    resizeRef.current = { startX: e.clientX, startY: e.clientY, ow: size?.w ?? defaultW(), oh: size?.h ?? defaultH() };
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const nw = Math.max(340, resizeRef.current.ow + ev.clientX - resizeRef.current.startX);
      const nh = Math.max(380, resizeRef.current.oh + ev.clientY - resizeRef.current.startY);
      setSize({ w: Math.min(nw, window.innerWidth - (pos?.x ?? 0)), h: Math.min(nh, window.innerHeight - (pos?.y ?? 0)) });
    };
    const onUp = () => { resizeRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleTest = async () => {
    setTestStatus('testing');
    setTestMessage('');
    const result = await testConnection(activeTab, tmpAnthropicKey, selectedModel, tmpCustomKey, tmpBaseUrl, tmpModel);
    setTestStatus(result.ok ? 'ok' : 'error');
    setTestMessage(result.message);
  };

  const matchedProvider = POPULAR_PROVIDERS.find(p => p.baseUrl === tmpBaseUrl);
  const suggestedModels = matchedProvider?.models ?? [];

  if (!pos || !size) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(14px)',
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={modalRef}
        className="anim-fade-up"
        style={{
          position: 'absolute',
          left: pos.x, top: pos.y,
          width: size.w, height: size.h,
          minWidth: 340, minHeight: 380,
          borderRadius: 16,
          background: 'var(--bg-2)', border: '1px solid var(--border-1)',
          boxShadow: 'var(--shadow-float)', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          userSelect: dragRef.current || resizeRef.current ? 'none' : 'auto',
        }}
      >
        {/* Header — drag handle */}
        <div
          onMouseDown={onDragStart}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 18px', borderBottom: '1px solid var(--border-0)', flexShrink: 0,
            cursor: 'grab',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-0)' }}>Settings</span>
            <span style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.04em' }}>drag to move · resize from corner</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', display: 'flex', padding: 2, borderRadius: 4 }}>
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>

        {/* Resize grip — bottom-right */}
        <div
          onMouseDown={onResizeStart}
          style={{
            position: 'absolute', bottom: 4, right: 4, width: 18, height: 18,
            cursor: 'nwse-resize', zIndex: 10,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
            padding: 3,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M9 1L1 9M9 5L5 9M9 9" stroke="var(--text-3)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>

        {/* Top-level section tabs */}
        <div style={{
          display: 'flex', overflowX: 'auto', scrollbarWidth: 'none',
          borderBottom: '1px solid var(--border-0)', background: 'var(--bg-1)',
          padding: '0 14px', gap: 0, flexShrink: 0,
        }}>
          {GLOBAL_TABS.map(t => {
            const active = globalTab === t.id;
            return (
              <button key={t.id} onClick={() => setGlobalTab(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '9px 10px',
                  border: 'none', borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                  background: 'transparent', color: active ? 'var(--text-0)' : 'var(--text-2)',
                  fontSize: 11, fontWeight: active ? 500 : 400, cursor: 'pointer',
                  whiteSpace: 'nowrap', transition: 'all 0.1s', flexShrink: 0,
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-1)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.color = active ? 'var(--text-0)' : 'var(--text-2)'; }}
              >
                <span style={{ fontSize: 11 }}>{t.icon}</span>
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Global tab content: Skills / Tools / Integrations / Memory / Channels */}
        {globalTab !== 'ai' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {globalTab === 'skills'       && <SkillsPage />}
            {globalTab === 'tools'        && <ToolsPage />}
            {globalTab === 'integrations' && <IntegrationsPage />}
            {globalTab === 'memory'       && <MemoryPage />}
            {globalTab === 'channels'     && <ChannelBridgesPage />}
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* AI tab body (provider config) */}
        {globalTab === 'ai' && (
          <>
            {/* Provider selector tabs */}
            <div style={{
              display: 'flex', borderBottom: '1px solid var(--border-0)',
              padding: '0 18px', background: 'var(--bg-1)', flexShrink: 0,
            }}>
              {(['anthropic', 'custom'] as const).map(t => {
                const isActive = activeTab === t;
                return (
                  <button key={t} onClick={() => setActiveTab(t)}
                    style={{
                      padding: '8px 12px', border: 'none',
                      borderBottom: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                      background: 'transparent',
                      color: isActive ? 'var(--text-0)' : 'var(--text-2)',
                      fontSize: 11, fontWeight: isActive ? 500 : 400,
                      cursor: 'pointer', transition: 'all 0.1s',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-1)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-2)'; }}
                  >
                    {t === 'anthropic' ? 'Anthropic' : 'OpenAI-compatible'}
                  </button>
                );
              })}
            </div>

            <div style={{ padding: 18, overflowY: 'auto', flex: 1 }}>
              {activeTab === 'anthropic' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <InputField
                    label="API Key"
                    type="password"
                    value={tmpAnthropicKey}
                    onChange={setTmpAnthropicKey}
                    placeholder="sk-ant-api03-..."
                    mono
                  />
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: -8 }}>
                    Get yours at console.anthropic.com — stored locally, never leaves your browser.
                  </p>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>Model</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {AI_MODELS.map(m => {
                        const sel = selectedModel === m.id;
                        return (
                          <button
                            key={m.id}
                            onClick={() => setSelectedModel(m.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '9px 12px', borderRadius: 8, cursor: 'pointer',
                              border: `1px solid ${sel ? 'var(--accent-border)' : 'var(--border-1)'}`,
                              background: sel ? 'var(--accent-subtle)' : 'var(--bg-1)',
                              transition: 'all 0.1s', textAlign: 'left',
                            }}
                            onMouseEnter={e => { if (!sel) e.currentTarget.style.borderColor = 'var(--border-2)'; }}
                            onMouseLeave={e => { if (!sel) e.currentTarget.style.borderColor = 'var(--border-1)'; }}
                          >
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12, fontWeight: 500, color: sel ? 'var(--text-0)' : 'var(--text-1)' }}>{m.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{(m.contextWindow / 1000).toFixed(0)}k context · {m.capabilities.slice(0, 3).join(', ')}</div>
                            </div>
                            {sel && <Check size={12} strokeWidth={2} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Team AI Mode ─────────────────────────────────────────── */}
              <TeamAISection
                tmpTeamMode={tmpTeamMode}
                setTmpTeamMode={setTmpTeamMode}
                tmpCommunicatorModel={tmpCommunicatorModel}
                setTmpCommunicatorModel={setTmpCommunicatorModel}
                tmpCriticModel={tmpCriticModel}
                setTmpCriticModel={setTmpCriticModel}
                activeTab={activeTab}
                mainModel={activeTab === 'anthropic' ? selectedModel : tmpModel}
              />

              {activeTab === 'custom' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <p style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.6 }}>
                    Works with any OpenAI-compatible API — OpenAI, Groq, Together, Ollama, Mistral, DeepSeek, and more.
                  </p>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>Quick select</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {POPULAR_PROVIDERS.map(p => {
                        const active = tmpBaseUrl === p.baseUrl;
                        return (
                          <button
                            key={p.label}
                            onClick={() => {
                              setTmpBaseUrl(p.baseUrl);
                              if (!tmpModel || !p.models.includes(tmpModel)) setTmpModel(p.models[0]);
                            }}
                            style={{
                              padding: '4px 9px', borderRadius: 6,
                              border: `1px solid ${active ? 'var(--accent-border)' : 'var(--border-1)'}`,
                              background: active ? 'var(--accent-subtle)' : 'var(--bg-1)',
                              color: active ? 'var(--accent-hover)' : 'var(--text-2)',
                              fontSize: 11, cursor: 'pointer', transition: 'all 0.1s',
                              fontWeight: active ? 500 : 400,
                            }}
                            onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = 'var(--border-2)'; }}
                            onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = 'var(--border-1)'; }}
                          >
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <InputField label="Base URL" value={tmpBaseUrl} onChange={setTmpBaseUrl} placeholder="https://api.openai.com/v1" mono />
                  <InputField label="API Key" type="password" value={tmpCustomKey} onChange={setTmpCustomKey} placeholder="sk-..." mono />

                  <div style={{ position: 'relative' }}>
                    <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-2)', display: 'block', marginBottom: 5 }}>Model</label>
                    <input
                      value={tmpModel}
                      onChange={e => setTmpModel(e.target.value)}
                      onFocus={() => setShowModelDropdown(suggestedModels.length > 0)}
                      placeholder="gpt-4o"
                      style={{
                        width: '100%', padding: '7px 10px',
                        background: 'var(--bg-1)', border: '1px solid var(--border-1)',
                        borderRadius: 7, color: 'var(--text-0)', fontSize: 12,
                        fontFamily: 'monospace', outline: 'none', transition: 'border-color 0.15s',
                        boxSizing: 'border-box',
                      }}
                      onBlur={() => setTimeout(() => setShowModelDropdown(false), 150)}
                      onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                    />
                    {showModelDropdown && suggestedModels.length > 0 && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                        background: 'var(--bg-3)', border: '1px solid var(--border-2)',
                        borderRadius: 8, overflow: 'hidden', marginTop: 2,
                        boxShadow: 'var(--shadow-md)',
                      }}>
                        {suggestedModels.map(m => (
                          <button
                            key={m}
                            onMouseDown={() => { setTmpModel(m); setShowModelDropdown(false); }}
                            style={{
                              width: '100%', padding: '7px 10px', border: 'none',
                              background: m === tmpModel ? 'var(--bg-4)' : 'transparent',
                              color: m === tmpModel ? 'var(--text-0)' : 'var(--text-1)',
                              fontSize: 12, textAlign: 'left', cursor: 'pointer',
                              fontFamily: 'monospace', transition: 'background 0.1s',
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-4)')}
                            onMouseLeave={e => (e.currentTarget.style.background = m === tmpModel ? 'var(--bg-4)' : 'transparent')}
                          >
                            <span>{m}</span>
                            {m === tmpModel && <Check size={10} strokeWidth={2} style={{ color: 'var(--accent)' }} />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6 }}>
                    For Ollama use <code style={{ fontFamily: 'monospace', background: 'var(--bg-3)', padding: '1px 4px', borderRadius: 3 }}>http://localhost:11434/v1</code> with any key.
                  </p>
                </div>
              )}
            </div>

            {/* Footer — AI tab only */}
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border-0)', flexShrink: 0 }}>
              {testStatus !== 'idle' && (
                <div style={{
                  marginBottom: 10, padding: '7px 10px', borderRadius: 7, fontSize: 11,
                  background: testStatus === 'ok' ? 'rgba(34,197,94,0.08)' : testStatus === 'testing' ? 'rgba(99,102,241,0.08)' : 'rgba(239,68,68,0.08)',
                  border: `1px solid ${testStatus === 'ok' ? 'rgba(34,197,94,0.2)' : testStatus === 'testing' ? 'rgba(99,102,241,0.2)' : 'rgba(239,68,68,0.2)'}`,
                  color: testStatus === 'ok' ? '#4ade80' : testStatus === 'testing' ? 'var(--accent)' : '#f87171',
                  lineHeight: 1.5,
                }}>
                  {testStatus === 'testing' ? '⏳ Testing connection…' : testStatus === 'ok' ? `✓ ${testMessage}` : `✗ ${testMessage}`}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={onClose}
                  style={{
                    flex: 1, padding: '8px', borderRadius: 8,
                    border: '1px solid var(--border-1)', background: 'transparent',
                    color: 'var(--text-1)', fontSize: 12, cursor: 'pointer', transition: 'border-color 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-2)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-1)')}
                >
                  Cancel
                </button>
                <button
                  onClick={handleTest}
                  disabled={testStatus === 'testing'}
                  style={{
                    flex: 1, padding: '8px', borderRadius: 8,
                    border: '1px solid var(--border-1)', background: 'transparent',
                    color: testStatus === 'ok' ? '#4ade80' : 'var(--text-1)',
                    fontSize: 12, cursor: testStatus === 'testing' ? 'not-allowed' : 'pointer',
                    transition: 'all 0.1s', opacity: testStatus === 'testing' ? 0.6 : 1,
                  }}
                  onMouseEnter={e => { if (testStatus !== 'testing') e.currentTarget.style.borderColor = 'var(--border-2)'; }}
                  onMouseLeave={e => { if (testStatus !== 'testing') e.currentTarget.style.borderColor = 'var(--border-1)'; }}
                >
                  {testStatus === 'testing' ? 'Testing…' : 'Test'}
                </button>
                <button
                  onClick={onSave}
                  style={{
                    flex: 2, padding: '8px', borderRadius: 8, border: 'none',
                    background: 'var(--accent)', color: 'white',
                    fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'opacity 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  Save & Apply
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
