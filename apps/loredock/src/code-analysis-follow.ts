import type { CodeAnalysis } from './code-analysis.js';
import type { AnalysisState } from './code-analysis-types.js';
import { sha256 } from './extract.js';
import { CatalogError } from './types.js';

/** Observe new publications independently of browser sessions; never resume an old attempt. */
export class CodeAnalysisFollow {
  private observed: string | null;
  private pending: string | null = null;
  private error: AnalysisState['automaticError'] = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  private stopped = false;
  constructor(readonly analysis: CodeAnalysis) { this.observed = analysis.catalog.store.project().publishedBuildId; }
  start() { if (!this.timer && !this.stopped) { this.timer = setInterval(() => this.tick(), 500); this.timer.unref(); } }
  stop() { this.stopped = true; clearInterval(this.timer); this.timer = undefined; this.pending = null; }
  state(): AnalysisState {
    const inventories = this.analysis.list(), project = this.analysis.catalog.store.project();
    const errorBuild = this.error ? this.analysis.catalog.store.one<{ policyVersion: number; sourceSetVersion: number }>('SELECT policyVersion,sourceSetVersion FROM builds WHERE id=?', this.error.buildId) : null;
    const error = this.error && project.publishedBuildId === this.error.buildId
      && (!errorBuild || (errorBuild.policyVersion === project.policyVersion && errorBuild.sourceSetVersion === project.sourceSetVersion))
      && !inventories.some(run => run.buildId === this.error!.buildId && run.currentParser && run.status !== 'fenced') ? this.error : null;
    return { inventories, pendingBuildId: this.pending, automaticError: error };
  }
  tick() {
    if (this.stopped) return;
    const project = this.analysis.catalog.store.project();
    if (project.publishedBuildId !== this.observed) {
      this.observed = project.publishedBuildId; this.pending = this.observed; this.error = null;
    }
    if (!this.pending) return;
    const buildId = this.pending;
    try {
      const build = this.analysis.catalog.store.buildRow(buildId);
      if (!build.published || build.policyVersion !== project.policyVersion || build.sourceSetVersion !== project.sourceSetVersion) { this.pending = null; return; }
      const inventories = this.analysis.list();
      // A manual attempt already owns this publication, including a user stop or failure.
      if (inventories.some(run => run.buildId === buildId && run.currentParser && run.status !== 'fenced')) { this.pending = null; return; }
      if (inventories.some(run => run.status === 'running')) return;
      this.analysis.start('auto-' + sha256(JSON.stringify([buildId, this.analysis.fingerprint])), buildId);
      this.pending = null;
    } catch (error) {
      // The previous worker may be finishing after a user pause/cancel. No attempt was started.
      if (error instanceof CatalogError && error.code === 'BUSY') return;
      this.pending = null;
      this.error = { buildId, message: error instanceof Error ? error.message.slice(0, 1024) : 'Automatic code analysis could not start.' };
    }
  }
}
