# Container security: verified lifecycle, unreadable browser input

Status: the security and lifecycle prerequisites pass; the first blank-control attempt
fails before Chrome starts. Browser resource eligibility remains unmeasured.

Task 145 is accepted through [PR #178](https://github.com/skyscs/ai-engineering-workbench/pull/178),
head `e989891`, identical-tree merge `42830f5`. Both complete CI logs pass 1,150 tests,
ten typechecks and ten final builds. Its unstarted container and first failure remain
unchanged. Task 146 commits the prospective correction at `d956155` and the concrete
first-launch manifest at `1e05117`, before consuming any browser launch attempt.

## Security and ownership

The controller now explicitly requests `apparmor=docker-default`. Empty applied-profile
metadata is allowed only on an unstarted created object with PID 0 and an unset start time.
Running/exited objects require the resolved default profile. A failed runtime security
check still permits cleanup of the already verified exact container ID; it never turns
that failed check into a successful control. All existing deadlines and one-start rules remain.

Before starting a child, PID 1 records and verifies its own applied `docker-default (enforce)`
label, seccomp mode 2, no-new-privileges, UID/GID 1000 and zero capability sets. Missing or
relaxed restrictions fail. The [source audit](../../scripts/loredock-container-browser/README.md)
links the exact installed Docker engine commit and explains the start-time profile selection.
No host browser profile, policy file or daemon configuration was inspected or changed.

The first image build passes in 5,630.415 ms. Its first eight root filesystem layers and
dependency versions match Task 145, including the exact Chrome and Node files. All
328 staged files (552,283,125 bytes) remain unchanged. The image is:

```text
sha256:f7d6e9bacbb22f384e6fe965ee4bf4be7002545acf3e779b900e95f5e6fdef2b
```

The three first non-browser preflights pass with actual stopped-state receipts, applied
security checks, no inner errors or survivors, and the kernel owner below PID 1:

| Case | Container ID prefix | Wrapper elapsed | Actual container exit |
| --- | --- | ---: | ---: |
| Normal | `69ce290596ab` | 622.168 ms | 0 |
| TERM-resistant orphan | `d682ddd2af47` | 10,721.776 ms | 0 |
| Host interruption | `ef99c7babc26f` | 10,878.605 ms | 0 |

The latter cases deliberately fail the inner operation and require actual pidfd KILL/wait
receipts for the resistant child. Host interruption propagates through the controller,
Docker and PID 1. These expected induced failures remain in the raw records. They do not
hide unexpected failures or prove that browser inputs are readable.

## First attempt and directory finding

The exclusive launch creates and starts container
`019f3f8e9f40c9461b726f49a2f2dc8746643a99f9526d5d266b8eeafd25b861` once. Its security
checks pass, but the Node observer fails while checking the browser tree:

```text
EACCES: permission denied, scandir '/opt/chrome/extensions'
```

No Chrome process or browser lifetime collector is started. Lifecycle, browser, idle and
assessment fields remain null; there are **zero browser samples** and no RSS score.
The sole observer is reaped, inner errors/survivors are empty, and Docker confirms exit 1.
Wrapper time is 457.360 ms; launch time is 1,049.654 ms. Host/staged/preflight inputs remain
unchanged. Inner input verification fails because the tree cannot be read. The consumed
claim/output/container must not be reset, retried or repaired in place.

Read-only metadata inspection of this owned public toolchain and its copies establishes:

| Empty `extensions` directory | Mode | UID:GID |
| --- | --- | --- |
| Original standalone installation | `0700` | `1000:1000` |
| Staged copy | `0700` | `1000:1000` |
| Container image | `0700` | `0:0` |

The Dockerfile uses ordinary `COPY`, which defaults to root ownership while preserving
source permissions. Docker documents explicit ownership through
[`COPY --chown`](https://docs.docker.com/reference/dockerfile/#copy---chown---chmod).
This explains the observed access failure. It does not establish the directory's origin,
an extension identity or the cause of earlier host-browser memory measurements.

The previous file/hash inventory omitted directory metadata, including empty directories.
The image inventory is a **build-time file/symlink inventory**, including builder-injected
`/etc` files; it is not proof of complete runtime filesystem metadata or readability.
The immutable image/layer identities and exact file bytes remain useful evidence, with
that limitation stated explicitly.

## Verification and next step

[Portable evidence](../fixtures/loredock-container-security/README.md) retains the original
attempt, all three preflights, exact helper/image inputs, security/exit receipts, directory
audit and ten complete closed logs. Sixteen focused regressions and the full local check
pass **1,157 tests** (728 LoreDock, 294 scripts, 135 other tests), ten typechecks and ten
final builds, with no failures or cancellations. Both complete exact-head CI logs must
pass before merge. Application bytes, original collectors/API and numeric limits are unchanged.

[Task 147](../../tasks/147-loredock-container-input-readability.md) fixes image ownership
prospectively and checks complete directory metadata and actual non-root readability
during construction/preflight, before a new single-use control. It preserves this failure,
all earlier attempts, default security, browser flags and resource metrics. No daemon,
application UI, real model or corporate source ran. Daemon aggregate-heap/startup and
application/full-flow qualification remain blocked.
