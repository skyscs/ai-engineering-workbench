# Task 060 — README-linked local documentation

Status: scoped before implementation, 2026-11-01.

Extend the roadmap's source-backed orientation beyond the root README. A repository
README often points to architecture, terminology or setup documents that are already
indexed but currently require a separate search. Expose those originals without another
form, model call or inferred glossary/architecture claim.

## Contract

- Recognize a conservative inline Markdown link profile in each validated root README:
  single-line plain labels and bare relative destinations. Support links in normal prose
  and shallow lists, with literal labels and exact referring-line citations. Ignore code
  fences, inline code, indented/quoted content and conservative HTML/comments. Reference
  links, nested/escaped labels, title syntax, HTML links and unsupported Markdown remain
  outside the profile; this is not a complete Markdown parser.
- Admit same-repository `.md`, `.txt` or extensionless README targets only. Decode percent
  escapes once, strip a literal fragment for file lookup, and remove harmless `./` segments.
  Reject schemes, absolute/network paths, backslashes, parent traversal (including encoded
  forms), queries, control characters, malformed/double encoding and unsafe destinations.
  Never fetch a URL, open the working tree or traverse another repository. Fragments open
  the complete saved file; do not pretend to resolve an anchor.
- Deduplicate exact normalized target paths in source order, retaining the first label/
  reference. Skip self-links. Select at most three distinct targets per README with labels
  up to 160 UTF-8 bytes and paths up to 512 bytes; omit whole over-limit entries and expose
  their count. Unsupported/external syntax is not counted as a missing local document.
- Resolve only fixed-parameter source/build/path lookups in the selected authorized index.
  Missing/excluded/unavailable/limited targets remain visible with reasons; an incomplete
  inventory cannot establish filesystem absence. Fully validate every admitted target and
  issue all its original parts through the existing evidence viewer. No recursive crawling.
- Preserve current root README and manifest priority and all existing 60-document, 32 KiB
  per-file, eight-span, 640 KiB input and 512 KiB output budgets. Read linked documents last
  in rounds across repositories (first target for each, then second, then third). Reuse
  authorized originals; no Git, filesystem, model or database writes during projection.
  Version the disposable orientation schema/adapter; no persisted schema, code parser,
  answer retrieval/prompt or Workbench changes.
- Add collapsed **Documentation linked from README** reading with escaped labels/paths,
  original README-link and target-part buttons, explicit gaps and omissions. Preserve
  source/index/policy late-response fences and complete existing README reading.

## Verification and delivery

Commit scope before code. Cover supported/hostile paths, percent encoding, source order,
deduplication, label/path/count bounds, code/comment exclusions, exact origin/target
citations, multiple parts, no recursion/cross-source fallback, budgets/fair rounds,
corruption, historical updates/restart, revocation/policy fences and protected HTTP reads.
Run an owned compiled browser check for target navigation/focus, hostile labels, 390px
layout, history and delayed responses using the existing non-forwarding proxy isolation.
Use only fresh synthetic sources and a separate worktree; preserve the running user demo,
its compiled assets/data and all frozen evaluation evidence/budgets. Update English guide,
roadmap/status and an ADR, run strict/full checks, review, publish and merge after both
exact-head CI events pass. Broader semantic synthesis and external connectors stay open.
