# Task 145 — Build and test one independent browser environment

Status: implementation in progress after Task 144 acceptance (PR #177, merge `4acc21a`).
The [prospective controls](../scripts/loredock-container-browser/README.md) and
[fixed plan](../scripts/loredock-container-browser/plan.json) precede image construction.
Nine synthetic owner/adapter regressions pass. No browser launch is authorized until
the concrete final image/input manifest and successful preflight receipts are committed.

Implement [ADR 0066](../docs/decisions/0066-loredock-independent-browser-container.md)
as ordinary test infrastructure only. Preserve all consumed controls and unchanged
application bytes, browser flags, RSS/cadence ceilings and blocked daemon qualification.

1. Build an isolated image from the pinned Python Linux amd64 digest with exact Task 143
   Chrome for Testing files and Node executable. Retain build inputs/logs, dependency
   versions, final image ID/config/layers and executable/support inventories. Verify runtime
   compatibility without a browser lifetime. No moving runtime tag or hidden fallback.
2. Implement the host create-record-verify-start owner and pinned PID-1 wrapper. Persist
   exact container identity before start; use finite API/wall/cleanup deadlines, no restart,
   non-root user, default security, private namespaces, network disabled and one fresh
   evidence mount. Keep the frozen kernel owner below PID 1. Prove interruption, pidfd
   signaling, failed/ambiguous API outcomes and actual stopped-state handling on small
   independent fixtures; retain first container preflight failures and stop if incompatible.
3. Implement a fresh explicitly hashed blank-page adapter with a 50-ms nominal RSS timer,
   retaining the original collector and unchanged at-most-100-ms actual-gap requirement.
   Verify raw sample completeness, tree membership, clock boundaries, identity and all
   writable storage accounting. Keep outer observer overhead separately visible.
4. Before any browser lifetime, commit the concrete image/runtime/collector/owner manifest,
   fixed environment/mount/temporary/shared-memory settings, exact one-use output path,
   thirty-second idle period and fixed deadlines/ceilings. Seal input bytes and verify
   them before and after execution. A preflight failure does not authorize tuning and
   consuming a browser run anyway.
5. Run the blank-page control exactly once only if all prerequisites pass. Preserve its
   first result, raw evidence and actual-exit receipts without retry or metric substitution.
   No daemon, application UI, models or corporate input. Container-only eligibility is
   not desktop/application/full-flow acceptance. On failure scope the concrete next
   decision; on success scope a separate application-page control with its prerequisites.
6. Retain portable evidence and meaningful lifecycle/assessment regressions, update the
   status/roadmap, run relevant/full checks and review both complete exact-head CI logs
   before merge. Keep the ordinary user checkout and all original frozen records untouched.
