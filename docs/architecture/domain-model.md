# Domain Model — v0.1

This document describes conceptual entities and invariants. It is not a final database schema.

## Workspace

Represents one engineering environment/data boundary.

Fields:

- id
- name
- aiConnectionId
- boundaryLocked
- createdAt
- updatedAt

Invariants:

- a Workspace owns one AI Connection in v0.1, created atomically with it;
- connection binding is immutable; connections are not shared across workspaces;
- launch settings cannot change after the first task locks the boundary, except
  one-time binding of an unset configuration directory before AI history exists
  and while no StageRun is active (ADR 0012);
- Task 006 must lock the boundary in the same transaction as first-task creation;
- the lock persists and cannot be undone, including after tasks are removed;
- Tasks inherit the Workspace data boundary;
- model overrides must remain within that connection.

## Repository

A Git repository registered in a Workspace.

Fields:

- id
- workspaceId
- name
- remoteUrl
- managedClone: boolean
- localPath
- commonGitDir (canonical lock identity; nullable until clone succeeds)
- defaultBranch (nullable, full symbolic ref)
- baseRef (nullable for an empty repository)
- resolvedCommitSha (nullable when no commit is selected)
- shallow: boolean
- status (`cloning`, `ready`, `failed`)
- error? (normalized Git failure)
- retainedFiles: boolean (incomplete/failed clone cleanup state)
- syncStatus (`idle`, `running`, `succeeded`, `failed`, `no_remote`)
- lastSyncAttemptAt (nullable)
- lastSyncCompletedAt (nullable)
- lastFetchedAt (nullable, last successful fetch)
- syncError (nullable, normalized failure with command and phase)
- createdAt
- updatedAt

Invariants:

- ready records have validated canonical checkout and common git-dir paths;
- registration snapshots must be revalidated before later operations;
- repository ownership cannot change; workspace deletion is blocked while records exist;
- unfinished clone records survive restart and are marked failed without automatic retry;
- synchronization never implies `git pull`;
- credentials are not stored in this entity.
- sync attempts are serialized by common git-dir, including across workspaces;
- failed attempts preserve the previous successful-fetch timestamp;
- missing selected base refs retain their name with a null resolved commit.

See [ADR 0007](../decisions/0007-repository-registry-and-clone-recovery.md) for
managed clone staging, cleanup and Git process boundaries.

## Task

An engineering task/investigation.

Fields:

- id
- workspaceId
- externalKey? (for a future Jira/GitLab key)
- title
- description
- status
- createdAt
- updatedAt

## TaskRepository

Associates a Task with selected repositories.

Fields:

- taskId
- repositoryId
- baseRef
- worktreePath?
- resolvedCommitSha?
- managedPinRef?
- preparationStatus (`pending`, `preparing`, `ready`, `failed`, `removing`)

## Artifact

Immutable local input associated with a Task.

Fields:

- id
- taskId
- type
- originalFilename
- mimeType
- byteSize
- sha256
- storedPath
- createdAt

## AIConnection

Represents a configured runtime/data boundary. Task 003 stores metadata only;
approval and successful runtime verification cannot be inferred from its existence.

Fields:

- id
- name
- runtimeType (`codex-cli` in v0.1)
- configHome (nullable canonical absolute directory; null blocks AI execution)
- configProfile (nullable; null selects the base configuration in configHome)
- executablePath (nullable; null selects `codex` on PATH)
- verificationStatus (`not_verified` in Task 003)
- createdAt
- updatedAt

Ownership is defined by the workspace's unique `aiConnectionId`. Must not contain
OAuth/session secrets copied from Codex. See
[ADR 0006](../decisions/0006-workspace-connection-ownership.md) for ownership,
configuration validation and the limits of freezing a CLI selector.

## ModelProfile

A selectable execution profile within an AI Connection.

Fields:

- id
- aiConnectionId
- name
- modelIdentifier (nullable, opaque)
- reasoningEffort (nullable; `low`, `medium`, `high`, `xhigh`)
- createdAt
- updatedAt

Arbitrary runtime arguments/environment overrides are excluded in v0.1. Validate
the application's effort choices and connection ownership; keep model identifiers
opaque. A null setting requests the CLI default; saving an effort choice does not
verify that a model supports it. Profile ownership cannot change. Later StageRuns
must retain immutable settings snapshots when a profile is edited.

The model identifier is intentionally opaque; corporate proxies may expose non-public model names.

## Constraint

Persistent human instruction applied to a Task.

Fields:

- id
- taskId
- text
- active
- source (`human` in v0.1)
- createdAt

## StageRun

One execution attempt of a workflow stage.

Fields:

- id
- taskId
- stage
- status
- aiConnectionId?
- modelProfileId?
- inputVersionRefs
- inputSnapshot (description, context revision, repository SHAs, artifact hashes,
  constraints, safe connection/profile settings, prompt/schema/CLI versions)
- previousVersionId?
- triggeredByInterventionId?
- startedAt
- completedAt
- error?

StageRun persistence starts in Task 006. Retry creates a new run; interrupted
runs become failed with an interruption reason. No automatic retry on restart.
Only one active AI run per task is allowed. Terminal transitions are atomic.

## InvestigationResult

Versioned AI output for the investigation stage.

Fields:

- id
- taskId
- stageRunId
- version
- status (`active`, `superseded`)
- freshness (`fresh`, `stale`)
- summary
- timeline/analysis structure
- evidenceIds[]
- createdAt

## RootCauseResult

Versioned conclusion derived from an InvestigationResult.

Fields:

- id
- taskId
- stageRunId
- investigationResultId
- version
- status (`active`, `superseded`)
- freshness (`fresh`, `stale`)
- summary
- confidence?
- unresolvedQuestions[]
- evidenceIds[]
- createdAt

Investigation and root-cause content remains immutable. Lifecycle metadata may
change. Publish the validated pair and supersede the previous pair atomically;
failed revisions leave prior successful content active (possibly stale).

## Evidence

Traceable support for an AI conclusion.

Possible evidence types:

- repository file/range
- Git commit
- Git diff
- Git blame/range
- test file/scenario
- task artifact/range
- log range

Fields:

- id
- taskId
- type
- repositoryId?
- revision?
- filePath?
- lineStart?
- lineEnd?
- artifactId?
- locator/metadata
- description
- createdAt

Repository evidence requires a commit SHA; artifact evidence resolves an immutable
artifact and content hash. Validate ownership, existence and locator ranges, without
claiming that valid locators alone prove a hypothesis. Resolve evidence from pinned
history rather than the current working tree; display unavailable sources explicitly.

## Intervention

Engineer feedback applied to a task/stage.

Fields:

- id
- taskId
- targetStage
- targetResultId?
- type (`ask`, `challenge`, `add_context`, `constraint`, `override`)
- text
- createdAt

CHALLENGE and CONSTRAINT execute end-to-end in v0.1. ASK, ADD_CONTEXT and OVERRIDE
remain reserved types: unsupported operations are explicit errors, not working UI
actions. Context can still be edited between runs through task/artifact operations.

## Future entities already anticipated

Not implemented in v0.1:

- PlanResult
- ImplementationRun
- VerificationResult
- KnowledgeEntry
- WorkspacePolicy
- ProviderPayloadAudit
