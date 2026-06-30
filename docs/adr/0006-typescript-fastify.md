# ADR-0006: TypeScript on Node.js with Fastify

**Status:** Accepted
**Date:** Day 0
**Deciders:** Founder, Architect

## Context

Backend language and framework choice. Constraints:
- AI agents must be effective at writing the code (this favors widely
  used languages with abundant training data)
- Strong typing is non-negotiable for healthcare-grade reliability
- Mature ecosystem for Postgres, healthcare-relevant tooling
- Fast enough for the latency budget (NFC tap path <800ms total,
  backend portion <300ms)

## Decision

TypeScript on Node.js 20 LTS, with Fastify as the HTTP framework.

Specific choices:
- **TypeScript 5.5+** in strict mode
- **Node.js 20 LTS** (latest LTS at decision time)
- **Fastify 4.x** — faster than Express, better plugin model, schema-first
- **Drizzle ORM** — type-safe, generates types from schema, lightweight
- **Zod** for runtime validation at API boundaries
- **Vitest** for testing
- **Pino** for structured logging
- **pnpm** as the package manager (workspaces, faster, smaller)

## Consequences

### Positive
- Massive training data for agents — TypeScript is among the
  best-supported languages for AI code generation
- Single language across server + Mobile-Engineer's API client codegen
- Strict mode catches a large class of bugs before runtime
- Drizzle generates types from migrations, so schema and code stay
  in sync

### Negative
- Node.js single-thread model can become a bottleneck under heavy
  CPU load (mitigated: our load is I/O-bound, and we can scale
  horizontally)
- Less performant than Go or Rust for raw throughput (mitigated:
  Fastify is fast enough for our envelope)

### Neutral / accepted tradeoffs
- We accept TypeScript's compile step in development. Drizzle's type
  generation is the only meaningful codegen step.

## Alternatives considered

**Go.** Strong choice for a healthcare backend. Rejected because
agent fluency in TypeScript is currently higher and the hiring/contractor
market for TypeScript is larger when we eventually grow.

**Python (FastAPI / SQLAlchemy).** Rejected. Type system is meaningfully
weaker than TypeScript's strict mode. Async ergonomics are poorer.

**Rust.** Rejected. Agent code-generation quality is lower for Rust,
and the language's strictness slows iteration speed at the alpha stage.

**Express.** Rejected in favor of Fastify. Fastify is faster, better
typed, and the plugin model matches our modular monolith approach.

**NestJS.** Rejected. Decorator-heavy DI introduces complexity that
fights AI code generation. Fastify with explicit wiring is clearer.

## References

- Fastify benchmarks https://fastify.dev/benchmarks/
- Drizzle docs https://orm.drizzle.team/

## Follow-up actions

- Set up `/server/` with the locked stack — file ticket (TICKET-002)
