# ADR 0030 — Bounded retrieval across twenty sources

Status: implemented for Task 026, 2026-10-31. Extends ADRs 0020, 0028 and 0029.

## Evidence and decision

The independent twenty-source fixture exposed two limitations in retrieval v5:
19/20 questions had all required original evidence, and zero-hit orientation covered
only eighteen sources. The missing case named a repository but did not lexically match
its route declaration. Tied selections and fallback source order depended on random
source IDs. The [recorded baseline](../fixtures/loredock-scale-retrieval/baseline-v5.json)
contains two fresh catalogs with identical source revisions and different identities.

Retrieval `fts-question-v6` keeps the existing lexical query and one-hop identifier
expansion, with three bounded changes:

1. A complete normalized repository name in the question adds an orientation sample
   from matching recorded active sources. Match whole words/identifier blocks, case,
   underscore, hyphen and camel-case normalization; `inventory-api-extra` does not
   match `inventory-api`. Do not infer aliases or choose one source when names collide.
   This is a literal selection hint, not ownership, routing or relevance proof.
2. Consider at most six first spans per named source and twelve total, round-robin in
   saved source order. Root README candidates precede package/Maven manifests, then
   shortest file paths with lexical ties. Keep the six strongest lexical candidates
   first, followed by named samples, existing README reserve, expansion and remaining
   lexical candidates. Cross-source evidence remains eligible. Disclose sampling bounds
   even when all selected samples fit; report overflow when observed.
3. With no lexical matches, consider up to six metadata representatives per source
   across the existing 120-candidate budget. Select in rounds across saved source order
   before deeper representatives. All twenty sources can receive a baseline opportunity;
   oversized/missing documents and final budgets can still leave sources unrepresented.

Lexical ties also use saved source order, file path and line range instead of random
source IDs. This stabilizes source locators for the same ordered source input; it is
not a promise of identical selections after source order, content or the corpus changes.

## Bounds, integrity and presentation

Final context still admits at most thirty whole spans and 64 KiB of UTF-8 source text.
Candidate span byte metadata is checked before reopening full original files. Admitted
evidence still passes the existing file/span integrity and source/policy checks. No
truncation or generated source text is introduced. The complete prompt limit remains
96 KiB including metadata/instructions/review overhead, separately from source text.

Gaps list authorized indexed sources that supply no passage, explicitly without
claiming absence or irrelevance. Preview shows represented source count over the saved
authorized index scope. This count is not understanding or confidence. No passages means
empty retrieval even when lexical candidates existed but exceeded admission budgets.

Engineer-note selection, human/unverified provenance and global review invalidation
are unchanged. Prompt v7, cited-answer schema v3, database schema 7 and runtime privileges
are unchanged. Old attempt JSON/hashes stay untouched; new preview/start uses retrieval
v6 in its immutable input hash. Registration, policy changes, revocation and history keep
their existing fences. No automatic answer generation or model request is added.

## Verification and limits

[Evaluation and browser artifacts](../fixtures/loredock-scale-retrieval/README.md)
record 20/20 required-evidence recall for both the expanded and original pilot corpora.
Fresh-ID regeneration preserves all twenty expanded selections and the zero-hit sample;
the small corpus now supplies passages from all twenty sources. Maximum observed expanded
prompt size is 30,812 bytes. These measurements use synthetic committed sources only.

Tests also cover colliding names, identifier-prefix rejection, old names without aliases,
missing/oversized README documents, byte/candidate/sample bounds, refresh/history,
restart and revocation. Chrome verifies the twenty-source preview, original route evidence,
keyboard focus, mobile layout and scope removal; the existing fake-runtime answer/review
workflow also passes. No real model is called.

Required uncertainty is recorded as an evaluation rubric, not scored as correct behavior.
Exact evidence recall does not establish semantic relevance, supported prose, uncertainty
compliance, repository routing or L5 readiness. Next qualification must evaluate actual
answers and engineer disputes against the expanded scope through an explicitly selected
eligible connection; independent semantic review and private-pilot gates remain open.
