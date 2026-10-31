export type FileChangeKind = 'initial' | 'added' | 'changed' | 'removed' | 'unchanged' | 'coverageChanged' | 'uncompared';
export type FileChangeCounts = Record<FileChangeKind, number>;
export interface IndexChanges {
  schemaVersion: 'loredock-index-changes-v1'; buildId: string; baselineBuildId: string | null;
  policyVersion: number; registryVersion: number; stale: boolean;
  comparison: 'initial' | 'update' | 'legacy'; complete: boolean;
  counts: FileChangeCounts;
  sources: { sourceId: string; name: string; previousRevision: string | null; revision: string | null;
    isNew: boolean; inventoryComplete: boolean; counts: FileChangeCounts }[];
  files: { sourceId: string; sourceName: string; path: string; change: FileChangeKind;
    previousStatus: string | null; status: string | null; previousEvidenceId: string | null; evidenceId: string | null }[];
  omittedDetails: number; gaps: string[];
  metrics: { reusedFiles: number; gitReadAttempts: number; cacheRejections: number } | null;
  limits: { filesPerIndex: number; details: number; outputBytes: number };
}
