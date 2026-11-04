// AVTOMATIK ALMASHTIRGICH (16.08.2026)
// Har daqiqa Timeweb serverini tekshiradi:
//   3 marta ketma-ket javob bermasa -> theirscargo.uz DNS'ini Sherzod PC
//   tunneliga o'tkazadi (foydalanuvchilar zaxira serverni ko'radi).
//   Server 5 daqiqa barqaror qaytgach -> DNS'ni Timeweb'ga qaytaradi.
// Zona Cloudflare'da faol bo'lmagunicha hech narsa qilmaydi.
const fs = require('fs');
const path = require('path');

const LOG = path.join(__dirname, 'cf-failover.log');
const TOKEN = fs.readFileSync(path.join(__dirname, 'cf-token.txt'), 'utf8').trim();
const ZONE = 'b4a0243b546d16a9c44e118ade4f8824';
const ORIGIN_IP = '46.8.114.230';
const TUNNEL_CNAME = '92fd5a4c-0d95-4d9e-ae8e-10e5b9eed99c.cfargotunnel.com';
const CHECK_MS = 60_000;
const FAIL_LIMIT = 3;   // 3 daqiqa javobsiz -> almashtirish
const OK_LIMIT = 5;     // 5 daqiqa barqaror -> qaytarish

let fails = 0, oks = 0;
let mode = 'unknown'; // 'primary' (Timeweb) | 'backup' (tunnel)

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

async function originAlive() {
  try {
    const r = await fetch('http://' + ORIGIN_IP + '/', {
      headers: { Host: 'theirscargo.uz' },
      signal: AbortSignal.timeout(10000),
      redirect: 'manual',
    });
    return r.status > 0 && r.status < 600;
  } catch {
    return false;
  }
}

async function zoneActive() {
  try { return (await cf('GET', '/zones/' + ZONE)).result?.status === 'active'; }
  catch { return false; }
}

// @ yozuvini topish (A yoki CNAME)
async function rootRecord() {
  const r = await cf('GET', '/zones/' + ZONE + '/dns_records?name=theirscargo.uz');
  return (r.result || []).find((x) => x.type === 'A' || x.type === 'CNAME') || null;
}

async function setRoot(type, content) {
  const rec = await rootRecord();
  const body = { type, name: 'theirscargo.uz', content, proxied: true, ttl: 1 };
  const res = rec
    ? await cf('PUT', '/zones/' + ZONE + '/dns_records/' + rec.id, body)
    : await cf('POST', '/zones/' + ZONE + '/dns_records', body);
  if (!res.success) throw new Error(JSON.stringify(res.errors));
}

async function tick() {
  try {
    const alive = await originAlive();
    if (alive) { fails = 0; oks++; } else { oks = 0; fails++; }

    if (mode === 'unknown') {
      const rec = await rootRecord();
      mode = rec && rec.type === 'CNAME' ? 'backup' : 'primary';
      log(`boshlang'ich rejim: ${mode}`);
    }

    if (mode === 'primary' && fails >= FAIL_LIMIT) {
      if (!(await zoneActive())) { log('server javobsiz, lekin zona hali faol emas — kutaman'); fails = 0; return; }
      log(`SERVER YIQILDI (${FAIL_LIMIT} daqiqa javobsiz) — DNS zaxiraga o'tkazilmoqda...`);
      await setRoot('CNAME', TUNNEL_CNAME);
      mode = 'backup';
      fails = 0;
      log("DNS -> Sherzod PC tunneli. Sayt zaxiradan ishlayapti.");
    } else if (mode === 'backup' && oks >= OK_LIMIT) {
      log(`SERVER QAYTDI (${OK_LIMIT} daqiqa barqaror) — DNS asosiyga qaytarilmoqda...`);
      await setRoot('A', ORIGIN_IP);
      mode = 'primary';
      oks = 0;
      log('DNS -> Timeweb. MUHIM: zaxira davrida tushgan e\'lonlarni ko\'chirish kerak!');
    }
  } catch (e) {
    log('XATO: ' + e.message);
  }
}

log('=== almashtirgich ishga tushdi ===');
tick();
setInterval(tick, CHECK_MS);
