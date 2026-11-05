# Ordinary browser memory attribution

Task 134 follows accepted PR #166 at `63501cb`, identical-tree merge `1a03c04`.
Both complete preceding CI logs pass 1,045 tests and were inspected before merge.
The [prospective control plan](../../loredock/BROWSER_MEMORY_ATTRIBUTION.md) and observer
were committed at `bf89725` before any new browser execution. No application source,
built asset, compiler, runtime or original frozen collector changed.

## Retained and fresh observations

Offline attribution at `eae8212` verifies all 223 archived Task 133 ordinary entries
before/after reading. Its ten complete samples span 1,019.920 ms and reconstruct the
1,403,904,000-byte peak across sixteen owned processes. Missing process roles, a clock
bridge and a blank baseline prevent causal attribution from that short observation.

The new controls each use a fresh isolated profile, the same Chrome binary and flags,
unchanged 100 ms raw sampler, and thirty idle seconds. The two application controls
use independent complete stopped catalog copies and the real production entry.

| Control | Whole-lifetime sampled summed RSS peak | Samples | Raw 1-GiB gate | Terminal sequential PSS |
| --- | --- | --- | --- | --- |
| Blank browser, no daemon/page | 1,311,698,944 B | 304 | Failed | 342,068,224 B |
| Indexed UI, no prepared/saved input | 1,383,780,352 B | 305 | Failed | 375,207,936 B |
| Useful Ready and exact saved v2 answer | 1,386,823,680 B | 308 | Failed | 371,171,328 B |

All three peak samples are complete. Two other samples are incomplete; they remain
retained and are not silently dropped. The original raw summed RSS includes collector
overhead and shared resident pages in every process. PSS comes from a later sequential
fourteen-process snapshot, not the sixteen-process peak. It is neither a substitute
for the failed gate nor a simultaneous unique-memory maximum.

At the blank peak, renderer processes contribute 584,802,304 bytes, the browser root
218,161,152, zygotes 143,761,408, GPU 144,109,568, network utility 125,140,992, storage
utility 54,370,304, and collector/crashpad/wrapper helpers the remainder. Two renderer
identities carry an observed `--extension-process` flag in every control. Their origin,
extension identity or policy is not inferred or inspected. No existing user browser
profile, corporate repository or Codex authentication data is read.

The blank control makes zero application requests. Indexed UI and Ready/saved windows
observe approximately four and five API requests per second, respectively, at most
two concurrent requests and no pending request at the end. These are ordinary
observations, not full performance qualification. The useful control preserves both
native displays and the saved answer's exact bytes; no answer generation occurs.
The kernel owner exits zero in 92,863.501 ms with no errors or surviving descendants,
observing both declared catalog roots. Real and controlled model calls are both zero.

## Role-label limitation and independent review

The first observer's derived role field searched argv elements beginning with `--type=`.
Chrome rewrote child argv to one process-title string, so that field incorrectly used
the fallback label. Complete argv, executable and PID/start-tick bytes were retained.
The offline assessment at `4eab86b` handles both actual argv and collapsed Chrome titles,
rejecting contradictory role flags and refusing to interpret unrelated path text.
Its regression test passes; no browser or first observation is rerun or rewritten.

Independent review opens only new copies of the two stopped catalogs. Integrity and
foreign keys pass. The zero/one saved answer counts and exact original witness/context
bytes remain unchanged. Eight Git identities, twenty-two files, eighteen original spans,
seven driver HTTP responses, 297 browser responses and four redacted sessions are
verified. All 1,460 first-run raw entries remain unchanged before/after assessment and
review. The 245 script tests and production build pass. All 139 accepted compiled
application modules remain byte-identical.

[records.json](records.json) binds the first retained attribution, first three-control
execution, full input snapshot, assessment, copied catalogs, helpers and logs with
per-entry hashes. Temporary Chrome profiles/caches remain in the original local output;
their explicit archive exclusions are recorded. Raw observations, responses, kernel
snapshots, application inputs and stopped catalogs are archived.

## Decision and continuation

The blank browser exceeds the existing ceiling before loading LoreDock. These controls
therefore do not demonstrate an application leak or justify a product memory change.
No Chrome flags, resource definitions, limits or defaults change. The current browser
environment is ineligible under the raw summed RSS gate. Selecting another environment
or a different resource contract requires a separate prospective decision and cannot
retroactively turn these failures into passes.

Startup and near-limit daemon heap are separate unresolved work. After exact-head CI
and merge, [Task 135](../../../tasks/135-loredock-compiler-isolation-design.md) designs
owned compiler isolation and complete worker resource accounting before implementation.
Full repaired qualification remains closed and requires a fresh prospective family.
