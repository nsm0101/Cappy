# Medication cup reference

The design target is **CSP-30** — a profile Cappy owns, describing the 30 mL
graduated dosing cup that ships on OTC liquid medications. Not any supplier's
part number.

Everything is generated from one dimensional model, `cup_geometry.py`, so no
drawing can carry a number the model disagrees with:

```
pip install pymupdf pillow numpy       # for measure/ only
python3 generate_figures.py
```

## Why a profile and not a part

A point fit to one catalogue SKU makes the product hostage to that moulder's
next tool revision, and it puts a supplier relationship on the critical path
of a hardware decision. A **nominal plus a band** wide enough to cover the
population does not. The only thing that has to be true is that the population
really does cluster — and that is a question samples answer, not suppliers.

There is a second reason, and it is the finding that forced this structure.
Comar publishes drawings for its whole dosage-cup range; all four were checked
(22-0263, 22-1211, 22-0717, 22-1525). Every one dimensions the rim, the height,
the base OD and the internal cores. **None of them dimensions the base recess.**
It exists because the cup needs a standing ring — a consequence of the design,
not a specification. No published tolerance, and nothing obliging a moulder to
hold it across a tool revision.

So there was never a supplier number to depend on for this feature. Owning the
profile isn't the riskier path; it's the only one that has a number in it.
[FIG. 6](figures/FIG-06-controlled-vs-uncontrolled.svg) draws that split.

## CSP-30 — provisional

| dimension | nominal | band | basis |
|---|---|---|---|
| recess ⌀ | **30.50** | −0.75 / +0.75 → 29.75–31.25 | two independent observations at ~30.5 |
| recess depth | **2.00** | −0.30 / +0.30 → 1.70–2.30 | cast of a real OTC cup |
| base outside ⌀ | 33.00 | ±0.75 → 32.25–33.75 | identification only, not puck-critical |

[FIG. 7](figures/FIG-07-csp30-standard-profile.svg) draws it, with the two
limit recesses the puck has to work in.

The **band is a provisional guess**, centred on the evidence in this package and
widened to something defensible. It is not a measurement of population spread.
[Sampling](#replacing-the-guess-with-data) replaces it, and tightening the
diameter band is what buys back pad travel.

## What the band does to the puck

[FIG. 8](figures/FIG-08-puck-from-band.svg) works it through. Two conditions
have to hold at opposite ends of the band — the puck must still *enter* the
smallest recess and still *grip* the largest — and the pads span the difference.

| | required | available | |
|---|---|---|---|
| pad travel | 1.10 mm | 1.25 mm | ✅ **0.15 mm to spare** |
| puck thickness | 1.80 mm | 1.50 mm | ⚠️ **0.30 mm over** |

**The six-pad architecture works.** That is the important result. Those pads can
absorb **1.80 mm of total diametral spread** across the cup population — so if
sampling shows the cups fall inside that much spread, the puck as architected
already covers the whole family and nothing structural has to change.

Two things do have to move:

**The diameter has to be re-centred.** Core ⌀25.00 / envelope ⌀27.50 becomes
**core ⌀29.35 / envelope ⌀31.55**. At ⌀27.50 the puck sits ~3 mm under the
nominal recess and never touches the wall — no grip at any point in the band.
This is independent of the standard-versus-supplier question: two separate
observations put the recess at ~30.5, and neither of them is ⌀27.50.

**The thickness is bounded by the shallow end of the depth band, not the
nominal.** At the 2.00 nominal, a 1.80 puck finishes 0.20 mm inside the foot
ring — exactly the fit intended. But at the band's 1.70 edge it stands 0.30 mm
proud and the cup rocks on it. Either thin the puck to 1.50, or establish by
sampling that no cup in the family is shallower than 2.00. That is a real
choice, and sampling is what makes it cheaply.

## The one datum that disagrees

Depth is where the evidence splits: a physical cast of a real OTC cup reads
**~2.0 mm**; Comar 22-0263's published geometry reads **1.20 mm**. A physical
measurement of an actual target beats a read of a catalogue drawing, so 2.00 is
the nominal.

The split still matters, because a puck is only safe down to the shallowest cup
it will ever meet. 1.20 is either a cup outside the family, a cup inside it that
nobody has cast yet, or a bad read.

**Worth ten seconds to rule out the third.** Put calipers on the cast itself,
across its thickness. If it reads ~1.2 rather than ~2.0, the cast captured the
recess and the 2.0 came from somewhere else — 22-0263's floor-to-foot-plane
distance is 2.16 mm, close enough to ~2.0 to be worth eliminating before it
propagates into a thickness decision.

## Replacing the guess with data

Cups, not suppliers. Fully within your control, and it is what turns CSP-30
from a provisional guess into a spec.

1. **Collect at least 12 cups** from as many different OTC products and brands
   as the house and the nearest pharmacy shelf supply. Different manufacturers
   matter far more than different bottles of the same product — one product is
   one mould.
2. **For each, record** recess ⌀, recess depth, base OD. Diameter across three
   axes at 60°; flag any cup where those disagree by more than 0.1 mm.
3. **Record the product and manufacturer** too, so an outlier can be traced to
   a family rather than written off.
4. **Set each band** to the observed min and max, then add likely lot-to-lot
   drift on top — assume at least ±0.15 mm beyond what a single sample of each
   mould shows.
5. **Compare the diameter spread** against `max_tolerable_spread()` (1.80 mm).
   Under it, the puck as architected covers the population. Over it, either the
   pads grow or the product ships with a cup.

Twelve cups is enough to find out whether the population is one cluster or two.
It is not enough to characterise the tails, and the tails are where retention
fails.

Then update `CSP30_RECESS_D` / `CSP30_RECESS_DEPTH` in `cup_geometry.py` and
re-run `generate_figures.py`; every figure and every derived puck dimension
follows automatically.

## The 30.5 coincidence

The earlier measurement pass derived a base outside diameter of **30.5 mm** from
a photograph of the inverted sample cup, reasoning that the token label spanned
about 90 % of the base disc "with only a thin rim of base wall visible around
it".

On the Comar cup, the measured recess is ⌀**30.53**, with a **1.25 mm** foot ring
around it — a thin rim of base wall.

The likeliest reading is that the photograph was measured correctly and labelled
wrongly: the circle that dominates an inverted cup is the recess, not the base
outside diameter. If so, 30.5 mm was always a good measurement *of the recess*,
and sizing the token to 90 % of it is what left the puck ~3 mm undersize. That
is the second observation putting the recess at ~30.5, and it is the reason
CSP-30 is centred there.

## The evidence behind the profile

The Comar drawings are **samples of the class**, not the target. They are the
only published dimensional evidence about this cup family that exists, which is
why they are archived here — using them as evidence creates no dependency.

| figure | what it shows |
|---|---|
| [FIG. 1](figures/FIG-01-cup-section.svg) | An in-family cup in section, every stated dimension, graduations at true heights |
| [FIG. 2](figures/FIG-02-base-recess-detail.svg) | The base recess, plus a ≈25:1 detail of the corner |
| [FIG. 3](figures/FIG-03-base-plan-view.svg) | Base from below — recess, foot ring, gate, mould marks |
| [FIG. 4](figures/FIG-04-fit-check.svg) | The old ⌀27.50 × 1.80 puck in each recess we have numbers for |
| [FIG. 5](figures/FIG-05-family-comparison.svg) | Three cups that all get called a medication cup |
| [FIG. 6](figures/FIG-06-controlled-vs-uncontrolled.svg) | What the drawings control and what they don't |
| [FIG. 7](figures/FIG-07-csp30-standard-profile.svg) | **CSP-30 — the design target** |
| [FIG. 8](figures/FIG-08-puck-from-band.svg) | **The puck that falls out of the band** |

FIG. 5 is the caution worth keeping in view: the wider "medication cup" world
spans 8.6 mm at the base once institutional souffle-style cups are included.
CSP-30 deliberately does **not** try to cover those. It covers the OTC dosing
cup that ships on the bottle, which is the cup Cappy is actually for.

## How the derived values were obtained

`measure/measure_source_drawing.py` measures the recess off the geometry of
Comar's drawing. That sheet is stamped *NOT TO SCALE*, so the script proves
scale before reporting: it calibrates on the stated ⌀42.07 rim, then measures
the stated ⌀33.02 base, which returns 33.030 — 0.03 % out. It reads the recess
twice from two independently drawn views, which agree to a third of a pixel,
and exits rather than reporting if a future revision fails the check. Output:
[`measure/RESULTS.md`](measure/RESULTS.md).

That rigour is about the reading, not the number underneath. A precise
measurement of an unspecified feature is still a measurement of an unspecified
feature — which is the whole argument for owning CSP-30.

## Files

```
cup_geometry.py            the model — CSP-30, the evidence samples, the puck math
generate_figures.py        emits figures/FIG-01..08.svg
svgkit.py                  small technical-drawing toolkit
figures/                   the drawing set
sources/                   the evidence drawings + PROVENANCE.md
measure/                   the metrology behind the DERIVED values
```

## Standing caveats

- CSP-30's band is provisional until the sampling above is done. Every number
  derived from it inherits that status, including the ⌀29.35 / ⌀31.55 puck.
- The archived Comar drawings are *REFERENCE ONLY … SUBJECT TO CHANGE*, and are
  evidence about the class, not a specification of it. See
  [`sources/PROVENANCE.md`](sources/PROVENANCE.md). Not for redistribution or
  filing.
- Nothing here describes mould tolerance or lot-to-lot drift. A retention design
  that only works at nominal will fail on a real bag of cups.
- Draft angle and corner radii on the recess remain unmeasured.
- NMP-001 Rev B note 6 still stands: no lip or positive snap feature assumed,
  and retention force needs material and tolerance testing. The pad-travel
  budget in FIG. 8 is geometry only — it says the pads *reach*, not that they
  *hold*.
