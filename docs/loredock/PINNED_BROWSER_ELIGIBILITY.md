# Pinned browser environment eligibility

Status: first ordinary control retained; the selected environment is ineligible.
The prospective plan was committed at `4addac2`, exact inputs at `eb89ab2`, and the
independent launch owner at `b31bbba` before the one browser lifetime.

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

## First result

The official archive reports the selected version and matches its 203,502,190-byte
vendor object and MD5. Local SHA-256 is
`8cdeb344e9b2cefe59f4aea8d1d93d5d93054c03cde217665c16fc1f62e72a66`;
the executable SHA-256 is `41ea350a7f209da77c14d1df3924d71ac66988623e71d44459b49a3dceb1c14e`.
All 301 installed files (427,261,102 bytes), fifteen driver/collector files and the
pinned Node runtime are checked before and after execution. The 36 frozen input files
remain unchanged. The original vendor archive/installation remain at their recorded
local paths; committed evidence binds their complete hashes and inventories.

| Observation | First result |
| --- | ---: |
| Complete raw samples / total samples | 306 / 306 |
| Peak summed RSS, bytes | **1,937,039,360** |
| Unchanged summed-RSS ceiling, bytes | 1,073,741,824 |
| Processes in the complete peak sample | 15 |
| Maximum sample-start gap, ms | **103.099** |
| Unchanged maximum sampling gap, ms | 100 |
| Startup / exit sample gaps, ms | 5.037 / 38.517 |
| Idle interval, ms | 30,003.871 |
| Application requests / model calls | 0 / 0 |
| External kernel owner lifetime, ms | 31,664.037 |

The browser and its lifetime collector exit normally; the outer driver exits 1 to retain
the failed RSS and sampling gates. The kernel owner reports no errors or survivors.
All source observations remain immutable; no retry or flag change occurs.

At the peak, observed renderer roles contribute 947,032,064 bytes, the browser root
292,519,936, zygotes 247,283,712, network utility 184,008,704, GPU 140,795,904,
storage utility 98,578,432 and collector/crashpad the remainder. Two renderer identities
carry an observed extension-process flag. Their identity, origin and contribution to the
failure are not inferred. The investigation did not inspect or modify existing profiles
or policy files; it does not establish which machine policies the browser applied.
The later sequential PSS sum is 479,755,264 bytes. It describes a different measurement
and instant and cannot replace the failed RSS gate or establish a simultaneous unique peak.

The [retained evidence](../fixtures/loredock-browser-eligibility/README.md) includes exact
inputs, raw process/clock observations, role records, installation provenance, launch and
exit results. Fresh profile/cache contents remain local and are explicitly excluded from
the published archive. Eight focused observer/input regressions and the full local check
pass: 1,141 tests, ten typechecks and ten final builds. Both exact-head CI logs are required
before merge. Application code, original collectors and all resource ceilings stay unchanged.

The selected binary alone does not make this host eligible. Do not proceed to an
indexed/Ready/saved application control. [Task 144](../../tasks/144-loredock-browser-environment-decision.md)
must decide an independent environment and prospective sampling margin before any new
execution; this result does not authorize changing browser flags, metrics or limits.
Daemon aggregate heap and complete startup qualification remain blocked independently.
