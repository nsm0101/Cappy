"""
Mechanical figures: FIG. 1-4 and FIG. 10-12.

All of these are drawn from geometry.py, so the token always comes out at
27.50 / 30.50 = 0.902 of the base outside diameter. Nothing here hard-codes a
token size, and FIG. 1 is drawn at a single true scale in both axes.
"""

import math

import geometry as G
from patentkit import (
    SIGHT_X0, SIGHT_X1, TOP, MIN_FONT,
    LW_OUTLINE, LW_NORMAL, LW_THIN,
    HATCH_VESSEL, HATCH_CORE, HATCH_PAD, draw_qr,
)

CX = (SIGHT_X0 + SIGHT_X1) / 2.0     # sheet centre line

ISO_K = 0.30    # vertical foreshortening of every circle in axonometric view


# ------------------------------------------------------------------ helpers

def _lobe_radius(deg, r_core, r_env, phase=0.0):
    """
    Radius of the six-pad outline at `deg`. Each pad root spans PAD_SPAN of the
    core perimeter at r_env; the PAD_GAP between roots eases smoothly back to
    r_core, per note 3 of NMP-001 ("smooth lobe profile is proposed").
    """
    pitch = 360.0 / G.PAD_N
    loc = (deg - phase) % pitch
    d = abs(loc - pitch / 2.0)          # angular distance from the pad centre
    half = G.PAD_SPAN / 2.0
    if d <= half:
        return r_env
    # smooth scallop across the remainder of the pitch sector
    t = (d - half) / max(1e-6, (pitch / 2.0 - half))
    t = min(1.0, t)
    return r_env + (r_core - r_env) * (0.5 - 0.5 * math.cos(math.pi * t))


def lobed_points(cx, cy, scale, k=1.0, phase=0.0, steps=900):
    """Cartesian outline of the token, `scale` points per millimetre."""
    r_core = G.CORE_D / 2.0 * scale
    r_env = G.ENV_D / 2.0 * scale
    pts = []
    for i in range(steps):
        deg = 360.0 * i / steps
        r = _lobe_radius(deg, r_core, r_env, phase)
        a = math.radians(deg)
        pts.append((cx + r * math.cos(a), cy + r * k * math.sin(a)))
    return pts


def _ellipse_front(sh, cx, cy, rx, k, lw=LW_NORMAL, dash=None):
    sh.ellipse(cx, cy, rx, rx * k, lw=lw, dash=dash)


# =================================================================== FIG. 1

def fig1(sh):
    """
    Exploded perspective view -- vessel 110 and token 120.

    Drawn at one true scale in both axes: the 1.80 mm token and the 2.10 mm
    recess are legible at 7 pt/mm without any exaggeration, so nothing in this
    view has to be qualified.
    """
    s = 7.0                        # points per millimetre, true in both axes
    k = ISO_K

    r_base = G.BASE_OD / 2.0 * s
    r_rim = G.RIM_OD / 2.0 * s
    r_rim_i = G.RIM_ID / 2.0 * s
    r_rec = G.RECESS_D_OPEN / 2.0 * s
    r_env = G.ENV_D / 2.0 * s
    r_core = G.CORE_D / 2.0 * s

    y_top = TOP - r_rim * k - 20.0           # rim centre (clears sheet number)
    y_base = y_top - G.VESSEL_H * s          # underside of the base
    y_floor = y_base + G.BASE_T * s          # inside floor

    # ---- vessel body ----------------------------------------------------
    sh.line(CX - r_base, y_base, CX - r_rim, y_top, w=LW_OUTLINE)
    sh.line(CX + r_base, y_base, CX + r_rim, y_top, w=LW_OUTLINE)
    _ellipse_front(sh, CX, y_top, r_rim, k, lw=LW_OUTLINE)
    _ellipse_front(sh, CX, y_top, r_rim_i, k, lw=LW_NORMAL)

    # base: front half of the underside solid, far half hidden
    sh.arc_ellipse(CX, y_base, r_base, r_base * k, 180, 360, lw=LW_OUTLINE)
    sh.arc_ellipse(CX, y_base, r_base, r_base * k, 0, 180, lw=LW_THIN,
                   dash=(3, 2.5))
    sh.line(CX - r_base, y_base, CX - r_base, y_floor, w=LW_OUTLINE)
    sh.line(CX + r_base, y_base, CX + r_base, y_floor, w=LW_OUTLINE)
    r_floor = (G.BASE_OD / 2.0 - G.WALL_T) * s
    _ellipse_front(sh, CX, y_floor, r_floor, k, lw=LW_NORMAL)

    # ---- recess 116: 0.902 of the base diameter -------------------------
    sh.arc_ellipse(CX, y_base, r_rec, r_rec * k, 180, 360, lw=LW_NORMAL)
    sh.arc_ellipse(CX, y_base, r_rec, r_rec * k, 0, 180, lw=LW_THIN,
                   dash=(3, 2.5))
    y_deep = y_base + G.RECESS_DEPTH * s
    sh.ellipse(CX, y_deep, G.RECESS_D_DEEP / 2.0 * s,
               G.RECESS_D_DEEP / 2.0 * s * k, lw=LW_THIN, dash=(3, 2.5))

    # ---- graduations ----------------------------------------------------
    for ml, label in G.GRADUATIONS:
        z = G.BASE_T + G.height_for_volume(ml)
        yy = y_base + z * s
        rr = G.sidewall_radius_at(z) * s
        major = ml in (15.0, 30.0)
        w = rr * (0.40 if major else 0.24)
        sh.line(CX - rr + 1.2, yy, CX - rr + 1.2 + w, yy, w=LW_THIN)
        if major:
            sh.text(label, CX - rr + w + 7.0, yy - 3.6, size=MIN_FONT)

    # ---- token 120, exploded on the axis below the vessel ---------------
    gap = 74.0
    y_tok_t = y_base - gap                   # first face 122, facing up
    y_tok_b = y_tok_t - G.PUCK_T * s         # second face 126, facing down

    top = lobed_points(CX, y_tok_t, s, k)
    bot = lobed_points(CX, y_tok_b, s, k, steps=900)
    sh.polyline(top, w=LW_OUTLINE, close=True)
    half = len(bot) // 2
    sh.polyline(bot[half:], w=LW_OUTLINE)      # front (lower) half only
    sh.line(CX - r_env, y_tok_t, CX - r_env, y_tok_b, w=LW_OUTLINE)
    sh.line(CX + r_env, y_tok_t, CX + r_env, y_tok_b, w=LW_OUTLINE)
    _ellipse_front(sh, CX, y_tok_t, r_core, k, lw=LW_THIN, dash=(3, 2.5))
    sh.text("IBUPROFEN", CX, y_tok_t - 3.6, size=MIN_FONT, align="c", bold=True)

    # ---- assembly axis, travel arrow, projection lines ------------------
    sh.centre_line(CX, y_top + r_rim * k + 14, CX, y_tok_b - r_env * k - 22)
    sh.arrow(CX, y_tok_t + r_env * k + 10, CX, y_base - 8, w=LW_NORMAL)
    for sgn in (-1, 1):
        sh.line(CX + sgn * r_env, y_tok_t + 4, CX + sgn * r_env, y_base - 4,
                w=LW_THIN, dash=(2.5, 3))

    # ---- dimensions that carry the corrected proportion -----------------
    y_d = y_tok_b - r_env * k - 34
    sh.dim_line(CX - r_env, y_d, CX + r_env, y_d, "Ø %.2f" % G.ENV_D,
                above=False)
    y_d2 = y_d - 26
    sh.dim_line(CX - r_base, y_d2, CX + r_base, y_d2, "Ø %.2f" % G.BASE_OD,
                above=False)
    for sgn in (-1, 1):
        sh.line(CX + sgn * r_env, y_tok_b - r_env * k - 4, CX + sgn * r_env,
                y_d - 5, w=LW_THIN)
        sh.line(CX + sgn * r_base, y_base - r_base * k - 4, CX + sgn * r_base,
                y_d2 - 5, w=LW_THIN)

    # ---- reference numerals ---------------------------------------------
    sh.ref(110, CX + r_rim + 34, y_top - 30, CX + r_rim - 5, y_top - 42)
    sh.ref(112, SIGHT_X0 + 2, y_top - 108, CX - r_base - 24, y_top - 122)
    sh.ref(114, CX + r_base + 44, y_floor - 6, CX + r_base - 4, y_floor - 9)
    sh.ref(118, CX + r_base + 44, y_base - 30, CX + r_base * 0.62,
           y_base - r_base * k * 0.78, elbow=[(CX + r_base + 26, y_base - 30)])
    sh.ref(116, SIGHT_X0 + 2, y_base - 30, CX - r_rec + 6, y_base - 6,
           elbow=[(CX - r_base - 24, y_base - 30)])
    sh.ref(120, CX + r_env + 46, y_tok_t - 22, CX + r_env - 2, y_tok_t - 10)
    sh.ref(122, SIGHT_X0 + 2, y_tok_t + 22, CX - r_core * 0.55, y_tok_t + 3,
           elbow=[(CX - r_env - 22, y_tok_t + 22)])
    sh.ref(130, SIGHT_X0 + 2, y_tok_b - 6, CX - r_env - 1, y_tok_b + 5,
           elbow=[(CX - r_env - 22, y_tok_b - 6)])
    sh.ref(126, CX + r_env + 46, y_tok_b - 34, CX + r_core * 0.42,
           y_tok_b - r_core * k * 0.66)

    sh.caption("FIG. 1",
               "EXPLODED PERSPECTIVE VIEW — VESSEL 110 AND TOKEN 120. "
               "DRAWN TO A SINGLE TRUE SCALE: TOKEN 120 AND RECESS 116 SPAN "
               "%.1f%% OF BASE 114." % (100 * G.TOKEN_TO_BASE),
               y_d2 - 24, width=430)


# =================================================================== FIG. 2

def fig2(sh):
    """Sectional view -- token 120 seated in recess 116."""
    s = 9.0            # points per millimetre, radial (true)
    sv = 9.0 * 5.2     # axial exaggeration

    r_base = G.BASE_OD / 2.0 * s
    r_rec_o = G.RECESS_D_OPEN / 2.0 * s
    r_rec_d = G.RECESS_D_DEEP / 2.0 * s
    r_env = G.ENV_D / 2.0 * s
    r_core = G.CORE_D / 2.0 * s

    y_wall_top = TOP - 16.0
    y_wall_h = 118.0
    y_floor = y_wall_top - y_wall_h
    y_deep = y_floor - (G.BASE_T - G.RECESS_DEPTH) * sv
    y_base = y_floor - G.BASE_T * sv

    # ---- vessel: base 114 and sidewall 112, hatched as one part ---------
    sh.polyline([(CX - r_base, y_floor), (CX - r_base, y_base),
                 (CX - r_rec_o, y_base)], w=LW_OUTLINE)
    sh.polyline([(CX + r_base, y_floor), (CX + r_base, y_base),
                 (CX + r_rec_o, y_base)], w=LW_OUTLINE)
    sh.line(CX - r_rec_o, y_base, CX - r_rec_d, y_deep, w=LW_OUTLINE)
    sh.line(CX + r_rec_o, y_base, CX + r_rec_d, y_deep, w=LW_OUTLINE)
    sh.line(CX - r_rec_d, y_deep, CX + r_rec_d, y_deep, w=LW_OUTLINE)
    r_in = r_base - G.WALL_T * s
    sh.line(CX - r_in, y_floor, CX + r_in, y_floor, w=LW_OUTLINE)

    for sgn in (-1, 1):
        sh.hatch_poly([(CX + sgn * r_base, y_base), (CX + sgn * r_rec_o, y_base),
                       (CX + sgn * r_rec_d, y_deep), (CX + sgn * r_base, y_deep)],
                      **HATCH_VESSEL)
    sh.hatch_rect(CX - r_base, y_deep, 2 * r_base, y_floor - y_deep,
                  **HATCH_VESSEL)

    r_out_top = G.sidewall_radius_at(G.BASE_T + y_wall_h / sv) * s
    for sgn in (-1, 1):
        ob, ot = CX + sgn * r_base, CX + sgn * r_out_top
        ib = CX + sgn * (r_base - G.WALL_T * s)
        it = CX + sgn * (r_out_top - G.WALL_T * s)
        sh.line(ob, y_floor, ot, y_wall_top, w=LW_OUTLINE)
        sh.line(ib, y_floor, it, y_wall_top, w=LW_OUTLINE)
        sh.line(it, y_wall_top, ot, y_wall_top, w=LW_THIN)
        sh.hatch_poly([(ob, y_floor), (ot, y_wall_top), (it, y_wall_top),
                       (ib, y_floor)], **HATCH_VESSEL)

    # ---- token 120 seated in the recess ---------------------------------
    y_tok_b = y_base + G.FACE_RECESS * sv     # second face 126
    y_tok_t = y_tok_b + G.PUCK_T * sv         # first face 122

    sh.rect(CX - r_env, y_tok_b, 2 * r_env, y_tok_t - y_tok_b, lw=LW_OUTLINE)
    sh.hatch_rect(CX - r_core, y_tok_b, 2 * r_core, y_tok_t - y_tok_b,
                  **HATCH_CORE)
    for sgn in (-1, 1):
        a, b = sorted([CX + sgn * r_core, CX + sgn * r_env])
        sh.hatch_rect(a, y_tok_b, b - a, y_tok_t - y_tok_b, **HATCH_PAD)
        sh.line(CX + sgn * r_core, y_tok_b, CX + sgn * r_core, y_tok_t,
                w=LW_THIN)

    # sealed NFC inlay 134 in interior cavity 132
    iw = G.INLAY_D / 2.0 * s
    ih = G.INLAY_T * sv * 1.9
    icy = (y_tok_b + y_tok_t) / 2.0
    sh.rect(CX - iw, icy - ih / 2.0, 2 * iw, ih, lw=LW_NORMAL)

    # ---- the two diameters, stacked below -------------------------------
    y_d1 = y_base - 30
    y_d2 = y_d1 - 26
    sh.dim_line(CX - r_env, y_d1, CX + r_env, y_d1,
                "Ø %.2f  TOKEN 120" % G.ENV_D, above=False)
    sh.dim_line(CX - r_base, y_d2, CX + r_base, y_d2,
                "Ø %.2f  BASE 114" % G.BASE_OD, above=False)
    for sgn in (-1, 1):
        sh.line(CX + sgn * r_env, y_tok_b - 3, CX + sgn * r_env, y_d1 - 5,
                w=LW_THIN)
        sh.line(CX + sgn * r_base, y_base - 3, CX + sgn * r_base, y_d2 - 5,
                w=LW_THIN)

    sh.centre_line(CX, y_d2 - 14, CX, y_wall_top + 12)

    # ---- reference numerals ---------------------------------------------
    sh.ref(110, CX + r_out_top + 26, y_wall_top - 30, CX + r_out_top - 6,
           y_wall_top - 40)
    sh.ref(112, SIGHT_X0 + 6, y_wall_top - 30, CX - r_out_top + 4,
           y_wall_top - 40)
    xr = CX + r_base + 30           # right numeral column
    xl = SIGHT_X0 + 6               # left numeral column
    ebr = CX + r_base + 18          # right elbow
    ebl = CX - r_base - 18          # left elbow

    sh.ref(114, xr, y_floor - 26, CX + r_base - 8, y_floor - 30)
    sh.ref(120, xr, y_floor - 56, CX + r_core * 0.86, y_tok_t - 4,
           elbow=[(ebr, y_floor - 56)])
    sh.ref(134, xr, icy - 6, CX + iw * 0.55, icy)
    sh.ref(130, xr, y_tok_b + 2, CX + r_env - 1, y_tok_b + 6,
           elbow=[(ebr, y_tok_b + 2)])
    sh.ref(118, xr, y_base - 30, CX + r_base - 8, y_base,
           elbow=[(ebr, y_base - 30)])

    sh.ref(122, xl, y_tok_t + 4, CX - r_core * 0.72, y_tok_t,
           elbow=[(ebl, y_tok_t + 4)])
    sh.ref(132, xl, icy + 14, CX - iw, icy + ih / 2.0, elbow=[(ebl, icy + 14)])
    sh.ref(126, xl, y_tok_b - 22, CX - r_core * 0.72, y_tok_b,
           elbow=[(ebl, y_tok_b - 22)])
    sh.ref(116, xl, y_base - 34, CX - r_rec_o + 2, y_base - 1,
           elbow=[(ebl, y_base - 34)])

    bottom = sh.note(
        "TOKEN 120 OCCUPIES %.1f%% OF THE BASE DIAMETER; ONLY %.2f mm OF BASE "
        "WALL REMAINS OUTBOARD OF RECESS 116." % (100 * G.TOKEN_TO_BASE,
                                                  G.annulus_wall()),
        CX, y_d2 - 32, width=420, bold=True)

    sh.caption("FIG. 2",
               "SECTIONAL VIEW — TOKEN 120 SEATED IN RECESS 116. RADIAL SCALE "
               "TRUE; AXIAL SCALE EXAGGERATED. SECOND FACE 126 LIES %.2f mm "
               "INSIDE LOWERMOST SURFACE 118, AND PERIPHERAL SIDEWALL 130 "
               "BEARS ON THE RECESS WALL." % G.FACE_RECESS,
               bottom - 6, width=430)


# ============================================================== FIG. 3 / 4

def _face_outline(sh, cx, cy, s):
    sh.polyline(lobed_points(cx, cy, s, 1.0), w=LW_OUTLINE, close=True)
    sh.circle(cx, cy, G.CORE_D / 2.0 * s, lw=LW_THIN, dash=(4, 3))


def fig3_fig4(sh):
    """Plan views of both token faces, side by side on one sheet."""
    s = 6.4
    r_env = G.ENV_D / 2.0 * s
    r_core = G.CORE_D / 2.0 * s

    lx = SIGHT_X0 + 138.0
    rx = SIGHT_X1 - 138.0
    cy = TOP - 124.0

    for cx in (lx, rx):
        _face_outline(sh, cx, cy, s)
        sh.centre_marks(cx, cy, r_env)
        sh.dim_line(cx - r_env, cy - r_env - 30, cx + r_env, cy - r_env - 30,
                    "Ø %.2f" % G.ENV_D, above=False)
        for sgn in (-1, 1):
            sh.line(cx + sgn * r_env, cy - r_env + 4, cx + sgn * r_env,
                    cy - r_env - 35, w=LW_THIN)

    # ---------------- FIG. 3 : first face 122, medication indicia --------
    sh.text("IBUPROFEN", lx, cy + 14, size=13.5, align="c", bold=True)
    sh.text("100 mg / 5 mL", lx, cy - 4, size=MIN_FONT, align="c")
    sh.text("C A P P Y !", lx, cy - 24, size=MIN_FONT, align="c")

    sh.ref(122, lx - r_env - 44, cy + r_env + 4, lx - r_core * 0.62,
           cy + r_core * 0.58)
    sh.ref(124, lx - r_env - 44, cy - r_env - 4, lx - r_core * 0.62,
           cy - r_core * 0.58)
    sh.fig_label("FIG. 3", lx, cy - r_env - 68,
                 sub="PLAN VIEW — FIRST FACE 122. FACES UPWARD INTO BASE 114 "
                     "AND IS READ THROUGH THE TRANSPARENT BASE.",
                 width=200)

    # ---------------- FIG. 4 : second face 126, optical code -------------
    draw_qr(sh, rx, cy - 2.0, r_core * 1.02, seed=23)
    sh.text("C A P P Y !", rx, cy + r_core * 0.76, size=MIN_FONT, align="c",
            bold=True)
    sh.text("SCAN IF TAP FAILS", rx, cy - r_core * 0.88, size=MIN_FONT,
            align="c")

    sh.ref(126, rx + r_env + 18, cy + r_env + 4, rx + r_env * 0.74,
           cy + r_env * 0.58)
    sh.ref(128, rx + r_env + 18, cy - 22, rx + r_core * 0.52, cy - r_core * 0.28)
    sh.ref(129, rx - r_env - 44, cy + r_env + 4, rx - r_core * 0.34,
           cy + r_core * 0.76 + 2)
    sh.fig_label("FIG. 4", rx, cy - r_env - 68,
                 sub="PLAN VIEW — SECOND FACE 126. FACES DOWNWARD AND IS "
                     "EXPOSED AT BASE 114; NFC TAG 134 LIES WITHIN, ON THE "
                     "OPPOSED SIDE.",
                 width=200)

    sh.note("BOTH FACES ARE SHOWN AT THE SAME SCALE. THE LOBED OUTLINE IS THE "
            "Ø %.2f mm FREE PAD ENVELOPE; THE BROKEN CIRCLE IS THE Ø %.2f mm "
            "RIGID CORE. FACE 122 CARRIES THE MEDICATION INDICIA AND FACE 126 "
            "CARRIES THE OPTICALLY-READABLE CODE." % (G.ENV_D, G.CORE_D),
            CX, cy - r_env - 176, width=430)


# ================================================================== FIG. 10

def fig10(sh):
    """Plan view of the token showing the six friction pads."""
    s = 11.4
    cx = CX
    r_env = G.ENV_D / 2.0 * s
    r_core = G.CORE_D / 2.0 * s
    cy = TOP - r_env - 34.0

    sh.polyline(lobed_points(cx, cy, s, 1.0), w=LW_OUTLINE, close=True)
    sh.circle(cx, cy, r_core, lw=LW_THIN, dash=(4, 3))
    sh.centre_marks(cx, cy, r_env, out=18.0, tick=0.0)

    draw_qr(sh, cx, cy, r_core * 0.80, seed=23)

    # one radial centre line per pad
    for i in range(G.PAD_N):
        a = math.radians(30.0 + i * 60.0)
        sh.line(cx + r_core * 0.90 * math.cos(a), cy + r_core * 0.90 * math.sin(a),
                cx + (r_env + 14) * math.cos(a), cy + (r_env + 14) * math.sin(a),
                w=LW_THIN, dash=(4, 3))

    y_d1 = cy - r_env - 34
    y_d2 = y_d1 - 26
    sh.dim_line(cx - r_env, y_d1, cx + r_env, y_d1,
                "Ø %.2f  FREE PAD ENVELOPE" % G.ENV_D, above=False)
    sh.dim_line(cx - r_core, y_d2, cx + r_core, y_d2,
                "Ø %.2f  RIGID CORE" % G.CORE_D, above=False)
    for sgn in (-1, 1):
        sh.line(cx + sgn * r_env, cy - r_env - 6, cx + sgn * r_env, y_d1 - 5,
                w=LW_THIN)
        sh.line(cx + sgn * r_core, cy - r_env - 6, cx + sgn * r_core,
                y_d2 - 5, w=LW_THIN)

    a30 = math.radians(30.0)
    sh.ref(120, cx - r_env - 40, cy + r_env * 0.55, cx - r_env * 0.86,
           cy + r_env * 0.42)
    sh.ref(137, cx + r_env + 18, cy + r_env * 0.60,
           cx + (r_core + r_env) / 2.0 * math.cos(a30),
           cy + (r_core + r_env) / 2.0 * math.sin(a30))
    sh.ref(138, cx - r_env - 40, cy - r_env * 0.55, cx - r_core * 0.78,
           cy - r_core * 0.52)
    sh.ref(139, cx + r_env + 18, cy - r_env * 0.60,
           cx + r_env * math.cos(-a30), cy + r_env * math.sin(-a30))
    sh.ref(126, cx - r_env - 40, cy - 6, cx - r_core * 0.86, cy - r_core * 0.18)
    sh.ref(128, cx + r_env + 18, cy - 6, cx + r_core * 0.40, cy - r_core * 0.24)

    bottom = sh.note(
        "%d PADS ON %.0f° CENTRES · %.2f mm RADIAL PROJECTION · %.2f mm ROOT "
        "CHORD (%.2f° SPAN). SIX PAD ROOTS COVER 95.6%% OF THE CORE PERIMETER; "
        "NOMINAL GAP BETWEEN ROOTS IS %.2f°."
        % (G.PAD_N, 360.0 / G.PAD_N, G.PAD_PROJ, G.PAD_CHORD, G.PAD_SPAN,
           G.PAD_GAP),
        CX, y_d2 - 32, width=420)

    sh.caption("FIG. 10",
               "PLAN VIEW — SECOND FACE 126 AND PAD GEOMETRY", bottom - 6)


# ================================================================== FIG. 11

def fig11(sh):
    """Section through opposing pads, free state."""
    s = 11.4
    sv = 11.4 * 6.4
    cx = CX
    r_env = G.ENV_D / 2.0 * s
    r_core = G.CORE_D / 2.0 * s
    h = G.PUCK_T * sv
    y0 = TOP - 150.0

    sh.rect(cx - r_env, y0, 2 * r_env, h, lw=LW_OUTLINE)
    sh.hatch_rect(cx - r_core, y0, 2 * r_core, h, **HATCH_CORE)
    for sgn in (-1, 1):
        a, b = sorted([cx + sgn * r_core, cx + sgn * r_env])
        sh.hatch_rect(a, y0, b - a, h, **HATCH_PAD)
        sh.line(cx + sgn * r_core, y0, cx + sgn * r_core, y0 + h, w=LW_NORMAL)

    iw = G.INLAY_D / 2.0 * s
    ih = G.INLAY_T * sv
    sh.rect(cx - iw, y0 + h / 2.0 - ih / 2.0, 2 * iw, ih, lw=LW_NORMAL)

    sh.line(cx + r_env, y0, cx + r_env + 44, y0, w=LW_THIN)
    sh.line(cx + r_env, y0 + h, cx + r_env + 44, y0 + h, w=LW_THIN)
    sh.dim_line(cx + r_env + 36, y0, cx + r_env + 36, y0 + h,
                "%.2f" % G.PUCK_T, above=False)

    sh.centre_line(cx, y0 - 22, cx, y0 + h + 22)

    sh.ref(122, cx - r_env - 44, y0 + h + 24, cx - r_core * 0.5, y0 + h)
    sh.ref(126, cx - r_env - 44, y0 - 26, cx - r_core * 0.5, y0)
    sh.ref(137, cx + r_env + 62, y0 + h + 20, cx + (r_core + r_env) / 2.0,
           y0 + h * 0.78)
    sh.ref(138, cx - r_env - 44, y0 + h * 0.5, cx - r_core * 0.86,
           y0 + h * 0.32)
    sh.ref(132, cx + r_env + 62, y0 - 24, cx + iw * 0.9,
           y0 + h / 2.0 - ih / 2.0)
    sh.ref(134, cx + r_env + 62, y0 + h * 0.5, cx + iw * 0.4, y0 + h / 2.0)

    bottom = sh.note(
        "PADS EXTEND THROUGH THE FULL %.2f mm AXIAL THICKNESS. PAD MATERIAL "
        "AND DUROMETER ARE NOT LIMITING; THE NFC INLAY IS SEALED WITHIN THE "
        "CORE." % G.PUCK_T, CX, y0 - 62, width=420)

    sh.caption("FIG. 11",
               "SECTION A-A THROUGH OPPOSING PADS — FREE STATE. RADIAL SCALE "
               "TRUE; AXIAL SCALE ENLARGED FOR CLARITY.", bottom - 6, width=430)


# ================================================================== FIG. 12

def fig12(sh):
    """Enlarged detail: seated token, recess taper, pad deflection."""
    s = 9.0
    sv = 9.0 * 8.4
    cx = CX

    r_base = G.BASE_OD / 2.0 * s
    r_rec_o = G.RECESS_D_OPEN / 2.0 * s
    r_rec_d = G.RECESS_D_DEEP / 2.0 * s
    r_env = G.ENV_D / 2.0 * s
    r_core = G.CORE_D / 2.0 * s

    y_floor = TOP - 44.0
    y_deep = y_floor - (G.BASE_T - G.RECESS_DEPTH) * sv
    y_base = y_floor - G.BASE_T * sv
    y_tok_b = y_base + G.FACE_RECESS * sv
    y_tok_t = y_tok_b + G.PUCK_T * sv

    # base material
    sh.polyline([(cx - r_base, y_floor), (cx - r_base, y_base),
                 (cx - r_rec_o, y_base), (cx - r_rec_d, y_deep)], w=LW_OUTLINE)
    sh.polyline([(cx + r_base, y_floor), (cx + r_base, y_base),
                 (cx + r_rec_o, y_base), (cx + r_rec_d, y_deep)], w=LW_OUTLINE)
    sh.line(cx - r_rec_d, y_deep, cx + r_rec_d, y_deep, w=LW_OUTLINE)
    sh.line(cx - r_base, y_floor, cx + r_base, y_floor, w=LW_OUTLINE)
    for sgn in (-1, 1):
        sh.hatch_poly([(cx + sgn * r_base, y_base), (cx + sgn * r_rec_o, y_base),
                       (cx + sgn * r_rec_d, y_deep), (cx + sgn * r_base, y_deep)],
                      **HATCH_VESSEL)
    sh.hatch_rect(cx - r_base, y_deep, 2 * r_base, y_floor - y_deep,
                  **HATCH_VESSEL)

    # ---- token 120, installed --------------------------------------------
    # The pads deflect to the local cavity diameter, so the installed outline
    # follows the recess wall: Ø27.471 at the external face, Ø27.30 at the
    # deepest plane. The free Ø27.50 envelope is shown broken, outboard.
    def cavity_r(y):
        t = (y - y_base) / (y_deep - y_base)
        return (r_rec_o + (r_rec_d - r_rec_o) * t)

    rb = cavity_r(y_tok_b)
    rt = cavity_r(y_tok_t)
    sh.polyline([(cx - rb, y_tok_b), (cx + rb, y_tok_b),
                 (cx + rt, y_tok_t), (cx - rt, y_tok_t)],
                w=LW_OUTLINE, close=True)
    sh.hatch_rect(cx - r_core, y_tok_b, 2 * r_core, y_tok_t - y_tok_b,
                  **HATCH_CORE)
    for sgn in (-1, 1):
        sh.hatch_poly([(cx + sgn * r_core, y_tok_b), (cx + sgn * rb, y_tok_b),
                       (cx + sgn * rt, y_tok_t), (cx + sgn * r_core, y_tok_t)],
                      **HATCH_PAD)
        sh.line(cx + sgn * r_core, y_tok_b, cx + sgn * r_core, y_tok_t,
                w=LW_THIN)
        # free pad envelope, broken
        sh.line(cx + sgn * r_env, y_tok_b - 10, cx + sgn * r_env, y_tok_t + 10,
                w=LW_THIN, dash=(2.5, 2.5))

    # 0.30 face recess and 2.10 recess depth
    sh.line(cx - r_rec_o - 30, y_base, cx + r_base + 30, y_base, w=LW_THIN,
            dash=(6, 3))
    sh.line(cx + rb, y_tok_b, cx + r_base + 30, y_tok_b, w=LW_THIN)
    sh.dim_line(cx + r_base + 22, y_base, cx + r_base + 22, y_tok_b,
                "%.2f" % G.FACE_RECESS, above=False)

    sh.line(cx - r_base, y_base, cx - r_base - 30, y_base, w=LW_THIN)
    sh.line(cx - r_rec_d, y_deep, cx - r_base - 30, y_deep, w=LW_THIN)
    sh.dim_line(cx - r_base - 22, y_base, cx - r_base - 22, y_deep,
                "%.2f" % G.RECESS_DEPTH, above=False)

    sh.centre_line(cx, y_base - 30, cx, y_floor + 20)

    xr = cx + r_base + 54           # right numeral column, clear of the dims
    xl = cx - r_base - 78           # left numeral column

    sh.ref(114, xr, y_floor - 12, cx + r_base - 10, y_floor - 16)
    sh.ref(119, xr, y_deep + 10, cx + r_rec_d - 6, y_deep)
    sh.ref(137, xr, y_tok_t - 54, cx + (r_core + rb) / 2.0, y_tok_t - 48)
    sh.ref(139, xr, y_tok_b + 22, cx + r_env, y_tok_b + 12)
    sh.ref(118, xr, y_base - 34, cx + r_base - 10, y_base)

    sh.ref(116, xl, y_deep + 10, cx - r_rec_o + 3, y_base - 6)
    sh.ref(120, xl, y_tok_t - 40, cx - r_core * 0.55, y_tok_t - 26)
    sh.ref(138, xl, y_tok_t - 76, cx - r_core * 0.88, y_tok_t - 66)
    sh.ref(126, xl, y_tok_b - 26, cx - r_core * 0.55, y_tok_b)

    bottom = sh.note(
        "RECESS 116 TAPERS FROM Ø %.2f AT LOWERMOST SURFACE 118 TO Ø %.2f AT "
        "DEEPEST PLANE 119, A WALL HALF-ANGLE OF %.2f°. THE LOCAL CAVITY "
        "DIAMETER AT THE EXTERNAL TOKEN FACE IS Ø 27.471, SO PAD 137 DEFLECTS "
        "RADIALLY BETWEEN 0.014 mm AND 0.10 mm. NO LIP OR POSITIVE SNAP "
        "FEATURE IS ASSUMED; RETENTION IS BY INTERFERENCE AT THE PADS."
        % (G.RECESS_D_OPEN, G.RECESS_D_DEEP, G.RECESS_HALF_ANGLE),
        CX, y_base - 74, width=430)

    sh.caption("FIG. 12",
               "ENLARGED DETAIL — TOKEN 120 INSTALLED IN RECESS 116. RADIAL "
               "SCALE TRUE; AXIAL SCALE AND WALL TAPER EXAGGERATED.",
               bottom - 6, width=430)
