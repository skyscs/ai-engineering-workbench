import { activePathCatalogs as activeCatalogs } from './code-paths-owner.js';
import { codePathLimits } from './code-paths-work.js';
import { bindingMetadata, bindingDomains, assertBindingMetadata } from './code-paths-metadata.js';
import { resolvePathFacts } from './code-paths-v2-resolve.js';
import { admitPaths } from './code-paths-v2-admit.js';
import { declarationMap } from './system-map.js';
import { sha256 } from './extract.js';
import { CatalogError } from './types.js';
import { SharedPathWork } from './code-paths-v2-work.js';
import { OperationBudget, operationAccounting } from './operation-budget.js';
import { topicRule } from './literal-topic.js';
import { createCanonicalFactPair } from './canonical-fact-pair.js';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const hash = /^[a-f0-9]{64}$/;
const byteSize = (value) => Buffer.byteLength(JSON.stringify(value));
function validateRequest(input, kind) {
    if (!uuid.test(input.buildId) || Object.keys(input).some(key => !['buildId', 'inventoryId', 'generationId', 'rootId', 'offset'].includes(key))
        || (input.inventoryId !== undefined && !uuid.test(input.inventoryId))
        || (input.generationId !== undefined && !hash.test(input.generationId))
        || (input.rootId !== undefined && !hash.test(input.rootId))
        || (input.inventoryId === undefined) !== (input.generationId === undefined)
        || (input.rootId !== undefined && input.generationId === undefined))
        throw new CatalogError('INVALID_REQUEST', 'Choose an index and a matching saved path generation.');
    if ((kind === 'paths' && input.offset !== undefined) || (kind === 'roots' && (input.inventoryId === undefined || input.rootId !== undefined
        || !Number.isSafeInteger(input.offset) || input.offset < 0 || input.offset > 12000 || input.offset % 4 !== 0)))
        throw new CatalogError('INVALID_PAGE', 'Choose an available four-entry-point page.');
}
/** Read-only request owner over one injected inventory service. No cache or background work. */
export class CodePathsV2 {
    analysis;
    options;
    limits;
    stopping = false;
    active = null;
    constructor(analysis, options = {}) {
        this.analysis = analysis;
        this.options = options;
        this.limits = { ...codePathLimits, ...options.limits };
        for (const [key, value] of Object.entries(this.limits))
            if (!Number.isSafeInteger(value) || value < 0 || value > codePathLimits[key]
                || !Object.hasOwn(codePathLimits, key))
                throw new CatalogError('INVALID_LIMIT', 'Internal connected-path limits may only decrease.');
        Object.freeze(this.limits);
    }
    async read(input, kind = 'paths', signal, suppliedBudget) {
        if (suppliedBudget !== undefined && !(suppliedBudget instanceof OperationBudget))
            throw new CatalogError('INVALID_CAPTURE_BUDGET', 'Use the internal operation budget.');
        const owned = suppliedBudget === undefined;
        const budget = suppliedBudget ?? new OperationBudget({ ...this.options.budget, ...signal ? { signal } : {}, wallCeiling: this.limits.wallMs });
        try {
            return await this.analysis.catalog.store.withPreparedReads(() => this.readOwned(input, kind, signal, budget));
        }
        finally {
            if (owned)
                budget.close();
        }
    }
    async readOwned(input, kind, signal, budget) {
        budget.check();
        validateRequest(input, kind);
        if (this.stopping)
            throw new CatalogError('SERVICE_STOPPED', 'Connected path reads are stopping.', 409);
        if (signal?.aborted)
            throw new CatalogError('CANCELLED', 'Connected path read cancelled.', 409);
        const catalog = this.analysis.catalog;
        if (activeCatalogs.has(catalog))
            throw new CatalogError('PATHS_BUSY', 'Another connected path read is running. Retry when it finishes.', 409);
        budget.claimPath();
        const controller = new AbortController();
        let finish;
        const done = new Promise(resolve => { finish = resolve; });
        this.active = { controller, done };
        activeCatalogs.add(catalog);
        try {
            return await this.project(input, kind, signal ? AbortSignal.any([controller.signal, signal]) : controller.signal, budget);
        }
        finally {
            this.active = null;
            activeCatalogs.delete(catalog);
            finish();
        }
    }
    async stop() { this.stopping = true; this.active?.controller.abort(); await this.active?.done; }
    async project(input, kind, signal, budget) {
        const { buildId } = input, catalog = this.analysis.catalog, analysis = this.analysis;
        const build = catalog.readBuildHeader(buildId);
        const unavailable = (code, message) => ({ schemaVersion: 'loredock-code-paths/2', status: 'unavailable', buildId, reason: { code, message } });
        let inventory;
        if (input.inventoryId) {
            try {
                inventory = analysis.get(input.inventoryId);
            }
            catch (error) {
                if (error instanceof CatalogError && error.code === 'NOT_FOUND')
                    return unavailable('INVENTORY_UNAVAILABLE', 'This code inventory was removed or is unavailable. Use Code coverage to inspect retained inventories.');
                throw error;
            }
            if (inventory.buildId !== buildId)
                throw new CatalogError('INVALID_INVENTORY', 'Choose an inventory for this index.');
            if (!inventory.currentParser || !inventory.published)
                return unavailable('INVENTORY_UNAVAILABLE', 'This code inventory is not compatible and published. Inspect Code coverage.');
        }
        else
            inventory = analysis.list().find(run => run.buildId === buildId && run.published && run.currentParser);
        if (!inventory)
            return unavailable('INVENTORY_UNAVAILABLE', 'No compatible published code inventory is available. Inspect Code coverage to start or finish analysis.');
        const snapshot = analysis.snapshot(inventory.id), work = new SharedPathWork(analysis, snapshot, this.limits, { signal, ...this.options.checkpoint ? { checkpoint: this.options.checkpoint } : {} }, budget);
        work.check();
        if (snapshot.summary.candidates > this.limits.files)
            throw new CatalogError('RESOLUTION_LIMIT', 'Connected file bound exceeded.', 409);
        const metadata = await bindingMetadata(catalog, analysis, snapshot, work, this.limits);
        const entries = [], consumed = [], canonicalPair = createCanonicalFactPair();
        let factEntries = 0;
        for (const fileId of snapshot.fileIds) {
            await work.step('read');
            const payload = analysis.file(inventory.id, fileId), file = metadata.files.get(fileId);
            factEntries += payload.facts.symbols.length + payload.facts.operations.length + payload.facts.calls.length + Object.keys(payload.facts.records).length;
            if (factEntries > this.limits.facts)
                throw new CatalogError('RESOLUTION_LIMIT', 'Connected fact bound exceeded.', 409);
            consumed.push([fileId, payload.contentHash, payload.inputHash]);
            entries.push({ file, payload: { ...canonicalPair(payload.facts, payload.ranges), evidence: payload.evidence } });
        }
        const domains = await bindingDomains(metadata, entries, work);
        await work.step('resolve', 0, true);
        const declaration = declarationMap(catalog, buildId);
        const identity = { buildId, sourceSetVersion: build.sourceSetVersion, inventoryId: inventory.id, fingerprint: inventory.fingerprint,
            analysisLimits: inventory.limits, manifestHash: snapshot.manifestHash, metadataDigest: metadata.digest,
            declarationAdapter: declaration.adapterVersion, declarationInputHash: declaration.inputHash,
            policyVersion: snapshot.policyVersion, registryVersion: snapshot.registryVersion, adapter: 'connected-paths-v2', topicRule, accounting: operationAccounting, limits: this.limits };
        const generationId = sha256(JSON.stringify(identity));
        if (input.generationId && input.generationId !== generationId)
            throw new CatalogError('INVALID_GENERATION', 'This path generation changed. Reload its default paths.');
        const resolution = await resolvePathFacts(catalog, buildId, { entries, candidateDocuments: snapshot.summary.candidates, domains,
            generationId, declaration, limits: this.limits, work });
        const graph = kind === 'paths' ? await admitPaths(resolution, this.limits, work, input.rootId) : null;
        const coverage = { scannedFiles: entries.length, retainedFiles: snapshot.fileIds.length, scanComplete: true, factEntries,
            consumedHash: sha256(JSON.stringify(consumed)), inventoryCounts: snapshot.summary.counts, metadataEntries: metadata.entries,
            metadataBytes: metadata.bytes, sources: domains.summaries, incompleteBindings: 0, bindingReasons: {},
            resolution: { ...resolution.coverage, nodes: resolution.nodes.length, edges: resolution.edges.length, roots: resolution.roots.length },
            omissions: resolution.omissions, declarationOmissions: resolution.declarationOmissions };
        for (const binding of resolution.resolutions) {
            await work.step('admit');
            if (binding.incomplete)
                coverage.incompleteBindings++;
            for (const [reason, count] of Object.entries(binding.domain.reasons))
                coverage.bindingReasons[reason] = (coverage.bindingReasons[reason] ?? 0) + count;
        }
        const offset = input.offset ?? 0, total = resolution.roots.length;
        if (offset !== 0 && offset >= total)
            throw new CatalogError('INVALID_PAGE', 'Choose an available four-entry-point page.');
        const envelope = { schemaVersion: 'loredock-code-paths/2', status: 'available', kind, generationId, projectionId: '0'.repeat(64),
            identity, coverage, graph, selection: { rootId: input.rootId ?? null, offset }, partial: true, deploymentCoherence: 'unknown',
            roots: { offset, limit: 4, total, previous: offset ? offset - 4 : null, next: offset + 4 < total ? offset + 4 : null,
                outsidePage: total - Math.min(4, total - offset), unavailableEntries: 0, items: [], evidence: {} } };
        await this.rootPage(envelope, resolution, work);
        await assertBindingMetadata(catalog, buildId, metadata, work, this.limits);
        const final = analysis.snapshot(inventory.id);
        if (final.manifestHash !== snapshot.manifestHash || final.policyVersion !== snapshot.policyVersion || final.registryVersion !== snapshot.registryVersion)
            throw new CatalogError('ANALYSIS_FENCED', 'Connected inventory changed.', 409);
        // No asynchronous gap between final fences, complete envelope sizing and publication.
        work.check();
        const { projectionId: _placeholder, ...content } = envelope;
        envelope.projectionId = sha256(JSON.stringify(content));
        if (byteSize(envelope) > this.limits.outputBytes)
            throw new CatalogError('OUTPUT_LIMIT', 'The complete path response exceeds its byte bound.', 409);
        work.check();
        return envelope;
    }
    async rootPage(envelope, resolution, work) {
        const nodes = new Map();
        for (const node of resolution.nodes) {
            await work.step('admit');
            nodes.set(node.id, node);
        }
        const page = envelope.roots;
        for (const root of resolution.roots.slice(page.offset, page.offset + 4)) {
            await work.step('admit');
            const node = nodes.get(root.id);
            const card = { status: 'available', id: root.id, role: root.role, sourceId: node.sourceId, sourceName: node.sourceName,
                path: node.path, revision: node.revision, label: node.label, startLine: node.startLine, endLine: node.endLine, evidenceIds: node.evidenceIds };
            const evidence = { ...page.evidence };
            for (const id of card.evidenceIds) {
                await work.step('admit');
                const ref = resolution.evidence[id];
                if (!ref)
                    throw new CatalogError('CORRUPT_CODE_FACTS', 'Entry-point original support is unavailable.', 409);
                evidence[id] = ref;
            }
            const candidate = { ...envelope, roots: { ...page, items: [...page.items, card], evidence } };
            // Reserve space for remaining explicit unavailable entries and final counters/hash.
            if (card.label.length > 512 || card.sourceName.length > 512 || byteSize(candidate) > this.limits.outputBytes - 4096) {
                page.items.push({ status: 'unavailable', id: root.id, reason: 'This entry point and its complete original support do not fit the response limits.' });
                page.unavailableEntries++;
            }
            else {
                page.items.push(card);
                page.evidence = evidence;
            }
        }
    }
}
