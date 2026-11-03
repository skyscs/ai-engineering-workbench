# Task 076 — Capture memory diagnosis contract

Status: scoped, 2026-11-03.

## Baseline

Task 075's first twenty-source capture qualification fails seven memory cases (61/68
pass). Useful first captures and shared accounting pass through 9,980 paths, but sampled
heap growth reaches 79.290 MiB and process RSS 407.316 MiB. The process includes fixture
preparation, replacement analyses and earlier operations. The result does not identify
retained objects, transient allocation, native memory or a specific leak.

Start from reviewed PR #79 head `7aaebb8cff49a8d1e272afad07862c843cc14293` while its
push/pull-request CI runs. Record the verified merge before the next diagnostic executes.
Preserve all Task 075 candidate/input/observer/result bytes and every earlier exhausted
matrix. No rerun, replacement measurement or changed threshold is permitted.

## Scope

Design only. Read retained measurements and trace concrete allocation/ownership sites in
the capture path, original validation, snapshots, query helpers and observer. Separate
observed facts from competing hypotheses. Define bounded prospective diagnostics that
distinguish operation work from preparation and long-lived-process effects, while retaining
useful paths, complete original support, shared accounting and all authorization fences.

Do not choose a production optimization without attribution. Do not add a cache, skip
validation, shrink source/fact scope, change limits, modify runtime/schema/API/UI/consumers,
generate new fixture data, run models, inspect corporate sources or change the user demo.

## Acceptance

Record the ownership/lifetime audit, instrumentation boundaries, fresh process versus
same-process controls, fixed diagnostic limits and stop rules. Explicitly separate
instrumented diagnosis from a future uninstrumented resource qualification. Preserve
resource failures independently of later semantic assertions. Record an ADR, active plan
and scoped next execution boundary. Review local references and the complete diff; both
CI events for the exact final head must pass before merge.
