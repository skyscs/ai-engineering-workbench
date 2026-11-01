# Short Java symbol verification

Task 049, 2026-11-01. Scope `c1e8cb9` follows PR #52 / main `2231a19`. Query version 2
adds exact short Java class/method aliases while keeping full result identities. See
[ADR 0043](../../decisions/0043-loredock-short-java-symbols.md).

Strict types, all 392 tests and production builds pass. One new integration test uses
owned `demo.alpha.Shared` and `demo.beta.Shared` classes in two sources with the same
display name. Both contain overloaded `run` methods and `stop`. `Shared.run` returns all
four distinct ranges, alternating sources; full package names narrow by their exact
spelling. `Shared` returns all six methods. Duplicate display names do not merge source
identities. Case/regex/partial-package/call-expression spellings remain literal no-matches.
An unrelated TypeScript `Shared.ts` with `run` participates in simple-name search but
does not acquire a Java class alias. Protected HTTP returns the same version-2 result.

Every original citation retains its source/path/revision/range. Queries reuse the same
published inventory. A separate compiled check confirms the parser fingerprint remains
`4c7fa6c899ddef2629d18285edacb377425f7298723f71354ea068560377bcbc`, exactly as in Task 048.
The historical qualifier correctly refuses the new query-source hashes; no full measurement
or attempt receipt was created. Existing facts need no reanalysis for this change.

The [browser result](browser-result.json) extends coverage workflow version 3 with
`StockProjection.accept` and `StockProjection`, both displaying
`synthetic.stock.StockProjection.accept`. Keyboard original navigation opens the recorded
inventory-worker source. Existing independent text results, hostile-label escaping,
query/evidence delays, refresh, policy/revocation fences, file browsing, restart and
390px layout still pass. The short-name mobile screenshot was inspected locally.

Reproduce after building with the documented toolchain and a free port 4244:

```sh
LOREDOCK_SMOKE_OUTPUT=/tmp/loredock-short-java-browser node scripts/loredock-code-coverage-smoke.mjs
```

The browser owns temporary sources, data and processes; answer mode is disabled. No
corporate input, model request, parser expansion, graph/answer reranking or new full-volume
measurement was used. Historical reports and both Task 048 oracle assessments are unchanged.
Short names are navigation conveniences, not import resolution or runtime binding claims.
