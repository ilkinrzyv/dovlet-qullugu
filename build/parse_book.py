#!/usr/bin/env python3
"""book/book.md + build/quiz/*.json → build/book.json (the data the app reads).

Headings: `#` = book title (first) or a part, `##` = chapter (“Fəsil N. Ad”, or an extra page such as the intro),
`###` = section. Section ids are positional (c3s2); a section added later carries its own id in the heading
(`### 3.5. Ad {#c3x1}`) so saved progress keeps pointing at the right sections."""
import glob, json, os, re, sys
from markdown_it import MarkdownIt

BASE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BASE, '..', 'book', 'book.md')
QUIZ = os.path.join(BASE, 'quiz')
OUT = os.path.join(BASE, 'book.json')
for stream in (sys.stdout, sys.stderr):
    stream.reconfigure(encoding='utf-8')  # Windows consoles default to a code page without ə

errors = []
def err(msg):
    errors.append(msg)
    print('ERROR', msg, file=sys.stderr)

md = MarkdownIt('commonmark', {'html': False, 'typographer': False}).enable('table')
text = open(SRC, encoding='utf-8').read()
tokens = md.parse(text)
lines = text.split('\n')

heads = []  # (first line, level, text)
for i, t in enumerate(tokens):
    if t.type == 'heading_open':
        heads.append((t.map[0], int(t.tag[1]), tokens[i + 1].content.strip()))

def body(k):
    """Markdown between heading k and the next heading."""
    start = heads[k][0] + 1
    end = heads[k + 1][0] if k + 1 < len(heads) else len(lines)
    return '\n'.join(lines[start:end]).strip('\n')

def html(src):
    h = md.render(src)
    h = h.replace('<table>', '<div class="tbl"><table>').replace('</table>', '</table></div>')
    return h.strip()

def plain(src):
    h = md.render(src)
    h = re.sub(r'<[^>]+>', ' ', h)
    h = h.replace('&quot;', '"').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&#39;', "'")
    return re.sub(r'\s+', ' ', h).strip()

ID_RE = re.compile(r'\s*\{#([a-z0-9-]+)\}\s*$')
NUM_RE = re.compile(r'^(\d+(?:\.\d+)*)\.\s+(.*)$')
CH_RE = re.compile(r'^Fəsil\s+(\d+)\.\s*(.+)$')

book = {'title': '', 'parts': [], 'chapters': []}
part, chapter, extras, seen = None, None, 0, set()
for k, (_, level, title) in enumerate(heads):
    m = ID_RE.search(title)
    own_id = m.group(1) if m else None
    title = ID_RE.sub('', title)
    if level == 1:
        if not book['title']:
            book['title'] = title
            book['lead'] = html(body(k))
            continue
        part = {'id': f'p{len(book["parts"]) + 1}', 'title': title, 'chapters': []}
        book['parts'].append(part)
        chapter = None
    elif level == 2:
        cm = CH_RE.match(title)
        if cm:
            cid, n, kind, title = f'c{int(cm.group(1))}', int(cm.group(1)), 'chapter', cm.group(2).strip()
        else:
            extras += 1
            cid, n, kind = f'x{extras}', None, 'extra'
        cid = own_id or cid
        chapter = {'id': cid, 'n': n, 'kind': kind, 'title': title, 'lead': html(body(k)), 'sections': []}
        if part and kind == 'chapter':
            part['chapters'].append(cid)
        book['chapters'].append(chapter)
    elif level == 3:
        if not chapter:
            err(f'section outside a chapter: {title}')
            continue
        nm = NUM_RE.match(title)
        num, name = (nm.group(1), nm.group(2)) if nm else ('', title)
        sid = own_id or f'{chapter["id"]}s{len(chapter["sections"]) + 1}'
        src = body(k)
        words = len(plain(src).split())
        chapter['sections'].append({'id': sid, 'num': num, 'title': name, 'html': html(src), 'text': plain(src),
                                    'mins': max(1, round(words / 160))})
    else:
        continue  # #### and deeper stay inside the section text
    for x in ([chapter['sections'][-1]['id']] if level == 3 else [chapter['id']] if level == 2 else [part['id']]):
        if x in seen:
            err(f'duplicate id {x}')
        seen.add(x)

# ---------- quizzes: {"<chapter number>": [{s, q, o, a, e}]} ----------
by_num = {c['n']: c for c in book['chapters'] if c['kind'] == 'chapter'}
sec_by_num = {s['num']: s['id'] for c in book['chapters'] for s in c['sections'] if s['num']}
book['quizzes'] = {}
nq = 0
for f in sorted(glob.glob(os.path.join(QUIZ, '*.json'))):
    name = os.path.basename(f)
    try:
        data = json.load(open(f, encoding='utf-8'))
    except ValueError as e:
        err(f'{name}: {e}')
        continue
    for key, items in data.items():
        ch = by_num.get(int(key)) if key.isdigit() else None
        if not ch:
            err(f'{name}: no chapter {key}')
            continue
        out = book['quizzes'].setdefault(ch['id'], [])
        for i, q in enumerate(items):
            where = f'{name} {key}#{i + 1}'
            o, a = q.get('o'), q.get('a')
            if not q.get('q') or not isinstance(o, list) or not 2 <= len(o) <= 6 or not all(isinstance(x, str) and x for x in o):
                err(f'{where}: needs q and 2–6 options')
                continue
            if not isinstance(a, int) or not 0 <= a < len(o):
                err(f'{where}: answer index {a!r} is out of range')
                continue
            if len(set(o)) != len(o):
                err(f'{where}: repeated option')
            sid = sec_by_num.get(q.get('s', ''))
            if q.get('s') and not sid:
                err(f'{where}: no section {q["s"]}')
            out.append({'id': f'{ch["id"]}q{len(out) + 1}', 's': sid, 'q': q['q'], 'o': o, 'a': a, 'e': q.get('e', '')})
            nq += 1

json.dump(book, open(OUT, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, separators=(',', ':'))
nch = sum(1 for c in book['chapters'] if c['kind'] == 'chapter')
nsec = sum(len(c['sections']) for c in book['chapters'])
print(f'chapters {nch} sections {nsec} questions {nq} errors {len(errors)}')
sys.exit(1 if errors else 0)
