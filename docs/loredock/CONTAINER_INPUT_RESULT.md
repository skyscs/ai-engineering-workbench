# Readable container inputs: first browser resource control remains failed

Status: Task 147 is accepted through PR #180 (head `6e36976`, merge `e673d43`), with
both complete CI logs passing 1,169 tests, ten typechecks and ten final builds.
Directory ownership and non-root input verification are fixed. The first blank-browser
lifetime completes and remains ineligible under the unchanged resource contract.

Task 146 is accepted through [PR #179](https://github.com/skyscs/ai-engineering-workbench/pull/179),
head `f60e6f4`, identical-tree merge `4b501a7`. Both complete CI logs pass 1,157 tests,
ten typechecks and ten final builds. Task 147 fixes its prospective code at `f4c9487`
and commits the concrete first-launch manifest at `c3b5f37` before one browser lifetime.
All earlier failed attempts and containers remain retained without retry.

## Input correction and prerequisites

The new image gives copied Chrome inputs UID/GID 1000 ownership and explicitly preserves
the source root's `0775` mode. Every original file byte/mode and nested directory mode stays
unchanged, including the empty `0700` directory. No host toolchain permission is modified.

The [shared input verifier](../../scripts/loredock-container-browser/inputs.mjs) checks all
301 files and all 12 directories, including empty entries, their types/modes/owners,
canonical parents and actual read/traverse access. Missing/extra directories, symlinks,
changed identity or unreadable inputs fail. The same non-root verifier runs during image
construction, before each lifecycle probe, and before/after the browser lifetime. Both
preflight and the launcher require matching successful input receipts.

The first image build passes in 26,634.018 ms. It preserves the first six base/dependency/
user filesystem layers and exact installed dependency versions from Task 146. Its 330
staged files (552,294,995 bytes), 26 host helper inputs and 61 preflight files stay exact.
The concrete image is:

```text
sha256:480c5c77ed525237b731fa7f82e6124e86a272a0f5609091dfd738c37934e0ea
```

All three first non-browser preflights pass with enforced default AppArmor, seccomp mode 2,
no-new-privileges, zero capabilities, UID/GID 1000, verified inputs and actual container exit 0:

| Case | Container ID prefix | Wrapper elapsed |
| --- | --- | ---: |
| Normal | `62d1247149a4` | 708.366 ms |
| TERM-resistant orphan | `de5fd1ab19c4` | 10,758.391 ms |
| Host interruption | `d0ca66b7ba94` | 10,858.817 ms |

Expected induced failures, pidfd signaling/reaping and no-survivor receipts remain explicit.
The build-time image file inventory still excludes general directory metadata and includes
builder-injected `/etc` files. Browser directories have their own complete verified records;
no claim of byte-identical runtime-injected files is made.

## First blank lifetime

Container `21a6ef25ee6faac25dd5c3f2342362346b6e16d4babefa339074c857c7c3f77c`
starts once. Input verification passes before and after Chrome. The empty-page idle interval
lasts 30,000.303 ms with zero API requests, pending requests or recorded long tasks.

| Observation | First result | Existing requirement |
| --- | ---: | ---: |
| Maximum collector-inclusive summed RSS | **1,309,532,160 bytes** | At most 1,073,741,824 |
| Complete samples | **603 / 606** | All complete |
| Maximum sample-start gap | 55.633 ms | At most 100 ms |
| Startup / terminal sample gap | 3.985 / 14.509 ms | At most 100 ms each |
| Browser exit / remaining survivors | 0 / none | Successful exit / none |
| Container exit | 1 | Negative assessment retained |
| Wrapper / complete launch | 31,634.086 / 32,201.418 ms | Existing deadlines unchanged |

The peak is a complete 15-process sample, and 596 samples exceed the RSS ceiling.
This is not a missing-value artifact. Three incomplete samples remain failures:

- Index 5: resident memory unavailable for one process and identity/parent changed for another.
- Index 604: a process exits during the sequential sample.
- Index 605: thread/process exits occur while the terminal sample is being read.

No missing value becomes zero credit, and no incomplete sample is discarded to pass the
control. The original collector/assessment and 1-GiB summed-RSS metric remain unchanged.
The Node driver and wrapper return failure because assessment fails; the browser exits 0.
Both ownership layers record no errors or survivors, and Docker confirms the stopped state.

An offline join of retained namespace process titles by PID and start ticks attributes
636,440,576 peak bytes to renderer roles, 222,519,296 to the browser root, 155,119,616 to
zygotes, 117,747,712 to network service, 94,003,200 to GPU, 53,452,800 to storage service,
22,831,104 to the lifetime collector and 7,417,856 to crashpad. These are observed role
categories only; they do not establish extension identities, host policy or causal effects.
Outer namespace/observer measurements remain separate from the fixed browser metric.

## Verification and next decision

[Portable evidence](../fixtures/loredock-container-inputs/README.md) retains all operational
records and raw samples. Twenty-eight focused tests and the full local check pass
**1,169 tests** (728 LoreDock, 306 scripts, 135 other tests), ten typechecks and ten final
builds, with no failures or cancellations. Both complete exact-head CI logs passed before
merge and are retained with Task 148's evidence. All 95 emitted LoreDock JavaScript files, application sources, original
collectors and the frozen API remain unchanged.

[Task 148](../../tasks/148-loredock-resource-gate-feasibility.md) reviews the retained
resource evidence and defines a feasible next qualification path before another run.
It distinguishes the standalone browser's failing baseline from application behavior and
keeps sampling completeness separate from RSS. No automatic metric/limit/security change,
new browser experiment or retrospective acceptance follows. Daemon aggregate-heap/startup
and application/full-flow qualification remain blocked. No real model or corporate source ran.
