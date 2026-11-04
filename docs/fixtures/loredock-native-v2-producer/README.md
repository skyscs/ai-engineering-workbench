# Native v2 producer verification

Task 103 scope `f8233ea` precedes implementation `75ae357`. The
[internal producer](../../loredock/NATIVE_PATHS_V2.md) uses native v2 identities,
direct-literal topic witnesses and the actual shared operation budget. Its only
change to v1 is extracting the catalog path-owner guard so the two services cannot
read paths concurrently. HTTP, launcher, browser and existing consumers remain v1.

Twelve native cases pass. An unchanged qualified offline producer controls complete
semantic projections, original evidence, all retained file reads, coverage/omissions
and every work charge across default, repeat, selected, page and isolated paths.
Only declared version-derived identities are normalized; native hashes and exact
repeat/pin behavior are asserted separately. Literal boundaries and different,
dynamic, escaped, empty/absent, overlength and ambiguous inputs retain conservative
behavior. The old dynamic-configuration candidate remains available in v1.

Actual shared-budget tests cover caller ownership, foreign/closed/reused capabilities,
an aggregate-only work refusal, exact ceilings, the original deadline, cancellation
and observer failures. Lifecycle tests cover both v1/v2 ownership directions, stop,
nested read scopes, worker overlap in both directions, original corruption, real
external SQLite commits, restart, inventory eviction, source revocation and live
policy fencing. Existing v1/reference checks remain unchanged.

First strict checking rejects an explicitly undefined optional signal. `8248ed8`
omits that field and restricts constructor budget options to limits/observer. The
first focused run rejects a test expecting a no-op external assignment to advance
SQLite's data version. `609c1b7` commits an actual change and independently checks
the version before expecting the read fence. Both first failures are retained.

The first full check passes 640 tests/types/builds. Review adds the reverse worker/
live-policy case (`ef7e973`), and the expanded final check passes **641 tests**,
strict types and builds. The compiled
[functional smoke](../../../scripts/loredock-v2-built-smoke.mjs) passes with fresh
owned sources: nine nodes/eight edges reach a document write, six original references
reopen, 446 path units are counted and restart returns the same projection. V1 keeps
its distinct derivation. No model call, user demo or resource family is involved.

All ten logs, normalized exits and exact raw/archive hashes are in
[validation.json](validation.json). Historical measured scripts, fixtures, manifests,
reports and preserved reference archives are unchanged. Seven native modules import
no script/test code; complete resolver/admission/reader and shared-owner diffs were
reviewed. No complete-capture or resource-scale claim follows.

PR #106 head `2771c77` passed push 41828149001 and pull-request 41828318744 CI
(629 tests), then merged as identical-tree `c51f174`, verified before final checks.
The next [Task 104](../../../tasks/104-loredock-native-capture-ownership.md) decides
native receipt storage, authorization/purge and recovery ownership before implementation.
