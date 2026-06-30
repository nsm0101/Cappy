# Vendor Evaluation Rubric

Use this template when evaluating any third-party service that may
touch production data, or when the founder requests a vendor brief.

```markdown
# Vendor Evaluation: [Vendor Name]

**Vendor:** [Name and product]
**Evaluator:** Research agent
**Date:** YYYY-MM-DD
**Use case:** [Why we are considering this vendor]

## Scoring (1-5, 5 = best for our needs)

| Criterion | Score | Notes |
|-----------|-------|-------|
| BAA availability | [ ] | Tier required, cost premium, time to sign |
| Pricing — free tier capacity | [ ] | What's included free |
| Pricing — at 100 users | [ ] | Estimated monthly cost |
| Pricing — at 1,000 users | [ ] | Estimated monthly cost |
| Pricing — at 10,000 users | [ ] | Estimated monthly cost |
| SLA — uptime commitment | [ ] | What % committed, with credits |
| SLA — support response time | [ ] | Documented |
| Security — SOC 2 Type 2 | [ ] | Date of most recent report |
| Security — HITRUST or ISO 27001 | [ ] | If applicable |
| Data residency | [ ] | US-only available? |
| Data exit / portability | [ ] | How to get data out |
| Market traction | [ ] | Funding, customers, references |
| Company stability | [ ] | Independent, profitable, runway |

**Total:** [sum] / 65

## Critical concerns

Anything that would be a deal-breaker regardless of score.

## Recommended use

- Use for: [specific use cases]
- Do not use for: [specific use cases]
- Reconsider in: [time horizon and triggering condition]

## Citations

[numbered list]
```

## Critical considerations for healthcare vendors

Beyond the rubric, every healthcare-context vendor must answer:

1. **Subprocessor list** — who else gets to see the data?
2. **Subprocessor BAA flow-through** — are subprocessors held to the
   same standards by their BAA?
3. **Breach notification SLA** — within how many hours of discovery
   will they notify us?
4. **Data deletion guarantee** — when we leave, how soon is our data
   gone, and how is that proven?
5. **Audit log access** — can we see who at the vendor accessed our
   data?
6. **Per-tenant key option** — can we encrypt with a key the vendor
   does not hold?

These six questions go in every healthcare vendor brief.
