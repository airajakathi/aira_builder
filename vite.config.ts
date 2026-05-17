import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'
import fs from 'fs'
import path from 'path'
import { exec, spawn } from 'child_process'
import type { ChildProcess } from 'child_process'
import net from 'net'
import { WebSocketServer } from 'ws'
import os from 'os'

const WORKSPACE = path.resolve(__dirname, 'workspace')
fs.mkdirSync(WORKSPACE, { recursive: true })

// ─── CORS proxy middleware ────────────────────────────────────────────────────
function corsProxyPlugin(): Plugin {
  return {
    name: 'cors-proxy',
    configureServer(server) {
      server.middlewares.use('/api/proxy', async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          });
          res.end();
          return;
        }
        if (req.method !== 'POST') { res.writeHead(405); res.end('Method Not Allowed'); return; }

        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        let payload: { targetUrl: string; method: string; headers: Record<string, string>; body: string };
        try { payload = JSON.parse(Buffer.concat(chunks).toString()); }
        catch { res.writeHead(400); res.end('Bad JSON'); return; }

        const { targetUrl, method, headers, body } = payload;
        if (!targetUrl || !targetUrl.startsWith('http')) { res.writeHead(400); res.end('Invalid targetUrl'); return; }

        try {
          const upstream = await fetch(targetUrl, {
            method: method ?? 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body,
          });
          const upstreamBody = await upstream.text();
          res.writeHead(upstream.status, {
            'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(upstreamBody);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: { message: `Proxy error: ${msg}`, type: 'proxy_error' } }));
        }
      });
    },
  };
}

// ─── Workspace server plugin ──────────────────────────────────────────────────
// Handles: file writes to disk, command execution, terminal WebSocket
function workspacePlugin(): Plugin {
  return {
    name: 'workspace-server',
    configureServer(server) {

      // Helper to read body
      async function readBody(req: IncomingMessage): Promise<unknown> {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        return JSON.parse(Buffer.concat(chunks).toString());
      }

      function json(res: ServerResponse, status: number, data: unknown) {
        const body = JSON.stringify(data);
        res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(body);
      }

      // Sanitise project slug
      function projectDir(projectId: string, projectName: string) {
        const slug = projectName.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').slice(0, 40);
        const dir = path.join(WORKSPACE, `${slug}-${projectId.slice(0, 8)}`);
        fs.mkdirSync(dir, { recursive: true });
        return dir;
      }

      // POST /api/workspace/write  { projectId, projectName, path, content }
      server.middlewares.use('/api/workspace/write', async (req, res) => {
        if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' }); res.end(); return; }
        try {
          const { projectId, projectName, path: filePath, content } = await readBody(req) as Record<string, string>;
          const dir = projectDir(projectId, projectName);
          const abs = path.join(dir, filePath.replace(/^\//, ''));
          fs.mkdirSync(path.dirname(abs), { recursive: true });
          fs.writeFileSync(abs, content, 'utf8');
          json(res, 200, { ok: true, abs });
        } catch (e) {
          json(res, 500, { error: String(e) });
        }
      });

      // POST /api/workspace/exec  { projectId, projectName, command }
      server.middlewares.use('/api/workspace/exec', async (req, res) => {
        if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' }); res.end(); return; }
        try {
          const { projectId, projectName, command } = await readBody(req) as Record<string, string>;
          const dir = projectDir(projectId, projectName);
          exec(command, { cwd: dir, timeout: 120_000, maxBuffer: 1024 * 1024 * 4 }, (err, stdout, stderr) => {
            json(res, 200, { ok: !err, stdout, stderr, exitCode: err?.code ?? 0 });
          });
        } catch (e) {
          json(res, 500, { error: String(e) });
        }
      });

      // Running dev servers: projectId -> { process, port, url }
      const devServers = new Map<string, { proc: ChildProcess; port: number; url: string }>();

      // Find a free port
      function getFreePort(preferred: number): Promise<number> {
        return new Promise(resolve => {
          const srv = net.createServer();
          srv.listen(preferred, () => { const p = (srv.address() as net.AddressInfo).port; srv.close(() => resolve(p)); });
          srv.on('error', () => {
            const srv2 = net.createServer();
            srv2.listen(0, () => { const p = (srv2.address() as net.AddressInfo).port; srv2.close(() => resolve(p)); });
          });
        });
      }

      // Resolve the public tunnel URL for a given port
      // In Bud/Orchids sandbox: https://<port>-<hostname>.bud.computer
      // Fallback: http://localhost:<port>
      function publicUrl(port: number): string {
        const hostname = os.hostname();
        if (hostname && hostname !== 'localhost' && !hostname.startsWith('127.')) {
          return `https://${port}-${hostname}.bud.computer`;
        }
        return `http://localhost:${port}`;
      }

      // POST /api/workspace/start  { projectId, projectName, command, port? }
      // Starts a long-running dev server in the background, returns its URL once ready
      server.middlewares.use('/api/workspace/start', async (req, res) => {
        if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' }); res.end(); return; }
        try {
          const { projectId, projectName, command, preferredPort } = await readBody(req) as Record<string, string>;
          const dir = projectDir(projectId, projectName);

          // Kill existing server for this project
          const existing = devServers.get(projectId);
          if (existing) { try { existing.proc.kill('SIGTERM'); } catch {} devServers.delete(projectId); }

          const port = await getFreePort(Number(preferredPort) || 5174);

          // Build the final command with port injection
          const isExpo = /\bexpo\b/.test(command.toLowerCase());
          let finalCmd: string;

          if (isExpo) {
            // Expo: run web-only with explicit port via env, remove any existing expo start flags
            const base = command.replace(/expo start.*/, 'expo start');
            finalCmd = `${base} --web`;
          } else {
            // Vite / Next / generic: inject --port if not already present
            const withPort = command.replace(/--port\s+\d+/, `--port ${port}`);
            finalCmd = withPort.includes('--port') ? withPort : `${withPort} --port ${port}`;
          }

          const proc = spawn('sh', ['-c', finalCmd], {
            cwd: dir,
            env: {
              ...process.env,
              PORT: String(port),
              BROWSER: 'none',
              CI: 'false',
              EXPO_NO_DOTENV: '1',
            },
            detached: false,
          });

          const url = publicUrl(port);
          devServers.set(projectId, { proc, port, url });

          // Wait up to 45s for server to be ready
          let ready = false;
          const outputBuf: string[] = [];

          const onData = (data: Buffer) => {
            const text = data.toString();
            outputBuf.push(text);
            if (!ready && (
              text.includes('localhost') ||
              text.includes('Local:') ||
              text.includes('ready') ||
              text.includes('started') ||
              text.includes('Bundl') ||         // Expo: "Bundling..."
              text.includes('compiled') ||       // Next.js
              text.includes('dev server running') ||
              /https?:\/\//.test(text)           // any URL appearing in output
            )) {
              ready = true;
            }
          };

          proc.stdout?.on('data', onData);
          proc.stderr?.on('data', onData);

          // Also detect early crash
          let crashed = false;
          proc.on('exit', (code) => { if (code !== 0 && code !== null) crashed = true; });

          // Poll until ready or timeout (45s for Expo which is slower)
          await new Promise<void>(resolve => {
            const start = Date.now();
            const timeout = isExpo ? 45000 : 30000;
            const check = setInterval(() => {
              if (ready || crashed || Date.now() - start > timeout) { clearInterval(check); resolve(); }
            }, 500);
          });

          json(res, 200, { ok: true, url, port, output: outputBuf.join('').slice(-2000) });
        } catch (e) {
          json(res, 500, { error: String(e) });
        }
      });

      // POST /api/workspace/stop  { projectId }
      server.middlewares.use('/api/workspace/stop', async (req, res) => {
        try {
          const { projectId } = await readBody(req) as Record<string, string>;
          const srv = devServers.get(projectId);
          if (srv) { try { srv.proc.kill('SIGTERM'); } catch {} devServers.delete(projectId); }
          json(res, 200, { ok: true });
        } catch (e) { json(res, 500, { error: String(e) }); }
      });

      // GET /api/workspace/servers  list running servers
      server.middlewares.use('/api/workspace/servers', async (req, res) => {
        const qs = new URL(req.url ?? '', 'http://x').searchParams;
        const projectId = qs.get('projectId');
        if (projectId) {
          const srv = devServers.get(projectId);
          const url = srv ? publicUrl(srv.port) : undefined;
          json(res, 200, srv ? { running: true, url, port: srv.port } : { running: false });
        } else {
          const all: Record<string, { url: string; port: number }> = {};
          devServers.forEach((v, k) => { all[k] = { url: publicUrl(v.port), port: v.port }; });
          json(res, 200, all);
        }
      });

      // GET /api/workspace/info/:projectId  returns disk path
      server.middlewares.use('/api/workspace/info', async (req, res) => {
        try {
          const qs = new URL(req.url ?? '', 'http://x').searchParams;
          const projectId = qs.get('projectId') ?? '';
          const projectName = qs.get('projectName') ?? 'project';
          const dir = projectDir(projectId, projectName);
          json(res, 200, { dir, workspace: WORKSPACE });
        } catch (e) {
          json(res, 500, { error: String(e) });
        }
      });

      // WebSocket terminal  ws://localhost:5173/api/terminal?projectId=...&projectName=...
      server.httpServer?.once('listening', () => {
        // Attach a WS server on the same HTTP server, filter by path
        const wss = new WebSocketServer({ noServer: true });

        server.httpServer!.on('upgrade', (request, socket, head) => {
          const url = new URL(request.url ?? '', 'http://x');
          if (url.pathname !== '/api/terminal') return;
          wss.handleUpgrade(request, socket as import('net').Socket, head, async (ws) => {
            const projectId = url.searchParams.get('projectId') ?? 'default';
            const projectName = url.searchParams.get('projectName') ?? 'project';
            const dir = projectDir(projectId, projectName);

            // Lazy import node-pty
            const pty = await import('node-pty');
            const shell = os.platform() === 'win32' ? 'cmd.exe' : (process.env.SHELL ?? '/bin/bash');
            const term = pty.spawn(shell, [], {
              name: 'xterm-256color',
              cols: 120, rows: 40,
              cwd: dir,
              env: { ...process.env, TERM: 'xterm-256color' },
            });

            term.onData(data => { if (ws.readyState === ws.OPEN) ws.send(data); });
            ws.on('message', (msg) => term.write(msg.toString()));
            ws.on('close', () => term.kill());
            term.onExit(() => { if (ws.readyState === ws.OPEN) ws.close(); });
          });
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), corsProxyPlugin(), workspacePlugin()],
  server: {
    port: 5173,
    host: true,
    // Ignore workspace folder — AI writes project files there during generation.
    // Without this, every file write triggers Vite HMR and reloads the page.
    watch: {
      ignored: [
        '**/workspace/**',
        '**/.git/**',
      ],
    },
  },
  define: {
    global: 'globalThis',
  },
})
