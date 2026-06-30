# Cappy — Product Brief

**Owner:** Founder
**Last reviewed:** [DATE]
**Source documents:** Original Cappy_Project_Goals_and_Product_Concept_Brief.docx

This is the canonical, in-repo statement of what Cappy is. When agents
encounter ambiguity, this document is the tiebreaker after `/AGENTS.md`.

## What Cappy is

Cappy is a family medication coordination system anchored on near-field
communication (NFC). When a caregiver is about to give a child a dose
of medication, they tap their phone to a small NFC sticker affixed to
the medication container. The phone opens directly to a quick-action
screen showing: who in the family this medication is for, when the last
dose was given, by whom, and whether another dose is safe to give now.
The caregiver confirms or skips. The action propagates in seconds to
every other authorized caregiver in the family.

## What Cappy is not

- Not a medical device. Cappy does not make clinical decisions or
  replace pediatrician guidance.
- Not a reminder app. Cappy is a record, not a nag.
- Not a pharmacy. Cappy does not fulfill or sell medication.
- Not for non-family contexts in alpha. Schools, daycares, and clinics
  are post-alpha considerations.

## Who uses Cappy

A "family" in Cappy terms is a small group of people who share
responsibility for one or more children's medication. Roles:

- **Admin** — typically a parent. Can add and remove other caregivers,
  add and remove children, set per-child access for other caregivers,
  manage NFC tag assignments, log doses for any child.
- **Caregiver** — typically the other parent, a grandparent, a babysitter.
  Can log doses for children they have access to. Cannot add or remove
  other caregivers.
- **Read-only** — typically a non-resident parent, a co-parent in shared
  custody, an extended family member who wants visibility. Cannot log
  doses but can see the timeline.

Per-child access overrides allow an admin to grant a babysitter access
to one child but not another within the same family.

## The core interaction

The brief calls this "tap to coordinate":

1. Caregiver picks up the medication container with NFC sticker
2. Taps phone to the sticker
3. Phone opens Cappy directly to a quick-action screen, in <1 second
4. Screen shows: child name, medication, current weight, last dose time
   and giver, status indicator (safe / too early / due now)
5. Caregiver taps "Log dose" or "Cancel"
6. If logged, all other authorized caregivers see the dose in their
   timeline within 5 seconds

This interaction must work reliably under stressful conditions: dim
light, one-handed operation while holding a sick child, partial
connectivity, fatigue.

## Design principles

1. **Low-friction first, accuracy second.** A logged dose with a small
   timestamp error beats a missed log. The system tolerates and shows
   imprecision rather than blocking on it.

2. **Coordination, not surveillance.** Caregivers see what others did
   so they can act. We do not score, rank, or judge caregivers. We
   never show "you did X, they did Y" framings.

3. **Corrections preserve history.** If a caregiver logs the wrong
   dose, the correction is a separate event, not an overwrite. The
   audit trail tells the truth even when humans get confused.

4. **The phone is the trusted device, the tag is dumb.** NFC tags carry
   only a UID. All medication context lives on the server. A lost or
   stolen tag is harmless.

5. **Plain language, calm tone.** No celebratory copy. No alarming
   copy. The voice is a calm friend in the kitchen, not a clinical
   system.

6. **Data sovereignty.** Families own their data. They can export it,
   they can delete it, they can revoke access at any time, and they
   are told plainly what is collected and why.

## Ambition (post-alpha)

The architecture is designed to support, in time:

- Multiple medications per family
- Prescription medication including controlled substances
- Pharmacy partnerships (NFC tags shipped pre-programmed with new
  prescriptions)
- Pharmaceutical real-world-evidence partnerships using de-identified
  adherence data, with explicit per-product caregiver consent
- Schools and daycares as separate "care contexts" with their own roles
- Clinical-decision-support integrations (for example, an electronic
  health record can pull a read-only view of recent doses on parent
  consent)

The alpha does not ship any of this. The alpha proves the core
interaction works and earns the right to build the rest.

## Non-goals for alpha

Spelled out so they are visibly out of scope:

- Android (month 4)
- Web app (post-alpha)
- Push notifications (alpha relies on realtime when app is open)
- Weight-based dose calculation (alpha shows weight, does not compute)
- Multiple medications (alpha = acetaminophen only)
- Prescription medications
- Multi-family per user account
- Custom-manufactured NFC tags (alpha uses generic NTAG215 we program)
- The de-identified analytics pipeline
- Admin web console (CLI scripts for now)

## Success metrics for alpha

- 10-25 design-partner families installed
- ≥5 families log ≥10 doses each
- Zero P0 safety bugs (missed sync, lost dose, wrong attribution)
- ≥1 family willing to be a public reference for fundraising
- Founder-conducted feedback interviews with at least half the cohort
