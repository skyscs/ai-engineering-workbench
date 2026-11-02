import assert from 'node:assert/strict';
import { setImmediate as yieldTurn } from 'node:timers/promises';
import { resolveBindingFacts } from './loredock-binding-resolution.mjs';
import { admitBindingPaths } from './loredock-binding-admission.mjs';
import { bindingMetadata, bindingDomains, assertBindingMetadata } from './loredock-binding-metadata.mjs';

export const bindingLimits = { files: 10000, facts: 10000, wallMs: 5000, work: 1000000,
  metadataEntries: 10000, metadataBytes: 8 * 1024 * 1024,
  resolutionNodes: 12000, resolutionEdges: 12000, bindingRecords: 12000, alternativeReferences: 12000,
  nodes: 160, edges: 240, flows: 2, steps: 20, traversals: 1000, pendingPaths: 1000, comparisons: 2000, outputBytes: 512 * 1024 };

class ProjectionWork {
  constructor(services, analysis, snapshot, limits, options, began) {
    Object.assign(this, { services, analysis, snapshot, limits, options, began });
    this.units = 0; this.sinceYield = 0; this.checkpoints = 0; this.lastYield = began;
    this.maxChunkMs = 0; this.stage = 'metadata'; this.stageStart = began; this.timings = {};
    this.changes = analysis.catalog.store.one('SELECT total_changes() n').n;
    this.dataVersion = analysis.catalog.store.one('PRAGMA data_version').data_version;
  }
  charge(count = 1) {
    const previous = this.units;
    this.units += count; this.sinceYield += count;
    if (this.units > this.limits.work) throw new this.services.CatalogError('WORK_LIMIT', 'Connected work bound exceeded.', 409);
    if (Math.floor(previous / 128) !== Math.floor(this.units / 128)) this.check();
  }
  check() {
    if (this.options.signal?.aborted) throw new this.services.CatalogError('CANCELLED', 'Connected projection cancelled.', 409);
    const project = this.analysis.catalog.store.project();
    const row = this.analysis.catalog.store.one('SELECT published,fingerprint,manifestHash,policyVersion,registryVersion FROM code_analyses WHERE id=?', this.snapshot.summary.id);
    if (project.policyVersion !== this.snapshot.policyVersion || project.sourceSetVersion !== this.snapshot.registryVersion
      || !row || !row.published || row.fingerprint !== this.snapshot.summary.fingerprint || row.manifestHash !== this.snapshot.manifestHash
      || row.policyVersion !== this.snapshot.policyVersion || row.registryVersion !== this.snapshot.registryVersion)
      throw new this.services.CatalogError('ANALYSIS_FENCED', 'Connected inventory or authorized scope changed.', 409);
    if (this.analysis.catalog.store.one('SELECT total_changes() n').n !== this.changes
      || this.analysis.catalog.store.one('PRAGMA data_version').data_version !== this.dataVersion)
      throw new this.services.CatalogError('METADATA_CHANGED', 'Saved input changed during projection.', 409);
    if (performance.now() - this.began >= this.limits.wallMs)
      throw new this.services.CatalogError('SCAN_INCOMPLETE', 'Connected cooperative time bound reached.', 409);
  }
  async step(stage, count = 1, force = false) {
    this.charge(count);
    if (this.stage !== stage) {
      this.timings[this.stage] = (this.timings[this.stage] ?? 0) + performance.now() - this.stageStart;
      this.stage = stage; this.stageStart = performance.now(); force = true;
    }
    if (!force && this.sinceYield < 128) return;
    this.check(); await yieldTurn();
    this.maxChunkMs = Math.max(this.maxChunkMs, performance.now() - this.lastYield); this.checkpoints++; this.sinceYield = 0;
    await this.options.checkpoint?.({ stage, checkpoints: this.checkpoints, units: this.units });
    this.check(); this.lastYield = performance.now();
  }
  stats() {
    return { workUnits: this.units, checkpoints: this.checkpoints, maxChunkMs: this.maxChunkMs,
      timings: { ...this.timings, [this.stage]: (this.timings[this.stage] ?? 0) + performance.now() - this.stageStart,
        wallMs: performance.now() - this.began } };
  }
}

/** Offline candidate only; complete saved coverage precedes binding and path admission. */
export async function bindingProjection(services, analysis, buildId, options = {}) {
  const limits = { ...bindingLimits, ...options.limits }, began = performance.now(); let work;
  for (const [key, value] of Object.entries(limits)) assert.ok(Number.isSafeInteger(value) && value >= 0 && value <= bindingLimits[key], 'Limits may only decrease.');
  const catalog = analysis.catalog;
  const finish = result => ({ ...result, stats: work?.stats() ?? { timings: { wallMs: performance.now() - began } } });
  try {
    catalog.readBuildHeader(buildId);
    const inventory = options.inventoryId ? analysis.get(options.inventoryId)
      : analysis.list().find(run => run.buildId === buildId && run.published && run.currentParser);
    if (!inventory) return finish({ status: 'unavailable', buildId, graph: null, error: { code: 'NOT_READY', message: 'No compatible published inventory.' } });
    if (inventory.buildId !== buildId) throw new services.CatalogError('INVALID_INVENTORY', 'Choose an inventory for this index.', 400);
    const snapshot = analysis.snapshot(inventory.id);
    work = new ProjectionWork(services, analysis, snapshot, limits, options, began);
    work.check();
    if (snapshot.summary.candidates > limits.files) throw new services.CatalogError('RESOLUTION_LIMIT', 'Connected file bound exceeded.', 409);
    const metadata = await bindingMetadata(catalog, analysis, snapshot, work, limits);
    const identity = { buildId, inventoryId: inventory.id, fingerprint: inventory.fingerprint, analysisLimits: inventory.limits,
      manifestHash: snapshot.manifestHash, metadataDigest: metadata.digest,
      policyVersion: snapshot.policyVersion, registryVersion: snapshot.registryVersion, adapter: 'task067-binding-v1', limits };
    const generationId = services.sha256(JSON.stringify(identity));
    if (options.rootId && !options.generationId || options.generationId && options.generationId !== generationId)
      throw new services.CatalogError('INVALID_GENERATION', 'Choose a root from the current generation.', 400);
    const entries = [], consumed = []; let factEntries = 0;
    for (const fileId of snapshot.fileIds) {
      await work.step('read');
      const payload = analysis.file(inventory.id, fileId), file = metadata.files.get(fileId);
      factEntries += payload.facts.symbols.length + payload.facts.operations.length + payload.facts.calls.length + Object.keys(payload.facts.records).length;
      if (factEntries > limits.facts) throw new services.CatalogError('RESOLUTION_LIMIT', 'Connected fact bound exceeded.', 409);
      entries.push({ file, payload }); consumed.push([fileId, payload.contentHash, payload.inputHash]);
    }
    const domains = await bindingDomains(metadata, entries, work);
    const resolution = await resolveBindingFacts(services, catalog, buildId, { entries, candidateDocuments: snapshot.summary.candidates,
      omissions: {}, domains, generationId, comparisons: limits.comparisons, limits, work });
    const graph = await admitBindingPaths(services, resolution, limits, work, options.rootId);
    const coverage = { scannedFiles: entries.length, retainedFiles: snapshot.fileIds.length, scanComplete: true, factEntries,
      consumedHash: services.sha256(JSON.stringify(consumed)), inventoryCounts: snapshot.summary.counts,
      metadataEntries: metadata.entries, metadataBytes: metadata.bytes, sources: domains.summaries };
    const envelope = { schemaVersion: 'loredock-binding-coverage-display/1', status: 'available', generationId, identity, coverage, graph };
    if (Buffer.byteLength(JSON.stringify(envelope)) > limits.outputBytes)
      throw new services.CatalogError('OUTPUT_LIMIT', 'Complete connected envelope exceeds its byte bound.', 409);
    await assertBindingMetadata(catalog, buildId, metadata, work, limits);
    const final = analysis.snapshot(inventory.id);
    if (final.manifestHash !== snapshot.manifestHash || final.policyVersion !== snapshot.policyVersion || final.registryVersion !== snapshot.registryVersion)
      throw new services.CatalogError('ANALYSIS_FENCED', 'Connected inventory changed.', 409);
    // No yield between final metadata/manifest authorization and publication.
    work.check();
    return finish({ status: 'available', buildId, envelope, graph, resolution });
  } catch (error) {
    return finish({ status: 'failed', buildId, graph: null,
      error: { code: error.code ?? 'PROJECTION_FAILED', message: error.code ? error.message : 'Connected projection failed validation.' } });
  }
}
