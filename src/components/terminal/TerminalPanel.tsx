import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { useAppStore } from '../../store';

export function TerminalPanel() {
  const activeProject = useAppStore(s => s.activeProject());
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const projectIdRef = useRef<string | null>(null);

  const connect = useCallback((projectId: string, projectName: string) => {
    // Clean up existing
    wsRef.current?.close();
    termRef.current?.dispose();

    const term = new Terminal({
      theme: {
        background: '#080809',
        foreground: '#c8c8d4',
        cursor: '#6366f1',
        selectionBackground: 'rgba(99,102,241,0.25)',
        black: '#1a1a24',
        brightBlack: '#3a3a50',
        red: '#f87171',
        brightRed: '#fc8181',
        green: '#4ade80',
        brightGreen: '#86efac',
        yellow: '#fbbf24',
        brightYellow: '#fde68a',
        blue: '#818cf8',
        brightBlue: '#a5b4fc',
        magenta: '#c084fc',
        brightMagenta: '#d8b4fe',
        cyan: '#22d3ee',
        brightCyan: '#67e8f9',
        white: '#e2e8f0',
        brightWhite: '#f8fafc',
      },
      fontFamily: '"Geist Mono", "SF Mono", "Fira Code", Menlo, monospace',
      fontSize: 12,
      lineHeight: 1.5,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 5000,
      allowProposedApi: true,
    });

    const fit = new FitAddon();
    const links = new WebLinksAddon();
    term.loadAddon(fit);
    term.loadAddon(links);
    termRef.current = term;
    fitRef.current = fit;

    if (containerRef.current) {
      term.open(containerRef.current);
      setTimeout(() => fit.fit(), 50);
    }

    // WebSocket connection to node-pty backend
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(
      `${protocol}//${location.host}/api/terminal?projectId=${encodeURIComponent(projectId)}&projectName=${encodeURIComponent(projectName)}`
    );
    wsRef.current = ws;

    ws.onopen = () => {
      term.writeln('\x1b[90m# Connected to project workspace\x1b[0m');
      term.writeln(`\x1b[90m# ${projectName}\x1b[0m`);
      term.writeln('');
    };

    ws.onmessage = (e) => term.write(e.data);
    ws.onclose = () => term.writeln('\r\n\x1b[90m[session closed]\x1b[0m');
    ws.onerror = () => term.writeln('\r\n\x1b[31m[WebSocket error — terminal unavailable]\x1b[0m');

    term.onData(data => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    });
  }, []);

  // Connect when project changes
  useEffect(() => {
    if (!activeProject) return;
    if (activeProject.id === projectIdRef.current) return;
    projectIdRef.current = activeProject.id;
    connect(activeProject.id, activeProject.name);
  }, [activeProject?.id]);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => {
      fitRef.current?.fit();
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      termRef.current?.dispose();
    };
  }, []);

  if (!activeProject) {
    return (
      <div style={{
        height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#080809',
      }}>
        <p style={{ fontSize: 12, color: '#3a3a50' }}>No project selected</p>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#080809' }}>
      {/* Toolbar */}
      <div style={{
        height: 36, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px',
        borderBottom: '1px solid var(--border-0)', background: 'var(--bg-1)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {['#ef4444', '#f59e0b', '#22c55e'].map(c => (
            <div key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c, opacity: 0.7 }} />
          ))}
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'monospace' }}>
          ~/workspace/{activeProject.name.toLowerCase().replace(/\s+/g, '-')}
        </span>
        <button
          onClick={() => connect(activeProject.id, activeProject.name)}
          style={{
            marginLeft: 'auto', padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border-1)',
            background: 'transparent', color: 'var(--text-3)', fontSize: 11, cursor: 'pointer',
            transition: 'all 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-1)'; e.currentTarget.style.borderColor = 'var(--border-2)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.borderColor = 'var(--border-1)'; }}
        >
          Reconnect
        </button>
      </div>

      {/* Terminal container */}
      <div
        ref={containerRef}
        style={{ flex: 1, overflow: 'hidden', padding: '4px 2px 2px' }}
      />
    </div>
  );
}
