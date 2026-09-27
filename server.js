// Local web studio: serves the UI and proxies Seedance 2.5 requests so the
// Higgsfield credentials stay on the server.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODEL_ID, OPTIONS, SeedanceError, buildInput, createClient, estimateCost } from './src/seedance.js';

const PUBLIC_DIR = fileURLToPath(new URL('./public/', import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const MAX_BODY_BYTES = 64 * 1024;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

let client;
function getClient() {
  client ??= createClient();
  return client;
}

// request_id -> { status_url, cancel_url }. The browser only ever sees request ids.
const requests = new Map();

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new SeedanceError('Request body too large', { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw new SeedanceError('Request body must be JSON', { status: 400 });
  }
}

function publicStatus(body) {
  const { status_url, cancel_url, ...rest } = body;
  return rest;
}

function lookup(id) {
  const entry = requests.get(id);
  if (!entry) throw new SeedanceError(`Unknown request ${id}`, { status: 404 });
  return entry;
}

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/options') {
    return sendJson(res, 200, { model: MODEL_ID, options: OPTIONS });
  }
  if (req.method === 'POST' && url.pathname === '/api/estimate') {
    const input = buildInput({ prompt: '-', ...(await readJson(req)) });
    return sendJson(res, 200, estimateCost(input));
  }
  if (req.method === 'POST' && url.pathname === '/api/generate') {
    const queued = await getClient().submit(await readJson(req));
    requests.set(queued.request_id, { status_url: queued.status_url, cancel_url: queued.cancel_url });
    return sendJson(res, 202, publicStatus(queued));
  }
  const match = url.pathname.match(/^\/api\/requests\/([\w-]+)(\/cancel)?$/);
  if (match) {
    const entry = lookup(match[1]);
    if (req.method === 'GET' && !match[2]) {
      return sendJson(res, 200, publicStatus(await getClient().status(entry.status_url)));
    }
    if (req.method === 'POST' && match[2]) {
      if (!entry.cancel_url) throw new SeedanceError('This request cannot be canceled', { status: 409 });
      return sendJson(res, 200, publicStatus(await getClient().cancel(entry.cancel_url)));
    }
  }
  sendJson(res, 404, { error: 'Not found' });
}

async function serveStatic(res, pathname) {
  const file = normalize(join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname));
  if (!file.startsWith(PUBLIC_DIR)) return sendJson(res, 403, { error: 'Forbidden' });
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    sendJson(res, 404, { error: 'Not found' });
  }
}

export const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
    await serveStatic(res, url.pathname);
  } catch (err) {
    const status = err instanceof SeedanceError && err.status >= 400 && err.status < 600 ? err.status : 500;
    if (status >= 500) console.error(err);
    sendJson(res, status, { error: err.message });
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => console.log(`AI Video Studio running at http://localhost:${PORT}`));
}
