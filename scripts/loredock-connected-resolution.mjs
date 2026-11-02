// Offline Task 063 resolver derived from the pinned Task 062 assembler.
// Resolve against retained facts before applying display caps; never imported by the app.
import path from 'node:path';
const baselineFlowLimits = { documents: 100, fileBytes: 32 * 1024, textBytes: 256 * 1024, fileSpans: 8,
    nodes: 160, edges: 240, comparisons: 2000, flows: 2, flowSteps: 20, traversals: 1000, outputBytes: 512 * 1024 };
const unique = (values) => [...new Set(values)].sort();
/** Code syntax and candidate wiring are navigation aids, never observed execution. */
export function resolveConnectedFacts(services, catalog, buildId, supplied) {
    const { declarationMap, sha256, CatalogError, compareHeaders } = services;
    const flowLimits = { ...baselineFlowLimits, comparisons: supplied.comparisons };
    const declaration = declarationMap(catalog, buildId), build = catalog.readBuild(declaration.buildId);
    const nodes = [], edges = [], resolutions = [];
    let alternativeReferences = 0;
    const available = new Map(Object.values(declaration.evidence).map(ref => [ref.id, ref]));
    const omissions = {};
    const symbols = [], operations = [];
    let parsedBytes = 0, examinedDocuments = 0, comparisons = 0;
    const omit = (reason, count = 1) => { omissions[reason] = (omissions[reason] ?? 0) + count; };
    const id = (...parts) => sha256(JSON.stringify([build.id, 'task063-connected-v1', ...parts]));
    function addNode(item) {
        const existing = nodes.find(node => node.id === item.id); if (existing) return existing;
        if (nodes.length >= supplied.limits.resolutionNodes) throw new CatalogError('RESOLUTION_LIMIT', 'Resolution node budget exceeded.', 409);
        nodes.push(item); return item;
    }
    function resolution(kind, owner, targets, incomplete) {
        alternativeReferences += targets.length;
        if (resolutions.length >= supplied.limits.bindingRecords || alternativeReferences > supplied.limits.alternativeReferences)
            throw new CatalogError('RESOLUTION_LIMIT', 'Resolution reference budget exceeded.', 409);
        resolutions.push({ kind, owner, targets: targets.map(target => target.node.id), incomplete,
            outcome: incomplete ? 'incomplete' : targets.length === 1 ? 'unique' : targets.length ? 'ambiguous' : 'unresolved' });
    }
    function link(kind, from, to, status, reason, gaps = [], extra = [], environment = null, headerCheck) {
        const edgeId = id('edge', kind, from.id, to.id, environment);
        if (edges.some(edge => edge.id === edgeId))
            return;
        if (edges.length >= supplied.limits.resolutionEdges) throw new CatalogError('RESOLUTION_LIMIT', 'Resolution edge budget exceeded.', 409);
        const item = { id: edgeId, kind, from: from.id, to: to.id, status, reason, environment, gaps,
            evidenceIds: unique([...from.evidenceIds, ...to.evidenceIds, ...extra]), ...(headerCheck ? { headerCheck } : {}) };
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
            const incomplete = supplied.incompleteSources.has(owner.node.sourceId);
            resolution('calls', owner.node.id, targets, incomplete);
            if (incomplete) { omit('incomplete-import-source'); continue; }
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
        const incomplete = supplied.incompleteSources.has(handler.sourceId);
        resolution('implements', handler.id, targets, incomplete);
        if (incomplete) { omit('incomplete-handler-source'); continue; }
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
            const incomplete = supplied.incompleteSources.has(subscriber.node.sourceId);
            resolution('consumer', subscriber.node.id, consumers, incomplete);
            if (incomplete) { omit('incomplete-consumer-source'); continue; }
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
    const key = node => [node.sourceName, node.path, node.kind, node.label].join('\0');
    const compareText = (a, b) => a < b ? -1 : a > b ? 1 : 0;
    const roots = symbols.filter(symbol => symbol.fact.role === 'vue-action' || symbol.fact.role === 'amd-function'
        || symbol.fact.role === 'function' && operations.some(operation => operation.owner === symbol && operation.fact.kind === 'http-request')
            && !edges.some(edge => edge.kind === 'calls' && edge.to === symbol.node.id))
        .sort((a, b) => priorities[a.fact.role] - priorities[b.fact.role]
            || compareText(a.node.sourceName, b.node.sourceName) || compareText(a.node.path, b.node.path)
            || compareText(a.fact.key, b.fact.key) || compareText(a.node.sourceId, b.node.sourceId));
    return { schemaVersion: 'loredock-connected-resolution/1', adapterVersion: 'task063-connected-v1', buildId: build.id,
        policyVersion: declaration.policyVersion, sourceSetVersion: declaration.sourceSetVersion, registryVersion: declaration.registryVersion,
        stale: declaration.stale, partial: true, deploymentCoherence: 'unknown', nodes, edges,
        evidence: Object.fromEntries(available), omissions, declarationOmissions: declaration.omissions,
        roots: roots.map(root => ({ id: root.node.id, role: root.fact.role, key: key(root.node) })), resolutions,
        coverage: { candidateDocuments, examinedDocuments, parsedBytes, comparisons, alternativeReferences },
        gaps: ['Supported syntax and candidate wiring only; runtime dispatch, authority and concrete database ownership remain unknown.',
            'Declarations have independent bounded coverage. Incomplete source facts cannot establish a unique binding.'] };
}
