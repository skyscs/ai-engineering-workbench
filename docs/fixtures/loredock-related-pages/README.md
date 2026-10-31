# Bounded related-repository pages

Task 043, 2026-11-01. Scope was committed in `f3735ed` before implementation, following
merged PR #46 (`b9cc358`). The rejected kind-priority policy remains offline.

The candidate preview now returns explicit four-source pages in saved source order,
with at most two original-evidence links per source. The related projection is v2;
lexical v1, the first-page selection, broad answer context, graph identities, saved
histories and database schema are unchanged. The existing 128 KiB preview cap applies
to every page. See [ADR 0039](../../decisions/0039-loredock-related-source-pages.md).

The interface displays the total eligible count, current range and Previous/Next controls.
It preserves the current view during loading, keeps new cards collapsed and clears the
evidence viewer on both request and publication. Context-hash and request-generation
checks prevent combining pages across question/build/source/policy/review changes.

## Verification

- `pnpm check`: strict types, all **364 tests** and production builds pass. Focused tests
  cover nineteen eligible identities across all five pages, duplicate display names,
  exact default selection, invalid/non-integer/out-of-range offsets, foreign evidence
  even outside the requested page, original ownership, output limits and policy fences.
- A later page preserves primary suggestions, Other matches and the original context hash;
  its preview hash changes. No source is repeated or skipped. The old Task 042 qualifier
  explicitly refuses changed selector hashes; its frozen examples remain executable.
- [Candidate diagnostic](candidate-result.json): both small fresh generations reproduce
  Task 039's default first-page originals and lexical hashes exactly after symmetric
  declaration-side normalization. Critical recall remains 22/22; five cases meet both
  scope conditions and counts remain `[7,6,1,2,2,4,7,7,1,8]`. These default-page metrics
  do not count every source available through explicit paging as an automatic suggestion.
- [Browser acceptance](browser-result.json): next/back navigation, a later-page original
  opened with the keyboard, collapsed cards, 390 px layout, original clearing, held page
  and evidence responses, changed-context rejection and a held page after source revocation
  all pass. Existing escaped labels, review/history/policy fences and Dojo route evidence
  remain covered. The later-page mobile screenshot was visually inspected without overflow.

Only owned synthetic sources and databases were used; no model was requested. No new
full-volume benchmark or semantic score replaced earlier measurements.

After `pnpm build`, run `node scripts/loredock-candidate-links-evaluation.mjs` for the
model-free default-page diagnostic. Run `node scripts/loredock-candidate-smoke.mjs` for
the explicit Linux browser check; it owns its fixture, daemon/browser processes and port
4244. `LOREDOCK_SMOKE_OUTPUT` selects a result directory. Historical reports stay intact.

Next: measure complete file-by-file code-fact extraction on the frozen synthetic volume
with the existing bounded parsers. Record cost, coverage, unsupported syntax and exact
original provenance before designing persistent analysis. Keep interactive graph limits,
current schemas and model gates unchanged during that feasibility step.
