# First production parser observation coverage record

The prospective plan was committed at `fd4f2e3`; candidate `7080e75` ran exactly once
into the exclusive `/home/toshiba/aew/task141-coverage-first` directory. The accepted
application base is `410e9acd4e113a0175e806444f31b8b9273cd887` (Task 140, PR #173).

- [first.tar.gz](first.tar.gz): all 487 retained files, 38,258,735 raw bytes;
  SHA-256 `4674e3fc4d9ebf567f5679b80d2a820522e0bd7f833d748cacd64ab2fac55279`.
- [inventory.json.gz](inventory.json.gz): path, size and SHA-256 for every archive member;
  compressed SHA-256 `9e3c27b4c91ec308c878cccea3308c6e696e55b0cfb9dfbff76489c6e309391a`.
- [tree.json](tree.json): archive identity and original candidate/base.
- [assessment.json](assessment.json): offline findings from the original raw records.
- [logs.json](logs.json): closed local checks and both complete accepted Task 140 CI logs.

The archive includes application source/emission, observer scripts, installed tsx/esbuild/
TypeScript files, exact runtime hash and launch environment; both synthetic Git repositories;
raw events, parent memory, heap request windows, process census, stopped catalogs and
actual child exit records. Every archive member was checked against the inventory.
The runtime executable itself is identified by SHA-256 and is not duplicated in the archive.

Both lifecycle controls pass with natural exit and no surviving descendants. Source startup
has a 324.833-ms parent interval. Missing startup/worker/nested-isolate coverage prevents
whole-heap and resource qualification in both modes. Read the
[result and limitations](../../loredock/PARSER_OBSERVATION_COVERAGE.md).

Inspect or extract a copy for offline review. Never rerun the original launcher or reset
the consumed directory. `assess.py` reads retained data and writes only a new exclusive
report; it does not launch the application or qualify an incomplete observation.
