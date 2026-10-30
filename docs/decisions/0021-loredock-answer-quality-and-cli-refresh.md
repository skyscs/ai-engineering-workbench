# ADR 0021 — Orientation fallback, issued citation choices and CLI requalification

Date: 2026-10-30. Status: implemented; human semantic acceptance remains separate.
Extends [ADR 0020](0020-loredock-bounded-answers.md).

## Problem

The initial answer pilot missed a frontend-conventions question with no lexical
overlap, discarded useful explicit no-framework evidence, and placed a source-backed
explanation in uncited uncertainty prose. Further evaluation found a document conflict
omitted after selecting a local value, an omitted identity-enforcement caveat, and a
content hash used as a citation ID. Mechanical validation correctly rejected the hash,
but the model had been allowed to emit arbitrary citation strings.

The installed CLI also changed from 0.159.2 to 0.166.0. A version-string update alone
cannot carry the earlier capability qualification forward.

## Decision

### Bounded orientation after zero lexical matches

Keep the existing lexical ranking and identifier expansion when they find matches.
When they find none, select only existing authorized first spans: root README files,
one root package/Maven manifest and one representative per supported source language.
Choose short paths deterministically, cap each repository at six spans, and select in
round-robin order up to 18 overall. Apply the existing 30-span / 64 KiB limits afterward.
Selection uses indexed file metadata, never question IDs, oracle answers, expected
repository names or new model calls. There is no new database schema or index migration.

Record `retrievalMode` as lexical, orientation or empty in the hashed context and model
input. Show a gap explaining that an orientation sample is neither a relevance match
nor a complete language inventory. Zero lexical hits still do not establish absence.
The sample cannot establish full architecture or runtime/deployment behavior.

### Restrict generation as well as publication

Build output schema `cited-answer-v3` from the immutable issued context: claim citation
choices are an enum of precisely its span IDs. With no spans, claims have maxItems=0;
do not send an invalid empty enum. Validate citations and full live authorization again
before publication, since a decoder constraint is not a replacement for that boundary.

Unknowns remain strings, but new output must phrase them as unanswered questions ending
in a question mark. Source-backed explanations and documented absences belong in cited
claims. Question punctuation is a format check, not semantic verification. Known values
or disagreements must not be hidden in the premise of a question. The prompt requires
documentation/configuration conflicts to remain visible even after selecting a scoped
value, and separates identity propagation from verified authentication/authorization.
Conflicts compare incompatible assertions under overlapping scope: a known local value
and an unknown production value alone are not contradictory. Explicitly different
environments must not be collapsed into a manufactured conflict.

Expose saved prompt/schema versions in attempt details. Existing schema-1/2 answer
prose is read as saved and never rewritten or revalidated under a newer decoder schema.
The SQLite schema stays at version 3. Declare the web app's development dependency on
the daemon whose transport types it imports so workspace build ordering is correct.

### Requalify the installed CLI

Text policy `text-only-v2` pins 0.166.0. Keep the model/effort at the previously selected
`gpt-5.6-terra` / medium and retain all restrictions and preflight guards from ADR 0020.
Workbench's qualified versions and adapter are unchanged.

Eight helper checks passed again. Actual Code Mode inventory now also contains
`list_mcp_resources`, `list_mcp_resource_templates` and `read_mcp_resource` alongside
blocked `apply_patch`. The new synthetic calls return empty resource/template lists
and reject a file URI through an unconfigured server. Production preflight requires
every configured MCP server to be disabled; enabled-server rejection is tested. These
primitives provide no resource access in the qualified configuration. Shell, direct
process/network JavaScript APIs and delegation remain unavailable. The selected personal
connection passed no-model preflight; no authentication/session secrets were parsed.

The global instruction canary still reaches the synthetic request, preserving the need
for the production global-AGENTS rejection guard. Helper filesystem isolation still
must not be confused with production's disabled-capability/read-only boundary.

## Consequences

Preserve each bounded run, including the run stopped on a rejected locator, the run
that omitted the identity caveat and the run that manufactured an environment conflict.
Never assemble a passing set from selected answers across runs. Numeric and safety
review must assess one complete version, with human
semantic approval recorded separately. No automatic retries, embeddings, routing,
relation graph or default activation is introduced by this decision.

See the [quality evidence and human review sheet](../fixtures/loredock-answer-quality/README.md).
