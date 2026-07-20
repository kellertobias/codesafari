/**
 * `codesafari dev` server — serves the viewer and a live manifest, watches
 * content, and pushes rebuild notifications over WebSocket.
 */

import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import chokidar from 'chokidar';
import { WebSocketServer, type WebSocket } from 'ws';
import { buildManifest } from '../manifest/build.js';
import { IgnoreMatcher } from '../ignore/ignore.js';
import { viewerBuilt, viewerDistDir } from '../commands/paths.js';

export interface DevOptions {
  port: number;
  /** Open the site in the default browser on startup (default true). */
  open?: boolean;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
};

export async function runDev(root: string, options: DevOptions): Promise<void> {
  const resolved = path.resolve(root);

  if (!(await viewerBuilt())) {
    throw new Error(
      'Prebuilt viewer assets are missing (viewer-dist/). Run `npm run build:viewer` first.',
    );
  }

  let manifestJson = await rebuild(resolved);

  const server = http.createServer((req, res) => {
    handleRequest(req, res, () => manifestJson).catch((err) => {
      res.writeHead(500);
      res.end(String(err));
    });
  });

  const wss = new WebSocketServer({ server });
  const clients = new Set<WebSocket>();
  wss.on('connection', (ws) => {
    clients.add(ws);
    ws.on('close', () => clients.delete(ws));
  });

  const broadcast = () => {
    for (const ws of clients) {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: 'reload' }));
    }
  };

  await setupWatcher(resolved, async () => {
    try {
      manifestJson = await rebuild(resolved);
      broadcast();
      console.log('Manifest rebuilt.');
    } catch (err) {
      console.error('Rebuild failed:', (err as Error).message);
    }
  });

  await new Promise<void>((resolve) => server.listen(options.port, resolve));
  const url = `http://localhost:${options.port}`;
  console.log(`CodeSafari dev server running at ${url}`);
  console.log('Watching .tour/ and source files. Press Ctrl+C to stop.');

  if (options.open !== false) {
    console.log('Opening your browser…');
    openBrowser(url);
  }
}

/**
 * Open a URL in the platform's default browser. Best-effort: a missing browser
 * or launcher never crashes the server.
 */
function openBrowser(url: string): void {
  const command =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'cmd'
        : 'xdg-open';
  // On Windows, `start` is a cmd builtin; the empty "" is the window title.
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    const child = spawn(command, args, { stdio: 'ignore', detached: true });
    child.on('error', () => {
      /* No launcher available (e.g. headless CI); ignore. */
    });
    child.unref();
  } catch {
    /* Spawning failed outright; ignore. */
  }
}

async function rebuild(root: string): Promise<string> {
  const { manifest, diagnostics } = await buildManifest(root, {
    bundleSources: true,
  });
  for (const d of diagnostics) {
    const location = d.file ? `${d.file}${d.line ? `:${d.line}` : ''}  ` : '';
    console.log(`  ${d.severity === 'error' ? 'error' : 'warn'}  ${location}${d.message}`);
  }
  return JSON.stringify(manifest);
}

async function setupWatcher(root: string, onChange: () => void): Promise<void> {
  const ignore = await IgnoreMatcher.load(root);
  const watcher = chokidar.watch(root, {
    ignoreInitial: true,
    ignored: (p: string) => {
      const base = path.basename(p);
      if (base === '.git' || base === 'node_modules') return true;
      // Always watch .tour/ and ignore-config files; otherwise honor ignores.
      if (IgnoreMatcher.files.includes(base)) return false;
      const rel = path.relative(root, p);
      if (rel.startsWith('.tour')) return false;
      return ignore.ignores(p);
    },
  });

  let timer: NodeJS.Timeout | null = null;
  const debounced = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(onChange, 120);
  };
  watcher.on('add', debounced).on('change', debounced).on('unlink', debounced);
}

async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  getManifest: () => string,
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (url.pathname === '/data/manifest.json') {
    res.writeHead(200, { 'content-type': MIME['.json'] });
    res.end(getManifest());
    return;
  }

  await serveStatic(url.pathname, res);
}

async function serveStatic(
  pathname: string,
  res: http.ServerResponse,
): Promise<void> {
  const dir = viewerDistDir();
  let rel = decodeURIComponent(pathname).replace(/^\/+/, '');
  if (rel === '') rel = 'index.html';

  const target = path.join(dir, rel);
  // Prevent path traversal outside the viewer directory.
  if (!target.startsWith(dir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Never cache in dev, so a rebuilt viewer (new hashed asset names referenced
  // by a fresh index.html) is always picked up on reload.
  const noCache = { 'cache-control': 'no-store' };

  try {
    const data = await fs.readFile(target);
    res.writeHead(200, {
      'content-type': MIME[path.extname(target)] ?? 'application/octet-stream',
      ...noCache,
    });
    res.end(data);
  } catch {
    // SPA fallback: serve index.html for unknown routes.
    try {
      const html = await fs.readFile(path.join(dir, 'index.html'));
      res.writeHead(200, { 'content-type': MIME['.html'], ...noCache });
      res.end(html);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  }
}
