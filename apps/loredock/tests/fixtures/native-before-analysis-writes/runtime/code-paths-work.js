import { setImmediate as yieldTurn } from 'node:timers/promises';
import { CatalogError } from './types.js';
export const codePathLimits = { files: 10000, facts: 10000, wallMs: 5000, work: 1000000,
    metadataEntries: 10000, metadataBytes: 8 * 1024 * 1024,
    resolutionNodes: 12000, resolutionEdges: 12000, bindingRecords: 12000, alternativeReferences: 12000,
    nodes: 160, edges: 240, flows: 2, steps: 20, traversals: 1000, pendingPaths: 1000, comparisons: 2000, outputBytes: 512 * 1024 };
/** One request's bounded work; conservative write fencing preserves the qualified reader. */
export class PathWork {
    analysis;
    snapshot;
    limits;
    options;
    began;
    units = 0;
    checkpoints = 0;
    sinceYield = 0;
    stage = 'metadata';
    changes;
    dataVersion;
    constructor(analysis, snapshot, limits, options, began) {
        this.analysis = analysis;
        this.snapshot = snapshot;
        this.limits = limits;
        this.options = options;
        this.began = began;
        this.changes = analysis.catalog.store.one('SELECT total_changes() n').n;
        this.dataVersion = analysis.catalog.store.one('PRAGMA data_version').data_version;
    }
    charge(count = 1) {
        const previous = this.units;
        this.units += count;
        this.sinceYield += count;
        if (this.units > this.limits.work)
            throw new CatalogError('WORK_LIMIT', 'Connected work bound exceeded.', 409);
        if (Math.floor(previous / 128) !== Math.floor(this.units / 128))
            this.check();
    }
    check() {
        if (this.options.signal.aborted)
            throw new CatalogError('CANCELLED', 'Connected path read cancelled.', 409);
        const store = this.analysis.catalog.store, project = store.project();
        const row = store.one('SELECT published,fingerprint,manifestHash,policyVersion,registryVersion FROM code_analyses WHERE id=?', this.snapshot.summary.id);
        if (project.policyVersion !== this.snapshot.policyVersion || project.sourceSetVersion !== this.snapshot.registryVersion
            || !row || !row.published || row.fingerprint !== this.snapshot.summary.fingerprint || row.manifestHash !== this.snapshot.manifestHash
            || row.policyVersion !== this.snapshot.policyVersion || row.registryVersion !== this.snapshot.registryVersion)
            throw new CatalogError('ANALYSIS_FENCED', 'Connected inventory or authorized scope changed.', 409);
        if (store.one('SELECT total_changes() n').n !== this.changes
            || store.one('PRAGMA data_version').data_version !== this.dataVersion)
            throw new CatalogError('METADATA_CHANGED', 'Saved input changed during this read. Retry after the current update finishes.', 409);
        if (performance.now() - this.began >= this.limits.wallMs)
            throw new CatalogError('SCAN_INCOMPLETE', 'Connected cooperative time bound reached.', 409);
    }
    async step(stage, count = 1, force = false) {
        this.charge(count);
        if (this.stage !== stage) {
            this.stage = stage;
            force = true;
        }
        if (!force && this.sinceYield < 128)
            return;
        this.check();
        await yieldTurn();
        this.checkpoints++;
        this.sinceYield = 0;
        await this.options.checkpoint?.({ stage, checkpoints: this.checkpoints, units: this.units });
        this.check();
    }
}
