/* Dövlət Qulluğu — service worker: keeps the whole book on the device so it opens without internet. */
const VERSION = '__VERSION__';
const CACHE = 'dq-kitab-' + VERSION;
const ASSETS = __ASSETS__;

async function putClean(cache, url) {
  const res = await fetch(new Request(url, { cache: 'reload' }));
  if (!res.ok) throw new Error('precache failed: ' + url + ' ' + res.status);
  // some hosts redirect ./index.html -> ./ ; a redirected response cannot answer a navigation, so store a clean copy
  const clean = res.redirected ? new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers }) : res;
  await cache.put(url, clean);
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const queue = ASSETS.slice();
    const worker = async () => { while (queue.length) await putClean(cache, queue.shift()); };
    await Promise.all([worker(), worker(), worker(), worker()]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('dq-kitab-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // external links go straight to the network
  const last = url.pathname.split('/').pop();
  const isShell = req.mode === 'navigate' && (!last || last === 'index.html' || !last.includes('.'));
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = isShell ? await cache.match('./') : await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      return await fetch(req);
    } catch (err) {
      if (req.mode === 'navigate') return new Response('<!doctype html><meta charset="utf-8"><title>Dövlət Qulluğu</title><p style="font:16px system-ui;padding:24px">İnternet yoxdur və bu səhifə hələ cihazda saxlanılmayıb.</p>', { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } });
      return Response.error();
    }
  })());
});
