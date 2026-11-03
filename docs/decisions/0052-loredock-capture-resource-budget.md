# ADR 0052 — Share one internal budget across path capture

## Status

Design decision recorded by Task 074, 2026-11-03. Production and frozen experiments remain
unchanged. Task 073 passed its small synthetic family; aggregate work and near-limit capture
remain unqualified.

## Decision

The next offline capture candidate creates one request-local monotonic deadline and shared
work counter before any nested work. Existing path and receipt charges contribute their deltas
exactly once, preserving local caps and all original/scope/publication fences. Keep the outer
five-second and one-million-unit limits; expose no new user setting or public budget option.
Use explicit experimental accounting identities and preserve existing historical readers.

Freeze fresh twenty-source, near-limit useful paths, pressure/refusal cases and independent
phase accounting before implementation. Source shares include documentation/configuration,
so the input generator must distinguish requested files from fully admitted inventory. Require
actual relevant omission reasons and raw observations before assertions.

See the [complete resource contract](../loredock/CAPTURE_RESOURCE_CONTRACT.md).

## Why and consequences

Task 073's receipt counter excludes its nested reader. An outer clock and two independent
work limits do not establish a shared work ceiling during nested execution. Raising limits or
summing only at return would conceal the composition gap. Shared ownership makes refusal and
resource claims explicit without changing the literal-topic matching rule.

Work units remain a proxy, and synchronous I/O remains cooperatively bounded. A shared refusal
may reject inputs that fit each local budget separately; this is intentional and must be visible
in fresh qualification. Passing small-family checks does not authorize production consumers,
semantic acceptance or reinterpretation of old failed evaluations.
