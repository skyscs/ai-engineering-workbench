# Terminal memory diagnostic evidence

Task 087 first verifies the complete lifecycle boundary with independent tiny
fixtures, before authoring or observing the fresh large family. These development
attempts are not resource qualification and do not replace any prior score.

## First integration failure

`development-validation.json` identifies all retained files and compressed logs.
The `first-integration/` tree contains both complete raw heap snapshots, metadata,
worker/parent reports, every raw operation/receipt, both parser outputs, stdout,
stderr and process exits. Gzip decompression reproduces each original byte length
and SHA-256. Databases, generated Git repositories and duplicate receipt files
remain local at the recorded original path; they are not needed for offline review.

All eight operations and both heap exports completed. The second offline parser
exited zero and wrote its summary, but the parent rejected a `/proc` sample whose
state was `R` and whose memory section was absent. Task 086 had incorrectly assumed
that absent RSS implied a zombie state. The first attempt remains failed.

Linux [v7.0 proc status implementation](https://github.com/torvalds/linux/blob/v7.0/fs/proc/array.c)
emits the memory section only when `get_task_mm` succeeds; state and memory presence
are not one atomic observation. An exit race is the interpretation of the saved
status and clean parser exit, not a claim about memory ownership. Before the new
freeze, the observer was corrected to record missing samples without fabricated
zeros, stop after child exit, and fail continued unavailability at 100 ms.
Pure regressions cover missing/recovered/malformed samples; actual child and
complete-application regressions verify the process boundary.

The second tiny full-process run passed. The original failed result and both graphs
remain unchanged. Large-family execution and its conclusions will be recorded
separately after the protocol freeze.
