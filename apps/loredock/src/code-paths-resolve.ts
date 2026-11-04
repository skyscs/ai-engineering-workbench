// Resolve complete qualified binding domains before applying display caps.
import path from 'node:path';
import type { Catalog } from './catalog.js';
import type { CallFact } from './code-facts.js';
import type { CanonicalFactPair } from './canonical-fact-pair.js';
import type { FlowNode, FlowEdge } from './code-flow-types.js';
import type { MapNode, MapEdge, MapEvidence, DeclarationMap } from './system-map-types.js';
import type { CodePathLimits } from './code-paths-types.js';
import type { PathWork } from './code-paths-work.js';
import type { SavedPath, PathFactEntry, PathResolution, PathBinding, BindingDomain, BindingDomains } from './code-paths-internal.js';
import { CatalogError } from './types.js';
import { sha256 } from './extract.js';
import { compareHeaders, type HeaderCheck } from './http-headers.js';
interface Parsed { file: SavedPath; facts: CanonicalFactPair['facts']; refs: MapEvidence[] }
interface SymbolEntry { node: FlowNode; fact: CanonicalFactPair['facts']['symbols'][number]; document: Parsed; calls: CallFact[] }
interface OperationEntry { node: FlowNode; fact: CanonicalFactPair['facts']['operations'][number]; owner: SymbolEntry }
interface ResolutionInput { entries: PathFactEntry[]; candidateDocuments: number; domains: BindingDomains;
  generationId: string; declaration: DeclarationMap; limits: CodePathLimits; work: PathWork }

const unique = (values: string[]) => [...new Set(values)].sort();
/** Code syntax and candidate wiring are navigation aids, never observed execution. */
export async function resolvePathFacts(catalog: Catalog, buildId: string, supplied: ResolutionInput): Promise<PathResolution> {
    const declaration = supplied.declaration, build = catalog.readBuild(buildId);
    const nodes: FlowNode[] = [], edges: FlowEdge[] = [], resolutions: PathBinding[] = [];
    const nodeIndex = new Map<string, FlowNode>(), edgeIds = new Set<string>(), sourceIndex = new Map(build.sources.map(source => [source.sourceId, source]));
    const exports = new Map<string, SymbolEntry[]>(), javaExact = new Map<string, SymbolEntry[]>(), javaShort = new Map<string, SymbolEntry[]>(),
      consumerIndex = new Map<string, SymbolEntry[]>(), byOwner = new Map<string, OperationEntry[]>(), incoming = new Set<string>();
    const key = (...parts: unknown[]) => JSON.stringify(parts);
    const append = <T>(index: Map<string, T[]>, name: string, value: T) => { supplied.work.charge(1); const values = index.get(name) ?? []; values.push(value); index.set(name, values); };
    const get = <T>(index: Map<string, T[]>, name: string): T[] => { const values = index.get(name) ?? []; supplied.work.charge(1); return values; };
    await supplied.work.step('resolve', 0, true);
    let alternativeReferences = 0;
    const available = new Map(Object.values(declaration.evidence).map(ref => [ref.id, ref]));
    const omissions: Record<string, number> = {};
    const symbols: SymbolEntry[] = [], operations: OperationEntry[] = [];
    let parsedBytes = 0, examinedDocuments = 0, comparisons = 0;
    const omit = (reason: string, count = 1) => { omissions[reason] = (omissions[reason] ?? 0) + count; };
    const id = (...parts: unknown[]) => sha256(JSON.stringify([supplied.generationId, 'connected-paths-v1', ...parts]));
    function addNode(item: FlowNode): FlowNode {
        const existing = nodeIndex.get(item.id); if (existing) return existing;
        if (nodes.length >= supplied.limits.resolutionNodes) throw new CatalogError('RESOLUTION_LIMIT', 'Resolution node budget exceeded.', 409);
        nodes.push(item); nodeIndex.set(item.id, item); supplied.work.charge(1); return item;
    }
    async function resolution(kind: PathBinding['kind'], owner: string, targets: SymbolEntry[], domain: BindingDomain) {
        alternativeReferences += targets.length;
        if (resolutions.length >= supplied.limits.bindingRecords || alternativeReferences > supplied.limits.alternativeReferences)
            throw new CatalogError('RESOLUTION_LIMIT', 'Resolution reference budget exceeded.', 409);
        const targetIds = [];
        for (const target of targets) { await supplied.work.step('resolve'); targetIds.push(target.node.id); }
        resolutions.push({ kind, owner, targets: targetIds, incomplete: !domain.complete, domain,
            outcome: targets.length === 1 ? 'unique' : targets.length ? 'ambiguous' : 'unresolved' });
    }
    function link(kind: FlowEdge['kind'], from: FlowNode, to: FlowNode, status: FlowEdge['status'], reason: string,
      gaps: string[] = [], extra: string[] = [], environment: string | null = null, headerCheck?: HeaderCheck) {
        const edgeId = id('edge', kind, from.id, to.id, environment);
        if (edgeIds.has(edgeId))
            return;
        if (edges.length >= supplied.limits.resolutionEdges) throw new CatalogError('RESOLUTION_LIMIT', 'Resolution edge budget exceeded.', 409);
        const item: FlowEdge = { id: edgeId, kind, from: from.id, to: to.id, status, reason, environment, gaps,
            evidenceIds: unique([...from.evidenceIds, ...to.evidenceIds, ...extra]), ...(headerCheck ? { headerCheck } : {}) };
        edges.push(item); edgeIds.add(edgeId); supplied.work.charge(1); if (kind === 'calls') incoming.add(to.id);
    }
    function compare() {
        if (comparisons >= supplied.limits.comparisons) {
            omit('comparison-limit');
            return false;
        }
        comparisons++; supplied.work.charge(1);
        return true;
    }
    const candidateDocuments = supplied.candidateDocuments;
    for (const { file, payload } of supplied.entries) {
        await supplied.work.step('resolve');
        const { facts, evidence: refs } = payload;
        parsedBytes += file.size;
        examinedDocuments++;
        for (const ref of refs) available.set(ref.id, ref);
        for (const gap of facts.gaps)
            omit(`adapter:${gap}`);
        const document = { file, facts, refs }, source = sourceIndex.get(file.sourceId)!;
        const localSymbols = new Map<string, SymbolEntry>(), symbolRanges = new Map(payload.ranges.symbols.map(range => [range.key, range]));
        const operationRanges = new Map(facts.operations.map((fact, index) => [fact.start, payload.ranges.operations[index]]));
        const callsByOwner = new Map<string, CallFact[]>();
        for (const call of facts.calls) { await supplied.work.step('resolve'); append(callsByOwner, call.owner, call); }
        function codeNode(key: string, kind: FlowNode['kind'], label: string, start: number, end: number, properties: Record<string, string>) {
            const range = key.startsWith('operation:')
                ? operationRanges.get(start)
                : symbolRanges.get(key);
            if (!range) throw new CatalogError('CORRUPT_CODE_FACTS', 'Saved graph range is unavailable.', 409);
            const { startLine, endLine } = range;
            return addNode({ id: id('node', file.sourceId, file.path, key), kind, label, sourceId: file.sourceId, sourceName: source.name,
                path: file.path, revision: source.revision!, startLine, endLine, properties,
                // Types, receiver declarations and imports can precede the operation's own lines.
                evidenceIds: refs.map(ref => ref.id) });
        }
        for (const fact of facts.symbols) {
            const node = codeNode(fact.key, 'symbol', fact.qualifiedName, fact.start, fact.end, { role: fact.role,
                ...fact.parameterTypes ? { parameterTypes: fact.parameterTypes.join(', ') } : {} });
            if (node) {
                await supplied.work.step('resolve');
                const symbol = { node, fact, document, calls: callsByOwner.get(fact.key) ?? [] };
                symbols.push(symbol); localSymbols.set(fact.key, symbol);
                if (fact.exported && fact.role !== 'amd-function') append(exports, key(file.sourceId, file.path, fact.name), symbol);
                if (fact.role === 'java-method') {
                    append(javaExact, key(file.sourceId, fact.qualifiedName), symbol);
                    append(javaShort, key(file.sourceId, fact.qualifiedName.split('.').slice(-2).join('.')), symbol);
                }
                if (fact.name === 'onMessage' && fact.parameterTypes?.length === 1)
                    append(consumerIndex, key(file.sourceId, fact.className, fact.parameterTypes[0], facts.records[fact.parameterTypes[0]!]), symbol);
            }
        }
        for (const fact of facts.operations) {
            const owner = localSymbols.get(fact.owner);
            if (!owner)
                continue;
            const properties = Object.fromEntries(Object.entries(fact.properties).filter(([key]) => key !== 'recordSignature'));
            const label = fact.kind === 'http-request' ? `${properties.method} ${properties.path}` : fact.kind === 'event-publish'
                ? `Publish ${properties.payloadType}` : fact.kind === 'event-subscribe' ? 'Subscribe via KafkaSubscriber' : 'MongoCollection.replaceOne';
            const node = codeNode(`operation:${fact.start}`, fact.kind, label, fact.start, fact.end, properties);
            if (!node)
                continue;
            await supplied.work.step('resolve');
            const operation = { node, fact, owner }; operations.push(operation); append(byOwner, owner.node.id, operation);
            link('performs', owner.node, node, 'static', 'This method/function contains the supported call in the indexed syntax; execution and ordering are unverified.');
        }
    }
    const symbolOrder = new Map(symbols.map((symbol, index) => [symbol.node.id, index]));
    for (const owner of symbols)
        for (const call of owner.calls) {
            await supplied.work.step('resolve');
            if (!call.module.startsWith('./') && !call.module.startsWith('../')) {
                omit('unsupported-import-target');
                continue;
            }
            const stem = path.posix.normalize(path.posix.join(path.posix.dirname(owner.node.path), call.module));
            if (stem === '..' || stem.startsWith('../') || path.posix.isAbsolute(stem)) {
                omit('unresolved-import');
                continue;
            }
            const paths = /\.(ts|js)$/.test(stem) ? [stem] : [stem + '.ts', stem + '.js', stem + '/index.ts', stem + '/index.js'];
            const targets = paths.flatMap(file => get(exports, key(owner.node.sourceId, file, call.imported)))
                .sort((a, b) => symbolOrder.get(a.node.id)! - symbolOrder.get(b.node.id)!);
            const domain = supplied.domains.imports(owner.node.sourceId, paths), incomplete = !domain.complete;
            await resolution('calls', owner.node.id, targets, domain);
            if (incomplete) { omit('incomplete-import-source'); continue; }
            if (targets.length === 1)
                link('calls', owner.node, targets[0]!.node, 'static', 'A supported relative named import is called by this function/action.');
            else
                omit(targets.length ? 'ambiguous-import' : 'unresolved-import');
        }
    const declaredNodes = new Map<string, FlowNode>();
    function declared(node: MapNode) {
        const refs = node.evidenceIds.map(id => available.get(id)!);
        const item = addNode({ id: id('declaration', node.id), kind: node.kind === 'http-route' ? 'route' : 'handler-reference', label: node.label,
            sourceId: node.sourceId, sourceName: node.sourceName, revision: node.revision!, path: refs[0]!.path,
            startLine: Math.min(...refs.map(ref => ref.startLine)), endLine: Math.max(...refs.map(ref => ref.endLine)),
            properties: node.properties, evidenceIds: node.evidenceIds });
        if (item)
            declaredNodes.set(node.id, item);
        return item;
    }
    for (const node of declaration.nodes.filter(node => node.kind === 'http-route' || node.kind === 'handler-reference'))
        declared(node);
    for (const edge of declaration.edges.filter(edge => edge.kind === 'routes-to')) {
        const from = declaredNodes.get(edge.from), to = declaredNodes.get(edge.to);
        if (from && to)
            link('routes-to', from, to, 'static', 'The JSON route names this handler reference. No HTTP server execution is established.');
    }
    for (const handler of nodes.filter(node => node.kind === 'handler-reference')) {
        await supplied.work.step('resolve');
        const exact = get(javaExact, key(handler.sourceId, handler.label));
        const targets = exact.length ? exact : get(javaShort, key(handler.sourceId, handler.label));
        const domain = supplied.domains.java(handler.sourceId), incomplete = !domain.complete;
        await resolution('implements', handler.id, targets, domain);
        if (incomplete) { omit('incomplete-handler-source'); continue; }
        if (targets.length === 1)
            link('implements', handler, targets[0]!.node, 'static', 'This same-source unique class/method matches the supported handler reference.');
        else
            omit(targets.length ? 'ambiguous-handler' : 'unresolved-handler');
    }
    const routes = nodes.filter(node => node.kind === 'route');
    for (const request of operations.filter(operation => operation.fact.kind === 'http-request')) {
        await supplied.work.step('resolve');
        for (const route of routes) {
            await supplied.work.step('resolve');
            if (!compare())
                break;
            if (route.properties.method === request.fact.properties.method && route.properties.path === request.fact.properties.path) {
                const headers = compareHeaders(request.node.properties, route.properties);
                link('http-target', request.node, route, 'candidate', `HTTP method/path match a route declaration; authority/proxy and deployment binding are unresolved. ${headers.detail}`, ['The client base URL or proxy is not bound to this route by supported source.',
                    'Literal header names do not prove runtime values, middleware/proxy rewrites, parameter conversion or identity enforcement.',
                    ...headers.status === 'match' ? [] : [headers.detail]], [], null, headers);
            }
        }
    }
    const declarationNodes = new Map(declaration.nodes.map(node => [node.id, node])), contracts = new Map<string, MapEdge[]>(), topicSettings = new Map<string, MapEdge[]>();
    const pairKey = (a: string, b: string) => JSON.stringify([a, b].sort());
    for (const edge of declaration.edges) {
        await supplied.work.step('resolve');
        const a = declarationNodes.get(edge.from)!, b = declarationNodes.get(edge.to)!;
        if (edge.kind === 'contract-match') append(contracts, key(pairKey(a.sourceId, b.sourceId), a.properties.name,
            JSON.stringify(Object.keys(JSON.parse(a.properties.fields!)).sort())), edge);
        if (edge.kind === 'setting-match' && a.label === 'orderTopic' && a.properties.valueType === 'string')
            append(topicSettings, pairKey(a.sourceId, b.sourceId), edge);
    }
    const subscribers = operations.filter(operation => operation.fact.kind === 'event-subscribe');
    for (const publisher of operations.filter(operation => operation.fact.kind === 'event-publish'))
        for (const subscriber of subscribers) {
            await supplied.work.step('resolve');
            if (!compare())
                break;
            if (publisher.node.sourceId === subscriber.node.sourceId)
                continue;
            const consumers = get(consumerIndex, key(subscriber.node.sourceId, subscriber.fact.properties.handlerClass,
                publisher.fact.properties.payloadType, publisher.fact.properties.recordSignature)).filter(symbol =>
                get(byOwner, symbol.node.id).some(operation => operation.fact.kind === 'document-write'
                    && operation.fact.properties.recordSignature === publisher.fact.properties.recordSignature));
            const domain = supplied.domains.java(subscriber.node.sourceId), incomplete = !domain.complete;
            await resolution('consumer', subscriber.node.id, consumers, domain);
            if (incomplete) { omit('incomplete-consumer-source'); continue; }
            if (consumers.length !== 1) {
                omit(consumers.length ? 'ambiguous-consumer-method' : 'unresolved-consumer-method');
                continue;
            }
            const matches = get(contracts, key(pairKey(publisher.node.sourceId, subscriber.node.sourceId), publisher.fact.properties.payloadType,
                JSON.stringify(Object.keys(JSON.parse(publisher.fact.properties.recordSignature!)).sort())));
            const topics = get(topicSettings, pairKey(publisher.node.sourceId, subscriber.node.sourceId));
            if (matches.length !== 1 || topics.length !== 1) {
                omit('unresolved-contract-or-topic-scope');
                continue;
            }
            const match = matches[0]!, topic = topics[0]!;
            if (match.environment !== null && match.environment !== topic.environment) {
                omit('incompatible-declared-environment');
                continue;
            }
            const topicValue = declarationNodes.get(topic.from)!.properties.value;
            const literalTopics = [publisher, subscriber].map(operation => operation.fact.properties.topicExpression!)
                .filter(expression => expression.startsWith('"'));
            if (literalTopics.some(expression => { try {
                return JSON.parse(expression) !== topicValue;
            }
            catch {
                return true;
            } })) {
                omit('contradictory-literal-topic');
                continue;
            }
            const consumer = consumers[0]!;
            link('event-delivery', publisher.node, subscriber.node, 'candidate', 'Equal supported Java record shapes, matching JSON contract declarations and one scoped orderTopic setting are candidate delivery clues.', ['Runtime topic parameters are not bound to the JSON orderTopic settings by supported code.',
                'A shared broker, serialization and co-deployment are unverified; JSON contracts are not linked to the record by code.'], unique([...match.evidenceIds, ...topic.evidenceIds, ...consumer.node.evidenceIds]), topic.environment);
            link('dispatch-candidate', subscriber.node, consumer.node, 'candidate', 'The subscriber receives this class, whose onMessage method accepts the matching record and contains a document write. Dispatch is unresolved.', ['KafkaSubscriber has no implementation proving that subscription dispatches to onMessage.']);
        }
    const priorities = { 'vue-action': 0, 'amd-function': 1, function: 2, 'java-method': 3 };
    const nodeKey = (node: FlowNode) => [node.sourceName, node.path, node.kind, node.label].join('\0');
    const compareText = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
    const roots: SymbolEntry[] = [];
    for (const symbol of symbols) {
        await supplied.work.step('resolve');
        if (symbol.fact.role === 'vue-action' || symbol.fact.role === 'amd-function'
            || symbol.fact.role === 'function' && get(byOwner, symbol.node.id).some(operation => operation.fact.kind === 'http-request')
                && !incoming.has(symbol.node.id)) roots.push(symbol);
    }
    roots.sort((a, b) => priorities[a.fact.role] - priorities[b.fact.role]
        || compareText(a.node.sourceName, b.node.sourceName) || compareText(a.node.path, b.node.path)
        || compareText(a.fact.key, b.fact.key) || compareText(a.node.sourceId, b.node.sourceId));
    await supplied.work.step('resolve', 0, true);
    return { schemaVersion: 'loredock-connected-resolution/1', adapterVersion: 'connected-paths-v1', buildId: build.id,
        policyVersion: declaration.policyVersion, sourceSetVersion: declaration.sourceSetVersion, registryVersion: declaration.registryVersion,
        stale: declaration.stale, partial: true, deploymentCoherence: 'unknown', nodes, edges,
        evidence: Object.fromEntries(available), omissions, declarationOmissions: declaration.omissions,
        roots: roots.map(root => ({ id: root.node.id, role: root.fact.role, key: nodeKey(root.node) })), resolutions,
        coverage: { candidateDocuments, examinedDocuments, parsedBytes, comparisons, alternativeReferences },
        gaps: ['Supported syntax and candidate wiring only; runtime dispatch, authority and concrete database ownership remain unknown.',
            'Declarations have independent bounded coverage. Incomplete target domains cannot establish a unique binding.'] };
}
