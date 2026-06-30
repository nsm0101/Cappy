# HIPAA Security Rule Mapping

> **Status:** Stub — to be filled in collaboration with healthcare counsel.
> Updated as technical controls are implemented.

**Owner:** Founder (also serving as Security Officer for alpha)
**Last reviewed:** [DATE]

This document maps each provision of the HIPAA Security Rule
(45 CFR Part 164, Subpart C) to the policies and technical controls
Cappy has in place to satisfy it. It is the master index for
compliance review.

## Administrative Safeguards (§164.308)

| § | Provision | Required/Addressable | How we address it | Evidence |
|---|-----------|----------------------|-------------------|----------|
| 308(a)(1)(i) | Security Management Process | Required | `/compliance/hipaa/risk-assessment.md` | Annual risk assessment |
| 308(a)(1)(ii)(A) | Risk Analysis | Required | `/compliance/hipaa/risk-assessment.md` | Same |
| 308(a)(1)(ii)(B) | Risk Management | Required | Tickets filed against findings | Ticket history |
| 308(a)(1)(ii)(C) | Sanction Policy | Required | `/compliance/hipaa/sanction-policy.md` | Policy doc |
| 308(a)(1)(ii)(D) | Information System Activity Review | Required | Quarterly audit log review | Review log |
| 308(a)(2) | Assigned Security Responsibility | Required | Founder is designated Security Officer | This document |
| 308(a)(3) | Workforce Security | Required | `/compliance/hipaa/access-management.md` | Policy doc |
| 308(a)(4) | Information Access Management | Required | `/compliance/hipaa/access-management.md` | Same |
| 308(a)(5) | Security Awareness and Training | Required | `/compliance/hipaa/workforce-training.md` | Training log |
| 308(a)(6) | Security Incident Procedures | Required | `/compliance/hipaa/incident-response.md` | Policy doc |
| 308(a)(7) | Contingency Plan | Required | `/compliance/hipaa/contingency-plan.md` | Policy doc; backup test results |
| 308(a)(8) | Evaluation | Required | Annual security evaluation | Eval doc |
| 308(b)(1) | Business Associate Contracts | Required | `/compliance/baa-register.md` | Signed BAAs |

## Physical Safeguards (§164.310)

| § | Provision | Required/Addressable | How we address it |
|---|-----------|----------------------|-------------------|
| 310(a)(1) | Facility Access Controls | Required | We do not maintain physical infrastructure; relying on Supabase / AWS facility controls (covered by their BAA and SOC 2) |
| 310(b) | Workstation Use | Required | Workstation policy: founder workstation hardened per `/compliance/hipaa/access-management.md` |
| 310(c) | Workstation Security | Required | Same as above |
| 310(d) | Device and Media Controls | Required | No removable media holds PHI; full-disk encryption on workstation; documented disposal procedure |

## Technical Safeguards (§164.312)

| § | Provision | Required/Addressable | How we address it |
|---|-----------|----------------------|-------------------|
| 312(a)(1) | Access Control | Required | Supabase Auth + application-layer authz; documented in code |
| 312(a)(2)(i) | Unique User Identification | Required | UUID per user, never reused |
| 312(a)(2)(ii) | Emergency Access Procedure | Required | Founder retains break-glass admin credentials in offline secure storage |
| 312(a)(2)(iii) | Automatic Logoff | Addressable | Mobile session expires after 30 days inactivity; sensitive ops re-authenticate |
| 312(a)(2)(iv) | Encryption and Decryption | Addressable | ADR-0005 envelope encryption |
| 312(b) | Audit Controls | Required | ADR-0007 hash-chained audit log |
| 312(c)(1) | Integrity Controls | Required | Audit hash chain; database constraints |
| 312(c)(2) | Authentication Mechanism | Addressable | Audit log hash chain proves integrity |
| 312(d) | Person or Entity Authentication | Required | Supabase Auth with MFA available |
| 312(e)(1) | Transmission Security | Required | TLS 1.3 enforced; certificate pinning on mobile |
| 312(e)(2)(i) | Integrity Controls | Addressable | TLS provides; payload hashes for sensitive operations |
| 312(e)(2)(ii) | Encryption | Addressable | TLS 1.3; never falls back to weaker |

## Organizational Requirements (§164.314)

| § | Provision | How we address it |
|---|-----------|-------------------|
| 314(a) | Business Associate Contracts | All vendors handling PHI have signed BAAs (see register) |
| 314(b) | Group Health Plans | N/A |

## Policies and Procedures (§164.316)

| § | Provision | How we address it |
|---|-----------|-------------------|
| 316(a) | Policies and Procedures | All policies stored in `/compliance/hipaa/`; version-controlled |
| 316(b)(1) | Documentation | Same |
| 316(b)(2)(i) | Time Limit (6 years from creation or last effective date) | Policies retained in git history; never deleted |
| 316(b)(2)(ii) | Availability | Founder + Compliance & Documentation agent maintain |
| 316(b)(2)(iii) | Updates | Reviewed annually; updated when material change occurs |

## Open items

- [ ] Privacy Officer to be designated formally before launch
- [ ] Annual risk assessment to be conducted before alpha launches
      with real families
- [ ] Workforce training documentation to be completed
- [ ] Backup restore drill to be performed and documented
- [ ] Penetration test to be scheduled before scaled launch
