// App check on the fixture book (build/test/): BA/BB filtering, programme map, open and figure questions, mock exam.
// Run `python build/parse_book.py --src build/test/book.md --quiz build/test/quiz --fig build/test/fig --out build/test/book.json` first.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
const ROOT = path.resolve(__dirname, '..', 'docs');
const BOOK = JSON.parse(fs.readFileSync(path.join(__dirname, 'test', 'book.json'), 'utf-8'));
const ART = 'https://claude.ai/artifact/TEST';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

function serve(port) {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    if (p === '/book.js') { res.writeHead(200, { 'content-type': TYPES['.js'] }); res.end('window.DQ_BOOK=' + JSON.stringify(BOOK) + ';'); return; }
    // a fixed claude.ai address, so the handoff links can be checked whatever the real build points at
    if (p === '/pwa.js') { res.writeHead(200, { 'content-type': TYPES['.js'] }); res.end(fs.readFileSync(path.join(ROOT, 'pwa.js'), 'utf-8').replace(/const ARTIFACT = '[^']*'/, `const ARTIFACT = '${ART}'`)); return; }
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
    if (i === 0) out.quizClaude = await page.$$eval('.expl .ai-box[data-act="q"]', els => els.length);
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

  // ---- questions inside the text (Məntiq): worked examples, checks without a solution ----
  await go('c3s1');
  out.iq = await page.$$eval('.iq', els => els.map(e => e.className.replace(/\b(iq|card)\b/g, '').trim()));
  out.exRight = await page.$eval('.iq.ex .opt.right .ol', el => el.textContent);
  out.exSolution = await page.$$eval('.iq.ex .iqe', els => els.length);
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

  // ---- Claude without a key: the button opens the same place in the claude.ai version, which answers there ----
  await page.evaluate(() => { window.__opened = []; window.open = u => { window.__opened.push(String(u)); return null; }; });
  await page.click('.claudebox [data-ai]');
  await page.locator('.iq.chk').nth(2).locator('[data-ai]').click();
  await page.waitForFunction(() => window.__opened.length === 2);
  out.handoff = await page.evaluate(() => window.__opened);
  await go('muellim');
  await page.evaluate(() => { window.__opened = []; window.open = u => { window.__opened.push(String(u)); return null; }; });
  await page.fill('#tq', 'Sillogizm nədir?');
  await page.click('[data-act="chat-send"]');
  await page.waitForFunction(() => window.__opened.length === 1);
  out.chatHandoff = await page.evaluate(() => window.__opened[0]);

  // ---- Claude with the reader's own API key: the answer streams in place ----
  const apiCalls = [];
  await page.route('https://api.anthropic.com/v1/**', route => {
    const req = route.request();
    if (req.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"data":[]}' });
    const body = JSON.parse(req.postData());
    apiCalls.push(body);
    const text = `Cavab ${apiCalls.length}: **fərqlərə bax**.`;
    const ev = [['message_start', { type: 'message_start', message: { model: body.model } }],
      ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }],
      ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } }],
      ['message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn' } }], ['message_stop', { type: 'message_stop' }]];
    return route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: ev.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join('') });
  });
  await go('ayarlar');
  await page.fill('#aikey', 'sk-ant-test-key-123');
  await page.click('[data-act="key-save"]');
  await page.waitForSelector('[data-act="key-del"]');
  out.keySaved = await page.evaluate(() => localStorage.getItem('dq-kitab:pwa:key'));
  await go('c3s1');
  const hintBox = page.locator('.iq.chk').nth(2).locator('.ai-box');
  await hintBox.locator('[data-ai]').click();
  await hintBox.locator('.ai-meta').waitFor();
  out.inlineAnswer = (await hintBox.locator('.ai-text').innerText()).trim();
  const m0 = JSON.stringify(apiCalls[0].messages);
  out.hintCall = { model: apiCalls[0].model, hint: m0.includes('Cavabı demə'), question: m0.includes('Kvadratın neçə tərəfi') };
  const figBox = page.locator('.iq.ex').nth(1).locator('.ai-box');
  await figBox.locator('[data-ai]').click();
  await figBox.locator('.ai-meta').waitFor();
  const fc = apiCalls[1].messages[0].content;
  out.figureSent = Array.isArray(fc) && fc[0].type === 'image' && fc[0].source.media_type === 'image/png' && fc[fc.length - 1].text.includes('şəkli əlavə olunub');
  await go('ayarlar');
  await page.click('[data-aimodel="claude-haiku-5-5"]');
  await go('c3s1');
  await page.click('.claudebox [data-ai]');
  await page.locator('.claudebox .ai-meta').waitFor();
  out.modelChoice = apiCalls[2].model;
  out.sectionPrompt = JSON.stringify(apiCalls[2].messages).includes('Fəsil 3. Məntiq fəsli');
  await shot('t1-claude');

  // ---- virtual teacher: a chat whose next turn carries the earlier ones ----
  await go('muellim');
  out.teacherTab = await page.$eval('.tab[aria-current="true"] span', el => el.textContent);
  out.teacherTopics = await page.$$eval('[data-topic]', els => els.length);
  await page.fill('#tq', 'Sillogizm nədir?');
  await page.click('[data-act="chat-send"]');
  await page.waitForFunction(() => document.querySelectorAll('#chat .bub.ai.prose').length === 1);
  await page.fill('#tq', 'Bir misal ver');
  await page.click('[data-act="chat-send"]');
  await page.waitForFunction(() => document.querySelectorAll('#chat .bub.ai.prose').length === 2);
  const t1c = apiCalls[apiCalls.length - 2], t2c = apiCalls[apiCalls.length - 1];
  out.chat = { first: JSON.stringify(t1c.messages).includes('Fənn: Məntiq'), roles: t2c.messages.map(m => m.role).join(','), last: t2c.messages[2].content };
  await page.click('[data-adv="0"]');
  await page.waitForFunction(() => document.querySelectorAll('#chat .bub.ai.prose').length === 3);
  out.adviceCtx = JSON.stringify(apiCalls[apiCalls.length - 1].messages).includes('İmtahan (BB qrupu)');
  await page.click('[data-tsubj="inf"]');
  out.teacherSwitch = { hash: await page.evaluate(() => location.hash), kept: await page.$$eval('#chat .bub', els => els.length) };
  await shot('t1-teacher');
  await page.evaluate(() => localStorage.removeItem('dq-kitab:pwa:key'));

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
  out.bbMissClaude = await page.$$eval('.miss .ai-box', els => els.length);

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
    if (i === 0) { await shot('t1-exam'); out.examNoClaude = await page.$$eval('.ai-box', els => els.length); }
    if (i + 1 < ex.items.length) await page.click('[data-act="next"]');
  }
  await page.click('.qgrid summary');
  out.gridAnswered = await page.$$eval('.gq.has', els => els.length);
  await page.click('[data-act="finish"]');
  await page.click('[data-act="ask-yes"]');
  await page.waitForFunction(() => location.hash === '#imtahan-netice');
  await page.waitForSelector('.tbl');
  const last = (await state()).examLast;
  out.baResult = { pts: last.pts, max: last.max, pct: last.pct, n: last.n };
  out.passChips = await page.$$eval('.chip.pass', els => els.length);
  await shot('t1-result');

  // ---- statistics: every answer counts; a wrong round in chapter 1 makes its sections weak ----
  await go('test-c1');
  for (let i = 0; i < 4; i++) {
    if (await page.$('#oa')) { await page.fill('#oa', 'yox'); await page.click('[data-act="check"]'); }
    else {
      const q = await page.$eval('.qtext', el => el.textContent), it = BOOK.quizzes.c1.find(x => x.q === q);
      await page.click(`.opt[data-oi="${(it.a + 1) % it.o.length}"]`);
    }
    await page.click('[data-act="next"]');
  }
  // an older, weaker mock exam, so the trend has two points
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('dq-kitab:v1'));
    s.exams.push({ at: Date.now() - 2 * 864e5, group: 'BA', n: 9, pts: 5, max: 11, pct: 45, timeUp: false,
      bySubj: { qan: { right: 2, n: 5, pts: 3, max: 6 }, men: { right: 1, n: 2, pts: 1, max: 3 } } });
    localStorage.setItem('dq-kitab:v1', JSON.stringify(s));
  });
  await page.reload();
  await go('home');
  out.statLink = await page.$$eval('.statlink[href="#statistika"]', els => els.length);
  await go('statistika');
  out.statTop = await page.$$eval('.stat b', els => els.map(e => e.textContent));
  out.statSubj = await page.$$eval('.srow', els => els.map(e => e.dataset.subj + ' ' + e.querySelector('.chip').textContent));
  out.weak = await page.$$eval('.wk', els => els.map(e => e.dataset.sec + ' ' + e.querySelector('.chn').textContent));
  out.trendPts = await page.$$eval('#trend .pt', els => els.length);
  await page.focus('#trend .pt');
  out.trendTip = (await page.textContent('#trend .tip')).includes('45%') && await page.isVisible('#trend .tip');
  out.trendRows = await page.$$eval('.tbl tbody tr', els => els.length);
  await shot('t1-stats');
  await page.click('.wk[data-sec="c1s1"] a.btn');
  await page.waitForSelector('.qhead .kicker');
  out.topicQuiz = { hash: await page.evaluate(() => location.hash), head: await page.$eval('.qhead .kicker', el => el.textContent) };

  // ---- one subject's timed exam (Məntiq): its own count and time, no pass table, kept apart from whole exams ----
  await go('testler');
  out.subjExLinks = await page.$$eval('.subjex a', els => els.map(a => a.getAttribute('href')));
  await go('imtahan');
  out.subjExRows = await page.$$eval('a.secrow[href^="#imtahan-"]', els => els.length);
  await go('imtahan-men');
  out.menPlan = { h1: await page.$eval('h1.h1', el => el.textContent), rows: await page.$$eval('.tbl tbody tr', els => els.length) };
  await page.click('[data-act="start"]');
  await page.waitForSelector('.timer');
  const mex = (await state()).exam;
  out.menExam = { subj: mex.subj, n: mex.items.length, secs: mex.secs, kicker: await page.$eval('.tb-kicker', el => el.textContent) };
  for (let i = 0; i < mex.items.length; i++) {
    const q = qOf(mex.items[i].id);
    if (q.t === 'open') await page.fill('#oa', q.a[0]); else await page.click(`.opt[data-oi="${(q.a + 1) % q.o.length}"]`); // the closed one wrong
    if (i + 1 < mex.items.length) await page.click('[data-act="next"]');
  }
  await page.click('[data-act="finish"]');
  await page.click('[data-act="ask-yes"]');
  await page.waitForFunction(() => location.hash === '#imtahan-netice');
  await page.waitForSelector('h1.h1');
  out.menResult = { h1: await page.$eval('h1.h1', el => el.textContent), passChips: await page.$$eval('.chip.pass, .chip.fail', els => els.length),
    again: await page.$eval('.row.block a.btn.primary', a => a.getAttribute('href')), saved: (await state()).exams[0].subj };
  await go('imtahan');
  out.fullHist = await page.$$eval('.hist .secrow', els => els.length);
  await go('home');
  out.homeBest = await page.$eval('a.tile[href="#imtahan"] .muted', el => el.textContent);
  await go('statistika');
  out.statSubjEx = await page.$$eval('.sx', els => els.map(e => e.getAttribute('href') + ' ' + e.querySelector('.chn').textContent));
  out.statTrendAfter = await page.$$eval('#trend .pt', els => els.length);
  await shot('t1-stats-subj');
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
  eq('chkWrong', 1); eq('chkShowBtn', 1); eq('chkNoSolution', 0); eq('chkSolved', 'Düzdür'); eq('chkOpen', 1);
  eq('chkSaved', ['c3s1k1', 'c3s1k2']); eq('chkKept', 2);
  eq('handoff', [ART + '#ai-sec-c3s1', ART + '#ai-hint-c3s1k4']);
  eq('chatHandoff', ART + '#ai-chat');
  eq('keySaved', 'sk-ant-test-key-123');
  eq('inlineAnswer', 'Cavab 1: fərqlərə bax.');
  eq('hintCall', { model: 'claude-sonnet-5-5', hint: true, question: true });
  eq('figureSent', true);
  eq('modelChoice', 'claude-haiku-5-5'); eq('sectionPrompt', true);
  eq('teacherTab', 'Müəllim');
  eq('teacherTopics', BOOK.prog.subjects.find(s => s.id === 'men').topics.filter(t => t.g.includes('BB')).length);
  eq('chat', { first: true, roles: 'user,assistant,user', last: 'Bir misal ver' });
  eq('adviceCtx', true);
  eq('teacherSwitch', { hash: '#muellim-inf', kept: 6 });
  eq('bbMissClaude', 5); eq('examNoClaude', 0);
  eq('statLink', 1);
  eq('statTop', ['76%', '9', '100%', '2']);
  eq('statSubj', ['qan 67% · orta', 'men 100% · yaxşı', 'az 100% · yaxşı', 'inf 100% · yaxşı']);
  eq('weak', ['c1s2 50%', 'c1s1 67%']);
  eq('trendPts', 2); eq('trendTip', true); eq('trendRows', 2);
  eq('topicQuiz', { hash: '#test-s-c1s1', head: 'Sual 1 / 3' });
  eq('subjExLinks', ['#imtahan-qan', '#imtahan-men', '#imtahan-az', '#imtahan-inf']);
  eq('subjExRows', 4);
  eq('menPlan', { h1: 'Məntiq sınağı', rows: 1 });
  eq('menExam', { subj: 'men', n: 2, secs: 300, kicker: 'Məntiq sınağı · BA' });
  eq('menResult', { h1: '2 / 3 bal · 67%', passChips: 0, again: '#imtahan-men', saved: 'men' });
  eq('fullHist', 2); eq('homeBest', 'ən yaxşı: 100%');
  eq('statSubjEx', ['#imtahan-men 67%']); eq('statTrendAfter', 2);
  out.errors = errors.concat(fail);
  console.log(JSON.stringify(out, null, 1));
  process.exit(out.errors.length ? 1 : 0);
})();
