# Task 017 — Source-backed declaration map (L3, first slice)

Status: accepted through the owner's merge of PR #21 (`a551f3c`), 2026-10-30.
The owner merged PR #20 and confirmed the preceding
review complete before requesting continuation. Task 016 is owner-accepted; its agent
assessment and historical failures remain unchanged rather than becoming a new human score.

## Objective

Open an indexed project's system map and see declared HTTP routes, handler references,
event contracts, configuration values and package identities, with original evidence.
Keep repository identities distinct from services and equal declarations distinct from
verified runtime connections. This is the first bounded L3 delivery, not full L3 acceptance.

## Implementation boundary

- Derive a bounded read-only projection from one authorized immutable index. Reuse
  original issued spans, policy/revocation fencing and local protected transport.
- Parse supported JSON declaration shapes and existing direct Maven/package metadata.
  No source execution, language-wide call graph, external connectors or new AI calls.
- Scope identities by build, source, file and declaration position. Equal text/names
  across repositories cannot merge entities. A handler string is a reference until
  code proves its implementation.
- Show matching contract shapes and matching scoped configuration values as candidate
  comparisons. Different declarations are reviewable differences, not proof of runtime
  incompatibility. Explicitly different environments must not become a false conflict.
- Surface incomplete adapter coverage, omitted documents/values and resource limits.
  Preserve unsupported material in the existing text/evidence catalog.
- Add a simple map view with source links and current/historical index selection.
  Late UI responses cannot reintroduce revoked or old-policy content.

## Acceptance

- The frozen three-repository fixture exposes both API routes, one handler reference,
  two separate contract declarations, package identities and scoped configuration.
  The contract and local-topic matches are candidate clues with both source citations.
- Original bytes/line locators resolve; aliases/names never become service/deployment
  identity proof. Same-name different contracts remain separate and visibly different.
- Tests cover environment separation, empty/unsupported input, deterministic restart,
  bounds, invalid declarations, corrupted evidence, revocation, policy and historical scope.
- Browser review opens a map citation, displays candidate links and respects removal,
  policy changes, historical selection and 390px layout. Existing checks remain green.
- Record zero model calls and unchanged source checkouts. No database migration is
  needed for this read projection.

## Follow-up within L3

Code-to-declaration adapters and two partial evidenced outlines follow in
[Task 018](018-loredock-static-flows.md). Durable human claim/scope corrections and
broader runtime/framework ownership remain separately scoped work.
Do not advertise a complete system graph, automatic routing or a Workbench bridge here.
