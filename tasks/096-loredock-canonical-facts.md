# Task 096 — Share one immutable fact-free pair within a request

Status: scoped before implementation, 2026-11-04.

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
