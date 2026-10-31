import type { CorrectionSnapshot, CorrectionSummary } from './correction-types.js';
import type { MapEvidence } from './system-map-types.js';

export type ReconciliationStatus = 'support-unchanged' | 'support-changed' | 'missing' | 'ambiguous' | 'unsupported' | 'already-reviewed';
export interface ReconciliationEntry {
  source: CorrectionSummary; original: CorrectionSnapshot;
  status: ReconciliationStatus; reason: string; current: CorrectionSnapshot | null;
}
export interface ReapplicationInput {
  requestId: string; buildId: string; sourceCorrectionId: string; targetId: string; previewHash: string; expectedRevision: number;
}
export interface ReconciliationPreview {
  schemaVersion: 'loredock-reconciliation-v1'; buildId: string; fromBuildId: string | null;
  policyVersion: number; registryVersion: number; revision: number; stale: boolean; editable: boolean;
  ancestors: { id: string; createdAt: string; activeCorrections: number }[];
  scope: { previous: { sourceId: string; name: string; revision: string | null }[]; current: { sourceId: string; name: string; revision: string | null }[] };
  entries: ReconciliationEntry[]; evidence: Record<string, MapEvidence>;
  activeCorrections: number; omittedCorrections: number; gaps: string[];
  limits: { ancestors: number; corrections: number; outputBytes: number };
  previewHash: string;
}
