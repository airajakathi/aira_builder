import { useState } from 'react';
import { Rocket, ExternalLink, CheckCircle, AlertCircle, Loader2, Globe } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { useAppStore } from '../../store';
import { PLATFORM_CONFIGS } from '../../lib/platforms';
import type { Platform, DeployTarget } from '../../types';

const PROVIDERS: Record<DeployTarget, { name: string; badge: string; detail: string }> = {
  vercel:       { name: 'Vercel',          badge: '▲', detail: 'Global edge network' },
  netlify:      { name: 'Netlify',         badge: '◆', detail: 'Continuous delivery' },
  appstore:     { name: 'App Store',       badge: '⬆', detail: 'iOS distribution' },
  playstore:    { name: 'Play Store',      badge: '▶', detail: 'Android distribution' },
  electron:     { name: 'Electron Build',  badge: '⚛', detail: 'Cross-platform desktop' },
  'chrome-store': { name: 'Chrome Store', badge: '◉', detail: 'Extension distribution' },
  firebase:     { name: 'Firebase',        badge: '◈', detail: 'Google hosting' },
  supabase:     { name: 'Supabase',        badge: '⚡', detail: 'Postgres + Auth' },
  railway:      { name: 'Railway',         badge: '◫', detail: 'Full-stack hosting' },
  fly:          { name: 'Fly.io',          badge: '◎', detail: 'Edge computing' },
};

export function DeployPanel() {
  const activeProject = useAppStore(s => s.activeProject());
  const { addDeployment, updateDeployment } = useAppStore();
  const [deploying, setDeploying] = useState<string | null>(null);

  if (!activeProject) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-0)' }}>
        <p style={{ fontSize: 12, color: 'var(--text-3)' }}>No project selected</p>
      </div>
    );
  }

  const targets = [...new Set(activeProject.platforms.flatMap(p => PLATFORM_CONFIGS[p]?.deployTargets ?? []))];

  const deploy = async (target: DeployTarget, platform: Platform) => {
    const id = uuid();
    addDeployment(activeProject.id, { id, platform, target, status: 'building', timestamp: Date.now(), logs: ['Initializing...'] });
    setDeploying(id);

    const steps = ['Installing dependencies', 'Type checking', 'Building', 'Optimizing', 'Uploading', 'Done'];
    for (let i = 0; i < steps.length; i++) {
      await new Promise(r => setTimeout(r, 500 + Math.random() * 500));
      updateDeployment(activeProject.id, id, {
        logs: steps.slice(0, i + 1),
        status: i === steps.length - 1 ? 'deployed' : 'building',
        url: i === steps.length - 1 ? `https://${activeProject.name.toLowerCase().replace(/\s+/g, '-')}.vercel.app` : undefined,
      });
    }
    setDeploying(null);
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 20, background: 'var(--bg-0)' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-0)', marginBottom: 4 }}>Deploy</h2>
        <p style={{ fontSize: 12, color: 'var(--text-2)' }}>
          {activeProject.platforms.length} platform{activeProject.platforms.length > 1 ? 's' : ''} · {targets.length} target{targets.length > 1 ? 's' : ''}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {targets.map(target => {
          const prov = PROVIDERS[target];
          if (!prov) return null;
          const relPlatform = activeProject.platforms.find(p => PLATFORM_CONFIGS[p]?.deployTargets.includes(target)) ?? activeProject.platforms[0];
          const lastDeploy = activeProject.deployments.filter(d => d.target === target).sort((a, b) => b.timestamp - a.timestamp)[0];

          return (
            <div
              key={target}
              style={{
                borderRadius: 10, padding: '14px 16px',
                background: 'var(--bg-2)', border: '1px solid var(--border-1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: lastDeploy ? 10 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--bg-3)', fontSize: 14, color: 'var(--text-1)',
                  }}>
                    {prov.badge}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-0)' }}>{prov.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{prov.detail}</div>
                  </div>
                </div>
                <button
                  onClick={() => !deploying && deploy(target, relPlatform)}
                  disabled={!!deploying}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 12px', borderRadius: 7, border: 'none',
                    background: deploying ? 'var(--bg-3)' : 'var(--accent)',
                    color: deploying ? 'var(--text-3)' : 'white',
                    fontSize: 12, fontWeight: 500, cursor: deploying ? 'default' : 'pointer',
                    transition: 'all 0.1s',
                  }}
                  onMouseEnter={e => { if (!deploying) e.currentTarget.style.opacity = '0.85'; }}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  {lastDeploy?.status === 'building'
                    ? <><Loader2 size={12} strokeWidth={2} className="anim-spin" /> Building</>
                    : <><Rocket size={12} strokeWidth={1.5} /> {lastDeploy?.status === 'deployed' ? 'Redeploy' : 'Deploy'}</>
                  }
                </button>
              </div>

              {lastDeploy && (
                <div style={{ borderTop: '1px solid var(--border-0)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {lastDeploy.url && (
                    <a href={lastDeploy.url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--accent)', fontSize: 12, textDecoration: 'none' }}>
                      <Globe size={11} strokeWidth={1.5} />
                      {lastDeploy.url}
                      <ExternalLink size={9} strokeWidth={1.5} />
                    </a>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {lastDeploy.status === 'deployed'
                      ? <CheckCircle size={11} strokeWidth={1.5} style={{ color: 'var(--green)' }} />
                      : lastDeploy.status === 'building'
                        ? <Loader2 size={11} strokeWidth={2} className="anim-spin" style={{ color: 'var(--yellow)' }} />
                        : <AlertCircle size={11} strokeWidth={1.5} style={{ color: 'var(--red)' }} />}
                    <span style={{ fontSize: 11, color: 'var(--text-2)' }}>
                      {lastDeploy.status === 'deployed' ? 'Deployed' : lastDeploy.status === 'building' ? 'Building...' : 'Failed'}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {new Date(lastDeploy.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {lastDeploy.logs.length > 0 && (
                    <div style={{
                      padding: '8px 10px', borderRadius: 6,
                      background: 'var(--bg-1)', border: '1px solid var(--border-0)',
                      maxHeight: 80, overflowY: 'auto',
                    }}>
                      {lastDeploy.logs.map((log, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{ fontSize: 10, color: i < lastDeploy.logs.length - 1 || lastDeploy.status === 'deployed' ? 'var(--green)' : 'var(--accent)' }}>
                            {i < lastDeploy.logs.length - 1 || lastDeploy.status === 'deployed' ? '✓' : '›'}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'monospace' }}>{log}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
