# Prepared-flow final execution work note

This note starts the final Task 128 execution-boundary work after the ordinary
[matrix](../fixtures/loredock-prepared-flow-matrix-integration/README.md) and its
[supplemental bindings](../fixtures/loredock-prepared-flow-matrix-closure/README.md).
It is not an executable seal or a qualification result. The reserved family has no
candidate reads. The frozen [contract](PREPARED_FLOW_QUALIFICATION.md), inputs, oracle,
limits and application bytes remain authoritative and unchanged.

## Adapter corrections before sealing

The current ordinary assembly must not be pointed directly at the reserved family.
Source review identified these concrete adapter gaps; resolve them on ordinary inputs
before committing the final entry:

1. Cold/warm source assessment currently passes `corpus`, `sources` and `expected`, but
   omits the supplied `references`. The ordinary twelve-file control has no required
   reference list, so it did not expose this omission. The frozen S01 does require
   original references. Pass the exact reference map through the cold/warm/diagnostic
   assessment and verify a required-original ordinary control.
2. The frozen S07/S09 `setup` values are prose instructions. Existing `oracleCase` accepts
   only `catalog-only` and `engineer-note` dispatch tags. Map those exact frozen case IDs
   to the existing implementations in the execution adapter; retain the original setup
   text and oracle hashes. Do not rewrite or relax the frozen oracle.
3. `createHistory` writes its complete failed result and then throws an assertion, even
   for an underlying typed `INCOMPLETE_CODE_ANALYSIS`. The assembly currently recognizes
   that typed prerequisite only when a helper returns. Define the failure handoff before
   execution, using the retained original error and normal teardown. Never classify an
   arbitrary assertion as a safe prerequisite failure.
4. If analysis prevents fresh history setup, its catalog has zero admissions, not the
   successful 64-row expectation. A prospective stopped-catalog check may use zero only
   for explicitly declared fresh catalogs after the exact known setup failure. It must
   prove no admissions/runtime calls occurred and must never alter expectations for an
   existing checkpoint, resumed history or unexplained nonempty catalog.
5. An oracle whose required analysis fails has no preparation. Record that unavailable
   substep explicitly alongside the failed prerequisite, instead of applying the
   successful `preparations === 1` assertion and losing the original failure category.
   Unknown errors, mismatched provenance or teardown failures still stop later cases.

These changes affect the evaluation adapter only. They cannot make a partial analysis
pass, manufacture a native path, shrink the near-limit corpus, seed history rows or
repair the application inside Task 128. Preserve every earlier first result and use
separate ordinary development observations for adapter checks.

## One final entry and consumption boundary

Reuse the existing ordered coordinator, case helpers and owner. Separate ordinary and
reserved entry points explicitly; the ordinary family guard must remain intact. The
reserved entry must accept only the exact committed execution manifest and expected
family, refuse a preexisting or partial consumption claim, and fsync its started record
before materialization or any candidate source read. Declare all catalog roots, every
functional handoff and permitted continuation before launch.

Bind the original oracle, all source vectors, S01 question/reference set, the exact
unverified engineer note and `t-boundary-notes` revocation source. R01 uses twenty sources
and 240 files; R02 uses twenty sources and 10,000 files. The ordinary twelve-file control
cannot stand in for either input. Source-only Catalog construction belongs exclusively
to S07; other cases retain their completed compatible-analysis prerequisite.

Each required measurement must produce its raw evidence and assessment or an explicit
failed/incomplete/not-run result. The contract expressly allows an incomplete gate when
complete accounting cannot be measured. Unmatched transient witness bytes, unavailable
private-boundary proof and missing operation work must therefore stay visible and keep
eligibility closed. They do not authorize new method wrappers, inferred zero work or
an endlessly expanded diagnostic suite. A recorded incomplete gate is not acceptance.

## Executable and environment closure

The final manifest must bind, without candidate execution:

- Final entry, coordinator, all case/assessment helpers, owner and passive monitors;
  exact command arguments, fixed output location, claim location and declared roots.
- All accepted application/workspace source and emitted import bytes, the actual
  production and controlled bootstrap, browser assets, complete runtime package entries,
  lockfile and installation identity. Use the real ESM server entry when resolving Hono.
- Node executable/version/V8, Python executable/version and owner dependencies, actual
  Chrome executable/support files, Git executable, OS/CPU/memory and canonical paths.
- An explicit environment allowlist and process ownership/cleanup settings. Never copy
  authentication files, tokens, secret-bearing user configuration or corporate code.
- Original application/input seal hashes, oracle/reference hashes and a retained audit
  that this reserved family has not previously been claimed or observed by a candidate.

Validate the manifest against the actual accepted bootstrap and its full imports, not
only imports exercised by a convenient helper. Commit it before any reserved run. The
existing `seal.mjs` remains verification-only; never regenerate its frozen data.

## Completion and next task

Execute the declared order once under the external owner. Retain the stopped catalogs,
synthetic Git trees, original response bytes, measurements, usage and screenshots even
on setup or gate failure. Verify retained copies independently and publish a case-by-case
decision without rewriting the first journal. Both final-head CI events must pass before
merging the result; functional test success does not override a failed resource gate.

If any mandatory result fails or remains incomplete/not-run, close semantic eligibility,
mark the prospective family consumed and scope the smallest ordinary diagnosis/fix as
the next task. Any repaired qualification needs a new prospective family. Task 128 does
not change the parser/schema, raise limits, activate defaults or run real models.
