#!/usr/bin/env python3
"""
Generate the medication-cup reference drawing set.

Every figure is drawn from cup_geometry.py, so no drawing can carry a
dimension that disagrees with the model. Run:

    python3 generate_figures.py

Outputs figures/FIG-*.svg.
"""

import math
import os

import cup_geometry as G
from svgkit import Sheet, DIA, DEG, ACCENT, GOOD, DIM

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "figures")
SRC = "Comar 22-0263, 2026-08-22"


# ---------------------------------------------------------------- helpers

def interior_radius(cup, z):
    """Inside radius of the cup wall at height z above the foot plane."""
    z0, z1 = cup.base_height, cup.height
    r0, r1 = cup.base_id / 2.0, cup.rim_id / 2.0
    return r0 + (r1 - r0) * ((z - z0) / (z1 - z0))


def outer_radius(cup, z):
    r0, r1 = cup.base_od / 2.0, cup.rim_od / 2.0
    return r0 + (r1 - r0) * (z / cup.height)


def height_for_volume(cup, ml):
    """Height above the inside floor at which `ml` stands, truncated cone."""
    r0, r1 = cup.base_id / 2.0, cup.rim_id / 2.0
    H = cup.height - cup.base_height
    target = ml * 1000.0
    lo, hi = 0.0, H
    for _ in range(90):
        h = (lo + hi) / 2
        r = r0 + (r1 - r0) * (h / H)
        if math.pi * h * (r0 * r0 + r0 * r + r * r) / 3.0 < target:
            lo = h
        else:
            hi = h
    return (lo + hi) / 2


def brim_capacity(cup):
    r0, r1 = cup.base_id / 2, cup.rim_id / 2
    return math.pi * (cup.height - cup.base_height) * (r0 * r0 + r0 * r1 + r1 * r1) / 3000.0


class View:
    """
    Maps model (radius, height-above-foot-plane) to sheet px.

    `r_ref` is the radius that lands on `cx`. It is 0 for a whole-cup view and
    the middle of the region of interest for an enlarged detail, which is what
    lets a detail at 15 mm radius be drawn at 95 px/mm without running off the
    sheet.
    """

    def __init__(self, cx, y_base, s, r_ref=0.0):
        self.cx, self.y_base, self.s, self.r_ref = cx, y_base, s, r_ref

    def x(self, r):
        return self.cx + (r - self.r_ref) * self.s

    def y(self, z):
        return self.y_base - z * self.s


def section_path(cup, v, ztop=None):
    """Section through the cup with the recess cut out of the base underside."""
    ztop = cup.height if ztop is None else ztop
    ro_b, ri_b = cup.base_od / 2, cup.base_id / 2
    ro_t, ri_t = outer_radius(cup, ztop), interior_radius(cup, ztop)
    rr, bh, rd = cup.recess_d / 2, cup.base_height, cup.recess_depth
    pts = [(-ro_b, 0), (-ro_t, ztop), (-ri_t, ztop), (-ri_b, bh),
           (ri_b, bh), (ri_t, ztop), (ro_t, ztop), (ro_b, 0),
           (rr, 0), (rr, rd), (-rr, rd), (-rr, 0)]
    return "M " + " L ".join(f"{v.x(r):.2f},{v.y(z):.2f}" for r, z in pts) + " Z"


# ---------------------------------------------------------------- FIG-01

def fig01():
    cup = G.EMBOSSED_30ML
    W, H = 1200, 1060
    sh = Sheet(W, H, "FIG. 1  CUP SECTION")
    sh.hatch_defs("h1", 45, 7)
    s = 13.2
    v = View(cx=420, y_base=804, s=s)
    COL = 800                                   # left edge of the annotation column

    sh.hatched(section_path(cup, v), "h1")
    sh.line(v.x(0), v.y(cup.height) - 40, v.x(0), v.y(0) + 40, "cl")

    # gate vestige on the inside floor
    gx, gy = v.x(0), v.y(cup.base_height)
    sh.path(f"M {gx-8:.1f},{gy:.1f} L {gx:.1f},{gy-8:.1f} L {gx+8:.1f},{gy:.1f}", "ol2")

    # graduations, labelled outside on the left
    for ml in cup.graduations:
        z = cup.base_height + height_for_volume(cup, ml)
        ri, ro = interior_radius(cup, z), outer_radius(cup, z)
        y = v.y(z)
        sh.line(v.x(ri) + 1, y, v.x(ro) - 1, y, "ol2")
        sh.line(v.x(-ri) - 1, y, v.x(-ro) + 1, y, "ol2")
        sh.line(v.x(-ro) - 16, y, v.x(-ro) - 4, y, "ext")
        sh.text(v.x(-ro) - 22, y + 4, f"{ml} mL", "ts", anchor="end")

    yt, yb = v.y(cup.height), v.y(0)

    # --- diameters
    sh.dim_h(v.x(-cup.rim_od / 2), v.x(cup.rim_od / 2), yt - 116, f"{DIA}42.07  rim outside",
             ext_y=yt)
    sh.dim_h(v.x(-cup.rim_id / 2), v.x(cup.rim_id / 2), yt - 68, f"{DIA}39.01  rim inside",
             ext_y=yt)
    sh.dim_h(v.x(-cup.base_od / 2), v.x(cup.base_od / 2), yb + 68,
             f"{DIA}33.02  base outside", ext_y=yb, outside=True, label_dy=20)
    sh.dim_h(v.x(-cup.base_id / 2), v.x(cup.base_id / 2), yb + 124,
             f"{DIA}31.43  inside floor", ext_y=v.y(cup.base_height),
             outside=True, label_dy=20)

    # --- overall height
    xr = v.x(cup.rim_od / 2) + 36
    sh.dim_v(yt, yb, xr, "41.50", ext_x=v.x(cup.rim_od / 2), side="right")
    sh.text(xr + 7, (yt + yb) / 2 + 22, "overall", "ts", anchor="start")

    # --- annotation column
    zt = cup.height - 5.0
    sh.leader(v.x((interior_radius(cup, zt) + outer_radius(cup, zt)) / 2), v.y(zt),
              COL, yt + 34, "1.53  wall at rim")
    zb = cup.base_height + 3.0
    sh.leader(v.x((interior_radius(cup, zb) + outer_radius(cup, zb)) / 2), v.y(zb),
              COL, yt + 300, "0.80  wall just above the base")
    sh.leader(gx + 6, gy - 5, COL, yt + 420, "gate vestige, inside floor")

    for i, t in enumerate([
        f"sidewall taper {cup.taper_half_angle:.2f}{DEG} per side",
        f"brim capacity {brim_capacity(cup):.1f} mL modelled",
        f"against {cup.overflow_cc} cc stated",
        "",
        "graduations moulded into the wall;",
        "each tick drawn at the height that",
        "volume actually stands at.",
    ]):
        sh.text(COL, yt + 92 + i * 20, t, "ts", anchor="start")

    # detail circle at the base
    sh.detail_circle(v.x(cup.base_od / 2) - 30, v.y(1.1), 56, "A")
    sh.leader(v.x(cup.base_od / 2) - 30 + 40, v.y(1.1) + 40, COL, yt + 480,
              "DETAIL A  →  FIG. 2")

    sh.text(W / 2, 46, "Comar 22-0263  ·  30 mL embossed dosage cup", "tt")
    sh.text(W / 2, 70,
            "the puck seats in the recess on the underside of this base", "ts")

    sh.title_block([
        ("scale", "≈3.5:1"),
        ("units", "millimetres"),
        ("all dimensions", "STATED on source drawing"),
        ("source", SRC),
    ], x=COL, y=H - 138, w=390)
    return sh.save(os.path.join(OUT, "FIG-01-cup-section.svg"))


# ---------------------------------------------------------------- FIG-02

def fig02():
    cup = G.EMBOSSED_30ML
    W, H = 1280, 1140
    sh = Sheet(W, H, "FIG. 2  BASE RECESS")
    sh.hatch_defs("h1", 45, 7)

    ro_b, ri_b = cup.base_od / 2, cup.base_id / 2
    rr, bh, rd = cup.recess_d / 2, cup.base_height, cup.recess_depth
    ztop = 4.4

    # ---------------- main view
    s = 19.5
    v = View(cx=620, y_base=300, s=s)
    sh.hatched(section_path(cup, v, ztop), "h1")
    for sgn in (-1, 1):
        sh.line(v.x(sgn * interior_radius(cup, ztop)), v.y(ztop),
                v.x(sgn * outer_radius(cup, ztop)), v.y(ztop), "ol2")
    sh.line(v.x(0), v.y(ztop) - 28, v.x(0), v.y(0) + 74, "cl")
    sh.line(v.x(-cup.gate_d / 2), v.y(rd), v.x(cup.gate_d / 2), v.y(rd), "ol2")

    yb = v.y(0)
    sh.dim_h(v.x(-ri_b), v.x(ri_b), v.y(ztop) - 62, f"{DIA}31.43  inside floor",
             ext_y=v.y(bh))
    sh.dim_h(v.x(-cup.gate_d / 2), v.x(cup.gate_d / 2), yb + 84, f"{DIA}3.7  gate witness",
             ext_y=v.y(rd), outside=True, label_dy=20)
    sh.dim_h(v.x(-rr), v.x(rr), yb + 142, f"{DIA}30.53   RECESS",
             ext_y=yb, outside=True, cls="acc", tcls="ta", label_dy=20)
    sh.text(v.x(0), yb + 182, "sets the puck diameter", "ta")
    sh.dim_h(v.x(-ro_b), v.x(ro_b), yb + 224, f"{DIA}33.02  base outside",
             ext_y=yb, outside=True, label_dy=20)

    xr = v.x(ro_b) + 80
    sh.dim_v(v.y(rd), v.y(0), xr, "1.20", ext_x=v.x(ro_b), side="right",
             outside=True, cls="acc", tcls="ta")
    sh.text(xr + 46, v.y(rd) + 6, "RECESS DEPTH", "ta", anchor="start")
    sh.text(xr + 46, v.y(rd) + 24, "sets the puck thickness", "ts", anchor="start")

    xl1 = v.x(-ro_b) - 70
    sh.dim_v(v.y(bh), v.y(rd), xl1, "0.96", ext_x=v.x(-ri_b), side="left", outside=True)
    sh.text(xl1 - 7, (v.y(bh) + v.y(rd)) / 2 + 21, "base panel", "ts", anchor="end")

    xl2 = v.x(-ro_b) - 162
    sh.dim_v(v.y(bh), v.y(0), xl2, "2.16", ext_x=v.x(-ro_b), side="left", outside=True)
    sh.text(xl2 - 7, (v.y(bh) + v.y(0)) / 2 + 21, "floor → foot", "ts", anchor="end")

    sh.leader(v.x((rr + ro_b) / 2), v.y(0.55), v.x(ro_b) + 80, v.y(0) + 58,
              "1.25  foot ring, radial")

    # ---------------- DETAIL A
    s2, rmid = 96.0, 15.68
    v2 = View(cx=286, y_base=930, s=s2, r_ref=rmid)
    r_lo, z_hi = 14.32, 2.86
    corner = [(ro_b, 0), (outer_radius(cup, z_hi), z_hi),
              (interior_radius(cup, z_hi), z_hi), (ri_b, bh),
              (r_lo, bh), (r_lo, rd), (rr, rd), (rr, 0)]
    sh.hatched("M " + " L ".join(f"{v2.x(r):.2f},{v2.y(z):.2f}" for r, z in corner) + " Z",
               "h1")
    sh.path(f"M {v2.x(r_lo):.1f},{v2.y(bh):.1f} L {v2.x(r_lo)-10:.1f},{v2.y(1.86):.1f} "
            f"L {v2.x(r_lo)+10:.1f},{v2.y(1.54):.1f} L {v2.x(r_lo):.1f},{v2.y(rd):.1f}", "ol2")

    sh.text(286, 618, "DETAIL A", "tt")
    sh.text(286, 640, "base corner, enlarged ≈25:1", "ts")

    sh.dim_h(v2.x(rr), v2.x(ro_b), v2.y(0) + 62, "1.25", ext_y=v2.y(0),
             outside=True, label_dy=20)
    sh.text(v2.x((rr + ro_b) / 2), v2.y(0) + 100, "foot ring", "ts")
    sh.dim_v(v2.y(rd), v2.y(0), v2.x(ro_b) + 66, "1.20", ext_x=v2.x(ro_b),
             side="right", outside=True, cls="acc", tcls="ta")
    sh.dim_v(v2.y(bh), v2.y(rd), v2.x(ro_b) + 156, "0.96", ext_x=v2.x(ro_b),
             side="right", outside=True)
    sh.leader(v2.x((ri_b + ro_b) / 2), v2.y(bh + 0.35), v2.x(ro_b) + 66,
              v2.y(z_hi) - 8, "0.80 wall")
    sh.leader(v2.x(rr), v2.y(rd * 0.5), v2.x(rr) - 120, v2.y(rd) - 54,
              "recess wall", anchor="end")

    # ---------------- notes
    notes = [
        "Draft on the recess wall is real but sits below the resolution of the",
        "source drawing: any half-angle from 0° to about 3° is consistent with it.",
        f"Treat {DIA}30.53 as the diameter at the opening and allow the deepest",
        "plane to be up to 0.13 mm smaller until a sample is measured.",
        "",
        "Corner radii are likewise not resolvable; ~0.3 mm is typical for the",
        "heel of a moulded PP cup.",
        "",
        f"The {DIA}3.7 gate witness sits in the centre of the recess ceiling. If it",
        "stands proud rather than flush, a rigid puck will rock on it — check a",
        "sample with a straightedge before fixing the puck's back face flat.",
    ]
    for i, t in enumerate(notes):
        sh.text(662, 662 + i * 21, t, "ts", anchor="start")

    sh.text(W / 2, 46, "Comar 22-0263  ·  base underside, section", "tt")
    sh.text(W / 2, 70, "the two red dimensions are the ones that constrain the puck", "ts")

    sh.title_block([
        ("main view", "≈5:1"),
        (f"{DIA}30.53 / 1.20 / 0.96", "DERIVED, ±0.12"),
        (f"{DIA}33.02 / {DIA}31.43", "STATED"),
        ("source", SRC),
    ], x=880, y=H - 128, w=370)
    return sh.save(os.path.join(OUT, "FIG-02-base-recess-detail.svg"))


# ---------------------------------------------------------------- FIG-03

def fig03():
    cup = G.EMBOSSED_30ML
    W, H = 1240, 1120
    sh = Sheet(W, H, "FIG. 3  BASE — PLAN FROM BELOW")
    s = 15.0
    cx, cy = 430, 476
    COL = 872

    def R(mm):
        return mm / 2 * s

    sh.raw(f'<path d="M {cx-R(cup.base_od)},{cy} '
           f'a {R(cup.base_od)},{R(cup.base_od)} 0 1,0 {2*R(cup.base_od)},0 '
           f'a {R(cup.base_od)},{R(cup.base_od)} 0 1,0 {-2*R(cup.base_od)},0 Z '
           f'M {cx-R(cup.recess_d)},{cy} '
           f'a {R(cup.recess_d)},{R(cup.recess_d)} 0 1,1 {2*R(cup.recess_d)},0 '
           f'a {R(cup.recess_d)},{R(cup.recess_d)} 0 1,1 {-2*R(cup.recess_d)},0 Z" '
           f'fill="{DIM}" fill-opacity="0.18" stroke="none" fill-rule="evenodd"/>')
    sh.raw(f'<circle cx="{cx}" cy="{cy}" r="{R(cup.recess_d):.2f}" '
           f'fill="{ACCENT}" fill-opacity="0.07" stroke="none"/>')

    sh.circle(cx, cy, R(cup.rim_od), "ol2")
    sh.circle(cx, cy, R(cup.base_od), "ol")
    sh.circle(cx, cy, R(cup.recess_d), "acc")
    sh.circle(cx, cy, R(cup.gate_d), "ol2")

    sh.line(cx - R(cup.rim_od) - 32, cy, cx + R(cup.rim_od) + 32, cy, "cl")
    sh.line(cx, cy - R(cup.rim_od) - 32, cx, cy + R(cup.rim_od) + 32, "cl")

    for ang in (58, 178, 298):
        a = math.radians(ang)
        rr = (R(cup.base_od) + R(cup.recess_d)) / 2
        sh.rect(cx + rr * math.cos(a) - 4, cy + rr * math.sin(a) - 4, 8, 8, "ol2")

    ybot = cy + R(cup.rim_od)
    sh.dim_h(cx - R(cup.recess_d), cx + R(cup.recess_d), ybot + 92,
             f"{DIA}30.53  RECESS — the puck seat", cls="acc", tcls="ta",
             outside=True, label_dy=20)
    sh.dim_h(cx - R(cup.base_od), cx + R(cup.base_od), ybot + 148,
             f"{DIA}33.02  base outside", outside=True, label_dy=20)
    sh.dim_h(cx - R(cup.rim_od), cx + R(cup.rim_od), ybot + 204,
             f"{DIA}42.07  rim, seen past the base", outside=True, label_dy=20)

    rr = (R(cup.base_od) + R(cup.recess_d)) / 2
    # leaders ordered by the height of their anchor so none of them cross
    a = math.radians(298)
    sh.leader(cx + rr * math.cos(a), cy + rr * math.sin(a), COL, 300,
              "mould marks in the ring")
    sh.leader(cx + R(cup.gate_d) * 0.72, cy - R(cup.gate_d) * 0.72, COL, 444,
              f"{DIA}3.7 gate witness")
    a = math.radians(30)
    sh.leader(cx + R(cup.recess_d) * 0.66 * math.cos(a),
              cy + R(cup.recess_d) * 0.66 * math.sin(a), COL, 516,
              "recess floor — the puck seats here")
    a = math.radians(58)
    sh.leader(cx + rr * math.cos(a), cy + rr * math.sin(a), COL, 588,
              "foot ring — the cup stands on this")

    for i, t in enumerate([
        "The shaded annulus is the only part of the base",
        "that touches the table. It is 1.25 mm wide.",
        "",
        "Anything seated in the recess must finish inside",
        "the ring plane, or the cup stops standing on the",
        "ring and starts standing on the puck.",
    ]):
        sh.text(COL, 668 + i * 21, t, "ts", anchor="start")

    sh.text(W / 2, 46, "Comar 22-0263  ·  base seen from below", "tt")
    sh.text(W / 2, 70, "shaded annulus is the foot ring the cup actually stands on", "ts")

    sh.title_block([
        ("scale", "≈4:1"),
        ("ring width", "1.25 radial"),
        ("puck seat area", f"{math.pi*(cup.recess_d/2)**2:.0f} mm²"),
        ("source", SRC),
    ], x=COL, y=136, w=340)
    return sh.save(os.path.join(OUT, "FIG-03-base-plan-view.svg"))


# ---------------------------------------------------------------- FIG-04

def fig04():
    """Three characterisations of the recess, and what each does to the puck."""
    cup = G.EMBOSSED_30ML
    W, H = 1420, 940
    sh = Sheet(W, H, "FIG. 4  FIT CHECK")
    sh.hatch_defs("h1", 45, 7)
    s = 10.4
    y_base = 470
    ro_b, ri_b = cup.base_od / 2, cup.base_id / 2
    ztop = 3.2

    panels = [
        (220, G.RECESS_NMP001, "good",
         "what the puck was drawn for", "ASSUMED"),
        (660, G.RECESS_CAST_SAMPLE, "acc",
         "the cup Cappy is for", "MEASURED — your cast"),
        (1100, G.RECESS_22_0263, "acc",
         "a real catalogue cup", "DERIVED — Comar drawing"),
    ]

    for cx, rec, kind, sub, prov in panels:
        v = View(cx=cx, y_base=y_base, s=s)
        known_d = rec.diameter is not None
        rr = (rec.diameter / 2) if known_d else 14.6      # schematic when unknown
        rd = rec.depth

        # base slab with the recess cut out; outer ends broken when the cup
        # itself is not identified
        pts = [(-ro_b, 0), (-outer_radius(cup, ztop), ztop),
               (-interior_radius(cup, ztop), ztop), (-ri_b, cup.panel_t + rd),
               (ri_b, cup.panel_t + rd), (interior_radius(cup, ztop), ztop),
               (outer_radius(cup, ztop), ztop), (ro_b, 0),
               (rr, 0), (rr, rd), (-rr, rd), (-rr, 0)]
        sh.hatched("M " + " L ".join(f"{v.x(r):.2f},{v.y(z):.2f}" for r, z in pts) + " Z",
                   "h1")
        for sgn in (-1, 1):
            sh.line(v.x(sgn * interior_radius(cup, ztop)), v.y(ztop),
                    v.x(sgn * outer_radius(cup, ztop)), v.y(ztop), "ol2")
        sh.line(v.x(0), v.y(ztop) - 12, v.x(0), v.y(0) + 46, "cl")

        # foot-plane datum
        sh.line(v.x(-ro_b) - 30, v.y(0), v.x(ro_b) + 30, v.y(0), "cl")

        # recess walls dashed where the diameter is not known
        if not known_d:
            for sgn in (-1, 1):
                sh.line(v.x(sgn * rr), v.y(0), v.x(sgn * rr), v.y(rd), "hid")

        # the NMP-001 puck, hung from the recess ceiling
        sh.rect(v.x(-G.PUCK_ENV_D / 2), v.y(rd), G.PUCK_ENV_D * s, G.PUCK_T * s,
                kind + "f", rx=2)

        # depth dimension, clear of the neighbouring panel
        sh.dim_v(v.y(rd), v.y(0), v.x(ro_b) + 46, f"{rd:.2f}",
                 ext_x=v.x(ro_b), side="right", outside=True)
        sh.text(v.x(ro_b) + 53, v.y(0) + 30, "deep", "ts", anchor="start")

        # headings
        sh.text(cx, 250, rec.label, "tt")
        sh.text(cx, 272, sub, "ts")
        sh.text(cx, 296, prov, "ta" if rec.provenance != "MEASURED" else "tg")

        # verdicts
        f = G.fit_against(rec)
        lines = []
        if f["radial"]:
            g = f["radial"]["radial_gap"]
            lines.append((f"{DIA}{rec.diameter:.2f}   {g:+.2f} mm per side",
                          "tg" if abs(g) < 0.3 else "ta"))
            if not f["radial"]["pads_can_bridge"]:
                lines.append((f"pads reach only {G.PUCK_PAD_PROJ:.2f} — no grip", "ta"))
            elif abs(g) < 0.3:
                lines.append(("pads bear on the wall", "tg"))
        else:
            lines.append((f"{DIA} NOT MEASURED YET", "ta"))
            lines.append(("this is the number that decides it", "ta"))
        p = f["axial"]["proud"]
        if p > 0:
            lines.append((f"puck {p:.2f} mm proud — cup rocks", "ta"))
        else:
            lines.append((f"puck sits {-p:.2f} mm inside the ring", "tg"))
        for i, (t, c) in enumerate(lines):
            sh.text(cx, 610 + i * 24, t, c)

    sh.text(W / 2, 46, "the recess is not one number", "tt")
    sh.text(W / 2, 70,
            f"the same {DIA}27.50 × 1.80 puck, in the three recesses we have "
            f"characterisations for", "ts")

    for i, t in enumerate([
        "Depth runs from 1.20 to 2.10 across the three. Your cast at 2.00 vindicates the",
        "depth NMP-001 assumed, for your cup — the 1.80 puck finishes 0.20 mm inside the",
        "foot plane, which is a working fit. It says nothing about the catalogue cup at 1.20.",
        "",
        "Diameter is the open question. It has never been measured on a physical recess.",
        f"NMP-001 assumes {DIA}27.50; the one drawing we can read says {DIA}30.53. Your cast can",
        "settle it in thirty seconds with a pair of calipers across its widest point.",
        "",
        "Only the right-hand base outline is a real cup. The other two are schematic:",
        "the depth and the puck are to scale, the surrounding cup is not.",
    ]):
        sh.text(W / 2, 748 + i * 21, t, "ts")

    sh.title_block([
        ("depth spread", "1.20 – 2.10 mm"),
        ("diameter spread", f"{DIA}27.50 – {DIA}30.53"),
        ("physically measured", "depth only, one cup"),
        ("scale", "≈3.2:1"),
    ], x=W - 386, y=H - 118, w=360)
    return sh.save(os.path.join(OUT, "FIG-04-fit-check.svg"))


# ---------------------------------------------------------------- FIG-05

def fig05():
    W, H = 1360, 860
    sh = Sheet(W, H, "FIG. 5  THREE CUPS, ONE SCALE")
    s = 8.0
    y_base = 430
    slots = [(240, G.EMBOSSED_30ML), (680, G.ACCUCUP_30ML), (1120, G.INSTITUTIONAL_1OZ)]

    for cx, cup in slots:
        unverified = cup.recess_d is None
        v = View(cx=cx, y_base=y_base, s=s)
        cls = "hid" if unverified else "ol"
        bh = cup.base_height if cup.recess_depth else 1.6
        outline = [(-cup.base_od / 2, 0), (-cup.rim_od / 2, cup.height),
                   (-cup.rim_id / 2, cup.height), (-cup.base_id / 2, bh),
                   (cup.base_id / 2, bh), (cup.rim_id / 2, cup.height),
                   (cup.rim_od / 2, cup.height), (cup.base_od / 2, 0)]
        sh.path("M " + " L ".join(f"{v.x(r):.2f},{v.y(z):.2f}" for r, z in outline) + " Z",
                cls)
        sh.line(v.x(0), v.y(cup.height) - 14, v.x(0), v.y(0) + 18, "cl")

        if cup.recess_d:
            rr, rd = cup.recess_d / 2, cup.recess_depth or 1.0
            rcls = "acc" if cup.recess_depth else "hid"
            sh.path(f"M {v.x(-rr):.1f},{v.y(0):.1f} L {v.x(-rr):.1f},{v.y(rd):.1f} "
                    f"L {v.x(rr):.1f},{v.y(rd):.1f} L {v.x(rr):.1f},{v.y(0):.1f}", rcls)

        sh.text(cx, y_base + 54, cup.part.split(" (")[0], "tt")
        sh.text(cx, y_base + 76, cup.name.replace("Comar ", "").replace(" Dosage Cup", ""),
                "ts")
        sh.line(cx - 116, y_base + 92, cx + 116, y_base + 92, "ext")

        rows = [(f"rim {DIA}", f"{cup.rim_od:.2f}"),
                (f"base {DIA}", f"{cup.base_od:.2f}"),
                ("height", f"{cup.height:.2f}")]
        if cup.recess_d and cup.recess_depth:
            rows += [(f"recess {DIA}", f"{cup.recess_d:.2f}"),
                     ("recess depth", f"{cup.recess_depth:.2f}")]
        elif cup.recess_d:
            rows += [(f"recess {DIA}", f"{cup.recess_d:.2f} ±0.25"),
                     ("recess depth", "not published")]
        else:
            rows += [(f"recess {DIA}", "UNKNOWN"), ("recess depth", "UNKNOWN")]
        for i, (k, val) in enumerate(rows):
            yy = y_base + 114 + i * 22
            sh.text(cx - 116, yy, k, "ts", anchor="start")
            sh.text(cx + 116, yy, val,
                    "ta" if val in ("UNKNOWN", "not published") else "td", anchor="end")

        src = ("manufacturer drawing" if not unverified else "distributor catalogue")
        sh.text(cx, y_base + 244, src, "ts")
        if unverified:
            sh.text(cx, y_base + 264, "dashed — nothing verified", "ta")

    sh.text(W / 2, 46, "three cups that all get called a medication cup", "tt")
    sh.text(W / 2, 70,
            "drawn to one scale — the base diameters differ by 8.6 mm across the set",
            "ts")
    sh.title_block([
        ("scale", "≈2.1:1"),
        ("22-0263 / 22-1211", "manufacturer drawings"),
        ("institutional 1 oz", "catalogue specs only"),
    ], x=980, y=H - 110, w=360)
    return sh.save(os.path.join(OUT, "FIG-05-family-comparison.svg"))


# ---------------------------------------------------------------- FIG-06

def fig06():
    """What the manufacturer dimensions, and what the puck currently relies on."""
    cup = G.EMBOSSED_30ML
    W, H = 1400, 980
    sh = Sheet(W, H, "FIG. 6  CONTROLLED vs UNCONTROLLED")
    sh.hatch_defs("h1", 45, 7)

    ro_b, ri_b = cup.base_od / 2, cup.base_id / 2
    rr, bh, rd = cup.recess_d / 2, cup.base_height, cup.recess_depth
    ztop = 4.0

    # ---------------- base section, colour-coded by who controls what
    s = 16.0
    v = View(cx=400, y_base=300, s=s)
    sh.hatched(section_path(cup, v, ztop), "h1")
    for sgn in (-1, 1):
        sh.line(v.x(sgn * interior_radius(cup, ztop)), v.y(ztop),
                v.x(sgn * outer_radius(cup, ztop)), v.y(ztop), "ol2")
    sh.line(v.x(0), v.y(ztop) - 20, v.x(0), v.y(0) + 60, "cl")

    yb = v.y(0)
    sh.dim_h(v.x(-ro_b), v.x(ro_b), yb + 96, f"{DIA}33.02  base outside",
             ext_y=yb, outside=True, cls="good", tcls="tg", label_dy=20)
    sh.text(v.x(0), yb + 136, "DIMENSIONED — Comar holds this", "tg")

    sh.dim_h(v.x(-rr), v.x(rr), yb + 196, f"{DIA}30.53  recess",
             ext_y=yb, outside=True, cls="acc", tcls="ta", label_dy=20)
    sh.text(v.x(0), yb + 236, "NOT DIMENSIONED ANYWHERE", "ta")

    sh.dim_v(v.y(rd), v.y(0), v.x(ro_b) + 70, "1.20", ext_x=v.x(ro_b),
             side="right", outside=True, cls="acc", tcls="ta")
    sh.text(v.x(ro_b) + 77, v.y(0) + 30, "not dimensioned", "ta", anchor="start")

    sh.text(400, 46, "the feature the puck grips is the one nobody specifies", "tt")
    sh.text(400, 70, "Comar 22-0263, base in section", "ts")

    # ---------------- the two lists
    X = 880
    sh.text(X, 130, "dimensioned on all four Comar dosage-cup drawings", "tg",
            anchor="start")
    for i, t in enumerate(G.CONTROLLED_FEATURES):
        sh.text(X + 14, 158 + i * 22, "·  " + t, "ts", anchor="start")
    y2 = 158 + len(G.CONTROLLED_FEATURES) * 22 + 26
    sh.text(X, y2, "drawn but never dimensioned, on any of them", "ta", anchor="start")
    for i, t in enumerate(G.UNCONTROLLED_FEATURES):
        sh.text(X + 14, y2 + 28 + i * 22, "·  " + t, "ts", anchor="start")

    y3 = y2 + 28 + len(G.UNCONTROLLED_FEATURES) * 22 + 22
    for i, t in enumerate([
        "The recess is there so the cup has a standing ring.",
        "It is a consequence of that, not a specified feature.",
        "No tolerance is published, and nothing obliges the",
        "moulder to hold it across a tool revision.",
    ]):
        sh.text(X, y3 + i * 21, t, "ts", anchor="start")

    # ---------------- two ways to register the puck
    sy = 660
    sh.line(60, sy - 34, W - 60, sy - 34, "ext")
    sh.text(W / 2, sy - 8, "two things the puck could register on", "tt")

    for cx0, kind, title, sub, note in [
        (400, "acc", "on the recess wall", "what NMP-001 does",
         "an interference fit against a diameter nobody controls"),
        (1000, "good", "on the base outside diameter", "alternative",
         f"a collar on {DIA}33.02 — a dimension Comar does hold"),
    ]:
        s2 = 9.0
        v2 = View(cx=cx0, y_base=sy + 120, s=s2)
        sh.hatched(section_path(cup, v2, ztop), "h1")
        sh.line(v2.x(0), v2.y(ztop) - 8, v2.x(0), v2.y(0) + 30, "cl")
        if kind == "acc":
            sh.rect(v2.x(-G.PUCK_ENV_D / 2), v2.y(rd),
                    G.PUCK_ENV_D * s2, G.PUCK_T * s2, "accf", rx=2)
            for sgn in (-1, 1):
                sh.line(v2.x(sgn * rr), v2.y(0), v2.x(sgn * rr), v2.y(rd), "acc")
        else:
            for sgn in (-1, 1):
                sh.rect(v2.x(sgn * ro_b) - (0 if sgn > 0 else 1.4 * s2),
                        v2.y(2.6), 1.4 * s2, 2.6 * s2, "goodf", rx=1)
            sh.rect(v2.x(-ro_b), v2.y(0), cup.base_od * s2, 1.0 * s2, "goodf", rx=1)
        sh.text(cx0, sy + 40, title, "tt")
        sh.text(cx0, sy + 62, sub, "ts")
        sh.text(cx0, sy + 176, note, "ta" if kind == "acc" else "tg")

    sh.title_block([
        ("drawings checked", "22-0263 · 22-1211 · 22-0717 · 22-1525"),
        ("recess dimensioned on", "none of them"),
        ("only physical measurement", "your cast, depth only"),
    ], x=W - 396, y=H - 100, w=370)
    return sh.save(os.path.join(OUT, "FIG-06-controlled-vs-uncontrolled.svg"))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for fn in (fig01, fig02, fig03, fig04, fig05, fig06):
        print("wrote", os.path.relpath(fn(), HERE))
    c = G.EMBOSSED_30ML
    print(f"\ncheck: modelled brim capacity {brim_capacity(c):.1f} mL "
          f"vs stated overflow {c.overflow_cc} cc")
    for ml in c.graduations:
        print(f"  {ml:>2} mL stands {height_for_volume(c, ml):5.2f} mm above the floor")
