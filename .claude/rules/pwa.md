---
paths:
  - "build/pwa.js"
  - "build/pwa.css"
  - "build/sw.template.js"
  - "build/build_pwa.py"
  - "build/tp1.js"
  - "build/make_icons.js"
---

# Offline layer: updates, install, service worker

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
