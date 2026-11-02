# Binding completeness qualification

Status: **offline gate passed**, 2026-11-02. Task 067 qualifies the binding-domain
interpretation on fresh owned inputs. Application consumers, schema and model behavior
remain unchanged. This is not semantic, runtime or independent product acceptance.

Scope `c02d729`, frozen inputs/oracle `2efdfa9`, measured candidate/harness
`3f4c96bf6b82cba602ac8b9fbd75f6168e341fb7`. See the
[prospective contract](../../../fixtures/loredock-binding-coverage/DESIGN.md),
[input identities](../../../fixtures/loredock-binding-coverage/baseline.json),
[independent tree vectors](../../../fixtures/loredock-binding-coverage/tree-vectors.json)
and [binding completeness design](../../loredock/BINDING_COMPLETENESS.md).
Task 065's failed oracle and observations remain intact; no old experiment was rerun.

## Outcome

The first run completes **1,031/1,031 checks** across 37 case records and 87 observations:
eleven standalone tree checks and 76 projections. The eight base first/repeat projections
all meet the prospective correctness, time, responsiveness and sampled-memory thresholds.
All 46,221 original span occurrences reopen exactly. Projection Git-call, store-write and
changed-row counters are zero outside separately recorded lifecycle injections. There are
no harness exceptions, replacement observations or amended expectations. Exit status is 0.

Every base size retains all seven critical original nodes, thirteen displayed nodes,
twelve edges and two write-ending paths. Unrelated TypeScript profile gaps stay visible
without suppressing complete import-target or Java domains. Relevant gaps, excluded and
unattempted targets, source path omissions and failed enumeration still block uniqueness.
Known alternatives remain ambiguous independently of domain completeness.

The matrix also verifies opaque symlink/gitlink boundaries, mixed-case Java uncertainty,
eight-root navigation with an isolated later root, wide branches, cycles, whole-path
admission, reduced work/metadata/comparison bounds, four-stage cancellation and policy
changes, revocation, addition, inventory eviction, corruption and historical/restart reads.
Metadata removal or changes cannot establish false absence. Independent SHA-1/SHA-256
tree vectors cover empty trees, executable/symlink/gitlink entries, Unicode, reserved names
and file/directory sorting. All tree verification uses saved metadata without Git reads.

## Resource observations

Twenty sources share 200, 800, 4,000 or 10,000 admitted paths. Twenty-five README/configuration
paths are not code. Repository preparation, indexing and analysis are outside projection
timing; metadata proof, original/fact validation, resolution, admission and final fences
are inside it. Full local checks completed before measurement, with no heavy local checks
running alongside this matrix. Machine/load readings are recorded in the receipt.

| Code files read | First / repeat wall ms | First / repeat maximum timer delay ms | Critical nodes | First / repeat work units |
| ---: | ---: | ---: | ---: | ---: |
| 175 | 72.80 / 57.64 | 28.49 / 21.56 | 7/7 | 6,908 / 6,908 |
| 775 | 237.22 / 224.72 | 24.91 / 28.49 | 7/7 | 26,108 / 26,108 |
| 3,975 | 1,196.27 / 1,146.97 | 28.88 / 29.66 | 7/7 | 128,508 / 128,508 |
| 9,975 | 3,557.20 / 3,626.48 | 56.73 / 60.73 | 7/7 | 320,508 / 320,508 |

Required bounds are 5,000 ms wall time, 100 ms timer delay, 256 MiB sampled RSS growth,
1 GiB sampled total RSS and 128 MiB sampled heap growth. The eight base readings peak at
344.33 MiB sampled total RSS and 50.18 MiB heap growth. The timer is armed before projection
and flushed after completion before serialization; checkpoint memory samples supplement
10 ms sampling. Samples can miss allocation peaks. The cooperative deadline, synchronous
SQLite/inventory/original checks and deterministic sorts do not guarantee real-time latency
on other inputs or hardware. No forced GC or cold-cache claim is made.

## Retained artifacts

- [result.json](result.json): exact first-run receipt, implementation hashes, original Git
  revisions, checks and per-observation byte/hash identities, metrics and counters.
- [observations.jsonl.gz](observations.jsonl.gz): all 87 compact observation files in receipt
  order, retaining each original byte and final newline. Full resolution alternatives,
  domain reasons, support and bounded display envelopes remain inspectable.
- [summary.json](summary.json): explicit gate, totals and compressed/uncompressed hashes.
  The archive is 9,999,357 bytes, expanding to 43,363,226 original bytes.
- [execution.txt](execution.txt): original stdout/stderr and exit status, including the
  SQLite experimental warning. Expected negative-case failures remain in the observations.

Inspect the saved evidence without executing the exhausted measurement again:

```python
import gzip, hashlib, json
from pathlib import Path

root = Path("docs/fixtures/loredock-binding-coverage")
receipt = json.loads((root / "result.json").read_text())
with gzip.open(root / "observations.jsonl.gz", "rb") as stream:
    for case in receipt["cases"]:
        for item in case["observations"]:
            line = stream.readline()
            assert len(line) == item["bytes"]
            assert hashlib.sha256(line).hexdigest() == item["sha256"]
            observation = json.loads(line)
    assert stream.read() == b""
```

## Verification and next boundary

Full strict checks, **462 tests** and builds pass. Six new focused regressions exercise
independent tree bytes, useful paths despite unrelated gaps, ambiguity plus incompleteness,
excluded-row deletion, cancellation/metadata bounds/root generations and late metadata edits.
They use small regression inputs, not the frozen qualification matrix.

Next is the separately scoped typed backend/protected-read phase of the
[integration plan](../../loredock/CONNECTED_PATH_INTEGRATION.md). It must add complete wire
identity, bounded four-root pages, single-reader ownership, parameter validation and request
cancellation while preserving existing answer/review/candidate derivations. Exercise reads
alongside a newer unpublished inventory explicitly: this offline candidate conservatively
rejects any database write during its asynchronous scan. Passing this matrix does not establish
that broader application concurrency behavior or qualify a new HTTP/UI contract.

The host restart preceding implementation removed the temporary worktree and old demo
process/data. Committed scope and frozen inputs survived. Development and first-run receipts
were recovered into persistent workspace directories; the demo was not recreated or migrated.
