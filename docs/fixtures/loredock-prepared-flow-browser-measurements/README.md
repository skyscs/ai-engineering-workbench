# Retained browser bytes and passive resource observations

The [browser observer](../../../scripts/loredock-prepared-flow/browser.mjs) now retains
each completed API response as its original decoded UTF-8 bytes, alongside the existing
parsed/sanitized object. An `api-body` event binds request identity, URL, byte length,
retained path and hashes. Session bodies alone are redacted before storage and have no
original-body hash. The shared [evidence helper](../../../scripts/loredock-prepared-flow/browser-evidence.mjs)
keeps header sanitization unchanged and validates UTF-8 without normalizing JSON whitespace
or ordinary source content. These are decoded body bytes, not compressed wire sizes.

Passive page observers retain long tasks, click feedback and DOM-update paint latency
through the final page observation. A click or earliest pending mutation starts a clock;
two animation frames later it records the visible paint observation. This measures initial
feedback and updates, not the duration of the whole asynchronous preparation. HTTP review
and complete preparation durations remain separate requirements. No application function,
request, original evidence or model output is replaced by this instrumentation.

The [independent assessor](../../../scripts/loredock-prepared-flow/browser-assess.mjs)
reconstructs API request/response/terminal identities from CDP events, verifies retained
bytes/hashes and applies the existing HTTP limits. Missing original bodies, failed requests
or unfinished observations cannot pass. It also checks the whole owned browser process
tree, sampling gaps, concurrent requests, full-page observed long tasks, visible paint
records and the real 30-second polling windows. Process ticks and wait4 CPU/peak records
remain raw; overlapping child usage is not summed into a fictitious exclusive CPU total.
Lane metadata is checked against the daemon, while final case provenance still needs the
execution seal. No subset result grants whole-flow qualification.

## Actual 20/64-row controls

The [ordinary entry](../../../scripts/loredock-prepared-flow/browser-measurements-development.mjs)
reuses the actual stopped 20/64-admission catalogs and sources from the earlier ordered
history run. It reopens each through production, shows one new Ready preview alongside
saved context, and observes the real page for 30 seconds. No new answer is admitted,
provider dispatched, model called or reserved-family candidate read.

| Observation | 20 stored rows | 64 stored rows |
| --- | --- | --- |
| Retained browser API bodies | 165 | 166 |
| Process-tree samples / incomplete | 310 / 0 | 310 / 0 |
| Summed sampled browser/collector RSS | 1,359,691,776 bytes | 1,363,238,912 bytes |
| Maximum observed sample gap | 102.648503 ms | 101.958016 ms |
| Maximum simultaneous network requests | 6 | 6 |
| Mean idle API requests/second | 4.999839 | 4.999998 |
| Click feedback paint | 29.8 ms | 30.9 ms |
| Maximum DOM-update paint | 42.4 ms | 38.1 ms |
| Visible DOM updates observed | 66 | 78 |

Both cases **fail** the 1 GiB summed RSS ceiling and the frozen requirement to sample the
browser at most every 100 ms. The sampler is configured at 100 ms; its actual gaps are
retained and assessed without subtracting nominal time or changing the requirement.
All API byte/latency checks, concurrency, idle request rate and observed paint checks pass.
No long-task entries were observed. The reported zero maximum is for observed long tasks;
it does not mean zero main-thread work or CPU. Browser long-task observation covers the
200 ms task ceiling but does not measure every shorter task's duration.

The first assessor already reported RSS failures and retained all sample gaps, but omitted
the explicit cadence check. Its original code and outcomes remain preserved. The corrected
assessor adds the 100 ms check, with an inclusive-boundary regression, and a separate
[offline reassessment](../../../scripts/loredock-prepared-flow/reassess-browser-development.mjs)
reads the same bytes. Independent comparison confirms that this is the only added result
check. No browser, preparation, resource sample or source indexing was repeated. Both
executions retain exit 1, no owner errors and no surviving processes.

## Retention and scope

[records.json](records.json) binds raw runs, original/corrected assessor inputs, complete
catalogs, reused source/checkpoint bytes, independent inspection copies, focused controls,
logs and four desktop/mobile screenshots. Screenshots ([20 desktop](history-20-desktop.png), [20 mobile](history-20-mobile.png),
[64 desktop](history-64-desktop.png), [64 mobile](history-64-mobile.png)) were inspected; both views preserve
Ready and saved context without horizontal overflow. Temporary Chrome profile/cache files
are excluded from the archives and explicitly listed; original local trees remain intact.

Independent inspection checks both complete copied working catalogs, their exact original
20/64 attempt identities and unpurged witness bytes. All 331 browser API bodies remain,
including two redacted sessions, with exact metadata/parsed-object agreement. Protected
client bodies and reused input hashes are also verified. Raw trees and input checkpoints
stay unchanged. Five focused tests cover Unicode/whitespace bytes, session redaction,
invalid/missing/changed evidence, inclusive HTTP/cadence limits, memory failures and
unfinished paint observations. Builds, syntax and the original application/input seal pass.
Both full final-head CI events remain required before merge.

This change closes browser-observation gaps without changing the application, parser,
schema, frozen input/oracle/threshold or user demo. Existing list work, daemon timer and
required-positive failures remain. Final ordered integration, the remaining global/storage/
work/lifetime assessment and executable/environment/output seal are still pending;
resource qualification and model eligibility remain false.

The preceding oracle checkpoint is accepted through
[PR #151](https://github.com/skyscs/ai-engineering-workbench/pull/151): push 42044188990 and
pull_request 42044443439 pass 985 tests at exact head
`4350c0d58c856198f79fc82a1b4844f13cc790a6`. Merge
`150c7babcc90669383ee6fb2353ac502ebe98ee2` has the identical tree. Both complete CI logs
are retained here.
