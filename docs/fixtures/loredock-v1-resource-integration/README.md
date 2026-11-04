# Production v1 resource integration

Task 101 scope `030cc89` and independent v1 reference `25f372d` precede production
implementation `e3644d2`. Task 100's store/analysis archive stays byte-identical.
Production now streams snapshot headers, reuses bounded read statements within one
worker/path operation and retains compact facts with one exact immutable empty-fact
pair per request. Every payload/original is still validated. SQL executions, writes,
work charges, v1 topic resolution, wire schema and consumer boundaries stay intact.

The analysis fingerprint changes because its implementation is hashed. The separate
historical source-identity test verifies incompatibility, explicit reanalysis, changed
generations and backward reopen; originals and offline recorded history survive.
The exact behavioral comparisons intentionally share one identity context. See the
[v1 reference](../../../apps/loredock/tests/fixtures/v1-path-reference/README.md).

Seventeen focused production cases/subcases pass. They cover exact snapshots,
escaped/empty/mixed manifests and the 10,000-header boundary, late corruption,
complete v1 response/SQL/work/original equality, root pages and isolated selection,
fact-free original corruption, worker controls, overlap, ownership and cleanup.
The stopped-copy worker executes the same 171 statements: preparation counts are
171 for the original worker and 30 for production. This is a tiny functional result,
not a resource-scale or native-memory claim.

Full strict checks/builds pass **629 tests** on their first execution. Existing
actual HTTP/fallback, symbols, auto-follow, cancellation, metadata/external-write,
source/policy fencing, answer/review and shutdown regressions all remain included.
The compiled browser check passes **15 checks / 28 path reads**, with desktop and
390px screenshots visually inspected. It uses a fresh owned three-source fixture
and a sentinel-verified non-forwarding proxy; no user demo, model or corporate input.

The [validation manifest](validation.json) retains all twelve command logs and three
browser artifacts with normalized exits and SHA-256 verification. Initial failures
are preserved: missing test import; two inherited experimental-factory assumptions;
root union narrowing; a wrong root-page assumption and missing test directory. Only
new test imports/assertions/setup were corrected. Production code remains unchanged
since `e3644d2`; no failed acceptance gate was relaxed.

Historical measurement scripts, fixtures, manifests and reports are unchanged. They
correctly reject the new production dependency hashes; none was replayed. The actual
launcher and protected route fallback import the typed services directly, with no
experimental/test imports. The shared operation budget remains unconnected.

Both CI events are required at the final PR head. PR #104 head `0c9aa12` passed push
41823846350 and pull-request 41823957326 CI (612 tests), then merged as identical-tree
`0df343e`. The next [Task 102](../../../tasks/102-loredock-final-qualification-boundary.md)
resolves the final compiled qualification contract before a fresh family is frozen.
This integration does not claim production scale, native receipt support or L5.
