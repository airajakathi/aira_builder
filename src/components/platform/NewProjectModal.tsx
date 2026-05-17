import { useState, useRef } from 'react';
import {
  X, ArrowRight, ArrowLeft, Check, Loader2,
  Globe, Smartphone, Monitor, Puzzle, Server, Zap,
  Database, Lock, CreditCard, Bot, Mail, BarChart2,
  MapPin, Search, Bell, Link2, Cpu, Plus, Trash2,
} from 'lucide-react';
import { PLATFORM_CONFIGS } from '../../lib/platforms';
import type { Platform, BackendType, StackConfig, RequiredService, HostingTarget, ServiceCategory } from '../../types';
import { useAppStore } from '../../store';

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_ORDER: Platform[] = ['web', 'fullstack', 'ios', 'android', 'desktop', 'extension', 'api'];

const BACKEND_OPTIONS: { id: BackendType; label: string; detail: string }[] = [
  { id: 'none',     label: 'None',     detail: 'Static frontend only, no server' },
  { id: 'single',   label: 'Single',   detail: 'One API or BaaS for everything' },
  { id: 'multiple', label: 'Multiple', detail: 'Separate services per platform' },
  { id: 'hybrid',   label: 'Hybrid',   detail: 'BaaS + custom API combined' },
];

const STARTERS = [
  'E-commerce store with payments & inventory',
  'Real-time chat application with rooms',
  'SaaS subscription platform with dashboard',
  'Food delivery app with maps & tracking',
  'AI-powered notes & knowledge base',
  'NFT marketplace on blockchain',
  'Healthcare patient management system',
  'Multi-tenant project management tool',
];

const HOSTING_OPTIONS: { id: HostingTarget; label: string; icon: string; detail: string; tags: string[] }[] = [
  { id: 'vercel',       label: 'Vercel',       icon: '▲', detail: 'Best for Next.js & React',          tags: ['web', 'frontend', 'serverless'] },
  { id: 'netlify',      label: 'Netlify',      icon: '◆', detail: 'Simple static & functions',         tags: ['web', 'frontend', 'simple'] },
  { id: 'firebase',     label: 'Firebase',     icon: '🔥', detail: 'Google all-in-one BaaS',            tags: ['mobile', 'realtime', 'auth'] },
  { id: 'supabase',     label: 'Supabase',     icon: '⚡', detail: 'Postgres + Auth + Storage',         tags: ['backend', 'database', 'open-source'] },
  { id: 'railway',      label: 'Railway',      icon: '🚂', detail: 'Simple backend deployments',        tags: ['backend', 'api', 'simple'] },
  { id: 'fly',          label: 'Fly.io',       icon: '🪁', detail: 'Global edge deployments',           tags: ['backend', 'edge', 'docker'] },
  { id: 'aws',          label: 'AWS',          icon: '☁️', detail: 'Enterprise-grade cloud',            tags: ['enterprise', 'scalable', 'complex'] },
  { id: 'gcp',          label: 'Google Cloud', icon: '🌤️', detail: 'Google infrastructure',             tags: ['enterprise', 'ai', 'bigdata'] },
  { id: 'cloudflare',   label: 'Cloudflare',   icon: '🟠', detail: 'Edge workers & Pages',              tags: ['edge', 'fast', 'cdn'] },
  { id: 'icp',          label: 'ICP',          icon: '∞', detail: 'Decentralized Internet Computer',   tags: ['blockchain', 'web3', 'decentralized'] },
  { id: 'solana',       label: 'Solana',       icon: '◎', detail: 'Solana blockchain deploy',          tags: ['blockchain', 'nft', 'defi'] },
  { id: 'docker-self',  label: 'Self-hosted',  icon: '🐳', detail: 'Docker on your own server',        tags: ['custom', 'privacy', 'control'] },
];

const SERVICE_ICONS: Record<ServiceCategory, React.ReactNode> = {
  auth:       <Lock size={12} />,
  database:   <Database size={12} />,
  storage:    <Server size={12} />,
  payments:   <CreditCard size={12} />,
  maps:       <MapPin size={12} />,
  ai:         <Bot size={12} />,
  email:      <Mail size={12} />,
  sms:        <Smartphone size={12} />,
  analytics:  <BarChart2 size={12} />,
  cdn:        <Globe size={12} />,
  search:     <Search size={12} />,
  push:       <Bell size={12} />,
  blockchain: <Link2 size={12} />,
  custom:     <Cpu size={12} />,
};

const PLATFORM_ICONS_JSX: Record<Platform, React.ReactNode> = {
  web:       <Globe size={14} />,
  fullstack: <Zap size={14} />,
  ios:       <Smartphone size={14} />,
  android:   <Smartphone size={14} />,
  desktop:   <Monitor size={14} />,
  extension: <Puzzle size={14} />,
  api:       <Server size={14} />,
};

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'idea' | 'platform' | 'backend' | 'stack' | 'services';

interface AnalysisResult {
  language: string;
  frameworks: string[];
  frontendHosting: HostingTarget;
  backendHosting: HostingTarget;
  services: RequiredService[];
  summary: string;
  reasoning: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildAnalysisPrompt(
  idea: string,
  platforms: Platform[],
  backendType: BackendType,
): string {
  return `You are a senior software architect. Analyze this project idea and return a JSON object.

PROJECT IDEA: "${idea}"
PLATFORMS: ${platforms.join(', ')}
BACKEND TYPE: ${backendType}

Return ONLY a valid JSON object (no markdown, no commentary) with this exact shape:
{
  "language": "TypeScript",
  "frameworks": ["Next.js 14", "Prisma", "tRPC"],
  "frontendHosting": "vercel",
  "backendHosting": "railway",
  "summary": "2-3 sentence architecture overview",
  "reasoning": "1-2 sentence justification for these choices",
  "services": [
    {
      "id": "maps-google",
      "name": "Google Maps",
      "category": "maps",
      "reason": "Required for location-based features",
      "envKey": "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
      "url": "https://console.cloud.google.com/apis/library/maps-backend.googleapis.com",
      "required": true,
      "icon": "🗺️"
    }
  ]
}

Rules:
- frontendHosting must be one of: vercel, netlify, firebase, supabase, railway, fly, aws, gcp, cloudflare, icp, solana, docker-self
- backendHosting same list
- Only include services that are genuinely needed for the described idea (0-8 services)
- service categories: auth, database, storage, payments, maps, ai, email, sms, analytics, cdn, search, push, blockchain, custom
- Choose the best modern stack that fits the platforms and idea
- For blockchain/web3 ideas use icp or solana hosting
- For mobile (ios/android) prefer firebase or supabase`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepDot({ active, done }: { active: boolean; done: boolean }) {
  return (
    <div style={{
      width: active ? 20 : done ? 16 : 6,
      height: 6, borderRadius: 99,
      background: done || active ? 'var(--accent)' : 'var(--border-2)',
      transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
    }} />
  );
}

function Btn({
  onClick, disabled, variant = 'primary', children, style: extra,
}: {
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost';
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: variant === 'ghost' ? 1 : 2,
        padding: '10px 16px', borderRadius: 10, border: 'none',
        background: variant === 'ghost'
          ? 'transparent'
          : disabled ? 'var(--bg-3)' : 'var(--accent)',
        color: variant === 'ghost'
          ? 'var(--text-1)'
          : disabled ? 'var(--text-3)' : 'white',
        fontSize: 13, fontWeight: 500,
        cursor: disabled ? 'default' : 'pointer',
        transition: 'opacity 0.1s',
        outline: variant === 'ghost' ? '1px solid var(--border-1)' : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        ...extra,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.opacity = '0.85'; }}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
    >
      {children}
    </button>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function NewProjectModal({ onClose }: { onClose: () => void }) {
  const { createProject, addMessage, provider, apiKey, customApiKey, customBaseUrl, customModel } = useAppStore();

  const [step, setStep] = useState<Step>('idea');
  const [name, setName] = useState('');
  const [idea, setIdea] = useState('');
  const [platforms, setPlatforms] = useState<Platform[]>(['web']);
  const [backendType, setBackendType] = useState<BackendType>('single');
  const [stackResult, setStackResult] = useState<AnalysisResult | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const steps: Step[] = ['idea', 'platform', 'backend', 'stack', 'services'];
  const stepIndex = steps.indexOf(step);

  const togglePlatform = (p: Platform) =>
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  // ── AI Analysis ────────────────────────────────────────────────────────────

  const analyse = async () => {
    setAnalysing(true);
    setAnalysisError('');
    abortRef.current = new AbortController();

    try {
      const prompt = buildAnalysisPrompt(idea || name, platforms, backendType);

      let rawJson = '';

      if (provider === 'anthropic' && apiKey) {
        const { default: Anthropic } = await import('@anthropic-ai/sdk');
        const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
        const msg = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1200,
          messages: [{ role: 'user', content: prompt }],
        });
        rawJson = (msg.content[0] as { text: string }).text;
      } else if (provider === 'openai-compatible' && customApiKey && customBaseUrl) {
        const baseURL = customBaseUrl.replace(/\/$/, '');
        const res = await fetch('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetUrl: `${baseURL}/chat/completions`,
            method: 'POST',
            headers: { Authorization: `Bearer ${customApiKey}` },
            body: JSON.stringify({
              model: customModel || 'gpt-4o-mini',
              max_tokens: 1200,
              messages: [{ role: 'user', content: prompt }],
            }),
          }),
          signal: abortRef.current.signal,
        });
        const data = await res.json() as { choices?: { message: { content: string } }[]; error?: { message: string } };
        if (data.error) throw new Error(data.error.message);
        rawJson = data.choices?.[0]?.message.content ?? '';
      } else {
        // No API key — use smart defaults
        throw new Error('NO_KEY');
      }

      // Parse JSON (strip markdown fences if present)
      const cleaned = rawJson.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned) as AnalysisResult;
      setStackResult(parsed);
      setStep('stack');
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;

      // Fall back to smart defaults based on platforms/backend
      const isMobile = platforms.some(p => ['ios', 'android'].includes(p));
      const isBlockchain = idea.toLowerCase().match(/nft|blockchain|defi|solana|icp|web3|crypto|token/);
      const needsPayments = idea.toLowerCase().match(/payment|stripe|subscription|shop|store|buy|sell|checkout/);
      const needsMaps = idea.toLowerCase().match(/map|location|gps|track|delivery|nearby|route/);
      const needsAI = idea.toLowerCase().match(/ai|gpt|claude|llm|chat|generate|image|voice/);
      const needsEmail = idea.toLowerCase().match(/email|newsletter|notification|invite|reset/);

      const services: RequiredService[] = [];
      if (needsPayments) services.push({ id: 'stripe', name: 'Stripe', category: 'payments', reason: 'Payment processing', envKey: 'STRIPE_SECRET_KEY', url: 'https://stripe.com', required: true, icon: '💳' });
      if (needsMaps) services.push({ id: 'google-maps', name: 'Google Maps', category: 'maps', reason: 'Location features', envKey: 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', url: 'https://console.cloud.google.com', required: true, icon: '🗺️' });
      if (needsAI) services.push({ id: 'openai', name: 'OpenAI', category: 'ai', reason: 'AI/LLM features', envKey: 'OPENAI_API_KEY', url: 'https://platform.openai.com', required: true, icon: '🤖' });
      if (needsEmail) services.push({ id: 'resend', name: 'Resend', category: 'email', reason: 'Email delivery', envKey: 'RESEND_API_KEY', url: 'https://resend.com', required: false, icon: '📧' });

      const defaults: AnalysisResult = {
        language: 'TypeScript',
        frameworks: isMobile
          ? ['React Native + Expo', 'Supabase']
          : isBlockchain
            ? ['SvelteKit', 'Internet Computer SDK']
            : backendType === 'none'
              ? ['React + Vite', 'Tailwind CSS']
              : ['Next.js 14', 'Prisma', 'PostgreSQL'],
        frontendHosting: isMobile ? 'firebase' : isBlockchain ? 'icp' : 'vercel',
        backendHosting: isMobile ? 'firebase' : isBlockchain ? 'icp' : backendType === 'none' ? 'vercel' : 'railway',
        services,
        summary: `A ${platforms.join('/')} application built with TypeScript. Uses modern tooling and best practices for the selected platforms.`,
        reasoning: 'Selected based on platform requirements and project type.',
      };
      setStackResult(defaults);
      setStep('stack');
    } finally {
      setAnalysing(false);
    }
  };

  // ── Create Project ─────────────────────────────────────────────────────────

  const handleCreate = () => {
    if (!name.trim()) return;

    const stackConfig = stackResult ? {
      language: stackResult.language,
      frameworks: stackResult.frameworks,
      frontendHosting: stackResult.frontendHosting,
      backendHosting: stackResult.backendHosting,
      services: stackResult.services,
      summary: stackResult.summary,
      confirmed: true,
    } : undefined;

    const project = createProject(name.trim(), platforms, backendType, idea.trim(), stackConfig);

    // First message = project brief to kick off generation
    const briefMessage = [
      idea.trim() ? `**Project:** ${idea.trim()}` : `**Project:** ${name.trim()}`,
      stackResult ? `\n**Stack:** ${stackResult.frameworks.join(' · ')} · ${stackResult.language}` : '',
      stackResult?.services.length ? `\n**Services needed:** ${stackResult.services.map(s => s.name).join(', ')}` : '',
      stackResult ? `\n**Deploy:** Frontend on ${stackResult.frontendHosting}${backendType !== 'none' ? ` · Backend on ${stackResult.backendHosting}` : ''}` : '',
      '\n\nPlease analyse the project context, create the full architecture, write the complete file structure and code, install dependencies, and start the development server.',
    ].filter(Boolean).join('');

    addMessage(project.id, {
      id: crypto.randomUUID(),
      role: 'user',
      content: briefMessage,
      timestamp: Date.now(),
    });

    onClose();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px 12px', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(20px)',
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="anim-fade-up"
        style={{
          width: '100%', maxWidth: step === 'stack' || step === 'services' ? 640 : step === 'platform' ? 600 : 520,
          borderRadius: 20, overflow: 'hidden',
          background: 'var(--bg-2)', border: '1px solid var(--border-1)',
          boxShadow: 'var(--shadow-float)',
          transition: 'max-width 0.3s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {steps.map((s, i) => (
                <StepDot key={s} active={s === step} done={i < stepIndex} />
              ))}
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{stepIndex + 1} / {steps.length}</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', display: 'flex', padding: 4, borderRadius: 6 }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-0)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-2)')}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div style={{ padding: '20px 24px 24px', minHeight: 380, display: 'flex', flexDirection: 'column' }}>

          {/* ── Step 1: Idea ─────────────────────────────────────────── */}
          {step === 'idea' && (
            <IdeaStep
              name={name} setName={setName}
              idea={idea} setIdea={setIdea}
              onNext={() => name.trim() && setStep('platform')}
            />
          )}

          {/* ── Step 2: Platform ─────────────────────────────────────── */}
          {step === 'platform' && (
            <PlatformStep
              platforms={platforms} toggle={togglePlatform}
              onBack={() => setStep('idea')}
              onNext={() => platforms.length > 0 && setStep('backend')}
            />
          )}

          {/* ── Step 3: Backend ──────────────────────────────────────── */}
          {step === 'backend' && (
            <BackendStep
              backendType={backendType} setBackendType={setBackendType}
              onBack={() => setStep('platform')}
              onNext={() => {
                analyse();
                setStep('stack'); // show loading immediately
              }}
              analysing={analysing}
            />
          )}

          {/* ── Step 4: Stack Analysis ───────────────────────────────── */}
          {step === 'stack' && (
            <StackStep
              analysing={analysing}
              result={stackResult}
              error={analysisError}
              onBack={() => setStep('backend')}
              onEdit={(updated) => setStackResult(updated)}
              onNext={() => setStep('services')}
            />
          )}

          {/* ── Step 5: Services & Create ────────────────────────────── */}
          {step === 'services' && stackResult && (
            <ServicesStep
              services={stackResult.services}
              onChange={(services) => setStackResult(r => r ? { ...r, services } : r)}
              onBack={() => setStep('stack')}
              onCreate={handleCreate}
              canCreate={!!name.trim()}
              projectName={name}
            />
          )}

        </div>
      </div>
    </div>
  );
}

// ─── Step Components ──────────────────────────────────────────────────────────

function IdeaStep({ name, setName, idea, setIdea, onNext }: {
  name: string; setName: (v: string) => void;
  idea: string; setIdea: (v: string) => void;
  onNext: () => void;
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-0)', letterSpacing: '-0.3px' }}>
          What are you building?
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>
          Describe your idea — Aira will analyse it and recommend the perfect stack.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          autoFocus
          type="text"
          placeholder="Project name"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onNext()}
          style={{
            padding: '10px 14px', borderRadius: 10,
            border: '1px solid var(--border-1)', background: 'var(--bg-1)',
            color: 'var(--text-0)', fontSize: 14, fontWeight: 500,
            outline: 'none', transition: 'border-color 0.15s',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-1)')}
        />
        <textarea
          rows={4}
          placeholder="Describe what to build, who it's for, and any key features... The more detail, the better Aira's stack recommendation."
          value={idea}
          onChange={e => setIdea(e.target.value)}
          style={{
            padding: '10px 14px', borderRadius: 10, resize: 'none',
            border: '1px solid var(--border-1)', background: 'var(--bg-1)',
            color: 'var(--text-0)', fontSize: 13, outline: 'none',
            transition: 'border-color 0.15s', lineHeight: 1.6,
          }}
          onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-1)')}
        />
      </div>

      <div>
        <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>Quick starters</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {STARTERS.map(s => (
            <button
              key={s}
              onClick={() => {
                setIdea(s);
                if (!name) setName(s.split(' ').slice(0, 3).join(' '));
              }}
              style={{
                padding: '4px 10px', borderRadius: 99,
                border: '1px solid var(--border-1)', background: 'var(--bg-1)',
                color: 'var(--text-2)', fontSize: 11, cursor: 'pointer', transition: 'all 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.color = 'var(--text-1)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-1)'; e.currentTarget.style.color = 'var(--text-2)'; }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <Btn onClick={onNext} disabled={!name.trim()} style={{ marginTop: 'auto' }}>
        Continue <ArrowRight size={14} strokeWidth={1.5} />
      </Btn>
    </div>
  );
}

function PlatformStep({ platforms, toggle, onBack, onNext }: {
  platforms: Platform[]; toggle: (p: Platform) => void;
  onBack: () => void; onNext: () => void;
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-0)', letterSpacing: '-0.3px' }}>Target platform</h2>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>Select one or more platforms to build for.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {PLATFORM_ORDER.map(id => {
          const cfg = PLATFORM_CONFIGS[id];
          const sel = platforms.includes(id);
          return (
            <button
              key={id}
              onClick={() => toggle(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                border: `1px solid ${sel ? 'var(--accent-border)' : 'var(--border-1)'}`,
                background: sel ? 'var(--accent-subtle)' : 'var(--bg-1)',
                textAlign: 'left', transition: 'all 0.12s',
              }}
              onMouseEnter={e => { if (!sel) e.currentTarget.style.borderColor = 'var(--border-2)'; }}
              onMouseLeave={e => { if (!sel) e.currentTarget.style.borderColor = 'var(--border-1)'; }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: sel ? 'rgba(99,102,241,0.15)' : 'var(--bg-3)',
                color: sel ? 'var(--accent)' : 'var(--text-2)',
                transition: 'all 0.12s',
              }}>
                {PLATFORM_ICONS_JSX[id]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: sel ? 'var(--text-0)' : 'var(--text-1)' }}>{cfg.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cfg.description}</div>
              </div>
              {sel && (
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Check size={9} strokeWidth={2.5} color="white" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
        <Btn variant="ghost" onClick={onBack}><ArrowLeft size={14} strokeWidth={1.5} /> Back</Btn>
        <Btn onClick={onNext} disabled={platforms.length === 0}>Continue <ArrowRight size={14} strokeWidth={1.5} /></Btn>
      </div>
    </div>
  );
}

function BackendStep({ backendType, setBackendType, onBack, onNext, analysing }: {
  backendType: BackendType; setBackendType: (v: BackendType) => void;
  onBack: () => void; onNext: () => void; analysing: boolean;
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-0)', letterSpacing: '-0.3px' }}>Backend architecture</h2>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>How should your data and API layer work?</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {BACKEND_OPTIONS.map(opt => {
          const sel = backendType === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setBackendType(opt.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                border: `1px solid ${sel ? 'var(--accent-border)' : 'var(--border-1)'}`,
                background: sel ? 'var(--accent-subtle)' : 'var(--bg-1)',
                textAlign: 'left', transition: 'all 0.1s',
              }}
              onMouseEnter={e => { if (!sel) e.currentTarget.style.borderColor = 'var(--border-2)'; }}
              onMouseLeave={e => { if (!sel) e.currentTarget.style.borderColor = 'var(--border-1)'; }}
            >
              <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: sel ? 'var(--accent)' : 'var(--border-2)', transition: 'background 0.1s' }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: sel ? 'var(--text-0)' : 'var(--text-1)' }}>{opt.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>{opt.detail}</div>
              </div>
              {sel && <Check size={13} style={{ marginLeft: 'auto', color: 'var(--accent)', flexShrink: 0 }} />}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
        <Btn variant="ghost" onClick={onBack}><ArrowLeft size={14} strokeWidth={1.5} /> Back</Btn>
        <Btn onClick={onNext} disabled={analysing}>
          {analysing ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Analysing…</> : <>Analyse Idea <ArrowRight size={14} strokeWidth={1.5} /></>}
        </Btn>
      </div>
    </div>
  );
}

function StackStep({ analysing, result, error, onBack, onEdit, onNext }: {
  analysing: boolean;
  result: AnalysisResult | null;
  error: string;
  onBack: () => void;
  onEdit: (r: AnalysisResult) => void;
  onNext: () => void;
}) {
  const [editFrontend, setEditFrontend] = useState(result?.frontendHosting ?? 'vercel');
  const [editBackend, setEditBackend] = useState(result?.backendHosting ?? 'railway');

  if (analysing) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid var(--border-1)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-0)' }}>Analysing your idea…</p>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>Aira is recommending the best stack for your project</p>
        </div>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-0)', letterSpacing: '-0.3px' }}>
          Recommended Stack
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>
          {result.reasoning}
        </p>
      </div>

      {/* Language + Frameworks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Tag color="var(--accent)" label={result.language} icon="⌨️" />
          {result.frameworks.map(f => <Tag key={f} label={f} />)}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>{result.summary}</p>
      </div>

      {/* Hosting */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)' }}>Hosting</p>
        <HostingPicker
          label="Frontend"
          value={editFrontend as HostingTarget}
          onChange={v => {
            setEditFrontend(v);
            onEdit({ ...result, frontendHosting: v });
          }}
        />
        <HostingPicker
          label="Backend"
          value={editBackend as HostingTarget}
          onChange={v => {
            setEditBackend(v);
            onEdit({ ...result, backendHosting: v });
          }}
        />
      </div>

      {/* Services summary */}
      {result.services.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)' }}>
            Services needed ({result.services.length})
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {result.services.map(s => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 9px', borderRadius: 8,
                background: 'var(--bg-3)', border: '1px solid var(--border-1)',
                fontSize: 11, color: 'var(--text-1)',
              }}>
                <span>{s.icon}</span>
                <span>{s.name}</span>
                {s.required && <span style={{ color: 'var(--accent)', fontSize: 9, fontWeight: 600 }}>REQ</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p style={{ fontSize: 12, color: 'var(--red)' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
        <Btn variant="ghost" onClick={onBack}><ArrowLeft size={14} strokeWidth={1.5} /> Back</Btn>
        <Btn onClick={onNext}>
          {result.services.length > 0 ? <>Configure Services <ArrowRight size={14} strokeWidth={1.5} /></> : <>Create Project <ArrowRight size={14} strokeWidth={1.5} /></>}
        </Btn>
      </div>
    </div>
  );
}

function ServicesStep({ services, onChange, onBack, onCreate, canCreate, projectName }: {
  services: RequiredService[];
  onChange: (s: RequiredService[]) => void;
  onBack: () => void;
  onCreate: () => void;
  canCreate: boolean;
  projectName: string;
}) {
  const updateService = (id: string, value: string) =>
    onChange(services.map(s => s.id === id ? { ...s, value } : s));

  const removeService = (id: string) =>
    onChange(services.filter(s => s.id !== id));

  const addCustom = () =>
    onChange([...services, {
      id: `custom-${Date.now()}`,
      name: 'Custom Service',
      category: 'custom',
      reason: '',
      envKey: 'CUSTOM_API_KEY',
      url: '',
      required: false,
      icon: '🔧',
    }]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-0)', letterSpacing: '-0.3px' }}>
          Configure Services
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>
          Add API keys now or later in Settings. Required services must be set to build.
        </p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300 }}>
        {services.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '24px 0' }}>
            No external services needed — clean and self-contained!
          </p>
        )}
        {services.map(svc => (
          <div
            key={svc.id}
            style={{
              padding: '12px 14px', borderRadius: 10,
              border: '1px solid var(--border-1)', background: 'var(--bg-1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 14 }}>{svc.icon}</span>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-0)' }}>{svc.name}</span>
                {svc.required && (
                  <span style={{
                    marginLeft: 6, fontSize: 9, fontWeight: 600,
                    padding: '1px 5px', borderRadius: 4,
                    background: 'rgba(99,102,241,0.15)', color: 'var(--accent)',
                  }}>REQUIRED</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {SERVICE_ICONS[svc.category]}
                <button
                  onClick={() => removeService(svc.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', padding: 2 }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
                >
                  <Trash2 size={11} strokeWidth={1.5} />
                </button>
              </div>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>{svc.reason}</p>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={svc.value ?? ''}
                onChange={e => updateService(svc.id, e.target.value)}
                placeholder={svc.envKey}
                type="password"
                style={{
                  flex: 1, padding: '6px 10px', borderRadius: 7,
                  border: '1px solid var(--border-1)', background: 'var(--bg-2)',
                  color: 'var(--text-0)', fontSize: 11, fontFamily: 'monospace',
                  outline: 'none', transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-1)')}
              />
              {svc.url && (
                <a
                  href={svc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '6px 10px', borderRadius: 7,
                    border: '1px solid var(--border-1)', background: 'var(--bg-2)',
                    color: 'var(--text-2)', fontSize: 11, textDecoration: 'none',
                    display: 'flex', alignItems: 'center',
                    transition: 'border-color 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-border)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-1)')}
                >
                  Get key ↗
                </a>
              )}
            </div>
          </div>
        ))}

        <button
          onClick={addCustom}
          style={{
            width: '100%', padding: '8px', borderRadius: 10, border: '1px dashed var(--border-1)',
            background: 'transparent', color: 'var(--text-3)', fontSize: 12, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'all 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.color = 'var(--text-1)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-1)'; e.currentTarget.style.color = 'var(--text-3)'; }}
        >
          <Plus size={12} strokeWidth={1.5} /> Add custom service
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <Btn variant="ghost" onClick={onBack}><ArrowLeft size={14} strokeWidth={1.5} /> Back</Btn>
        <Btn onClick={onCreate} disabled={!canCreate}>
          Create {projectName || 'Project'} <Zap size={14} strokeWidth={1.5} />
        </Btn>
      </div>
    </div>
  );
}

// ─── Micro components ─────────────────────────────────────────────────────────

function Tag({ label, icon, color }: { label: string; icon?: string; color?: string }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 8,
      background: color ? `${color}18` : 'var(--bg-3)',
      border: `1px solid ${color ? `${color}35` : 'var(--border-1)'}`,
      fontSize: 12, color: color ?? 'var(--text-1)', fontWeight: 500,
    }}>
      {icon && <span>{icon}</span>}
      {label}
    </div>
  );
}

function HostingPicker({ label, value, onChange }: {
  label: string; value: HostingTarget; onChange: (v: HostingTarget) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 11, color: 'var(--text-3)', width: 60, flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, flex: 1 }}>
        {HOSTING_OPTIONS.map(h => {
          const sel = value === h.id;
          return (
            <button
              key={h.id}
              onClick={() => onChange(h.id)}
              title={h.detail}
              style={{
                padding: '4px 9px', borderRadius: 7, fontSize: 11, cursor: 'pointer',
                border: `1px solid ${sel ? 'var(--accent-border)' : 'var(--border-1)'}`,
                background: sel ? 'var(--accent-subtle)' : 'var(--bg-1)',
                color: sel ? 'var(--accent-hover)' : 'var(--text-2)',
                fontWeight: sel ? 500 : 400, transition: 'all 0.1s',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
              onMouseEnter={e => { if (!sel) e.currentTarget.style.borderColor = 'var(--border-2)'; }}
              onMouseLeave={e => { if (!sel) e.currentTarget.style.borderColor = 'var(--border-1)'; }}
            >
              <span style={{ fontSize: 10 }}>{h.icon}</span>
              {h.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
