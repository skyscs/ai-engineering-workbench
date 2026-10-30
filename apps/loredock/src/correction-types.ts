export type CorrectionTarget = 'declaration-link' | 'code-link';
export type CorrectionAction = 'dispute' | 'clarify' | 'withdraw';
export interface CorrectionInput {
  requestId: string; buildId: string; targetKind: CorrectionTarget; targetId: string;
  projectionHash: string; expectedRevision: number; expectedPreviousId: string | null;
  action: CorrectionAction; statement: string | null; environment: string | null;
}
export interface CorrectionSummary {
  id: string; buildId: string; targetKind: CorrectionTarget; targetId: string;
  version: number; revision: number; previousId: string | null; createdAt: string;
  action: CorrectionAction; statement: string | null; environment: string | null;
  provenance: 'human'; verification: 'unverified'; affectedFlowIds: string[];
}
export interface CorrectionSnapshot {
  schemaVersion: string; adapterVersion: string; projectionHash: string;
  id: string; kind: string; status: string; reason: string; environment: string | null;
  from: { id: string; label: string; sourceId: string; sourceName: string };
  to: { id: string; label: string; sourceId: string; sourceName: string };
  evidenceIds: string[];
}
export interface CorrectionHistory {
  buildId: string; revision: number; versions: (CorrectionSummary & { original: CorrectionSnapshot })[];
}
export interface CorrectionOverlay {
  schemaVersion: 'loredock-corrections-v1'; buildId: string; policyVersion: number;
  registryVersion: number; revision: number; stale: boolean; editable: boolean;
  corrections: CorrectionSummary[];
  limits: { targets: number; versions: number; statementBytes: number; snapshotBytes: number; outputBytes: number; historyBytes: number };
}
