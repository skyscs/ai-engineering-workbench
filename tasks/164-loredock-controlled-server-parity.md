# Task 164 — Use the production server owner for controlled-runtime tests

Status: planned after Task 163 exact-head CI acceptance. Independent functional work under
[ADR 0070](../docs/decisions/0070-loredock-complete-runtime-boundary.md); no executor or resource run.

1. Preserve Task 163's layout review, both complete CI logs, every consumed first result,
   frozen prepared-flow implementation, memory assessor, API and v2 contract. Do not edit
   or invoke `scripts/loredock-prepared-flow/launcher.mjs` or an exhausted family.
2. Add the smallest typed internal TextRuntime constructor injection to LoreDockServer,
   using the existing Answers dependency seam. Ordinary startup still uses its existing
   default. Expose no HTTP, environment, CLI or persisted runtime override. Disabled answer
   mode must not prepare or call an injected runtime; preserve the two experimental switches.
3. Add a separate controlled test launcher that imports the emitted production server owner.
   Reuse its actual async parser readiness, service construction, loopback listen, startup
   cancellation and shutdown. Do not duplicate Catalog/CodeAnalysis/createApp wiring, patch
   private emitted methods, bypass parser warming or substitute a source-loader lane.
4. Keep the fake runtime deterministic and model-free. Own one request at a time, fixed
   allowlisted control messages and bounded records. Reuse current TextRuntime contracts;
   no general command runner, shell, arbitrary paths, runtime flags or provider fallback.
   Choose fresh temporary catalog/output paths, exact process arguments, normalized errors
   and bounded stdout/stderr before tests. Signals must stop the same server owner and await
   actual exit; no paid session or automatic restart is allowed.
5. Verify relevant behavior: normal/default startup, answers-disabled non-use, exact injected
   dispatch and close, parser readiness before listen, startup failure and cancellation,
   repeated stop, pending controlled work interruption, and actual parser/process shutdown
   before catalog reopen. Use existing focused lifecycle fixtures where appropriate and
   independent process tests for the new launcher; do not test only string replacements.
   Tests may start owned local Node/HTTP processes on fresh synthetic data. They must not
   start a model, Chrome, delegated service, namespace/cgroup probe or consumed resource run.
6. Document the new functional seam and the remaining complete-executor gaps. Record source
   changes and the resulting emitted-byte differences honestly; old immutable evidence is
   historical, not qualification of a changed application. Run focused checks and full
   `pnpm check`, review the full diff and both complete exact-head CI logs, then merge.

Default product behavior, source/policy fences, saved history, schemas and resource ceilings
remain unchanged. This repairs controlled-test parity only. It grants no timing/memory,
complete executor, semantic, L5 or Workbench bridge acceptance. A later task must separately
scope any shared-namespace implementation and sealed live gate; this task supplies no authority
to resume native experiments or reopen a consumed prepared-flow family.
