# Exact-symbol search verification

Task 047, 2026-11-01. Scope `7b3a9dd` follows PR #50 / main `04eaee9`. The existing
Explore the sources input now also checks a compatible durable code inventory. See
[ADR 0042](../../decisions/0042-loredock-exact-symbol-search.md).

Strict types, all 386 tests and production builds pass. Seven new integration tests cover
simple/qualified/Java-class exact matching, whitespace/case/literal operator input,
duplicate source display names, source-balanced match limits, output/time stops, original
ownership, corrupt payloads/originals/mappings, historical index selection and a paused
repeat alongside published facts. Asynchronous scans reject policy changes, revocation
and eviction. HTTP checks exercise protected access and invalid query/index inputs.
A spy confirms that lookup does not invoke the full aggregate build-summary method.

On the small owned twenty-source shape, all 121 retained files are checked. `Orders.accept`
is found even though its file is outside the unchanged 100-document graph sample.
The first test draft incorrectly assumed the shorter `loadProbe190004` file was outside
that sample; the assertion was corrected to the genuinely omitted Java method. This was
a test-expectation error, not a parser or graph selection change. Six unsupported files
and seven gap messages remain explicit; `OrderBadge` has no supported symbol result.

The [coverage/search browser result](browser-result.json) extends the prior workflow with
one shared search input, qualified symbol lookup, keyboard original evidence, escaped
hostile source labels and a 390px layout. Raw passages appear while a symbol response is
held and survive an injected symbol-endpoint failure. Held text/symbol responses cannot
restore results after query edits; held originals are also cleared. Refresh, policy change
and source revocation fence pending symbol results. Existing file-page, detail, restart
and project-poll cases still pass. Screenshots were inspected locally.

The first browser attempt released a held response after server publication but before
the UI observed that publication; the older index was still legitimately selected. The
harness now waits for the new published index option in the UI before testing the fence.
No product boundary was weakened. The [candidate browser regression](candidate-browser-result.json)
also passes. Both suites use sequential owned port-4244 daemons, generated sources and
isolated data directories, with answer mode disabled.

Reproduce after building with the documented toolchain:

```sh
LOREDOCK_SMOKE_OUTPUT=/tmp/loredock-symbol-browser node scripts/loredock-code-coverage-smoke.mjs
LOREDOCK_SMOKE_OUTPUT=/tmp/loredock-candidate-browser node scripts/loredock-candidate-smoke.mjs
```

Use fresh output directories and leave port 4244 free. These are mechanical small-shape
checks, not a new full-volume benchmark or independent semantic acceptance. No corporate
source, model request, parser expansion, candidate reranking or prompt change was used.
Historical reports and failed semantic gates remain unchanged. Larger lookup coverage
and latency require their own frozen measurement contract.
