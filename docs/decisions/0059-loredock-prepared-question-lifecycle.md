# ADR 0059 — Keep question previews transient and make witnesses answer-owned

Status: prospective production lifecycle design, Task 121, 2026-11-04. No schema or
application change is implemented by this ADR.

## Context

Task 120 passes one frozen offline comparison: selecting a relevant root from complete
resolution and fitting a fully supported compact path is mechanically feasible. Ask
Project still recomputes synchronous lexical context at start and uses legacy publication
validation. A new asynchronous preview cannot be inserted without reserving ownership;
recomputing a native graph at model completion would change the issued input. User-saved
native receipts have a separate explicit history purpose and bounded capacity.

The offline driver counted lexical work through trusted fixture method wrappers. That is
not a production read-accounting capability. New source indexes already trigger background
analysis, so conservative write fencing and actual analysis-owner contention must also be
handled explicitly in the normal user flow.

## Decision

Follow [the preparation lifecycle contract](../loredock/PREPARED_QUESTION_LIFECYCLE.md).
Keep one bounded transient preparation slot per catalog, owned before any await. A ready
snapshot has an opaque server-issued ID, a content hash and a ten-minute monotonic lifetime;
restart, replacement, cancellation and source/review invalidation discard it. The browser
reviews originals, existing notes/comparisons and an optional qualified native path through
the existing question → context → answer flow. No new ordinary technical selectors appear.

Use actual scoped lexical row/original-byte accounting and an internal typed native
selection seam under one existing budget. Do not ship the copied offline producer or
fixture method replacement as a production owner. Default public/legacy behavior requires
parity; fixed source, derived and complete-prompt caps remain unchanged. Missing/ambiguous/
oversized native clues are omissions, while integrity/scope/busy failures fail preparation.
No hidden analysis start, queue, retry, graph cache or model dispatch is added.

On explicit Generate, atomically promote the trusted ready bytes into the answer attempt,
complete dependencies and a separate answer-owned witness. Start remains synchronous for
this bounded promotion; the worker reauthorizes the saved input asynchronously before any
runtime preparation or dispatch. A matching stored request is idempotent even if its
transient preview is gone. No client-authored graph or hash alone can establish provenance.

Choose prospective schema 11 for a versioned witness table and input-kind discriminator,
with old context/hash/prompt bytes unchanged. Witness storage is separate from the 64
user-saved receipts; cap it at 64 records, 768 KiB per record and 48 MiB serialized total.
Refuse capacity atomically without deleting history or dropping reviewed clues. Revocation
purges witness text through the answer's full source union before purge completes; policy
changes fence retained history. Interrupted answers never resume or dispatch on restart.
Precise SQL/serialization and maintenance compatibility are later implementation contracts.

Validate the issued native witness before dispatch and publication without current facts,
path selection or original-inventory availability. Source/policy/registry/published-build
and review fences remain current; a code-inventory replacement for the same build does
not alter the issued input. New prompt/context versions are explicit, original IDs alone
are citations, and legacy validation remains a separate unchanged path.

## Consequences

Preview requires no durable job table or user-history CRUD and cannot fill saved-path slots.
A restart requires Find context again. Native answers consume bounded additional storage;
quota/refusal behavior and future explicit history removal need visible product treatment.
Read validation and intentional transactional publication writes must have distinct epoch
handling. Shutdown order must stop new consumers before native paths/analysis/storage.

Implementation is staged: production accounting/selection seams, owned preview and UI,
answer-owned storage/publication, then fresh composition/resource and semantic/model gates.
Task 122 covers only the first stage. This ADR does not enable native answer generation,
allocate model attempts, replay exhausted evaluations or claim independent/L5 acceptance.
