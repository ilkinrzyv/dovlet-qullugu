/* Dövlət Qulluğu — offline app layer: service worker, updates, install, backup files, Claude through the reader's
   own API key. Loaded before app.js; app.js finds it as window.DQ_PWA (absent on the claude.ai page). */
(function () {
'use strict';
const VERSION = '2026.11.01-7e0b24c';
const ASSET_COUNT = 46;
const CACHE = 'dq-kitab-' + VERSION;
const ARTIFACT = 'https://claude.ai/artifact/DS1Sg1NBATqkMRPuVkHoER'; // the claude.ai version of the book; Claude runs there on the reader's own account
const API = 'https://api.anthropic.com/v1';
const K_KEY = 'dq-kitab:pwa:key';
const DEFAULT_MODEL = 'claude-sonnet-5-5'; // used when the reader leaves the model on “Avtomatik”

const bus = new EventTarget();
const emit = type => { try { bus.dispatchEvent(new Event(type)); } catch (e) { } };
const on = (type, fn) => bus.addEventListener(type, fn);
const online = () => navigator.onLine !== false;
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { } }
};

/* ---------- Claude: Messages API, streamed, from the browser, with the reader's key ---------- */
const key = () => (ls.get(K_KEY) || '').trim();
const hasKey = () => !!key();
const keyHint = () => { const k = key(); return k ? k.slice(0, 7) + '…' + k.slice(-4) : ''; };
const artifactLink = path => /^https:\/\/claude\.ai\//.test(ARTIFACT) ? ARTIFACT + (path ? '#' + path : '') : '';
function apiHeaders(k, json) {
  const h = { 'x-api-key': k, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
  if (json) h['content-type'] = 'application/json';
  return h;
}
function httpErr(status, j) {
  const t = (j && j.error && j.error.type) || '', m = (j && j.error && j.error.message) || '';
  let code = 'upstream_error';
  if (status === 401 || t === 'authentication_error') code = 'auth';
  else if (status === 402 || t === 'billing_error' || /credit balance|billing/i.test(m)) code = 'credit';
  else if (status === 403 || t === 'permission_error') code = 'permission';
  else if (status === 404 || t === 'not_found_error') code = 'model';
  else if (status === 413 || t === 'request_too_large') code = 'prompt_too_large';
  else if (status === 429 || t === 'rate_limit_error') code = 'rate_limited';
  else if (status === 529 || status === 503 || t === 'overloaded_error') code = 'overloaded';
  return { code, message: m || ('HTTP ' + status), status };
}
const blobB64 = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(b); });
/* Same contract as the claude.ai page's sample(): resolves {text, truncated, modelApplied}, rejects {code, message, text?}. */
async function sample(input, opts) {
  opts = opts || {};
  if (!online()) throw { code: 'offline', message: 'offline' };
  if (!hasKey()) throw { code: 'auth', message: 'no key' };
  if (opts.signal && opts.signal.aborted) throw { code: 'cancelled', message: 'cancelled', text: '' };
  const msgs = [];
  (typeof input === 'string' ? [{ role: 'user', content: input }] : input).forEach(m => {
    const role = m.role === 'assistant' ? 'assistant' : 'user', p = msgs[msgs.length - 1];
    if (p && p.role === role) p.content += '\n\n' + m.content; else msgs.push({ role, content: String(m.content) });
  });
  const imgs = opts.images ? [].concat(opts.images).filter(Boolean) : [];
  if (imgs.length) {
    const last = msgs[msgs.length - 1], blocks = [];
    for (const b of imgs) blocks.push({ type: 'image', source: { type: 'base64', media_type: b.type || 'image/png', data: await blobB64(b) } });
    last.content = blocks.concat([{ type: 'text', text: last.content }]);
  }
  const model = opts.model || DEFAULT_MODEL;
  let resp;
  try {
    resp = await fetch(API + '/messages', { method: 'POST', headers: apiHeaders(key(), true), signal: opts.signal,
      body: JSON.stringify({ model, max_tokens: 8000, stream: true, messages: msgs }) });
  } catch (e) {
    if (opts.signal && opts.signal.aborted) throw { code: 'cancelled', message: 'cancelled', text: '' };
    throw { code: online() ? 'network' : 'offline', message: String(e && e.message || e) };
  }
  if (!resp.ok) { let j = null; try { j = await resp.json(); } catch (e) { j = null; } throw httpErr(resp.status, j); }
  let text = '', stop = null, streamErr = null;
  try {
    const reader = resp.body.getReader(), dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const r = await reader.read();
      if (r.done) break;
      buf += dec.decode(r.value, { stream: true }).replace(/\r\n?/g, '\n');
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
        let data = '';
        chunk.split('\n').forEach(line => { if (line.startsWith('data:')) data += line.slice(5).replace(/^ /, ''); });
        if (!data) continue;
        let ev; try { ev = JSON.parse(data); } catch (e) { continue; }
        if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') {
          text += ev.delta.text;
          if (typeof opts.onText === 'function') { try { opts.onText({ text, delta: ev.delta.text }); } catch (e) { } }
        } else if (ev.type === 'message_delta' && ev.delta && ev.delta.stop_reason) stop = ev.delta.stop_reason;
        else if (ev.type === 'error') streamErr = ev.error || { type: 'api_error' };
      }
    }
  } catch (e) {
    if (opts.signal && opts.signal.aborted) throw { code: 'cancelled', message: 'cancelled', text };
    throw { code: online() ? 'network' : 'offline', message: String(e && e.message || e), text };
  }
  if (streamErr) throw Object.assign(httpErr(streamErr.type === 'overloaded_error' ? 529 : 500, { error: streamErr }), { text });
  if (stop === 'refusal') throw { code: 'refused', message: 'refused' };
  if (!text.trim()) throw { code: 'empty_completion', message: 'empty' };
  return { text, truncated: stop === 'max_tokens', modelApplied: model };
}
async function testKey(k) {
  k = (k || '').trim();
  if (!online()) return { ok: false, code: 'offline' };
  try {
    const r = await fetch(API + '/models?limit=1', { headers: apiHeaders(k, false) });
    if (r.ok) return { ok: true };
    let j = null; try { j = await r.json(); } catch (e) { j = null; }
    return Object.assign({ ok: false }, httpErr(r.status, j));
  } catch (e) { return { ok: false, code: 'network' }; }
}
const setKey = k => { ls.set(K_KEY, (k || '').trim()); emit('key'); };
const clearKey = () => { ls.del(K_KEY); emit('key'); };

/* ---------- service worker: offline cache + updates ---------- */
const sw = { supported: 'serviceWorker' in navigator && window.isSecureContext && location.protocol !== 'file:', reg: null, ready: false, updated: false, error: '' };
let swTries = 0;
async function checkCache() {
  try {
    if (await caches.has(CACHE)) {
      const n = (await (await caches.open(CACHE)).keys()).length;
      sw.ready = n >= ASSET_COUNT;
    }
  } catch (e) { sw.ready = false; }
  emit('sw');
  if (!sw.ready && ++swTries < 40) setTimeout(checkCache, 1500);
}
function showUpdateBar() {
  if (document.getElementById('pwa-bar')) return;
  closeBanner(false); // the update bar sits in the same place
  const bar = document.createElement('div');
  bar.id = 'pwa-bar'; bar.className = 'pwa-bar'; bar.setAttribute('role', 'status');
  bar.innerHTML = '<span>Kitabın yeni versiyası yükləndi.</span><button type="button">Yenilə</button>';
  bar.querySelector('button').addEventListener('click', () => location.reload());
  document.body.appendChild(bar);
}
if (sw.supported) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !sw.updated) { sw.updated = true; emit('sw'); showUpdateBar(); } });
  window.addEventListener('load', async () => {
    try {
      sw.reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      await navigator.serviceWorker.ready;
      checkCache();
    } catch (e) { sw.error = String(e && e.message || e); emit('sw'); }
  });
}
async function checkUpdate() {
  if (!sw.reg) return 'none';
  try { await sw.reg.update(); } catch (e) { return online() ? 'error' : 'offline'; }
  return sw.reg.installing || sw.reg.waiting ? 'found' : 'latest';
}

/* ---------- install ---------- */
let deferred = null;
const isStandalone = () => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } };
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; emit('install'); });
window.addEventListener('appinstalled', () => { deferred = null; emit('install'); });
function installState() { if (isStandalone()) return 'installed'; if (deferred) return 'prompt'; if (isIOS()) return 'ios'; return 'none'; }
async function install() {
  if (!deferred) return false;
  const d = deferred; deferred = null;
  try { await d.prompt(); const ch = await d.userChoice; emit('install'); return !!ch && ch.outcome === 'accepted'; } catch (e) { emit('install'); return false; }
}

/* ---------- install banner: offered when the page opens, until the book is installed ---------- */
// Android and desktop Chrome/Edge: the banner's button opens the browser's own install dialog (beforeinstallprompt).
// iOS has no such dialog, so the banner says how to add the page from the Share menu; Android browsers without the
// event get the menu path, and the banner turns into the button if the event comes later. Nothing shows in the
// installed app; "Bağla" hides the banner for LATER_DAYS.
const K_LATER = 'dq-kitab:pwa:install-later';
const LATER_DAYS = 3;
const UA = navigator.userAgent || '';
const isAndroid = () => /android/i.test(UA);
const isIOSSafari = () => isIOS() && /Safari\//.test(UA) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(UA);
const snoozed = () => Date.now() - (+ls.get(K_LATER) || 0) < LATER_DAYS * 864e5;
const SHARE = '<svg class="pi-share" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M8 11H6.5A1.5 1.5 0 0 0 5 12.5v7A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5H16"/></svg>';
const HOW = {
  prompt: 'İnternetsiz də açılır və telefonda ayrıca tətbiq kimi işləyir.',
  ios: `Safari-də <b>Paylaş</b> ${SHARE} düyməsinə toxun (bəzən “•••” menyusundadır), sonra <b>“Ana ekrana əlavə et”</b> (Add to Home Screen) və <b>“Əlavə et”</b>.`,
  iosother: `Brauzerin <b>Paylaş</b> ${SHARE} menyusunda <b>“Ana ekrana əlavə et”</b> (Add to Home Screen) seç. Belə seçim yoxdursa, səhifəni Safari-də aç.`,
  android: 'Brauzerin menyusunu (<b>⋮</b>) aç və <b>“Tətbiqi quraşdır”</b> (Install app) və ya <b>“Ana ekrana əlavə et”</b> (Add to Home screen) seç. Belə seçim yoxdursa, səhifəni Chrome-da aç.'
};
function closeBanner(later) {
  const b = document.getElementById('pwa-install');
  if (b) b.remove();
  if (later) ls.set(K_LATER, String(Date.now()));
}
function showBanner(kind) {
  if (!document.body || isStandalone() || snoozed() || document.getElementById('pwa-bar')) return;
  let b = document.getElementById('pwa-install');
  if (b && b.dataset.kind === kind) return;
  if (!b) {
    b = document.createElement('div');
    b.id = 'pwa-install'; b.className = 'pwa-install';
    b.setAttribute('role', 'region'); b.setAttribute('aria-label', 'Tətbiqi quraşdır');
    document.body.appendChild(b);
  }
  b.dataset.kind = kind;
  b.innerHTML = `<img src="icons/icon-192.png" alt="" width="44" height="44"><div class="pi-text"><b class="pi-title">Kitabı ana ekrana əlavə et</b><span>${HOW[kind]}</span></div>`
    + (kind === 'prompt' ? '<button type="button" class="pi-go">Quraşdır</button>' : '')
    + '<button type="button" class="pi-x" aria-label="Bağla">×</button>';
  const go = b.querySelector('.pi-go');
  if (go) go.addEventListener('click', async () => { const ok = await install(); closeBanner(!ok); });
  b.querySelector('.pi-x').addEventListener('click', () => closeBanner(true));
}
function offerInstall() {
  if (isStandalone()) return;
  if (deferred) showBanner('prompt');
  else if (isIOS()) showBanner(isIOSSafari() ? 'ios' : 'iosother');
  else if (isAndroid()) showBanner('android');
}
on('install', () => { if (deferred) showBanner('prompt'); });
window.addEventListener('appinstalled', () => closeBanner(false));
window.addEventListener('load', () => setTimeout(offerInstall, isAndroid() ? 3500 : 1200)); // Android: give the browser time to offer its dialog

/* ---------- storage, files ---------- */
async function persisted() { try { return !!(navigator.storage && navigator.storage.persisted && await navigator.storage.persisted()); } catch (e) { return false; } }
async function persist() { try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch (e) { } return false; }
async function saveFile(name, text) {
  const file = new File([text], name, { type: 'application/json' });
  let coarse = false; try { coarse = matchMedia('(pointer: coarse)').matches; } catch (e) { }
  if (coarse && navigator.canShare && navigator.share) {
    try {
      if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return 'shared'; }
    } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a'); a.href = url; a.download = name; a.hidden = true;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'downloaded';
}
function pickFile() {
  return new Promise(resolve => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'application/json,.json'; inp.hidden = true;
    inp.addEventListener('change', () => {
      const f = inp.files && inp.files[0]; inp.remove();
      if (!f) { resolve(null); return; }
      const rd = new FileReader();
      rd.onload = () => resolve(String(rd.result || ''));
      rd.onerror = () => resolve(null);
      rd.readAsText(f);
    });
    document.body.appendChild(inp); inp.click();
  });
}

/* ---------- theme colour of the system bars follows the app theme ---------- */
function syncTheme() {
  let bg = '';
  try { bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(); } catch (e) { }
  if (!bg) return;
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  metas.forEach((m, i) => { if (i === 0) { m.setAttribute('content', bg); m.removeAttribute('media'); } else m.remove(); });
}
try {
  new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => setTimeout(syncTheme, 0));
} catch (e) { }
document.addEventListener('DOMContentLoaded', () => {
  syncTheme();
  if (isStandalone()) persist();
});

/* ---------- network ---------- */
window.addEventListener('online', () => emit('net'));
window.addEventListener('offline', () => emit('net'));

window.DQ_PWA = {
  VERSION, online, sw, checkUpdate, installState, install, isIOS, isStandalone,
  persisted, persist, saveFile, pickFile, on,
  sample, hasKey, keyHint, testKey, setKey, clearKey, artifactLink
};
})();
