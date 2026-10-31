import type { MapEvidence } from './system-map-types.js';
import type { HeaderCheck } from './http-headers.js';

export type FlowNodeKind = 'symbol' | 'http-request' | 'event-publish' | 'event-subscribe' | 'document-write' | 'route' | 'handler-reference' | 'contract';
export interface FlowNode {
  id: string; kind: FlowNodeKind; label: string; sourceId: string; sourceName: string;
  path: string; revision: string; startLine: number; endLine: number;
  properties: Record<string, string>; evidenceIds: string[];
}
export interface FlowEdge {
  id: string; kind: 'calls' | 'performs' | 'http-target' | 'routes-to' | 'implements' | 'event-delivery' | 'dispatch-candidate';
  from: string; to: string; status: 'static' | 'candidate'; reason: string;
  environment: string | null; gaps: string[]; evidenceIds: string[];
  headerCheck?: HeaderCheck;
}
export interface StaticFlow {
  id: string; title: string; status: 'partial'; environment: null;
  nodeIds: string[]; edgeIds: string[]; evidenceIds: string[]; gaps: string[];
}
export interface CodeFlows {
  schemaVersion: 'loredock-code-flows-v1'; adapterVersion: 'pilot-code-v3'; buildId: string;
  policyVersion: number; sourceSetVersion: number; registryVersion: number; stale: boolean;
  partial: true; deploymentCoherence: 'unknown'; nodes: FlowNode[]; edges: FlowEdge[]; flows: StaticFlow[];
  evidence: Record<string, MapEvidence>; gaps: string[]; omissions: Record<string, number>;
  declarationOmissions: Record<string, number>;
  coverage: { candidateDocuments: number; examinedDocuments: number; parsedBytes: number };
  limits: { documents: number; fileBytes: number; textBytes: number; fileSpans: number; nodes: number; edges: number;
    comparisons: number; flows: number; flowSteps: number; traversals: number; outputBytes: number };
  inputHash: string;
}
