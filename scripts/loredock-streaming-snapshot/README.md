# Streaming snapshot validation candidate

This opt-in offline factory implements Task 081's single allocation candidate.
It changes only the ownership of transient snapshot headers and manifest input.
The normal daemon, APIs, consumers and schema still use the existing snapshot.

`createStreamingAnalysis` returns an injected subclass that retains the baseline
authorization checks over public catalog/store operations. It executes the exact
bounded header SQL through a synchronous SQLite iterator, checks every unit, and
retains only ordered parsed-file IDs. Manifest hashing writes `[`, each identical
`JSON.stringify({ fileId, inputHash })` separated by commas, and `]`. This is the
same byte sequence as the previous whole-array serialization, including empty
arrays and escaped/non-ASCII values.

No snapshot result, SQL statement or authorization is cached. All three complete
snapshot calls, checkpoint hashes, count/byte checks, path work, original support
and final publication fences remain. Iteration remains synchronous, as before;
cooperative timing and memory still require separate qualification. The source
identity is pinned in `baseline.json`; the explicit authorization copy must be
reviewed against that baseline before any future integration.

`services.mjs` wires the candidate to compiled unchanged complete-capture services
for a later explicitly scoped fresh qualification. It does not execute a corpus or
probe. Ordinary tests inject source services and independent inputs. They compare
snapshots against the baseline on actual SQLite data, reject corrupt late rows and
scope changes, exercise the unchanged 10,000-header ceiling, and compare all eight
capture/page/history outcomes across three owned processes.

No measured memory improvement, history-RSS fix or resource acceptance is claimed.
Never run old frozen families with this replacement. A fresh uninstrumented
qualification with unchanged limits precedes production integration.
