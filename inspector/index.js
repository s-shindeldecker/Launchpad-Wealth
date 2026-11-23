// Inspector sidecar — tails server.log (repo root) and streams parsed events over SSE.
//
//   GET /events   text/event-stream: the last ~200 events on connect, then live ones.
//   GET /health   { ok, file, exists }
//
// Read-only: it never talks to LaunchDarkly or the server, and nothing breaks if it's down.
// The server writes server.log only when started through tee (see inspector/README.md).
//
// Usage: npm run inspector   (INSPECTOR_PORT, default 4200; SERVER_LOG to override the path)

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createParser } from './parse.js';

const PORT = Number(process.env.INSPECTOR_PORT || 4200);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOG = path.resolve(repoRoot, process.env.SERVER_LOG || 'server.log');
const BACKLOG = 200;
const POLL_MS = 300;

const backlog = [];
const clients = new Set();

const parser = createParser({
  onEvent(e) {
    backlog.push(e);
    if (backlog.length > BACKLOG) backlog.shift();
    const frame = `data: ${JSON.stringify(e)}\n\n`;
    for (const res of clients) res.write(frame);
  },
});

// ---------- tail ----------
let offset = 0;
let partial = '';

function readNew() {
  let stat;
  try {
    stat = fs.statSync(LOG);
  } catch {
    return; // not created yet — keep polling
  }
  if (stat.size < offset) {
    // Truncated or replaced: start again from the top.
    offset = 0;
    partial = '';
  }
  if (stat.size === offset) return;
  const fd = fs.openSync(LOG, 'r');
  try {
    const buf = Buffer.alloc(stat.size - offset);
    fs.readSync(fd, buf, 0, buf.length, offset);
    offset = stat.size;
    const lines = (partial + buf.toString('utf8')).split('\n');
    partial = lines.pop(); // last piece has no newline yet
    for (const l of lines) parser.line(l);
  } finally {
    fs.closeSync(fd);
  }
}

// Whole existing file first (so sim devices are known), keeping only the last BACKLOG events.
readNew();
parser.goLive();
setInterval(readNew, POLL_MS);

// ---------- HTTP / SSE ----------
const server = http.createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*' };
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/events') {
    res.writeHead(200, {
      ...cors,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('retry: 3000\n\n');
    for (const e of backlog) res.write(`data: ${JSON.stringify(e)}\n\n`);
    clients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 15000);
    req.on('close', () => {
      clearInterval(ping);
      clients.delete(res);
    });
    return;
  }
  if (url.pathname === '/health') {
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, file: LOG, exists: fs.existsSync(LOG) }));
    return;
  }
  res.writeHead(404, cors);
  res.end();
});

server.listen(PORT, () => {
  console.log(`[inspector] tailing ${path.relative(repoRoot, LOG)} → http://localhost:${PORT}/events`);
  if (!fs.existsSync(LOG)) console.log('[inspector] server.log not found yet — waiting for it');
});
