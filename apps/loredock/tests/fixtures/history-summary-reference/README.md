# Accepted answer service before bounded history summaries

The source and emitted text files are exact copies from accepted merge `12b1392`
(PR #163). `verify.mjs` pins both hashes, independently recompiles the old source,
and permits only the new summary import, optional response marker and `state()`
list call. All full-content reads, admission, replay, cancellation and dispatch
remain byte-identical. The existing historical verification chain restores this
specific delta before checking its older immutable manifests.

The new summary implementation has separate behavioral regressions for authority,
review/build freshness, corruption, useful row parity and one aggregate budget.
Historical source equivalence does not claim that new summaries perform full
witness validation; their explicit contract is documented in
[ADR 0060](../../../../../docs/decisions/0060-loredock-answer-history-summaries.md).
