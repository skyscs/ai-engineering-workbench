# ADR 0042 — Bounded exact-symbol search

## Status

Accepted for Task 047, 2026-11-01. Extends schema-8 durable code inventories without
changing parser support, graph sampling, candidate ranking or answer contexts.

## Decision

Use the existing source-search input for two independent local reads: original lexical
passages and exact supported symbols. Match a trimmed, nonempty, case-sensitive string
against a symbol's simple name, qualified name or Java class name. Limit original query
input to 200 UTF-8 bytes. No fuzzy ranking, regex, model request or runtime inference.

Select the newest published current-parser inventory for the requested authorized index.
A newer paused/running repeat does not hide a matching published result. Missing, evicted
or old-parser inventory is explicitly unavailable; corrupt facts or fenced scope fail
visibly. Source text search remains independent of the symbol result.

Validate the complete bounded unit manifest and payload-byte metadata, then validate each
scanned file through the durable service, including original bytes, identity, checkpoints,
evidence and symbol ranges. No AST reparse, Git process or source execution occurs.
Read-only catalog header authorization preserves publication/policy checks without
recomputing full aggregate index coverage for every file. Recheck the inventory manifest,
parser and policy/registry identity after yielding and before response publication.

The existing inventory bounds cover 10,000 units, 50 MiB original text and 16 MiB retained
payload. Check a five-second wall budget between files and yield after each file. This
is cooperative, not a hard deadline for a synchronous file/manifest validation. Return
at most twenty matches and 256 KiB JSON, alternating sources in saved registration order,
then path/symbol order within a source. Retain at most twenty matches per source while
counting all observed matches. Reserve final counters/flags when admitting output bytes.
Coverage distinguishes retained/scanned files, scan completion, time stops, observed and
omitted matches, output stops and inventory syntax/coverage gaps.

Every result carries source/file/revision/blob/content identity, validated line/hash range,
overlapping original references and syntax-only status. Inventory ID/fingerprint and
policy/registry versions identify the derivation. Query input and results are not persisted.
No-match never proves absence from the system, especially after a partial scan.

The protected GET endpoint uses existing Host/Origin/session checks. The UI escapes
labels, offers original-source buttons and keeps coverage details compact. Raw results
can appear before symbol lookup finishes. Query edits, replacement searches and index/
policy/source changes invalidate pending text, symbol and evidence results. A search
does not lock index/policy controls behind its asynchronous symbol scan.

## Consequences

Exact names now reach supported files outside the graph's 100-document sample without
widening model input or claiming full language understanding. Each lookup validates
originals again; full-volume latency still needs separate qualification. Parser identity
includes service code, so this upgrade requires explicit reanalysis of older inventories.
Semantic retrieval, supported-framework expansion and Workbench integration remain separate.
