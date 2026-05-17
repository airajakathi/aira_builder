import { useState, useEffect } from 'react';
import { RefreshCw, ExternalLink, Monitor, Smartphone, Tablet, Globe, QrCode, Terminal, Loader2 } from 'lucide-react';
import { useAppStore } from '../../store';
import { PLATFORM_CONFIGS } from '../../lib/platforms';

const DEVICE_SIZES = {
  desktop: { width: '100%', height: '100%', label: 'Desktop' },
  tablet:  { width: '768px', height: '1024px', label: 'Tablet' },
  mobile:  { width: '390px', height: '844px', label: 'Mobile' },
};

export function PreviewPanel() {
  const { previewUrl } = useAppStore();
  const activeProject = useAppStore(s => s.activeProject());
  const isGenerating = useAppStore(s => s.isGenerating);
  const builderStatus = useAppStore(s => s.teamBus.builderStatus);
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [refreshKey, setRefreshKey] = useState(0);
  const [iframeError, setIframeError] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(false);

  // Reset iframe state when URL changes
  useEffect(() => {
    setIframeError(false);
    setIframeLoading(true);
  }, [previewUrl, refreshKey]);

  const isNativeProject = activeProject?.platforms.some(p => ['ios', 'android'].includes(p));
  const isWebProject = activeProject?.platforms.some(p => ['web', 'fullstack', 'api'].includes(p));
  const isTerminalProject = activeProject?.platforms.some(p => ['desktop', 'extension'].includes(p));

  // Determine what to show:
  // - If previewUrl set AND it's a web/expo-web URL → iframe
  // - If native project with no preview yet → NativePreview
  // - If previewUrl set AND native → NativePreview with QR
  const showIframe = !!previewUrl && (isWebProject || (!isNativeProject && !isTerminalProject));
  const showNative = isNativeProject;
  const showTerminal = !showIframe && !showNative && isTerminalProject;

  if (!activeProject) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-0)' }}>
        <p style={{ fontSize: 12, color: 'var(--text-3)' }}>No project selected</p>
      </div>
    );
  }

  const { width, height } = DEVICE_SIZES[device];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-0)' }}>
      {/* Toolbar */}
      <div style={{
        height: 40, display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 12px', flexShrink: 0,
        borderBottom: '1px solid var(--border-0)', background: 'var(--bg-1)',
      }}>
        {/* URL bar */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 7,
          padding: '5px 10px', borderRadius: 7,
          background: 'var(--bg-2)', border: '1px solid var(--border-1)',
          minWidth: 0,
        }}>
          <Globe size={11} strokeWidth={1.5} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: 'var(--text-2)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {previewUrl ?? 'localhost:5173'}
          </span>
        </div>

        {/* Device switcher */}
        <div style={{ display: 'flex', gap: 1, padding: 2, borderRadius: 7, background: 'var(--bg-2)' }}>
          {([
            { id: 'desktop' as const, Icon: Monitor },
            { id: 'tablet' as const,  Icon: Tablet },
            { id: 'mobile' as const,  Icon: Smartphone },
          ]).map(({ id, Icon }) => (
            <button
              key={id}
              onClick={() => setDevice(id)}
              style={{
                width: 26, height: 26, border: 'none', borderRadius: 5,
                background: device === id ? 'var(--bg-4)' : 'transparent',
                color: device === id ? 'var(--text-0)' : 'var(--text-3)',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', transition: 'all 0.1s',
              }}
            >
              <Icon size={12} strokeWidth={1.5} />
            </button>
          ))}
        </div>

        <button
          onClick={() => setRefreshKey(k => k + 1)}
          style={{
            width: 28, height: 28, border: 'none', background: 'transparent',
            cursor: 'pointer', color: 'var(--text-3)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', borderRadius: 6,
            transition: 'all 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-1)'; e.currentTarget.style.background = 'var(--bg-2)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.background = 'transparent'; }}
        >
          <RefreshCw size={12} strokeWidth={1.5} />
        </button>

        {previewUrl && (
          <a href={previewUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex' }}>
            <button
              style={{
                width: 28, height: 28, border: 'none', background: 'transparent',
                cursor: 'pointer', color: 'var(--text-3)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', borderRadius: 6,
                transition: 'all 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-1)'; e.currentTarget.style.background = 'var(--bg-2)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.background = 'transparent'; }}
            >
              <ExternalLink size={12} strokeWidth={1.5} />
            </button>
          </a>
        )}
      </div>

      {/* Preview */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#050506', overflow: 'hidden', position: 'relative',
      }}>
        {showIframe ? (
          <div style={{
            width, height, maxWidth: '100%', maxHeight: '100%',
            overflow: 'hidden', transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
            border: device !== 'desktop' ? '1px solid var(--border-2)' : 'none',
            borderRadius: device === 'mobile' ? 28 : device === 'tablet' ? 16 : 0,
            boxShadow: device !== 'desktop' ? '0 24px 64px rgba(0,0,0,0.6)' : 'none',
            position: 'relative',
          }}>
            {iframeLoading && !iframeError && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', background: 'var(--bg-1)', zIndex: 2, gap: 10,
              }}>
                <Loader2 size={22} strokeWidth={1.5} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Loading preview…</span>
              </div>
            )}
            {iframeError ? (
              <div style={{
                width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 10, background: 'var(--bg-1)',
              }}>
                <span style={{ fontSize: 28 }}>⚠️</span>
                <p style={{ fontSize: 12, color: 'var(--text-2)', textAlign: 'center', maxWidth: 260 }}>
                  Preview blocked. <a href={previewUrl!} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>Open in new tab →</a>
                </p>
              </div>
            ) : (
              <iframe
                key={refreshKey}
                src={previewUrl!}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title="Preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox"
                onLoad={() => setIframeLoading(false)}
                onError={() => { setIframeLoading(false); setIframeError(true); }}
              />
            )}
          </div>
        ) : showNative ? (
          <NativePreview platforms={activeProject!.platforms} previewUrl={previewUrl} />
        ) : showTerminal ? (
          <TerminalPreview isGenerating={isGenerating} builderDetail={builderStatus.detail} />
        ) : isGenerating ? (
          <BuildingState detail={builderStatus.detail} />
        ) : (
          <EmptyPreview />
        )}
      </div>

      {/* Platform row */}
      <div style={{
        height: 36, display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 14px', flexShrink: 0,
        borderTop: '1px solid var(--border-0)', background: 'var(--bg-1)',
      }}>
        {activeProject.platforms.map(p => {
          const cfg = PLATFORM_CONFIGS[p];
          return (
            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{cfg.icon}</span>
              <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{cfg.label}</span>
              <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'var(--bg-3)', color: 'var(--text-3)' }}>
                {cfg.deployTargets[0]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BuildingState({ detail }: { detail: string }) {
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 14, background: 'var(--bg-1)',
    }}>
      <div style={{ position: 'relative', width: 48, height: 48 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: 'linear-gradient(135deg, #6366f1, #818cf8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, fontWeight: 700, color: 'white',
        }}>⚙</div>
        <div style={{
          position: 'absolute', bottom: -4, right: -4,
          width: 16, height: 16, borderRadius: '50%',
          background: '#0ea5e9', border: '2px solid var(--bg-1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Loader2 size={9} strokeWidth={3} style={{ color: 'white', animation: 'spin 0.8s linear infinite' }} />
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', marginBottom: 6 }}>Builder is working</p>
        <p style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'monospace', maxWidth: 280 }}>
          {detail || 'Generating code...'}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)',
            animation: `pulse 1.2s ease infinite ${i * 0.2}s`,
          }} />
        ))}
      </div>
    </div>
  );
}

function EmptyPreview() {
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 10, background: 'var(--bg-1)',
    }}>
      <Monitor size={28} strokeWidth={1} style={{ color: 'var(--text-3)' }} />
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)', marginBottom: 4 }}>Live Preview</p>
        <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6 }}>
          Start a conversation to generate code.<br />Preview will appear automatically.
        </p>
      </div>
    </div>
  );
}

function NativePreview({ platforms, previewUrl }: { platforms: string[]; previewUrl: string | null }) {
  const nativePlatforms = platforms.filter(p => ['ios', 'android'].includes(p));
  // If a web preview URL exists for Expo, show it in mobile frame
  const showWebPreview = !!previewUrl;
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start', padding: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
      {nativePlatforms.map(p => (
        <div key={p} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 200, height: 400, borderRadius: p === 'ios' ? 36 : 26,
            background: '#0a0a0a', border: `2px solid ${p === 'ios' ? '#2a2a2a' : '#1e1e1e'}`,
            boxShadow: '0 24px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05)',
            overflow: 'hidden', position: 'relative',
          }}>
            {/* Notch / camera */}
            <div style={{
              position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
              width: p === 'ios' ? 100 : 20, height: p === 'ios' ? 28 : 20,
              background: '#0a0a0a', zIndex: 3,
              borderRadius: p === 'ios' ? '0 0 18px 18px' : '50%',
              marginTop: p === 'android' ? 8 : 0,
            }} />
            {showWebPreview ? (
              <>
                <iframe
                  key={refreshKey}
                  src={previewUrl!}
                  style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                  title={`${p} preview`}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
                />
              </>
            ) : (
              <div style={{
                width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', background: '#111',
              }}>
                <p style={{ fontSize: 28, marginBottom: 8 }}>{p === 'ios' ? '🍎' : '◎'}</p>
                <p style={{ fontSize: 11, color: '#555' }}>{p === 'ios' ? 'iOS Simulator' : 'Android Emulator'}</p>
                <p style={{ fontSize: 10, color: '#333', marginTop: 6 }}>Waiting for server...</p>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
              {p === 'ios' ? 'iPhone 15 Pro' : 'Pixel 8 Pro'}
            </p>
            {showWebPreview && (
              <button onClick={() => setRefreshKey(k => k + 1)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)',
                display: 'flex', padding: 2,
              }}>
                <RefreshCw size={10} strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>
      ))}
      {/* QR / instructions panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 32, maxWidth: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <QrCode size={20} strokeWidth={1} style={{ color: 'var(--text-3)' }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>Expo Go</span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.7 }}>
          {previewUrl
            ? 'App is running. Scan the QR code in Expo Go or use the web preview.'
            : 'Waiting for Expo server to start. Use Expo Go on your phone to scan the QR code.'}
        </p>
        {previewUrl && (
          <a href={previewUrl} target="_blank" rel="noopener noreferrer" style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11,
            color: 'var(--accent)', textDecoration: 'none',
          }}>
            <ExternalLink size={10} strokeWidth={1.5} /> Open in browser
          </a>
        )}
        <code style={{
          fontSize: 10, padding: '6px 10px', borderRadius: 6,
          background: 'var(--bg-3)', color: 'var(--green)',
          border: '1px solid var(--border-1)', display: 'block',
        }}>
          npx expo start
        </code>
      </div>
    </div>
  );
}

function TerminalPreview({ isGenerating, builderDetail }: { isGenerating: boolean; builderDetail: string }) {
  return (
    <div style={{ width: '100%', maxWidth: 560, padding: 24 }}>
      <div style={{
        borderRadius: 12, overflow: 'hidden',
        border: '1px solid var(--border-1)', boxShadow: 'var(--shadow-lg)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '10px 14px', background: 'var(--bg-3)',
          borderBottom: '1px solid var(--border-1)',
        }}>
          {['#ef4444', '#f59e0b', '#22c55e'].map(c => (
            <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.8 }} />
          ))}
          <span style={{ marginLeft: 4, fontSize: 11, color: 'var(--text-3)' }}>Terminal</span>
          {isGenerating && <Loader2 size={10} strokeWidth={2} style={{ marginLeft: 'auto', color: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />}
        </div>
        <div style={{ padding: 16, background: '#050506', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.8 }}>
          <div style={{ color: 'var(--text-3)' }}>
            <span style={{ color: 'var(--accent)', opacity: 0.7 }}>~/project</span>{' $ '}
            <span style={{ color: 'var(--text-2)' }}>{isGenerating ? builderDetail || 'generating...' : 'npm run build'}</span>
          </div>
          <div style={{ color: 'var(--text-3)', marginTop: 8 }}>
            {isGenerating ? 'Building...' : 'Waiting for code generation...'}
          </div>
        </div>
      </div>
    </div>
  );
}
