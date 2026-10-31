# ADR 0034 — Bounded literal HTTP header comparison

Status: accepted for Task 031 implementation, 2026-10-31.

## Context

Task 030's fixed-prompt prospective evaluation failed on an extra claim joining a
client's `x-tenant-id` header to a handler's `X-Tenant` binding without a supplied mapping.
The existing code graph matched method/path but did not compare these declarations.
The evaluation remains failed; its answers, rubric, corpus and scores are immutable.
The model budget for this follow-up is zero.

## Decision

Extend the existing source-only adapters with literal names, not values or runtime
configuration. The supported fetch/Dojo object literal yields a complete literal-name
set or an explicit unknown. Spreads, computed keys, getters, duplicate case-folded names,
`__proto__`, external objects, malformed field names and oversized input remain unknown.
Existing unsupported request syntax can still omit the entire request with a coverage gap.
No source evaluation, framework resolution or dependency installation is involved.

Read `headerBindings` from the same JSON object as `routes`. Only keys of the exact form
`<route.handler>.<identifier>` belong to that handler; other handlers do not supply its
bindings. Missing/empty binding declarations remain unresolved. At most 16 entries in
each client header object or root binding map are accepted. Field names allow the ASCII
token grammar, up to 128 characters; each serialized names/bindings property must fit
512 characters. Parameter identifiers are also bounded. Excess input invalidates the
complete comparison instead of retaining a misleading prefix.

Compare ASCII names case-insensitively, as specified in
[RFC 9110 section 5.1](https://www.rfc-editor.org/rfc/rfc9110.html#name-field-names),
using its [token grammar](https://www.rfc-editor.org/rfc/rfc9110.html#name-tokens).
Do not normalize punctuation, infer aliases or copy header values into derived metadata.
An empty/omitted client object is an empty literal declaration, not proof of missing
runtime headers. Every method/path HTTP candidate retains its original status and gets
one of `match`, `gap`, or `unknown`, with both original source citations.
All statuses leave deployment, proxy/middleware rewriting, values, conversion and
identity enforcement unverified. A gap is a review clue, not a confirmed runtime bug.

Show the comparisons inside the existing flow view, including all admitted HTTP
candidates outside the two outline selections. Reuse source navigation and engineer
corrections. Keep the document/text/graph/comparison/output limits and source/policy/
late-response fences; no setup inputs are added. The list is bounded graph coverage,
not an exhaustive inventory of system interfaces.

Version the projections as `pilot-code-v2` and `json-declarations-v2`, including their
identifier namespaces. The projection schemas and database schema do not change.
Keep old correction snapshots readable and byte-stable, but reject version-1 adapter
reapplication. After refreshing, users can inspect earlier corrections and review new
links explicitly. Previously stored answer inputs/results and review snapshots remain
historical; current projections are recomputed from pinned original files.

## Consequences and verification

An independent receipt/ledger example was added before implementation: v1 failed to
expose its header gap; v2 reports it with both originals. Focused tests cover case-only
matches, non-alias punctuation, empty and dynamic inputs, malformed/ambiguous objects,
bounds and binding ownership. Version-1 correction records remain readable across
restart but cannot be reapplied. Existing graph-bound, evidence-integrity, revocation
and historical answer audits remain applicable and pass in the full check.

Browser acceptance uses an owned twenty-source fixture plus independent matching and
dynamic examples. It checks candidates outside the outlines, original citations,
correction persistence, escaped rendering, narrow-screen layout and stale-data fences.
See [evidence](../fixtures/loredock-http-headers/README.md).

This task changes map review only. Prompt v8, retrieval v7, answer schema v3 and text
runtime policy v2 are unchanged. Feeding derived comparisons into answers needs a
separate contract that labels them as derived, preserves original support, and handles
selection bounds, versioning and revocation. New model evaluation needs a new prospective
design and explicit budget; historical failures cannot be rescored as successes.
