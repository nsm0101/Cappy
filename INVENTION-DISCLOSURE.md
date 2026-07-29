# Invention Disclosure — Cappy! / CloseDose Medication Coordination System

**Inventor:** Nickolas Mancini
**Date of disclosure:** 2026-07-29
**Status:** Attorney work product input — **not a filing, not legal advice**
**Related:** `BETA-0.8-SPEC.md`, `RX-PHARMACY-ARCHITECTURE.md`

---

## ⚠️ Read this first

I am not a patent attorney and this document is not legal advice. It is a **technical disclosure** — the artifact that lets a registered patent attorney draft a provisional quickly and cheaply, because the engineering, the embodiments, and the prior-art positioning are already assembled. Do not file this document as-is.

Three time-sensitive items to raise with counsel **in the first conversation**:

1. **The on-sale / public-disclosure bar.** In the US, a patent application must be filed within **one year** of the first public disclosure, offer for sale, or public use of the invention. Beta distribution, physical stickers or pucks given to anyone outside a signed NDA, a public TestFlight, a pitch to a non-NDA audience, or a public website describing the system can each start that clock. **Most of the world has no grace period at all** — a single public disclosure before filing is an absolute bar to patent rights in Europe, China, and Japan. Establish the earliest disclosure date now, before anything else.
2. **Provisional ≠ placeholder.** A provisional only supports later claims to subject matter it actually describes in enabling detail (35 U.S.C. §112). A thin provisional buys a date it cannot defend. This document is intentionally detailed for that reason. Filing fee is modest — $65 micro / $130 small / $325 large entity — so cost is not the constraint; drafting quality is.
3. **Inventorship and ownership.** If anyone else contributed to conception of any claimed element, they may be a legal co-inventor regardless of contract. Get this right before filing; correcting inventorship later is expensive and can invalidate.

---

## 1. Field

Systems and methods for physically-initiated, context-resolved medication administration coordination — specifically, near-field-communication and optically encoded tags affixed to medication containers whose meaning is resolved server-side against the identity, household, and administration history of the person who scanned them.

---

## 2. The problem

Home medication administration fails in ways the artifacts involved cannot address:

- **Prescription labels are static and inert.** Small, low contrast, monochrome, one language, high reading level. They cannot count doses, cannot reflect a changed regimen, and cannot be read by a low-vision caregiver in a dark room.
- **Multi-caregiver double-dosing.** Two parents, one febrile child, 3 AM. Neither knows what the other did. Acetaminophen overdose is a leading cause of pediatric acute liver failure, and the mechanism is frequently coordination failure, not ignorance.
- **The pharmacy cannot see the medicine cabinet.** A pharmacy management system knows the prescriptions it filled. It has no visibility into OTC purchases. Therefore **no existing system can detect that a child received diphenhydramine at 6 PM and is about to receive cetirizine at 8 PM** — neither is a prescription, so neither appears in any clinical record anywhere.
- **Existing tag-based systems require per-patient provisioning.** Every prior approach binds a tag to a patient or package before use, which means someone must provision it, and which means the tag itself carries or points at protected health information.
- **Cognitive load is highest exactly when capacity is lowest.** Sick child, middle of the night, sleep-deprived adult, mental arithmetic on milligrams per kilogram.

---

## 3. Prior art landscape and where it stops

NFC-based medication adherence is a **crowded field**. Any claim reading on "an NFC tag on a medication container that a smartphone taps to log a dose" is unavailable. Documented prior art includes NXP's NFC blister packs and pill bottles (2015), Thinfilm/Jones Packaging NFC prescription cartons (2016), CCL Healthcare's NFC adherence label products, and a substantial academic literature on mHealth + NFC adherence.

Adjacent art also covers: smart pill bottles with electronic caps, app-based medication reminders, pediatric weight-based dose calculators, e-prescribing and drug–drug interaction checking within pharmacy systems, and serialized anti-counterfeit pharmaceutical tags.

**Counsel should commission a professional search before filing.** My assessment of where the art appears to stop:

| Prior art does | Prior art does not |
|---|---|
| Bind a tag to a patient or package at manufacture / provisioning | Leave the tag deliberately **generic and identity-free**, resolving all specificity from the scanner's authenticated context at scan time |
| Log that *a* dose was taken | Compute a **patient-specific dose and safety verdict** at scan time from that patient's weight, age, and full cross-caregiver administration history |
| Check interactions **within** a pharmacy's own prescription record | Check interactions **across** dispensed prescriptions and household OTC administrations, including **OTC-vs-OTC**, which appears in no clinical record |
| Remind one user | **Arbitrate among multiple caregivers**, propagating one caregiver's action into the safety state and notification eligibility of the others in real time |
| Provision tags as a discrete step | Provision, verify, and **irreversibly lock** a tag as an atomic side effect of an **unmodified existing label-printing workflow** |

---

## 4. Summary of the invention

A medication coordination system in which a machine-readable tag affixed to a container encodes **no patient information and, in the general case, no prescription information** — only an identifier that is resolved by a server into a patient-specific administration decision, using the authenticated identity of the scanning user, the household context active for that user, the administration history of every caregiver in that household, and the current time.

The same physical tag therefore yields **different, individually correct results for different scanning users**, without ever having been provisioned for any of them.

The system spans two tag classes resolved through **one client pipeline and one namespace**:

- **Class-level tags** (OTC): mass-produced, identical, encoding a medication-class identifier such as `ace-child`. Zero provisioning. Zero information content. Any household, any number of patients.
- **Instance-level tags** (Rx): provisioned at dispensing, encoding a high-entropy opaque token that is meaningless without server-side authorization, written and **permanently locked** during the pharmacy's existing label-print operation.

The scanning device does not know or care which class it encountered. That is the architectural point.

---

## 5. Embodiments

### 5.1 Class-level tag with context-relative resolution *(primary — strongest novelty)*

A tag affixed to an over-the-counter medication container bears an NDEF URI record encoding a **medication-class identifier**, e.g. `https://cappy.closedose.com/t/ace-child`. Every tag for that medication class is **byte-identical**. The tag identifies *a kind of medicine* — nothing more.

On scan, a client application transmits the identifier together with the scanning user's authentication credential and active household context. The server:

1. Authenticates the scanning user and verifies household membership
2. Maps the class identifier to a medication record in that household's catalog, honoring per-household product/brand preferences
3. Enumerates every eligible recipient in the household — **pediatric patients and adult caregivers alike**
4. For each, computes: age-gate pathway, weight- or age-band-derived dose and volume, minimum-interval status, rolling-24-hour cumulative cap status, and cross-medication interaction status
5. Returns a per-recipient administration decision

**Consequences that distinguish this from all identified prior art:**

- **The tag needs no provisioning, ever.** It is manufactured, sold, and used with no binding step.
- **The tag carries no PHI and cannot leak any.** A lost, photographed, cloned, or discarded tag discloses only "someone owns children's acetaminophen."
- **One tag serves an unlimited number of patients across an unlimited number of households simultaneously.**
- **The identical tag produces different correct outputs for different scanners** — a 40 lb four-year-old for one user, a 180 lb adult for another, "too early, 2 h 10 m remaining" for a third whose co-parent already dosed.
- **Every downstream state change is caregiver-relative**, not tag-relative.

*Alternative embodiments:* optical code (QR/DataMatrix) encoding the same URI; a printed short code entered manually; a voice-initiated equivalent; BLE beacon; the class identifier encoded as a GTIN/NDC rather than a proprietary slug.

### 5.2 Unified dual-class namespace

Class-level and instance-level identifiers occupy one namespace and one client resolution pipeline. The client parses any accepted form — Universal Link, custom scheme, or bare identifier — and submits it unchanged. The server determines class from the identifier's own form and routes accordingly.

The benefit is that a household moves between OTC and prescription medications with **no change in interaction, no second app, and no mode switch**, and the client requires no update to support a new tag class. Novelty candidate: a single scan pipeline in which identifier class, provisioning state, and authorization model are entirely server-resolved and invisible to the scanning device.

### 5.3 Cross-source interaction detection including OTC-vs-OTC

Because the system holds a unified household administration record spanning dispensed prescriptions **and** household OTC administrations, it detects conflicts no existing system can see.

Worked example, fully enabled in `BETA-0.8-SPEC.md` §5: a caregiver scans a cetirizine container. The server observes a diphenhydramine administration to the same patient 2 hours prior. Both are OTC; **neither exists in any pharmacy or clinical record**. The system interposes a warning identifying the duplicate-class therapy, the additive-sedation risk, and the absence of additive benefit, and requires an explicit override that is audit-logged and propagated to other caregivers.

Detection is table-driven over medication class pairs with **asymmetric lookback windows** reflecting each agent's duration of action (cetirizine ~24 h, diphenhydramine ~4–6 h) — the window applied depends on which agent was given first, not merely on the pair.

*Novelty candidates:* (a) interaction detection across a dispensed-prescription record and a household-maintained OTC administration record; (b) OTC-vs-OTC duplicate-class detection where neither agent appears in any clinical record; (c) asymmetric, direction-dependent lookback windows keyed to per-agent duration of action.

### 5.4 Multi-caregiver arbitration with PHI-free notification

A dose logged by one caregiver on one device propagates to a database trigger, an asynchronous push-notification service, and every other authorized caregiver's device.

Distinguishing features:

- **Per-caregiver × per-medication × per-event-type notification eligibility** — see `BETA-0.8-SPEC.md` §3.3 — with resolution falling back from most to least specific, and a class of **safety events that cannot be disabled**.
- **The notification payload contains no medication name, dose, or condition.** It conveys only that an administration occurred and by whom. Clinical content is retrieved only after the recipient taps through into the authenticated application. A push notification renders on a locked screen in public; the design deliberately separates the *coordination signal* from the *clinical content*.
- **Staleness suppression:** an administration recorded offline and synchronized later does not generate a real-time notification, because the coordination value has expired while the alarm value has not.
- **PRN vs. scheduled modality** determines notification semantics: for as-needed medications the system announces *permission* ("may be given now if still needed"); for scheduled medications it announces *obligation* ("is due"). The system never instructs administration of an as-needed medication.

*Novelty candidate:* a notification whose delivery is triggered by a clinical event but whose payload is deliberately clinically empty, with authorization-gated retrieval of the clinical content on interaction.

### 5.5 Provisioning-at-label-print with irreversible lock *(pharmacy workflow)*

At prescription dispensing, an interposer receives the pharmacy management system's **unmodified label print job**, forwards it unchanged to the printer, and in parallel:

1. Parses dispensing identifiers from the print stream
2. Computes one-way HMACs of patient and prescription identifiers using a key held **only at the pharmacy**, so the remote service never receives reversible identifiers
3. Requests a high-entropy opaque token, stored remotely only as a hash of itself
4. Encodes the token as an NDEF URI onto a tag carried on the same liner as the label
5. **Reads the tag back and byte-compares** before proceeding
6. **Irreversibly locks** the tag — capability container set read-only, one-time-programmable lock bytes set, and on cryptographic tags the access conditions set and factory keys rotated
7. Signals the printer to render a tap-target indicium **only on success**

**Fail-closed property:** if any step fails, the label prints *without* the tap indicium and the container proceeds as a conventional untagged fill. The system's failure mode is "not smart," never "points at the wrong medication."

**Zero-keystroke property:** the technician performs no additional action whatsoever. This is not an ergonomic nicety — it is the enabling condition for adoption in a workflow running hundreds of fills per day, and the reason this differs from every prior provisioning scheme, all of which insert a discrete provisioning step.

*Novelty candidates:* (a) tag provisioning as an atomic, zero-interaction side effect of an unmodified existing print operation, via print-stream interposition requiring no modification to the pharmacy system; (b) verify-then-permanently-lock as a single atomic operation with fail-closed indicium suppression; (c) on-premises one-way hashing of patient identifiers such that the remote service holds no reversible identifier at provisioning time.

### 5.6 Possession-insufficient authorization

Scanning an instance-level tag conveys **no information whatsoever** absent independent authorization. An unauthenticated resolution returns a generic page identical for valid and invalid tokens — the endpoint is not an oracle for token validity.

First binding requires **two factors of different kinds**: one from the physical artifact (a claim code printed in the label's auxiliary text block) and one from personal knowledge (patient date of birth). Neither a stolen container nor a leaked database is independently sufficient.

*Novelty candidate:* a medication container tag for which physical possession is explicitly insufficient for information access, with binding requiring one artifact-borne and one knowledge-borne factor.

### 5.7 Dosing-cup base as tag substrate and identification surface

A disc seated in the interior base of a medication dosing cup, bearing an embedded NFC inlay, an optical code, and the printed medication name.

Distinguishing features:

- **Utilizes an otherwise-unused surface** — the interior base of a dosing cup is dead space on every such cup manufactured.
- **Places the medication name in the caregiver's line of sight at the moment of pouring** — the point of maximum wrong-medication risk, when the caregiver is looking at the cup rather than at the container.
- **Interchangeable**: the disc is medication-specific, the cup generic, so one cup serves an entire household's medications.
- **Co-locates two scanning modalities on one artifact** so the interaction degrades gracefully — NFC failure (unsupported device, protective case, depleted battery, unfamiliar user) falls back to a camera rather than to nothing. This dual-modality co-location is what substantiates the system's accessibility claim.

*Consider both a utility claim on the article and a separate design patent on the ornamental configuration.* Design patents are inexpensive, fast, and useful against direct copying.

### 5.8 Accessibility-substantive presentation

The system's asserted advantage over a printed label is presented as concrete, claimable mechanism rather than a general assertion: dose information rendered at caregiver-selected scale to accessibility-extra-extra-extra-large without truncation or reflow loss; audible dose readout independent of the operating system's screen reader, with units spoken in full ("seven point five milliliters") rather than as abbreviations; every safety state encoded redundantly in color, text, and symbol so no state is conveyed by color alone; and a reduced-luminance, warm-shifted presentation mode for nighttime administration that does not wake the patient being dosed.

---

## 6. Claim-shaped statements

For counsel to draft from. Deliberately over-inclusive; expect most to narrow or be dropped.

**A. Context-relative resolution of an identity-free tag** *(primary independent)*
A method comprising: reading, from a machine-readable tag affixed to a medication container, an identifier denoting a class of medication and containing no patient-identifying and no container-instance-identifying information; transmitting the identifier with an authentication credential of the scanning user; determining a household associated with that credential; identifying a plurality of candidate recipients within that household; computing, for each, an administration decision from that recipient's stored physiological attributes and an administration history aggregated across multiple caregivers; and returning per-recipient decisions — such that identical tags scanned by different authenticated users yield different administration decisions without any tag having been provisioned to any user.

**B. Dependent — dual-population resolution**
The method of A, wherein the candidate recipients comprise both pediatric patients whose decision is computed on a body-mass basis and adult caregivers whose decision is computed on a fixed-dose basis, from the same tag in the same operation.

**C. Cross-source interaction detection**
A method comprising maintaining a unified per-patient administration record spanning dispensed prescription products and non-prescription products administered in the household; detecting, on scan, that a proposed administration and a prior recorded administration belong to a common therapeutic class; wherein at least one of the two is a non-prescription product absent from any clinical record; applying a lookback window selected as a function of *which* agent was administered first; and interposing a warning requiring explicit override, the override being audit-logged and propagated to other authorized caregivers.

**D. Provisioning as a side effect of unmodified label printing**
A method comprising receiving a label print job directed to a printer by a pharmacy management system; forwarding the job unmodified; deriving dispensing identifiers therefrom; obtaining an opaque token bearing no derivable relationship to those identifiers; encoding the token onto a tag carried with the label stock; reading the encoded tag back and verifying byte equality; irreversibly disabling further writes; and causing a tap-target indicium to be rendered on the label only upon successful verification and locking — the method requiring no modification to the pharmacy management system and no additional operator interaction.

**E. Possession-insufficient authorization**
A system wherein resolution of an instance-level tag identifier by an unauthorized requester returns a response identical for valid and invalid identifiers, and wherein binding requires concurrent presentation of a first factor borne on the physical artifact and a second factor of patient knowledge not present on the artifact.

**F. Clinically-empty notification with authorization-gated retrieval**
A method wherein recording an administration by a first caregiver triggers a notification to a second caregiver whose payload identifies that an administration occurred and by whom, and excludes medication identity, dose, and indication; the excluded content being retrievable only upon authenticated interaction; and wherein delivery is suppressed when the elapsed time since administration exceeds a coordination-relevance threshold.

**G. Article — dosing cup insert**
An article comprising a disc dimensioned to seat in the interior base of a medication dosing cup, comprising an NFC inlay and an optically-readable code encoding a common resolution target, and a printed medication identification visible through the cup interior when the cup is empty or filling.

---

## 7. Figures to prepare

Rendered figures accompany this disclosure as `figures/` (see `FIGURES.md`).

1. **FIG. 1** — System architecture: tag, device, resolver, database, notification service
2. **FIG. 2** — Context-relative resolution: one tag, two scanning users, two different outputs *(the money figure)*
3. **FIG. 3** — Dual-class namespace and unified client pipeline
4. **FIG. 4** — Rx provisioning sequence: print job → interpose → mint → encode → verify → lock → indicium
5. **FIG. 5** — Multi-caregiver sync and notification eligibility resolution
6. **FIG. 6** — Cross-source interaction detection with asymmetric windows
7. **FIG. 7** — Claim / authorization state machine
8. **FIG. 8** — Dosing cup puck: exploded, seated, and in-use views
9. **FIG. 9** — Tag lifecycle: manufacture → provision → lock → resolve → void

---

## 8. Reduction to practice — evidence of possession

Strengthens both the disclosure and any later priority dispute. All in this repository, under version control with dated commits:

| Element | Evidence |
|---|---|
| Class-level tag resolution | `ios-native/Cappy/Domain/Tags.swift`; `app/supabase/functions/nfc-resolve/`; live at `cappy.closedose.com/t/{slug}` |
| Weight/age-based dose computation | `ios-native/Cappy/Domain/Dosing.swift` |
| Server-authoritative interval and 24 h cap | `compute_dose_status` RPC, `app/supabase/migrations/20260702013000_*` |
| Multi-caregiver household model | `family_caregivers`, `caregiver_child_access`, RLS in `20260101000100_rls.sql` |
| Dual-population (child + caregiver) resolution | `20260630150000_caregiver_dose_recipients.sql`; `FamilyDashboardView.swift:178` |
| Real-time cross-device propagation | `ios-native/Cappy/Services/Supabase/RealtimeService.swift` |
| Hash-chained tamper-evident audit log | `docs/adr/0007-audit-log-strategy.md`; `audit_events` |
| Tag hardware and payload decision | `docs/adr/0008-nfc-tag-strategy.md` |
| Cross-source interaction detection | `BETA-0.8-SPEC.md` §5 (designed; implementation in progress) |
| Rx provisioning architecture | `RX-PHARMACY-ARCHITECTURE.md` (designed) |
| Physical pucks | Fabricated; photograph and date them, and record the fabrication date |

**Action for counsel:** establish and document the conception date and first-disclosure date for each element above. Note that designed-but-unimplemented embodiments are still disclosable and claimable provided the description is enabling — but the conception evidence matters.

---

## 9. Recommended filing strategy

For counsel's consideration:

1. **One provisional covering all embodiments now.** Broad disclosure, cheap, buys twelve months. Do not split prematurely — a provisional's value is the breadth of what it enables you to claim later.
2. **Professional prior-art search during the provisional year**, before committing to non-provisional claims. NFC-adherence art is dense; the search should specifically target claim elements A, C, and D.
3. **Design patent on the puck in parallel.** Inexpensive, issues in months rather than years, and directly useful against a copyist.
4. **File the non-provisional at month 10–11**, claims shaped by the search and by whatever the market has taught you in the interim.
5. **Decide on PCT / foreign filing before the twelve-month deadline.** This is the irreversible one, and it is also where the no-grace-period rule bites.
6. **Trademark separately and sooner.** "Cappy!" and "CloseDose" are protectable now and are, realistically, the more defensible commercial asset in the near term. Patents deter and attract investment; trademarks are what customers actually attach to.
7. **Have counsel clear the medication card lockups** in the same engagement — see `BETA-0.8-SPEC.md` §1.6. Trade dress in pharmaceutical packaging is protected independently of the word mark, and the exposure rises with commercial scale.

---

## Sources

- [USPTO fee schedule](https://www.uspto.gov/learning-and-resources/fees-and-payment/uspto-fee-schedule) · [Micro entity status](https://www.uspto.gov/patents/laws/micro-entity-status)
- [NXP NFC blister packs and pill bottles (2015)](https://www.nfcw.com/2015/11/18/339766/nxp-launches-nfc-blister-packs-and-pill-bottles-for-medication-tracking/)
- [Smart Labels Enhance Drug Packaging — Pharmaceutical Technology](https://www.pharmtech.com/view/smart-labels-enhance-drug-packaging)
- [NFC Medication Adherence — CCL Healthcare](https://cclhealthcare.com/packaging-products/pharmaceutical-labels/smart-and-intelligent-packaging/nfc/nfc-medication-adherence/)
- [Medication adherence supported by mHealth and NFC — ScienceDirect](https://www.sciencedirect.com/science/article/pii/S2352914821000423)
- [How recent NFC advances enable anti-counterfeit drug containment & support adherence — ONdrugDelivery](https://www.ondrugdelivery.com/how-recent-nfc-advances-enable-anti-counterfeit-drug-containment-support-adherence/)
