# Task 096 — Share one immutable fact-free pair within a request

Status: merged through PR #100, 2026-11-04.

Implement only the candidate selected by Task 095: after full per-file validation,
share one immutable canonical `{facts,ranges}` pair for an exactly repeated fact-free
shape within one path request. Bound the first eligible serialized shape to 4 KiB.
No map growth, hash-only comparison, cross-request reuse or evidence sharing.
Different, oversized or unsupported shapes preserve their original representation.

Keep all files/entries, original reads, validation, metadata, consumed identities,
gap/domain semantics, work charges, resolver evidence and final fences unchanged.
Copy/freeze the canonical pair without modifying the validated input. State ends
with its request on success/error/cancel/stop. The change remains an offline fork
composed with accepted streaming/compact/prepared-read services. Preserve measured
modules and all exhausted input families.

Prove exact captures/pages/receipts/history, stable work/read/no-write counts and
source/fence/ownership behavior on independent tiny inputs before resources. Cover
identical/different/empty/ordered gap lists, extra fields, 4 KiB fallback, fact-free
import targets, ambiguous domains, corruption and overlap/cancel/stop. Verify actual
sharing and immutable input independence. Full strict checks, complete diff/source/
hash review and both exact-head CI events precede identical-tree merge.

No resource run, native ownership claim, production consumer, corporate source,
model call or demo change. Only a later fresh frozen complete qualification can
establish fixed resource acceptance; existing failures remain failed.

## Outcome

Scope `e8f13e2` precedes implementation `3c3264d`. One helper owns only the first
eligible exact shape; copied/frozen values preserve mutable inputs and all per-file
evidence. A mechanical fork comparison limits changes to the retention seam.
Five helper/source cases and nine integration cases/subcases pass on first execution,
including actual shared identity at domain construction, exact receipt/page/history
bytes, equal work/read/preparation counts, corruption and lifecycle/fence behavior.

Full checks pass 596 tests, strict types and builds. Built composition imports;
19 direct and 412 previous measured dependency hashes match. All six first logs
are [retained](../docs/fixtures/loredock-canonical-facts/README.md). No resource claim
or production change follows. Next separately qualify complete actual process
lifecycles on a fresh frozen family after this candidate's CI/merge acceptance.

Final head `9cf719b` passed push 41817625017 and pull-request 41817637896 CI
(596 tests), then merged as identical-tree `271d1c8`. Task 097 includes that merge
before any resource execution.
