#!/usr/bin/env python3
"""
Build the provisional application drawing set.

    python3 generate.py [--only 1,2,12] [--out DIR]

Writes, into <out>:
    Provisional_Application_Drawings.pdf   the full set, one figure sheet per page
    FIG-nn.pdf                             each sheet on its own
    preview/FIG-nn.png                     150 dpi rasters for review

Everything is generated from geometry.py, so the drawn token / recess / base
proportions cannot drift from the dimensional model.
"""

import argparse
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import figs_app
import figs_mechanical as M
import figs_system as S
from patentkit import Drawings

# Sheet order. Each entry is (figure label, drawing function).
SHEETS = [
    ("FIG-01", M.fig1),
    ("FIG-02", M.fig2),
    ("FIG-03-04", M.fig3_fig4),
    ("FIG-05", S.fig5),
    ("FIG-06", S.fig6),
    ("FIG-07", S.fig7),
    ("FIG-08", figs_app.fig8),
    ("FIG-09", S.fig9),
    ("FIG-10", M.fig10),
    ("FIG-11", M.fig11),
    ("FIG-12", M.fig12),
    ("FIG-13", figs_app.fig13),
    ("FIG-14", figs_app.fig14),
    ("FIG-15", figs_app.fig15),
]


def build(out_dir, only=None):
    os.makedirs(out_dir, exist_ok=True)
    preview = os.path.join(out_dir, "preview")
    os.makedirs(preview, exist_ok=True)

    sheets = SHEETS
    if only:
        keep = {int(v) for v in only.split(",")}
        sheets = [s for i, s in enumerate(SHEETS, 1) if i in keep]

    total = len(SHEETS)

    # combined set
    combined = os.path.join(out_dir, "Provisional_Application_Drawings.pdf")
    doc = Drawings(combined, total)
    for _, fn in sheets:
        fn(doc.sheet())
    doc.save()

    # one file per sheet, each numbered as it is in the combined set
    for idx, (name, fn) in enumerate(SHEETS, 1):
        if only and idx not in {int(v) for v in only.split(",")}:
            continue
        one = Drawings(os.path.join(out_dir, name + ".pdf"), total)
        fn(one.sheet(number=idx))
        one.save()

    render_previews(combined, preview)

    # the filing copy lives at the top of cappy-patent/
    filing = os.path.join(os.path.dirname(out_dir),
                          "Provisional_Application_Drawings.pdf")
    shutil.copyfile(combined, filing)
    return filing


def render_previews(pdf_path, out_dir, dpi=150):
    try:
        import pymupdf
    except ImportError:
        return
    d = pymupdf.open(pdf_path)
    for i, p in enumerate(d):
        p.get_pixmap(dpi=dpi).save(os.path.join(out_dir, "sheet-%02d.png" % (i + 1)))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="1-based sheet numbers, comma separated")
    ap.add_argument("--out", default=os.path.join(
        os.path.dirname(os.path.abspath(__file__)), ".."))
    a = ap.parse_args()
    print(build(os.path.abspath(a.out), a.only))
