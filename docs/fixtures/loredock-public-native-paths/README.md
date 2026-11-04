# Public native path migration evidence

Task 115 passes 28 focused tests/subtests, 824 full strict tests/builds, seventeen actual
Chrome scenarios and three normal-daemon startup/restart checks. Public responses are
native v2; direct-topic support remains a static candidate, dynamic topics remain
unresolved, and real cancellation/time/work limits produce bounded HTTP 409 errors.
Both normal daemon runs exit zero and release catalog ownership. No model was invoked.

The [manifest](validation.json) retains ten command logs and fifteen raw report/process/
screenshot artifacts. Every entry has an original length/SHA-256 and archive SHA-256;
JSON/logs use gzip, PNGs retain their original bytes. Reviewed source/emitted public
modules are pinned, and all 38 previously qualified core runtime hashes remain identical.

The pre-migration failing contract run and first focused test-assumption failures remain
in the logs. Ordinary fixture teardown removed temporary test catalogs; their raw databases
are not claimed archived. Browser/startup reports and owned startup source/data directories
remain at their recorded locations. Neither historical resource inputs nor results changed.

[Desktop screenshot](browser/paths-desktop.png) and
[mobile screenshot](browser/paths-mobile.png) were visually inspected. The browser uses
an owned non-forwarding proxy; the actual-entry smoke uses a fresh isolated data directory,
refuses an occupied port and stops both owned processes. The user's checkout/demo is untouched.
These are functional public-consumer checks, not another resource or semantic/L5 qualification.
