---
paths:
  - "build/app.js"
  - "build/app.css"
  - "build/look.js"
  - "build/t1.js"
  - "build/t2.js"
  - "build/build_page.py"
  - "build/artifact.txt"
  - "libs/**"
---

# The app: look, router, state, Claude

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
  `#test-c1` / `test-mix` / `test-wrong` / `test-s-c1s2` (one section; a card at the top of the section,
  as the chapter test is at the top of its chapter, and a filled one under its text — the owner found a small chip
  too easy to miss), `#imtahan`, `#imtahan-men` (one
  subject's part: its question count, its share of the time), `#imtahan-netice`, `#statistika`, `#sual-c1q3`,
  `#muellim[-men]`, `#axtar=...`, `#ayarlar`, `#kartlar`, `#kartlar-c1` / `kartlar-reqem` (flash cards: a law
  chapter's maddə number ↔ name, or every “Yadda saxla” table row; built from the book's own html by `decks()`)).
  `vis()` filters everything by `S.group`. Law questions' explanations
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
  its start time (`subj` set for a one-subject exam; `flags` = questions put aside with “Sonra bax”, shown again
  before the end; `paused` = when a pause began — the ⏸ by the timer, or leaving the app while `pauseOnLeave`, a switch
  on the exam's page, is on — the questions hide and `start` moves on by the pause), `exams` = history (entries with
  `subj` are subject exams; whole-exam views filter them out), `examLast`, `run` = a practice test half done (the
  same object as `quizRun`; it goes on from the same question after a reload until finished or another starts),
  `hl` = highlights per section `[{k: block among the article's children (notes left out), a, b: offsets in its text,
  t: the text}]`, `notes` = a note per maddə anchor or section id `{t, at}`, `cards` = flash card id → 1 known / 0 not
  yet). “Sıfırla” keeps marks, highlights and notes. Export/import as JSON with `app: "dovlet-qullugu"` (offline app
  only). The exam result shares as a 1080×1350 picture (`resultImage`, `DQ_PWA.shareFile`; offline app only).
- Claude (`app.js` section 2b; teacher chat in section 10) answers inside the book, under the button, like the QA book.
  Two builds of the same `app.js`: the claude.ai page (`build_page.py`, published as an artifact with capability
  `sample` + images, URL in `build/artifact.txt`) runs on the reader's own claude.ai account via
  `window.claude.use('sample')`; the offline app calls the Messages API with the reader's own key (`DQ_PWA.sample`,
  key only in localStorage, sent only to api.anthropic.com). Without a key a button opens the claude.ai page at
  `#ai-<act>-<ref>` (act `sec|hint|iq|q|topic|adv|chat|mus` — `mus` is the mock interview: Claude on the hiring board,
  seven questions one by one, a review after each, a mark at the end; started from the teacher's empty chat and the
  interview chapters; claude.ai passes only plain anchors, no `/`), which routes
  to the place and starts the answer itself; only book ids travel, typed text goes to the clipboard. The model is
  the reader's choice (Ayarlar → Claude, `S.aiModel`; `auto` names none). Prompts are Azerbaijani; check questions
  ask for a hint, not the answer; figures go along as PNG. No Claude inside a running mock exam. claude.ai shows no
  `confirm()`/`alert()` and blocks downloads — use `askHere()` and keep export/import behind `if (PWA)`.
  The teacher page is one plain chat on any topic (the owner's wish: no subject picker, no topic list); the
  ready-made advice prompts show only on an empty chat; `#ai-topic-…` links still open the chat with that topic.
  After changing `app.js`/`app.css` or the book, rebuild the page and republish it to the same artifact URL.
- Ayarlar → “Paylaş” (offline app only, `shareCard()`): a QR for the public address (`SHARE_URL`) plus “Linki göndər”
  (`navigator.share`, else copy) and “Linki kopyala”. The QR is `build/icons/qr.svg`, made once with `segno`
  (`segno.make(url, error='m').save(…, scale=8, border=2)`); regenerate it only if the address changes.
- `libs/` — marked 12.0.2 and DOMPurify 3.1.6 (render Claude's markdown safely); copied into `docs/libs/`; the
  claude.ai page loads the same versions from jsDelivr.
- Saving the reader's tokens: a Claude button's answer is kept on the device (`runBox`, localStorage `dq-kitab:ai-answers`, keyed by a hash of model + prompt, 40 answers / 400k characters) and shown again without a call, with “Yenidən soruş”. The teacher's chat is never replayed; in the offline app it sends `cache_control` (`opts.promptCache`) so earlier turns are read from the API's prompt cache, and old turns drop six at a time so that the prefix stays the same.
