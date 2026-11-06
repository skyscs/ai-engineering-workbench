# First container preflight: retained pre-start failure

The [result](../../loredock/CONTAINER_BROWSER_ELIGIBILITY.md) records candidate `d13b5a4`,
its successful pinned image build and failed first preflight. One container object was
created; no start request, container process or browser execution occurred. The retained
object remains in `created` state with Running false/PID 0. Do not start or repurpose it.

- `preflight.tar.gz`: every regular file from the first preflight directory, including exact
  create/inspect responses, durable identity/intent, validation failure and host outcome.
  The empty `normal/evidence` directory contains no runtime output and no archived files.
- `helper-inputs.tar.gz`: exact first staged helper/control inputs and Dockerfile. These
  retain the prospective README/code at `d13b5a4`, before the later result documentation.
- `image-metadata.tar.gz`: build command/outcome, exact local image ID/config/layers,
  7,259 image entries, dependency versions/library resolution, read-only extraction receipts
  and final unstarted-container inspect. The fresh Docker client configuration is `{}`.
- The corresponding `*-files.json.gz` files enumerate every archived byte/hash.
- `staged-files.json`: all 326 original build-context files and hashes. Every file was
  reverified after construction/preflight. Large public Chrome/Node payloads remain local;
  `records.json` declares their exclusion and exact byte count. The Chrome installation is
  already bound by [Task 143's evidence](../loredock-browser-eligibility/README.md).
- `logs/`: nine closed complete logs, including both accepted Task 144 CI events, two
  passing focused runs, staging/install/build, the full 1,150-test check and failed preflight.
- `records.json`: source/image/container identities, complete archive/log hashes, reviewed
  checks and explicit unexecuted browser scope.

Original local roots are `/home/toshiba/aew/task145-image-inputs-first`,
`/home/toshiba/aew/task145-image-build-first` and
`/home/toshiba/aew/task145-container-preflight-first`. They are consumed and must not be
reset or rerun. No browser output directory or concrete browser launch manifest was created.
The orphan/interruption preflight cases remain unexecuted. Source/application/API/collector
bytes and resource ceilings stay unchanged; no runtime or full-flow eligibility follows.
