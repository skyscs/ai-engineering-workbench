# Task 069 — Browse connected source paths

Status: scoped before implementation, 2026-11-02.

## Baseline and authorization

Continue the user's authorized development sequence on owned synthetic sources.
Task 068 merged as `a485dd7` after exact-head `ccc4dee` push run
41458071930 and pull-request run 41458229766 succeeded. The merge tree matches
that reviewed head. Task 067's frozen qualification remains exhausted.

## Scope

Implement Phase C of `docs/loredock/CONNECTED_PATH_INTEGRATION.md`:

- A collapsed Browse connected paths section beside existing static flows.
- Two default paths, four entry points per page, explicit root selection and
  default restoration; original evidence through the existing panel.
- Visible partial/static-candidate/runtime-unknown qualifications, source coverage,
  omissions, unavailable entries and an accessible Code coverage link.
- Poll lightweight inventory state only while expanded. Keep a retained published
  inventory during a newer unpublished attempt; clear and reload defaults once
  on compatible publication or inventory loss. No automatic analysis/retry loop.
- Abort owned requests and fence every response by scope, inventory/generation,
  selection and request sequence. Clear pending original evidence on navigation,
  collapse, unmount and context changes. Correctness cannot depend on cancellation.
- Preserve existing review controls, comparison cards, answer adapters and schema.
  No new configuration, model requests, source routing or runtime claims.

## Verification and review

Use focused checks plus the repository check. A fresh owned synthetic browser
fixture must exercise desktop/narrow layouts, keyboard/focus, loading/empty/error/
busy states, roots/pages/defaults/originals, inventory publication and delayed
responses across selection/index/source/policy boundaries. Reuse transport helpers
without rerunning frozen experiments. An owned non-forwarding browser proxy and
fresh Chrome profile must prove a unique sentinel before app navigation. Record
first failures and final evidence honestly. Do not rebuild the primary checkout
or change an existing user's demo, data or listener.

Update user guidance/status and keep results in persistent worktrees/artifacts.
Review the final diff and merge only after push and pull-request CI succeed on
that exact head. Phase D consumer semantics remains a separately scoped next task.
