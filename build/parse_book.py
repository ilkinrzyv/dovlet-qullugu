#!/usr/bin/env python3
"""book/book.md + build/quiz/*.json + build/proqram.json → build/book.json (the data the app reads).

Headings: `#` = book title (first) or a part, `##` = chapter (“Fəsil N. Ad”, or an extra page such as the intro),
`###` = section. Section ids are positional (c3s2); a section added later carries its own id in the heading
(`### 3.5. Ad {#c3x1}`) so saved progress keeps pointing at the right sections.

A heading may end with attributes in braces: `{#id qrup=BA fənn=qan}`. `qrup` limits a part, chapter or section to
some position groups (default: all of exam.groups, inherited downwards); `fənn` ties a part or chapter to a subject
of proqram.json (inherited by its chapters and their questions)."""
import argparse, glob, json, os, re, sys
from markdown_it import MarkdownIt

BASE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument('--src', default=os.path.join(BASE, '..', 'book', 'book.md'))
ap.add_argument('--quiz', default=os.path.join(BASE, 'quiz'))
ap.add_argument('--fig', default=os.path.join(BASE, 'fig'))
ap.add_argument('--out', default=os.path.join(BASE, 'book.json'))
args = ap.parse_args()
for stream in (sys.stdout, sys.stderr):
    stream.reconfigure(encoding='utf-8')  # Windows consoles default to a code page without ə

errors = []
def err(msg):
    errors.append(msg)
    print('ERROR', msg, file=sys.stderr)

prog = json.load(open(os.path.join(BASE, 'proqram.json'), encoding='utf-8'))
GROUPS = prog['exam']['groups']
SUBJ = {s['id']: s for s in prog['subjects']}

md = MarkdownIt('commonmark', {'html': False, 'typographer': False}).enable('table')
text = open(args.src, encoding='utf-8').read()
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

ATTR_RE = re.compile(r'\s*\{([^{}]*)\}\s*$')
NUM_RE = re.compile(r'^(\d+(?:\.\d+)*)\.\s+(.*)$')
CH_RE = re.compile(r'^Fəsil\s+(\d+)\.\s*(.+)$')

def attrs(title, where):
    """Split `Ad {#id qrup=BA fənn=qan}` into the title and its attributes."""
    m = ATTR_RE.search(title)
    if not m:
        return title, {}
    out = {}
    for tok in m.group(1).split():
        if tok.startswith('#'):
            out['id'] = tok[1:]
        elif tok.startswith('qrup='):
            out['g'] = [g for g in tok[5:].split(',') if g]
            bad = [g for g in out['g'] if g not in GROUPS]
            if bad or not out['g']:
                err(f'{where}: unknown group {tok}')
        elif tok.startswith('fənn='):
            out['subj'] = tok[5:]
            if out['subj'] not in SUBJ:
                err(f'{where}: unknown subject {tok}')
        else:
            err(f'{where}: unknown attribute {tok}')
    return ATTR_RE.sub('', title), out

book = {'title': '', 'parts': [], 'chapters': []}
part, chapter, extras, seen = None, None, 0, set()
for k, (_, level, raw) in enumerate(heads):
    if level > 3:
        continue  # #### and deeper stay inside the section text
    title, at = attrs(raw, raw)
    if level == 1:
        if not book['title']:
            book['title'] = title
            book['lead'] = html(body(k))
            continue
        part = {'id': at.get('id') or f'p{len(book["parts"]) + 1}', 'title': title, 'chapters': [],
                'g': at.get('g', GROUPS), 'subj': at.get('subj')}
        book['parts'].append(part)
        chapter = None
        new_id = part['id']
    elif level == 2:
        cm = CH_RE.match(title)
        if cm:
            cid, n, kind, title = f'c{int(cm.group(1))}', int(cm.group(1)), 'chapter', cm.group(2).strip()
        else:
            extras += 1
            cid, n, kind = f'x{extras}', None, 'extra'
        cid = at.get('id') or cid
        inherit = part if (part and kind == 'chapter') else None
        chapter = {'id': cid, 'n': n, 'kind': kind, 'title': title, 'lead': html(body(k)), 'sections': [],
                   'g': at.get('g', inherit['g'] if inherit else GROUPS),
                   'subj': at.get('subj', inherit['subj'] if inherit else None)}
        if inherit:
            inherit['chapters'].append(cid)
            if not set(chapter['g']) <= set(inherit['g']):
                err(f'{cid}: groups {chapter["g"]} wider than its part')
        book['chapters'].append(chapter)
        new_id = cid
    else:
        if not chapter:
            err(f'section outside a chapter: {title}')
            continue
        nm = NUM_RE.match(title)
        num, name = (nm.group(1), nm.group(2)) if nm else ('', title)
        sid = at.get('id') or f'{chapter["id"]}s{len(chapter["sections"]) + 1}'
        src = body(k)
        g = at.get('g', chapter['g'])
        if not set(g) <= set(chapter['g']):
            err(f'{sid}: groups {g} wider than its chapter')
        words = len(plain(src).split())
        chapter['sections'].append({'id': sid, 'num': num, 'title': name, 'html': html(src), 'text': plain(src),
                                    'mins': max(1, round(words / 160)), 'g': g})
        new_id = sid
    if new_id in seen:
        err(f'duplicate id {new_id}')
    seen.add(new_id)

# ---------- quizzes: {"<chapter number>": [{s, q, o, a, e} | {t: "open", s, q, a: [...], e}]} ----------
by_num = {c['n']: c for c in book['chapters'] if c['kind'] == 'chapter'}
sec_by_num = {s['num']: (s, c) for c in book['chapters'] for s in c['sections'] if s['num']}

def figure(rel, where):
    p = os.path.join(args.fig, rel)
    if not os.path.isfile(p):
        err(f'{where}: no figure {rel}')
        return None
    svg = open(p, encoding='utf-8').read().strip()
    if not svg.startswith('<svg') or re.search(r'<script|\son\w+\s*=|href\s*=\s*["\']?\s*(?:https?:|javascript:)', svg, re.I):
        err(f'{where}: {rel} must be a plain inline SVG')
        return None
    return svg

book['quizzes'] = {}
nq = 0
for f in sorted(glob.glob(os.path.join(args.quiz, '*.json'))):
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
            sec = None
            if q.get('s'):
                hit = sec_by_num.get(q['s'])
                if not hit or hit[1] is not ch:
                    err(f'{where}: no section {q["s"]} in chapter {key}')
                else:
                    sec = hit[0]
            g = q.get('g') or (sec['g'] if sec else ch['g'])
            if not set(g) <= set(GROUPS):
                err(f'{where}: unknown group in {g}')
            item = {'id': f'{ch["id"]}q{len(out) + 1}', 's': sec['id'] if sec else None, 'subj': ch['subj'], 'g': g,
                    'q': q.get('q', ''), 'e': q.get('e', '')}
            if not item['q']:
                err(f'{where}: empty question')
                continue
            if q.get('t') == 'open':
                a = q.get('a')
                a = [a] if isinstance(a, str) else a
                if not isinstance(a, list) or not a or not all(isinstance(x, str) and x.strip() for x in a):
                    err(f'{where}: an open question needs the accepted answers in a')
                    continue
                item.update(t='open', a=a)
            else:
                o, a = q.get('o'), q.get('a')
                need = SUBJ[ch['subj']]['opts'] if ch['subj'] else None
                if not isinstance(o, list) or not all(isinstance(x, str) and x for x in o) or not 2 <= len(o) <= 6:
                    err(f'{where}: needs 2–6 options')
                    continue
                if need and len(o) != need:
                    err(f'{where}: {SUBJ[ch["subj"]]["title"]} questions have {need} options, this one has {len(o)}')
                if not isinstance(a, int) or not 0 <= a < len(o):
                    err(f'{where}: answer index {a!r} is out of range')
                    continue
                if len(set(o)) != len(o):
                    err(f'{where}: repeated option')
                item.update(t='mc', o=o, a=a)
                if q.get('fix'):
                    item['fix'] = True  # options refer to labels in the figure: keep their order
            if q.get('img'):
                svg = figure(q['img'], where)
                if svg:
                    item['img'] = svg
            out.append(item)
            nq += 1

# ---------- programme: every “see” must point at a chapter or section ----------
# Only the real book must cover every link; a test book has a few chapters, so the rest are dropped.
strict = os.path.abspath(args.src) == os.path.abspath(ap.get_default('src'))
known = {c['id'] for c in book['chapters']} | {s['id'] for c in book['chapters'] for s in c['sections']}
for s in prog['subjects']:
    for t in s['topics']:
        t.setdefault('g', GROUPS)
        see = t.get('see', [])
        for x in see:
            if x not in known and strict:
                err(f'proqram {s["id"]} {t["num"]}: unknown id {x}')
        if see and not strict:
            t['see'] = [x for x in see if x in known]
book['prog'] = prog

json.dump(book, open(args.out, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, separators=(',', ':'))
nch = sum(1 for c in book['chapters'] if c['kind'] == 'chapter')
nsec = sum(len(c['sections']) for c in book['chapters'])
print(f'chapters {nch} sections {nsec} questions {nq} errors {len(errors)}')
sys.exit(1 if errors else 0)
