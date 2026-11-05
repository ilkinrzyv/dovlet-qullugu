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

Prefer `cd build && npm run check` (add steps to narrow it: `npm run check -- app page`): it runs the build and the
suites, prints one line per step and only the failures; full output in `build/shots/check-<step>.log`. The scripts
themselves print long JSON; `"errors": []` = pass. `npm run icons` re-renders `build/icons/`. Screenshots land in
`build/shots/` (gitignored). On Windows the scripts reconfigure stdout to UTF-8; use `python`, not `python3`.

## Where things live

The details load by themselves when a matching file is opened (`.claude/rules/`):

- `content.md`: `book/book.md` format, law text and `build/qanun.py`, inline questions, `build/quiz/`, `build/proqram.json`, Məntiq figures
- `app.md`: `build/app.js` / `app.css` (look, routes, state keys, Claude), `libs/`, the claude.ai page
- `pwa.md`: `build/pwa.js`, `build/sw.template.js`, updates, install banner

## Saving tokens

- `docs/`, `build/book.json`, `build/node_modules/` and `fonts/` are build output or vendored: `.claude/settings.json` denies reading them and `.ignore` keeps them out of search. Work from the sources. To inspect them, use a narrow shell command.
- `build/app.js` is 145 KB and `book/book.md` 240 KB: never read them whole. List `app.js`'s parts with `grep -n -A1 '^/\* ====' build/app.js`, find a function with Grep, read that range. Same for `build/qanun/*.json`: grep the maddə.
- Run tests through `npm run check`, not the raw scripts.
- Prefer doing a search yourself over a subagent unless the user asks; a subagent starts cold.

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
