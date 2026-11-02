// Check of the claude.ai page (build_page.py) on the fixture book: Claude through a stand-in for the `sample`
// capability, the #ai-<act>-<ref> links from the offline app answering by themselves, the model choice.
// `npm run test:page` builds build/test/page.html (+ .doc.html, the published skeleton) first.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
const DOC = path.join(__dirname, 'test', 'page.doc.html');
const LIBS = path.resolve(__dirname, '..', 'libs');
const CDN = { 'marked@12.0.2/marked.min.js': 'marked-12.0.2/marked.min.js', 'dompurify@3.1.6/dist/purify.min.js': 'dompurify-3.1.6/purify.min.js' };

function serve(port) {
  const srv = http.createServer((req, res) => {
    if (req.url.split('?')[0] !== '/') { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    fs.createReadStream(DOC).pipe(res);
  });
  return new Promise(r => srv.listen(port, '127.0.0.1', () => r(srv)));
}

// what the claude.ai viewer hands the page: window.claude.use('sample') → a function that streams an answer
const MOCK = () => {
  window.__calls = [];
  const sample = async (input, opts) => {
    opts = opts || {};
    window.__calls.push({ input: JSON.stringify(input), model: opts.model || null, cache: opts.cache, images: (opts.images || []).map(b => b.type) });
    const text = `Cavab ${window.__calls.length}: **addım-addım**.`;
    await new Promise(r => setTimeout(r, 30));
    if (opts.onText) opts.onText({ text, delta: text });
    return { text, truncated: false, modelApplied: opts.model || 'claude-sonnet-5-5' };
  };
  sample.limits = async () => ({ images: true });
  window.claude = { use: async name => (name === 'sample' ? sample : null) };
};

(async () => {
  const PORT = 8768, URL0 = `http://127.0.0.1:${PORT}/`;
  const srv = await serve(PORT);
  const browser = await chromium.launch();
  const errors = [], fail = [], out = {};
  const open = async mock => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await ctx.route('https://cdn.jsdelivr.net/npm/**', route => {
      const f = CDN[route.request().url().split('/npm/')[1]];
      return f ? route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(LIBS, f)) }) : route.abort();
    });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    if (mock) await ctx.addInitScript(MOCK);
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    page.on('dialog', d => { errors.push('dialog (never shown on claude.ai): ' + d.message()); d.dismiss(); });
    return page;
  };
  const page = await open(true);
  const shot = name => page.screenshot({ path: path.join(__dirname, 'shots', name + '.png'), fullPage: true });
  const calls = () => page.evaluate(() => window.__calls);
  const meta = sel => page.locator(sel + ' .ai-meta').first().waitFor();

  // a hint link: the section opens and Claude starts on that check question without a click
  await page.goto(URL0 + '#ai-hint-c3s1k1');
  await page.waitForFunction(() => location.hash === '#c3s1');
  const hintBox = '.ai-box[data-act="hint"][data-ref="c3s1k1"]';
  await meta(hintBox);
  let c = await calls();
  out.hint = { n: c.length, ask: c[0].input.includes('Cavabı demə'), question: c[0].input.includes('3, 5, 7'), model: c[0].model,
    text: (await page.locator(hintBox + ' .ai-text').innerText()).trim() };
  await shot('t2-hint');

  // a worked example with a figure: the picture goes along as a PNG
  await page.goto(URL0 + '#ai-iq-c3s1k3');
  await meta('.ai-box[data-act="iq"][data-ref="c3s1k3"]');
  c = await calls();
  out.figure = { images: c[1].images, said: c[1].input.includes('şəkli əlavə olunub') };

  // a test question: its own page, answer shown, explanation started
  await page.goto(URL0 + '#ai-q-c1q1');
  await page.waitForFunction(() => location.hash === '#sual-c1q1');
  await meta('.ai-box[data-act="q"]');
  c = await calls();
  out.question = { right: await page.locator('.opt.right').count(), full: c[2].input.includes('Düz cavab:') };

  // a programme topic from the teacher: the chat answers it
  await page.goto(URL0 + '#ai-topic-men.0');
  await page.waitForFunction(() => location.hash === '#muellim-men' && document.querySelectorAll('#chat .bub.ai.prose').length === 1);
  c = await calls();
  out.topic = { bubbles: await page.$$eval('#chat .bub', els => els.length), cache: c[3].cache, prompt: c[3].input.includes('DİM proqramı, Məntiq') };
  await page.fill('#tq', 'Bir misal də ver');
  await page.click('[data-act="chat-send"]');
  await page.waitForFunction(() => document.querySelectorAll('#chat .bub.ai.prose').length === 2);
  c = await calls();
  out.chatTurns = JSON.parse(c[4].input).map(t => t.role).join(',');
  await shot('t2-teacher');

  // a typed question from the offline app arrives through the clipboard
  await page.goto(URL0 + '#ai-chat');
  await page.waitForSelector('.toast:not([hidden])');
  out.chatLink = { hash: await page.evaluate(() => location.hash), toast: (await page.textContent('.toast')).includes('yapışdır') };

  // settings: the model is the reader's choice; no API key and no export on claude.ai
  await page.goto(URL0 + '#ayarlar');
  await page.waitForSelector('#set-ai');
  out.settings = { models: await page.locator('[data-aimodel]').count(), key: await page.locator('#aikey').count(), exp: await page.locator('[data-act="export"]').count() };
  await page.click('[data-aimodel="claude-opus-5-5"]');
  await page.goto(URL0 + '#c3s1');
  await page.click('.claudebox [data-ai]');
  await meta('.claudebox');
  c = await calls();
  out.opus = { model: c[c.length - 1].model, meta: (await page.locator('.claudebox .ai-meta').innerText()).includes('Opus 5.5') };

  // reset asks inside the page and keeps the model choice
  await page.goto(URL0 + '#ayarlar');
  await page.click('[data-act="reset"]');
  await page.click('[data-act="ask-yes"]');
  out.reset = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('dq-kitab:v1')); return { chk: Object.keys(s.chk).length, model: s.aiModel }; });

  // the look: light by default; a theme the claude.ai viewer applies later does not override the reader's choice
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload();
  await page.waitForSelector('#view > *');
  out.look = await page.evaluate(async () => {
    const root = document.documentElement, first = root.getAttribute('data-theme');
    root.setAttribute('data-theme', 'dark');                       // what the viewer does when its own theme is dark
    await new Promise(r => setTimeout(r, 50));
    return [first, root.getAttribute('data-theme'), getComputedStyle(document.body).backgroundColor];
  });
  await page.goto(URL0 + '#ayarlar');
  await page.waitForSelector('#set-ai');
  await page.click('[data-theme="auto"]');
  out.lookSystem = await page.evaluate(async () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    await new Promise(r => setTimeout(r, 50));
    return document.documentElement.getAttribute('data-theme');
  });

  // outside claude.ai (a saved copy): no Claude, the book still works
  const bare = await open(false);
  await bare.goto(URL0 + '#c3s1');
  await bare.waitForSelector('.iq');
  await bare.click('.claudebox [data-ai]');
  await bare.waitForSelector('.toast:not([hidden])');
  out.bare = (await bare.textContent('.toast')).trim();

  await browser.close();
  srv.close();
  const eq = (k, v) => { if (JSON.stringify(out[k]) !== JSON.stringify(v)) fail.push(`${k}: expected ${JSON.stringify(v)}, got ${JSON.stringify(out[k])}`); };
  eq('hint', { n: 1, ask: true, question: true, model: null, text: 'Cavab 1: addım-addım.' });
  eq('figure', { images: ['image/png'], said: true });
  eq('question', { right: 1, full: true });
  eq('topic', { bubbles: 2, cache: false, prompt: true });
  eq('chatTurns', 'user,assistant,user');
  eq('chatLink', { hash: '#muellim', toast: true });
  eq('settings', { models: 4, key: 0, exp: 0 });
  eq('opus', { model: 'claude-opus-5-5', meta: true });
  eq('reset', { chk: 0, model: 'claude-opus-5-5' });
  eq('bare', 'Claude bu görünüşdə əlçatan deyil.');
  eq('look', ['light', 'light', 'rgb(245, 246, 251)']);
  eq('lookSystem', 'dark');
  out.errors = errors.concat(fail);
  console.log(JSON.stringify(out, null, 1));
  process.exit(out.errors.length ? 1 : 0);
})();
