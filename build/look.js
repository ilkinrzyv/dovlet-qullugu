// The saved look, applied before the page paints: build_pwa.py and build_page.py inline this at the top of the page.
// The default is light; a state saved while "Sistem" was still the default (no themeV) counts as light too. app.js
// (applyLook) takes over after load and keeps the same rule.
(function () {
  var t = 'light';
  try {
    var s = JSON.parse(localStorage.getItem('dq-kitab:v1') || '{}');
    if (s.theme === 'dark' || (s.theme === 'auto' && s.themeV)) t = s.theme;
  } catch (e) { }
  if (t !== 'auto') { document.documentElement.setAttribute('data-theme', t); window.DQ_LOOK = 1; }
})();
