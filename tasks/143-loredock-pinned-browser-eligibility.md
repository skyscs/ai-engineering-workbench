# Task 143 — Pin and test a standalone browser environment

Status: accepted through PR #176, head `3bf786a`, identical-tree merge `86d1908`.
The first control remains ineligible. Both complete CI logs pass 1,141 tests,
ten typechecks and ten final builds.
See [the control method](../docs/loredock/PINNED_BROWSER_ELIGIBILITY.md) and
[fixed plan](../scripts/loredock-browser-eligibility/plan.mjs).

Follow [ADR 0065](../docs/decisions/0065-loredock-resource-observation-boundary.md).
This is a new ordinary browser-environment control, independent of blocked daemon
whole-isolate heap qualification. Preserve every old failure, limit and consumed family.

1. Obtain the official full Chrome for Testing `157.0.8103.38` Linux x64 archive from
   `https://storage.googleapis.com/chrome-for-testing-public/157.0.8103.38/linux64/chrome-linux64.zip`.
   Retain the vendor catalog response, URL, local archive/executable/support-file SHA-256
   inventory and exact reported version. Use a new local toolchain directory. Never replace
   the system browser or read/change its profiles, policies, extensions or credentials.
2. Before a browser lifecycle, commit a prospective ordinary manifest with immutable
   collector/adapter/runtime inputs, exact unchanged flags, separate empty profile/cache,
   environment allowlist, explicit process ownership, startup/whole/cleanup deadlines,
   thirty-second idle window, 100-ms raw sampling and the unchanged 1,073,741,824-byte
   whole-tree RSS ceiling. Use an exclusive first output directory. No browser-type fallback,
   extension switches, retry, shared-page subtraction or PSS substitution.
3. Run one fresh blank-page control with no daemon, application page, models or corporate
   input. Record the full lifetime, every available PID/start identity, raw samples,
   missing/vanished process records, binary/process roles, errors and actual cleanup.
   Keep diagnostic observer overhead in the total and distinguish environment eligibility
   from production performance qualification. Unexpected policy/extension behavior is a
   finding, never permission to disable it.
4. On an incomplete or over-limit result, preserve the first failure and scope the required
   environment decision without tuning and rerunning. If this narrow control is eligible,
   plan a separate fresh indexed/Ready/saved UI control on the accepted application build;
   a blank page cannot qualify application memory, browser responsiveness or the full flow.
5. Retain exact inputs/results and meaningful observer regressions. Run necessary checks;
   inspect both complete exact-head CI logs before merge. Keep application source/emission,
   schemas, defaults and the blocked Node heap/startup gates unchanged.

No download or runtime call occurs as part of the preceding design task. If the selected
vendor artifact is unavailable, report that condition and choose a new version prospectively
in a separate review; do not silently use a different channel, version or installed browser.

The selected archive/version and all 301 installed files are verified. The one blank-page
control produces 306 complete samples, zero application/model requests and actual cleanup
without survivors. It fails summed RSS at 1,937,039,360 bytes and the actual sample gap at
103.099 ms. Both failures and all raw evidence remain retained without a rerun.
Eight focused tests and the full 1,141-test check pass, including ten typechecks/builds.
After CI review and merge, continue with [Task 144](144-loredock-browser-environment-decision.md);
do not start an application-page control in this ineligible environment.
