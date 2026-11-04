# Task 120 native question-context evidence

The sole sealed six-source library matrix passes **44/44** observations. The family is
**exhausted**. Read the [result and limitations](../../loredock/NATIVE_QUESTION_CONTEXT_RESULT.md),
[protocol](../../loredock/NATIVE_QUESTION_CONTEXT_RUN.md) and
[final executable freeze](../../../fixtures/loredock-native-question-context-run/final-freeze.json).
No production prompt/consumer, real model, corporate source or resource qualification is enabled.

- [Observed result](raw/observed-first/result.json.gz), [independent assessment](raw/observed-first/assessment.json.gz),
  [all raw observations](raw/observed-first/matrix-raw.json.gz) and [worker exit](raw/observed-first/worker-exit.json.gz).
- [First positive question](raw/observed-first/question.return-flow.json.gz) and
  [topic question](raw/observed-first/question.topic-entry.json.gz) retain independent lexical/public-default controls,
  complete measured preparation, exact receipts, compact items and prompts.
- [First development failure](raw/development-first/failure.json.gz) and
  [first ordinary-matrix assessment](raw/matrix-development-first/assessment.json.gz) remain unchanged.
- [Archive index](archive-index.json) binds all 383 compressed artifacts by raw/archive
  SHA-256 and byte counts: 15 command logs, 364 raw files and four stopped-source/catalog
  tar bundles containing 11,094 regular files. Every bundle member is individually hashed.
- [Stopped observed sources/catalogs](catalogs/observed-first.tar.gz) retain the complete
  owned synthetic state after all owners close and WAL checkpoints complete. This includes
  source Git state. No credentials or corporate sources were involved.

The first two small development runs used `receiptFixture.close()`, which deletes their
source/catalog directories; only their actual raw files/logs remain. The separate boundary
run, both ordinary matrix runs and final observed run preserve stopped catalogs/sources.
Ordinary CI uses only separate permit inputs and never imports the reserved library factory.
The dedicated observed worker PID was 2154060 and exited 0/signal null, without timeout
or forced termination. All artifact compression is lossless; source data is not rewritten.

The [review record](review.json) records commits, validation and scope. Local full validation
passes 869 tests/types/builds at `0ee6a99`; final focused validation passes at `aa8797b`.
The seal is committed at `a3b8b55` before the one observed run. Exact-head push/PR CI remains
a merge prerequisite and is recorded in the PR and the next accepted handoff.
