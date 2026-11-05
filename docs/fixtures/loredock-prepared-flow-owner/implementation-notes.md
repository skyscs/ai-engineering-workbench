# Kernel-owned orphan cleanup: original implementation plan

This design was recorded before implementation. The [current result](README.md) now
records the implemented owner and ordinary subprocess/application exercises. The text
below preserves the motivation and acceptance criteria of that bounded slice.

The accepted-checkpoint owner discovers process groups by periodic observation. It cannot
prove cleanup for a descendant that forks, changes session/group and becomes orphaned
between observations. The existing report names that limit and does not qualify the gate.

A separate owned probe confirms the local Linux alternative without touching an application
or source family: an outer process enables PR_SET_CHILD_SUBREAPER, starts an intermediate
Node process, and first discovers its detached child only after the intermediate exits.
The kernel reparents the child to the owner. The owner signals it, obtains its actual wait
status and leaves no child behind. Raw source, stdout/stderr and result are retained in
/home/toshiba/aew/task128-subreaper-probe. The installed Linux man-pages 6.17 describe this
behavior in PR_SET_CHILD_SUBREAPER.2const and PR_GET_CHILD_SUBREAPER.2const.

Implement a small Linux-only Python-standard-library external owner for the sealed gate.
Keep the owner itself alive as the subreaper; no interpreter exec transition is necessary.
Verify the actual flag before creating the driver. Discover every thread's child list,
including directly adopted orphans. Reap owned children with wait4 and retain actual exit
status/rusage. Use pidfd_open/pidfd_send_signal with identity/ancestry checks to avoid a
PID-reuse race while terminating. Freeze the driver, drain and then force-stop remaining
owned descendants within bounded cleanup, repeating discovery until the kernel-owned tree
is empty. Never signal a process merely because its name or port matches.

The new owner must preserve raw source/catalog/browser outputs on failure and independently
stop work on the already frozen wall/storage thresholds. It does not alter actual daemon
or Chrome execution, application methods, runtime doubles or resource limits. Its interpreter,
libc/ctypes entry, code, commands and explicit environment belong to the later executable
seal. Keep the Node owner as historical development evidence until the replacement is
verified; do not retroactively claim that old runs used kernel adoption.

Required ordinary checks: a double-fork/new-session child orphaned before the first sample,
driver failure with live children, TERM-resistant descendants, actual retained daemon/browser
failure, storage exceedance and external interruption. Preserve every failed exercise. No
reserved-family candidate observation, model call or product behavior change is needed.
