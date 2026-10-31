# ADR 0029 — Reviewed bulk sources and fair baseline indexing

Status: implemented for Task 025, 2026-10-31. Extends ADRs 0019, 0025 and 0027.

## Decision

Accept an explicit list of 1–40 absolute local paths within 8 KiB of serialized path
input. A model-free preview resolves canonical checkout roots/common Git directories,
marks existing sources, duplicate identities and individual failures, and reports
capacity for twenty active sources. There is no directory scan, clone or source execution.
The existing single-source endpoint shares the same production capacity.

The browser confirms the ready unique set once. The daemon recomputes the entire
preview, including identities and registry revision, before a short SQLite transaction
inserts every ready source and increments the registry once. Overflow, changed paths,
stale previews or insertion failure leave the batch unregistered. Source content is
read only by a separate explicit index action. Git identity reads have the existing
per-command bounds and a shared 30-second abort signal per preview. Filesystem/Git
metadata is trusted local input; this is not an atomic lock over external checkouts.
Indexing rechecks identity again before reading pinned source objects.

Schema 7 adds request-ID/payload-hash/receipt records and nullable build allocation.
Receipts contain only inserted source IDs and the resulting registry revision, not
copied source text/paths. Exact replay works after restart or revocation without
restoring sources or executing Git; altered inputs conflict. Browser edits or registry
changes invalidate previews; late responses cannot repopulate the replaced form.

New builds persist `source-shares-v1` with the original project path and byte budgets.
Each recorded source gets an equal share with the integer remainder assigned in source
order. README candidates precede root package/Maven manifests and remaining lexical
paths. At twenty sources, shares are 500 paths and 2.5 MiB. Unused shares are deliberately
not redistributed: deterministic bounded admission is preferable for this baseline
slice to a second inventory pass or an adaptive scheduler. A large source can be partial
while aggregate capacity remains unused. Policy/format/read failures and source byte
exclusions remain visible. Inventory commands retain their independent output cap.
Oversized trees can therefore fail before path allocation, with an explicit source gap.

Pause/restart retains allocations, inventory checkpoints, original revisions and fixed
refresh baseline. Resume rejects smaller project budgets; increasing a daemon budget
does not change the saved shares. Pre-schema-7 builds have null allocation and retain
legacy admission. Refresh reuse still applies current per-file/source/project limits
before validating/copying original bytes with fresh evidence IDs. Old evidence and
source/policy fences remain unchanged.

Overview adapter `readme-orientation-v2` allows twenty cards, sixty documents, 640 KiB
input and 512 KiB output. Per-file 32 KiB/eight-span and excerpt limits are unchanged.
All README attempts precede optional manifests, so twenty bounded READMEs fit; oversized,
ambiguous, missing, failed and truncated sources remain gaps. Schema shape is unchanged.

## Limits and validation

The [capacity evidence](../../fixtures/loredock-scale/onboarding-result.json) records
production bulk ingestion, Git reads, unchanged refresh and retained bytes. Automated
tests cover transaction rollback, identity/registry races, exact concurrent/restarted
replay, revocation, legacy migration/resume, a 10,010-extra-file imbalance and twenty
maximum-sized overview documents. [Browser evidence](../fixtures/loredock-bulk-onboarding/README.md)
covers preview/confirmation, late responses, original citations, refresh/restart,
revocation and 390px layout. No model or source application is executed.

Maps, flows, answer retrieval, note selection and model payload bounds are unchanged.
Twenty cards establish baseline source visibility, not complete system understanding,
real-world throughput, semantic answer acceptance, retention limits or L5 readiness.
The next slice evaluates wider question retrieval against the independent twenty-source
oracle before changing model-facing budgets. Private-pilot and independent semantic
review gates still precede the Workbench bridge.
