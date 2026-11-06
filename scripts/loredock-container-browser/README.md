# Prospective container control

Task 145 implements [ADR 0066](../../docs/decisions/0066-loredock-independent-browser-container.md).
The production application and original collectors remain unchanged. All commands here
are single-use local test infrastructure, not application setup requirements.

Build inputs are staged exclusively at `/home/toshiba/aew/task145-image-inputs-first` by
`prepare.py` from a clean committed candidate. They include only audited scripts, exact
Node/Chrome files and public Python/Debian dependencies. Freeze the resulting image ID,
config/layers, dependency/runtime inventories and build log before the first browser.

`owner.py` persists the create response before any start, checks exact image/config/mounts
and owns only that full ID. Each API call has a five-second deadline, the host execution
deadline is 160 seconds, cleanup uses fifteen seconds for TERM and five for KILL, and
every actual stopped state is inspected. No retry, name lookup, workload listing, automatic
removal or restart. Stopped containers remain available for evidence verification.

The non-root PID-1 `init.py` starts the frozen kernel owner below PID 1. Its 120-second
inner limit, ten-second cleanup grace and five-second forced-exit wait are unchanged;
the wrapper has an independent 150-second deadline. Private namespace census and entire
evidence/private-shm storage observations are retained at a nominal 500-ms interval.
They are diagnostic additions; the original browser collector-inclusive RSS metric stays
separate. No system browser configuration, credentials or corporate sources enter the image.

`preflight.py` owns one exclusive normal/orphan/interruption set in
`/home/toshiba/aew/task145-container-preflight-first`. The orphan ignores TERM; success
requires its real pidfd KILL/wait receipt. Interruption sends TERM to the host controller,
then verifies forwarding through Docker/PID 1 and actual stopped state. Expected induced
failures are recorded explicitly. Any unexpected preflight failure stops the sequence.

Only after these prerequisites pass may a committed concrete manifest authorize the one
browser lifetime. `observe.mjs` opens a thirty-second blank page with the same browser
flags, and `adapter.mjs` declares only import/page relocation and a 50-ms nominal timer.
The unchanged assessment still requires actual gaps at most 100 ms and summed RSS at most
1,073,741,824 bytes. The optional former sequential PSS diagnostic is not performed;
raw namespace process/role observations remain separately visible. No subtraction or metric
substitution follows. The source and adapted script hashes are retained.

No browser first output is authorized by this preparatory commit alone. The image identity,
passed preflight receipts and exact first launch manifest must be committed first. Preserve
all build/preflight/control failures without rerunning their exclusive output paths.
