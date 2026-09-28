import { DomainError } from './index.js';
import type { GitFailure } from './index.js';
export interface DraftInput {
  workspaceId: string | null;
  repositoryIds: string[];
  source: string;
  description: string;
  modelProfileId: string | null;
}
export interface DraftFile { id: string; name: string; size: number; included: boolean }
export type LaunchState = 'checking' | 'repositories' | 'preparing' | 'investigating' | 'succeeded' | 'failed' | 'cancelled';
export interface LaunchOperation {
  id: string; draftId: string; state: LaunchState; message: string; runId: string | null;
  cancelRequested: boolean; createdAt: string; updatedAt: string;
  error: GitFailure | null;
}
export interface InvestigationDraft {
  id: string; input: DraftInput; revision: number; taskId: string | null; preserveContext: boolean;
  files: DraftFile[]; launch: LaunchOperation | null; createdAt: string; updatedAt: string;
}
export const activeLaunchStates: LaunchState[] = ['checking', 'repositories', 'preparing', 'investigating'];
export function identifier(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value)) throw new DomainError('INVALID_INPUT', 'A valid request identifier is required.');
  return value;
}
export function parseDraftInput(value: unknown): DraftInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DomainError('INVALID_INPUT', 'Expected draft input.');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !['workspaceId', 'repositoryIds', 'source', 'description', 'modelProfileId'].includes(key)) ||
    typeof input.source !== 'string' || input.source.length > 4096 || /[\x00-\x1f\x7f]/.test(input.source) ||
    typeof input.description !== 'string' || input.description.length > 65536 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input.description) ||
    !Array.isArray(input.repositoryIds) || input.repositoryIds.length > 16) throw new DomainError('INVALID_INPUT', 'Provide a repository and a problem description within the supported limits.');
  const ids = input.repositoryIds.map(identifier);
  if (new Set(ids).size !== ids.length) throw new DomainError('INVALID_INPUT', 'Choose each repository once.');
  return { workspaceId: input.workspaceId === null ? null : identifier(input.workspaceId), repositoryIds: ids,
    source: input.source.trim(), description: input.description, modelProfileId: input.modelProfileId === null ? null : identifier(input.modelProfileId) };
}
