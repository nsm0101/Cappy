"""
App-side figures: FIG. 8 and FIG. 13-15.

These are redrawn from the shipping Cappy interface rather than from a generic
sketch. Layout, element order and proportion follow the design-system
templates in `Cappy Design System_6.29.26/templates` (nfc-quick-access,
dose-log-popup, med-timeline), which are authored against a 390 pt wide
device; `Screen` maps those device coordinates onto the sheet, so anything
measured off the real UI can be placed here directly.

Two deliberate departures from a screenshot, both forced by 37 CFR 1.84:

  * Colour, gradients and grey fills are dropped. Where the interface uses
    colour to carry meaning -- the dose-status pills -- the meaning is carried
    here by a marker glyph instead, and the drawing says so.
  * Type is set by role, at sizes that clear the 1/8 in minimum, rather than
    scaled down from the device. The hierarchy of the real screen is kept; the
    absolute sizes are not, because a faithful scale would be illegible and
    non-compliant. Copy is trimmed to what fits at those sizes, and `check()`
    fails the build if any string still runs past its container.
"""

from patentkit import (
    SIGHT_X0, SIGHT_X1, TOP, MIN_FONT,
    LW_OUTLINE, LW_NORMAL, LW_THIN,
)

CX = (SIGHT_X0 + SIGHT_X1) / 2.0

DEV_W = 390.0                # the device the templates are drawn against
SCALE = 0.72                 # device pt -> page pt

# Type roles, in page points. Every one clears the 1/8 in character minimum.
T_BODY = MIN_FONT            # 12.7
T_SUB = 14.4
T_TITLE = 17.0
T_DISPLAY = 24.0

# The medication shown throughout is the one carried by token 120 in FIG. 1
# and FIG. 3, so the mechanical and interface figures describe one scenario.
MED_NAME = "IBUPROFEN"
MED_BRAND = "CHILDREN'S IBUPROFEN"
MED_CONC = "100 mg / 5 mL"


class Screen:
    """
    A phone screen on the sheet. Device coordinates run x -> right from the
    left edge of the screen and y -> down from the top of the screen.
    """

    def __init__(self, sheet, cx, top_y, dev_h, s=SCALE):
        self.sh = sheet
        self.s = s
        self.w = DEV_W * s
        self.h = dev_h * s
        self.dev_h = dev_h
        self.x0 = cx - self.w / 2.0
        self.y1 = top_y

    # --- mapping ---------------------------------------------------------
    def px(self, x):
        return self.x0 + x * self.s

    def py(self, y):
        return self.y1 - y * self.s

    def d(self, v):
        return v * self.s

    @property
    def bottom(self):
        return self.y1 - self.h

    # --- chrome ----------------------------------------------------------
    def frame(self, clock="9:41", cropped=True):
        sh = self.sh
        sh.rect(self.x0, self.bottom, self.w, self.h, lw=LW_OUTLINE,
                r=self.d(40))
        sh.rect(self.px(DEV_W / 2 - 30), self.py(24), self.d(60), self.d(8),
                lw=LW_THIN, r=self.d(4))
        self.text(clock, 24, 36, T_BODY, bold=True)
        self.text("100%", DEV_W - 24, 36, T_BODY, align="r")
        if cropped:
            # break line: the view continues below what is shown
            y = self.dev_h - 12
            sh.line(self.px(20), self.py(y), self.px(DEV_W - 20), self.py(y),
                    w=LW_THIN, dash=(5, 4))

    # --- text ------------------------------------------------------------
    def text(self, s, x, y, size=T_BODY, bold=False, align="l"):
        return self.sh.text(s, self.px(x), self.py(y), size=size, bold=bold,
                            align=align)

    def tw(self, s, size=T_BODY, bold=False):
        """Width of `s` in device units."""
        return self.sh.text_w(s, size, bold) / self.s

    def cap(self, size=T_BODY):
        """Cap height in device units, for baseline placement."""
        return size * 0.72 / self.s

    # --- boxes -----------------------------------------------------------
    def card(self, x, y, w, h, r=18, lw=LW_NORMAL, dash=None):
        self.sh.rect(self.px(x), self.py(y + h), self.d(w), self.d(h),
                     lw=lw, r=self.d(r), dash=dash)

    def pill(self, x, y, w, h, lw=LW_THIN):
        self.sh.rect(self.px(x), self.py(y + h), self.d(w), self.d(h),
                     lw=lw, r=self.d(h / 2.0))

    def dot(self, x, y, r=4.0, fill=1):
        self.sh.circle(self.px(x), self.py(y), self.d(r), lw=LW_THIN,
                       fill=fill)

    def avatar(self, x, y, dia, mono):
        r = dia / 2.0
        self.sh.circle(self.px(x + r), self.py(y + r), self.d(r), lw=LW_NORMAL)
        self.text(mono, x + r, y + r + self.cap() / 2.0, T_BODY, bold=True,
                  align="c")

    def button(self, x, y, w, h, label, filled=True):
        self.sh.rect(self.px(x), self.py(y + h), self.d(w), self.d(h),
                     lw=LW_OUTLINE if filled else LW_NORMAL, r=self.d(14))
        if filled:
            self.sh.rect(self.px(x + 4), self.py(y + h - 4), self.d(w - 8),
                         self.d(h - 8), lw=LW_THIN, r=self.d(10))
        self.text(label, x + w / 2.0, y + h / 2.0 + self.cap(T_SUB) / 2.0,
                  T_SUB, bold=True, align="c")

    def status_pill(self, right_x, y, label, marker="open", h=30):
        """
        Status indicium 164. The interface separates these states by colour;
        the drawing separates them by the marker inside the pill -- open for a
        dose that may be given, solid for too early, divided for just given.
        """
        pad = 10.0
        w = self.tw(label, T_BODY, True) + pad * 2 + 16
        x = right_x - w
        self.pill(x, y, w, h)
        mx, my = x + pad + 6, y + h / 2.0
        if marker == "filled":
            self.dot(mx, my, 5.0, fill=1)
        elif marker == "half":
            self.dot(mx, my, 5.0, fill=0)
            self.sh.line(self.px(mx), self.py(my - 5.0), self.px(mx),
                         self.py(my + 5.0), w=LW_NORMAL)
        else:
            self.dot(mx, my, 5.0, fill=0)
        self.text(label, x + pad + 16, y + h / 2.0 + self.cap() / 2.0, T_BODY,
                  bold=True)
        return x

    # --- checking --------------------------------------------------------
    def check(self, label, text, x, limit, size=T_BODY, bold=False):
        """Fail the build if `text` would run past `limit` device units."""
        end = x + self.tw(text, size, bold)
        if end > limit + 0.5:
            raise ValueError("%s overflows by %.0f device pt: %r"
                             % (label, end - limit, text))


# =================================================================== FIG. 8

def fig8(sh):
    """Dosing card 160 -- roster 162 with status indicia 164."""
    sc = Screen(sh, CX - 54.0, TOP + 8.0, dev_h=712)
    sc.frame()

    # ---- medication identity, populated from token 120 -------------------
    sc.card(16, 54, 358, 182, r=26, lw=LW_OUTLINE)
    sc.pill(34, 74, 154, 30)
    sc.dot(52, 89, 4.5, fill=1)
    sc.text("TAG DETECTED", 66, 94, T_BODY, bold=True)
    sc.text(MED_NAME, 34, 148, T_DISPLAY, bold=True)
    sc.text(MED_BRAND, 34, 172, T_BODY)
    sc.card(34, 184, 164, 40, r=12, lw=LW_THIN)
    sc.text("CONCENTRATION", 46, 201, T_BODY)
    sc.text(MED_CONC, 46, 219, T_BODY, bold=True)
    sc.card(208, 184, 166, 40, r=12, lw=LW_THIN)
    sc.text("FORM", 220, 201, T_BODY)
    sc.text("SUSPENSION", 220, 219, T_BODY, bold=True)
    sc.check("FIG.8 conc", MED_CONC, 46, 194, T_BODY, True)
    sc.check("FIG.8 form", "SUSPENSION", 220, 368, T_BODY, True)
    sc.check("FIG.8 name", MED_NAME, 34, 374, T_DISPLAY, True)

    # ---- roster 162 -------------------------------------------------------
    sc.text("WHO IS THIS FOR?", 16, 272, T_TITLE, bold=True)
    sc.text("TAP A NAME TO SEE THE DOSE", 16, 296, T_BODY)
    sc.check("FIG.8 sub", "TAP A NAME TO SEE THE DOSE", 16, 374)

    rows = [
        ("EM", "EMMA", "6 yrs · 38 lb", "DUE NOW", "open"),
        ("NO", "NOAH", "3 yrs · 31 lb", "TOO EARLY", "filled"),
        ("AV", "AVA", "18 mo · 24 lb", "JUST DOSED", "half"),
    ]
    ry = 312.0
    for mono, name, sub, status, marker in rows:
        sc.card(16, ry, 358, 86, r=18)
        sc.avatar(32, ry + 18, 50, mono)
        sc.text(name, 96, ry + 42, T_SUB, bold=True)
        sc.text(sub, 96, ry + 64, T_BODY)
        px = sc.status_pill(358, ry + 28, status, marker)
        sc.check("FIG.8 row %s" % name, sub, 96, px - 8)
        ry += 98.0

    # ---- footer + call to action -----------------------------------------
    sc.dot(24, 624, 5.0, fill=0)
    sc.text("ALWAYS CONFIRM BEFORE DOSING", 40, 629, T_BODY)
    sc.check("FIG.8 foot", "ALWAYS CONFIRM BEFORE DOSING", 40, 374)
    sc.button(16, 644, 358, 52, "CHOOSE A CHILD TO CONTINUE")

    # ---- reference numerals -----------------------------------------------
    xr = SIGHT_X1 - 40
    xl = SIGHT_X0 + 2
    sh.ref(140, xr, sc.py(40), sc.px(DEV_W) + 2, sc.py(52))
    sh.ref(146, xr, sc.py(96), sc.px(DEV_W) - 6, sc.py(104))
    sh.ref(160, xr, sc.py(160), sc.px(374), sc.py(150))
    sh.ref(162, xr, sc.py(300), sc.px(374), sc.py(312))
    sh.ref(164, xr, sc.py(430), sc.px(346), sc.py(452))
    sh.ref(120, xl, sc.py(152), sc.px(30), sc.py(142),
           elbow=[(sc.px(0) - 20, sc.py(152))])
    sh.ref(154, xl, sc.py(364), sc.px(44), sc.py(358),
           elbow=[(sc.px(0) - 20, sc.py(364))])

    bottom = sh.note(
        "DOSING CARD 160 IS POPULATED FROM TOKEN 120. STATUS INDICIUM 164 "
        "CARRIES AN OPEN MARKER FOR A DOSE THAT MAY BE GIVEN, A SOLID MARKER "
        "FOR TOO EARLY, AND A DIVIDED MARKER FOR A DOSE JUST GIVEN; THE "
        "INTERFACE ITSELF SEPARATES THESE STATES BY COLOUR.", CX, sc.bottom - 24, width=444)

    sh.caption("FIG. 8",
               "DOSING CARD 160 — ROSTER 162 WITH STATUS INDICIA 164",
               bottom - 6, width=444)


# ------------------------------------------------------- shared dose sheet

def _dose_sheet_head(sc, top, mono, who):
    """Identity block at the head of the dose sheet, common to FIG. 13/14."""
    sc.card(0, top, DEV_W, sc.dev_h - top - 4, r=30, lw=LW_OUTLINE)
    sc.sh.rect(sc.px(DEV_W / 2 - 24), sc.py(top + 18), sc.d(48), sc.d(5),
               lw=LW_THIN, r=sc.d(2.5))
    sc.card(20, top + 32, 48, 48, r=13, lw=LW_NORMAL)
    sc.text("I", 44, top + 64, T_SUB, bold=True, align="c")
    sc.text(MED_NAME, 80, top + 54, T_SUB, bold=True)
    sc.text(MED_CONC, 80, top + 76, T_BODY)
    sc.avatar(20, top + 98, 44, mono)
    sc.text(who, 76, top + 128, T_SUB, bold=True)
    sc.check("dose head", who, 76, 370, T_SUB, True)


def _stat_pair(sc, y, items):
    for i, (lab, val, note) in enumerate(items):
        bx = 20 + i * 178
        sc.card(bx, y, 170, 74, r=14, lw=LW_THIN)
        sc.text(lab, bx + 12, y + 26, T_BODY)
        sc.text(val, bx + 12, y + 50, T_SUB, bold=True)
        sc.text(note, bx + 12, y + 68, T_BODY)
        sc.check("stat note", note, bx + 12, bx + 170)


def _window(sc, y, label, right, filled_frac, given, nextok):
    sc.card(20, y, 350, 76, r=14, lw=LW_THIN)
    sc.text(label, 32, y + 26, T_BODY)
    sc.text(right, 358, y + 26, T_BODY, bold=True, align="r")
    sc.check("window head", label + "  " + right, 32, 358)
    sc.pill(32, y + 36, 326, 12)
    if filled_frac > 0:
        sc.sh.hatch_rect(sc.px(32), sc.py(y + 48), sc.d(326 * filled_frac),
                         sc.d(12), spacing=3.0, angle=45)
    sc.text(given, 32, y + 68, T_BODY)
    sc.text(nextok, 358, y + 68, T_BODY, align="r")
    sc.check("window feet", given + "  " + nextok, 32, 358)


# ================================================================== FIG. 13

def fig13(sh):
    """Terminal state (a): dose volume 166 displayed in units of volume."""
    sc = Screen(sh, CX - 54.0, TOP + 8.0, dev_h=712)
    sc.frame()

    sc.text("WHO IS THIS DOSE FOR?", 16, 72, T_BODY, bold=True)
    sc.card(16, 84, 358, 28, r=10, lw=LW_THIN, dash=(3, 3))

    top = 136.0
    _dose_sheet_head(sc, top, "EM", "EMMA · 38 lb")

    # status banner -- safe to give
    sc.card(20, top + 154, 350, 68, r=16, lw=LW_NORMAL)
    sc.card(32, top + 166, 44, 44, r=12, lw=LW_THIN)
    sc.dot(54, top + 188, 8.0, fill=0)
    sc.text("SAFE TO GIVE", 90, top + 186, T_SUB, bold=True)
    sc.text("LAST DOSE 5 h 12 m AGO", 90, top + 208, T_BODY)
    sc.check("FIG.13 banner", "LAST DOSE 5 h 12 m AGO", 90, 362)

    _stat_pair(sc, top + 234, (("WEIGHT", "38 lb", "UPDATED 9 d"),
                               ("LAST DOSE", "5 h 12 m", "BY DAD")))
    _window(sc, top + 320, "DOSING WINDOW", "OPEN NOW", 1.0,
            "GIVEN 6:28 PM", "NEXT OK NOW")

    # ---- dose volume 166 --------------------------------------------------
    sc.card(20, top + 406, 350, 80, r=16, lw=LW_OUTLINE)
    sc.text("AMOUNT", 32, top + 430, T_BODY)
    sc.text("9.0 mL", 32, top + 468, T_DISPLAY, bold=True)
    for i, gl in enumerate(("–", "+")):
        bx = 254 + i * 60
        sc.card(bx, top + 420, 52, 52, r=13, lw=LW_NORMAL)
        sc.text(gl, bx + 26, top + 456, T_SUB, bold=True, align="c")

    sc.text("180 mg · FILL VESSEL 110 TO 9 mL", 20, top + 508, T_BODY)
    sc.check("FIG.13 fill", "180 mg · FILL VESSEL 110 TO 9 mL", 20,
             374)
    sc.button(20, top + 520, 350, 52, "LOG 9.0 mL FOR EMMA")

    xr = SIGHT_X1 - 40
    xl = SIGHT_X0 + 2
    sh.ref(140, xr, sc.py(54), sc.px(DEV_W) + 2, sc.py(66))
    sh.ref(160, xr, sc.py(top + 46), sc.px(DEV_W) - 12, sc.py(top + 36))
    sh.ref(166, xr, sc.py(top + 470), sc.px(110), sc.py(top + 462))
    sh.ref(152, xr, sc.py(top + 566), sc.px(370), sc.py(top + 546))
    sh.ref(110, xl, sc.py(top + 512), sc.px(126), sc.py(top + 504),
           elbow=[(sc.px(0) - 20, sc.py(top + 512))])
    sh.ref(154, xl, sc.py(top + 130), sc.px(42), sc.py(top + 120),
           elbow=[(sc.px(0) - 20, sc.py(top + 130))])

    bottom = sh.note(
        "TERMINAL STATE (a) OF FIG. 7. DOSE VOLUME 166 IS GIVEN IN UNITS OF "
        "LIQUID VOLUME AND REFERRED TO A GRADUATION ON SIDEWALL 112, SO THE "
        "CAREGIVER NEVER CONVERTS A MASS INTO A VOLUME. CONFIRMING WRITES AN "
        "ENTRY TO RECORD 152.", CX, sc.bottom - 24, width=444)

    sh.caption("FIG. 13", "DOSING CARD 160 — DOSE VOLUME 166", bottom - 6,
               width=444)


# ================================================================== FIG. 14

def fig14(sh):
    """Terminal state (c): too-early indication 168 in place of the volume."""
    sc = Screen(sh, CX - 54.0, TOP + 8.0, dev_h=712)
    sc.frame()

    sc.text("WHO IS THIS DOSE FOR?", 16, 72, T_BODY, bold=True)
    sc.card(16, 84, 358, 28, r=10, lw=LW_THIN, dash=(3, 3))

    top = 130.0
    _dose_sheet_head(sc, top, "NO", "NOAH · 31 lb")

    # ---- too-early indication 168 -----------------------------------------
    sc.card(20, top + 154, 350, 124, r=16, lw=LW_OUTLINE)
    sc.card(32, top + 166, 44, 44, r=12, lw=LW_NORMAL)
    sc.dot(54, top + 188, 8.0, fill=1)
    sc.text("TOO EARLY", 90, top + 184, T_SUB, bold=True)
    sc.text("WAIT 1 h 40 m", 90, top + 206, T_BODY)
    sc.text("NOAH HAD IBUPROFEN 2 h 20 m AGO.", 32, top + 234, T_BODY)
    sc.text("NEXT IBUPROFEN AT 9:40 PM.", 32, top + 254, T_BODY)
    sc.text("ACETAMINOPHEN IS OK NOW.", 32, top + 272, T_BODY, bold=True)
    sc.check("FIG.14 line1", "NOAH HAD IBUPROFEN 2 h 20 m AGO.", 32, 362)

    _stat_pair(sc, top + 290, (("WEIGHT", "31 lb", "UPDATED 3 w"),
                               ("LAST DOSE", "2 h 20 m", "SARA")))
    _window(sc, top + 376, "DOSING WINDOW", "WAIT 1 h 40 m", 0.58,
            "GIVEN 7:20 PM", "NEXT OK 9:40 PM")

    # the volume is suppressed, not merely hidden
    sc.card(20, top + 462, 350, 58, r=16, lw=LW_NORMAL, dash=(5, 4))
    sc.text("DOSE VOLUME SUPPRESSED", DEV_W / 2, top + 497, T_SUB, bold=True,
            align="c")
    sc.button(20, top + 528, 350, 52, "SEE WHAT IS SAFE NOW", filled=False)

    xr = SIGHT_X1 - 40
    xl = SIGHT_X0 + 2
    sh.ref(140, xr, sc.py(54), sc.px(DEV_W) + 2, sc.py(66))
    sh.ref(160, xr, sc.py(top + 46), sc.px(DEV_W) - 12, sc.py(top + 36))
    sh.ref(168, xr, sc.py(top + 190), sc.px(370), sc.py(top + 184))
    sh.ref(152, xl, sc.py(top + 258), sc.px(20), sc.py(top + 250),
           elbow=[(sc.px(0) - 20, sc.py(top + 258))])
    sh.ref(154, xl, sc.py(top + 130), sc.px(42), sc.py(top + 120),
           elbow=[(sc.px(0) - 20, sc.py(top + 130))])

    bottom = sh.note(
        "TERMINAL STATE (c) OF FIG. 7. TOO-EARLY INDICATION 168 REPLACES THE "
        "DOSE VOLUME, NAMES THE REMAINING INTERVAL, AND OFFERS THE SECOND "
        "MEDICATION WHERE THE CROSS-MEDICATION INTERVAL PERMITS.", CX, sc.bottom - 24, width=444)

    sh.caption("FIG. 14",
               "DOSING CARD 160 — TOO-EARLY INDICATION 168 IN PLACE OF THE "
               "DOSE VOLUME", bottom - 6, width=444)


# ================================================================== FIG. 15

def fig15(sh):
    """Administration record 152 as propagated to second device 170."""
    sc = Screen(sh, CX - 54.0, TOP + 8.0, dev_h=712)
    sc.frame()

    sc.text("ACTIVITY", 16, 84, T_TITLE, bold=True)
    sc.text("EVERY CAREGIVER, EVERY DOSE", 16, 108, T_BODY)
    sc.check("FIG.15 sub", "EVERY CAREGIVER, EVERY DOSE", 16, 374)

    cx = 16.0
    for i, c in enumerate(("ALL", "EMMA", "NOAH", "AVA")):
        w = sc.tw(c, T_BODY, True) + 26
        sc.pill(cx, 126, w, 32, lw=LW_OUTLINE if i == 0 else LW_THIN)
        sc.text(c, cx + w / 2.0, 147, T_BODY, bold=True, align="c")
        cx += w + 7
    sc.check("FIG.15 chips", "", cx - 7, 374)

    entries = [
        ("TODAY", None, None, None, None, False),
        (None, "EM", "IBUPROFEN · 9 mL · EMMA", "SARA", "6:28 PM", False),
        (None, "AV", "ACETAMINOPHEN · 5 mL", "GRANDPA RAY", "4:42 PM",
         False),
        ("YESTERDAY", None, None, None, None, False),
        (None, "NO", "IBUPROFEN · 5 mL", "GRANDPA RAY", "8:18 PM", True),
        (None, "EM", "ACETAMINOPHEN · 5 mL", "SARA", "11:48 AM", False),
    ]

    y = 180.0
    for head, mono, title, by, clock, merged in entries:
        if head:
            sc.text(head, 16, y + 20, T_BODY, bold=True)
            y += 32
            continue
        sc.card(16, y, 358, 76, r=16)
        sc.avatar(30, y + 16, 44, mono)
        # the clock shares the second line with the caregiver, so the entry
        # title gets the full width of the row
        sc.text(title, 88, y + 36, T_BODY, bold=True)
        sc.text(by, 88, y + 60, T_BODY)
        sc.text(clock, 360, y + 60, T_BODY, align="r")
        sc.check("FIG.15 title", title, 88, 360, T_BODY, True)
        sc.check("FIG.15 by", by, 88, 360 - sc.tw(clock) - 10)
        if merged:
            # entries reconciled by FIG. 9 carry a badge in the real timeline
            bw = sc.tw("MERGED", T_BODY, True) + 18
            bx = 360 - bw
            sc.pill(bx, y + 22, bw, 22, lw=LW_NORMAL)
            sc.text("MERGED", bx + bw / 2.0, y + 38, T_BODY, bold=True,
                    align="c")
            sc.check("FIG.15 merged title", title, 88, bx - 10, T_BODY, True)
        y += 86

    xr = SIGHT_X1 - 40
    xl = SIGHT_X0 + 2
    sh.ref(170, xr, sc.py(62), sc.px(DEV_W) + 2, sc.py(74))
    sh.ref(152, xr, sc.py(220), sc.px(340), sc.py(212))
    sh.ref(154, xl, sc.py(220), sc.px(48), sc.py(212),
           elbow=[(sc.px(0) - 20, sc.py(220))])
    sh.ref(150, xl, sc.py(496), sc.px(120), sc.py(488),
           elbow=[(sc.px(0) - 20, sc.py(496))])

    bottom = sh.note(
        "CAREGIVER-SHARED ADMINISTRATION RECORD 152 AS IT REACHES SECOND "
        "HANDHELD COMPUTING DEVICE 170. AN ENTRY RECONCILED BY THE PROCESS OF "
        "FIG. 9 IS MARKED MERGED AND CARRIES THE EARLIER OF THE TWO "
        "ADMINISTRATION TIMES.", CX, sc.bottom - 24, width=444)

    sh.caption("FIG. 15",
               "ADMINISTRATION RECORD 152 ON SECOND DEVICE 170", bottom - 6,
               width=444)
