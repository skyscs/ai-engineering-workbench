# First pinned browser eligibility evidence

One ordinary blank-page control ran at `b31bbbac4acebcc1d1af7615effbe87f49f655d8`, after
prospective plan `4addac2` and manifest `eb89ab2`. The unchanged application base is
`98dc39ec6f407a929e1b46219bf45905950c87eb` (Task 142, PR #175).

- [first.tar.gz](first.tar.gz): 39 operational records, 3,097,555 raw bytes;
  SHA-256 `ce2ca3669385c10cc608cad10db052f4c959b53bccd12347182f608f275147f5`.
- [inputs.tar.gz](inputs.tar.gz): all 36 immutable candidate/installation inputs;
  SHA-256 `2401307c773581fba1a05cf8c920d9524478fdd3d53ad927b0086345311e442c`.
- [trees.json](trees.json) and the compressed per-tree inventories bind every member,
  size, hash and explicit exclusion. All 75 published members were verified.
- [assessment.json](assessment.json) retains the first negative gates and observed process
  roles; [launch-result.json](launch-result.json) records actual owner exit and unchanged inputs.
- [logs.json](logs.json) binds ten closed local/preceding-CI logs, including the complete
  1,141-test local check and both accepted Task 142 CI logs.

All 306 raw samples are complete. Peak summed RSS is 1,937,039,360 bytes across fifteen
processes, over the unchanged 1-GiB limit. The actual sampling gap reaches 103.099 ms,
over the unchanged at-most-100-ms requirement. Both failures remain failed. The browser
and collector exit normally; the driver returns 1 for the failed assessment. There are
zero kernel-owner errors, surviving descendants, application requests or model calls.

The original output remains at `/home/toshiba/aew/task143-browser-first`; immutable inputs
remain at `/home/toshiba/aew/task143-browser-inputs-first`. Fresh browser profile/cache
contents remain local (205 files, 5,359,429 bytes) and are not published. No existing
user profile is read. The vendor archive and 301 installed browser files also remain at
their manifest paths; exact inventories/hashes are committed instead of duplicating the
browser binary payload. Nothing is deleted or reset for another attempt.

The terminal sequential PSS sum and process-role flags are diagnostics only. They do not
identify extensions or explain the cause of the failure, and cannot replace summed RSS.
Read [the result and next decision](../../loredock/PINNED_BROWSER_ELIGIBILITY.md).
