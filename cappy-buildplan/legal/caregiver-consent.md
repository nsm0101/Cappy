# Caregiver Consent Screen

> **DRAFT — requires healthcare attorney review before publication.**

This is the text shown to every new user on first launch, before they
can create or join a family. The user must explicitly tap "I agree"
to continue.

---

## Welcome to Cappy

Cappy helps families coordinate medication for their children. Before
you start, please read this and confirm you understand.

### What Cappy does

Cappy keeps a shared record of when a child has been given medication,
and by whom. When you tap your phone to a Cappy NFC sticker on a
medication bottle, Cappy shows you when the last dose was given and
lets you record a new one. Other caregivers in your family see the
update on their phones.

### What Cappy does not do

- **Cappy is not medical advice.** It does not tell you whether to
  give a dose, what dose to give, or whether a medication is safe.
  Always follow the directions from your child's pediatrician or
  pharmacist.
- **Cappy is not a substitute for a doctor.** If your child is sick,
  see a healthcare provider.
- **Cappy is not for emergencies.** In an emergency, call 911 or
  Poison Control at 1-800-222-1222.

### Your responsibility

You confirm that:
- You are 18 or older
- You are a parent, legal guardian, or otherwise authorized to
  record health information about the children you add
- You will only invite caregivers you trust with this information
- You understand that medication decisions are yours, not Cappy's

### Your data

We collect a small amount of information so the service works. The
sensitive parts are encrypted. We do not sell your information. You
can delete your account at any time. Read the full Privacy Policy:
[link to /privacy]

### Alpha software notice

Cappy is currently alpha software being tested with a small group of
families. You may encounter bugs. Please report them to us — your
feedback shapes the product.

By tapping "I agree" you accept the [Terms of Service](terms) and the
[Privacy Policy](privacy).

[ I agree ]   [ I do not agree ]

---

## Behavior notes for the implementer

- Both buttons must be the same visual weight (no "default" styling
  on Agree)
- "I do not agree" returns the user to the sign-out state
- The agreed-on versions of Terms and Privacy are recorded in the
  user record with a timestamp
- If we update Terms or Privacy materially, we re-prompt for consent
- The text is selectable so users can copy it
