# Task 142 — Decide the resource observation boundary

Status: design complete after Task 141 acceptance (PR #174, merge `361728e`).
See [ADR 0065](../docs/decisions/0065-loredock-resource-observation-boundary.md).

The unchanged Task 140 application completes the small source/emitted lifecycle control,
but Task 141 cannot certify early worker heap or the full source isolate set. Source
loading adds esbuild helpers and an observed 324.833 ms parent gap. The emitted control
has a 72.231 ms maximum parent gap, yet its first worker sample arrives only 27.915 ms
after creation and later requests take up to 78.615 ms. Neither result qualifies the
existing heap/startup contract. The browser baseline RSS failure remains separate.

Make an explicit architecture/measurement decision before implementation or another
near-limit attempt. Keep existing resource ceilings, failed gates and consumed inputs.
This is a design task, not permission to change the contract to fit the measurements.

1. Trace the original sampled-heap/startup contract and distinguish sampled maxima,
   continuous peaks, unavailable values and declared process scope. Do not silently
   reinterpret missing startup coverage as a pass.
2. Evaluate a production-emission-only qualification lane, with development loader costs
   reported separately; retain source support and its observed failure. Determine whether
   startup preload plus worker-local timestamped observations can satisfy the original
   contract, including the pre-JavaScript interval and busy synchronous compiler work.
3. Compare the retained worker design with separately owned parser processes and any
   supported runtime instrumentation. Separate process RSS does not establish V8 heap;
   changing topology must preserve exact parser results, source authority, budget ownership,
   cancellation and actual-exit cleanup. Do not implement a second parser or weaken output.
4. Select a falsifiable bounded next step only if all necessary coverage can be explained.
   Otherwise document that the current Node facilities cannot qualify the contract and
   identify the exact product/environment decision needed. Do not spend another near-limit
   run on an observer already known to be incomplete. No forced GC or profiling substitution.
5. Keep the known browser baseline failure separate and propose its next decision without
   changing the browser ceiling, subtracting baseline memory or claiming PSS equivalence.

Deliver an ADR, updated roadmap/status and a concrete next task. Run documentation checks;
review complete CI logs if required by the repository workflow, merge, and continue only
with the selected bounded scope. No product edits, resource/model measurements or retries.

Decision: retain the worker architecture and current limits, keep daemon heap/startup
qualification blocked, and make no near-limit attempt. A narrower JavaScript-lifetime
measurement contract is identified as a separate possible decision, not adopted here.
Continue independently with [Task 143](143-loredock-pinned-browser-eligibility.md): pin
an official standalone browser and run one prospectively declared blank-page eligibility
control before considering another application UI measurement.
