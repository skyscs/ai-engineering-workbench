import type { BuildSource, Coverage } from './types.js';
import type { MapEvidence } from './system-map-types.js';

export interface OrientationExcerpt {
  text: string; startLine: number; endLine: number; evidenceIds: string[]; truncated: boolean;
  provenance: 'documented'; verification: 'unverified';
}
export interface OrientationSource {
  sourceId: string; sourceName: string; revision: string | null; sourceStatus: BuildSource['status']; coverage: Coverage; omittedInventory: number;
  readme: { path: string | null; state: 'available' | 'missing' | 'ambiguous' | 'excluded' | 'unavailable' | 'limited' | 'no-prose'; reason: string };
  context: OrientationExcerpt | null;
  reading: { kind: 'readme' | 'manifest'; path: string; evidenceIds: string[] }[];
  gaps: string[];
}
export interface ProjectOrientation {
  schemaVersion: 'loredock-orientation-v1'; adapterVersion: 'readme-orientation-v2'; buildId: string;
  policyVersion: number; sourceSetVersion: number; registryVersion: number; stale: boolean;
  partial: true; deploymentCoherence: 'unknown'; sources: OrientationSource[];
  unindexedSources: { sourceId: string; sourceName: string }[];
  evidence: Record<string, MapEvidence>; gaps: string[]; omissions: Record<string, number>;
  coverage: { repositories: number; withContext: number; examinedDocuments: number; parsedBytes: number };
  limits: { repositories: number; documents: number; fileBytes: number; textBytes: number; fileSpans: number; excerptBytes: number; excerptLines: number; outputBytes: number };
  inputHash: string;
}
