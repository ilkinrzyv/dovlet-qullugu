// PWA check on the real build: service worker precache, installability, reading, updates found by themselves (Chromium
// and WebKit as an iPhone, in Safari and from the home screen), offline reload with the host gone.
// The app's own flows (groups, tests, mock exam) are checked on a fixture book by t1.js.
const { chromium, webkit, devices } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
const ROOT = path.resolve(__dirname, '..', 'docs');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const VERSION = /const VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(ROOT, 'pwa.js'), 'utf-8'))[1];
let NEXT = ''; // set: the host plays a newer release — sw.js and pwa.js carry VERSION + NEXT, so a new cache as well

function serve(port) {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'max-age=600' });
    if (NEXT && (p === '/sw.js' || p === '/pwa.js')) { res.end(fs.readFileSync(f, 'utf-8').split(VERSION).join(VERSION + NEXT)); return; }
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => srv.listen(port, '127.0.0.1', () => r(srv)));
}

(async () => {
  const PORT = 8766;
  const srv = await serve(PORT);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const out = {};
  const book = JSON.parse(fs.readFileSync(path.join(__dirname, 'book.json'), 'utf-8'));
  const firstCh = book.chapters.find(c => c.kind === 'chapter' && c.sections.length) || book.chapters.find(c => c.sections.length);

  await page.goto(`http://127.0.0.1:${PORT}/`);
  await page.waitForFunction(() => window.DQ_PWA && window.DQ_PWA.sw.ready === true, null, { timeout: 30000 });
  out.version = await page.evaluate(() => DQ_PWA.VERSION);
  out.controller = await page.evaluate(async () => { await navigator.serviceWorker.ready; return !!navigator.serviceWorker.controller; });
  const cdp = await ctx.newCDPSession(page);
  try { out.installErrors = (await cdp.send('Page.getInstallabilityErrors')).installabilityErrors; } catch (e) { out.installErrors = 'n/a: ' + e.message; }
  try { out.manifestErrors = (await cdp.send('Page.getAppManifest')).errors; } catch (e) { out.manifestErrors = 'n/a'; }
  out.homeChapters = await page.$$eval('.chrow', els => els.length);
  await page.screenshot({ path: path.join(__dirname, 'shots', 'home.png'), fullPage: true });

  // read the first section and mark it
  await page.click(`a.chrow[href="#${firstCh.id}"]`);
  await page.waitForSelector('.secrow');
  await page.click('.secrow');
  await page.waitForSelector('article.prose');
  await page.click('[data-act="read"]');
  out.readSaved = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('dq-kitab:v1')).read).length);
  await page.screenshot({ path: path.join(__dirname, 'shots', 'section.png'), fullPage: true });

  // chapter test: answer every question with the first option shown (open ones with a guess)
  if (book.quizzes[firstCh.id]) {
    await page.goto(`http://127.0.0.1:${PORT}/#test-${firstCh.id}`);
    for (let i = 0; i < book.quizzes[firstCh.id].length; i++) {
      await page.waitForSelector('.opt[data-oi], #oa');
      if (await page.$('#oa')) {
        await page.fill('#oa', '1');
        await page.click('[data-act="check"]');
      } else await page.click('.opt[data-oi]');
      await page.waitForSelector('.expl');
      if (i === 0) await page.screenshot({ path: path.join(__dirname, 'shots', 'quiz.png'), fullPage: true });
      await page.click('[data-act="next"]');
    }
    await page.waitForSelector('[data-act="again"]');
    out.quizSaved = await page.evaluate(id => JSON.parse(localStorage.getItem('dq-kitab:v1')).quiz[id], firstCh.id);
  }

  // search folds Azerbaijani letters
  await page.goto(`http://127.0.0.1:${PORT}/#axtar`);
  await page.fill('#q', 'kecid');
  out.searchHits = await page.$$eval('.hit', els => els.length);

  // law text: a long section lists its maddələr; a test explanation links to the maddə it cites
  const lawSec = book.chapters.filter(c => c.subj === 'qan').flatMap(c => c.sections).sort((a, b) => b.html.split('<h4 id=').length - a.html.split('<h4 id=').length)[0];
  await page.goto(`http://127.0.0.1:${PORT}/#${lawSec.id}`);
  await page.waitForSelector('article.prose.law');
  out.lawToc = [await page.$$eval('.toc li', els => els.length), lawSec.html.split('<h4 id=').length - 1];
  const lawQ = book.quizzes.c1 && book.quizzes.c1.find(q => /^Maddə \d+/.test(q.e || ''));
  if (lawQ) {
    await page.goto(`http://127.0.0.1:${PORT}/#sual-${lawQ.id}`);
    await page.waitForSelector('.expl');
    out.lawLinks = await page.$$eval('.expl a.lawref', els => els.map(a => a.getAttribute('href').slice(1)));
  }

  await page.goto(`http://127.0.0.1:${PORT}/#ayarlar`);
  out.appRow = await page.$eval('#set-app', el => el.innerText.replace(/\s+/g, ' '));
  await page.click('[data-theme="dark"]');
  out.dark = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await page.screenshot({ path: path.join(__dirname, 'shots', 'settings-dark.png'), fullPage: true });

  // ---- install banner: the browser's install dialog (Android, desktop) or Share → Add to Home Screen (iOS) ----
  const fakePrompt = () => {            // what Chrome fires when the page can be installed
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = async () => { window.__prompted = (window.__prompted || 0) + 1; };
    e.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
    window.dispatchEvent(e);
  };
  const ins = {};
  ins.desktopNone = await page.$$eval('#pwa-install', els => els.length);
  await page.evaluate(fakePrompt);
  await page.waitForSelector('#pwa-install[data-kind="prompt"] .pi-go');
  await page.waitForTimeout(400);                           // let the banner finish sliding in
  await page.screenshot({ path: path.join(__dirname, 'shots', 'install-prompt.png') });
  await page.click('#pwa-install .pi-go');
  await page.waitForSelector('#pwa-install', { state: 'detached' });
  ins.prompted = await page.evaluate(() => window.__prompted);
  const phone = async (ua, init) => {
    const c = await browser.newContext({ userAgent: ua, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
    if (init) await c.addInitScript(init);
    const p = await c.newPage();
    p.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await p.goto(`http://127.0.0.1:${PORT}/`);
    await p.waitForSelector('#view > *');
    return p;
  };
  const kindOf = async p => { await p.waitForSelector('#pwa-install', { timeout: 8000 }); return p.$eval('#pwa-install', el => el.dataset.kind); };
  const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
  const IOS_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.156 Mobile/15E148 Safari/604.1';
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36';
  let p = await phone(IOS);
  ins.ios = await kindOf(p);
  await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(__dirname, 'shots', 'install-ios.png') });
  await p.click('#pwa-install .pi-x');
  ins.iosLater = await p.evaluate(() => !!localStorage.getItem('dq-kitab:pwa:install-later'));
  await p.reload();
  await p.waitForTimeout(2500);
  ins.iosAfterClose = await p.$$eval('#pwa-install', els => els.length);
  await p.context().close();
  p = await phone(IOS_CHROME);
  ins.iosChrome = await kindOf(p);
  await p.context().close();
  p = await phone(IOS, () => Object.defineProperty(navigator, 'standalone', { get: () => true }));
  await p.waitForTimeout(2500);
  ins.iosInstalled = await p.$$eval('#pwa-install', els => els.length);
  await p.context().close();
  p = await phone(ANDROID);
  ins.android = await kindOf(p);
  await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(__dirname, 'shots', 'install-android.png') });
  await p.evaluate(fakePrompt);
  await p.waitForSelector('#pwa-install[data-kind="prompt"] .pi-go');
  ins.androidLater = 'prompt';
  await p.context().close();
  out.install = ins;

  // ---- updates: a new release is found and offered by itself, without a visit to Ayarlar ----
  // The app comes back to the screen (an installed app is usually resumed, not opened afresh), the bar offers the new
  // version, “Sonra” hides it until the next return, “Yenilə” loads it; left open, the half-hourly check finds the next.
  // The page clock jumps instead of waiting: resumes within a minute of a check do not ask again.
  const updates = async (type, label, opts, init) => {
    NEXT = '';
    const b = await type.launch();
    const c = await b.newContext(opts);
    await c.clock.install();
    if (init) await c.addInitScript(init);
    const p = await c.newPage();
    p.on('pageerror', e => errors.push(`${label} pageerror: ${e.message}`));
    const r = {};
    const resume = () => p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    const bars = () => p.$$eval('#pwa-bar', els => els.length);
    try {
      await p.goto(`http://127.0.0.1:${PORT}/#c1`);
      await p.waitForFunction(() => window.DQ_PWA && window.DQ_PWA.sw.ready === true, null, { timeout: 30000 });
      await resume();
      r.firstInstall = await bars();                    // nothing to offer on the very first visit
      NEXT = '-n1';
      await p.clock.fastForward(90000);
      await resume();
      await p.waitForSelector('#pwa-bar .pb-go', { timeout: 30000 });
      r.onResume = 1;
      await p.waitForTimeout(400);
      await p.screenshot({ path: path.join(__dirname, 'shots', `update-${label}.png`) });
      r.overTabbar = await p.evaluate(() => document.getElementById('pwa-bar').getBoundingClientRect().bottom <= document.getElementById('tabbar').getBoundingClientRect().top);
      await p.click('#pwa-bar .pb-x');
      r.later = await bars();
      await resume();
      r.backOnResume = await bars();
      await Promise.all([p.waitForEvent('load'), p.click('#pwa-bar .pb-go')]);
      await p.waitForFunction(() => window.DQ_PWA && window.DQ_PWA.sw.ready === true, null, { timeout: 30000 });
      r.reloaded = (await p.evaluate(() => DQ_PWA.VERSION)) === VERSION + '-n1' ? 1 : 0;
      r.afterReload = await bars();
      NEXT = '-n2';
      await p.clock.fastForward('31:00');
      await p.waitForSelector('#pwa-bar .pb-go', { timeout: 30000 });
      r.halfHourly = 1;
    } catch (e) { r.error = e.message.split('\n')[0]; }
    await b.close();
    NEXT = '';
    return r;
  };
  const iPhone = devices['iPhone 15'];
  out.updates = {
    chromium: await updates(chromium, 'chromium', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true }),
    iosSafari: await updates(webkit, 'ios-safari', iPhone),
    iosHome: await updates(webkit, 'ios-home', iPhone, () => Object.defineProperty(navigator, 'standalone', { get: () => true }))
  };

  // ---- host gone + offline: reload and use the book ----
  await new Promise(r => { srv.close(r); srv.closeAllConnections(); });
  await ctx.setOffline(true);
  await page.goto(`http://127.0.0.1:${PORT}/#${firstCh.id}`);
  await page.waitForSelector('.secrow', { timeout: 15000 });
  out.offlineSections = await page.$$eval('.secrow', els => els.length);
  out.offlineReadKept = await page.$$eval('.secrow.done', els => els.length);
  await page.goto(`http://127.0.0.1:${PORT}/#proqram`);
  await page.waitForSelector('.ptopic', { timeout: 15000 });
  out.offlineTopics = await page.$$eval('.ptopic', els => els.length);
  out.offlineFont = await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('16px Literata', 'ə'); });

  await browser.close();
  const fail = [];
  if (!out.controller) fail.push('no service worker controller');
  if (Array.isArray(out.installErrors) && out.installErrors.length) fail.push('installability: ' + JSON.stringify(out.installErrors));
  if (Array.isArray(out.manifestErrors) && out.manifestErrors.length) fail.push('manifest: ' + JSON.stringify(out.manifestErrors));
  if (out.readSaved !== 1) fail.push('read mark not saved');
  if (book.quizzes[firstCh.id] && !(out.quizSaved && typeof out.quizSaved.best === 'number')) fail.push('quiz result not saved');
  if (!out.searchHits) fail.push('search found nothing for “kecid”');
  if (out.lawToc[0] !== out.lawToc[1]) fail.push('maddə list of the longest law section: ' + JSON.stringify(out.lawToc));
  const ids = new Set(book.chapters.flatMap(c => c.sections).flatMap(s => [...s.html.matchAll(/ id="([^"]+)"/g)].map(m => m[1])));
  if (!out.lawLinks || !out.lawLinks.length || !out.lawLinks.every(id => ids.has(id))) fail.push('explanation links: ' + JSON.stringify(out.lawLinks));
  if (!out.offlineTopics) fail.push('offline programme page');
  if (out.dark !== 'dark') fail.push('theme switch');
  const wantInstall = { desktopNone: 0, prompted: 1, ios: 'ios', iosLater: true, iosAfterClose: 0, iosChrome: 'iosother', iosInstalled: 0, android: 'android', androidLater: 'prompt' };
  if (JSON.stringify(out.install) !== JSON.stringify(wantInstall)) fail.push('install banner: ' + JSON.stringify(out.install));
  const wantUpdate = { firstInstall: 0, onResume: 1, overTabbar: true, later: 0, backOnResume: 1, reloaded: 1, afterReload: 0, halfHourly: 1 };
  Object.keys(out.updates).forEach(k => { if (JSON.stringify(out.updates[k]) !== JSON.stringify(wantUpdate)) fail.push(`update (${k}): ` + JSON.stringify(out.updates[k])); });
  if (out.offlineSections !== firstCh.sections.length) fail.push('offline chapter view');
  if (out.offlineReadKept !== 1) fail.push('offline progress lost');
  if (!out.offlineFont) fail.push('fonts not cached');
  out.errors = errors.concat(fail);
  console.log(JSON.stringify(out, null, 1));
  process.exit(out.errors.length ? 1 : 0);
})();
