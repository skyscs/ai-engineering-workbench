# Complete synthetic code-fact inventory feasibility

Task 044, 2026-11-01. The [protocol](../../../fixtures/loredock-code-inventory/DESIGN.md)
and parser/corpus hashes were frozen in `5fbfd0d`; implementation `b33e6c5` precedes
the one declared experiment. [Summary](summary.json) retains every aggregate and source
breakdown. [Compressed raw result](raw-result.json.gz) retains both complete per-file
records without modification. Its decoded SHA-256 is
`3f09ad309f97a10116db356c0ba988f05cee8f7ff1efd0258a45bdef9a9bf1d8`;
gzip reduces 16,586,495 bytes to 1,965,060 bytes. This is artifact compression, not a
production cache or storage measurement.

One fresh full Task 041 fixture publishes all 3,679 eligible files with sixty intentional
exclusions and no failures. There is no refresh, resume, retry, corporate input or model
request. The default graph still examines 100/3,621 code candidates. Two fixed sequential
passes examine all 3,621 candidates on the same pinned index, preserving 32 KiB/file,
eight-span/file and parser guards. Neither pass reaches its total budgets.

| Observation | First pass | Repeat pass |
| --- | ---: | ---: |
| Examined / retained files | 3,621 / 3,621 | 3,621 / 3,621 |
| Failed / excluded / unattempted / omitted facts | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| Input / serialized raw fact bytes | 7,378,135 / 741,496 | 7,378,135 / 741,496 |
| Symbols / operations / calls / record signatures | 3,616 / 8 / 1 / 8 | 3,616 / 8 / 1 / 8 |
| Wall time | 19.783 s | 1.097 s |
| Parsing | 0.852 s | 0.276 s |
| Validated stored-document reads | 1.175 s | 0.381 s |
| Independent Git reads | 15.775 s | 0 s |
| Other provenance validation | 1.447 s | 0.258 s |
| Range validation | 0.060 s | 0.012 s |
| Sampled evaluator RSS peak | 267,419,648 bytes | 295,161,856 bytes |

The repeat pass reparses every file and revalidates stored originals; only already verified
Git text is reused. It is not a cache-hit measurement or independent corpus. RSS excludes
child Git processes, sampling can miss peaks, and both passes share process/OS state.
No production latency or representative framework-cost claim follows from these timings.

Every per-file record is identical across passes. All three fixed final-file exact symbols
are found; all 98 default graph symbols agree with full-inventory original line ranges.
Each pass verifies 3,621 original spans against owned Git revision/blob/content/range hashes.
UTF-16 symbol/operation offsets retain their original text hashes. Source checkouts stay
clean and no answer attempt exists.

The larger inventory finds `order-api`'s `Orders.accept` in its original Java file, outside
the default graph sample. This is exact same-source method syntax, not proof that a route
binds to it or executes it. The two inventory handlers still have no method match. Nine
Java and 3,612 TypeScript-dispatched files include seven retained gap occurrences:
two unsupported Java syntax, two TypeScript profiles, one Java profile, one Vue envelope
and one AMD shape. Parsing every file does not imply understanding every file.

## Validation and next slice

Strict types, all 366 tests and production builds pass. Small-shape tests cover deterministic
facts, original ranges, every budget class, corrupt content, revocation, policy changes and
source changes during an extraction pass. The experiment explicitly pins both passes to
one build. Production parsers, schemas, interactive graph limits and prompts are unchanged.
Earlier semantic failures and independent/private-project acceptance remain open.

The next slice should persist a bounded per-file inventory before connecting it to broader
queries or maps. Keep source evidence authoritative, fingerprint actual parser/dependency
bytes, validate resumed work against the same index, expose interruptions and unsupported
syntax, and fence/purge derivatives with their source. Bound retained generations and fact
bytes explicitly. Cross-revision parser reuse is unnecessary for the first implementation:
the observed parser cost is small, and semantic equivalence needs a separate contract.
Keep current graph and answer selection unchanged until a distinct integration slice.

To inspect all records, run `gzip -dc docs/fixtures/loredock-code-inventory/raw-result.json.gz`.
To reproduce this historical experiment, build with the documented Node 22 / pnpm toolchain
and run `node scripts/loredock-code-inventory-probe.mjs NEW_OUTPUT_DIRECTORY`. The runner
checks frozen inputs before creating owned sources and refuses an existing output directory.
Changed parser/projection inputs require a new contract; preserve this report.
