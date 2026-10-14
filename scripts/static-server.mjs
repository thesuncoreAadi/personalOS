#!/usr/bin/env node
/**
 * Dependency-free static file server for the production build.
 *
 *   node scripts/static-server.mjs [dir] [port] [host]
 *   node scripts/static-server.mjs dist 8080 0.0.0.0
 *
 * Serves a built SPA: unknown paths that do not look like files fall back to index.html, so both
 * hash routing and history routing work. Never serves outside the chosen directory.
 */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const dir = resolve(process.argv[2] ?? 'dist');
const port = Number(process.argv[3] ?? 8080);
const host = process.argv[4] ?? '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

const indexHtml = join(dir, 'index.html');

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const target = resolve(join(dir, normalize(decoded)));
  // Containment check: never escape the served directory.
  if (target !== dir && !target.startsWith(dir + sep)) return null;
  return target;
}

async function sendFile(res, filePath, status = 200) {
  const info = await stat(filePath);
  if (info.isDirectory()) return sendFile(res, join(filePath, 'index.html'), status);
  res.writeHead(status, {
    'content-type': MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    'content-length': info.size,
    'cache-control': filePath === indexHtml ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  createReadStream(filePath).pipe(res);
}

const server = createServer(async (req, res) => {
  const target = safePath(req.url ?? '/');
  if (!target) {
    res.writeHead(403, { 'content-type': 'text/plain' });
    res.end('Forbidden');
    return;
  }
  try {
    await sendFile(res, target);
  } catch {
    try {
      await sendFile(res, indexHtml, 200); // SPA fallback
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('Not found. Did you run "npm run build" first?');
    }
  }
});

server.listen(port, host, () => {
  console.log(`Serving ${dir}`);
  console.log(`  http://localhost:${port}`);
  console.log(`  on this network: http://<this-machine-ip>:${port}`);
  console.log('Press Ctrl+C to stop.');
});
