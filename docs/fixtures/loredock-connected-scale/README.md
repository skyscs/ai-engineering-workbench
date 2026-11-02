# Connected resolution scale qualification

Status: **gate failed; production promotion rejected**, 2026-11-02. Task 065 is an offline
experiment. The application, saved answers, correction targets, schemas and owner demo are
unchanged. No model requests or corporate sources were used.

Scope `d01d8c0`, frozen fresh inputs/resource contract `d7e76b4`, measured candidate and
harness `8a06c992fe3d2d849662d7a02c652e19efd1de46`. See the
[prospective contract](../../../fixtures/loredock-connected-scale/DESIGN.md),
[input identities](../../../fixtures/loredock-connected-scale/baseline.json) and
[integration design](../../loredock/CONNECTED_PATH_INTEGRATION.md).

## Outcome

The first full run completes 22 cases and 46 observations: **605/628 checks pass**, with
23 retained failures. All eight base resource observations pass their predeclared time,
responsiveness and sampled-memory thresholds. All 46,028 reopened original span occurrences
match their source/revision/path/line/hash identities. All projection Git-call, store-write
and changed-row counters are zero outside separately counted lifecycle hooks. There are no
harness exceptions or replacement runs. The probe exits 1 because the required gate fails.

The indexed, yielding resolver reads all 9,975 code files in the maximum admitted shape, but
preserves only two of seven required display nodes. Complete fact reading and fast bounded
execution do not establish useful connected context. No backend/UI adoption follows.

## Resource measurements

Twenty sources have equal path shares. The 10,000-path catalog limit includes README and
configuration files, so the maximum shape contains 9,975 code files and 25 non-code files.
Source/index preparation is outside the projection timings. These are one-machine readings
with the exact hardware and Node version in [the receipt](result.json); no other heavy local
checks ran concurrently with the recorded projection matrix.

| Code files read | First / repeat wall ms | First / repeat max timer delay ms | Required nodes displayed | First / repeat work units |
| ---: | ---: | ---: | ---: | ---: |
| 95 | 42.09 / 50.09 | 0.20 / 3.97 | 4/7 | 749 / 749 |
| 575 | 212.76 / 206.97 | 6.84 / 9.63 | 2/7 | 3,622 / 3,622 |
| 3,575 | 1,282.94 / 1,242.82 | 12.00 / 23.77 | 2/7 | 21,622 / 21,622 |
| 9,975 | 4,236.46 / 4,246.04 | 64.34 / 66.17 | 2/7 | 60,022 / 60,022 |

The prospective bounds are 5,000 ms wall, 100 ms timer delay, 256 MiB sampled RSS increase,
1 GiB sampled total RSS and 128 MiB sampled heap increase. Maximum sampled total RSS across
the eight base readings is 321.85 MiB; their maximum heap increase is 32.36 MiB. Full values,
baselines, stage times, checkpoint intervals and sample counts are retained per observation.
Checkpoint/10 ms samples can miss allocation peaks; this is neither a hard memory bound nor
a cold-cache/general hardware guarantee. The five-second deadline remains cooperative.

## Why the useful-path gate fails

The fresh corpus deliberately mixes function files with literal descriptor constants. The
[current TypeScript extractor](../../../apps/loredock/src/code-typescript.ts) reports
`unsupported-typescript-profile` when it emits no supported function symbols. The candidate
correctly preserves the Task 063 rule that **any** gap makes its whole source incomplete.
That policy is too broad for this shape: unrelated constant files suppress relative named
imports and Java handler/consumer bindings elsewhere in the repository.

The prospective oracle incorrectly assumed that these no-function files would leave the
required paths available. It is not amended after observation. Source-level conservatism
avoids false positive uniqueness, but the useful-path gate remains failed. The complete
retained vectors show the necessary operations; the projection withholds the dependent links.

| Cases | Retained failed checks | Observed consequence |
| --- | ---: | --- |
| S01–S04 | 16 | First/repeat useful-family and seven-node conditions fail. The smallest graph has seven nodes/five edges; larger graphs have five nodes/three edges. No selected path reaches the write. |
| S06 | 2 | Both alternatives remain recorded, but bindings are classified incomplete instead of the expected ambiguous outcome because other files have gaps. No false unique edge is issued. |
| S09 | 1 | A withheld named-import edge leaves an extra HTTP-function root, so the nine-root/default-omission oracle fails. Explicit isolated-root inspection still works. |
| S10 | 2 | Withheld call/handler/consumer bindings prevent useful branch paths and the expected pending-path-limit exercise. This does not qualify branch workload behavior. |
| S11 | 1 | Simple-path validation passes, but the expected write-ending cycle path is absent. |
| S12 | 1 | A one-node isolated root fits the lowered node cap, contrary to the expected whole-path omission of both roots. The retained path is not a half-admitted long path. |

Source registration order, truncated alternatives, incomplete inventories, explicit isolated
roots, internal resolution/work/time bounds, comparison omissions, cancellation in all three
stages, policy changes in all three stages, revocation, addition, inventory eviction,
fact/original corruption and restart checks pass. These successes do not erase the failed
usefulness, root and branch conditions. All earlier frozen gates and budgets remain intact.

## Retained artifacts

- [result.json](result.json): exact first-run receipt, implementation hashes, source revisions,
  checks and per-observation hashes/counters/metrics. Its generic next-step field is subject
  to the explicit failed gate recorded here and in the summary.
- [observations.jsonl.gz](observations.jsonl.gz): all 46 original compact JSON observations,
  concatenated in receipt order. Each line is the exact original observation file, including
  its final newline; per-line byte/hash identities are in the receipt. Full internal graph,
  alternative, support and bounded envelope vectors remain inspectable.
- [summary.json](summary.json): explicit rejection, totals, compressed and uncompressed hashes.
  The archive contains 41,419,118 uncompressed bytes (9,691,609 compressed bytes).
- [execution.txt](execution.txt): original stdout/stderr, including SQLite's experimental
  warning and all failed-check names. No observed result was replaced.

Inspect saved data without rerunning the experiment:

```python
import gzip, hashlib, json
from pathlib import Path

root = Path("docs/fixtures/loredock-connected-scale")
receipt = json.loads((root / "result.json").read_text())
expected = [item for case in receipt["cases"] for item in case["observations"]]
with gzip.open(root / "observations.jsonl.gz", "rb") as stream:
    for item in expected:
        line = stream.readline()
        assert len(line) == item["bytes"]
        assert hashlib.sha256(line).hexdigest() == item["sha256"]
        observation = json.loads(line)
    assert stream.read() == b""
```

## Verification and next boundary

Strict types, all **456 tests** and builds pass at the measured implementation. Four added
focused checks cover indexed ambiguity, resolution/admission cancellation, explicit-root/
work/atomic-admission bounds and policy fencing. They use existing small regression fixtures,
not this frozen measurement harness. Local full checks finished before measurement began.

Before production integration, freeze a separate binding-completeness contract and fresh
counterexamples. Distinguish known relative-import target paths from unrelated files, and
Java handler/consumer candidates from unrelated TypeScript gaps. Missing or excluded target
files, parser truncation, inventory omissions and unknown path coverage must still block
positive uniqueness. Do not just ignore gaps or classify arbitrary unsupported code as safe.
Preserve this failed corpus and its oracle; a successor needs new prospective useful-path,
ambiguity, branch and resource evidence. The existing application consumers stay unchanged.
