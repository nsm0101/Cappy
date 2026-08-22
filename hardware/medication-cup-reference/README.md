# Medication cup reference

Dimensioned drawings of the cups the Cappy puck seats into, and an honest
account of how well the recess it seats into is actually known.

Everything is generated from one dimensional model, `cup_geometry.py`, so no
drawing can carry a number the model disagrees with. Regenerate with:

```
pip install pymupdf pillow numpy       # for measure/ only
python3 generate_figures.py
```

## Start here: the recess is not a specified feature

**No manufacturer publishes a dimensioned base recess, and it looks like none
ever will.** Comar publishes technical drawings for its whole dosage-cup range.
All four were checked — 22-0263, 22-1211, 22-0717 and 22-1525 — and every one
of them dimensions the same short list:

| dimensioned on every sheet | drawn on every sheet, dimensioned on none |
|---|---|
| rim outside diameter | base recess diameter |
| rim inside diameter | base recess depth |
| overall height | recess wall draft |
| base outside diameter | foot ring radial width |
| internal core diameters | gate witness height, corner radii |

That is not an oversight on one sheet. The recess exists because the cup needs
a standing ring to nest and to sit flat; it is a *consequence* of the wall,
base and ring design rather than a feature anyone specifies. Nothing published
carries a tolerance for it, and nothing obliges a moulder to hold it across a
tool revision or a cavity change. [FIG. 6](figures/FIG-06-controlled-vs-uncontrolled.svg)
draws the split.

The design consequence is the important part: **NMP-001 currently specifies an
interference fit against a diameter that nobody controls.** The base outside
diameter, sitting 1.25 mm away from it, *is* controlled — ⌀33.02 on 22-0263,
⌀37.19 on 22-1211, ⌀41.79 on 22-0717. Any retention that registers on the base
OD is designed to a number the supplier holds. That is worth weighing against
the recess press-fit before the geometry is frozen.

### What can still be got

1. **Your cast.** It is a physical copy of the actual recess, which beats every
   drawing here for your cup. You have the depth at ~2.0 mm. The diameter is
   still the open number — see [the protocol](#measuring-your-cast).
2. **A part specification from the cup's maker.** A published catalogue drawing
   stamped *REFERENCE ONLY … SUBJECT TO CHANGE* is not a controlled document.
   A part spec or cavity print under NDA is where a toleranced recess dimension
   would live, if one exists at all. That is a conversation with the supplier,
   not a search.
3. **A cored cup.** Comar's own flyer says the AccuCup "can be custom-cored for
   a perfect bottle cap fit" and that "custom rib designs can modify the cup to
   accommodate various closure sizes". The tooling is already treated as
   modifiable. A recess cored to a dimension *you* specify is the only route to
   a controlled interference fit — and it turns the fit from something you
   reverse-engineer into something you own.

Everything below is the best available evidence in the meantime. Treat the
DERIVED numbers as "what one manufacturer's CAD happens to say", not as spec.

## The drawings

| figure | what it shows |
|---|---|
| [FIG. 1](figures/FIG-01-cup-section.svg) | Whole cup in section, every stated dimension, graduations at their true heights |
| [FIG. 2](figures/FIG-02-base-recess-detail.svg) | The base recess, section plus a ≈25:1 detail of the corner |
| [FIG. 3](figures/FIG-03-base-plan-view.svg) | Base from below — recess, foot ring, gate, mould marks |
| [FIG. 4](figures/FIG-04-fit-check.svg) | The ⌀27.50 × 1.80 puck in each of the three recesses we have numbers for |
| [FIG. 5](figures/FIG-05-family-comparison.svg) | Three cups that all get called a medication cup, at one scale |
| [FIG. 6](figures/FIG-06-controlled-vs-uncontrolled.svg) | **What the drawings control and what they don't** |

## Where the recess numbers stand

| | diameter | depth | status |
|---|---|---|---|
| your cast | **not measured** | **~2.0 mm** | MEASURED — the only physical evidence |
| Comar 22-0263 | 30.53 ±0.12 | 1.20 ±0.12 | DERIVED from undimensioned CAD geometry |
| Comar 22-1211 | unresolved | unreadable | ribbed base, circles cannot be told apart |
| NMP-001 Rev B | 27.50 | 2.10 | ASSUMED, never checked against a cup |

**Depth.** Your cast at ~2.0 mm broadly vindicates NMP-001's 2.10: the 1.80 mm
puck finishes about 0.20 mm inside the foot-ring plane, so the cup still stands
on its own ring. The catalogue cup at 1.20 mm would leave the same puck 0.60 mm
proud and rocking — which is a good illustration of why this dimension cannot
be assumed to travel between SKUs.

**Diameter.** Still the open question and the one that decides the design.
NMP-001 assumes ⌀27.50; the one drawing that can be read says ⌀30.53. Against
friction pads that project 1.25 mm, that is the difference between a grip and a
drop-out.

## The 30.5 coincidence

The earlier measurement pass (`cappy-patent/reference/MEASUREMENTS.md`, in the
now-deleted `cappy-patent/` tree) derived a base outside diameter of **30.5 mm**
from a photograph of the inverted sample cup, reasoning that the token label
spanned about 90 % of the base disc "with only a thin rim of base wall visible
around it".

On the Comar cup, the measured recess is ⌀**30.53** and the foot ring around it
is **1.25 mm** wide — a thin rim of base wall.

The likeliest reading is that the photograph was measured correctly and
labelled wrongly: the circle that dominates an inverted cup is the recess, not
the base outside diameter, and the thin rim around it is the foot ring. If so,
30.5 mm was always a good measurement *of the recess*, and sizing the token to
90 % of it left the puck about 3 mm undersize.

That is a hypothesis fitting two independent observations, not a conclusion.
Your cast settles it: ~30.5 across and it holds; ~27.5 and NMP-001 was right
and the Comar cup is simply a different cup.

## Measuring your cast

Five numbers, and the first is the one that matters.

1. **Diameter across the widest face** — the face that was at the recess
   opening. Three readings at 60° to each other; record all three. More than
   0.1 mm of spread means the recess is not round, which is itself worth
   knowing.
2. **Diameter across the opposite face.** The difference between this and (1),
   over the depth, is the draft angle. Expect the deep face to be smaller, by
   0 to 0.15 mm.
3. **Depth again, near the wall rather than at the centre** — tells you whether
   the recess ceiling is flat or domed.
4. **Any dimple or pip in the middle of a face?** That is the gate witness
   printing into your cast. If it stands proud on the cup it holds a rigid puck
   off the ceiling and lets it rock, whatever the diameters say.
5. **The cup's base outside diameter**, straight off the cup. With (1) this
   gives the foot ring width and places your cup in FIG. 5.

Then update `RECESS_CAST_SAMPLE` in `cup_geometry.py` and re-run
`generate_figures.py`; every figure follows.

Two cautions. A cast can read deep if the material crept past the foot ring or
pulled a meniscus at the opening, and wide if it picked up the corner radius —
so cross-check (3) with a depth gauge on the cup itself. And one cast is one
cavity of one lot: the number that matters for retention is the *spread* across
cups, which needs several samples from different bags.

## Two cups, and why the difference matters

`FIG. 5` draws them at one scale. Both 30 mL, both polypropylene, both sold as
dosage cups:

| | Comar 22-0263 | Comar 22-1211 |
|---|---|---|
| rim ⌀ | 42.07 | 44.45 |
| base ⌀ | 33.02 | 37.19 |
| height | 41.50 | 36.32 |
| graduations | embossed, 5–30 mL | printed, 15 / 30 mL |
| inside the base | plain | ribbed, cores over a 24 or 28 mm CR closure |

Their base diameters differ by 4.2 mm. Add the institutional 1 oz souffle-style
medicine cup — catalogue base ⌀ 28.58 to 30.36 depending on whose you buy — and
the family spans 8.6 mm at the base. A puck that grips one need not touch
another, and 1.25 mm of pad projection does not cover 8.6 mm of spread.

That is a product decision as much as an engineering one: whether the puck
ships *with* a cup whose recess you control, or has to survive whatever cup is
already in the house.

## Files

```
cup_geometry.py            the dimensional model — single source of truth
generate_figures.py        emits figures/FIG-*.svg
svgkit.py                  small technical-drawing toolkit
figures/                   the drawing set
sources/                   Comar's published drawings + PROVENANCE.md
measure/                   the metrology behind the DERIVED values
```

## How the DERIVED values were obtained

`measure/measure_source_drawing.py` measures the recess off the geometry of
Comar's drawing. That sheet is stamped *NOT TO SCALE*, so the script proves the
scale before reporting anything: it calibrates on the stated ⌀42.07 rim, then
measures the stated ⌀33.02 base, which comes back 33.030 — 0.03 % out. It then
reads the recess twice from two independently drawn views, which agree to a
third of a pixel. Output and the list of what the method cannot recover:
[`measure/RESULTS.md`](measure/RESULTS.md).

That rigour is about the *reading*, not about the underlying number. A precise
measurement of an unspecified feature is still a measurement of an unspecified
feature.

## Standing caveats

- Comar's drawings are *REFERENCE ONLY … SUBJECT TO CHANGE*. Good enough to
  design against and to decide what to measure; not a supply agreement. See
  [`sources/PROVENANCE.md`](sources/PROVENANCE.md).
- Every number here is one nominal geometry. None of it describes mould
  tolerance, cavity-to-cavity variation or lot-to-lot drift. A retention design
  that only works at nominal will fail on a real bag of cups.
- Draft angle and corner radii on the recess are below the resolution of the
  source drawing and remain unmeasured.
- NMP-001 Rev B note 6 still stands: no lip or positive snap feature assumed,
  and retention force needs material and tolerance testing.
