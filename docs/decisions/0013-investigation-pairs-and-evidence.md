# ADR 0013 — Investigation publication and pinned evidence

## Status

Accepted for Task 009 implementation, 2026-09-11.

## Decision

Use one runtime invocation for an investigation and its root-cause conclusion.
`packages/workflow` owns the versioned prompt, JSON schema and deterministic
structural validation. The existing RuntimeService owns preflight, processes,
shared Git locks, immutable input snapshots, cancellation and events. A new
investigation entry point uses `investigation-v1`; the earlier preview endpoint
remains compatible and does not create investigation reports.

Schema 9 stores each pair as one immutable aggregate with an investigation ID,
associated root-cause ID, task/run IDs, monotonic task version, context revision
and validated JSON. The root cause belongs to the investigation in that row;
there is no independently published or partially available root cause. Insert the
pair, store runtime output and mark the StageRun succeeded in one short SQLite
transaction. Structural validation is repeated at the storage boundary. Git/file
validation happens before that transaction while application Git locks are held.
Publication verifies the context revision again. A storage error rolls back all
three changes. Failure/cancellation cannot replace a prior report.

Compute workflow state from durable facts instead of rebuilding the original task
table: an active full investigation is INVESTIGATING; a task with a published pair
is ROOT_CAUSE_READY; otherwise use prepared-context readiness. Validation of the
investigation half is the internal INVESTIGATION_READY step, never a separately
published state. Failure or restart interruption restores the previous durable
state. Worktree removal does not erase an existing report.

Report content and identity are append-only. Active/superseded status is derived
from the greatest successfully published version. Freshness compares the report's
context revision with the task's current revision. These are lifecycle projections,
not changes to old reasoning. Minimal version selection ships now so immutability
is inspectable; challenge, persistent constraints and richer history remain Task 010.
Existing previews are retained without being promoted into verified report pairs.

## Evidence contract

A report contains at most 128 distinct evidence IDs. Timeline entries and an
identified concrete cause require references to existing IDs. An insufficient-
evidence conclusion can omit evidence but must supply unresolved questions.
Optional confidence is omitted: no calibrated probability is implied.

Support three deterministic locator kinds:

- Repository file: a selected repository, full commit SHA, relative path and
  inclusive 1-based line range. The SHA must be the retained pin or an available
  ancestor of it. Read a regular blob from Git objects, not the working checkout.
- Git commit: a selected repository and full SHA on that same anchored history.
  Resolve the commit and show its parents, timestamp and message.
- Artifact: an artifact ID and SHA-256 from the run snapshot, with a nonempty
  UTF-8 byte range entirely inside the selection supplied to that invocation.
  Verify the stored file hash through its protected descriptor before decoding.

Historical file citations need ancestor SHAs to explain an introducing change;
requiring every citation to name only the tip would obstruct historical analysis.
An unrelated or later commit is rejected. Verify canonical repository identity
and the retained pin on every evidence read. Use literal Git paths, disable object
replacement for evidence commands and never fetch missing objects implicitly.
File evidence rejects traversal, symlinks, submodules, binary/unsupported UTF-8,
files above 256 KiB and ranges above 1000 lines. The shared Git transport decodes
UTF-8; replacement characters are conservatively unsupported, even when literal.
Shallow or missing history is unavailable evidence, not a fabricated match.

Read routes accept only owned report/evidence IDs. Recheck source availability
when opened; show failures explicitly without altering historical content. Context
selection changes do not redirect old artifact locators. Source cleanup leaves
Git-object evidence available while the source repository and retained pin exist.
Validation proves locator existence and ownership at that time, not that it
supports the model's explanation. Concurrent external mutation remains outside
application locking guarantees; repositories/configuration are trusted local inputs.

## Rendering and verification

Use escaped React text for source snippets and a deliberately limited Markdown
renderer for prose: paragraphs, unordered lists, bold, inline/fenced code and
HTTP(S) links without embedded credentials. Other markup remains inert text.
No raw HTML, automatic image loading, file URLs or executable link schemes.
The UI distinguishes insufficient evidence, stale reports and unavailable sources.

Synthetic process/API/storage/browser checks cover publication, rollback,
cancellation, restart, legacy migration, pinned/ancestor evidence, excluded or
changed artifacts, invalid locators and inert hostile markup. Real synthetic
acceptance is separate and must explicitly bind the chosen configuration directory.
