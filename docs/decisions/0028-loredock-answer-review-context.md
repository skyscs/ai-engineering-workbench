# ADR 0028 — Engineer review in cited-answer context

Status: implemented, 2026-10-31. Task 023 extends the accepted answer workflow without
changing the source-only output schema, runtime capabilities or database schema 6.

## Decision

Retrieval `fts-question-v5` retains v4 source selection and adds `answer-review-v1`.
The latest authorized non-withdrawn corrections from the selected index are considered
in revision order. A note matches if its original relationship evidence intersects the
issued source spans. This conservative signal is neither semantic relevance nor proof
of the human statement. Other-index notes require explicit reapplication first.

Freeze exact note ID/version/action/text, human environment, human/unverified provenance,
original endpoint labels/kind/status/environment, overlapping issued evidence IDs and
optional original reapplication version. Inspect saved corrections through their existing
integrity/authorization checks. Do not copy full target snapshots or unrelated source
text into the prompt. Up to 100 latest targets can be examined through the existing
bounded overlay; admit at most ten notes and 16 KiB of serialized UTF-8 note JSON.
Never truncate a note. Record matching, omitted and unmatched counts and explanatory gaps.
Source selection still has its separate 30-span / 64 KiB budget. Prompt/metadata overhead
is additional; these are not token, provider-usage or complete prompt-size caps.

Prompt `loredock-answer-v7` supplies notes separately from original spans, explicitly as
untrusted human assertions. They cannot authorize tools, change source scope, settle a
conflict without source evidence or provide citation IDs. The unchanged output schema
`cited-answer-v3` accepts only original issued source IDs. The UI independently displays
the actual notes, so their existence is visible even if a model fails to acknowledge one.
Mechanical validation cannot prove that a model properly handled a dispute; no new
real-model semantic acceptance is claimed by this fake-runtime iteration.

## Freshness and persistence

The snapshot includes the project's monotonic review revision in its input hash. Any
review change invalidates a new preview/start, pre-dispatch input or pending publication.
This is deliberately conservative: even an unrelated correction can require another
preview. It avoids hidden changes to omitted notes or negative matches. A running model
is not automatically restarted; a completion rejected after review changes retains any
usage receipt and the last successful answer. Saving a correction itself invokes no model.

Save review inside the existing immutable attempt context JSON. Preserve older JSON
bytes without adding missing fields. Read responses independently expose review state:
`current`, `changed`, `not-recorded` for legacy inputs, or `unavailable` when authorization
is lost. Current review state does not mean human approval, adequate retrieval or current
source revisions. Index/registry freshness remains separate. Exact request replay returns
the original attempt, including its original note versions, without a second invocation.

Answer source dependencies are the union of recorded context sources and every admitted
note's dependency scope, including inherited reapplication dependencies. Existing source
fencing and purge therefore cover saved note/target-label text as well as answer prose.
Policy changes fence the entire input. External screenshots/exports/backups remain outside
application purge. No new API, storage schema, model connection or Git command is added.

## Browser behavior

Context preview and saved answers show a collapsed Engineer review section with source
navigation, human scope alongside original relationship scope, and explicit omissions.
All note text renders literally. Polling detects review changes and reloads saved answer
state; source/index/publication/review boundaries discard obsolete preview and detail
responses. Historical answers retain their historical notes after edit or withdrawal.
Generation with updated review requires Find context and an explicit new attempt.

## Limits and follow-up

Overlap can include an irrelevant note and miss a semantically related one. No automatic
resolution, claim-level human attribution, answer rewriting or note-based source expansion
is implemented. Real-model disputed-link evaluation, broader relationship adapters and
the heterogeneous 20-repository benchmark remain separate gates.
