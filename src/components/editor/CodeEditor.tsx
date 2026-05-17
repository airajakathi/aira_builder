import { useEffect } from 'react';
import { useState } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import { Copy, Check } from 'lucide-react';
import { useAppStore } from '../../store';

export function CodeEditor() {
  const activeFile = useAppStore(s => s.activeFile());
  const activeProjectId = useAppStore(s => s.activeProjectId);
  const updateFileContent = useAppStore(s => s.updateFileContent);
  const monaco = useMonaco();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!monaco) return;
    monaco.editor.defineTheme('aira', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment',        foreground: '3f3f46', fontStyle: 'italic' },
        { token: 'keyword',        foreground: '818cf8' },
        { token: 'string',         foreground: '6ee7b7' },
        { token: 'number',         foreground: 'fbbf24' },
        { token: 'type',           foreground: 'a78bfa' },
        { token: 'function',       foreground: '93c5fd' },
        { token: 'variable',       foreground: 'f0abfc' },
        { token: 'operator',       foreground: '67e8f9' },
        { token: 'tag',            foreground: 'f87171' },
        { token: 'attribute.name', foreground: 'fcd34d' },
        { token: 'attribute.value',foreground: '6ee7b7' },
      ],
      colors: {
        'editor.background':                   '#080809',
        'editor.foreground':                   '#a1a1aa',
        'editor.lineHighlightBackground':      '#0e0e1000',
        'editor.lineHighlightBorder':          '#0e0e10',
        'editor.selectionBackground':          '#6366f120',
        'editor.inactiveSelectionBackground':  '#6366f110',
        'editorLineNumber.foreground':         '#27272a',
        'editorLineNumber.activeForeground':   '#52525b',
        'editorCursor.foreground':             '#6366f1',
        'editorIndentGuide.background1':       '#18181c',
        'editorBracketMatch.background':       '#6366f115',
        'editorBracketMatch.border':           '#6366f140',
        'editorWidget.background':             '#0e0e10',
        'editorWidget.border':                 '#18181c',
        'editorSuggestWidget.background':      '#131316',
        'editorSuggestWidget.border':          '#1e1e24',
        'editorSuggestWidget.selectedBackground': '#18181c',
        'editorHoverWidget.background':        '#131316',
        'editorHoverWidget.border':            '#1e1e24',
        'scrollbar.shadow':                    '#00000000',
        'scrollbarSlider.background':          '#18181c',
        'scrollbarSlider.hoverBackground':     '#27272a',
        'scrollbarSlider.activeBackground':    '#3f3f46',
        'editorGutter.background':             '#080809',
        'minimap.background':                  '#080809',
      },
    });
    monaco.editor.setTheme('aira');
  }, [monaco]);

  const copy = async () => {
    if (!activeFile?.content) return;
    await navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!activeFile) {
    return (
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 8,
        background: 'var(--bg-0)',
      }}>
        <div style={{ fontSize: 28, opacity: 0.08, fontFamily: 'monospace', color: 'var(--text-0)' }}>{'</>'}</div>
        <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Select a file from the sidebar</p>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-0)' }}>
      {/* File bar */}
      <div style={{
        height: 36, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 12px', flexShrink: 0,
        borderBottom: '1px solid var(--border-0)', background: 'var(--bg-1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {activeFile.isDirty && (
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)' }} />
          )}
          <span style={{
            fontSize: 12, color: 'var(--text-1)', fontFamily: 'monospace',
            letterSpacing: '0.01em',
          }}>
            {activeFile.path}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {activeFile.language && (
            <span style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.05em' }}>
              {activeFile.language}
            </span>
          )}
          <button
            onClick={copy}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 7px', borderRadius: 5, border: '1px solid var(--border-1)',
              background: 'transparent', color: 'var(--text-3)', fontSize: 11,
              cursor: 'pointer', transition: 'all 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.color = 'var(--text-1)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-1)'; e.currentTarget.style.color = 'var(--text-3)'; }}
          >
            {copied ? <Check size={10} strokeWidth={2} style={{ color: 'var(--green)' }} /> : <Copy size={10} strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Editor
          height="100%"
          language={activeFile.language ?? 'plaintext'}
          value={activeFile.content ?? ''}
          theme="aira"
          onChange={val => {
            if (activeProjectId && activeFile) {
              updateFileContent(activeProjectId, activeFile.id, val ?? '');
            }
          }}
          options={{
            fontSize: 12.5,
            fontFamily: '"Geist Mono", "JetBrains Mono", "SF Mono", ui-monospace, monospace',
            fontLigatures: true,
            lineHeight: 1.75,
            letterSpacing: 0.2,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            padding: { top: 16, bottom: 16 },
            lineNumbers: 'on',
            lineNumbersMinChars: 4,
            roundedSelection: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            renderLineHighlight: 'none',
            bracketPairColorization: { enabled: false },
            guides: { indentation: false, bracketPairs: false },
            smoothScrolling: true,
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            renderWhitespace: 'none',
            glyphMargin: false,
            folding: true,
            foldingHighlight: false,
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
              verticalScrollbarSize: 3,
              horizontalScrollbarSize: 3,
              arrowSize: 0,
            },
          }}
          loading={
            <div style={{
              height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-0)',
            }}>
              <div style={{
                width: 16, height: 16, borderRadius: '50%',
                border: '1.5px solid var(--border-2)',
                borderTopColor: 'var(--accent)',
              }} className="anim-spin" />
            </div>
          }
        />
      </div>
    </div>
  );
}
