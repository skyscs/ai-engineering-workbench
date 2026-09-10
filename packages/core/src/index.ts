export const reasoningEfforts = ['low', 'medium', 'high', 'xhigh'] as const;
export type ReasoningEffort = typeof reasoningEfforts[number];

export interface Workspace {
  id: string;
  name: string;
  aiConnectionId: string;
  boundaryLocked: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface ConnectionInput {
  name: string;
  executablePath: string | null;
  configProfile: string | null;
}
export interface AIConnection extends ConnectionInput {
  id: string;
  runtimeType: 'codex-cli';
  verificationStatus: 'not_verified';
  createdAt: string;
  updatedAt: string;
}
export interface ModelProfileInput {
  name: string;
  modelIdentifier: string | null;
  reasoningEffort: ReasoningEffort | null;
}
export interface ModelProfile extends ModelProfileInput {
  id: string;
  aiConnectionId: string;
  createdAt: string;
  updatedAt: string;
}
export interface WorkspaceInput { name: string; connection: ConnectionInput }

export class DomainError extends Error {
  constructor(public readonly code: 'INVALID_INPUT' | 'NOT_FOUND' | 'BOUNDARY_LOCKED' | 'CONFLICT', message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export interface GitFailure {
  code: string;
  message: string;
  exitCode: number | null;
  signal: string | null;
  stderr: string;
}
export interface RepositoryMetadata {
  localPath: string;
  commonGitDir: string;
  remoteUrl: string | null;
  defaultBranch: string | null;
  baseRef: string | null;
  resolvedCommitSha: string | null;
  shallow: boolean;
}
export interface Repository extends Omit<RepositoryMetadata, 'commonGitDir'> {
  id: string;
  workspaceId: string;
  name: string;
  commonGitDir: string | null;
  managedClone: boolean;
  status: 'cloning' | 'ready' | 'failed';
  error: GitFailure | null;
  retainedFiles: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface RepositoryInput {
  name: string;
  source: string;
  baseRef: string | null;
}
export function parseRepositoryInput(value: unknown): RepositoryInput {
  const input = object(value, ['name', 'source', 'baseRef']);
  const source = text(input.source, 'source', 4096);
  const baseRef = optionalText(input.baseRef, 'baseRef', 256);
  if (source.startsWith('-') || baseRef?.startsWith('-')) {
    throw new DomainError('INVALID_INPUT', 'Repository paths, URLs and refs cannot start with a hyphen.');
  }
  return { name: text(input.name, 'name', 120), source, baseRef };
}

function object(value: unknown, fields: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DomainError('INVALID_INPUT', 'Expected a JSON object.');
  }
  if (Object.keys(value).some((key) => !fields.includes(key))) {
    throw new DomainError('INVALID_INPUT', 'The request contains unsupported fields.');
  }
  return value as Record<string, unknown>;
}
function text(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new DomainError('INVALID_INPUT', `${field} must be nonempty text of at most ${max} characters, without control characters.`);
  }
  return value.trim();
}
function optionalText(value: unknown, field: string, max: number): string | null {
  return value === undefined || value === null ? null : text(value, field, max);
}
export function parseWorkspaceRename(value: unknown): { name: string } {
  const input = object(value, ['name']);
  return { name: text(input.name, 'name', 120) };
}
export function parseConnection(value: unknown): ConnectionInput {
  const input = object(value, ['name', 'executablePath', 'configProfile']);
  const profile = optionalText(input.configProfile, 'configProfile', 128);
  if (profile !== null && !/^[A-Za-z0-9_-]+$/.test(profile)) {
    throw new DomainError('INVALID_INPUT', 'Use a CLI profile name containing letters, numbers, underscores or hyphens.');
  }
  return { name: text(input.name, 'name', 120),
    executablePath: optionalText(input.executablePath, 'executablePath', 4096), configProfile: profile };
}
export function parseWorkspaceCreate(value: unknown): WorkspaceInput {
  const input = object(value, ['name', 'connection']);
  return { name: text(input.name, 'name', 120), connection: parseConnection(input.connection) };
}
export function parseModelProfile(value: unknown): ModelProfileInput {
  const input = object(value, ['name', 'modelIdentifier', 'reasoningEffort']);
  const model = optionalText(input.modelIdentifier, 'modelIdentifier', 256);
  if (model?.startsWith('-')) throw new DomainError('INVALID_INPUT', 'The model identifier cannot start with a hyphen.');
  const effort = input.reasoningEffort ?? null;
  if (effort !== null && !reasoningEfforts.includes(effort as ReasoningEffort)) {
    throw new DomainError('INVALID_INPUT', 'Choose a supported reasoning effort or the CLI default.');
  }
  return { name: text(input.name, 'name', 120), modelIdentifier: model, reasoningEffort: effort as ReasoningEffort | null };
}
export function assertBoundaryEditable(locked: boolean): void {
  if (locked) throw new DomainError('BOUNDARY_LOCKED', 'This workspace has a locked data boundary. Create another workspace to change its connection.');
}
