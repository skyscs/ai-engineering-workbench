# Historical parser controls

This fixture preserves the accepted pre-adoption implementation at
`41d70a1b7423ab52a482ba81b9f432d343fa0eb2`. `before.json.gz` contains 97 original files;
its manifest pins the compressed archive, expanded bytes and every individual source.
The additional archive pins two more unchanged test files exposed by the first full
regression run. The original archive is never rewritten.

Five historical test entry points execute their unchanged assertions against exact
pre-adoption source/emission. Their original synchronous factory, native fingerprint,
SQL execution counts and error behavior remain meaningful historical controls. They
are distinct from the live production adoption tests in `owned-parser-production.test.ts`
and the source/emitted server tests. Parser-upgrade behavior is tested explicitly;
old fingerprints are never silently mapped to the new implementation.

`delta.json` pins actual current source bytes and added modules before the normalizer
returns old bytes. Compiled callers additionally verify deterministic current emission.
Older normalization layers may supply independently pinned historical sources; only
those exact source/manifest pairs are accepted. Old manifest hashes and original fixture
modules remain unchanged. Historical modules are materialized into a temporary root so
their installed-code fingerprint reads see the corresponding historical bytes. The
unchanged error-type module is shared only after byte verification, preserving the
original mixed-control exception identity.

The ordinary prototype unit adapter also resolves all native dependencies from that
historical root. It cannot execute a reserved entry. No consumed observation, reserved
qualification family, first-run driver or sealed source is rerun or edited here.
