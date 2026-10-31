#!/usr/bin/env python3
"""Draws the Məntiq figures into build/fig/men/*.svg (run: python build/figs_men.py).

The geometry behind the answers is computed, not drawn by hand: cube nets are folded, punched paper is unfolded,
mirror images are transformed. The asserts below check every answer the book and the quizzes rely on, so a figure
cannot silently disagree with its question."""
import math, os, sys

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fig', 'men')
INK, MID, PALE, FRAME = '#1f2328', '#8a9199', '#eceef1', '#c9ced4'
FONT = 'IBM Plex Sans, Arial, sans-serif'
W, S, GAP = 540, 88, 14  # canvas width, cell size, gap between cells

def f(v):
    return ('%.1f' % v).rstrip('0').rstrip('.')

def poly(ps, fill='none', w=2.5, close=True, dash=False):
    tag = 'polygon' if close else 'polyline'
    d = ' stroke-dasharray="5 4"' if dash else ''
    return (f'<{tag} points="{" ".join(f"{f(x)},{f(y)}" for x, y in ps)}" fill="{fill}" stroke="{INK}" '
            f'stroke-width="{w}" stroke-linejoin="round" stroke-linecap="round"{d}/>')

def circle(cx, cy, r, fill='none', w=2.5):
    return f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="{fill}" stroke="{INK}" stroke-width="{w}"/>'

def line(x1, y1, x2, y2, w=2.5, dash=False, color=INK):
    d = ' stroke-dasharray="5 4"' if dash else ''
    return f'<line x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}" stroke="{color}" stroke-width="{w}" stroke-linecap="round"{d}/>'

def rect(x, y, w, h, fill='none', sw=2.5, dash=False, stroke=INK, rx=0):
    d = ' stroke-dasharray="5 4"' if dash else ''
    return f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{d}/>'

def text(x, y, t, size=20, weight=600, fill=INK):
    return f'<text x="{f(x)}" y="{f(y)}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="middle" dominant-baseline="central">{t}</text>'

def ngon(n, cx, cy, r, rot=-90):
    return [(cx + r * math.cos(math.radians(rot + 360 * k / n)), cy + r * math.sin(math.radians(rot + 360 * k / n))) for k in range(n)]

SIDES = {'triangle': 3, 'square': 4, 'pentagon': 5, 'hexagon': 6, 'heptagon': 7}

def shape(kind, cx, cy, r, fill='none'):
    if kind == 'circle':
        return circle(cx, cy, r, fill)
    n = SIDES[kind]
    rot = -45 if n == 4 else -90
    rr = r * (1.25 if n == 4 else 1.12 if n == 3 else 1.0)  # similar visual size
    return poly(ngon(n, cx, cy + (r * 0.12 if n == 3 else 0), rr, rot), fill)

def dots(n, cx, cy, gap=10, r=3.6):
    x0 = cx - gap * (n - 1) / 2
    return ''.join(circle(x0 + k * gap, cy, r, INK, 0) for k in range(n))

def ring_dots(n, cx, cy, rr, r=3.8):
    if n == 1:
        return circle(cx, cy, r, INK, 0)
    return ''.join(circle(x, y, r, INK, 0) for x, y in ngon(n, cx, cy, rr))

def frame(x, y, s=S, dash=False):
    return rect(x, y, s, s, '#ffffff', 1.5, dash, FRAME, 10)

def options(y, draws, s=S):
    """A row of answer cells labelled A, B, C…; returns the SVG and the next free y."""
    n = len(draws)
    x0 = (W - (n * s + (n - 1) * GAP)) / 2
    out = []
    for k, d in enumerate(draws):
        x = x0 + k * (s + GAP)
        out += [frame(x, y, s), d(x + s / 2, y + s / 2), text(x + s / 2, y + s + 20, 'ABCDE'[k], 17)]
    return ''.join(out), y + s + 38

def problem(y, items, s=S):
    """A row such as  [a] : [b] = [c] : ?  — items are draw functions, ':' / '=' / '→', or '?'."""
    widths = [24 if isinstance(it, str) and it != '?' else s for it in items]
    x = (W - (sum(widths) + GAP * (len(items) - 1))) / 2
    out = []
    for it, w in zip(items, widths):
        if it == '?':
            out += [frame(x, y, s, True), text(x + s / 2, y + s / 2, '?', 30, 600, MID)]
        elif isinstance(it, str):
            out.append(text(x + w / 2, y + s / 2, it, 26, 500))
        else:
            out += [frame(x, y, s), it(x + s / 2, y + s / 2)]
        x += w + GAP
    return ''.join(out), y + s + 22

def save(name, h, body, crop=None):
    os.makedirs(OUT, exist_ok=True)
    w = crop or W  # a lone figure is cut to its own width, so phones show it larger
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{f((W - w) / 2)} 0 {w} {f(h)}" width="{w}" height="{f(h)}" '
           f'font-family="{FONT}">{body}</svg>\n')
    open(os.path.join(OUT, name + '.svg'), 'w', encoding='utf-8', newline='\n').write(svg)

def figure(name, *rows, crop=None):
    """Stack rows (each a function y → (svg, next y)) and save."""
    y, body = 12, ''
    for r in rows:
        svg, y = r(y)
        body += svg
    save(name, y - 6, body, crop)

# ---------- cube nets: roll a cube over the net; a net folds into a cube if every cell gets its own face ----------
ROLL = {  # moving one cell in a direction: which face ends up at the bottom, given faces as D, U, N, S, E, W
    (0, 1): lambda o: {'D': o['E'], 'E': o['U'], 'U': o['W'], 'W': o['D'], 'N': o['N'], 'S': o['S']},
    (0, -1): lambda o: {'D': o['W'], 'W': o['U'], 'U': o['E'], 'E': o['D'], 'N': o['N'], 'S': o['S']},
    (1, 0): lambda o: {'D': o['S'], 'S': o['U'], 'U': o['N'], 'N': o['D'], 'E': o['E'], 'W': o['W']},
    (-1, 0): lambda o: {'D': o['N'], 'N': o['U'], 'U': o['S'], 'S': o['D'], 'E': o['E'], 'W': o['W']},
}
OPP = {'D': 'U', 'U': 'D', 'N': 'S', 'S': 'N', 'E': 'W', 'W': 'E'}

def fold(cells):
    """cells: list of (row, col). Returns {cell: cube face} or None when the net does not fold into a cube."""
    cells = list(cells)
    start = cells[0]
    face = {start: 'D'}
    stack = [(start, {k: k for k in 'DUNSEW'})]
    while stack:
        (r, c), o = stack.pop()
        for d, roll in ROLL.items():
            nb = (r + d[0], c + d[1])
            if nb in cells and nb not in face:
                no = roll(o)
                face[nb] = no['D']
                stack.append((nb, no))
    if len(face) != 6 or len(set(face.values())) != 6:
        return None
    return face

def opposite(cells, labels, of):
    fc = fold(cells)
    assert fc, 'not a cube net'
    lab = dict(zip(cells, labels))
    target = OPP[fc[cells[labels.index(of)]]]
    return next(lab[c] for c in cells if fc[c] == target)

def net(cells, cx, cy, u, labels=None):
    rows = [r for r, _ in cells]; cols = [c for _, c in cells]
    x0 = cx - (max(cols) - min(cols) + 1) * u / 2 - min(cols) * u
    y0 = cy - (max(rows) - min(rows) + 1) * u / 2 - min(rows) * u
    out = ''
    for k, (r, c) in enumerate(cells):
        out += rect(x0 + c * u, y0 + r * u, u, u, '#ffffff', 2)
        if labels:
            out += text(x0 + c * u + u / 2, y0 + r * u + u / 2, labels[k], u * 0.46, 600)
    return out

# ---------- punched paper: unfold by mirroring every hole across each fold line, last fold first ----------
def unfold(holes, folds):
    """holes in unit coordinates (x right, y down); folds: list of ('x', 0.5) / ('y', 0.5) in folding order."""
    pts = set(holes)
    for axis, at in reversed(folds):
        pts |= {(2 * at - x, y) if axis == 'x' else (x, 2 * at - y) for x, y in pts}
    return {(round(x, 3), round(y, 3)) for x, y in pts}

def paper(holes, cx, cy, side=64, folded=None):
    x0, y0 = cx - side / 2, cy - side / 2
    out = rect(x0, y0, side, side, '#ffffff', 2)
    for x, y in holes:
        out += circle(x0 + x * side, y0 + y * side, side * 0.065, INK, 0)
    return out

# ---------- polyline shapes for mirror and rotation tasks ----------
F_SHAPE = [[(0, 4), (0, 0), (3, 0)], [(0, 2), (2, 2)]]            # the letter F
FLAG = [[(0, 4), (0, 0)], [(0, 0), (2.4, 1), (0, 2)]]              # a pole with a flag

def transform(strokes, kind):
    t = {'id': lambda x, y: (x, y), 'mx': lambda x, y: (-x, y), 'my': lambda x, y: (x, -y),
         'r90': lambda x, y: (-y, x), 'r180': lambda x, y: (-x, -y), 'r270': lambda x, y: (y, -x)}[kind]
    return [[t(x, y) for x, y in s] for s in strokes]

def strokes(st, cx, cy, u=12):
    xs = [x for s in st for x, _ in s]; ys = [y for s in st for _, y in s]
    ox = cx - (min(xs) + max(xs)) * u / 2; oy = cy - (min(ys) + max(ys)) * u / 2
    return ''.join(poly([(ox + x * u, oy + y * u) for x, y in s], 'none', 4, close=False) for s in st)

def key(st):
    """Shape identity up to translation, to prove that options really differ."""
    xs = [x for s in st for x, _ in s]; ys = [y for s in st for _, y in s]
    return frozenset(frozenset(((round(x - min(xs), 3), round(y - min(ys), 3)) for x, y in s)) for s in st)

# =====================================================================================================
# 16.1 Analogy and the odd one out
# =====================================================================================================
B = lambda k, r=30, fill='none': (lambda cx, cy: shape(k, cx, cy, r, fill))
figure('16-1a',
       lambda y: problem(y, [B('circle'), ':', B('circle', 14, INK), '=', B('square'), ':', '?']),
       lambda y: options(y, [B('square', 30, INK), B('square', 14), B('square', 14, INK), B('circle', 14, INK), B('square')]))
figure('16-1b',
       lambda y: problem(y, [B('triangle'), ':', B('square'), '=', B('square'), ':', '?']),
       lambda y: options(y, [B('triangle'), B('hexagon'), B('circle'), B('pentagon'), B('square')]))

def with_dots(kind, n):
    return lambda cx, cy: shape(kind, cx, cy, 32) + ring_dots(n, cx, cy + (3 if kind == 'triangle' else 0), 11 if n > 3 else 9)
odd_dots = [('square', 4), ('pentagon', 5), ('triangle', 3), ('square', 3), ('hexagon', 6)]
assert [i for i, (k, n) in enumerate(odd_dots) if SIDES[k] != n] == [3]   # D: the only one whose dots ≠ sides
figure('16-1c', lambda y: options(y, [with_dots(k, n) for k, n in odd_dots]))

def nested(outer, inner):
    return lambda cx, cy: shape(outer, cx, cy, 33) + shape(inner, cx, cy, 14)
odd_nest = [('circle', 'circle'), ('square', 'triangle'), ('square', 'square'), ('triangle', 'triangle'), ('hexagon', 'hexagon')]
assert [i for i, (a, b) in enumerate(odd_nest) if a != b] == [1]           # B
figure('16-1d', lambda y: options(y, [nested(a, b) for a, b in odd_nest]))

# =====================================================================================================
# 16.2 Sequences and matrices
# =====================================================================================================
CORNER = {'TL': (-1, -1), 'TR': (1, -1), 'BR': (1, 1), 'BL': (-1, 1), 'C': (0, 0)}
def dot_in_square(pos):
    def d(cx, cy):
        dx, dy = CORNER[pos]
        return rect(cx - 28, cy - 28, 56, 56) + circle(cx + dx * 17, cy + dy * 17, 7, INK, 0)
    return d
cw = ['TL', 'TR', 'BR', 'BL']
assert cw[3] == 'BL'                                                        # TL → TR → BR → next is BL
figure('16-2a',
       lambda y: problem(y, [dot_in_square('TL'), dot_in_square('TR'), dot_in_square('BR'), '?']),
       lambda y: options(y, [dot_in_square(p) for p in ['TL', 'TR', 'C', 'BL', 'BR']]))

def hand(deg):
    def d(cx, cy):
        a = math.radians(deg - 90)
        return circle(cx, cy, 32) + line(cx, cy, cx + 25 * math.cos(a), cy + 25 * math.sin(a), 3.5) + circle(cx, cy, 3.5, INK, 0)
    return d
assert (90 + 45) == 135                                                     # +45° each step
figure('16-2b',
       lambda y: problem(y, [hand(0), hand(45), hand(90), '?']),
       lambda y: options(y, [hand(a) for a in [180, 135, 270, 315, 0]]))

def counted(kind, n):
    return lambda cx, cy: shape(kind, cx, cy, 30) + dots(n, cx, cy + (4 if kind == 'triangle' else 0), 9, 3.5)
M = [[('circle', 1), ('square', 2), ('triangle', 3)],
     [('square', 3), ('triangle', 1), ('circle', 2)],
     [('triangle', 2), ('circle', 3), None]]
missing = ('square', 1)
full = [row[:2] + [row[2] or missing] for row in M]
for line_ in full + [list(c) for c in zip(*full)]:                          # every row and column: each shape once, each count once
    assert len({k for k, _ in line_}) == 3 and sorted(n for _, n in line_) == [1, 2, 3]

def matrix(cells, s=76):
    def row(y):
        out = ''
        x0 = (W - (3 * s + 2 * GAP)) / 2
        for r in range(3):
            for c in range(3):
                x, yy = x0 + c * (s + GAP), y + r * (s + GAP)
                if cells[r][c] is None:
                    out += frame(x, yy, s, True) + text(x + s / 2, yy + s / 2, '?', 28, 600, MID)
                else:
                    out += frame(x, yy, s) + cells[r][c](x + s / 2, yy + s / 2)
        return out, y + 3 * s + 2 * GAP + 22
    return row
figure('16-2c',
       matrix([[None if x is None else counted(*x) for x in row] for row in M]),
       lambda y: options(y, [counted(*x) for x in [('square', 2), ('circle', 1), ('square', 1), ('triangle', 1), ('square', 3)]]))

def strokes_of(*parts):
    def d(cx, cy):
        out, r = '', 26
        for p in parts:
            if p == '|': out += line(cx, cy - r, cx, cy + r, 3.5)
            if p == '-': out += line(cx - r, cy, cx + r, cy, 3.5)
            if p == '\\': out += line(cx - r * .75, cy - r * .75, cx + r * .75, cy + r * .75, 3.5)
            if p == '/': out += line(cx + r * .75, cy - r * .75, cx - r * .75, cy + r * .75, 3.5)
            if p == 'o': out += circle(cx, cy, 20, 'none', 3.5)
        return out
    return d
OV = [[('|',), ('-',), ('|', '-')], [('\\',), ('/',), ('\\', '/')], [('o',), ('|',), None]]
assert all(set(r[2]) == set(r[0]) | set(r[1]) for r in OV[:2])             # third = first laid over second
figure('16-2d',
       matrix([[None if x is None else strokes_of(*x) for x in row] for row in OV]),
       lambda y: options(y, [strokes_of(*x) for x in [('o', '-'), ('o',), ('|',), ('o', '|', '-'), ('o', '|')]]))

# =====================================================================================================
# 16.3 Counting, joining and splitting
# =====================================================================================================
def count_triangles(cevians):
    """A triangle cut by `cevians` lines from the apex: any two of the base points form one triangle with the apex."""
    k = cevians + 2
    return k * (k - 1) // 2
assert count_triangles(2) == 6 and count_triangles(3) == 10

def fan(cevians, h=170):
    def row(y):
        cx, top, base = W / 2, y + 6, y + 6 + h
        xs = [cx - 150 + 300 * i / (cevians + 1) for i in range(cevians + 2)]
        out = poly([(cx, top), (xs[0], base), (xs[-1], base)], 'none', 3)
        for x in xs[1:-1]:
            out += line(cx, top, x, base, 3)
        return out, base + 20
    return row
figure('16-3a', fan(2), crop=330)
figure('16-q11', fan(3), crop=330)

def square_diagonals(y):
    s, x0 = 170, (W - 170) / 2
    return rect(x0, y + 6, s, s, 'none', 3) + line(x0, y + 6, x0 + s, y + 6 + s, 3) + line(x0 + s, y + 6, x0, y + 6 + s, 3), y + s + 26
figure('16-3b', square_diagonals, crop=210)

def grid2(y):
    s, x0 = 150, (W - 150) / 2
    return (rect(x0, y + 6, s, s, 'none', 3) + line(x0 + s / 2, y + 6, x0 + s / 2, y + 6 + s, 3)
            + line(x0, y + 6 + s / 2, x0 + s, y + 6 + s / 2, 3)), y + s + 26
figure('16-q5', grid2, crop=190)

U = 38
TRI = lambda x, y: [(x, y + U), (x + U, y + U), (x + U, y)]              # right isosceles triangle, legs U
def pieces(y):
    cx = W / 2
    out = poly(TRI(cx - U - 14, y + 4), PALE, 2.5) + poly(TRI(cx + 14, y + 4), PALE, 2.5)
    return out, y + U + 30
def area(ps):
    return abs(sum(ps[i][0] * ps[i - 1][1] - ps[i - 1][0] * ps[i][1] for i in range(len(ps)))) / 2
JOIN = {
    'square': [(0, 0), (U, 0), (U, U), (0, U)],
    'big triangle': [(0, U), (2 * U, U), (U, 0)],
    'parallelogram': [(0, U), (U, U), (2 * U, 0), (U, 0)],
    'rectangle 2×1': [(0, 0), (2 * U, 0), (2 * U, U), (0, U)],
    'diamond': [(U * .7071, 0), (2 * U * .7071, U * .7071), (U * .7071, 2 * U * .7071), (0, U * .7071)],
}
two = 2 * area(TRI(0, 0))
assert [k for k, ps in JOIN.items() if abs(area(ps) - two) > 1] == ['rectangle 2×1']   # D: the only area that differs
def placed(ps):
    def d(cx, cy):
        xs = [x for x, _ in ps]; ys = [y for _, y in ps]
        ox, oy = cx - (min(xs) + max(xs)) / 2, cy - (min(ys) + max(ys)) / 2
        return poly([(ox + x, oy + y) for x, y in ps], PALE, 2.5)
    return d
figure('16-3c', pieces, lambda y: options(y, [placed(JOIN[k]) for k in ['square', 'big triangle', 'parallelogram', 'rectangle 2×1', 'diamond']]))

def cells_shape(cells, u=18):
    def d(cx, cy):
        rows = [r for r, _ in cells]; cols = [c for _, c in cells]
        x0 = cx - (max(cols) + 1) * u / 2; y0 = cy - (max(rows) + 1) * u / 2
        return ''.join(rect(x0 + c * u, y0 + r * u, u, u, PALE, 2) for r, c in cells)
    return d
TETRO = {'I': [(0, 0), (0, 1), (0, 2), (0, 3)], 'L': [(0, 0), (1, 0), (2, 0), (2, 1)], 'T': [(0, 0), (0, 1), (0, 2), (1, 1)],
         'plus': [(0, 1), (1, 0), (1, 1), (1, 2), (2, 1)], 'O': [(0, 0), (0, 1), (1, 0), (1, 1)]}
assert [k for k, v in TETRO.items() if len(v) != 4] == ['plus']              # D
def four_squares(y):
    return cells_shape([(0, 0), (0, 2), (0, 4), (0, 6)], 20)(W / 2, y + 16), y + 46
figure('16-3d', four_squares, lambda y: options(y, [cells_shape(TETRO[k]) for k in ['I', 'L', 'T', 'plus', 'O']]))

# =====================================================================================================
# 16.4 Cube nets
# =====================================================================================================
CROSS = [(0, 1), (1, 0), (1, 1), (1, 2), (2, 1), (3, 1)]
STAIR = [(0, 0), (0, 1), (1, 1), (1, 2), (2, 2), (2, 3)]
assert opposite(CROSS, ['1', '5', '2', '6', '3', '4'], '1') == '3'
assert opposite(STAIR, ['1', '2', '3', '4', '5', '6'], '2') == '5'
def net_row(cells, labels, u=50):
    def row(y):
        rows = [r for r, _ in cells]
        h = (max(rows) + 1) * u
        return net(cells, labels and W / 2, y + h / 2 + 4, u, labels), y + h + 22
    return row
figure('16-4a', net_row(CROSS, ['1', '5', '2', '6', '3', '4']), crop=190)
figure('16-4b', net_row(STAIR, ['1', '2', '3', '4', '5', '6']), crop=240)

NETS_C = [CROSS, [(1, 0), (1, 1), (1, 2), (1, 3), (0, 0), (2, 3)], [(0, 0), (0, 1), (0, 2), (1, 0), (1, 1), (1, 2)], STAIR,
          [(0, 0), (0, 1), (1, 1), (1, 2), (1, 3), (2, 3)]]
NETS_D = [[(0, 0), (0, 1), (0, 2), (1, 1), (2, 1), (3, 1)], [(0, 0), (1, 0), (1, 1), (1, 2), (1, 3), (2, 1)],
          [(0, 1), (1, 0), (1, 1), (1, 2), (1, 3), (2, 0)], [(1, 0), (1, 1), (1, 2), (1, 3), (0, 1), (2, 2)],
          [(1, 0), (1, 1), (1, 2), (1, 3), (0, 1), (0, 2)]]
NETS_Q = [[(0, 2), (1, 0), (1, 1), (1, 2), (2, 2), (3, 2)], [(0, 0), (1, 0), (1, 1), (2, 1), (2, 2), (3, 2)],
          [(1, 0), (1, 1), (1, 2), (1, 3), (0, 3), (2, 3)], [(0, 1), (1, 1), (1, 2), (1, 3), (2, 0), (2, 1)],
          [(0, 1), (1, 0), (1, 1), (1, 2), (2, 2), (2, 3)]]
assert [i for i, n in enumerate(NETS_C) if not fold(n)] == [2]             # C: a 2×3 block
assert [i for i, n in enumerate(NETS_D) if not fold(n)] == [4]             # E: two flaps on the same side, side by side
assert [i for i, n in enumerate(NETS_Q) if not fold(n)] == [0]             # A: a two-face arm overlaps the strip
def net_cell(cells):
    return lambda cx, cy: net(cells, cx, cy, 17)
figure('16-4c', lambda y: options(y, [net_cell(n) for n in NETS_C]))
figure('16-4d', lambda y: options(y, [net_cell(n) for n in NETS_D]))
figure('16-q7', lambda y: options(y, [net_cell(n) for n in NETS_Q]))

Q6_NET = [(0, 0), (1, 0), (1, 1), (1, 2), (1, 3), (2, 1)]
Q6_LAB = ['1', '2', '3', '4', '5', '6']
assert opposite(Q6_NET, Q6_LAB, '5') == '3'
figure('16-q6', net_row(Q6_NET, Q6_LAB, 46), crop=220)

# =====================================================================================================
# 16.5 Symmetry: punched paper and mirror images
# =====================================================================================================
def folded(region, hole):
    """The folded paper (region in unit coordinates) inside the dashed outline of the whole sheet, with the hole."""
    def row(y):
        side, x0, y0 = 150, (W - 150) / 2, y + 6
        (ax, ay), (bx, by) = region
        out = rect(x0, y0, side, side, 'none', 1.8, True, MID)
        out += rect(x0 + ax * side, y0 + ay * side, (bx - ax) * side, (by - ay) * side, PALE, 2.5)
        out += circle(x0 + hole[0] * side, y0 + hole[1] * side, side * 0.06, INK, 0)
        return out, y0 + side + 22
    return row
def sheet(holes):
    return lambda cx, cy: paper(holes, cx, cy)

A5 = unfold([(0.15, 0.65)], [('x', 0.5), ('y', 0.5)])   # right half onto left, then top half onto bottom
assert A5 == {(0.15, 0.65), (0.85, 0.65), (0.15, 0.35), (0.85, 0.35)}
OPT5A = [{(0.15, 0.65), (0.85, 0.65)}, A5, {(0.15, 0.15), (0.85, 0.15), (0.15, 0.85), (0.85, 0.85)},
         {(0.15, 0.65), (0.35, 0.65), (0.15, 0.85), (0.35, 0.85)}, {(0.15, 0.65), (0.85, 0.35), (0.15, 0.35)}]
assert [i for i, o in enumerate(OPT5A) if o == A5] == [1]                  # B
figure('16-5a', folded(((0, 0.5), (0.5, 1)), (0.15, 0.65)), lambda y: options(y, [sheet(o) for o in OPT5A]))

B5 = unfold([(0.7, 0.8)], [('y', 0.5)])                  # top half onto bottom
assert B5 == {(0.7, 0.8), (0.7, 0.2)}
OPT5B = [{(0.7, 0.8), (0.3, 0.8)}, {(0.7, 0.8)}, {(0.7, 0.8), (0.3, 0.2)}, B5, {(0.3, 0.8), (0.3, 0.2)}]
assert [i for i, o in enumerate(OPT5B) if o == B5] == [3]                  # D
figure('16-5b', folded(((0, 0.5), (1, 1)), (0.7, 0.8)), lambda y: options(y, [sheet(o) for o in OPT5B]))

Q8 = unfold([(0.6, 0.3)], [('x', 0.5)])                  # left half onto right
assert Q8 == {(0.6, 0.3), (0.4, 0.3)}
OPTQ8 = [{(0.6, 0.3), (0.6, 0.7)}, {(0.6, 0.3), (0.4, 0.7)}, {(0.6, 0.3)}, {(0.4, 0.3), (0.4, 0.7)}, Q8]
assert [i for i, o in enumerate(OPTQ8) if o == Q8] == [4]                  # E
figure('16-q8', folded(((0.5, 0), (1, 1)), (0.6, 0.3)), lambda y: options(y, [sheet(o) for o in OPTQ8]))

def shaped(st):
    return lambda cx, cy: strokes(st, cx, cy)
def mirror_problem(base, axis):
    def row(y):
        s = S
        if axis == 'v':     # mirror to the right of the shape
            x1 = W / 2 - s - 20
            out = frame(x1, y, s) + strokes(base, x1 + s / 2, y + s / 2)
            out += line(W / 2, y - 4, W / 2, y + s + 4, 2.5, True, MID)
            out += frame(W / 2 + 20, y, s, True) + text(W / 2 + 20 + s / 2, y + s / 2, '?', 30, 600, MID)
            return out, y + s + 22
        x = (W - s) / 2     # mirror (water line) under the shape
        out = frame(x, y, s) + strokes(base, x + s / 2, y + s / 2)
        out += line(x - 30, y + s + 14, x + s + 30, y + s + 14, 2.5, True, MID)
        out += frame(x, y + s + 28, s, True) + text(x + s / 2, y + s + 28 + s / 2, '?', 30, 600, MID)
        return out, y + 2 * s + 50
    return row
KINDS_C = ['id', 'r180', 'mx', 'my', 'r90']
KINDS_D = ['r180', 'my', 'id', 'mx', 'r90']
for base, kinds in ((F_SHAPE, KINDS_C), (FLAG, KINDS_D)):
    assert len({key(transform(base, k)) for k in kinds}) == 5             # five different pictures
assert KINDS_C.index('mx') == 2 and KINDS_D.index('my') == 1               # C (vertical mirror), B (water)
figure('16-5c', mirror_problem(F_SHAPE, 'v'), lambda y: options(y, [shaped(transform(F_SHAPE, k)) for k in KINDS_C]))
figure('16-5d', mirror_problem(FLAG, 'h'), lambda y: options(y, [shaped(transform(FLAG, k)) for k in KINDS_D]))

# ---------- chapter test figures ----------
def fill_pair(outer, inner, outer_black):
    return lambda cx, cy: shape(outer, cx, cy, 33, INK if outer_black else 'none') + \
        (shape(inner, cx, cy, 13, '#ffffff') if outer_black else shape(inner, cx, cy, 13, INK))
figure('16-q1',
       lambda y: problem(y, [fill_pair('triangle', 'circle', True), ':', fill_pair('triangle', 'circle', False), '=',
                             fill_pair('square', 'triangle', True), ':', '?']),
       lambda y: options(y, [fill_pair('square', 'triangle', True), fill_pair('triangle', 'square', False),
                             fill_pair('square', 'triangle', False),
                             lambda cx, cy: shape('square', cx, cy, 33) + shape('triangle', cx, cy, 13),
                             fill_pair('triangle', 'square', True)]))

KINDS_Q2 = ['id', 'r90', 'r180', 'mx', 'r270']
rot = {key(transform(F_SHAPE, k)) for k in ('id', 'r90', 'r180', 'r270')}
assert [i for i, k in enumerate(KINDS_Q2) if key(transform(F_SHAPE, k)) not in rot] == [3]   # D: the mirrored F
figure('16-q2', lambda y: options(y, [shaped(transform(F_SHAPE, k)) for k in KINDS_Q2]))

figure('16-q3',
       lambda y: problem(y, [B('triangle'), B('square'), B('pentagon'), '?']),
       lambda y: options(y, [B('circle'), B('square'), B('heptagon'), B('hexagon'), B('pentagon')]))

def quadrant(*black):
    def d(cx, cy):
        out = ''
        for q, (dx, dy) in {'TL': (-1, -1), 'TR': (0, -1), 'BR': (0, 0), 'BL': (-1, 0)}.items():
            out += rect(cx + dx * 28, cy + dy * 28, 28, 28, INK if q in black else '#ffffff', 2.5)
        return out
    return d
figure('16-q4',
       lambda y: problem(y, [quadrant('TL'), quadrant('TR'), quadrant('BR'), quadrant('BL'), '?']),
       lambda y: options(y, [quadrant('TR'), quadrant('TL'), quadrant('BR'), quadrant('TL', 'BR'), quadrant('BL')]))

SYM = {'triangle': True, 'square': True, 'circle': True, 'F': False, 'rectangle': True}
assert [k for k, v in SYM.items() if not v] == ['F']                       # D
figure('16-q12', lambda y: options(y, [B('triangle', 32), B('square', 30), B('circle', 32), shaped(F_SHAPE),
                                       lambda cx, cy: rect(cx - 34, cy - 20, 68, 40)]))

# =====================================================================================================
# 17.4 Perimeter and area (sides along the grid; labels give only what the reader may use)
# =====================================================================================================
def perimeter(ps):
    return sum(abs(ps[i][0] - ps[i - 1][0]) + abs(ps[i][1] - ps[i - 1][1]) for i in range(len(ps)))

def dimensioned(ps, labels, u=22):
    def row(y):
        xs = [x for x, _ in ps]; ys = [v for _, v in ps]
        ox, oy = (W - (max(xs) - min(xs)) * u) / 2, y + 26
        out = poly([(ox + x * u, oy + v * u) for x, v in ps], PALE, 2.5)
        for x, v, t in labels:
            out += text(ox + x * u, oy + v * u, t, 15, 600)
        return out, oy + (max(ys) - min(ys)) * u + 34
    return row

STAIR_P = [(0, 6), (0, 0), (2, 0), (2, 2), (5, 2), (5, 4), (8, 4), (8, 6)]
L_CUT = [(0, 0), (6, 0), (6, 3), (10, 3), (10, 6), (0, 6)]
NOTCH = [(0, 0), (4, 0), (4, 2), (8, 2), (8, 0), (12, 0), (12, 5), (0, 5)]
assert perimeter(STAIR_P) == 28                                             # = 2 · (8 + 6)
assert area(L_CUT) == 48 and perimeter(L_CUT) == 32                         # 10 · 6 − 4 · 3; a corner cut keeps the perimeter
assert perimeter(NOTCH) == 38 and area(NOTCH) == 52                         # 2 · (12 + 5) + 2 · 2
figure('17-4a', dimensioned(STAIR_P, [(4, 6.75, '8 sm'), (-1.4, 3, '6 sm')]), crop=300)
figure('17-4b', dimensioned(L_CUT, [(5, 6.75, '10 sm'), (-1.4, 3, '6 sm'), (8.6, 2.45, '4 sm'), (7.0, 0.9, '3 sm')]), crop=330)
figure('17-4c', dimensioned(NOTCH, [(6, 5.75, '12 sm'), (-1.4, 2.5, '5 sm'), (6, -0.7, '4 sm'), (5.0, 1, '2 sm')]), crop=360)

# ---------- 16.6 ciphers (text only): the Azerbaijani alphabet and the codes used in the book ----------
AZ = 'ABCÇDEƏFGĞHXIİJKQLMNOÖPRSŞTUÜVYZ'
assert len(AZ) == 32
def shift(word, n):
    return ''.join(AZ[(AZ.index(ch) + n) % 32] for ch in word)
assert shift('BAĞ', 1) == 'CBH' and shift('QAR', 1) == 'LBS' and shift('DAĞ', 2) == 'ƏCX'
def code(words, table):
    return {w: ''.join(str(table[ch]) for ch in w) for w in words}
assert code(['DAM', 'DAŞ', 'ŞAM', 'ŞAD'], {'D': 4, 'A': 1, 'M': 3, 'Ş': 2}) == {'DAM': '413', 'DAŞ': '412', 'ŞAM': '213', 'ŞAD': '214'}
assert code(['SAZ', 'SAL', 'ZAL'], {'S': 6, 'A': 2, 'Z': 8, 'L': 5}) == {'SAZ': '628', 'SAL': '625', 'ZAL': '825'}
assert code(['QAR', 'QAŞ', 'ŞAR'], {'Q': 7, 'A': 1, 'R': 5, 'Ş': 3}) == {'QAR': '715', 'QAŞ': '713', 'ŞAR': '315'}

sys.stdout.reconfigure(encoding='utf-8')
print('figures', len(os.listdir(OUT)), '— all answer checks passed')
