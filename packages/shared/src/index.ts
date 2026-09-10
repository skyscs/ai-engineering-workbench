import type { AIConnection, ModelProfile, Workspace } from '@aew/core';
export type { AIConnection, ConnectionInput, ModelProfile, ModelProfileInput, Workspace, WorkspaceInput } from '@aew/core';
export interface WorkspaceDetail {
  workspace: Workspace;
  connection: AIConnection;
  modelProfiles: ModelProfile[];
}
export interface WorkspaceList { workspaces: Workspace[] }
export interface ApiError { error: { code: string; message: string } }
export type { Repository, RepositoryInput, RepositoryMetadata, GitFailure } from '@aew/core';
export interface RepositoryList { repositories: import('@aew/core').Repository[] }
export type { SyncFailure } from '@aew/core';
export type { TaskWorktree, GitWorktreeFailure } from '@aew/core';
export type { Task, TaskInput, Artifact, ContextManifest, ContextSelection, ArtifactLimits, StageRun } from '@aew/core';
export interface TaskDetail {
  task: import('@aew/core').Task;
  artifacts: import('@aew/core').Artifact[];
  context: import('@aew/core').ContextManifest;
  limits: import('@aew/core').ArtifactLimits;
  imports: { id: string; originalFilename: string; state: string; errorCode: string | null }[];
  worktrees: import('@aew/core').TaskWorktree[];
  latestRun: import('@aew/core').StageRun | null;
}
