import { useState, useRef, useCallback, useEffect } from 'react';
import { useAppStore } from './store';
import { Sidebar } from './components/sidebar/Sidebar';
import { ChatPanel } from './components/chat/ChatPanel';
import { RightPanel } from './components/editor/RightPanel';
import { NewProjectModal } from './components/platform/NewProjectModal';

const CHAT_MIN = 280;
const CHAT_MAX = 720;
const CHAT_DEFAULT = 420;

function ResizeDivider({
  onResize,
  isDragging,
}: {
  onResize: (delta: number) => void;
  isDragging: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 12,
        flexShrink: 0,
        cursor: 'col-resize',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
        userSelect: 'none',
      }}
    >
      {/* thin line */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          left: 5,
          width: 1,
          background: isDragging
            ? 'var(--accent)'
            : hovered
            ? 'var(--border-2)'
            : 'var(--border-1)',
          transition: 'background 0.15s',
        }}
      />
      {/* grip dots */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          padding: '3px 4px',
          borderRadius: 4,
          background:
            isDragging || hovered ? 'var(--bg-3)' : 'transparent',
          transition: 'background 0.15s',
          zIndex: 1,
        }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              width: 3,
              height: 3,
              borderRadius: '50%',
              background:
                isDragging || hovered
                  ? 'var(--text-2)'
                  : 'var(--border-2)',
              transition: 'background 0.15s',
            }}
          />
        ))}
      </div>
    </div>
  );
}

function App() {
  const [showNewProject, setShowNewProject] = useState(false);
  const [chatWidth, setChatWidth] = useState(CHAT_DEFAULT);
  const [isDragging, setIsDragging] = useState(false);

  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      dragStartX.current = e.clientX;
      dragStartWidth.current = chatWidth;
    },
    [chatWidth]
  );

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - dragStartX.current;
      const next = Math.min(
        CHAT_MAX,
        Math.max(CHAT_MIN, dragStartWidth.current + delta)
      );
      setChatWidth(next);
    };

    const onUp = () => setIsDragging(false);

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isDragging]);

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        overflow: 'hidden',
        background: 'var(--bg-0)',
        cursor: isDragging ? 'col-resize' : undefined,
        userSelect: isDragging ? 'none' : undefined,
      }}
    >
      <Sidebar onNewProject={() => setShowNewProject(true)} />

      <div
        ref={containerRef}
        style={{ flex: 1, minWidth: 0, display: 'flex', overflow: 'hidden' }}
      >
        {/* Chat panel — fixed pixel width */}
        <div
          style={{
            width: chatWidth,
            minWidth: CHAT_MIN,
            maxWidth: CHAT_MAX,
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          <ChatPanel />
        </div>

        {/* Drag handle */}
        <div onMouseDown={handleMouseDown} style={{ flexShrink: 0 }}>
          <ResizeDivider onResize={() => {}} isDragging={isDragging} />
        </div>

        {/* Editor panel — fills remaining space */}
        <div style={{ flex: 1, minWidth: 320, overflow: 'hidden' }}>
          <RightPanel />
        </div>
      </div>

      {showNewProject && (
        <NewProjectModal onClose={() => setShowNewProject(false)} />
      )}
    </div>
  );
}

export default App;
