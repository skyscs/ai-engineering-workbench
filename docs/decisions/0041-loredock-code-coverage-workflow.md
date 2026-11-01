# ADR 0041 — Code coverage in the indexing workflow

## Status

Accepted for Task 046, 2026-11-01. Extends the [durable inventory foundation](0040-loredock-durable-code-inventory.md)
without changing its schema, parser support, payload budgets or retention policy.

## Decision

The daemon owns one code-analysis service and a lightweight publication observer. Every
500 ms the observer checks the current published index ID. It queues a newly published
index only when its policy/registry are current, coalesces superseded publications and
waits for active analysis. A stable request ID binds the index and parser fingerprint.
A manual attempt already covering that publication is respected, including pause,
interruption, cancellation or failure. Busy cleanup delays admission; other start errors
are surfaced once without retrying or changing the source index.

Startup records the existing published pointer without starting historical work. Users
can explicitly analyze that index. Restart never resumes interrupted work automatically.
Shutdown stops observation before interrupting analysis and closing catalog storage.
The observer is independent of browser sessions; closing a tab does not cancel analysis.

Protected local APIs expose at most two summaries, fifty file records per page and one
bounded file payload. Manual starts require current expected source/policy versions and
an authorized index for that registry. Unknown fields, invalid offsets/actions, control
arguments and foreign file IDs are rejected. Existing Host/Origin/session/CSRF, body caps,
fact/original validation, parser identity, retention and purge boundaries remain in force.
Reading summaries does not make fenced file data available.

The default source-index panel shows compact Code coverage with examined-file counts
and distinct affected-file/message counts. Nonzero omissions stay visible. Detailed file
rows, payload limits and repeat-analysis controls remain collapsed. Keyboard disclosure,
selected-file focus and original-source buttons support inspection. Syntax facts remain
reading aids; unsupported frameworks and runtime behavior stay unknown. Existing search,
maps, candidate ranking and answer contexts do not consume the wider inventory yet.

The component is scoped to policy, registry, selected index and publication. Run replacement,
publication, page/file changes and collapsed details invalidate pending detail/evidence.
Summary polling does not overlap; mutation generations reject older summary responses.
Project-state polling also uses request generations so an older held response cannot undo
a newer mutation refresh. Obsolete pending source-index request receipts are cleared when
policy, registry or publication changes; lost responses within an unchanged scope retain
their idempotent request identity.

## Consequences

The normal Index sources / Update knowledge action now prepares persistent code syntax
without additional configuration fields or a model call. A previous published index remains
readable while an update runs; each code inventory stays pinned to its own original revision
vector. Raw index retention, independent semantic review, representative framework costs
and the Workbench bridge remain separate. The next slice should add bounded query access
to full-inventory facts and originals, with an explicit recall/uncertainty contract.
