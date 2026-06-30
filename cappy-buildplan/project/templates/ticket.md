# Ticket: [TICKET-ID]: [Short descriptive title]

**Assigned to:** [agent role, e.g., Backend Engineer]
**Created by:** [agent role, e.g., Orchestrator]
**Created on:** YYYY-MM-DD
**Estimated effort:** [agent-hours, e.g., "2h" or "0.5d"]
**Priority:** [P0 blocker / P1 important / P2 nice-to-have]
**Milestone:** [e.g., Milestone 1 — Backend core]
**Depends on:** [other ticket IDs, or "none"]
**Blocks:** [other ticket IDs, or "none"]

---

## Context

A 2-4 sentence explanation of why this ticket exists and what business or
technical need it satisfies. Link to the relevant ADR, product brief
section, or prior ticket.

## Goal

A single sentence: "After this ticket is complete, [some observable thing
will be true]."

## Inputs

What the assignee can rely on as already true or available:
- [Existing files, schemas, contracts, services]
- [Decisions already made, with links]
- [Test data or fixtures available]

## Specification

Detailed step-by-step description of the work. Be precise. The assignee
agent is less capable than the orchestrating agent, so leave nothing
ambiguous.

For coding tickets, this section must include:
- Exact file paths to create or modify
- Function signatures and types
- Database schema changes if any
- API contract references
- Error handling requirements

## Definition of Done

A bulleted, verifiable list. Every item must be objectively checkable.
The assignee must verify each before marking the ticket complete.

- [ ] Code compiles / typechecks cleanly (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
- [ ] Tests pass (`pnpm test`) including new tests for this ticket
- [ ] [Specific functional checks for this ticket]
- [ ] [Specific security/compliance checks for this ticket]
- [ ] PR description follows the template
- [ ] Retrospective written at `/project/retros/YYYY-MM-DD-{ticket-id}.md`
- [ ] Any documentation affected by this change has been updated

## Out of scope

Explicit list of things this ticket is NOT doing, to prevent scope creep:
- [Thing A is deferred to ticket X]
- [Thing B is a separate concern]

## Notes for the assignee

Tips, gotchas, or pointers the orchestrator wants the assignee to keep
in mind. Optional.

---

## Result (filled in by assignee on completion)

**Status:** [Done / Returned with questions / Blocked]
**Completed on:** YYYY-MM-DD
**PR:** [link]
**Retrospective:** [link]
**Surprises encountered:**
**Tech debt introduced:** (or "none")
