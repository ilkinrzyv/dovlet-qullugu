(function () {
'use strict';

/* =========================================================
   1. Data
   ========================================================= */
const BOOK = window.DQ_BOOK;
const PWA = window.DQ_PWA || null; // offline app build only
const CHAPTERS = BOOK.chapters;
const chById = {}, secById = {}, secCh = {};
CHAPTERS.forEach(c => { chById[c.id] = c; c.sections.forEach(s => { secById[s.id] = s; secCh[s.id] = c.id; }); });
const ORDER = []; // reading order of every section, intro pages included
CHAPTERS.forEach(c => c.sections.forEach(s => ORDER.push(s.id)));
const MAIN = CHAPTERS.filter(c => c.kind === 'chapter');
const LEARNABLE = [];
MAIN.forEach(c => c.sections.forEach(s => LEARNABLE.push(s.id)));
const QUIZ = BOOK.quizzes || {};
const qById = {};
Object.keys(QUIZ).forEach(ch => QUIZ[ch].forEach(q => { qById[q.id] = Object.assign({ ch }, q); }));
const ALL_Q = Object.keys(qById);
const MIX_SIZE = 20;

/* =========================================================
   2. Utilities
   ========================================================= */
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const pct = (a, b) => b ? Math.round(a * 100 / b) : 0;
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// search ignores Azerbaijani letters: “qullugu” finds “qulluğu”
function fold(s) {
  return String(s || '').toLocaleLowerCase('az').replace(/̇/g, '')
    .replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g');
}
const ICONS = {
  book: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
  checklist: '<path d="M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17"/><path d="M11 6h9M11 12h9M11 18h9"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v5h-5"/>',
  shuffle: '<path d="M3 7h3.5c2 0 3.2 1 4.3 2.7l2.4 4.6c1 1.7 2.3 2.7 4.3 2.7H21"/><path d="M3 17h3.5c1.4 0 2.4-.5 3.2-1.3M14.3 8.3c.8-.8 1.8-1.3 3.2-1.3H21"/><path d="M18 4l3 3-3 3M18 14l3 3-3 3"/>',
  redo: '<path d="M4 12a8 8 0 0 1 13.7-5.6L20 9"/><path d="M20 4v5h-5"/><path d="M12 9v4l2.5 1.5"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 20h14"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5"/><path d="M5 4h14"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M11 18.5h2"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
};
const icon = (n, cls) => `<svg class="i${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

let toastTimer = null;
function toast(msg) {
  let t = $('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2400);
}

/* =========================================================
   3. Saved state (this device only)
   ========================================================= */
const KEY = 'dq-kitab:v1';
const blank = () => ({ read: {}, last: '', quiz: {}, wrong: {}, theme: 'auto', fs: 'm' });
let S = blank();
try { S = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { S = blank(); }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Yadda saxlamaq alınmadı — brauzerin yaddaşı doludur və ya bağlıdır.'); } }

const FS = { s: '15.5px', m: '17px', l: '19px' };
function applyLook() {
  const root = document.documentElement;
  if (S.theme === 'light' || S.theme === 'dark') root.setAttribute('data-theme', S.theme); else root.removeAttribute('data-theme');
  root.style.setProperty('--fs', FS[S.fs] || FS.m);
}

const readIn = c => c.sections.filter(s => S.read[s.id]).length;
const totalRead = () => LEARNABLE.filter(id => S.read[id]).length;

/* =========================================================
   4. Shell: top bar, tab bar, router
   ========================================================= */
const TABS = [['home', 'Kitab', 'book'], ['testler', 'Testlər', 'checklist'], ['axtar', 'Axtarış', 'search'], ['ayarlar', 'Ayarlar', 'sliders']];
let tab = 'home';

function topbar(kicker, name, back) {
  $('#topbar .wrap').innerHTML = `
    ${back ? `<a class="ibtn" href="#${esc(back)}" aria-label="Geri">${icon('back')}</a>` : ''}
    <div class="tb-title">${kicker ? `<span class="tb-kicker">${esc(kicker)}</span>` : ''}<span class="tb-name">${esc(name)}</span></div>
    <div class="readbar"><i></i></div>`;
}
function tabbar() {
  $('#tabbar').innerHTML = `<div class="wrap">${TABS.map(([id, label, ic]) =>
    `<a class="tab" href="#${id}" aria-current="${tab === id}">${icon(ic)}<span>${label}</span></a>`).join('')}</div>`;
}

function route() {
  const h = decodeURIComponent(location.hash.slice(1)) || 'home';
  const view = $('#view');
  quizRun = h.startsWith('test-') ? quizRun : null;
  if (secById[h]) { tab = 'home'; vSection(h); }
  else if (chById[h]) { tab = 'home'; vChapter(h); }
  else if (h === 'testler') { tab = 'testler'; vTests(); }
  else if (h.startsWith('test-')) { tab = 'testler'; vQuiz(h.slice(5)); }
  else if (h === 'axtar' || h.startsWith('axtar=')) { tab = 'axtar'; vSearch(h.slice(6)); }
  else if (h === 'ayarlar') { tab = 'ayarlar'; vSettings(); }
  else { tab = 'home'; vHome(); }
  tabbar();
  if (!h.startsWith('axtar')) window.scrollTo(0, 0);
  view.focus({ preventScroll: true });
}

/* =========================================================
   5. Book views
   ========================================================= */
function bar(a, b) { return `<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct(a, b)}"><i style="width:${pct(a, b)}%"></i></div>`; }

function chRow(c) {
  const n = readIn(c), total = c.sections.length;
  const label = c.kind === 'chapter' ? `Fəsil ${c.n}` : 'Giriş';
  return `<a class="chrow" href="#${c.id}">
    <span class="chn">${esc(label)}</span>
    <span class="cht"><b>${esc(c.title)}</b>${c.kind === 'chapter' ? `<span class="chm">${n}/${total} bölmə${QUIZ[c.id] ? ` · ${QUIZ[c.id].length} sual` : ''}</span>${bar(n, total)}` : ''}</span>
    ${icon('chev')}</a>`;
}

function vHome() {
  topbar('', BOOK.title);
  const done = totalRead(), all = LEARNABLE.length;
  const next = S.last && secById[S.last] ? S.last : (LEARNABLE.find(id => !S.read[id]) || ORDER[0]);
  const nextSec = next && secById[next];
  const extras = CHAPTERS.filter(c => c.kind === 'extra');
  const tests = Object.keys(S.quiz).length;
  $('#view').innerHTML = `
    <section class="hero">
      <span class="kicker">İmtahana hazırlıq</span>
      <h1 class="h1">${esc(BOOK.title)}</h1>
      <div class="card stat">
        <div><b>${done}</b><span>/ ${all} bölmə oxunub</span></div>
        <div><b>${tests}</b><span>test işlənib</span></div>
        ${bar(done, all)}
      </div>
      ${nextSec ? `<a class="card cont" href="#${next}">
        <span class="kicker">${S.last ? 'Davam et' : 'Başla'}</span>
        <b>${esc((nextSec.num ? nextSec.num + '. ' : '') + nextSec.title)}</b>
        <span class="muted">${esc(chById[secCh[next]].title)}</span>${icon('arrow')}</a>` : ''}
    </section>
    ${extras.length ? `<section class="block"><div class="list">${extras.map(chRow).join('')}</div></section>` : ''}
    ${BOOK.parts.map(p => `<section class="block">
      <div class="block-h"><h2>${esc(p.title)}</h2></div>
      <div class="list">${p.chapters.map(id => chRow(chById[id])).join('')}</div>
    </section>`).join('')}`;
}

function vChapter(id) {
  const c = chById[id];
  const kicker = c.kind === 'chapter' ? `Fəsil ${c.n}` : 'Giriş';
  topbar(kicker, c.title, 'home');
  const q = QUIZ[id];
  const best = S.quiz[id];
  $('#view').innerHTML = `
    <span class="kicker">${esc(kicker)}</span>
    <h1 class="h1">${esc(c.title)}</h1>
    ${c.lead ? `<div class="prose lead">${c.lead}</div>` : ''}
    <div class="list block">${c.sections.map(s => `<a class="secrow${S.read[s.id] ? ' done' : ''}" href="#${s.id}">
      <span class="tick">${S.read[s.id] ? icon('check') : ''}</span>
      <span class="sect"><b>${esc((s.num ? s.num + '. ' : '') + s.title)}</b><span class="muted">${s.mins} dəq</span></span>
      ${icon('chev')}</a>`).join('')}</div>
    ${q ? `<a class="card quizcta block" href="#test-${id}">
      ${icon('checklist')}<span><b>Fəsil testi</b><span class="muted">${q.length} sual${best ? ` · ən yaxşı nəticə ${best.best}%` : ''}</span></span>${icon('arrow')}</a>` : ''}`;
}

function vSection(id) {
  const s = secById[id], c = chById[secCh[id]];
  const i = ORDER.indexOf(id), prev = ORDER[i - 1], next = ORDER[i + 1];
  const kicker = c.kind === 'chapter' ? `Fəsil ${c.n}${s.num ? ' · ' + s.num : ''}` : c.title;
  topbar(kicker, s.title, c.id);
  if (S.last !== id) { S.last = id; save(); }
  const nav = (sid, dir) => sid ? `<a class="pn ${dir}" href="#${sid}"><span class="muted">${dir === 'prev' ? 'Əvvəlki' : 'Növbəti'}</span><b>${esc(secById[sid].title)}</b></a>` : '<span></span>';
  $('#view').innerHTML = `
    <span class="kicker">${esc(kicker)}</span>
    <h1 class="h1">${esc(s.title)}</h1>
    <div class="row meta muted">${icon('clock')} ${s.mins} dəq oxu</div>
    <article class="prose">${s.html}</article>
    <button type="button" class="btn ${S.read[id] ? 'done' : 'primary'} readbtn" data-act="read">${S.read[id] ? icon('check') + ' Oxunub' : 'Oxudum'}</button>
    <nav class="prevnext">${nav(prev, 'prev')}${nav(next, 'next')}</nav>`;
  $('[data-act="read"]').addEventListener('click', e => {
    if (S.read[id]) delete S.read[id]; else S.read[id] = Date.now();
    save();
    const b = e.currentTarget;
    b.className = `btn ${S.read[id] ? 'done' : 'primary'} readbtn`;
    b.innerHTML = S.read[id] ? icon('check') + ' Oxunub' : 'Oxudum';
  });
}

/* reading progress line under the top bar */
window.addEventListener('scroll', () => {
  const i = $('.readbar i');
  if (!i) return;
  const max = document.documentElement.scrollHeight - innerHeight;
  i.style.width = (secById[location.hash.slice(1)] && max > 0 ? Math.min(100, scrollY * 100 / max) : 0) + '%';
}, { passive: true });

/* =========================================================
   6. Tests
   ========================================================= */
let quizRun = null; // { key, items: [{ id, order }], i, picks: [] } — in memory only

function vTests() {
  topbar('', 'Testlər');
  const wrong = Object.keys(S.wrong).filter(id => qById[id]);
  const withQ = MAIN.filter(c => QUIZ[c.id] && QUIZ[c.id].length);
  $('#view').innerHTML = `
    <span class="kicker">Məşq</span>
    <h1 class="h1">Testlər</h1>
    <p class="muted">Hər sualdan sonra düzgün cavab və izahı görünür. Səhv etdiyin suallar ayrıca toplanır.</p>
    <div class="list block">
      <a class="secrow" href="#test-mix"><span class="tick acc">${icon('shuffle')}</span>
        <span class="sect"><b>Qarışıq test</b><span class="muted">Bütün fəsillərdən ${Math.min(MIX_SIZE, ALL_Q.length)} təsadüfi sual${S.quiz.mix ? ` · son nəticə ${S.quiz.mix.last}%` : ''}</span></span>${icon('chev')}</a>
      <a class="secrow${wrong.length ? '' : ' off'}" href="#test-wrong"${wrong.length ? '' : ' aria-disabled="true" tabindex="-1"'}><span class="tick acc">${icon('redo')}</span>
        <span class="sect"><b>Səhvlərim</b><span class="muted">${wrong.length ? `${wrong.length} sual təkrar gözləyir` : 'Hələ səhv yoxdur'}</span></span>${icon('chev')}</a>
    </div>
    <section class="block"><div class="block-h"><h2>Fəsil testləri</h2></div>
      <div class="list">${withQ.length ? withQ.map(c => {
        const r = S.quiz[c.id];
        return `<a class="secrow" href="#test-${c.id}"><span class="chn">${c.n}</span>
          <span class="sect"><b>${esc(c.title)}</b><span class="muted">${QUIZ[c.id].length} sual${r ? ` · ən yaxşı ${r.best}%` : ''}</span></span>${icon('chev')}</a>`;
      }).join('') : '<p class="muted card">Hələ test yoxdur.</p>'}</div></section>`;
  $$('.secrow.off').forEach(a => a.addEventListener('click', e => e.preventDefault()));
}

function quizIds(key) {
  if (key === 'mix') return shuffle(ALL_Q).slice(0, MIX_SIZE);
  if (key === 'wrong') return shuffle(Object.keys(S.wrong).filter(id => qById[id]));
  return (QUIZ[key] || []).map(q => q.id);
}
function quizName(key) {
  if (key === 'mix') return 'Qarışıq test';
  if (key === 'wrong') return 'Səhvlərim';
  return chById[key] ? `Fəsil ${chById[key].n}. ${chById[key].title}` : 'Test';
}

function vQuiz(key) {
  if (!quizRun || quizRun.key !== key) {
    const ids = quizIds(key);
    if (!ids.length) { location.replace('#testler'); return; }
    quizRun = { key, items: ids.map(id => ({ id, order: shuffle(qById[id].o.map((_, i) => i)) })), i: 0, picks: [] };
  }
  topbar('Test', quizName(key), 'testler');
  if (quizRun.i >= quizRun.items.length) { quizResult(); return; }
  const it = quizRun.items[quizRun.i], q = qById[it.id], picked = quizRun.picks[quizRun.i];
  const n = quizRun.items.length, answered = picked != null;
  $('#view').innerHTML = `
    <div class="row qhead"><span class="kicker">Sual ${quizRun.i + 1} / ${n}</span>${bar(quizRun.i + (answered ? 1 : 0), n)}</div>
    <h1 class="qtext">${esc(q.q)}</h1>
    <div class="opts">${it.order.map((oi, k) => {
      let cls = '';
      if (answered) cls = oi === q.a ? ' right' : (oi === picked ? ' wrong' : ' dim');
      return `<button type="button" class="opt${cls}" data-oi="${oi}"${answered ? ' disabled' : ''}>
        <span class="ol">${'ABCDEF'[k]}</span><span>${esc(q.o[oi])}</span></button>`;
    }).join('')}</div>
    ${answered ? `<div class="card expl ${picked === q.a ? 'ok' : 'bad'}">
      <b>${picked === q.a ? 'Düzdür' : 'Səhvdir'}</b>${q.e ? `<p>${esc(q.e)}</p>` : ''}
      ${q.s && secById[q.s] ? `<a href="#${q.s}">Bölməni oxu: ${esc(secById[q.s].num)}. ${esc(secById[q.s].title)}</a>` : ''}
    </div>
    <button type="button" class="btn primary wide" data-act="next">${quizRun.i + 1 < n ? 'Növbəti sual' : 'Nəticəni gör'} ${icon('arrow')}</button>` : ''}`;
  $$('.opt[data-oi]').forEach(b => b.addEventListener('click', () => {
    const oi = +b.dataset.oi;
    quizRun.picks[quizRun.i] = oi;
    if (oi === q.a) delete S.wrong[it.id]; else S.wrong[it.id] = Date.now();
    save();
    vQuiz(key);
    const nx = $('[data-act="next"]');
    if (nx) nx.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }));
  const nx = $('[data-act="next"]');
  if (nx) nx.addEventListener('click', () => { quizRun.i++; vQuiz(key); window.scrollTo(0, 0); });
}

function quizResult() {
  const { key, items, picks } = quizRun;
  const right = items.filter((it, i) => picks[i] === qById[it.id].a).length;
  const score = pct(right, items.length);
  const prev = S.quiz[key];
  S.quiz[key] = { best: Math.max(score, prev ? prev.best : 0), last: score, at: Date.now() };
  save();
  const missed = items.map((it, i) => ({ q: qById[it.id], p: picks[i] })).filter(x => x.p !== x.q.a);
  $('#view').innerHTML = `
    <span class="kicker">Nəticə</span>
    <h1 class="h1">${right} / ${items.length} düz · ${score}%</h1>
    ${bar(right, items.length)}
    <div class="row block">
      <button type="button" class="btn primary" data-act="again">${icon('refresh')} Yenidən</button>
      <a class="btn" href="#testler">Testlərə qayıt</a>
    </div>
    ${missed.length ? `<section class="block"><div class="block-h"><h2>Səhv cavablar</h2></div>
      <div class="stack">${missed.map(x => `<div class="card miss">
        <b>${esc(x.q.q)}</b>
        <p class="no">${icon('x')} ${esc(x.q.o[x.p])}</p>
        <p class="yes">${icon('check')} ${esc(x.q.o[x.q.a])}</p>
        ${x.q.e ? `<p class="muted">${esc(x.q.e)}</p>` : ''}
      </div>`).join('')}</div></section>` : '<p class="card expl ok"><b>Bütün cavablar düzdür.</b></p>'}`;
  $('[data-act="again"]').addEventListener('click', () => { quizRun = null; vQuiz(key); });
}

/* =========================================================
   7. Search
   ========================================================= */
const INDEX = ORDER.map(id => ({ id, t: fold(secById[id].title), x: fold(secById[id].text), raw: secById[id].text }));

function snippet(raw, q) {
  const f = fold(raw), at = f.indexOf(q);
  if (at < 0) return esc(raw.slice(0, 140)) + (raw.length > 140 ? '…' : '');
  const a = Math.max(0, at - 60), b = Math.min(raw.length, at + q.length + 80);
  return (a ? '…' : '') + esc(raw.slice(a, at)) + '<mark>' + esc(raw.slice(at, at + q.length)) + '</mark>' + esc(raw.slice(at + q.length, b)) + (b < raw.length ? '…' : '');
}

function vSearch(q0) {
  topbar('', 'Axtarış');
  $('#view').innerHTML = `
    <label class="search"><span class="sr">Axtarış</span>${icon('search')}
      <input type="search" id="q" placeholder="Söz və ya ifadə yaz" autocomplete="off" value="${esc(q0)}"></label>
    <div id="hits" class="list block"></div>`;
  const inp = $('#q');
  const run = () => {
    const q = fold(inp.value.trim());
    history.replaceState(null, '', '#axtar' + (inp.value.trim() ? '=' + encodeURIComponent(inp.value.trim()) : ''));
    if (q.length < 2) { $('#hits').innerHTML = '<p class="muted">Ən azı 2 hərf yaz.</p>'; return; }
    const hits = INDEX.filter(e => e.t.includes(q) || e.x.includes(q)).slice(0, 50);
    $('#hits').innerHTML = hits.length ? hits.map(e => {
      const s = secById[e.id], c = chById[secCh[e.id]];
      return `<a class="hit" href="#${e.id}"><span class="kicker">${esc(c.kind === 'chapter' ? `Fəsil ${c.n}` : c.title)}</span>
        <b>${esc((s.num ? s.num + '. ' : '') + s.title)}</b><span class="snip">${snippet(e.raw, q)}</span></a>`;
    }).join('') : '<p class="muted">Heç nə tapılmadı.</p>';
  };
  inp.addEventListener('input', run);
  run();
  if (!q0) inp.focus();
}

/* =========================================================
   8. Settings
   ========================================================= */
function seg(name, cur, opts) {
  return `<div class="seg" role="radiogroup">${opts.map(([v, l]) =>
    `<button type="button" role="radio" aria-checked="${cur === v}" data-${name}="${v}">${l}</button>`).join('')}</div>`;
}

function appRow() {
  if (!PWA) return '<p class="muted">Bu səhifə offline tətbiq kimi açılmayıb — irəliləyiş yenə bu brauzerdə saxlanılır.</p>';
  const st = PWA.installState();
  const off = PWA.sw.ready ? 'Offline hazırdır — internetsiz açılır.' : (PWA.sw.supported ? 'Offline yaddaş hazırlanır…' : 'Offline rejim yalnız HTTPS ünvanında işləyir.');
  return `<p><b>Versiya:</b> <span class="mono">${esc(PWA.VERSION)}</span></p>
    <p>${esc(off)}</p>
    ${st === 'prompt' ? `<button type="button" class="btn primary" data-act="install">${icon('phone')} Tətbiqi quraşdır</button>` : ''}
    ${st === 'ios' ? '<p class="muted">iPhone/iPad: Paylaş düyməsi → “Ana ekrana əlavə et”.</p>' : ''}
    ${st === 'installed' ? '<p class="muted">Tətbiq quraşdırılıb.</p>' : ''}
    <button type="button" class="btn" data-act="update">${icon('refresh')} Yeniləməni yoxla</button>`;
}

function vSettings() {
  topbar('', 'Ayarlar');
  $('#view').innerHTML = `
    <h1 class="h1">Ayarlar</h1>
    <section class="block"><div class="block-h"><h2>Görünüş</h2></div>
      <div class="card stack">
        <div class="set"><span>Rejim</span>${seg('theme', S.theme, [['auto', 'Sistem'], ['light', 'Açıq'], ['dark', 'Qaranlıq']])}</div>
        <div class="set"><span>Mətn ölçüsü</span>${seg('fs', S.fs, [['s', 'Kiçik'], ['m', 'Orta'], ['l', 'Böyük']])}</div>
      </div></section>
    <section class="block"><div class="block-h"><h2>Tətbiq</h2></div>
      <div class="card stack" id="set-app">${appRow()}</div></section>
    <section class="block"><div class="block-h"><h2>Məlumatlar</h2></div>
      <div class="card stack">
        <p class="muted">İrəliləyiş və test nəticələri yalnız bu cihazda saxlanılır. Başqa cihaza keçmək üçün ixrac et, orada idxal et.</p>
        <div class="row">
          <button type="button" class="btn" data-act="export">${icon('download')} İxrac et</button>
          <button type="button" class="btn" data-act="import">${icon('upload')} İdxal et</button>
          <button type="button" class="btn ghost danger" data-act="reset">${icon('trash')} Sıfırla</button>
        </div>
      </div></section>`;
  $$('[data-theme]', $('#view')).forEach(b => b.addEventListener('click', () => { S.theme = b.dataset.theme; save(); applyLook(); vSettings(); }));
  $$('[data-fs]').forEach(b => b.addEventListener('click', () => { S.fs = b.dataset.fs; save(); applyLook(); vSettings(); }));
  bindApp();
  $('[data-act="export"]').addEventListener('click', exportData);
  $('[data-act="import"]').addEventListener('click', importData);
  $('[data-act="reset"]').addEventListener('click', () => {
    if (!confirm('Bütün irəliləyiş və test nəticələri silinsin?')) return;
    S = Object.assign(blank(), { theme: S.theme, fs: S.fs }); save(); toast('Sıfırlandı');
  });
}
function bindApp() {
  const ins = $('[data-act="install"]');
  if (ins) ins.addEventListener('click', async () => { await PWA.install(); refreshApp(); });
  const up = $('[data-act="update"]');
  if (up) up.addEventListener('click', async () => {
    const r = await PWA.checkUpdate();
    toast({ found: 'Yeni versiya yüklənir…', latest: 'Ən son versiyadır.', offline: 'İnternet yoxdur.', none: 'Offline rejim aktiv deyil.' }[r] || 'Yoxlamaq alınmadı.');
  });
}
function refreshApp() { const box = $('#set-app'); if (box) { box.innerHTML = appRow(); bindApp(); } }
if (PWA) ['sw', 'install', 'net'].forEach(t => PWA.on(t, refreshApp));

async function exportData() {
  const name = `dovlet-qullugu-${new Date().toISOString().slice(0, 10)}.json`;
  const text = JSON.stringify({ app: 'dovlet-qullugu', v: 1, at: new Date().toISOString(), data: S }, null, 1);
  if (PWA) { const r = await PWA.saveFile(name, text); if (r !== 'cancelled') toast('Fayl hazırdır'); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}
async function importData() {
  let text = null;
  if (PWA) text = await PWA.pickFile();
  else text = await new Promise(res => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = () => { const f = inp.files[0]; if (!f) return res(null); f.text().then(res, () => res(null)); };
    inp.click();
  });
  if (!text) return;
  let j = null; try { j = JSON.parse(text); } catch (e) { j = null; }
  if (!j || j.app !== 'dovlet-qullugu' || !j.data || typeof j.data !== 'object') { toast('Bu fayl bu kitabın ixracı deyil.'); return; }
  S = Object.assign(blank(), j.data); save(); applyLook(); vSettings(); toast('İdxal olundu');
}

/* =========================================================
   9. Start
   ========================================================= */
applyLook();
window.addEventListener('hashchange', route);
route();
})();
