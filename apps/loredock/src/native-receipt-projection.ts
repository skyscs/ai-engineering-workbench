import { codeAnalysisLimits } from './code-analysis-types.js';
import { codePathLimits } from './code-paths-work.js';
import { operationAccounting } from './operation-budget.js';
import { literalTopic, topicRule } from './literal-topic.js';
import type { MapEvidence } from './system-map-types.js';
import type { ReceiptProjection } from './native-receipt-types.js';
import { array, dictionary, gitId, hash, hex, integer, nullable, oneOf, parseJson, requireReceipt,
  same, shape, sortedUnique, string, unique, uuid, type Check, type receiptContext } from './native-receipt-json.js';

const bool = oneOf(true, false), count = integer(), strings = array(string(655360), 20000);
const numbers = dictionary(count), ids = array(uuid, 30, 1);
const boundedNumbers = (limits: Record<string, number>) => shape(Object.fromEntries(Object.entries(limits).map(([key, limit]) => [key, integer(limit)])));
const path: Check = value => string(4096, 1)(value) && !(value as string).includes('\0')
  && !(value as string).includes('\\') && !(value as string).split('/').some(part => !part || part === '.' || part === '..')
  && !/^[A-Za-z]:/.test(value as string);
export const locatorFields = { sourceName: string(512, 1), path, revision: gitId, startLine: integer(Number.MAX_SAFE_INTEGER, 1), endLine: integer(Number.MAX_SAFE_INTEGER, 1) };
export const evidenceShape = shape({ id: uuid, ...locatorFields });
const evidence = dictionary(evidenceShape, 30);
const node = shape({ id: hex, kind: oneOf('symbol', 'http-request', 'event-publish', 'event-subscribe', 'document-write', 'route', 'handler-reference', 'contract'),
  label: string(512), sourceId: uuid, ...locatorFields, properties: dictionary(string(512)), evidenceIds: ids });
const witnessEndpoint = shape({ expression: string(512), evidenceIds: ids });
const edge = shape({ id: hex, kind: oneOf('calls', 'performs', 'http-target', 'routes-to', 'implements', 'event-delivery', 'dispatch-candidate'),
  from: hex, to: hex, status: oneOf('static', 'candidate'), reason: string(655360), environment: nullable(string(512)), gaps: strings, evidenceIds: ids },
  { headerCheck: shape({ status: oneOf('match', 'gap', 'unknown'), detail: string(655360) }),
    topicCheck: shape({ rule: oneOf(topicRule.version), value: string(256, 1), publisher: witnessEndpoint, subscriber: witnessEndpoint }) });
const flow = shape({ id: hex, title: string(655360), status: oneOf('partial'), environment: oneOf(null),
  nodeIds: array(hex, 20, 1), edgeIds: array(hex, 19), evidenceIds: ids, gaps: strings });
const root: Check = value => shape({ status: oneOf('unavailable'), id: hex, reason: string(655360) })(value)
  || shape({ status: oneOf('available'), id: hex, role: string(512, 1), sourceId: uuid, ...locatorFields, label: string(512), evidenceIds: ids })(value);
const resolution = { candidateDocuments: count, examinedDocuments: count, parsedBytes: count, comparisons: count, alternativeReferences: count };
const versions = { buildId: uuid, policyVersion: count, sourceSetVersion: count, registryVersion: count };
const graph = shape({ schemaVersion: oneOf('loredock-connected-display/2'), adapterVersion: oneOf('connected-paths-v2'), ...versions,
  stale: bool, partial: oneOf(true), deploymentCoherence: oneOf('unknown'), nodes: array(node, 160), edges: array(edge, 240), flows: array(flow, 2), evidence,
  gaps: strings, omissions: numbers, declarationOmissions: numbers, limits: boundedNumbers(codePathLimits), inputHash: hex,
  coverage: shape({ ...resolution, resolutionNodes: count, resolutionEdges: count, candidateRoots: count,
    selectedRoots: array(hex, 2), traversals: count, unselectedNodes: count, unselectedEdges: count }) });
const source = shape({ sourceId: uuid, knownPaths: count, status: oneOf('pending', 'ready', 'failed'), omittedPaths: count,
  treeVerified: bool, opaquePaths: count, unsafePaths: bool, filesWithGaps: count, javaFiles: count, javaComplete: bool });
const projectionShape = shape({ schemaVersion: oneOf('loredock-code-paths/2'), status: oneOf('available'), kind: oneOf('paths'), generationId: hex, projectionId: hex,
  identity: shape({ ...versions, inventoryId: uuid, fingerprint: hex, analysisLimits: boundedNumbers(codeAnalysisLimits), manifestHash: hex,
    metadataDigest: hex, declarationAdapter: oneOf('json-declarations-v2'), declarationInputHash: hex, adapter: oneOf('connected-paths-v2'),
    topicRule: shape({ version: oneOf(topicRule.version), maxUtf8Bytes: oneOf(topicRule.maxUtf8Bytes) }),
    accounting: shape({ version: oneOf(operationAccounting.version), work: oneOf(operationAccounting.work), wallMs: oneOf(operationAccounting.wallMs) }),
    limits: boundedNumbers(codePathLimits) }),
  coverage: shape({ scannedFiles: count, retainedFiles: count, scanComplete: oneOf(true), factEntries: count, consumedHash: hex,
    inventoryCounts: numbers, metadataEntries: count, metadataBytes: count, sources: array(source, 20), incompleteBindings: count, bindingReasons: numbers,
    resolution: shape({ ...resolution, nodes: count, edges: count, roots: count }), omissions: numbers, declarationOmissions: numbers }), graph,
  selection: shape({ rootId: nullable(hex), offset: oneOf(0) }), partial: oneOf(true), deploymentCoherence: oneOf('unknown'),
  roots: shape({ offset: oneOf(0), limit: oneOf(4), total: count, previous: oneOf(null), next: nullable(integer()), outsidePage: count,
    unavailableEntries: integer(4), items: array(root, 4), evidence }) });

/** Recompute recorded identities only; no fact lookup, binding resolution or authorization. */
export function decodeProjection(serialized: string, context: ReturnType<typeof receiptContext>) {
  const parsed = parseJson(serialized, context.limits.projectionBytes, context);
  requireReceipt(projectionShape(parsed) && serialized === JSON.stringify(parsed));
  const value = parsed as ReceiptProjection, { identity, graph: g, coverage: c, roots: page } = value;
  const charge = () => context.budget.charge('receipt');
  const { projectionId, ...content } = value, { inputHash, ...graphContent } = g;
  requireReceipt(hash(JSON.stringify(content)) === projectionId && hash(JSON.stringify(identity)) === value.generationId && hash(JSON.stringify(graphContent)) === inputHash);
  requireReceipt(g.buildId === identity.buildId && g.policyVersion === identity.policyVersion && g.sourceSetVersion === identity.sourceSetVersion
    && g.registryVersion === identity.registryVersion && identity.registryVersion >= identity.sourceSetVersion
    && g.stale === (identity.registryVersion !== identity.sourceSetVersion) && same(g.limits, identity.limits));
  requireReceipt(c.sources.length <= context.limits.sources && unique(c.sources.map(row => row.sourceId)));
  requireReceipt(c.scannedFiles === c.retainedFiles && c.scannedFiles <= identity.limits.files && c.factEntries <= identity.limits.facts
    && c.metadataEntries <= identity.limits.metadataEntries && c.metadataBytes <= identity.limits.metadataBytes);
  for (const key of Object.keys(resolution) as (keyof typeof resolution)[]) requireReceipt(c.resolution[key] === g.coverage[key]);
  requireReceipt(g.coverage.resolutionNodes === c.resolution.nodes && g.coverage.resolutionEdges === c.resolution.edges
    && g.coverage.candidateRoots === c.resolution.roots && c.resolution.roots === page.total
    && g.coverage.unselectedNodes === c.resolution.nodes - g.nodes.length && g.coverage.unselectedEdges === c.resolution.edges - g.edges.length
    && c.resolution.nodes <= identity.limits.resolutionNodes && c.resolution.edges <= identity.limits.resolutionEdges
    && c.resolution.comparisons <= identity.limits.comparisons && c.resolution.alternativeReferences <= identity.limits.alternativeReferences
    && g.coverage.traversals <= identity.limits.traversals && g.nodes.length <= identity.limits.nodes && g.edges.length <= identity.limits.edges
    && g.flows.length <= identity.limits.flows);
  requireReceipt(page.items.length === Math.min(4, page.total) && unique(page.items.map(item => item.id))
    && page.outsidePage === page.total - page.items.length && page.next === (page.total > 4 ? 4 : null)
    && page.unavailableEntries === page.items.filter(item => item.status === 'unavailable').length);
  requireReceipt(unique(g.coverage.selectedRoots) && (value.selection.rootId === null
    ? same(g.coverage.selectedRoots, page.items.slice(0, identity.limits.flows).map(item => item.id))
    : same(g.coverage.selectedRoots, [value.selection.rootId])));
  const evidence = new Map<string, MapEvidence>(), graphUsed = new Set<string>(), rootUsed = new Set<string>();
  for (const dictionary of [g.evidence, page.evidence]) for (const [id, ref] of Object.entries(dictionary)) {
    charge(); requireReceipt(id === ref.id && ref.startLine <= ref.endLine && (!evidence.has(id) || same(evidence.get(id), ref))); evidence.set(id, ref);
  }
  requireReceipt(evidence.size <= context.limits.spans, 'RECEIPT_SPAN_LIMIT');
  const support = (ids: string[], dictionary: Record<string, MapEvidence>, used: Set<string>) => {
    requireReceipt(unique(ids)); for (const id of ids) { requireReceipt(Object.hasOwn(dictionary, id)); used.add(id); }
  };
  const nodes = new Map(g.nodes.map(item => [item.id, item])), edges = new Map(g.edges.map(item => [item.id, item]));
  requireReceipt(nodes.size === g.nodes.length && edges.size === g.edges.length && unique(g.flows.map(item => item.id)));
  for (const node of g.nodes) { charge(); requireReceipt(node.startLine <= node.endLine); support(node.evidenceIds, g.evidence, graphUsed); }
  for (const edge of g.edges) {
    charge(); const from = nodes.get(edge.from), to = nodes.get(edge.to); requireReceipt(from && to && from.id !== to.id);
    requireReceipt(edge.id === hash(JSON.stringify([value.generationId, 'connected-paths-v2', 'edge', edge.kind, edge.from, edge.to, edge.environment])));
    requireReceipt(sortedUnique(edge.evidenceIds) && [...from.evidenceIds, ...to.evidenceIds].every(id => edge.evidenceIds.includes(id)));
    support(edge.evidenceIds, g.evidence, graphUsed);
    if (edge.headerCheck) requireReceipt(edge.kind === 'http-target');
    if (edge.kind === 'event-delivery') {
      const witness = edge.topicCheck; requireReceipt(witness && edge.status === 'candidate' && from.kind === 'event-publish' && to.kind === 'event-subscribe');
      for (const [item, endpoint] of [[witness.publisher, from], [witness.subscriber, to]] as const) {
        requireReceipt(literalTopic(item.expression) === witness.value && item.expression === endpoint.properties.topicExpression
          && same(item.evidenceIds, [...endpoint.evidenceIds].sort())); support(item.evidenceIds, g.evidence, graphUsed);
      }
    } else requireReceipt(!Object.hasOwn(edge, 'topicCheck'));
  }
  const flowNodes = new Set<string>(), flowEdges = new Set<string>(), flowRoots = new Set<string>();
  for (const flow of g.flows) {
    charge(); requireReceipt(unique(flow.nodeIds) && unique(flow.edgeIds) && flow.nodeIds.length <= identity.limits.steps
      && flow.nodeIds.every(id => nodes.has(id)) && flow.edgeIds.length === flow.nodeIds.length - 1 && !flowRoots.has(flow.nodeIds[0]!));
    flowRoots.add(flow.nodeIds[0]!); requireReceipt(g.coverage.selectedRoots.includes(flow.nodeIds[0]!));
    requireReceipt(flow.id === hash(JSON.stringify([identity.buildId, 'connected-paths-v2', flow.nodeIds[0], flow.edgeIds])));
    const expectedSupport = new Set(flow.nodeIds.flatMap(id => nodes.get(id)!.evidenceIds));
    flow.nodeIds.forEach(id => flowNodes.add(id));
    for (const [index, id] of flow.edgeIds.entries()) {
      const edge = edges.get(id); requireReceipt(edge && edge.from === flow.nodeIds[index] && edge.to === flow.nodeIds[index + 1]);
      flowEdges.add(id); edge.evidenceIds.forEach(ref => expectedSupport.add(ref));
    }
    requireReceipt(same(flow.evidenceIds, [...expectedSupport].sort())); support(flow.evidenceIds, g.evidence, graphUsed);
  }
  requireReceipt(flowNodes.size === nodes.size && flowEdges.size === edges.size);
  for (const root of page.items) if (root.status === 'available') {
    charge(); requireReceipt(root.startLine <= root.endLine); support(root.evidenceIds, page.evidence, rootUsed);
    const node = nodes.get(root.id);
    if (node) requireReceipt(node.kind === 'symbol' && node.sourceId === root.sourceId && node.properties.role === root.role
      && node.label === root.label && node.sourceName === root.sourceName && node.path === root.path && node.revision === root.revision
      && node.startLine === root.startLine && node.endLine === root.endLine && same(node.evidenceIds, root.evidenceIds));
  }
  requireReceipt(graphUsed.size === Object.keys(g.evidence).length && rootUsed.size === Object.keys(page.evidence).length);
  context.budget.check(); return { value, evidence };
}
