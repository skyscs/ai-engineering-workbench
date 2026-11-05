# Task 134 — Attribute browser process-tree memory

Status: scoped after Task 133; begin after both exact-head CI events and identical-tree merge.

## Evidence and objective

The first ordinary Task 133 browser passes Ready/saved header-gap display checks but
its passive process-tree sample reaches 1,403,904,000 bytes, exceeding the unchanged
1,073,741,824-byte RSS ceiling. Earlier ordinary observations also exceeded that bound.
Useful UI behavior does not resolve this resource failure.

Attribute the excess before choosing a fix. Distinguish the browser process baseline,
page/application work and observation overhead. Do not infer retained JavaScript heap
or an application leak from aggregate process RSS alone.

## Sequence

1. Review only retained ordinary Task 133 browser samples, lifetime records, events,
   response bytes and executable identity. Verify hashes before reading; preserve all
   original files. Reconstruct the exact maximum and contributing process identities,
   sample completeness and timing relative to navigation/preparation/history. State
   where missing process roles or lifecycle samples prevent causal attribution.
2. Before fresh execution, declare a small fixed set of ordinary controls: blank browser,
   built UI with no prepared input, and useful Ready plus saved context. Use independent
   copies of stopped synthetic catalogs. Record exact binary, flags, built assets,
   sources and application bytes. Preserve first outputs and failures without retries.
3. Keep the existing raw summed RSS definition, cadence, process ownership and limits.
   Optional role/PSS/heap observations are explicitly diagnostic and cannot replace the
   failed gate. Do not subtract shared pages or instrumentation, tune Chrome flags,
   weaken isolation, warm a candidate or exclude startup/descendants to manufacture a pass.
4. Choose the next smallest change only if supported by those observations. A browser
   baseline above the ceiling is a documented constraint, not evidence of a product leak.
   If a safe product fix is not demonstrated, retain the result and scope the specific
   remaining decision; do not claim resource qualification or change the contract.
5. Retain complete stopped copies, sources, process lifetimes, samples, browser/API
   outputs, first failures and input identities. Run relevant checks; inspect both
   complete exact-head CI logs before merging.

## Boundaries

No corporate code, real model call, default activation, schema or model-policy change.
Use the existing controlled runtime only if a new saved answer is essential; prefer
copied retained ordinary history. The consumed Task 127/128 family, frozen driver,
manifest, source seal and first failed qualification remain untouched and unreplayed.
Startup and near-limit daemon heap are separate failures. Complete repaired qualification
still requires a new prospective family, not these diagnostic controls.
