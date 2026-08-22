"""
System figures: FIG. 5 (block diagram) and the three flowcharts, FIG. 6, 7
and 9. These carry the same reference numerals as the superseded set, so the
specification text does not have to change; only the layout, the line weights
and the type size are rebuilt to clear 37 CFR 1.84.
"""

from patentkit import (
    SIGHT_X0, SIGHT_X1, TOP, MIN_FONT,
    LW_OUTLINE, LW_NORMAL, LW_THIN,
)

CX = (SIGHT_X0 + SIGHT_X1) / 2.0
W = SIGHT_X1 - SIGHT_X0

# Lowest y a flowchart body may reach: below this sits the FIG. caption.
CAPTION_FLOOR = 100.0

BOX_R = 5.0          # corner radius on process boxes
FS = MIN_FONT        # every glyph in these figures is at the legal minimum


# ------------------------------------------------------------------ helpers

def _flow(sh, x, y, w, h, text, lw=LW_NORMAL, dash=None):
    sh.flow_box(x, y, w, h, text, size=FS, r=BOX_R, lw=lw, dash=dash)
    return (x, y, w, h)


def _box_h(sh, text, w, minimum=0.0):
    """Height a box needs once `text` is wrapped to `w`."""
    n = len(sh.flow_lines(text, w, FS))
    return max(minimum, n * (FS + 2.2) + 15.0)


def _flow_mid(sh, x, cy, w, text, lw=LW_OUTLINE, minimum=0.0):
    """Branch box centred on `cy`, sized to its own wrapped text."""
    h = _box_h(sh, text, w, minimum)
    return _flow(sh, x, cy - h / 2.0, w, h, text, lw=lw)


def _below(box):
    x, y, w, h = box
    return (x + w / 2.0, y)


def _above(box):
    x, y, w, h = box
    return (x + w / 2.0, y + h)


def _left(box):
    x, y, w, h = box
    return (x, y + h / 2.0)


def _right(box):
    x, y, w, h = box
    return (x + w, y + h / 2.0)


def _label(sh, text, x, y, align="l"):
    """Small branch label (YES / NO) with the paper blanked behind it."""
    w = sh.text_w(text, FS)
    c = sh.c
    c.saveState()
    c.setFillColorRGB(1, 1, 1)
    ox = 0 if align == "l" else (-w if align == "r" else -w / 2.0)
    c.rect(x + ox - 2, y - 3, w + 4, FS + 2, stroke=0, fill=1)
    c.restoreState()
    sh.text(text, x, y, size=FS, align=align)


# =================================================================== FIG. 5

def fig5(sh):
    """Block diagram of medication dosing system 100."""
    y = TOP - 24.0

    # ---------------- vessel + token group -------------------------------
    gw = 210.0
    gx = SIGHT_X0 + 4
    gh = 132.0
    sh.rect(gx, y - gh, gw, gh, lw=LW_OUTLINE, r=8)
    sh.text("DOSE-METERING VESSEL 110", gx + gw / 2.0, y - 18, size=FS,
            align="c", bold=True)
    inner = [
        "GRADUATED SIDEWALL 112",
        "TRANSPARENT BASE 114",
        "UPWARDLY-OPEN RECESS 116",
    ]
    for i, t in enumerate(inner):
        sh.text(t, gx + gw / 2.0, y - 40 - i * (FS + 5), size=FS, align="c")

    tw = 210.0
    tx = SIGHT_X1 - tw - 4
    sh.rect(tx, y - gh, tw, gh, lw=LW_OUTLINE, r=8)
    sh.text("MEDICATION-IDENTIFYING", tx + tw / 2.0, y - 16, size=FS,
            align="c", bold=True)
    sh.text("TOKEN 120", tx + tw / 2.0, y - 16 - FS - 3, size=FS, align="c",
            bold=True)
    inner2 = [
        "PASSIVE NFC TAG 134",
        "IN INTERIOR CAVITY 132",
        "OPTICAL CODE 128 ON FACE 126",
    ]
    for i, t in enumerate(inner2):
        sh.text(t, tx + tw / 2.0, y - 52 - i * (FS + 5), size=FS, align="c")

    # seated-in relationship
    sh.arrow(tx - 4, y - gh / 2.0, gx + gw + 4, y - gh / 2.0, w=LW_NORMAL)
    _label(sh, "SEATED IN", (tx + gx + gw) / 2.0, y - gh / 2.0 + 6, align="c")

    # ---------------- handheld computing device 140 ----------------------
    dy = y - gh - 42.0
    dh = 118.0
    dw = 300.0
    dx = CX - dw / 2.0
    sh.rect(dx, dy - dh, dw, dh, lw=LW_OUTLINE, r=8)
    sh.text("HANDHELD COMPUTING DEVICE 140", CX, dy - 17, size=FS, align="c",
            bold=True)
    cells = [("NFC RADIO 142", "CAMERA 144"),
             ("PROCESSOR 148", "DISPLAY 146"),
             ("LOCAL STORE 190", "DOSING CARD 160")]
    for i, (a, b) in enumerate(cells):
        yy = dy - 40 - i * (FS + 8)
        sh.text(a, dx + 16, yy, size=FS)
        sh.text(b, dx + dw - 16, yy, size=FS, align="r")

    sh.elbow_arrow([(gx + gw / 2.0, y - gh), (gx + gw / 2.0, dy + 16),
                    (CX - 70, dy + 16), (CX - 70, dy)], w=LW_NORMAL)
    _label(sh, "TAP / READ", CX - 66, dy + 20)
    sh.elbow_arrow([(tx + tw / 2.0, y - gh), (tx + tw / 2.0, dy + 16),
                    (CX + 70, dy + 16), (CX + 70, dy)], w=LW_NORMAL)
    _label(sh, "SCAN ON FAILED READ", CX + 66, dy + 20, align="r")

    # ---------------- server, record, formulary, second device -----------
    sy = dy - dh - 44.0
    sh_h = 74.0
    sw = 232.0
    sx = SIGHT_X0 + 4
    sh.rect(sx, sy - sh_h, sw, sh_h, lw=LW_OUTLINE, r=8)
    sh.text("SYNCHRONIZATION SERVER 150", sx + sw / 2.0, sy - 17, size=FS,
            align="c", bold=True)
    sh.text("CAREGIVER-SHARED", sx + sw / 2.0, sy - 36, size=FS, align="c")
    sh.text("ADMINISTRATION RECORD 152", sx + sw / 2.0, sy - 36 - FS - 3,
            size=FS, align="c")
    sh.text("CARE RECIPIENT RECORDS 154", sx + sw / 2.0, sy - 36 - 2 * (FS + 3),
            size=FS, align="c")

    fw = 210.0
    fx = SIGHT_X1 - fw - 4
    sh.rect(fx, sy - sh_h, fw, sh_h, lw=LW_OUTLINE, r=8)
    sh.text("MEDICATION FORMULARY 180", fx + fw / 2.0, sy - 17, size=FS,
            align="c", bold=True)
    sh.text("DOSE COEFFICIENT,", fx + fw / 2.0, sy - 36, size=FS, align="c")
    sh.text("CONCENTRATION, INTERVALS,", fx + fw / 2.0, sy - 36 - FS - 3,
            size=FS, align="c")
    sh.text("MAXIMUM DAILY MASS", fx + fw / 2.0, sy - 36 - 2 * (FS + 3),
            size=FS, align="c")

    sh.elbow_arrow([(CX - 70, dy - dh), (CX - 70, sy + 18),
                    (sx + sw / 2.0, sy + 18), (sx + sw / 2.0, sy)],
                   w=LW_NORMAL)
    _label(sh, "SYNC", CX - 66, sy + 22)
    sh.elbow_arrow([(CX + 70, dy - dh), (CX + 70, sy + 18),
                    (fx + fw / 2.0, sy + 18), (fx + fw / 2.0, sy)],
                   w=LW_NORMAL)
    _label(sh, "LOOK UP", CX + 66, sy + 22, align="r")

    ry = sy - sh_h - 40.0
    rh = 46.0
    rw = 300.0
    rx = CX - rw / 2.0
    sh.rect(rx, ry - rh, rw, rh, lw=LW_OUTLINE, r=8)
    sh.text("SECOND HANDHELD COMPUTING DEVICE 170", CX, ry - 18, size=FS,
            align="c", bold=True)
    sh.text("SECOND CAREGIVER OF THE HOUSEHOLD", CX, ry - 18 - FS - 4,
            size=FS, align="c")
    sh.arrow(sx + sw / 2.0, sy - sh_h, rx + rw * 0.32, ry, w=LW_NORMAL)
    _label(sh, "PROPAGATE ENTRY", sx + sw / 2.0 + 6, ry + 12)

    sh.caption("FIG. 5", "MEDICATION DOSING SYSTEM 100", ry - rh, size=17.0)


# =================================================================== FIG. 6

# Column geometry shared by the two flowcharts. The main column sits against
# the left of the sight and every branch box lands in the right column, so
# nothing can drift into the margins as the wording changes.
MAIN_X = SIGHT_X0
MAIN_W = 244.0
MAIN_CX = MAIN_X + MAIN_W / 2.0
BR_X = 352.0
BR_W = SIGHT_X1 - BR_X


def _heights(sh, items, w):
    """Height each stack item needs once its text is wrapped to the column."""
    hs = []
    for kind, h, text in items:
        frac = 0.86 if kind == "dia" else 1.0
        n = len(sh.flow_lines(text, w * frac, FS))
        need = n * (FS + 2.2) + (26.0 if kind == "dia" else 15.0)
        hs.append(max(h, need))
    return hs


def _stack(sh, y, items, floor, x=MAIN_X, w=MAIN_W):
    """
    Draw a vertical run of boxes and diamonds between `y` and `floor`, joining
    each to the next with an arrow. `items` are (kind, min height, text) and
    kind is 'box', 'end' or 'dia'. The gap between items is whatever the band
    allows, so a flowchart cannot run off the bottom of the sheet.

    Returns the y of the bottom of the last item and the list of boxes.
    """
    hs = _heights(sh, items, w)
    slack = (y - floor) - sum(hs)
    gap = slack / max(1, len(items) - 1)
    if gap < 8.0:
        raise ValueError("stack does not fit: only %.1f pt of gap available; "
                         "shorten the box text or split the figure" % gap)
    gap = min(gap, 24.0)

    out = []
    prev = None
    for (kind, _, text), h in zip(items, hs):
        top = y
        if prev is not None:
            sh.arrow(x + w / 2.0, prev, x + w / 2.0, top, w=LW_NORMAL)
        if kind == "dia":
            sh.flow_diamond(x + w / 2.0, top - h / 2.0, w, h, text, size=FS)
        else:
            _flow(sh, x, top - h, w, h, text,
                  lw=LW_OUTLINE if kind == "end" else LW_NORMAL)
        out.append((x, top - h, w, h))
        prev = top - h
        y = prev - gap
    return prev, out


def fig6(sh):
    """Dose volume determination with the body-mass freshness gate."""
    y = TOP - 14.0

    items = [
        ("box", 32, "600  TAP TOKEN 120 SEATED IN VESSEL 110"),
        ("box", 32, "602  READ PASSIVE NFC TAG 134 VIA RADIO 142"),
        ("dia", 48, "604  READ SUCCESSFUL?"),
        ("box", 38, "612  OPEN DOSING CARD 160; DISPLAY ROSTER 162"),
        ("box", 38, "614  RECEIVE SELECTION OF A SELECTED CARE RECIPIENT"),
        ("box", 38, "616  RETRIEVE BODY MASS DATUM AND ITS ACQUISITION TIME"),
        ("dia", 52, "618  AGE > STALENESS THRESHOLD?"),
        ("box", 38, "622  COMPUTE DOSE MASS = BODY MASS x COEFFICIENT"),
        ("box", 38, "624  CONVERT TO DOSE VOLUME USING CONCENTRATION"),
        ("box", 30, "626  INTERVAL INTERLOCK (FIG. 7)"),
    ]
    bottom, boxes = _stack(sh, y, items, CAPTION_FLOOR)

    d604 = boxes[2]
    d618 = boxes[6]

    # YES / NO on the main line
    _label(sh, "YES", MAIN_CX + 5, d604[1] - 14)
    _label(sh, "NO", MAIN_CX + 5, d618[1] - 14)

    # ---- optical fallback branch, in the right column --------------------
    cy604 = d604[1] + d604[3] / 2.0
    sh.arrow(MAIN_X + MAIN_W, cy604, BR_X, cy604, w=LW_NORMAL)
    _label(sh, "NO", MAIN_X + MAIN_W + 6, cy604 + 5)

    b606 = _flow_mid(sh, BR_X, cy604, BR_W,
                     "606  DECODE OPTICALLY-READABLE CODE 128 VIA CAMERA 144",
                     lw=LW_NORMAL)
    gap = 18.0
    ycur = b606[1] - gap
    sh.flow_diamond(BR_X + BR_W / 2.0, ycur - 24, BR_W, 48,
                    "608  CODE DECODED?", size=FS)
    sh.arrow(BR_X + BR_W / 2.0, cy604 - 22, BR_X + BR_W / 2.0, ycur,
             w=LW_NORMAL)

    y610 = ycur - 48 - gap
    _flow(sh, BR_X, y610 - 52, BR_W, 52,
          "610  TERMINAL STATE (f): MANUAL SELECTION; THE ENTRY IS "
          "MARKED AS MANUAL", lw=LW_OUTLINE)
    sh.arrow(BR_X + BR_W / 2.0, ycur - 48, BR_X + BR_W / 2.0, y610,
             w=LW_NORMAL)
    _label(sh, "NO", BR_X + BR_W / 2.0 + 5, y610 + 5)

    # 608 YES rejoins the main column at 612
    b612 = boxes[3]
    sh.elbow_arrow([(BR_X, ycur - 24), (BR_X - 14, ycur - 24),
                    (BR_X - 14, b612[1] + b612[3] / 2.0),
                    (b612[0] + b612[2], b612[1] + b612[3] / 2.0)],
                   w=LW_NORMAL)
    _label(sh, "YES", BR_X - 18, ycur - 19, align="r")

    # ---- staleness branch ------------------------------------------------
    cy618 = d618[1] + d618[3] / 2.0
    sh.arrow(MAIN_X + MAIN_W, cy618, BR_X, cy618, w=LW_NORMAL)
    _label(sh, "YES", MAIN_X + MAIN_W + 6, cy618 + 5)
    b620 = _flow(sh, BR_X, cy618 - 32, BR_W, 64,
                 "620  TERMINAL STATE (b): SUPPRESS DOSE VOLUME; REQUIRE A "
                 "REPLACEMENT BODY MASS DATUM", lw=LW_OUTLINE)
    b616 = boxes[5]
    sh.elbow_arrow([(BR_X, b620[1]), (BR_X - 14, b620[1]),
                    (BR_X - 14, b616[1] + 10),
                    (b616[0] + b616[2], b616[1] + 10)],
                   w=LW_THIN, dash=(4, 3))
    _label(sh, "ON ENTRY OF A REPLACEMENT", BR_X - 18, b620[1] + 5,
           align="r")

    sh.caption("FIG. 6",
               "DOSE VOLUME DETERMINATION WITH BODY MASS FRESHNESS GATE",
               bottom)


# =================================================================== FIG. 7

def fig7(sh):
    """Same-medication and cross-medication interval interlock."""
    y = TOP - 14.0

    items = [
        ("box", 30, "700  DOSE VOLUME COMPUTED, FIG. 6"),
        ("box", 40, "702  FROM RECORD 152, RETRIEVE THE LAST " "ADMINISTRATION OF THIS MEDICATION"),
        ("dia", 54, "704  ELAPSED < SAME-MEDICATION MINIMUM INTERVAL?"),
        ("box", 40, "708  RETRIEVE THE LAST ADMINISTRATION " "OF THE SECOND MEDICATION"),
        ("dia", 54, "710  ELAPSED < CROSS-MEDICATION MINIMUM INTERVAL?"),
        ("dia", 54, "714  ROLLING 24 h MASS + DOSE MASS\n> DAILY MAXIMUM?"),
        ("end", 40, "718  TERMINAL STATE (a): DISPLAY DOSE " "VOLUME IN UNITS OF LIQUID VOLUME"),
        ("box", 40, "720  CAREGIVER CONFIRMS; WRITE THE " "ENTRY TO RECORD 152"),
    ]
    bottom, boxes = _stack(sh, y, items, CAPTION_FLOOR)

    branches = [
        (boxes[2], 56, "706  TERMINAL STATE (c): DISPLAY "
                       "TOO-EARLY INDICATION 168 IN PLACE OF THE DOSE VOLUME"),
        (boxes[4], 42, "712  TERMINAL STATE (d): TOO EARLY — CROSS MEDICATION"),
        (boxes[5], 56, "716  TERMINAL STATE (e): DAILY MAXIMUM REACHED; "
                       "SUPPRESS THE DOSE VOLUME"),
    ]
    for dia, h, text in branches:
        cy = dia[1] + dia[3] / 2.0
        sh.arrow(MAIN_X + MAIN_W, cy, BR_X, cy, w=LW_NORMAL)
        _label(sh, "YES", MAIN_X + MAIN_W + 6, cy + 5)
        _flow_mid(sh, BR_X, cy, BR_W, text, minimum=h)
        _label(sh, "NO", MAIN_CX + 5, dia[1] - 12)

    sh.caption("FIG. 7",
               "SAME-MEDICATION AND CROSS-MEDICATION INTERVAL INTERLOCK",
               bottom)


# =================================================================== FIG. 9

def fig9(sh):
    """Offline reconciliation of administration entries."""
    bw = 250.0
    bx = CX - bw / 2.0
    y = TOP - 26.0
    gap = 28.0

    _flow(sh, bx, y - 38, bw, 38,
          "900  ADMINISTRATION ENTRY CREATED ON DEVICE 140")
    y -= 38 + gap

    dh = 54.0
    sh.flow_diamond(CX, y - dh / 2.0, 220, dh, "902  SERVER 150 REACHABLE?",
                    size=FS)
    sh.arrow(CX, y + gap, CX, y, w=LW_NORMAL)

    lx = SIGHT_X0 + 16
    rx = SIGHT_X1 - 212
    b904 = _flow(sh, lx, y - dh / 2.0 - 24, 200, 48,
                 "904  WRITE ENTRY TO LOCAL STORE 190")
    sh.arrow(CX - 110, y - dh / 2.0, lx + 200, y - dh / 2.0, w=LW_NORMAL)
    _label(sh, "NO", CX - 116, y - dh / 2.0 + 5, align="r")

    b906 = _flow(sh, rx, y - dh / 2.0 - 30, 200, 60,
                 "906  WRITE ENTRY TO RECORD 152; PROPAGATE TO DEVICE 170")
    sh.arrow(CX + 110, y - dh / 2.0, rx, y - dh / 2.0, w=LW_NORMAL)
    _label(sh, "YES", CX + 116, y - dh / 2.0 + 5)

    y -= dh + gap + 26
    b908 = _flow(sh, lx, y - 44, 200, 44,
                 "908  SERVER 150 LATER BECOMES REACHABLE")
    sh.arrow(lx + 100, y + 44 + gap - 18, lx + 100, y, w=LW_NORMAL)

    y -= 44 + gap
    sh.flow_diamond(CX, y - 42, 300, 84,
                    "910  TWO ENTRIES, SAME MEDICATION " "IDENTIFIER AND SAME CARE RECIPIENT, " "WITHIN THE MINIMUM SAME-MEDICATION INTERVAL?", size=FS)
    sh.elbow_arrow([(lx + 100, y + gap + 42 - 42), (lx + 100, y - 42),
                    (CX - 150, y - 42)], w=LW_NORMAL)

    b912 = _flow(sh, lx, y - 42 - 40, 200, 80,
                 "912  RETAIN THE EARLIER ADMINISTRATION TIME; THE NEXT "
                 "DOSE IS DELAYED, NEVER ADVANCED")
    sh.elbow_arrow([(CX, y - 84), (CX, y - 106), (lx + 100, y - 106),
                    (lx + 100, y - 82)], w=LW_NORMAL)
    _label(sh, "YES", CX + 5, y - 100)

    b914 = _flow(sh, rx, y - 42 - 26, 200, 52,
                 "914  MERGE BOTH ENTRIES INTO RECORD 152")
    sh.arrow(CX + 150, y - 42, rx, y - 42, w=LW_NORMAL)
    _label(sh, "NO", CX + 156, y - 37)

    y = y - 42 - 80 - gap
    b916 = _flow(sh, bx, y - 40, bw, 40,
                 "916  RECORD 152 IS CONSISTENT ACROSS THE HOUSEHOLD",
                 lw=LW_OUTLINE)
    sh.elbow_arrow([(lx + 100, y + 40 + gap - 40), (lx + 100, y + 20),
                    (bx, y + 20)], w=LW_NORMAL)
    sh.elbow_arrow([(rx + 100, y + 40 + gap + 26 - 52 - 14),
                    (rx + 100, y + 20), (bx + bw, y + 20)], w=LW_NORMAL)

    sh.caption("FIG. 9", "OFFLINE RECONCILIATION OF ADMINISTRATION ENTRIES",
               y - 40)
