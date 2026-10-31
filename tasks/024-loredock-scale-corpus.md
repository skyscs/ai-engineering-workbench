# Task 024 — Heterogeneous system corpus and capacity baseline

Status: implemented and locally verified, 2026-10-31. Task 023 was agent-reviewed and merged through
PR #27 (`586bff3`) after both CI runs passed, under the owner's autonomous delivery
authorization. Independent real-model semantic acceptance remains separate.

## Objective

Prepare the next source-foundation expansion with twenty distinct synthetic repository
roles, frozen source/evidence expectations and an honest baseline of current capacity
limits. Raising the registration limit alone cannot establish useful project context.

## Boundary and acceptance

- Preserve the original three-repository corpus, commits and oracle unchanged. Add
  seventeen distinct services, libraries, deployment/data and documentation repositories
  in an independent scale fixture. Include Java, JS/TS, Vue, Dojo, Kafka and Mongo clues,
  multi-service ownership, duplicate names, environment differences, renamed components,
  unsupported dynamic wiring and unavailable external behavior.
- Keep all sources static/synthetic; do not install dependencies, run applications,
  contact brokers/databases/providers or read private repositories. Generate only owned
  temporary Git repositories with deterministic history and excluded canaries.
- Freeze hashes/revision vectors and an independent question/evidence oracle before
  model evaluation. The oracle stays outside every source repository and product input.
  Validate reproducibility, original-corpus preservation, resolving evidence, differentiated
  roles and clean source checkouts; never score semantic correctness from locator validity.
- Exercise production registration without bypassing its three-source limit. Record
  the fourth-source rejection as a capacity blocker, not successful twenty-source ingestion.
  Document inventory/orientation/retrieval/map/history limits and a concrete next slice.
- Record generation/inventory measurements separately from ingestion/answer metrics.
  This small heterogeneous fixture is not a production-sized load benchmark or L5
  acceptance. Product behavior, parser support and model permissions stay unchanged.

## Verification record

Full `pnpm check` passes 293 tests (140 LoreDock and 18 script checks), strict
typechecks and builds. The new generator freezes twenty distinct roles, 79 text files,
sixty excluded canaries and twenty question/evidence/uncertainty cases. Every evidence
locator resolves; two generations match; original pilot commits and oracle are preserved.
The production probe observes the expected fourth-source rejection and indexes only
the supported three-source subset. No real model calls or product behavior changes.
See [fixture/baseline](../fixtures/loredock-scale/README.md) and
[capacity audit/next acceptance](../docs/loredock/SCALE_READINESS.md).
