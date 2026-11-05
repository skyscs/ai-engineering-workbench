# Ordinary daemon cold-start attribution

[Task 130](../../../tasks/130-loredock-cold-start-pause.md) follows the accepted
[Task 129 diagnosis](../loredock-partial-inventory-diagnosis/README.md). PR #162 passes
both exact-head CI events with 1,032 tests at `f3615e6`, before identical-tree merge
`aaec8fd`. Complete CI logs and their hashes are retained in
[accepted-diagnosis-ci.json](accepted-diagnosis-ci.json).

## Prospective first observation

One actual production launch comes first. It registers the four ordinary permit
sources, indexes twelve files, completes analysis of five code files and prepares
the required original-backed path once. The prior ordinary observer retains raw
HTTP bytes, full sources/catalog and the unchanged passive timer/memory journal.
No answer admission or model call occurs.

Then five fresh processes run once each, in this fixed order:

1. Empty control using only the diagnostic runner and passive preload.
2. ESM import of the installed TypeScript compiler.
3. `createRequire` of that exact same compiler file.
4. Import of the actual compiled code adapter.
5. Import of the actual compiled HTTP application, without constructing services.

The compiler is CommonJS. The ESM/CommonJS comparison tests a possible loading cost;
it does not assume the cause or replace production loading. Each component retains
import start/end times, complete raw timer/memory samples, process arguments and
normal exit. Component times overlap in what they load and must not be added or
subtracted as exclusive production costs. They establish neither application
readiness nor resource acceptance. Fresh process/module state does not imply a
flushed operating-system filesystem cache.

The existing external owner bounds the whole diagnostic to five minutes and one
declared catalog root. Every process uses pinned Node with the passive preload;
there are no compile-cache, profiler, heap or GC overrides. The first raw interval
remains included against 100 ms. Unknown errors stop subsequent components; first
results remain immutable. Exact executable inputs and runtime/module identities
are saved before execution. This committed plan precedes the first observation.

## Decision boundary

Only measured attribution may justify a minimal loading change. Such a change must
preserve the same parser and facts, readiness, later analysis/preparation and complete
resource visibility. Deferring work after listen or hiding it in an unmeasured worker
is insufficient. A product comparison must retain its first ordinary result, including
any remaining failure. The consumed Task 128 gate stays unchanged; future qualification
requires new prospective inputs. Defaults, schema and model eligibility do not change.

## First attribution and declared repair comparison

The first observation at `e07c5e9` completes normally with no owner errors or survivors.
Actual production preparation retains the required useful originals/path but fails
the raw timer limit at 320.039 ms. Fresh component observations are:

| Component | Import duration | Maximum raw interval |
| --- | --- | --- |
| Empty control | 0.001 ms | 10.629 ms |
| TypeScript through ESM | 229.343 ms | 231.337 ms |
| Same TypeScript through `createRequire` | 110.998 ms | 112.953 ms |
| Actual code adapter | 226.533 ms | 228.458 ms |
| Actual HTTP app | 250.186 ms | 252.601 ms |

The two compiler cases have the same installed file identity. Their first observations
support a direct CommonJS load as the smallest justified improvement; they do not
establish that it meets 100 ms. The application change uses explicit `createRequire`
and a type-only namespace import, supported by both NodeNext and `tsx`. It changes no
parser calls, dependency version, initialization timing or limits. The parser fingerprint
intentionally changes with implementation bytes; existing inventories become incompatible
until explicitly reanalyzed. No schema or saved original/history migration occurs.

Before observing this repair, declare exactly two fresh ordinary production controls:
the same completed baseline and the constant-only partial variant from Task 129.
Each must retain all eight required originals, a useful native path, immutable review
and truthful coverage. Preserve complete passive measurements and stopped catalogs,
including failures. No component replay or model call is part of this comparison.
The previous application's frozen seal is historical after this product change;
its files, consumed inputs, driver, manifest and first raw result are not rewritten.

The first repair at `4d66a05` used import-equals syntax. Its compiled production
comparison passed both useful-context controls, with raw startup gaps of 198.315
and 199.075 ms, still failing 100 ms. Focused source tests then exposed that `tsx`
emits an unavailable `require` for that syntax. All four test files failed to load;
the development/source mode was therefore broken despite the compiled result.
An attempted edit used the wrong working-directory-relative path and changed no
code; the accidentally repeated checks retained the same four failures separately.

The corrected explicit load preserves the compiler and parser calls while supporting
source execution. Declare a separate first two-control production observation for
this corrected revision, using the same ordinary comparison and unchanged limits.
This is a new development revision, not a replay or replacement of any earlier
result. Both earlier production observations and failed source checks remain retained.

## Corrected first comparison

At `f4149e8`, both actual production controls retain the useful native path and all
eight required original references. The completed control has five parsed code files
and no gaps; the constant variant has six parsed code files and the same explicit
unsupported-profile gap. Immutable repeated reviews match, and native context remains
static, partial, unverified and of unknown deployment coherence.

| Observation | Raw maximum gap | Peak sampled RSS | Peak sampled heap |
| --- | --- | --- | --- |
| Original completed control | 320.039 ms | 162,115,584 bytes | 53,555,392 bytes |
| Corrected completed control | 202.277 ms | 134,250,496 bytes | 35,534,904 bytes |
| Corrected constant control | 189.904 ms | 134,778,880 bytes | 35,923,800 bytes |

The like-for-like completed observation reduces the gap by about 37% and sampled
heap by about 34%. These are single ordinary observations, not statistical performance
guarantees. Every production timer-gap measurement still fails 100 ms. No further
startup fix or new qualification is claimed. There is no deferred initialization,
additional worker or hidden resource owner.

The corrected strict typecheck/build and 31 focused adapter, Dojo, flow and durable
analysis tests pass. The compiled parser function body is identical to the baseline;
all seven ordinary TypeScript/Vue file comparisons retain exact facts. The only changed
compiled workspace module is `code-typescript.js`; compiler and Node identities match
across all three observations. Existing inventory fingerprints intentionally differ.

Independent checks retain five complete stopped catalogs, twenty Git identities,
62 original files, forty required-original checks, five immutable review pairs and
103 HTTP responses. All five component records match raw import/timer/exit bytes.
SQLite integrity/foreign keys pass, with zero answer attempts, witnesses, admissions
or model calls. All 546 raw entries remain unchanged. The three external owners exit
normally without errors or survivors. Separate byte checking is not external product
acceptance.

[records.json](records.json) binds all three first observations, executable snapshots,
stopped copies, successful and failed check logs, offline parity and review helpers.
The original failed development check remains visible alongside the corrected checks.
The first static archive check started before the asynchronous archive finished and
reported a missing records file. After archive completion, the same check passes;
both logs are retained. This did not launch or repeat application observations.

## Historical reference checks

Initial PR #163 CI at `c60b814` fails four historical source checks in both events
(push 42104317222 and pull_request 42104365030). Each application suite reports
660 passes and four failures; later suites are not run. The failures expect the old
compiler-adapter source hash while reading the changed production file. The complete
job logs are retained; the first `gh run --log` downloads failed to connect to the
results receiver, and the job-log API downloads subsequently completed.

The correction preserves the exact independently copied old source in the
[compiler loading reference](../../../apps/loredock/tests/fixtures/compiler-loading-reference/README.md).
A strict helper reconstructs only the permitted loading/type changes and rejects
any other source edit before returning historical bytes to the older test controls.
No existing source/dependency manifest or fingerprint is updated. Two new regression
tests verify the complete emitted parser body and actual compiler identity, and reject
parser or loader changes beyond the explicit delta. All eleven focused historical
checks pass, including the four affected cases and explicit reanalysis/backward reopen.

The original frozen inventory verifier is untouched and still rejects this changed
application. The ordinary inventory unit test explicitly checks that rejection, checks
the original pins through the exact delta, and uses the current production fingerprint
for its small functional scan. This separation cannot qualify the historical experiment.
No new production observation follows this test-only correction.

The script suite, which the initial CI did not reach, then reports nine failures:
four older whole-application byte pins, four ordinary native-child checks that stop
before setup because their observer assumes ESM-only external dependencies, and the
consumed seal auditor's ESM-only dependency assertion. Its first log and the retained
failed native-child artifacts remain available.

The same strict historical delta now covers original emitted bytes. The current
ordinary native identity observer recognizes only the exact admitted direct compiler
load, resolves the actual installed compiler and keeps its payload hash. The consumed
Task 128 import auditor is untouched: its regression explicitly records that the old
ESM-only graph omits this new CommonJS edge, then checks that edge separately without
executing application code. Future qualification must account for both mechanisms;
the old manifest is not valid for the changed application. All 71 affected script
checks pass after these corrections. No parser, threshold or production byte changed
after the corrected first comparison.

## Next bounded work

Keep the measured startup improvement without claiming the complete resource gate.
[Task 131](../../../tasks/131-loredock-prepared-history-list-work.md) addresses the
separately observed twenty-row history work excess. Current summary reads validate
full witnesses even when their content is omitted. The next task must define a correct
bounded summary contract while retaining full content-read validation. Startup,
near-limit heap, browser RSS and native-output size remain open qualification failures.
