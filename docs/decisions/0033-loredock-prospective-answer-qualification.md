# ADR 0033 — One-shot prospective answer qualification

Status: evaluated for Task 030, 2026-10-31. Prospective semantic gate failed.

## Decision

Evaluate the twenty-four Task 028 wordings once after Task 029's retrieval correction,
without changing questions, prompt v8, retrieval v7, model/effort, source corpus or prior
scores. Freeze their identities and implementation hashes before dispatch. The selected
personal text-only CLI remains the sole runtime; authentication stays with the CLI.

Use an explicitly invoked evaluator with injected product services/runtime, keeping
model calls out of normal tests. Save the exact input, attempt and dispatch checkpoint
before external execution; serialize atomic JSON checkpoints. One failed attempt consumes
its slot and stops the sequence. Refuse existing outputs and changed contract/runtime
identities. This task permits one run of at most 24 attempts, with the existing 120-second
per-attempt limit and no automatic retry. It does not alter Task 028's zero-model budget.

Review every generated claim and every frozen requirement, including optional assertions
and unanswered questions. Record exact answer locations for satisfied requirements and
equivalent support where relevant. Keep independent human-review boxes unchecked. Audit
all original bytes against newly reconstructed Git objects, and verify judgment coverage
separately from the subjective semantic assessment. Preserve all raw failures and earlier
results; never assemble a best-of result or retroactively replace an earlier gate.

## Outcome and consequence

The single run completes 24/24 operationally and retains all required evidence. Agent
review passes 11/12 development and 12/12 reserved cases. Every required proposition is
covered, but an extra d10 claim asserts tenant-header propagation across components whose
literal header names differ. The prospective all-cases-grounded gate fails; Task 027's
historical gate remains failed too. [Complete evidence and review](../fixtures/loredock-prospective-answers/README.md)
disclose the narrow interpretation of h10's separate declarations and remaining human
review uncertainty.

This distinguishes evidence recall, completeness and grounding: a useful correct core
answer can still add an unsupported cross-component assertion. The next bounded product
task should expose literal request/binding compatibility and unresolved mapping with
source citations, not enlarge context or repeatedly tune against inspected answers.
Static compatibility will still not prove runtime wiring or identity enforcement.
No UI, application schema, prompt or runtime policy changes are included here.
