# Task 163 — Review the complete runtime layout and remaining executor gates

Status: review completed; Task 163 exact-head CI acceptance pending. Task 162 is accepted
through PR #195, head c32205e, identical-tree merge b6e71b2. The
[layout review](../docs/loredock/COMPLETE_EXECUTOR_LAYOUT.md) and
[ADR 0070](../docs/decisions/0070-loredock-complete-runtime-boundary.md) stop expansion of
the unchanged tiny recipe and scope independent controlled-server parity in Task 164.
No service, workload, browser, model, counter/capability probe or consumed entry was started.

1. Retain Task 162's complete first result, source pins and both exact-head CI logs. State
   precisely what its tiny normal-exit PASS establishes and what remains unqualified under
   ADR 0068, ADR 0069 and the immutable v2 contract. Preserve every earlier result.
2. Review the complete emitted Node/Chromium/measured-control layout before extending the
   executor. Map direct birth into fixed scopes, shared isolated communication needed for
   loopback HTTP/browser control, namespace lifetime, descriptor/environment handoff, fixed
   read-only inputs and owned writable state. The one-probe/empty-role fixture does not
   establish these application capabilities. Use existing retained inputs and primary
   runtime/kernel documentation where needed; distinguish evidence from inference.
3. Check compatibility with the selected runtime binaries and namespace/security semantics,
   including Chromium's own sandbox and the existing restriction on nested user namespaces.
   Do not silently add launch flags, weaken isolation, change selected runtimes, expose host
   paths/network or create an alternate environment to obtain a passing result.
4. Map remaining ancestor-control identity/stability, actual process-tree/orphan closure,
   interrupted collector/final-record loss, watchdog/forced-cleanup handling and outside
   attestor cost to concrete evidence and failure/unavailability rules. Keep the existing
   memory assessor and receipt schema immutable; separate owner/executor proof from an
   offline memory verdict. Preserve original zero samples and final same-FD retention.
5. Choose the smallest coherent next offline implementation and its explicit later live
   gate, with fixed inputs, ownership, lifecycle, deadlines/work/storage/record bounds and
   acceptance criteria. Do not create a general process framework or reopen a full prepared
   flow family. If the required layout is incompatible with fixed constraints, document the
   stop and scope independently bounded functional work without promoting executor/L5/bridge.
6. Publish the reviewed layout, evidence/gap matrix and next task. Verify local links and
   immutable hashes, inspect the complete diff and both full exact-head CI logs before merge.

This review supplies no implementation, live ownership, resource qualification, application
benchmark or independent human semantic acceptance. All product/semantic and bridge gates
remain separate from the executor prerequisite sequence.
