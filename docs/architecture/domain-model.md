# Domain Model — v0.1

This document describes conceptual entities and invariants. It is not a final database schema.

## Workspace

Represents one engineering environment/data boundary.

Fields:

- id
- name
- aiConnectionId
- createdAt
- updatedAt

Invariants:

- a Workspace has one active AI Connection in v0.1;
- connection binding and launch settings cannot change once tasks exist in v0.1;
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
- defaultBranch/baseRef
- lastFetchedAt
- createdAt

Invariants:

- localPath must resolve to a Git repository;
- synchronization never implies `git pull`;
- credentials are not stored in this entity.

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

Represents an approved runtime/data boundary.

Fields:

- id
- workspaceId? (or separately reusable later)
- name
- runtimeType (`codex-cli` in v0.1)
- configSelector/profile?
- executablePath?
- createdAt

Must not contain OAuth/session secrets copied from Codex.

## ModelProfile

A selectable execution profile within an AI Connection.

Fields:

- id
- aiConnectionId
- name
- modelIdentifier?
- reasoning/effort?

Arbitrary runtime arguments/environment overrides are excluded in v0.1. Validate
supported effort settings and connection ownership; keep model identifiers opaque.

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
