/* Dövlət Qulluğu — offline app layer: service worker, updates, install, backup files.
   Loaded before app.js; app.js finds it as window.DQ_PWA (absent when the page is opened some other way). */
(function () {
'use strict';
const VERSION = '2026.10.31-2078145';
const ASSET_COUNT = 44;
const CACHE = 'dq-kitab-' + VERSION;

const bus = new EventTarget();
const emit = type => { try { bus.dispatchEvent(new Event(type)); } catch (e) { } };
const on = (type, fn) => bus.addEventListener(type, fn);
const online = () => navigator.onLine !== false;

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
  persisted, persist, saveFile, pickFile, on
};
})();
