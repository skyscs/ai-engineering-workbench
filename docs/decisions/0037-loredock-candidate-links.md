# ADR 0037 — Evidence-anchored context beside source suggestions

Status: accepted for a bounded model-free reading aid. Automatic routing is not accepted.

## Context

Task 036's lexical shortlist is useful to read but omits four critical repository
occurrences on the observed ten-case incident set. Existing code and declaration maps
contain additional original-evidence relationships, with explicit syntax and scope limits.

## Decision

Keep lexical selection v1 and the broader answer context unchanged. Add a separate
`source-candidate-links-v1` projection to the protected candidate preview. Only primary
suggestions seed one-hop HTTP/event or contract/setting comparisons. A seed endpoint
must own an original context passage containing a distinctive question term. Auxiliary
edge evidence cannot establish that anchor. Preserve both endpoint supports and every
additional original reference, verified against the same authorized catalog/build.

Return at most four additional sources in saved order and two relationships per source,
with eligible/omitted counts and full underlying coverage. Sort by frozen kind and
canonical original locators. Symmetric declaration comparisons sort independently of
their stored left/right order; keep their original sides in the response. Code edge
direction stays significant. The UI uses a comparison symbol for declarations.

The preview hash includes both projection hashes/versions, selected evidence locators
and overlap-selected human notes. Additional support remains outside the unchanged
answer input. The source, policy, question, index and review fences apply to the entire
preview and pending evidence. No persistence, runtime invocation or source execution.

The default UI keeps **Related repositories to inspect** collapsed. It retains reasons,
scope, differences, gaps and evidence controls on both sides. These are optional reading
clues, not confirmed live connections, changes to the primary ranking or edit targets.

## Consequences

The fixed diagnostic recovers 21/22 critical occurrences versus 18/22 primary-only,
but increases union sizes to 1–8. Only five cases meet their useful size bound and four
meet both necessary conditions, versus ten and six for primary-only. Configuration
comparisons can add incidental sources because a whole passage contains the question
term. The ir06 inventory-api miss remains. Do not treat recall gain as routing acceptance.

Both fresh generations select identical source/link support after normalizing symmetric
declaration sides. Five cases change raw left/right representation; the report retains
both generations and this distinction. All Task 035 context and Task 036 lexical
selections remain unchanged. No old evaluation or model output is rewritten.

Next: qualify more precise relationship anchoring on newly frozen adversarial source
examples before replacing the frozen v1 rule. Keep old diagnostic failures visible.
