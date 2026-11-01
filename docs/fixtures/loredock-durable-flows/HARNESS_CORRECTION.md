# First observation and harness correction

The first run used prototype `ca93fb7`, frozen inputs `759cb04` and scope `b368729`.
Its complete receipt is retained in `first-harness-failure.json`; it is not a successful
projection qualification. The independent reader/parity and authorization-fence tests
passed, but the observation harness failed while reopening citations.

`MapEvidence` deliberately contains only ID, source name, path, revision and line range.
The harness incorrectly compared its nonexistent source ID/content hash/span hash with
full original fields. Successful reads were consequently replaced by harness errors;
secondary scenario assertions then failed on the missing graph. These are harness
failures, not observations establishing a graph or coverage failure.

The correction compares the actual compact locator fields, independently checks source
ownership against the saved build and payloads, and verifies original content/span/Git
blob hashes against frozen source bytes. It also retains the computed projection if a
later harness check fails. A focused test now opens real compact references and rejects
wrong payload ownership. No input, oracle, parser, selection, assembler or production
behavior changes. The corrected run uses a separate fresh output directory and retains
its own implementation identity; failed and corrected receipts must remain distinguishable.

The corrected measurement also preserves six live-object equality failures: `emptyFacts()`
creates `records` with a null prototype, while JSON persistence reconstructs a plain object.
The full serialized vectors are equal. `review.json` documents an offline interpretation
of the retained measurement, and a comparison-helper test verifies that record value changes
still fail. No measurement is repeated for this representation correction. The separate
200-function dense-case expectation remains unsatisfied under the existing parser cap.
