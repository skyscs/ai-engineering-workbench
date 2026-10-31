import type { Catalog } from './catalog.js';
import type { AnswerContext } from './answer-context.js';
import type { CodeFlows, FlowNode } from './code-flow-types.js';
import type { DeclarationMap } from './system-map-types.js';
import type { HeaderCheck } from './http-headers.js';
import { codeFlows } from './code-flows.js';
import { answerPrompt, answerPromptBytes } from './answer-prompt.js';
import { CatalogError } from './types.js';

export const answerInterfaceLimits = { comparisons: 6, comparisonBytes: 8 * 1024 } as const;
type Endpoint = Pick<FlowNode, 'sourceId' | 'sourceName' | 'path' | 'label'>;
export interface AnswerInterfaceComparison {
  id: string; kind: 'http-target'; status: 'candidate'; from: Endpoint; to: Endpoint;
  headerCheck: HeaderCheck; evidenceIds: string[];
}
export interface AnswerInterfaces {
  schemaVersion: 'answer-interfaces-v1'; provenance: 'static-analysis'; verification: 'unverified';
  codeAdapter: CodeFlows['adapterVersion']; declarationAdapter: DeclarationMap['adapterVersion'];
  comparisons: AnswerInterfaceComparison[]; matching: number; incomplete: number; unrelated: number;
  omitted: number; comparisonBytes: number; limits: typeof answerInterfaceLimits;
  graphOmissions: Record<string, number>; declarationOmissions: Record<string, number>; gaps: string[];
}
const bytes = (items: AnswerInterfaceComparison[]) => Buffer.byteLength(JSON.stringify(items));
const endpoint = ({ sourceId, sourceName, path, label }: FlowNode): Endpoint => ({ sourceId, sourceName, path, label });

/** Admission requires the complete original support already present in the source context. */
export function selectAnswerInterfaces(graph: CodeFlows, evidenceIds: string[]): AnswerInterfaces {
  const issued = new Set(evidenceIds), comparisons: AnswerInterfaceComparison[] = [];
  let matching = 0, incomplete = 0, unrelated = 0;
  for (const edge of graph.edges) {
    if (edge.kind !== 'http-target' || edge.status !== 'candidate' || !edge.headerCheck) continue;
    if (!edge.evidenceIds.some(id => issued.has(id))) { unrelated++; continue; }
    if (!edge.evidenceIds.every(id => issued.has(id))) { incomplete++; continue; }
    matching++;
    const from = graph.nodes.find(node => node.id === edge.from)!, to = graph.nodes.find(node => node.id === edge.to)!;
    const item: AnswerInterfaceComparison = { id: edge.id, kind: 'http-target', status: 'candidate',
      from: endpoint(from), to: endpoint(to), headerCheck: edge.headerCheck, evidenceIds: edge.evidenceIds };
    if (comparisons.length < answerInterfaceLimits.comparisons && bytes([...comparisons, item]) <= answerInterfaceLimits.comparisonBytes) comparisons.push(item);
  }
  return { schemaVersion: 'answer-interfaces-v1', provenance: 'static-analysis', verification: 'unverified',
    codeAdapter: graph.adapterVersion, declarationAdapter: 'json-declarations-v2', comparisons,
    matching, incomplete, unrelated, omitted: matching - comparisons.length, comparisonBytes: bytes(comparisons),
    limits: answerInterfaceLimits, graphOmissions: graph.omissions, declarationOmissions: graph.declarationOmissions,
    gaps: [
      'Static comparisons describe supported declarations only; deployment, header values, rewriting, parameter conversion and identity enforcement remain unverified.',
      'Only candidates whose complete original support is already supplied are included. Missing comparisons do not establish absence.',
      'Graph analysis is bounded. Unsupported syntax and candidates outside its document, text, graph or comparison budgets are not exhaustively examined.',
    ] };
}

export function answerInterfaces(catalog: Catalog, buildId: string, evidenceIds: string[]) {
  return selectAnswerInterfaces(codeFlows(catalog, buildId), evidenceIds);
}

/** Drop whole derived items, never original source spans or engineer notes. */
export function fitAnswerInterfaces(context: Omit<AnswerContext, 'inputHash'>) {
  const block = context.interfaces;
  while (block?.comparisons.length && Buffer.byteLength(answerPrompt(context)) > answerPromptBytes) {
    block.comparisons.pop(); block.omitted = block.matching - block.comparisons.length;
    block.comparisonBytes = bytes(block.comparisons);
  }
  if (Buffer.byteLength(answerPrompt(context)) > answerPromptBytes) {
    throw new CatalogError('INPUT_LIMIT', 'The complete context exceeds 96 KiB even without derived comparisons. Narrow the question or source scope.', 409);
  }
}

export function assertAnswerInterfaces(catalog: Catalog, context: AnswerContext) {
  // Legacy contexts retain their original optional-field absence and hashed bytes.
  if (context.interfaces === undefined) return;
  const expected = { ...context, interfaces: answerInterfaces(catalog, context.buildId, context.spans.map(span => span.id)) };
  fitAnswerInterfaces(expected);
  if (JSON.stringify(context.interfaces) !== JSON.stringify(expected.interfaces)) {
    throw new CatalogError('INVALID_ANSWER', 'The derived interface comparisons do not match their issued original support and adapter provenance.', 422);
  }
}
