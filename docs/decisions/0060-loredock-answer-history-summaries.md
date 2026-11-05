# ADR 0060 — Bounded answer history summaries

Status: accepted for Task 131 implementation; resource observation pending.

## Decision

The twenty-row `GET /api/answers` page reads authorized summary metadata under one
fixed `OperationBudget` (1,000,000 work units, five seconds). It does not load the
saved answer text or prepared witness payload. No schema migration, startup cache,
background work, per-row budget reset or limit increase is introduced.

Prepared rows add `inputValidation: "metadata-only"`. This describes this read, not
the quality of the answer. Existing status, staleness, usage and review-state meanings
remain unchanged. Detail reads, idempotent admission and model dispatch keep their
existing complete witness validation. A successful list does not certify that every
saved witness is readable; opening an answer may still report corruption.

## Authority and integrity

Before reading retained context, summaries check current policy and every retained
source dependency. Unauthorized rows remain fenced with no context or answer.
Authorized prepared summaries require a retained witness row, supported input,
witness/composition/prompt/answer versions, bounded witness accounting metadata,
valid preparation and reviewed-hash identities, and the original request binding.

The saved lexical context is byte-accounted before loading, hashed against immutable
witness metadata, and checked against its own input hash and attempt identity. Its
review revision supplies the existing `current`/`changed` state. Source membership
must exactly match the saved build dependencies plus review dependencies; current
source authority and the build's policy/source-set identity are checked. The page
checks the same read-only catalog epoch throughout.

The schema-11 admission transaction and immutable triggers remain the authority for
stored metadata. Summaries do not reconstruct the reviewed hash from the witness,
decode its receipt, compare its saved dependency revision/tree values, validate its
prompt or compact context, or reopen originals. Those checks remain on full reads
and dispatch. Missing/unsupported/inconsistent metadata fails explicitly; payload-only
corruption may remain undetected until a full read. No summary fallback publishes
content or enables generation.

## Accounting and acceptance

Charge returned ID rows, summary metadata bytes, saved context bytes and current
dependency work to one page budget. Full context bytes are charged even though only
review metadata is returned. Oversized/corrupt context is refused before loading its
text into JavaScript. SQL does not select witness/result payloads. Accounting is
application work, not a claim that SQLite reads no physical database pages.

Observe the first ordinary twenty- and sixty-four-answer controls with the existing
fake runtime, then production-entry reopen and a separate diagnostic accounting lane.
Require twenty useful rows, unchanged full detail, exact summary parity apart from
the declared marker, one closed budget, aggregate work at most 1,000,000 and actual
production list HTTP time at most 500 ms. Preserve complete stopped catalogs, sources,
responses and first failures. No real models or consumed reserved-family replay.

Cold startup, near-limit heap, browser RSS and native-output size remain separate
unresolved gates. This observation cannot qualify the complete prepared flow.
