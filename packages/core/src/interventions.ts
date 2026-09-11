import { DomainError } from './index.js';
import type { InvestigationResult } from './investigation.js';
import type { StageRun } from './tasks.js';

export const interventionTypes = ['ask', 'challenge', 'add_context', 'constraint', 'override'] as const;
export type InterventionType = typeof interventionTypes[number];
export interface MutationGuard { requestId: string; expectedContextRevision: number }
export type InterventionInput = MutationGuard & ({ type: 'constraint'; text: string } |
  { type: 'challenge'; text: string; targetReportId: string; modelProfileId: string | null });
export interface Intervention {
  id: string; taskId: string; type: 'challenge' | 'constraint'; text: string;
  operation: 'challenge' | 'add_constraint' | 'deactivate_constraint';
  targetReportId: string | null; constraintId: string | null; requestId: string;
  contextRevision: number; createdAt: string;
}
export interface InterventionHistory extends Intervention {
  runId: string | null; runStatus: StageRun['status'] | null; reportId: string | null;
}
export interface Constraint {
  id: string; taskId: string; text: string; active: boolean; sourceInterventionId: string;
  createdAt: string; deactivatedAt: string | null;
}
export interface RevisionContext {
  intervention: Intervention;
  previousReport: { id: string; rootCauseId: string; version: number; contextRevision: number; result: InvestigationResult };
}
export interface ResultDependency { dependentId: string; upstreamId: string }
export function parseMutationGuard(value: Record<string, unknown>): MutationGuard {
  if (typeof value.requestId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value.requestId) ||
    !Number.isSafeInteger(value.expectedContextRevision) || Number(value.expectedContextRevision) < 1) {
    throw new DomainError('INVALID_INPUT', 'Provide a request UUID and the context revision shown in the current task.');
  }
  return { requestId: value.requestId, expectedContextRevision: Number(value.expectedContextRevision) };
}
export function parseIntervention(value: unknown): InterventionInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DomainError('INVALID_INPUT', 'Provide an intervention object.');
  const v = value as Record<string, unknown>;
  if (['ask', 'add_context', 'override'].includes(String(v.type))) throw new DomainError('UNSUPPORTED_ACTION', 'Only challenge and constraint interventions are implemented.');
  const fields = v.type === 'challenge' ? ['type','text','targetReportId','modelProfileId','requestId','expectedContextRevision'] : ['type','text','requestId','expectedContextRevision'];
  if (!['challenge','constraint'].includes(String(v.type)) || Object.keys(v).some(k => !fields.includes(k)) ||
    typeof v.text !== 'string' || !v.text.trim() || v.text.length > 8192 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v.text)) {
    throw new DomainError('INVALID_INPUT', 'Choose challenge or constraint and provide nonempty text up to 8192 characters.');
  }
  const guard = parseMutationGuard(v), text = v.text.trim();
  if (v.type === 'constraint') return { ...guard, type: 'constraint', text };
  if (typeof v.targetReportId !== 'string' || !/^[a-f0-9-]{36}$/.test(v.targetReportId) ||
    (v.modelProfileId !== undefined && v.modelProfileId !== null && (typeof v.modelProfileId !== 'string' || !/^[a-f0-9-]{36}$/.test(v.modelProfileId)))) {
    throw new DomainError('INVALID_INPUT', 'Choose a published report and an optional model profile from this workspace.');
  }
  return { ...guard, type: 'challenge', text, targetReportId: v.targetReportId, modelProfileId: v.modelProfileId as string | null ?? null };
}
