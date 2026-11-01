# Prospective clarification of newly generated support identities

Recorded before the fixed twenty-source measurement, 2026-11-01. The three-source
rehearsal completed all five stages but its initial comparator reported 173/182 equality.
All nine differences were the order of two `interfaces.comparisons[].evidenceIds` entries
in the independently generated third index. Production code sorts these unranked support
sets by randomly generated span UUID. The original owner/path/revision/range/hash support,
ranked query order, scores, snippets and original text were equal.

For the independently generated index only, replace source span UUIDs with their complete
generation/owner/path/revision/range/hash identities and sort each interface comparison's
support array. Preserve multiplicity: do not deduplicate or drop references. Continue to
compare literal hits, question hits, context spans and interface comparisons in their
original order. Omit only the newly generated build/context/derived-comparison IDs already
covered by the original semantic-identity contract. Existing two generations stay exact,
including their original support order and input hashes.

This clarifies semantic identity comparison, not the prototype, workload, query cases,
storage thresholds or supported production behavior. No twenty-source measurement has
been executed. The original DESIGN, cases and baseline remain unchanged; the initial
rehearsal failure summary is retained with the report. Tests must detect a changed snippet,
dropped support, missing lifecycle check and equal failures on both variants.
