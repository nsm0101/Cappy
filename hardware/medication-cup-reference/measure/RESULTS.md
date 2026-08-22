# Derived base-recess measurements

Output of `measure_source_drawing.py` against
`../sources/22-0263-Comar-30-mL-Embossed-Dosage-Cup-Drawing.pdf`.

Re-run it after any change to the source drawing; `cup_geometry.py` must be
updated to match, and the figures regenerated.

```
calibration   rim ⌀42.07 -> 8.5982 px/mm
              base reads 33.030 vs 33.02 stated (0.03 % error)

plan view circles (mm): 18.43, 30.53, 33.03, 42.04
  recess diameter        30.53
  foot ring radial width 1.25

section view
  base panel thickness   0.97
  recess depth           1.20
  floor to foot plane    2.16

uncertainty  1 px = 0.116 mm.
             The calibration check above closed to 0.03 mm, so the
             circle fits are good to about a tenth of a millimetre;
             the section lines are 1-2 px wide, so call the depth
             and panel figures ±0.12 mm.
```

## Reading it

The calibration line is the load-bearing part. Comar states two diameters on
that sheet, ⌀42.07 at the rim and ⌀33.02 at the base. The script scales the
raster using the first and then measures the second. It comes back 33.030
against 33.02 stated — 0.03 % — which is what licenses treating everything
else on the sheet as being to scale, in spite of the DRAWING NOT TO SCALE note
in the title block. If a future revision of the drawing fails that check the
script exits rather than reporting numbers.

The recess is then read twice over, from two views that were drawn
independently:

| | plan view | section view |
|---|---|---|
| recess diameter | 30.53 | 30.5 (wall positions) |
| foot ring width | 1.25 | 1.28 |

Those agree to within a third of a pixel, which is the second reason to trust
the figure.

## What this does not give you

- **Draft angle on the recess wall.** A 3° half-angle over a 1.20 mm depth
  moves the wall 0.06 mm, which is half a pixel. Not resolvable.
- **Corner radii.** Same problem.
- **Whether the gate witness stands proud.** The drawing shows a ⌀3.7 circle
  at the centre of the recess ceiling but says nothing about its height.
- **Mould tolerance.** This is one nominal CAD geometry. It says nothing about
  how much cavity-to-cavity and lot-to-lot variation a real bag of cups has.

All four need a caliper on real samples. See the measurement protocol in
`../README.md`.
