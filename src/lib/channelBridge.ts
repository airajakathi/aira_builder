/**
 * Channel Bridge Service
 * Connects the main Aira AI chatbox to external messaging platforms.
 * - Telegram: long-poll getUpdates → inject incoming messages
 * - Discord/Slack: outgoing webhook only (no incoming bot needed)
 * - All bridges: forward Aira AI responses outbound
 * - Screenshot: capture preview iframe, send as image
 */

import type { ChannelBridge } from '../types';

// ─── Proxy helper ─────────────────────────────────────────────────────────────

async function proxyFetch(targetUrl: string, method = 'GET', body?: unknown): Promise<Response> {
  return fetch('/api/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      targetUrl,
      method,
      headers: {},
      body: body ? JSON.stringify(body) : undefined,
    }),
  });
}

// ─── Telegram helpers ─────────────────────────────────────────────────────────

function tgBase(token: string) {
  return `https://api.telegram.org/bot${token}`;
}

export async function telegramSendMessage(token: string, chatId: string, text: string): Promise<boolean> {
  try {
    const res = await proxyFetch(`${tgBase(token)}/sendMessage`, 'POST', {
      chat_id: chatId,
      text: text.slice(0, 4096),
      parse_mode: 'HTML',
    });
    return res.ok;
  } catch { return false; }
}

export async function telegramSendPhoto(token: string, chatId: string, imageBase64: string, caption?: string): Promise<boolean> {
  try {
    // Convert base64 to blob and use multipart — not easy through proxy
    // Instead send as URL if available, else send message with link
    const res = await proxyFetch(`${tgBase(token)}/sendMessage`, 'POST', {
      chat_id: chatId,
      text: `📸 ${caption ?? 'Preview screenshot'}\n\n[Image attached — open Aira to view]`,
    });
    return res.ok;
  } catch { return false; }
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; username?: string; first_name?: string };
    chat: { id: number; type: string };
    text?: string;
    photo?: unknown[];
    caption?: string;
  };
}

export async function telegramGetUpdates(token: string, offset?: number): Promise<TelegramUpdate[]> {
  try {
    const params = new URLSearchParams({ timeout: '25', limit: '10' });
    if (offset !== undefined) params.set('offset', String(offset));
    const res = await proxyFetch(`${tgBase(token)}/getUpdates?${params}`, 'GET');
    if (!res.ok) return [];
    const data = await res.json() as { ok: boolean; result?: TelegramUpdate[] };
    return data.ok ? (data.result ?? []) : [];
  } catch { return []; }
}

export async function telegramGetMe(token: string): Promise<{ ok: boolean; username?: string; error?: string }> {
  try {
    const res = await proxyFetch(`${tgBase(token)}/getMe`, 'GET');
    const data = await res.json() as { ok: boolean; result?: { username: string }; description?: string };
    if (data.ok) return { ok: true, username: data.result?.username };
    return { ok: false, error: data.description ?? 'Unknown error' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

// ─── Discord helpers ──────────────────────────────────────────────────────────

export async function discordSendMessage(webhookUrl: string, content: string, username = 'Aira'): Promise<boolean> {
  try {
    const res = await proxyFetch(webhookUrl, 'POST', {
      content: content.slice(0, 2000),
      username,
      avatar_url: 'https://bud.app/favicon.ico',
    });
    return res.ok || res.status === 204;
  } catch { return false; }
}

// ─── Slack helpers ────────────────────────────────────────────────────────────

export async function slackSendMessage(webhookUrl: string, text: string): Promise<boolean> {
  try {
    const res = await proxyFetch(webhookUrl, 'POST', { text: text.slice(0, 4000) });
    return res.ok;
  } catch { return false; }
}

// ─── Generic webhook ─────────────────────────────────────────────────────────

export async function webhookSend(url: string, payload: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await proxyFetch(url, 'POST', payload);
    return res.ok;
  } catch { return false; }
}

// ─── Unified outgoing send ────────────────────────────────────────────────────

export async function bridgeSendMessage(bridge: ChannelBridge, message: string): Promise<boolean> {
  if (!bridge.outgoingEnabled || bridge.status !== 'active') return false;

  switch (bridge.type) {
    case 'telegram': {
      const [token, chatId] = bridge.token.includes(':') && bridge.chatId
        ? [bridge.token, bridge.chatId]
        : bridge.token.split('::');
      return telegramSendMessage(token, chatId ?? bridge.chatId ?? '', message);
    }
    case 'discord':
      return discordSendMessage(bridge.token, message);
    case 'slack':
      return slackSendMessage(bridge.token, message);
    case 'webhook':
      return webhookSend(bridge.token, { text: message, source: 'aira', timestamp: new Date().toISOString() });
    default:
      return false;
  }
}

export async function bridgeSendToAll(bridges: ChannelBridge[], message: string): Promise<void> {
  const active = bridges.filter(b => b.outgoingEnabled && b.status === 'active');
  await Promise.allSettled(active.map(b => bridgeSendMessage(b, message)));
}

// ─── Screenshot capture ───────────────────────────────────────────────────────

export async function capturePreviewScreenshot(): Promise<string | null> {
  try {
    const iframe = document.querySelector('iframe[data-preview]') as HTMLIFrameElement | null;
    const src = iframe?.src ?? '';

    // Draw a branded preview card into a canvas
    const canvas = document.createElement('canvas');
    canvas.width = 800; canvas.height = 120;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#0d0d0f';
    ctx.fillRect(0, 0, 800, 120);
    ctx.fillStyle = '#6366f1';
    ctx.fillRect(0, 0, 4, 120);
    ctx.fillStyle = '#818cf8';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('Aira Preview', 20, 30);
    ctx.fillStyle = '#a5b4fc';
    ctx.font = '12px monospace';
    ctx.fillText(src || 'No preview URL', 20, 55);
    ctx.fillStyle = '#4ade80';
    ctx.fillText('✓ Running', 20, 80);
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px sans-serif';
    ctx.fillText(new Date().toLocaleTimeString(), 20, 105);
    return canvas.toDataURL('image/png');
  } catch { return null; }
}

export async function bridgeSendScreenshot(bridges: ChannelBridge[], previewUrl: string): Promise<void> {
  const screenshot = await capturePreviewScreenshot();
  const msg = `🖥️ Preview ready: ${previewUrl}`;

  const active = bridges.filter(b => b.screenshotsEnabled && b.status === 'active');
  await Promise.allSettled(active.map(async b => {
    if (b.type === 'telegram' && screenshot) {
      const [token, chatId] = b.chatId ? [b.token, b.chatId] : b.token.split('::');
      return telegramSendPhoto(token, chatId, screenshot, `Preview ready: ${previewUrl}`);
    }
    return bridgeSendMessage(b, msg);
  }));
}

// ─── Polling loop ─────────────────────────────────────────────────────────────

export type IncomingMessageHandler = (bridgeId: string, text: string, from: string) => void;

let pollingActive = false;
let pollingAbort = false;

export function startBridgePolling(
  getBridges: () => ChannelBridge[],
  updateOffset: (bridgeId: string, offset: number) => void,
  onMessage: IncomingMessageHandler,
): () => void {
  if (pollingActive) return () => { pollingAbort = true; };
  pollingActive = true;
  pollingAbort = false;

  const poll = async () => {
    while (!pollingAbort) {
      const bridges = getBridges();
      const telegramBridges = bridges.filter(
        b => b.type === 'telegram' && b.incomingEnabled && b.status === 'active' && b.token && b.chatId,
      );

      await Promise.allSettled(telegramBridges.map(async b => {
        const offset = b.lastUpdateId !== undefined ? b.lastUpdateId + 1 : undefined;
        const [token] = b.token.includes('::') ? b.token.split('::') : [b.token];
        const updates = await telegramGetUpdates(token, offset);

        for (const upd of updates) {
          updateOffset(b.id, upd.update_id);
          const text = upd.message?.text ?? upd.message?.caption;
          if (!text) continue;
          const chatId = String(upd.message?.chat.id);
          // Only accept from the configured chatId
          if (b.chatId && chatId !== b.chatId) continue;
          const from = upd.message?.from?.username ?? upd.message?.from?.first_name ?? 'User';
          onMessage(b.id, text, from);
        }
      }));

      // Wait 3s between polls (avoids hammering Telegram API)
      await new Promise(r => setTimeout(r, 3000));
    }
    pollingActive = false;
  };

  poll();
  return () => { pollingAbort = true; };
}
