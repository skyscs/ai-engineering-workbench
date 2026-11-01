# Task 055 — Production external-content literal search

Status: scoped before implementation, 2026-11-01.

Tasks 053–054 justify removing the redundant literal-search text copy. The matched
control preserves complete token positions and all queries while saving 17.4% of
compacted SQLite allocation. Ship that storage change with migration and lifecycle
coverage; preserve the frozen experiments and their narrower synthetic claims.

## Contract

- Introduce schema 9 with an integer document-to-span mapping and external-content
  view over existing original spans. Preserve legacy rowids, tokenizer, rank settings,
  originals, historical references, answer contexts, review and code inventories.
  Convert schema 8 atomically before normal restart recovery. Validate legacy content
  and FTS consistency; reject unsupported or inconsistent layouts visibly rather than
  silently repairing them. Rollback leaves legacy logical state and version unchanged
  and releases ownership. Fresh and older supported schemas reach the same layout.
- Use explicit production insertion within the existing file transaction. Remove FTS
  postings before original content during source purge; mapping cleanup is transactional.
  Keep API/UI, retrieval policy, model behavior and parser fingerprints unchanged.
- Do not automatically vacuum or restart any existing user process. Migration releases
  pages for reuse; physical shrinking remains explicit offline maintenance. Document
  startup conversion, stopped backup/rollback and temporary disk requirements.
- Keep accounting and compaction compatible with schemas 8 and 9 without migrating them.
  Attribute mapping pages to literal search and distinguish logical searchable text
  from the stored duplicate. Version the report when changing its public contract.
- Test exact legacy query/rank/snippet/context and complete vocabulary preservation,
  refresh/restart/revocation, original and derivative history, insertion/purge rollback,
  migration failure before and during conversion, ownership release, empty/older schemas,
  and audit/compaction on both versions. Use owned fixtures only; no model calls.

## Delivery

Keep historical designs, pins, raw reports and exclusive receipts unchanged. Replace
obsolete prototype-on-current-store rehearsals with production migration coverage and
retained-result assessor tests; archival experiment execution still requires its pinned
schema-8 implementation. Add an ADR, update user/architecture/status documentation,
run strict checks, full tests/builds and an owned compiled migration/maintenance smoke.
Review, create the PR and merge after both exact-head CI events succeed. The running
user demo stays on its existing process/data; owner feedback and semantic gates remain
open. Follow-up scope depends on findings, without rerunning exhausted evaluations.
