import assert from 'node:assert/strict';
import { setImmediate as yieldTurn } from 'node:timers/promises';
import { resolveScaleFacts } from './loredock-connected-scale-resolution.mjs';
import { admitScalePaths } from './loredock-connected-scale-admission.mjs';

export const scaleLimits = { files: 10000, facts: 10000, wallMs: 5000, work: 1000000,
  resolutionNodes: 12000, resolutionEdges: 12000, bindingRecords: 12000, alternativeReferences: 12000,
  nodes: 160, edges: 240, flows: 2, steps: 20, traversals: 1000, pendingPaths: 1000, comparisons: 2000, outputBytes: 512 * 1024 };

class ProjectionWork {
  constructor(services, analysis, snapshot, limits, options, began) {
    Object.assign(this, { services, analysis, snapshot, limits, options, began });
    this.units = 0; this.sinceYield = 0; this.checkpoints = 0; this.lastYield = began;
    this.maxChunkMs = 0; this.stage = 'read'; this.stageStart = began; this.timings = {};
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
    this.maxChunkMs = Math.max(this.maxChunkMs, performance.now() - this.lastYield);
    this.check(); await yieldTurn(); this.checkpoints++; this.sinceYield = 0;
    await this.options.checkpoint?.({ stage, checkpoints: this.checkpoints, units: this.units });
    this.check(); this.lastYield = performance.now();
  }
  stats() {
    return { workUnits: this.units, checkpoints: this.checkpoints, maxChunkMs: this.maxChunkMs,
      timings: { ...this.timings, [this.stage]: (this.timings[this.stage] ?? 0) + performance.now() - this.stageStart,
        wallMs: performance.now() - this.began } };
  }
}

/** Offline candidate only. Complete retained-fact validation precedes resolution/admission. */
export async function scaleProjection(services, analysis, buildId, options = {}) {
  const limits = { ...scaleLimits, ...options.limits }, began = performance.now(); let work;
  for (const [key, value] of Object.entries(limits)) assert.ok(Number.isSafeInteger(value) && value >= 0 && value <= scaleLimits[key], 'Limits may only decrease.');
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
    if (snapshot.summary.candidates > limits.files) throw new services.CatalogError('RESOLUTION_LIMIT', 'Connected file bound exceeded.', 409);
    const incomplete = new Map(), mark = (source, reason, count = 1) => {
      const reasons = incomplete.get(source) ?? {}; reasons[reason] = (reasons[reason] ?? 0) + count; incomplete.set(source, reasons);
    };
    for (let offset = 0; offset < snapshot.summary.candidates; offset += 50) {
      for (const unit of analysis.files(inventory.id, offset)) {
        await work.step('read'); if (unit.status !== 'parsed') mark(unit.sourceId, unit.status);
      }
    }
    const excluded = catalog.store.all(`SELECT sourceId,count(*) count FROM files WHERE buildId=? AND status<>'indexed'
      AND (lower(path) LIKE '%.ts' OR lower(path) LIKE '%.js' OR lower(path) LIKE '%.vue' OR lower(path) LIKE '%.java') GROUP BY sourceId LIMIT 21`, buildId);
    if (excluded.length > 20) throw new services.CatalogError('RESOLUTION_LIMIT', 'Connected source metadata bound exceeded.', 409);
    for (const source of excluded) mark(source.sourceId, 'index-excluded', source.count);
    const entries = [], consumed = []; let factEntries = 0;
    for (const fileId of snapshot.fileIds) {
      await work.step('read', 1, true);
      const payload = analysis.file(inventory.id, fileId);
      const file = catalog.store.one('SELECT id,sourceId,path,size,length(raw) storedBytes FROM files WHERE id=?', fileId);
      factEntries += payload.facts.symbols.length + payload.facts.operations.length + payload.facts.calls.length + Object.keys(payload.facts.records).length;
      if (factEntries > limits.facts) throw new services.CatalogError('RESOLUTION_LIMIT', 'Connected fact bound exceeded.', 409);
      entries.push({ file, payload }); consumed.push([fileId, payload.contentHash, payload.inputHash]);
      for (const gap of payload.facts.gaps) mark(payload.sourceId, gap);
    }
    const resolution = await resolveScaleFacts(services, catalog, buildId, { entries, candidateDocuments: snapshot.summary.candidates,
      omissions: {}, incompleteSources: new Set(incomplete.keys()), comparisons: limits.comparisons, limits, work });
    const graph = await admitScalePaths(services, resolution, limits, work, options.rootId);
    const identity = { buildId, inventoryId: inventory.id, fingerprint: inventory.fingerprint, manifestHash: snapshot.manifestHash,
      policyVersion: snapshot.policyVersion, registryVersion: snapshot.registryVersion, adapter: 'task065-connected-v1', limits };
    const generationId = services.sha256(JSON.stringify(identity));
    const coverage = { scannedFiles: entries.length, retainedFiles: snapshot.fileIds.length, scanComplete: true, factEntries,
      consumedHash: services.sha256(JSON.stringify(consumed)), incompleteSources: Object.fromEntries(incomplete), inventoryCounts: snapshot.summary.counts };
    const envelope = { schemaVersion: 'loredock-connected-scale-display/1', status: 'available', generationId, identity, coverage, graph };
    if (Buffer.byteLength(JSON.stringify(envelope)) > limits.outputBytes)
      throw new services.CatalogError('OUTPUT_LIMIT', 'Complete connected envelope exceeds its byte bound.', 409);
    const final = analysis.snapshot(inventory.id);
    if (final.manifestHash !== snapshot.manifestHash) throw new services.CatalogError('ANALYSIS_FENCED', 'Connected inventory changed.', 409);
    await work.step('admit', 0, true);
    return finish({ status: 'available', buildId, envelope, graph, resolution });
  } catch (error) {
    return finish({ status: 'failed', buildId, graph: null,
      error: { code: error.code ?? 'PROJECTION_FAILED', message: error.code ? error.message : 'Connected projection failed validation.' } });
  }
}
