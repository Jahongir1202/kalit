// AVTOMATIK ALMASHTIRGICH v2 (05.11.2026) — Sherzod PC
// Har daqiqa asosiy serverni (Airnet 46.8.114.230) tekshiradi:
//   3 marta ketma-ket javob bermasa -> 2021.uz va theirscargo.uz DNS'ini Sherzod PC
//   tunneliga o'tkazadi (foydalanuvchilar zaxira saytni ko'radi).
//   Server 5 daqiqa barqaror qaytgach -> DNS'ni asosiy serverga qaytaradi.
// Faqat Cloudflare'da faol (active) zonalar buriladi; pending zona o'tkazib yuboriladi.
const fs = require('fs');
const path = require('path');

const LOG = path.join(__dirname, 'cf-failover.log');
const TOKEN = fs.readFileSync(path.join(__dirname, 'cf-token.txt'), 'utf8').trim();
const ORIGIN_IP = '46.8.114.230';
const TUNNEL_CNAME = '92fd5a4c-0d95-4d9e-ae8e-10e5b9eed99c.cfargotunnel.com';
const ZONES = [
  { id: '6b43dcdd784eb7ba6f8e7968a4cbc99d', name: '2021.uz' },
  { id: 'b4a0243b546d16a9c44e118ade4f8824', name: 'theirscargo.uz' },
];
const CHECK_MS = 60_000;
const FAIL_LIMIT = 3;   // 3 daqiqa javobsiz -> almashtirish
const OK_LIMIT = 5;     // 5 daqiqa barqaror -> qaytarish

let fails = 0, oks = 0;
let mode = 'unknown'; // 'primary' | 'backup'

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    if (fs.existsSync(LOG) && fs.statSync(LOG).size > 512 * 1024)
      fs.writeFileSync(LOG, fs.readFileSync(LOG, 'utf8').slice(-100_000));
    fs.appendFileSync(LOG, line);
  } catch {}
}

async function cf(method, url, body) {
  const r = await fetch('https://api.cloudflare.com/client/v4' + url, {
    method,
    headers: { Authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  return r.json();
}

// Asosiy server tirikmi: 2 ta domen nomi bilan so'raladi, bittasi javob bersa — tirik
async function originAlive() {
  for (const host of ['2021.uz', 'theirscargo.uz']) {
    try {
      const r = await fetch('http://' + ORIGIN_IP + '/', {
        headers: { Host: host },
        signal: AbortSignal.timeout(10000),
        redirect: 'manual',
      });
      if (r.status > 0 && r.status < 500) return true;
    } catch {}
  }
  return false;
}

async function zoneActive(z) {
  try { return (await cf('GET', '/zones/' + z.id)).result?.status === 'active'; }
  catch { return false; }
}

async function rootRecord(z) {
  const r = await cf('GET', '/zones/' + z.id + '/dns_records?name=' + z.name);
  return (r.result || []).find((x) => x.type === 'A' || x.type === 'CNAME') || null;
}

async function setRoot(z, type, content) {
  const rec = await rootRecord(z);
  const body = { type, name: z.name, content, proxied: true, ttl: 1 };
  const res = rec
    ? await cf('PUT', '/zones/' + z.id + '/dns_records/' + rec.id, body)
    : await cf('POST', '/zones/' + z.id + '/dns_records', body);
  if (!res.success) throw new Error(z.name + ': ' + JSON.stringify(res.errors));
}

async function switchAll(toBackup) {
  for (const z of ZONES) {
    try {
      if (!(await zoneActive(z))) { log(`${z.name}: zona faol emas — o'tkazib yuborildi`); continue; }
      if (toBackup) await setRoot(z, 'CNAME', TUNNEL_CNAME);
      else await setRoot(z, 'A', ORIGIN_IP);
      log(`${z.name} -> ${toBackup ? 'ZAXIRA (Sherzod PC tunneli)' : 'ASOSIY (' + ORIGIN_IP + ')'}`);
    } catch (e) { log('XATO ' + e.message); }
  }
}

async function tick() {
  try {
    const alive = await originAlive();
    if (alive) { fails = 0; oks++; } else { oks = 0; fails++; }

    if (mode === 'unknown') {
      const rec = await rootRecord(ZONES[1]); // theirscargo.uz doim faol — holat shundan
      mode = rec && rec.type === 'CNAME' ? 'backup' : 'primary';
      log(`boshlang'ich rejim: ${mode}`);
    }

    if (mode === 'primary' && fails >= FAIL_LIMIT) {
      log(`SERVER YIQILDI (${FAIL_LIMIT} daqiqa javobsiz) — DNS zaxiraga o'tkazilmoqda...`);
      await switchAll(true);
      mode = 'backup'; fails = 0;
      log('Sayt zaxiradan ishlayapti.');
    } else if (mode === 'backup' && oks >= OK_LIMIT) {
      log(`SERVER QAYTDI (${OK_LIMIT} daqiqa barqaror) — DNS asosiyga qaytarilmoqda...`);
      await switchAll(false);
      mode = 'primary'; oks = 0;
      log("DNS -> asosiy server. MUHIM: zaxira davrida tushgan e'lonlar asosiy bazada yo'q (bot ingest zaxiraga yozgan).");
    } else if (mode === 'backup' && fails > 0 && fails % 10 === 0) {
      // zaxira rejimida yangi faollashgan zona bo'lsa (masalan 2021.uz keyin active bo'lsa) uni ham buramiz
      await switchAll(true);
    }
  } catch (e) {
    log('XATO: ' + e.message);
  }
}

log('=== almashtirgich v2 ishga tushdi (2021.uz + theirscargo.uz) ===');
tick();
setInterval(tick, CHECK_MS);
