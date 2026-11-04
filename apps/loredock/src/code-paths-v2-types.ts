import type { FlowEdge } from './code-flow-types.js';
import type { CodePathGraph, CodePathIdentity, CodePathsAvailable, CodePathsUnavailable } from './code-paths-types.js';
import type { PathResolution } from './code-paths-internal.js';
import type { topicRule } from './literal-topic.js';
import type { operationAccounting } from './operation-budget.js';

export interface TopicWitness {
  rule: typeof topicRule.version; value: string;
  publisher: { expression: string; evidenceIds: string[] };
  subscriber: { expression: string; evidenceIds: string[] };
}
export interface FlowEdgeV2 extends FlowEdge { topicCheck?: TopicWitness }
export interface PathResolutionV2 extends Omit<PathResolution, 'schemaVersion' | 'adapterVersion' | 'edges'> {
  schemaVersion: 'loredock-connected-resolution/2'; adapterVersion: 'connected-paths-v2'; edges: FlowEdgeV2[];
}
export interface CodePathGraphV2 extends Omit<CodePathGraph, 'schemaVersion' | 'adapterVersion' | 'edges'> {
  schemaVersion: 'loredock-connected-display/2'; adapterVersion: 'connected-paths-v2'; edges: FlowEdgeV2[];
}
export interface CodePathIdentityV2 extends Omit<CodePathIdentity, 'adapter'> {
  adapter: 'connected-paths-v2'; topicRule: typeof topicRule; accounting: typeof operationAccounting;
}
export interface CodePathsAvailableV2 extends Omit<CodePathsAvailable, 'schemaVersion' | 'identity' | 'graph'> {
  schemaVersion: 'loredock-code-paths/2'; identity: CodePathIdentityV2; graph: CodePathGraphV2 | null;
}
export interface CodePathsUnavailableV2 extends Omit<CodePathsUnavailable, 'schemaVersion'> { schemaVersion: 'loredock-code-paths/2' }
export type CodePathsResponseV2 = CodePathsAvailableV2 | CodePathsUnavailableV2;
