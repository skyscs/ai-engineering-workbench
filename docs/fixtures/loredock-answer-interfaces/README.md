# Answer interface context evidence

Task 032 connects bounded static HTTP comparisons to answer preview, immutable input
and prompt v9. Retrieval v7, answer schema v3, database schema v7 and historical answers
remain unchanged. This is model-free implementation qualification, not semantic scoring.

## Checks and retained results

- `browser-result.json`: twenty synthetic sources plus two independent files; all three
  comparison states, preview/issued-prompt identity, original caller/route keyboard
  citations, escaped text, 390-pixel layout, saved context after reload, history after
  refresh, legacy optional-field absence, historical selection and late-response/source/
  policy fences. Two **fake** runtime calls; zero external model requests.
- `answer-browser-result.json`: the existing answer regression, including review notes,
  output/citation rendering, failure, cancellation, refresh, history and fencing. It also
  uses a fake runtime; the reported call count is not real model usage.
- `retrieval-regression.json`: current mechanical recall compared with Task 029 originals.
  All 24 prospective and 20 expanded selection fingerprints are unchanged; the original
  three-source pilot retains the same retrieved reference sets for all 20 questions.
  Full reference recall remains 24/24, 20/20 and 20/20. The recorded baseline paths and
  hashes make the comparison explicit. Regeneration checks also remain stable.

Before implementation, the new dispatch/site example retrieved both originals but failed
the assertion requiring a comparison in the issued prompt. The finished tests cover
one-sided/empty support, matching/missing/dynamic headers, count/UTF-8 limits, complete
prompt fitting without source/review loss, rehashed provenance/ownership tampering,
invalid derived citation IDs, restart/replay and source revocation. An oversized base
context is rejected before runtime preparation. Legacy inputs keep their original bytes.

`pnpm check` passes 334 tests, strict typechecks and builds on Node 22.23.2. A final focused
test also verifies publication validation after prompt-budget trimming. The obsolete v8
evaluation protocol is rejected by unmodified v9 production services before preparation;
historical answer audits still pass. No new semantic review or score is inferred.

## Reproduction

After `pnpm check`, run the following with Node 22.13+ and local Chrome. Browser scripts
own port 4244 and must run sequentially with any existing LoreDock instance stopped.
All sources are generated temporary fixtures; user repositories are not used.

```sh
LOREDOCK_SMOKE_OUTPUT=/tmp/loredock-interface-browser node scripts/loredock-answer-interfaces-smoke.mjs
LOREDOCK_SMOKE_OUTPUT=/tmp/loredock-answer-browser node scripts/loredock-answer-smoke.mjs
node scripts/loredock-completeness.mjs > /tmp/loredock-prospective-retrieval.json
node scripts/loredock-scale-retrieval.mjs > /tmp/loredock-scale-retrieval.json
node scripts/loredock-retrieval-evaluation.mjs > /tmp/loredock-pilot-retrieval.json
```

Compare `selectedLocatorHash` by question ID against the retained Task 029 prospective/
expanded reports; compare `retrievedEvidence` for the pilot. These checks measure source
availability and selection only. Model output can still invent a connection despite
the derived clue. A new prospective semantic evaluation and independent review remain
necessary. See [ADR 0035](../../decisions/0035-loredock-answer-interface-context.md).
