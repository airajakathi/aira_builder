import { useState } from 'react';
import {
  Settings2, Zap, Wrench, Plug, Brain, Bot,
  Plus, Trash2, Bell, Globe, Lock, Search,
  ToggleLeft, ToggleRight, ChevronDown, ChevronRight,
  Play, Pause, Webhook, Hash, Clock, ExternalLink,
  RefreshCw, Check, X, Send, TestTube2, Radio, Camera,
  MessageSquare, Loader2,
} from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { useAppStore } from '../../store';
import { PLATFORM_CONFIGS } from '../../lib/platforms';
import { telegramGetMe } from '../../lib/channelBridge';
import type {
  Backend, Skill, SkillTrigger, CustomTool, ToolExecutor,
  Integration, IntegrationCategory, MemoryEntry, MemoryType,
  AgentLoop, AgentTriggerType, ChannelConfig, ChannelBridge, BridgeType,
} from '../../types';

// ─── Shared styles ────────────────────────────────────────────────────────────
const LABEL: React.CSSProperties = { fontSize: 10, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 };
const INPUT: React.CSSProperties = { width: '100%', padding: '7px 10px', background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 7, color: 'var(--text-1)', fontSize: 12, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };

// ─── Channel delivery helpers (real HTTP calls) ───────────────────────────────

async function sendToChannel(ch: ChannelConfig, message: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (ch.type === 'console') {
      console.log('[AgentLoop]', message);
      return { ok: true };
    }
    if (ch.type === 'webhook') {
      if (!ch.target) return { ok: false, error: 'No webhook URL set' };
      const r = await fetch(ch.target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message, source: 'aira-builder', timestamp: new Date().toISOString() }),
      });
      return { ok: r.ok, error: r.ok ? undefined : `HTTP ${r.status}` };
    }
    if (ch.type === 'slack') {
      // Slack incoming webhook
      if (!ch.target) return { ok: false, error: 'No Slack webhook URL' };
      const r = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl: ch.target, method: 'POST', headers: {}, body: JSON.stringify({ text: message }) }),
      });
      return { ok: r.ok, error: r.ok ? undefined : `HTTP ${r.status}` };
    }
    if (ch.type === 'discord') {
      // Discord webhook
      if (!ch.target) return { ok: false, error: 'No Discord webhook URL' };
      const r = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl: ch.target, method: 'POST', headers: {}, body: JSON.stringify({ content: message }) }),
      });
      return { ok: r.ok, error: r.ok ? undefined : `HTTP ${r.status}` };
    }
    if (ch.type === 'telegram') {
      // Telegram Bot API — target format: "BOT_TOKEN:CHAT_ID"
      if (!ch.target) return { ok: false, error: 'No Telegram token:chatId' };
      const [token, chatId] = ch.target.split(':');
      if (!token || !chatId) return { ok: false, error: 'Format must be BOTTOKEN:CHAT_ID' };
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' }),
      });
      return { ok: r.ok, error: r.ok ? undefined : `HTTP ${r.status}` };
    }
    if (ch.type === 'email') {
      // Use Resend if connected, else warn
      const state = useAppStore.getState();
      const resend = state.integrations.find(i => i.slug === 'resend' && i.status === 'connected');
      if (!resend?.credentials?.apiKey) return { ok: false, error: 'Connect Resend integration first' };
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resend.credentials.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'aira@airabuilder.app',
          to: [ch.target],
          subject: '[Aira Agent] Result',
          text: message,
        }),
      });
      return { ok: r.ok, error: r.ok ? undefined : `HTTP ${r.status}` };
    }
    return { ok: false, error: `Unknown channel type: ${ch.type}` };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ─── Sub-page: Project Info ───────────────────────────────────────────────────

function ProjectInfoPage() {
  const activeProject = useAppStore(s => s.activeProject());
  const { addBackend, removeBackend } = useAppStore();
  const [addingBackend, setAddingBackend] = useState(false);
  const [newBackend, setNewBackend] = useState<Partial<Backend>>({ type: 'supabase' });

  if (!activeProject) return <EmptyState msg="No project selected" />;

  const BACKEND_TYPES: { id: Backend['type']; label: string; icon: string; color: string }[] = [
    { id: 'supabase', label: 'Supabase', icon: '⚡', color: '#3ecf8e' },
    { id: 'firebase', label: 'Firebase', icon: '🔥', color: '#ffa000' },
    { id: 'node',     label: 'Node.js',  icon: '🟢', color: '#68a063' },
    { id: 'python',   label: 'Python',   icon: '🐍', color: '#3572a5' },
    { id: 'go',       label: 'Go',       icon: '🔵', color: '#00acd7' },
    { id: 'custom',   label: 'Custom',   icon: '⚙️', color: '#888' },
  ];

  return (
    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Tech Stack */}
      <Section title="Tech Stack">
        {Object.entries(activeProject.tech).map(([k, v]) => k !== 'extra' && (
          <Row key={k} left={<span style={{ fontSize: 11, color: 'var(--text-2)', textTransform: 'capitalize' }}>{k}</span>}
            right={<code style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--bg-3)', color: 'var(--accent)', border: '1px solid var(--border-1)' }}>{String(v) || '—'}</code>} />
        ))}
      </Section>

      {/* Platforms */}
      <Section title="Platforms">
        {activeProject.platforms.map(p => {
          const cfg = PLATFORM_CONFIGS[p];
          return (
            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-2)', border: '1px solid var(--border-1)' }}>
              <span style={{ fontSize: 16 }}>{cfg.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-0)' }}>{cfg.label}</div>
                <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{cfg.frameworks[0]}</div>
              </div>
              <div style={{ display: 'flex', gap: 3 }}>
                {cfg.deployTargets.map(t => (
                  <span key={t} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: `${cfg.color}15`, color: cfg.color, border: `1px solid ${cfg.color}30` }}>{t}</span>
                ))}
              </div>
            </div>
          );
        })}
      </Section>

      {/* Backends */}
      <Section title={`Backends (${activeProject.backendType})`} action={<AddBtn onClick={() => setAddingBackend(true)} />}>
        {activeProject.backends.map(b => {
          const bt = BACKEND_TYPES.find(t => t.id === b.type);
          return (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 8, background: 'var(--bg-2)', border: '1px solid var(--border-1)' }}>
              <span>{bt?.icon ?? '⚙️'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-0)' }}>{b.name}</div>
                {b.url && <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.url}</div>}
              </div>
              <DelBtn onClick={() => removeBackend(activeProject.id, b.id)} />
            </div>
          );
        })}
        {activeProject.backends.length === 0 && !addingBackend && <EmptyRow msg="No backends configured" />}
        {addingBackend && (
          <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg-2)', border: '1px solid var(--border-1)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {BACKEND_TYPES.map(t => (
                <button key={t.id} onClick={() => setNewBackend(p => ({ ...p, type: t.id }))}
                  style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, cursor: 'pointer', border: `1px solid ${newBackend.type === t.id ? t.color : 'var(--border-1)'}`, background: newBackend.type === t.id ? `${t.color}18` : 'transparent', color: newBackend.type === t.id ? t.color : 'var(--text-2)' }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            <input placeholder="Backend name" value={newBackend.name ?? ''} onChange={e => setNewBackend(p => ({ ...p, name: e.target.value }))} style={INPUT} />
            <input placeholder="URL (optional)" value={newBackend.url ?? ''} onChange={e => setNewBackend(p => ({ ...p, url: e.target.value }))} style={{ ...INPUT, fontFamily: 'monospace', fontSize: 11 }} />
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => { addBackend(activeProject.id, { id: uuid(), name: newBackend.name!, type: newBackend.type!, url: newBackend.url, apiKey: newBackend.apiKey, config: {} }); setAddingBackend(false); setNewBackend({ type: 'supabase' }); }} disabled={!newBackend.name}
                style={{ flex: 1, padding: '6px 0', background: 'var(--accent)', border: 'none', borderRadius: 7, color: 'white', fontSize: 12, cursor: newBackend.name ? 'pointer' : 'not-allowed', opacity: newBackend.name ? 1 : 0.5 }}>Add</button>
              <button onClick={() => setAddingBackend(false)} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--border-1)', borderRadius: 7, color: 'var(--text-2)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}
      </Section>

      {/* Project meta */}
      <Section title="Project Info">
        {[
          ['Created', new Date(activeProject.createdAt).toLocaleDateString()],
          ['Files', String(activeProject.files.reduce((a, f) => a + (f.type === 'file' ? 1 : (f.children?.length ?? 0)), 0))],
          ['Messages', String(activeProject.messages.length)],
          ['Deployments', String(activeProject.deployments.length)],
        ].map(([k, v]) => (
          <Row key={k} left={<span style={{ fontSize: 11, color: 'var(--text-2)' }}>{k}</span>} right={<span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-3)' }}>{v}</span>} />
        ))}
      </Section>
    </div>
  );
}

// ─── Sub-page: Skills ─────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<SkillTrigger, string> = {
  manual: 'Manual', on_message: 'On message', on_file_write: 'On file write', on_build: 'On build', scheduled: 'Scheduled',
};

const STARTER_SKILLS: Array<Omit<Skill, 'id' | 'createdAt'>> = [
  { name: 'Code Reviewer', description: 'Auto-reviews code after every file write.', systemPrompt: 'You are a senior code reviewer. Check for bugs, security issues, and style. Be concise.', tools: [], trigger: 'on_file_write', enabled: false, icon: '🔍', color: '#6366f1' },
  { name: 'Test Generator', description: 'Generates unit tests for new functions.', systemPrompt: 'You are a test engineer. Generate comprehensive tests covering happy paths, edge cases, and errors.', tools: [], trigger: 'on_file_write', enabled: false, icon: '🧪', color: '#10b981' },
  { name: 'Daily Standup', description: 'Summarises project activity every morning.', systemPrompt: 'Analyse recent files and messages, produce a short standup: done, in-progress, blockers.', tools: [], trigger: 'scheduled', schedule: '0 9 * * 1-5', enabled: false, icon: '📋', color: '#f59e0b' },
  { name: 'Doc Writer', description: 'Keeps README and inline docs updated.', systemPrompt: 'Update README.md and JSDoc comments whenever code changes. Keep docs accurate and concise.', tools: [], trigger: 'on_build', enabled: false, icon: '📝', color: '#3b82f6' },
];

export function SkillsPage() {
  const { skills, addSkill, updateSkill, deleteSkill, toggleSkill } = useAppStore();
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState(''); const [desc, setDesc] = useState(''); const [prompt, setPrompt] = useState(''); const [trigger, setTrigger] = useState<SkillTrigger>('manual'); const [schedule, setSchedule] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const save = () => {
    if (!name.trim() || !prompt.trim()) return;
    addSkill({ name: name.trim(), description: desc.trim(), systemPrompt: prompt.trim(), tools: [], trigger, schedule: trigger === 'scheduled' ? schedule : undefined, enabled: true, icon: '⚡', color: '#6366f1' });
    setName(''); setDesc(''); setPrompt(''); setTrigger('manual'); setShowNew(false);
  };

  return (
    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SectionHeader title="Skills" subtitle="AI behaviour extensions injected into every generation." badge={skills.filter(s => s.enabled).length > 0 ? `${skills.filter(s => s.enabled).length} active` : undefined}
        action={<AddBtn onClick={() => setShowNew(v => !v)} />} />

      {showNew && (
        <FormCard>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-0)', marginBottom: 10 }}>New Skill</p>
          <FInput label="Name" value={name} onChange={setName} placeholder="e.g. Code Reviewer" />
          <FInput label="Description" value={desc} onChange={setDesc} placeholder="What does this skill do?" />
          <div style={{ marginBottom: 8 }}>
            <label style={LABEL}>Trigger</label>
            <select value={trigger} onChange={e => setTrigger(e.target.value as SkillTrigger)} style={INPUT}>
              {Object.entries(TRIGGER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {trigger === 'scheduled' && <FInput label="Cron" value={schedule} onChange={setSchedule} placeholder="0 9 * * 1-5" mono />}
          <div style={{ marginBottom: 10 }}>
            <label style={LABEL}>System Prompt</label>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} placeholder="AI instructions for this skill…" style={{ ...INPUT, resize: 'vertical', lineHeight: 1.6 }} />
          </div>
          <FormActions onSave={save} onCancel={() => setShowNew(false)} disabled={!name.trim() || !prompt.trim()} saveLabel="Create Skill" />
        </FormCard>
      )}

      {skills.length === 0 && !showNew && (
        <EmptyWithTemplates label="No skills yet" items={STARTER_SKILLS.map(s => ({ icon: s.icon ?? '⚡', name: s.name, desc: s.description, onClick: () => addSkill(s) }))} />
      )}

      {skills.map(s => (
        <div key={s.id} style={{ borderRadius: 9, border: `1px solid ${s.enabled ? `${s.color}33` : 'var(--border-1)'}`, background: s.enabled ? `${s.color}06` : 'var(--bg-2)', overflow: 'hidden' }}>
          <div style={{ padding: '9px 12px', display: 'flex', alignItems: 'flex-start', gap: 9 }}>
            <div style={{ width: 32, height: 32, borderRadius: 7, flexShrink: 0, background: `${s.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{s.icon ?? '⚡'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-0)' }}>{s.name}</span>
                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: `${s.color}20`, color: s.color, fontWeight: 600 }}>{TRIGGER_LABELS[s.trigger]}</span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>{s.description}</p>
            </div>
            <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
              <button onClick={() => toggleSkill(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: s.enabled ? s.color : 'var(--text-3)', display: 'flex' }}>
                {s.enabled ? <ToggleRight size={18} strokeWidth={1.5} /> : <ToggleLeft size={18} strokeWidth={1.5} />}
              </button>
              <button onClick={() => setExpanded(expanded === s.id ? null : s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: 'var(--text-3)', display: 'flex' }}>
                {expanded === s.id ? <ChevronDown size={13} strokeWidth={1.5} /> : <ChevronRight size={13} strokeWidth={1.5} />}
              </button>
              <DelBtn onClick={() => deleteSkill(s.id)} />
            </div>
          </div>
          {expanded === s.id && (
            <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--border-0)' }}>
              <div style={{ marginTop: 10 }}>
                <label style={LABEL}>System Prompt</label>
                <textarea value={s.systemPrompt} onChange={e => updateSkill(s.id, { systemPrompt: e.target.value })} rows={4} style={{ ...INPUT, resize: 'vertical', lineHeight: 1.6 }} />
              </div>
              {s.trigger === 'scheduled' && (
                <div style={{ marginTop: 8 }}>
                  <label style={LABEL}>Cron</label>
                  <input value={s.schedule ?? ''} onChange={e => updateSkill(s.id, { schedule: e.target.value })} placeholder="0 9 * * 1-5" style={{ ...INPUT, fontFamily: 'monospace', fontSize: 11 }} />
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Sub-page: Tools ──────────────────────────────────────────────────────────

const EXEC_LABELS: Record<ToolExecutor, string> = { http: 'HTTP', code: 'Code', mcp: 'MCP' };

export function ToolsPage() {
  const { customTools, addTool, updateTool, deleteTool, toggleTool } = useAppStore();
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState(''); const [desc, setDesc] = useState(''); const [exec, setExec] = useState<ToolExecutor>('http'); const [url, setUrl] = useState(''); const [code, setCode] = useState('return JSON.stringify(args);');
  const [expanded, setExpanded] = useState<string | null>(null);

  const save = () => {
    if (!name.trim()) return;
    addTool({ name: name.trim().replace(/\s+/g, '_').toLowerCase(), description: desc.trim(), executor: exec, httpUrl: url, httpMethod: 'GET', codeBody: code, params: [], enabled: true, icon: exec === 'http' ? '🌐' : '⚡' });
    setName(''); setDesc(''); setUrl(''); setShowNew(false);
  };

  return (
    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SectionHeader title="Tools" subtitle="Custom tools Aira can call — HTTP APIs, code runners, MCP delegates."
        badge={customTools.filter(t => t.enabled).length > 0 ? `${customTools.filter(t => t.enabled).length}/${customTools.length}` : undefined}
        action={<AddBtn onClick={() => setShowNew(v => !v)} />} />

      {showNew && (
        <FormCard>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-0)', marginBottom: 10 }}>New Tool</p>
          <FInput label="Name (snake_case)" value={name} onChange={setName} placeholder="fetch_weather" mono />
          <FInput label="Description" value={desc} onChange={setDesc} placeholder="What does this tool do?" />
          <div style={{ marginBottom: 8 }}>
            <label style={LABEL}>Executor</label>
            <div style={{ display: 'flex', gap: 4 }}>
              {(Object.keys(EXEC_LABELS) as ToolExecutor[]).map(e => (
                <button key={e} onClick={() => setExec(e)} style={{ flex: 1, padding: '6px 0', borderRadius: 7, border: `1px solid ${exec === e ? 'var(--accent)' : 'var(--border-1)'}`, background: exec === e ? 'rgba(99,102,241,0.12)' : 'transparent', color: exec === e ? 'var(--accent)' : 'var(--text-2)', fontSize: 11, cursor: 'pointer', fontWeight: exec === e ? 600 : 400 }}>{EXEC_LABELS[e]}</button>
              ))}
            </div>
          </div>
          {exec === 'http' && <FInput label="URL" value={url} onChange={setUrl} placeholder="https://api.example.com/{{endpoint}}" mono />}
          {exec === 'code' && (
            <div style={{ marginBottom: 8 }}>
              <label style={LABEL}>JS Body</label>
              <textarea value={code} onChange={e => setCode(e.target.value)} rows={4} style={{ ...INPUT, fontFamily: 'monospace', fontSize: 11, resize: 'vertical' }} />
            </div>
          )}
          <FormActions onSave={save} onCancel={() => setShowNew(false)} disabled={!name.trim()} saveLabel="Create Tool" />
        </FormCard>
      )}

      {customTools.length === 0 && !showNew && <EmptyRow msg="No custom tools yet. Create one above." />}

      {customTools.map(t => (
        <div key={t.id} style={{ borderRadius: 9, border: `1px solid ${t.enabled ? 'var(--border-2)' : 'var(--border-1)'}`, background: 'var(--bg-2)', overflow: 'hidden' }}>
          <div style={{ padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, flexShrink: 0, background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{t.icon ?? '🔧'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-0)', fontFamily: 'monospace' }}>{t.name}</span>
                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'var(--bg-3)', color: 'var(--text-2)', border: '1px solid var(--border-1)' }}>{EXEC_LABELS[t.executor]}</span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</p>
            </div>
            <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
              <button onClick={() => toggleTool(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: t.enabled ? 'var(--green)' : 'var(--text-3)', display: 'flex' }}>
                {t.enabled ? <ToggleRight size={18} strokeWidth={1.5} /> : <ToggleLeft size={18} strokeWidth={1.5} />}
              </button>
              <button onClick={() => setExpanded(expanded === t.id ? null : t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: 'var(--text-3)', display: 'flex' }}>
                {expanded === t.id ? <ChevronDown size={13} strokeWidth={1.5} /> : <ChevronRight size={13} strokeWidth={1.5} />}
              </button>
              <DelBtn onClick={() => deleteTool(t.id)} />
            </div>
          </div>
          {expanded === t.id && (
            <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--border-0)' }}>
              {t.executor === 'http' && (
                <div style={{ marginTop: 10 }}>
                  <label style={LABEL}>URL</label>
                  <input value={t.httpUrl ?? ''} onChange={e => updateTool(t.id, { httpUrl: e.target.value })} style={{ ...INPUT, fontFamily: 'monospace', fontSize: 11 }} />
                  <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                    {(['GET', 'POST', 'PUT', 'DELETE'] as const).map(m => (
                      <button key={m} onClick={() => updateTool(t.id, { httpMethod: m })} style={{ padding: '3px 8px', borderRadius: 6, border: `1px solid ${t.httpMethod === m ? 'var(--accent)' : 'var(--border-1)'}`, background: t.httpMethod === m ? 'rgba(99,102,241,0.15)' : 'transparent', color: t.httpMethod === m ? 'var(--accent)' : 'var(--text-2)', fontSize: 10, cursor: 'pointer', fontFamily: 'monospace', fontWeight: 600 }}>{m}</button>
                    ))}
                  </div>
                </div>
              )}
              {t.executor === 'code' && (
                <div style={{ marginTop: 10 }}>
                  <label style={LABEL}>JS Body</label>
                  <textarea value={t.codeBody ?? ''} onChange={e => updateTool(t.id, { codeBody: e.target.value })} rows={5} style={{ ...INPUT, fontFamily: 'monospace', fontSize: 11, resize: 'vertical' }} />
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Sub-page: Integrations ───────────────────────────────────────────────────

const CAT_LABELS: Record<IntegrationCategory, string> = { database: '🗄️ Database', auth: '🔐 Auth', payments: '💳 Payments', ai: '🤖 AI', communication: '💬 Comms', devops: '🚀 DevOps', analytics: '📊 Analytics', storage: '☁️ Storage', mcp: '⚙️ MCP' };

function ConnectModal({ integration, onClose }: { integration: Integration; onClose: () => void }) {
  const { connectIntegration, updateIntegration } = useAppStore();
  const [key, setKey] = useState(''); const [url, setUrl] = useState(''); const [saving, setSaving] = useState(false);

  const connect = async () => {
    if (integration.authType === 'oauth' && integration.oauthUrl) { window.open(integration.oauthUrl, '_blank', 'width=600,height=700'); updateIntegration(integration.id, { status: 'connecting' }); setTimeout(() => connectIntegration(integration.id, { oauth: '1' }), 1500); onClose(); return; }
    if (!key.trim() && integration.authType !== 'none') return;
    setSaving(true); updateIntegration(integration.id, { status: 'connecting' });
    await new Promise(r => setTimeout(r, 700));
    const creds: Record<string, string> = {};
    if (key) creds.apiKey = key;
    if (url) creds.url = url;
    connectIntegration(integration.id, creds);
    setSaving(false); onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ width: 400, background: 'var(--bg-2)', border: '1px solid var(--border-2)', borderRadius: 14, padding: 22, boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: `${integration.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{integration.icon}</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-0)', margin: 0 }}>Connect {integration.name}</p>
            <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>{integration.description}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex' }}><X size={15} strokeWidth={1.5} /></button>
        </div>
        {integration.authType === 'oauth' ? (
          <button onClick={connect} style={{ width: '100%', padding: '9px 0', background: integration.color || 'var(--accent)', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <ExternalLink size={13} strokeWidth={1.5} />Connect with {integration.name}
          </button>
        ) : (
          <>
            {(integration.authType === 'url+key' || integration.category === 'mcp') && (
              <div style={{ marginBottom: 10 }}>
                <label style={LABEL}>URL / Endpoint</label>
                <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." style={{ ...INPUT, fontFamily: 'monospace', fontSize: 11 }} />
              </div>
            )}
            {integration.authType !== 'none' && (
              <div style={{ marginBottom: 14 }}>
                <label style={LABEL}>API Key</label>
                <input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder={`${integration.name} API key`} style={INPUT} />
                <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>Stored locally, never sent to Aira servers.</p>
              </div>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={connect} disabled={saving || (integration.authType !== 'none' && !key.trim())}
                style={{ flex: 1, padding: '8px 0', background: 'var(--accent)', border: 'none', borderRadius: 7, color: 'white', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, opacity: saving || (integration.authType !== 'none' && !key.trim()) ? 0.6 : 1 }}>
                {saving ? <><RefreshCw size={12} strokeWidth={1.5} style={{ animation: 'spin 0.8s linear infinite' }} />Connecting…</> : <><Check size={12} strokeWidth={2} />Connect</>}
              </button>
              <button onClick={onClose} style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--border-1)', borderRadius: 7, color: 'var(--text-2)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function IntegrationsPage() {
  const { integrations, disconnectIntegration } = useAppStore();
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState<IntegrationCategory | 'all'>('all');
  const [connecting, setConnecting] = useState<Integration | null>(null);

  const cats = [...new Set(integrations.map(i => i.category))] as IntegrationCategory[];
  const filtered = integrations.filter(i =>
    (activeCat === 'all' || i.category === activeCat) &&
    (!query || i.name.toLowerCase().includes(query.toLowerCase()))
  );
  const grouped = cats.reduce<Record<string, Integration[]>>((a, c) => { const items = filtered.filter(i => i.category === c); if (items.length) a[c] = items; return a; }, {});
  const connected = integrations.filter(i => i.status === 'connected').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {connecting && <ConnectModal integration={connecting} onClose={() => setConnecting(null)} />}
      <div style={{ padding: '14px 16px 0', flexShrink: 0 }}>
        <SectionHeader title="Integrations" subtitle="Connect services — Aira uses their APIs directly in generated code."
          badge={connected > 0 ? `${connected} connected` : undefined} badgeColor="var(--green)" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', background: 'var(--bg-2)', border: '1px solid var(--border-1)', borderRadius: 8, margin: '8px 0' }}>
          <Search size={12} strokeWidth={1.5} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search…" style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-0)', fontSize: 12, flex: 1 }} />
        </div>
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 10, scrollbarWidth: 'none' }}>
          {(['all', ...cats] as const).map(c => (
            <button key={c} onClick={() => setActiveCat(c)}
              style={{ padding: '3px 10px', borderRadius: 20, border: `1px solid ${activeCat === c ? 'var(--accent)' : 'var(--border-1)'}`, background: activeCat === c ? 'rgba(99,102,241,0.12)' : 'transparent', color: activeCat === c ? 'var(--accent)' : 'var(--text-2)', fontSize: 10, cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: activeCat === c ? 600 : 400 }}>
              {c === 'all' ? '✦ All' : CAT_LABELS[c as IntegrationCategory].split(' ').slice(1).join(' ')}
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{CAT_LABELS[cat as IntegrationCategory]}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {items.map(i => (
                <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', borderRadius: 9, border: `1px solid ${i.status === 'connected' ? `${i.color}33` : 'var(--border-1)'}`, background: i.status === 'connected' ? `${i.color}06` : 'var(--bg-2)' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 7, flexShrink: 0, background: `${i.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{i.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-0)' }}>{i.name}</span>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: i.status === 'connected' ? 'var(--green)' : i.status === 'connecting' ? 'var(--accent)' : 'var(--text-3)', flexShrink: 0, boxShadow: i.status === 'connected' ? '0 0 5px var(--green)' : 'none' }} />
                    </div>
                    <p style={{ fontSize: 10, color: 'var(--text-3)', margin: 0 }}>{i.description}</p>
                  </div>
                  {i.status === 'connected'
                    ? <button onClick={() => disconnectIntegration(i.id)} style={{ padding: '4px 9px', background: 'transparent', border: '1px solid var(--border-1)', borderRadius: 6, color: 'var(--text-3)', fontSize: 10, cursor: 'pointer', transition: 'all 0.1s', flexShrink: 0 }} onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-1)'; e.currentTarget.style.color = 'var(--text-3)'; }}>Disconnect</button>
                    : <button onClick={() => setConnecting(i)} style={{ padding: '5px 11px', background: 'var(--accent)', border: 'none', borderRadius: 7, color: 'white', fontSize: 11, fontWeight: 500, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {i.status === 'connecting' ? <><RefreshCw size={10} strokeWidth={1.5} style={{ animation: 'spin 0.8s linear infinite' }} />Connecting</> : 'Connect'}
                      </button>
                  }
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Sub-page: Memory ─────────────────────────────────────────────────────────

const TYPE_INFO: Record<MemoryType, { icon: string; color: string; label: string }> = {
  note: { icon: '📝', color: '#6366f1', label: 'Note' }, document: { icon: '📄', color: '#3b82f6', label: 'Doc' },
  snippet: { icon: '💻', color: '#10b981', label: 'Snippet' }, url: { icon: '🔗', color: '#f59e0b', label: 'URL' }, fact: { icon: '💡', color: '#8b5cf6', label: 'Fact' },
};

export function MemoryPage() {
  const { memories, addMemory, deleteMemory, activeProjectId, getMemoriesForProject } = useAppStore();
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState(''); const [content, setContent] = useState(''); const [type, setType] = useState<MemoryType>('note'); const [tags, setTags] = useState(''); const [global, setGlobal] = useState(true);
  const [query, setQuery] = useState('');

  const projectMems = activeProjectId ? getMemoriesForProject(activeProjectId) : memories;
  const filtered = projectMems.filter(m => !query || m.title.toLowerCase().includes(query.toLowerCase()) || m.content.toLowerCase().includes(query.toLowerCase()));

  const save = () => {
    if (!title.trim() || !content.trim()) return;
    addMemory({ title: title.trim(), content: content.trim(), type, tags: tags.split(',').map(t => t.trim()).filter(Boolean), projectIds: global ? [] : [activeProjectId ?? ''].filter(Boolean) });
    setTitle(''); setContent(''); setTags(''); setShowNew(false);
  };

  return (
    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SectionHeader title="Memory" subtitle="Persistent knowledge Aira recalls during every generation." badge={`${projectMems.length} entries`} action={<AddBtn onClick={() => setShowNew(v => !v)} />} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 10px', background: 'var(--bg-2)', border: '1px solid var(--border-1)', borderRadius: 8 }}>
        <Search size={11} strokeWidth={1.5} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search memories…" style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-0)', fontSize: 12, flex: 1 }} />
      </div>

      {showNew && (
        <FormCard>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-0)', marginBottom: 10 }}>Add Memory</p>
          <div style={{ marginBottom: 8 }}>
            <label style={LABEL}>Type</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {(Object.keys(TYPE_INFO) as MemoryType[]).map(t => <button key={t} onClick={() => setType(t)} style={{ padding: '3px 9px', borderRadius: 20, border: `1px solid ${type === t ? TYPE_INFO[t].color : 'var(--border-1)'}`, background: type === t ? `${TYPE_INFO[t].color}18` : 'transparent', color: type === t ? TYPE_INFO[t].color : 'var(--text-2)', fontSize: 10, cursor: 'pointer' }}>{TYPE_INFO[t].icon} {TYPE_INFO[t].label}</button>)}
            </div>
          </div>
          <FInput label="Title" value={title} onChange={setTitle} placeholder="Give this memory a name" />
          <div style={{ marginBottom: 8 }}>
            <label style={LABEL}>Content</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={3} placeholder="The information to remember…" style={{ ...INPUT, resize: 'vertical', lineHeight: 1.6 }} />
          </div>
          <FInput label="Tags (comma-separated)" value={tags} onChange={setTags} placeholder="auth, stripe, design" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <button onClick={() => setGlobal(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 7, border: `1px solid ${global ? 'rgba(99,102,241,0.4)' : 'var(--border-1)'}`, background: global ? 'rgba(99,102,241,0.1)' : 'transparent', color: global ? 'var(--accent)' : 'var(--text-2)', fontSize: 10, cursor: 'pointer' }}>
              {global ? <Globe size={10} strokeWidth={1.5} /> : <Lock size={10} strokeWidth={1.5} />}
              {global ? 'Global (all projects)' : 'This project only'}
            </button>
          </div>
          <FormActions onSave={save} onCancel={() => setShowNew(false)} disabled={!title.trim() || !content.trim()} saveLabel="Save Memory" />
        </FormCard>
      )}

      {filtered.length === 0 && !showNew && <EmptyRow msg={query ? `No memories match "${query}"` : 'No memories yet. Add knowledge Aira should always remember.'} />}

      {filtered.map(m => (
        <div key={m.id} style={{ padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border-1)', background: 'var(--bg-2)', display: 'flex', gap: 9 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0, background: `${TYPE_INFO[m.type].color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{TYPE_INFO[m.type].icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</span>
              <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: `${TYPE_INFO[m.type].color}18`, color: TYPE_INFO[m.type].color, flexShrink: 0 }}>{TYPE_INFO[m.type].label}</span>
              {m.projectIds.length === 0 ? <Globe size={9} strokeWidth={1.5} style={{ color: 'var(--text-3)', flexShrink: 0 }} /> : <Lock size={9} strokeWidth={1.5} style={{ color: 'var(--text-3)', flexShrink: 0 }} />}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-2)', margin: 0, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{m.content}</p>
            {m.tags.length > 0 && <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>{m.tags.map(t => <span key={t} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'var(--bg-3)', color: 'var(--text-3)', border: '1px solid var(--border-1)' }}>#{t}</span>)}</div>}
          </div>
          <DelBtn onClick={() => deleteMemory(m.id)} />
        </div>
      ))}
    </div>
  );
}

// ─── Sub-page: Agents ─────────────────────────────────────────────────────────

const TRIG_INFO: Record<AgentTriggerType, string> = { manual: 'Manual', cron: 'Scheduled', webhook: 'Webhook', event: 'Event' };
const STATUS_CLR: Record<string, string> = { idle: 'var(--text-3)', running: 'var(--accent)', paused: 'var(--yellow)', error: 'var(--red)', done: 'var(--green)' };
const CH_ICONS: Record<ChannelConfig['type'], React.ReactNode> = { console: <Hash size={10} />, webhook: <Webhook size={10} />, slack: <Bell size={10} />, discord: <Bell size={10} />, telegram: <Bell size={10} />, email: <Bell size={10} /> };
const CH_PLACEHOLDERS: Record<ChannelConfig['type'], string> = { console: '', webhook: 'https://hooks.example.com/...', slack: 'https://hooks.slack.com/services/...', discord: 'https://discord.com/api/webhooks/...', telegram: 'BOT_TOKEN:CHAT_ID', email: 'you@example.com' };

function AgentsPage() {
  const { agentLoops, addAgentLoop, updateAgentLoop, deleteAgentLoop, setLoopStatus, appendLoopLog, activeProjectId } = useAppStore();
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState(''); const [desc, setDesc] = useState(''); const [prompt, setPrompt] = useState(''); const [trig, setTrig] = useState<AgentTriggerType>('manual'); const [cron, setCron] = useState(''); const [maxSteps, setMaxSteps] = useState(10);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string }>>({});

  const save = () => {
    if (!name.trim()) return;
    addAgentLoop({ name: name.trim(), description: desc.trim(), systemPrompt: prompt.trim() || 'You are an autonomous agent.', skillIds: [], toolIds: [], maxSteps, triggerType: trig, cronSchedule: trig === 'cron' ? cron : undefined, status: 'idle', enabled: true, channels: [{ type: 'console', target: '', enabled: true }], projectId: activeProjectId ?? undefined, lastRunAt: undefined, lastRunResult: undefined });
    setName(''); setDesc(''); setPrompt(''); setShowNew(false);
  };

  const runNow = (l: AgentLoop) => {
    setLoopStatus(l.id, 'running');
    appendLoopLog(l.id, '▶ Manual run triggered');
    setTimeout(() => { appendLoopLog(l.id, '✓ Run complete'); setLoopStatus(l.id, 'done'); updateAgentLoop(l.id, { lastRunAt: Date.now(), lastRunResult: 'Completed' }); }, 1800);
  };

  const testChannel = async (loopId: string, ch: ChannelConfig) => {
    const key = `${loopId}-${ch.type}`;
    const result = await sendToChannel(ch, `🔔 Aira test message from loop "${agentLoops.find(l => l.id === loopId)?.name}" — ${new Date().toLocaleTimeString()}`);
    setTestResults(r => ({ ...r, [key]: { ok: result.ok, msg: result.ok ? 'Sent!' : result.error ?? 'Failed' } }));
    setTimeout(() => setTestResults(r => { const n = { ...r }; delete n[key]; return n; }), 3000);
  };

  const addChannel = (l: AgentLoop, type: ChannelConfig['type']) => {
    if (l.channels.some(c => c.type === type)) return;
    updateAgentLoop(l.id, { channels: [...l.channels, { type, target: '', enabled: true }] });
  };

  const removeChannel = (l: AgentLoop, type: ChannelConfig['type']) => {
    updateAgentLoop(l.id, { channels: l.channels.filter(c => c.type !== type) });
  };

  const updateChannelTarget = (l: AgentLoop, type: ChannelConfig['type'], target: string) => {
    updateAgentLoop(l.id, { channels: l.channels.map(c => c.type === type ? { ...c, target } : c) });
  };

  return (
    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SectionHeader title="Agents" subtitle="Autonomous loops — run on schedule, webhook, or manually. Deliver results to any channel."
        badge={agentLoops.filter(l => l.status === 'running').length > 0 ? `${agentLoops.filter(l => l.status === 'running').length} running` : undefined}
        badgeColor="var(--accent)" action={<AddBtn onClick={() => setShowNew(v => !v)} />} />

      {showNew && (
        <FormCard>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-0)', marginBottom: 10 }}>New Agent Loop</p>
          <FInput label="Name" value={name} onChange={setName} placeholder="Nightly Quality Check" />
          <FInput label="Description" value={desc} onChange={setDesc} placeholder="What does this agent do?" />
          <div style={{ marginBottom: 8 }}>
            <label style={LABEL}>Trigger</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {(Object.keys(TRIG_INFO) as AgentTriggerType[]).map(t => <button key={t} onClick={() => setTrig(t)} style={{ padding: '3px 10px', borderRadius: 20, border: `1px solid ${trig === t ? 'var(--accent)' : 'var(--border-1)'}`, background: trig === t ? 'rgba(99,102,241,0.12)' : 'transparent', color: trig === t ? 'var(--accent)' : 'var(--text-2)', fontSize: 10, cursor: 'pointer', fontWeight: trig === t ? 600 : 400 }}>{TRIG_INFO[t]}</button>)}
            </div>
          </div>
          {trig === 'cron' && <FInput label="Cron Expression" value={cron} onChange={setCron} placeholder="0 */6 * * *" mono />}
          <div style={{ marginBottom: 8 }}>
            <label style={LABEL}>System Prompt (optional)</label>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={2} style={{ ...INPUT, resize: 'vertical', lineHeight: 1.6 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <label style={{ ...LABEL, margin: 0 }}>Max Steps:</label>
            <input type="number" value={maxSteps} onChange={e => setMaxSteps(Number(e.target.value))} min={1} max={50} style={{ ...INPUT, width: 70 }} />
          </div>
          <FormActions onSave={save} onCancel={() => setShowNew(false)} disabled={!name.trim()} saveLabel="Create Loop" />
        </FormCard>
      )}

      {agentLoops.length === 0 && !showNew && <EmptyRow msg="No agent loops yet. Create one to run autonomous tasks on a schedule or webhook." />}

      {agentLoops.map(l => (
        <div key={l.id} style={{ borderRadius: 9, overflow: 'hidden', border: '1px solid var(--border-1)', background: 'var(--bg-2)' }}>
          <div style={{ padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 32, height: 32, borderRadius: 7, flexShrink: 0, background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <Bot size={15} strokeWidth={1.5} style={{ color: 'var(--text-2)' }} />
              <div style={{ position: 'absolute', bottom: -2, right: -2, width: 8, height: 8, borderRadius: '50%', background: STATUS_CLR[l.status], border: '1.5px solid var(--bg-2)', boxShadow: l.status === 'running' ? `0 0 6px ${STATUS_CLR[l.status]}` : 'none' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 1 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-0)' }}>{l.name}</span>
                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'var(--bg-3)', color: 'var(--text-2)', border: '1px solid var(--border-1)' }}>{TRIG_INFO[l.triggerType]}</span>
                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, color: STATUS_CLR[l.status], border: `1px solid ${STATUS_CLR[l.status]}44`, background: `${STATUS_CLR[l.status]}11` }}>{l.status}</span>
              </div>
              <p style={{ fontSize: 10, color: 'var(--text-3)', margin: 0 }}>{l.description || l.systemPrompt.slice(0, 60)}</p>
            </div>
            <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
              <button onClick={() => runNow(l)} disabled={l.status === 'running'} title="Run now" style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'rgba(99,102,241,0.15)', color: 'var(--accent)', cursor: l.status === 'running' ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: l.status === 'running' ? 0.5 : 1 }}>
                <Play size={10} strokeWidth={2} />
              </button>
              <button onClick={() => setExpanded(expanded === l.id ? null : l.id)} style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {expanded === l.id ? <ChevronDown size={13} strokeWidth={1.5} /> : <ChevronRight size={13} strokeWidth={1.5} />}
              </button>
              <DelBtn onClick={() => deleteAgentLoop(l.id)} />
            </div>
          </div>

          {expanded === l.id && (
            <div style={{ borderTop: '1px solid var(--border-0)', background: 'var(--bg-1)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* System prompt */}
              <div>
                <label style={LABEL}>System Prompt</label>
                <textarea value={l.systemPrompt} onChange={e => updateAgentLoop(l.id, { systemPrompt: e.target.value })} rows={3} style={{ ...INPUT, resize: 'vertical', background: 'var(--bg-2)' }} />
              </div>

              {l.triggerType === 'cron' && (
                <div>
                  <label style={LABEL}>Cron Schedule</label>
                  <input value={l.cronSchedule ?? ''} onChange={e => updateAgentLoop(l.id, { cronSchedule: e.target.value })} placeholder="0 */6 * * *" style={{ ...INPUT, fontFamily: 'monospace', fontSize: 11, background: 'var(--bg-2)' }} />
                </div>
              )}
              {l.triggerType === 'webhook' && (
                <div style={{ padding: '8px 10px', background: 'var(--bg-2)', borderRadius: 7, border: '1px solid var(--border-1)' }}>
                  <p style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 3 }}>POST to this endpoint to trigger:</p>
                  <code style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'monospace' }}>/api/agent-loop/{l.id}/trigger</code>
                </div>
              )}

              <div>
                <label style={LABEL}>Max Steps</label>
                <input type="number" value={l.maxSteps} onChange={e => updateAgentLoop(l.id, { maxSteps: Number(e.target.value) })} min={1} max={50} style={{ ...INPUT, width: 70, background: 'var(--bg-2)' }} />
              </div>

              {/* ── Channels (real integration) ── */}
              <div>
                <label style={LABEL}>Delivery Channels</label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                  {(['console', 'webhook', 'slack', 'discord', 'telegram', 'email'] as ChannelConfig['type'][]).map(ch => {
                    const active = l.channels.some(c => c.type === ch);
                    return (
                      <button key={ch} onClick={() => active ? removeChannel(l, ch) : addChannel(l, ch)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, border: `1px solid ${active ? 'var(--accent)' : 'var(--border-1)'}`, background: active ? 'rgba(99,102,241,0.12)' : 'transparent', color: active ? 'var(--accent)' : 'var(--text-2)', fontSize: 10, cursor: 'pointer', fontWeight: active ? 600 : 400 }}>
                        {CH_ICONS[ch]}{ch}
                      </button>
                    );
                  })}
                </div>

                {/* Per-channel target + test button */}
                {l.channels.filter(c => c.type !== 'console').map(ch => {
                  const testKey = `${l.id}-${ch.type}`;
                  const testRes = testResults[testKey];
                  return (
                    <div key={ch.type} style={{ marginBottom: 6 }}>
                      <label style={{ ...LABEL, textTransform: 'none', fontSize: 10, letterSpacing: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {CH_ICONS[ch.type]} {ch.type} target
                      </label>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <input value={ch.target} onChange={e => updateChannelTarget(l, ch.type, e.target.value)}
                          placeholder={CH_PLACEHOLDERS[ch.type]}
                          style={{ ...INPUT, flex: 1, fontFamily: 'monospace', fontSize: 10, background: 'var(--bg-2)', padding: '5px 8px' }} />
                        <button
                          onClick={() => testChannel(l.id, ch)}
                          disabled={!ch.target.trim()}
                          title="Send test message"
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4, padding: '5px 9px',
                            background: testRes ? (testRes.ok ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)') : 'var(--bg-3)',
                            border: `1px solid ${testRes ? (testRes.ok ? 'var(--green)' : 'var(--red)') : 'var(--border-1)'}`,
                            borderRadius: 6, color: testRes ? (testRes.ok ? 'var(--green)' : 'var(--red)') : 'var(--text-2)',
                            fontSize: 10, cursor: ch.target.trim() ? 'pointer' : 'not-allowed', opacity: ch.target.trim() ? 1 : 0.5,
                            whiteSpace: 'nowrap', flexShrink: 0,
                          }}>
                          {testRes
                            ? (testRes.ok ? <><Check size={9} strokeWidth={2} />{testRes.msg}</> : <><X size={9} strokeWidth={2} />{testRes.msg}</>)
                            : <><Send size={9} strokeWidth={1.5} />Test</>
                          }
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Run logs */}
              {l.runLogs.length > 0 && (
                <div style={{ borderRadius: 7, overflow: 'hidden', border: '1px solid var(--border-1)' }}>
                  <div style={{ padding: '4px 8px', background: 'var(--bg-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Run Logs</span>
                    <button onClick={() => updateAgentLoop(l.id, { runLogs: [] })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 9, color: 'var(--text-3)' }}>Clear</button>
                  </div>
                  <div style={{ maxHeight: 120, overflowY: 'auto', padding: '6px 8px', background: 'var(--bg-0)' }}>
                    {l.runLogs.slice(-30).map((line, i) => <div key={i} style={{ fontSize: 10, color: 'var(--text-2)', fontFamily: 'monospace', lineHeight: 1.7 }}>{line}</div>)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Channel Bridges Page ─────────────────────────────────────────────────────

const BRIDGE_PRESETS: { type: BridgeType; label: string; icon: string; color: string; hint: string; tokenLabel: string; tokenPlaceholder: string; chatLabel?: string; chatPlaceholder?: string }[] = [
  { type: 'telegram', label: 'Telegram', icon: '✈️', color: '#2AABEE', hint: 'Create a bot via @BotFather, then get your Chat ID from @userinfobot.', tokenLabel: 'Bot Token', tokenPlaceholder: '123456789:AAF...', chatLabel: 'Chat ID', chatPlaceholder: '123456789' },
  { type: 'discord',  label: 'Discord',  icon: '🎮', color: '#5865F2', hint: 'Create a webhook in your Discord channel settings → Integrations → Webhooks.', tokenLabel: 'Webhook URL', tokenPlaceholder: 'https://discord.com/api/webhooks/...' },
  { type: 'slack',    label: 'Slack',    icon: '💬', color: '#4A154B', hint: 'Create an incoming webhook at api.slack.com/apps → Incoming Webhooks.', tokenLabel: 'Webhook URL', tokenPlaceholder: 'https://hooks.slack.com/services/...' },
  { type: 'webhook',  label: 'Webhook',  icon: '🔗', color: '#6366f1', hint: 'Any HTTP POST endpoint. Aira sends JSON with { text, source, timestamp }.', tokenLabel: 'Endpoint URL', tokenPlaceholder: 'https://your-server.com/aira-webhook' },
];

export function ChannelBridgesPage() {
  const { channelBridges, addChannelBridge, updateChannelBridge, deleteChannelBridge, agentLoops } = useAppStore();
  const [adding, setAdding] = useState(false);
  const [addType, setAddType] = useState<BridgeType>('telegram');
  const [addName, setAddName] = useState('');
  const [addToken, setAddToken] = useState('');
  const [addChatId, setAddChatId] = useState('');
  const [addIncoming, setAddIncoming] = useState(true);
  const [addOutgoing, setAddOutgoing] = useState(true);
  const [addScreenshots, setAddScreenshots] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; msg: string }>>({});

  const preset = BRIDGE_PRESETS.find(p => p.type === addType)!;

  const verifyTelegram = async () => {
    if (!addToken) return;
    setVerifying(true);
    setVerifyResult(null);
    const r = await telegramGetMe(addToken);
    setVerifyResult(r.ok ? { ok: true, msg: `Connected as @${r.username}` } : { ok: false, msg: r.error ?? 'Failed' });
    setVerifying(false);
  };

  const saveBridge = () => {
    if (!addToken) return;
    addChannelBridge({
      type: addType,
      name: addName || preset.label,
      token: addToken,
      chatId: addChatId || undefined,
      incomingEnabled: addIncoming,
      outgoingEnabled: addOutgoing,
      screenshotsEnabled: addScreenshots,
      lastUpdateId: undefined,
    });
    setAdding(false);
    setAddToken(''); setAddChatId(''); setAddName('');
    setVerifyResult(null);
  };

  const activateBridge = async (b: ChannelBridge) => {
    if (b.type === 'telegram') {
      updateChannelBridge(b.id, { status: 'connecting' });
      const r = await telegramGetMe(b.token);
      updateChannelBridge(b.id, { status: r.ok ? 'active' : 'error', error: r.ok ? undefined : r.error });
    } else {
      // For webhooks/discord/slack just mark active — no verification possible without server
      updateChannelBridge(b.id, { status: b.status === 'active' ? 'disconnected' : 'active' });
    }
  };

  const sendTestMsg = async (b: ChannelBridge) => {
    setTestingId(b.id);
    const { bridgeSendMessage } = await import('../../lib/channelBridge');
    const ok = await bridgeSendMessage({ ...b, status: 'active' }, `🔔 Aira test — ${new Date().toLocaleTimeString()}. Channel bridge is working!`);
    setTestResult(prev => ({ ...prev, [b.id]: { ok, msg: ok ? 'Sent ✓' : 'Failed ✗' } }));
    setTestingId(null);
    setTimeout(() => setTestResult(prev => { const n = { ...prev }; delete n[b.id]; return n; }), 3000);
  };

  const STATUS_COLOR: Record<ChannelBridge['status'], string> = {
    disconnected: 'var(--text-3)',
    connecting:   'var(--yellow)',
    active:       '#4ade80',
    error:        'var(--red)',
  };

  return (
    <Section>
      <SectionHeader title="Channel Bridges" action={!adding && <AddBtn onClick={() => { setAdding(true); setAddType('telegram'); }} />} />

      {/* How it works */}
      <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', marginBottom: 14, fontSize: 11, color: 'var(--text-2)', lineHeight: 1.7 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: 'var(--accent)', fontWeight: 600 }}>
          <Radio size={11} /> Connect Aira to your messaging apps
        </div>
        Chat with Aira from <strong style={{ color: 'var(--text-1)' }}>Telegram, Discord, Slack</strong> or any webhook — bidirectionally. Messages you send arrive in the chatbox. Aira's responses are delivered back. Works from mobile.
      </div>

      {/* Add form */}
      {adding && (
        <FormCard>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-0)', marginBottom: 12 }}>Add Channel Bridge</p>

          {/* Bridge type selector */}
          <div style={{ display: 'flex', gap: 5, marginBottom: 12, flexWrap: 'wrap' }}>
            {BRIDGE_PRESETS.map(p => (
              <button key={p.type} onClick={() => { setAddType(p.type); setVerifyResult(null); }}
                style={{ padding: '5px 10px', borderRadius: 7, fontSize: 12, cursor: 'pointer', border: `1px solid ${addType === p.type ? p.color + '80' : 'var(--border-1)'}`, background: addType === p.type ? p.color + '15' : 'var(--bg-1)', color: addType === p.type ? p.color : 'var(--text-2)', fontWeight: addType === p.type ? 600 : 400, transition: 'all 0.1s' }}>
                {p.icon} {p.label}
              </button>
            ))}
          </div>

          <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 12, lineHeight: 1.6 }}>{preset.hint}</p>

          <FInput label="Name (optional)" value={addName} onChange={setAddName} placeholder={preset.label} />
          <div style={{ marginTop: 8 }}>
            <FInput label={preset.tokenLabel} value={addToken} onChange={setAddToken} placeholder={preset.tokenPlaceholder} mono />
          </div>
          {preset.chatLabel && (
            <div style={{ marginTop: 8 }}>
              <FInput label={preset.chatLabel} value={addChatId} onChange={setAddChatId} placeholder={preset.chatPlaceholder ?? ''} mono />
            </div>
          )}

          {/* Verify Telegram */}
          {addType === 'telegram' && addToken && (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={verifyTelegram} disabled={verifying}
                style={{ padding: '5px 12px', borderRadius: 7, background: 'var(--bg-3)', border: '1px solid var(--border-1)', color: 'var(--text-1)', fontSize: 11, cursor: verifying ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                {verifying ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={10} />}
                Verify Bot
              </button>
              {verifyResult && (
                <span style={{ fontSize: 11, color: verifyResult.ok ? '#4ade80' : 'var(--red)' }}>
                  {verifyResult.ok ? '✓' : '✗'} {verifyResult.msg}
                </span>
              )}
            </div>
          )}

          {/* Toggles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '12px 0 14px' }}>
            {([['incomingEnabled', addIncoming, setAddIncoming, '📩 Receive incoming messages (chat to Aira via channel)'],
               ['outgoingEnabled', addOutgoing, setAddOutgoing, '📤 Send Aira responses to channel'],
               ['screenshotsEnabled', addScreenshots, setAddScreenshots, '📸 Send preview screenshots when ready']] as const).map(([_k, val, setter, label]) => (
              <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 11, color: 'var(--text-1)' }}>
                <button onClick={() => setter(!val)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: val ? 'var(--accent)' : 'var(--text-3)', display: 'flex' }}>
                  {val ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                </button>
                {label}
              </label>
            ))}
          </div>

          <FormActions onSave={saveBridge} onCancel={() => { setAdding(false); setVerifyResult(null); }} disabled={!addToken} saveLabel="Add Bridge" />
        </FormCard>
      )}

      {/* Bridge list */}
      {channelBridges.length === 0 && !adding && (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📡</div>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', marginBottom: 4 }}>No channels connected</p>
          <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Connect Telegram, Discord, or Slack to chat with Aira from mobile</p>
        </div>
      )}

      {channelBridges.map(b => {
        const p = BRIDGE_PRESETS.find(x => x.type === b.type)!;
        const tr = testResult[b.id];
        return (
          <Row key={b.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>{p.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-0)' }}>{b.name}</span>
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: p.color + '18', color: p.color }}>{p.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS_COLOR[b.status] }} />
                  <span style={{ fontSize: 10, color: STATUS_COLOR[b.status] }}>{b.status}</span>
                  {b.error && <span style={{ fontSize: 10, color: 'var(--red)' }}>— {b.error}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                {/* Test */}
                <button onClick={() => sendTestMsg(b)} disabled={testingId === b.id}
                  title="Send test message"
                  style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-1)', background: 'var(--bg-1)', color: tr ? (tr.ok ? '#4ade80' : 'var(--red)') : 'var(--text-2)', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {testingId === b.id ? <Loader2 size={9} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={9} />}
                  {tr ? tr.msg : 'Test'}
                </button>
                {/* Connect/Disconnect */}
                <button onClick={() => activateBridge(b)}
                  style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-1)', background: b.status === 'active' ? 'rgba(34,197,94,0.1)' : 'var(--bg-1)', color: b.status === 'active' ? '#4ade80' : 'var(--text-2)', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {b.status === 'connecting' ? <Loader2 size={9} style={{ animation: 'spin 1s linear infinite' }} /> : b.status === 'active' ? <Radio size={9} /> : <Radio size={9} />}
                  {b.status === 'active' ? 'Live' : b.status === 'connecting' ? 'Connecting…' : 'Connect'}
                </button>
                <DelBtn onClick={() => deleteChannelBridge(b.id)} />
              </div>
            </div>

            {/* Capabilities row */}
            <div style={{ display: 'flex', gap: 8, paddingLeft: 2 }}>
              {[
                [b.incomingEnabled, '📩 Incoming', (v: boolean) => updateChannelBridge(b.id, { incomingEnabled: v })],
                [b.outgoingEnabled, '📤 Outgoing', (v: boolean) => updateChannelBridge(b.id, { outgoingEnabled: v })],
                [b.screenshotsEnabled, '📸 Screenshots', (v: boolean) => updateChannelBridge(b.id, { screenshotsEnabled: v })],
              ].map(([enabled, label, toggle]) => (
                <button key={label as string} onClick={() => (toggle as (v: boolean) => void)(!(enabled as boolean))}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, border: `1px solid ${enabled ? 'var(--accent-border)' : 'var(--border-1)'}`, background: enabled ? 'var(--accent-subtle)' : 'transparent', color: enabled ? 'var(--accent-hover)' : 'var(--text-3)', fontSize: 10, cursor: 'pointer' }}>
                  {label as string}
                </button>
              ))}
            </div>
          </Row>
        );
      })}

      {/* Agent loops section — informational */}
      {agentLoops.length > 0 && (
        <>
          <div style={{ marginTop: 20, marginBottom: 10 }}>
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-3)' }}>AI-Created Agents</p>
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3, lineHeight: 1.5 }}>Aira automatically creates and manages these agent loops during complex builds.</p>
          </div>
          {agentLoops.map(l => (
            <Row key={l.id} style={{ gap: 10 }}>
              <Bot size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-0)' }}>{l.name}</span>
                <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>{l.triggerType} · {l.status}</p>
              </div>
              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: l.status === 'running' ? 'rgba(99,102,241,0.15)' : 'var(--bg-3)', color: l.status === 'running' ? 'var(--accent)' : 'var(--text-3)' }}>
                {l.status}
              </span>
            </Row>
          ))}
        </>
      )}
    </Section>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function EmptyState({ msg }: { msg: string }) {
  return <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ fontSize: 12, color: 'var(--text-3)' }}>{msg}</p></div>;
}
function EmptyRow({ msg }: { msg: string }) {
  return <p style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', padding: '16px 0' }}>{msg}</p>;
}
function EmptyWithTemplates({ label, items }: { label: string; items: { icon?: string; name: string; desc: string; onClick: () => void }[] }) {
  return (
    <div style={{ textAlign: 'center', paddingTop: 24 }}>
      <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 12 }}>{label}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {items.map(i => (
          <button key={i.name} onClick={i.onClick} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', background: 'var(--bg-2)', border: '1px solid var(--border-1)', borderRadius: 8, cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.borderColor = 'var(--border-2)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-2)'; e.currentTarget.style.borderColor = 'var(--border-1)'; }}>
            {i.icon && <span style={{ fontSize: 16 }}>{i.icon}</span>}
            <div><div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-0)' }}>{i.name}</div><div style={{ fontSize: 10, color: 'var(--text-3)' }}>{i.desc.slice(0, 55)}…</div></div>
          </button>
        ))}
      </div>
    </div>
  );
}
function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{title}</p>
        {action}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>{children}</div>
    </div>
  );
}
function SectionHeader({ title, subtitle, badge, badgeColor, action }: { title: string; subtitle?: string; badge?: string; badgeColor?: string; action?: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: badge || subtitle ? 4 : 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-0)' }}>{title}</span>
        {badge && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: badgeColor ? `${badgeColor}20` : 'var(--bg-3)', color: badgeColor ?? 'var(--text-2)', fontWeight: 600 }}>{badge}</span>}
        {action && <div style={{ marginLeft: 'auto' }}>{action}</div>}
      </div>
      {subtitle && <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>{subtitle}</p>}
    </div>
  );
}
function Row({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>{left}{right}</div>;
}
function AddBtn({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', background: 'var(--accent)', border: 'none', borderRadius: 6, color: 'white', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}><Plus size={10} strokeWidth={2} />New</button>;
}
function DelBtn({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-3)', display: 'flex', transition: 'color 0.1s', flexShrink: 0 }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}><Trash2 size={12} strokeWidth={1.5} /></button>;
}
function FormCard({ children }: { children: React.ReactNode }) {
  return <div style={{ borderRadius: 9, border: '1px solid var(--accent-border)', background: 'rgba(99,102,241,0.04)', padding: 13 }}>{children}</div>;
}
function FInput({ label, value, onChange, placeholder, mono }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={LABEL}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ ...INPUT, ...(mono ? { fontFamily: 'monospace', fontSize: 11 } : {}) }} />
    </div>
  );
}
function FormActions({ onSave, onCancel, disabled, saveLabel }: { onSave: () => void; onCancel: () => void; disabled?: boolean; saveLabel: string }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <button onClick={onSave} disabled={disabled} style={{ flex: 1, padding: '7px 0', background: 'var(--accent)', border: 'none', borderRadius: 7, color: 'white', fontSize: 12, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>{saveLabel}</button>
      <button onClick={onCancel} style={{ padding: '7px 14px', background: 'transparent', border: '1px solid var(--border-1)', borderRadius: 7, color: 'var(--text-2)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
    </div>
  );
}

// ─── Main Settings Panel with sub-tabs ───────────────────────────────────────

// ─── Project Settings Panel (project-scoped only) ─────────────────────────────

export function ProjectSettingsPanel() {
  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--bg-0)' }}>
      <ProjectInfoPage />
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
