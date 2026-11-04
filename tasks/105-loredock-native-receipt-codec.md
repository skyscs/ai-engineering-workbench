# Task 105 — Validate the native receipt format

Status: implementation started, 2026-11-04.

Implement the pure, strict native receipt codec defined by ADR 0057. Keep this
change independent of filesystem ownership, schema migration and async capture/
history orchestration. No route, browser consumer, resource family or model call.

Define typed `loredock-code-path-receipt/1` content, canonical encoding and bounded
decoding for native v2 path projections with complete originals/dependencies and a
catalog UUID. Validate all nested shapes, field sets, supported versions, IDs that
can be recomputed from recorded fields, graph/projection/generation hashes, literal
topic witnesses, original hashes/reference support and dependency consistency.
Do not claim to rederive opaque node/source IDs from absent analysis payloads.

Enforce fixed UTF-8, JSON depth, projection, receipt, original-text, span and source
bounds; trusted limits may only reduce them. Charge the caller's actual OperationBudget
without replacing its deadline or closing it. Reject unknown/legacy/experimental/
foreign records, duplicate or unused support, broken paths and noncanonical outer
records. Preserve exact projection JSON and original bytes, including Unicode.

The codec performs no I/O, source authorization or fact/path rederivation. Its typed
output does not authorize publication or historical text: the later service must
reopen source scope and every original under the final live guard. No arbitrary-file
import or identity translation. Mutable caller objects must not alias decoded output.

Use independently constructed records and real native v2 output from small owned
synthetic repositories. Test positive default/selected/isolated selections, deterministic
encode/decode, each structural/hash/scope/witness corruption, malformed UTF-8/depth/
bytes, exact and reduced bounds, legacy refusal, shared-work/deadline/cancellation and
closed-budget handling. Rehash tampered envelopes in tests so outer integrity cannot
mask missing nested validation. Preserve first failures and historical fixtures.

Run focused tests, strict types/full checks/build and a compiled codec smoke. Record
limitations and the complete diff, require both exact-head CI events before merge,
then continue Task 106 storage/lifecycle without asking for renewed approval.
