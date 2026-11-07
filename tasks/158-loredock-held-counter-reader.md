# Task 158 — Acquire bounded counter records through retained descriptors

Status: planned after Task 157 first-result acceptance. Direct birth and the fixed namespace
prerequisite pass; counter lifetime and complete executor qualification remain unproven.

1. Read the adopted v2 contract, Task 151 receipt schema and accepted ownership/direct-birth
   boundaries. Define a small acquisition API for exactly run/daemon/browser scope records
   supplied through already owned directory handles. Caller-supplied handles or fixture data
   alone must never establish live ownership or executor/resource qualification.
2. Implement a separate bounded reader that retains read-only, close-on-exec descriptors for
   the required current/peak/event interfaces. Bind directory and counter identities, check
   named-versus-held replacement, retain exact raw bytes and monotonic read windows, and
   reject symlinks, non-regular interfaces, unexpected scope/interface names and oversized
   reads. Never write/reset counters, create groups, move processes or contact a service manager.
3. Retain partial observations and explicit errors when a required read is unavailable.
   Preserve already observed violations for the existing offline assessor; do not substitute
   zeros or publish a terminal record from a last live read. Final role observations precede
   the direct root observation. A caller must provide actual-exit evidence before a future
   live adapter may classify observations as terminal.
4. Use temporary filesystem fixtures and injected clocks/failures to test exact boundary
   bytes, read windows, stable/replaced names, partial/oversized/missing reads, descriptor
   closure on all paths, non-inheritance and terminal ordering. Exercise the existing pure
   assessor with supplied records where compatible, without changing its frozen acceptance
   contract or claiming that synthetic records prove kernel counter capability.
5. Run full local checks, review the complete diff and both complete exact-head CI logs.
   Retain accepted Task 157 first evidence/CI and all previous consumed inputs unchanged.
   No live service, clone3, sandbox, allocation, counter reset, app, browser or model runs in
   this task. Scope a separately sealed tiny acquisition integration only after acceptance;
   actual missing counter capability ends that path without environment tuning.

Ancestor-control acquisition, complete counter lifetime, orphan/interrupted-collector
controls, application resource/timing, semantic readiness and the Workbench bridge remain
separate gates. Keep the default product flow and all published API/resource limits unchanged.
