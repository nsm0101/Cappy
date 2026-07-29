# Cappy! / CloseDose — Business Plan

**Date:** 2026-07-29
**Stage:** Beta 0.8, pre-revenue
**Related:** `BETA-0.8-SPEC.md`, `RX-PHARMACY-ARCHITECTURE.md`, `INVENTION-DISCLOSURE.md`

> **On the numbers.** Figures marked **[V]** are verified against a cited source. Figures marked **[A]** are assumptions with the reasoning shown. Nothing here is presented as more certain than it is — an investor who catches one inflated number discounts every other number in the deck, and the honest version of this business is strong enough that it doesn't need help.

---

## 1. The thesis in one paragraph

Home medication administration is a coordination and comprehension problem that the physical artifacts involved cannot solve, because a printed label is inert. Cappy! makes the container itself the interface: tap the bottle, and a phone that knows the patient, the household, and everything every caregiver has already given renders a personalized, safety-checked answer. The over-the-counter product proves the interaction with mass-produced, zero-provisioning, zero-PHI tags. The prescription product carries the same interaction into pharmacy, provisioned inside the existing label-print workflow at zero marginal effort for the technician. The defensible asset is not the tag — tags are commodities — it is the resolution layer that makes an identical tag mean something different and individually correct for every person who taps it, and the household medication record that no pharmacy, payer, or EHR possesses.

---

## 2. The problem, quantified

**Dosing errors are the norm, not the exception.** **[V]**

- Over **40%** of caregivers make errors dosing liquid medications; some studies find over 50% measure an incorrect dose or give a dose outside the recommended range.
- Nearly **half** of caregivers gave a dose deviating **more than 20%** from what was prescribed after ED discharge; **1 in 4** deviated by more than **40%**.
- **Over 80%** of pediatric home medication errors involve liquid formulations — exactly the products Cappy! addresses first.
- Teaspoon/tablespoon users err more than mL users (45.1% vs 31.4%), which is a *comprehension* failure, not a diligence failure.

**Interventions work, which means the problem is tractable.** A health-literacy-informed counseling intervention cut error rates roughly in half (54.2% → 30.4%). **[V]** That is the strongest single argument in this plan: this is not an immutable human-factors floor. Better information delivery measurably moves it. Cappy! is that intervention, delivered at every dose instead of once at discharge, at near-zero marginal cost.

**Non-adherence is expensive, and the honest range is wide.** Commonly cited estimates run **$100–300B** annually in avoidable US healthcare costs (3–10% of total spend), with ~125,000 associated deaths and ≥10% of hospitalizations. **[V]** The frequently-quoted "$300 billion" figure is contested — including in the pharmacy trade press — and is most often cited by companies selling adherence products. **Use the $100–300B range and say so.** The lower bound is still enormous, and citing it accurately buys credibility that the upper bound costs.

**The structural gap nobody else can close:** a pharmacy management system knows the prescriptions it filled. It has no visibility into the medicine cabinet. **No existing system can detect that a child received diphenhydramine at 6 PM and cetirizine at 8 PM**, because neither is a prescription and neither appears in any clinical record anywhere. Cappy! is positioned at the only vantage point from which that is visible: the household.

---

## 3. Market

### 3.1 Bottom-up sizing

Assumption stack, so each input can be argued with independently:

| Input | Value | Basis |
|---|---|---|
| US households with children under 18 | ~33M | **[A]** Census order-of-magnitude — **verify before any external use** |
| Share plausibly reachable (smartphone, NFC-capable, English/Spanish) | 85% | **[A]** |
| Serviceable households | ~28M | derived |
| Realistic consumer conversion at maturity | 2–5% | **[A]** Comparable consumer-health subscription penetration |
| Consumer households at maturity | 560K–1.4M | derived |
| Consumer ARPU | $30–48/yr | **[A]** $2.99–3.99/mo |
| **Consumer revenue at maturity** | **$17–67M/yr** | derived |

Consumer alone is a real but modest business. **The consumer product is not the business — it is the proof, the data asset, and the distribution wedge.** State that plainly rather than dressing the DTC number up.

| Input | Value | Basis |
|---|---|---|
| US retail pharmacy locations | ~60K | **[A]** — **verify** |
| Realistic reachable share (chains + independents willing to deploy) | 15% | **[A]** |
| Target locations | ~9K | derived |
| Revenue per location per month | $200–500 | **[A]** SaaS + tag consumables |
| **Pharmacy revenue at maturity** | **$22–54M/yr** | derived |

The pharmacy channel is comparable in size, far higher in margin, dramatically more defensible, and it is where the patent estate has teeth.

### 3.2 Where the real money is

Payers and health systems. A single avoided pediatric readmission is worth thousands; a single avoided acetaminophen hepatotoxicity admission is worth tens of thousands. Adherence-driven readmission reduction is a line item every Medicare Advantage plan and every value-based-care system already budgets for.

This is also the longest sale — 12–24 month cycles, pilot-then-committee, and it will demand outcomes evidence Cappy! does not yet have. **Do not build the company on it, but instrument for it from day one.** The evidence you need in year three is data you must start collecting in year one.

---

## 4. Buyers

| Buyer | Pain | What they buy | Cycle | Verdict |
|---|---|---|---|---|
| **Parents of young children** | 2 AM, sick kid, "did you already give her something?" | Peace of mind; the co-parent sync | Days | **Start here.** Acute, emotional, self-diagnosing |
| **Caregivers of elderly parents** | Multi-drug regimen, multiple adult children coordinating | Same product, different label | Days–weeks | Large adjacent market, minimal product change |
| **Independent pharmacies** | Differentiation vs. chains and mail-order | Loyalty, adherence, a reason to exist | Weeks–months | **Best B2B entry.** Owner decides; no committee |
| **Regional chains** | Star Ratings, adherence measures, differentiation | Measured adherence lift | 6–12 mo | Second, after independent pilots produce data |
| **Health systems** | Readmission penalties, discharge med errors | Transitions-of-care tooling | 12–24 mo | Requires outcomes evidence |
| **Payers / PBMs** | Total cost of care | Reduced utilization | 18–36 mo | Biggest pocket, longest sale |
| **OTC manufacturers** | Shelf differentiation, brand loyalty | Co-branded tags in-pack | 6–18 mo | Underrated. Solves distribution *and* funds it |

**The OTC manufacturer channel deserves more attention than it usually gets.** A manufacturer that ships a Cappy!-enabled cap or in-pack puck gets a differentiated product and a direct channel to the household at the moment of use. They pay for the tag, they distribute it at their scale, and they solve the consumer cold-start problem that would otherwise cost far more than the company can afford. One such deal changes the trajectory of the business more than a hundred pharmacy locations.

---

## 5. Competition

| Category | Examples | Why Cappy! is not that |
|---|---|---|
| Medication reminder apps | Medisafe, MyTherapy, Rx apps | No physical trigger. Manual entry decays within weeks. Cappy!'s entry point is the bottle you're already holding |
| Smart pill bottles / caps | AdhereTech, Pillsy | $30–100/unit electronics, batteries, one bottle each. Cappy!'s tag is cents and needs no power |
| NFC smart packaging | NXP, Thinfilm, CCL Healthcare | **The closest prior art.** They tag the package; they do not resolve the tag against a multi-caregiver household record, do not compute a patient-specific dose, and do not check interactions across Rx and OTC. The tag is the easy part |
| Pediatric dose calculators | Hospital tables, calculator apps | Reference lookups. No memory of what was given, no coordination, no physical trigger |
| Pharmacy adherence programs | Chain-native refill sync | Blind to OTC and blind to the home |

**The moat, honestly assessed.** The tag is a commodity — anyone can buy NTAG stickers. The app is replicable. What is hard to copy: (1) the household medication record spanning Rx and OTC, which compounds in value and which no incumbent is positioned to assemble; (2) the pharmacy workflow integration, whose difficulty is *organizational* rather than technical and therefore doesn't yield to a well-funded fast follower; (3) the patent estate, if the filings in `INVENTION-DISCLOSURE.md` issue on the context-relative-resolution and provisioning-at-print claims.

A large incumbent — CVS, Walgreens, a PBM — could build this. The reason they haven't is that it spans consumer software, physical packaging, and pharmacy operations, and no single P&L owner inside those companies is accountable for all three. That is a real but **temporary** advantage. It argues for moving fast and for making the patent filings count.

---

## 6. Revenue model

**Consumer — freemium.**
- Free: one child, one caregiver, all OTC medications, all safety checks. **Safety is never paywalled.** Gating a dose-limit warning is indefensible on the merits and would be the first thing a journalist writes about.
- Premium ($3.99/mo, $34.99/yr): multiple children, unlimited caregivers, cross-device push sync, history export, widget customization, scheduled-medication reminders.
- The paid boundary is **coordination and convenience**, never safety. This is a values line and a liability line simultaneously.

**Pharmacy — SaaS + consumables.**
- Bridge appliance: $499 one-time or bundled
- $149–299/location/month
- Tags: $0.12–0.35 each (NTAG215) / $0.55–1.00 (NTAG 424 DNA), sold at ~40% margin
- Enterprise tier for chains: usage-based, with adherence reporting

**Manufacturer — licensing.** Per-unit license for Cappy!-enabled packaging plus integration NRE. Highest margin, zero support burden, and it inverts the distribution cost.

**Health system / payer — outcomes contracts.** Per-member-per-month, or shared savings against readmission reduction. Not before year three, and not before you have the data.

---

## 7. Unit economics

**Consumer [A]**

| | |
|---|---|
| CAC (organic + content + pediatrician referral) | $8–25 |
| Starter tag kit COGS | $2.50 |
| Annual ARPU (blended free/paid, 4% conversion) | $1.40 |
| Server cost/household/yr | $0.30 |

Consumer is **not self-funding at a 4% conversion rate.** Do not pretend otherwise. It funds itself only via (a) a manufacturer deal covering tag COGS and distribution, (b) conversion materially above 4%, or (c) treating consumer CAC as a customer-acquisition cost for the pharmacy channel, which is arguably what it actually is. Be explicit with investors about which of these you're betting on.

**Pharmacy [A]**

| | |
|---|---|
| Revenue/location/mo | $149–299 |
| Tag margin at 300 scripts/day, 60% tagged | ~$300–800/mo |
| Bridge hardware COGS | $180 |
| Support cost/location/mo | $25 |
| **Gross margin** | **~75–85%** |
| Payback on hardware | < 2 months |

Pharmacy economics work on their own. This is the business.

---

## 8. Go-to-market

**Phase 1 — Consumer beta (now → 6 months).** Ship 0.8. Seed 500–1,000 households via pediatrician offices, parenting communities, and NICU/peds discharge. Instrument everything: tap rate, dose-logging retention, multi-caregiver activation, and above all **caught near-misses** — every time the app blocked a too-early or duplicate-antihistamine dose is a data point that becomes the pitch.

**Phase 2 — Independent pharmacy pilot (6–12 months).** Three to five independents. Owner-operators decide in one conversation. Prove the zero-keystroke claim with a stopwatch and the mis-bind rate with a count. Execute BAAs. **The exit criterion is not revenue — it is a technician saying the workflow didn't change.**

**Phase 3 — Manufacturer conversation (9–18 months).** With consumer traction and pharmacy proof, approach OTC manufacturers of pediatric analgesics and antihistamines. Target: one co-branded pilot SKU.

**Phase 4 — Regional chain (18–30 months).** Adherence lift data from Phase 2, Star Ratings framing, 10–50 stores.

**Phase 5 — Payer / health system (30 months+).** Only with outcomes data.

**Distribution unlocks, in order of leverage:** (1) an OTC manufacturer packaging deal — solves cold start and COGS simultaneously; (2) pediatrician-office distribution — free tags in well-child visit bags, trusted channel, near-zero CAC; (3) hospital discharge — the moment of maximum motivation and maximum documented error rate.

---

## 9. Risks

| Risk | Severity | Response |
|---|---|---|
| **Regulatory: FDA CDS classification** | High | Computing doses and prompting administration approaches Clinical Decision Support. Maintain the coordination-aid framing, the disclaimer on every dose surface, and never auto-administer. **Get a regulatory opinion before pharmacy pilot, not after** |
| **Liability from a wrong dose** | High | Server-authoritative safety math, fail-closed on unknown medications (`BETA-0.8-SPEC.md` §0), hash-chained audit log, insurance, and counsel-reviewed terms. The §0 defect is a live example of exactly this risk class |
| **Consumer conversion below model** | High | Most likely failure mode. Mitigate by treating pharmacy/manufacturer as the primary business earlier than feels comfortable |
| **HIPAA / BAA burden at pharmacy** | Medium | Architecture already minimizes PHI (`RX-PHARMACY-ARCHITECTURE.md` §6). Budget months, not weeks |
| **Trade dress exposure on med card lockups** | Medium | Counsel clearance in the same engagement as the provisional (`BETA-0.8-SPEC.md` §1.6) |
| **Print-stream parsing fragility across PMS updates** | Medium | Fail closed, fingerprint library, parse-confidence alerting; migrate to structured feeds per chain |
| **Incumbent builds it** | Medium | Patents, speed, and the household data asset they cannot retroactively assemble |
| **NFC tap failure / user unfamiliarity** | Medium | QR co-located on every artifact — the reason the puck design matters |
| **Tag supply chain for 424 DNA keys** | Medium | Longest lead time of anything in the plan. **Start supplier conversations now** |

---

## 10. Funding and milestones

**Pre-seed / seed: $750K–1.5M, 18 months.**

Allocation **[A]**: engineering 45%, pharmacy pilot + hardware 20%, legal/IP/regulatory 15%, consumer acquisition 12%, ops 8%.

The legal/IP line is larger than typical for a seed-stage consumer app and should stay that way. This company's defensibility is disproportionately legal, and its risk is disproportionately regulatory.

**Milestones that justify a Series A:**

1. 5,000 active households, 40%+ month-3 retention
2. Documented near-miss prevention count — *the* headline metric
3. Three pharmacy pilots live, technician time delta ≈ zero, BAAs executed
4. Non-provisional filed with claims informed by a professional search
5. One manufacturer LOI
6. Rx tag path proven end-to-end: provision → lock → claim → resolve → void

Milestone 2 is the one that matters. Everything else is table stakes; "we prevented N doses that shouldn't have happened, here is the audit log" is the sentence that raises the round.

---

## Sources

- [Preventing Home Medication Administration Errors — AAP *Pediatrics*](https://publications.aap.org/pediatrics/article/148/6/e2021054666/183379/Preventing-Home-Medication-Administration-Errors)
- [Health Literacy–Informed Intervention Reduces Pediatric Caregiver Liquid Medication Dosing Errors — AHRQ](https://www.ahrq.gov/news/newsletters/e-newsletter/911.html)
- [Liquid Medication Dosing Errors in Children: Role of Provider Counseling Strategies — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC4034520/)
- [Measurement of Ambulatory Medication Errors in Children — AAP *Pediatrics*](https://publications.aap.org/pediatrics/article/152/6/e2023061281/195645/Measurement-of-Ambulatory-Medication-Errors-in)
- [Adherence and health care costs — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC3934668/)
- [Does Nonadherence Really Cost the Health Care System $300 Billion Annually? — Pharmacy Times](https://www.pharmacytimes.com/view/does-nonadherence-really-cost-the-health-care-system-300-billion-annually)
- [Medication non-adherence: a common and costly problem — PAN Foundation](https://www.panfoundation.org/medication-non-adherence/)
- [NFC Medication Adherence — CCL Healthcare](https://cclhealthcare.com/packaging-products/pharmaceutical-labels/smart-and-intelligent-packaging/nfc/nfc-medication-adherence/)
