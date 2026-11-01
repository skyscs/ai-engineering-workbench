// Offline Task 062 copy of the pinned pilot-code-v3 assembler at 7e8c921.
// Only input acquisition/ranges, explicit experimental provenance and input limits differ.
// Never imported by the application. No parser, filesystem resolution or source execution.
import path from 'node:path';
export const baselineFlowLimits = { documents: 100, fileBytes: 32 * 1024, textBytes: 256 * 1024, fileSpans: 8,
    nodes: 160, edges: 240, comparisons: 2000, flows: 2, flowSteps: 20, traversals: 1000, outputBytes: 512 * 1024 };
const unique = (values) => [...new Set(values)].sort();
/** Code syntax and candidate wiring are navigation aids, never observed execution. */
export function assembleSavedFlows(services, catalog, buildId, supplied) {
    const { declarationMap, sha256, CatalogError, compareHeaders } = services;
    const flowLimits = { ...baselineFlowLimits, ...supplied.inputLimits };
    const declaration = declarationMap(catalog, buildId), build = catalog.readBuild(declaration.buildId);
    const nodes = [], edges = [], flows = [];
    const available = new Map(Object.values(declaration.evidence).map(ref => [ref.id, ref]));
    const evidence = new Map(), omissions = {};
    const symbols = [], operations = [];
    let outputBytes = 0, parsedBytes = 0, examinedDocuments = 0, comparisons = 0;
    const omit = (reason, count = 1) => { omissions[reason] = (omissions[reason] ?? 0) + count; };
    const id = (...parts) => sha256(JSON.stringify([build.id, 'task062-saved-facts-v1', ...parts]));
    function reserve(item) {
        const refs = item.evidenceIds.filter(ref => !evidence.has(ref)).map(ref => available.get(ref));
        const cost = Buffer.byteLength(JSON.stringify(item)) + 1 + refs.reduce((sum, ref) => sum + Buffer.byteLength(JSON.stringify(ref)) + ref.id.length + 4, 0);
        if (outputBytes + cost > flowLimits.outputBytes - 16 * 1024) {
            omit('output-byte-limit');
            return false;
        }
        outputBytes += cost;
        for (const ref of refs)
            evidence.set(ref.id, ref);
        return true;
    }
    function addNode(item) {
        const existing = nodes.find(node => node.id === item.id);
        if (existing)
            return existing;
        if (nodes.length >= flowLimits.nodes) {
            omit('node-limit');
            return;
        }
        if (item.label.length > 512 || Object.values(item.properties).some(value => value.length > 512)) {
            omit('property-byte-limit');
            return;
        }
        if (reserve(item)) {
            nodes.push(item);
            return item;
        }
        return;
    }
    function link(kind, from, to, status, reason, gaps = [], extra = [], environment = null, headerCheck) {
        const edgeId = id('edge', kind, from.id, to.id, environment);
        if (edges.some(edge => edge.id === edgeId))
            return;
        if (edges.length >= flowLimits.edges) {
            omit('edge-limit');
            return;
        }
        const item = { id: edgeId, kind, from: from.id, to: to.id, status, reason, environment, gaps,
            evidenceIds: unique([...from.evidenceIds, ...to.evidenceIds, ...extra]), ...(headerCheck ? { headerCheck } : {}) };
        if (reserve(item))
            edges.push(item);
    }
    function compare() {
        if (comparisons >= flowLimits.comparisons) {
            omit('comparison-limit');
            return false;
        }
        comparisons++;
        return true;
    }
    const candidateDocuments = supplied.candidateDocuments;
    for (const [reason, count] of Object.entries(supplied.omissions)) omit(reason, count);
    for (const { file, payload } of supplied.entries) {
        const { facts, evidence: refs } = payload;
        parsedBytes += file.size;
        examinedDocuments++;
        for (const ref of refs) available.set(ref.id, ref);
        for (const gap of facts.gaps)
            omit(`adapter:${gap}`);
        const document = { file, facts, refs }, source = build.sources.find(source => source.sourceId === file.sourceId);
        function codeNode(key, kind, label, start, end, properties) {
            const range = key.startsWith('operation:')
                ? payload.ranges.operations[facts.operations.findIndex(fact => fact.start === start)]
                : payload.ranges.symbols.find(range => range.key === key);
            if (!range) throw new CatalogError('CORRUPT_CODE_FACTS', 'Saved graph range is unavailable.', 409);
            const { startLine, endLine } = range;
            return addNode({ id: id('node', file.sourceId, file.path, key), kind, label, sourceId: file.sourceId, sourceName: source.name,
                path: file.path, revision: source.revision, startLine, endLine, properties,
                // Types, receiver declarations and imports can precede the operation's own lines.
                evidenceIds: refs.map(ref => ref.id) });
        }
        for (const fact of facts.symbols) {
            const node = codeNode(fact.key, 'symbol', fact.qualifiedName, fact.start, fact.end, { role: fact.role,
                ...fact.parameterTypes ? { parameterTypes: fact.parameterTypes.join(', ') } : {} });
            if (node)
                symbols.push({ node, fact, document });
        }
        for (const fact of facts.operations) {
            const owner = symbols.find(symbol => symbol.document === document && symbol.fact.key === fact.owner);
            if (!owner)
                continue;
            const properties = Object.fromEntries(Object.entries(fact.properties).filter(([key]) => key !== 'recordSignature'));
            const label = fact.kind === 'http-request' ? `${properties.method} ${properties.path}` : fact.kind === 'event-publish'
                ? `Publish ${properties.payloadType}` : fact.kind === 'event-subscribe' ? 'Subscribe via KafkaSubscriber' : 'MongoCollection.replaceOne';
            const node = codeNode(`operation:${fact.start}`, fact.kind, label, fact.start, fact.end, properties);
            if (!node)
                continue;
            operations.push({ node, fact, owner });
            link('performs', owner.node, node, 'static', 'This method/function contains the supported call in the indexed syntax; execution and ordering are unverified.');
        }
    }
    for (const owner of symbols)
        for (const call of owner.document.facts.calls.filter(call => call.owner === owner.fact.key)) {
            if (!call.module.startsWith('./') && !call.module.startsWith('../')) {
                omit('unsupported-import-target');
                continue;
            }
            const stem = path.posix.normalize(path.posix.join(path.posix.dirname(owner.node.path), call.module));
            if (stem.startsWith('../')) {
                omit('unresolved-import');
                continue;
            }
            const paths = /\.(ts|js)$/.test(stem) ? [stem] : [stem + '.ts', stem + '.js', stem + '/index.ts', stem + '/index.js'];
            const targets = symbols.filter(target => target.node.sourceId === owner.node.sourceId && paths.includes(target.node.path)
                && target.fact.exported && target.fact.role !== 'amd-function' && target.fact.name === call.imported);
            if (targets.length === 1)
                link('calls', owner.node, targets[0].node, 'static', 'A supported relative named import is called by this function/action.');
            else
                omit(targets.length ? 'ambiguous-import' : 'unresolved-import');
        }
    const declaredNodes = new Map();
    function declared(node) {
        const refs = node.evidenceIds.map(id => available.get(id));
        const item = addNode({ id: node.id, kind: node.kind === 'http-route' ? 'route' : 'handler-reference', label: node.label,
            sourceId: node.sourceId, sourceName: node.sourceName, revision: node.revision, path: refs[0].path,
            startLine: Math.min(...refs.map(ref => ref.startLine)), endLine: Math.max(...refs.map(ref => ref.endLine)),
            properties: node.properties, evidenceIds: node.evidenceIds });
        if (item)
            declaredNodes.set(item.id, item);
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
        const eligible = symbols.filter(symbol => symbol.node.sourceId === handler.sourceId && symbol.fact.role === 'java-method');
        const exact = eligible.filter(symbol => symbol.fact.qualifiedName === handler.label);
        const targets = exact.length ? exact : eligible.filter(symbol => symbol.fact.qualifiedName.split('.').slice(-2).join('.') === handler.label);
        if (targets.length === 1)
            link('implements', handler, targets[0].node, 'static', 'This same-source unique class/method matches the supported handler reference.');
        else
            omit(targets.length ? 'ambiguous-handler' : 'unresolved-handler');
    }
    for (const request of operations.filter(operation => operation.fact.kind === 'http-request')) {
        for (const route of nodes.filter(node => node.kind === 'route')) {
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
    const subscribers = operations.filter(operation => operation.fact.kind === 'event-subscribe');
    for (const publisher of operations.filter(operation => operation.fact.kind === 'event-publish'))
        for (const subscriber of subscribers) {
            if (!compare())
                break;
            if (publisher.node.sourceId === subscriber.node.sourceId)
                continue;
            const consumers = symbols.filter(symbol => symbol.node.sourceId === subscriber.node.sourceId
                && symbol.fact.className === subscriber.fact.properties.handlerClass && symbol.fact.name === 'onMessage'
                && symbol.fact.parameterTypes?.length === 1 && symbol.fact.parameterTypes[0] === publisher.fact.properties.payloadType
                && symbol.document.facts.records[symbol.fact.parameterTypes[0]] === publisher.fact.properties.recordSignature
                && operations.some(operation => operation.owner === symbol && operation.fact.kind === 'document-write'
                    && operation.fact.properties.recordSignature === publisher.fact.properties.recordSignature));
            if (consumers.length !== 1) {
                omit(consumers.length ? 'ambiguous-consumer-method' : 'unresolved-consumer-method');
                continue;
            }
            const pair = (a, b) => a === publisher.node.sourceId && b === subscriber.node.sourceId || b === publisher.node.sourceId && a === subscriber.node.sourceId;
            const matches = declaration.edges.filter(edge => edge.kind === 'contract-match').filter(edge => {
                const a = declaration.nodes.find(node => node.id === edge.from), b = declaration.nodes.find(node => node.id === edge.to);
                return pair(a.sourceId, b.sourceId) && a.properties.name === publisher.fact.properties.payloadType
                    && JSON.stringify(Object.keys(JSON.parse(a.properties.fields)).sort())
                        === JSON.stringify(Object.keys(JSON.parse(publisher.fact.properties.recordSignature)).sort());
            });
            const topics = declaration.edges.filter(edge => edge.kind === 'setting-match').filter(edge => {
                const a = declaration.nodes.find(node => node.id === edge.from), b = declaration.nodes.find(node => node.id === edge.to);
                return pair(a.sourceId, b.sourceId) && a.label === 'orderTopic' && a.properties.valueType === 'string';
            });
            if (matches.length !== 1 || topics.length !== 1) {
                omit('unresolved-contract-or-topic-scope');
                continue;
            }
            const match = matches[0], topic = topics[0];
            if (match.environment !== null && match.environment !== topic.environment) {
                omit('incompatible-declared-environment');
                continue;
            }
            const topicValue = declaration.nodes.find(node => node.id === topic.from).properties.value;
            const literalTopics = [publisher, subscriber].map(operation => operation.fact.properties.topicExpression)
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
            const consumer = consumers[0];
            link('event-delivery', publisher.node, subscriber.node, 'candidate', 'Equal supported Java record shapes, matching JSON contract declarations and one scoped orderTopic setting are candidate delivery clues.', ['Runtime topic parameters are not bound to the JSON orderTopic settings by supported code.',
                'A shared broker, serialization and co-deployment are unverified; JSON contracts are not linked to the record by code.'], unique([...match.evidenceIds, ...topic.evidenceIds, ...consumer.node.evidenceIds]), topic.environment);
            link('dispatch-candidate', subscriber.node, consumer.node, 'candidate', 'The subscriber receives this class, whose onMessage method accepts the matching record and contains a document write. Dispatch is unresolved.', ['KafkaSubscriber has no implementation proving that subscription dispatches to onMessage.']);
        }
    const priorities = { 'vue-action': 0, 'amd-function': 1, function: 2, 'java-method': 3 };
    const roots = symbols.filter(symbol => symbol.fact.role === 'vue-action' || symbol.fact.role === 'amd-function'
        || symbol.fact.role === 'function' && operations.some(operation => operation.owner === symbol && operation.fact.kind === 'http-request')
            && !edges.some(edge => edge.kind === 'calls' && edge.to === symbol.node.id))
        .sort((a, b) => priorities[a.fact.role] - priorities[b.fact.role] || (a.node.path < b.node.path ? -1 : a.node.path > b.node.path ? 1 : 0));
    let traversed = 0;
    for (const root of roots) {
        if (flows.length >= flowLimits.flows) {
            omit('flow-limit');
            continue;
        }
        const pending = [{ nodeIds: [root.node.id], edgeIds: [] }], terminal = [];
        while (pending.length && traversed < flowLimits.traversals) {
            traversed++;
            const current = pending.pop(), last = current.nodeIds.at(-1);
            const outgoing = edges.filter(edge => edge.from === last && !current.nodeIds.includes(edge.to));
            if (!outgoing.length || current.nodeIds.length >= flowLimits.flowSteps) {
                terminal.push(current);
                if (outgoing.length)
                    omit('flow-step-limit');
                continue;
            }
            for (const edge of outgoing.slice().reverse())
                pending.push({ nodeIds: [...current.nodeIds, edge.to], edgeIds: [...current.edgeIds, edge.id] });
        }
        if (pending.length)
            omit('flow-traversal-limit');
        const score = (walk) => nodes.find(node => node.id === walk.nodeIds.at(-1))?.kind === 'document-write' ? 1000 + walk.nodeIds.length : walk.nodeIds.length;
        terminal.sort((a, b) => score(b) - score(a));
        const selected = terminal[0];
        if (!selected || !selected.edgeIds.length)
            continue;
        const pathEdges = selected.edgeIds.map(id => edges.find(edge => edge.id === id));
        const pathNodes = selected.nodeIds.map(id => nodes.find(node => node.id === id));
        const gaps = unique([...pathEdges.flatMap(edge => edge.gaps), 'This is a static outline, not an observed execution or coherent deployment.',
            ...pathNodes.at(-1).kind === 'document-write' ? ['The MongoCollection receiver is not bound to a concrete database or collection by supported code.'] : ['The supported path ends before an evidenced document write.'],
            ...terminal.length > 1 ? ['Several static branches exist; one bounded outline is shown for this entry point.'] : []]);
        const item = { id: id('flow', root.node.id, selected.edgeIds), title: `${root.fact.role === 'vue-action' ? 'Vue action' : root.fact.role === 'amd-function' ? 'Dojo action' : 'HTTP client'} · ${path.posix.basename(root.node.path)}`,
            status: 'partial', environment: null, ...selected, gaps,
            evidenceIds: unique([...pathNodes.flatMap(node => node.evidenceIds), ...pathEdges.flatMap(edge => edge.evidenceIds)]) };
        if (reserve(item))
            flows.push(item);
    }
    const gaps = ['Only the versioned pilot syntax profiles are analyzed; framework-wide call graphs and dynamic behavior remain unsupported.',
        'Static calls describe source syntax, not execution order. Candidate hops require review of their original sources.',
        'Repository identity does not establish service ownership. Deployment coherence and the active environment are unknown.'];
    if (Object.keys(omissions).length || Object.keys(declaration.omissions).length)
        gaps.push('Unsupported or bounded work was omitted; inspect code and declaration coverage.');
    if (declaration.stale)
        gaps.push('This projection uses an older index or source registry; revoked sources are excluded.');
    if (build.status === 'partial')
        gaps.push('The source index is partial; excluded and failed material is unavailable.');
    const result = { schemaVersion: 'loredock-durable-flow-probe/1', adapterVersion: 'task062-saved-facts-v1', buildId: build.id,
        policyVersion: declaration.policyVersion, sourceSetVersion: declaration.sourceSetVersion, registryVersion: declaration.registryVersion,
        stale: declaration.stale, partial: true, deploymentCoherence: 'unknown', nodes, edges, flows,
        evidence: Object.fromEntries(evidence), gaps, omissions, declarationOmissions: declaration.omissions,
        coverage: { candidateDocuments, examinedDocuments, parsedBytes }, limits: flowLimits };
    const output = { ...result, inputHash: sha256(JSON.stringify(result)) };
    if (Buffer.byteLength(JSON.stringify(output)) > flowLimits.outputBytes)
        throw new CatalogError('FLOW_LIMIT', 'The code-flow response exceeds its byte limit.', 409);
    return output;
}
