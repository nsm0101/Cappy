"""
patentkit -- drawing primitives for USPTO-compliant utility patent figures.

Everything here emits black line art only: no colour, no grey fill, no raster.
Surface / section shading is done with line hatching, per 37 CFR 1.84(m).

Sheet rules enforced by Sheet():
  * US Letter, 612 x 792 pt
  * margins  left 72 / top 72 / right 45 / bottom 27 pt   (1.84(g))
  * sheet number centred in the top of the sheet, inside the sight  (1.84(t))
  * every glyph >= MIN_FONT pt so character height clears 1/8 in    (1.84(p)(3))
  * no hairlines: every stroke has an explicit width >= 0.6 pt      (1.84(l))
"""

import math

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas as rl_canvas

# ---------------------------------------------------------------- page setup

PAGE_W, PAGE_H = letter  # 612 x 792 pt

MARGIN_L = 72.0
MARGIN_T = 72.0
MARGIN_R = 45.0
MARGIN_B = 27.0

# Work a little inside the legal minimum so nothing can creep into the margin.
SAFE = 4.0
SIGHT_X0 = MARGIN_L + SAFE
SIGHT_X1 = PAGE_W - MARGIN_R - SAFE
SIGHT_Y0 = MARGIN_B + SAFE
SIGHT_Y1 = PAGE_H - MARGIN_T - SAFE

SIGHT_W = SIGHT_X1 - SIGHT_X0
SIGHT_H = SIGHT_Y1 - SIGHT_Y0

# The sheet number sits in a reserved band at the top of the sight; drawings
# start below it. CAPTION_GAP is the clear space kept under a drawing before
# its FIG. label.
TOP = SIGHT_Y1 - 28.0     # first y a drawing may use
BOT = SIGHT_Y0 + 6.0      # last y a caption may use
CAPTION_GAP = 26.0

# Hatching convention for this set. Adjacent parts never share an angle.
HATCH_VESSEL = dict(angle=45.0, spacing=4.6)    # vessel 110 (all of it)
HATCH_CORE = dict(angle=135.0, spacing=5.6)   # token rigid core 138
HATCH_PAD = dict(angle=135.0, spacing=2.6)   # token friction pads 137

# 1/8 in = 9 pt of *character* height. Helvetica cap height is 0.717 em, so a
# 12.5 pt face is the smallest that clears it. Round up and never go below.
MIN_FONT = 12.7

FONT = "Helvetica"
FONT_B = "Helvetica-Bold"

# Stroke weights, in points.
LW_OUTLINE = 1.10   # part outlines, section cut edges
LW_NORMAL = 0.80   # ordinary visible edges
LW_THIN = 0.65   # hatching, tick marks, interior detail
LW_LEADER = 0.65   # leader lines
LW_CENTRE = 0.65   # centre lines

MM = 72.0 / 25.4  # points per millimetre


def mm(v):
    """Millimetres -> points."""
    return v * MM


class Sheet:
    """One drawing sheet. Wraps a reportlab canvas with patent conventions."""

    def __init__(self, c, number, total):
        self.c = c
        self.number = number
        self.total = total
        c.setLineCap(1)
        c.setLineJoin(1)
        c.setStrokeColorRGB(0, 0, 0)
        c.setFillColorRGB(0, 0, 0)
        self._sheet_number()

    def _sheet_number(self):
        c = self.c
        c.setFont(FONT, MIN_FONT)
        label = "%d / %d" % (self.number, self.total)
        c.drawCentredString(PAGE_W / 2.0, SIGHT_Y1 - MIN_FONT, label)

    # ------------------------------------------------------------- text

    def wrap(self, s, width, size=MIN_FONT, bold=False):
        """Greedy word wrap to `width` points. Honours explicit newlines."""
        out = []
        for para in s.split("\n"):
            line = ""
            for word in para.split():
                trial = (line + " " + word).strip()
                if line and self.text_w(trial, size, bold) > width:
                    out.append(line)
                    line = word
                else:
                    line = trial
            out.append(line)
        return out

    def fig_label(self, text, x, y, size=17.0, sub=None, sub_size=None,
                  width=None):
        """
        `FIG. n` caption with an optional wrapped descriptive block underneath.
        Returns the y of the last line drawn.
        """
        c = self.c
        c.setFont(FONT_B, size)
        c.drawCentredString(x, y, text)
        if not sub:
            return y
        ssize = sub_size or MIN_FONT
        lines = self.wrap(sub, width or (SIGHT_W - 40), ssize)
        yy = y
        for i, line in enumerate(lines):
            yy = y - size * 0.95 - i * (ssize + 2.6)
            c.setFont(FONT, ssize)
            c.drawCentredString(x, yy, line)
        return yy

    def caption(self, label, sub, bottom_of_drawing, x=None, size=17.0,
                width=None):
        """Place a figure caption a fixed clear distance below the drawing."""
        x = x if x is not None else (SIGHT_X0 + SIGHT_X1) / 2.0
        y = bottom_of_drawing - CAPTION_GAP - size
        return self.fig_label(label, x, y, size=size, sub=sub, width=width)

    def note(self, s, x, y, width=None, size=MIN_FONT, align="c", bold=False):
        """Centred explanatory note, wrapped. Returns the y of the last line."""
        lines = self.wrap(s, width or (SIGHT_W - 40), size, bold)
        yy = y
        for i, line in enumerate(lines):
            yy = y - i * (size + 2.6)
            self.text(line, x, yy, size=size, align=align, bold=bold)
        return yy

    def text(self, s, x, y, size=MIN_FONT, align="l", bold=False, leading=None):
        """Plain text. `s` may contain newlines. Never smaller than MIN_FONT."""
        c = self.c
        size = max(size, MIN_FONT)
        c.setFont(FONT_B if bold else FONT, size)
        lead = leading or (size + 2.0)
        for i, line in enumerate(s.split("\n")):
            yy = y - i * lead
            if align == "c":
                c.drawCentredString(x, yy, line)
            elif align == "r":
                c.drawRightString(x, yy, line)
            else:
                c.drawString(x, yy, line)
        return y - (len(s.split("\n")) - 1) * lead

    def text_w(self, s, size=MIN_FONT, bold=False):
        return self.c.stringWidth(s, FONT_B if bold else FONT, max(size, MIN_FONT))

    # ------------------------------------------------------- basic strokes

    def line(self, x0, y0, x1, y1, w=LW_NORMAL, dash=None):
        c = self.c
        c.saveState()
        c.setLineWidth(w)
        if dash:
            c.setDash(dash)
        c.line(x0, y0, x1, y1)
        c.restoreState()

    def polyline(self, pts, w=LW_NORMAL, close=False, dash=None):
        c = self.c
        c.saveState()
        c.setLineWidth(w)
        if dash:
            c.setDash(dash)
        p = c.beginPath()
        p.moveTo(*pts[0])
        for q in pts[1:]:
            p.lineTo(*q)
        if close:
            p.close()
        c.drawPath(p, stroke=1, fill=0)
        c.restoreState()

    def rect(self, x, y, w, h, lw=LW_NORMAL, r=None, dash=None):
        c = self.c
        c.saveState()
        c.setLineWidth(lw)
        if dash:
            c.setDash(dash)
        if r:
            c.roundRect(x, y, w, h, r, stroke=1, fill=0)
        else:
            c.rect(x, y, w, h, stroke=1, fill=0)
        c.restoreState()

    def circle(self, x, y, r, lw=LW_NORMAL, dash=None, fill=0):
        c = self.c
        c.saveState()
        c.setLineWidth(lw)
        if dash:
            c.setDash(dash)
        c.circle(x, y, r, stroke=1, fill=fill)
        c.restoreState()

    def ellipse(self, cx, cy, rx, ry, lw=LW_NORMAL, dash=None):
        c = self.c
        c.saveState()
        c.setLineWidth(lw)
        if dash:
            c.setDash(dash)
        c.ellipse(cx - rx, cy - ry, cx + rx, cy + ry, stroke=1, fill=0)
        c.restoreState()

    def arc_ellipse(self, cx, cy, rx, ry, a0, a1, lw=LW_NORMAL, dash=None, n=96):
        """Elliptical arc from a0 to a1 degrees, drawn as a polyline."""
        pts = []
        for i in range(n + 1):
            a = math.radians(a0 + (a1 - a0) * i / n)
            pts.append((cx + rx * math.cos(a), cy + ry * math.sin(a)))
        self.polyline(pts, w=lw, dash=dash)

    def centre_line(self, x0, y0, x1, y1):
        self.line(x0, y0, x1, y1, w=LW_CENTRE, dash=(9, 3, 2, 3))

    def centre_marks(self, cx, cy, r, out=13.0, inset=5.0, tick=9.0):
        """
        Centre lines for a round part drawn as four stubs that straddle the
        outline plus a small cross at the axis, so they never run through
        indicia inside the part.
        """
        for sgn in (-1, 1):
            self.centre_line(cx + sgn * (r - inset), cy, cx + sgn * (r + out), cy)
            self.centre_line(cx, cy + sgn * (r - inset), cx, cy + sgn * (r + out))
        self.line(cx - tick, cy, cx + tick, cy, w=LW_CENTRE)
        self.line(cx, cy - tick, cx, cy + tick, w=LW_CENTRE)

    # ----------------------------------------------------------- arrows

    def arrow_head(self, x, y, ang, size=6.5, w=LW_NORMAL):
        """Solid triangular head at (x, y) pointing along `ang` (radians)."""
        c = self.c
        c.saveState()
        c.setLineWidth(w)
        back = ang + math.pi
        spread = math.radians(20)
        p = c.beginPath()
        p.moveTo(x, y)
        p.lineTo(x + size * math.cos(back - spread), y + size * math.sin(back - spread))
        p.lineTo(x + size * math.cos(back + spread), y + size * math.sin(back + spread))
        p.close()
        c.drawPath(p, stroke=1, fill=1)
        c.restoreState()

    def arrow(self, x0, y0, x1, y1, w=LW_NORMAL, size=6.5, dash=None):
        ang = math.atan2(y1 - y0, x1 - x0)
        back = size * 0.85
        self.line(x0, y0, x1 - back * math.cos(ang), y1 - back * math.sin(ang), w=w, dash=dash)
        self.arrow_head(x1, y1, ang, size=size, w=w)

    def elbow_arrow(self, pts, w=LW_NORMAL, size=6.5, dash=None):
        """Orthogonal polyline ending in an arrow head."""
        self.polyline(pts[:-1] + [self._pull_back(pts[-2], pts[-1], size * 0.85)],
                      w=w, dash=dash)
        ang = math.atan2(pts[-1][1] - pts[-2][1], pts[-1][0] - pts[-2][0])
        self.arrow_head(pts[-1][0], pts[-1][1], ang, size=size, w=w)

    @staticmethod
    def _pull_back(a, b, d):
        ang = math.atan2(b[1] - a[1], b[0] - a[0])
        return (b[0] - d * math.cos(ang), b[1] - d * math.sin(ang))

    def dim_line(self, x0, y0, x1, y1, label, size=MIN_FONT, gap=3.0, above=True,
                 ext=None):
        """Dimension line with heads at both ends and a centred label."""
        ang = math.atan2(y1 - y0, x1 - x0)
        self.line(x0, y0, x1, y1, w=LW_THIN)
        self.arrow_head(x0, y0, ang + math.pi, size=5.5, w=LW_THIN)
        self.arrow_head(x1, y1, ang, size=5.5, w=LW_THIN)
        if ext:
            for (ex, ey0, ey1) in ext:
                self.line(ex, ey0, ex, ey1, w=LW_THIN)
        mx, my = (x0 + x1) / 2.0, (y0 + y1) / 2.0
        off = (size * 0.85 + gap) if above else -(gap + size * 0.35)
        self.c.setFont(FONT, max(size, MIN_FONT))
        w = self.text_w(label, size)
        # blank the line under the label so the text stays legible
        self.c.saveState()
        self.c.setFillColorRGB(1, 1, 1)
        self.c.rect(mx - w / 2 - 2, my + off - 2.5, w + 4, size + 1, stroke=0, fill=1)
        self.c.restoreState()
        self.text(label, mx, my + off, size=size, align="c")

    # ------------------------------------------------------ reference marks

    def ref(self, num, tx, ty, ax, ay, size=MIN_FONT, elbow=None, dot=False):
        """
        Reference numeral `num` at (tx, ty) with a lead line to the feature at
        (ax, ay). Lead lines carry no arrow head when they land on a surface
        (1.84(q)); `dot` puts a terminal dot for a lead into a blank area.
        """
        self.c.setFont(FONT, max(size, MIN_FONT))
        w = self.text_w(str(num), size)
        h = max(size, MIN_FONT) * 0.72

        # start the lead just outside the numeral, on the side facing the target
        cx, cy = tx + w / 2.0, ty + h / 2.0
        ang = math.atan2(ay - cy, ax - cx)
        sx = cx + (w / 2.0 + 3.0) * math.cos(ang)
        sy = cy + (h / 2.0 + 3.0) * math.sin(ang)

        if elbow:
            self.polyline([(sx, sy)] + list(elbow) + [(ax, ay)], w=LW_LEADER)
        else:
            self.line(sx, sy, ax, ay, w=LW_LEADER)
        if dot:
            self.c.saveState()
            self.c.setLineWidth(LW_LEADER)
            self.c.circle(ax, ay, 1.6, stroke=1, fill=1)
            self.c.restoreState()
        self.text(str(num), tx, ty, size=size)

    # ---------------------------------------------------------- hatching

    def hatch(self, path_fn, x0, y0, x1, y1, spacing=4.2, angle=45.0,
              lw=LW_THIN):
        """
        Fill the region defined by `path_fn(canvas_path)` with parallel lines.
        `path_fn` receives a fresh reportlab path and must close the region.
        (x0, y0, x1, y1) is the bounding box to sweep.
        """
        c = self.c
        c.saveState()
        p = c.beginPath()
        path_fn(p)
        c.clipPath(p, stroke=0, fill=0)
        c.setLineWidth(lw)

        a = math.radians(angle)
        dx, dy = math.cos(a), math.sin(a)
        nx, ny = -dy, dx                       # normal to the hatch direction
        w, h = x1 - x0, y1 - y0
        span = abs(w * nx) + abs(h * ny)
        diag = math.hypot(w, h)
        cx, cy = (x0 + x1) / 2.0, (y0 + y1) / 2.0

        k = -span / 2.0
        while k <= span / 2.0:
            px, py = cx + nx * k, cy + ny * k
            c.line(px - dx * diag, py - dy * diag, px + dx * diag, py + dy * diag)
            k += spacing
        c.restoreState()

    def hatch_rect(self, x, y, w, h, **kw):
        self.hatch(lambda p: (p.rect(x, y, w, h), p.close()),
                   x, y, x + w, y + h, **kw)

    def hatch_poly(self, pts, **kw):
        xs = [q[0] for q in pts]
        ys = [q[1] for q in pts]

        def fn(p):
            p.moveTo(*pts[0])
            for q in pts[1:]:
                p.lineTo(*q)
            p.close()

        self.hatch(fn, min(xs), min(ys), max(xs), max(ys), **kw)

    # ------------------------------------------------------------ boxes

    def flow_lines(self, text, w, size=MIN_FONT, pad=15.0):
        """Lines of `text` wrapped to fit inside a box `w` wide."""
        return self.wrap(text, max(20.0, w - pad), size)

    def flow_box(self, x, y, w, h, text, size=MIN_FONT, r=0, lw=LW_NORMAL,
                 leading=None, dash=None):
        """Rounded/plain box with centred, vertically-centred wrapped text."""
        self.rect(x, y, w, h, lw=lw, r=r, dash=dash)
        lines = self.flow_lines(text, w, size)
        lead = leading or (size + 2.2)
        total = (len(lines) - 1) * lead
        ty = y + h / 2.0 + total / 2.0 - size * 0.36
        for i, line in enumerate(lines):
            self.text(line, x + w / 2.0, ty - i * lead, size=size, align="c")

    def flow_diamond(self, cx, cy, w, h, text, size=MIN_FONT, lw=LW_NORMAL):
        pts = [(cx, cy + h / 2), (cx + w / 2, cy), (cx, cy - h / 2), (cx - w / 2, cy)]
        self.polyline(pts, w=lw, close=True)
        # a diamond only offers its full width at the waist, so wrap tighter
        lines = self.flow_lines(text, w * 0.86, size)
        lead = size + 2.2
        total = (len(lines) - 1) * lead
        ty = cy + total / 2.0 - size * 0.36
        for i, line in enumerate(lines):
            self.text(line, cx, ty - i * lead, size=size, align="c")


# ------------------------------------------------------------ QR-ish pattern

def qr_cells(seed, n=13):
    """
    Deterministic pseudo-random module map with three finder patterns, so the
    optically-readable code reads as a real 2-D code without encoding a live
    payload. Returns an n x n grid of 0/1.
    """
    g = [[0] * n for _ in range(n)]
    state = seed & 0xFFFFFFFF
    for r in range(n):
        for col in range(n):
            state = (1103515245 * state + 12345) & 0x7FFFFFFF
            g[r][col] = (state >> 16) & 1

    def finder(r0, c0):
        for r in range(7):
            for c in range(7):
                if 0 <= r0 + r < n and 0 <= c0 + c < n:
                    edge = r in (0, 6) or c in (0, 6)
                    core = 2 <= r <= 4 and 2 <= c <= 4
                    g[r0 + r][c0 + c] = 1 if (edge or core) else 0
        # quiet ring
        for r in range(-1, 8):
            for c in range(-1, 8):
                if (r in (-1, 7) or c in (-1, 7)):
                    rr, cc = r0 + r, c0 + c
                    if 0 <= rr < n and 0 <= cc < n:
                        g[rr][cc] = 0

    finder(0, 0)
    finder(0, n - 7)
    finder(n - 7, 0)
    return g


def draw_qr(sheet, cx, cy, size, seed=7, n=13, lw=None):
    """Draw a QR-style code centred at (cx, cy), `size` points across."""
    g = qr_cells(seed, n)
    cell = size / float(n)
    c = sheet.c
    c.saveState()
    c.setFillColorRGB(0, 0, 0)
    x0 = cx - size / 2.0
    y0 = cy - size / 2.0
    for r in range(n):
        for col in range(n):
            if g[r][col]:
                c.rect(x0 + col * cell, y0 + (n - 1 - r) * cell,
                       cell, cell, stroke=0, fill=1)
    c.restoreState()
    sheet.rect(x0, y0, size, size, lw=LW_THIN)


# ------------------------------------------------------------- document

class Drawings:
    """Multi-sheet drawing set."""

    def __init__(self, path, total, title="Provisional Application Drawings"):
        self.c = rl_canvas.Canvas(path, pagesize=letter)
        self.c.setTitle(title)
        self.total = total
        self.n = 0

    def sheet(self, number=None):
        """Start a new sheet. `number` overrides the running count, so a
        single-figure file can still carry its number in the full set."""
        self.n += 1
        if self.n > 1:
            self.c.showPage()
        return Sheet(self.c, number or self.n, self.total)

    def save(self):
        self.c.save()
