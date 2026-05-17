import type { Platform } from '../../types';
import { PLATFORM_CONFIGS } from '../../lib/platforms';

interface Props {
  platform: Platform;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export function PlatformBadge({ platform, size = 'sm', showLabel = false }: Props) {
  const cfg = PLATFORM_CONFIGS[platform];
  const pad = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-medium ${pad}`}
      style={{
        background: `${cfg.color}18`,
        color: cfg.color,
        border: `1px solid ${cfg.color}30`,
      }}
    >
      <span>{cfg.icon}</span>
      {showLabel && <span>{cfg.label}</span>}
    </span>
  );
}
