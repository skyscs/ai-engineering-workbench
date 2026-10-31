# Task 036 — Model-free source candidate preview

Status: planned. Follows Task 035's broad-context baseline.

## Scope

Add a separate **Where should I look?** preview to the model-free LoreDock UI. A user
describes a problem or names a symbol and receives a small set of source suggestions,
their original evidence and visible uncertainty. This is a reading/investigation aid,
not a root-cause answer, an implementation target or automatic Workbench routing.

The existing answer retrieval, prompt, source caps, immutable histories and failed
evaluations remain unchanged. Use the already bounded production context as input;
never send a model request or inspect unregistered source content.

## Ranking contract (freeze before implementation/evaluation)

1. Use the existing question terms and original selected span text/path, normalized
   with the existing search normalization. Source display names and reviewer expectations
   are not ranking evidence. Keep original IDs, ownership, bytes and ranges intact.
2. Count each term once per represented source. A distinctive term has at least three
   characters and occurs in no more than half the represented sources, rounded up
   (minimum one). This is bounded-context lexical distinctiveness, not semantic relevance.
3. Give each distinctive term weight `log(1 + N / (1 + df))`, where N is the number
   of represented sources and df their observed term frequency. Sum distinct matched
   term weights per source; repeated mentions or many files do not multiply a term.
4. Suggest sources scoring at least 60% of the strongest eligible score, at most six.
   Break exact ties by saved source order. Show all remaining matched candidates and
   omissions separately, including ties crossing the cap. Do not convert scores to
   probabilities or claim omitted sources are irrelevant.
5. Retain at most three strongest original supporting passages per candidate with
   their matched terms and exact evidence locators. Nonempty lexical suggestions still
   require review. With no distinctive match, explicitly request a more specific clue;
   an orientation fallback alone must not silently select repositories.
6. Keep snapshot versions, source coverage, omissions, missing deployment knowledge
   and engineer notes separate from ranking evidence. No declaration, lexical match or
   engineer assertion becomes a confirmed runtime/causal relationship.

## Acceptance

- Commit fresh adversarial source/context cases before implementing this policy:
  distinct symbols, shared producer/consumer/contract names, common-only and zero-hit
  questions, duplicate display names, cap-crossing ties, source-name-only matches and
  negative mentions. Preserve failures; do not tune policy to Task 035 case bounds.
- Add a bounded authenticated preview endpoint available without answer mode. It accepts
  only a question and optional saved build ID. Apply existing source/policy authorization;
  stale/historical scope remains explicit. No database migration or saved scope mutation.
- Show the preview near the top of the workspace with one input. Explain suggestions
  through original evidence, keep omitted candidates inspectable and do not present a
  lexical score as confidence. Escape source labels/text and support keyboard/mobile use.
- Fence late responses and evidence after input, selected index, source, policy and
  relevant review changes. A removed source must not survive through a cached preview.
- Verify generic selection properties, original ownership, API authorization/invalid
  input, partial/stale/revoked scope and deterministic fresh-identity behavior. Run the
  unchanged Task 035 diagnostic without rewriting its retained baseline or answer context.
- Full checks and a sequential owned-fixture browser smoke must pass. Record candidate
  and remaining abstention limitations honestly, review the diff and merge after both
  exact-head CI runs pass, then continue the owner's authorized sequence.

Synthetic-only scope remains selected. No corporate inputs, new model calls, automatic
investigation, code-edit permission or L5/bridge acceptance follow from this preview.
