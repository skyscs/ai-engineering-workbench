# Saved-path discovery evidence

Task 118 adds bounded authorized discovery and an explicit browser list. See the
[contract and review](../../loredock/SAVED_PATH_DISCOVERY.md) and [manifest](validation.json).
These are ordinary functional/capacity observations, not a new resource qualification.

Parent PR #121 head `3be8a268e40b77a3d0e1903e8a89d5e3d3648019` passed push
41910682631 and pull-request 41910691383 CI and merged as identical-tree `4ab902b`.
The prospective contract was committed at `5c0a486`, with its policy-only unavailable rule
tightened at `62386f4`. The accepted runtime/member baseline was retained at `9e97f55`
before production changes. Reviewed executable head: `b01f186`. Node 22.23.2,
pnpm 10.15.0, TypeScript 5.9.3 and Chrome 152.0.7977.82.

| Retained command | Exit | Result |
| --- | ---: | --- |
| Frozen-lockfile install; baseline build | 0; 0 | Isolated dependencies and accepted pre-change runtime. |
| First native typecheck | 2 | Input record narrowing required explicit string/number guards. |
| Corrected native typecheck | 0 | Guards and API types pass. |
| First focused run, `622b3ee` | Unrecovered | Hung cancellation test overwrote the observed first request with a concurrent busy request. Owned runner/test processes were terminated with SIGTERM; the partial log is retained. |
| Corrected focused run | 0 | 78 tests/subtests; the observed signal/result belongs only to the first request. |
| First workspace build | 1 | The validated page-size union widened across the inferred result type. |
| Corrected workspace build, `bb0acce` | 0 | Explicit validated union compiles without changing runtime values. |
| First compiled capacity run, `bb0acce` | 0 | Five checks, 64 actual files and 36 successful list operations across restart. |
| First Chrome run, `197b8d1` | 1 | Eleven scenarios; a global original-read window included eleven concurrent overview reads on an unavailable-only list. |
| Second Chrome run, `180a6e8` | 1 | Six scenarios; the smaller-budget test assumed the next record cost no more than the first. Real work-limit refusals remain recorded. |
| Third Chrome run, `2301691` | 1 | Twelve scenarios; the runner looked for sources on store project metadata instead of catalog state. |
| Fourth Chrome run, `b01f186` | 0 | Fourteen scenarios and 33 native HTTP outcomes, with operation-local original counters and retained global deltas. |
| First full strict check, `197b8d1` | 1 | Historical ordinary dependency test detected the intentionally added storage member. No frozen manifest was changed. |
| Additive reference proof, `b01f186` | 0 | Removing only the new source member restores the complete original source hash. |
| Final full `pnpm check`, `b01f186` | 0 | 862 tests (17 + 18 + 43 + 655 + 57 + 72), strict types and all builds. |

Sixteen gzip command logs and 255 raw artifacts are retained, including fifteen PNGs,
actual list/history/error response bytes, 64 native receipt copies, the measured reduced-budget
refusal, first failure views, Chrome logs and reports. Original and archived lengths and
SHA-256 hashes are bound by the manifest. All attempts remain separate; no result was
rewritten or relabeled.

The [capacity report](capacity-first/result.json.gz) verifies complete pages against the
actual files, every saved original, unchanged bytes/revisions, duplicate behavior at
capacity, refusal of a 65th record and the same generation after reopening. Every list
has zero Git/write/changed-row/fact/snapshot/path deltas and zero publication locks.
Maximum observed work is 276,675, reported wall time 22.716816 ms and encoded response
5,110 bytes. Whole-operation counters cover each request; process memory samples are
observations only. No reserved family or large-input acceptance is inferred.

The [passing browser report](browser-fourth/result.json.gz) exercises empty, four/two,
unavailable-only and mixed pages, generation changes, explicit refresh, direct links,
keyboard collapse/focus, source changes, project-refresh failure, actual cancellation/
busy/private faults, smaller-page recovery, version rejection and hidden-source purge.
All four Chrome processes exit zero without a signal or forced termination. The owned
transport never forwards upstream or listens on the user's port 4244. Operation-local
original counts isolate native requests from concurrent project overview reads; global
window counters are also preserved. No source Git mutation or model request occurs.

The runtime closure is now 39 actual emitted modules. Thirty-six old modules and every
preexisting emitted class member match the accepted baseline; native-capture and native
receipt storage add methods, and native-capture-list is new. Nineteen additional reviewed
source/test/script/API/browser asset hashes are retained. The immutable historical
resource gate is not claimed as a qualification of the changed closure.

The ordinary fixture lifecycle removes temporary source/catalog directories on teardown;
receipt copies here are not full stopped-directory backups. Browser profiles remain
outside the repository and are excluded. The user's primary checkout/demo, corporate
sources, existing history and exhausted resource families were not modified. Agent review
and CI do not establish independent semantic, private-pilot or L5 acceptance.
