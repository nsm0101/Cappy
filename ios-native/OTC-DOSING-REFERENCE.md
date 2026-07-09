# Pediatric Liquid OTC Medication Reference

Reference for expanding Cappy's weight-based dosing engine (`Dosing.swift`) beyond acetaminophen/ibuprofen. Ordered by priority — most important to add first. Concentrations pulled from current manufacturer labeling / DailyMed / pediatric-practice dosing charts as of July 2026 (sources below); **every mg/kg figure needs your — or a pharmacist/pediatrician's — sign-off against current AAP/manufacturer guidance before it gets hardcoded**, since `Dosing.swift` is explicitly the safety-critical single source of truth for dose math in the app.

## Already supported

| Medication | Concentration | Notes |
|---|---|---|
| Acetaminophen | 160 mg / 5 mL | Standardized across infant + children's liquid since the 2011 FDA-driven industry unification. |
| Ibuprofen | 100 mg / 5 mL (children's); 50 mg / 1.25 mL (infant's) | Infant concentration is less commonly stocked now — worth confirming it's still sold before relying on it. |

## Recommended additions, in priority order

### 1. Diphenhydramine (Benadryl)
- **Concentration:** 12.5 mg / 5 mL (the standard, essentially only liquid concentration on the market)
- **AAP dosing:** 1–2 mg/kg/dose, max single dose 50 mg
- **Why first:** most common third liquid a family needs alongside fever reducers — allergic reactions, hives, itching.
- **Safety flag:** FDA/AAP caution against routine sedating-antihistamine use in young children; labeling says consult a doctor under 6. Historical case reports of deaths in children under 6 tied to misuse. Cappy's UI copy for this one should read as "for acute allergic reactions, under a doctor's guidance" rather than a routine daily-allergy med, and should carry a stronger age-gate warning than acetaminophen/ibuprofen do.

### 2. Cetirizine (Zyrtec)
- **Concentration:** 1 mg/mL (i.e. 5 mg / 5 mL)
- FDA-approved from 6 months; once-daily, much milder sedation profile than diphenhydramine
- Well-established age/weight dosing tables, lower safety-caveat burden — good second addition

### 3. Loratadine (Claritin)
- **Concentration:** 5 mg / 5 mL
- Approved from age 1; non-drowsy, once-daily

### 4. Fexofenadine (Allegra)
- **Concentration:** 30 mg / 5 mL
- Approved from 6 months (15 mg/2.5 mL dose in the youngest band; 30 mg/5 mL for ages 2–11)
- Non-drowsy but twice-daily — slightly more scheduling complexity than the once-daily antihistamines above. Lower priority only because it's less commonly kept on hand, not for any safety reason.

### 5. Simethicone (infant gas drops, e.g. Mylicon)
- **Concentration:** 20 mg / 0.3 mL
- Dosing is **not** meaningfully weight-scaled — fixed 0.3 mL per dose regardless of weight within the infant range, up to 12×/day (max 240 mg/day)
- Lower priority for the weight-based dosing *engine* specifically since there's no mg/kg math to build. Easy to add as a simple fixed-dose entry if dose-timing/history tracking is the main value, not the calculator.

### 6. Polyethylene glycol 3350 (Miralax)
- Not a liquid itself — a powder dissolved in a drink; weight-based at 0.4–0.8 g/kg/day for maintenance (up to ~1–1.5 g/kg/day short-term for disimpaction), typically capped around 17 g/day
- Pediatric use is technically off-label (FDA label is adult-focused) though it's the de facto first-line recommendation in pediatric GI practice
- Doesn't fit Cappy's acute "log a PRN dose, track the next-safe-time" model — it's daily maintenance, not as-needed. Would want a distinct "chronic medication" mode (daily reminder, not a dosing-window calculation) rather than folding into the existing engine. Treat as a separate future feature, not a simple extension.

## Explicitly do not add
- **Aspirin** — Reye's syndrome risk in children/teens with viral illness. Never appropriate for pediatric fever/pain.
- **Bismuth subsalicylate (Pepto-Bismol)** — same Reye's syndrome concern (it's a salicylate).
- **Combination cough/cold products** (dextromethorphan, guaifenesin, decongestants, etc.) — FDA-driven manufacturer labeling says do not use under 4; AAP recommends avoiding across the board given weak efficacy evidence and real safety concerns. If this ever gets revisited, treat it as its own heavily-gated category, not a weight-based mg/kg extension of the existing engine.

## Sources
- [Benadryl Dosing — WonderKids Pediatrics](https://www.wonderkidspeds.com/getattachment/5d5b7b4b-9781-450d-b875-eaf4c8ba1996/Benadryl-Dosing.aspx)
- [Diphenhydramine (Benadryl) Dose Chart — Stamford Pediatric Associates](https://stamfordpediatrics.com/medical-information/medication-dosages/diphenhidramine-benadryl-dose-chart/)
- [Children's Zyrtec (Cetirizine) Dosing — PDF](https://cahadr.com/storage/app/media/zyrtec-dosing.pdf)
- [Zyrtec (Cetirizine) Child Dosage Chart — St. Louis Children's Hospital](https://www.stlouischildrens.org/health-resources/dosage-tables/cetirizine-zyrtec-dosage-table)
- [Children's Claritin Syrup 24 Hour Allergy Relief — Claritin.com](https://www.claritin.com/products/childrens-claritin/syrup-24hour)
- [DailyMed — Children's Loratadine Solution](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=505dd329-8987-45f8-986f-65e2bbc4fdd6)
- [DailyMed — Children's Allegra Allergy (fexofenadine) Suspension](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=e2bd23c7-dfba-463a-adbe-2183970da740)
- [Allegra Dosage Guide — Drugs.com](https://www.drugs.com/dosage/allegra.html)
- [Infants' Gas Relief Drops (Simethicone) — DailyMed](https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=966f0506-c2d2-4d3c-bd2d-c5a6b1e0a157)
- [Guide to Manage Functional Constipation in Pediatric Patients — University of Iowa Children's](https://www.healthcare.uiowa.edu/marcom/uichildrens/referring-providers/managing-constipation.pdf)
- [Miralax Dosage Guide for Kids and Adults — GoodRx](https://www.goodrx.com/miralax/dosage)
