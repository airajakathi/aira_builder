import { Code2, Eye, Rocket, Settings2, TerminalSquare } from 'lucide-react';
import { useAppStore } from '../../store';
import { CodeEditor } from './CodeEditor';
import { PreviewPanel } from '../preview/PreviewPanel';
import { DeployPanel } from './DeployPanel';
import { ProjectSettingsPanel } from './ProjectSettingsPanel';
import { TerminalPanel } from '../terminal/TerminalPanel';

type Panel = 'code' | 'preview' | 'terminal' | 'deploy' | 'settings';

const TABS: { id: Panel; label: string; Icon: React.FC<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }> }[] = [
  { id: 'code',     label: 'Code',     Icon: Code2 },
  { id: 'preview',  label: 'Preview',  Icon: Eye },
  { id: 'terminal', label: 'Terminal', Icon: TerminalSquare },
  { id: 'deploy',   label: 'Deploy',   Icon: Rocket },
  { id: 'settings', label: 'Settings', Icon: Settings2 },
];

export function RightPanel() {
  const { rightPanel, setRightPanel } = useAppStore();

  // Clamp panel value to the 5 allowed — anything else (skills/tools/etc) → settings
  const activeTab: Panel = (['code', 'preview', 'terminal', 'deploy', 'settings'] as Panel[]).includes(rightPanel as Panel)
    ? (rightPanel as Panel)
    : 'settings';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-0)' }}>
      {/* Tabs */}
      <div style={{
        height: 44, display: 'flex', alignItems: 'center',
        padding: '0 12px', gap: 2, flexShrink: 0,
        borderBottom: '1px solid var(--border-0)',
        background: 'var(--bg-1)',
      }}>
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setRightPanel(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', borderRadius: 7, border: 'none',
                background: active ? 'var(--bg-3)' : 'transparent',
                color: active ? 'var(--text-0)' : 'var(--text-2)',
                fontSize: 12, fontWeight: active ? 500 : 400,
                cursor: 'pointer', transition: 'all 0.1s',
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.color = 'var(--text-1)'; e.currentTarget.style.background = 'var(--bg-2)'; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.color = 'var(--text-2)'; e.currentTarget.style.background = 'transparent'; } }}
            >
              <Icon
                size={13}
                strokeWidth={active ? 1.75 : 1.5}
                style={{ color: active ? (id === 'terminal' ? 'var(--green)' : 'var(--accent)') : undefined }}
              />
              {label}
            </button>
          );
        })}
      </div>

      {/* Panel content — Terminal kept mounted to preserve session */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, display: activeTab === 'code' ? 'block' : 'none' }}>
          <CodeEditor />
        </div>
        <div style={{ position: 'absolute', inset: 0, display: activeTab === 'preview' ? 'block' : 'none' }}>
          <PreviewPanel />
        </div>
        <div style={{ position: 'absolute', inset: 0, display: activeTab === 'terminal' ? 'block' : 'none' }}>
          <TerminalPanel />
        </div>
        <div style={{ position: 'absolute', inset: 0, display: activeTab === 'deploy' ? 'block' : 'none' }}>
          <DeployPanel />
        </div>
        <div style={{ position: 'absolute', inset: 0, display: activeTab === 'settings' ? 'block' : 'none' }}>
          <ProjectSettingsPanel />
        </div>
      </div>
    </div>
  );
}
