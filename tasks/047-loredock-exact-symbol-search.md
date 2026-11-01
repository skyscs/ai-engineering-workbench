# Task 047 — Bounded exact-symbol lookup over complete code inventories

Status: scoped before implementation, 2026-11-01.

Use the durable inventory in a first bounded query path. Exact supported symbol lookup
can reach files outside the interactive graph sample without widening the graph or model
context. Keep the existing source-search input and raw passage results; no additional
configuration field, AI request, corporate source or full-volume benchmark is required.

## Contract

- Match a trimmed, nonempty query literally and case-sensitively against a parsed symbol's
  simple name, qualified name or Java class name. No regex, fuzzy relevance, language model,
  confidence score, runtime/binding inference or automatic investigation scope. Limit the
  UTF-8 query to 200 bytes. Known unsupported syntax and absent inventory are explicit gaps;
  no exact match does not establish absence from the system.
- Choose the newest published, current-parser inventory for the requested authorized
  source index, not simply the most recently analyzed index. A newer in-progress repeat
  may coexist with a valid published inventory of the same pinned source. If no compatible
  inventory exists, return an unavailable diagnostic without breaking original text search.
- Scan at most the existing 10,000 file-unit manifest, 16 MiB retained payload and 50 MiB
  original-text bounds. Revalidate complete original support through the durable service;
  never trust raw cached names as citation authority. Yield between files, check a five-
  second active wall budget between units and recheck source/policy/run identity before
  returning. Corrupt or revoked/fenced facts fail visibly instead of becoming a no-match
  response. No reparse, Git command or source execution is introduced by lookup.
- Return at most twenty symbol matches and 256 KiB output, selecting sources in saved
  source order with one match per source per round, then path/symbol source order. Keep
  at most twenty matches per source while scanning and report total observed matches,
  scanned/retained file counts, output omissions, time stops and inventory syntax gaps.
  Original references must overlap each symbol's validated line range. Results retain
  source/revision/file identity, parser/run provenance and unverified syntax status.
- Avoid computing full aggregate index coverage for each file authorization: expose the
  catalog's existing published/current-policy header validation for internal service use,
  preserving the same checks and keeping full readBuild summaries unchanged.
- Expose a protected read endpoint and add supplemental supported-symbol results to the
  existing Explore the sources search. Original passage results remain available when
  symbol lookup is unavailable or fails. Use escaped labels and original evidence buttons;
  distinguish symbol matches from text matches. Do not persist questions or replace
  candidate ranking/answer context. Editing a query, index/source/policy changes, result
  replacement and late evidence must fence old results.

## Acceptance

Use owned small fixtures to cover exact/simple/qualified/class matching, literal injection
strings, duplicate names across sources, source-balanced result limits, output/time limits,
zero/unsupported/unavailable cases, corrupted originals/checkpoints, foreign mappings,
revocation/policy/eviction during an awaited scan, parser changes and historical index
selection. A 121-file shape must resolve an exact supported symbol outside the unchanged
100-document graph sample. These are mechanical checks, not blind semantic acceptance.

Verify protected HTTP input/ownership behavior and browser search/original/late-response
flows without adding a second search input. Run relevant checks, strict types, full tests
and sequential owned-browser acceptance. Preserve all historical reports and failed gates.
After both exact-head CI events pass, merge and continue the planned sequence; a broader
semantic retrieval or Workbench bridge change requires its own contract.
