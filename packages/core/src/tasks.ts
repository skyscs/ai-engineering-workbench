import { DomainError, type AIConnection, type ModelProfile } from './index.js';

export interface TaskInput { title: string; description: string; repositoryIds: string[] }
export interface Task extends TaskInput {
  id: string; workspaceId: string; status: 'CREATED' | 'CONTEXT_READY'; contextRevision: number; createdAt: string; updatedAt: string;
}
export interface Artifact {
  id: string; taskId: string; originalFilename: string; mimeType: string; byteSize: number;
  sha256: string; kind: 'text' | 'image' | 'unsupported'; createdAt: string;
}
export interface ContextSelection { artifactId: string; start: number; end: number }
export interface ContextEntry extends Artifact { range: { start: number; end: number } | null; reason: string }
export interface ContextManifest {
  revision: number; descriptionBytes: number; includedBytes: number; limitBytes: number; entries: ContextEntry[];
}
export interface ArtifactLimits { fileBytes: number; taskBytes: number; contextBytes: number }
export const defaultArtifactLimits: ArtifactLimits = { fileBytes: 100 * 1024 ** 2, taskBytes: 1024 ** 3, contextBytes: 1024 ** 2 };
export interface RunFailure { code: string; message: string; exitCode: number | null; signal: string | null; stderr: string }
export interface RunInputSnapshot {
  task: Task; connection: AIConnection; profile: ModelProfile | null;
  repositories: { id: string; baseRef: string | null; resolvedCommitSha: string | null; worktreePath?: string | null; managedPinRef?: string | null }[];
  context: ContextManifest; constraints: readonly string[]; promptVersion: string; schemaVersion: string;
}
export interface StageRun {
  id: string; taskId: string; aiConnectionId: string; modelProfileId: string | null;
  stage: 'context_preparation' | 'investigation'; status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  inputSnapshot: RunInputSnapshot; error: RunFailure | null;
  createdAt: string; startedAt: string | null; completedAt: string | null;
}
export interface TaskWorktree {
  taskId: string; repositoryId: string; repositoryName: string; workspaceId: string; baseRef: string | null;
  resolvedCommitSha: string | null; worktreePath: string | null; managedPinRef: string | null;
  sourcePath: string | null; commonGitDir: string | null;
  status: 'pending' | 'preparing' | 'ready' | 'failed' | 'removing' | 'removed';
  operationId: string | null; operationKind: 'prepare' | 'remove' | null;
  error: GitWorktreeFailure | null; updatedAt: string | null;
}
export interface GitWorktreeFailure extends RunFailure { phase: 'preflight' | 'pin' | 'create' | 'verify' | 'remove' | 'recovery' }
export function parseTask(value: unknown): TaskInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DomainError('INVALID_INPUT', 'Expected a task object.');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !['title', 'description', 'repositoryIds'].includes(key)) ||
    typeof input.title !== 'string' || !input.title.trim() || input.title.length > 120 || /[\u0000-\u001f\u007f]/.test(input.title) ||
    typeof input.description !== 'string' || !input.description.trim() || input.description.length > 65536 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input.description) ||
    !Array.isArray(input.repositoryIds) || input.repositoryIds.length < 1 || input.repositoryIds.length > 32 ||
    input.repositoryIds.some((id) => typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) ||
    new Set(input.repositoryIds).size !== input.repositoryIds.length) {
    throw new DomainError('INVALID_INPUT', 'Provide a title (120 characters), description (65536 characters) and 1–32 distinct repository IDs.');
  }
  return { title: input.title.trim(), description: input.description, repositoryIds: input.repositoryIds as string[] };
}
export function parseSelections(value: unknown): ContextSelection[] {
  if (!Array.isArray(value) || value.length > 1024) throw new DomainError('INVALID_INPUT', 'Provide an array of context selections.');
  const ids = new Set<string>();
  return value.map((item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new DomainError('INVALID_INPUT', 'Invalid context selection.');
    const row = item as Record<string, unknown>;
    if (Object.keys(row).some((key) => !['artifactId', 'start', 'end'].includes(key)) || typeof row.artifactId !== 'string' ||
      ids.has(row.artifactId) || !Number.isSafeInteger(row.start) || !Number.isSafeInteger(row.end) ||
      (row.start as number) < 0 || (row.end as number) <= (row.start as number)) {
      throw new DomainError('INVALID_INPUT', 'Choose each artifact once with a nonempty byte range [start, end).');
    }
    ids.add(row.artifactId);
    return { artifactId: row.artifactId, start: row.start as number, end: row.end as number };
  });
}
