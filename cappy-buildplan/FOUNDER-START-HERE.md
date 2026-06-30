# Founder Onboarding — How to Use This Kit

This kit contains everything needed to start the Cappy alpha build
with a team of AI agents under your direction. This document tells
you how to operate it.

## What you have

A complete repository scaffold with:
- A 90-day plan (`/project/PLAN.md`)
- 8 ADRs documenting day-zero architectural decisions (`/docs/adr/`)
- 8 agent system prompts (`/agents/`)
- Universal rules every agent reads first (`/AGENTS.md`)
- Security rules every coding agent enforces (`/compliance/SECURITY-RULES.md`)
- Schema spec, OpenAPI spec, working server scaffold
- HIPAA policy stubs for the 9 most-needed policies
- Drafts of Privacy Policy, Terms of Service, Caregiver Consent
- CI/CD workflows for GitHub Actions
- 7 ready-to-dispatch tickets for Milestone 0 and the start of
  Milestone 1

## What you do not have (and need to acquire)

- A healthcare attorney engaged for legal document review (priority,
  Day 1)
- A vendor accounts (TICKET-001 walks you through this)
- A registered domain name
- Apple Developer enrollment
- An LLC if you want the legal separation (recommended before signing
  BAAs)
- Cyber liability insurance (post-funding consideration)
- Funding (this kit does not address that — out of scope)

## Day 1: How to start

1. **Skim every file in `/project/` and `/AGENTS.md`** (about 30 minutes)
2. **Read the example briefing** at `/project/example-day-1-briefing.md`
3. **Open a Claude (or your chosen agent platform) session** and load
   the Orchestrator prompt from `/agents/orchestrator.md`
4. **Tell the Orchestrator:** "We are starting Day 1 of Cappy. Read
   the foundation kit, generate today's briefing."
5. **Review the briefing.** Approve, redirect, or modify.
6. **For tickets you can take yourself (TICKET-001 is yours)**, work
   through them; check off the definition of done.
7. **For tickets that go to specialists**, start a separate agent
   session per specialist with their role prompt loaded, and hand them
   the ticket file path.

## How the loop works

```
Daily:
  ┌─────────────────────────────────────────────────────────┐
  │ 1. You open the Orchestrator session                    │
  │ 2. Orchestrator reads PLAN, GOALS, feedback, retros     │
  │ 3. Orchestrator generates today's briefing              │
  │ 4. You approve / redirect / decide open questions       │
  │ 5. Orchestrator dispatches up to 3 tickets              │
  │ 6. Each specialist agent works in parallel on its       │
  │    ticket in its own session                            │
  │ 7. Specialists return work to Orchestrator              │
  │ 8. Orchestrator reviews against Definition of Done      │
  │ 9. Orchestrator updates PLAN, files retros, surfaces    │
  │    any new decisions                                    │
  │ 10. End of session                                      │
  └─────────────────────────────────────────────────────────┘
```

You are the human in the loop. The Orchestrator does not advance
milestones, change the strategic goal, or commit to vendors without
your explicit approval recorded in `/project/GOALS.md`.

## How to read the daily briefing

Every briefing has a "Decisions needed from founder" section. These
are blockers — work cannot proceed without your answer. Treat them
as the most important part of the briefing.

The briefing also lists what is in flight and what completed
yesterday. You can read deeper by opening the relevant ticket file.

## When to override an agent

You can and should override agents when:
- The agent is wrong (technically, factually, or in judgment)
- The agent is being overcautious in a way that wastes time
- You have context the agent does not (e.g., a conversation with a
  potential design partner that should reshape priorities)
- The agent is missing a constraint you care about

You should rarely override agents on:
- Security rules (those exist for a reason)
- Compliance policies (regulators do not care about your timeline)
- Architectural decisions captured in ADRs (supersede with a new
  ADR; do not contradict silently)

## When the agent is uncertain

If a specialist agent says "I'm uncertain" and presents you with two
options, your job is to decide. Resist the urge to say "you choose."
Decisions get more expensive as they get later.

If you are also uncertain, the most useful thing you can do is
recognize that the question is itself a research task — file a
ticket to the Research agent.

## When to bring in humans

Some things AI agents cannot do for you:
- Sign legal documents
- Operate as your healthcare attorney (engage a real one)
- Make business judgment calls about partnerships
- Build the relationships that get you design partners
- Explain Cappy to investors with conviction

Plan for these to be your time.

## Cost expectations

Approximate monthly:
- Pre-vendor (foundation kit phase): $0
- Alpha (Milestone 0-1): $50-100/mo
- Alpha launched (Milestone 4): $150-400/mo
- AI agent usage: $50-300/mo depending on intensity

You should hit "alpha shipped" within a $1,500 monthly burn at the
high end.

## Safety reminders

- Your alpha will collect real PHI. Treat it accordingly from Day 1.
- Do not skip the attorney engagement to "ship faster." A privacy
  incident in alpha could kill the company.
- Do not invite real families until the legal docs are reviewed by
  counsel and the security checklist in Milestone 4 is complete.

## Asking for help

If you find yourself stuck on something this kit does not address,
your options:
- File a Research ticket
- Engage a fractional expert (HIPAA consultant, mobile dev consultant,
  designer)
- Ask in founder communities (Indie Hackers, Y Combinator alumni
  network, etc.)

Good luck.
