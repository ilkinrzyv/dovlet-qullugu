(function () {
'use strict';

/* =========================================================
   1. Data
   ========================================================= */
// the offline app loads book.js; the claude.ai page carries the same data in a JSON script tag
const BOOK = window.DQ_BOOK || JSON.parse(document.getElementById('book-data').textContent);
const PWA = window.DQ_PWA || null; // offline app build only
const CHAPTERS = BOOK.chapters;
const chById = {}, secById = {}, secCh = {}, secAt = {}; // secAt: a section's place in the book
CHAPTERS.forEach(c => { chById[c.id] = c; c.sections.forEach(s => { secById[s.id] = s; secCh[s.id] = c.id; secAt[s.id] = Object.keys(secById).length; }); });
// Law text: every maddə heading and bənd paragraph has an id (konstitusiya-m72, karguzarliq-b25, a decree's bənd -f3).
// #<id> opens its section at that place; test explanations and bookmarks point there.
const ANCH = {};     // id → { s: section id, t: heading or the bənd's text, i: book order }
const SEC_ACTS = {}; // section id → the acts its law text comes from, in order
const deTag = h => h.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
let anchors = 0;
CHAPTERS.forEach(c => c.sections.forEach(s => {
  for (const m of s.html.matchAll(/<(h4|p) id="([\w-]+)">([\s\S]*?)<\/\1>/g)) {
    ANCH[m[2]] = { s: s.id, t: deTag(m[3]).replace(/\s+/g, ' ').trim(), i: anchors++ };
    const act = m[2].replace(/-[mbf]\d[\w-]*$/, ''), list = SEC_ACTS[s.id] || (SEC_ACTS[s.id] = []);
    if (!list.includes(act)) list.push(act);
  }
}));
const QUIZ = BOOK.quizzes || {};
const qById = {};
Object.keys(QUIZ).forEach(ch => QUIZ[ch].forEach(q => { qById[q.id] = Object.assign({ ch }, q); }));
const ALL_Q = Object.keys(qById);
const PROG = BOOK.prog, EXAM = PROG.exam, GROUPS = EXAM.groups;
const SUBJ = {};
PROG.subjects.forEach(s => { SUBJ[s.id] = s; });
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
// open answers: case, spaces, a trailing dot and decimal comma do not matter; letters do
const norm = s => String(s == null ? '' : s).toLocaleLowerCase('az').trim().replace(/\s+/g, ' ').replace(/,/g, '.').replace(/\.$/, '');
function clock(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
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
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
  flag: '<path d="M5 21V4h11l-1.5 4L16 12H5"/>',
  chat: '<path d="M4 5h16v11H10l-4.5 3.5V16H4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  chart: '<path d="M3 20h18"/><path d="M6 20v-6M11 20V6M16 20v-9M21 20V9" transform="translate(-1.5 0)"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  star: '<path d="M12 3.6l2.55 5.2 5.7.83-4.13 4.03.98 5.69L12 16.66 6.9 19.35l.98-5.69-4.13-4.03 5.7-.83z"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  scale: '<path d="M12 4v16M8 20h8M5 7h14"/><path d="M7 7l-2.6 6.2M7 7l2.6 6.2M4 13.2a3 3 0 0 0 6 0z"/><path d="M17 7l-2.6 6.2M17 7l2.6 6.2M14 13.2a3 3 0 0 0 6 0z"/>',
  logic: '<circle cx="6" cy="6.5" r="2.5"/><circle cx="18" cy="6.5" r="2.5"/><circle cx="12" cy="17.5" r="2.5"/><path d="M8.5 6.5h7M7.3 8.7l3.4 6.6M16.7 8.7l-3.4 6.6"/>',
  lang: '<path d="M3 18.5L8 6l5 12.5M4.9 14h6.2"/><circle cx="17.6" cy="15.3" r="2.8"/><path d="M20.4 12.3v6.2"/>',
  monitor: '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M8.5 20h7M12 16.5V20"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>'
};
const icon = (n, cls) => `<svg class="i${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;
// each subject has its colour (.s-qan … in app.css) and icon; chapters without one are the interview part
const SICON = { qan: 'scale', men: 'logic', az: 'lang', inf: 'monitor' };
const sk = subj => 's-' + (SICON[subj] ? subj : 'mus');
const sicon = subj => `<span class="sic">${icon(SICON[subj] || 'user')}</span>`;
// a progress ring, p = 0–100; label: the text in its middle
function ring(p, size, w, label, aria) {
  const c = size / 2, r = (size - w) / 2, len = 2 * Math.PI * r, d = Math.max(0, Math.min(100, p || 0)) * len / 100;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" ${aria ? `role="img" aria-label="${esc(aria)}"` : 'aria-hidden="true"'}>
    <circle class="tr" cx="${c}" cy="${c}" r="${r}" fill="none" stroke-width="${w}"/>
    ${d > 0.5 ? `<circle class="val" cx="${c}" cy="${c}" r="${r}" fill="none" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${d.toFixed(2)} ${len.toFixed(2)}" transform="rotate(-90 ${c} ${c})"/>` : ''}
    ${label ? `<text x="${c}" y="${c}" dy=".36em" text-anchor="middle" font-size="${Math.round(size / 4.2)}">${label}</text>` : ''}</svg>`;
}

let toastTimer = null;
// a yes/no question under `after` (claude.ai shows no confirm() dialogs)
function askHere(after, msg, yes, onYes) {
  const old = after.parentNode.querySelector('.askhere');
  if (old) { old.remove(); return; }
  const d = document.createElement('div');
  d.className = 'card askhere';
  d.setAttribute('role', 'alertdialog');
  d.innerHTML = `<p>${esc(msg)}</p><div class="row"><button type="button" class="btn sm primary" data-act="ask-yes">${esc(yes)}</button>
    <button type="button" class="btn sm ghost" data-act="ask-no">İmtina</button></div>`;
  after.insertAdjacentElement('afterend', d);
  $('[data-act="ask-yes"]', d).addEventListener('click', () => { d.remove(); onYes(); });
  $('[data-act="ask-no"]', d).addEventListener('click', () => { d.remove(); after.focus(); });
  $('[data-act="ask-yes"]', d).focus();
}

function toast(msg) {
  let t = $('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2400);
}

/* =========================================================
   2b. Claude: answers inside the book
   ========================================================= */
// Claude writes its answer right under the button. On claude.ai (the artifact page) it runs on the reader's own
// Claude account through the `sample` capability. In the offline app it needs the reader's own Anthropic API key
// (DQ_PWA.sample); without one, the button opens the same place in the claude.ai version (#ai-<act>-<ref>: claude.ai
// passes on only plain anchors, no slashes), which starts the answer by itself. Only book ids travel in that link — typed text goes to the clipboard.
// The model is the reader's choice (Ayarlar → Claude); "auto" names none and lets Claude pick.
const MODELS = [['auto', 'Avtomatik'], ['claude-opus-5-5', 'Opus 5.5'], ['claude-sonnet-5-5', 'Sonnet 5.5'], ['claude-haiku-5-5', 'Haiku 5.5']];
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch (e) { return false; }
}
const AI = {
  fn: null, images: false,
  ready: Promise.resolve(),
  init() {
    if (PWA) { this.fn = PWA.sample; this.images = true; return; }
    this.ready = (async () => {
      try { this.fn = window.claude && typeof window.claude.use === 'function' ? await window.claude.use('sample') : null; } catch (e) { this.fn = null; }
      if (this.fn && this.fn.limits) { try { this.images = !!(await this.fn.limits()).images; } catch (e) { this.images = false; } }
    })();
  },
  here() { return PWA ? PWA.hasKey() : !!this.fn; },
  opts() { return S.aiModel && S.aiModel !== 'auto' ? { model: S.aiModel } : {}; }
};
function aiErr(e) {
  switch (e && e.code) {
    case 'not_granted': case 'sampling_disabled': case 'not_declared': case 'capability_disabled': case 'capability_removed':
      return 'Claude bu görünüşdə əlçatan deyil: icazə verilməyib və ya hesabda söndürülüb.';
    case 'rate_limited': return 'Hazırda çox sorğu var və ya istifadə limitinə çatmısan. Bir az sonra yenidən cəhd et.';
    case 'session_expired': return 'Sessiyanın vaxtı bitib — claude.ai-a yenidən daxil ol.';
    case 'refused': return 'Claude bu sorğuya cavab vermədi. Sualı başqa cür yaz.';
    case 'empty_completion': return 'Cavab boş gəldi. Sualı qısalt və ya sadələşdir.';
    case 'prompt_too_large': return 'Mətn çox uzundur. Daha qısa sual yaz.';
    case 'offline': return 'İnternet yoxdur. Claude yalnız onlayn işləyir; kitab və testlər offline da işləyir.';
    case 'auth': case 'permission': return 'API açarı qəbul edilmədi. Ayarlar → Claude bölməsində açarı yoxla.';
    case 'credit': return 'Anthropic API hesabında kredit qalmayıb (platform.claude.com → Billing).';
    case 'model': return 'Seçilmiş model bu açarla əlçatan deyil. Ayarlarda başqa model seç.';
    case 'overloaded': return 'Claude hazırda çox yüklüdür. Bir az sonra yenidən cəhd et.';
    case 'network': return 'Claude-a qoşulmaq alınmadı. İnterneti yoxla və yenidən cəhd et.';
    default: return 'Bağlantıda xəta baş verdi. Yenidən cəhd et.';
  }
}
// markdown answers → safe HTML (marked + DOMPurify; plain paragraphs if they are missing)
function mdToHtml(text) {
  let html = null;
  try {
    if (window.marked && window.DOMPurify) html = window.DOMPurify.sanitize(window.marked.parse(String(text || ''), { gfm: true, breaks: false }));
  } catch (e) { html = null; }
  if (html == null) html = String(text || '').split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  return html.replace(/<table>/g, '<div class="tbl"><table>').replace(/<\/table>/g, '</table></div>');
}
// an SVG figure as a PNG for Claude to look at (it accepts raster images only)
function svgToPng(svg) {
  return new Promise(resolve => {
    try {
      const img = new Image();
      img.onload = () => {
        const k = 2, w = (img.naturalWidth || 540) * k, h = (img.naturalHeight || 300) * k;
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
        cv.toBlob(b => resolve(b), 'image/png');
      };
      img.onerror = () => resolve(null);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    } catch (e) { resolve(null); }
  });
}

const subjTitle = id => SUBJ[id] ? SUBJ[id].title : '';
function tutor(subj) {
  return `Sən Azərbaycanda dövlət qulluğuna qəbul imtahanına (DİM-in test imtahanı, ${S.group} vəzifə qrupu) hazırlaşan birinə kömək edən səbirli müəllimsən. Azərbaycan dilində, sadə və addım-addım cavab ver.`
    + (subj === 'qan' ? ' Qanun maddələrinə istinad et; əmin olmadığın faktı uydurma, e-qanun.az-da yoxlamağı məsləhət gör.' : '');
}
// order: the option order the reader saw (letters follow it); null for open questions. img: the figure is attached
function qPlain(q, order, img) {
  const lines = [`Sual: ${clip(q.qt || q.q, 1500)}`];
  if (q.img) lines.push(img ? '(Sualın şəkli əlavə olunub; variantlardakı hərflər şəkildəki hərflərdir.)' : '(Sualda şəkil var, amma əlavə edilə bilmədi — şəkli görmədən ümumi üsulu izah et.)');
  if (q.t === 'open') lines.push('(Açıq sual: cavab yazılır.)');
  else order.forEach((oi, k) => lines.push(`${'ABCDEF'[k]}) ${q.o[oi]}`));
  return lines.join('\n');
}
function ansLabel(q, order, v) {
  if (q.t === 'open') return v == null || v === '' ? 'cavab yazmamışam' : v;
  return v == null ? 'cavab verməmişəm' : `${'ABCDEF'[order.indexOf(v)]}) ${q.o[v]}`;
}
const topicOf = q => q.s && secById[q.s] ? `${secById[q.s].num ? secById[q.s].num + '. ' : ''}${secById[q.s].title}` : '';
function pSection(s, c) {
  const where = `${subjTitle(c.subj) ? subjTitle(c.subj) + ' → ' : ''}Fəsil ${c.n}. ${c.title} → ${s.num ? s.num + '. ' : ''}${s.title}`;
  return `${tutor(c.subj)}\n\nMövzu: ${where}.\nBu mövzunu mənə sadə dillə izah et, 2–3 misal göstər və sonda özümü yoxlamaq üçün 3 sual ver (cavablarını ən sonda ayrıca yaz).\n\nKitabdakı mətn: ${clip(s.text, 6000)}`;
}
// a check question the reader is stuck on: a hint first, never the answer straight away
function pHint(q, order, topic, subj, img) {
  return `${tutor(subj)}\n\nBu yoxlama sualında çətinlik çəkirəm${topic ? ` (mövzu: ${topic})` : ''}. Cavabı demə: hansı qayda və ya üsulun lazım olduğunu izah et və bir-iki ipucu ver ki, cavabı özüm tapım. Sonda “Cavabını yaz, yoxlayım” de.\n\n${qPlain(q, order, img)}`;
}
// an answered question or a worked example: the full solution and one more like it
function pExplain(q, order, picked, topic, subj, img) {
  const e = q.et || (q.k ? '' : q.e);
  return `${tutor(subj)}\n\nBu sualın həllini addım-addım izah et, düz cavabın niyə məhz bu olduğunu göstər və mənə oxşar bir sual ver (cavabını ən sonda yaz)${topic ? `. Mövzu: ${topic}` : ''}.\n\n${qPlain(q, order, img)}`
    + (picked === undefined ? '' : `\nMənim cavabım: ${ansLabel(q, order, picked)}.`)
    + `\nDüz cavab: ${q.t === 'open' ? q.a[0] : ansLabel(q, order, q.a)}.`
    + (e ? `\nKitabdakı izah: ${clip(e, 1500)}` : '');
}

// what a Claude button asks: act = sec | hint | iq | q | topic | adv; ref = a book id; x = {o: order, p: pick}
function inlineAt(ref) {
  const m = /^(.+)k(\d+)$/.exec(ref);
  const s = m && secById[m[1]], q = s && s.qs && s.qs[+m[2]];
  return q ? { s, c: chById[secCh[s.id]], q } : null;
}
function aiTask(act, ref, x) {
  x = x || {};
  if (act === 'sec') { const s = secById[ref]; return s && chById[secCh[ref]].kind === 'chapter' ? { label: `${s.num ? s.num + '. ' : ''}${s.title} — izah`, make: () => pSection(s, chById[secCh[ref]]) } : null; }
  if (act === 'hint' || act === 'iq') {
    const t = inlineAt(ref); if (!t) return null;
    const order = t.q.t === 'open' ? null : t.q.o.map((_, k) => k), topic = `${t.s.num ? t.s.num + '. ' : ''}${t.s.title}`;
    return { label: (act === 'hint' ? 'İpucu: ' : 'Həll: ') + clip(t.q.qt, 80), img: t.q.img,
      make: img => act === 'hint' ? pHint(t.q, order, topic, t.c.subj, img) : pExplain(t.q, order, undefined, topic, t.c.subj, img) };
  }
  if (act === 'q') {
    const q = qById[ref]; if (!q) return null;
    const order = q.t === 'open' ? null : (Array.isArray(x.o) && x.o.length === q.o.length ? x.o : q.o.map((_, k) => k));
    return { label: 'İzah: ' + clip(q.q, 80), img: q.img, make: img => pExplain(q, order, x.p, topicOf(q), q.subj, img) };
  }
  if (act === 'topic') {
    const [sid, i] = ref.split('.'), s = SUBJ[sid], t = s && s.topics[+i];
    return t ? { label: `${s.title}, ${t.num}: ${t.title}`, make: () => pTopic(s, t) } : null;
  }
  if (act === 'adv') { const a = ADVICE[+ref]; return a ? { label: a[0], make: () => pAdvice(a[1]) } : null; }
  return null;
}
const aiBox = (act, ref, label, x) =>
  `<div class="ai-box" data-act="${act}" data-ref="${esc(ref)}"${x ? ` data-x="${esc(JSON.stringify(x))}"` : ''}>
    <button type="button" class="btn sm claude" data-ai>${icon('chat')} <span>${esc(label)}</span></button><div class="ai-out" hidden></div></div>`;
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-ai]');
  if (b) { const box = b.closest('.ai-box'); if (box) runBox(box); }
});

// the offline app without a key: the same place in the claude.ai version starts the answer there
function handoff(path, copy) {
  if (!PWA) { toast('Claude bu görünüşdə əlçatan deyil.'); return; }
  if (!PWA.online()) { toast('İnternet yoxdur — Claude yalnız onlayn işləyir.'); return; }
  const url = PWA.artifactLink(path);
  if (!url) { toast('Claude üçün Ayarlarda öz API açarını əlavə et.'); return; }
  if (copy) copyText(copy);
  const w = window.open(url, '_blank');
  if (w) { try { w.opener = null; } catch (e) { } }
  toast(copy ? 'claude.ai versiyası açılır. Sualın kopyalandı — orada yapışdır.' : 'claude.ai versiyası açılır — Claude cavabı orada özü başladacaq.');
}

async function runBox(box) {
  const act = box.dataset.act, ref = box.dataset.ref;
  let x = null; try { x = box.dataset.x ? JSON.parse(box.dataset.x) : null; } catch (e) { x = null; }
  const task = aiTask(act, ref, x);
  if (!task) return;
  await AI.ready;
  if (!AI.here()) { handoff(`ai-${act}-${ref}`); return; }
  const out = $('.ai-out', box), btn = $('[data-ai]', box);
  if (box._ctl) return; // already answering
  let images = null;
  if (task.img && AI.images) { const png = await svgToPng(task.img); if (png) images = [png]; }
  const input = task.make(!!images);
  btn.disabled = true;
  const res = await aiStream(out, [{ role: 'user', content: input }], { images, holder: box });
  btn.disabled = false;
  if (res) {
    const more = document.createElement('div');
    more.className = 'row ai-more';
    more.innerHTML = `<button type="button" class="btn sm ghost" data-act="ai-chat">${icon('chat')} Müəllimlə davam et</button>`;
    more.firstChild.addEventListener('click', () => { CHAT.turns = [{ role: 'user', content: input, label: task.label }, { role: 'assistant', content: res.text }]; location.hash = '#muellim'; });
    out.appendChild(more);
  }
}
// stream one answer into `out`; resolves {text} or null. holder._ctl marks a call in progress
async function aiStream(out, turns, o) {
  const holder = o.holder || out;
  const ctl = new AbortController();
  holder._ctl = ctl;
  out.hidden = false;
  out.innerHTML = `<div class="ai-wait"><span class="ai-dot"></span>Claude düşünür…</div><div class="ai-text prose"></div><div class="row ai-ctl"><button type="button" class="btn sm ghost" data-act="ai-stop">${icon('x')} Dayandır</button></div>`;
  const textEl = $('.ai-text', out), wait = $('.ai-wait', out), ctlRow = $('.ai-ctl', out);
  ctlRow.firstChild.addEventListener('click', () => ctl.abort());
  const opts = Object.assign({ signal: ctl.signal, onText: ({ text }) => { wait.hidden = true; textEl.innerHTML = mdToHtml(text); } }, AI.opts());
  if (o.chat) opts.cache = false; // every chat turn must be a fresh answer; one-off explanations may replay
  if (o.images) opts.images = o.images;
  let res = null;
  try {
    res = await AI.fn(turns, opts);
    textEl.innerHTML = mdToHtml(res.text);
    const model = res.modelApplied ? (MODELS.find(m => m[0] === res.modelApplied) || [0, res.modelApplied])[1] : '';
    ctlRow.outerHTML = `<p class="ai-meta">Claude${model ? ' · ' + esc(model) : ''}${res.truncated ? ' · cavab yarımçıq qaldı' : ''} · faktları kitabla yoxla</p>`;
  } catch (e) {
    wait.hidden = true;
    if (e && e.text) textEl.innerHTML = mdToHtml(e.text); else if (!(e && e.code === 'cancelled')) textEl.innerHTML = '';
    ctlRow.outerHTML = e && e.code === 'cancelled' ? '<p class="ai-meta">Dayandırıldı.</p>' : `<p class="ai-err">${esc(aiErr(e))}</p>`;
    res = null;
  } finally { holder._ctl = null; }
  return res;
}

// a link from the offline app (#ai-<act>-<ref>): open the place, then ask once
let PENDING = null;
function aiTarget(act, ref) {
  if (act === 'sec') return ref;
  if (act === 'hint' || act === 'iq') { const t = inlineAt(ref); return t ? t.s.id : 'home'; }
  if (act === 'q') return 'sual-' + ref;
  if (act === 'topic') return 'muellim-' + ref.split('.')[0];
  return 'muellim';
}
function runPending() {
  const p = PENDING; PENDING = null;
  if (!p) return;
  if (p.act === 'chat') { toast('Sualın kopyalanıb — aşağıdakı sahəyə yapışdır və göndər.'); return; }
  if (p.act === 'topic' || p.act === 'adv') { const t = aiTask(p.act, p.ref); if (t) chatSend(t.make(), t.label); return; }
  const box = $$('.ai-box').find(b => b.dataset.act === p.act && b.dataset.ref === p.ref);
  if (!box) return;
  box.scrollIntoView({ block: 'center' });
  runBox(box);
}

/* =========================================================
   3. Saved state (this device only)
   ========================================================= */
const KEY = 'dq-kitab:v1';
// themeV: saved after light became the default look (2026-10-31); before that "auto" (Sistem) was only the default
// lawV: saved after the Qanunvericilik chapters became the full law text (2026-11-01); read marks from before were
// set on the old summary sections, which no longer line up with the new ones
// at: [section, block] — where in the last section the reader stopped (“Davam et” opens it there)
// marks: bookmarks, a section id or a law anchor (konstitusiya-m72) → when it was marked
const blank = () => ({ read: {}, last: '', at: null, marks: {}, quiz: {}, wrong: {}, ans: {}, chk: {}, aiModel: 'auto', theme: 'light', themeV: 1, lawV: 1, fs: 'm', group: GROUPS[0], exam: null, exams: [], examLast: null });
// A state an older version saved (on this device or in an exported file), brought up to date
function upgrade(saved) {
  if (saved.theme === 'auto' && !saved.themeV) saved.theme = 'light';   // the same rule as look.js
  if (saved.read && !saved.lawV) Object.keys(saved.read).forEach(id => { if (secCh[id] && chById[secCh[id]].subj === 'qan') delete saved.read[id]; });
  return Object.assign(blank(), saved);
}
let S = blank();
try { S = upgrade(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { S = blank(); }
if (!GROUPS.includes(S.group)) S.group = GROUPS[0];
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Yadda saxlamaq alınmadı — brauzerin yaddaşı doludur və ya bağlıdır.'); } }

const FS = { s: '15.5px', m: '17px', l: '19px' };
let ownTheme = !!window.DQ_LOOK; // data-theme set by this app (look.js sets it first); the claude.ai viewer may set its own
let lookWatch = null;
function applyLook() {
  const root = document.documentElement;
  if (S.theme === 'light' || S.theme === 'dark') { root.setAttribute('data-theme', S.theme); ownTheme = true; }
  else if (ownTheme) { root.removeAttribute('data-theme'); ownTheme = false; }
  root.style.setProperty('--fs', FS[S.fs] || FS.m);
  // a look the reader chose here wins over one the claude.ai viewer applies later; "Sistem" leaves the viewer's in place
  if (!lookWatch && window.MutationObserver) {
    lookWatch = new MutationObserver(() => {
      if ((S.theme === 'light' || S.theme === 'dark') && root.getAttribute('data-theme') !== S.theme) root.setAttribute('data-theme', S.theme);
    });
    lookWatch.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  }
}

/* what the chosen position group sees */
const vis = x => !x || !x.g || x.g.includes(S.group);
const visChapters = () => CHAPTERS.filter(vis);
const visSections = c => c.sections.filter(vis);
function order() { const o = []; visChapters().forEach(c => visSections(c).forEach(s => o.push(s.id))); return o; }
function learnable() { const o = []; visChapters().filter(c => c.kind === 'chapter').forEach(c => visSections(c).forEach(s => o.push(s.id))); return o; }
const pool = () => ALL_Q.filter(id => vis(qById[id]) && vis(chById[qById[id].ch]));
const chQuiz = id => (QUIZ[id] || []).filter(q => vis(q)).map(q => q.id);
const readIn = c => visSections(c).filter(s => S.read[s.id]).length;
const onlyFor = x => x && x.g && x.g.length < GROUPS.length ? `<span class="chip">yalnız ${esc(x.g.join(', '))}</span>` : '';

/* =========================================================
   4. Shell: top bar, tab bar, router
   ========================================================= */
// search opens from the book's own top bar; the tab bar floats and shows the label of the open tab only
const TABS = [['home', 'Kitab', 'book'], ['testler', 'Testlər', 'checklist'], ['muellim', 'Müəllim', 'chat'], ['statistika', 'Statistika', 'chart'], ['ayarlar', 'Ayarlar', 'sliders']];
let tab = 'home';
let focus = false; // reading, a test or the exam: the tab bar gives way to the page's own bar
let examTimer = null;
// a view sets `after` to say where to scroll once it is on screen (default: the top)
let after = null, curSec = null;
// A test's explanation opened the book (a maddə, or the question's section): the test waits — quizRun is kept — and the
// book offers the way back. { h: the test's route, y: where it was scrolled, n: book pages opened since, label }
let RET = null;
let RESUME = false; // “Davam et” was tapped: the last section opens where the reader stopped

// o.big: a tab's own page (a large title on the left); o.close: the way back is an ×; o.mid: html instead of the title
function topbar(kicker, name, back, extra, sub, o) {
  o = o || {};
  $('#topbar').classList.toggle('big', !!o.big);
  $('#topbar .wrap').innerHTML = `
    ${back ? `<a class="ibtn" href="#${esc(back)}" aria-label="${o.close ? 'Bağla' : 'Geri'}"${RET && back === RET.h ? ' data-retgo' : ''}>${icon(o.close ? 'x' : 'back')}</a>` : ''}
    ${o.mid != null ? o.mid : `<div class="tb-title">${kicker ? `<span class="tb-kicker">${esc(kicker)}</span>` : ''}<span class="tb-name">${esc(name)}</span></div>`}
    ${extra || (back && o.mid == null ? '<span class="ibtn-sp"></span>' : '')}<div class="readbar"><i></i></div>`;
  // a second row that stays on screen with the bar (the programme's subject tabs)
  let row = $('#topbar .tb-sub');
  if (sub && !row) { row = document.createElement('div'); row.className = 'wrap tb-sub'; $('#topbar').appendChild(row); }
  if (sub) row.innerHTML = sub; else if (row) row.remove();
}
function tabbar() {
  $('#tabbar').innerHTML = `<div class="wrap">${TABS.map(([id, label, ic]) =>
    `<a class="tab" href="#${id}" aria-current="${tab === id}" aria-label="${label}">${icon(ic)}<span>${label}</span></a>`).join('')}</div>`;
  document.body.classList.toggle('focus', focus);
}
// home: the bar shows the book's name only once the big title has scrolled away
let heroWatch = null;
function quietTitle(el) {
  const bar = $('#topbar'), watch = !!(el && window.IntersectionObserver);
  if (heroWatch) { heroWatch.disconnect(); heroWatch = null; }
  bar.classList.toggle('quiet', watch);
  if (!watch) return;
  heroWatch = new IntersectionObserver(([e]) => bar.classList.toggle('quiet', e.isIntersecting), { rootMargin: '-64px 0px 0px 0px' });
  heroWatch.observe(el);
}
// a view redrawn in place (a test's next question, its result) says whether the tab bar shows
function setFocus(on) { focus = on; document.body.classList.toggle('focus', on); }
// a sheet over the page's bottom: the page gets the room to scroll everything above it
function fitSheet(sh) {
  if (!sh) return;
  const fit = () => { const h = sh.offsetHeight + 16 + 'px'; $('#view').style.paddingBottom = h; document.documentElement.style.scrollPaddingBottom = h; };
  fit();
  if (window.ResizeObserver) new ResizeObserver(fit).observe(sh);
}

document.addEventListener('click', e => {
  const t = e.target;
  if (!t || !t.closest) return;
  if (t.closest('a.lawref, a[data-ret]')) {
    const h = decodeURIComponent(location.hash.slice(1));
    const label = h.startsWith('sual-') ? 'Suala qayıt' : h === 'imtahan-netice' || (quizRun && quizRun.i >= quizRun.items.length) ? 'Nəticəyə qayıt' : 'Testə qayıt';
    RET = { h, y: window.scrollY, n: 0, label };
    return;
  }
  if (t.closest('[data-retgo]') && RET) { // straight back when the test is the page before this one
    e.preventDefault();
    if (RET.n === 1) history.back(); else location.hash = '#' + RET.h;
    return;
  }
  if (t.closest('[data-resume]')) RESUME = true;
  const mk = t.closest('[data-mark]');
  if (mk) toggleMark(mk.dataset.mark);
});

function route() {
  const h = decodeURIComponent(location.hash.slice(1)) || 'home';
  const ai = /^ai-(sec|hint|iq|q|topic|adv|chat)(?:-([\w.]+))?$/.exec(h);
  if (ai) { PENDING = { act: ai[1], ref: ai[2] || '' }; location.replace('#' + aiTarget(ai[1], ai[2] || '')); return; }
  clearInterval(examTimer); examTimer = null;
  const sec = ANCH[h] ? ANCH[h].s : secById[h] ? h : null;
  const back = RET && h === RET.h ? RET : null;
  if (back || (RET && !sec)) RET = null; else if (RET) RET.n++;
  if (!h.startsWith('test-') && !RET) quizRun = null;
  const resume = RESUME;
  RESUME = false; after = null; curSec = null; toTop.hidden = true; focus = false;
  $('#view').style.paddingBottom = ''; document.documentElement.style.scrollPaddingBottom = '';
  quietTitle(null);
  if (sec) { tab = 'home'; vSection(sec, ANCH[h] ? h : null, resume); }
  else if (h === 'elfecinler') { tab = 'home'; vMarks(); }
  else if (h.startsWith('sual-') && qById[h.slice(5)]) { tab = 'testler'; vQuestion(h.slice(5)); }
  else if (chById[h]) { tab = 'home'; vChapter(h); }
  else if (h === 'proqram' || h.startsWith('proqram-')) { tab = 'home'; vProgram(h.slice(8)); }
  else if (h === 'testler') { tab = 'testler'; vTests(); }
  else if (h.startsWith('test-')) { tab = 'testler'; vQuiz(h.slice(5)); }
  else if (h === 'imtahan') { tab = 'testler'; vExam(); }
  else if (h === 'imtahan-netice') { tab = 'testler'; vExamResult(); }
  else if (h.startsWith('imtahan-') && SUBJ[h.slice(8)]) { tab = 'testler'; vExam(h.slice(8)); }
  else if (h === 'statistika') { tab = 'statistika'; vStats(); }
  else if (h === 'muellim' || h.startsWith('muellim-')) { tab = 'muellim'; vTeacher(h.slice(8)); }
  else if (h === 'axtar' || h.startsWith('axtar=')) { tab = 'home'; vSearch(h.slice(6)); }
  else if (h === 'ayarlar') { tab = 'ayarlar'; vSettings(); }
  else { tab = 'home'; vHome(); }
  // under a back button the bar shows the page's title only once its own big title has scrolled away
  if (!heroWatch && !$('#topbar').classList.contains('big')) { const t = $('#view h1.h1:not(.sr)'); if (t) quietTitle(t); }
  tabbar();
  if (after) after();
  else if (back) window.scrollTo(0, back.y);
  else if (!h.startsWith('axtar')) window.scrollTo(0, 0);
  $('#view').focus({ preventScroll: true });
  if (PENDING) AI.ready.then(runPending);
}

/* =========================================================
   5. Book views
   ========================================================= */
function bar(a, b) { return `<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct(a, b)}"><i style="width:${pct(a, b)}%"></i></div>`; }
const groupNote = x => vis(x) ? '' : `<p class="card note">Bu mövzu ${esc(S.group)} qrupunun proqramında yoxdur — yalnız ${esc(x.g.join(', '))} üçündür.</p>`;

function chRow(c) {
  const secs = visSections(c), n = readIn(c), nq = chQuiz(c.id).length, chap = c.kind === 'chapter';
  return `<a class="chrow${chap ? ' ' + sk(c.subj) : ''}" href="#${c.id}">
    <span class="chn" aria-label="${chap ? `Fəsil ${c.n}` : 'Giriş'}">${chap ? c.n : icon('book')}</span>
    <span class="cht"><b>${esc(c.title)}</b>${chap ? `<span class="chm">${n}/${secs.length} bölmə${nq ? ` · ${nq} sual` : ''} ${onlyFor(c)}</span>${bar(n, secs.length)}` : '<span class="chm">Giriş</span>'}</span>
    ${icon('chev')}</a>`;
}

function coverage(subj) {
  const topics = SUBJ[subj].topics.filter(vis);
  return [topics.filter(t => (t.see || []).some(x => vis(chById[x] || secById[x]))).length, topics.length];
}

function vHome() {
  const [name, sub] = BOOK.title.split(/:\s*/);
  topbar(`${S.group} qrupu · ${sub || 'İmtahana hazırlıq'}`, name, null,
    `<a class="ibtn" href="#axtar" aria-label="Axtarış">${icon('search')}</a>`, null, { big: true });
  const all = learnable(), done = all.filter(id => S.read[id]).length;
  const next = S.last && secById[S.last] && vis(secById[S.last]) ? S.last : (all.find(id => !S.read[id]) || order()[0]);
  const nextSec = next && secById[next], nextCh = nextSec && chById[secCh[next]];
  const chSecs = nextCh ? visSections(nextCh) : [], chDone = chSecs.filter(s => S.read[s.id]).length;
  const extras = CHAPTERS.filter(c => c.kind === 'extra' && vis(c));
  const T = tally(pool());
  const full = S.exams.filter(r => r.group === S.group && !r.subj);
  const best = full.reduce((m, r) => Math.max(m, r.pct), -1);
  const marks = Object.keys(S.marks).filter(k => markInfo(k)).length;
  const parts = BOOK.parts.filter(vis).map(p => {
    const chs = p.chapters.map(id => chById[id]).filter(vis), secs = chs.flatMap(visSections), subj = p.subj || '';
    const t = tally(pool().filter(id => (qById[id].subj || '') === subj));
    return { p, chs, secs, subj, read: secs.filter(s => S.read[s.id]).length, name: p.title.split(/\s+[—–-]\s+/).pop(), acc: t.n ? pct(t.r, t.n) : null };
  });
  const hours = EXAM.minutes % 60 ? `${EXAM.minutes} dəq` : `${EXAM.minutes / 60} saat`;
  $('#view').innerHTML = `
    ${nextSec ? `<a class="hero cont" href="#${next}" data-resume>
      <span class="pill">${S.last ? 'Davam et' : 'Başla'} · ${nextSec.mins} dəq</span>
      <b>${esc(secName(nextSec))}</b>
      <span class="hero-foot"><span>${bar(chDone, chSecs.length)}${esc(nextCh.kind === 'chapter' ? `Fəsil ${nextCh.n}` : nextCh.title)} · ${chDone} / ${chSecs.length} bölmə</span>
        <span class="hero-go">${icon('arrow')}</span></span></a>` : ''}
    <div class="kpis">
      <a class="kpi" href="#proqram"><span class="sic">${icon('book')}</span><b>${pct(done, all.length)}%</b><span>kitab oxunub</span></a>
      <a class="kpi" href="#statistika"><span class="sic ok">${icon('check')}</span><b>${T.n ? pct(T.r, T.n) + '%' : '—'}</b><span>düz cavab</span></a>
      <a class="kpi" href="#imtahan"><span class="sic warm">${icon('timer')}</span><b>${full.length ? full[0].pct + '%' : '—'}</b><span>son sınaq</span></a>
    </div>
    <section class="block">
      <div class="block-h"><h2>Fənlər</h2><a href="#proqram">Proqram</a></div>
      <nav class="subjnav" aria-label="Fənlər">${parts.filter(x => x.chs.length).map(x => `<button type="button" class="subj ${sk(x.subj)}" data-part="${esc(x.p.id)}">
        <span class="subj-top">${sicon(x.subj)}${ring(pct(x.read, x.secs.length), 40, 5)}</span>
        <span><b>${esc(x.name)}</b><span class="muted">${x.read}/${x.secs.length} bölmə${x.acc != null ? ` · ${x.acc}% düz` : ''}</span></span></button>`).join('')}</nav>
    </section>
    <a class="night" href="#imtahan"><span class="sic">${icon('timer')}</span>
      <span><b>Sınaq imtahanı</b><span class="muted">${S.exam ? 'davam edir' : `${FULL} sual · ${hours}${best >= 0 ? ` · ən yaxşı: ${best}%` : ''}`}</span></span>
      <span class="go">${S.exam ? 'Davam et' : 'Başla'}</span></a>
    <section class="block"><div class="list">
      <a class="chrow" href="#elfecinler"><span class="chn star">${icon('star')}</span>
        <span class="cht"><b>Əlfəcinlər</b><span class="chm">${marks ? `${marks} qeyd` : 'Vacib bölmə və maddələri ulduzla qeyd et'}</span></span>${icon('chev')}</a>
      ${extras.map(chRow).join('')}</div></section>
    ${parts.map(({ p, chs, secs, read, subj }) => `<section class="block ${sk(subj)}" id="part-${esc(p.id)}">
        <div class="block-h ph"><h2>${esc(p.title)}</h2>${secs.length ? `<span>${read}/${secs.length} bölmə</span>` : ''}</div>
        ${secs.length ? bar(read, secs.length) : ''}
        ${chs.length ? `<div class="list">${chs.map(chRow).join('')}</div>`
          : `<p class="card muted empty">Hazırlanır.${p.subj ? ` Mövzular <a href="#proqram-${p.subj}">Proqram</a> səhifəsindədir.` : ''}</p>`}
      </section>`).join('')}`;
  $$('[data-part]').forEach(b => b.addEventListener('click', () => $('#part-' + b.dataset.part).scrollIntoView({ behavior: 'smooth' })));
}

function vChapter(id) {
  const c = chById[id];
  const kicker = c.kind === 'chapter' ? `Fəsil ${c.n}` : 'Giriş';
  topbar(kicker, c.title, 'home');
  const q = chQuiz(id), best = S.quiz[id], tests = secTests();
  // under each section: reading time, its checks solved so far, its test questions
  const meta = s => {
    const chk = (s.qs || []).map((x, i) => x.k === 'chk' ? `${s.id}k${i}` : '').filter(Boolean);
    return [`${s.mins} dəq`, chk.length ? `${chk.filter(k => S.chk[k]).length}/${chk.length} tapşırıq` : '',
      tests[s.id] ? `${tests[s.id]} test sualı` : ''].filter(Boolean).join(' · ');
  };
  $('#view').innerHTML = `
    <span class="kicker">${esc(kicker)}</span>
    <h1 class="h1">${esc(c.title)}</h1>
    ${groupNote(c)}
    ${c.lead ? `<div class="prose lead">${c.lead}</div>` : ''}
    ${q.length ? `<a class="card quizcta block" href="#test-${id}">
      ${icon('checklist')}<span><b>Fəsil testi</b><span class="muted">${q.length} sual${best ? ` · ən yaxşı nəticə ${best.best}%` : ''}</span></span>${icon('arrow')}</a>` : ''}
    <div class="list block">${visSections(c).map(s => `<a class="secrow${S.read[s.id] ? ' done' : ''}" href="#${s.id}">
      <span class="tick">${S.read[s.id] ? icon('check') : ''}</span>
      <span class="sect"><b>${esc((s.num ? s.num + '. ' : '') + s.title)}</b><span class="muted">${meta(s)} ${onlyFor(s)}</span></span>
      ${icon('chev')}</a>`).join('')}</div>`;
}
// test questions per section, for the chosen group
function secTests() { const n = {}; pool().forEach(id => { const s = qById[id].s; if (s) n[s] = (n[s] || 0) + 1; }); return n; }

// anchor: a maddə (bənd) to open the section at; resume: open it where the reader stopped (“Davam et”)
function vSection(id, anchor, resume) {
  const s = secById[id], c = chById[secCh[id]], law = c.subj === 'qan';
  const ord = order(), i = ord.indexOf(id), prev = i > 0 ? ord[i - 1] : null, next = i >= 0 ? ord[i + 1] : null;
  const kicker = c.kind === 'chapter' ? `Fəsil ${c.n}${s.num ? ' · ' + s.num : ''}` : c.title;
  topbar(kicker, s.title, RET ? RET.h : c.id, markBtn(id, 'ibtn mark', 'Bölməni əlfəcinlərə əlavə et'));
  curSec = id; focus = true;
  if (S.last !== id) { S.last = id; save(); }
  const nq = secTests()[id] || 0, best = S.quiz['s-' + id], nmad = law ? (s.html.match(/<h4 id=/g) || []).length : 0;
  const nav = (sid, dir) => sid ? `<a class="pn ${dir}" href="#${sid}"><span class="muted">${dir === 'prev' ? 'Əvvəlki' : 'Növbəti'}</span><b>${esc(secById[sid].title)}</b></a>` : '<span></span>';
  // the text on a white sheet; back, read and next in a bar under the thumb (the tab bar gives way while reading)
  $('#view').innerHTML = `<div class="paper ${sk(c.subj)}">
    <div class="chips">
      <span class="chip">${icon('clock')} ${s.mins} dəq</span>
      ${nmad ? `<span class="chip">${nmad} maddə</span>` : ''}
      ${nq ? `<a class="quizcta secq" href="#test-s-${id}">${icon('checklist')}<span>Test · <span class="muted">${nq} sual${best ? ` · ən yaxşı ${best.best}%` : ''}</span></span>${icon('arrow')}</a>` : ''}
      ${onlyFor(s)}
    </div>
    <h1 class="h1">${esc(s.title)}</h1>
    <p class="muted small secof">${esc(c.kind === 'chapter' ? `Fəsil ${c.n} · ${c.title}` : c.title)}</p>
    ${groupNote(vis(c) ? s : c)}
    <article class="prose${law ? ' law' : ''}">${s.html}</article>
    ${c.kind === 'chapter' ? `<div class="card claudebox"><span class="muted small">Aydın olmayan yer var? Virtual müəllim izah etsin.</span>${aiBox('sec', s.id, 'Claude-dan izah istə')}</div>` : ''}
    <nav class="prevnext">${nav(prev, 'prev')}${nav(next, 'next')}</nav>
    <div class="fabspace"></div>
    </div>
    ${RET ? `<a class="retpill" href="#${esc(RET.h)}" data-retgo>${icon('back')} ${esc(RET.label)}</a>` : ''}
    <nav class="actbar" aria-label="Bölmə">
      <a class="ab-ic" href="#${prev || c.id}" aria-label="${prev ? 'Əvvəlki bölmə' : 'Fəslə qayıt'}">${icon('back')}</a>
      <button type="button" class="ab-read${S.read[id] ? ' done' : ''}" data-act="read" aria-pressed="${!!S.read[id]}">${icon('check')}<span>${S.read[id] ? 'Oxunub' : 'Oxudum'}</span></button>
      <a class="ab-next" href="#${next || c.id}">${next ? 'Növbəti' : 'Fəslə qayıt'} ${icon('arrow')}</a>
    </nav>`;
  $('[data-act="read"]').addEventListener('click', e => {
    if (S.read[id]) delete S.read[id]; else S.read[id] = Date.now();
    save();
    const b = e.currentTarget;
    b.classList.toggle('done', !!S.read[id]);
    b.setAttribute('aria-pressed', !!S.read[id]);
    $('span', b).textContent = S.read[id] ? 'Oxunub' : 'Oxudum';
  });
  (s.qs || []).forEach((q, i) => { const box = $(`.iq[data-i="${i}"]`); if (box) inlineQ(box, s, c, q, i); });
  if (law) {
    lawToc();
    // “Maddə 1. Hakimiyyətin mənbəyi” → a number pill and the name; the text itself stays the same
    $$('article.prose h4[id]').forEach(h => {
      const m = !h.children.length && /^(Maddə\s+[^\s.]+)(\.?\s*)([\s\S]*)$/.exec(h.textContent);
      if (m) h.innerHTML = `<span class="mnum">${esc(m[1])}</span><span class="msep">${esc(m[2])}</span><span class="mname">${esc(m[3])}</span>`;
      h.insertAdjacentHTML('beforeend', markBtn(h.id, 'hmark', 'Maddəni əlfəcinlərə əlavə et'));
    });
  }
  if (anchor) after = () => showAnchor(anchor);
  else if (resume && S.at && S.at[0] === id && S.at[1] > 0) after = () => {
    const el = $('article.prose').children[S.at[1]];
    if (el) el.scrollIntoView(); else window.scrollTo(0, 0);
  };
}

// a long law section starts with its maddələr (bəndlər for the Təlimat); each opens its place, marked
function lawToc() {
  const art = $('article.prose.law');
  let items = $$('h4[id]', art), what = 'maddələr';
  if (!items.length) { items = $$('p[id]', art); what = 'bəndlər'; }
  if (items.length < 3) return;
  const row = el => {
    const m = /^(?:Maddə\s+)?([^\s.]+)\.?\s*(.*)$/.exec(ANCH[el.id] ? ANCH[el.id].t : el.textContent) || ['', '', ''];
    const nx = el.nextElementSibling, name = m[2] || (nx && /çıxarılıb/.test(nx.textContent) ? 'çıxarılıb' : '');
    return `<li><a href="#${el.id}"><span class="tn">${esc(m[1])}</span><span>${esc(clip(name, 160))}</span></a></li>`;
  };
  const d = document.createElement('details');
  d.className = 'card toc';
  d.innerHTML = `<summary>Bu bölmədəki ${what} <span class="muted">${items.length}</span></summary><ol>${items.map(row).join('')}</ol>`;
  art.parentNode.insertBefore(d, art);
}
// a maddə (bənd) opened from a link: scrolled to, and marked through the end of its text
function showAnchor(id) {
  const el = document.getElementById(id);
  if (!el) { window.scrollTo(0, 0); return; }
  let x = el;
  do { x.classList.add('hl'); x = x.nextElementSibling; } while (x && !/^H[45]$/.test(x.tagName) && !(el.tagName === 'P' && x.id));
  el.scrollIntoView({ block: 'start' });
}

/* bookmarks: a section (the star in the top bar) or a maddə (the star by its heading) */
const markBtn = (k, cls, label) => `<button type="button" class="${cls}${S.marks[k] ? ' on' : ''}" data-mark="${esc(k)}" aria-pressed="${!!S.marks[k]}" aria-label="${esc(label)}" title="${esc(label)}">${icon('star')}</button>`;
function toggleMark(k) {
  const on = !S.marks[k];
  if (on) S.marks[k] = Date.now(); else delete S.marks[k];
  save();
  $$(`[data-mark="${k}"]`).forEach(b => { b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  if (location.hash !== '#elfecinler') toast(on ? 'Əlfəcinlərə əlavə olundu' : 'Əlfəcinlərdən çıxarıldı');
}
// what a bookmark points at, if it is still in the book and in the chosen group's programme
function markInfo(k) {
  const a = ANCH[k], sid = a ? a.s : secById[k] ? k : null;
  const s = sid && secById[sid], c = s && chById[secCh[sid]];
  if (!s || !vis(s) || !vis(c)) return null;
  return { k, s, c, title: a ? a.t : secName(s), at: secAt[sid] * 1e4 + (a ? a.i + 1 : 0) };
}
function vMarks() {
  topbar('Kitab', 'Əlfəcinlər', 'home');
  const list = Object.keys(S.marks).map(markInfo).filter(Boolean).sort((x, y) => x.at - y.at);
  $('#view').innerHTML = `
    <span class="kicker">${esc(S.group)} qrupu</span>
    <h1 class="h1">Əlfəcinlər</h1>
    <p class="muted">Bölməni yuxarıdakı ulduzla, qanun maddəsini başlığının yanındakı ulduzla qeyd et — hamısı burada, kitabdakı sırası ilə.</p>
    ${list.length ? `<div class="list block">${list.map(x => `<div class="secrow mk">
        <a class="sect" href="#${esc(x.k)}"><span class="kicker">${esc(x.c.kind === 'chapter' ? `Fəsil ${x.c.n}${ANCH[x.k] && x.s.num ? ' · ' + x.s.num : ''}` : x.c.title)}</span>
          <b>${esc(clip(x.title, 120))}</b></a>
        <button type="button" class="ibtn" data-unmark="${esc(x.k)}" aria-label="Əlfəcindən çıxar" title="Əlfəcindən çıxar">${icon('x')}</button></div>`).join('')}</div>`
      : '<p class="card muted empty block">Hələ əlfəcin yoxdur.</p>'}`;
  $$('[data-unmark]').forEach(b => b.addEventListener('click', () => { delete S.marks[b.dataset.unmark]; save(); const y = scrollY; vMarks(); window.scrollTo(0, y); }));
}

/* questions inside the text: a worked example (answer and solution shown) or a check (no solution, Claude helps) */
function inlineQ(box, s, c, q, i) {
  const id = `${s.id}k${i}`;
  const order = q.t === 'open' ? null : q.o.map((_, k) => k); // the author's order: solutions may name letters
  const fig = q.img ? `<figure class="qfig">${q.img}</figure>` : '';
  if (q.k === 'ex') {
    box.className = 'iq ex card';
    box.innerHTML = `<span class="kicker">Nümunə</span><div class="iqq">${q.q}</div>
      ${q.t === 'open' ? `${fig}<p class="iqmsg ok">Cavab: ${esc(q.a[0])}</p>` : qBody(q, order, q.a, true)}
      <div class="iqe"><b>Həlli</b>${q.e}</div>
      ${aiBox('iq', id, 'Claude-dan daha ətraflı')}`;
    return;
  }
  const st = { tried: [], val: '', bad: false, show: false }; // this visit only; a solved check is saved
  const letters = q.fix && q.o.every((x, k) => x === 'ABCDEF'[k]); // options are the figure's labels
  // the question part redraws on every attempt; Claude's box stays, so a hint is not wiped by the next try
  box.innerHTML = `<div class="iq-main"></div>${aiBox('hint', id, 'Claude-dan kömək')}`;
  const main = $('.iq-main', box), cbox = $('.ai-box', box);
  const draw = () => {
    const done = !!S.chk[id], open = done || st.show;
    box.className = 'iq chk card' + (done ? ' solved' : '');
    cbox.dataset.act = open ? 'iq' : 'hint';
    $('[data-ai] span', cbox).textContent = open ? 'Claude ilə həlli' : 'Claude-dan kömək';
    const body = q.t === 'open'
      ? `${fig}<div class="row iqopen">
          <input class="oa${done ? ' right' : st.bad ? ' wrong' : ''}" type="text" autocomplete="off" aria-label="Cavab" placeholder="Cavabı yaz" value="${esc(done ? q.a[0] : st.val)}"${open ? ' disabled' : ''}>
          ${open ? '' : '<button type="button" class="btn primary" data-act="iqcheck">Yoxla</button>'}</div>`
      : `${fig}<div class="opts${letters ? ' letters' : ''}">${order.map((oi, k) => {
          const cls = open && oi === q.a ? ' right' : st.tried.includes(oi) ? ' wrong' : open ? ' dim' : '';
          return `<button type="button" class="opt${cls}" data-oi="${oi}"${open || st.tried.includes(oi) ? ' disabled' : ''}><span class="ol">${'ABCDEF'[k]}</span>${letters ? '' : `<span>${esc(q.o[oi])}</span>`}</button>`;
        }).join('')}</div>`;
    const msg = done ? `<p class="iqmsg ok">${icon('check')} Düzdür</p>`
      : st.show ? `<p class="iqmsg">Düz cavab: <b>${esc(q.t === 'open' ? q.a[0] : ansLabel(q, order, q.a))}</b></p>`
      : st.tried.length || st.bad ? `<p class="iqmsg bad">${icon('x')} Səhvdir — yenidən cəhd et və ya Claude-dan ipucu al.</p>` : '';
    main.innerHTML = `<span class="kicker">Özünü yoxla</span><div class="iqq">${q.q}</div>${body}${msg}
      ${!open && (st.tried.length || st.bad) ? '<div class="row"><button type="button" class="btn sm ghost" data-act="iqshow">Cavabı göstər</button></div>' : ''}`;
    const solve = () => { S.chk[id] = Date.now(); save(); };
    $$('.opt', main).forEach(b => b.addEventListener('click', () => {
      const oi = +b.dataset.oi;
      if (oi === q.a) solve(); else st.tried.push(oi);
      draw();
    }));
    const inp = $('.oa', main), chk = $('[data-act="iqcheck"]', main);
    if (chk) {
      const go = () => {
        st.val = inp.value.trim();
        if (!st.val) { inp.focus(); return; }
        st.bad = !isRight(q, st.val);
        if (!st.bad) solve();
        draw();
      };
      chk.addEventListener('click', go);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    }
    const sh = $('[data-act="iqshow"]', main);
    if (sh) sh.addEventListener('click', () => { st.show = true; draw(); });
  };
  draw();
}

/* in a section: the reading progress line under the top bar, a “Yuxarı” button on long pages, and the place the
   reader has got to (kept for “Davam et”) */
const toTop = document.createElement('button');
toTop.type = 'button'; toTop.className = 'fab'; toTop.hidden = true;
toTop.setAttribute('aria-label', 'Yuxarı'); toTop.title = 'Yuxarı'; toTop.innerHTML = icon('up');
toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
document.body.appendChild(toTop);
let placeTimer = null;
window.addEventListener('scroll', () => {
  const i = $('.readbar i'), max = document.documentElement.scrollHeight - innerHeight;
  if (i) i.style.width = (curSec && max > 0 ? Math.min(100, scrollY * 100 / max) : 0) + '%';
  toTop.hidden = !(curSec && scrollY > innerHeight * 1.5);
  if (curSec) { clearTimeout(placeTimer); placeTimer = setTimeout(keepPlace, 500); }
}, { passive: true });
// S.at = [section, the first block of its text still on screen]
function keepPlace() {
  const art = $('article.prose');
  if (!art || !curSec) return;
  const top = $('#topbar').getBoundingClientRect().bottom + 8, kids = art.children;
  let k = 0;
  while (k < kids.length - 1 && kids[k].getBoundingClientRect().bottom < top) k++;
  if (!k && S.at && S.at[0] === curSec) return; // opened at the top again: keep how far it was read
  if (!S.at || S.at[0] !== curSec || S.at[1] !== k) { S.at = [curSec, k]; save(); }
}

/* =========================================================
   6. Programme map: every DİM topic of the chosen group, and where the book teaches it
   ========================================================= */
// one subject at a time; its tabs stay on screen under the top bar (#proqram-men opens that one)
let progTab = null;
function vProgram(focus) {
  const cur = SUBJ[focus] ? focus : SUBJ[progTab] ? progTab : PROG.subjects[0].id, s = SUBJ[cur];
  progTab = cur;
  topbar('DİM', 'Proqram', 'home', '', `<nav class="ptabs" role="tablist" aria-label="Fənlər">${PROG.subjects.map(x =>
    `<a role="tab" href="#proqram-${x.id}" aria-selected="${x.id === cur}" data-tab="${x.id}">${esc(x.title)}</a>`).join('')}</nav>`);
  const b = EXAM.blocks.find(x => x.subj === cur), [have, total] = coverage(cur);
  $('#view').innerHTML = `
    <span class="kicker">${esc(S.group)} qrupu</span>
    <h1 class="h1">Test imtahanı proqramı</h1>
    <p class="muted">DİM-in proqramında ${esc(S.group)} qrupuna düşən mövzular. Hər mövzunun yanında onu öyrədən fəsil görünür.</p>
    <section class="block" id="pr-${cur}">
      <div class="block-h"><h2>${esc(s.title)}${b ? ` · ${b.n} sual` : ''}</h2></div>
      <div class="card stack">
        <div class="row cov"><span><b>${have}/${total}</b> mövzu kitabda</span>${bar(have, total)}</div>
        ${s.note ? `<p class="muted small">${esc(s.note)}</p>` : ''}
      </div>
      <div class="list ptopics">${s.topics.filter(vis).map(t => topicRow(s, t)).join('')}</div>
    </section>`;
  // switching tabs replaces the page in the history: Back leaves the programme
  $$('#topbar [data-tab]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); location.replace('#proqram-' + a.dataset.tab); }));
  const tabs = $('#topbar .ptabs'), on = $('[aria-selected="true"]', tabs); // scrolled only as far as the chosen tab needs
  if (on) tabs.scrollLeft = Math.max(0, on.offsetLeft + on.offsetWidth - tabs.clientWidth + 12);
}
function topicRow(s, t) {
  const where = (t.see || []).filter(x => vis(chById[x] || secById[x]));
  const secs = [];
  where.forEach(x => { if (chById[x]) visSections(chById[x]).forEach(sec => secs.push(sec.id)); else secs.push(x); });
  const read = secs.filter(id => S.read[id]).length;
  return `<div class="ptopic">
    <div class="pt-head"><span class="chn">${esc(t.num)}</span>
      <span class="sect"><b>${esc(t.title)}</b>${t.src ? `<span class="muted small">${esc(t.src)}</span>` : ''}</span></div>
    <div class="row pt-meta">${onlyFor(t)}
      ${where.length ? where.map(x => `<a class="chip acc" href="#${x}">${esc(chById[x] ? `Fəsil ${chById[x].n}` : secById[x].num || secById[x].title)}</a>`).join('')
        + `<span class="chip${read === secs.length && secs.length ? ' pass' : ''}">${read}/${secs.length} oxunub</span>`
        : '<span class="chip warn">hazırlanır</span>'}</div>
    ${t.items ? `<details><summary>Proqrama daxildir (${t.items.length})</summary><ul>${t.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}
  </div>`;
}

/* =========================================================
   7. Questions (shared by practice tests and the mock exam)
   ========================================================= */
const isRight = (q, v) => q.t === 'open' ? v != null && q.a.some(x => norm(x) === norm(v)) && norm(v) !== '' : v === q.a;
const optOrder = q => q.t === 'open' ? null : (q.fix ? q.o.map((_, i) => i) : shuffle(q.o.map((_, i) => i)));
const answerText = (q, v) => q.t === 'open' ? (v == null || v === '' ? '—' : v) : (v == null ? '—' : q.o[v]);
const rightText = q => q.t === 'open' ? q.a[0] : q.o[q.a];

/* A law question's explanation with its references linked to the book: “Maddə 72.III”, “109-cu maddəsinin”, “Bənd 25”.
   A law's name before a reference picks the act (and holds until another name: “Konstitusiyanın 57-ci və 94-cü
   maddəsi”); otherwise it is the act of the question's section, then the others of its chapter. A bare “32-ci bənd”
   is a point of some maddə and stays text; “Bənd 1.0.10” of a law (not the Təlimat) is a point of maddə 1. */
const REF_NUM = String.raw`\d+(?:¹|-\d+)?(?:\.(?:\d+(?:-\d+)?|[IVX]+))*`, REF_SUF = String.raw`-?(?:cü|ci|cı|cu|ü|i|ı|u)\s+`;
const REF = new RegExp(String.raw`(Konstitusiyan[ıi]n|[Bb]ayraq qanununun|[Gg]erb(?: və himn)? qanun(?:unun|larının)|[Hh]imn qanununun|Fərman (435|614)|Fərmanın|Qanunun|Təlimatın)`
  + String.raw`|([Mm]addə\p{L}*\s+(${REF_NUM})|(${REF_NUM})${REF_SUF}maddə\p{L}*)|([Bb]ənd\p{L}*\s+(${REF_NUM})|(${REF_NUM})${REF_SUF}bənd\p{L}*)`, 'gu');
function lawLinks(q) {
  const e = String(q.e || ''), c = chById[q.ch];
  if (!c || c.subj !== 'qan') return esc(e);
  const own = (SEC_ACTS[q.s] || []).slice();
  c.sections.forEach(s => (SEC_ACTS[s.id] || []).forEach(a => { if (!own.includes(a)) own.push(a); }));
  let cur = null, at = 0, out = '';
  for (const m of e.matchAll(REF)) {
    if (m[1]) { // a law's name: Fərmanın = the decree that approved this chapter's Təlimat
      cur = m[2] ? 'ferman-' + m[2] : m[1] === 'Fərmanın' ? '*'
        : ({ kons: 'konstitusiya', bayr: 'bayraq', gerb: 'gerb', himn: 'himn' })[m[1].slice(0, 4).toLowerCase()] || null;
      continue;
    }
    const num = m[4] || m[5] || m[7] || m[8], dotted = num.includes('.');
    const n = num.split('.')[0].replace('¹', '-1'), acts = cur && cur !== '*' ? [cur] : own;
    const find = k => acts.map(a => `${a}-${k}${n}`).find(x => ANCH[x]);
    const id = m[3] ? find('m') : cur === '*' ? find('f') : find('b') || (dotted ? find('m') : null);
    if (!id) continue;
    out += esc(e.slice(at, m.index)) + `<a class="lawref" href="#${id}">${esc(m[0])}</a>`;
    at = m.index + m[0].length;
  }
  return out + esc(e.slice(at));
}

// reveal: show right / wrong marks (practice after answering, never during the exam)
function qBody(q, order, picked, reveal) {
  const fig = q.img ? `<figure class="qfig">${q.img}</figure>` : '';
  if (q.t === 'open') {
    const ok = reveal && isRight(q, picked);
    return `${fig}<div class="openq">
      <label class="sr" for="oa">Cavab</label>
      <input id="oa" class="oa${reveal ? (ok ? ' right' : ' wrong') : ''}" type="text" inputmode="text" autocomplete="off" placeholder="Cavabı yaz" value="${esc(picked || '')}"${reveal ? ' disabled' : ''}>
      ${reveal ? '' : '<span class="muted small">Açıq sual: cavabı özün yazırsan.</span>'}
    </div>`;
  }
  // options that only name the labels drawn in the figure (A, B, C…) become a row of letter buttons
  const letters = q.fix && order.every((oi, k) => q.o[oi] === 'ABCDEF'[k]);
  return `${fig}<div class="opts${letters ? ' letters' : ''}">${order.map((oi, k) => {
    let cls = '';
    if (reveal) cls = oi === q.a ? ' right' : (oi === picked ? ' wrong' : ' dim');
    else if (oi === picked) cls = ' picked';
    return `<button type="button" class="opt${cls}" data-oi="${oi}" aria-pressed="${oi === picked}"${reveal ? ' disabled' : ''}>
      <span class="ol">${'ABCDEF'[k]}</span>${letters ? '' : `<span>${esc(q.o[oi])}</span>`}</button>`;
  }).join('')}</div>`;
}

/* =========================================================
   8. Practice tests
   ========================================================= */
let quizRun = null; // { key, items: [{ id, order }], i, picks: [] } — in memory only

function vTests() {
  topbar(`Məşq · ${S.group} qrupu`, 'Testlər', null, null, null, { big: true });
  const all = pool();
  const wrong = Object.keys(S.wrong).filter(id => all.includes(id));
  const withQ = visChapters().filter(c => c.kind === 'chapter' && chQuiz(c.id).length);
  const subj = PROG.subjects.map(s => [s, all.filter(id => qById[id].subj === s.id).length]).filter(x => x[1]);
  const hours = EXAM.minutes % 60 ? `${EXAM.minutes} dəq` : `${EXAM.minutes / 60} saat`;
  $('#view').innerHTML = `
    <a class="night cont" href="#imtahan"><span class="sic">${icon('timer')}</span>
      <span><b>${S.exam ? 'İmtahana qayıt' : 'Sınaq imtahanı'}</b><span class="muted">${S.exam ? 'davam edir' : `İmtahan kimi: ${FULL} sual, ${hours}, fənlər üzrə nəticə`}</span></span>
      <span class="go">${S.exam ? 'Davam et' : 'Başla'}</span></a>
    ${S.exam ? '' : `<div class="subjex"><span class="muted small">Yalnız bir fənn, vaxtla:</span>
      <div class="row">${EXAM.blocks.map(b => `<a class="btn sm ${sk(b.subj)}" href="#imtahan-${b.subj}">${esc(SUBJ[b.subj].title)} · ${b.n}</a>`).join('')}</div></div>`}
    <div class="list block">
      <a class="secrow${all.length ? '' : ' off'}" href="#test-mix"><span class="tick acc">${icon('shuffle')}</span>
        <span class="sect"><b>Qarışıq test</b><span class="muted">${all.length ? `Bütün fəsillərdən ${Math.min(MIX_SIZE, all.length)} təsadüfi sual${S.quiz.mix ? ` · son nəticə ${S.quiz.mix.last}%` : ''}` : 'Hələ sual yoxdur'}</span></span>${icon('chev')}</a>
      <a class="secrow s-men${wrong.length ? '' : ' off'}" href="#test-wrong"><span class="tick acc">${icon('redo')}</span>
        <span class="sect"><b>Səhvlərim</b><span class="muted">${wrong.length ? `${wrong.length} sual təkrar gözləyir` : 'Hələ səhv yoxdur'}</span></span>${icon('chev')}</a>
    </div>
    ${subj.length ? `<section class="block"><div class="block-h"><h2>Fənn testləri</h2></div>
      <div class="list">${subj.map(([s, n]) => {
        const r = S.quiz['f-' + s.id];
        return `<a class="secrow ${sk(s.id)}" href="#test-f-${s.id}"><span class="tick acc">${icon(SICON[s.id] || 'checklist')}</span>
          <span class="sect"><b>${esc(s.title)}</b><span class="muted">${Math.min(MIX_SIZE, n)} sual (bankda ${n})${r ? ` · ən yaxşı ${r.best}%` : ''}</span></span>${icon('chev')}</a>`;
      }).join('')}</div></section>` : ''}
    <section class="block"><div class="block-h"><h2>Fəsil testləri</h2></div>
      <div class="list">${withQ.length ? withQ.map(c => {
        const r = S.quiz[c.id];
        return `<a class="secrow ${sk(c.subj)}" href="#test-${c.id}"><span class="chn">${c.n}</span>
          <span class="sect"><b>${esc(c.title)}</b><span class="muted">${chQuiz(c.id).length} sual${r ? ` · ən yaxşı ${r.best}%` : ''}</span></span>${icon('chev')}</a>`;
      }).join('') : '<p class="muted empty">Hələ test yoxdur — fəsillər əlavə olunduqca burada görünəcək.</p>'}</div></section>`;
  $$('.secrow.off').forEach(a => { a.setAttribute('aria-disabled', 'true'); a.tabIndex = -1; a.addEventListener('click', e => e.preventDefault()); });
}

function quizIds(key) {
  const all = pool();
  if (key === 'mix') return shuffle(all).slice(0, MIX_SIZE);
  if (key === 'wrong') return shuffle(Object.keys(S.wrong).filter(id => all.includes(id)));
  if (key.startsWith('f-')) return shuffle(all.filter(id => qById[id].subj === key.slice(2))).slice(0, MIX_SIZE);
  if (key.startsWith('s-')) return shuffle(all.filter(id => qById[id].s === key.slice(2)));
  return chById[key] ? chQuiz(key) : [];
}
function quizName(key) {
  if (key === 'mix') return 'Qarışıq test';
  if (key === 'wrong') return 'Səhvlərim';
  if (key.startsWith('f-') && SUBJ[key.slice(2)]) return SUBJ[key.slice(2)].title;
  if (key.startsWith('s-') && secById[key.slice(2)]) return secName(secById[key.slice(2)]);
  return chById[key] ? `Fəsil ${chById[key].n}. ${chById[key].title}` : 'Test';
}

function vQuiz(key) {
  if (!quizRun || quizRun.key !== key) {
    const ids = quizIds(key);
    if (!ids.length) { location.replace('#testler'); return; }
    quizRun = { key, items: ids.map(id => ({ id, order: optOrder(qById[id]) })), i: 0, picks: [] };
  }
  $('#view').style.paddingBottom = ''; document.documentElement.style.scrollPaddingBottom = '';
  if (quizRun.i >= quizRun.items.length) { topbar('Nəticə', quizName(key), 'testler'); quizResult(); return; }
  setFocus(true);
  const it = quizRun.items[quizRun.i], q = qById[it.id], picked = quizRun.picks[quizRun.i];
  const n = quizRun.items.length, answered = picked !== undefined, done = quizRun.i + (answered ? 1 : 0);
  const ok = answered && isRight(q, picked), sec = q.s && secById[q.s];
  // the way out and the progress up top; the verdict comes up as a sheet with the way on
  topbar('', '', 'testler', `<span class="qcount">${quizRun.i + 1}<span>/${n}</span></span>`, null, { close: true,
    mid: `<div class="qbar" role="progressbar" aria-label="${esc(quizName(key))}" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${done}"><i style="width:${pct(done, n)}%"></i></div>` });
  $('#view').innerHTML = `
    <div class="qhead ${sk(q.subj)}"><span class="chip acc">${esc(subjName(q.subj))}</span><span class="kicker">Sual ${quizRun.i + 1} / ${n}</span>${sec ? `<span class="muted small">· ${esc(sec.num || sec.title)}</span>` : ''}</div>
    <h1 class="qtext">${esc(q.q)}</h1>
    ${qBody(q, it.order, picked, answered)}
    ${!answered && q.t === 'open' ? `<div class="actbar"><button type="button" class="btn primary" data-act="check">Yoxla</button></div>` : ''}
    ${answered ? `<section class="sheet expl ${ok ? 'ok' : 'bad'}" aria-label="Cavab">
      <span class="grab" aria-hidden="true"></span>
      <div class="sheet-h"><span class="res-ic">${icon(ok ? 'check' : 'x')}</span>
        <div class="res"><b>${ok ? 'Düzdür' : 'Səhvdir'}</b>${ok ? '' : `<span>Düz cavab: ${esc(rightText(q))}</span>`}</div></div>
      <div class="sheet-body">
        ${q.e ? `<p>${lawLinks(q)}</p>` : ''}
        ${sec ? `<a class="secref" href="#${q.s}" data-ret>${icon('book')}<span>Bölməni oxu: ${esc(secName(sec))}</span></a>` : ''}
        ${aiBox('q', it.id, 'Claude-dan ətraflı izah', { o: it.order, p: picked })}
      </div>
      <div class="sheet-act"><button type="button" class="btn primary" data-act="next">${quizRun.i + 1 < n ? 'Növbəti sual' : 'Nəticəni gör'} ${icon('arrow')}</button></div>
    </section>` : ''}`;
  if (answered) fitSheet($('#view .sheet'));
  const pick = v => {
    quizRun.picks[quizRun.i] = v;
    if (isRight(q, v)) delete S.wrong[it.id]; else S.wrong[it.id] = Date.now();
    note(it.id, isRight(q, v));
    save();
    vQuiz(key);
    const o = $$('#view .opt.wrong, #view .opt.right').pop() || $('#oa'); // the lower of the two stays above the sheet
    if (o) o.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  $$('.opt[data-oi]').forEach(b => b.addEventListener('click', () => pick(+b.dataset.oi)));
  const chk = $('[data-act="check"]'), inp = $('#oa');
  if (chk) {
    const go = () => { if (!inp.value.trim()) { inp.focus(); return; } pick(inp.value.trim()); };
    chk.addEventListener('click', go);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  }
  const nx = $('[data-act="next"]');
  if (nx) nx.addEventListener('click', () => { quizRun.i++; vQuiz(key); window.scrollTo(0, 0); });
}

/* one question with its answer and explanation (the claude.ai version opens it from the offline app's links) */
function vQuestion(id) {
  const q = qById[id], c = chById[q.ch];
  topbar(c.kind === 'chapter' ? `Fəsil ${c.n}` : '', 'Sual', 'testler');
  const order = q.t === 'open' ? null : q.o.map((_, k) => k);
  $('#view').innerHTML = `
    <span class="kicker">${esc(c.kind === 'chapter' ? `Fəsil ${c.n}. ${c.title}` : c.title)}</span>
    <h1 class="qtext">${esc(q.q)}</h1>
    ${q.t === 'open' ? `${q.img ? `<figure class="qfig">${q.img}</figure>` : ''}<p class="iqmsg ok">Düz cavab: ${esc(q.a[0])}</p>` : qBody(q, order, q.a, true)}
    <div class="card expl ok"><b>Düz cavab: ${esc(rightText(q))}</b>
      ${q.e ? `<p>${lawLinks(q)}</p>` : ''}
      ${q.s && secById[q.s] ? `<a href="#${q.s}" data-ret>Bölməni oxu: ${esc(secById[q.s].num)}. ${esc(secById[q.s].title)}</a>` : ''}
      ${aiBox('q', id, 'Claude-dan ətraflı izah')}
    </div>`;
}

function missedList(items, picks) {
  const missed = items.map((it, i) => ({ q: qById[it.id], p: picks[i], order: it.order })).filter(x => x.q && !isRight(x.q, x.p));
  return missed.length ? `<div class="stack">${missed.map(x => `<div class="card miss">
      <b>${esc(x.q.q)}</b>
      ${x.q.img ? `<figure class="qfig sm">${x.q.img}</figure>` : ''}
      <p class="no">${icon('x')} ${esc(answerText(x.q, x.p))}</p>
      <p class="yes">${icon('check')} ${esc(rightText(x.q))}</p>
      ${x.q.e ? `<p class="muted">${lawLinks(x.q)}</p>` : ''}
      ${aiBox('q', x.q.id, 'Claude ilə izah', { o: x.order, p: x.p })}
    </div>`).join('')}</div>` : '<p class="card expl ok"><b>Bütün cavablar düzdür.</b></p>';
}

function quizResult() {
  const { key, items, picks } = quizRun;
  const right = items.filter((it, i) => isRight(qById[it.id], picks[i])).length;
  const score = pct(right, items.length);
  const prev = S.quiz[key];
  S.quiz[key] = { best: Math.max(score, prev ? prev.best : 0), last: score, at: Date.now() };
  save();
  setFocus(false);
  $('#view').innerHTML = `
    <div class="card score">
      ${ring(score, 136, 13, score + '%', `${score} faiz`)}
      <h1 class="h1">${right} / ${items.length} düz cavab</h1>
      <span class="muted small">${esc(quizName(key))}${prev ? ` · ən yaxşı ${Math.max(score, prev.best)}%` : ''}</span>
      <div class="row">
        <button type="button" class="btn primary" data-act="again">${icon('refresh')} Yenidən</button>
        <a class="btn" href="#testler">Testlərə qayıt</a>
      </div>
    </div>
    <section class="block"><div class="block-h"><h2>Səhv cavablar</h2></div>${missedList(items, picks)}</section>`;
  $('[data-act="again"]').addEventListener('click', () => { quizRun = null; vQuiz(key); });
}

/* =========================================================
   9. Mock exam: the real exam's subjects and counts, a timer, no hints until the end
   ========================================================= */
const FULL = EXAM.blocks.reduce((a, b) => a + b.n, 0);
function examPlan(group, subj) {
  const all = ALL_Q.filter(id => qById[id].g.includes(group) && (chById[qById[id].ch].g || GROUPS).includes(group));
  return EXAM.blocks.filter(b => !subj || b.subj === subj).map(b => {
    const open = (b.open && b.open[group]) || 0;
    const mine = all.filter(id => qById[id].subj === b.subj);
    const mc = mine.filter(id => qById[id].t === 'mc'), op = mine.filter(id => qById[id].t === 'open');
    return { b, open, mc, op, take: Math.min(mc.length, b.n - open) + Math.min(op.length, open) };
  });
}
const examSecs = n => Math.max(300, Math.round(EXAM.minutes * 60 * n / FULL));
const examMax = items => items.reduce((a, it) => a + (qById[it.id] && qById[it.id].t === 'open' ? EXAM.points.open : EXAM.points.closed), 0);

// subj: one subject's part of the exam (its question count, its share of the time); none = the whole exam
function vExam(subj) {
  if (S.exam) { examRun(); return; }
  const one = SUBJ[subj] ? subj : null;
  const plan = examPlan(S.group, one), take = plan.reduce((a, p) => a + p.take, 0);
  const n = plan.reduce((a, p) => a + p.b.n, 0), open = plan.reduce((a, p) => a + p.open, 0);
  const maxPts = n - open + open * EXAM.points.open;
  const title = one ? `${SUBJ[one].title} sınağı` : 'Sınaq imtahanı', what = one ? 'sınaq' : 'imtahan';
  topbar('Testlər', title, one ? 'imtahan' : 'testler');
  const hist = S.exams.filter(r => r.group === S.group && (r.subj || null) === one).slice(0, 8);
  $('#view').innerHTML = `
    <span class="kicker">${esc(S.group)} qrupu</span>
    <h1 class="h1">${esc(title)}</h1>
    <p class="muted">${one ? `Real imtahanın “${esc(SUBJ[one].title)}” hissəsi kimi: sualların sayı imtahandakı qədərdir, vaxt bu fənnin payına düşən qədər.`
      : 'Sualların sayı və fənləri real imtahandakı kimidir.'} Cavablar ${what} bitəndən sonra göstərilir.</p>
    <div class="tbl"><table>
      <thead><tr><th>Fənn</th><th>Sual</th>${open ? '<th>O cümlədən açıq</th>' : ''}<th>Bankda</th></tr></thead>
      <tbody>${plan.map(p => `<tr><td>${esc(SUBJ[p.b.subj].title)}</td><td>${p.b.n}</td>${open ? `<td>${p.open}</td>` : ''}<td>${p.mc.length + (p.open ? p.op.length : 0)}</td></tr>`).join('')}</tbody>
    </table></div>
    <div class="card stack">
      <p>${icon('clock')} Vaxt: <b>${clock(examSecs(n))}</b> (${n} sual üçün) · Qapalı sual ${EXAM.points.closed} bal${open ? `, açıq sual ${EXAM.points.open} bal` : ''} · Ən yüksək bal: <b>${maxPts}</b></p>
      ${take < n ? `<p class="warnline">Bankda hələ ${take} uyğun sual var — ${what} ${take} sualla olacaq, vaxt da mütənasib: ${clock(examSecs(take))}.</p>` : ''}
      <p class="muted small">${one ? `Vaxt ${EXAM.minutes} dəqiqənin bu fənnin sual payına (${n}/${FULL}) düşən hissəsidir. ` : ''}${esc(EXAM.minutes_note)}${open ? ' ' + esc(EXAM.open_note) : ''}</p>
      <button type="button" class="btn primary" data-act="start"${take ? '' : ' disabled'}>${take ? (one ? 'Sınağı başla' : 'İmtahanı başla') : 'Hələ sual yoxdur'}</button>
    </div>
    ${one ? '' : `<section class="block"><div class="block-h"><h2>Fənn üzrə sınaq</h2></div>
      <div class="list">${EXAM.blocks.map(b => {
        const last = S.exams.find(r => r.group === S.group && r.subj === b.subj);
        return `<a class="secrow" href="#imtahan-${b.subj}"><span class="tick acc">${icon('timer')}</span>
          <span class="sect"><b>${esc(SUBJ[b.subj].title)}</b><span class="muted">${b.n} sual · ${clock(examSecs(b.n))}${last ? ` · son nəticə ${last.pct}%` : ''}</span></span>${icon('chev')}</a>`;
      }).join('')}</div>
      <p class="muted small">Yalnız bir fənn: imtahandakı qədər sual, vaxt imtahandakı payına görə.</p></section>
    <section class="block"><div class="block-h"><h2>Keçid balları (${esc(S.group)})</h2></div>${passTable(null)}
      <p class="muted small">${esc(EXAM.pass_note)}</p></section>`}
    ${hist.length ? `<section class="block"><div class="block-h"><h2>Əvvəlki nəticələr</h2></div>
      <div class="list hist">${hist.map(r => `<div class="secrow"><span class="chn">${r.pct}%</span>
        <span class="sect"><b>${r.pts} / ${r.max} bal</b><span class="muted">${day(r.at)} · ${r.n} sual${r.timeUp ? ' · vaxt bitdi' : ''}</span></span></div>`).join('')}</div></section>` : ''}`;
  const st = $('[data-act="start"]');
  if (st) st.addEventListener('click', () => {
    const items = [];
    plan.forEach(p => {
      shuffle(p.mc).slice(0, p.b.n - p.open).forEach(id => items.push({ id, order: optOrder(qById[id]) }));
      shuffle(p.op).slice(0, p.open).forEach(id => items.push({ id, order: null }));
    });
    S.exam = { group: S.group, subj: one, start: Date.now(), secs: examSecs(items.length), items, ans: {}, i: 0 };
    save();
    examRun();
  });
}

function passTable(score) {
  const rows = EXAM.pass.filter(r => r.sub.startsWith(S.group));
  return `<div class="tbl"><table><thead><tr><th>Alt qrup</th><th>Keçid</th>${score != null ? '<th>Sən</th>' : ''}<th>Vəzifələr</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td><b>${r.sub}</b></td><td>${r.pct}%</td>${score != null ? `<td>${score >= r.pct ? `<span class="chip pass">${icon('check')} keçir</span>` : '<span class="chip fail">keçmir</span>'}</td>` : ''}<td class="small">${esc(r.who)}</td></tr>`).join('')}</tbody></table></div>`;
}

function examLeft() { return S.exam.secs - (Date.now() - S.exam.start) / 1000; }

function examRun() {
  const E = S.exam;
  if (E.items.some(it => !qById[it.id])) { // the book was updated mid-exam: drop questions that no longer exist
    const items = [], ans = {};
    E.items.forEach((it, k) => { if (qById[it.id]) { if (E.ans[k] !== undefined) ans[items.length] = E.ans[k]; items.push(it); } });
    E.items = items; E.ans = ans; E.i = 0;
    if (!items.length) S.exam = null;
    save();
    if (!S.exam) { vExam(); return; }
  }
  if (examLeft() <= 0) { examFinish(true); return; }
  const n = E.items.length;
  if (E.i >= n) E.i = n - 1;
  const it = E.items[E.i], q = qById[it.id];
  const picked = E.ans[E.i];
  const done = Object.keys(E.ans).filter(k => E.ans[k] !== '' && E.ans[k] != null).length;
  const what = SUBJ[E.subj] ? 'Sınağı' : 'İmtahanı';
  setFocus(true);
  topbar(`${SUBJ[E.subj] ? SUBJ[E.subj].title + ' sınağı' : 'Sınaq imtahanı'} · ${E.group}`, SUBJ[q.subj] ? SUBJ[q.subj].title : 'Sual', 'testler', `<span class="timer mono" aria-live="off">${clock(examLeft())}</span>`, null, { close: true });
  $('#view').innerHTML = `
    <div class="row qhead ${sk(q.subj)}"><span class="kicker">Sual ${E.i + 1} / ${n}${q.t === 'open' ? ' · açıq' : ''}</span>${bar(done, n)}</div>
    <h1 class="qtext">${esc(q.q)}</h1>
    ${qBody(q, it.order, picked, false)}
    <nav class="actbar" aria-label="Suallar">
      <button type="button" class="btn" data-act="prev"${E.i ? '' : ' disabled'}>${icon('back')} Əvvəlki</button>
      <button type="button" class="btn primary" data-act="next"${E.i + 1 < n ? '' : ' disabled'}>Növbəti ${icon('chev')}</button>
    </nav>
    <details class="qgrid card"><summary>Bütün suallar · ${done}/${n} cavablanıb</summary>
      <div class="grid">${E.items.map((x, k) => {
        const a = E.ans[k], has = a !== undefined && a !== '' && a !== null;
        return `<button type="button" class="gq${has ? ' has' : ''}${k === E.i ? ' cur' : ''}" data-go="${k}">${k + 1}</button>`;
      }).join('')}</div></details>
    <button type="button" class="btn ghost danger wide" data-act="finish">${icon('flag')} ${what} bitir</button>`;
  const go = k => { E.i = k; save(); examRun(); window.scrollTo(0, 0); };
  $$('.opt[data-oi]').forEach(b => b.addEventListener('click', () => {
    const oi = +b.dataset.oi;
    if (E.ans[E.i] === oi) delete E.ans[E.i]; else E.ans[E.i] = oi; // tap again to clear
    save(); examRun();
  }));
  const inp = $('#oa');
  if (inp) inp.addEventListener('input', () => { if (inp.value.trim()) E.ans[E.i] = inp.value.trim(); else delete E.ans[E.i]; save(); });
  $('[data-act="prev"]').addEventListener('click', () => go(E.i - 1));
  $('[data-act="next"]').addEventListener('click', () => go(E.i + 1));
  $$('.gq').forEach(b => b.addEventListener('click', () => go(+b.dataset.go)));
  $('[data-act="finish"]').addEventListener('click', e => {
    const left = n - Object.keys(E.ans).length;
    const ask = SUBJ[E.subj] ? 'Sınaq bitsin?' : 'İmtahan bitsin?';
    askHere(e.currentTarget, left ? `${left} sual cavabsızdır. ${ask}` : ask, 'Bəli, bitir', () => examFinish(false));
  });
  clearInterval(examTimer);
  examTimer = setInterval(() => {
    if (!S.exam) { clearInterval(examTimer); return; }
    const left = examLeft(), t = $('.timer');
    if (t) { t.textContent = clock(left); t.classList.toggle('low', left < 300); }
    if (left <= 0) { clearInterval(examTimer); examFinish(true); }
  }, 1000);
}

function examFinish(timeUp) {
  const E = S.exam;
  clearInterval(examTimer);
  const items = E.items.filter(it => qById[it.id]);
  const picks = items.map(it => E.ans[E.items.indexOf(it)]);
  let pts = 0;
  const bySubj = {};
  items.forEach((it, i) => {
    const q = qById[it.id], w = q.t === 'open' ? EXAM.points.open : EXAM.points.closed, v = picks[i];
    const r = bySubj[q.subj] || (bySubj[q.subj] = { right: 0, n: 0, pts: 0, max: 0 });
    r.n++; r.max += w;
    if (isRight(q, v)) { pts += w; r.right++; r.pts += w; delete S.wrong[it.id]; }
    else if (v !== undefined && v !== '') S.wrong[it.id] = Date.now();
    if (v !== undefined && v !== '') note(it.id, isRight(q, v));
  });
  const max = examMax(items), res = { at: Date.now(), group: E.group, n: items.length, pts, max, pct: pct(pts, max), bySubj, timeUp };
  if (SUBJ[E.subj]) res.subj = E.subj; // one subject's part only; the whole exam has none
  S.examLast = Object.assign({ items, picks, used: Math.min(E.secs, Math.round((Date.now() - E.start) / 1000)) }, res);
  S.exams.unshift(res);
  S.exams = S.exams.slice(0, 40);
  S.exam = null;
  save();
  if (location.hash === '#imtahan-netice') vExamResult(); else location.hash = '#imtahan-netice';
}

function vExamResult() {
  const R = S.examLast, one = R && SUBJ[R.subj] ? R.subj : null;
  topbar(one ? `${SUBJ[one].title} sınağı` : 'Sınaq imtahanı', 'Nəticə', 'testler');
  if (!R) { location.replace('#imtahan'); return; }
  setFocus(false);
  const g = S.group;
  S.group = R.group; // the pass table belongs to the group the exam was taken in
  const table = passTable(R.pct), lines = one ? [] : EXAM.pass.filter(r => r.sub.startsWith(R.group));
  S.group = g;
  const met = lines.filter(r => R.pct >= r.pct).map(r => r.sub).sort();
  const and = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' və ' + a[a.length - 1] : a[0];
  $('#view').innerHTML = `
    <div class="card score">
      <h1 class="h1 sr">${R.pts} / ${R.max} bal · ${R.pct}%</h1>
      ${gauge(R.pct, R.pts, R.max, lines.map(r => r.pct))}
      ${one ? '' : met.length ? `<span class="verdict ok">${icon('check')} ${esc(and(met))} üçün keçid balını topladın</span>`
        : `<span class="verdict no">Keçid balına hələ çatmır — ən aşağı hədd ${Math.min(...lines.map(r => r.pct))}%</span>`}
      <span class="muted small">${esc(R.group)} qrupu · ${one ? esc(SUBJ[one].title) + ' sınağı · ' : ''}${R.n} sual · vaxt ${clock(R.used)}${R.timeUp ? ' · vaxt bitdi' : ''}</span>
    </div>
    <div class="subjgrid">${EXAM.blocks.filter(b => R.bySubj[b.subj]).map(b => { const r = R.bySubj[b.subj], p = pct(r.right, r.n);
      return `<div class="sbox ${sk(b.subj)}">${ring(p, 56, 6, p + '%', `${SUBJ[b.subj].title}: ${p} faiz`)}
        <span><b>${esc(SUBJ[b.subj].title)}</b><span class="muted">${r.right} / ${r.n} düz · ${r.pts}/${r.max} bal</span></span></div>`; }).join('')}</div>
    <div class="row block">
      <a class="btn primary" href="#imtahan${one ? '-' + one : ''}">${icon('refresh')} ${one ? 'Yeni sınaq' : 'Yeni imtahan'}</a>
      <a class="btn" href="#testler">Testlərə qayıt</a>
    </div>
    ${one ? '<p class="muted small">Keçid balları bütün imtahan üçündür, ona görə fənn sınağında göstərilmir.</p>'
      : `<section class="block"><div class="block-h"><h2>Keçid balları</h2></div>${table}</section>`}
    <section class="block"><div class="block-h"><h2>Səhv və cavabsız suallar</h2></div>${missedList(R.items, R.picks)}</section>`;
}
// the exam's score on a half ring; the group's pass thresholds are ticks on it (none for one subject's exam)
function gauge(p, pts, max, ticks) {
  const cx = 140, cy = 134, r = 104, v = Math.max(0, Math.min(100, p)) * Math.PI * r / 100;
  const at = (q, rr) => [cx - rr * Math.cos(Math.PI * q / 100), cy - rr * Math.sin(Math.PI * q / 100)];
  const arc = `M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  return `<svg class="gauge" width="280" height="150" viewBox="0 0 280 150" role="img" aria-label="${p} faiz${ticks.length ? ', keçid həddləri ' + ticks.join(', ') + ' faiz' : ''}">
    <path class="tr" d="${arc}" fill="none" stroke-width="18" stroke-linecap="round"/>
    ${v > 0.5 ? `<path class="val" d="${arc}" fill="none" stroke-width="18" stroke-linecap="round" stroke-dasharray="${v.toFixed(2)} 999"/>` : ''}
    ${ticks.map(t => { const [x1, y1] = at(t, 95), [x2, y2] = at(t, 113), [lx, ly] = at(t, 127);
      return `<path class="${t <= p ? 'tk-in' : 'tk-out'}" d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke-width="2.5" stroke-linecap="round"/>
        <text class="lb${t <= p ? ' ok' : ''}" x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="${t > 50 ? 'start' : t < 50 ? 'end' : 'middle'}">${t}</text>`; }).join('')}
    <text class="big" x="${cx}" y="112" text-anchor="middle" font-size="46">${p}%</text>
    <text class="sub" x="${cx}" y="${cy}" text-anchor="middle" font-size="13">${pts} / ${max} bal</text></svg>`;
}

/* =========================================================
   9b. Statistics: accuracy by subject and topic, weakest topics, the mock exam trend
   ========================================================= */
// every answered test question (practice and exams): S.ans[id] = [right, tries, last answer right 1/0]
function note(id, ok) { const a = S.ans[id] || [0, 0, 0]; S.ans[id] = [a[0] + (ok ? 1 : 0), a[1] + 1, ok ? 1 : 0]; }
const LEVELS = [[80, 'pass', 'yaxşı'], [60, 'warn', 'orta'], [0, 'fail', 'zəif']];
const level = p => LEVELS.find(l => p >= l[0]);
const subjName = id => SUBJ[id] ? SUBJ[id].title : 'Müsahibə'; // chapters without a subject are the interview part
function tally(ids) {
  const t = { r: 0, n: 0, tried: 0, bank: ids.length };
  ids.forEach(id => { const a = S.ans[id]; if (a) { t.r += a[0]; t.n += a[1]; t.tried++; } });
  return t;
}
// a topic is a section of the book; it needs two answers before it can count as weak
function weakTopics(limit) {
  const by = {};
  pool().forEach(id => {
    const q = qById[id], a = S.ans[id];
    if (!a || !secById[q.s]) return;
    const t = by[q.s] || (by[q.s] = { r: 0, n: 0 });
    t.r += a[0]; t.n += a[1];
  });
  return Object.keys(by).map(sid => ({ s: secById[sid], r: by[sid].r, n: by[sid].n, p: pct(by[sid].r, by[sid].n) }))
    .filter(x => x.n >= 2 && x.p < 80 && vis(x.s) && vis(chById[secCh[x.s.id]]))
    .sort((a, b) => a.p - b.p || b.n - a.n).slice(0, limit);
}
const secName = s => `${s.num ? s.num + '. ' : ''}${s.title}`;
const MON = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avq', 'sen', 'okt', 'noy', 'dek']; // browsers often lack az month names
const day = t => { const d = new Date(t); return `${d.getDate()} ${MON[d.getMonth()]}`; };

function vStats() {
  topbar(`${S.group} qrupu`, 'Statistika', null, null, null, { big: true });
  const all = pool(), T = tally(all), secs = learnable();
  const full = S.exams.filter(r => r.group === S.group && !r.subj);
  const best = full.reduce((m, r) => Math.max(m, r.pct), -1);
  const chk = Object.keys(S.chk).filter(id => { const t = inlineAt(id); return t && vis(t.s); }).length;
  const subjects = [...PROG.subjects.map(s => s.id), ''].map(id => {
    const mine = secs.filter(sid => (chById[secCh[sid]].subj || '') === id);
    return { id, t: tally(all.filter(q => (qById[q].subj || '') === id)), read: mine.filter(sid => S.read[sid]).length, secs: mine.length };
  }).filter(x => x.t.bank || x.secs);
  const weak = weakTopics(8);
  const cols = EXAM.blocks.filter(b => full.some(r => r.bySubj[b.subj]));
  const subjEx = EXAM.blocks.map(b => ({ b, list: S.exams.filter(r => r.group === S.group && r.subj === b.subj) })).filter(x => x.list.length);
  $('#view').innerHTML = `
    ${T.n ? '' : '<p class="card note">Hələ test cavabı yoxdur. <a href="#testler">Testlər</a> bölməsində fəsil testi və ya qarışıq test həll et — düzgünlük və zəif mövzular burada toplanacaq.</p>'}
    <div class="card stat">
      <div><b>${T.n ? pct(T.r, T.n) + '%' : '—'}</b><span>düz cavab</span></div>
      <div><b>${T.tried}</b><span>/ ${T.bank} sual həll edilib</span></div>
      <div><b>${best >= 0 ? best + '%' : '—'}</b><span>ən yaxşı sınaq</span></div>
      <div><b>${chk}</b><span>yoxlama sualı həll olunub</span></div>
    </div>
    <section class="block"><div class="block-h"><h2>Fənlər üzrə</h2></div>
      <div class="list">${subjects.map(x => {
        const p = x.t.n ? pct(x.t.r, x.t.n) : null, L = p == null ? null : level(p);
        return `<div class="srow ${sk(x.id)}" data-subj="${x.id || 'other'}">
          <div class="srow-h"><b>${esc(subjName(x.id))}</b>${L ? `<span class="chip ${L[1]}">${p}% · ${L[2]}</span>` : '<span class="chip">cavab yoxdur</span>'}</div>
          ${bar(x.t.r, x.t.n)}
          <span class="muted small">${x.t.tried}/${x.t.bank} sual həll edilib · ${x.t.r}/${x.t.n} cavab düz · oxunub ${x.read}/${x.secs} bölmə</span>
        </div>`;
      }).join('')}</div>
      <p class="muted small">Düzgünlük: məşq testləri və sınaq imtahanlarındakı bütün cavablar. 80%-dən yuxarı — yaxşı, 60–79% — orta.</p></section>
    <section class="block"><div class="block-h"><h2>Zəif mövzular</h2></div>
      ${weak.length ? `<div class="list">${weak.map(x => `<div class="secrow wk" data-sec="${x.s.id}"><span class="chn">${x.p}%</span>
        <span class="sect"><a href="#${x.s.id}"><b>${esc(secName(x.s))}</b></a><span class="muted">${esc(subjName(chById[secCh[x.s.id]].subj))} · ${x.r}/${x.n} cavab düz</span></span>
        <a class="btn sm" href="#test-s-${x.s.id}">Məşq et</a></div>`).join('')}</div>`
        : `<p class="card muted empty">${T.n ? 'Zəif mövzu yoxdur: ən azı 2 cavab verilmiş bütün mövzularda düzgünlük 80% və yuxarıdır.' : 'Test həll etdikcə düzgünlüyü 80%-dən aşağı olan mövzular burada görünəcək.'}</p>`}
      <p class="muted small">Mövzu kitabın bölməsidir; sayılması üçün ən azı 2 cavab lazımdır. “Məşq et” yalnız o bölmənin suallarını verir.</p></section>
    <section class="block"><div class="block-h"><h2>Sınaq imtahanı dinamikası</h2></div>
      ${full.length ? `${full.length > 1 ? '<div class="card trend" id="trend"></div>' : ''}
      <div class="tbl nums${full.length > 1 ? ' block' : ''}"><table><thead><tr><th>Tarix</th><th>Ümumi</th>${cols.map(b => `<th>${esc(SUBJ[b.subj].title)}</th>`).join('')}</tr></thead>
        <tbody>${full.slice(0, 10).map(r => `<tr><td>${day(r.at)}</td><td><b>${r.pct}%</b></td>${cols.map(b => { const x = r.bySubj[b.subj];
          return `<td>${x ? `${pct(x.right, x.n)}% <span class="muted small">${x.right}/${x.n}</span>` : '—'}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`
        : '<p class="card muted empty">Hələ sınaq imtahanı verməmisən — <a href="#imtahan">sınaq imtahanı</a> bitəndən sonra nəticələr burada qrafikdə görünəcək.</p>'}</section>
    ${subjEx.length ? `<section class="block"><div class="block-h"><h2>Fənn sınaqları</h2></div>
      <div class="list">${subjEx.map(x => `<a class="secrow sx" href="#imtahan-${x.b.subj}"><span class="chn">${x.list[0].pct}%</span>
        <span class="sect"><b>${esc(SUBJ[x.b.subj].title)}</b><span class="muted">son: ${day(x.list[0].at)} · ən yaxşı ${Math.max(...x.list.map(r => r.pct))}% · ${x.list.length} dəfə</span></span>${icon('chev')}</a>`).join('')}</div></section>` : ''}`;
  trendRows = full.length > 1 ? full.slice(0, 12).reverse() : null;
  if (trendRows) drawTrend($('#trend'), trendRows);
}
let trendRows = null;

// mock exam results over time: one line on a fixed 0–100% scale, the group's pass thresholds as a band
function drawTrend(el, rows) {
  const passes = EXAM.pass.filter(r => r.sub.startsWith(S.group)).map(r => r.pct);
  const lo = Math.min(...passes), hi = Math.max(...passes);
  el.dataset.w = el.clientWidth;
  const W = Math.max(240, el.clientWidth - 32), H = 190, L = 40, R = 14, T = 14, B = 26;
  const X = i => L + (rows.length > 1 ? i * (W - L - R) / (rows.length - 1) : (W - L - R) / 2), Y = p => T + (100 - p) * (H - T - B) / 100;
  const every = Math.ceil(rows.length / 8);
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Sınaq imtahanı nəticələri, faizlə: ${rows.map(r => r.pct + '%').join(', ')}">
    <rect class="band" x="${L}" y="${Y(hi)}" width="${W - L - R}" height="${Y(lo) - Y(hi)}"/>
    ${[0, 50, 100].map(v => `<line class="grid" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${L - 8}" y="${Y(v) + 4}" text-anchor="end">${v}%</text>`).join('')}
    <text class="ax" x="${L + 6}" y="${Y(hi) + 12}">keçid ${lo}–${hi}%</text>
    ${rows.map((r, i) => i % every && i !== rows.length - 1 ? '' : `<text class="ax" x="${X(i)}" y="${H - 6}" text-anchor="middle">${i + 1}</text>`).join('')}
    <line class="guide" x1="0" x2="0" y1="${T}" y2="${H - B}" visibility="hidden"/>
    <polyline class="ln" points="${rows.map((r, i) => `${X(i)},${Y(r.pct)}`).join(' ')}"/>
    ${rows.map((r, i) => `<circle class="pt" cx="${X(i)}" cy="${Y(r.pct)}" r="4.5" tabindex="0" data-i="${i}" aria-label="İmtahan ${i + 1}, ${day(r.at)}: ${r.pct}%"/>`).join('')}
    <text class="val" x="${X(rows.length - 1)}" y="${Y(rows[rows.length - 1].pct) - 11}" text-anchor="${rows.length > 1 ? 'end' : 'middle'}">${rows[rows.length - 1].pct}%</text>
  </svg><div class="tip" hidden></div>`;
  const svg = $('svg', el), tip = $('.tip', el), guide = $('.guide', el);
  const show = i => {
    const r = rows[i];
    guide.setAttribute('x1', X(i)); guide.setAttribute('x2', X(i)); guide.setAttribute('visibility', 'visible');
    tip.innerHTML = `<b>${r.pct}%</b> · ${r.pts}/${r.max} bal<br><span>İmtahan ${i + 1} · ${day(r.at)}${r.timeUp ? ' · vaxt bitdi' : ''}</span>`;
    tip.hidden = false;
    const k = svg.getBoundingClientRect().width / W;
    tip.style.left = Math.min(Math.max(X(i) * k + 16, 70), el.clientWidth - 70) + 'px';
    tip.style.top = (Y(r.pct) * k + 12 + 14) + 'px';
  };
  const hide = () => { tip.hidden = true; guide.setAttribute('visibility', 'hidden'); };
  svg.addEventListener('pointermove', e => {
    const k = svg.getBoundingClientRect().width / W, x = (e.clientX - svg.getBoundingClientRect().left) / k;
    show(rows.length > 1 ? Math.max(0, Math.min(rows.length - 1, Math.round((x - L) / ((W - L - R) / (rows.length - 1))))) : 0);
  });
  svg.addEventListener('pointerleave', hide);
  $$('.pt', el).forEach(c => { c.addEventListener('focus', () => show(+c.dataset.i)); c.addEventListener('blur', hide); });
}
window.addEventListener('resize', () => { const el = $('#trend'); if (el && trendRows && el.dataset.w !== String(el.clientWidth)) drawTrend(el, trendRows); });

/* =========================================================
   10. Virtual teacher: one plain chat about anything; ready-made advice on an empty chat carries the reader's progress
   ========================================================= */
const ADVICE = [
  ['Hazırlıq planı', 'İmtahana qədər mənə həftəlik hazırlıq planı qur. Əvvəlcə neçə həftəm qaldığını və gündə nə qədər vaxt ayıra bildiyimi soruş.'],
  ['Zəif yerlərim', 'Nəticələrimə görə hansı fənlərə və mövzulara daha çox vaxt ayırmalıyam? Konkret addımlar təklif et.'],
  ['Vaxt bölgüsü', 'İmtahanda vaxtı fənlər və suallar arasında necə bölüm? Çətin suala ilişəndə nə edim?'],
  ['Məntiq vərdişləri', 'Məntiq suallarını sürətli və düzgün həll etmək üçün hansı üsullar və gündəlik məşqlər lazımdır?'],
  ['Müsahibə', 'Testdən sonrakı müsahibəyə necə hazırlaşım? Hansı sual növləri olur və cavabı necə qurum?'],
  ['Motivasiya', 'Hazırlıq dövründə diqqəti və motivasiyanı necə saxlayım? Sadə gündəlik rejim təklif et.']
];
let tDraft = '';

function myStatus() {
  const all = learnable(), done = all.filter(id => S.read[id]).length;
  const wrong = {};
  Object.keys(S.wrong).forEach(id => { const q = qById[id]; if (q && vis(q)) wrong[q.subj] = (wrong[q.subj] || 0) + 1; });
  const w = PROG.subjects.filter(s => wrong[s.id]).map(s => `${s.title} ${wrong[s.id]}`);
  const ex = S.exams.find(r => r.group === S.group && !r.subj), wk = weakTopics(4);
  return [`Mənim vəziyyətim: kitabda ${done}/${all.length} bölmə oxumuşam.`,
    w.length ? `Təkrar gözləyən səhv suallarım: ${w.join(', ')}.` : 'Hələ səhv sual qeydə alınmayıb.',
    wk.length ? `Zəif mövzularım: ${wk.map(x => `${secName(x.s)} (${x.p}%)`).join(', ')}.` : '',
    ex ? `Son sınaq imtahanı: ${ex.pct}% (${EXAM.blocks.filter(b => ex.bySubj[b.subj]).map(b => `${SUBJ[b.subj].title} ${ex.bySubj[b.subj].right}/${ex.bySubj[b.subj].n}`).join(', ')}).` : 'Sınaq imtahanı hələ verməmişəm.'
  ].filter(Boolean).join(' ');
}
function examFacts() {
  const open = EXAM.blocks.reduce((a, b) => a + ((b.open && b.open[S.group]) || 0), 0);
  const pass = EXAM.pass.filter(r => r.sub.startsWith(S.group)).map(r => `${r.sub} ${r.pct}%`).join(', ');
  return `İmtahan (${S.group} qrupu): ${FULL} test sualı — ${EXAM.blocks.map(b => `${SUBJ[b.subj].title} ${b.n}`).join(', ')}${open ? `; onlardan ${open}-i açıq sualdır` : '; hamısı qapalıdır'}. Qapalı sual ${EXAM.points.closed}, açıq sual ${EXAM.points.open} bal. Keçid həddi alt qruplar üzrə: ${pass}. Testdən sonra müsahibə keçirilir.`;
}
const pAdvice = ask => `Sən Azərbaycanda dövlət qulluğuna qəbul imtahanına hazırlaşanlara məsləhət verən təcrübəli mentorsan. Azərbaycan dilində, konkret və praktik cavab ver. Rəsmi qaydanı bilmirsənsə uydurma — DİM-in saytında (dim.gov.az) yoxlamağı məsləhət gör.\n\n${ask}\n\n${myStatus()}\n${examFacts()}`;
// the first typed question carries the teacher's instructions; the reader may ask about anything
const pFree = text => `${tutor()} Söhbət istənilən mövzuda ola bilər: imtahan fənləri (qanunvericilik, məntiq, Azərbaycan dili, informatika), müsahibə, hazırlıq və ya başqa sual. Qanunlar və rəsmi qaydalar barədə əmin olmadığın faktı uydurma — e-qanun.az və ya dim.gov.az saytında yoxlamağı məsləhət gör.\n\n${text}`;
const pTopic = (s, t) => `${tutor(s.id)}\n\nBu mövzunu imtahan səviyyəsində izah et: əsas qaydalar, tipik sual növləri, 2–3 həll olunmuş nümunə və sonda özümü yoxlamaq üçün 3 sual (cavabları ən sonda).\n\nDİM proqramı, ${s.title}, mövzu ${t.num}: ${t.title}${t.src ? ` (${t.src})` : ''}.${t.items ? ` Proqrama daxildir: ${clip(t.items.join('; '), 600)}.` : ''}`;

// the conversation lives while the app is open: {role, content, label?}; label is what the bubble shows
const CHAT = { turns: [], busy: false };
const CHAT_KEEP = 14; // turns sent to Claude: the first (it carries the instructions) and the latest ones
function aiMode() {
  if (!PWA) return AI.fn ? 'Claude sənin claude.ai hesabınla işləyir.' : 'Claude bu görünüşdə əlçatan deyil.';
  return PWA.hasKey() ? 'Claude öz API açarınla işləyir (Ayarlar → Claude).'
    : 'Bu tətbiqdə Claude üçün API açarı yoxdur: sual claude.ai versiyasında açılacaq və cavab orada başlayacaq. Cavabın burada görünməsi üçün Ayarlar → Claude bölməsində açar əlavə et.';
}
function drawChat() {
  const el = $('#chat');
  if (!el) return;
  el.innerHTML = CHAT.turns.length ? CHAT.turns.map(t => t.role === 'user'
    ? `<div class="bub me">${esc(t.label || t.content)}</div>`
    : `<div class="bub ai prose">${mdToHtml(t.content)}</div>`).join('')
    : `<div class="chat-empty"><p class="muted small">İstənilən mövzuda yaz: qanun maddəsi, məntiq məsələsi, dil qaydası, Excel düsturu, müsahibə və ya hazırlıq planı. Cavab burada yazılacaq.</p>
      <div class="row">${ADVICE.map(([l], i) => `<button type="button" class="btn sm" data-adv="${i}">${esc(l)}</button>`).join('')}</div>
      <p class="muted small">Bu hazır mövzular Claude-a irəliləyişini də göndərir: oxunan bölmələr, səhvlər, son sınaq nəticəsi.</p></div>`;
}
async function chatSend(content, label) {
  if (CHAT.busy || !content.trim()) return;
  await AI.ready;
  CHAT.turns.push({ role: 'user', content, label });
  drawChat();
  const el = $('#chat');
  const out = document.createElement('div');
  out.className = 'bub ai';
  el.appendChild(out);
  out.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  const turns = CHAT.turns.length > CHAT_KEEP ? [CHAT.turns[0], ...CHAT.turns.slice(-(CHAT_KEEP - 1))] : CHAT.turns;
  CHAT.busy = true;
  const send = $('[data-act="chat-send"]');
  if (send) send.disabled = true;
  const res = await aiStream(out, turns.map(t => ({ role: t.role, content: t.content })), { chat: true });
  CHAT.busy = false;
  if (send) send.disabled = false;
  if (res) { CHAT.turns.push({ role: 'assistant', content: res.text }); drawChat(); }
}

const ASK_HINT = 'Sualını yaz… Məsələn: inzibati akt nədir? Bu məntiq məsələsini necə həll edim?';
function vTeacher() {
  topbar(`Claude · ${S.group} qrupu`, 'Virtual müəllim', null, null, null, { big: true });
  $('#view').innerHTML = `
    <p class="muted small" id="ai-mode">${esc(aiMode())}</p>
    <section class="block">
      <div class="card stack chatcard">
        <div id="chat" class="chat" aria-live="polite"></div>
        <label class="sr" for="tq">Sualın</label>
        <textarea id="tq" class="ta" rows="3" placeholder="${esc(CHAT.turns.length ? 'Davam sualını yaz…' : ASK_HINT)}">${esc(tDraft)}</textarea>
        <div class="row"><button type="button" class="btn sm primary" data-act="chat-send">${icon('chat')} Göndər</button>
          <button type="button" class="btn sm ghost" data-act="chat-new">${icon('refresh')} Yeni söhbət</button></div>
      </div>
    </section>`;
  drawChat();
  const ta = $('#tq');
  ta.addEventListener('input', () => { tDraft = ta.value; });
  // a typed question: the first one carries the teacher's instructions
  const send = async () => {
    const text = ta.value.trim();
    if (!text) { ta.focus(); return; }
    await AI.ready;
    if (!AI.here()) { handoff('ai-chat', text); return; }
    ta.value = ''; tDraft = '';
    chatSend(CHAT.turns.length ? text : pFree(text), text);
  };
  $('[data-act="chat-send"]').addEventListener('click', send);
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); });
  $('[data-act="chat-new"]').addEventListener('click', () => { if (CHAT.busy) return; CHAT.turns = []; drawChat(); ta.placeholder = ASK_HINT; });
  // the ready-made advice shown on an empty chat
  $('#chat').addEventListener('click', async e => {
    const b = e.target.closest && e.target.closest('[data-adv]');
    if (!b) return;
    const t = aiTask('adv', b.dataset.adv);
    if (!t) return;
    await AI.ready;
    if (!AI.here()) { handoff(`ai-adv-${b.dataset.adv}`); return; }
    chatSend(t.make(), t.label);
  });
  AI.ready.then(() => { const m = $('#ai-mode'); if (m) m.textContent = aiMode(); });
}

/* =========================================================
   11. Search
   ========================================================= */
const INDEX = CHAPTERS.flatMap(c => c.sections.map(s => ({ id: s.id, t: fold(s.title), x: fold(s.text), raw: s.text })));

function snippet(raw, q) {
  const f = fold(raw), at = f.indexOf(q);
  if (at < 0) return esc(raw.slice(0, 140)) + (raw.length > 140 ? '…' : '');
  const a = Math.max(0, at - 60), b = Math.min(raw.length, at + q.length + 80);
  return (a ? '…' : '') + esc(raw.slice(a, at)) + '<mark>' + esc(raw.slice(at, at + q.length)) + '</mark>' + esc(raw.slice(at + q.length, b)) + (b < raw.length ? '…' : '');
}

function vSearch(q0) {
  topbar('Kitab', 'Axtarış', 'home');
  $('#view').innerHTML = `
    <label class="search"><span class="sr">Axtarış</span>${icon('search')}
      <input type="search" id="q" placeholder="Söz və ya ifadə yaz" autocomplete="off" value="${esc(q0)}"></label>
    <div id="hits" class="list block"></div>`;
  const inp = $('#q');
  const run = () => {
    const q = fold(inp.value.trim());
    history.replaceState(null, '', '#axtar' + (inp.value.trim() ? '=' + encodeURIComponent(inp.value.trim()) : ''));
    if (q.length < 2) { $('#hits').innerHTML = '<p class="muted empty">Ən azı 2 hərf yaz.</p>'; return; }
    const hits = INDEX.filter(e => vis(secById[e.id]) && vis(chById[secCh[e.id]]) && (e.t.includes(q) || e.x.includes(q))).slice(0, 50);
    $('#hits').innerHTML = hits.length ? hits.map(e => {
      const s = secById[e.id], c = chById[secCh[e.id]];
      return `<a class="hit" href="#${e.id}"><span class="kicker">${esc(c.kind === 'chapter' ? `Fəsil ${c.n}` : c.title)}</span>
        <b>${esc((s.num ? s.num + '. ' : '') + s.title)}</b><span class="snip">${snippet(e.raw, q)}</span></a>`;
    }).join('') : '<p class="muted empty">Heç nə tapılmadı.</p>';
  };
  inp.addEventListener('input', run);
  run();
  if (!q0) inp.focus();
}

/* =========================================================
   12. Settings
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
    <p class="muted small">Yeni versiya özü yüklənir və tətbiqdən çıxıb qayıdanda açılır; yarımçıq test və ya söhbət varsa, bitənə qədər gözləyir.</p>
    <button type="button" class="btn" data-act="update">${icon('refresh')} İndi yoxla</button>`;
}

function vSettings() {
  topbar(`${S.group} qrupu`, 'Ayarlar', null, null, null, { big: true });
  $('#view').innerHTML = `
    <section class="block"><div class="block-h"><h2>Vəzifə qrupu</h2></div>
      <div class="card stack">
        <div class="set"><span>Qrup</span>${seg('group', S.group, GROUPS.map(g => [g, g]))}</div>
        <p class="muted small">Kitab, testlər, axtarış və sınaq imtahanı yalnız bu qrupun proqramına düşən mövzuları göstərir. BA-da 20 açıq sual var, BB-də hamısı qapalıdır.</p>
      </div></section>
    <section class="block"><div class="block-h"><h2>Görünüş</h2></div>
      <div class="card stack">
        <div class="set"><span>Rejim</span>${seg('theme', S.theme, [['light', 'Açıq'], ['dark', 'Qaranlıq'], ['auto', 'Sistem']])}</div>
        <div class="set"><span>Mətn ölçüsü</span>${seg('fs', S.fs, [['s', 'Kiçik'], ['m', 'Orta'], ['l', 'Böyük']])}</div>
      </div></section>
    <section class="block"><div class="block-h"><h2>Claude</h2></div>
      <div class="card stack" id="set-ai">${claudeRow()}</div></section>
    <section class="block"><div class="block-h"><h2>Tətbiq</h2></div>
      <div class="card stack" id="set-app">${appRow()}</div></section>
    <section class="block"><div class="block-h"><h2>Məlumatlar</h2></div>
      <div class="card stack">
        <p class="muted">${PWA ? 'İrəliləyiş və test nəticələri yalnız bu cihazda saxlanılır. Başqa cihaza keçmək üçün ixrac et, orada idxal et.'
          : 'İrəliləyiş bu brauzerdə saxlanılır. İxrac və idxal oflayn tətbiqdədir (ilkinrzyv.github.io/dovlet-qullugu).'}</p>
        <div class="row">
          ${PWA ? `<button type="button" class="btn" data-act="export">${icon('download')} İxrac et</button>
          <button type="button" class="btn" data-act="import">${icon('upload')} İdxal et</button>` : ''}
          <button type="button" class="btn ghost danger" data-act="reset">${icon('trash')} Sıfırla</button>
        </div>
      </div></section>`;
  $$('[data-group]').forEach(b => b.addEventListener('click', () => { S.group = b.dataset.group; save(); vSettings(); toast(`${S.group} qrupu seçildi`); }));
  $$('[data-theme]', $('#view')).forEach(b => b.addEventListener('click', () => { S.theme = b.dataset.theme; save(); applyLook(); vSettings(); }));
  $$('[data-fs]').forEach(b => b.addEventListener('click', () => { S.fs = b.dataset.fs; save(); applyLook(); vSettings(); }));
  bindApp();
  bindClaude();
  if (PWA) {
    $('[data-act="export"]').addEventListener('click', exportData);
    $('[data-act="import"]').addEventListener('click', importData);
  }
  $('[data-act="reset"]').addEventListener('click', e => askHere(e.currentTarget.parentNode, 'Bütün irəliləyiş və test nəticələri silinsin?', 'Bəli, sil', () => {
    S = Object.assign(blank(), { theme: S.theme, fs: S.fs, group: S.group, aiModel: S.aiModel, marks: S.marks }); save(); toast('Sıfırlandı');
  }));
}
// model choice (every build) and, in the offline app, the reader's own API key
function claudeRow() {
  const models = `<div class="row" role="radiogroup" aria-label="Model">${MODELS.map(([v, l]) =>
    `<button type="button" class="btn sm${S.aiModel === v ? ' on' : ''}" role="radio" aria-checked="${S.aiModel === v}" data-aimodel="${v}">${esc(l)}</button>`).join('')}</div>
    <p class="muted small">Model: “Avtomatik” — Claude özü seçir; Opus ən güclü, Haiku ən sürətli modeldir.</p>`;
  if (!PWA) return `${models}<p class="muted small">${esc(aiMode())} İstifadə hesabının limitindən çıxılır.</p>`;
  const has = PWA.hasKey(), art = PWA.artifactLink('');
  return `${models}
    <p class="small">${has ? `API açarı: <span class="mono">${esc(PWA.keyHint())}</span> — cavablar bu tətbiqdə yazılır.` : 'API açarı yoxdur: Claude düymələri claude.ai versiyasını açır və cavab orada başlayır.'}</p>
    <label class="sr" for="aikey">API açarı</label>
    <input id="aikey" class="oa" type="password" autocomplete="off" spellcheck="false" placeholder="sk-ant-…">
    <div class="row"><button type="button" class="btn sm primary" data-act="key-save">Açarı yadda saxla</button>
      ${has ? '<button type="button" class="btn sm ghost danger" data-act="key-del">Açarı sil</button>' : ''}
      ${art ? `<a class="btn sm ghost" href="${esc(art)}" target="_blank" rel="noopener">claude.ai versiyası</a>` : ''}</div>
    <p class="muted small">Açarı platform.claude.com → API Keys səhifəsində yarat. Açar yalnız bu cihazda saxlanılır və yalnız api.anthropic.com-a göndərilir. Xərc API hesabından çıxılır — claude.ai abunəliyindən ayrıdır.</p>`;
}
function bindClaude() {
  const box = $('#set-ai');
  if (!box) return;
  $$('[data-aimodel]', box).forEach(b => b.addEventListener('click', () => { S.aiModel = b.dataset.aimodel; save(); box.innerHTML = claudeRow(); bindClaude(); }));
  const sv = $('[data-act="key-save"]', box), del = $('[data-act="key-del"]', box);
  if (sv) sv.addEventListener('click', async () => {
    const k = $('#aikey').value.trim();
    if (!k) { $('#aikey').focus(); return; }
    sv.disabled = true; toast('Açar yoxlanılır…');
    const r = await PWA.testKey(k);
    sv.disabled = false;
    if (!r.ok) { toast(aiErr(r)); return; }
    PWA.setKey(k); toast('Açar yadda saxlanıldı — Claude artıq bu tətbiqdə cavab verəcək.');
    box.innerHTML = claudeRow(); bindClaude();
  });
  if (del) del.addEventListener('click', () => { PWA.clearKey(); box.innerHTML = claudeRow(); bindClaude(); });
}
function bindApp() {
  const ins = $('[data-act="install"]');
  if (ins) ins.addEventListener('click', async () => { await PWA.install(); refreshApp(); });
  const up = $('[data-act="update"]');
  if (up) up.addEventListener('click', async () => {
    const r = await PWA.checkUpdate();
    toast({ found: PWA.sw.updated ? 'Yeni versiya hazırdır.' : 'Yeni versiya yüklənir…', latest: 'Ən son versiyadır.', offline: 'İnternet yoxdur.', none: 'Offline rejim aktiv deyil.' }[r] || 'Yoxlamaq alınmadı.');
  });
}
function refreshApp() { const box = $('#set-app'); if (box) { box.innerHTML = appRow(); bindApp(); } }
if (PWA) ['sw', 'install', 'net'].forEach(t => PWA.on(t, refreshApp));

// export/import live in the offline app only: claude.ai lets a page neither download nor keep files
async function exportData() {
  const name = `dovlet-qullugu-${new Date().toISOString().slice(0, 10)}.json`;
  const text = JSON.stringify({ app: 'dovlet-qullugu', v: 1, at: new Date().toISOString(), data: S }, null, 1);
  const r = await PWA.saveFile(name, text);
  if (r !== 'cancelled') toast('Fayl hazırdır');
}
async function importData() {
  const text = await PWA.pickFile();
  if (!text) return;
  let j = null; try { j = JSON.parse(text); } catch (e) { j = null; }
  if (!j || j.app !== 'dovlet-qullugu' || !j.data || typeof j.data !== 'object') { toast('Bu fayl bu kitabın ixracı deyil.'); return; }
  S = upgrade(j.data);
  if (!GROUPS.includes(S.group)) S.group = GROUPS[0];
  save(); applyLook(); vSettings(); toast('İdxal olundu');
}

/* =========================================================
   13. Start
   ========================================================= */
applyLook();
AI.init();
// the offline app reloads itself into a new version when the reader leaves it — unless that would lose work in hand
if (PWA) PWA.busy = () => !!(quizRun && quizRun.picks.length && quizRun.i < quizRun.items.length) || CHAT.busy || CHAT.turns.length > 0
  || !!tDraft.trim() || $$('.ai-box').some(b => b._ctl) || $$('#view input.oa:not([disabled]), #aikey').some(i => i.value.trim());
window.addEventListener('hashchange', route);
route();
})();
