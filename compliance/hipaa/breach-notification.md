# Breach Notification Policy

> **Status:** Stub — to be reviewed by healthcare counsel.

**Owner:** Founder (Privacy Officer)
**Implements:** 45 CFR §§164.400-414
**Last reviewed:** [DATE]

## What counts as a breach

Under HIPAA (§164.402), a breach is the acquisition, access, use, or
disclosure of PHI in a manner not permitted by the Privacy Rule that
compromises the security or privacy of the PHI.

A use or disclosure of PHI not permitted is **presumed to be a breach**
unless we demonstrate, through risk assessment, that there is a low
probability the PHI has been compromised.

The risk assessment considers at least:
1. The nature and extent of the PHI involved
2. The unauthorized person who used the PHI or to whom disclosure was
   made
3. Whether the PHI was actually acquired or viewed
4. The extent to which the risk has been mitigated

Some events are excluded from the breach definition (§164.402):
- Unintentional acquisition by a workforce member acting in good faith
- Inadvertent disclosure between authorized persons at the same entity
- A disclosure where the recipient could not reasonably have retained
  the information

## Notification requirements

### Individual notification (§164.404)

Without unreasonable delay, and in no case later than **60 calendar
days** after discovery of the breach.

Method:
- Written notice by first-class mail to the last known address (or
  email if the individual has agreed to electronic notice)
- Substitute notice (e.g., website posting) if contact information
  is insufficient

Content (§164.404(c)):
- Brief description of what happened, including dates
- Description of types of unsecured PHI involved
- Steps individuals should take to protect themselves
- Brief description of what we are doing to investigate, mitigate, and
  prevent recurrence
- Contact procedures for questions

### HHS notification (§164.408)

For breaches affecting **500 or more individuals**: notify HHS
contemporaneously with notifying individuals (within 60 days), via
the HHS OCR breach reporting portal.

For breaches affecting **fewer than 500**: maintain a log and submit
annually to HHS, no later than 60 days after the end of the calendar
year.

### Media notification (§164.406)

For breaches affecting **more than 500 residents of a state or
jurisdiction**: notify prominent media outlets serving that area,
within 60 days.

### State law

Many states have their own breach notification laws that may apply
in addition to HIPAA. Counsel will determine which states' laws apply
based on where affected individuals reside and what additional
notifications are required.

## Procedure

When an event meeting the breach definition is suspected:

1. The Incident Commander invokes the Incident Response procedure
2. The Privacy Officer (founder for alpha) is notified immediately
3. Counsel is engaged
4. Risk assessment is documented in the incident record
5. If breach is confirmed:
   - Individual notifications drafted, reviewed by counsel, sent within
     the 60-day window
   - HHS notification submitted within the 60-day window
   - Media notification if threshold met
   - Notifications retained as evidence
6. If breach is not confirmed (low probability of compromise):
   - Risk assessment retained
   - No notification required
   - Decision and rationale documented

## Documentation

All breach assessments, notifications, and supporting evidence are
retained for **6 years** per §164.316(b)(2)(i).

The breach log lives at `/security/breaches/` (gitignored if
necessary; otherwise PHI is hashed in entries).

## Vendor breach (Business Associate)

If a vendor with a BAA notifies us of a breach on their side:
1. The vendor's notification triggers our 60-day clock from the date
   we are notified (or, if we discover it ourselves, from discovery)
2. We follow the same notification procedure as for our own breaches
3. The vendor is responsible for their own statutory notifications
   under their BAA
