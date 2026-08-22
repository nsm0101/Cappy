"""
Dimensional model of the medication cups the Cappy puck has to seat into.

All values in millimetres. Every number carries a provenance tag so that no
figure can quietly present an assumption as a measurement:

    STATED   printed as a dimension on the manufacturer's own drawing
    DERIVED  measured off that drawing's geometry by measure_source_drawing.py,
             with the scale calibrated against two STATED dimensions that came
             back within 0.03 mm (see measure/RESULTS.md)
    CATALOG  published by a distributor as a product spec, no drawing behind it
    ASSUMED  inventor-specified in NMP-001 Rev B, not measured from any cup

The one relationship the puck design turns on is the base recess: its diameter
sets the puck diameter, its depth sets the puck thickness. NMP-001 Rev B
ASSUMED that recess. This model carries the measured one alongside it so the
two can be compared directly (see the FIT block at the bottom).
"""

from dataclasses import dataclass, field


# --------------------------------------------------------------------------
# Comar 22-0263 — 30 mL Embossed Dosage Cup
#
# The classic medication-cup shape: the cup moulded onto OTC liquid
# medications, and the one the founder photographed for the original
# measurement pass. Drawing: sources/22-0263-Comar-30-mL-Embossed-Dosage-Cup-
# Drawing.pdf, downloaded from comar.com 2026-08-22.
# --------------------------------------------------------------------------

@dataclass(frozen=True)
class Cup:
    name: str
    part: str
    rim_od: float
    rim_id: float
    height: float
    base_od: float
    base_id: float
    # base underside
    recess_d: float | None = None
    recess_depth: float | None = None
    panel_t: float | None = None
    foot_ring_w: float | None = None
    gate_d: float | None = None
    capacity_ml: float = 30.0
    overflow_cc: float | None = None
    gram_weight: float | None = None
    material: str = "PP"
    graduations: tuple = ()
    provenance: dict = field(default_factory=dict)

    @property
    def wall_t_rim(self) -> float:
        """Sidewall thickness at the rim."""
        return (self.rim_od - self.rim_id) / 2.0

    @property
    def wall_t_base(self) -> float:
        """Sidewall thickness just above the base."""
        return (self.base_od - self.base_id) / 2.0

    @property
    def taper_half_angle(self) -> float:
        """Included half-angle of the outside sidewall taper, degrees."""
        import math
        return math.degrees(math.atan(((self.rim_od - self.base_od) / 2.0) / self.height))

    @property
    def base_height(self) -> float:
        """Inside floor down to the foot-ring contact plane."""
        return self.panel_t + self.recess_depth


EMBOSSED_30ML = Cup(
    name="Comar 30 mL Embossed Dosage Cup",
    part="22-0263",
    rim_od=42.07,        # STATED  Ø1.656
    rim_id=39.01,        # STATED  Ø1.536
    height=41.50,        # STATED   1.634
    base_od=33.02,       # STATED  Ø1.300
    base_id=31.43,       # STATED  Ø1.237
    recess_d=30.53,      # DERIVED  plan view, ±0.12
    recess_depth=1.20,   # DERIVED  section view, ±0.12
    panel_t=0.96,        # DERIVED  section view, ±0.12
    foot_ring_w=1.25,    # DERIVED  (base_od - recess_d) / 2
    gate_d=3.7,          # DERIVED  central gate witness, ±0.15
    overflow_cc=39.6,    # STATED
    gram_weight=5.1,     # STATED
    graduations=(5, 10, 15, 20, 25, 30),
    provenance={
        "drawing": "22-0263-Comar-30-mL-Embossed-Dosage-Cup-Drawing.pdf",
        "retrieved": "2026-08-22",
        "note": "Drawing marked REFERENCE ONLY / NOT TO SCALE; geometry proved "
                "to scale to within 0.03 mm on two independent stated dimensions.",
    },
)


# --------------------------------------------------------------------------
# Comar 22-1211 — 30 mL AccuCup Printed Dosage Cup
#
# Same nominal capacity, different mould: wider and shorter, and cored with
# internal ribs so it inverts over a 24 mm or 28 mm CR closure. Included
# because "30 mL dosage cup" does not imply one geometry.
# --------------------------------------------------------------------------

ACCUCUP_30ML = Cup(
    name="Comar 30 mL AccuCup Printed Dosage Cup",
    part="22-1211",
    rim_od=44.45,        # STATED  Ø1.750
    rim_id=42.70,        # STATED  Ø1.681
    height=36.32,        # STATED   1.430
    base_od=37.19,       # STATED  Ø1.464
    base_id=36.07,       # STATED  Ø1.420 — 28 mm CR closure clearance
    recess_d=None,       # not resolvable — see note
    recess_depth=None,
    panel_t=None,
    foot_ring_w=None,
    overflow_cc=41.9,    # STATED
    gram_weight=3.7,     # STATED
    graduations=(15, 30),
    provenance={
        "drawing": "22-1211-Comar-30-mL-AccuCup-Printed-Dosage-Cup-Drawing.pdf",
        "retrieved": "2026-08-22",
        "note": "The base plan view raster is ~4.6 px/mm against 8.6 px/mm for "
                "22-0263, and this cup is internally ribbed, so the circles "
                "inside the base outline cannot be told apart: a circle at "
                "~36.5 could be the foot ring and one at ~29.3 could be the "
                "rib root or the recess. Recorded as unresolved rather than "
                "guessed. Depth is not readable at all.",
    },
)


# --------------------------------------------------------------------------
# Institutional 1 oz graduated medicine cup (souffle style)
#
# The cup on a hospital med pass. No manufacturer drawing is published for any
# of the common SKUs; these are distributor catalogue specs, quoted to the
# nearest 1/8 in, so treat them as a family envelope and not as dimensions.
# Nothing about its base underside is published at all.
# --------------------------------------------------------------------------

INSTITUTIONAL_1OZ = Cup(
    name="Institutional 1 oz graduated medicine cup",
    part="family envelope (Choice / Medline / Dart / Dynarex)",
    rim_od=47.63,        # CATALOG 1-7/8 in
    rim_id=45.63,        # CATALOG rim_od less an assumed 1.0 mm wall
    height=34.93,        # CATALOG 1-3/8 in
    base_od=28.58,       # CATALOG 1-1/8 in
    base_id=26.98,       # CATALOG base_od less an assumed 0.8 mm wall
    recess_d=None,       # UNKNOWN — nothing published, nothing measured
    recess_depth=None,
    graduations=(5, 10, 15, 20, 25, 30),
    provenance={
        "drawing": None,
        "retrieved": "2026-08-22",
        "note": "Catalogue specs only. Spread across SKUs is large: rim OD "
                "44.45-47.63, base OD 28.58-30.36, height 32.94-34.93. "
                "Must be caliper-verified on real samples before it drives "
                "any puck dimension.",
    },
)

CUPS = (EMBOSSED_30ML, ACCUCUP_30ML, INSTITUTIONAL_1OZ)


# --------------------------------------------------------------------------
# Recesses
#
# The recess is the feature the puck actually has to fit, and it is *not* one
# number across the family. Three independent characterisations exist, and
# they disagree on depth by nearly a millimetre. Keep them separate rather
# than averaging them: each is a correct statement about a different thing.
# --------------------------------------------------------------------------

@dataclass(frozen=True)
class Recess:
    label: str
    diameter: float | None
    depth: float | None
    provenance: str          # MEASURED | DERIVED | ASSUMED
    of: str
    note: str = ""

    @property
    def complete(self) -> bool:
        return self.diameter is not None and self.depth is not None


RECESS_22_0263 = Recess(
    label="Comar 22-0263, from the drawing",
    diameter=30.53,
    depth=1.20,
    provenance="DERIVED",
    of="one specific catalogue SKU",
    note="Both values read off Comar's own published geometry and cross-checked "
         "between two views; scale calibration closed to 0.03 mm. Good to "
         "±0.12 mm as a statement about the geometry drawn on that sheet — "
         "but Comar does not DIMENSION the recess on any of its four dosage-cup "
         "drawings, so this is a read of an uncontrolled feature. It is what "
         "the CAD happens to say, not a number the moulder holds to. See "
         "CONTROLLED_FEATURES below.",
)


# --------------------------------------------------------------------------
# What the manufacturer actually controls
#
# Checked on all four published Comar dosage-cup drawings (22-0263, 22-1211,
# 22-0717, 22-1525). Every one of them dimensions the same short list, and
# none of them dimensions the base underside at all. The recess exists because
# the cup needs a standing ring; it is a consequence of that, not a specified
# feature, so nobody guarantees it and nothing stops it moving between tool
# revisions.
#
# This matters for retention: an interference fit designed against a diameter
# nobody controls is a fit that can silently stop working.
# --------------------------------------------------------------------------

CONTROLLED_FEATURES = (
    "rim outside diameter",
    "rim inside diameter",
    "overall height",
    "base outside diameter",
    "internal core diameters (closure clearance, rib circle)",
)

UNCONTROLLED_FEATURES = (
    "base recess diameter",
    "base recess depth",
    "recess wall draft",
    "foot ring radial width",
    "gate witness height",
    "corner radii",
)

RECESS_CAST_SAMPLE = Recess(
    label="founder's cast of the sample cup",
    diameter=None,           # ← the decisive open number
    depth=2.0,
    provenance="MEASURED",
    of="the physical cup Cappy is being designed around",
    note="Cast taken from the recess and measured directly, 2026-08-22. This "
         "outranks any drawing read for this cup. The diameter of the same "
         "cast has not been reported yet; it is the number that settles the "
         "puck diameter, because it can be read straight off the cast with "
         "calipers.",
)

RECESS_NMP001 = Recess(
    label="NMP-001 Rev B",
    diameter=27.50,
    depth=2.10,
    provenance="ASSUMED",
    of="nothing — inventor-specified",
    note="Carried on the engineering drawing as a basic dimension. The 2.10 "
         "depth is close to the cast's 2.0. The 27.50 diameter has never been "
         "checked against a physical recess.",
)

RECESSES = (RECESS_CAST_SAMPLE, RECESS_22_0263, RECESS_NMP001)


# --------------------------------------------------------------------------
# CSP-30 — the Cappy Standard Profile
#
# The design target. Not any supplier's part: a profile Cappy owns, describing
# the 30 mL graduated dosing cup that ships on OTC liquid medications, held as
# a nominal plus a tolerance band rather than a point dimension.
#
# The reason to work this way is independence. A point fit to one catalogue
# SKU makes the product hostage to that moulder's next tool revision. A band
# wide enough to cover the population makes the puck fit whatever cup is in
# the house, and the only thing that has to be true is that the population
# really does cluster — which is a question samples answer, not suppliers.
#
# The band below is PROVISIONAL. It is centred on the evidence in this
# package and widened to a defensible guess; SAMPLING_PLAN says how to
# replace the guess with data. Every number is meant to be tightened, and
# tightening the diameter band is what buys back pad travel.
# --------------------------------------------------------------------------

@dataclass(frozen=True)
class Band:
    """A nominal dimension and the spread the design must tolerate."""
    nominal: float
    minus: float
    plus: float
    basis: str

    @property
    def lo(self) -> float:
        return self.nominal - self.minus

    @property
    def hi(self) -> float:
        return self.nominal + self.plus

    @property
    def spread(self) -> float:
        return self.hi - self.lo

    def __str__(self) -> str:
        return f"{self.nominal:.2f} -{self.minus:.2f}/+{self.plus:.2f} " \
               f"({self.lo:.2f}–{self.hi:.2f})"


CSP30_RECESS_D = Band(
    nominal=30.50, minus=0.75, plus=0.75,
    basis="Two independent observations land on ~30.5: the recess measured off "
          "Comar 22-0263's geometry (30.53) and the founder's photo-derived "
          "circle on the sample cup's base (30.5). Band is a provisional guess "
          "at population spread, not a measurement of it.",
)

CSP30_RECESS_DEPTH = Band(
    nominal=2.00, minus=0.30, plus=0.30,
    basis="The founder's cast of an actual OTC cup reads ~2.0, and reports every "
          "recent OTC cup as consistent. Comar 22-0263's drawing reads 1.20, "
          "which is the one datum that disagrees — see DEPTH_CONFLICT.",
)

CSP30_BASE_OD = Band(
    nominal=33.00, minus=0.75, plus=0.75,
    basis="Comar 22-0263 states 33.02. Not a puck-critical dimension, carried "
          "so a cup can be identified as in-family without inverting it.",
)

DEPTH_CONFLICT = """\
Depth is the one place the evidence splits. A physical cast of a real OTC cup
reads ~2.0 mm; Comar 22-0263's published geometry reads 1.20 mm. A physical
measurement of an actual target beats a read of a catalogue drawing, so 2.00
is the nominal.

The split still matters, because a puck is only safe down to the SHALLOWEST
cup it will ever meet, and 1.20 is either (a) a cup outside the family, (b) a
cup inside it that nobody has cast yet, or (c) a bad read. Worth ten seconds
to rule out (c): put calipers on the cast itself, across its thickness. If it
reads ~1.2 rather than ~2.0, the cast captured the recess and the 2.0 came
from somewhere else — 22-0263's floor-to-foot-plane distance is 2.16, which is
close enough to ~2.0 to be worth eliminating.
"""


def puck_for_band(recess_d: Band = CSP30_RECESS_D,
                  recess_depth: Band = CSP30_RECESS_DEPTH,
                  interference: float = 0.15,
                  compressed_clearance: float = 0.20,
                  face_clearance: float = 0.20) -> dict:
    """
    The puck envelope that grips anywhere in the band.

    Two conditions have to hold at once, at opposite ends of the band:

      fits the SMALLEST recess   core + compressed pads must clear recess_d.lo
      grips the LARGEST recess   free pad envelope must exceed recess_d.hi

    The pads span the difference, so the band's spread sets the pad projection
    the design needs. That is the whole relationship: every 0.1 mm shaved off
    the diameter band is 0.05 mm of pad travel handed back.
    """
    core_d = recess_d.lo - 2 * compressed_clearance
    envelope_d = recess_d.hi + 2 * interference
    required_proj = (envelope_d - core_d) / 2.0
    max_thickness = recess_depth.lo - face_clearance
    return {
        "core_d": round(core_d, 2),
        "envelope_d": round(envelope_d, 2),
        "required_pad_projection": round(required_proj, 2),
        "available_pad_projection": PUCK_PAD_PROJ,
        "pad_projection_ok": required_proj <= PUCK_PAD_PROJ,
        "pad_margin": round(PUCK_PAD_PROJ - required_proj, 2),
        "max_thickness": round(max_thickness, 2),
        "current_thickness": PUCK_T,
        "thickness_ok": PUCK_T <= max_thickness,
        "thickness_margin": round(max_thickness - PUCK_T, 2),
    }


def max_tolerable_spread(interference: float = 0.15,
                         compressed_clearance: float = 0.20) -> float:
    """
    How much diametral spread the CURRENT pad geometry can absorb.

    Solving required_proj <= PUCK_PAD_PROJ for the band spread. This is the
    number that decides whether "design to the standard" is viable with the
    puck as drawn: sample enough cups, and if their diameters fall inside this
    much total spread, the existing six-pad architecture already covers the
    population and only the nominal has to move.
    """
    return 2 * PUCK_PAD_PROJ - 2 * interference - 2 * compressed_clearance


SAMPLING_PLAN = """\
Replacing the provisional band with a measured one needs cups, not suppliers.

  1. Collect at least 12 cups from as many different OTC products and brands
     as the house and the nearest pharmacy shelf can supply. Different
     manufacturers matter far more than different bottles of the same product:
     one product is one mould.
  2. For each, record recess diameter, recess depth and base OD. Diameter
     across three axes at 60 degrees; note any cup where those disagree by
     more than 0.1 mm.
  3. Also record the product and manufacturer, so an outlier can be traced to
     a family rather than written off.
  4. Set each band to the observed min and max, then add the moulder's likely
     lot-to-lot drift on top — assume at least +/-0.15 mm beyond what a single
     sample of each mould shows.
  5. Compare the resulting diameter spread against max_tolerable_spread().
     Under it, the puck as architected already covers the population. Over it,
     either the pads grow or the product ships with a cup.

Twelve cups is enough to find out whether the population is one cluster or
two. It is not enough to characterise the tails, and the tails are where
retention fails.
"""


# --------------------------------------------------------------------------
# The puck as drawn in NMP-001 Rev B — all ASSUMED
# --------------------------------------------------------------------------

PUCK_CORE_D = 25.00        # ASSUMED rigid core diameter
PUCK_ENV_D = 27.50         # ASSUMED free pad envelope diameter
PUCK_T = 1.80              # ASSUMED installed thickness
PUCK_PAD_PROJ = 1.25       # ASSUMED radial projection of each friction pad
PUCK_PAD_N = 6

NMP001_RECESS_D_OPEN = 27.50   # ASSUMED recess diameter at the opening
NMP001_RECESS_D_DEEP = 27.30   # ASSUMED recess diameter at the deepest plane
NMP001_RECESS_DEPTH = 2.10     # ASSUMED recess depth
NMP001_FACE_RECESS = 0.30      # ASSUMED puck face sits this far inside the base


# --------------------------------------------------------------------------
# FIT — what the assumed puck actually does in the measured recess
# --------------------------------------------------------------------------

def fit_against(recess: Recess, puck_d: float = PUCK_ENV_D,
                puck_t: float = PUCK_T) -> dict:
    """
    Seat a puck of `puck_d` x `puck_t` in `recess`.

    Positive `radial_gap` means the puck is loose: there is nothing for the
    friction pads to bear against. Positive `proud` means the puck stands
    below the foot-ring contact plane, so the cup rests on the puck instead
    of on its own ring and rocks.

    Either axis can be unknown, and the answer on the other axis still holds —
    which matters here, because the cast sample has a known depth and an
    unknown diameter.
    """
    out = {"recess": recess.label, "puck_d": puck_d, "puck_t": puck_t,
           "pad_projection_available": PUCK_PAD_PROJ}
    if recess.diameter is None:
        out["radial"] = None
    else:
        gap = (recess.diameter - puck_d) / 2.0
        out["radial"] = {
            "radial_gap": gap,
            "diametral_gap": recess.diameter - puck_d,
            "retained": gap <= 0,
            "pads_can_bridge": gap <= PUCK_PAD_PROJ,
        }
    if recess.depth is None:
        out["axial"] = None
    else:
        proud = puck_t - recess.depth
        out["axial"] = {
            "proud": proud,
            "seats_inside_foot_plane": proud <= 0,
            "face_clearance": -proud,
        }
    return out


def puck_envelope_for(recess: Recess, interference: float = 0.15,
                      clearance: float = 0.20) -> dict:
    """
    The puck envelope that fits `recess`.

    `interference` is how far the free pad envelope should stand proud of the
    recess wall so the pads are compressed on assembly. `clearance` is how far
    the puck's outer face should sit inside the foot-ring plane so the cup
    still stands on its own ring.
    """
    out = {"interference_per_side": interference, "face_clearance": clearance}
    if recess.diameter is not None:
        out["core_d"] = round(recess.diameter - 2 * PUCK_PAD_PROJ + 2 * interference, 2)
        out["envelope_d"] = round(recess.diameter + 2 * interference, 2)
    if recess.depth is not None:
        out["max_thickness"] = round(recess.depth - clearance, 2)
    return out


if __name__ == "__main__":
    for c in CUPS:
        print(f"{c.name} ({c.part})")
        print(f"  rim  Ø{c.rim_od:.2f} / Ø{c.rim_id:.2f}   height {c.height:.2f}")
        print(f"  base Ø{c.base_od:.2f} / Ø{c.base_id:.2f}   taper {c.taper_half_angle:.2f}°")
        if c.recess_d:
            dep = f"{c.recess_depth:.2f}" if c.recess_depth else "unknown"
            print(f"  recess Ø{c.recess_d:.2f} x {dep} deep")
        else:
            print("  recess: not characterised")
        print()

    print("=" * 68)
    print(f"NMP-001 puck: Ø{PUCK_ENV_D:.2f} envelope × {PUCK_T:.2f} thick, "
          f"{PUCK_PAD_N} pads projecting {PUCK_PAD_PROJ:.2f}\n")
    for r in RECESSES:
        f = fit_against(r)
        print(f"{r.label}  [{r.provenance}]")
        d = f"Ø{r.diameter:.2f}" if r.diameter else "Ø unknown"
        z = f"{r.depth:.2f} deep" if r.depth else "depth unknown"
        print(f"  recess {d} × {z}")
        if f["radial"]:
            print(f"  radial: {f['radial']['radial_gap']:+.2f} mm per side"
                  f"{'  — pads cannot bridge it' if not f['radial']['pads_can_bridge'] else ''}")
        else:
            print("  radial: UNKNOWN — needs the cast measured across")
        if f["axial"]:
            p = f["axial"]["proud"]
            print(f"  axial:  {p:+.2f} mm "
                  f"{'proud of the foot plane' if p > 0 else 'inside the foot plane'}")
        print(f"  envelope that fits: {puck_envelope_for(r)}")
        print()
