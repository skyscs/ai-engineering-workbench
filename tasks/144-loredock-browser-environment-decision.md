# Task 144 — Decide an independent browser environment and observation margin

Status: accepted through PR #177, head `54d7a9d`, identical-tree merge `4acc21a`.
Both complete exact-head CI logs pass 1,141 tests, ten typechecks and ten final builds.
See [ADR 0066](../docs/decisions/0066-loredock-independent-browser-container.md) and the
[retained read-only audit](../docs/fixtures/loredock-browser-environment/README.md).

The first pinned Chrome for Testing blank-page control fails the original 1-GiB summed
RSS gate at 1,937,039,360 bytes and at-most-100-ms sampling requirement at 103.099 ms.
All 306 samples are complete; actual cleanup succeeds and no application or model runs.
Changing the binary alone did not make this host eligible. Do not rerun or tune that control.

Deliver a prospective design before another browser execution:

1. Retain both the original system-browser and Task 143 failures, exact binary identities,
   current resource metric/ceilings and blocked daemon heap/startup qualification. Do not
   interpret extension-process flags as extension identity or a proven cause. No inspection
   or disabling of existing profiles, extensions, machine policy or monitoring controls.
2. Audit available independent execution facilities read-only. Compare a separately pinned
   Linux container/CI environment with the current host; define exact runtime/image/binary
   identities, process namespaces, filesystem mounts, local-only test endpoints, fresh
   profile/cache and complete ownership. No privileged container, host-profile mounts,
   corporate inputs, installed-browser replacement or unreviewed fallback. If no suitable
   environment exists, report the specific missing capability instead of guessing.
3. Keep the existing Chrome for Testing binary/version and browser flags for the candidate
   environment. A different environment is a new prospective control, never a repaired score
   for the consumed host run. State the supported environment scope explicitly; no broad
   claim about a user's normal desktop browser follows from container/CI eligibility.
4. Design sampling with headroom below the unchanged 100-ms actual-gap requirement,
   for example a declared 50-ms nominal interval. Preserve raw unfiltered timestamps,
   sequential-process limitations, incomplete samples and start/end gaps. Keep observer
   overhead included. Never edit the frozen prepared-flow collector; any fresh adapter
   must pin the original and declare every change before execution.
5. Define a small, single-use blank-page eligibility task only after the environment and
   collector can be made concrete and reviewable. Retain first failures without retries,
   metric substitution, baseline subtraction or larger ceilings. Application UI and full-flow
   gates stay closed until their independent prerequisites are actually met.

Update the ADR/roadmap/status and scope the next bounded task. Documentation checks and
both complete exact-head CI logs precede merge. This design task makes no application edits,
browser runs, model calls or changes to system configuration. Any proposed resource-contract
change must be explicit and separately reviewed; it is not authorized by this task.

The accessible local Docker server is the selected candidate; no image or container
mutation occurred. Public OCI metadata pins the Python 3.14.4 Linux amd64 base by digest.
The design retains the same browser/Node binaries and browser flags, a 50-ms nominal
timer under the unchanged 100-ms actual limit, durable exact container ownership and
an inner kernel owner below PID 1. Compatibility remains untested. After CI acceptance,
continue with [Task 145](145-loredock-container-browser-eligibility.md); no resource gate
or narrower daemon coverage contract is adopted by this decision.
