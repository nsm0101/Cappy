#!/usr/bin/env python3
"""
Check a drawing set against the parts of 37 CFR 1.84 that can be measured
mechanically. Run it after every regeneration.

    python3 audit.py ../Provisional_Application_Drawings.pdf

Checks:
  sheet size          21.6 x 27.9 cm (US Letter)
  margins             left/top >= 2.5 cm, right >= 1.5 cm, bottom >= 1.0 cm
  colour              black strokes and fills only
  character height    every glyph >= 1/8 in (0.32 cm)
  line width          no zero-width (hairline) strokes
  figure labels       every sheet carries a `FIG. n` label
  numbering           sheets numbered consecutively as n / total
"""

import collections
import re
import sys

import pymupdf

PT_PER_CM = 72.0 / 2.54
LETTER = (612.0, 792.0)

MIN_L = 2.5 * PT_PER_CM      # 70.87
MIN_T = 2.5 * PT_PER_CM
MIN_R = 1.5 * PT_PER_CM      # 42.52
MIN_B = 1.0 * PT_PER_CM      # 28.35

# 1/8 in of character height. Helvetica cap height is 0.717 em.
MIN_CHAR_PT = 9.0
CAP_RATIO = 0.717
MIN_FONT_PT = MIN_CHAR_PT / CAP_RATIO   # 12.55


def ink_bbox(page, dpi=150):
    """Bounding box of everything that actually prints, in PDF points."""
    pm = page.get_pixmap(dpi=dpi, colorspace=pymupdf.csGRAY)
    scale = 72.0 / dpi
    w, h = pm.width, pm.height
    data = pm.samples
    x0, y0, x1, y1 = w, h, -1, -1
    for row in range(h):
        base = row * pm.stride
        line = data[base:base + w]
        if min(line) > 200:          # nothing dark enough to be ink
            continue
        first = next(i for i, v in enumerate(line) if v <= 200)
        last = w - 1 - next(i for i, v in enumerate(reversed(line)) if v <= 200)
        x0 = min(x0, first)
        x1 = max(x1, last)
        y0 = min(y0, row)
        y1 = max(y1, row)
    if x1 < 0:
        return (0.0, 0.0, 0.0, 0.0)
    return (x0 * scale, y0 * scale, (x1 + 1) * scale, (y1 + 1) * scale)


def audit(path):
    doc = pymupdf.open(path)
    problems = []
    sizes = collections.Counter()
    fonts = collections.Counter()
    widths = collections.Counter()

    for i, page in enumerate(doc, 1):
        tag = "sheet %d" % i
        r = page.rect
        if (round(r.width), round(r.height)) != (round(LETTER[0]), round(LETTER[1])):
            problems.append("%s: page is %.0fx%.0f pt, expected 612x792"
                            % (tag, r.width, r.height))

        # Ink extent is measured from a raster, not from path rectangles:
        # hatching is drawn as long lines behind a clip path, so its path
        # rects reach well outside the region that actually prints.
        x0, y0, x1, y1 = ink_bbox(page)
        seen_fig = False
        sheet_no = None

        for d in page.get_drawings():
            for key in ("color", "fill"):
                c = d.get(key)
                if c and not all(abs(v - 0.0) < 1e-6 or abs(v - 1.0) < 1e-6
                                 for v in c):
                    problems.append("%s: non-black/white ink %s" % (tag, c))
                if c and len(set(round(v, 3) for v in c)) > 1:
                    problems.append("%s: colour ink %s" % (tag, c))
            w = d.get("width")
            widths[round(w or 0.0, 2)] += 1
            if d.get("stroke_opacity", 1) not in (None, 1):
                problems.append("%s: transparent stroke" % tag)
            if (w is not None and w == 0
                    and d.get("type") in ("s", "fs")):
                problems.append("%s: zero-width (hairline) stroke" % tag)

        for b in page.get_text("dict")["blocks"]:
            if b["type"] != 0:
                continue
            for line in b["lines"]:
                for s in line["spans"]:
                    sizes[round(s["size"], 1)] += 1
                    fonts[s["font"]] += 1
                    if s["size"] < MIN_FONT_PT - 0.05:
                        problems.append(
                            "%s: %.1f pt text is under the 1/8 in minimum "
                            "(%.2f pt): %r"
                            % (tag, s["size"], MIN_FONT_PT, s["text"][:40]))
                    t = s["text"].strip()
                    if t.startswith("FIG."):
                        seen_fig = True
                    m = re.fullmatch(r"(\d+)\s*/\s*(\d+)", t)
                    if m:
                        sheet_no = (int(m.group(1)), int(m.group(2)))

        left, top = x0, y0
        right, bottom = LETTER[0] - x1, LETTER[1] - y1
        for name, got, need in (("left", left, MIN_L), ("top", top, MIN_T),
                                ("right", right, MIN_R),
                                ("bottom", bottom, MIN_B)):
            if got < need - 0.05:
                problems.append("%s: %s margin %.1f pt < %.1f pt required"
                                % (tag, name, got, need))

        if not seen_fig:
            problems.append("%s: no FIG. label found" % tag)
        if sheet_no is None:
            problems.append("%s: no sheet number found" % tag)
        elif sheet_no[0] != i or sheet_no[1] != len(doc):
            problems.append("%s: numbered %d / %d, expected %d / %d"
                            % (tag, sheet_no[0], sheet_no[1], i, len(doc)))

    print("%s — %d sheets" % (path, len(doc)))
    print("  text sizes : %s" % sorted(sizes))
    print("  fonts      : %s" % sorted(fonts))
    print("  line widths: %s" % sorted(w for w in widths if w))
    if problems:
        print("\n  %d PROBLEM(S):" % len(problems))
        for p in problems:
            print("    - " + p)
        return 1
    print("\n  OK — no 1.84 violations detected.")
    return 0


if __name__ == "__main__":
    sys.exit(audit(sys.argv[1] if len(sys.argv) > 1
                   else "../Provisional_Application_Drawings.pdf"))
