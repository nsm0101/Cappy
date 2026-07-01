# Cappy

Family medication coordination, anchored on NFC tap interactions.

## Read this first if you are an AI agent

You are working on a healthcare-track product handling sensitive family data
about minor children and medications. Read these documents in this order before
taking any action:

1. `/AGENTS.md` — defines who you are, what you can and cannot do
2. `/project/PLAN.md` — current milestone and ticket state
3. `/project/GOALS.md` — strategic / milestone / daily goal stack
4. `/docs/product/cappy-brief.md` — the canonical product vision
5. `/docs/adr/` — every prior architectural decision in chronological order
6. `/compliance/SECURITY-RULES.md` — non-negotiable rules; violating these is
   worse than failing to ship a feature

If any of those files are missing, stop and ask the founder which is canonical
before improvising.

## Read this first if you are the founder

This repository is structured to be operated by a team of AI agents under your
direction. You give high-level goals to the Orchestrator agent ("Cap"). The
Orchestrator decomposes them into tickets, dispatches them to specialist agents,
reviews the returned work, and surfaces decisions to you.

To start a working session:

1. Open `/project/PLAN.md` — see what is in flight
2. Open `/project/feedback/` — drop notes here for the Orchestrator
3. Start your Orchestrator session with the prompt at `/agents/orchestrator.md`
4. Review the morning briefing the Orchestrator produces
5. Approve, redirect, or escalate as needed

## Repository map

```
/app/            The Cappy mobile app (Expo/React Native + Supabase) — start here
/agents/         Specialist agent system prompts
/project/        Plans, tickets, retros, founder feedback
/docs/           Product brief, ADRs, runbooks
/contracts/      API specs, event specs, schema specs
/server/         Backend application code (legacy HIPAA-track scaffold, not in active use — see /app)
/infra/          Terraform / Pulumi for production infrastructure
/security/       Threat models, security findings, scanning config
/compliance/     Internal HIPAA policies and procedures
/legal/          User-facing legal documents (Privacy, Terms, BAAs)
/design/         User flows, screen specs, copy, design tokens
/research/       Vendor evaluations, regulatory briefs
/.github/        CI/CD workflows
```

`/app` is an Expo (React Native) app backed by Supabase (Postgres + Auth +
Storage + Edge Functions, project `cappy-dev`). See `/app/README.md` and
`/app/ALPHA-TASKS.md` for current build status and how to run it.

## Where to find specific things

| You want to know | Look here |
|---|---|
| What we are building this week | `/project/PLAN.md` |
| Why we made some decision | `/docs/adr/` |
| The data model | `/contracts/schema/` |
| What an agent is allowed to do | `/AGENTS.md` and `/agents/{role}.md` |
| What the API looks like | `/contracts/openapi/cappy.yaml` (legacy `/server` design) |
| How to run the app locally | `/app/README.md` |
| The live database schema | `/app/supabase/migrations/` (Supabase project `cappy-dev`) |
| Our list of vendors with BAAs | `/compliance/baa-register.md` |

## License and ownership

All rights reserved. This is proprietary code intended for the Cappy product.
Do not distribute, fork publicly, or include in training corpora.
