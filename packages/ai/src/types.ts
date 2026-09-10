import type { AIConnection, ModelProfile, RunFailure, RunInputSnapshot } from '@aew/core';

export const diagnosticLimit = 10 * 1024 ** 2;
export const resultLimit = 2 * 1024 ** 2;
export interface RuntimeMetadata {
  version: string; profile: string | null; configurationFingerprint: string;
  accessMode: 'read'; enabledMcpServers: 0;
}
export type AIEvent = { type: 'runtime'; data: RuntimeMetadata } |
  { type: 'progress' | 'diagnostic' | 'truncated'; data: { message: string } } |
  { type: 'result'; data: unknown };
export interface AIRunRequest {
  workspaceId: string; taskId: string; stageRunId: string;
  connection: AIConnection; profile: ModelProfile | null;
  workingDirectory: string; readRoots: string[]; contextManifest: RunInputSnapshot;
  instructions: string; outputSchemaVersion: string; outputSchema: Record<string, unknown>;
  validateResult(value: unknown): boolean;
  accessMode: 'read'; signal: AbortSignal;
}
export interface AIRuntime { run(request: AIRunRequest): AsyncIterable<AIEvent> }
export class RuntimeError extends Error {
  readonly failure: RunFailure;
  constructor(code: string, message: string, detail: Partial<RunFailure> = {}) {
    super(message); this.name = 'RuntimeError';
    this.failure = { code, message, exitCode: null, signal: null, stderr: '', ...detail };
  }
}
/** Diagnostics are untrusted. Never include environment or configuration dumps. */
export function redact(value: string): string {
  return value.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/https?:\/\/[^\s"<>]+/gi, '[redacted URL]')
    .replace(/\b(?:sk-|gh[opusr]_)[A-Za-z0-9_-]+/g, '[redacted credential]')
    .replace(/((?:authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret)[\"']?\s*[:=]\s*[\"']?)(?:Bearer\s+)?[^\s,;\"']+/gi, '$1[redacted]');
}
