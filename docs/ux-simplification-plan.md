# UX simplification: from repository to investigation

Status: direction accepted by the project owner, 2026-09-28. Iteration 1 is
implemented and browser-verified in [Task 012](../tasks/012-investigation-ux-prototype.md). The owner accepted the walkthrough direction. [Task 013](../tasks/013-primary-investigation-flow.md)
implements the primary experience on real application services. The user guide
describes that implementation; deferred ideas below remain future work.

## Outcome

A developer should be able to start an investigation by selecting a repository,
describing a problem and choosing **Investigate**. Attaching supporting text is
optional. The application owns preparation, persistence and progress reporting.
Selecting the intended Codex setup is a one-time prerequisite, with a visible
saved selection on subsequent investigations.

Keep the existing local daemon, Git isolation, report history and evidence model.
Change the primary interaction from managing internal entities to investigating
a problem. Success means an unassisted user completes the workflow, not merely
that a scripted browser can submit all the forms.

## Findings from the current implementation

| Current behavior | User consequence | Proposed change |
| --- | --- | --- |
| `App.tsx` initially presents workspace and connection creation; the main page stacks repository, task and settings forms. | Configuration dominates the first experience. | Open an investigation composer; keep settings in a separate view. |
| `SettingsForms.tsx` exposes connection name, configuration directory, profile mode and executable. | Users must understand runtime wiring before describing their problem. | Reuse or explicitly choose a saved Codex setup; move executable and named profile to advanced settings. |
| `Repositories.tsx` requires a name and source mode in addition to a source. | Users describe the same repository multiple times. | Accept a local path or Git URL; derive a display name and show the detected source type. |
| `Tasks.tsx` requires a title and description, then exposes `Worktrees.tsx` preparation separately. | Users operate the internal workflow manually. | Derive an editable title; prepare isolated code as part of starting the investigation. |
| `Tasks.tsx` places imports after `Runtime`; import, include and save are separate actions with byte offsets. | Files can appear attached while never reaching analysis. | Put attachments beside the description; add supported text to the draft context immediately and show its inclusion state. |
| `Runtime.tsx` disables launch for several prerequisites without a single explanation of the next action. | A disabled button leaves the user to diagnose the system. | Show a specific blocker and its remedy next to the primary action. |
| Model selection resets when the task view mounts; settings still say “Configured · not verified.” | Previously made choices feel unreliable. | Persist explicit project defaults and show the actual result and scope of local checks. |
| Task status maps every state except `CONTEXT_READY` to “Created.” | Progress contradicts the visible report/run. | Derive one clear user-facing status from preparation, execution and publication (AEW-003). |
| Connection settings lock when the first task is created, before the first successful launch. | A configuration mistake can require starting over. | Validate the selected setup before creating the immutable task; retain an editable draft until then. |

The failure in AEW-004 also shows why preparation and compatibility errors need
to surface before model execution, with the input draft retained.

## Main experience

Use **Projects** and **Investigations** as the primary navigation. A project is the
user-facing presentation of an existing workspace: one saved connection, one or
more repositories, and investigation history. No parallel project domain entity
or wholesale storage rename is required. Existing workspaces remain accessible.

For a returning user, open their last project and show:

```text
New investigation

Project                 Checkout service                         Change
Code                    Current committed version · main         Change

What is going wrong?
[Describe the problem or paste the issue here...                       ]

Supporting files        Drop logs or text files here, or Add files
  incident.log          Included · full text                     Remove

Using                   Personal setup · Saved model settings     Change
                        Read-only analysis. Your checkout stays unchanged.
                        Selected code and text may be sent through this setup.

Advanced options

                                                  [ Investigate ]
```

For a new project, replace the project selector with **Repository path or Git
URL**. Derive the project/repository names from that source, disambiguating name
collisions without silently reusing another connection boundary. Offer **Add
another repository** as a secondary action. Do not require a title: derive it
deterministically from the first nonempty description line and allow later renaming.

A browser directory upload does not supply a usable server-side checkout path.
The first implementation accepts a pasted path, with inline validation and recent
registered repositories. A native directory picker or general filesystem browser
is a separate feature, not a dependency of this redesign.

## Defaults and settings

| Concern | Normal path | Optional control |
| --- | --- | --- |
| AI setup | Reuse the explicitly confirmed project connection. | Change setup before task creation; show its path and custom settings. |
| Model and effort | Use saved project settings; otherwise clearly show “Codex defaults.” | Remember an explicitly selected model profile per project. Do not invent speed/quality presets without verified model mappings. |
| Local repository revision | Use the selected checkout's current committed `HEAD`; show branch and commit. | Select another branch, tag or commit. This differs from today's origin-HEAD-first detection and needs explicit implementation/tests. |
| Remote repository revision | Clone when starting; use the advertised default branch and record its resolved commit. | Select another available revision after discovery. Do not claim an unfetched revision is current. |
| Existing repository freshness | Use the displayed locally available revision. | Explicit **Fetch updates**; never silently pull or change a task's existing pin. |
| Supporting text | Include newly attached, supported text in full when it fits; show “Included.” | Preview, exclude, or choose lines when it does not fit. Convert lines to verified UTF-8 byte ranges internally. |
| Unsupported attachments | Explain “Stored only — not analyzed” before accepting them. | Preserve as a local attachment if the user chooses. Do not imply image/PDF analysis. |
| Data directory | Use the existing application data directory automatically. | Show **Application data** under Settings, separately from **Codex setup**. |
| Technical metadata | Keep it recorded for reproducibility and support. | Expand **Details** for run IDs, worktree paths, hashes, raw error codes and retained events. |

Never infer personal versus corporate identity from an executable or directory
name. For first use, show previously saved setups or narrowly discovered path
candidates with their full paths and require a deliberate choice. Do not scan
credentials. Even one detected candidate needs explicit confirmation. Save that
choice so the user does not repeat it for every run; never silently substitute
another setup on failure.

Connection setup checks should identify executable/version, directory/profile and
supported tool configuration through bounded local diagnostics, without a model
request. Show **Local checks passed**, not **Account verified**. Authentication
status can only be presented when supported CLI diagnostics establish it; model
availability and provider access may remain unverified until an invocation. Repeat
project-specific checks once the actual worktree exists and revalidate before exec.

## One action, explicit progress

**Investigate** authorizes preparation and one model invocation for the displayed
inputs. It should save the draft, register/clone selected sources as necessary,
create the task, import and persist selected context, prepare and pin worktrees,
run final preflight, and launch the existing investigation service.

Connection validation must finish before task creation locks the launch settings.
Use durable drafts for description, source choices, attachment references and
launch choices. Keep draft uploads owned and recoverable, with an explicit
discard path. Do not place source/log text or secrets in URLs or browser storage.
Existing task snapshots and connection-lock rules remain immutable. A changed
connection for an existing task creates a new draft under an explicitly chosen
boundary, preserving the old history.

The daemon must own this sequence. A browser-only chain of POST requests would
lose progress on reload and risk duplicate launches. Persist a bounded launch
operation and stable client request ID; retries of the same submission recover
the operation instead of creating another paid run. Reuse existing repository,
artifact, worktree and runtime services and their locking/recovery behavior.
This is one workflow, not a general-purpose workflow engine.

Show these states with a single primary next action:

| State | What the user sees | Action |
| --- | --- | --- |
| Draft | Description, included files, selected setup and code revision. | **Investigate**, or a named prerequisite such as **Choose Codex setup**. |
| Preparing | Actual steps: checking setup, downloading code if needed, preparing isolated code. | **Cancel**. |
| Investigating | Elapsed time and only progress substantiated by runtime events. | **Cancel**. |
| Ready | Conclusion, supporting evidence and unresolved questions. | **Revise analysis**; secondary **Export**. |
| Needs attention | Failed step, plain-language cause and corrective action; input retained. | **Fix setup**, **Choose revision**, or **Retry**, as appropriate. |

If another investigation is running, link to it instead of leaving an unexplained
disabled button. Refreshing/reopening the page restores the same operation and
latest report. Preparation failures retain successful steps. After daemon restart,
recover state but require explicit continuation before any model invocation.
Cancellation during preparation must prevent a later launch. Never automatically
retry model requests or claim an exact percentage/ETA from sparse CLI events.

Example error presentation:

```text
The selected Codex setup is unavailable.
Your problem description and files are saved. Analysis has not started.

[ Review setup ]    Details
```

Use that “not started” claim only when known. After execution begins, distinguish
failed/unknown completion from a preflight rejection. Preserve normalized error
codes and redacted diagnostics under Details. For immutable historical tasks,
**Review setup** must explain when a new draft is necessary rather than promising
an in-place account switch. Never delete user configuration to resolve a blocker.

## Results and revision

Lead with **Conclusion**, **Evidence**, and **What is still unknown**. Offer file
and commit citations that open their recorded source. Put full chronology,
attempt history and technical diagnostics behind secondary controls. Preserve
access to every report version; a failed revision must leave the last report visible.

Replace the main “Human interventions” form with **What should we reconsider?**
and **Revise analysis**. This maps to the existing challenge operation and clearly
starts another invocation. Keep **Rules for this investigation** as a secondary
panel for persistent constraints. Do not turn every message into a persistent
rule or an implicit paid call, and do not advertise a general chat while ASK is
unimplemented.

Allow **Investigate newer code** to create a fresh draft, retaining the old pin and
reports. Description/repository edits belong to a draft or a deliberate new
investigation; previously recorded run inputs must never change retroactively.

## Delivery sequence

Each iteration needs a short unassisted walkthrough with the project owner before
adding more features. Preserve existing data throughout; all UI copy stays English.

1. **Validate the interaction.** Build a small clickable prototype of the composer,
   one-time setup selection, progress, one failure and a report. Use labeled sample
   data, with no CLI/model calls. Ask the owner to start a sample investigation and
   identify what was included without reading documentation. Revise the prototype
   until the next action and the selected setup are clear.
2. **Deliver one complete local-repository path.** Add local setup diagnostics,
   durable drafts and the idempotent daemon launch sequence. Connect the composer
   to real services, automatically prepare worktrees, remember explicit model
   choices, fix status presentation and restore the current investigation on reload.
   Include full-text attachment inclusion with visible errors for oversize or
   unsupported files. Keep existing advanced repository management available.
3. **Complete context and recovery.** Add remote URLs to the same entry field,
   additional repositories, readable revision selection, text preview with line
   selection, cancellation across preparation stages, and actionable recovery for
   partial imports/clones/preparation. Show existing workspaces/tasks through the
   new navigation and provide safe draft discard/new-investigation flows.
4. **Simplify review and finish acceptance.** Apply the report/revision design,
   retain accessible version history and export, remove redundant primary forms,
   and replace the long first-run documentation with the verified short journey.
   Run the existing regression suite and the user acceptance exercise below.

Essential duplicate protection, cancellation and reload recovery are required in
iteration 2; iteration 3 extends coverage to remote and multi-repository workflows.
The new defaults and draft lifecycle need an ADR and bounded implementation tasks
before coding. Do not modify historical migrations or mark this proposal accepted
merely because its prototype is understandable.

## Acceptance

For an installed app with a compatible authenticated setup and a local repository,
target a first submission within five minutes without README instructions or
developer coaching. Exclude Git download and model-response latency from that
target. For an existing project, require only a problem description; files and
overrides remain optional. These are proposed targets, not measured results.

Verify that the owner can select the intended setup, launch, explain which code
and attachments are included, recover from a missing-directory error, reopen an
active investigation, read evidence and request a revision without knowing the
terms worktree, stage run, context revision or UTF-8 byte offset.

Automated acceptance must cover double submission, lost responses, reload during
preparation, cancellation immediately before launch, failed preflight, unsupported
attachments, partial import, dirty local checkout, revision pin stability and a
failed report revision. Use a fake runtime in CI. A separately deliberate real
investigation establishes that the simplified path reaches an actual report.

Do not expand this effort into provider replacement, model auto-routing, general
chat, OCR, repository auto-selection, native packaging or code implementation.
The priority is a usable route through the capabilities already built.

## Owner acceptance and primary implementation

On 2026-09-28 the owner accepted the prototype direction and requested the new
experience as the primary application. Task 013 implements the composer, durable
drafts, bounded text uploads and daemon-owned launch flow on the existing services.
The original interface remains at `/advanced`. Further UX changes will follow
feedback from actual use; the static prototype is a historical development artifact.
