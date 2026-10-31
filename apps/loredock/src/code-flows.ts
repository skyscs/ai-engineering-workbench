import path from 'node:path';
import type { Catalog } from './catalog.js';
import type { CodeFacts, OperationFact, SymbolFact } from './code-facts.js';
import { javaFacts } from './code-java.js';
import { typescriptFacts } from './code-typescript.js';
import { sha256 } from './extract.js';
import { readMapDocument, type MapDocument } from './map-document.js';
import { declarationMap } from './system-map.js';
import type { MapEvidence, MapNode } from './system-map-types.js';
import { CatalogError } from './types.js';
import type { CodeFlows, FlowEdge, FlowNode, StaticFlow } from './code-flow-types.js';
import { compareHeaders, type HeaderCheck } from './http-headers.js';

export const flowLimits = { documents: 100, fileBytes: 32 * 1024, textBytes: 256 * 1024, fileSpans: 8,
  nodes: 160, edges: 240, comparisons: 2000, flows: 2, flowSteps: 20, traversals: 1000, outputBytes: 512 * 1024 } as const;
interface Parsed { file: MapDocument; facts: CodeFacts; refs: MapEvidence[]; content: string }
interface SymbolEntry { node: FlowNode; fact: SymbolFact; document: Parsed }
interface OperationEntry { node: FlowNode; fact: OperationFact; owner: SymbolEntry }
const unique = (values: string[]) => [...new Set(values)].sort();

/** Code syntax and candidate wiring are navigation aids, never observed execution. */
export function codeFlows(catalog: Catalog, buildId?: string): CodeFlows {
  const declaration = declarationMap(catalog, buildId), build = catalog.readBuild(declaration.buildId);
  const nodes: FlowNode[] = [], edges: FlowEdge[] = [], flows: StaticFlow[] = [];
  const available = new Map(Object.values(declaration.evidence).map(ref => [ref.id, ref]));
  const evidence = new Map<string, MapEvidence>(), omissions: Record<string, number> = {};
  const symbols: SymbolEntry[] = [], operations: OperationEntry[] = [];
  let outputBytes = 0, parsedBytes = 0, examinedDocuments = 0, comparisons = 0;
  const omit = (reason: string, count = 1) => { omissions[reason] = (omissions[reason] ?? 0) + count; };
  const id = (...parts: unknown[]) => sha256(JSON.stringify([build.id, 'pilot-code-v3', ...parts]));
  function reserve(item: FlowNode | FlowEdge | StaticFlow) {
    const refs = item.evidenceIds.filter(ref => !evidence.has(ref)).map(ref => available.get(ref)!);
    const cost = Buffer.byteLength(JSON.stringify(item)) + 1 + refs.reduce((sum, ref) => sum + Buffer.byteLength(JSON.stringify(ref)) + ref.id.length + 4, 0);
    if (outputBytes + cost > flowLimits.outputBytes - 16 * 1024) { omit('output-byte-limit'); return false; }
    outputBytes += cost; for (const ref of refs) evidence.set(ref.id, ref); return true;
  }
  function addNode(item: FlowNode): FlowNode | undefined {
    const existing = nodes.find(node => node.id === item.id); if (existing) return existing;
    if (nodes.length >= flowLimits.nodes) { omit('node-limit'); return; }
    if (item.label.length > 512 || Object.values(item.properties).some(value => value.length > 512)) { omit('property-byte-limit'); return; }
    if (reserve(item)) { nodes.push(item); return item; } return;
  }
  function link(kind: FlowEdge['kind'], from: FlowNode, to: FlowNode, status: FlowEdge['status'], reason: string,
    gaps: string[] = [], extra: string[] = [], environment: string | null = null, headerCheck?: HeaderCheck) {
    const edgeId = id('edge', kind, from.id, to.id, environment);
    if (edges.some(edge => edge.id === edgeId)) return;
    if (edges.length >= flowLimits.edges) { omit('edge-limit'); return; }
    const item: FlowEdge = { id: edgeId, kind, from: from.id, to: to.id, status, reason, environment, gaps,
      evidenceIds: unique([...from.evidenceIds, ...to.evidenceIds, ...extra]), ...(headerCheck ? { headerCheck } : {}) };
    if (reserve(item)) edges.push(item);
  }
  function compare() {
    if (comparisons >= flowLimits.comparisons) { omit('comparison-limit'); return false; }
    comparisons++; return true;
  }
  const predicate = "(lower(f.path) LIKE '%.ts' OR lower(f.path) LIKE '%.js' OR lower(f.path) LIKE '%.vue' OR lower(f.path) LIKE '%.java')";
  const candidateDocuments = catalog.store.one<{ count: number }>(`SELECT count(*) AS count FROM files f JOIN sources s ON s.id=f.sourceId
    WHERE f.buildId=? AND f.status='indexed' AND s.status='active' AND ${predicate}`, build.id)!.count;
  const files = catalog.store.all<MapDocument>(`SELECT id,sourceId,path,size,storedBytes FROM (
    SELECT f.id,f.sourceId,f.path,f.size,length(f.raw) AS storedBytes,
      row_number() OVER (PARTITION BY f.sourceId ORDER BY length(f.path),f.path) AS position
    FROM files f JOIN sources s ON s.id=f.sourceId WHERE f.buildId=? AND f.status='indexed' AND s.status='active' AND ${predicate})
    ORDER BY position,sourceId,path LIMIT ?`, build.id, flowLimits.documents);
  if (candidateDocuments > files.length) omit('document-limit', candidateDocuments - files.length);
  for (const file of files) {
    if (!Number.isSafeInteger(file.size) || !Number.isSafeInteger(file.storedBytes) || file.size < 0 || file.storedBytes < 0) throw new CatalogError('CORRUPT_EVIDENCE', 'Code source bytes are unavailable.', 409);
    if (file.size > flowLimits.fileBytes || file.storedBytes > flowLimits.fileBytes) { omit('file-byte-limit'); continue; }
    if (parsedBytes + file.size > flowLimits.textBytes) { omit('input-byte-limit'); continue; }
    const issued = catalog.store.all<{ id: string }>('SELECT id FROM spans WHERE fileId=? ORDER BY startLine LIMIT ?', file.id, flowLimits.fileSpans + 1);
    if (issued.length > flowLimits.fileSpans) { omit('file-span-limit'); continue; }
    const { content, refs } = readMapDocument(catalog, build.id, file, issued);
    parsedBytes += file.size; examinedDocuments++;
    for (const ref of refs) available.set(ref.id, ref);
    const facts = file.path.endsWith('.java') ? javaFacts(content) : typescriptFacts(content, file.path);
    for (const gap of facts.gaps) omit(`adapter:${gap}`);
    const document: Parsed = { file, facts, refs, content }, source = build.sources.find(source => source.sourceId === file.sourceId)!;
    function codeNode(key: string, kind: FlowNode['kind'], label: string, start: number, end: number, properties: Record<string, string>) {
      const startLine = content.slice(0, start).split('\n').length, endLine = content.slice(0, Math.max(start, end - 1)).split('\n').length;
      return addNode({ id: id('node', file.sourceId, file.path, key), kind, label, sourceId: file.sourceId, sourceName: source.name,
        path: file.path, revision: source.revision!, startLine, endLine, properties,
        // Types, receiver declarations and imports can precede the operation's own lines.
        evidenceIds: refs.map(ref => ref.id) });
    }
    for (const fact of facts.symbols) {
      const node = codeNode(fact.key, 'symbol', fact.qualifiedName, fact.start, fact.end, { role: fact.role,
        ...fact.parameterTypes ? { parameterTypes: fact.parameterTypes.join(', ') } : {} });
      if (node) symbols.push({ node, fact, document });
    }
    for (const fact of facts.operations) {
      const owner = symbols.find(symbol => symbol.document === document && symbol.fact.key === fact.owner); if (!owner) continue;
      const properties = Object.fromEntries(Object.entries(fact.properties).filter(([key]) => key !== 'recordSignature'));
      const label = fact.kind === 'http-request' ? `${properties.method} ${properties.path}` : fact.kind === 'event-publish'
        ? `Publish ${properties.payloadType}` : fact.kind === 'event-subscribe' ? 'Subscribe via KafkaSubscriber' : 'MongoCollection.replaceOne';
      const node = codeNode(`operation:${fact.start}`, fact.kind, label, fact.start, fact.end, properties); if (!node) continue;
      operations.push({ node, fact, owner });
      link('performs', owner.node, node, 'static', 'This method/function contains the supported call in the indexed syntax; execution and ordering are unverified.');
    }
  }
  for (const owner of symbols) for (const call of owner.document.facts.calls.filter(call => call.owner === owner.fact.key)) {
    if (!call.module.startsWith('./') && !call.module.startsWith('../')) { omit('unsupported-import-target'); continue; }
    const stem = path.posix.normalize(path.posix.join(path.posix.dirname(owner.node.path), call.module));
    if (stem.startsWith('../')) { omit('unresolved-import'); continue; }
    const paths = /\.(ts|js)$/.test(stem) ? [stem] : [stem + '.ts', stem + '.js', stem + '/index.ts', stem + '/index.js'];
    const targets = symbols.filter(target => target.node.sourceId === owner.node.sourceId && paths.includes(target.node.path)
      && target.fact.exported && target.fact.role !== 'amd-function' && target.fact.name === call.imported);
    if (targets.length === 1) link('calls', owner.node, targets[0]!.node, 'static', 'A supported relative named import is called by this function/action.');
    else omit(targets.length ? 'ambiguous-import' : 'unresolved-import');
  }
  const declaredNodes = new Map<string, FlowNode>();
  function declared(node: MapNode): FlowNode | undefined {
    const refs = node.evidenceIds.map(id => available.get(id)!);
    const item = addNode({ id: node.id, kind: node.kind === 'http-route' ? 'route' : 'handler-reference', label: node.label,
      sourceId: node.sourceId, sourceName: node.sourceName, revision: node.revision!, path: refs[0]!.path,
      startLine: Math.min(...refs.map(ref => ref.startLine)), endLine: Math.max(...refs.map(ref => ref.endLine)),
      properties: node.properties, evidenceIds: node.evidenceIds });
    if (item) declaredNodes.set(item.id, item); return item;
  }
  for (const node of declaration.nodes.filter(node => node.kind === 'http-route' || node.kind === 'handler-reference')) declared(node);
  for (const edge of declaration.edges.filter(edge => edge.kind === 'routes-to')) {
    const from = declaredNodes.get(edge.from), to = declaredNodes.get(edge.to);
    if (from && to) link('routes-to', from, to, 'static', 'The JSON route names this handler reference. No HTTP server execution is established.');
  }
  for (const handler of nodes.filter(node => node.kind === 'handler-reference')) {
    const eligible = symbols.filter(symbol => symbol.node.sourceId === handler.sourceId && symbol.fact.role === 'java-method');
    const exact = eligible.filter(symbol => symbol.fact.qualifiedName === handler.label);
    const targets = exact.length ? exact : eligible.filter(symbol => symbol.fact.qualifiedName.split('.').slice(-2).join('.') === handler.label);
    if (targets.length === 1) link('implements', handler, targets[0]!.node, 'static', 'This same-source unique class/method matches the supported handler reference.');
    else omit(targets.length ? 'ambiguous-handler' : 'unresolved-handler');
  }
  for (const request of operations.filter(operation => operation.fact.kind === 'http-request')) {
    for (const route of nodes.filter(node => node.kind === 'route')) {
      if (!compare()) break;
      if (route.properties.method === request.fact.properties.method && route.properties.path === request.fact.properties.path) {
        const headers = compareHeaders(request.node.properties, route.properties);
        link('http-target', request.node, route, 'candidate',
          `HTTP method/path match a route declaration; authority/proxy and deployment binding are unresolved. ${headers.detail}`,
          ['The client base URL or proxy is not bound to this route by supported source.',
            'Literal header names do not prove runtime values, middleware/proxy rewrites, parameter conversion or identity enforcement.',
            ...headers.status === 'match' ? [] : [headers.detail]], [], null, headers);
      }
    }
  }
  const subscribers = operations.filter(operation => operation.fact.kind === 'event-subscribe');
  for (const publisher of operations.filter(operation => operation.fact.kind === 'event-publish')) for (const subscriber of subscribers) {
    if (!compare()) break;
    if (publisher.node.sourceId === subscriber.node.sourceId) continue;
    const consumers = symbols.filter(symbol => symbol.node.sourceId === subscriber.node.sourceId
      && symbol.fact.className === subscriber.fact.properties.handlerClass && symbol.fact.name === 'onMessage'
      && symbol.fact.parameterTypes?.length === 1 && symbol.fact.parameterTypes[0] === publisher.fact.properties.payloadType
      && symbol.document.facts.records[symbol.fact.parameterTypes[0]!] === publisher.fact.properties.recordSignature
      && operations.some(operation => operation.owner === symbol && operation.fact.kind === 'document-write'
        && operation.fact.properties.recordSignature === publisher.fact.properties.recordSignature));
    if (consumers.length !== 1) { omit(consumers.length ? 'ambiguous-consumer-method' : 'unresolved-consumer-method'); continue; }
    const pair = (a: string, b: string) => a === publisher.node.sourceId && b === subscriber.node.sourceId || b === publisher.node.sourceId && a === subscriber.node.sourceId;
    const matches = declaration.edges.filter(edge => edge.kind === 'contract-match').filter(edge => {
      const a = declaration.nodes.find(node => node.id === edge.from)!, b = declaration.nodes.find(node => node.id === edge.to)!;
      return pair(a.sourceId, b.sourceId) && a.properties.name === publisher.fact.properties.payloadType
        && JSON.stringify(Object.keys(JSON.parse(a.properties.fields!) as object).sort())
          === JSON.stringify(Object.keys(JSON.parse(publisher.fact.properties.recordSignature!) as object).sort());
    });
    const topics = declaration.edges.filter(edge => edge.kind === 'setting-match').filter(edge => {
      const a = declaration.nodes.find(node => node.id === edge.from)!, b = declaration.nodes.find(node => node.id === edge.to)!;
      return pair(a.sourceId, b.sourceId) && a.label === 'orderTopic' && a.properties.valueType === 'string';
    });
    if (matches.length !== 1 || topics.length !== 1) { omit('unresolved-contract-or-topic-scope'); continue; }
    const match = matches[0]!, topic = topics[0]!;
    if (match.environment !== null && match.environment !== topic.environment) { omit('incompatible-declared-environment'); continue; }
    const topicValue = declaration.nodes.find(node => node.id === topic.from)!.properties.value;
    const literalTopics = [publisher, subscriber].map(operation => operation.fact.properties.topicExpression!)
      .filter(expression => expression.startsWith('"'));
    if (literalTopics.some(expression => { try { return JSON.parse(expression) !== topicValue; } catch { return true; } })) {
      omit('contradictory-literal-topic'); continue;
    }
    const consumer = consumers[0]!;
    link('event-delivery', publisher.node, subscriber.node, 'candidate',
      'Equal supported Java record shapes, matching JSON contract declarations and one scoped orderTopic setting are candidate delivery clues.',
      ['Runtime topic parameters are not bound to the JSON orderTopic settings by supported code.',
        'A shared broker, serialization and co-deployment are unverified; JSON contracts are not linked to the record by code.'],
      unique([...match.evidenceIds, ...topic.evidenceIds, ...consumer.node.evidenceIds]), topic.environment);
    link('dispatch-candidate', subscriber.node, consumer.node, 'candidate',
      'The subscriber receives this class, whose onMessage method accepts the matching record and contains a document write. Dispatch is unresolved.',
      ['KafkaSubscriber has no implementation proving that subscription dispatches to onMessage.']);
  }
  const priorities = { 'vue-action': 0, 'amd-function': 1, function: 2, 'java-method': 3 };
  const roots = symbols.filter(symbol => symbol.fact.role === 'vue-action' || symbol.fact.role === 'amd-function'
    || symbol.fact.role === 'function' && operations.some(operation => operation.owner === symbol && operation.fact.kind === 'http-request')
      && !edges.some(edge => edge.kind === 'calls' && edge.to === symbol.node.id))
    .sort((a, b) => priorities[a.fact.role] - priorities[b.fact.role] || (a.node.path < b.node.path ? -1 : a.node.path > b.node.path ? 1 : 0));
  let traversed = 0;
  for (const root of roots) {
    if (flows.length >= flowLimits.flows) { omit('flow-limit'); continue; }
    type Walk = { nodeIds: string[]; edgeIds: string[] };
    const pending: Walk[] = [{ nodeIds: [root.node.id], edgeIds: [] }], terminal: Walk[] = [];
    while (pending.length && traversed < flowLimits.traversals) {
      traversed++; const current = pending.pop()!, last = current.nodeIds.at(-1)!;
      const outgoing = edges.filter(edge => edge.from === last && !current.nodeIds.includes(edge.to));
      if (!outgoing.length || current.nodeIds.length >= flowLimits.flowSteps) {
        terminal.push(current); if (outgoing.length) omit('flow-step-limit'); continue;
      }
      for (const edge of outgoing.slice().reverse()) pending.push({ nodeIds: [...current.nodeIds, edge.to], edgeIds: [...current.edgeIds, edge.id] });
    }
    if (pending.length) omit('flow-traversal-limit');
    const score = (walk: Walk) => nodes.find(node => node.id === walk.nodeIds.at(-1))?.kind === 'document-write' ? 1000 + walk.nodeIds.length : walk.nodeIds.length;
    terminal.sort((a, b) => score(b) - score(a)); const selected = terminal[0]; if (!selected || !selected.edgeIds.length) continue;
    const pathEdges = selected.edgeIds.map(id => edges.find(edge => edge.id === id)!);
    const pathNodes = selected.nodeIds.map(id => nodes.find(node => node.id === id)!);
    const gaps = unique([...pathEdges.flatMap(edge => edge.gaps), 'This is a static outline, not an observed execution or coherent deployment.',
      ...pathNodes.at(-1)!.kind === 'document-write' ? ['The MongoCollection receiver is not bound to a concrete database or collection by supported code.'] : ['The supported path ends before an evidenced document write.'],
      ...terminal.length > 1 ? ['Several static branches exist; one bounded outline is shown for this entry point.'] : []]);
    const item: StaticFlow = { id: id('flow', root.node.id, selected.edgeIds), title: `${root.fact.role === 'vue-action' ? 'Vue action' : root.fact.role === 'amd-function' ? 'Dojo action' : 'HTTP client'} · ${path.posix.basename(root.node.path)}`,
      status: 'partial', environment: null, ...selected, gaps,
      evidenceIds: unique([...pathNodes.flatMap(node => node.evidenceIds), ...pathEdges.flatMap(edge => edge.evidenceIds)]) };
    if (reserve(item)) flows.push(item);
  }
  const gaps = ['Only the versioned pilot syntax profiles are analyzed; framework-wide call graphs and dynamic behavior remain unsupported.',
    'Static calls describe source syntax, not execution order. Candidate hops require review of their original sources.',
    'Repository identity does not establish service ownership. Deployment coherence and the active environment are unknown.'];
  if (Object.keys(omissions).length || Object.keys(declaration.omissions).length) gaps.push('Unsupported or bounded work was omitted; inspect code and declaration coverage.');
  if (declaration.stale) gaps.push('This projection uses an older index or source registry; revoked sources are excluded.');
  if (build.status === 'partial') gaps.push('The source index is partial; excluded and failed material is unavailable.');
  const result = { schemaVersion: 'loredock-code-flows-v1' as const, adapterVersion: 'pilot-code-v3' as const, buildId: build.id,
    policyVersion: declaration.policyVersion, sourceSetVersion: declaration.sourceSetVersion, registryVersion: declaration.registryVersion,
    stale: declaration.stale, partial: true as const, deploymentCoherence: 'unknown' as const, nodes, edges, flows,
    evidence: Object.fromEntries(evidence), gaps, omissions, declarationOmissions: declaration.omissions,
    coverage: { candidateDocuments, examinedDocuments, parsedBytes }, limits: flowLimits };
  const output = { ...result, inputHash: sha256(JSON.stringify(result)) };
  if (Buffer.byteLength(JSON.stringify(output)) > flowLimits.outputBytes) throw new CatalogError('FLOW_LIMIT', 'The code-flow response exceeds its byte limit.', 409);
  return output;
}
