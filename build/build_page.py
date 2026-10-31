#!/usr/bin/env python3
"""Assemble the single-file page published as the claude.ai artifact (the book with Claude on the reader's own
claude.ai account) from book.json, app.css and app.js. Writes ../dist/dovlet-qullugu.html (not committed).

--book / --out build the same page from another book (the checks use the fixture book)."""
import argparse, json, os, sys

BASE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument('--book', default=os.path.join(BASE, 'book.json'))
ap.add_argument('--out', default=os.path.join(BASE, '..', 'dist', 'dovlet-qullugu.html'))
ap.add_argument('--wrap', action='store_true', help='also write a full document mimicking the published skeleton')
args = ap.parse_args()
sys.stdout.reconfigure(encoding='utf-8')

book = json.load(open(args.book, encoding='utf-8'))
css = open(os.path.join(BASE, 'app.css'), encoding='utf-8').read()
js = open(os.path.join(BASE, 'app.js'), encoding='utf-8').read()
look = open(os.path.join(BASE, 'look.js'), encoding='utf-8').read().strip()  # the saved look before the page paints
data = json.dumps(book, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
assert '</script' not in js.lower()

FONTS = ('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600'
         '&family=IBM+Plex+Sans:wght@400;500;600;700'
         '&family=Literata:ital,opsz,wght@0,7..72,400..700;1,7..72,400..700&display=swap')
nch = sum(1 for c in book['chapters'] if c['kind'] == 'chapter')
nq = sum(len(v) for v in book['quizzes'].values())

page = f'''<title>Dövlət Qulluğu Kitabı</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Dövlət qulluğu test imtahanına hazırlıq (BA, BB): {nch} fəsil, {nq} test sualı, sınaq imtahanı və Claude müəllim.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}">
<style>
{css}
</style>
<script>
{look}
</script>
<header id="topbar" class="topbar"><div class="wrap"></div></header>
<main id="view" class="wrap" tabindex="-1" aria-live="polite"></main>
<nav id="tabbar" class="tabbar" aria-label="Əsas bölmələr"></nav>
<script type="application/json" id="book-data">{data}</script>
<script src="https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js"></script>
<script>
{js}
</script>
'''
os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
open(args.out, 'w', encoding='utf-8', newline='\n').write(page)
if args.wrap:  # what the platform serves around the page: a skeleton with a small reset
    reset = (':root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
             'body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}')
    doc = ('<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">'
           f'<style>{reset}</style></head><body>{page}</body></html>')
    open(os.path.splitext(args.out)[0] + '.doc.html', 'w', encoding='utf-8', newline='\n').write(doc)
print('page bytes', len(page.encode('utf-8')))
