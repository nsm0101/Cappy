# Figures — Invention Disclosure

Patent-style line drawings: black on white, no shading, no color, numbered reference elements. Sized for letter paper at 100% scale.

## Drafted

| Figure | File | Shows |
|---|---|---|
| **FIG. 2** | `FIG2-context-relative-resolution.svg` | One identical tag, two scanning users, two different correct outputs. **The primary novelty figure** — if an examiner reads only one drawing, this is it |
| **FIG. 4** | `FIG4-rx-provisioning-sequence.svg` | Print-job interposition → mint → encode → read-back verify → irreversible lock → conditional indicium. Zero-keystroke and fail-closed properties |
| **FIG. 6** | `FIG6-cross-source-interaction.svg` | Unified Rx + household-OTC record, table-driven rules, direction-dependent asymmetric lookback windows, override propagation |
| **FIG. 8** | `FIG8-dosing-cup-puck.svg` | Dosing-cup insert: exploded, seated section, in-use line of sight. Dead-space utilization and dual-modality |

## Reference numeral index

Keep this consistent across all figures — examiners and attorneys both rely on it.

| # | Element |
|---|---|
| 200 | Machine-readable tag (200a/200b class-level, 200r instance-level/Rx) |
| 210 | Scanning device |
| 220 | Resolution service |
| 230 | Household record |
| 240 | Per-recipient administration decision output |
| 300 | Pharmacy management system |
| 302 | Label print job |
| 310 | Provisioning bridge |
| 312 | Print-stream parser |
| 314 | On-premises HMAC of identifiers |
| 316 | NDEF encoder |
| 318 | Read-back verification |
| 320 | Irreversible lock |
| 322 | Indicium decision (fail-closed) |
| 330 | Token service |
| 340 | Label printer with integrated encoder |
| 350 | Dispensed container |
| 400 | Dispensed prescription record |
| 410 | Household OTC administration record |
| 420 | Unified per-patient record |
| 430 | Interaction rule table |
| 440 | Detection engine |
| 450 | Warning interstitial / verdict |
| 460 | Audit log entry |
| 500 | Dosing cup |
| 502 | Interior base |
| 510 | Disc / puck insert |
| 512 | NFC inlay |
| 514 | Optical code |
| 516 | Printed medication identification |

## Still to draft

Lower priority — the four above carry the claims that matter most.

- **FIG. 1** — Overall system architecture
- **FIG. 3** — Dual-class namespace, unified client pipeline
- **FIG. 5** — Multi-caregiver sync; notification eligibility resolution; PHI-free payload boundary
- **FIG. 7** — Claim/authorization state machine (unclaimed → claim attempt → bound → voided)
- **FIG. 9** — Tag lifecycle: manufacture → provision → lock → resolve → void

## Notes for the attorney

- USPTO drawing rules (37 CFR 1.84) govern margins, line weight, shading, and lead lines. These are drafted to be close but **have a draftsperson conform them before filing** — it is inexpensive and rejections on drawings are a pointless delay.
- Every numeral appearing in a figure must appear in the specification text, and vice versa.
- FIG. 8 may also support a **design patent** on the disc's ornamental configuration — a separate, cheaper, faster filing worth doing in parallel.
