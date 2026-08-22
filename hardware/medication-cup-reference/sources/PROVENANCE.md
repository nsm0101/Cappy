# Where these files came from

All three were downloaded from comar.com on **2026-08-22**. They are
manufacturer-published reference documents, retrieved from public URLs with no
login. Each drawing carries Comar's own footer: *PROPRIETARY AND CONFIDENTIAL …
DRAWING AND SPECIFICATIONS PROVIDED FOR REFERENCE ONLY AND SUBJECT TO CHANGE
WITHOUT NOTICE.*

Treat them accordingly: they are a sound basis for design work and for
deciding what to go and measure, and they are **not** a substitute for a
supplier agreement or for dimensions on a part you have actually bought. Do
not redistribute them outside the company, and do not reproduce them in a
patent filing — the derived drawings in `../figures/` exist partly so that
nothing needs to.

| file | Comar part | what it is |
|---|---|---|
| `22-0263-Comar-30-mL-Embossed-Dosage-Cup-Drawing.pdf` | 22-0263 | 30 mL embossed dosage cup. Six views incl. a section and a plan of the base. **The primary source for this reference.** |
| `22-1211-Comar-30-mL-AccuCup-Printed-Dosage-Cup-Drawing.pdf` | 22-1211 | 30 mL printed AccuCup. Wider, shorter, internally ribbed for a bottle-cap fit. |
| `Comar-PCI-Dosage-Cup-Flyer-0280.pdf` | — | Range flyer listing the 20 / 30 / 60 mL round, 20 mL square and 30 mL embossed cups. |

Source pages:

- <https://www.comar.com/catalog/dosage-cups/30-ml-round-embossed-dosage-cup/>
- <https://www.comar.com/catalog/dosage-cups/30-ml-round-accucup-printed-dosage-cup/>

## Not from Comar

The institutional 1 oz graduated medicine cup figures in `../cup_geometry.py`
are **distributor catalogue specs**, not drawings. No manufacturer of that cup
publishes a dimensioned drawing that we could find. Quoted to the nearest
1/8 in:

| source | top ⌀ | base ⌀ | height |
|---|---|---|---|
| Choice 1 oz graduated (WebstaurantStore 346MEDCUP1Z) | 1-7/8 in = 47.63 | 1-1/8 in = 28.58 | 1-3/8 in = 34.93 |
| Medline DYND80000 | 1.75 in = 44.45 | — | 1.3 in = 33.02 |
| Dart P100N souffle (same tooling family) | 1-51/64 in = 45.64 | 1-25/128 in = 30.36 | 1-19/64 in = 32.94 |

They disagree with each other by more than the puck's whole fit budget, which
is the point: that family cannot drive a dimension until someone measures a
real one.
