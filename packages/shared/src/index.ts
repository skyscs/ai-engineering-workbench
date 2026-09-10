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
