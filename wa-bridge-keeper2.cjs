// WHATSAPP KO'PRIK QO'RIQCHISI — Sherzod PC (16.08.2026, ko'chirilgan)
// Teskari SSH: server:3001->lokal bot, server:3002->lokal agent, server:3003->zaxira agenti.
// (05.11) zaxira-agent.cjs ni ham shu qo'riqchi ushlab turadi.
// Kalit: C:\yukbor\id_yukbor (parolsiz, faqat shu server uchun).
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const DIR = 'C:\\yukbor';
const LOG = path.join(DIR, 'wa-bridge.log');
const SSH = 'C:\\Windows\\System32\\OpenSSH\\ssh.exe';
const KEY = path.join(DIR, 'id_yukbor');

let child = null;
let backoffMs = 5000;

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    if (fs.existsSync(LOG) && fs.statSync(LOG).size > 512 * 1024)
      fs.writeFileSync(LOG, fs.readFileSync(LOG, 'utf8').slice(-100_000));
    fs.appendFileSync(LOG, line);
  } catch {}
}

function start() {
  const started = Date.now();
  child = spawn(SSH, [
    '-N',
    '-i', KEY,
    '-R', '3001:127.0.0.1:3001',
    '-R', '3002:127.0.0.1:3002',
    '-R', '3003:127.0.0.1:3003',
    '-o', 'BatchMode=yes',
    '-o', 'StrictHostKeyChecking=accept-new',
    '-o', 'ServerAliveInterval=15',
    '-o', 'ServerAliveCountMax=3',
    '-o', 'ExitOnForwardFailure=yes',
    'root@46.8.114.230',
  ], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });

  child.stderr.on('data', (d) => {
    const s = String(d).trim();
    if (s) log('ssh: ' + s.slice(0, 200));
    if (/remote port forwarding failed/i.test(s)) {
      log("server portni band qilib qolgan — bo'shataman");
      const fix = spawn(SSH, [
        '-i', KEY, '-o', 'BatchMode=yes', 'root@46.8.114.230',
        "for P in 3001 3002 3003; do PID=$(ss -tlnp | grep \":$P\" | grep -oP 'pid=\\K[0-9]+' | head -1); [ -n \"$PID\" ] && kill $PID; done; true",
      ], { stdio: 'ignore', windowsHide: true });
      fix.on('exit', (c) => log("port bo'shatish: kod " + c));
    }
  });

  log(`tunnel ochildi (PID ${child.pid})`);

  child.on('exit', (code) => {
    const lived = Date.now() - started;
    if (lived < 30_000) backoffMs = Math.min(backoffMs * 2, 3 * 60_000);
    else backoffMs = 5000;
    log(`tunnel uzildi (kod ${code}, ${Math.round(lived / 1000)}s) — ${backoffMs / 1000}s dan keyin qayta`);
    child = null;
    setTimeout(start, backoffMs);
  });
}

// ---- zaxira agenti (127.0.0.1:3003) — tirik bo'lmasa ochiladi, har daqiqa tekshiriladi ----
const http = require('http');
function agentAlive() {
  return new Promise((resolve) => {
    const r = http.get('http://127.0.0.1:3003/health', { timeout: 5000 }, (res) => { res.resume(); resolve(res.statusCode === 200); });
    r.on('timeout', () => { r.destroy(); resolve(false); });
    r.on('error', () => resolve(false));
  });
}
async function ensureAgent() {
  if (await agentAlive()) return;
  const script = path.join(DIR, 'zaxira-agent.cjs');
  if (!fs.existsSync(script) || !fs.existsSync(path.join(DIR, 'zaxira.token'))) return;
  const a = spawn(process.execPath, [script], { cwd: DIR, detached: true, stdio: 'ignore', windowsHide: true });
  a.unref();
  log(`zaxira agenti ochildi (PID ${a.pid})`);
}

log("=== ko'prik qo'riqchisi ishga tushdi (Sherzod PC) ===");
start();
ensureAgent();
setInterval(ensureAgent, 60_000);
