# ADR 0014 — Human interventions, revision provenance and invalidation

## Status

Accepted for Task 010 implementation, 2026-09-11.

## Decision

Implement two explicit intervention actions. A constraint saves a persistent rule
for this task without starting AI. A challenge starts a fresh investigation against
the exact latest published report. ASK, ADD_CONTEXT and OVERRIDE remain reserved
domain types and return `UNSUPPORTED_ACTION`; they are not offered in the UI.

A submission includes a caller-generated request UUID and the task context revision
observed by the editor. Persist the UUID under a unique task key. Reject duplicate
keys, obsolete context revisions, superseded targets and additional active runs.
An active report that is stale because of a newly added constraint can still be
challenged with the current context revision; stale context is distinct from a
superseded target. After failure/cancellation the user can submit a new challenge
with a new UUID and the same active target. No automatic retry or session resume.
If a response is lost, refresh history before deciding whether another run is needed.

Schema 10 adds append-only interventions, task constraints, immutable StageRun
provenance columns and result dependencies/invalidations. Create a challenge and
its queued StageRun in the same SQLite transaction; an invalid model, unavailable
context or insertion failure cannot leave an orphan intervention. Each challenge
owns at most one run. Foreign-key/trigger checks protect task ownership and prevent
later edits to the provenance. Existing snapshots and result JSON are never changed;
older runs receive null provenance columns rather than invented links.

Every new full investigation records the previous published version it would
supersede. A challenged run additionally snapshots the intervention and complete
previous report pair. All new runs snapshot active constraint records and texts.
The prompt is `investigation-v2`; the output schema remains `investigation-v1`.
The legacy preview prompt also becomes `runtime-preview-v2` and carries constraints.
The model must reconsider previous claims, explain the revision in its summary,
revalidate current evidence and retain uncertainty when warranted. Human feedback
is not a requirement to agree with an unsupported assertion. Current read-only and
connection restrictions still take precedence over a conflicting task constraint.

## Constraint lifecycle and limits

Constraints are task-scoped, with a maximum of 32 active entries and 32 KiB of
active UTF-8 text. Intervention text is limited to 8192 characters, within the
existing 16 KiB JSON request limit. Saving or deactivating a constraint increments
context revision atomically and invalidates existing dependent results. Neither
operation starts a model request. Content/source identity remains immutable;
deactivation is one-way and recorded as another intervention. To correct a rule,
deactivate it and add a replacement. Historical snapshots retain the earlier rule.

Constraint and artifact/context writes are blocked while that task has an active
StageRun. Other idle tasks can still receive constraints. An intervention's recorded
context revision is the editor's observed revision before the change; clients reload
the task to obtain the resulting revision.

## Dependencies and publication

Persist investigation → task context and root cause → investigation dependency
edges for each report pair. A context-revision update triggers transitive
invalidation inside the same transaction using a recursive UNION query scoped to
the task. UNION terminates duplicate/cyclic paths. Invalidations record the first
context revision that made the immutable result stale. Backfill dependencies and
freshness for earlier reports during migration without rewriting them.

The invalidation primitive is exercised with synthetic downstream domain nodes;
no implementation/planning stages, graph editor, queue or general workflow engine
are introduced. Previous-report links record revision provenance, not a freshness
dependency: a corrected report must not become stale merely because its predecessor
was stale. Each newly published pair depends on the current task context.

Keep active/superseded separate from fresh/stale. Recheck the previous version and
context revision at publication; the pair, runtime output, dependency edges and
successful run commit together. A failed or cancelled revision preserves the last
successful pair. Restart marks unfinished attempts interrupted and retains their
intervention links. Only a successful replacement supersedes the old version.

## User interface and verification

Show active constraints, add/deactivate controls and a free-form challenge against
the selected active report. Show the triggering challenge and previous version on
a revised report. History retains the latest 100 interventions, attempt outcomes,
links to resulting versions and an inspector for failure/model/constraint snapshots.
Changing report/context resets intervention drafts so a form cannot silently target
a different version. Submission keys survive an unsuccessful send while the form
remains unchanged. The server remains authoritative for race and ownership checks.

Deterministic tests cover carry-forward, constraints without AI, stale/duplicate
submissions, cancellation, rollback, deactivation, immutable history, restart,
transitive invalidation and schema 9 migration. Chrome exercises the same revision
loop through the production adapter with a synthetic CLI. This task adds no new
real model invocation; the three release acceptance investigations remain Task 011.
