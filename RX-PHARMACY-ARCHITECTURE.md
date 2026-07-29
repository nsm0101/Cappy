# Cappy! Rx — Pharmacy-Provisioned NFC Medication Tags

**Status:** Design proposal
**Date:** 2026-07-29
**Depends on:** Beta 0.8 (`BETA-0.8-SPEC.md`) — multi-medication catalog, per-medication scheduling, notification matrix
**Related:** ADR-0008 (NTAG215 + Universal Links), `INVENTION-DISCLOSURE.md`

---

## 1. The problem this solves

A prescription label is a fixed, printed artifact. It is small, low-contrast, monochrome, in one language, written at a reading level most patients do not have, and it is stale the moment the regimen changes. It cannot count doses, cannot tell a second caregiver what the first one did, cannot warn about an interaction with something in the same medicine cabinet, and cannot be read at all by someone with low vision at 2 AM.

Cappy!'s OTC system already replaced that experience for four medications by putting a tag on the bottle and the intelligence in the phone. The Rx system extends the same interaction to prescriptions — with the critical difference that **the tag must be provisioned by the pharmacy, at fill time, bound to one specific patient and one specific prescription.**

The design constraint that dominates everything below: **pharmacy technicians will not adopt anything that adds keystrokes.** Retail pharmacy runs at 250–600 scripts/day per store with chronic understaffing. A workflow that adds ten seconds per fill is a workflow that gets bypassed within a week. The system must be *invisible* to the technician or it does not ship.

---

## 2. Architecture at a glance

```
┌── PHARMACY ──────────────────────────────────────────────────────┐
│  Pharmacy Management System (PMS)                                │
│     │ label print job (existing, unmodified)                     │
│     ▼                                                            │
│  Cappy Provisioning Bridge  ── on-prem, no PHI egress ──┐        │
│     │ extracts Rx#, NDC, patient key                    │        │
│     │                                                   ▼        │
│     │                              POST /rx/provision (hashed    │
│     │                              identifiers only) ──► Cappy   │
│     │                              ◄── opaque token             │
│     ▼                                                            │
│  Label Printer + Integrated NFC Encoder                          │
│     ├─ encode NDEF: https://cappy.closedose.com/r/{token}        │
│     ├─ read-back verify                                          │
│     ├─ permanent lock (irreversible)                             │
│     └─ apply label over tag                                      │
└──────────────────────────────────────────────────────────────────┘
                              │  bottle leaves with patient
                              ▼
┌── PATIENT / CAREGIVER ───────────────────────────────────────────┐
│  tap ──► Universal Link ──► Cappy!                               │
│           │                                                      │
│           ├─ not authenticated  → generic landing, ZERO PHI      │
│           ├─ authenticated, not linked → claim flow (2nd factor) │
│           └─ authenticated + authorized → full Rx dose card      │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. The token — why the URI carries nothing

**Requirement: possession of the bottle must not grant access to the prescription.**

A pill bottle is left on a counter, in a bag, in a trash can, in a hotel room. If the tag's URI encoded the patient, the drug, or the Rx number — even obfuscated — then anyone with a phone and thirty seconds has a protected health information disclosure. Encoding PHI in the tag is the single most tempting and most disqualifying shortcut in this design.

**The token is an opaque, high-entropy, meaningless string.**

```
https://cappy.closedose.com/r/K7M2QX8VNP4RTJ9WBDHF3SGY
```

- 128 bits from a CSPRNG, Crockford base32, 25 characters
- No encoded structure: not a counter, not a hash of the Rx number, not derived from anything. Structure invites enumeration and inference
- Stored server-side only as **SHA-256(token)** — a Cappy database breach does not yield working tags
- Rate-limited and monotonically penalized per source on miss, so the namespace cannot be swept

**What an unauthenticated tap returns:** a branded page saying "This is a Cappy! prescription tag. Open the app to view it." Nothing else. No drug name, no pharmacy, no patient, no confirmation that the token is even valid — an invalid token returns the identical page, so the endpoint is not an oracle.

### 3.1 Claim — binding a tag to a person

First tap by an authenticated user who is not yet linked to that Rx starts a claim flow requiring a **second factor the bottle does not carry**:

- Patient date of birth, **plus**
- A 6-character claim code printed on the label in the pharmacy's existing "additional information" block

Both are needed. DOB alone is guessable for a known person; a printed code alone is defeated by having the bottle. Requiring one factor from the physical artifact and one from the person's knowledge means neither a stolen bottle nor a data leak is sufficient alone.

Claim attempts are rate-limited per token (5, then locked pending pharmacy re-verification), logged to the hash-chained audit log, and notify any already-linked caregiver.

Once claimed, the Rx is bound to a Cappy family. Subsequent taps by any authorized caregiver in that family resolve instantly. Taps by anyone else get the generic page — **even though the tag is identical**. Authorization lives in the server, never in the tag.

---

## 4. Tag hardware and the lock

### 4.1 Recommendation: NTAG 424 DNA for Rx, NTAG215 stays for OTC

The OTC stickers can remain NTAG215 (~$0.10–0.30 at volume) because their URI is a public, non-secret medication slug — `ace-child` is the same on every sticker in the world and reveals nothing.

Rx tags should use **NTAG 424 DNA** (~$0.55–1.00 at volume). The reason is SUN (Secure Unique NFC) messaging: the tag emits a URI containing a **per-tap cryptographic MAC and a monotonic tap counter**, computed on-tag with a key that never leaves it.

```
https://cappy.closedose.com/r/K7M2QX8VNP4RTJ9WBDHF3SGY?c=00A3F1&m=8B2E...
```

This buys three things a static tag cannot:

1. **Clone detection.** A copied static tag produces a valid URI forever. A cloned 424 cannot produce a valid MAC for a counter value the server has not seen; a replayed one reuses a counter and is rejected. For a controlled substance this is the difference between a tag and a credential.
2. **Tamper evidence.** A counter that jumps or regresses indicates a tag that has been read out-of-band or substituted.
3. **Diversion signal.** Tap counts and geography on a controlled-substance fill are a genuine signal, and a defensible reason for a pharmacy chain to care about this system at all.

Cost delta at 500 scripts/day is roughly $100–180/store/month. That is small against a single averted readmission and trivial against a diversion event.

**Decision:** NTAG 424 DNA for Rx. Keep the resolver backward-compatible with static tokens so a static-tag pilot is possible before 424 supply is in place.

### 4.2 Permanent lock

After a verified write, the encoder sets the tag irreversibly read-only:

- NDEF message written and **read back and byte-compared** — never trust a write status
- Capability Container set to read-only
- Static and dynamic lock bytes set (one-time programmable; the transition is physically irreversible)
- On 424: `AUTH0` / access-condition bytes set so file writes require the diversified key, and the app-master key rotated off the factory default

Result: the tag can be read by any phone forever and rewritten by no one, including Cappy and including the pharmacy. A tag cannot be repointed at a different prescription after it leaves the counter. **This is a safety property, not just a security one** — a rewritable tag on a medication bottle is a mechanism for giving the wrong drug.

Corollary: a mis-provisioned tag cannot be fixed, only voided. §5.4 covers that.

---

## 5. Pharmacy workflow integration

### 5.1 The wedge: intercept the print stream

Integrating with pharmacy management systems properly means per-vendor work against McKesson EnterpriseRx, Epic Willow Ambulatory, PioneerRx, Liberty, QS/1, Rx30 — each a separate commercial relationship measured in quarters.

**Every one of them prints a label.** The label print job is a universal, vendor-neutral integration surface that requires no vendor's permission.

The **Provisioning Bridge** is a small on-prem appliance (or service on the label workstation) that presents itself as the label printer, parses the incoming job, forwards it unchanged to the real printer, and in parallel drives the NFC encoder.

- Works with any PMS on day one
- Zero changes to pharmacy software, zero IT project, zero vendor negotiation
- Reversible: unplug it and labels print exactly as before

This is the difference between a pilot next quarter and a pilot in two years. Migrate to NCPDP SCRIPT / HL7 v2 / SMART-on-FHIR `MedicationRequest` feeds later, per chain, once the value is demonstrated — **cleaner, and strictly a second step.**

Print-stream parsing is per-PMS-template fragile. Mitigations: ship a template-fingerprint library, fail *closed* (no tag rather than a wrong tag) on unrecognized layouts, and alert on parse-confidence drops after a PMS update.

### 5.2 What the technician does

**Nothing.**

The tag sticker is pre-loaded on the same liner roll as the label stock. The technician sends the label to print exactly as today. The encoder writes and locks the tag as the label advances past the antenna. The label is applied over the tag by the existing applicator or by hand as today.

The only visible change is a printed **tap target** on the label — a small Cappy! mark reading "Tap phone here" — and the claim code in the auxiliary text block.

If encoding fails, **the label prints with the tap target suppressed** and the bottle proceeds as a normal, non-tagged fill. The failure mode is "this bottle isn't smart," never "this bottle points at the wrong drug." A pharmacy will tolerate the first indefinitely and the second never.

### 5.3 Form factors

| Form | Placement | Use |
|---|---|---|
| **Under-label inlay** | Tag on the vial, label applied over it | Default for Rx vials. Universal, tamper-evident, no new SKU |
| **Cap inlay** | Tag in the child-resistant cap | Better ergonomics, but caps get swapped between bottles — **not recommended for Rx**, where mis-binding is the core hazard |
| **Cup puck** | Disc seated in the base of a dosing cup | See §5.5 |
| **Carton insert** | Tag on the inner flap | Unit-of-use / blister packaging |

The under-label inlay is strongly preferred for Rx precisely because it is *not* removable. The physical binding between tag and container should be as permanent as the logical binding between token and prescription.

### 5.4 Voiding

A locked tag cannot be corrected, so correction is server-side:

- Any authorized user or the pharmacy can **void** a token. The record survives; resolution returns "This prescription tag is no longer active."
- Void is automatic on: discontinuation, a new fill of the same Rx (the prior tag voids when the new one is claimed), and expiry (fill date + days supply + configurable grace).
- Voided-token taps are logged. A spike is a signal worth surfacing — someone is tapping bottles that should have been discarded.

### 5.5 The dosing-cup puck

The discs — QR + NFC + printed medication name, seated in the base of a plastic dosing cup — solve a different problem from the bottle tag, and it's a good one.

- **The cup base is dead space** on every dosing cup manufactured. Putting the medication name on the *inside* bottom means the name is visible at the exact moment of pouring, in the caregiver's line of sight, at the moment of highest error risk. Wrong-medication errors happen while looking at the cup, not while looking at the bottle.
- **The QR is the fallback that makes the system honest.** NFC fails: older Androids, cases, low battery, a user who has never tapped a tag. A visible QR in the same artifact means the interaction degrades to a camera instead of to nothing. Any credible claim about accessibility depends on there being a second modality.
- **Interchangeable** — the puck is per-medication, the cup is generic, so one cup serves the household.

For OTC this ships now with the existing public slugs. For Rx, a puck is patient-bound and therefore needs the same claim and void machinery as the bottle tag; treat it as an accessory to a provisioned Rx, not an independent artifact.

---

## 6. Data flow and PHI boundary

**Design goal: Cappy's servers hold as little PHI as the product can function on.**

At provisioning, the Bridge sends:

| Sent | Not sent |
|---|---|
| `rx_hash` = HMAC(pharmacy key, Rx number) | Rx number |
| `patient_hash` = HMAC(pharmacy key, patient ID + DOB) | Patient name, address, DOB |
| NDC (drug identity) | Prescriber identity |
| Days supply, quantity, sig-derived interval | Free-text sig |
| Pharmacy NCPDP ID | |

The HMAC key is generated per pharmacy and **held only by the Bridge**. Cappy cannot reverse a hash to an identifier. Patient identity enters the system only when the patient claims the tag, and then only what they supply themselves.

The drug identity (NDC) is genuinely needed — dosing, interactions, and the card all depend on it — and is stored encrypted per ADR-0005 envelope encryption.

**Compliance:** the pharmacy is a covered entity and Cappy is a business associate. A **BAA is a hard gate on the first production fill**, and the existing `compliance/hipaa/` material must be extended to cover the Bridge as a deployed on-prem component: physical security, key custody, patch responsibility, breach notification. Treat this as a work item with a lead time measured in months, not a checkbox.

---

## 7. Sig parsing — the hardest correctness problem

Turning `"TAKE 1 TABLET BY MOUTH EVERY 6 HOURS AS NEEDED FOR PAIN"` into a structured schedule is where this system is most likely to be quietly wrong.

Position:

1. **Prefer structured fields.** NCPDP SCRIPT and FHIR `Dosage.timing` carry structured frequency. When the Bridge has them, use them and never parse text.
2. **When parsing text, parse conservatively.** A curated pattern library over the ~200 sig forms that cover the large majority of retail volume. Anything outside it → **no schedule**, and the card displays the sig verbatim in large high-contrast type.
3. **"No schedule" is a good outcome, not a failure.** A verbatim sig rendered at 40pt with a read-aloud button already beats the printed label decisively. Structured scheduling is the upgrade, not the floor.
4. **Never infer a PRN interval as a scheduled one.** "Every 6 hours as needed" is PRN — the §2 distinction in the 0.8 spec applies directly, and getting this backwards means telling a parent to give a PRN opioid on a clock.
5. **Pharmacist confirmation for controlled substances.** One tap in the Bridge UI to confirm a parsed schedule, required for CII–CIV. This is the one place where adding a technician interaction is worth it.

---

## 8. What Cappy! shows for an Rx

The payoff — everything the printed label cannot do:

- Drug name in the patient's chosen language, at their chosen size, high contrast, with a **read-aloud** button
- A photo of the actual tablet, from the NDC, so "is this the right pill" is answerable
- Time since last dose and time until next, live
- **Dose logging across caregivers** — the 0.8 sync machinery, unchanged
- Interaction warnings against everything else in the family's Cappy! record, OTC included. *This is the killer feature: the pharmacy's system knows the prescriptions it filled; only Cappy! knows the Tylenol in the cabinet.*
- Refill countdown and one-tap refill request
- Adherence history the patient can show a prescriber
- Days-supply reconciliation — a bottle that should be empty and isn't is a visible signal

---

## 9. Build sequence

| Phase | Scope | Exit criterion |
|---|---|---|
| **R0** | Token service, `/r/{token}` resolver, claim flow, void. Static tags, hand-provisioned | 10 tags, 3 households, no PHI reachable unauthenticated |
| **R1** | Bridge v1 — print-stream parse for one PMS, USB encoder, read-back + lock | 100 consecutive fills, zero mis-binds, zero technician keystrokes |
| **R2** | NTAG 424 DNA, SUN verification, clone/replay detection | Cloned tag rejected; replayed counter rejected |
| **R3** | Single independent pharmacy pilot, BAA executed | 30 days, tech-time delta ≈ 0, measured claim rate |
| **R4** | Structured feeds (NCPDP SCRIPT / FHIR), multi-PMS templates | Two PMS vendors, sig-parse confidence ≥ 95% or clean fallback |
| **R5** | Regional chain, integrated applicator hardware | Unit economics validated at ≥ 10 stores |

---

## 10. Open questions

1. **Regulatory posture.** Displaying the pharmacy's own sig back to the patient is arguably not a medical device. Computing a schedule, warning about interactions, and prompting doses moves toward FDA Clinical Decision Support territory. Cappy!'s existing "coordination aid, never auto-administer, always show the disclaimer" framing is the right defense — get a regulatory opinion before R3, not after.
2. **Who pays.** Pharmacy chain (adherence + differentiation), payer/PBM (readmission reduction), health system (transitions of care), or patient. Payer is the largest pocket and the longest sale. See `BUSINESS-PLAN.md`.
3. **Controlled substances.** The strongest wedge (diversion signal, tap audit) and the heaviest compliance burden. Probably not first.
4. **Applicator hardware.** Build, or partner with an existing label-applicator OEM? Partnering is faster and the OEM already owns the pharmacy relationship.
5. **Tag supply chain.** 424 DNA key provisioning at manufacture requires a trusted supplier relationship and a key-management story. Start it early — it has the longest lead time of anything here.
