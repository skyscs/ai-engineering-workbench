# Compact payload development verification

Task 088 changes only the opt-in request-local entry representation. This directory
records independent regression work, never an exhausted or new resource family.
`validation.json` identifies exact raw log bytes and closed failure database copies;
gzip decompression reproduces each SHA-256 and byte count.

The first focused run passed exact capture/work/read parity, history, all three
negative-binding cases and cancellation/final-fence cases. The corruption/refusal
test failed because it expected an exception from every authorization change.
A second focused run with an explicit mutation label identified source registration
as the case. Both original logs and both closed databases remain retained.

Source review shows the `code_analysis_boundary` trigger unpublishes inventory on
registry change. The existing default selector therefore returns a structured
`INVENTORY_UNAVAILABLE` response before reading facts. The assertion was corrected
to require that same unavailable response from both readers and zero fact reads.
No implementation behavior, resource gate or frozen expectation was weakened.

The candidate is intentionally limited to preserving facts/ranges/evidence in a
smaller wrapper after full validation. Structural checks prove those fields and
preserved gap entries; exact byte/counter comparisons establish tested equivalence.
They do not establish lower heap growth, RSS, or qualification. Task 087's four
failed operation resource gates and all prior outcomes remain unchanged.

The full pinned `pnpm check` passes all **545 tests**, strict typechecks and builds,
including the seven new tests/subtests after the assertion correction. The built
opt-in services import successfully as StreamingCodeAnalysis plus the compact
CodePaths factory. The source comparison confirms only the comment, factory name
and entry construction differ from the old reader. All eleven dependency hashes,
retained archive hashes, changed-file whitespace and Markdown links were reviewed.
Both exact-head CI events remain required before merge.
