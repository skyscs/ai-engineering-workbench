# Independent browser environment: decision evidence

This directory retains Task 144's read-only capability audit, public base-image metadata
and both complete accepted Task 143 CI logs. [ADR 0066](../../decisions/0066-loredock-independent-browser-container.md)
defines the candidate environment and ownership boundary. No container or browser ran.

- `capabilities.json`: executable/socket availability and three public kernel capability values.
- `docker.json`: selected fields from local `GET /version` and `GET /info` only. No workload
  or image lists, configuration changes or daemon-side mutation.
- `python-index.json`, `python-linux-amd64.json`, `python-config.json`: exact public OCI
  bytes for official `library/python:3.14.4-slim-bookworm`, including the selected Linux amd64
  manifest/config. Content digests were verified before selection. Anonymous registry
  authorization was kept in memory and is not retained.
- `python-record.json`: tag-resolution digests and metadata-only scope. Image payloads
  were not pulled. The tag is provenance; future execution uses the selected digest.
- `task143-ci-push.log.gz`, `task143-ci-pr.log.gz`: complete successful logs for head
  `3bf786a1d5d20e023b6510a9b6c631ca46755abc`. Both pass 1,141 tests, ten typechecks
  and ten final builds with no failures/cancellations; PR #176 merged as identical-tree
  `86d1908a7ca8c4030e78edd5ea72253cb7a9fdab`.
- `records.json`: exact byte/hash inventory and reviewed CI identities/counts.

Runtime compatibility is untested. Docker metadata does not prove non-root/pidfd/cleanup
behavior, and container isolation does not establish the cause of the earlier host RSS
failure. The first failed browser records, application source, frozen collectors and
resource limits remain unchanged. Task 145 must make the image/owner/observer concrete,
pass its non-browser prerequisites and commit exact inputs before the one blank control.
