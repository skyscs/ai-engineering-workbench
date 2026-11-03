# Terminal heap helper development evidence

Task 086 exercises independent tiny objects and graph mutations only. No large
resource corpus or application optimization is created. The
[helper contract](../../../scripts/loredock-terminal-ownership/README.md) records
fixed bounds, process ownership, intrusive collection/export behavior and the
limits of the graph readout.

The schema preflight runs pinned Node 22.23.2 with only PATH/C locale, a 16 MiB hard
file limit and a 30-second timeout. Its 5,209,992-byte default heap snapshot and
exact command/exit identity are retained. It establishes the real metadata schema,
not application residency or resource acceptance. The compressed graph contains
only this owned Node bootstrap process, without user configuration or project code.

The first focused run fails before snapshot export because the `/proc/self/limits`
parser rejects trailing whitespace after the byte unit. The child exits 1 and its
stdout/stderr/exit are retained in `first-child.jsonl.gz`. The hard limit was
installed correctly; the parser now accepts the actual Linux record formatting.
No bound is raised to fix that failure.

The corrected real child exports a marked owned object once while held and once
after release in a later event-loop turn. Offline counts are one and zero. Graph
mutations distinguish explicit strong edges, weak-only reachability and runtime/
native uncertainty, and reject invalid metadata/IDs/indices/encoding/bounds.
Actual process tests preserve exit 7, cleanup failure, cancellation, timeout, sampled
RSS refusal and a native hard-file-limit failure; owned file checks reject altered
hashes/lengths, traversal and symlinks. Focused checks pass all four tests.

Review additionally ensures parent descriptors close after setup errors, native/
hidden path segments stay unclassified, and the whole-child watchdog can include
future preparation. The diagnostic ceiling is fixed at 900 seconds before any
large-family authoring; tiny regressions reduce it to 15 seconds or less. This is
not an application deadline or a qualification-limit change.

`validation.json` records raw/archive hashes, sizes, exits, runtime identity and
compressed log references. All first failures remain. The first full pinned-toolchain
check exits 0 with 533 tests, strict typechecks and builds. Final review additionally
rejects omitted/duplicate/third export calls through the real child; the full check
is repeated and again passes all 533 tests, typechecks and builds. Old measured code, frozen inputs, original
scores and product code remain unchanged; streaming is still unqualified.
