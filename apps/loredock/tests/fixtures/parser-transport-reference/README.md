# Original parser transport facts

These source and fact bytes come directly from the first Task 138 archive at
`d84971fec360540db4266d38a65e9b9840ae1881`. The manifest pins the original archive,
member names, stored bytes and decoded hashes. Expectations are not regenerated from
the new codec. The first failed observation and its application source remain unchanged.

The ordinary case fits protocol v1; dense operations and a long owner fail its response
bound while their direct graphs succeed. Source and emitted protocol-v2 tests must
reconstruct exactly these fact bytes and original ranges. Passing these three cases
repairs concrete regressions; it does not qualify all possible inputs or resource limits.
