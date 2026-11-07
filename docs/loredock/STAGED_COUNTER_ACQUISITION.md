# Staged held-counter acquisition

Task 161 implements the offline reader required by [ADR 0069](../decisions/0069-loredock-creation-ordered-counters.md).
It fixes the API ordering limitation exposed by the consumed [Task 159 result](HELD_COUNTER_PREREQUISITE_RESULT.md).
No actual cgroup, service, native helper, sandbox, payload, application, browser or model is
executed by this task. The v2 contract, Task 151 assessor and accepted readers remain unchanged.

## API and sequence

The standalone [reader](../../scripts/loredock-staged-counters/reader.py) accepts read-only,
non-inheritable parent/run directory handles and explicit boot/monotonic-clock bindings.
It owns duplicates, opens the eight root counters once and retains those exact descriptors
through role attachment and the final capture. It does not create directories or discover
services. Its byte/identity algorithms derive from the frozen Task 158 implementation.

| Call | Required state | Result |
| --- | --- | --- |
| `StagedCounters(parent_fd, run_fd, boot_id=..., clock_id=...)` | Supplied distinct, correctly named parent/run handles | Root descriptors and earliest acquisition boundary |
| `capture_root_initial()` | Root ready | One root initial record; original zero/empty data |
| `attach_roles({"daemon": fd, "browser": fd})` | Root initial complete and eligible | One attachment attempt; two distinct roles beneath the same root |
| `capture_roles_initial()` | Roles attached | One initial role record; root identity continuity checked before and after |
| `capture_final()` | Role initial capture returned | One final record, ordered daemon, browser, run |
| `close()` / context exit | No active operation | Attempts closure of every owned FD; caller handles stay open |

Use the context manager. A wrong-order call is rejected without consuming an otherwise
valid stage. An entered operation is consumed before work begins: exceptions, overflows
and interrupted captures cannot be retried. Invalid attachment closes all owned handles,
including partial role acquisitions. Missing role counter interfaces remain explicit partial
data and can produce a diagnostic final record, but never restore initial eligibility.
Repeated, reentrant and after-close operations are rejected; there is no reopen/repair API.
This is a synchronous trusted-caller API, not a thread-safety or hostile-Python boundary.

## Records and eligibility

Each returned record uses `loredock-staged-held-counter-observation/1`, with an explicit
`phase` (`root-initial`, `roles-initial`, `final`), `scopeOrder`, `acquiredAtNs` and observations.
Each observation preserves the unchanged assessor's `{identity, window, raw}` snapshot,
plus per-interface bytes in base64, completeness, descriptor identity, read windows and
bounded errors with stage/type/errno. Raw scalar strings are never normalized. Invalid UTF-8,
overflow and failed/partial reads retain available bytes without inventing complete raw values.
Independent fields remain available when a sibling field fails.

`rootInitialEligible` describes the original root initial data. `initialDataEligible` requires
both complete zero initial phases and stable root identity through role acquisition; any
initial failure remains ineligible. These flags are historical data checks, not current
process-admission permissions or final memory verdicts. Final data may contain a known
breach or missing field regardless of prior eligibility. The owner must still recheck actual
identity/membership immediately before admission, assess final predicates and prove lifetime.

Open/identity failures latch. Clock failures also latch across phases: later valid ticks cannot
repair the run's timing history. `acquisitionErrors` and `continuityErrors` preserve relevant
failures independently of role bytes. Returned objects contain copies, so changing a prior
record cannot alter held identities or initial eligibility. No previous snapshot is retained
inside the reader or substituted for a missing final field.

The earliest acquisition timestamp precedes the first root read. Initial root and role windows
remain distinct; use that earliest boundary when projecting a receipt. Using the later daemon
boundary is invalid. Root setup charges appearing after the initial sample remain in the
unchanged final peak: no reset, subtraction, rebasing or alternative zero sample is performed.

## Bounds and owner responsibilities

There are three fixed scopes and eight fixed interfaces. The two initial phases read 8 + 16
interfaces; the final phase reads 24. There are two logical sets, not extra checkpoints. A
complete interface is at most 4 KiB; each read request is at most 4 KiB, with one overflow
byte retained only as a diagnostic. Each returned record is at most 1 MiB. There is one active
capture, no queue and no cached record. The future owner must publish each record before the
next operation and preserve the existing 2-MiB first-output cap.

The reader cannot establish creation chronology, actual cgroup filesystem semantics, exclusive
ownership, mounts' accounting options, fsync, process membership or terminal lifetime merely
from supplied handles. All ownership/terminal/executor/resource qualification flags stay false;
no durability boolean is emitted. Temporary-file tests are evidence about this API only.

A separate owned-service integration must exclusively create root without descendants,
publish and fsync its initial record before constructing descendants, then durably publish
role initials before the fixed native path. It must bind these actions with actual stage
records, recheck empty membership and retain final bytes after actual wait but before service
removal. The frozen Task 156 constructor cannot express that sequence and must not be patched
in place. An unavailable initial or actual capability stops admission under the same contract.
No host tuning or fallback is authorized. Full ancestor, orphan, interruption, lifetime,
application resource/timing, semantic and bridge gates remain separate.

## Verification

The [temporary-file regressions](../../scripts/loredock-staged-counters/test_reader.py) create
roles after root capture and prove descriptor continuity while root charges grow. They cover
partial attachment/closure, timing and identity races, wrong parents/owners/mounts, byte bounds,
errno, invalid encodings, record mutation, sticky failures and lifecycle misuse.
The [Node checks](../../scripts/tests/loredock-staged-counters.test.mjs) explicitly supply
synthetic lifecycle/environment/fsync declarations to the unchanged assessor. They verify
compatible separate initial windows, rejection of a late acquisition boundary, preservation
of a known root breach despite another missing field and no initial-for-final substitution.
See the [retained verification records](../fixtures/loredock-staged-counters/README.md).
