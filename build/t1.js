// App check on the fixture book (build/test/): BA/BB filtering, programme map, open and figure questions, mock exam.
// Run `python build/parse_book.py --src build/test/book.md --quiz build/test/quiz --fig build/test/fig --out build/test/book.json` first.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
const ROOT = path.resolve(__dirname, '..', 'docs');
const BOOK = JSON.parse(fs.readFileSync(path.join(__dirname, 'test', 'book.json'), 'utf-8'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

function serve(port) {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    if (p === '/book.js') { res.writeHead(200, { 'content-type': TYPES['.js'] }); res.end('window.DQ_BOOK=' + JSON.stringify(BOOK) + ';'); return; }
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => srv.listen(port, '127.0.0.1', () => r(srv)));
}

(async () => {
  const PORT = 8767, URL0 = `http://127.0.0.1:${PORT}/`;
  const srv = await serve(PORT);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [], fail = [], out = {};
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());
  const shot = name => page.screenshot({ path: path.join(__dirname, 'shots', name + '.png'), fullPage: true });
  const go = async h => { await page.goto(URL0 + '#' + h); await page.waitForSelector('#view > *'); };
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('dq-kitab:v1') || '{}'));
  const setGroup = async g => { await go('ayarlar'); await page.click(`[data-group="${g}"]`); };
  const qOf = id => { for (const k in BOOK.quizzes) for (const q of BOOK.quizzes[k]) if (q.id === id) return q; return null; };

  // ---- BA (default): everything visible ----
  await go('home');
  out.baChapters = await page.$$eval('.chrow', els => els.length);
  await shot('t1-home-ba');
  await go('c1');
  out.baC1Sections = await page.$$eval('.secrow', els => els.length);
  await go('proqram');
  out.baQanTopics = await page.$$eval('#pr-qan .ptopic', els => els.length);
  await shot('t1-proqram');

  // ---- BB: BA-only chapter, section and questions disappear ----
  await setGroup('BB');
  await go('home');
  out.bbChapters = await page.$$eval('.chrow', els => els.length);
  await go('c1');
  out.bbC1Sections = await page.$$eval('.secrow', els => els.length);
  await go('proqram');
  out.bbQanTopics = await page.$$eval('#pr-qan .ptopic', els => els.length);
  await go('c2');
  out.bbHiddenNote = await page.$$eval('.note', els => els.length);

  // chapter test in BB: 2 closed + 1 open (the BA-only question is left out)
  await go('test-c1');
  out.bbC1Quiz = await page.$eval('.qhead .kicker', el => el.textContent);
  for (let i = 0; i < 3; i++) {
    if (await page.$('#oa')) {
      await page.fill('#oa', ' Beş ');
      await page.click('[data-act="check"]');
      out.openPractice = await page.$eval('.expl > b', el => el.textContent);
      await shot('t1-open');
    } else {
      const q = await page.$eval('.qtext', el => el.textContent);
      const item = BOOK.quizzes.c1.find(x => x.q === q);
      await page.click(`.opt[data-oi="${item.a}"]`);
    }
    if (i === 0) out.quizClaude = await page.$$eval('.expl a[data-claude]', els => els.length);
    await page.click('[data-act="next"]');
  }
  out.bbC1Score = (await state()).quiz.c1;

  // figure question keeps its option order (labels live in the picture)
  await go('test-c3');
  if (await page.$('#oa')) { await page.fill('#oa', '5'); await page.click('[data-act="check"]'); await page.click('[data-act="next"]'); }
  out.figure = await page.$$eval('.qfig svg', els => els.length);
  out.figOrder = await page.$$eval('.opts.letters .opt .ol', els => els.map(e => e.textContent).join(''));
  await page.click('.opt[data-oi="1"]');
  out.figRight = await page.$eval('.expl > b', el => el.textContent);
  await shot('t1-figure');

  // ---- questions inside the text (Məntiq): worked examples, checks without a solution, Claude help ----
  const claudeQ = href => { const u = new URL(href); return { host: u.host, path: u.pathname, params: [...u.searchParams.keys()], q: u.searchParams.get('q') }; };
  await go('c3s1');
  out.iq = await page.$$eval('.iq', els => els.map(e => e.className.replace(/\b(iq|card)\b/g, '').trim()));
  out.exRight = await page.$eval('.iq.ex .opt.right .ol', el => el.textContent);
  out.exSolution = await page.$$eval('.iq.ex .iqe', els => els.length);
  const hint = claudeQ(await page.$eval('.iq.chk a[data-claude]', a => a.href));
  out.hintLink = { host: hint.host, path: hint.path, params: hint.params, hint: hint.q.includes('Cavabı dərhal demə'), question: hint.q.includes('3, 5, 7') };
  const c0 = page.locator('.iq.chk').nth(0), c1 = page.locator('.iq.chk').nth(1);
  await c0.locator('.opt[data-oi="0"]').click();
  out.chkWrong = await c0.locator('.iqmsg.bad').count();
  out.chkShowBtn = await c0.locator('[data-act="iqshow"]').count();
  out.chkNoSolution = await page.locator('.iq.chk .iqe').count();
  await c0.locator('.opt[data-oi="2"]').click();
  out.chkSolved = (await c0.locator('.iqmsg.ok').textContent()).trim();
  await c1.locator('.oa').fill('Yeddi');
  await c1.locator('[data-act="iqcheck"]').click();
  out.chkOpen = await c1.locator('.iqmsg.ok').count();
  out.chkSaved = Object.keys((await state()).chk || {}).sort();
  await shot('t1-inline');
  await page.reload();
  await page.waitForSelector('.iq.chk');
  out.chkKept = await page.locator('.iq.chk.solved').count();
  out.sectionClaude = claudeQ(await page.$eval('.claudebox a[data-claude]', a => a.href)).q.includes('Fəsil 3. Məntiq fəsli');

  // ---- virtual teacher ----
  await go('muellim');
  out.teacherTab = await page.$eval('.tab[aria-current="true"] span', el => el.textContent);
  out.teacherTopics = await page.$$eval('#t-explain .list a[data-claude]', els => els.length);
  out.teacherEmpty = await page.$$eval('#t-explain a.claude.primary.off', els => els.length);
  await page.fill('#tq', 'Sillogizm nədir?');
  const tq = claudeQ(await page.$eval('#t-explain a.claude.primary', a => a.href));
  out.teacherAsk = { params: tq.params, text: tq.q.includes('Sillogizm nədir?'), subj: tq.q.includes('Fənn: Məntiq') };
  await page.click('[data-tsubj="inf"]');
  out.teacherSwitch = { hash: await page.evaluate(() => location.hash), kept: await page.$eval('#tq', el => el.value) };
  out.adviceCtx = claudeQ(await page.$eval('#t-advice .row a[data-claude]', a => a.href)).q.includes('İmtahan (BB qrupu)');
  await shot('t1-teacher');

  // search follows the group
  await go('axtar');
  await page.fill('#q', 'cedvel');
  out.searchBB = await page.$$eval('.hit', els => els.length);

  // ---- mock exam, BB: closed questions only, time runs out ----
  await go('imtahan');
  await page.click('[data-act="start"]');
  await page.waitForSelector('.timer');
  out.bbExam = await state().then(s => s.exam.items.map(it => qOf(it.id).t));
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('dq-kitab:v1')); s.exam.start -= (s.exam.secs + 5) * 1000; localStorage.setItem('dq-kitab:v1', JSON.stringify(s)); });
  await page.reload();
  await page.waitForSelector('h1.h1');
  out.bbTimeUp = await state().then(s => ({ hash: null, last: s.examLast && { pts: s.examLast.pts, max: s.examLast.max, timeUp: s.examLast.timeUp }, running: !!s.exam }));
  out.bbTimeUp.hash = await page.evaluate(() => location.hash);
  out.bbMissClaude = await page.$$eval('.miss a[data-claude]', els => els.length);

  // ---- mock exam, BA: answer everything right ----
  await setGroup('BA');
  await go('imtahan');
  out.baPlan = await page.$$eval('.tbl tbody tr', rows => rows.map(r => r.innerText.replace(/\s+/g, ' ')));
  await page.click('[data-act="start"]');
  await page.waitForSelector('.timer');
  const ex = (await state()).exam;
  out.baExam = ex.items.map(it => qOf(it.id).t).join(',');
  for (let i = 0; i < ex.items.length; i++) {
    const q = qOf(ex.items[i].id);
    if (q.t === 'open') await page.fill('#oa', q.a[0]);
    else await page.click(`.opt[data-oi="${q.a}"]`);
    if (i === 0) { await shot('t1-exam'); out.examNoClaude = await page.$$eval('a[data-claude]', els => els.length); }
    if (i + 1 < ex.items.length) await page.click('[data-act="next"]');
  }
  await page.click('.qgrid summary');
  out.gridAnswered = await page.$$eval('.gq.has', els => els.length);
  await page.click('[data-act="finish"]');
  await page.waitForFunction(() => location.hash === '#imtahan-netice');
  await page.waitForSelector('.tbl');
  const last = (await state()).examLast;
  out.baResult = { pts: last.pts, max: last.max, pct: last.pct, n: last.n };
  out.passChips = await page.$$eval('.chip.pass', els => els.length);
  await shot('t1-result');
  await page.emulateMedia({ colorScheme: 'dark' });
  await go('test-c3');
  await shot('t1-figure-dark');

  await browser.close();
  srv.close();
  const eq = (k, v) => { if (JSON.stringify(out[k]) !== JSON.stringify(v)) fail.push(`${k}: expected ${JSON.stringify(v)}, got ${JSON.stringify(out[k])}`); };
  eq('baChapters', 6); eq('bbChapters', 5);
  eq('baC1Sections', 2); eq('bbC1Sections', 1);
  eq('bbHiddenNote', 1);
  if (out.baQanTopics <= out.bbQanTopics) fail.push('programme: BA should list more law topics than BB');
  eq('bbQanTopics', BOOK.prog.subjects[0].topics.filter(t => t.g.includes('BB')).length);
  eq('bbC1Quiz', 'Sual 1 / 3');
  eq('openPractice', 'Düzdür');
  if (!out.bbC1Score || out.bbC1Score.best !== 100) fail.push('chapter test score ' + JSON.stringify(out.bbC1Score));
  eq('figure', 1); eq('figOrder', 'ABCDE'); eq('figRight', 'Düzdür');
  eq('searchBB', 1);
  if (out.bbExam.includes('open') || out.bbExam.length !== 5) fail.push('BB exam items ' + JSON.stringify(out.bbExam));
  if (!out.bbTimeUp.last || !out.bbTimeUp.last.timeUp || out.bbTimeUp.running || out.bbTimeUp.hash !== '#imtahan-netice') fail.push('time-up ' + JSON.stringify(out.bbTimeUp));
  eq('baResult', { pts: 11, max: 11, pct: 100, n: 9 });
  eq('gridAnswered', 9);
  eq('passChips', 4);
  eq('quizClaude', 1);
  eq('iq', ['ex', 'chk', 'chk', 'ex', 'chk']);
  eq('exRight', 'B'); eq('exSolution', 2);
  eq('hintLink', { host: 'claude.ai', path: '/new', params: ['q'], hint: true, question: true });
  eq('chkWrong', 1); eq('chkShowBtn', 1); eq('chkNoSolution', 0); eq('chkSolved', 'Düzdür'); eq('chkOpen', 1);
  eq('chkSaved', ['c3s1k1', 'c3s1k2']); eq('chkKept', 2); eq('sectionClaude', true);
  eq('teacherTab', 'Müəllim');
  eq('teacherTopics', BOOK.prog.subjects.find(s => s.id === 'men').topics.filter(t => t.g.includes('BB')).length);
  eq('teacherEmpty', 1);
  eq('teacherAsk', { params: ['q'], text: true, subj: true });
  eq('teacherSwitch', { hash: '#muellim-inf', kept: 'Sillogizm nədir?' });
  eq('adviceCtx', true);
  eq('bbMissClaude', 5); eq('examNoClaude', 0);
  out.errors = errors.concat(fail);
  console.log(JSON.stringify(out, null, 1));
  process.exit(out.errors.length ? 1 : 0);
})();
