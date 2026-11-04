import assert from 'node:assert/strict';
import { analysisLimits, bounds, bytes, choice, counts, dict, eq, evidence, fields, hash, hex,
  ids, limits, list, locator, number, optionalNull, parse, pathLimits, resolution, sorted, strings, text, unique, uuid, versions } from './schema.mjs';

const endpoint = value => fields(value, { expression: text(512), evidenceIds: ids });
const node = value => fields(value, { id: hex, kind: choice('symbol', 'http-request', 'event-publish', 'event-subscribe', 'document-write', 'route', 'handler-reference', 'contract'),
  label: text(512), sourceId: uuid, ...locator, properties: dict(text(512)), evidenceIds: ids });
const root = value => value?.status === 'unavailable' ? fields(value, { status: choice('unavailable'), id: hex, reason: text() })
  : fields(value, { status: choice('available'), id: hex, role: text(512, 1), sourceId: uuid, ...locator, label: text(512), evidenceIds: ids });
const edge = value => fields(value, { id: hex, kind: choice('calls', 'performs', 'http-target', 'routes-to', 'implements', 'event-delivery', 'dispatch-candidate'),
  from: hex, to: hex, status: choice('static', 'candidate'), reason: text(), environment: optionalNull(text(512)), gaps: strings, evidenceIds: ids },
{ headerCheck: item => fields(item, { status: choice('match', 'gap', 'unknown'), detail: text() }),
  topicCheck: item => fields(item, { rule: choice('direct-java-topic-literal/1'), value: text(256, 1), publisher: endpoint, subscriber: endpoint }) });
const flow = value => fields(value, { id: hex, title: text(), status: choice('partial'), environment: choice(null),
  nodeIds: list(hex, 20, 1), edgeIds: list(hex, 19), evidenceIds: ids, gaps: strings });
const graph = value => fields(value, { schemaVersion: choice('loredock-connected-display/2'), adapterVersion: choice('connected-paths-v2'), ...versions,
  stale: choice(false, true), partial: choice(true), deploymentCoherence: choice('unknown'), nodes: list(node, 160), edges: list(edge, 240),
  flows: list(flow, 2), evidence: dict(evidence, 30), gaps: strings, omissions: counts, declarationOmissions: counts, limits: bounds(pathLimits), inputHash: hex,
  coverage: item => fields(item, { ...resolution, resolutionNodes: number(), resolutionEdges: number(), candidateRoots: number(),
    selectedRoots: list(hex, 2), traversals: number(), unselectedNodes: number(), unselectedEdges: number() }) });
function shape(value, kind) {
  fields(value, { schemaVersion: choice('loredock-code-paths/2'), status: choice('available'), kind: choice(kind), generationId: hex, projectionId: hex,
    identity: item => fields(item, { ...versions, inventoryId: uuid, fingerprint: hex, analysisLimits: bounds(analysisLimits), manifestHash: hex, metadataDigest: hex,
      declarationAdapter: choice('json-declarations-v2'), declarationInputHash: hex, adapter: choice('connected-paths-v2'), limits: bounds(pathLimits),
      topicRule: rule => fields(rule, { version: choice('direct-java-topic-literal/1'), maxUtf8Bytes: choice(256) }),
      accounting: accounting => fields(accounting, { version: choice('shared-capture-work/1'), work: choice(1000000), wallMs: choice(5000) }) }),
    coverage: item => fields(item, { scannedFiles: number(), retainedFiles: number(), scanComplete: choice(true), factEntries: number(), consumedHash: hex,
      inventoryCounts: counts, metadataEntries: number(), metadataBytes: number(), incompleteBindings: number(), bindingReasons: counts,
      resolution: r => fields(r, { ...resolution, nodes: number(), edges: number(), roots: number() }), omissions: counts, declarationOmissions: counts,
      sources: list(source => fields(source, { sourceId: uuid, knownPaths: number(), status: choice('pending', 'ready', 'failed'), omittedPaths: number(),
        treeVerified: choice(true, false), opaquePaths: number(), unsafePaths: choice(true, false), filesWithGaps: number(), javaFiles: number(), javaComplete: choice(true, false) }), 20) }),
    graph: kind === 'paths' ? graph : choice(null), partial: choice(true), deploymentCoherence: choice('unknown'),
    selection: item => fields(item, { rootId: optionalNull(hex), offset: choice(kind === 'paths' ? 0 : 4) }),
    roots: item => fields(item, { offset: choice(kind === 'paths' ? 0 : 4), limit: choice(4), total: number(), previous: optionalNull(number()),
      next: optionalNull(number()), outsidePage: number(), unavailableEntries: number(4), items: list(root, 4), evidence: dict(evidence, 30) }) });
}
const headerName = value => { text(128, 1)(value); assert.match(value, /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/); };
export function directTopic(expression) {
  text(512, 3)(expression); const match = /^"[^"\\\r\n]+"$/u.exec(expression);
  assert.ok(match && match[0] === expression, 'Topic witness must be one complete direct literal.');
  const literal = expression.slice(1, -1); assert.ok(bytes(literal) <= 256); return literal;
}
function checkHeaders(edge, request, route) {
  assert.ok(edge.headerCheck, 'HTTP candidate requires a header comparison.');
  let names, bindings;
  if (request.requestHeaderStatus === 'literal') { names = JSON.parse(request.requestHeaderNames); list(headerName, 16)(names); unique(names.map(n => n.toLowerCase())); }
  if (route.headerBindingStatus === 'literal') { bindings = JSON.parse(route.headerBindings);
    list(binding => fields(binding, { parameter: text(128, 1), name: headerName }), 16, 1)(bindings); }
  let expected;
  if (!bindings) expected = { status: 'unknown', detail: 'No complete supported header binding is declared for this handler in the route document.' };
  else if (!names) expected = { status: 'unknown', detail: 'Client header names are dynamic, unsupported or beyond the analysis bound; their mapping remains unresolved.' };
  else {
    const missing = bindings.filter(binding => !names.some(name => name.toLowerCase() === binding.name.toLowerCase()));
    expected = missing.length ? { status: 'gap', detail: `Route bindings ${missing.map(b => `${b.parameter} ← ${b.name}`).join(', ')} have no matching literal client header among ${names.join(', ') || '(none declared)'}.` }
      : { status: 'match', detail: `Literal header names match the declared bindings (${bindings.map(b => `${b.parameter} ← ${b.name}`).join(', ')}), ignoring ASCII case.` };
  }
  eq(edge.headerCheck, expected);
}
export function decodeProjection(serialized, kind = 'paths') {
  assert.ok(['paths', 'roots'].includes(kind)); text(limits.projectionBytes)(serialized);
  const p = parse(Buffer.from(serialized), limits.projectionBytes, true); shape(p, kind);
  const { projectionId, ...body } = p, { identity: identity, coverage: coverage, roots: page, graph: g } = p;
  eq(hash(JSON.stringify(body)), projectionId); eq(hash(JSON.stringify(identity)), p.generationId);
  assert.ok(identity.registryVersion >= identity.sourceSetVersion && bytes(serialized) <= identity.limits.outputBytes);
  unique(coverage.sources.map(source => source.sourceId)); eq(coverage.scannedFiles, coverage.retainedFiles);
  for (const [actual, maximum] of [[coverage.scannedFiles, identity.limits.files], [coverage.factEntries, identity.limits.facts],
    [coverage.metadataEntries, identity.limits.metadataEntries], [coverage.metadataBytes, identity.limits.metadataBytes],
    [coverage.resolution.nodes, identity.limits.resolutionNodes], [coverage.resolution.edges, identity.limits.resolutionEdges],
    [coverage.resolution.comparisons, identity.limits.comparisons], [coverage.resolution.alternativeReferences, identity.limits.alternativeReferences]]) assert.ok(actual <= maximum);
  eq(page.total, coverage.resolution.roots); eq(page.items.length, Math.min(4, Math.max(0, page.total - page.offset)));
  eq(page.previous, page.offset ? Math.max(0, page.offset - 4) : null); eq(page.next, page.offset + 4 < page.total ? page.offset + 4 : null);
  eq(page.outsidePage, page.total - page.items.length); eq(page.unavailableEntries, page.items.filter(item => item.status === 'unavailable').length);
  unique(page.items.map(item => item.id));
  const refs = new Map();
  for (const dictionary of [page.evidence, g?.evidence ?? {}]) for (const [id, ref] of Object.entries(dictionary)) {
    eq(id, ref.id); assert.ok(ref.startLine <= ref.endLine); if (refs.has(id)) eq(refs.get(id), ref); refs.set(id, ref);
  }
  assert.ok(refs.size <= limits.spans);
  const support = (values, dictionary, used) => { unique(values); for (const id of values) { assert.ok(Object.hasOwn(dictionary, id)); used.add(id); } };
  const usedPage = new Set();
  for (const entry of page.items) if (entry.status === 'available') { assert.ok(entry.startLine <= entry.endLine); support(entry.evidenceIds, page.evidence, usedPage); }
  eq(usedPage.size, Object.keys(page.evidence).length);
  if (!g) { eq(p.selection.rootId, null); return { projection: p, evidence: refs }; }
  const { inputHash, ...graphBody } = g; eq(hash(JSON.stringify(graphBody)), inputHash);
  for (const key of Object.keys(versions)) eq(g[key], identity[key]); eq(g.limits, identity.limits);
  eq(g.stale, identity.registryVersion !== identity.sourceSetVersion);
  for (const key of Object.keys(resolution)) eq(g.coverage[key], coverage.resolution[key]);
  eq(g.coverage.resolutionNodes, coverage.resolution.nodes); eq(g.coverage.resolutionEdges, coverage.resolution.edges);
  eq(g.coverage.candidateRoots, page.total); eq(g.coverage.unselectedNodes, coverage.resolution.nodes - g.nodes.length);
  eq(g.coverage.unselectedEdges, coverage.resolution.edges - g.edges.length);
  for (const [actual, maximum] of [[g.coverage.traversals, identity.limits.traversals], [g.nodes.length, identity.limits.nodes],
    [g.edges.length, identity.limits.edges], [g.flows.length, identity.limits.flows]]) assert.ok(actual <= maximum);
  unique(g.coverage.selectedRoots); eq(g.coverage.selectedRoots, p.selection.rootId === null ? page.items.slice(0, identity.limits.flows).map(item => item.id) : [p.selection.rootId]);
  const nodes = new Map(g.nodes.map(item => [item.id, item])), edges = new Map(g.edges.map(item => [item.id, item])), usedGraph = new Set();
  eq(nodes.size, g.nodes.length); eq(edges.size, g.edges.length); unique(g.flows.map(item => item.id));
  for (const item of g.nodes) { assert.ok(item.startLine <= item.endLine); support(item.evidenceIds, g.evidence, usedGraph); }
  const kinds = { calls: ['symbol', 'symbol'], performs: ['symbol', 'operation'], 'http-target': ['http-request', 'route'],
    'routes-to': ['route', 'handler-reference'], implements: ['handler-reference', 'symbol'], 'event-delivery': ['event-publish', 'event-subscribe'], 'dispatch-candidate': ['event-subscribe', 'symbol'] };
  for (const item of g.edges) {
    const from = nodes.get(item.from), to = nodes.get(item.to); assert.ok(from && to && from.id !== to.id);
    eq(item.id, hash(JSON.stringify([p.generationId, 'connected-paths-v2', 'edge', item.kind, item.from, item.to, item.environment])));
    eq(from.kind, kinds[item.kind][0]); assert.ok(kinds[item.kind][1] === 'operation' ? ['http-request', 'event-publish', 'event-subscribe', 'document-write'].includes(to.kind) : to.kind === kinds[item.kind][1]);
    eq(item.status, ['http-target', 'event-delivery', 'dispatch-candidate'].includes(item.kind) ? 'candidate' : 'static');
    sorted(item.evidenceIds); for (const id of [...from.evidenceIds, ...to.evidenceIds]) assert.ok(item.evidenceIds.includes(id)); support(item.evidenceIds, g.evidence, usedGraph);
    if (item.kind === 'http-target') checkHeaders(item, from.properties, to.properties); else assert.ok(!Object.hasOwn(item, 'headerCheck'));
    if (item.kind === 'event-delivery') {
      assert.ok(item.topicCheck);
      for (const [endpoint, source] of [[item.topicCheck.publisher, from], [item.topicCheck.subscriber, to]]) {
        const literal = directTopic(endpoint.expression);
        eq(literal, item.topicCheck.value); eq(endpoint.expression, source.properties.topicExpression); eq(endpoint.evidenceIds, [...source.evidenceIds].sort());
      }
    } else { eq(item.environment, null); assert.ok(!Object.hasOwn(item, 'topicCheck')); }
  }
  const usedNodes = new Set(), usedEdges = new Set(), usedRoots = new Set();
  for (const item of g.flows) {
    unique(item.nodeIds); unique(item.edgeIds); assert.ok(item.nodeIds.length <= identity.limits.steps); eq(item.edgeIds.length, item.nodeIds.length - 1);
    assert.ok(g.coverage.selectedRoots.includes(item.nodeIds[0]) && !usedRoots.has(item.nodeIds[0])); usedRoots.add(item.nodeIds[0]);
    eq(item.id, hash(JSON.stringify([identity.buildId, 'connected-paths-v2', item.nodeIds[0], item.edgeIds])));
    const allSupport = new Set();
    for (const id of item.nodeIds) { assert.ok(nodes.has(id)); usedNodes.add(id); nodes.get(id).evidenceIds.forEach(ref => allSupport.add(ref)); }
    item.edgeIds.forEach((id, index) => { const edge = edges.get(id); assert.ok(edge); eq([edge.from, edge.to], item.nodeIds.slice(index, index + 2));
      usedEdges.add(id); edge.evidenceIds.forEach(ref => allSupport.add(ref)); });
    eq(item.evidenceIds, [...allSupport].sort()); support(item.evidenceIds, g.evidence, usedGraph);
  }
  eq(usedNodes.size, nodes.size); eq(usedEdges.size, edges.size); eq(usedGraph.size, Object.keys(g.evidence).length);
  for (const entry of page.items) if (entry.status === 'available' && nodes.has(entry.id)) {
    const item = nodes.get(entry.id); eq(item.kind, 'symbol'); eq(item.properties.role, entry.role);
    for (const key of ['sourceId', ...Object.keys(locator), 'label', 'evidenceIds']) eq(item[key], entry[key]);
  }
  return { projection: p, evidence: refs };
}
