# ADR 0061 — Lossless native question format v2

Status: implemented in Task 133; first ordinary controls retained. Complete resource
and semantic qualification remains pending.

## Decision and boundaries

Introduce `native-question-item/2` with `loredock-prepared-answer-v2`. Preserve exact
v1 serialization and prompt generation for existing saved witnesses. The admission
kind, witness/composition/storage schemas, original-only answer schema, model policy
and all byte/work/time limits remain unchanged. No stored data is rewritten.

The v2 item factors three values already present in the same immutable context:

1. Its lexical input hash comes from the enclosing `INPUT_JSON.inputHash`; the witness
   still stores and validates that explicit binding. The v2 item omits the duplicate.
2. A native header check proven identical to a legacy comparison can use
   `{ "legacyHeader": comparisonIndex }`. Both indexes and the complete immutable
   comparison belong to the reviewed snapshot. Unmatched headers remain inline.
3. `duplicateClues` uses `[legacyComparisonIndex, nativeEdgeIndex]` tuples. Expansion
   recovers the exact old legacy IDs from the same comparison array.

Keep every other field and its meaning: node/edge ordering, status, reasons, environment,
gaps, omissions, coverage, original IDs, topic witnesses and uncertainty. Legacy
comparisons and original source passages are never removed to make the native path fit.
Native/reference indexes remain non-citations and repeated clues remain one observation.

## Construction and validation

Construct the complete semantic v1 item before selecting the wire representation and
applying unchanged combined limits. Applying v2 only after the old v1 size check would
incorrectly preserve its refusal. A whole path still either fits completely or reports
an explicit omission. Reference reconstruction and serialization use the existing
operation budget; no separate budget resets or unmeasured background cache are added.

An exact legacy duplicate requires matching endpoint source/file/label identities,
status, full original support and header-check content. Never reference a merely
similar comparison. Validate tuple shapes, integer ranges, uniqueness, edge membership
and matching immutable context. Canonical reconstruction from the saved receipt remains
the authority for native facts; a reference does not create independent evidence.
Invalid, missing, ambiguous or unknown-version input fails explicitly without fallback.

Readers select the serializer and prompt from the stored supported version, never from
the latest version constant alone. A nonempty item must agree with its prompt version.
Source-only snapshots support their recorded prompt version even though their textual
prompt is unchanged. Audit preparation, compact reconstruction, snapshot decoding,
durable metadata, history summaries, worker validation and replay together.

The browser receives the matching complete enclosing context for both Ready and saved
answers. A pure resolver may be shared; no Node-only module may enter the browser bundle.
Header gaps and their explanations must display identically after reference resolution.

## Prospective evidence

Before production edits, declare and retain a fresh ordinary eight-source baseline.
First observe its actual production HTTP review. Then use an independent complete
stopped catalog copy and the real preparation owner to retain its full v1 snapshot.
A diagnostic JSON serialization observer may retain the exact complete v1 item before
the size refusal; it forwards unchanged bytes and grants no timing/memory acceptance.
The trusted promotion callback deliberately rolls back after copying the snapshot,
leaving Ready usable and creating no answer or runtime call.

Compare the diagnostic context/compact/hash with the production review. Retain the
complete item, receipt, originals, sources, both catalogs and all public responses.
This fresh observation never reconstructs or replaces the discarded historical item.

After implementation, require a useful complete production v2 path under 8,192 bytes,
with all eight required source quotes and every expanded v1 qualification preserved.
Exercise invalid references, mismatched/unknown versions, UTF-8 sizing, inline unmatched
headers, source-only input and a true whole-path over-limit refusal. Reopen a complete
copy of existing v1 saved history and verify exact old full response/prompt/replay bytes
with no dispatch. Save/reopen/replay/purge one v2 answer through the controlled runtime.

Preserve first results and failures without retries. Actual production timing stays
separate from diagnostics. No corporate code, real model, reserved-family replay or
default activation occurs. Startup, near-limit heap, browser RSS and fresh complete
resource/semantic qualification remain separate unresolved work.
