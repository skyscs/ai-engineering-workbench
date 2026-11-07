# Corrected empty-controller admission

Task 156 corrects the helper defect retained by the
[first direct-birth prerequisite](DIRECT_BIRTH_PREREQUISITE_RESULT.md). That attempt,
its code, claims, failed-unit state and all first records remain consumed and unchanged.
No new first attempt has run at this prospective revision.

The separate [adapter](../../scripts/loredock-empty-controller-prerequisite/probe.py)
uses a new manifest schema, task-specific unit/output and exclusive entries. Its native
source, capture and protocol modules are pinned to the accepted Task 155 bytes; acquisition,
ownership, sandbox and payload dependencies retain their earlier pins. It changes neither
the direct-birth mechanism nor any namespace/security/work/deadline boundary.

The [owned-leaf reader](../../scripts/loredock-empty-controller-prerequisite/leaf.py)
recognizes the kernel's zero-byte empty controller list. Nonempty lists must contain unique
lowercase controller names separated by single spaces and end with a newline. It rejects
newline-only input, extra whitespace, malformed names, duplicates and oversized text.
Raw reads are retained exactly; no newline is added and no whitespace is normalized.

Enabled controller names must be present in that held directory's available list. Only
memory is enabled, and only inside the new owned unit/run directories. Existing enabled
controllers are preserved; the available list and resulting enabled set are checked after
the write. The target must expose memory, have no enabled subtree controller, be an empty
domain and report empty processes/events. Unknown available names carry no added authority;
unknown enabled names cannot authorize mutation. This interprets lists as membership data,
not permission to change additional controllers.

The [versioned kernel formatter](https://github.com/torvalds/linux/blob/v7.0/kernel/cgroup/cgroup.c#L3136)
and retained unit/run/target observations support the zero-byte rule. The upstream source
is not attestation of the complete installed kernel. A separate actual first attempt is
still necessary to establish direct creation and namespace behavior; the prior attempt
never executed the native helper and establishes no clone3 capability failure.

## Verification before the sole attempt

Eighteen new offline regressions cover canonical/malformed lists, enabled-name membership,
missing/changed availability, preserved controllers, target eligibility, replacement and
errors between mkdir/open/snapshot. A temporary-filesystem kernel double starts from the
exact retained controller/type/process/event bytes and exercises the complete leaf creation
method. It permits writes only to its temporary owned unit/run control files.

The complete mocked service path then reaches native capture exactly once, independently
validates and retains the supplied pre-exec child observation, and checks normal exit and
empty target evidence. Invalid target input never reaches capture. Claims and internal
entries reject reuse; held child-directory descriptors close on normal and failing paths.
These tests do not contact systemd, write actual cgroups or execute native code/Bubblewrap.
The original 34 direct-birth, 20 acquisition, 20 ownership and 16 transport cases remain
independent checks; their passing results do not replace live qualification.

After full checks and review, commit and seal one fresh candidate with the same installed
compiler/runtime and fixed inputs. Admit at most one service/clone3/sandbox/payload and
one explicit 1-MiB allocation. Keep 10/5/2-second service bounds, four-second native control,
five-second capture, 25-second launcher, 64-KiB streams, 1-MiB records and 2-MiB output.
Preserve failure; missing actual capability ends the path without environment tuning.

A pass could establish only the direct-birth and fixed namespace prerequisites. Counter
lifetime, ancestor controls, orphan/interrupted-collector scenarios, application resources
and timing, semantic quality and the Workbench bridge remain outside this task.
