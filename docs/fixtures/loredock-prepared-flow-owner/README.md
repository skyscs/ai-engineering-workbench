# Kernel-owned process cleanup development

This is an ordinary Task 128 development slice after [PR #132](https://github.com/skyscs/ai-engineering-workbench/pull/132).
Both push 41964013784 and pull_request 41964018496 pass 948 tests at
`3469467ea7504b6f35748c838a2d47b19cca98b1`. Merge `f59530782fd63c289c0daa50ae850cd19eed33f4`
has an identical tree. The two complete CI logs are retained here. The primary demo
checkout remains unchanged at `592bbc085d9405db86461d47fda5f3382bbaccde`.

Two isolated Linux probes pass. Each creates an intermediate owned Node process whose
child starts a separate process group; the intermediate exits before the owner's first
observation. With the actual child-subreaper flag set, the kernel adopts that orphan into
the owner. It is discovered, signalled and reaped with no remaining child. The second probe
uses a pidfd for signal delivery and wait4 for the actual exit status and OS high-water RSS.
Both recorded the expected SIGTERM exit. The local interpreter is Python 3.14.4; these
are owned process probes, with no daemon, application input or model execution.

[records.json](records.json) binds those original probes and the previous CI logs.
The [implementation notes](implementation-notes.md) preserve the design recorded before
implementation. The replacement [external owner](../../../scripts/loredock-prepared-flow/kernel-owner.py)
is now implemented and exercised against actual daemon and Chrome lifetimes. The previous
Node owner's observations and limitations remain unchanged; earlier runs did not use
kernel adoption.

## Implementation and execution

The Linux-only Python standard-library process enables and verifies child-subreaper mode
before launching the driver. It discovers children from every kernel thread's child list,
including adopted orphans, checks identity and ancestry, and signals through pidfds.
It freezes the driver during cleanup, drains descendants, escalates when necessary,
and uses wait4 to retain actual exits and OS usage for children it reaps. Successful
cleanup requires an empty kernel child tree. Process names, ports and recorded PID files
never grant authority to signal an unrelated process.

The owner checks wall time and samples owned storage, with maximum settings equal to the
existing 40-minute and 2-GiB ceilings. Storage traversal uses directory descriptors and
O_NOFOLLOW, including when opening a directory that may have changed during traversal.
Raw outputs remain on every outcome. The owner always reports `resourceQualification: false`;
it does not implement or substitute for the complete frozen resource assessor.

From a built checkout with Node 22 and Linux/Python 3.9+ supporting pidfds:

```sh
repo="$(pwd -P)"
python3 -I -S scripts/loredock-prepared-flow/kernel-owner.py \
  --node "$(node -p 'process.execPath')" \
  --script "$repo/scripts/loredock-prepared-flow/browser-development.mjs" \
  --output /absolute/new-owned-output-directory
```

The output directory must not already exist, and all supplied paths must be canonical
and absolute. Interpreter isolation and disabled site initialization are required.
Python is an evaluation-tool requirement; the application launch remains unchanged.
The owner's explicit child environment is retained in `command.json`. This ordinary
checkpoint does not seal the later reserved-family executable/runtime closure.

## Ordinary verification

[execution-records.json](execution-records.json) binds complete raw output archives,
per-file inventories, retained source scripts and verification logs. Browser profiles
and caches remain locally retained and are excluded from the published archives; the
full stopped-tree inventories and storage totals include them. No output is deleted.

Six subprocess tests exercise adoption before first observation, normal completion,
driver failure with a TERM-resistant detached orphan, wall timeout, storage exceedance
and external interruption. An unrelated sentinel survives a forged PID-file entry.
The normal case also confirms that storage sampling does not follow an external directory
symlink. The focused test commands retain every temporary directory.
The local `pnpm check` passes 954 tests (17 Git, 18 adapter, 43 storage, 664 LoreDock,
57 daemon and 155 script tests), strict typechecks and production builds. The original
application/input seal validates without a candidate read of reserved sources.

| Actual application exercise | Owner outcome | Retention result |
| --- | --- | --- |
| Core HTTP flow, answer replay and actual-entry reopen | Completed, no survivors | Original sources and stopped catalog preserved. |
| Built UI in Chrome, desktop and 390px layout | Completed, no survivors | Browser observations and one durable answer preserved. |
| Deliberate driver exit 7 after browser Ready | Driver-left-owned-process, cleanup succeeded | Owner reaped abandoned daemon/browser processes; one durable answer preserved. |
| External SIGTERM after browser Ready | Owner-SIGTERM, cleanup succeeded | Owner drained/reaped the tree; one durable answer preserved. |

Each stopped data tree was copied before SQLite inspection. Integrity and foreign-key
checks pass, each retains one successful answer and witness, and all original source
hashes match. Full raw trees remain byte-identical after inspection. Deliberate failure
and interruption remain nonzero owner outcomes; cleanup success does not relabel the
interrupted application exercise as a completed run. Partial browser journals have no
invented closing events or normal driver `exit.json` records.

The first core run and first focused test pass preceded the final no-follow storage
traversal. They remain ordinary earlier-revision evidence. The later browser, crash,
interruption and focused test runs use the final traversal. No earlier artifact is
rewritten to imply execution with the later code.

## Limits and next work

Storage is sampled, not a filesystem quota: growth between samples can exceed a ceiling.
Interrupted/deadline-limited samples explicitly report `complete: false`. Final result
and journal bytes are written after sampling; the independent stopped-tree inventory
therefore supplies the complete final storage total. A stopped-tree total does not
recover an unobserved transient peak. The eventual gate must assess all recorded
measurements and retain any incomplete observation as such.

The owner cannot survive its own SIGKILL or machine loss, and uninterruptible kernel work
can exceed the bounded cleanup wait. Such outcomes do not establish cleanup. The raw
signals, wait results, errors and survivors remain evidence, rather than a blanket
guarantee for every OS failure. Zombie exits reaped by an intermediate parent have that
parent's retained observations; wait4 does not retroactively supply a per-child report.

The first-preflight and deterministic in-preparation fault boundaries, complete R01–R15
driver/assessor and final pre-observation seal remain pending. Known ordinary history-work,
browser-RSS and startup-delay exceedances remain failures against the prospective limits.
This checkpoint does not make a performance, semantic-quality or product-readiness claim.

The reserved kiln family still has zero candidate reads. No oracle, threshold, accepted
application runtime, experimental default or frozen Task 128 scope has changed.
