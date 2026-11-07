# Held counters around one direct-born synthetic child

[Task 159](../../tasks/159-loredock-held-counter-prerequisite.md) combines the accepted
[direct-birth prerequisite](NATIVE_CAPABILITY_PREREQUISITE_RESULT.md) and
[held reader](HELD_COUNTER_ACQUISITION.md) in one separately committed and sealed candidate.
Its only workload remains the fixed namespace payload with one explicit 1-MiB allocation.
The native source, target run/probe path, sandbox, payload, execution permit and strict
pre-exec guard retain their accepted hashes. No application, browser or model runs.

## Admission and scope

The [probe](../../scripts/loredock-held-counter-prerequisite/probe.py) first establishes
fresh dedicated user-service ownership through the unchanged acquisition and assessor.
The outside attestor enables memory accounting only inside that owned boundary. It creates
the accepted run/probe target and two empty daemon/browser siblings under run. Those empty
leaves are prerequisite counter scopes, not application role workloads or a full layout proof.
Their handles remain separate from the frozen leaf helper's run/probe descriptor list.

The [adapter](../../scripts/loredock-held-counter-prerequisite/counters.py) acquires the
accepted reader's fixed descriptors before any measured child. It requires complete, stable,
ordered initial interface reads, exact raw/byte agreement, zero current/peak/swap/events,
empty domain groups and the existing hierarchical memory_hugetlb_accounting mount mode.
It retains raw observations and admission results with file and directory fsync before
invoking the native collector. Missing initial evidence or a publication failure prevents
child creation. There is no reopen, reset, baseline subtraction, peak addition or retry.

Counter and directory descriptors stay in the attestor. The unchanged capture adapter passes
only the target descriptor into the native parent; its child closes that descriptor before
the unchanged sandbox exec. A temporary-process regression checks descriptor exclusion while
the real held reader owns all counter handles. The payload independently reports its own FDs.

## Final retention and assessment

After the native parent reports actual normal wait and the target is observed empty, the
same held descriptors produce final daemon and browser reads followed by the direct root.
A failed native/terminal path can still retain diagnostic final bytes, but cannot claim a
normal complete exit. Partial reads retain independent successful fields and exact errors;
they never reuse an initial or previous value. Empty role peaks must remain zero and the
root's creation-to-terminal peak must be positive for this tiny workload.

Raw records and their inventory are fsynced before sampling rawRetainedAtNs. The canonical
UTF-8 memory receipt, lifetime record and hash-bound retention record are then fsynced before
service return while counter handles remain open. Native fromNs is a conservative timestamp
before creation; native exit toNs is a conservative timestamp after normal wait. These are
explicit lower/upper lifetime bounds, not exact kernel event timestamps. Initial reads must
precede the lower bound; final reads must follow the upper bound. Missing evidence never
manufactures an actual exit. A before-return getrusage snapshot reports limited outside
attestor RSS/CPU diagnostics; it excludes complete helper lifetime and other processes.

The separately pinned [outside postprocessor](../../scripts/loredock-held-counter-prerequisite/postprocess.mjs)
uses the existing local Node toolchain after the service ends. Node is not added to the
fixed service runtime, installed at /usr/bin/node or executed inside the sandbox. It reads
bounded retained files and checks the manifest/claim, inventory, receipt projection and
lifetime hashes through a [pure combiner](../../scripts/loredock-held-counter-prerequisite/assess.mjs).
The [v2 contract](observable-resource-contract-v2.json) and
[memory assessor](../../scripts/loredock-memory-receipts/assess.mjs) remain unchanged.
Acquisition assessment, offline memory assessment and combined outcome remain distinct.
If a late receipt/retention write is missing, complete raw observations can still diagnose
a known breach through an explicitly incomplete receipt; that fallback can never pass.
FAIL takes precedence over unavailable evidence. Unicode raw events remain canonical UTF-8,
so a malformed line cannot hide a separately recorded positive pressure event.

The kernel sources support the read strategy: [kernfs](https://github.com/torvalds/linux/blob/v7.0/fs/kernfs/file.c)
routes sequential interfaces through seq_read_iter;
[seq_file](https://github.com/torvalds/linux/blob/v7.0/fs/seq_file.c#L172) resets the sequence at
offset zero; [memcontrol](https://github.com/torvalds/linux/blob/v7.0/mm/memcontrol.c#L4255)
uses the global high watermark when an opened peak descriptor has not been reset.
This source review does not attest the installed kernel or actual counter availability.

## Bounds and verification

One fresh service, native invocation, clone3 attempt, sandbox and payload are permitted.
Service bounds remain 10/5/2 seconds; native control four seconds; capture five seconds;
launcher 25 seconds. There are only two counter batches, three scopes and eight interfaces
per scope, 4-KiB complete values, 64-KiB streams, 1-MiB records and 2-MiB first output.
The outside offline process has a separate ten-second/1-MiB-output bound and pinned runtime.
Missing actual counter capability ends this path without host/profile/runtime tuning,
resource-limit changes, pressure injection, fallback or a second actual attempt.

Sixteen Python regressions exercise mocked complete service execution, missing/nonzero
initial evidence, role admission, replacement, partial final acquisition, normal wait,
retention failure, descriptor isolation, strict mount modes, canonical bytes and entry reuse.
Nine Node checks exercise unchanged-assessor compatibility, known-failure preservation,
receipt/inventory/lifetime mismatches and bounded outside file acquisition. All service,
cgroup and workload records in these tests are synthetic; the FD test starts ordinary Python.
The first focused Node run exposed an overly narrow evidence-filename predicate and is
retained as development history; existing filenames with underscores are now accepted.

Full local checks pass 1,221 Node tests, ten typechecks and ten final builds, without
failures/cancellations/skips. All 148 emitted application/package modules remain unchanged.

Full executor lifetime, ancestor controls, orphan/interruption handling, application memory,
responsiveness, semantic readiness and the Workbench bridge remain separate. A tiny
prerequisite pass does not qualify resources or promote prepared answers. Agent review
and merge do not constitute independent human semantic/product acceptance.
