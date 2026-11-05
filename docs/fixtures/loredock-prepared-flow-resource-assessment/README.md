# Declared live catalog storage and global owner assessment

The [external owner](../../../scripts/loredock-prepared-flow/kernel-owner.py) now accepts
up to 64 distinct, non-overlapping `--catalog-root` paths below its owned `run/` directory.
Declarations precede the driver launch. Its existing descriptor-based, no-follow storage
walk tracks each declared catalog separately while still counting the whole output.
SQLite, WAL/SHM, lock and native-history files inside a declared root all contribute to
that root's bytes. Symbolic-link targets are never traversed. Missing roots remain explicitly
unobserved; they are not silently accepted as empty measured catalogs.

The frozen per-catalog ceiling is 512 MiB and the whole output ceiling remains 2 GiB.
The owner stops new work and drains its kernel-owned descendants when either is reached,
without removing evidence. Tests may choose smaller ceilings, but never larger ones.
Signals still depend only on actual descendant identities/pidfds, not on declared paths
or process files. The browser lifetime collector keeps its existing ownership behavior;
its constructor does not declare catalog roots or acquire another global watchdog.

The [independent assessor](../../../scripts/loredock-prepared-flow/resource-assess.mjs)
checks complete start/finish and storage evidence, actual driver outcome, ownership cleanup,
frozen limits, every declared root's observed peak, total sampled storage, final retained
bytes and suite wall time. The final inventory includes owner report/journal bytes written
after the last live sample. Missing per-catalog data in historical runs, unobserved roots,
raced/incomplete samples, surviving processes and contradictory peaks cannot pass. A
successful metric subset never grants full resource qualification or model eligibility.

## Actual ordinary production reopens

The [ordinary entry](../../../scripts/loredock-prepared-flow/resource-assessment-development.mjs)
reuses the earlier stopped 20/64-row history and starts the actual production daemon twice.
Its command declares `run/restart-20/data` and `run/restart-64/data`. All 84 saved answers
and same-request replays remain exact; transient preparations correctly disappear. No
answer is newly admitted and no provider/model or reserved-family candidate is invoked.

| Observed value | Result |
| --- | --- |
| 20-row catalog sampled peak | 1,961,984 bytes |
| 64-row catalog sampled peak | 5,492,736 bytes |
| Whole owned directory sampled peak | 9,488,809 bytes |
| Final retained directory | 9,490,621 bytes |
| Owner lifetime | 1,995.089658 ms |
| Owner cleanup | 0.125024 ms |
| Storage samples | 3, all complete with zero raced entries |

These owner/storage checks pass with exit 0, no errors and no surviving descendants.
Sampling is nominally once per second; the observed maximum interval is 1,020.333853 ms.
These are sampled maxima, not continuous storage bounds. The stopped 20/64 catalog
sizes match the last individual-root samples. Retained witnesses total 1,326,720 and
4,245,504 bytes respectively, with no purged rows or new attempt identities.

This control does not requalify daemon timer gaps, browser memory, aggregate list work or
source usefulness. Its input source trees live in their original retained ordinary run;
that external input is separately hash-bound and is not part of the newly owned directory
measurement. The final matrix must declare every live catalog and bind declarations to
case/process inputs, including the expressly permitted catalog-only setup.

## Validation and retention

[records.json](records.json) binds actual output, complete copied catalogs, reused sources/
checkpoints, independent assessment, focused control trees and logs. Two copied catalogs
pass integrity and foreign-key checks. Independent inspection verifies 71 reused files,
all 84 exact saved answers and all 92 protected-client bodies (90 exact byte sizes and two
redacted sessions). The two expected `QUESTION_NOT_FOUND` HTTP 409 responses remain
recorded. Raw trees and input checkpoints are unchanged.

Eight kernel-owner tests cover the existing lifecycle/ownership cases plus a real catalog
ceiling that stops a TERM-resistant orphan while preserving its oversized file, and early
rejection of escaping/duplicate/overlapping declarations. Four independent assessor tests
cover inclusive limits, failures, final bytes, missing legacy observations, races and
inconsistent evidence. Browser collector compatibility is checked separately because it
imports the owner's lifecycle implementation. Installation, builds, syntax and the original
application/input seal pass locally; both full final-head CI events remain required.

No application, parser, schema, frozen input/oracle/threshold or user-demo change occurs.
Remaining per-operation/content assessments, complete ordered integration and the final
executable/environment/output seal are pending. Existing failed required positives and
resource outcomes remain failed; model eligibility is closed.

The preceding browser checkpoint is accepted through
[PR #152](https://github.com/skyscs/ai-engineering-workbench/pull/152): push 42046811345 and
pull_request 42046866562 pass 990 tests at exact head
`1c5816c9948be6f101c10f14fab694b1d8690490`. Merge
`935daef6190bc53e370e5016747fcfb251648742` has the identical tree. Both complete CI logs
are retained here.
