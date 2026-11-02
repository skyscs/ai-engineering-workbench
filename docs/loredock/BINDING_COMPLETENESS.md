# Completeness for supported binding searches

Status: design only, 2026-11-02. [Task 066](../../tasks/066-loredock-binding-completeness.md),
scope `dc4d625`, follows the failed [Task 065 qualification](../fixtures/loredock-connected-scale/README.md).
This contract changes neither parsers nor application/prototype behavior. A fresh offline
qualification must precede the backend phase of the [integration plan](CONNECTED_PATH_INTEGRATION.md).

## Problem and decision

Task 065 scans all 9,975 retained code files within its prospective resource limits, but
unrelated TypeScript profile gaps suppress useful imports and Java bindings. An unrelated
constant-only file does not become a supported function target merely because it shares a
repository. Conversely, a retained unique target is not safe when another relevant target
may be excluded, truncated or outside the saved index.

Replace one source-wide boolean with completeness of the **specific supported candidate
domain**. Preserve all existing matching predicates and every competing retained candidate.
Narrow where uncertainty applies; do not remove parser gaps, infer arbitrary unsupported
syntax is harmless, or promote a candidate to observed runtime behavior. Original spans
remain the only citation authority. This is not new module/compiler resolution.

## What the saved data proves today

| Saved boundary | Actual implementation | Consequence |
| --- | --- | --- |
| [Git inventory](../../apps/loredock/src/git.ts) | Reads the complete bounded `ls-tree -r -l` output, including symlinks/gitlinks; invalid/unavailable output fails the source. | Successful enumeration is separate from admitted paths and analyzed text. No new Git read is needed to inspect saved metadata. |
| [Catalog admission](../../apps/loredock/src/catalog.ts), [stored sources/files](../../apps/loredock/src/store.ts) | `files` contains admitted tree entries only. `build_sources.omitted` counts entries beyond path shares; failed sources can coexist with a published partial build. | `omitted > 0` or non-ready source status means unknown path coverage. Parsed unit counts cannot establish complete source enumeration. |
| [Index exclusion](../../apps/loredock/src/extract.ts) | Admitted paths remain recorded even when policy, size, mode, binary/text or read limits exclude their content. | A known excluded target is different from an absent path. Symlinks and gitlinks can hide descendant paths. |
| [CodeAnalysis](../../apps/loredock/src/code-analysis.ts) | Its manifest selects indexed `.ts`, `.js`, `.vue`, `.java` paths. Nonparsed units and per-file gaps are retained; original/fact integrity and authorization are validated. | Join the complete saved file metadata with the unit manifest. A missing unit for an eligible indexed file is an inconsistency, not a successful negative lookup. |
| [TypeScript facts](../../apps/loredock/src/code-typescript.ts) | No supported function symbols produces `unsupported-typescript-profile`; other gaps include truncation, unsupported bodies and unresolved headers. | Keep every gap. The successor does not distinguish harmless gap categories inside a relevant target file. |
| [Parser dispatch](../../apps/loredock/src/code-analysis.ts) | Candidate-extension selection is case-insensitive, but Java dispatch uses exact `.java`. | Do not silently reinterpret uppercase/mixed-case suffixes as validated Java. Treat an uncertain language profile conservatively. |

There is an additional gap in the offline candidates: grouped index-excluded **code** files
do not account for paths never admitted into `files`. A fully read code manifest can still
miss an alternative hidden by source path shares. The successor must explicitly qualify
that condition; successful Task 063 checks did not cover it.

## Bounded coverage proof

Before resolving bindings, authorize the selected build and one compatible published code
inventory. Read at most twenty source headers and 10,000 saved file entries in bounded pages,
including non-code/excluded entries. Reject excess rows, duplicate source/path identities,
invalid metadata and impossible file/ancestor collisions. Do not load raw code in this pass.
Keep indexed-original validation through the existing CodeAnalysis reader unchanged.

For a source with `status=ready`, no omitted paths and valid revision/tree metadata, verify
the saved file list against its recorded Git tree ID before treating absent paths as known.
Reconstruct canonical tree objects from saved paths, modes and object IDs: recursive directory
objects, Git's byte ordering (including the directory terminator), canonical mode spelling
and the SHA-1/SHA-256 object header/hash selected by the recorded object IDs. Verify the root
digest against `build_sources.tree`. Do not call Git or read a working tree to repair a
mismatch. A mismatch fails the whole projection as integrity failure; it is not a removable
syntax gap. This proof verifies correspondence with the trusted recorded tree identity, not
remote authenticity or provenance of that identity itself.

This prevents a deleted excluded row from masquerading as an absent target merely because
the code manifest still validates. Add independent known Git tree vectors, non-ASCII names,
directory/file sort neighbors, executable modes, empty trees and deliberate metadata removal
to the prospective test contract, including names such as `__proto__` and `constructor`.
Treat path segments as data, never object-prototype lookups. Test construction may use Git;
projection proof may not.

When a source has omitted entries or failed enumeration, record unknown path coverage and
block positive uniqueness for its dependent domains. Do not attempt a partial-tree digest
match or infer an omitted entry's language from admitted entries. Retained original syntax
can still be displayed with explicit uncertainty. Unsafe paths or opaque tree boundaries
remain conservative blockers as described below, even when their Git bytes can be verified.

Join every eligible indexed code file to exactly one manifest unit; validate no extra or
foreign units, missing identities or impossible statuses. An existing nonparsed unit remains
known incomplete. An evicted/unpublished/incompatible inventory is unavailable; an indexed
file mysteriously missing from a published manifest is integrity failure. Record separate
counts for known paths, complete/unknown path coverage, analyzed files and syntax gaps.

For the next experiment, freeze an 8 MiB canonical metadata budget in addition to the existing
entry/source bounds. Check aggregate metadata size before materializing it; account for
paths, object IDs, status/mode and identity fields using a specified canonical UTF-8 encoding.
Count tree/index work in the existing one-million-unit budget and yield through construction.
An excess fails explicitly. Include source metadata and its verified tree/coverage digest
in generation identity and recheck it, manifest identity and policy/registry after yields
and before publication. No new persistent table or parser fingerprint is needed for this
read-only interpretation; use a new resolver/completeness version.

## Candidate domains

### Supported relative named imports

Retain current literal `./` and `../` normalization within the source, case-sensitive matching,
and the four supported suffix alternatives: `stem.ts`, `stem.js`, `stem/index.ts`,
`stem/index.js`; an explicit `.ts` or `.js` suffix selects that exact path. Reject escaping,
unsafe or unsupported module forms as unresolved. Do not add tsconfig aliases, packages,
barrel/re-export discovery, `.mts`/`.cts`, filesystem case folding or symlink following.

The domain comprises those exact candidate paths in the importing source. A source with
unknown path coverage blocks the domain. A gitlink/symlink/unsupported-mode entry at a
candidate path or one of its ancestors also blocks it: descendants were not enumerated.
An unsafe path whose relationship cannot be established conservatively blocks the source.

With verified path coverage, a candidate path absent from the saved tree has no supported
file candidate in that committed source. A present candidate must have indexed originals,
a parsed compatible unit and **no parser gaps**. Any excluded, failed, unattempted, omitted,
truncated or otherwise gapped candidate blocks positive uniqueness, even if its retained
prefix has no matching symbol. Do not select one available suffix while ignoring another.
Unrelated paths retain their coverage warnings but do not invalidate this domain.

Gather every exported non-AMD symbol with the exact imported name across all candidate
files, preserving distinct symbol/file identities. Issue a static call only for one target
in a complete domain. Zero targets means unresolved; multiple targets mean ambiguous.
Known multiple targets remain ambiguous **and** carry an incomplete flag if unseen targets
may also exist. Completeness and cardinality are separate diagnostics. A literal source call
remains syntax evidence; incomplete analysis of the caller limits the outline, not the
completeness of unrelated target files. Shadowed/unresolved calls absent from saved facts are
not recreated by the resolver.

### Java handler and consumer candidates

For same-source handler lookup, the domain is all potential Java files in that source;
class/package-to-filename guesses cannot narrow it. Keep exact qualified-name precedence
and the existing simple class/method fallback. Do not use a unique simple-name match if a
missing Java file could contain another exact or fallback candidate.

For subscription/consumer lookup, the domain is all potential Java files in the subscriber's
source. Preserve the exact class, one matching parameter type, supported record signature
and matching document-write requirements. Do not infer a consumer from a filename or a
single visible class. Keep publisher, topic, contract, environment, HTTP/header comparison
rules and candidate/runtime qualifications unchanged.

Any unparsed/excluded/gapped relevant Java file blocks positive uniqueness. Case-insensitive
Java-looking suffixes with uncertain parser dispatch also block it. Unknown source path
coverage, unsafe entries or opaque gitlink/symlink boundaries block Java-domain completeness;
their possible descendants cannot be dismissed by the visible entry's suffix. A TypeScript,
JavaScript or Vue gap elsewhere remains visible but does not invalidate a fully verified
Java domain. This distinction follows the supported parser roles, not a claim that build
systems never generate Java from another language. Generated/external/runtime code remains
outside the profile and must stay explicitly unknown.

## Diagnostics, display and failure behavior

Each binding diagnostic records domain kind, completeness, retained candidate count,
candidate identities and bounded blocker reason counts. Store no inferred source truth.
Keep all alternatives internally within existing reference caps; overflow fails before
positive uniqueness. The bounded display envelope carries aggregate coverage and the reasons
needed to explain an unresolved hop, not every irrelevant path or raw fact payload.

Differentiate incomplete domains from ordinary zero/multiple matches. A gap elsewhere in the
system is still shown in coverage. No empty result establishes absence outside the supported
profile. Continue atomic path admission and existing root/branch/depth/work limits. Narrower
completeness may restore incoming calls and therefore change root counts, selected branches
and omission totals; qualify those consequences rather than assuming only edge count changes.

Authorization, source/policy changes, inventory eviction, metadata/source/fact corruption,
cancellation and incomplete resource scans still discard pending graph data. Metadata proof
is not a license to reuse stale facts or weaken original validation. Existing answer,
candidate, correction and saved-history consumers remain on their current adapter.

## Next prospective qualification

Freeze independently authored inputs, canonical metadata sizing/tree vectors, precise
expected nodes/edges/roots, stage metrics and one-run protocol before implementing the
successor. Do not rewrite or rerun Task 065's oracle. The fresh matrix must include:

| Family | Positive case | Required counterexample |
| --- | --- | --- |
| Import paths | Constants/gaps outside all four target paths leave the known supported call available. | A second suffix target is excluded, unattempted, truncated or has unsupported exports; no false unique call. |
| Import alternatives | One complete matching target plus verified absent suffixes. | Multiple same-name targets, isolated missing target, source path-share overflow, failed enumeration and opaque ancestor entry. |
| Java domains | Unrelated TS/JS/Vue gaps coexist with complete supported handler/consumer facts. | An unrelated-looking Java file is missing/truncated, a duplicate handler/consumer appears late, or suffix/parser dispatch is uncertain. |
| Tree proof | Independent exact SHA-1/SHA-256 tree vectors, nested paths, file/directory sort neighbors and executable files. | Remove or change an excluded file row, alter object/mode/path/tree identity, duplicate a path or collide with an ancestor; fail before claiming absence. |
| Root/branch behavior | More than four roots, later isolated root, useful wide branches and a supported cycle. | Explicit root/page identities from a different generation, traversal/pending bounds and relevant target uncertainty; retain exact omissions and simple paths. |
| Resource limits | Twenty-source mixed-language/profile inputs through 10,000 admitted paths, with useful complete paths and two default writes. | Metadata bytes, fact/reference/work/time/display bounds; no positive uniqueness from a truncated domain. |
| Lifecycle | Stable repeated/historical reads and restart from retained facts. | Cancellation, source addition/removal, policy changes, inventory eviction and original/derivative/metadata corruption at read/resolve/admission yields. |

Reuse the prospective 5,000 ms projection, 100 ms timer-delay, 256 MiB RSS-increase, 1 GiB
sampled RSS and 128 MiB heap-increase targets on the newly frozen large-input family. Include
tree-proof cost in the measured read stage. Keep the existing cooperative/memory-sampling
limitations explicit. Zero projection Git/store writes and exact original reopening remain
required. Passing performance while losing useful paths is a failed gate, as Task 065 shows.

A successful fresh qualification permits the separately scoped typed backend phase. A failed
one remains retained and requires its own diagnosis/prospective successor. No UI, graph
consumer switch, model retry or private-pilot acceptance is implied by this design.
