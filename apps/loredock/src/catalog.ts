import { setImmediate as yieldTurn } from 'node:timers/promises';
import path from 'node:path';
import { SourceRegistration } from './source-registration.js';
import { baselineOrder, share, type Allocation } from './allocation.js';
import { SourceGit } from './git.js';
import { exclusion, extract, extractorVersion, gitBlobHash, sha256 } from './extract.js';
import { readCheckpoint } from './checkpoint.js';
import { CatalogStore, defaults, type FileRow } from './store.js';
import { CatalogError, type Evidence, type Policy, type ProjectState, type SearchHit, type SearchResult } from './types.js';

const active = ['preparing', 'running', 'pause_requested'];
export class Catalog {
  private readonly workers = new Map<string, { controller: AbortController; done: Promise<void> }>();
  readonly limits: typeof defaults;
  private stopping = false;
  private readonly boundaryListeners = new Set<() => void>();
  onBoundaryChange(listener: () => void) { this.boundaryListeners.add(listener); return () => this.boundaryListeners.delete(listener); }
  private boundaryChanged() { for (const listener of this.boundaryListeners) listener(); }
  constructor(readonly store: CatalogStore, private readonly git = new SourceGit(), limits: Partial<typeof defaults> = {}) {
    this.limits = { ...defaults, ...limits, sources: defaults.sources };
    store.purge();
  }
  state(): ProjectState {
    const project = this.store.project();
    return { name: 'My system', ...project, policy: JSON.parse(project.policy) as Policy, sources: this.store.sources(),
      builds: this.store.all<{ id: string }>('SELECT id FROM builds ORDER BY rowid DESC LIMIT 20').map(row => this.store.build(row.id)), limits: this.limits };
  }
  async addSource(value: string) {
    const identity = await this.git.identity(value, new AbortController().signal);
    if (identity.path === this.store.directory || identity.path.startsWith(this.store.directory + path.sep)) throw new CatalogError('INVALID_PATH', 'Sources must be outside the LoreDock data directory.');
    const source = this.store.addSource(identity); this.boundaryChanged(); return source;
  }
  previewSources(paths: unknown) { return new SourceRegistration(this.store, this.git).preview(paths); }
  async registerSources(input: Record<string, unknown>) {
    const receipt = await new SourceRegistration(this.store, this.git).register(input); this.boundaryChanged(); return receipt;
  }
  start(requestId: string, sourceSetVersion: number, policyVersion: number) {
    const build = this.store.start(requestId, sourceSetVersion, policyVersion, this.limits);
    if (['preparing', 'running'].includes(build.status)) this.schedule(build.id);
    return this.store.build(build.id);
  }
  control(id: string, action: string) {
    const build = this.store.buildRow(id);
    if (action === 'cancel') {
      if ([...active, 'paused', 'interrupted'].includes(build.status)) this.store.run("UPDATE builds SET status='cancelled',reason='Cancelled by the user.' WHERE id=?", id);
      this.workers.get(id)?.controller.abort();
    } else if (action === 'pause') {
      if (['preparing', 'running'].includes(build.status)) this.store.run("UPDATE builds SET status='pause_requested',reason='Finishing the current unit.' WHERE id=?", id);
    } else if (action === 'resume') {
      if (active.includes(build.status)) return this.store.build(id);
      if (!['paused', 'interrupted'].includes(build.status)) throw new CatalogError('CONFLICT', 'Only a paused or interrupted index can be resumed.', 409);
      if (build.extractorVersion !== extractorVersion) throw new CatalogError('EXTRACTOR_CHANGED', 'The extractor changed. Cancel and start a new index.', 409);
      if (build.policyVersion !== this.store.project().policyVersion || this.store.buildSources(id).some(source => this.store.source(source.sourceId).status !== 'active')) throw new CatalogError('CONFLICT', 'Inputs are no longer authorized. Start a new index.', 409);
      const allocation = build.allocation ? JSON.parse(build.allocation) as Allocation : null;
      if (allocation && (allocation.paths > this.limits.paths || allocation.bytes > this.limits.totalBytes)) throw new CatalogError('LIMIT_CHANGED', 'Current limits are below this index allocation. Cancel and index again.', 409);
      const inventoried = this.store.one<{ count: number }>('SELECT count(*) AS count FROM files WHERE buildId=?', id)!.count;
      if (inventoried > this.limits.paths || this.store.coverage(id).bytes > this.limits.totalBytes) throw new CatalogError('LIMIT_CHANGED', 'Current limits do not cover this checkpoint. Cancel and index again.', 409);
      for (const file of this.store.all<{ id: string }>("SELECT id FROM files WHERE buildId=? AND status='indexed'", id)) readCheckpoint(this.store, file.id, this.limits.fileBytes);
      this.store.run("UPDATE builds SET status='preparing',reason=NULL WHERE id=?", id);
      // A paused worker may still be unwinding its finally block.
      const previous = this.workers.get(id);
      if (previous) void previous.done.then(() => this.schedule(id)); else this.schedule(id);
    } else throw new CatalogError('INVALID_ACTION', 'Unknown index action.');
    return this.store.build(id);
  }
  updatePolicy(value: unknown) { this.store.updatePolicy(value); this.abortInvalidWorkers(); this.boundaryChanged(); }
  revoke(id: string) { this.store.revoke(id); this.abortInvalidWorkers(); this.boundaryChanged(); this.store.purge(); }
  private abortInvalidWorkers() { for (const [id, worker] of this.workers) if (!this.store.writable(id)) worker.controller.abort(); }
  private schedule(id: string) {
    if (this.stopping || this.workers.has(id)) return;
    const controller = new AbortController();
    const done = this.run(id, controller.signal).catch(error => {
      if (active.includes(this.store.buildRow(id).status)) this.store.run("UPDATE builds SET status='failed',reason=? WHERE id=?", error instanceof Error ? error.message.slice(0, 2048) : 'Indexing failed.', id);
    }).finally(() => this.workers.delete(id));
    this.workers.set(id, { controller, done });
  }
  async idle() { await Promise.all([...this.workers.values()].map(worker => worker.done)); }
  async stop() {
    this.stopping = true;
    for (const [id, worker] of this.workers) {
      if (active.includes(this.store.buildRow(id).status)) this.store.run("UPDATE builds SET status='interrupted',reason='The daemon stopped. Resume explicitly.' WHERE id=?", id);
      worker.controller.abort();
    }
    await this.idle();
  }
  private checkpoint(id: string, deadline: number): boolean {
    const build = this.store.buildRow(id);
    if (!active.includes(build.status)) return false;
    if (build.status === 'pause_requested' || Date.now() >= deadline) {
      this.store.run("UPDATE builds SET status='paused',reason=? WHERE id=?", build.status === 'pause_requested' ? 'Paused at a durable checkpoint.' : 'Wall-time budget reached. Resume explicitly.', id);
      return false;
    }
    return this.store.writable(id);
  }
  private async run(id: string, signal: AbortSignal) {
    await yieldTurn();
    const deadline = Date.now() + this.limits.wallMs;
    const sources = this.store.buildSources(id);
    const recorded = this.store.buildRow(id).allocation;
    const allocation = recorded ? JSON.parse(recorded) as Allocation : null;
    for (const [index, source] of sources.entries()) {
      if (!this.checkpoint(id, deadline)) return;
      if (source.status !== 'pending') continue;
      try {
        if (!source.revision) {
          const snapshot = await this.git.snapshot(source, signal);
          if (!this.store.writable(id)) return;
          this.store.run('UPDATE build_sources SET revision=?,tree=?,dirty=? WHERE buildId=? AND sourceId=?', snapshot.revision, snapshot.tree, Number(snapshot.dirty), id, source.sourceId);
          source.revision = snapshot.revision;
        }
        const entries = await this.git.inventory(source, source.revision, signal);
        if (!this.store.writable(id)) return;
        const used = this.store.one<{ count: number }>('SELECT count(*) AS count FROM files WHERE buildId=?', id)!.count;
        const quota = allocation ? share(allocation.paths, sources.length, index) : this.limits.paths;
        if (allocation) entries.sort(baselineOrder);
        const admitted = entries.slice(0, Math.max(0, Math.min(quota, this.limits.paths - used)));
        this.store.inventory(id, source.sourceId, admitted, entries.length - admitted.length);
      } catch (error) {
        if (!this.store.writable(id)) return;
        this.store.run("UPDATE build_sources SET status='failed',error=? WHERE buildId=? AND sourceId=?", error instanceof Error ? error.message.slice(0, 2048) : 'Source inventory failed.', id, source.sourceId);
      }
    }
    if (!this.checkpoint(id, deadline)) return;
    this.store.run("UPDATE builds SET status='running' WHERE id=?", id);
    const policy = JSON.parse(this.store.buildRow(id).policy) as Policy;
    while (this.checkpoint(id, deadline)) {
      const file = this.store.one<FileRow>("SELECT * FROM files WHERE buildId=? AND status='pending' ORDER BY rowid LIMIT 1", id);
      if (!file) { this.store.publish(id); return; }
      const source = this.store.buildSources(id).find(source => source.sourceId === file.sourceId)!;
      const reason = exclusion(file, policy, this.limits.fileBytes);
      if (reason) this.store.finishFile(file, { reason });
      else if (this.store.coverage(id).bytes + file.size > this.limits.totalBytes) this.store.finishFile(file, { reason: 'total-byte-limit' });
      else if (allocation && this.store.coverage(id, file.sourceId).bytes + file.size > share(allocation.bytes, sources.length, sources.findIndex(item => item.sourceId === file.sourceId))) this.store.finishFile(file, { reason: 'source-byte-limit' });
      else {
        if (this.reuse(file)) { await yieldTurn(); continue; }
        this.store.run("UPDATE files SET gitReadAttempts=gitReadAttempts+1 WHERE id=? AND status='pending'", file.id);
        try {
          const bytes = await this.git.blob(source, file.blob, signal, this.limits.fileBytes);
          if (bytes.length !== file.size || gitBlobHash(bytes, file.blob) !== file.blob) throw new Error('Git blob size or hash changed.');
          const result = extract(bytes, file.path);
          this.store.finishFile(file, 'reason' in result ? result : { ...result, raw: bytes });
        } catch (error) {
          this.store.finishFile(file, { reason: 'read-failed', status: 'failed', error: error instanceof Error ? error.message.slice(0, 2048) : 'File read failed.' });
        }
      }
      await yieldTurn();
    }
  }
  private reuse(file: FileRow): boolean {
    const build = this.store.buildRow(file.buildId);
    if (!build.baselineBuildId) return false;
    const previous = this.store.one<{ id: string }>(`SELECT f.id FROM files f JOIN builds b ON b.id=f.buildId JOIN sources s ON s.id=f.sourceId
      WHERE f.buildId=? AND f.sourceId=? AND f.path=? AND f.mode=? AND f.blob=? AND f.size=? AND f.status='indexed'
      AND s.status='active' AND b.published=1 AND b.policyVersion=? AND b.policy=? AND b.extractorVersion=?`,
      build.baselineBuildId, file.sourceId, file.path, file.mode, file.blob, file.size, build.policyVersion, build.policy, build.extractorVersion);
    if (!previous) return false;
    let cached: ReturnType<typeof readCheckpoint>;
    try { cached = readCheckpoint(this.store, previous.id, this.limits.fileBytes); }
    catch (error) {
      if (!(error instanceof CatalogError) || error.code !== 'CORRUPT_CHECKPOINT') throw error;
      this.store.run("UPDATE files SET cacheRejected=1 WHERE id=? AND status='pending'", file.id); return false;
    }
    // Keep publication outside the cache-validation catch: DB failures must not become cache misses.
    this.store.finishFile(file, cached, previous.id); return true;
  }
  /** Authorize immutable index metadata without recomputing aggregate coverage per file. */
  readBuildHeader(id: string) {
    const build = this.store.buildRow(id);
    if (!build.published) throw new CatalogError('NOT_READY', 'This index has not been published.', 409);
    if (build.policyVersion !== this.store.project().policyVersion) throw new CatalogError('POLICY_CHANGED', 'This index uses an old policy. Index sources again.', 409);
    return build;
  }
  readBuild(buildId?: string) {
    const id = buildId ?? this.store.project().publishedBuildId;
    if (!id) throw new CatalogError('NOT_READY', 'Index sources before exploring the system map.', 409);
    this.readBuildHeader(id); return this.store.build(id);
  }
  search(query: string, buildId?: string): SearchResult {
    if (!query.trim() || query.length > 500) throw new CatalogError('INVALID_QUERY', 'Enter between 1 and 500 characters.');
    const id = buildId ?? this.store.project().publishedBuildId;
    if (!id) throw new CatalogError('NOT_READY', 'Index sources before searching.', 409);
    const build = this.readBuildHeader(id);
    // Literal terms only; user punctuation cannot become FTS operators or SQL.
    const terms = query.trim().split(/\s+/).slice(0, 20).map(term => '"' + term.replaceAll('"', '""') + '"').join(' AND ');
    const hits = this.store.all<SearchHit>(`SELECT s.id,f.sourceId,bs.name AS sourceName,bs.revision,f.path,s.startLine,s.endLine,
      substr(snippet(search,1,'','','…',24),1,400) AS snippet FROM search JOIN spans s ON s.id=search.spanId JOIN files f ON f.id=s.fileId
      JOIN sources src ON src.id=f.sourceId JOIN build_sources bs ON bs.buildId=f.buildId AND bs.sourceId=f.sourceId
      WHERE search MATCH ? AND f.buildId=? AND src.status='active' AND f.status='indexed' ORDER BY rank LIMIT 30`, terms, id);
    return { buildId: id, partial: build.status === 'partial', stale: build.sourceSetVersion !== this.store.project().sourceSetVersion, hits };
  }
  evidence(id: string): Evidence {
    const row = this.store.one<Evidence & { raw: Uint8Array; metadata: string; sourceStatus: string }>(`SELECT s.id,f.sourceId,bs.name AS sourceName,bs.revision,f.path,s.startLine,s.endLine,
      '' AS snippet, f.buildId,f.contentHash,s.hash AS spanHash,f.blob AS blobId,s.text,f.raw,f.metadata,src.status AS sourceStatus
      FROM spans s JOIN files f ON f.id=s.fileId JOIN sources src ON src.id=f.sourceId
      JOIN build_sources bs ON bs.buildId=f.buildId AND bs.sourceId=f.sourceId WHERE s.id=? AND f.status='indexed'`, id);
    if (!row || row.sourceStatus !== 'active') throw new CatalogError('NOT_FOUND', 'This evidence is unavailable or revoked.', 404);
    this.readBuildHeader(row.buildId);
    if (sha256(Buffer.from(row.raw)) !== row.contentHash || sha256(row.text) !== row.spanHash) throw new CatalogError('CORRUPT_EVIDENCE', 'Stored evidence failed its integrity check.', 409);
    const lines = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(row.raw).replaceAll('\r\n', '\n').split('\n');
    if (row.startLine < 1 || row.endLine < row.startLine || row.endLine > lines.length || lines.slice(row.startLine - 1, row.endLine).join('\n') !== row.text) throw new CatalogError('CORRUPT_EVIDENCE', 'Stored evidence does not match its source range.', 409);
    const { raw: _raw, sourceStatus: _status, metadata, ...evidence } = row;
    return { ...evidence, metadata: JSON.parse(metadata) as Record<string, unknown> };
  }
  files(id: string) {
    const build = this.store.buildRow(id);
    if (build.policyVersion !== this.store.project().policyVersion) throw new CatalogError('POLICY_CHANGED', 'File details are fenced by the current policy.', 409);
    return this.store.all<{ path: string; status: string; reason: string | null; error: string | null }>(
      `SELECT f.path,f.status,f.reason,f.error FROM files f JOIN sources s ON s.id=f.sourceId WHERE f.buildId=? AND s.status='active' AND f.status IN ('excluded','failed') ORDER BY f.rowid LIMIT 100`, id);
  }
}
