# Readable container input and first blank-browser evidence

The [result](../../loredock/CONTAINER_INPUT_RESULT.md) records prospective source `f4c9487`,
manifest `c3b5f37`, a successful image/non-root input check, three successful lifecycle
preflights and one completed blank lifetime with a failed resource assessment.

- `preflight.tar.gz`: all 61 files from the first normal/orphan/interruption cases,
  including actual security, input-verification, identity and stopped-state receipts.
- `first-attempt.tar.gz`: 36 operational records, including all 606 raw RSS samples,
  separate namespace/storage observations, input checks, actual exits and negative assessment.
  Fresh profile/cache/home/temporary runtime files remain local and are excluded explicitly.
- `helper-inputs.tar.gz`: all 28 staged helper/control inputs and the Dockerfile. The old
  consumed Task 146 launch manifest is excluded from staging and preserved in its own archive.
- `image-metadata.tar.gz`: 14 build/image/dependency records, including the complete build
  log and successful build-time input verification as UID/GID 1000. Only the empty Docker
  client configuration is published; unrelated client bookkeeping remains local.
- `receipts.tar.gz`: the committed manifest, exclusive claim, complete launch outcome,
  input/lifecycle/resource reviews and both accepted Task 146 CI results.
- Each `*-files.json.gz` contains every member's original size and SHA-256.
- `staged-files.json` retains all 330 staged-file identities (552,294,995 bytes).
  Public Chrome/Node payloads remain local; all bytes and complete browser directory
  metadata are bound by the staged/control manifests and actual input receipts.
- `logs/` retains nine closed complete logs: both Task 146 CI events, focused tests,
  preparation, install, image build, the 1,169-test full check, preflight and first browser.
- `records.json` binds exact source/image identities, archive/log hashes and exclusions.

Original roots are `/home/toshiba/aew/task147-image-inputs-first`,
`/home/toshiba/aew/task147-image-build-first`,
`/home/toshiba/aew/task147-container-preflight-first` and
`/home/toshiba/aew/task147-container-browser-first`. All first paths and the claim are
consumed; do not reset or rerun them. All four containers are retained stopped.
No resource/full-flow acceptance, corporate source or model output is included.
