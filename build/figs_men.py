#!/usr/bin/env python3
"""Draws the Məntiq figures into build/fig/men/*.svg (run: python build/figs_men.py).

The geometry behind the answers is computed, not drawn by hand: cube nets are folded, punched paper is unfolded,
mirror images are transformed. The asserts below check every answer the book and the quizzes rely on, so a figure
cannot silently disagree with its question."""
import itertools, json, math, os, sys
from fractions import Fraction

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

# What the question on each figure must answer: the option index when the options are the figure's letters, else the
# right answer as text. Written to answers.json; parse_book.py checks every question that uses the figure against it.
ANSWERS = {}
def answer(name, value):
    ANSWERS[name + '.svg'] = value

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
answer('16-1a', 2)                                                         # C: the small black square
figure('16-1b',
       lambda y: problem(y, [B('triangle'), ':', B('square'), '=', B('square'), ':', '?']),
       lambda y: options(y, [B('triangle'), B('hexagon'), B('circle'), B('pentagon'), B('square')]))

def with_dots(kind, n):
    return lambda cx, cy: shape(kind, cx, cy, 32) + ring_dots(n, cx, cy + (3 if kind == 'triangle' else 0), 11 if n > 3 else 9)
odd_dots = [('square', 4), ('pentagon', 5), ('triangle', 3), ('square', 3), ('hexagon', 6)]
assert [i for i, (k, n) in enumerate(odd_dots) if SIDES[k] != n] == [3]   # D: the only one whose dots ≠ sides
answer('16-1b', 3)                                                         # D: one side more each time
figure('16-1c', lambda y: options(y, [with_dots(k, n) for k, n in odd_dots])); answer('16-1c', 3)

def nested(outer, inner):
    return lambda cx, cy: shape(outer, cx, cy, 33) + shape(inner, cx, cy, 14)
odd_nest = [('circle', 'circle'), ('square', 'triangle'), ('square', 'square'), ('triangle', 'triangle'), ('hexagon', 'hexagon')]
assert [i for i, (a, b) in enumerate(odd_nest) if a != b] == [1]           # B
figure('16-1d', lambda y: options(y, [nested(a, b) for a, b in odd_nest])); answer('16-1d', 1)

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
       lambda y: options(y, [dot_in_square(p) for p in ['TL', 'TR', 'C', 'BL', 'BR']])); answer('16-2a', 3)

def hand(deg):
    def d(cx, cy):
        a = math.radians(deg - 90)
        return circle(cx, cy, 32) + line(cx, cy, cx + 25 * math.cos(a), cy + 25 * math.sin(a), 3.5) + circle(cx, cy, 3.5, INK, 0)
    return d
assert (90 + 45) == 135                                                     # +45° each step
figure('16-2b',
       lambda y: problem(y, [hand(0), hand(45), hand(90), '?']),
       lambda y: options(y, [hand(a) for a in [180, 135, 270, 315, 0]])); answer('16-2b', 1)

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
       lambda y: options(y, [counted(*x) for x in [('square', 2), ('circle', 1), ('square', 1), ('triangle', 1), ('square', 3)]])); answer('16-2c', 2)

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
       lambda y: options(y, [strokes_of(*x) for x in [('o', '-'), ('o',), ('|',), ('o', '|', '-'), ('o', '|')]])); answer('16-2d', 4)

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
figure('16-3a', fan(2), crop=330); answer('16-3a', str(count_triangles(2)))
figure('16-q11', fan(3), crop=330); answer('16-q11', str(count_triangles(3)))

def square_diagonals(y):
    s, x0 = 170, (W - 170) / 2
    return rect(x0, y + 6, s, s, 'none', 3) + line(x0, y + 6, x0 + s, y + 6 + s, 3) + line(x0 + s, y + 6, x0, y + 6 + s, 3), y + s + 26
figure('16-3b', square_diagonals, crop=210); answer('16-3b', '8')   # 4 small and 4 made of two halves

def grid2(y):
    s, x0 = 150, (W - 150) / 2
    return (rect(x0, y + 6, s, s, 'none', 3) + line(x0 + s / 2, y + 6, x0 + s / 2, y + 6 + s, 3)
            + line(x0, y + 6 + s / 2, x0 + s, y + 6 + s / 2, 3)), y + s + 26
figure('16-q5', grid2, crop=190); answer('16-q5', '5')   # 4 small and the whole

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
figure('16-3c', pieces, lambda y: options(y, [placed(JOIN[k]) for k in ['square', 'big triangle', 'parallelogram', 'rectangle 2×1', 'diamond']])); answer('16-3c', 3)

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
figure('16-3d', four_squares, lambda y: options(y, [cells_shape(TETRO[k]) for k in ['I', 'L', 'T', 'plus', 'O']])); answer('16-3d', 3)

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
figure('16-4a', net_row(CROSS, ['1', '5', '2', '6', '3', '4']), crop=190); answer('16-4a', '3')
figure('16-4b', net_row(STAIR, ['1', '2', '3', '4', '5', '6']), crop=240); answer('16-4b', '5')

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
figure('16-4c', lambda y: options(y, [net_cell(n) for n in NETS_C])); answer('16-4c', 2)
figure('16-4d', lambda y: options(y, [net_cell(n) for n in NETS_D])); answer('16-4d', 4)
figure('16-q7', lambda y: options(y, [net_cell(n) for n in NETS_Q])); answer('16-q7', 0)

Q6_NET = [(0, 0), (1, 0), (1, 1), (1, 2), (1, 3), (2, 1)]
Q6_LAB = ['1', '2', '3', '4', '5', '6']
assert opposite(Q6_NET, Q6_LAB, '5') == '3'
figure('16-q6', net_row(Q6_NET, Q6_LAB, 46), crop=220); answer('16-q6', '3')

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
figure('16-5a', folded(((0, 0.5), (0.5, 1)), (0.15, 0.65)), lambda y: options(y, [sheet(o) for o in OPT5A])); answer('16-5a', 1)

B5 = unfold([(0.7, 0.8)], [('y', 0.5)])                  # top half onto bottom
assert B5 == {(0.7, 0.8), (0.7, 0.2)}
OPT5B = [{(0.7, 0.8), (0.3, 0.8)}, {(0.7, 0.8)}, {(0.7, 0.8), (0.3, 0.2)}, B5, {(0.3, 0.8), (0.3, 0.2)}]
assert [i for i, o in enumerate(OPT5B) if o == B5] == [3]                  # D
figure('16-5b', folded(((0, 0.5), (1, 1)), (0.7, 0.8)), lambda y: options(y, [sheet(o) for o in OPT5B])); answer('16-5b', 3)

Q8 = unfold([(0.6, 0.3)], [('x', 0.5)])                  # left half onto right
assert Q8 == {(0.6, 0.3), (0.4, 0.3)}
OPTQ8 = [{(0.6, 0.3), (0.6, 0.7)}, {(0.6, 0.3), (0.4, 0.7)}, {(0.6, 0.3)}, {(0.4, 0.3), (0.4, 0.7)}, Q8]
assert [i for i, o in enumerate(OPTQ8) if o == Q8] == [4]                  # E
figure('16-q8', folded(((0.5, 0), (1, 1)), (0.6, 0.3)), lambda y: options(y, [sheet(o) for o in OPTQ8])); answer('16-q8', 4)

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
figure('16-5c', mirror_problem(F_SHAPE, 'v'), lambda y: options(y, [shaped(transform(F_SHAPE, k)) for k in KINDS_C])); answer('16-5c', 2)
figure('16-5d', mirror_problem(FLAG, 'h'), lambda y: options(y, [shaped(transform(FLAG, k)) for k in KINDS_D])); answer('16-5d', 1)

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
                             fill_pair('triangle', 'square', True)])); answer('16-q1', 2)

KINDS_Q2 = ['id', 'r90', 'r180', 'mx', 'r270']
rot = {key(transform(F_SHAPE, k)) for k in ('id', 'r90', 'r180', 'r270')}
assert [i for i, k in enumerate(KINDS_Q2) if key(transform(F_SHAPE, k)) not in rot] == [3]   # D: the mirrored F
figure('16-q2', lambda y: options(y, [shaped(transform(F_SHAPE, k)) for k in KINDS_Q2])); answer('16-q2', 3)

figure('16-q3',
       lambda y: problem(y, [B('triangle'), B('square'), B('pentagon'), '?']),
       lambda y: options(y, [B('circle'), B('square'), B('heptagon'), B('hexagon'), B('pentagon')])); answer('16-q3', 3)

def quadrant(*black):
    def d(cx, cy):
        out = ''
        for q, (dx, dy) in {'TL': (-1, -1), 'TR': (0, -1), 'BR': (0, 0), 'BL': (-1, 0)}.items():
            out += rect(cx + dx * 28, cy + dy * 28, 28, 28, INK if q in black else '#ffffff', 2.5)
        return out
    return d
figure('16-q4',
       lambda y: problem(y, [quadrant('TL'), quadrant('TR'), quadrant('BR'), quadrant('BL'), '?']),
       lambda y: options(y, [quadrant('TR'), quadrant('TL'), quadrant('BR'), quadrant('TL', 'BR'), quadrant('BL')])); answer('16-q4', 1)

SYM = {'triangle': True, 'square': True, 'circle': True, 'F': False, 'rectangle': True}
assert [k for k, v in SYM.items() if not v] == ['F']                       # D
figure('16-q12', lambda y: options(y, [B('triangle', 32), B('square', 30), B('circle', 32), shaped(F_SHAPE),
                                       lambda cx, cy: rect(cx - 34, cy - 20, 68, 40)])); answer('16-q12', 3)

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
figure('17-4a', dimensioned(STAIR_P, [(4, 6.75, '8 sm'), (-1.4, 3, '6 sm')]), crop=300); answer('17-4a', str(perimeter(STAIR_P)))
figure('17-4b', dimensioned(L_CUT, [(5, 6.75, '10 sm'), (-1.4, 3, '6 sm'), (8.6, 2.45, '4 sm'), (7.0, 0.9, '3 sm')]), crop=330); answer('17-4b', str(int(area(L_CUT))))
figure('17-4c', dimensioned(NOTCH, [(6, 5.75, '12 sm'), (-1.4, 2.5, '5 sm'), (6, -0.7, '4 sm'), (5.0, 1, '2 sm')]), crop=360); answer('17-4c', str(perimeter(NOTCH)))

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

# =====================================================================================================
# 16.7 Cube views: the cube folded from a net, seen from above, from the front-left and the front-right
# =====================================================================================================
# A net is folded printed side out: its first cell becomes the top face, the cell east of it the east face, and so on —
# the mirror image of rolling a cube over the net, which fold() does. The marks look the same after a quarter turn and
# in a mirror, so a view is fixed by the marks on the top, front (south) and right (east) faces.
MARKS = ['dot', 'ring', 'target', 'square', 'hollow', 'four']

def mark(kind):
    ns = ' vector-effect="non-scaling-stroke"'
    if kind == 'dot':
        return f'<circle cx=".5" cy=".5" r=".2" fill="{INK}"/>'
    if kind == 'ring':
        return f'<circle cx=".5" cy=".5" r=".23" fill="none" stroke="{INK}" stroke-width="2.6"{ns}/>'
    if kind == 'target':
        return mark('ring') + f'<circle cx=".5" cy=".5" r=".075" fill="{INK}"/>'
    if kind == 'square':
        return f'<rect x=".3" y=".3" width=".4" height=".4" fill="{INK}"/>'
    if kind == 'hollow':
        return f'<rect x=".29" y=".29" width=".42" height=".42" fill="none" stroke="{INK}" stroke-width="2.6"{ns}/>'
    if kind == 'four':
        return ''.join(f'<circle cx="{x}" cy="{y}" r=".09" fill="{INK}"/>' for x in ('.3', '.7') for y in ('.3', '.7'))
    raise ValueError(kind)

def on_face(o, a, b, kind):
    """A mark on the parallelogram o + u·a + v·b, u and v from 0 to 1."""
    return f'<g transform="matrix({a[0]:.2f} {a[1]:.2f} {b[0]:.2f} {b[1]:.2f} {o[0]:.2f} {o[1]:.2f})">{mark(kind)}</g>'

def iso_cube(top, front, right, e=36):
    """Drawer: a cube seen from above, front-left (south face) and front-right (east face)."""
    def d(cx, cy):
        P = lambda x, y, z: (cx + e * 0.866 * (x + y - 1), cy + e * (0.5 * (x - y) - z + 0.5))
        def face(o, u, v, kind, fill):
            a, b = (u[0] - o[0], u[1] - o[1]), (v[0] - o[0], v[1] - o[1])
            return poly([o, u, (u[0] + b[0], u[1] + b[1]), v], fill, 2.2) + on_face(o, a, b, kind)
        return (face(P(0, 0, 1), P(1, 0, 1), P(0, 1, 1), top, '#ffffff')
                + face(P(0, 0, 0), P(1, 0, 0), P(0, 0, 1), front, '#f2f4f6')
                + face(P(1, 0, 0), P(1, 1, 0), P(1, 0, 1), right, '#e5e8ec'))
    return d

def mark_tile(kind, s=52):
    return lambda cx, cy: rect(cx - s / 2, cy - s / 2, s, s, '#ffffff', 2) + on_face((cx - s / 2, cy - s / 2), (s, 0), (0, s), kind)

def net_marked(cells, labels, u=38):
    """Row: a net with a mark in each cell; cells are (row, col) counted from (0, 0)."""
    def row(y):
        h, w = (max(r for r, _ in cells) + 1) * u, (max(c for _, c in cells) + 1) * u
        x0, y0 = (W - w) / 2, y + 4
        out = ''.join(rect(x0 + c * u, y0 + r * u, u, u, '#ffffff', 2) + on_face((x0 + c * u, y0 + r * u), (u, 0), (0, u), lab)
                      for (r, c), lab in zip(cells, labels))
        return out, y0 + h + 22
    return row

def cubes_row(vs, e=42, gap=44):
    """Row: views of one cube side by side, numbered under them."""
    def row(y):
        cw = 2 * 0.866 * e
        x0 = (W - (len(vs) * cw + (len(vs) - 1) * gap)) / 2
        out = ''
        for k, v in enumerate(vs):
            cx = x0 + k * (cw + gap) + cw / 2
            out += iso_cube(*v, e=e)(cx, y + e + 6) + text(cx, y + 2 * e + 24, str(k + 1), 15, 600, MID)
        return out, y + 2 * e + 44
    return row

def cube_of(cells, labels):
    """The marked cube a net folds into: {face: mark}, faces U, D, N, S, E, W."""
    fc = fold(cells)
    assert fc, 'not a cube net'
    up = {'D': 'U', 'U': 'D'}
    return {up.get(fc[c], fc[c]): lab for c, lab in zip(cells, labels)}

def turn_z(F):  # a quarter turn about the vertical axis: the north face goes east
    return {'U': F['U'], 'D': F['D'], 'E': F['N'], 'S': F['E'], 'W': F['S'], 'N': F['W']}
def turn_x(F):  # a quarter turn about the east-west axis: the top face goes north
    return {'E': F['E'], 'W': F['W'], 'N': F['U'], 'D': F['N'], 'S': F['D'], 'U': F['S']}
def orbit(F):
    seen, todo = {}, [F]
    while todo:
        G = todo.pop()
        k = tuple(sorted(G.items()))
        if k not in seen:
            seen[k] = G
            todo += [turn_z(G), turn_x(G)]
    return list(seen.values())
def views(F):
    return {(G['U'], G['S'], G['E']) for G in orbit(F)}
CUBES = [dict(zip('UDNSEW', p)) for p in itertools.permutations(MARKS)]
CUBE_VIEWS = [views(F) for F in CUBES]
def fits(given):
    """Every marked cube that can show all the given views (a cube counts once per position, 24 times)."""
    return [F for F, vs in zip(CUBES, CUBE_VIEWS) if all(v in vs for v in given)]
def opp_of(F, m):
    return F[OPP[next(p for p, x in F.items() if x == m)]]
def why_not(F, v):
    if v in views(F):
        return 'ok'
    t, l, r = v
    return 'opp' if opp_of(F, t) in (l, r) or opp_of(F, l) == r else 'mirror'
def opposite_question(F, given, x, marks):
    """The views must fix the face opposite x; returns its index among `marks` (the options)."""
    found = {opp_of(G, x) for G in fits(given)}
    assert found == {opp_of(F, x)} and all(v in views(F) for v in given), found
    return marks.index(found.pop())

# the hand-checked case: the cross folded with its centre on top; the corner top-front-right reads dot, hollow, four
CROSS_M = [(1, 1), (0, 1), (1, 0), (1, 2), (2, 1), (3, 1)]
LAB_A = ['dot', 'ring', 'square', 'four', 'hollow', 'target']
FA = cube_of(CROSS_M, LAB_A)
assert FA == {'U': 'dot', 'N': 'ring', 'W': 'square', 'E': 'four', 'S': 'hollow', 'D': 'target'}
assert len(orbit(FA)) == 24 and ('dot', 'hollow', 'four') in views(FA) and ('dot', 'four', 'hollow') not in views(FA)
NET_B, LAB_B = [(1, 0), (0, 0), (1, 1), (1, 2), (1, 3), (2, 2)], ['ring', 'four', 'dot', 'hollow', 'square', 'target']
NET_C, LAB_C = [(0, 0), (0, 1), (1, 1), (1, 2), (1, 3), (2, 3)], ['square', 'target', 'ring', 'dot', 'four', 'hollow']
NET_D, LAB_D = [(0, 1), (1, 0), (1, 1), (1, 2), (1, 3), (2, 1)], ['hollow', 'dot', 'four', 'target', 'ring', 'square']
FB, FC, FD = cube_of(NET_B, LAB_B), cube_of(NET_C, LAB_C), cube_of(NET_D, LAB_D)

def cube_choice(name, cells, labels, F, opts, why):
    assert [why_not(F, v) for v in opts] == why, [why_not(F, v) for v in opts]
    figure(name, net_marked(cells, labels), lambda y: options(y, [iso_cube(*v) for v in opts], 94))
    good = [i for i, w in enumerate(why) if w == 'ok']
    answer(name, good[0] if len(good) == 1 else next(i for i, w in enumerate(why) if w != 'ok'))

cube_choice('16-7a', CROSS_M, LAB_A, FA,                                     # which cube: C
            [('ring', 'hollow', 'dot'), ('dot', 'four', 'hollow'), ('square', 'dot', 'ring'), ('four', 'square', 'dot'), ('square', 'dot', 'hollow')],
            ['opp', 'mirror', 'ok', 'opp', 'mirror'])
cube_choice('16-7b', NET_B, LAB_B, FB,                                       # which cube can not be: D
            [('dot', 'four', 'ring'), ('hollow', 'square', 'four'), ('ring', 'square', 'target'), ('square', 'target', 'hollow'), ('target', 'hollow', 'dot')],
            ['ok', 'ok', 'ok', 'mirror', 'ok'])
def cube_opposite(name, F, given, x, marks):
    figure(name, cubes_row(given), lambda y: options(y, [mark_tile(m) for m in marks]))
    answer(name, opposite_question(F, given, x, marks))
cube_opposite('16-7c', FA, [('dot', 'four', 'ring'), ('dot', 'square', 'hollow')], 'dot', ['ring', 'four', 'target', 'square', 'hollow'])
cube_opposite('16-7d', FC, [('dot', 'ring', 'hollow'), ('ring', 'target', 'square')], 'ring', ['dot', 'target', 'square', 'hollow', 'four'])
cube_choice('16-q13', NET_D, LAB_D, FD,
            [('four', 'dot', 'ring'), ('four', 'square', 'target'), ('hollow', 'target', 'four'), ('hollow', 'dot', 'square'), ('four', 'square', 'dot')],
            ['opp', 'ok', 'mirror', 'opp', 'mirror'])
cube_choice('16-q14', NET_C, LAB_C, FC,
            [('target', 'dot', 'ring'), ('square', 'ring', 'target'), ('four', 'target', 'dot'), ('hollow', 'ring', 'square'), ('ring', 'dot', 'target')],
            ['mirror', 'ok', 'ok', 'ok', 'ok'])
cube_opposite('16-q15', FB, [('four', 'square', 'ring'), ('square', 'hollow', 'target')], 'square', ['ring', 'target', 'hollow', 'dot', 'four'])
# another view of the cube shown twice: the right option fits every cube with both views, the others fit none
GIVEN16 = [('dot', 'four', 'target'), ('dot', 'ring', 'hollow')]
OPT16 = [('dot', 'target', 'four'), ('four', 'ring', 'dot'), ('square', 'dot', 'ring'), ('square', 'target', 'four'), ('target', 'hollow', 'ring')]
FITS16 = fits(GIVEN16)
assert len(FITS16) == 24 and all(v in views(FC) for v in GIVEN16)
assert [i for i, v in enumerate(OPT16) if all(v in views(G) for G in FITS16)] == [3]
assert [i for i, v in enumerate(OPT16) if all(v not in views(G) for G in FITS16)] == [0, 1, 2, 4]
assert [why_not(FC, v) for v in OPT16] == ['mirror', 'opp', 'opp', 'ok', 'opp']
figure('16-q16', cubes_row(GIVEN16), lambda y: options(y, [iso_cube(*v) for v in OPT16], 94)); answer('16-q16', 3)
figure('16-q17', cubes_row([('ring', 'dot', 'hollow'), ('ring', 'target', 'square'), ('hollow', 'ring', 'dot')], e=38, gap=34),
       lambda y: options(y, [mark_tile(m) for m in ['square', 'four', 'dot', 'target', 'hollow']]))
answer('16-q17', opposite_question(FD, [('ring', 'dot', 'hollow'), ('ring', 'target', 'square'), ('hollow', 'ring', 'dot')], 'ring',
                                   ['square', 'four', 'dot', 'target', 'hollow']))
cube_opposite('16-q18', FD, [('dot', 'four', 'hollow'), ('square', 'dot', 'ring')], 'dot', ['target', 'ring', 'square', 'hollow', 'four'])

# =====================================================================================================
# 16.8 Joining parts in the mind: pieces may be turned; every answer is the same whether or not they may be flipped
# =====================================================================================================
def cells_of(*rows):
    return [(r, c) for r, line in enumerate(rows) for c, ch in enumerate(line) if ch == '#']
def norm_cells(cells):
    r0, c0 = min(r for r, _ in cells), min(c for _, c in cells)
    return tuple(sorted((r - r0, c - c0) for r, c in cells))
def turns(cells, flips=False):
    out, cur = set(), list(cells)
    for _ in range(4):
        cur = [(c, -r) for r, c in cur]
        out.add(norm_cells(cur))
        if flips:
            out.add(norm_cells([(r, -c) for r, c in cur]))
    return out
def tilings(target, pieces, flips=False):
    """In how many ways the pieces, each used once and turned (and flipped if `flips`), cover the target exactly."""
    if sum(len(p) for p in pieces) != len(target):
        return 0
    forms = [sorted(turns(p, flips)) for p in pieces]
    def go(free, used):
        if not free:
            return 1
        cell, n = min(free), 0
        for i, fs in enumerate(forms):
            if i not in used:
                for fm in fs:
                    placed = {(cell[0] + r - fm[0][0], cell[1] + c - fm[0][1]) for r, c in fm}
                    if placed <= free:
                        n += go(free - placed, used | {i})
        return n
    return go(frozenset(target), frozenset())
def one_tiling(target, pieces):
    """A tiling as {cell: piece index} (for writing the explanation)."""
    forms = [sorted(turns(p)) for p in pieces]
    def go(free, used, got):
        if not free:
            return got
        cell = min(free)
        for i, fs in enumerate(forms):
            if i not in used:
                for fm in fs:
                    placed = {(cell[0] + r - fm[0][0], cell[1] + c - fm[0][1]) for r, c in fm}
                    if placed <= free:
                        hit = go(free - placed, used | {i}, {**got, **{p: i for p in placed}})
                        if hit:
                            return hit
        return None
    return go(frozenset(target), frozenset(), {})

def cells_draw(cells, u=16, fill=PALE):
    def d(cx, cy):
        rows, cols = [r for r, _ in cells], [c for _, c in cells]
        x0 = cx - (min(cols) + max(cols) + 1) * u / 2
        y0 = cy - (min(rows) + max(rows) + 1) * u / 2
        return ''.join(rect(x0 + c * u, y0 + r * u, u, u, fill, 2) for r, c in cells)
    return d
def pieces_row(pieces, u=28):
    """Row: the pieces with plus signs between them."""
    def row(y):
        ws = [(max(c for _, c in p) + 1) * u for p in pieces]
        h = max((max(r for r, _ in p) + 1) * u for p in pieces)
        x = (W - (sum(ws) + 56 * (len(pieces) - 1))) / 2
        out = ''
        for k, (p, w) in enumerate(zip(pieces, ws)):
            out += cells_draw(p, u)(x + w / 2, y + 6 + h / 2)
            x += w
            if k + 1 < len(pieces):
                out += text(x + 28, y + 6 + h / 2, '+', 28, 500)
                x += 56
        return out, y + h + 34
    return row
def holed(*rows, u=32):
    """Row: '#' a cell of the figure, 'o' an empty cell to be filled (dashed)."""
    def row(y):
        w = max(len(r) for r in rows)
        x0, y0 = (W - w * u) / 2, y + 6
        cells = [(r, c, ch) for r, line in enumerate(rows) for c, ch in enumerate(line)]
        out = ''.join(rect(x0 + c * u, y0 + r * u, u, u, PALE, 2.2) for r, c, ch in cells if ch == '#')
        out += ''.join(rect(x0 + c * u, y0 + r * u, u, u, '#ffffff', 1.6, True, MID) for r, c, ch in cells if ch == 'o')
        return out, y0 + len(rows) * u + 24
    return row
def pair_draw(a, b, u=14):
    """Drawer: two pieces, one above the other."""
    def d(cx, cy):
        ha, hb = (max(r for r, _ in a) + 1) * u, (max(r for r, _ in b) + 1) * u
        y = cy - (ha + hb + 8) / 2
        return cells_draw(a, u)(cx, y + ha / 2) + cells_draw(b, u)(cx, y + ha + 8 + hb / 2)
    return d

P5 = {'F': cells_of('.##', '##.', '.#.'), 'I': cells_of('#####'), 'L': cells_of('#...', '####'), 'N': cells_of('##..', '.###'),
      'P': cells_of('##', '##', '#.'), 'T': cells_of('###', '.#.', '.#.'), 'U': cells_of('#.#', '###'), 'V': cells_of('#..', '#..', '###'),
      'W': cells_of('#..', '##.', '.##'), 'X': cells_of('.#.', '###', '.#.'), 'Y': cells_of('.#..', '####'), 'Z': cells_of('##.', '.#.', '.##')}
T4 = {'I': cells_of('####'), 'O': cells_of('##', '##'), 'T': cells_of('###', '.#.'), 'L': cells_of('#..', '###'), 'S': cells_of('.##', '##.')}
assert len({min(map(norm_cells, turns(p, True))) for p in P5.values()}) == 12   # twelve different pentominoes

def joined(name, pieces, shapes, good):
    """Which shape the pieces make: only `good`, and flipping would not make another one possible."""
    assert [i for i, t in enumerate(shapes) if tilings(t, pieces)] == [good]
    assert [i for i, t in enumerate(shapes) if tilings(t, pieces, True)] == [good]
    figure(name, pieces_row(pieces), lambda y: options(y, [cells_draw(t) for t in shapes]))
    answer(name, good)
def missing(name, rows, pieces, good):
    """Which piece fills the dashed cells: the right one only after a turn, and no other one even if flipped."""
    hole = norm_cells([(r, c) for r, line in enumerate(rows) for c, ch in enumerate(line) if ch == 'o'])
    assert [i for i, p in enumerate(pieces) if hole in turns(p)] == [good]
    assert [i for i, p in enumerate(pieces) if hole in turns(p, True)] == [good]
    assert norm_cells(pieces[good]) != hole                                     # it is drawn turned
    figure(name, holed(*rows), lambda y: options(y, [cells_draw(p) for p in pieces]))
    answer(name, good)

joined('16-8a', [P5['P'], T4['L']], [cells_of('.#..', '####', '####'), cells_of('##..', '###.', '####'), cells_of('###.', '####', '.#.#'),
                                     cells_of('#..', '###', '###', '#.#'), cells_of('###', '#.#', '#.#', '.##')], 1)
joined('16-8b', [P5['V'], T4['O']], [cells_of('##.#', '####', '#..#'), cells_of('#.##', '####', '##..'), cells_of('####', '##.#', '##..'),
                                     cells_of('.##', '.##', '###', '.##'), cells_of('###.', '#.##', '#.##')], 4)
missing('16-8c', ['oo##', '#ooo', '####', '####'],
        [cells_of('#...', '####'), cells_of('.#', '##', '#.', '#.'), cells_of('.#..', '####'), P5['W'], P5['Z']], 1)
missing('16-8d', ['#####', '#oooo', '##o##'],
        [P5['P'], P5['V'], P5['T'], cells_of('#.', '#.', '##', '#.'), P5['L']], 3)
joined('16-q19', [T4['T'], T4['L']], [cells_of('###', '#.#', '..#', '.##'), cells_of('.#.', '###', '#..', '###'), cells_of('..#.', '####', '#.##'),
                                      cells_of('##..', '####', '..##'), cells_of('####', '#..#', '..##')], 1)
joined('16-q20', [P5['U'], T4['T']], [cells_of('#.##', '####', '..##'), cells_of('##.', '.##', '###', '##.'), cells_of('###.', '.###', '##.#'),
                                      cells_of('###', '###', '.##', '.#.'), cells_of('#.#', '#.#', '#.#', '###')], 3)
missing('16-q21', ['#####', '##oo#', '#ooo#', '#####'],
        [P5['L'], P5['Y'], cells_of('#.', '##', '##'), P5['N'], P5['V']], 2)
SQ3 = cells_of('###', '###', '###')
PAIRS22 = [(P5['Y'], T4['T']), (P5['L'], T4['S']), (P5['P'], T4['L']), (P5['W'], T4['L']), (P5['T'], T4['L'])]
assert [i for i, pr in enumerate(PAIRS22) if tilings(SQ3, list(pr))] == [2]
assert [i for i, pr in enumerate(PAIRS22) if tilings(SQ3, list(pr), True)] == [2]
figure('16-q22', lambda y: (cells_draw(SQ3, 30)(W / 2, y + 51), y + 116), lambda y: options(y, [pair_draw(a, b) for a, b in PAIRS22], 96))
answer('16-q22', 2)

# =====================================================================================================
# More figures for 16.1–16.5: analogies, odd ones out, sequences, matrices, counting, nets, folding, mirrors
# =====================================================================================================
def arrow(deg, fill='#ffffff', s=27):
    """Drawer: an arrow pointing at `deg` degrees (0 = up, clockwise)."""
    def d(cx, cy):
        base = [(0, -s), (s * .6, -s * .05), (s * .22, -s * .05), (s * .22, s), (-s * .22, s), (-s * .22, -s * .05), (-s * .6, -s * .05)]
        a = math.radians(deg)
        return poly([(cx + x * math.cos(a) - y * math.sin(a), cy + x * math.sin(a) + y * math.cos(a)) for x, y in base], fill, 2.2)
    return d
# 16.1: each step turns the arrow 90° clockwise and swaps black and white
A_RULE = lambda deg, fill: ((deg + 90) % 360, INK if fill == '#ffffff' else '#ffffff')
assert A_RULE(0, '#ffffff') == (90, INK) and A_RULE(270, '#ffffff') == (0, INK)
figure('16-q23', lambda y: problem(y, [arrow(0), ':', arrow(90, INK), '=', arrow(270), ':', '?']),
       lambda y: options(y, [arrow(0), arrow(180, INK), arrow(270, INK), arrow(0, INK), arrow(90)])); answer('16-q23', 3)
# outer and inner shapes change places
figure('16-q24', lambda y: problem(y, [nested('circle', 'square'), ':', nested('square', 'circle'), '=', nested('triangle', 'hexagon'), ':', '?']),
       lambda y: options(y, [nested('triangle', 'hexagon'), nested('hexagon', 'hexagon'), nested('square', 'triangle'),
                             nested('triangle', 'triangle'), nested('hexagon', 'triangle')])); answer('16-q24', 4)
# big and white becomes small and black
figure('16-q25', lambda y: problem(y, [B('triangle', 32), ':', B('triangle', 15, INK), '=', B('hexagon', 32), ':', '?']),
       lambda y: options(y, [B('hexagon', 32, INK), B('hexagon', 15, INK), B('hexagon', 15), B('triangle', 15, INK), B('pentagon', 15, INK)]))
answer('16-q25', 1)
# odd one out: four turns of the flag and one mirror image
KINDS26 = ['r90', 'mx', 'id', 'r270', 'r180']
rot_flag = {key(transform(FLAG, k)) for k in ('id', 'r90', 'r180', 'r270')}
assert len({key(transform(FLAG, k)) for k in KINDS26}) == 5
assert [i for i, k in enumerate(KINDS26) if key(transform(FLAG, k)) not in rot_flag] == [1]
figure('16-q26', lambda y: options(y, [shaped(transform(FLAG, k)) for k in KINDS26])); answer('16-q26', 1)
# odd one out: four turns of an L made of four squares and one mirror image (a J)
L4 = cells_of('#.', '#.', '##')
L4_TURNS = sorted(turns(L4))
J4 = norm_cells([(r, -c) for r, c in L4])
OPT27 = [L4_TURNS[0], L4_TURNS[1], L4_TURNS[2], L4_TURNS[3], J4]
assert len(set(OPT27)) == 5 and J4 not in turns(L4)
assert [i for i, o in enumerate(OPT27) if o not in turns(L4)] == [4]
figure('16-q27', lambda y: options(y, [cells_draw(o, 18) for o in OPT27])); answer('16-q27', 4)

# 16.2: a black cell walks round the edge of a 3×3 board, three cells clockwise at a time
EDGE = [(0, 0), (0, 1), (0, 2), (1, 2), (2, 2), (2, 1), (2, 0), (1, 0)]
WALK = [EDGE[3 * k % 8] for k in range(5)]
assert WALK == [(0, 0), (1, 2), (2, 0), (0, 1), (2, 2)]
def board(cell, u=20):
    def d(cx, cy):
        x0, y0 = cx - 1.5 * u, cy - 1.5 * u
        return ''.join(rect(x0 + c * u, y0 + r * u, u, u, INK if (r, c) == cell else '#ffffff', 1.8) for r in range(3) for c in range(3))
    return d
OPT28 = [(2, 1), (1, 0), (2, 2), (0, 2), (1, 1)]
figure('16-q28', lambda y: problem(y, [board(c) for c in WALK[:4]] + ['?']), lambda y: options(y, [board(c) for c in OPT28]))
answer('16-q28', OPT28.index(WALK[4]))
# arrows turn 45° anticlockwise each step, white and black in turn
SEQ29 = [(0, '#ffffff'), (315, INK), (270, '#ffffff')]
NEXT29 = (225, INK)
assert all((SEQ29[k][0] - 45) % 360 == SEQ29[k + 1][0] for k in range(2)) and NEXT29[0] == (SEQ29[-1][0] - 45) % 360
OPT29 = [(225, '#ffffff'), (180, INK), (135, INK), (225, INK), (270, INK)]
figure('16-q29', lambda y: problem(y, [arrow(*a) for a in SEQ29] + ['?']), lambda y: options(y, [arrow(*a) for a in OPT29]))
answer('16-q29', OPT29.index(NEXT29))
# one side fewer each step, black and white in turn
SEQ30 = [('hexagon', INK), ('pentagon', 'none'), ('square', INK)]
OPT30 = [('triangle', INK), ('square', 'none'), ('triangle', 'none'), ('circle', 'none'), ('pentagon', INK)]
assert [SIDES[k] for k, _ in SEQ30] == [6, 5, 4]
figure('16-q30', lambda y: problem(y, [B(k, 30, fl) for k, fl in SEQ30] + ['?']), lambda y: options(y, [B(k, 30, fl) for k, fl in OPT30]))
answer('16-q30', OPT30.index(('triangle', 'none')))
# staircases of 1, 3, 6 squares: the next has 4 steps, 10 squares
def stairs(n):
    return [(r, c) for r in range(n) for c in range(r + 1)]
OPT31 = [stairs(5), cells_of('#####', '#####'), [x for x in stairs(4) if x != (0, 0)], stairs(4), stairs(3)]
assert [len(o) for o in OPT31] == [15, 10, 9, 10, 6]
figure('16-q31', lambda y: problem(y, [cells_draw(stairs(n), 13) for n in (1, 2, 3)] + ['?']), lambda y: options(y, [cells_draw(o, 13) for o in OPT31]))
answer('16-q31', 3)
# a 3×3 matrix: every row and every column has each shape once and each colour once
GREY = '#9aa1a9'
M32 = [[('circle', '#ffffff'), ('square', GREY), ('triangle', INK)],
       [('square', INK), ('triangle', '#ffffff'), ('circle', GREY)],
       [('triangle', GREY), ('circle', INK), None]]
MISS32 = ('square', '#ffffff')
full32 = [row[:2] + [row[2] or MISS32] for row in M32]
for line_ in full32 + [list(c) for c in zip(*full32)]:
    assert len({k for k, _ in line_}) == 3 and len({fl for _, fl in line_}) == 3
OPT32 = [('square', INK), ('circle', '#ffffff'), ('square', GREY), MISS32, ('triangle', '#ffffff')]
figure('16-q32', matrix([[None if x is None else B(x[0], 24, x[1]) for x in row] for row in M32]),
       lambda y: options(y, [B(k, 26, fl) for k, fl in OPT32])); answer('16-q32', 3)
# a matrix where the third picture keeps the lines that appear in only one of the first two
X33 = [[('|', '-'), ('-', '/'), ('|', '/')], [('\\', 'o'), ('o', '-'), ('\\', '-')], [('|', '\\'), ('\\', '/'), None]]
for r in X33[:2]:
    assert set(r[2]) == set(r[0]) ^ set(r[1])
NEXT33 = set(X33[2][0]) ^ set(X33[2][1])
OPT33 = [('|', '\\', '/'), ('|', '/'), ('\\',), ('|',), ('/', '-')]
assert [i for i, o in enumerate(OPT33) if set(o) == NEXT33] == [1]
figure('16-q33', matrix([[None if x is None else strokes_of(*x) for x in row] for row in X33]), lambda y: options(y, [strokes_of(*o) for o in OPT33]))
answer('16-q33', 1)
# dots: the third picture in each row has as many as the first two together
D34 = [[1, 2, 3], [2, 2, 4], [3, 1, None]]
assert all(r[0] + r[1] == r[2] for r in D34[:2])
OPT34 = [2, 3, 4, 5, 6]
figure('16-q34', matrix([[None if n is None else counted('circle', n) for n in row] for row in D34]),
       lambda y: options(y, [counted('circle', n) for n in OPT34])); answer('16-q34', OPT34.index(D34[2][0] + D34[2][1]))

# 16.3: counting — every count below comes from the drawing's own lines
def count_tri(segs):
    """Triangles whose three sides lie on the drawn segments (corners: ends and crossings)."""
    segs = [((Fraction(a), Fraction(b)), (Fraction(c), Fraction(d))) for (a, b), (c, d) in segs]
    def cross(s, t):
        (x1, y1), (x2, y2) = s
        (x3, y3), (x4, y4) = t
        den = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3)
        if den == 0:
            return None
        u = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / den
        v = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / den
        return (x1 + u * (x2 - x1), y1 + u * (y2 - y1)) if 0 <= u <= 1 and 0 <= v <= 1 else None
    pts = {p for s in segs for p in s} | {p for s, t in itertools.combinations(segs, 2) for p in [cross(s, t)] if p}
    def on(p, s):
        (x1, y1), (x2, y2) = s
        return ((x2 - x1) * (p[1] - y1) == (y2 - y1) * (p[0] - x1)
                and min(x1, x2) <= p[0] <= max(x1, x2) and min(y1, y2) <= p[1] <= max(y1, y2))
    side = lambda p, q: any(on(p, s) and on(q, s) for s in segs)
    return sum(1 for a, b, c in itertools.combinations(pts, 3)
               if (b[0] - a[0]) * (c[1] - a[1]) != (b[1] - a[1]) * (c[0] - a[0]) and side(a, b) and side(b, c) and side(a, c))
def fan_segs(cevians):
    xs = [Fraction(i, cevians + 1) for i in range(cevians + 2)]
    return [((Fraction(1, 2), 0), (0, 1)), ((Fraction(1, 2), 0), (1, 1)), ((0, 1), (1, 1))] + [((Fraction(1, 2), 0), (x, 1)) for x in xs[1:-1]]
SQUARE = [((0, 0), (1, 0)), ((1, 0), (1, 1)), ((1, 1), (0, 1)), ((0, 1), (0, 0))]
assert count_tri(fan_segs(2)) == count_triangles(2) == 6 and count_tri(fan_segs(3)) == 10
assert count_tri(SQUARE + [((0, 0), (1, 1)), ((1, 0), (0, 1))]) == 8
JACK = SQUARE + [((0, 0), (1, 1)), ((1, 0), (0, 1)), ((Fraction(1, 2), 0), (Fraction(1, 2), 1)), ((0, Fraction(1, 2)), (1, Fraction(1, 2)))]
N_JACK = count_tri(JACK)
def seg_figure(segs, s=170):
    def row(y):
        x0, y0 = (W - s) / 2, y + 6
        return ''.join(line(x0 + float(a) * s, y0 + float(b) * s, x0 + float(c) * s, y0 + float(d) * s, 3) for (a, b), (c, d) in segs), y0 + s + 24
    return row
figure('16-q35', seg_figure(JACK), crop=220); answer('16-q35', str(N_JACK))
def grid_lines(rows, cols, u=50):
    def row(y):
        x0, y0 = (W - cols * u) / 2, y + 6
        out = ''.join(line(x0, y0 + r * u, x0 + cols * u, y0 + r * u, 3) for r in range(rows + 1))
        out += ''.join(line(x0 + c * u, y0, x0 + c * u, y0 + rows * u, 3) for c in range(cols + 1))
        return out, y0 + rows * u + 24
    return row
def count_rects(rows, cols, squares=False):
    return sum(1 for r1, r2 in itertools.combinations(range(rows + 1), 2) for c1, c2 in itertools.combinations(range(cols + 1), 2)
               if not squares or r2 - r1 == c2 - c1)
assert count_rects(2, 2, True) == 5                                            # 16-q5
figure('16-q36', grid_lines(3, 3), crop=210); answer('16-q36', str(count_rects(3, 3, True)))
assert count_rects(3, 3, True) == 14
figure('16-q37', grid_lines(1, 4, 56), crop=280); answer('16-q37', str(count_rects(1, 4)))
assert count_rects(1, 4) == 10
figure('16-q38', fan(4), crop=330); answer('16-q38', str(count_tri(fan_segs(4))))
assert count_tri(fan_segs(4)) == count_triangles(4) == 15

# 16.4: nets — exactly one of these folds into a cube
NETS39 = [[(0, 0), (0, 1), (0, 2), (1, 0), (1, 1), (1, 2)], [(0, 0), (0, 1), (0, 2), (0, 3), (0, 4), (1, 2)],
          [(1, 0), (1, 1), (1, 2), (1, 3), (0, 1), (0, 2)], [(0, 0), (1, 0), (1, 1), (1, 2), (2, 2), (2, 3)],
          [(0, 0), (0, 1), (1, 1), (1, 2), (2, 2), (3, 2)]]
assert [i for i, n in enumerate(NETS39) if fold(n)] == [3]
figure('16-q39', lambda y: options(y, [net_cell(n) for n in NETS39])); answer('16-q39', 3)
# a numbered net: the largest sum of two opposite faces
NET40 = [(0, 0), (0, 1), (1, 1), (1, 2), (1, 3), (2, 3)]
LAB40 = ['2', '6', '1', '5', '3', '4']
SUMS40 = {int(a) + int(opposite(NET40, LAB40, a)) for a in LAB40}
figure('16-q40', net_row(NET40, LAB40, 46), crop=240); answer('16-q40', str(max(SUMS40)))

# 16.5: punched paper folded twice, then mirror images
Q41 = unfold([(0.75, 0.7)], [('y', 0.5), ('x', 0.5)])          # top half onto bottom, then left half onto right
assert Q41 == {(0.75, 0.7), (0.25, 0.7), (0.75, 0.3), (0.25, 0.3)}
OPT41 = [{(0.75, 0.7), (0.25, 0.7)}, {(0.75, 0.7), (0.25, 0.3), (0.75, 0.3), (0.25, 0.7)}, {(0.75, 0.7), (0.75, 0.3)},
         {(0.75, 0.7), (0.25, 0.7), (0.75, 0.1), (0.25, 0.1)}, {(0.25, 0.3), (0.75, 0.7)}]
assert [i for i, o in enumerate(OPT41) if o == Q41] == [1]
figure('16-q41', folded(((0.5, 0.5), (1, 1)), (0.75, 0.7)), lambda y: options(y, [sheet(o) for o in OPT41])); answer('16-q41', 1)
Q42 = unfold([(0.3, 0.9)], [('y', 0.5), ('y', 0.75)])          # folded in four as a strip: top onto bottom twice
assert Q42 == {(0.3, 0.9), (0.3, 0.6), (0.3, 0.4), (0.3, 0.1)}
OPT42 = [{(0.3, 0.9), (0.3, 0.1)}, {(0.3, 0.9), (0.3, 0.6)}, {(0.3, 0.9), (0.7, 0.9), (0.3, 0.1), (0.7, 0.1)},
         {(0.3, 0.9), (0.3, 0.7), (0.3, 0.5), (0.3, 0.3)}, Q42]
assert [i for i, o in enumerate(OPT42) if o == Q42] == [4]
figure('16-q42', folded(((0, 0.75), (1, 1)), (0.3, 0.9)), lambda y: options(y, [sheet(o) for o in OPT42])); answer('16-q42', 4)
KINDS43 = ['mx', 'r180', 'my', 'id', 'r90']
assert len({key(transform(F_SHAPE, k)) for k in KINDS43}) == 5
figure('16-q43', mirror_problem(F_SHAPE, 'h'), lambda y: options(y, [shaped(transform(F_SHAPE, k)) for k in KINDS43]))
answer('16-q43', KINDS43.index('my'))
R_SHAPE = [[(0, 4), (0, 0), (2, 0), (2, 2), (0, 2)], [(0.8, 2), (2.2, 4)]]   # a letter R
KINDS44 = ['r180', 'id', 'my', 'r90', 'mx']
assert len({key(transform(R_SHAPE, k)) for k in KINDS44}) == 5
figure('16-q44', mirror_problem(R_SHAPE, 'v'), lambda y: options(y, [shaped(transform(R_SHAPE, k)) for k in KINDS44]))
answer('16-q44', KINDS44.index('mx'))

# 17.4: two more figures with sides along the grid
PLUS = [(2, 0), (4, 0), (4, 2), (6, 2), (6, 4), (4, 4), (4, 6), (2, 6), (2, 4), (0, 4), (0, 2), (2, 2)]
assert perimeter(PLUS) == 24 and area(PLUS) == 20
figure('17-q1', dimensioned(PLUS, [(3, -0.75, '2 sm'), (6.9, 3, '2 sm'), (3, 6.75, '2 sm')], u=24), crop=260)
answer('17-q1', str(perimeter(PLUS)))
U_FIG = [(0, 0), (2, 0), (2, 3), (6, 3), (6, 0), (8, 0), (8, 5), (0, 5)]
assert area(U_FIG) == 28 and perimeter(U_FIG) == 32
figure('17-q2', dimensioned(U_FIG, [(4, 5.75, '8 sm'), (-1.4, 2.5, '5 sm'), (4, -0.7, '4 sm'), (5.0, 1.5, '3 sm')]), crop=300)
answer('17-q2', str(int(area(U_FIG))))

# =====================================================================================================
# 17.7 Charts: drawn from the numbers below; every answer is computed from the same numbers
# =====================================================================================================
def num(v):
    return f(v).replace('.', ',')                                             # decimal comma
def text_l(x, y, t, size=14, weight=500, fill=INK):
    return f'<text x="{f(x)}" y="{f(y)}" font-size="{size}" font-weight="{weight}" fill="{fill}" dominant-baseline="central">{t}</text>'
def chart_axes(y0, y1, lo, top, step, left=58, right=24, unit=''):
    out, v = '', lo
    while v <= top + 1e-9:
        yy = y1 - (v - lo) / (top - lo) * (y1 - y0)
        out += line(left, yy, W - right, yy, 1, color=FRAME) + text(left - 22, yy, num(v) + unit, 13, 500, MID)
        v += step
    return out + line(left, y1, W - right, y1, 2)
def bar_chart(labels, series, top, step, legend=None, h=170, unit=''):
    """Row: one bar per label, or two side by side (white and grey) when two series are given."""
    fills = ['#9aa1a9', '#ffffff'] if len(series) == 2 else ['#9aa1a9']
    def row(y):
        left, right = 58, 24
        y0 = y + 12 + (28 if legend else 0)
        y1 = y0 + h
        out = ''
        if legend:
            x = W / 2 - 120
            for k, name in enumerate(legend):
                out += rect(x, y + 6, 16, 16, fills[k], 1.6) + text_l(x + 24, y + 14, name, 14)
                x += 140
        out += chart_axes(y0, y1, 0, top, step, left, right)
        slot = (W - left - right) / len(labels)
        bw = slot * (0.5 if len(series) == 1 else 0.32)
        for i, lab in enumerate(labels):
            cx = left + slot * (i + 0.5)
            for k, vals in enumerate(series):
                x = cx - bw * len(series) / 2 + k * bw
                bh = vals[i] / top * h
                out += rect(x, y1 - bh, bw, bh, fills[k], 1.6)
                out += text(x + bw / 2, y1 - bh - 10, num(vals[i]), 12.5, 600)
            out += text(cx, y1 + 16, lab, 13.5, 500)
        return out, y1 + 34
    return row
def line_chart(labels, values, lo, top, step, h=160, unit=''):
    def row(y):
        left, right = 58, 24
        y0, y1 = y + 16, y + 16 + h
        out = chart_axes(y0, y1, lo, top, step, left, right, unit)
        slot = (W - left - right) / len(labels)
        pts = [(left + slot * (i + 0.5), y1 - (v - lo) / (top - lo) * h) for i, v in enumerate(values)]
        out += poly(pts, 'none', 2.5, close=False)
        for (x, yy), v, lab in zip(pts, values, labels):
            out += circle(x, yy, 4.5, INK, 0) + text(x, yy - 14, num(v), 12.5, 600) + text(x, y1 + 16, lab, 13.5, 500)
        return out, y1 + 34
    return row
PIE_FILLS = [('#ffffff', INK), ('#dfe3e8', INK), ('#b9c0c8', INK), ('#7d858e', '#ffffff'), ('#4f565e', '#ffffff')]
def pie_chart(parts, r=82):
    """Row: a pie from 12 o'clock clockwise; parts = [(name, share of 1, label in the slice)]; names in a key."""
    assert abs(sum(p for _, p, _ in parts) - 1) < 1e-9
    def row(y):
        cx, cy = W / 2 - 100, y + 10 + r
        out, a0 = '', -90.0
        for k, (name, share, lab) in enumerate(parts):
            a1 = a0 + 360 * share
            fill, ink = PIE_FILLS[k]
            p0 = (cx + r * math.cos(math.radians(a0)), cy + r * math.sin(math.radians(a0)))
            p1 = (cx + r * math.cos(math.radians(a1)), cy + r * math.sin(math.radians(a1)))
            big = 1 if a1 - a0 > 180 else 0
            out += (f'<path d="M{f(cx)},{f(cy)} L{f(p0[0])},{f(p0[1])} A{r},{r} 0 {big} 1 {f(p1[0])},{f(p1[1])} Z" '
                    f'fill="{fill}" stroke="{INK}" stroke-width="1.8" stroke-linejoin="round"/>')
            mid = math.radians((a0 + a1) / 2)
            out += text(cx + r * 0.62 * math.cos(mid), cy + r * 0.62 * math.sin(mid), lab, 13, 600, ink)
            ky = y + 18 + k * 30
            out += rect(cx + r + 40, ky, 18, 18, fill, 1.6) + text_l(cx + r + 66, ky + 9, f'{name} — {lab}', 15)
            a0 = a1
        return out, y + 2 * r + 30
    return row
def table_fig(head, rows, w0=110, w=100, h=34):
    def row(y):
        total = w0 + w * (len(head) - 1)
        x0, out = (W - total) / 2, ''
        for r, cells in enumerate([head] + rows):
            yy = y + 6 + r * h
            out += rect(x0, yy, total, h, '#f2f4f6' if r == 0 else '#ffffff', 1.4, stroke=FRAME)
            for c, t in enumerate(cells):
                cx = x0 + (w0 / 2 if c == 0 else w0 + w * (c - 0.5))
                out += text(cx, yy + h / 2, t, 14, 600 if r == 0 or c == 0 else 500)
        for c in range(1, len(head)):
            xx = x0 + w0 + w * (c - 1)
            out += line(xx, y + 6, xx, y + 6 + h * (len(rows) + 1), 1.4, color=FRAME)
        return out, y + 6 + h * (len(rows) + 1) + 20
    return row

# book: books sold by month — the second quarter beats the first by 40
SALES = [40, 55, 35, 60, 45, 65]
assert sum(SALES[3:]) - sum(SALES[:3]) == 40
figure('17-7a', bar_chart(['Yan', 'Fev', 'Mar', 'Apr', 'May', 'İyn'], [SALES], 70, 10)); answer('17-7a', '40')
TEMP = [12, 15, 14, 18, 21, 19, 13]
assert sum(TEMP) == 112 and sum(TEMP) / len(TEMP) == 16
figure('17-7b', line_chart(['B.e.', 'Ç.a.', 'Ç.', 'C.a.', 'C.', 'Ş.', 'B.'], TEMP, 0, 25, 5)); answer('17-7b', '16')
LANG = [('İngilis', 0.40, '40%'), ('Rus', 0.25, '25%'), ('Alman', 0.15, '15%'), ('Fransız', 0.10, '10%'), ('Digər', 0.10, '10%')]
assert round(240 * (0.40 - 0.25)) == 36
figure('17-7c', pie_chart(LANG)); answer('17-7c', '36')
BUDGET = [('Ərzaq', 0.40, '40%'), ('Kommunal', 0.20, '20%'), ('Nəqliyyat', 0.15, '15%'), ('Təhsil', 0.10, '10%'), ('Digər', 0.15, '15%')]
assert round(360 * 0.15) == 54
figure('17-7d', pie_chart(BUDGET)); answer('17-7d', '54')
# quizzes
QA, QB = [20, 25, 30, 35], [30, 22, 33, 20]
gaps = [abs(a - b) for a, b in zip(QA, QB)]
assert gaps == [10, 3, 3, 15] and gaps.index(max(gaps)) == 3
figure('17-q3', bar_chart(['I rüb', 'II rüb', 'III rüb', 'IV rüb'], [QA, QB], 40, 10, legend=['A filialı', 'B filialı'])); answer('17-q3', 'IV rüb')
READERS = [120, 90, 150, 110, 130]
assert sum(READERS) / 5 == 120
figure('17-q4', bar_chart(['B.e.', 'Ç.a.', 'Ç.', 'C.a.', 'C.'], [READERS], 160, 40)); answer('17-q4', '120')
SOLD = [80, 100, 120, 90, 135]
assert (SOLD[4] - SOLD[3]) * 100 / SOLD[3] == 50
figure('17-q5', bar_chart(['Yan', 'Fev', 'Mar', 'Apr', 'May'], [SOLD], 140, 20)); answer('17-q5', '50%')
PRICE = [2.0, 2.4, 2.4, 3.0, 2.7]
assert abs((PRICE[3] - PRICE[2]) / PRICE[2] - 0.25) < 1e-9
figure('17-q6', line_chart(['Yan', 'Fev', 'Mar', 'Apr', 'May'], PRICE, 0, 3.5, 0.5)); answer('17-q6', '25%')
STAFF = [('İstehsal', 0.50, '50%'), ('Satış', 0.20, '20%'), ('Ofis', 0.18, '18%'), ('Digər', 0.12, '12%')]
assert round(800 * (0.50 - 0.20 - 0.18)) == 96
figure('17-q7', pie_chart(STAFF)); answer('17-q7', '96')
GENRE = [('Bədii', 160 / 360, '160°'), ('Elmi', 100 / 360, '100°'), ('Tarix', 60 / 360, '60°'), ('Uşaq', 40 / 360, '40°')]
assert round(1800 * 100 / 360) == 500
figure('17-q8', pie_chart(GENRE)); answer('17-q8', '500')
SCORES = {'Aysel': [78, 85, 90], 'Murad': [88, 80, 84], 'Leyla': [92, 76, 83], 'Orxan': [70, 95, 89], 'Nigar': [85, 85, 85]}
assert max(SCORES, key=lambda k: sum(SCORES[k])) == 'Nigar' and sorted(sum(v) for v in SCORES.values()) == [251, 252, 253, 254, 255]
figure('17-q9', table_fig(['Tələbə', 'Məntiq', 'Dil', 'İnformatika'], [[k] + [str(x) for x in v] for k, v in SCORES.items()])); answer('17-q9', 'Nigar')

# 16.6 ciphers used in the chapter test (text only)
assert shift('KİTAB', 2) == 'LKÜCÇ' and shift('KİTAB', 1) == 'QJUBC'
assert '-'.join(str(AZ.index(ch) + 1) for ch in 'QALA') == '17-1-18-1' and '-'.join(str(AZ.index(ch) + 1) for ch in 'QARA') == '17-1-24-1'

# ---------- a second set for the chapter tests ----------
cube_choice('16-q45', NET_B, LAB_B, FB,
            [('hollow', 'square', 'target'), ('ring', 'dot', 'hollow'), ('dot', 'hollow', 'target'), ('four', 'ring', 'dot'), ('square', 'dot', 'four')],
            ['mirror', 'opp', 'mirror', 'ok', 'opp'])
missing('16-q46', ['####', '#ooo', '##o#', '##o#'], [P5['U'], P5['X'], cells_of('..#', '###', '..#'), P5['F'], P5['Y']], 2)
def folded_many(region, holes):
    """Like folded(), with several holes."""
    def row(y):
        side, x0, y0 = 150, (W - 150) / 2, y + 6
        (ax, ay), (bx, by) = region
        out = rect(x0, y0, side, side, 'none', 1.8, True, MID)
        out += rect(x0 + ax * side, y0 + ay * side, (bx - ax) * side, (by - ay) * side, PALE, 2.5)
        out += ''.join(circle(x0 + hx * side, y0 + hy * side, side * 0.06, INK, 0) for hx, hy in holes)
        return out, y0 + side + 22
    return row
H47 = [(0.2, 0.25), (0.35, 0.75)]
Q47 = unfold(H47, [('x', 0.5)])                                   # right half onto left
assert Q47 == {(0.2, 0.25), (0.8, 0.25), (0.35, 0.75), (0.65, 0.75)}
OPT47 = [{(0.2, 0.25), (0.2, 0.75), (0.35, 0.75), (0.35, 0.25)}, {(0.2, 0.25), (0.7, 0.25), (0.35, 0.75), (0.85, 0.75)},
         {(0.2, 0.25), (0.35, 0.75)}, Q47, {(0.2, 0.25), (0.65, 0.25), (0.35, 0.75), (0.8, 0.75)}]
assert [i for i, o in enumerate(OPT47) if o == Q47] == [3]
figure('16-q47', folded_many(((0, 0), (0.5, 1)), H47), lambda y: options(y, [sheet(o) for o in OPT47])); answer('16-q47', 3)
figure('16-q48', grid_lines(2, 3, 56), crop=230); answer('16-q48', str(count_rects(2, 3)))
assert count_rects(2, 3) == 18
ODD49 = [('pentagon', 4), ('triangle', 2), ('hexagon', 6), ('square', 3), ('heptagon', 6)]
assert [i for i, (k, n) in enumerate(ODD49) if SIDES[k] - 1 != n] == [2]
figure('16-q49', lambda y: options(y, [with_dots(k, n) for k, n in ODD49])); answer('16-q49', 2)
assert (45 + 180) % 360 == 225 and (90 + 180) % 360 == 270
figure('16-q50', lambda y: problem(y, [arrow(45), ':', arrow(225), '=', arrow(90, INK), ':', '?']),
       lambda y: options(y, [arrow(90), arrow(0, INK), arrow(180, INK), arrow(270), arrow(270, INK)])); answer('16-q50', 4)
RIDERS = [30, 45, 40, 70, 65, 50]
HOURS = ['7:00', '8:00', '9:00', '10:00', '11:00', '12:00']
rises = [b - a for a, b in zip(RIDERS, RIDERS[1:])]
assert rises == [15, -5, 30, -5, -15] and rises.index(max(rises)) == 2
figure('17-q10', line_chart(HOURS, RIDERS, 0, 80, 20)); answer('17-q10', '9:00–10:00')
FRUIT = [120, 80, 60, 40]
assert FRUIT[0] * 100 / sum(FRUIT) == 40
figure('17-q11', bar_chart(['Alma', 'Armud', 'Gilas', 'Ərik'], [FRUIT], 140, 20)); answer('17-q11', '40%')
T_FIG = [(0, 0), (8, 0), (8, 2), (5, 2), (5, 6), (3, 6), (3, 2), (0, 2)]
assert area(T_FIG) == 24 and perimeter(T_FIG) == 28
figure('17-q12', dimensioned(T_FIG, [(4, -0.7, '8 sm'), (-1.4, 1, '2 sm'), (4, 6.75, '2 sm'), (6.1, 4, '4 sm')]), crop=300)
answer('17-q12', str(int(area(T_FIG))))

json.dump(ANSWERS, open(os.path.join(OUT, 'answers.json'), 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=0, sort_keys=True)
sys.stdout.reconfigure(encoding='utf-8')
print('figures', sum(n.endswith('.svg') for n in os.listdir(OUT)), 'answers', len(ANSWERS), '— all answer checks passed')
