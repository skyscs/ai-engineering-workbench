# Pinned browser environment eligibility

Status: prospective ordinary control, before browser installation or execution.

[ADR 0065](../decisions/0065-loredock-resource-observation-boundary.md) is accepted through
PR #175, head `24e1589`, identical-tree merge `98dc39e`. Both complete CI logs pass
1,133 tests, ten typechecks and ten final builds. Daemon heap/startup qualification
remains blocked; this independent control does not change that result.

The [plan](../../scripts/loredock-browser-eligibility/plan.mjs) selects official full
Chrome for Testing 157.0.8103.38 Linux x64 and preserves the exact browser flags,
100-ms raw sampler, collector-inclusive 1-GiB RSS ceiling and actual-exit ownership.
Its first output and input directories are exclusive. No previous observation is rerun.

Retrieve the vendor catalog/archive into a new toolchain directory and retain exact
archive and extracted-file hashes. Record the reported version as installation metadata;
then commit the complete binary/collector/runtime manifest before the single browser
lifetime. The installed system browser, profiles, policies and extensions are outside
the task. Do not fall back to them or alter them if this environment fails.

The ordinary driver opens only `about:blank`, observes thirty idle seconds and closes
the browser through the existing collector. No daemon, application page or model runs.
Retain full raw samples, phase clocks, process identities/roles and actual cleanup.
Any missing observation, error, survivor or over-limit value prevents eligibility.
Check actual sample-start and start/end gaps against the original at-most-100-ms
sampling requirement; a nominal `setInterval(100)` is not proof of that cadence.
An eligible result would support planning a separate application-page control only;
it cannot qualify application memory, browser responsiveness or the full prepared flow.

The same flags include the existing headless configuration; no extension, process-count,
heap or memory-reduction switches may be added after seeing the first result. Keep
observer overhead included and preserve all failed samples. A newly selected binary
does not retroactively change the Task 134 blank-browser failure.
