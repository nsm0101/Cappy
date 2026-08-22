"""
A very small technical-drawing toolkit that emits SVG.

Enough of a drawing surface to place outlines, section hatching, centrelines,
linear and diameter dimensions with proper extension lines and arrowheads,
leader notes and a title block. Model units are millimetres; each Sheet
carries one scale factor in px per mm, so a figure cannot drift out of scale
the way a hand-placed drawing can.
"""

import math

INK = "#14181d"
DIM = "#4a5560"
ACCENT = "#b4331f"      # measured-but-problematic callouts
GOOD = "#1d6b4a"        # proposed / conforming
GHOST = "#9aa4ae"

STYLE = f"""
.ol   {{ fill:none; stroke:{INK};   stroke-width:1.6;  stroke-linejoin:round; stroke-linecap:round; }}
.ol2  {{ fill:none; stroke:{INK};   stroke-width:1.0;  stroke-linejoin:round; stroke-linecap:round; }}
.hid  {{ fill:none; stroke:{GHOST}; stroke-width:1.0;  stroke-dasharray:6 4; }}
.cl   {{ fill:none; stroke:{DIM};   stroke-width:0.8;  stroke-dasharray:14 4 3 4; }}
.dim  {{ fill:none; stroke:{DIM};   stroke-width:0.9; }}
.ext  {{ fill:none; stroke:{DIM};   stroke-width:0.7; }}
.acc  {{ fill:none; stroke:{ACCENT};stroke-width:1.8; }}
.accf {{ fill:{ACCENT}; fill-opacity:0.13; stroke:{ACCENT}; stroke-width:1.4; }}
.good {{ fill:none; stroke:{GOOD};  stroke-width:1.8; }}
.goodf{{ fill:{GOOD}; fill-opacity:0.12; stroke:{GOOD}; stroke-width:1.4; }}
.t    {{ font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:13px; fill:{INK}; }}
.td   {{ font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:13px; fill:{DIM}; }}
.ta   {{ font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:13px; fill:{ACCENT}; font-weight:600; }}
.tg   {{ font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:13px; fill:{GOOD}; font-weight:600; }}
.tt   {{ font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:15px; fill:{INK}; font-weight:600;
         letter-spacing:0.04em; }}
.ts   {{ font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:11.5px; fill:{DIM}; }}
.arrow{{ fill:{DIM}; }}
.arrowa{{ fill:{ACCENT}; }}
"""


class Sheet:
    """A drawing sheet. Model millimetres in, SVG out."""

    def __init__(self, w, h, title="", subtitle="", scale_note="", bg="#ffffff"):
        self.w, self.h = w, h
        self.title, self.subtitle, self.scale_note = title, subtitle, scale_note
        self.bg = bg
        self.parts = []
        self._hatch_ids = set()

    # ---- raw primitives -------------------------------------------------

    def raw(self, s):
        self.parts.append(s)

    def line(self, x1, y1, x2, y2, cls="ol"):
        self.raw(f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" class="{cls}"/>')

    def path(self, d, cls="ol"):
        self.raw(f'<path d="{d}" class="{cls}"/>')

    def circle(self, cx, cy, r, cls="ol"):
        self.raw(f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{r:.2f}" class="{cls}"/>')

    def rect(self, x, y, w, h, cls="ol", rx=0):
        self.raw(f'<rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" '
                 f'rx="{rx}" class="{cls}"/>')

    def text(self, x, y, s, cls="t", anchor="middle", rotate=None, size=None):
        tr = f' transform="rotate({rotate} {x:.2f} {y:.2f})"' if rotate else ""
        sz = f' style="font-size:{size}px"' if size else ""
        self.raw(f'<text x="{x:.2f}" y="{y:.2f}" text-anchor="{anchor}" '
                 f'class="{cls}"{tr}{sz}>{_esc(s)}</text>')

    # ---- section hatching ----------------------------------------------

    def hatch_defs(self, name="h1", angle=45, spacing=7, color=None):
        if name in self._hatch_ids:
            return name
        self._hatch_ids.add(name)
        c = color or DIM
        self.parts.insert(0,
            f'<defs><pattern id="{name}" patternUnits="userSpaceOnUse" '
            f'width="{spacing}" height="{spacing}" '
            f'patternTransform="rotate({angle})">'
            f'<line x1="0" y1="0" x2="0" y2="{spacing}" stroke="{c}" stroke-width="0.8"/>'
            f'</pattern></defs>')
        return name

    def hatched(self, d, name="h1"):
        self.raw(f'<path d="{d}" fill="url(#{name})" stroke="{INK}" stroke-width="1.4" '
                 f'stroke-linejoin="round"/>')

    # ---- dimensions ------------------------------------------------------

    def _arrow(self, x, y, ang, cls="arrow", size=8):
        a = math.radians(ang)
        p1 = (x, y)
        p2 = (x - size * math.cos(a) + size * 0.30 * math.sin(a),
              y - size * math.sin(a) - size * 0.30 * math.cos(a))
        p3 = (x - size * math.cos(a) - size * 0.30 * math.sin(a),
              y - size * math.sin(a) + size * 0.30 * math.cos(a))
        self.raw(f'<polygon points="{p1[0]:.2f},{p1[1]:.2f} {p2[0]:.2f},{p2[1]:.2f} '
                 f'{p3[0]:.2f},{p3[1]:.2f}" class="{cls}"/>')

    def dim_h(self, x1, x2, y, label, ext_y=None, cls="dim", tcls="td", outside=False,
              label_dy=-7):
        """Horizontal dimension between x1 and x2, dimension line at y."""
        if ext_y is not None:
            for x in (x1, x2):
                self.line(x, ext_y, x, y + (4 if ext_y > y else -4), "ext")
        if outside:
            self.line(x1 - 26, y, x2 + 26, y, cls)
            self._arrow(x1, y, 180, "arrowa" if cls == "acc" else "arrow")
            self._arrow(x2, y, 0, "arrowa" if cls == "acc" else "arrow")
        else:
            self.line(x1, y, x2, y, cls)
            self._arrow(x1, y, 0, "arrowa" if cls == "acc" else "arrow")
            self._arrow(x2, y, 180, "arrowa" if cls == "acc" else "arrow")
        self.text((x1 + x2) / 2, y + label_dy, label, tcls)

    def dim_v(self, y1, y2, x, label, ext_x=None, cls="dim", tcls="td", side="left",
              outside=False):
        """Vertical dimension between y1 and y2, dimension line at x."""
        if ext_x is not None:
            for y in (y1, y2):
                self.line(ext_x, y, x + (4 if ext_x > x else -4), y, "ext")
        if outside:
            self.line(x, y1 - 26, x, y2 + 26, cls)
            self._arrow(x, y1, 270, "arrowa" if cls == "acc" else "arrow")
            self._arrow(x, y2, 90, "arrowa" if cls == "acc" else "arrow")
        else:
            self.line(x, y1, x, y2, cls)
            self._arrow(x, y1, 90, "arrowa" if cls == "acc" else "arrow")
            self._arrow(x, y2, 270, "arrowa" if cls == "acc" else "arrow")
        if side == "left":
            self.text(x - 7, (y1 + y2) / 2 + 4, label, tcls, anchor="end")
        else:
            self.text(x + 7, (y1 + y2) / 2 + 4, label, tcls, anchor="start")

    def leader(self, px, py, tx, ty, label, tcls="td", anchor=None, dot=True):
        """Leader from a point on the part to a text label."""
        elbow = tx + (-14 if tx > px else 14)
        self.line(px, py, elbow, ty, "ext")
        self.line(elbow, ty, tx, ty, "ext")
        if dot:
            self.raw(f'<circle cx="{px:.2f}" cy="{py:.2f}" r="2.2" fill="{DIM}"/>')
        a = anchor or ("start" if tx > px else "end")
        off = 4 if a == "start" else -4
        self.text(tx + off, ty + 4, label, tcls, anchor=a)

    def detail_circle(self, cx, cy, r, letter):
        self.raw(f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{r:.2f}" fill="none" '
                 f'stroke="{DIM}" stroke-width="1.1" stroke-dasharray="5 4"/>')
        self.text(cx + r * 0.75, cy - r * 0.78, letter, "tt")

    # ---- output ----------------------------------------------------------

    def title_block(self, rows, x=None, y=None, w=300):
        x = self.w - w - 26 if x is None else x
        y = self.h - 26 - 20 * (len(rows) + 1) if y is None else y
        h = 20 * (len(rows) + 1)
        self.raw(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="none" '
                 f'stroke="{DIM}" stroke-width="1"/>')
        self.line(x, y + 20, x + w, y + 20, "ext")
        self.text(x + 10, y + 14, self.title, "tt", anchor="start")
        for i, (k, v) in enumerate(rows):
            yy = y + 20 * (i + 1) + 14
            self.text(x + 10, yy, k, "ts", anchor="start")
            self.text(x + w - 10, yy, v, "ts", anchor="end")

    def render(self):
        body = "\n  ".join(self.parts)
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w} {self.h}" '
                f'width="{self.w}" height="{self.h}" role="img">\n'
                f'  <style>{STYLE}</style>\n'
                f'  <rect width="{self.w}" height="{self.h}" fill="{self.bg}"/>\n'
                f'  {body}\n</svg>\n')

    def save(self, path):
        with open(path, "w") as f:
            f.write(self.render())
        return path


def _esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


DIA = "⌀"   # ⌀
DEG = "°"
PM = "±"
