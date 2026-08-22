# cappy-patent

Drawing set and supporting material for the provisional patent application on
the Cappy medication-identifying token and dosing system.

```
cappy-patent/
├── Provisional_Application_Drawings.pdf   ← the set to file (14 sheets)
├── figures/                               generated figures + the generator
│   ├── Provisional_Application_Drawings.pdf
│   ├── FIG-01.pdf … FIG-15.pdf            one sheet per file
│   ├── preview/sheet-01.png …             150 dpi rasters for review
│   └── src/                               the generator (see below)
├── reference/                             current, non-filing source material
│   ├── Puck_Engineering_Drawings_NMP-001_RevB.pdf
│   └── MEASUREMENTS.md
└── OLD/                                   superseded — do not file
```

## What changed, and why

### 1. The token is now drawn at its true size relative to the cup

This was the substantive problem with the superseded set. Measured off the
vector geometry of the old drawings:

| view | token ÷ base outside diameter | should be |
|---|---|---|
| old FIG. 1 | 0.424 | 0.902 |
| old FIG. 2 | 0.294 | 0.902 |

The token was drawn between **2.1× and 3.1× too small in diameter** — roughly
4× to 9× too small in area — so it read as a small central button rather than
a disc that fills essentially the whole underside of the base.

The true relationship, from engineering drawing NMP-001 Rev B and the
photographs of the sample cup:

```
token free-pad envelope   Ø 27.50 mm
base outside diameter     Ø 30.50 mm      → token spans 90.2 % of the base
base wall left outboard      1.50 mm      → a thin annulus, nothing more
```

Every figure is generated from `figures/src/geometry.py`, so no drawing can
carry a token size that disagrees with the dimensional model. FIG. 1 is drawn
at a **single true scale in both axes** — the 1.80 mm token and the 2.10 mm
recess are legible at 7 pt/mm without exaggeration, so nothing in that view
needs a disclaimer. FIG. 2, 11 and 12 keep radial scale true and say plainly
where the axial scale is exaggerated.

FIG. 12 also draws the *installed* token correctly: its pads deflect to the
local cavity diameter, so the outline follows the recess wall from Ø 27.471 at
the external face to Ø 27.30 at the deepest plane, with the free Ø 27.50
envelope shown broken outboard of it.

### 2. The app-side figures now match the shipping interface

FIG. 8 and the new FIG. 13–15 are redrawn from the design-system templates in
`Cappy Design System_6.29.26/templates` (`nfc-quick-access`, `dose-log-popup`,
`med-timeline`), which are authored against a 390 pt device. Layout, element
order, hierarchy and copy follow the real screens.

Two departures from a screenshot, both required by 37 CFR 1.84(a)(1):

* **No colour.** Where the interface uses colour to carry meaning — the
  dose-status pills — the drawing carries it with a marker glyph instead
  (open = may be given, solid = too early, divided = just given), and each
  sheet says so explicitly.
* **Type is set by role**, at sizes that clear the 1/8 in character minimum,
  rather than scaled down from the device. The hierarchy of the real screen is
  preserved; the absolute sizes are not, because a faithful scale would be
  both illegible and non-compliant. Copy is trimmed to fit, and the generator
  fails the build if any string overruns its container.

### 3. Compliance problems in the old set are fixed

The superseded PDF carried text as small as **5.2 pt** — far under the 1/8 in
(≈ 12.55 pt Helvetica) minimum of 37 CFR 1.84(p)(3) — along with zero-width
hairline strokes, a short left margin on sheet 2, a dozen embedded Type 3
fonts from a mixed toolchain, and no sheet numbering.

The new set uses one font family (Helvetica / Helvetica-Bold), three explicit
stroke weights (0.65 / 0.80 / 1.10 pt), a 12.7 pt floor on every glyph, and
consecutive `n / 14` sheet numbers. `figures/src/audit.py` checks all of this
mechanically and currently reports no violations.

## Sheet list

| sheet | figure | subject |
|---|---|---|
| 1 | FIG. 1 | Exploded perspective — vessel 110 and token 120, true scale |
| 2 | FIG. 2 | Section — token 120 seated in recess 116 |
| 3 | FIG. 3 / FIG. 4 | Plan views of first face 122 and second face 126 |
| 4 | FIG. 5 | Medication dosing system 100, block diagram |
| 5 | FIG. 6 | Dose volume determination with body-mass freshness gate |
| 6 | FIG. 7 | Same-medication and cross-medication interval interlock |
| 7 | FIG. 8 | Dosing card 160 — roster 162 with status indicia 164 |
| 8 | FIG. 9 | Offline reconciliation of administration entries |
| 9 | FIG. 10 | Plan view — second face 126 and six-pad geometry |
| 10 | FIG. 11 | Section A-A through opposing pads, free state |
| 11 | FIG. 12 | Enlarged detail — token 120 installed in recess 116 |
| 12 | FIG. 13 | Dosing card 160 — dose volume 166 |
| 13 | FIG. 14 | Dosing card 160 — too-early indication 168 |
| 14 | FIG. 15 | Administration record 152 on second device 170 |

Reference numerals 110–190 are unchanged from the superseded set, so existing
specification text still reads correctly against these drawings.

FIG. 13, 14 and 15 are **new**. They need brief-description entries added to
the specification before filing; suggested wording:

> FIG. 13 is a view of the dosing card displaying the dose volume for a
> selected care recipient.
> FIG. 14 is a view of the dosing card displaying the too-early indication in
> place of the dose volume.
> FIG. 15 is a view of the caregiver-shared administration record as
> propagated to a second handheld computing device.

## Regenerating

```
cd figures/src
pip install pymupdf reportlab pillow      # once
python3 generate.py                       # writes the whole set + previews
python3 audit.py ../Provisional_Application_Drawings.pdf
```

`generate.py --only 1,2` rebuilds selected sheets. Change a dimension in
`geometry.py` and every affected figure follows; the generator raises rather
than silently producing an overflowing box or an off-page drawing.

## Before filing

* Add the FIG. 13–15 brief descriptions to the specification.
* Confirm the vessel dimensions in `geometry.py`. The token values are
  inventor-specified basics from NMP-001 Rev B; the vessel values are
  **measured from photographs** of the sample cup and are recorded in
  `reference/MEASUREMENTS.md`. They are self-consistent (they imply a 32.7 mL
  brim capacity, matching the 30 mL cup the figures depict) but they are not
  supplier drawings. Only the 27.50 / 30.50 ratio is load-bearing for the
  disclosure.
* The QR patterns in FIG. 4 and FIG. 10 are representative module maps, not
  live payloads — NMP-001 note 5 lists the payload as TBD.
