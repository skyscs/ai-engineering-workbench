import type { AnalysisLimits } from './code-analysis-types.js';
import type { FlowEdge, FlowNode, StaticFlow } from './code-flow-types.js';
import type { MapEvidence } from './system-map-types.js';

// Transport declarations only. Internal resolution and saved fact vectors are not wire data.
export interface CodePathLimits {
  files: number; facts: number; wallMs: number; work: number; metadataEntries: number; metadataBytes: number;
  resolutionNodes: number; resolutionEdges: number; bindingRecords: number; alternativeReferences: number;
  nodes: number; edges: number; flows: number; steps: number; traversals: number; pendingPaths: number;
  comparisons: number; outputBytes: number;
}
export interface PathSourceCoverage {
  sourceId: string; knownPaths: number; status: 'pending' | 'ready' | 'failed'; omittedPaths: number;
  treeVerified: boolean; opaquePaths: number; unsafePaths: boolean; filesWithGaps: number; javaFiles: number; javaComplete: boolean;
}
export interface PathResolutionCoverage {
  candidateDocuments: number; examinedDocuments: number; parsedBytes: number; comparisons: number; alternativeReferences: number;
}
export interface CodePathGraph {
  schemaVersion: 'loredock-connected-display/1'; adapterVersion: 'connected-paths-v1'; buildId: string;
  policyVersion: number; sourceSetVersion: number; registryVersion: number; stale: boolean;
  partial: true; deploymentCoherence: 'unknown'; nodes: FlowNode[]; edges: FlowEdge[]; flows: StaticFlow[];
  evidence: Record<string, MapEvidence>; gaps: string[]; omissions: Record<string, number>;
  declarationOmissions: Record<string, number>; limits: CodePathLimits;
  coverage: PathResolutionCoverage & { resolutionNodes: number; resolutionEdges: number; candidateRoots: number;
    selectedRoots: string[]; traversals: number; unselectedNodes: number; unselectedEdges: number };
  inputHash: string;
}
export interface CodePathIdentity {
  buildId: string; sourceSetVersion: number; inventoryId: string; fingerprint: string; analysisLimits: AnalysisLimits;
  manifestHash: string; metadataDigest: string; declarationAdapter: string; declarationInputHash: string;
  policyVersion: number; registryVersion: number; adapter: 'connected-paths-v1'; limits: CodePathLimits;
}
export interface CodePathCoverage {
  scannedFiles: number; retainedFiles: number; scanComplete: true; factEntries: number; consumedHash: string;
  inventoryCounts: Record<string, number>; metadataEntries: number; metadataBytes: number; sources: PathSourceCoverage[];
  incompleteBindings: number; bindingReasons: Record<string, number>;
  resolution: PathResolutionCoverage & { nodes: number; edges: number; roots: number };
  omissions: Record<string, number>; declarationOmissions: Record<string, number>;
}
export type CodePathRootCard = { status: 'available'; id: string; role: string; sourceId: string; sourceName: string;
  path: string; revision: string; label: string; startLine: number; endLine: number; evidenceIds: string[] }
  | { status: 'unavailable'; id: string; reason: string };
export interface CodePathRootPage {
  offset: number; limit: 4; total: number; previous: number | null; next: number | null;
  outsidePage: number; unavailableEntries: number; items: CodePathRootCard[]; evidence: Record<string, MapEvidence>;
}
export interface CodePathsAvailable {
  schemaVersion: 'loredock-code-paths/1'; status: 'available'; kind: 'paths' | 'roots'; generationId: string; projectionId: string;
  identity: CodePathIdentity; coverage: CodePathCoverage; roots: CodePathRootPage; graph: CodePathGraph | null;
  selection: { rootId: string | null; offset: number }; partial: true; deploymentCoherence: 'unknown';
}
export interface CodePathsUnavailable {
  schemaVersion: 'loredock-code-paths/1'; status: 'unavailable'; buildId: string;
  reason: { code: string; message: string };
}
export type CodePathsResponse = CodePathsAvailable | CodePathsUnavailable;
export interface CodePathRequest { buildId: string; inventoryId?: string; generationId?: string; rootId?: string; offset?: number }
