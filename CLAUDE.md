# Dövlət Qulluğu — notes for Claude

Interactive Azerbaijani study book for the civil service (dövlət qulluğu) course and admission exams. Offline PWA
served by GitHub Pages (branch `main`, folder `/docs`) at https://ilkinrzyv.github.io/dovlet-qullugu/.
Built on the same pattern as the owner's QA book (https://github.com/ilkinrzyv/qa-kitabi): one markdown source,
Python build, a framework-free `app.js`, a cache-first service worker.

## Build

```bash
pip install -r requirements.txt
python build/parse_book.py   # → build/book.json (gitignored); must print "errors 0"
python build/build_pwa.py    # → docs/ and dist/dovlet-qullugu-offline.zip; prints the new version
cd build && npm ci && npx playwright install chromium && npm run test:pwa   # prints JSON; "errors": [] = pass
```

`npm run icons` re-renders `build/icons/` from `make_icons.js`. Screenshots land in `build/shots/` (gitignored).
On Windows the scripts reconfigure stdout to UTF-8; use `python`, not `python3`.

## Where things live

- `book/book.md` — the text. `#` = book title (first) or a part, `## Fəsil N. Ad` = chapter (id `cN`), any other `##`
  = extra page (intro, appendix; id `xN`), `###` = section (id `cNsK`, positional). Saved progress is keyed by these
  ids, so a section inserted later carries its own id in the heading (`### 3.5. Ad {#c3x1}`) and the ones after keep
  theirs. Rendered to HTML at build time with markdown-it (`html: False`), so no markdown library ships.
- `build/quiz/*.json` — `{"<chapter number>": [{s, q, o, a, e}]}`; `s` = section number ("1.2"), `a` = index of the
  right option. Quiz ids are positional (`c1q3`), so new questions go at the end of a chapter's list. `parse_book.py`
  counts a bad answer index, unknown chapter or section as an error.
- `build/app.js` — the whole UI in one IIFE: hash router (`#home`, `#c1`, `#c1s2`, `#testler`, `#test-c1` /
  `test-mix` / `test-wrong`, `#axtar=...`, `#ayarlar`), state in localStorage `dq-kitab:v1`
  (`read`, `last`, `quiz`, `wrong`, `theme`, `fs`), export/import as JSON with `app: "dovlet-qullugu"`.
- `build/pwa.js` — `window.DQ_PWA`: service-worker registration, update bar, install prompt, file save/pick.
  Present only in the PWA build; guard its use with `if (PWA)`.
- `build/sw.template.js` — cache-first service worker; `build_pwa.py` injects VERSION (content hash) and the precache
  list. Cache names start with `dq-kitab-`.

## Rules

- Reader-facing text is Azerbaijani (Latin script).
- Never edit `docs/` by hand: change the sources, rebuild, and commit `docs/` together with the source change.
- Facts about laws and exam rules must come from the owner or an official source; do not invent article numbers.
- Run `npm run test:pwa` before pushing and say what could not be verified.
