"""
Dimensional model for the Cappy dosing vessel and medication-identifying token.

Every value is in millimetres. The token values are the inventor-specified
basic dimensions from engineering drawing NMP-001 Rev B (2026-08-21). The
vessel values are taken from the measured production dosing cup photographed
alongside a rule (see reference/MEASUREMENTS.md) and are held to the one
relationship the drawings must get right:

    token free-pad envelope  27.50 mm
    ---------------------------------  =  0.902
    vessel base outside dia   30.50 mm

The superseded drawing set drew that ratio at 0.42 (FIG. 1) and 0.29 (FIG. 2),
i.e. the token was between 2.1x and 3.1x too small in diameter, which made the
seated token look like a small central button rather than a disc that occupies
essentially the whole underside of the base.
"""

# --------------------------------------------------------------- token 120

CORE_D = 25.00        # rigid core diameter
ENV_D = 27.50        # free pad envelope diameter (six friction pads)
PUCK_T = 1.80        # installed thickness
PAD_N = 6           # number of friction pads
PAD_PROJ = 1.25        # radial projection of each pad beyond the core
PAD_CHORD = 12.00       # pad root chord
PAD_SPAN = 57.37       # degrees of core perimeter subtended by one pad root
PAD_GAP = 2.63        # degrees between adjacent pad roots
INLAY_D = 17.00       # sealed NFC inlay antenna envelope (schematic)
INLAY_T = 0.35        # inlay thickness (schematic)

# ------------------------------------------------------- recess 116 in base

RECESS_D_OPEN = 27.50   # diameter at the lowermost (open) plane
RECESS_D_DEEP = 27.30   # diameter at the deepest plane
RECESS_DEPTH = 2.10    # axial depth
RECESS_HALF_ANGLE = 2.73  # degrees, wall half-angle
FACE_RECESS = 0.30    # token outer face sits this far inside the base surface

# Sanity: the token is thinner than the recess by exactly the face recess.
assert abs((RECESS_DEPTH - PUCK_T) - FACE_RECESS) < 1e-9

# ------------------------------------------------------------- vessel 110

RIM_OD = 40.00       # top rim outside diameter
RIM_ID = 37.80       # top rim inside diameter
BASE_OD = 30.50       # base outside diameter
VESSEL_H = 41.00       # overall height
WALL_T = 1.10        # nominal sidewall thickness
BASE_T = 3.20        # base thickness (recess is cut into its underside)
FLOOR_T = BASE_T - RECESS_DEPTH   # material left over the seated token

assert FLOOR_T > 0.5, "base floor over the recess must stay mouldable"

# Graduations moulded into the sidewall. 5 / 10 / 15 mL are the marks legible
# in the photographs of the sample cup; 20 and 30 mL sit above them and are
# what the superseded FIG. 1 labelled. Heights come from height_for_volume(),
# so each tick is drawn where that volume actually stands.
GRADUATIONS = [
    (5.0, "5 mL"),
    (10.0, "10 mL"),
    (15.0, "15 mL"),
    (20.0, "20 mL"),
    (30.0, "30 mL"),
]
VESSEL_CAPACITY_ML = 32.7   # brim capacity implied by the model above

# ----------------------------------------------------------- key ratios

TOKEN_TO_BASE = ENV_D / BASE_OD          # 0.902
TOKEN_TO_RIM = ENV_D / RIM_OD           # 0.688
RECESS_TO_BASE = RECESS_D_OPEN / BASE_OD  # 0.902

# What the superseded set drew, measured off the vector geometry of
# OLD/Provisional_Application_Drawings_2026-08-21.pdf.
OLD_RATIO_FIG1 = 70.7 / 166.9    # 0.424
OLD_RATIO_FIG2 = 86.9 / 295.8    # 0.294


def annulus_wall():
    """Radial thickness of the base wall left outboard of the recess."""
    return (BASE_OD - RECESS_D_OPEN) / 2.0


def sidewall_radius_at(z):
    """
    Outside radius of the tapered sidewall at height `z` above the base
    underside. Linear taper from BASE_OD at z=0 to RIM_OD at z=VESSEL_H.
    """
    t = max(0.0, min(1.0, z / VESSEL_H))
    return (BASE_OD + (RIM_OD - BASE_OD) * t) / 2.0


def height_for_volume(ml):
    """
    Height above the inside floor at which `ml` millilitres stands, for a
    truncated cone. Used to place the moulded graduations truthfully.
    """
    import math

    r0 = (BASE_OD / 2.0) - WALL_T
    r1 = (RIM_OD / 2.0) - WALL_T
    h = VESSEL_H - BASE_T
    target = ml * 1000.0  # mm^3

    lo, hi = 0.0, h
    for _ in range(80):
        z = (lo + hi) / 2.0
        r = r0 + (r1 - r0) * (z / h)
        vol = math.pi * z * (r0 * r0 + r0 * r + r * r) / 3.0
        if vol < target:
            lo = z
        else:
            hi = z
    return (lo + hi) / 2.0
