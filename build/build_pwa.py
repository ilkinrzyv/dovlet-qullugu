#!/usr/bin/env python3
"""Build the offline app (PWA) into ../docs/ (served by GitHub Pages) plus ../dist/dovlet-qullugu-offline.zip.
Run parse_book.py first: it writes build/book.json."""
import datetime, hashlib, json, os, shutil, sys, zipfile

BASE = os.path.dirname(os.path.abspath(__file__))
SCR = os.path.normpath(os.path.join(BASE, '..'))
OUT = os.path.join(SCR, 'docs')
ZIP = os.path.join(SCR, 'dist', 'dovlet-qullugu-offline.zip')
FONTS = os.path.join(SCR, 'fonts')
ICONS = os.path.join(BASE, 'icons')
sys.stdout.reconfigure(encoding='utf-8')

rd = lambda p: open(p, encoding='utf-8').read()
book = json.load(open(os.path.join(BASE, 'book.json'), encoding='utf-8'))
css = rd(os.path.join(BASE, 'app.css')) + rd(os.path.join(BASE, 'pwa.css'))
app_js = rd(os.path.join(BASE, 'app.js'))
pwa_js = rd(os.path.join(BASE, 'pwa.js'))
sw_tpl = rd(os.path.join(BASE, 'sw.template.js'))

shutil.rmtree(OUT, ignore_errors=True)
for d in ('fonts', 'icons'):
    os.makedirs(os.path.join(OUT, d))

def wr(rel, text):
    with open(os.path.join(OUT, rel), 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)

# ---------- fonts (latin + latin-ext covers every Azerbaijani letter) ----------
FAM = [
    ('IBM Plex Sans', 'fontsource-ibm-plex-sans-5.3.0', 'ibm-plex-sans', (400, 500, 600, 700), False),
    ('IBM Plex Mono', 'fontsource-ibm-plex-mono-5.3.0', 'ibm-plex-mono', (400, 500, 600), False),
    ('Literata', 'fontsource-literata-5.3.0', 'literata', (400, 500, 600, 700), True),
]
RANGES = {
    'latin': 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
    'latin-ext': 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF',
}
font_css, font_files = '', []
for name, d, slug, weights, italic in FAM:
    for w in weights:
        for style in (('normal', 'italic') if italic else ('normal',)):
            for sub in ('latin-ext', 'latin'):
                f = f'{slug}-{sub}-{w}-{style}.woff2'
                src = os.path.join(FONTS, d, 'package', 'files', f)
                if not os.path.exists(src):
                    continue
                shutil.copy(src, os.path.join(OUT, 'fonts', f))
                font_files.append('fonts/' + f)
                font_css += (f"@font-face{{font-family:'{name}';font-style:{style};font-weight:{w};font-display:swap;"
                             f"src:url({f}) format('woff2');unicode-range:{RANGES[sub]};}}\n")
wr('fonts/fonts.css', font_css)
shutil.copy(os.path.join(FONTS, 'fontsource-ibm-plex-sans-5.3.0', 'package', 'LICENSE'), os.path.join(OUT, 'fonts', 'LICENSE-IBM-Plex.txt'))
shutil.copy(os.path.join(FONTS, 'fontsource-literata-5.3.0', 'package', 'LICENSE'), os.path.join(OUT, 'fonts', 'LICENSE-Literata.txt'))

# ---------- icons ----------
icon_files = []
for f in sorted(os.listdir(ICONS)):
    shutil.copy(os.path.join(ICONS, f), os.path.join(OUT, 'icons', f))
    icon_files.append('icons/' + f)

# ---------- book data as a script (works from file:// too) ----------
data = json.dumps(book, ensure_ascii=False, separators=(',', ':')).replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
book_js = 'window.DQ_BOOK=' + data.replace('</', '<\\/') + ';\n'

NAME = 'Dövlət Qulluğu'
nch = sum(1 for c in book['chapters'] if c['kind'] == 'chapter')
nq = sum(len(v) for v in book['quizzes'].values())
DESC = f'Dövlət qulluğu imtahanlarına hazırlıq: {nch} fəsil, {nq} test sualı. Offline işləyir.'
INDEX = f'''<!doctype html>
<html lang="az">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{NAME}</title>
<meta name="description" content="{DESC}">
<meta name="theme-color" content="#F5F3EC" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#111317" media="(prefers-color-scheme: dark)">
<meta name="color-scheme" content="light dark">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon.svg" type="image/svg+xml">
<link rel="icon" href="icons/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="{NAME}">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<style>:root{{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}body{{margin:0;font:14px system-ui,sans-serif}}[hidden]{{display:none!important}}</style>
<link rel="stylesheet" href="fonts/fonts.css">
<link rel="stylesheet" href="app.css">
</head>
<body>
<header id="topbar" class="topbar"><div class="wrap"></div></header>
<main id="view" class="wrap" tabindex="-1" aria-live="polite"></main>
<nav id="tabbar" class="tabbar" aria-label="Əsas bölmələr"></nav>
<noscript><p style="padding:24px">Bu kitab JavaScript ilə işləyir — brauzerdə JavaScript-i aç.</p></noscript>
<script src="book.js"></script>
<script src="pwa.js"></script>
<script src="app.js"></script>
</body>
</html>
'''

MANIFEST = {
    'id': './',
    'name': f'{NAME} — İmtahana Hazırlıq',
    'short_name': NAME,
    'description': DESC,
    'lang': 'az', 'dir': 'ltr',
    'start_url': './', 'scope': './',
    'display': 'standalone',
    'background_color': '#F5F3EC', 'theme_color': '#F5F3EC',
    'categories': ['education', 'books'],
    'icons': [
        {'src': 'icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any'},
        {'src': 'icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any'},
        {'src': 'icons/maskable-192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'maskable'},
        {'src': 'icons/maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'},
    ],
    'shortcuts': [
        {'name': 'Testlər', 'short_name': 'Testlər', 'description': 'Fəsil testləri, qarışıq test, səhvlərim', 'url': './#testler'},
        {'name': 'Axtarış', 'short_name': 'Axtarış', 'description': 'Bütün mətndə axtarış', 'url': './#axtar'},
    ],
}
manifest = json.dumps(MANIFEST, ensure_ascii=False, indent=1) + '\n'

wr('app.css', css)
wr('app.js', app_js)
wr('book.js', book_js)
wr('index.html', INDEX)
wr('manifest.webmanifest', manifest)

assets = ['./', 'app.css', 'app.js', 'book.js', 'pwa.js', 'manifest.webmanifest', 'fonts/fonts.css'] + font_files + icon_files

# version = content hash of everything the app is made of (templates, not the injected copies)
h = hashlib.sha256()
for part in (css, app_js, pwa_js, sw_tpl, book_js, INDEX, manifest, font_css):
    h.update(part.encode('utf-8'))
for rel in font_files + icon_files:
    h.update(open(os.path.join(OUT, rel), 'rb').read())
VERSION = datetime.date.today().strftime('%Y.%m.%d') + '-' + h.hexdigest()[:7]

wr('pwa.js', pwa_js.replace('__VERSION__', VERSION).replace('__ASSET_COUNT__', str(len(assets))))
wr('sw.js', sw_tpl.replace('__VERSION__', VERSION).replace('__ASSETS__', json.dumps(assets, ensure_ascii=False, indent=1)))

total = sum(os.path.getsize(os.path.join(OUT, a if a != './' else 'index.html')) for a in assets)
mb = f'{total / 1024 / 1024:.1f}'.replace('.', ',')

README = f'''# {NAME} — offline tətbiq

Bu qovluq dövlət qulluğu imtahanlarına hazırlıq kitabının **offline tətbiq (PWA)** versiyasıdır. Bir dəfə
internetlə açandan sonra kitab, testlər və irəliləyiş **internetsiz** işləyir. Telefonda ana ekrana adi tətbiq
kimi quraşdırılır.

Versiya: `{VERSION}` · cihazda tutduğu yer: təxminən {mb} MB.

## Telefona quraşdır

- **Android (Chrome):** saytı aç → Ayarlar → “Tətbiqi quraşdır” və ya menyu (⋮) → “Ana ekrana əlavə et”.
- **iPhone, iPad (Safari):** saytı aç → Paylaş düyməsi → “Ana ekrana əlavə et”.

Ayarlar → Tətbiq bölməsində “Offline hazırdır” yazısı görünəndən sonra tətbiqi internetsiz də aça bilərsən.

## Məlumatların

- İrəliləyiş və test nəticələri yalnız bu cihazda saxlanılır.
- Ehtiyat nüsxə: Ayarlar → Məlumatlar → “İxrac et” (.json fayl). Yeni cihazda “İdxal et”.
- Brauzerin sayt məlumatlarını silsən, irəliləyiş də silinir — əvvəlcə ixrac et.

## Yeniləmə

Sayt yenilənəndə tətbiq növbəti açılışda yeni versiyanı yükləyir və “Yenilə” düyməsini göstərir. Məlumatların itmir.

## Fayllar

- `index.html` — tətbiqin qabığı
- `app.js`, `app.css` — interfeys
- `book.js` — kitabın bütün mətni və testlər
- `pwa.js` — offline rejim, quraşdırma, ixrac və idxal
- `sw.js` — service worker (offline yaddaş)
- `manifest.webmanifest`, `icons/` — tətbiqin adı və ikonları
- `fonts/` — IBM Plex Sans, IBM Plex Mono, Literata (SIL Open Font License 1.1)
'''
wr('README.md', README)
wr('.nojekyll', '')  # GitHub Pages: serve files as they are, no Jekyll

# ---------- zip: files at the root, so any static host serves index.html at / ----------
os.makedirs(os.path.dirname(ZIP), exist_ok=True)
if os.path.exists(ZIP):
    os.remove(ZIP)
with zipfile.ZipFile(ZIP, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for root, _, files in os.walk(OUT):
        for f in sorted(files):
            p = os.path.join(root, f)
            z.write(p, os.path.relpath(p, OUT))
print('version', VERSION)
print('assets', len(assets), 'precache bytes', total)
print('zip bytes', os.path.getsize(ZIP))
