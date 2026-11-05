# Compiler loading reference

`code-typescript.ts.txt` is the exact original source from accepted commit
`aaec8fd329e3c01b9cb97c1171c4681af1fe3c88`, SHA-256
`773a8ced3b8e304c7d306fa9a91e060ce7da7194ebcde5a4ccb5aa12f9c1a5ad`.

Task 130 changes the eager compiler loading mechanism and erased type names only.
The verifier reconstructs that exact permitted delta from these independent original
bytes and rejects any other production change before returning historical source to
older test controls. Existing dependency manifests and source fingerprints stay pinned.
The emitted parser body must remain identical in a separate regression test.
The original compiled module is also retained as `code-typescript.js.txt`, SHA-256
`bed4a32a30f629aec58f02ae4e0284cde053d318b39046fcde54d6640a6772b9`.
Both old and current emitted bytes must match deterministic compilation of their
independently verified source. Older whole-application controls use the same exact delta.

The original frozen inventory verifier remains strict and rejects the new application.
The small ordinary inventory unit test explicitly observes that rejection, verifies
the historical pins through this exact delta, and labels its scan with the current
production fingerprint. This does not rerun or accept an old resource qualification.
