# Complete runtime layout review

Task 163 is a static review under [ADR 0070](../decisions/0070-loredock-complete-runtime-boundary.md).
The [v2 contract](observable-resource-contract-v2.json), [ADR 0068](../decisions/0068-loredock-observable-resource-contract.md)
and [creation order](../decisions/0069-loredock-creation-ordered-counters.md) remain authoritative.
This document contains requirements and source-supported inferences, not an executable plan
or permission to launch a new candidate. See the [review record](../fixtures/loredock-complete-executor-layout/README.md).

## What the accepted tiny result establishes

Task 162 preserves an original zero root before descendants, separate zero role initials,
durable publications and checked empty admission. One fixed 1-MiB payload is born directly
in `run/probe`; its normal actual wait precedes complete final daemon/browser/root reads
through original descriptors. The unreset root peak is 8,667,136 bytes. The owned group
disappears without forced cleanup. The memory and staged-record assessments pass offline.

This is one successful normal-exit prerequisite on the recorded machine. The daemon and
browser scopes contained no application processes; there was no control workload, HTTP,
Chrome, real model or corporate input. It does not prove full executor qualification.
The 136 first records, 14 sealed service inputs, outside inputs and evidence remain in
the unchanged 176-member [archive](../fixtures/loredock-staged-counter-prerequisite/README.md).
Never rerun its seal, first launch or first assessment to obtain additional evidence.

## Required ownership and communication

```text
fresh delegated user service                 existing manager owns the outer boundary
  attestor                                  minimal owner/watchdog/final receipt, outside run
  run                                       empty domain; original root counters held
    daemon                                  production Node + parser threads + owned helpers
    browser                                 browser lifetime collector + Chrome + descendants
    control                                 request driver + traces/storage + shared setup cost

daemon:127.0.0.1:4244 <--> browser and measured control
browser DevTools loopback endpoint <--> measured control
```

All three role trees must be born in their assigned held groups. No spawn-then-migrate,
helper exclusion or process hidden outside `run` may improve a result. The root peak
includes setup and shared control. A process forked by a role stays in that role unless
an explicitly verified direct-birth helper creates it elsewhere; ordinary child spawning
from `control` therefore cannot stand in for direct daemon/browser creation.

Daemon, browser and controller require the **same isolated network namespace**, with
loopback usable and no host network, external interface, port publication or external
proxy. Preserve the server's exact Host/Origin/CSRF rules and URL. Reading a DevTools URL
from a file does not make its socket reachable from another network namespace.

An outside owner must retain namespace identities and their owning user namespace,
the namespace keeper's PID/start identity, role directory FDs and lifetime receipts.
Namespace handles alone do not prove permission to join, process survival or cleanup.
A keeper belongs to measured `control` and must outlive communication but exit before
final root capture. Its death must stop admission; no replacement namespace can inherit
the old candidate's identity. Any PID-namespace init/reaper and intermediate process is
part of the appropriate role and the actual wait ledger.

| Proposed shortcut | Static finding | Outcome |
| --- | --- | --- |
| Copy the tiny `--unshare-net` command for each role | Each invocation creates a different network; the required loopback endpoints are not shared | Reject this composition |
| Put one broker inside the tiny control-rooted cgroup namespace and pass sibling FDs | With `nsdelegate`, source and destination must be visible below that namespace root; daemon/browser are siblings outside it | Reject this composition |
| Share the host network or migrate already-running children | Changes the isolation or creation boundary | Prohibited fallback |
| Join retained isolated namespaces from an outside direct-birth owner | Potential direction, but user-namespace ownership, join order, capabilities, PID-entry fork, root/cwd and FD closure need a new audited helper | Unimplemented and unqualified; no live trial authorized |

These are source-supported conclusions about the fixed recipes, not claims that every
secure composition is impossible. Linux v7.0's `cgroup_css_set_fork` uses current credentials
and calls the namespace-aware attachment checks; `nsdelegate` requires both groups below
the namespace root. See [the checks](https://github.com/torvalds/linux/blob/v7.0/kernel/cgroup/cgroup.c#L5314)
and [direct creation](https://github.com/torvalds/linux/blob/v7.0/kernel/cgroup/cgroup.c#L6815).
Upstream source is not an attestation of the installed Ubuntu kernel.

Joining user namespaces can grant capabilities **inside that namespace**. PID `setns`
affects later children, not the caller. Thus adding `setns` to the old native command
does not preserve its one-child proof. A future design must verify each trusted setup
transition, independent post-setup identity and capability clearing, then close every
namespace/root/cgroup/outside-attestor control descriptor before application exec. Never grant host
capabilities or assume `no_new_privs` alone prevents namespace privilege transitions.
See [setns semantics](https://man7.org/linux/man-pages/man2/setns.2.html) and
[no-new-privileges scope](https://docs.kernel.org/userspace-api/no_new_privs.html).

## Selected runtimes and file boundary

Keep Node 22.23.2, full Chrome for Testing 157.0.8103.38, Python 3.14.4 and the recorded
non-setuid Bubblewrap. Their executable hashes are in the review record. Installed
Bubblewrap is `0.11.1-1ubuntu0.3`; upstream v0.11.1 is a reference, not proof of identical
distribution patches. Its [setup implementation](https://github.com/containers/bubblewrap/blob/v0.11.1/bubblewrap.c#L2949)
rejects `--userns` with `--unshare-user`, requires unsharing for `--disable-userns`, and
uses a nested payload namespace to enforce the restriction. An existing namespace join
cannot blindly reuse the complete tiny command's flags.

The frozen browser collector already supplies `--headless --no-sandbox --disable-gpu
--disable-background-networking --remote-debugging-port=0`, a fresh profile and `about:blank`.
The current source tag [defines no-sandbox](https://github.com/chromium/chromium/blob/157.0.8103.38/sandbox/policy/switches.cc#L42)
as disabling normally sandboxed process types. Its [zygote initialization](https://github.com/chromium/chromium/blob/157.0.8103.38/content/browser/zygote_host/zygote_host_impl_linux.cc#L102)
returns early for that flag; otherwise it selects namespace or setuid support.
The retained local `chrome_sandbox` is UID/GID 1000, mode 0755, not setuid. Nested userns
creation is denied by the tiny profile and `no_new_privs` prevents setuid exec escalation.
Removing the existing flag therefore has no demonstrated compatible inner-sandbox route.
Keep the declared flag and limitation; do not chmod/install a helper, change runtime or
relax the outer profile to obtain a result. This is a compatibility inference, not a Chrome run.

The tiny sandbox's read-only `/usr` does not contain the selected Node or Chrome binaries.
A future application manifest must bind exact verified runtime closures, emitted modules,
package-resolution symlinks, public UI files, required libraries/fonts/configuration and
synthetic source snapshots at fixed read-only destinations. A binary hash alone is not a
dependency-closure audit. No whole home, repository checkout, user profile, Codex auth,
DBus socket, Docker socket or host cgroup mount may be exposed. Do not install `/usr/bin/node`
or change the host toolchain merely to make the existing tiny loader accept it.

Writable catalog/WAL, browser profile/home/cache, temporary files, private shared memory
and evidence must be freshly owned and included in storage accounting. Record exact mount
identities, ownership and cleanup scope. Neither private path names nor a common UID prove
cross-role isolation; the outside attestor's controls and receipts must stay inaccessible
through mounts, `/proc`, inherited FDs or a shared writable evidence root. Preserve app
Host/Origin/CSRF and source authorization; an external sandbox cannot replace them.
Exact runtime closures and writable layout are **not yet sealed**.

Freeze environment and FD allowlists per role. Fixed runtime PATH/locale, owned data/output
paths and fresh browser HOME/XDG paths are sufficient inputs to review; never inherit the
parent's arbitrary environment, authentication or proxy variables. Keep standard streams
bounded. The controlled daemon may additionally receive one explicitly owned Node IPC
channel from measured control; that application test channel is distinct from the outside
attestor's admission/cleanup authority. Its descriptor, message schema, closure and storage
cost must be declared. It does not authorize passing cgroup or namespace handles to Node.

## A separate application parity defect

The frozen [controlled bootstrap](../../scripts/loredock-prepared-flow/launcher.mjs) uses
`new CodeAnalysis(catalog)`, starts following before listen and manually closes services.
The current [production owner](../../apps/loredock/src/server.ts) instead awaits
`CodeAnalysis.create`, warms and verifies the parser before listen, owns cancellation
during startup, and waits for actual parser shutdown before closing storage. The old
bootstrap's header describes its historical baseline; it is not a current parity proof.

Do not edit that frozen file or invoke an exhausted family. The next narrow change should
inject only a controlled TextRuntime into the current owner and use it from a new launcher.
No duplicate Catalog/analysis/HTTP wiring, emitted-method patching or alternative parser
mode is needed. Explicit controlled diagnostics remain separate from ordinary resource
observations. Verify startup failure, interruption, answer dispatch and real shutdown
with local synthetic tests; no model or qualification-family execution follows.

## Evidence still required before a complete executor result

| Boundary | Existing evidence | Missing observation and outcome |
| --- | --- | --- |
| Manager ownership | Dedicated invocation and held topology in Task 162 | Re-establish for each new candidate; mixed/replaced owner is UNAVAILABLE; never clean up foreign identities |
| Root/role counters | Original staged zero reads and final same-FD retention on one tiny exit | Preserve this order with populated roles and measured control; lost/replaced/reset final data is UNAVAILABLE, not the last live sample |
| Ancestor controls | Mount mode and parent topology | Bind every relevant ancestor's held/named identity and effective memory/swap/CPU/cpuset/PID controls; read before admission and after closure, retaining errors and available pressure/event diagnostics. Change/unknown constraint is UNAVAILABLE; two snapshots do not prove no intervening change |
| Direct role birth and isolation | One `run/probe` child and independent pre-exec gate | Three-role birth, shared loopback, namespace ownership/lifetime, root/cwd, caps/FDs/environment and prohibited-path access; positive escape/leak is FAIL, missing proof UNAVAILABLE |
| Actual tree exit | One normal direct-child wait and empty target | Short-lived descendants, reparented orphan, role collectors and namespace keeper; actual wait ledger plus hierarchical `populated=0`, not just empty `cgroup.procs` |
| Interrupted collection | Offline failure cases | Separate fixed orphan/interruption controls, raw partial records/errno and final retention loss; missing terminal evidence UNAVAILABLE, independently known failure remains FAIL |
| Watchdog and cleanup | Normal stop; frozen bounded ownership checks | Exact-invocation forced cleanup and actual remaining-tree verification; timeout/forced kill fails a positive normal case even when cleanup succeeds |
| Outside attestor cost | Partial self RSS/CPU and external wall diagnostics | Complete attestor/owned-helper wait and usage intervals, retained bytes and explicit gaps; rounded systemd totals are not exact or additive with root memory |
| Application behavior | Existing functional tests and preserved historical results | Current controlled/ordinary bootstrap parity, source/work/storage/HTTP/timer/browser evidence and useful cases. Tiny memory PASS supplies none of these |
| Semantics and bridge | Historical failures remain recorded | Independent semantic/private-pilot and L5 acceptance; no routing or Workbench promotion |

The memory assessor and receipt schema stay immutable. Ancestor, namespace and exit
evidence belongs to a separate executor record, not invented fields in a memory receipt.
Keep missing-evidence reasons beside known violations. No claimed `qualified` boolean,
manager exit code or offline transcript consistency establishes a live executor.

## Next bounded work and later live gate

[Task 164](../../tasks/164-loredock-controlled-server-parity.md) is independent functional
work: one internal runtime seam, one new controlled launcher and lifecycle tests on fresh
synthetic catalogs. Default startup, public API, schemas, ordinary answer selection and
experimental switches stay unchanged. No delegated services/cgroups/namespaces/Chrome/models or
consumed qualification entries are used. It is not a new resource candidate.

Native expansion remains stopped pending a separately reviewed, concrete shared-namespace
handoff implementation with intercepted-syscall tests and exact descriptor/capability
transitions. Only then may a new task seal a tiny three-role gate. Its prospective maximums
are three role entries, sixteen total owned processes, two one-MiB short-lived allocations,
one loopback exchange of at most 1 KiB per direction, 10/5/2-second service/start/stop and
25-second outer watchdog. Keep 4-KiB interface reads, 64-KiB streams, 1-MiB receipts, one
pending receipt and 2-MiB total first output. These are bounds for a later reviewed gate,
not permission to run or impose host CPU/memory limits. Freeze the exact process topology,
commands, runtime closure, clocks, inputs, expected failures and exclusive first paths
before execution. If it cannot fit, stop and review; do not increase bounds after a failure.

That gate must establish shared isolated communication, each direct role birth, unchanged
security, actual complete normal exit and final same-FD retention. Predeclare separate
orphan/interrupted-recorder cases with their own exclusive first records; never retry a
failed normal case under changed settings. An unavailable actual capability ends the
candidate without host policy edits or environment fallback. No application/Chrome gate
opens until all required executor axes are independently evidenced. Application resources,
the preserved 35 non-memory limits and model semantics still require later fresh gates.
