# Complete capture resource contract

Status: Task 074 design; Task 075's first offline scale gate is rejected on memory,
2026-11-03. Production remains unchanged. Task 073's
[small-family result](../fixtures/loredock-literal-topics/README.md) is retained and exhausted.

## What the current evidence establishes

Task 073 measures 77 successful projections/pages, 28 captures and eight history reads on
four sources. Complete literal-topic paths fit their bounds. It does not establish twenty-
source or near-limit capture cost. Task 067's saved-tree/binding scale result predates the
new literal witness and receipt work; it cannot be relabeled as their scale qualification.

The current accounting has two separate owners:

| Owner | Charged work and checks | Composition limitation |
| --- | --- | --- |
| [`PathWork`](../../apps/loredock/src/code-paths-work.ts) | Metadata/tree traversal, fact/resolution/admission entries, comparisons and explicit byte weights; independent one-million work and five-second limits; yields at stage transitions/128 units. | Starts a new clock for the nested path request. Its units are not added to receipt metrics. |
| [Offline receipt `Work`](../../scripts/loredock-literal-topics/receipt.mjs) | Projection/wrapper/original bytes, validation entries/checkpoints and final snapshot candidate count; outer five-second clock; epoch/scope checks across yields and final handoff. | Its one-million-unit counter excludes the nested reader. `metrics.work` is local wrapper/original work, not whole-capture work. |

The outer clock includes the nested call, so an over-budget result is refused. The external
AbortSignal already reaches the nested reader; its deadline and work counter still have a
separate owner. Both layers have bounded data structures and independent checks. Summing
two nominal ceilings or checking the sum only after return would not enforce one shared
budget during work.

## Decision: one internal operation budget

The next offline candidate must create a request-local budget before capture performs any
path/original work. Its absolute monotonic deadline is entry plus **5,000 ms**, and its total
work limit is **1,000,000 units**, both reducible in tests only. Pass that same object through
the trusted nested path reader. No global accumulator, cross-request state, public budget
parameter, JSON executable option or user configuration field is introduced.

Keep existing local path and receipt count/byte/work checks. Every existing positive charge
contributes its delta exactly once to both its local subtotal and the shared total:

`totalWork = pathWork + receiptWork`

Do not add a completed subtotal again at return or reset the total at stage transitions.
Do not subtract shared evidence or cached bytes: repeated work is still work. Keep existing
weights for this experiment and identify the accounting version explicitly; the units are a
bounded-work proxy, not CPU instructions, elapsed time or a memory measurement. Graph/fact
limits and maximum serialized bytes remain independent safety bounds.

A shared check must run at nested checks/yields, after every awaited checkpoint and before
final publication, using the original deadline and cancellation signal. If a local cap is
stricter, it still wins. A charge that would exceed the shared bound refuses immediately;
negative, fractional or non-finite charges/bounds are invalid. A cancelled/stopped/failed
capture cannot donate a budget to another request. Standalone path/history operations create
their own budget; history reports `pathWork = 0` and must never call the path/fact services.

The shared object is an internal capability supplied by the operation owner, not a callback
from HTTP input. Retain one-reader ownership, catalog epoch, metadata/manifest and policy/
source checks. A budget refusal must not bypass those checks on a later retry. Use an explicit
new experimental accounting/adapter identity; do not change frozen Task 073 bytes or treat its
receipt metrics as aggregate. Existing historical readers and legacy consumers stay intact.

## Publication and metric boundaries

Capture covers request admission, path reading, original reopening, envelope validation and
serialization, lock acquisition, final snapshot checks, file fsync/link/unlink/directory fsync,
and the final pre-return check. Keep the synchronous SQLite immediate guard without DML or
await inside it. A failed operation returns no new receipt ID and removes only its own new
pending/target file; an existing identical receipt remains intact. A competing writer and
committed external epoch changes must still be tested separately.

The deadline remains cooperative. Synchronous parsing, hashing, SQLite and filesystem calls
cannot be interrupted mid-call. Check around bounded calls and retain actual outer time and
maximum sampled interval; do not promise a hard five-second process kill or crash-atomic
publication across catalog and filesystem. A failed cleanup is an explicit failure, never a
successful refusal silently counted by the observer.

Report accounting version, `pathWork`, `receiptWork`, `totalWork`, outer wall time, checkpoints,
serialized projection/receipt bytes, original text/spans and full source dependencies. The
observer independently counts charge deltas by phase and compares their sum. Resource
metrics are diagnostics outside immutable semantic receipt content; they do not establish
current applicability, runtime delivery or source relevance.

## Fresh twenty-source qualification boundary

The next task must freeze a new owned corpus/generator, expected typed identities, literal
values/reasons, size vectors, output/resource bounds and one-run protocol before implementation
or observation. Do not reuse or rerun a previous frozen matrix. Include these families:

1. Twenty repositories with new source names and a useful Vue/TypeScript → Java HTTP → event
   → subscriber → document-write path. Include two default roots, another explicit root beyond
   page one and uncited scope repositories. Every size must retain the expected complete paths
   and exact original support; fast empty/truncated results do not satisfy usefulness.
2. Small, intermediate and near-limit indexed inventories, with exact path/fact/metadata counts
   declared before observation. Every source has a fixed share of the 10,000 catalog paths and
   50 MiB input bytes: at twenty sources, at most 500 paths each, including README/contracts/
   configuration. Allocate code filler within those shares; do not concentrate it in one source,
   increase limits or confuse requested files with admitted files. Keep separately expected
   source-share overflow/opaque/omitted-fact cases as refusals or incomplete domains.
3. Fresh branch/publisher/subscriber/comparison pressure and long original/witness cases within
   existing individual caps. Preserve complete alternatives before display selection. Use a
   meaningful complete path for success cases and exact counted reasons for intentional bounds.
4. First/repeat full capture and historical read after eviction/restart, including all twenty
   authorization dependencies. Record combined work, full wall/interval/memory and bytes per
   operation; prepare/index/analyze outside the measured projection/capture interval and report
   that preparation separately. No concurrent heavy checks during resource measurements.
5. A prospectively reduced shared ceiling where path and receipt local subtotals individually
   fit but their sum exceeds it. Require refusal before publication. Exercise exhaustion inside
   nested metadata/read/resolve/admit work and after returning to original/serialization/handoff
   work. Independent small regressions can verify charge arithmetic with controlled services;
   the frozen resource family must also use real saved inventories and full originals.
6. Shared deadline/cancellation during nested stages and final handoff; external epoch changes,
   competing lock, cleanup and same-target idempotency. A failed large operation cannot affect a
   subsequent small one. History has zero nested path/fact work and preserves exact old bytes.

Retain existing limits: two paths/twenty nodes per path, 160 display nodes/240 edges, 512 KiB
projection, thirty originals/64 KiB original text, 640 KiB receipt and twenty dependencies.
Success must meet the shared work/deadline bounds, maximum sampled interval 150 ms, sampled
RSS 384 MiB and heap growth 64 MiB, using 5 ms samples plus a final sample. Sampling is not a
peak guarantee. Do not relax a threshold after observing a failure.

## Observer and promotion gates

Journal exact projections/receipts/errors before assertions. Identify nodes by source/path/
kind/label/role and exact cardinality; preserve independent controls. Every negative topic or
coverage case must assert its *relevant* frozen reason, not merely that any gap exists. Unrelated
isolated-root omissions must not mask a missing diagnostic. Distinguish operation refusals,
observer errors, cleanup failures and prerequisite-blocked checks; never count the latter as
passes. Verify archive hashes without reexecuting the candidate.

Useful paths, complete evidence/authorization, shared-budget enforcement, resource samples,
history compatibility and observer validity are separate mandatory gates. Preserve the first
failed outcome and stop promotion; no tuning/rerun of the exhausted matrix. Even a pass permits
only a separate production integration review. It does not change answer context, reapply notes,
authorize autonomous repository routing or satisfy semantic/private-pilot acceptance.

Task 074 defines this boundary only; it does not freeze inputs or implement the shared budget.

## Task 075 outcome

The [fresh shared-budget qualification](../fixtures/loredock-capture-scale/README.md)
preserves the first failed resource gate. Complete first captures pass at twenty sources
through 9,980 files, but repeated large operations exceed the 64 MiB heap-growth threshold.
Large history and two following small variants exceed 384 MiB process RSS. The single
process includes preparation and earlier operations; these failures do not identify a
specific leak or component. Subsequent semantic assertions in failed cases remain unexecuted.

Keep this contract's limits and all first-run bytes. Next: separately investigate ownership,
retained versus transient allocations and preparation/process effects, then prospectively
qualify any changed candidate on fresh inputs. No production receipt consumer is authorized
by successful accounting, refusal or ordinary CI checks alone.

Task 076 defines the [memory diagnosis boundary](CAPTURE_MEMORY_DIAGNOSIS.md): inspect
source ownership and compare fresh same-process, reopened-process and instrumentation
controls before selecting an optimization. Diagnostic samples do not replace this gate.
