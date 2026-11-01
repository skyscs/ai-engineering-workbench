# ADR 0048 — README-linked local documentation

## Status

Accepted for Task 060 implementation, 2026-11-01. This extends original source reading,
not semantic architecture synthesis, question retrieval or Workbench integration.

## Decision

Orientation schema v3 / adapter v4 recognizes a conservative single-line inline Markdown
link profile in the already validated root README. Plain labels and bare destinations
retain their original line and README evidence IDs. Code fences/inline code, indentation,
quotes and conservative HTML/comments are excluded. Shared block exclusion logic preserves
the preceding section selector's behavior. Reference/title/HTML link forms, nested/escaped
labels and other Markdown constructs are outside the profile. Unsupported syntax does not
establish missing documentation; complete originals remain available.

Only relative `.md`, `.txt` and extensionless README targets inside the same indexed
repository are candidates. Strip a literal fragment for file lookup, decode percent escapes
once and remove `.` segments. Reject schemes, absolute/network paths, backslashes, parent
segments, query markers, controls, malformed/double encoding and unsafe destinations.
No URL/working-tree/filesystem access or cross-repository fallback occurs. Exact case and
path remain significant. Fragments do not select or validate anchors; reading opens the
complete original file. Relative links in linked documents are not followed recursively.

Retain the first occurrence of each exact normalized target path; skip README self-links.
At most three distinct targets are admitted per README with labels up to 160 UTF-8 bytes
and paths up to 512 bytes. Whole over-limit entries are counted once per distinct path;
unsupported/external links are not counted as missing local targets. Empty labels are
omitted rather than replaced by inferred titles. Labels render literally, without HTML
or inline Markdown execution.

Resolve fixed source/build/path queries against recorded files only. Available targets
must pass the same complete original byte/hash/span validation as root documents and
supply every original part. Missing records remain ambiguous between absent content and
incomplete inventory; excluded/unavailable/limited records retain explicit reasons.
Corruption fails the projection visibly instead of issuing unchecked evidence.

Preserve existing README-first, then root-manifest reading. Linked documents use remaining
capacity in rounds across repositories (first target for each, then second, then third).
The same sixty-document, 32 KiB/file, eight-span/file, 640 KiB input and 512 KiB output
limits apply. All twenty root contexts still take priority. A crowded index can omit
linked originals without hiding their reading gap. No new persisted schema, parser
fingerprint, model invocation, prompt or answer-context expansion is introduced.

The collapsed **Documentation linked from README** view offers separate target-part and
referring-README buttons through the existing evidence viewer. Current authorization,
historical identities and source/index/policy late-response fences remain in force.
No additional source form or configuration is required.

## Verification and limits

Focused tests cover paths, syntax exclusions, Unicode/count bounds, same-source lookup,
exact original support, multi-part reading, no recursion, read-only/Git-free projection,
corruption, update/restart and source/policy boundaries. A twenty-source test verifies
fair remaining-slot allocation and full-budget README priority. Compiled browser checks
use the existing owned non-forwarding proxy pattern, preserving the normal origin/session/
CSRF/CSP protections and the live user demo. All inputs are synthetic and model-free.

This conservative profile can omit valid Markdown links and does not resolve aliases,
redirects, directories, anchors, other repositories or external documentation services.
Reading labels remain author claims, not verified architecture or terminology.
