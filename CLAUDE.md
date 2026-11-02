# Dövlət Qulluğu — notes for Claude

Interactive Azerbaijani study book for the civil service (dövlət qulluğu) admission test, position groups **BA and
BB** (the owner's target; A groups are out of scope). Offline PWA served by GitHub Pages (branch `main`, folder
`/docs`) at https://ilkinrzyv.github.io/dovlet-qullugu/. Built on the same pattern as the owner's QA book
(https://github.com/ilkinrzyv/qa-kitabi): one markdown source, Python build, a framework-free `app.js`, a cache-first
service worker.

## Build

```bash
pip install -r requirements.txt
python build/qanun.py        # only when laws change: official texts from e-qanun.az → build/qanun/*.json (committed)
python build/parse_book.py   # → build/book.json (gitignored); must print "errors 0"
python build/build_pwa.py    # → docs/ and dist/dovlet-qullugu-offline.zip; prints the new version
python build/build_page.py   # → dist/dovlet-qullugu.html, the claude.ai version (see Claude below)
cd build && npm ci && npx playwright install chromium webkit
npm run test:pwa             # real build: service worker, install + install banner, offline reload, programme page,
                             # the longest law section's maddə list, a law explanation's links, a new release found
                             # and offered by itself (Chromium; WebKit as an iPhone, in Safari and from the home screen)
npm run test:app             # fixture book (build/test/): BA/BB filter, open + figure questions, inline nümunə/yoxla,
                             # Claude with a mocked API key + handoff links, teacher chat, mock exam, time-up,
                             # law text from ```qanun blocks, old read marks on law sections dropped, maddə list,
                             # explanation → maddə → back to the test, bookmarks, resume, programme tabs
npm run test:page            # fixture book as the claude.ai page, `sample` mocked: #ai-… links answer by themselves
```

All checks print JSON; `"errors": []` = pass. `npm run icons` re-renders `build/icons/`. Screenshots land in
`build/shots/` (gitignored). On Windows the scripts reconfigure stdout to UTF-8; use `python`, not `python3`.

## Where things live

- `book/book.md` — the text. `#` = book title (first) or a part, `## Fəsil N. Ad` = chapter (id `cN`), any other `##`
  = extra page (intro, exam rules; id `xN`), `###` = section (id `cNsK`, positional). Saved progress is keyed by these
  ids, so a section inserted later carries its own id. Heading attributes in braces: `{#c3x1 qrup=BA fənn=qan}` —
  `qrup` limits a part/chapter/section to some groups (inherited downwards, never wider than the parent), `fənn`
  ties a part or chapter to a subject (`qan`, `men`, `az`, `inf`). Chapter numbers run through the whole book.
  `####` and deeper stay inside a section. Rendered to HTML at build time with markdown-it (`html: False`), so no
  markdown library ships.
- Law text (Qanunvericilik, chapters 1–14) is the official text, never typed or summarised by hand — the owner found
  the old bullet summaries tiring and wants the maddələr in full and in order, as in a printed code. A ` ```qanun <act> `
  block lists what to show, one line each: `mənbə` (e-qanun link + text date, used in chapter leads), `preambula`,
  `maddə 5–9` (en dash; `13-1`, `98¹` are single numbers), `maddə 1: 1.0 1.0.1–1.0.4` (only those points),
  `bənd 33–34`, `hissə 1–3`, `fərman bənd 3`, `keçid müddəaları`. `parse_book.py` expands it from
  `build/qanun/<act>.json`: bölmə/fəsil/hissə captions (h5) come along when a selection starts after them, maddə
  headings are h4, a maddə or bənd removed whole shows as “çıxarılıb”; `app.js` gives qan sections `.prose.law`.
  Every maddə heading and bənd paragraph gets an id — `<act>-m<n>`, `<act>-b<n>`, a Təlimat's decree `<act>-f<n>`
  (`98¹` → `konstitusiya-m98-1`) — so a maddə may be shown in one section only (the parser fails otherwise). `#<id>`
  opens its section there, marked; a law section with 3+ maddələr (bəndlər in the Təlimat) opens with their list.
  Sections follow the law's own order (a fəsil, or a 5–12k-character run of maddələr); the programme decides which
  maddələr appear at all. “Yadda saxla” tables at chapter ends are the only summaries left.
- `build/qanun.py` — downloads each act in `ACTS` (key → e-qanun id) through `api.e-qanun.az/downloadWord/<id>`, which
  points at the Word file on `frameworks.e-qanun.az` (plain requests work there; `e-qanun.az/frameworks/…` answers
  403), and cuts it into units. In those files struck-through text is text an amendment removed (the endnotes say
  “çıxarılmışdır/ləğv edilmişdir”) — it is dropped, as are the endnotes; Word's automatic numbering is rendered;
  Cyrillic look-alike letters are mapped to Latin. Rerun it when a law changes, read `git diff build/qanun`, then check
  the questions and “Yadda saxla” rows that cite the changed points. The old summaries (before 2026-11-01) had kept
  some removed provisions (attestasiya, maddə 31 of the civil service law; the flag's Pantone colours; the 35-year age
  limit for President); the questions on them were replaced in place. On 2026-11-01 all 503 legislation questions
  were then checked one by one against the current text (answer, distractors, cited point).
- Questions inside a section: fenced blocks ` ```nümunə ` (worked example: `S:`, `A)`…, `Cavab: B`, `İzah:`) and
  ` ```yoxla ` (check: same without `İzah:`; the reader asks Claude instead). No options = open question,
  `Cavab: 7 | yeddi`; `Şəkil:` = SVG under `build/fig/`. The parser cuts them into `section.qs` and leaves
  `<div class="iq" data-i>` placeholders; options keep the author's order. In `fənn=men` chapters every section must
  follow the pattern (nümunə, yoxla+)+ — the owner wants each explanation followed by a worked example and a check.
- `build/figs_men.py` — draws every Məntiq figure into `build/fig/men/` (chapters 15–17 and their tests). The answers
  are computed there and asserted (cube nets are folded, punched paper unfolded, mirror images transformed, ciphers
  encoded, perimeters summed), so change a figure in the script and rerun it — never hand-edit those SVGs. It also
  writes `answers.json` (per figure: the option index, or the right answer as text); `parse_book.py` fails when a
  question on that figure answers otherwise. Cube views (16.7) fold the net printed side out and test a view against
  all 24 rotations; assembly tasks (16.8) use an exact-cover solver and are picked so the answer is the same whether or
  not pieces may be flipped; charts (17.7) are drawn from the same numbers the answers are computed from.
- `build/proqram.json` — DİM's four test programmes, BA/BB topics only, with the programme's own numbering (so gaps
  such as 2.1 → 2.3 are real), `g` for BA-only topics and `see` = chapter/section ids that teach a topic (checked by
  the parser). `exam` holds the exam shape (40/30/15/15, BA open counts 8/6/3/3, 1 and 2 points, 180 minutes) and the
  pass thresholds in percent per subgroup (DİM booklet 2017). Minutes and the open split are unofficial — the
  `*_note` fields say so in the app; keep them until the owner confirms.
- `build/quiz/*.json` — `{"<chapter number>": [...]}`. Closed: `{s, q, o, a, e}`, option count must match the subject
  (`qan` 4, others 5). Open: `{t: "open", s, q, a: [accepted answers], e}`. Figure: `img` = SVG under `build/fig/`
  (inlined; no scripts, handlers or external links), `fix: true` keeps option order when options are the figure's
  letters. Optional `g`. Quiz ids are positional (`c1q3`): new questions go at the end of a chapter's list, and an
  outdated question is replaced in place, not deleted. `s` is the section number (`1.4`), so restructuring sections
  means remapping `s` (legislation questions: by the maddə their `e` cites).
- The look is the “Müasir” design the owner chose (2026-11-02) from three drafts on a claude.ai canvas
  (https://claude.ai/artifact/4ZEQvrMkBri4o8aiBgKE5N): Plus Jakarta Sans only (vendored in `fonts/`, Google Fonts on
  the claude.ai page; it has ə and tabular figures), indigo accent `#4F46E5`, a colour per subject (`.s-qan`,
  `.s-men`, `.s-az`, `.s-inf`, `.s-mus` set `--sc*`; `sk()`/`sicon()` in app.js), large rounded cards, a floating tab
  bar (Kitab, Testlər, Müəllim, Statistika, Ayarlar; search opens from the Kitab page's top bar). A tab's own page
  has a large title in the top bar (`topbar(…, {big})`); other pages a back button and a centred title that shows once
  the page's `h1.h1` scrolls away. Reading a section, a test and the mock exam are `focus` pages: the tab bar gives
  way to the page's own `.actbar` (back / Oxudum / Növbəti; Əvvəlki / Növbəti), and a test's verdict comes up as a
  bottom `.sheet`. The law text's “Maddə N.” headings get a number pill without changing their text.
- `build/app.js` — the whole UI in one IIFE: hash router (`#home`, `#c1`, `#c1s2`, `#konstitusiya-m72` (a law id),
  `#elfecinler` (bookmarks), `#proqram[-qan]` (one subject at a time; its tabs are a second top-bar row), `#testler`,
  `#test-c1` / `test-mix` / `test-wrong` / `test-f-qan` / `test-s-c1s2` (one section; linked at the top of the section,
  as the chapter test is at the top of its chapter), `#imtahan`, `#imtahan-men` (one
  subject's part: its question count, its share of the time), `#imtahan-netice`, `#statistika`, `#sual-c1q3`,
  `#muellim[-men]`, `#axtar=...`, `#ayarlar`). `vis()` filters everything by `S.group`. Law questions' explanations
  (`lawLinks`): “Maddə 72.III”, “109-cu maddəsinin”, “Bənd 25” link to the law id; a law's name before a reference
  (Konstitusiyanın, Bayraq/Gerb/Himn qanununun, Fərman 435/614, Fərmanın = the Təlimat's decree) picks the act until
  the next name, else the act of the question's section, then of its chapter — so write explanations as “Maddə N…” and
  name any other law. A link (or “Bölməni oxu”) from a test keeps the test (`quizRun`, `RET`) and the book shows
  “Testə qayıt”. State in localStorage
  `dq-kitab:v1` (`read`, `last`, `at` = [section, block index] where reading stopped, used by “Davam et”, `marks` =
  bookmarks (section id or law id → time; “Sıfırla” keeps them), `quiz`, `wrong`, `ans` = per test question `[right, tries, last 1/0]` from practice and
  exams (the statistics page: accuracy per subject, weak sections = under 80% with 2+ answers), `chk` = solved inline
  checks keyed `cNsKkI` (I = index in `section.qs`), `aiModel`, `theme` (default light, the owner's choice; `themeV`
  marks a state saved after that, so an older `auto` opens light once; `build/look.js`, inlined at the top of both
  pages, applies it before paint), `lawV` (marks a state saved after the law text replaced the summaries; `upgrade()`
  drops older read marks on qan sections, also for imported files), `fs`, `group`, `exam` = the running mock exam with
  its start time (`subj` set for a
  one-subject exam), `exams` = history (entries with `subj` are subject exams; whole-exam views filter them out),
  `examLast`). Export/import as JSON with `app: "dovlet-qullugu"` (offline app only).
- Claude (`app.js` section 2b; teacher chat in section 10) answers inside the book, under the button, like the QA book.
  Two builds of the same `app.js`: the claude.ai page (`build_page.py`, published as an artifact with capability
  `sample` + images, URL in `build/artifact.txt`) runs on the reader's own claude.ai account via
  `window.claude.use('sample')`; the offline app calls the Messages API with the reader's own key (`DQ_PWA.sample`,
  key only in localStorage, sent only to api.anthropic.com). Without a key a button opens the claude.ai page at
  `#ai-<act>-<ref>` (act `sec|hint|iq|q|topic|adv|chat`; claude.ai passes only plain anchors, no `/`), which routes
  to the place and starts the answer itself; only book ids travel, typed text goes to the clipboard. The model is
  the reader's choice (Ayarlar → Claude, `S.aiModel`; `auto` names none). Prompts are Azerbaijani; check questions
  ask for a hint, not the answer; figures go along as PNG. No Claude inside a running mock exam. claude.ai shows no
  `confirm()`/`alert()` and blocks downloads — use `askHere()` and keep export/import behind `if (PWA)`.
  The teacher page is one plain chat on any topic (the owner's wish: no subject picker, no topic list); the
  ready-made advice prompts show only on an empty chat; `#ai-topic-…` links still open the chat with that topic.
  After changing `app.js`/`app.css` or the book, rebuild the page and republish it to the same artifact URL.
- `libs/` — marked 12.0.2 and DOMPurify 3.1.6 (render Claude's markdown safely); copied into `docs/libs/`; the
  claude.ai page loads the same versions from jsDelivr.
- `build/pwa.js` — `window.DQ_PWA`: service-worker registration, update bar, install prompt, file save/pick, Claude
  API calls. Present only in the PWA build; guard its use with `if (PWA)`. Updates happen by themselves (the owner's
  wish): it asks for a new sw.js when the app opens, comes back to the screen (installed apps are resumed, not
  reopened — iOS above all; a minute apart at most), gets the network back and every 30 minutes; sw.js caches the new
  version and takes over, and the page reloads into it when the reader leaves the app (at once if it is off screen),
  back at the same scroll with a “Kitab yeni versiyaya keçdi” toast — unless `DQ_PWA.busy()` (set by app.js: a test
  half done, a chat, typed text) says a reload would lose work. Meanwhile the bar offers “Yenilə” (“Sonra” hides it
  until the next return; the toast and the corner buttons move up over it; it waits while a test's answer sheet is
  up). It also shows the install banner when the
  page opens (the owner's wish): a button for the browser's install dialog (`beforeinstallprompt`: Android, desktop
  Chrome/Edge), Share → “Ana ekrana əlavə et” steps on iOS (Safari and other iOS browsers worded apart), the ⋮ menu
  path on Android browsers without the event (after 3.5 s; it turns into the button if the event comes later).
  Never in the installed app; “Bağla” hides it for 3 days (`LATER_DAYS`, key `dq-kitab:pwa:install-later`).
  Styles in `build/pwa.css` (PWA build only). `npm run test:pwa` covers these cases with spoofed user agents.
- `build/sw.template.js` — cache-first service worker; `build_pwa.py` injects VERSION (content hash) and the precache
  list. Cache names start with `dq-kitab-`.

## Content sources the owner gave (Desktop, not in the repo)

DİM programmes (Qanunvericilik 01.06.2026, Azərbaycan dili 16.02.2026, İnformatika 30.09.2026, Məntiq 18.07.2024),
`DQ.txt` (exam shape), `QANUN.txt` (~150 interview Q&A: messy, partly outdated — Minsk Group, occupation lists,
TANAP plans, old budgets — needs fact-checking before use), `inf.pdf` (20 logic questions from testbook.az, no answer
key — third-party material: use as a model of question types only, never copy into this public repo; same for DİM's
"1000/2000 test" books).

## Rules

- Reader-facing text is Azerbaijani (Latin script).
- Never edit `docs/` by hand: change the sources, rebuild, and commit `docs/` together with the source change.
- Law text comes from e-qanun.az (current edition) through `build/qanun.py`; cover only the articles the programme
  lists. Facts about laws and exam rules must come from the owner or an official source; do not invent article numbers,
  and check a question's facts against `build/qanun/*.json` (the current text), not against older summaries.
- Run both checks before pushing and say what could not be verified. The owner wants every finished piece of work
  committed and pushed to `main` without asking first.
