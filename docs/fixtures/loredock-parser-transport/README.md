# First production parser transport prerequisite

This ordinary synthetic record belongs to
[Task 138](../../../tasks/138-loredock-production-file-parser.md). The prerequisite
fails; production adoption is deferred. No application code, limit, default, native
fingerprint or consumed qualification family changes. There are zero model calls.

`records.json` pins the complete first-attempt archive, its separate file inventory,
local logs and both complete accepted Task 137 CI logs. The first tree contains exact
source/runtime identities, the external owner script, child output, stopped catalogs,
synthetic Git repositories, direct facts/graphs and per-owner terminal states.
The observation at `d84971fec360540db4266d38a65e9b9840ae1881` is never overwritten or rerun.

The ordinary 182-byte source produces an exact 8,090-byte graph through the adapter.
Two other direct graphs succeed, preserving their useful HTTP operation and existing
bounded omissions, but their thread replies fail:

| Case | Input bytes | Direct fact bytes | Reply bytes | Direct graph bytes | Failure |
| --- | ---: | ---: | ---: | ---: | --- |
| Dense operations | 20,328 | 736,636 | 736,909 | 156,559 | `PARSER_RESULT_LIMIT` |
| Long owner | 9,878 | 846,191 | 846,464 | 3,270 | `PARSER_RESULT_LIMIT` |

The unchanged response bound is 524,288 bytes. Every direct parser returns two symbols,
the expected operations and no syntax gaps. The dense graph reports 943 omitted nodes;
the long-owner graph reports one omitted oversized property. Those graph limits already
produce valid bounded outputs; the new transport must not reject the whole operation
merely because its intermediate facts repeat large strings.

The complete child exits 1 after 1,171.132 ms, without a timeout. All three parser owners
report closed state, joined exit and no retained ownership. The stopped ordinary worker
also has exit code 1 because explicit thread termination uses that exit status; its graph
comparison succeeds. Kernel child high-water RSS is 240,764 KiB, with 1.004 user and
0.317 system CPU seconds. These diagnostics combine direct parsing and worker comparison;
they do not qualify startup, isolate heap, simultaneous aggregate memory or production RSS.

Static review verifies the retained originals, three Git identities and graph evidence
against each read-only catalog, as well as unchanged application source/emission.
The baseline full build passes. The first CI-review helper assumed nine typecheck jobs;
inspection found ten actual successful packages/apps. Both complete Task 137 logs contain
1,094 passing tests, ten successful typechecks and complete builds at `bebef156`, before
merge `48b88a9`. Task 138 still requires exact-head CI before merge.

The [next task](../../../tasks/139-loredock-lossless-parser-transport.md) reviews lossless
string factoring and strict bounded decoding. The first failed frames and direct results
remain an independent compatibility baseline. Production adoption and all outstanding
resource gates remain deferred until their actual prerequisites pass.
