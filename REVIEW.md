# Starter archive and development plan review — 2026-09-09

## Conclusion

Keep the v0.1 architecture. The main gaps are late runtime validation, incomplete
execution boundaries, and undefined recovery/versioning behavior. Corrections are
recorded in DEVELOPMENT_PLAN.md, the task files, specifications, and ADR 0004.
Application code was not changed during this review. The original ZIP is preserved.

## Findings by priority

| Priority | Original location | Finding and consequence | Planned correction |
| --- | --- | --- | --- |
| High | Tasks 008, 009 | Task 008 requires failed StageRun persistence and the selected profile, but persistence arrives in 009. | Introduce minimal StageRun storage and input snapshots in 006; add investigation semantics in 009. |
| High | Task 008, SECURITY.md | A prompt prohibition does not enforce read-only access. Worktrees are not sandboxes. | Validate the runtime early; enforce execution restrictions, disallow unattended escalation, test denied writes. |
| High | apps/daemon/src/index.ts | Only health/static routes exist today; privileged local API protection is missing from the roadmap. Loopback binding alone is insufficient once file operations are added. | Add Host/Origin validation, local browser sessions and mutation protection in 001. |
| High | domain-model.md: ModelProfile.extraRuntimeArgs | Arbitrary arguments could change sandbox, provider or configuration and bypass the connection boundary. | Exclude arbitrary runtime arguments from v0.1 and validate typed profile fields on the server. |
| High | Tasks 007, 009 | Moving base refs and current-line locators cannot reliably reproduce evidence. | Pin commit SHAs; snapshot inputs and template/schema versions; bind evidence to revisions or artifact hashes. |
| High | Tasks 002, 006, 007, 011 | SQLite and filesystem operations are not one transaction; failures can leave inconsistent records/files. | Introduce operation states, staging, atomic rename and reconciliation with each stateful feature. |
| High | WORKFLOW.md, Task 010 | Failed revisions, changed inputs and concurrent runs have undefined semantics. | Preserve the previous successful report; supersede only after successful replacement; track stale separately; serialize runs. |
| Medium | ARCHITECTURE.md: AIRunRequest | A single workingDirectory does not describe multiple repositories or artifacts outside that directory. | Add a manifest of read roots and validate a two-repository case in the early spike. |
| Medium | Tasks 006, 009 | Importing PDF/video does not imply runtime comprehension; upload/context limits are undefined. | Separate storage from analysis, disclose unsupported inputs and define limits; defer OCR/video analysis. |
| Medium | Task 007 | Branch-attached worktrees can conflict with an occupied branch; cleanup guarantees are incomplete. | Use detached worktrees at pinned SHAs; verify ownership/clean state and refuse forced deletion. |
| Medium | SECURITY.md: AI Connection | A profile name does not prove corporate/personal credential isolation. | Treat the connection as an explicit user configuration; do not claim verified provider/account identity without CLI evidence. |
| Medium | package.json, START_HERE.md | Node >=22 is too broad for Vite 7; no lockfile exists and the scaffold is unverified. | Use Node 22.12+ and pnpm 10.15.0; commit a lockfile and validate a clean installation in 001. |
| Medium | package.json, packages/*/package.json | The build runs daemon before internal packages; packages lack exports/workspace dependencies. This is a future integration problem, not a demonstrated failure while they remain placeholders. | Add exports, declared dependencies and topological builds when internal imports appear; validate clean checkouts. |
| Medium | apps/daemon/src/index.ts | With public assets present, an unknown /api/* route can reach SPA fallback and return HTML. | Add explicit JSON API 404 handling before SPA fallback; test the production asset path in 001. |
| Medium | Previous plan | Task numbering is mistaken for product iteration; value validation is late and acceptance could introduce unnecessary per-commit pauses. | Keep small tasks, add scenario-based checkpoints, and allow explicitly authorized sequences to continue without repeated permission. |

## Verification and limitations

- Read Tasks 001–011, product/architecture/security/workflow documents, ADRs,
  daemon/web code and build configuration. ZIP integrity validation passed.
- Local shell: Node v18.20.2. The pnpm version command failed while Corepack tried
  to write its cache in a read-only location. This describes the current shell,
  not a demonstrated project or pnpm defect.
- Installed codex-cli 0.153.4: exec help lists JSONL, output-schema, read-only
  sandbox and profile selection. No real AI investigation was run during review;
  Task 000 must still validate the chosen profile and effective restrictions.
- Application installation, build and tests were not run. Scaffold findings are
  Task 001 acceptance requirements, not implemented code fixes.
- The previous SSH check established read access and returned no refs. It did
  not establish push permission; recheck the remote before the first import.
  Nothing was published to GitHub during this review.

## Verification sources

- [Vite 7 Node requirements](https://vite.dev/blog/announcing-vite7):
  Node 20.19+ or 22.12+; this project keeps the Node 22.12+ development baseline.
- [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode):
  JSONL, JSON Schema output and explicit sandbox settings support the adapter.
  They do not independently certify isolation of every configured external tool.
- Local codex version/help checks corroborated installed CLI capabilities without
  reading authentication tokens or sending project content to a model.
