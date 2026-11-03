# Offline shared capture budget candidate

Task 075 only; no production API/schema/consumer change. This successor follows the
[resource contract](../../docs/loredock/CAPTURE_RESOURCE_CONTRACT.md). The original Task 073
modules, fixtures and measured results remain unchanged and exhausted.

`budget.mjs` owns one monotonic deadline and accepted phase counters for an operation.
Existing path and receipt charges contribute once, retaining their local caps and all
scope/epoch checks. The shared counter refuses before accepting an over-limit delta. It
cannot be reused after closure or claim a second path read. Standalone path/history reads
own separate budgets, and history has no nested path work. Work units remain a proxy.

`paths.mjs`, `resolve.mjs`, `admit.mjs` and `receipt.mjs` are explicit offline forks, with
original hashes in `baseline.json`. Matching and support rules are unchanged. New adapter,
wire/display/receipt namespaces and an accounting profile identify the derivation. The
reader injects the production work/saved-tree/binding services and composes an internal
shared budget; there is no runtime source rewriting, public budget option or added package.

The receipt guard keeps synchronous final publication and adds cleanup if a final post-lock
check fails. Trusted synchronous publication hooks verify cancellation after linking: only
the new target and its pending file are removed, while identical existing bytes survive.
Cancellation/deadlines remain cooperative around bounded synchronous I/O. This does not
claim a hard process deadline, arbitrary import authenticity or multi-resource crash recovery.

`fixture.mjs` creates owned synthetic sources, including only the explicitly admitted
`not-present` dangling symlink vector. It does not follow symlinks or accept user paths.
`probe.mjs` executes the [frozen one-run protocol](../../fixtures/loredock-capture-scale/README.md)
only when explicitly launched into a fresh absolute output directory. It records preparation
separately, journals exact raw results before checks, and independently sums accepted charge
deltas into per-phase histograms without a large per-charge event log. Failure/cleanup/
observer errors remain distinct. No CI or normal test imports the frozen corpus/probe.

Independent source-level regressions cover aggregate-only exhaustion, nested deadline,
post-link cancellation, historical zero-path accounting and budget ownership. They need no
prebuilt daemon and no model. Their fixtures are separate from the frozen scale inputs.
