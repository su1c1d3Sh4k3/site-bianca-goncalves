'use strict';
/*
  Servidor do site da Bianca Gonçalves.
  - Serve o site estático (index, assets, política etc.).
  - /painel: painel de anúncios protegido por e-mail e senha (variáveis de ambiente).
  - /api/ads-ingest: recebe os números enviados pelo script do Google Ads (token secreto).
  - /api/evt: registra o que as visitantes fazem no site (visita, rolagem, cliques), sem dados pessoais.
  Sem dependências externas e sem banco de dados: os dados ficam em um arquivo JSON.

  Variáveis de ambiente:
    PAINEL_EMAIL     e-mail de acesso ao painel
    PAINEL_SENHA     senha de acesso ao painel
    SESSION_SECRET   texto longo e aleatório para assinar o cookie de sessão
    INGEST_TOKEN     token que o script do Google Ads envia no cabeçalho X-Token
    DATA_DIR         pasta onde o arquivo de dados é salvo (padrão: ./data)
    PORT             porta HTTP (padrão: 80)
*/

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SERVER_DIR = __dirname;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const DATA_FILE = path.join(DATA_DIR, 'ads.json');
const EVENTS_FILE = path.join(DATA_DIR, 'visitas.jsonl');
const PORT = Number(process.env.PORT || 80);

const PAINEL_EMAIL = (process.env.PAINEL_EMAIL || '').trim().toLowerCase();
const PAINEL_SENHA = process.env.PAINEL_SENHA || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const INGEST_TOKEN = process.env.INGEST_TOKEN || '';
const SESSION_DAYS = 14;
const COOKIE = 'bg_painel';

if (!PAINEL_EMAIL || !PAINEL_SENHA || SESSION_SECRET.length < 32 || INGEST_TOKEN.length < 32) {
  console.warn('[painel] Variáveis PAINEL_EMAIL, PAINEL_SENHA, SESSION_SECRET (32+) e INGEST_TOKEN (32+) precisam estar definidas. O painel fica desativado até lá.');
}
const PAINEL_ENABLED = !!(PAINEL_EMAIL && PAINEL_SENHA && SESSION_SECRET.length >= 32 && INGEST_TOKEN.length >= 32);

/* ---------- Arquivos públicos permitidos ---------- */
const PUBLIC_FILES = new Set(['/index.html', '/politica-de-privacidade.html', '/robots.txt', '/sitemap.xml']);
const PUBLIC_DIRS = ['/assets/', '/favicon/', '/versao-antiga/', '/Nova pasta/'];

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp4': 'video/mp4'
};
const COMPRESSIBLE = /^(text\/|application\/(javascript|json|xml)|image\/svg)/;

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN'
};

/* ---------- Dados (memória + arquivo) ---------- */
let adsData = null;
try { adsData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) { adsData = null; }

function saveData(obj) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj));
  fs.renameSync(tmp, DATA_FILE);
  adsData = obj;
}

/* ---------- Visitas no site (primeira parte, sem cookies e sem IP) ---------- */
const EVT_TYPES = new Set(['view', 'scroll', 'cta', 'leave']);
const evtHits = new Map();
function dayInSaoPaulo(d) { return new Date(d.getTime() - 3 * 3600e3).toISOString().slice(0, 10); }
function cleanStr(v, max) { return String(v == null ? '' : v).replace(/[^\w-]/g, '').slice(0, max); }
function recordEvent(ip, raw) {
  const now = Date.now();
  const hits = (evtHits.get(ip) || []).filter(t => now - t < 60e3);
  if (hits.length >= 60) return;
  hits.push(now); evtHits.set(ip, hits);
  if (evtHits.size > 5000) evtHits.clear();
  let e;
  try { e = JSON.parse(raw); } catch (err) { return; }
  if (!e || !EVT_TYPES.has(e.t)) return;
  const row = {
    ts: new Date(now).toISOString(), d: dayInSaoPaulo(new Date(now)), s: cleanStr(e.s, 24), t: e.t,
    v: cleanStr(e.v, 24), tema: cleanStr(e.tema, 20), ads: e.ads ? 1 : 0, m: e.m ? 1 : 0, sec: Math.min(3600, Math.max(0, Number(e.sec) || 0))
  };
  if (!row.s) return;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.appendFile(EVENTS_FILE, JSON.stringify(row) + '\n', () => {});
}
function visitSummary(days) {
  let lines = [];
  try { lines = fs.readFileSync(EVENTS_FILE, 'utf8').split('\n'); } catch (e) { return { days: {}, since: null }; }
  const from = dayInSaoPaulo(new Date(Date.now() - (days - 1) * 864e5));
  const sessions = new Map();
  let since = null;
  for (const line of lines) {
    if (!line) continue;
    let e; try { e = JSON.parse(line); } catch (err) { continue; }
    if (!since || e.d < since) since = e.d;
    if (e.d < from) continue;
    let s = sessions.get(e.s);
    if (!s) { s = { d: e.d, ads: 0, m: e.m, tema: '', scroll: 0, sec: 0, cta: [], viewed: false }; sessions.set(e.s, s); }
    if (e.ads) s.ads = 1;
    if (e.tema) s.tema = e.tema;
    if (e.t === 'view') s.viewed = true;
    if (e.t === 'scroll') s.scroll = Math.max(s.scroll, Number(e.v) || 0);
    if (e.t === 'cta') s.cta.push(e.v || 'desconhecido');
    s.sec = Math.max(s.sec, e.sec || 0);
  }
  const out = {};
  for (const s of sessions.values()) {
    if (!s.viewed) continue;
    const k = s.d;
    const o = out[k] || (out[k] = { all: emptyDay(), ads: emptyDay() });
    addSession(o.all, s);
    if (s.ads) addSession(o.ads, s);
  }
  return { days: out, since };
}
function emptyDay() { return { visits: 0, mobile: 0, quick: 0, s25: 0, s50: 0, s75: 0, s100: 0, secSum: 0, withCta: 0, cta: {} }; }
function addSession(o, s) {
  o.visits++; if (s.m) o.mobile++;
  if (s.sec < 10) o.quick++;
  if (s.scroll >= 25) o.s25++; if (s.scroll >= 50) o.s50++; if (s.scroll >= 75) o.s75++; if (s.scroll >= 100) o.s100++;
  o.secSum += Math.min(s.sec, 1800);
  if (s.cta.length) o.withCta++;
  s.cta.forEach(c => { o.cta[c] = (o.cta[c] || 0) + 1; });
}

/* ---------- Sessão ---------- */
function sign(value) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');
}
function makeSession() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_DAYS * 864e5 })).toString('base64url');
  return payload + '.' + sign(payload);
}
function validSession(req) {
  if (!PAINEL_ENABLED) return false;
  const raw = parseCookies(req)[COOKIE];
  if (!raw || raw.indexOf('.') < 0) return false;
  const [payload, sig] = raw.split('.');
  if (!safeEqual(sig, sign(payload))) return false;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now(); } catch (e) { return false; }
}
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}
function isHttps(req) {
  return (req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}
function sessionCookie(req, value, maxAge) {
  return `${COOKIE}=${value}; Path=/painel; HttpOnly; SameSite=Lax; Max-Age=${maxAge}` + (isHttps(req) ? '; Secure' : '');
}

/* ---------- Limite de tentativas de login ---------- */
const attempts = new Map();
function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
}
function tooManyAttempts(ip) {
  const now = Date.now();
  const list = (attempts.get(ip) || []).filter(t => now - t < 15 * 60e3);
  attempts.set(ip, list);
  return list.length >= 8;
}
function registerFail(ip) { (attempts.get(ip) || attempts.set(ip, []).get(ip)).push(Date.now()); }

/* ---------- Helpers de resposta ---------- */
function send(req, res, status, body, type, extra) {
  const headers = Object.assign({}, SECURITY_HEADERS, { 'Content-Type': type }, extra || {});
  let buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  if (COMPRESSIBLE.test(type) && buf.length > 512 && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    buf = zlib.gzipSync(buf, { level: 6 });
    headers['Content-Encoding'] = 'gzip';
    headers['Vary'] = 'Accept-Encoding';
  }
  headers['Content-Length'] = buf.length;
  res.writeHead(status, headers);
  res.end(req.method === 'HEAD' ? undefined : buf);
}
function redirect(res, location, extra) {
  res.writeHead(303, Object.assign({ Location: location }, SECURITY_HEADERS, extra || {}));
  res.end();
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const NO_INDEX = { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' };
function painelFile(name) { return fs.readFileSync(path.join(SERVER_DIR, name)); }

/* ---------- Arquivos estáticos ---------- */
function serveStatic(req, res, urlPath) {
  if (urlPath === '/') urlPath = '/index.html';
  if (urlPath.endsWith('/')) urlPath += 'index.html';
  const allowed = PUBLIC_FILES.has(urlPath) || PUBLIC_DIRS.some(d => urlPath.startsWith(d));
  const filePath = path.join(ROOT, urlPath);
  if (!allowed || !filePath.startsWith(ROOT + path.sep) || urlPath.includes('..')) return notFound(req, res);

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) return notFound(req, res);
    const ext = path.extname(filePath).toLowerCase();
    const type = TYPES[ext] || 'application/octet-stream';
    const cache = urlPath === '/index.html' ? 'no-cache'
      : urlPath.startsWith('/assets/') ? 'public, max-age=2592000' : 'public, max-age=3600';
    const extra = { 'Cache-Control': cache };
    if (urlPath.startsWith('/versao-antiga/')) extra['X-Robots-Tag'] = 'noindex, nofollow';

    // Vídeo: suporte a Range (necessário no Safari/iPhone)
    if (ext === '.mp4') {
      const range = req.headers.range;
      const headers = Object.assign({}, SECURITY_HEADERS, extra, { 'Content-Type': type, 'Accept-Ranges': 'bytes' });
      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        let start = m && m[1] ? parseInt(m[1], 10) : 0;
        let end = m && m[2] ? parseInt(m[2], 10) : stat.size - 1;
        if (start >= stat.size || end >= stat.size || start > end) {
          res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }); return res.end();
        }
        headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
        headers['Content-Length'] = end - start + 1;
        res.writeHead(206, headers);
        return req.method === 'HEAD' ? res.end() : fs.createReadStream(filePath, { start, end }).pipe(res);
      }
      headers['Content-Length'] = stat.size;
      res.writeHead(200, headers);
      return req.method === 'HEAD' ? res.end() : fs.createReadStream(filePath).pipe(res);
    }
    fs.readFile(filePath, (e, buf) => e ? notFound(req, res) : send(req, res, 200, buf, type, extra));
  });
}
function notFound(req, res) {
  send(req, res, 404, '<!doctype html><meta charset="utf-8"><title>Página não encontrada</title><body style="font-family:system-ui;padding:48px;color:#2B2420;background:#FBF8F4"><h1 style="font-weight:400">Página não encontrada</h1><p><a href="/" style="color:#A24F31">Voltar ao site</a></p>', 'text/html; charset=utf-8');
}

/* ---------- Rotas ---------- */
const server = http.createServer(async (req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { return notFound(req, res); }

  try {
    if (urlPath === '/healthz') return send(req, res, 200, 'ok', 'text/plain; charset=utf-8');

    /* Recebe dados do script do Google Ads */
    if (urlPath === '/api/ads-ingest') {
      if (req.method !== 'POST') return send(req, res, 405, 'method not allowed', 'text/plain; charset=utf-8');
      if (!PAINEL_ENABLED || !safeEqual(req.headers['x-token'] || '', INGEST_TOKEN)) return send(req, res, 401, 'unauthorized', 'text/plain; charset=utf-8');
      const body = await readBody(req, 3 * 1024 * 1024);
      let data;
      try { data = JSON.parse(body); } catch (e) { return send(req, res, 400, 'invalid json', 'text/plain; charset=utf-8'); }
      if (!data || !Array.isArray(data.daily)) return send(req, res, 400, 'invalid payload', 'text/plain; charset=utf-8');
      data.receivedAt = new Date().toISOString();
      saveData(data);
      return send(req, res, 200, JSON.stringify({ ok: true, rows: data.daily.length }), 'application/json; charset=utf-8');
    }

    /* Eventos de visita enviados pelo site */
    if (urlPath === '/api/evt') {
      if (req.method !== 'POST') return send(req, res, 405, 'method not allowed', 'text/plain; charset=utf-8');
      const body = await readBody(req, 2048);
      recordEvent(clientIp(req), body);
      res.writeHead(204, SECURITY_HEADERS);
      return res.end();
    }

    /* Painel */
    if (urlPath === '/painel' || urlPath.startsWith('/painel/')) {
      if (urlPath === '/painel') return redirect(res, '/painel/');

      if (urlPath === '/painel/entrar' && req.method === 'POST') {
        const ip = clientIp(req);
        if (tooManyAttempts(ip)) return redirect(res, '/painel/?erro=tentativas');
        const form = new URLSearchParams(await readBody(req, 4096));
        const okEmail = safeEqual((form.get('email') || '').trim().toLowerCase(), PAINEL_EMAIL);
        const okSenha = safeEqual(form.get('senha') || '', PAINEL_SENHA);
        if (!PAINEL_ENABLED || !okEmail || !okSenha) { registerFail(ip); return redirect(res, '/painel/?erro=1'); }
        attempts.delete(ip);
        return redirect(res, '/painel/', { 'Set-Cookie': sessionCookie(req, makeSession(), SESSION_DAYS * 86400) });
      }

      if (urlPath === '/painel/sair') {
        return redirect(res, '/painel/', { 'Set-Cookie': sessionCookie(req, '', 0) });
      }

      const logged = validSession(req);

      if (urlPath === '/painel/dados.json') {
        if (!logged) return send(req, res, 401, '{"erro":"login"}', 'application/json; charset=utf-8', NO_INDEX);
        return send(req, res, 200, JSON.stringify(adsData || { vazio: true }), 'application/json; charset=utf-8', NO_INDEX);
      }

      if (urlPath === '/painel/visitas.json') {
        if (!logged) return send(req, res, 401, '{"erro":"login"}', 'application/json; charset=utf-8', NO_INDEX);
        return send(req, res, 200, JSON.stringify(visitSummary(62)), 'application/json; charset=utf-8', NO_INDEX);
      }

      if (urlPath === '/painel/' || urlPath === '/painel/index.html') {
        const page = logged ? 'painel.html' : 'login.html';
        return send(req, res, 200, painelFile(page), 'text/html; charset=utf-8', NO_INDEX);
      }
      return notFound(req, res);
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return send(req, res, 405, 'method not allowed', 'text/plain; charset=utf-8');
    return serveStatic(req, res, urlPath);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) send(req, res, 500, 'erro interno', 'text/plain; charset=utf-8');
  }
});

server.listen(PORT, () => console.log(`Servidor ouvindo na porta ${PORT}${PAINEL_ENABLED ? '' : ' (painel desativado: faltam variáveis)'}`));
