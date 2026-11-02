# Task 071 — Frozen receipt qualification inputs

Freeze this directory before implementing or observing the receipt candidate. The owned
four-source seat-booking corpus and structural oracle were authored from literals, not
resolver output. They are known to the author and are not external semantic validation.
No old frozen matrix, model question or resource observation is reused.

## One-run protocol

1. Commit inputs/oracle/protocol, then implement the offline candidate and independent
   small regression checks. Do not inspect these inputs through the new candidate yet.
2. Commit final candidate/harness; record that full commit, input file SHA-256 hashes,
   toolchain, hardware, baseline RSS/heap and exclusive measurement output directory.
3. Execute the matrix exactly once. Each destructive case uses a fresh owned catalog.
   Observe every listed success, availability/history/corruption case, each reducible
   limit, cancellation at each stage and every stage/mutation pair. Include an external
   committed SQLite write during capture plus a blocked writer inside the final lock.
4. Preserve each first observation, all raw receipts/statuses and stdout/stderr/exit code.
   Record failures and continue independent cases when cleanup succeeds. A failed gate
   rejects promotion; never edit expectations and repeat this matrix. Any successor
   requires new scope/inputs. Implementation regressions use separate small fixtures.

The entire capture/read has one five-second cooperative budget from entry through final
publication, including path reads, original reopening, validation and serialization. Charge
work for input/output bytes and bounded collection entries; cap it at one million units.
The existing CodePaths service retains its stricter independent work limits too. Check
cancellation/time/work between stages and original spans. No reset of the outer clock.
Default source/count/text/projection/receipt caps are in oracle.json; reduction tests set
each cap to zero, except source bound one. A bound failure returns no receipt ID or file.
Unknown/increased/negative/noninteger limits are rejected before work.

For successful first/repeat/default/selected captures and history reads, record total wall,
maximum interval slice (5ms sampling plus final interval), sampled RSS and heap growth,
complete wire/text/receipt bytes, charged work and checkpoints. Admit only if all oracle
thresholds pass. Sampling is not a process isolation or peak-memory guarantee. Deliberately
injected waits/errors are diagnostics, not resource success cases. No heavy check runs in
parallel with the matrix.

Capture emits only own content-addressed receipt files. Original projection JSON ordering
must survive wrapping/unwrapping. Final synchronous publication holds a SQLite immediate
transaction with no DML, rechecks the capture epoch and closes/renames the owned file before
releasing the lock. A second connection must fail its write while that guard is held. This
qualifies the local handoff, not atomic multi-resource crash recovery or production storage.
No async callback may run inside the final guard. Record lock transactions separately from
DML counters; no catalog write, Git invocation or implicit analysis is allowed outside
explicit fixture lifecycle hooks. An external write committed before the final lock must
invalidate the capture even when main-connection total_changes is unchanged.

History reads reopen complete originals, scope dependencies and their immutable metadata,
but must never call CodePaths/CodeAnalysis/Git. A retained receipt is not a current
verification; publication, parser change and extra sources leave it recorded/stale, while
revocation/policy/corruption fences it. Mutated file cases use the original trusted receipt
ID; stronger internal corruption cases reseal only the outer hash to reach nested checks.
No arbitrary external receipt import or authenticity claim is tested or implemented.

The alternatives case adds the oracle's second Java handler without changing existing
source-file bytes. The recorded old receipt must stay byte-identical and readable; a new
projection must have a different generation and may not preserve the old unique handler
edge. No correction is transferred. Existing legacy-answer input bytes and correction
rows must stay unchanged by receipt capture/read itself.

Successful qualification permits a separate production design/review, not automatic
consumer adoption, cross-adapter note migration, new answer semantics or Workbench routing.
