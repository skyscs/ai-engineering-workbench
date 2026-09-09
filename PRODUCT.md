# Product Specification — v0.1

## Problem

AI-assisted software development is often powerful but operationally informal. Engineers repeatedly reconstruct the same context by hand: ticket text, repository selection, screenshots, logs, prior changes, relevant tests, and explicit instructions such as “do not implement before understanding the root cause.”

This approach works, but the workflow is mostly stored in prompts and in the engineer's head. It is difficult to reproduce, inspect, revise, audit, and improve over time.

## Product statement

AI Engineering Workbench is a **local-first engineering workspace** that turns prompt-driven engineering habits into an explicit software workflow while preserving the engineer's ability to intervene through natural language at any point.

It is not a code editor and not an autonomous software factory. It is an orchestration and investigation layer around existing repositories, artifacts, AI runtimes, and engineering judgement.

## Primary user

An experienced software engineer who:

- works across one or more existing repositories;
- already uses AI coding tools daily;
- handles defects and feature tasks that require context gathering and historical reasoning;
- may work with corporate source code that must remain on the local machine except through approved AI infrastructure;
- wants repeatability without losing manual control.

## v0.1 user journey

### One-time workspace setup

1. Create a workspace.
2. Add existing local repositories or clone repositories through system Git.
3. Configure the workspace's AI connection using an existing Codex CLI configuration/profile.
4. Optionally define repository metadata such as default/base branch.

### Per task

1. Create a task with title and description.
2. Add local artifacts such as screenshots, logs, text, Markdown, PDFs, or video files.
3. Select repositories manually. Automatic repository suggestion is deferred until repository profiles exist.
4. Create isolated Git worktrees for the task.
5. Run an investigation.
6. Review the root-cause report and its evidence.
7. If the conclusion is wrong or incomplete, submit a natural-language intervention.
8. Re-run the affected stage and create a new version of the result.

## v0.1 success criteria

The release is successful if it can help investigate at least three realistic engineering defects end-to-end without manually recreating the same investigation prompt each time.

The acceptance set includes one single-repository regression, one two-repository
case, and a case with a human challenge and persistent constraint. Record expected
history/evidence and assess the explanation manually; exact wording and confidence
scores are not acceptance measures. An honest insufficient-evidence conclusion is
valid, while a fabricated confirmed cause is not.

The tool should make it easier to answer:

- What code is likely relevant?
- Which historical changes matter?
- What is the likely root cause?
- What concrete evidence supports that conclusion?
- What changed after the engineer challenged the result?

## v0.1 capability limits

Imported files remain immutable local inputs. Importing PDF/video does not imply
automated analysis; unsupported inputs are identified before execution. CHALLENGE
and CONSTRAINT are the planned executable intervention actions; other intervention types
remain reserved domain concepts. These limits must be visible in the UI.

## Explicitly out of scope for v0.1

- code implementation by the agent;
- automatic test execution and BDD generation;
- Docker/service orchestration;
- automatic knowledge-base retrieval;
- Jira, GitLab, Slack, Teams, or email integrations;
- multi-agent swarms;
- direct OpenAI Responses API runtime;
- local model runtimes;
- cloud storage or cloud synchronization;
- team accounts, RBAC, or collaboration;
- exact outbound-payload audit for Codex CLI traffic;
- automatic repository selection.

## Product language

Preferred terms in product/UI/docs:

- Workspace
- Repository
- Task
- Artifact
- Investigation
- Root Cause
- Evidence
- Intervention
- Constraint
- AI Connection
- Model Profile
- Stage Run

Avoid marketing-heavy terms such as “autonomous engineer” unless the capability actually exists.
