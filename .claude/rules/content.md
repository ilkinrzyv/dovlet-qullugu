---
paths:
  - "book/**"
  - "build/parse_book.py"
  - "build/qanun.py"
  - "build/qanun/**"
  - "build/quiz/**"
  - "build/fig/**"
  - "build/figs_men.py"
  - "build/proqram.json"
  - "build/test/book.md"
  - "build/test/quiz/**"
---

# Book, law text, questions and figures

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
