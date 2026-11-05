// ZAXIRA AGENTI — Sherzod PC (05.11.2026)
// Jahongir serverdan (faqat teskari SSH tunnel orqali, 127.0.0.1:3003) buyruq yuboradi:
//   POST /run  {cmd, cwd?, timeout?}  sarlavha: x-token = C:\yukbor\zaxira.token
//   GET  /health
// Maqsad: zaxira saytni yangilash, failover sozlash — Sherzod akani bezovta qilmasdan.
// Tashqaridan ochiq emas: faqat 127.0.0.1 da tinglaydi, token bo'lmasa rad etadi.
const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const DIR = 'C:\yukbor';
const LOG = path.join(DIR, 'zaxira-agent.log');
const TOKEN = fs.readFileSync(path.join(DIR, 'zaxira.token'), 'utf8').trim();

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    if (fs.existsSync(LOG) && fs.statSync(LOG).size > 512 * 1024)
      fs.writeFileSync(LOG, fs.readFileSync(LOG, 'utf8').slice(-100_000));
    fs.appendFileSync(LOG, line);
  } catch {}
}

function readBody(req) {
  return new Promise((resolve) => {
    let s = '';
    req.on('data', (d) => { s += d; if (s.length > 1e6) req.destroy(); });
    req.on('end', () => resolve(s));
  });
}

const server = http.createServer(async (req, res) => {
  const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
  if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true, agent: 'zaxira-sherzod', time: Date.now() });
  if (req.headers['x-token'] !== TOKEN) return send(403, { error: 'token' });
  if (req.method === 'POST' && req.url === '/run') {
    let body;
    try { body = JSON.parse(await readBody(req)); } catch { return send(400, { error: 'json' }); }
    const cmd = String(body.cmd || '');
    if (!cmd) return send(400, { error: 'cmd' });
    const timeout = Math.min(Number(body.timeout) || 120_000, 900_000);
    const cwd = body.cwd || DIR;
    log(`run (${cwd}): ${cmd.slice(0, 300)}`);
    const t0 = Date.now();
    exec('chcp 65001>nul & ' + cmd, { cwd, timeout, maxBuffer: 8 * 1024 * 1024, windowsHide: true, shell: 'cmd.exe' }, (err, stdout, stderr) => {
      const out = { code: err ? (err.code ?? 1) : 0, ms: Date.now() - t0, stdout: String(stdout).slice(-200_000), stderr: String(stderr).slice(-50_000) };
      if (err && err.killed) out.timeout = true;
      send(200, out);
    });
    return;
  }
  send(404, { error: 'yoq' });
});

server.on('error', (e) => { log('server xato: ' + e.message); process.exit(1); });
server.listen(3003, '127.0.0.1', () => log('=== zaxira agenti ishga tushdi (127.0.0.1:3003) ==='));
