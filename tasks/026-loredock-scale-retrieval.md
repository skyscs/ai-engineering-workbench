# Task 026 — Bounded question context across twenty sources

Status: implemented and locally verified; ready for PR/CI review. Follows Task 025 / merged PR #29.

## Problem and scope

The initial twenty-source probe retrieved all required evidence for 19/20 frozen
questions. A question naming `inventory-api` missed its route declarations, while
the no-match fallback represented only eighteen repositories. UUID ordering also
made tied selections depend on registration identity. Improve generic evidence
selection without changing the independent oracle or enlarging model input limits.

## Acceptance

1. Record a repeatable pre-change baseline and post-change offline evaluation of
   all twenty frozen questions. Score exact source/revision/file/range/hash recall,
   not answer correctness. The original three-source evaluation must not regress.
2. A complete normalized repository name in the question may add a bounded first-span
   sample from that source, alongside lexical/cross-source matches. Do not infer
   ownership or routes from names, add fixture-specific rules, or choose one identity
   when several sources share a name. Keep source sample limits and gaps explicit.
3. With no lexical matches, offer each of twenty sources a baseline opportunity
   before deeper representatives. Use stable saved source order for ties. Preserve
   the 120-candidate / 30-span / 64 KiB text limits and existing prompt/output limits.
   Skip oversized spans as whole units and report unrepresented sources honestly.
4. Show source representation in the answer preview. Keep original evidence,
   human-note provenance, policy/revocation fences, saved-answer bytes and explicit
   run/retry behavior. No schema migration, model execution or repository mutation.
5. Test fresh-identity reproducibility, literal-name boundaries/ambiguity, renamed
   sources, cross-source recall, missing/oversized READMEs, candidate/span/byte bounds,
   refresh/history/restart and revocation. Run full checks and the answer browser
   regression; record a twenty-source preview in Chrome without a real model call.
6. Update contracts, guide, decision/status and measured artifacts; review the diff,
   create a PR and merge after both CI runs pass for its exact head.

This is retrieval qualification, not semantic answer acceptance or L5 readiness.
Real-model source support/uncertainty review, unsupported framework profiles, retention
and an eligible private pilot remain separate gates before the Workbench bridge.

## Verification

- Full `pnpm check`: 303 tests (150 LoreDock, 18 script checks), strict typechecks and
  production builds. No database/runtime/prompt-schema migration.
- Expanded oracle: 20/20 complete evidence sets on two fresh catalogs versus 19/20
  before; original pilot remains 20/20. All twenty ordered selections and zero-hit
  locators repeat across fresh source IDs. Source/oracle fixture hashes are unchanged.
- Chrome: twenty-source preview, named route evidence, keyboard focus, mobile layout,
  revocation/reload and existing fake-runtime answer/review regression pass. Zero real
  model calls; the new preview harness records zero runtime preparations/attempts.
- See [artifacts](../docs/fixtures/loredock-scale-retrieval/README.md) and
  [ADR 0030](../docs/decisions/0030-loredock-scale-retrieval.md).

Next: qualify actual answer support and uncertainty, including engineer disputes, on
expanded source scope through an eligible explicitly selected connection. Independent
semantic review, framework coverage and private-pilot gates remain open.
