# Kernel-owned process cleanup development

This is the next in-progress Task 128 slice after [PR #132](https://github.com/skyscs/ai-engineering-workbench/pull/132).
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

[records.json](records.json) binds all probe source, stdout/stderr and result bytes plus
raw logs. The [implementation notes](implementation-notes.md) specify the next external
owner change. That owner is not implemented by this checkpoint; these small probes do
not qualify all descendant races, full application shutdown or the prospective resource
gate. The previous Node owner's observations and limitations remain unchanged.

The reserved kiln family still has zero candidate reads. No oracle, threshold, accepted
application runtime, experimental default or frozen Task 128 scope has changed.
