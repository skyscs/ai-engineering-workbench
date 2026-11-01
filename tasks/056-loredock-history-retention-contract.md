# Task 056 — Retained-history dependency and ranking contract

Status: scoped before analysis/probe implementation, 2026-11-01.

Task 055 removes one text copy but does not bound retained history. Before selecting
any deletion policy, review the existing dependency and retrieval semantics and make
the next read-only diagnostic concrete. This task ships no deletion feature.

## Contract

- Map current-build, unfinished-work, answer/citation, correction/reapplication,
  code-inventory, refresh-baseline, reuse-lineage and request-replay dependencies to
  their actual readers and constraints. Distinguish metadata from original payload
  requirements. A missing SQL foreign key or stale/failed state is not deletion consent.
- Check whether removing unrelated historical postings can alter current-build ranking.
  Fix one in-memory example before execution: current document A contains two `alpha`
  tokens plus eighteen `filler` tokens; B contains `alpha filler`. Ten historical
  documents each contain two hundred `legacy` tokens. Query `alpha` with an explicit
  current-build filter before/after deleting only the historical documents. Exercise
  the external literal and Porter question FTS layouts. Retain scores, ordering,
  token/document counts and unchanged current text identities. This is a SQLite
  mechanism probe, not a product-quality benchmark or a model run.
- Document the resulting constraints, a conservative default, alternatives and a
  bounded read-only per-generation diagnostic contract with adversarial acceptance
  cases. Do not define a retention window, change ranking, orphan citations, remove
  application history, bypass correction triggers or repurpose source revocation.
- Keep frozen evaluations and the live user demo untouched. Read only repository
  source; the probe creates/discards its own in-memory database with synthetic text.

## Delivery

Commit scope before implementation, record the dependency matrix and exact probe result,
update the roadmap/status, check artifact links and the probe's assertions, and submit a
separate PR. Merge only after both exact-head CI events pass. The follow-up contract
must identify what can proceed without manual feedback and what a future removal
operation would need to preserve; it does not authorize deleting existing user data.
