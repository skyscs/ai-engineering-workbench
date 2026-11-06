# Observable resource contract review

Task 150's [ADR 0068](../../decisions/0068-loredock-observable-resource-contract.md)
adopts a [prospective v2 contract](../../loredock/observable-resource-contract-v2.json)
with explicit accounting-mode, delegation, event-field and terminal-order refinements.
This is a design decision, not a qualified executor or application resource result.

[Capability metadata](capability-readonly.json) records only current-user cgroup identity,
mount options, permissions, interface presence, delegation markers, installed tool paths
and the user-manager response. No memory-counter values were read, cgroup created, service
started or host configuration changed. The writable terminal scope lacks a delegation
marker and is not a permitted test owner. Installed tools are not execution proof.

[Review findings](review-findings.json) preserve the read-only preparation that motivated
the decision; [sources](sources.json) distinguish documented interfaces from local capability.
[Records](records.json) bind every retained file, adopted contract and the two complete
accepted Task 149 CI logs: PR #182 head `e88d751`, identical-tree merge `799c7a3`, 1,169
tests, zero failures/cancellations, ten typechecks and ten final builds in each run.

[Task 151](../../../tasks/151-loredock-memory-receipt-assessor.md) implements the pure
offline assessor first. No browser, daemon resource control, model, corporate source or
consumed family is executed or rescored. The original v1 failures remain unchanged.
