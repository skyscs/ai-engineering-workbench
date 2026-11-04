# Prepared reads within an inventory worker

Task 093 tests the single candidate selected by the
[inventory preparation audit](../../docs/loredock/INVENTORY_PREPARATION_AUDIT.md).
The opt-in service delegates one scheduled worker invocation to the original `run`
body inside Task 090's unchanged bounded read scope. Every query executes again
with current bindings. There is no row, authorization, original or payload cache.

The seam deliberately depends on the pinned TypeScript-private `run` method being
emitted as an ordinary prototype method. It is not a supported public extension API.
`baseline.json` and a source-hash regression bind the reviewed implementation;
the factory rejects a missing worker and construction rejects an incompatible store
before acquiring ownership. Subclassing retains the original module's shared
one-analysis-per-catalog guard. No scheduler or worker code is copied or changed.

The wrapper returns the scope promise to the unchanged scheduler. Its `finally`
clears references before scheduler error handling/cleanup. A new invocation after
pause or a cleanup/resume race opens a new scope. Start/control and synchronous
checkpoint validation stay outside; stop/idle still await the owned promise.
Original validation, per-file transactions, parsing, writes, publication/eviction
and history are unchanged. No transaction spans a cooperative yield.

One store retains at most 64 statements / 64 KiB SQL text. Overlapping path reads
or workers fall back to fresh preparation rather than sharing an active scope.
Unrelated async work does not inherit its statements. Close and expired descendants
retain the existing scope behavior. Releasing references is not native finalization
or an RSS guarantee. This remains offline; no production consumer imports it.

Independent tiny stopped copies test exact units/checkpoints/manifests and receipts,
fresh SQL execution/bindings, original reads/writes, corruption/authorization,
lifecycle boundaries, concurrent paths and scheduler races. Existing Task 090 tests
cover the unchanged store's bounds and failure/recursive/async cleanup behavior.
Preparation counts show reuse only. A separate fresh frozen complete uninstrumented
qualification is required before resources or production promotion can be accepted.
