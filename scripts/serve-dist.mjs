// Serves dist/ under /chw-timesheet/, the same path GitHub Pages uses. For preview and e2e only.
// Usage: node scripts/serve-dist.mjs [port] [folder]; the folder (default dist/) lets the update
// e2e serve a copy it changes.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const BASE = '/chw-timesheet/';
const port = Number(process.argv[2] ?? 4173);
const dist = process.argv[3] ? resolve(process.argv[3]) : join(import.meta.dirname, '..', 'dist');

/** @type {Record<string, string>} */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
};

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  if (path === '/chw-timesheet') {
    res.writeHead(301, { location: BASE }).end();
    return;
  }
  if (!path.startsWith(BASE)) {
    res.writeHead(404).end('Not found');
    return;
  }
  const relative = path.slice(BASE.length) || 'index.html';
  const file = normalize(join(dist, relative));
  if (!file.startsWith(dist + sep) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404).end('Not found');
    return;
  }
  res.writeHead(200, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'cache-control': 'no-cache',
  });
  createReadStream(file).pipe(res);
}).listen(port, () => {
  console.log(`Serving ${dist} at http://localhost:${String(port)}${BASE}`);
});
