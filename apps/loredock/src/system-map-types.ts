// Transport-only declarations; no infrastructure imports in the browser.
export type MapNodeKind = 'repository' | 'package' | 'http-route' | 'handler-reference' | 'event-contract' | 'setting';
export type MapEdgeKind = 'declares' | 'routes-to' | 'contract-match' | 'contract-difference' | 'setting-match' | 'setting-difference';
export interface MapNode {
  id: string; kind: MapNodeKind; label: string; sourceId: string; sourceName: string;
  revision: string | null; environment: string | null; provenance: 'catalog' | 'declaration';
  properties: Record<string, string>; evidenceIds: string[];
}
export interface MapEdge {
  id: string; kind: MapEdgeKind; from: string; to: string;
  status: 'declared' | 'candidate' | 'difference'; environment: string | null;
  reason: string; evidenceIds: string[];
}
export interface MapEvidence {
  id: string; sourceName: string; path: string; revision: string; startLine: number; endLine: number;
}
export interface DeclarationMap {
  schemaVersion: 'loredock-map-v1'; adapterVersion: 'json-declarations-v1'; buildId: string;
  policyVersion: number; sourceSetVersion: number; registryVersion: number; stale: boolean;
  partial: true; deploymentCoherence: 'unknown'; nodes: MapNode[]; edges: MapEdge[];
  evidence: Record<string, MapEvidence>; gaps: string[]; omissions: Record<string, number>;
  coverage: { indexedFiles: number; candidateDocuments: number; examinedDocuments: number; parsedBytes: number };
  limits: { documents: number; fileBytes: number; textBytes: number; fileSpans: number; members: number; nodes: number; edges: number; comparisons: number; outputBytes: number };
  inputHash: string;
}
