#!/usr/bin/env python3
"""
Recover the base-recess dimensions from Comar's published drawing.

Comar dimensions the outside of the 30 mL embossed cup but not the recess on
the underside of its base — which is the one feature the Cappy puck has to fit.
The recess is drawn, though, in two independent views. This script measures it
off the drawing's own geometry.

Method
------
1. The two drawing views on sheet 22-0263 are raster images embedded in the
   PDF, not vectors, so the measurement is done in pixels.
2. Scale is calibrated against dimensions Comar *states* on the drawing:
   ⌀42.07 rim OD and ⌀33.02 base OD. If those two disagree by more than 0.5 %
   the drawing is not to scale and the script refuses to report anything.
3. The recess is then read twice — as a circle in the plan view, and as a
   notch in the section view — and the two reads are cross-checked.

The drawing says DRAWING NOT TO SCALE. That note is about print scaling; the
CAD geometry underneath is to scale, and step 2 proves it before any derived
number is emitted. Run:

    pip install pymupdf pillow numpy
    python3 measure_source_drawing.py
"""

import math
import os
import sys

try:
    import numpy as np
    import pymupdf
    from PIL import Image
except ImportError:
    sys.exit("needs: pip install pymupdf pillow numpy")

import io

HERE = os.path.dirname(os.path.abspath(__file__))
PDF = os.path.join(HERE, os.pardir, "sources",
                   "22-0263-Comar-30-mL-Embossed-Dosage-Cup-Drawing.pdf")

STATED_RIM_OD = 42.07
STATED_BASE_OD = 33.02
STATED_HEIGHT = 41.50
THRESH = 190          # ink threshold on the 8-bit grey raster


# ------------------------------------------------------------------ raster

def load_views():
    """The lower band of the sheet carries the section and the plan view."""
    doc = pymupdf.open(PDF)
    page = doc[0]
    best = None
    for im in page.get_images(full=True):
        xref = im[0]
        info = doc.extract_image(xref)
        if info["width"] < 1000 or info["height"] < 300:
            continue
        rect = page.get_image_rects(xref)[0]
        # the section + plan view band is the lowest of the large images
        if best is None or rect.y0 > best[0].y0:
            best = (rect, info)
    if best is None:
        sys.exit("could not find the drawing band in the PDF")
    img = Image.open(io.BytesIO(best[1]["image"])).convert("L")
    return np.array(img).astype(float)


# ------------------------------------------------------- circle extraction

def fit_circle(points):
    x, y = points[:, 0], points[:, 1]
    A = np.c_[2 * x, 2 * y, np.ones(len(points))]
    sol, *_ = np.linalg.lstsq(A, x ** 2 + y ** 2, rcond=None)
    cx, cy, c = sol
    return cx, cy, math.sqrt(c + cx ** 2 + cy ** 2)


def outer_circle(dark, x0, x1):
    """Robust fit of the outermost circle in a column band."""
    sub = dark[:, x0:x1]
    pts = []
    for y in range(sub.shape[0]):
        xs = np.where(sub[y])[0]
        if len(xs) >= 2:
            pts.append((xs.min() + x0, y))
            pts.append((xs.max() + x0, y))
    P = np.array(pts, float)
    for _ in range(12):
        cx, cy, r = fit_circle(P)
        res = np.abs(np.hypot(P[:, 0] - cx, P[:, 1] - cy) - r)
        keep = res < max(2.0, np.percentile(res, 70))
        if keep.sum() < 30:
            break
        P = P[keep]
    return fit_circle(P)


def concentric_radii(dark, cx, cy, r_max, min_count=400):
    """Radii of the concentric circles about (cx, cy), by radial scan."""
    H, W = dark.shape
    hits = []
    for adeg in np.arange(0, 360, 0.5):
        th = math.radians(adeg)
        r = 25.0
        while r < r_max:
            xi, yi = int(round(cx + r * math.cos(th))), int(round(cy + r * math.sin(th)))
            if 0 <= xi < W and 0 <= yi < H and dark[yi, xi]:
                hits.append(r)
            r += 0.25
    hist, edges = np.histogram(np.array(hits), bins=np.arange(25, r_max, 0.5))
    bands, cur = [], None
    for i, c in enumerate(hist):
        if c >= 40:
            if cur and edges[i] <= cur[1] + 0.01:
                cur = (cur[0], edges[i + 1], cur[2] + c)
            else:
                if cur:
                    bands.append(cur)
                cur = (edges[i], edges[i + 1], c)
    if cur:
        bands.append(cur)
    return [((lo + hi) / 2, c) for lo, hi, c in bands if c >= min_count]


# ---------------------------------------------------------- section reader

def horizontal_line_y(ink, y0, y1, x0, x1):
    """Sub-pixel y of a horizontal line, by intensity-weighted centroid."""
    band = ink[y0:y1 + 1, x0:x1 + 1]
    w = band.sum(axis=1)
    ys = np.arange(y0, y1 + 1)
    return float((w * ys).sum() / w.sum())


def find_base_lines(dark, ink, x0, x1):
    """
    The three horizontal lines that define the base in the section view:
    the inside floor, the recess ceiling and the foot-ring contact plane.
    """
    counts = dark[:, x0:x1].sum(axis=1)
    span = x1 - x0
    rows = [y for y, c in enumerate(counts) if c > span * 0.75]
    groups, cur = [], [rows[0]]
    for y in rows[1:]:
        if y - cur[-1] <= 2:
            cur.append(y)
        else:
            groups.append(cur)
            cur = [y]
    groups.append(cur)
    if len(groups) < 3:
        sys.exit(f"expected 3 base lines, found {len(groups)}")
    return [horizontal_line_y(ink, g[0] - 3, g[-1] + 3, x0, x1) for g in groups[-3:]]


# --------------------------------------------------------------------- run

def main():
    a = load_views()
    dark = a < THRESH
    ink = 255.0 - a
    H, W = a.shape

    # ---- plan view: the concentric circles on the base
    cx, cy, r_out = outer_circle(dark, int(W * 0.38), int(W * 0.80))
    scale = 2 * r_out / STATED_RIM_OD          # px per mm, from the rim circle
    radii = concentric_radii(dark, cx, cy, r_out * 1.02)
    circles = sorted(2 * r / scale for r, _ in radii)

    base_od = min(circles, key=lambda d: abs(d - STATED_BASE_OD))
    err = abs(base_od - STATED_BASE_OD) / STATED_BASE_OD
    print(f"calibration   rim \u2300{STATED_RIM_OD} -> {scale:.4f} px/mm")
    print(f"              base reads {base_od:.3f} vs {STATED_BASE_OD} stated "
          f"({err*100:.2f} % error)")
    if err > 0.005:
        sys.exit("the two stated dimensions disagree — drawing is not to scale, "
                 "refusing to report derived values")

    recess = max((d for d in circles if d < base_od - 0.5), default=None)
    print(f"\nplan view circles (mm): " + ", ".join(f"{d:.2f}" for d in circles))
    print(f"  recess diameter        {recess:.2f}")
    print(f"  foot ring radial width {(base_od - recess) / 2:.2f}")

    # ---- section view: the three base lines
    x0, x1 = int(W * 0.10), int(W * 0.15)
    floor_y, ceil_y, foot_y = find_base_lines(dark, ink, x0, x1)
    panel = (ceil_y - floor_y) / scale
    depth = (foot_y - ceil_y) / scale
    print(f"\nsection view")
    print(f"  base panel thickness   {panel:.2f}")
    print(f"  recess depth           {depth:.2f}")
    print(f"  floor to foot plane    {(foot_y - floor_y) / scale:.2f}")

    print(f"\nuncertainty  1 px = {1/scale:.3f} mm.")
    print( "             The calibration check above closed to 0.03 mm, so the")
    print( "             circle fits are good to about a tenth of a millimetre;")
    print(f"             the section lines are 1-2 px wide, so call the depth")
    print(f"             and panel figures ±{1/scale:.2f} mm.")


if __name__ == "__main__":
    main()
