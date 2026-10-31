# Dövlət Qulluğu — notes for Claude

Interactive Azerbaijani study book for the civil service (dövlət qulluğu) admission test, position groups **BA and
BB** (the owner's target; A groups are out of scope). Offline PWA served by GitHub Pages (branch `main`, folder
`/docs`) at https://ilkinrzyv.github.io/dovlet-qullugu/. Built on the same pattern as the owner's QA book
(https://github.com/ilkinrzyv/qa-kitabi): one markdown source, Python build, a framework-free `app.js`, a cache-first
service worker.

## Build

```bash
pip install -r requirements.txt
python build/parse_book.py   # → build/book.json (gitignored); must print "errors 0"
python build/build_pwa.py    # → docs/ and dist/dovlet-qullugu-offline.zip; prints the new version
python build/build_page.py   # → dist/dovlet-qullugu.html, the claude.ai version (see Claude below)
cd build && npm ci && npx playwright install chromium
npm run test:pwa             # real build: service worker, install, offline reload, programme page offline
npm run test:app             # fixture book (build/test/): BA/BB filter, open + figure questions, inline nümunə/yoxla,
                             # Claude with a mocked API key + handoff links, teacher chat, mock exam, time-up
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
  Rendered to HTML at build time with markdown-it (`html: False`), so no markdown library ships.
- Questions inside a section: fenced blocks ` ```nümunə ` (worked example: `S:`, `A)`…, `Cavab: B`, `İzah:`) and
  ` ```yoxla ` (check: same without `İzah:`; the reader asks Claude instead). No options = open question,
  `Cavab: 7 | yeddi`; `Şəkil:` = SVG under `build/fig/`. The parser cuts them into `section.qs` and leaves
  `<div class="iq" data-i>` placeholders; options keep the author's order. In `fənn=men` chapters every section must
  follow the pattern (nümunə, yoxla+)+ — the owner wants each explanation followed by a worked example and a check.
- `build/figs_men.py` — draws every Məntiq figure into `build/fig/men/` (chapters 15–17 and their tests). The answers
  are computed there and asserted (cube nets are folded, punched paper unfolded, mirror images transformed, ciphers
  encoded, perimeters summed), so change a figure in the script and rerun it — never hand-edit those SVGs.
- `build/proqram.json` — DİM's four test programmes, BA/BB topics only, with the programme's own numbering (so gaps
  such as 2.1 → 2.3 are real), `g` for BA-only topics and `see` = chapter/section ids that teach a topic (checked by
  the parser). `exam` holds the exam shape (40/30/15/15, BA open counts 8/6/3/3, 1 and 2 points, 180 minutes) and the
  pass thresholds in percent per subgroup (DİM booklet 2017). Minutes and the open split are unofficial — the
  `*_note` fields say so in the app; keep them until the owner confirms.
- `build/quiz/*.json` — `{"<chapter number>": [...]}`. Closed: `{s, q, o, a, e}`, option count must match the subject
  (`qan` 4, others 5). Open: `{t: "open", s, q, a: [accepted answers], e}`. Figure: `img` = SVG under `build/fig/`
  (inlined; no scripts, handlers or external links), `fix: true` keeps option order when options are the figure's
  letters. Optional `g`. Quiz ids are positional (`c1q3`): new questions go at the end of a chapter's list.
- `build/app.js` — the whole UI in one IIFE: hash router (`#home`, `#c1`, `#c1s2`, `#proqram[-qan]`, `#testler`,
  `#test-c1` / `test-mix` / `test-wrong` / `test-f-qan`, `#imtahan`, `#imtahan-netice`, `#muellim[-men]`,
  `#axtar=...`, `#ayarlar`). `vis()` filters everything by `S.group`. State in localStorage `dq-kitab:v1` (`read`,
  `last`, `quiz`, `wrong`, `chk` = solved inline checks keyed `cNsKkI` (I = index in `section.qs`), `aiModel`, `theme`,
  `fs`, `group`, `exam` = the running mock exam with its start time, `exams` = history, `examLast`). Export/import as
  JSON with `app: "dovlet-qullugu"` (offline app only).
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
  After changing `app.js`/`app.css` or the book, rebuild the page and republish it to the same artifact URL.
- `libs/` — marked 12.0.2 and DOMPurify 3.1.6 (render Claude's markdown safely); copied into `docs/libs/`; the
  claude.ai page loads the same versions from jsDelivr.
- `build/pwa.js` — `window.DQ_PWA`: service-worker registration, update bar, install prompt, file save/pick, Claude
  API calls. Present only in the PWA build; guard its use with `if (PWA)`.
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
- Law text comes from e-qanun.az (current edition); cover only the articles the programme lists. Facts about laws and
  exam rules must come from the owner or an official source; do not invent article numbers.
- Run both checks before pushing and say what could not be verified. The owner wants every finished piece of work
  committed and pushed to `main` without asking first.
