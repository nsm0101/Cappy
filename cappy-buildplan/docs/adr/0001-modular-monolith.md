# ADR-0001: Modular monolith for alpha, microservices later

**Status:** Accepted
**Date:** Day 0
**Deciders:** Founder, Architect

## Context

The full architectural vision for Cappy includes nine bounded contexts:
identity, family, children, medications, doses, NFC, notifications,
authorization, audit, and safety. The natural urge for a HIPAA-track
healthcare product is to deploy each as a separate microservice from
day one for "proper isolation."

Reality: a solo founder operating with AI agent leverage cannot
operationally support nine deployable services. Each service multiplies
the surface area of CI, deployment, monitoring, secrets, network
policies, and incident response. Microservices are an organizational
solution to a team-coordination problem; we don't have a team.

We need an architecture that:
1. Ships an alpha in 90 days with one developer
2. Preserves the option to extract services later under load
3. Does not violate the bounded contexts so badly that extraction is
   impossible

## Decision

For alpha and the foreseeable future post-alpha, deploy a **modular
monolith**: a single deployable artifact with strict internal module
boundaries. Modules:

- Each lives in its own directory under `/server/src/modules/{name}/`
- Has its own routes, services, repositories, and schemas
- Does not import from another module's internal files; only from
  its `index.ts` public exports
- Communicates with other modules via function calls, but conceptually
  treats those calls as "would be RPC if we extracted this"
- Has its own database tables; cross-module queries go through the
  owning module's repository

When a specific module needs to scale independently, becomes a
performance hot spot, or grows to a size that justifies a separate
team, it can be extracted to a service. The clean module boundaries
make this practical.

## Consequences

### Positive
- One CI pipeline, one deploy target, one secrets store, one log stream
- Local development is trivially fast (one process)
- Refactoring across module boundaries is straightforward (compiler
  catches everything)
- Operationally cheap: a single Supabase + small compute is enough for
  alpha

### Negative
- A bug in one module can crash the whole process (mitigated by
  Fastify's plugin error isolation)
- Resource isolation is weaker than separate services
- Deploying one module requires redeploying the whole monolith

### Neutral / accepted tradeoffs
- We trust ourselves to enforce module boundaries via code review and
  lint rules rather than via process boundaries
- The architecture diagram looks more sophisticated than the deployment
  topology, which is fine

## Alternatives considered

**Microservices from day one.** Rejected. The operational cost is
prohibitive for a solo founder, and the "isolation benefit" is
illusory at this scale because all services would share the same
database and same cluster anyway.

**Plain monolith with no module discipline.** Rejected. The bounded
contexts are real and worth preserving. A flat structure would harden
into a tangle that is genuinely hard to extract from later.

**Serverless functions per concern.** Rejected. Cold-start latency
would violate the <800ms NFC tap target. Also fragments observability
and complicates transactional consistency.

## References

- Cappy backend architecture document (founder conversation, Day 0)
- Shopify, GitHub, Stack Overflow modular-monolith case studies (general
  knowledge)

## Follow-up actions

- Lint rule preventing cross-module deep imports (eslint-plugin-boundaries)
  — file ticket
- Module README template — file ticket
