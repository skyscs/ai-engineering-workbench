# ADR 0065 — Retain resource blockers and isolate browser environment eligibility

Status: accepted design; implementation and measurements belong to later tasks.

## Context

Task 141 is accepted through [PR #174](https://github.com/skyscs/ai-engineering-workbench/pull/174),
head `9cdccb1e7b3fff24eea293a727eb44e8ae2f196b`, identical-tree merge
`361728e19cdea54688b35e0b0920a24037ace54f`. Both complete CI logs pass 1,133 tests,
ten typechecks and ten final builds. Its unchanged application completes the small
source/emitted lifecycle controls, but neither establishes complete startup/isolate heap
coverage. Source's parent interval reaches 324.833 ms; emitted reaches 72.231 ms.
See the [original record](../loredock/PARSER_OBSERVATION_COVERAGE.md).

The [original contract](../loredock/PREPARED_FLOW_QUALIFICATION.md) explicitly measures
sampled maxima, not a mathematical continuous bound. It preserves startup/end gaps,
raw intervals, process high-water RSS and missing observations. Its passive main-thread
preload runs before application imports, after Node bootstrap; it never measured heap
before JavaScript. [ADR 0062](0062-loredock-owned-file-parser.md) additionally requires
every worker lifetime and prevents qualification with missing startup/busy coverage.
Neither text authorizes zero-filling unavailable memory or discarding helper isolates.
Task 141's public Worker wrapper is diagnostic; it is not the original passive resource lane.

## Decision

Keep the production worker architecture. Its exact parser compatibility, bounded admission,
cancellation and actual-exit ownership are established. A different process topology is
not justified by an observer limitation. Keep daemon RSS 402,653,184 bytes, aggregate
observed heap 67,108,864 bytes, raw parent interval 100 ms at the existing 10-ms schedule,
and browser summed RSS 1,073,741,824 bytes. All other operation/storage bounds stay fixed.

Do not run another daemon near-limit or repaired full-flow gate with the current observer.
Whole-isolate heap and complete startup qualification remain blocked. Use the emitted
application as the candidate production lane in any future contract; report source loader
costs separately and preserve source support and the original source failure. This lane
selection alone grants no resource acceptance and does not exclude a required old case.

| Candidate | Benefit | Remaining problem | Decision |
| --- | --- | --- | --- |
| Existing external worker heap requests | Samples a busy worker through a native interrupt | Unknown sample instant, early/late unavailability, pending/rejected requests | Retain for diagnostics |
| Parent and worker-local passive preloads | Timestamp application entry before compiler imports | Cannot observe earlier native initialization; local timers can stall during synchronous work; current worker explicitly uses empty `execArgv` | No implementation until coverage contract is explicit |
| Separate parser process | Clearer OS process attribution | Another runtime bootstrap and heap; RSS still is not V8 heap | Do not migrate just for measurement |
| Inspector or heap snapshots | Useful diagnostic state | No demonstrated complete startup sampling; snapshots alter memory/timing and are prohibited substitutes | Do not use for acceptance |
| Custom Node/V8 instrumentation | Could expose native lifecycle samples | Different maintained runtime and an unproven observer | Outside this bounded step |

Node's [worker implementation](https://raw.githubusercontent.com/nodejs/node/v22.23.2/src/node_worker.cc)
creates the isolate/context before publishing the Environment. Heap requests run an
interrupt there and deliver results later to the parent, without a measurement timestamp.
The inference is limited: this audited mechanism cannot fill its unavailable initialization
and teardown intervals; it does not prove that every possible native observer is impossible.
[Startup preloads](https://nodejs.org/download/release/v22.23.2/docs/api/cli.html#--importmodule)
can run before application modules, but are themselves JavaScript after runtime setup.
[Inspector sessions](https://nodejs.org/download/release/v22.23.2/docs/api/inspector.html)
do not document a whole-isolate startup heap high-water guarantee.
[Heap snapshots](https://nodejs.org/download/release/v22.23.2/docs/api/v8.html#v8writeheapsnapshotfilenameoptions)
are per-isolate, blocking and memory-intensive; they are not a replacement for the gate.

Before daemon qualification resumes, choose one explicit, separately reviewed scope:
provide a supported observer that covers the current lifetime requirements, or prospectively
define a narrower sampled application-JavaScript boundary with native bootstrap/teardown
reported unavailable and whole-process RSS/time retained. The latter would change coverage
semantics even with the same numeric ceilings; this ADR does **not** adopt it. All old failed
gates remain failed. No parent/worker maximum is relabeled a simultaneous or continuous peak.

## Independent next step: a pinned browser environment

Task 134's blank browser already exceeded the raw summed-RSS ceiling before LoreDock
loaded. Its observed extension-process flags do not establish extension identity or cause.
Do not inspect or alter existing profiles, extensions or machine policies to repair that result.

Select the official full Chrome for Testing Linux x64 distribution for a **new** ordinary
environment eligibility control. Chrome provides this distribution for version-pinned
automation without auto-updates; it is distinct from a user's installed browser.
See [the vendor documentation](https://developer.chrome.com/docs/automation-and-testing/chrome-for-testing).
Select version **157.0.8103.38**, revision **r1717349**, from the
[availability catalog](https://googlechromelabs.github.io/chrome-for-testing/) observed on
2026-11-06 (catalog timestamp `2026-11-06T03:15:08.023Z`). Use the full `chrome` artifact,
not `chrome-headless-shell`; this avoids silently changing browser type as well as binary.

[Task 143](../../tasks/143-loredock-pinned-browser-eligibility.md) first pins the downloaded
archive, extracted executable/support files, exact flags, collector and runtime identities
before launching anything. It uses a separate installation and fresh profile/cache, with
the existing headless flags and raw RSS accounting unchanged. Pinning is a reproducibility
record; the new environment is not assumed to pass or to be free of machine policy effects.

Run only one thirty-second blank-page lifetime initially. Include startup, collector and
every owned process in the unchanged 1-GiB sum; retain incomplete samples and actual exit.
This narrow environment check needs OS process coverage, not the blocked Node aggregate
heap observer. On failure, retain it and stop without changing flags or retrying. On success,
scope a separate fresh indexed/Ready/saved UI control; no application or full-flow acceptance
transfers from an empty page. The previous browser failure remains unchanged.

## Consequences and validation

This task changes documentation and retains accepted CI evidence only. It does not install
or run a browser, modify product code, create new measurements, call models or reopen a
consumed family. Validate local document links, frozen API bytes, exact application tree and
both complete CI logs for this head. Continue with the independently scoped Task 143 after
merge; daemon resource qualification stays explicitly blocked.
