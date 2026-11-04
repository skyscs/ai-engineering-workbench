# Native worker SQL ownership evidence

Task 111's first committed diagnostic at `c41b029` passes on actual compiled services:
four owned sources, 47 files, 40 code inputs and 5,201 bytes. The bounded observer retains
47 SQL templates/7,581 bytes and seven stages without bound values or per-call records.
Each replacement prepares forty pending INSERTs and forty of each checkpoint/counter
UPDATE. All calls still execute; this is evidence of repeated preparation, not proof
of retained memory or a resource-qualified improvement.

Both replacements retain forty parsed inputs and their explicit 32 comment-only syntax
gaps. Evicted history returns exactly ten saved originals, four dependencies and the
saved projection, with zero source writes, Git/fact/path/snapshot reads or publication
locks. Source table hashes remain identical. Actual native owners close successfully.
The [ownership review](../../loredock/NATIVE_WORKER_OWNERSHIP.md) records unexercised
branches, binding lifetime constraints and the narrow candidate acceptance contract.

Three focused diagnostic tests and **805 full strict tests/builds** pass. The
[manifest](validation.json) retains all five command logs and five input/raw/report
artifacts, each with verified raw length/SHA-256 and archive SHA-256. There were no
failed validation or diagnostic attempts. Original owned SQLite/source/Git files remain
at the recorded diagnostic directory; the documentation bundle does not duplicate them.
No production code, exhausted resource family, model input or user demo is changed.
