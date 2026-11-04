# Inventory worker read verification

Task 093 scope `79785f2` precedes implementation `d6b26c1`. The first strict
typecheck rejects an unchecked fixture key. The first behavioral run has seven
passing and four failing cases/counts (including the parent of a failed subtest).
Its exact source and logs remain available; failed owned directories are recorded
in `validation.json` and retained locally, not archived as portable source evidence.

The failures are incorrect new-test expectations for existing fencing: the project
trigger handles both policy and registry edits, immediately fences inventories and
deletes units. Resume therefore returns `CONFLICT`; a concurrent path detects the
old build policy first and returns `POLICY_CHANGED`. These baseline refusals are
preserved. Test correction `8505c11` also strengthens cleanup ordering, proves both
scope-overlap directions and checks original-read/write counters. The candidate
implementation is unchanged after its first behavioral invocation.

The second focused run passes 19 cases including the existing eight SQLite scope
cases. Final full checks pass **581 tests**, strict types and production builds;
the final worker regression contributes twelve cases/subcases. Built offline
services import successfully. Eight first development logs are gzip-retained with
raw/archive hashes and exit codes. All seventeen immediate dependencies and all
410 files in the previous qualification baseline match after build.

Identical stopped tiny catalogs contain nine code files and the same pending
inventory identity. Resumption performs **171 SQL executions in each arm**, with
all method/SQL/binding records equal after replacing only elapsed duration values.
Preparations fall from **171 to 30**; write preparations remain identical. Both arms
read nine originals and make zero Git calls. Exact inventory rows except duration,
all units/payloads/checkpoints, dependencies and receipt bytes agree. Receipts retain
ten originals, and history after two replacements matches with zero nested path,
fact, snapshot, write or Git activity.

The tests additionally cover synchronous admission, idempotency/errors, shared
catalog ownership, incompatible seam/store rejection, pause/resume with preserved
completed units, cancellation, repeated stop, stopped reopening, corrupted original
bytes/spans/payloads/manifests/parser identity, policy/registry fencing, explicit
partial publication, worker errors and the resume/final-cleanup race. Concurrent
paths and unrelated reads use fresh preparation while a worker owns a scope; the
reverse overlap also falls back without sharing statements. A transaction can start
between worker files, confirming the worker does not hold one across its yield.

These are semantic and ownership checks, not resource acceptance. No model request,
corporate source, demo operation, frozen resource family, profiler, snapshot or forced
collection is involved. The first failed Task 091 resource gate stays failed. Both
exact final-head CI events and identical-tree merge remain required; next separately
freeze a fresh complete uninstrumented qualification.
