import type { CodeAnalysis } from './code-analysis.js';
import type { AnalysisFileSummary } from './code-analysis-types.js';
import type { CanonicalFactPair } from './canonical-fact-pair.js';
import type { FlowEdge, FlowNode } from './code-flow-types.js';
import type { MapEvidence } from './system-map-types.js';
import type { BuildSourceRow, FileRow } from './store.js';
import type { PathResolutionCoverage, PathSourceCoverage } from './code-paths-types.js';
import type { SymbolFact } from './code-facts.js';

export type PathSnapshot = ReturnType<CodeAnalysis['snapshot']>;
export type PathSourceHeader = Pick<BuildSourceRow, 'sourceId' | 'name' | 'revision' | 'tree' | 'status' | 'omitted'>;
export type SavedPath = Pick<FileRow, 'id' | 'sourceId' | 'path' | 'mode' | 'blob' | 'size' | 'status' | 'reason' | 'contentHash'>;
export interface PathSource extends PathSourceHeader {
  files: SavedPath[]; byPath: Map<string, SavedPath>; unsafe: boolean; opaque: string[]; treeVerified: boolean;
}
export interface PathMetadata {
  digest: string; bytes: number; entries: number; sources: Map<string, PathSource>; files: Map<string, SavedPath>;
}
export interface JoinedPathMetadata extends PathMetadata { units: Map<string, AnalysisFileSummary> }
export interface PathFactEntry { file: SavedPath; payload: CanonicalFactPair & { evidence: MapEvidence[] } }
export interface BindingDomain {
  kind: 'java-source' | 'import-paths'; complete: boolean; reasons: Record<string, number>; candidateFiles: number; paths?: string[];
}
export interface BindingDomains {
  summaries: PathSourceCoverage[]; java(sourceId: string): BindingDomain; imports(sourceId: string, paths: string[]): BindingDomain;
}
export interface PathBinding {
  kind: 'calls' | 'implements' | 'consumer'; owner: string; targets: string[]; incomplete: boolean; domain: BindingDomain;
  outcome: 'unique' | 'ambiguous' | 'unresolved';
}
export interface PathRoot { id: string; role: SymbolFact['role']; key: string }
export interface PathResolution {
  schemaVersion: 'loredock-connected-resolution/1'; adapterVersion: 'connected-paths-v1'; buildId: string;
  policyVersion: number; sourceSetVersion: number; registryVersion: number; stale: boolean;
  partial: true; deploymentCoherence: 'unknown'; nodes: FlowNode[]; edges: FlowEdge[]; evidence: Record<string, MapEvidence>;
  omissions: Record<string, number>; declarationOmissions: Record<string, number>; roots: PathRoot[];
  resolutions: PathBinding[]; coverage: PathResolutionCoverage; gaps: string[];
}
