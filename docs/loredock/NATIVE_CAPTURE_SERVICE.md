# Native capture and authorized history

Task 107 adds the internal `NativeCaptures` service around native v2 paths, the
[strict codec](NATIVE_RECEIPT_FORMAT.md) and [catalog-owned storage](NATIVE_CAPTURE_OWNERSHIP.md).
It has no HTTP/browser consumer. Application wiring must stop the service before
closing its catalog store. Construct it with the actual CodeAnalysis owner; an
optional actual CodePathsV2 instance remains caller-owned and is not stopped by
this service. Otherwise the service creates and stops its own path reader.

## Operations

`capture({ buildId, inventoryId?, generationId?, rootId? }, signal?, budget?)`
accepts a build and optional matching inventory/generation pins. A selected root
requires both pins; capture does not accept root-page offsets. It returns only
`captured`, the receipt hash, whether a file was created and operation metrics.
Repeated content preserves the existing file and returns `created: false`.

`history(receiptId, signal?, budget?)` returns `recorded`, the exact saved projection,
originals and complete dependency vector, plus metrics. It explicitly reports
`currentApplicability: not-checked`. A newer published build or registered source
set marks history stale; it cannot enlarge saved authority. Inventory eviction and
restart do not rederive a graph or read fact payloads. History reopens every original,
including support absent from the displayed graph, and checks all saved sources,
including dependencies without any displayed node or original.

Policy changes deny old text while retaining the record. Source revocation removes
all dependent records before catalog purge completes. Storage integrity alone grants
no source access: use this service for authorized history. See
[verification evidence](../fixtures/loredock-native-capture-history/README.md).

## Ownership and bounds

One actual OperationBudget begins before preparation and covers path derivation,
codec traversal, original validation and publication. A supplied budget retains its
existing charges and deadline and remains caller-owned. Fixed limits cannot be
raised; trusted options can reduce format/work/deadline limits. History honors the
same reduced codec bounds. There is no new user configuration.

A per-store owner rejects overlapping complete capture/history calls, even across
service instances. The existing shared v1/v2 path owner still rejects competing
path reads. Each cooperative boundary checks cancellation, source policy/registry,
local total changes and external SQLite data version. Stop cancels active work,
waits for it to finish and is idempotent; it does not stop injected path readers.
Trusted asynchronous checkpoints and a synchronous final-fence hook are for tests.
They are not request inputs or production diagnostics.

After asynchronous preparation, capture uses a synchronous finalizer: it acquires
`BEGIN IMMEDIATE`, revalidates complete scope and the published analysis snapshot,
and publishes without another await. Releasing the source guard and checking the
final deadline remain inside storage's rollback ownership. A late failure removes
only this invocation's newly linked record; an existing duplicate remains intact.
Persistent source-guard release failure reports `CAPTURE_GUARD_RELEASE_FAILED`,
retains both errors and disables native work until the catalog is closed/reopened.
Filesystem cleanup failure remains explicit through `RECEIPT_CLEANUP_FAILED`.
History takes no publication lock and performs no source writes or path rederivation;
its final scope/epoch/budget checks and output occur in one synchronous continuation.

Counters describe logical charged work, not CPU instructions or memory attribution.
This functional verification is not final composition/resource qualification, dense
project acceptance, runtime coherence, independent semantic acceptance or L5 readiness.
The [independent native assessor](../../scripts/loredock-native-assessment/README.md)
now checks functional outputs. The fresh compiled qualification follows separately. All sixteen
complete operations, seven cross-process comparisons and numerical gates remain.
