# Container security and first input-verification failure

The [result](../../loredock/CONTAINER_SECURITY_RESULT.md) records prospective source
`d956155`, concrete manifest `1e05117`, three successful non-browser lifecycle preflights
and one consumed launch attempt that fails before starting Chrome. No browser measurement
or resource acceptance follows.

- `preflight.tar.gz`: all 58 files from the normal, orphan and host-interruption cases,
  including applied-security, exact-ID, actual-exit, pidfd and no-survivor receipts.
- `first-attempt.tar.gz`: all 17 files from the consumed first attempt, including the
  `EACCES` input failure, observer reap and actual container exit 1. No browser profile
  or browser lifetime directory was created.
- `helper-inputs.tar.gz`: all 26 staged helper/control files and the Dockerfile at the
  prospective revision. The large public Chrome and Node payloads remain local.
- `image-metadata.tar.gz`: the complete build log and selected build/image/dependency
  metadata. Only the empty Docker client `config.json` is included; unrelated client
  bookkeeping is excluded. The inventory describes build-time files/symlinks, not all
  directory metadata or runtime-injected files.
- `receipts.tar.gz`: the committed launch manifest, exclusive claim, complete launch
  result, directory audit, reviews, Docker version and exact upstream source references.
  Upstream source bytes stay local; canonical commit URLs, blob IDs and hashes are recorded.
- Each `*-files.json.gz` enumerates every archive member's original size and SHA-256.
- `staged-files.json` retains all 328 staged-file identities (552,283,125 bytes).
- `logs/` contains ten closed logs: both accepted Task 145 CI events, two focused runs,
  preparation, image build, install, the 1,157-test full check, preflight and first attempt.
- `records.json` binds archive/log hashes, source/image identity, exclusions and outcomes.

Original roots are `/home/toshiba/aew/task146-image-inputs-first`,
`/home/toshiba/aew/task146-image-build-first`,
`/home/toshiba/aew/task146-container-preflight-first` and
`/home/toshiba/aew/task146-container-browser-first`. These first paths and the launch claim
are consumed and must not be reset or rerun. All four containers are retained stopped;
Task 145's separate unstarted object remains untouched. No corporate code or model output
is included. All application/full-flow resource gates remain unchanged.
