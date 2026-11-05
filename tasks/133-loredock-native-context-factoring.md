# Task 133 — Version lossless native context factoring

Status: scoped after Task 132; begin after both exact-head CI events and identical-tree merge.

## Objective

Implement the smallest versioned representation justified by the
[retained size diagnosis](../docs/fixtures/loredock-native-size-diagnosis/README.md).
Three redundant components offer an estimated 287-byte saving on the ordinary failed
positive; that estimate is not an observed complete item or a qualification result.
Keep the 8,192-byte combined derived limit and all other existing bounds.

## Design and compatibility before implementation

1. Record an ADR for `native-question-item/2` and a distinct prepared prompt version.
   Prefer exact legacy header references, an enclosing lexical binding and duplicate
   clue index tuples. Preserve v1 decoding, validation, prompt generation, history and
   idempotent replay. Do not rewrite stored snapshots or migrate their hashes.
2. Audit every version gate: preparation, compact reconstruction, snapshot validation,
   durable witness metadata, answer history summaries, worker validation and browser
   Ready/saved displays. A supported saved version must select its exact serializer
   and prompt; unknown or inconsistent versions fail explicitly. Avoid a database
   schema change unless evidence demonstrates it is necessary.
3. Define strict reference reconstruction. A reference is valid only when the immutable
   context contains that exact comparison and its endpoints, status, header check and
   complete original support match the native edge. Reject invalid, missing, negative,
   out-of-range or ambiguous references. Inline unmatched headers unchanged. Keep the
   complete original list, qualifiers, reasons, gaps, omissions and topic witnesses.

## Prospective ordinary controls

Declare input bytes, order and first-output locations before execution. Use no reserved
family or corporate code. Preserve every first failure and make no automatic retries.

- Before changing production code, capture one complete synthetic v1 snapshot through
  a controlled, model-free diagnostic consumer of the real preparation owner. Keep
  actual public review alongside it. Do not infer missing historical bytes from this
  new input, and do not count diagnostic timing as production performance.
- Require a fresh production HTTP positive containing the complete intended path,
  all eight original quotes and every qualification, under the unchanged byte limit.
  Include a header mismatch and a second independent legacy comparison. Compare the
  complete expanded v2 meaning with v1 construction, not just total byte counts.
- Exercise nonduplicate inline headers, no native path/source-only input, unsupported
  versions, invalid references, UTF-8 sizing and a genuine over-limit whole-path refusal.
  Never turn a required positive into a refusal or silently remove source context.
- Reopen an independently copied existing v1 saved-answer catalog. Full response bytes,
  metadata summaries, exact old prompts and idempotent replay must remain valid without
  dispatch. Preserve policy/source/review fences and corruption failures for both formats.
- Save one new v2 answer with the existing controlled runtime, verify original-only
  citations, restart/detail/replay and source purge. No real model call is needed.

Record actual size/work/time and preserve complete stopped catalogs, exact sources,
public responses and full synthetic snapshots. Run relevant tests, review historical
source deltas, and inspect both complete exact-head CI logs before merge.

Startup, near-limit heap and browser RSS remain separate. Prepared input stays
experimental; full repaired qualification requires a fresh prospective family.
