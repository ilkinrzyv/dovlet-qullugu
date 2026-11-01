#!/usr/bin/env python3
"""Law texts for the Qanunvericilik part, as e-qanun.az (the Ministry of Justice's legal database) publishes them.

`python build/qanun.py [key ...]` downloads each act's current Word file — the file e-qanun's “Word” button gives —
and writes build/qanun/<key>.json: the act's details and its text cut into units. Laws: `b` bölmə, `f` fəsil, `m`
maddə. Decrees: `p` bənd (a top-level numbered point with its sub-points). The record-keeping instruction: its decree's
bəndlər in `decree`, then `h` hissə and `p` bənd. Text struck through in the file is text an amendment removed, so it
is left out, as are the amendment notes; a maddə removed whole stays as a unit with `x`. book.md pulls the text in
with ```qanun blocks (parse_book.py). Rerun after a law changes and look at the diff."""
import datetime, json, os, re, sys, urllib.request, zipfile, io
import xml.etree.ElementTree as ET

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, 'qanun')
API = 'https://api.e-qanun.az/'
for stream in (sys.stdout, sys.stderr):
    stream.reconfigure(encoding='utf-8')

# key: (e-qanun id, kind) — the ids are those in e-qanun.az/framework/<id>
ACTS = {
    'konstitusiya': (897, 'law'),
    'dovlet-qullugu': (4481, 'law'),
    'ferman-435': (4518, 'decree'),        # applying the civil service law; the programme takes its part 3
    'etik': (13685, 'law'),
    'ferman-614': (13712, 'decree'),       # applying the ethics law; the programme takes its point 3
    'korrupsiya': (5809, 'law'),
    'melumat': (3420, 'law'),
    'muraciet': (31281, 'law'),
    'nha': (21300, 'law'),
    'dovlet-dili': (1865, 'law'),
    'inzibati-icraat': (11254, 'law'),
    'ombudsman': (1407, 'law'),
    'mehkemeler': (3933, 'law'),
    'elektron-imza': (5916, 'law'),
    'karguzarliq': (2284, 'instruction'),  # decree 935 and the instruction it approved
    'bayraq': (6198, 'law'),
    'gerb': (41948, 'law'),
    'himn': (41961, 'law'),
}

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
SUPD = str.maketrans('0123456789', '⁰¹²³⁴⁵⁶⁷⁸⁹')
# Cyrillic letters that look like Latin ones slip into e-qanun texts (sәsvermәsi); they would break search
HOMO = str.maketrans({'ә': 'ə', 'Ә': 'Ə', 'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'у': 'y',
                      'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P', 'С': 'C',
                      'Т': 'T', 'Х': 'X', 'і': 'i', 'І': 'I', 'ј': 'j', 'Ј': 'J', 'һ': 'h', 'Һ': 'H', 'ү': 'ü',
                      'Ү': 'Ü', 'ө': 'ö', 'Ө': 'Ö', 'ғ': 'ğ', 'Ғ': 'Ğ'})


def az_upper(s):
    return s.replace('i', 'İ').upper()


def az_lower(s):
    return s.replace('İ', 'i').replace('I', 'ı').lower()


# ---------- Word file → paragraphs ----------
def on(rpr, tag):
    e = rpr.find(W + tag) if rpr is not None else None
    return e is not None and e.get(W + 'val', 'true') not in ('0', 'false', 'none')


class Numbering:
    """Word's automatic numbering (some laws number their points this way): the label each paragraph shows. As in
    Word, lists that share an abstract definition share one count; a list with a startOverride restarts it where that
    list is first used (korrupsiya 9.1 → 9.2 → 9.3 runs over three lists)."""
    def __init__(self, z):
        self.lists, self.count, self.started = {}, {}, set()
        if 'word/numbering.xml' not in z.namelist():
            return
        root = ET.fromstring(z.read('word/numbering.xml'))
        def level_defs(parent):
            levels = {}
            for lv in parent.iter(W + 'lvl'):
                def val(tag, lv=lv):
                    e = lv.find(W + tag)
                    return e.get(W + 'val') if e is not None else None
                levels[int(lv.get(W + 'ilvl'))] = {'fmt': val('numFmt'), 'text': val('lvlText') or '',
                                                   'start': int(val('start') or 1)}
            return levels
        abstract = {a.get(W + 'abstractNumId'): level_defs(a) for a in root.iter(W + 'abstractNum')}
        for n in root.iter(W + 'num'):
            aid = n.find(W + 'abstractNumId').get(W + 'val')
            levels = {k: dict(v) for k, v in abstract.get(aid, {}).items()}
            restart = {}
            for o in n.iter(W + 'lvlOverride'):
                k = int(o.get(W + 'ilvl'))
                levels.update({lk: dict(lv) for lk, lv in level_defs(o).items()})  # a redefined level, same count
                s = o.find(W + 'startOverride')
                if s is not None:
                    restart[k] = int(s.get(W + 'val'))
            self.lists[n.get(W + 'numId')] = (aid, levels, restart)

    def label(self, num_id, level):
        aid, levels, restart = self.lists.get(num_id, (None, {}, {}))
        if level not in levels:
            return ''
        c = self.count.setdefault(aid, {})
        if level in restart and (num_id, level) not in self.started:
            self.started.add((num_id, level))
            c[level] = restart[level] - 1
        c[level] = c.get(level, levels[level]['start'] - 1) + 1
        for deeper in [k for k in c if k > level]:
            del c[deeper]
        if levels[level]['fmt'] in ('bullet', 'none'):
            return ''
        return re.sub(r'%(\d)', lambda m: str(c.get(int(m.group(1)) - 1, levels.get(int(m.group(1)) - 1, {}).get('start', 1))),
                      levels[level]['text'])


def run_text(r):
    out = []
    for x in r:
        if x.tag == W + 't':
            out.append(x.text or '')
        elif x.tag == W + 'tab':
            out.append(' ')
        elif x.tag in (W + 'br', W + 'cr'):
            out.append('\n')
        elif x.tag == W + 'noBreakHyphen':
            out.append('-')
        elif x.tag == W + 'sym' and x.get(W + 'char'):
            out.append(chr(int(x.get(W + 'char'), 16)))
    return ''.join(out)


def clean(s):
    s = s.translate(HOMO).replace(' ', ' ').replace('­', '')
    s = re.sub(r'[ \t]+', ' ', s)
    return re.sub(r' *\n *', '\n', s).strip()


def paragraph(p, numbering):
    kept, struck, bold, n = [], [], 0, 0
    for r in p.iter(W + 'r'):
        if r.find(W + 'endnoteReference') is not None or r.find(W + 'footnoteReference') is not None:
            continue  # the amendment notes
        rpr = r.find(W + 'rPr')
        t = run_text(r)
        if not t or on(rpr, 'vanish'):
            continue
        if on(rpr, 'strike') or on(rpr, 'dstrike'):
            struck.append(t)
            continue
        if on(rpr, 'caps') or on(rpr, 'smallCaps'):
            t = az_upper(t)
        va = rpr.find(W + 'vertAlign') if rpr is not None else None
        if va is not None and va.get(W + 'val') == 'superscript' and t.strip().isdigit():
            t = t.strip().translate(SUPD)  # Maddə 98¹
        kept.append(t)
        n += len(t.strip())
        bold += len(t.strip()) if on(rpr, 'b') else 0
    ppr = p.find(W + 'pPr')
    center, label = False, ''
    if ppr is not None:
        jc = ppr.find(W + 'jc')
        center = jc is not None and jc.get(W + 'val') == 'center'
        num = ppr.find(W + 'numPr')
        if num is not None and num.find(W + 'numId') is not None:
            lvl = num.find(W + 'ilvl')
            label = numbering.label(num.find(W + 'numId').get(W + 'val'), int(lvl.get(W + 'val')) if lvl is not None else 0)
    text = clean(''.join(kept))
    if label and text:
        text = f'{label} {text}'
    return {'t': text, 'struck': clean(''.join(struck)), 'b': n > 0 and bold / n > 0.6, 'c': center}


def paragraphs(docx):
    z = zipfile.ZipFile(io.BytesIO(docx))
    numbering = Numbering(z)
    body = ET.fromstring(z.read('word/document.xml')).find(W + 'body')
    out = []
    for el in body:
        if el.tag == W + 'p':
            out.append(paragraph(el, numbering))
        elif el.tag == W + 'tbl':
            rows = []
            for tr in el.iter(W + 'tr'):
                rows.append([' '.join(x for x in (paragraph(p, numbering)['t'] for p in tc.iter(W + 'p')) if x)
                             for tc in tr.iter(W + 'tc')])
            rows = [r for r in rows if any(r)]
            if rows:
                out.append({'t': '', 'table': rows, 'struck': '', 'b': False, 'c': False})
    return out


# ---------- paragraphs → units ----------
# The text ends where the signature or the list of amending acts starts
END = re.compile(r'^(İSTİFADƏ OLUNMUŞ MƏNBƏ|.{0,60}\b(HEYDƏR|İLHAM|Heydər|İlham) ƏLİYEV\b|Bakı şəhəri,|№ ?\S+$'
                 r'|\d{1,2} [a-zəöüğış]+ \d{4}-c[ıiuü] il\.?$)')
ART = re.compile(r'^Maddə\s+(\d+(?:-\d+)?[⁰¹²³⁴⁵⁶⁷⁸⁹]*)\.?\s*(.*)$')
FES = re.compile(r'^(?:([IVXLC]+)fəsil|fəsil([IVXLC]+|\d+))\.?$', re.I)  # tried on the heading with its spaces taken out
BOL = re.compile(r'^(\w+)\s+bölmə\.?$', re.I)
KEC = re.compile(r'^keçid müddəaları$', re.I)
POINT = re.compile(r'^(\d+)(?:-(\d+))?\.\s')
# Headings are printed in capitals, so the file's own case says nothing; names keep their capitals
PROPER = [('azərbaycan respublikası', 'Azərbaycan Respublikası'), ('naxçıvan muxtar respublikası', 'Naxçıvan Muxtar Respublikası'),
          ('Respublikasının konstitusiya', 'Respublikasının Konstitusiya'), ('ali məhkəmə', 'Ali Məhkəmə'),
          ('Respublikasının insan hüquqları', 'Respublikasının İnsan hüquqları'), ('milli məclis', 'Milli Məclis'),
          ('Respublikasının hüquqi aktların dövlət reyestri', 'Respublikasının Hüquqi Aktların Dövlət Reyestri')]


def heading(s):
    """A heading (shown in capitals in the file, typed in any case) → sentence case."""
    s = az_lower(flat(s).strip())
    for a, b in PROPER:
        s = s.replace(a, b)
    return az_upper(s[:1]) + s[1:]


def flat(s):
    """Letter-spaced words in headings: “f ə s i l” → “fəsil”."""
    return re.sub(r'(?<!\S)((?:\w ){3,}\w)(?!\S)', lambda m: m.group(1).replace(' ', ''), s)


def fesil(t):
    return FES.match(re.sub(r'\s', '', t)) if len(t) < 30 else None


def point_no(t):
    m = POINT.match(t)
    return (int(m.group(1)), int(m.group(2) or 0)) if m else None


def item(p):
    return {'table': p['table']} if 'table' in p else p['t']


def head_split(ps):
    """The title lines and the intro (a preamble, a decree's opening words) before the first unit."""
    pre = []
    for i, p in enumerate(ps):
        t = p['t']
        if i == 0 or p['c'] or not t or re.search(r'(qanunu|fərmanı|konstitusiyası)$', t, re.I):
            continue
        pre.append(item(p))
    return pre


def law_units(ps):
    units, cur, first = [], None, None
    i = 0
    while i < len(ps):
        p = ps[i]
        t = p['t']
        if t and END.match(t):
            break
        if not t and 'table' not in p:
            m = ART.match(p['struck'])
            if m:  # removed whole
                cur = None
                units.append({'k': 'm', 'n': m.group(1), 't': '', 'p': [], 'x': 1})
                first = i if first is None else first
            i += 1
            continue
        m = ART.match(t) if 'table' not in p else None
        if m:
            cur = {'k': 'm', 'n': m.group(1), 't': m.group(2).strip(), 'p': []}
            units.append(cur)
            first = i if first is None else first
            i += 1
            continue
        if KEC.match(t):  # the Constitution's transitional provisions, after its last maddə
            cur = {'k': 'k', 'n': 'keçid', 't': 'Keçid müddəaları', 'p': []}
            units.append(cur)
            i += 1
            continue
        fm = fesil(t)
        bm = BOL.match(flat(t)) if len(t) < 40 else None
        if fm or bm:
            j = i + 1
            while j < len(ps) and not ps[j]['t']:
                j += 1
            title = ''
            if j < len(ps) and not ART.match(ps[j]['t']) and not fesil(ps[j]['t']):
                title = ps[j]['t']
                j += 1
            if fm:
                label = f'{fm.group(1).upper()} fəsil' if fm.group(1) else f'Fəsil {fm.group(2)}'
                units.append({'k': 'f', 'n': label, 't': heading(title)})
            else:
                units.append({'k': 'b', 'n': heading(bm.group(1)), 't': heading(title)})
            first = i if first is None else first
            cur = None
            i = j
            continue
        if cur is not None:
            cur['p'].append(item(p))
        i += 1
    return units, first


def add_point(units, cur, p):
    """A paragraph into the run of bəndlər: a higher top-level number starts a new bənd; one struck out whole is a
    removed bənd (kept as an empty unit with `x`, like a removed maddə)."""
    if 'table' in p:
        if cur is not None:
            cur['p'].append(item(p))
        return cur
    n = point_no(p['t'] or p['struck'])
    if n and (cur is None or n > cur['key']):
        cur = {'k': 'p', 'n': f'{n[0]}-{n[1]}' if n[1] else str(n[0]), 'key': n, 'p': [item(p)] if p['t'] else []}
        if not p['t']:
            cur['x'] = 1
        units.append(cur)
    elif cur is not None and p['t']:
        cur['p'].append(item(p))
    return cur


def point_units(ps, start, stop_at=None):
    """Top-level numbered points (bənd) with everything under them, from ps[start]; `stop_at` ends the run."""
    units, cur = [], None
    for i in range(start, len(ps)):
        p = ps[i]
        t = p['t']
        if (t and END.match(t)) or (stop_at and stop_at(p)):
            return units, i
        if t or p['struck'] or 'table' in p:
            cur = add_point(units, cur, p)
    return units, len(ps)


def instruction_units(ps):
    """Decree 935, then the instruction: hissə headings (“N. Ad”, numbered on their own) and bəndlər."""
    title = next(i for i, p in enumerate(ps) if p['t'] == 'TƏLİMAT')
    decree, _ = point_units(ps, 0, stop_at=lambda p: 'table' in p)
    units, cur, part = [], None, 0
    for p in ps[title + 1:]:
        t = p['t']
        if t and END.match(t):
            break
        if 'table' in p and re.search(r'nömrəli Fərmanı ilə təsdiq edilmiş', ' '.join(sum(p['table'], [])), re.I):
            break  # the forms annexed to the instruction, each headed “… təsdiq edilmiş Təlimatın N nömrəli əlavəsi”
        if not t and not p['struck'] and 'table' not in p:
            continue
        m = re.match(r'^(\d+)\.\s+(.+)$', t)
        if m and int(m.group(1)) == part + 1 and len(t) < 200 and not re.search(r'[.;:,]$', t):
            part += 1
            units.append({'k': 'h', 'n': str(part), 't': m.group(2).strip()})
            continue
        cur = add_point(units, cur, p)
    return decree, units


def convert(key, docx, kind):
    ps = paragraphs(docx)
    out = {}
    if kind == 'law':
        units, first = law_units(ps)
        out['pre'] = head_split(ps[:first] if first is not None else [])
    elif kind == 'decree':
        start = next(i for i, p in enumerate(ps) if point_no(p['t']))
        out['pre'] = head_split(ps[:start])
        units, _ = point_units(ps, start)
    else:
        start = next(i for i, p in enumerate(ps) if point_no(p['t']))
        out['pre'] = head_split(ps[:start])
        out['decree'], units = instruction_units(ps)
        for u in out['decree']:
            del u['key']
    for u in units:
        u.pop('key', None)
    out['units'] = units
    return out


def check(key, act):
    """Numbered points inside a maddə carry its number (5.1, 5.1.2) and none repeats: anything else means the
    numbering was misread."""
    bad = []
    for u in act['units']:
        if u['k'] != 'm' or not re.fullmatch(r'\d+(?:-\d+)?', u['n']):
            continue
        seen = set()
        for x in u['p']:
            m = re.match(r'^(\d+(?:-\d+)?)\.\d', x) if isinstance(x, str) else None
            if m and m.group(1) != u['n']:
                bad.append(f'maddə {u["n"]}: {x[:60]}')
            lab = re.match(r'^(\d+(?:[.-]\d+)+)\.\s', x) if isinstance(x, str) else None
            if lab:
                if lab.group(1) in seen:
                    bad.append(f'maddə {u["n"]}: {lab.group(1)} twice')
                seen.add(lab.group(1))
    for b in bad[:8]:
        print(f'  WARN {key} {b}')
    return len(bad)


def get(url):
    req = urllib.request.Request(url, headers={'Accept-Language': 'AZ'})
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.read()


def main():
    keys = sys.argv[1:] or list(ACTS)
    os.makedirs(OUT, exist_ok=True)
    warn = 0
    for key in keys:
        fid, kind = ACTS[key]
        req = json.loads(get(f'{API}framework/{fid}'))['data']['requisite']
        docx = get(get(f'{API}downloadWord/{fid}').decode('utf-8').strip())
        act = {'key': key, 'id': fid, 'title': req['title'].strip(), 'num': (req.get('citation') or '').strip(),
               'date': req.get('acceptDate'), 'status': req.get('statusName'), 'url': f'https://e-qanun.az/framework/{fid}',
               'fetched': datetime.date.today().isoformat()}
        act.update(convert(key, docx, kind))
        warn += check(key, act)
        json.dump(act, open(os.path.join(OUT, key + '.json'), 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
        n = {k: sum(1 for u in act['units'] if u['k'] == k) for k in 'bfmhp'}
        chars = sum(len(x) if isinstance(x, str) else 0 for u in act['units'] for x in u.get('p', []))
        removed = [u['n'] for u in act['units'] if u.get('x')]
        print(f'{key}: {act["title"][:60]} — {", ".join(f"{k} {v}" for k, v in n.items() if v)}, {chars} simvol'
              + (f', çıxarılıb: {" ".join(removed)}' if removed else ''))
    print(f'acts {len(keys)} warnings {warn}')


if __name__ == '__main__':
    main()
