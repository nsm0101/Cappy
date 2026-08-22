# Where the dimensions come from

## Token 120 — from the engineering drawing

`Puck_Engineering_Drawings_NMP-001_RevB.pdf` (NMP-001, Rev B, 2026-08-21) is
the authority for everything about the token and the recess. It marks the two
diameters as inventor-specified basic dimensions.

| feature | value |
|---|---|
| rigid core | Ø 25.00 mm |
| free pad envelope | Ø 27.50 mm |
| installed thickness | 1.80 mm |
| friction pads | 6, on 60° centres |
| pad radial projection | 1.25 mm |
| pad root chord | 12.00 mm (57.37° span, 2.63° gaps, 95.6 % coverage) |
| recess at opening | Ø 27.50 mm |
| recess at deepest plane | Ø 27.30 mm |
| recess depth | 2.10 mm |
| recess wall half-angle | 2.73° |
| face recess when seated | 0.30 mm |
| local cavity Ø at external face | 27.471 mm |
| pad radial deflection | 0.014 – 0.10 mm |
| prior prototype | Ø 26.8 × 2.0 mm |

Note that the drawing is a **concept disclosure with grey fills** — it is
correct as a dimensional source but is not itself filable as a patent drawing.

## Vessel 110 — measured from the sample cup

Taken from the three photographs of the Children's Ibuprofen dosing cup shot
alongside a steel rule. Ratios were read off the images and anchored to the
one dimension already known exactly, the Ø 27.50 mm recess.

The governing observation is from the photograph of the inverted cup: the
token label spans about 90 % of the cup's base disc, edge to edge, with only a
thin rim of base wall visible around it. That fixes

    base outside diameter ≈ 27.50 / 0.90 ≈ 30.5 mm

and everything else follows from the cup's proportions in the same frames.

| feature | value | basis |
|---|---|---|
| base outside diameter | 30.50 mm | token ÷ 0.90, from the inverted-cup photo |
| top rim outside diameter | 40.00 mm | base ÷ 0.75, rim-to-base ratio in frame 1 |
| top rim inside diameter | 37.80 mm | wall thickness below |
| overall height | 41.00 mm | rule reading in frame 1, foreshortening allowed for |
| sidewall thickness | 1.10 mm | typical moulded dosing cup; consistent with the section |
| base thickness | 3.20 mm | leaves 1.10 mm of floor over a 2.10 mm recess |

### Consistency check

Treating the interior as a truncated cone gives a brim capacity of **32.7 mL**,
with graduations standing at

| volume | height above the inside floor |
|---|---|
| 5 mL | 7.4 mm |
| 10 mL | 14.1 mm |
| 15 mL | 20.1 mm |
| 20 mL | 25.6 mm |
| 30 mL | 35.4 mm (94 % of the interior height) |

That is exactly how a 30 mL dosing cup is built — the 30 mL mark sits just
under the rim — and it agrees with the "30 mL" and "15 mL" graduations the
superseded FIG. 1 carried, and with the 5 / 10 / 15 mL marks legible in the
photographs. `geometry.py` computes each tick's height from the volume rather
than placing it by eye.

### Standing caveat

These vessel numbers are inferred from photographs, not supplied by the cup's
manufacturer. They are internally consistent and good enough for a provisional,
where the disclosure turns on the *relationship* between the token and the
recess rather than on the cup's absolute dimensions. If a supplier drawing for
the cup becomes available, update `geometry.py` and regenerate; the figures
will follow automatically.
