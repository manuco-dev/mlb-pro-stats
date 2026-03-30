import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);

async function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!existsSync(envPath)) return;
  const raw = await readFile(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.ico') return 'image/x-icon';
  return 'text/plain; charset=utf-8';
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function sendFile(res, filePath) {
  const content = await readFile(filePath);
  res.writeHead(200, { 'Content-Type': mimeType(filePath) });
  res.end(content);
}

async function handleApi(req, res, pathname) {
  const routeName = pathname.replace(/^\/api\//, '').replace(/\/+$/, '');
  const modulePath = path.join(__dirname, 'api', `${routeName}.js`);
  if (!routeName || !existsSync(modulePath)) {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'API no encontrada' }));
    return;
  }
  try {
    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readRequestBody(req);
    const request = new Request(`http://localhost:${PORT}${req.url}`, {
      method: req.method,
      headers: req.headers,
      body
    });
    const mod = await import(pathToFileURL(modulePath).href);
    const response = await mod.default(request);
    if (!(response instanceof Response)) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'Respuesta inválida del handler' }));
      return;
    }
    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    const data = Buffer.from(await response.arrayBuffer());
    res.writeHead(response.status, headers);
    res.end(data);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: error.message }));
  }
}

async function handleStatic(req, res, pathname) {
  const cleanPath = pathname === '/' ? '/index.html' : pathname;
  const requestedFile = path.join(__dirname, cleanPath);
  const canServeFile =
    existsSync(requestedFile) &&
    path.extname(requestedFile) &&
    !requestedFile.includes(`${path.sep}api${path.sep}`);
  const filePath = canServeFile ? requestedFile : path.join(__dirname, 'index.html');
  await sendFile(res, filePath);
}

await loadEnv();

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://localhost:${PORT}`);
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url.pathname);
      return;
    }
    await handleStatic(req, res, url.pathname);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(error.message);
  }
});

server.listen(PORT, () => {
  process.stdout.write(`MLB Stats local server running on http://localhost:${PORT}\n`);
});
