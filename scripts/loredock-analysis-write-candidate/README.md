# Independent analysis write comparison

`compare.mjs` opens identical stopped owned catalogs with the archived pre-candidate
store/analysis or current services. Seven scenarios compare actual retained unit/source
state, independently verified checkpoint hashes and SQL execution counters. Only new
inventory IDs and validated clocks are normalized. On three 16-file inventories, each
repeated INSERT/UPDATE performs 48 writes in both arms; preparations must be 48 versus 3.
The diagnostic records no argument values or per-call SQL records.

The ordinary source test and plain-Node compiled entry share this independently authored
comparison. The controls originate in the committed
[reference](../../apps/loredock/tests/fixtures/analysis-write-reference/README.md), not
current implementation delegation. The current fingerprint provider is explicit; this
is a behavior comparison, not a historical-runtime upgrade replay.

After committing and building, set an absent absolute `LOREDOCK_ANALYSIS_WRITE_OUTPUT`
and run `node scripts/loredock-analysis-write-candidate/run.mjs` with Node 22. The
entry verifies control bytes and records all 38 actual compiled runtime modules. It
retains both comparison reports and a separate complete native two-process development
smoke. Failures/partial artifacts remain at that exclusive output directory. Resource
results stay visible but this is functional development validation, never a reserved
qualification or native-memory attribution. No prior frozen family is imported.
