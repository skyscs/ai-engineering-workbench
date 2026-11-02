# Task 072 — Event-topic evidence contract

Status: design completed and locally reviewed, 2026-11-03. Scope commit `fddad3b`.

## Baseline

Continue the authorized synthetic sequence after Task 071's failed frozen qualification.
PR #75 merged as `c3bb8ff` after exact head `6b11b012a680432941914bef6c3af094bfa81f78`
passed push 41545106891 and pull-request 41545150480 CI (488 tests). The merge tree
matches the reviewed head. Those checks do not overturn the 86/88 qualification failure.

## Scope

Specify a narrow, separately versioned event-topic candidate rule grounded in explicit
Java call-site literals, independent of the business-specific `orderTopic` setting name.
Define exact accepted syntax, unknown/contradictory cases, contract/consumer completeness,
original support, environment meaning, identity/history compatibility and resource bounds.
Correct the next observer's identity/journaling contract without changing Task 071's
frozen inputs, candidate, harness or outcomes.

Design only: no parser/resolver/API/schema/UI change, model call, new measurement, user
source/data access or prototype promotion. Do not infer arbitrary JSON-key roles or
runtime delivery from matching strings. Existing adapters and saved bytes remain intact.

## Acceptance

Trace the current rule and retained failure, choose the smallest defensible successor,
and define its fresh prospective comparison/receipt cases and stop conditions. Record an
ADR and update the active development/integration contract. Review all new local document
targets and the diff; merge only after both exact-head CI events succeed.

## Result

The [topic-evidence contract](../docs/loredock/EVENT_TOPIC_EVIDENCE.md) and
[ADR 0051](../docs/decisions/0051-loredock-literal-event-topics.md) select exact, bounded
direct-literal equality while retaining complete consumer alternatives, admitted contract
evidence and original support. Unbound settings do not select or suppress this candidate;
dynamic expressions abstain without a hidden legacy fallback. Declared environment and
runtime deployment remain distinct. New identities and receipt validation are mandatory.

The next fresh qualification must test both useful paths and conservative losses, and
journal raw observations before typed source/path/kind assertions. Task 071's failure and
bytes remain unchanged. Source/reference and complete-diff review cover this design-only
change; no runtime, model, demo or frozen evaluation was executed.
