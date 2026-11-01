import { randomUUID } from 'node:crypto';
import { setImmediate as yieldTurn } from 'node:timers/promises';
import type { Catalog } from './catalog.js';
import { CatalogError } from './types.js';
import { gitBlobHash, sha256 } from './extract.js';
import { readMapDocument } from './map-document.js';
import { typescriptFacts } from './code-typescript.js';
import { javaFacts } from './code-java.js';
import { codeAnalysisFingerprint, factRanges, verifyFactRanges } from './code-analysis-facts.js';
import { codeAnalysisLimits, type AnalysisLimits, type AnalysisRow, type AnalysisFile, type AnalysisUnit, type AnalysisPayload, type AnalysisSummary, type AnalysisFileSummary } from './code-analysis-types.js';

const predicate = "(lower(f.path) LIKE '%.ts' OR lower(f.path) LIKE '%.js' OR lower(f.path) LIKE '%.vue' OR lower(f.path) LIKE '%.java')";
const fileColumns = 'f.id,f.sourceId,bs.name AS sourceName,bs.revision,f.path,f.blob,f.contentHash,f.size,length(f.raw) AS storedBytes';
const fileJoins = 'FROM files f JOIN sources src ON src.id=f.sourceId JOIN build_sources bs ON bs.buildId=f.buildId AND bs.sourceId=f.sourceId';
const instances = new WeakSet<Catalog>();
function checked(condition: unknown): asserts condition {
  if (!condition) throw new CatalogError('CORRUPT_CODE_CHECKPOINT', 'Stored code analysis failed validation. Start a new inventory.', 409);
}
function inputHash(run: Pick<AnalysisRow, 'buildId' | 'fingerprint'>, file: AnalysisFile) {
  return sha256(JSON.stringify({ buildId: run.buildId, fingerprint: run.fingerprint, file }));
}
function checkpointHash(unit: AnalysisUnit) {
  return sha256(JSON.stringify([unit.runId, unit.fileId, unit.ordinal, unit.inputHash, unit.status, unit.reason,
    unit.inputBytes, unit.payloadBytes, unit.gapCount, unit.payloadHash]));
}

/** Disposable derived inventory. Original source evidence remains authoritative. */
export class CodeAnalysis {
  readonly fingerprint = codeAnalysisFingerprint();
  readonly limits: AnalysisLimits;
  private worker: { id: string; done: Promise<void> } | undefined;
  private stopping = false;
  constructor(readonly catalog: Catalog, limits: Partial<AnalysisLimits> = {}) {
    this.limits = { ...codeAnalysisLimits, ...limits };
    for (const key of Object.keys(this.limits) as (keyof AnalysisLimits)[]) {
      if (!Number.isSafeInteger(this.limits[key]) || this.limits[key] < 0 || this.limits[key] > codeAnalysisLimits[key]) {
        throw new CatalogError('INVALID_LIMIT', 'Code analysis limits may only reduce the default bounds.');
      }
    }
    if (instances.has(catalog)) throw new CatalogError('BUSY', 'This catalog already has a code analysis service.', 409);
    instances.add(catalog);
  }
  private get store() { return this.catalog.store; }
  private row(id: string) {
    const row = this.store.one<AnalysisRow>('SELECT * FROM code_analyses WHERE id=?', id);
    if (!row) throw new CatalogError('NOT_FOUND', 'This code inventory is unavailable or was evicted.', 404);
    return row;
  }
  private authorize(row: AnalysisRow) {
    const project = this.store.project();
    if (row.status === 'fenced' || project.policyVersion !== row.policyVersion || project.sourceSetVersion !== row.registryVersion) {
      throw new CatalogError('ANALYSIS_FENCED', 'Sources or policy changed. Start a new code inventory.', 409);
    }
    this.catalog.readBuild(row.buildId);
    if (row.fingerprint !== this.fingerprint) throw new CatalogError('PARSER_CHANGED', 'The code parser changed. Start a new inventory.', 409);
    checked(row.limits === JSON.stringify(this.limits));
  }
  private metadata(row: AnalysisRow, fileId: string) {
    const file = this.store.one<AnalysisFile>(`SELECT ${fileColumns} ${fileJoins}
      WHERE f.id=? AND f.buildId=? AND f.status='indexed' AND src.status='active' AND ${predicate}`, fileId, row.buildId);
    checked(file); return file;
  }
  private document(row: AnalysisRow, file: AnalysisFile) {
    checked(Number.isSafeInteger(file.size) && file.size > 0 && Number.isSafeInteger(file.storedBytes) && file.storedBytes === file.size
      && file.size <= this.limits.fileBytes);
    const issued = this.store.all<{ id: string }>('SELECT id FROM spans WHERE fileId=? ORDER BY startLine LIMIT ?', file.id, this.limits.fileSpans + 1);
    checked(issued.length <= this.limits.fileSpans);
    const document = readMapDocument(this.catalog, row.buildId, file, issued);
    checked(gitBlobHash(document.raw, file.blob) === file.blob);
    return document;
  }
  get(id: string): AnalysisSummary {
    const row = this.row(id);
    const counts = this.store.all<{ status: AnalysisUnit['status']; count: number }>('SELECT status,count(*) count FROM code_analysis_files WHERE runId=? GROUP BY status', id);
    const coverage = this.store.one<{ gaps: number; filesWithGaps: number; examined: number }>(`SELECT coalesce(sum(gapCount),0) gaps,
      count(CASE WHEN gapCount>0 THEN 1 END) filesWithGaps,count(CASE WHEN inputBytes>0 THEN 1 END) examined FROM code_analysis_files WHERE runId=?`, id)!;
    return { id: row.id, buildId: row.buildId, status: row.status, published: Boolean(row.published), createdAt: row.createdAt, reason: row.reason,
      candidates: row.candidates, counts: Object.fromEntries(counts.map(item => [item.status, item.count])), ...coverage,
      textBytes: row.textBytes, payloadBytes: row.payloadBytes, elapsedMs: row.elapsedMs, limits: JSON.parse(row.limits) as AnalysisLimits,
      fingerprint: row.fingerprint, currentParser: row.fingerprint === this.fingerprint,
      staleIndex: this.store.buildRow(row.buildId).sourceSetVersion !== this.store.project().sourceSetVersion };
  }
  list() { return this.store.all<{ id: string }>('SELECT id FROM code_analyses ORDER BY rowid DESC').map(row => this.get(row.id)); }
  files(id: string, offset = 0) {
    const row = this.row(id); this.authorize(row);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset >= Math.max(1, row.candidates) || offset % 50) throw new CatalogError('INVALID_PAGE', 'Choose an available code-file page.');
    return this.store.all<AnalysisFileSummary>(
      `SELECT u.fileId,f.sourceId,bs.name sourceName,f.path,u.status,u.reason,u.gapCount FROM code_analysis_files u JOIN files f ON f.id=u.fileId
      JOIN build_sources bs ON bs.buildId=f.buildId AND bs.sourceId=f.sourceId WHERE u.runId=? ORDER BY u.ordinal LIMIT 50 OFFSET ?`, id, offset);
  }
  private validateUnit(row: AnalysisRow, unit: AnalysisUnit): AnalysisPayload | undefined {
    const file = this.metadata(row, unit.fileId); checked(unit.inputHash === inputHash(row, file));
    if (unit.status === 'pending') {
      checked(unit.checkpointHash === null && unit.payload === null && unit.payloadHash === null && !unit.inputBytes && !unit.payloadBytes && !unit.gapCount && unit.reason === null);
      return;
    }
    checked(checkpointHash(unit) === unit.checkpointHash && Number.isSafeInteger(unit.inputBytes) && unit.inputBytes >= 0
      && Number.isSafeInteger(unit.payloadBytes) && unit.payloadBytes >= 0 && Number.isSafeInteger(unit.gapCount) && unit.gapCount >= 0);
    if (unit.status !== 'parsed') { checked(unit.payload === null && unit.payloadHash === null && unit.payloadBytes === 0
      && (unit.inputBytes === 0 || unit.inputBytes === file.size)); return; }
    checked(unit.payload && Buffer.byteLength(unit.payload) === unit.payloadBytes && unit.payloadBytes <= this.limits.filePayloadBytes
      && sha256(unit.payload) === unit.payloadHash && unit.inputBytes === file.size);
    let payload: AnalysisPayload;
    try { payload = JSON.parse(unit.payload) as AnalysisPayload; } catch { checked(false); }
    checked(payload && typeof payload === 'object');
    const document = this.document(row, file);
    const identity = this.payloadIdentity(row, unit, file);
    for (const key of Object.keys(identity) as (keyof typeof identity)[]) checked(payload[key] === identity[key]);
    checked(JSON.stringify(payload.evidence) === JSON.stringify(document.refs));
    verifyFactRanges(document.content, payload.facts, payload.ranges); checked(unit.gapCount === payload.facts.gaps.length);
    return payload;
  }
  file(id: string, fileId: string) {
    const row = this.row(id); this.authorize(row);
    if (!row.published) throw new CatalogError('NOT_READY', 'Finish code analysis before reading its facts.', 409);
    const unit = this.store.one<AnalysisUnit>('SELECT * FROM code_analysis_files WHERE runId=? AND fileId=?', id, fileId);
    if (!unit || unit.status !== 'parsed') throw new CatalogError('NOT_FOUND', 'This file has no retained code facts.', 404);
    return this.validateUnit(row, unit)!;
  }
  private payloadIdentity(row: AnalysisRow, unit: AnalysisUnit, file: AnalysisFile) {
    return { schemaVersion: 'loredock-file-facts/1' as const, inputHash: unit.inputHash, fingerprint: row.fingerprint, buildId: row.buildId,
      fileId: file.id, sourceId: file.sourceId, sourceName: file.sourceName, revision: file.revision, path: file.path, blob: file.blob, contentHash: file.contentHash };
  }
  start(requestId: string, buildId: string) {
    if (this.stopping) throw new CatalogError('STOPPING', 'Code analysis is stopping.', 409);
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(requestId)) throw new CatalogError('INVALID_REQUEST', 'A valid code analysis request ID is required.');
    this.catalog.readBuild(buildId); const project = this.store.project();
    const payloadHash = sha256(JSON.stringify({ buildId, policyVersion: project.policyVersion, registryVersion: project.sourceSetVersion, fingerprint: this.fingerprint, limits: this.limits }));
    const previous = this.store.one<AnalysisRow>('SELECT * FROM code_analyses WHERE requestId=?', requestId);
    if (previous) {
      if (previous.payloadHash !== payloadHash) throw new CatalogError('CONFLICT', 'This request ID has different code analysis inputs.', 409);
      this.authorize(previous); return this.get(previous.id);
    }
    const id = this.store.transaction(() => {
      if (this.store.one("SELECT id FROM code_analyses WHERE status='running'") || this.worker) throw new CatalogError('BUSY', 'Pause or cancel the active code inventory first.', 409);
      const files = this.store.all<AnalysisFile>(`SELECT ${fileColumns} ${fileJoins} WHERE f.buildId=? AND src.status='active' AND f.status='indexed'
        AND ${predicate} ORDER BY bs.rowid,f.path LIMIT ?`, buildId, codeAnalysisLimits.documents + 1);
      if (files.length > codeAnalysisLimits.documents) throw new CatalogError('ANALYSIS_LIMIT', 'The index exceeds the bounded code inventory.', 409);
      const id = randomUUID(), identity = { buildId, fingerprint: this.fingerprint };
      const units = files.map(file => ({ fileId: file.id, inputHash: inputHash(identity, file) }));
      const keep = this.store.one<{ id: string }>('SELECT id FROM code_analyses WHERE published=1 ORDER BY rowid DESC LIMIT 1');
      this.store.run('DELETE FROM code_analyses WHERE id<>?', keep?.id ?? '');
      this.store.run(`INSERT INTO code_analyses (id,requestId,payloadHash,buildId,policyVersion,registryVersion,fingerprint,limits,manifestHash,candidates,status,createdAt)
        VALUES (?,?,?,?,?,?,?,?,?,?,'running',?)`, id, requestId, payloadHash, buildId, project.policyVersion, project.sourceSetVersion,
        this.fingerprint, JSON.stringify(this.limits), sha256(JSON.stringify(units)), files.length, new Date().toISOString());
      this.store.run(`INSERT INTO code_analysis_sources SELECT ?,bs.sourceId FROM build_sources bs JOIN sources s ON s.id=bs.sourceId WHERE bs.buildId=? AND s.status='active'`, id, buildId);
      units.forEach((unit, ordinal) => this.store.run('INSERT INTO code_analysis_files (runId,fileId,ordinal,inputHash) VALUES (?,?,?,?)', id, unit.fileId, ordinal, unit.inputHash));
      return id;
    });
    this.schedule(id); return this.get(id);
  }
  control(id: string, action: 'pause' | 'resume' | 'cancel') {
    if (!['pause', 'resume', 'cancel'].includes(action)) throw new CatalogError('INVALID_ACTION', 'Unknown code analysis action.');
    const row = this.row(id);
    if (action === 'pause' && row.status === 'running') this.store.run("UPDATE code_analyses SET status='paused',reason='Paused between files.' WHERE id=?", id);
    else if (action === 'cancel' && ['running', 'paused', 'interrupted'].includes(row.status)) this.store.run("UPDATE code_analyses SET status='cancelled',reason='Cancelled by the user.' WHERE id=?", id);
    else if (action === 'resume') {
      if (this.stopping) throw new CatalogError('STOPPING', 'Code analysis is stopping.', 409);
      if (row.status === 'running') return this.get(id);
      if (!['paused', 'interrupted'].includes(row.status)) throw new CatalogError('CONFLICT', 'Only paused or interrupted code analysis can resume.', 409);
      this.authorize(row);
      if (this.store.one("SELECT id FROM code_analyses WHERE status='running'")) throw new CatalogError('BUSY', 'Another code inventory is running.', 409);
      const validationStarted = performance.now();
      const units = this.store.all<AnalysisUnit>('SELECT * FROM code_analysis_files WHERE runId=? ORDER BY ordinal', id);
      checked(units.length === row.candidates && units.every((unit, index) => unit.ordinal === index)
        && sha256(JSON.stringify(units.map(({ fileId, inputHash }) => ({ fileId, inputHash })))) === row.manifestHash);
      for (const unit of units) this.validateUnit(row, unit);
      checked(units.reduce((sum, unit) => sum + unit.inputBytes, 0) === row.textBytes && row.textBytes <= this.limits.textBytes
        && units.reduce((sum, unit) => sum + unit.payloadBytes, 0) === row.payloadBytes && row.payloadBytes <= this.limits.payloadBytes
        && Number.isFinite(row.elapsedMs) && row.elapsedMs >= 0);
      this.store.run("UPDATE code_analyses SET status='running',reason=NULL,elapsedMs=elapsedMs+? WHERE id=?", performance.now() - validationStarted, id); this.schedule(id);
    }
    return this.get(id);
  }
  private schedule(id: string) {
    if (this.worker || this.stopping) return;
    const done = Promise.resolve().then(() => this.run(id)).catch(error => {
      if (this.row(id).status === 'running') this.store.run("UPDATE code_analyses SET status='failed',reason=? WHERE id=?", `Code analysis failed: ${error instanceof Error ? error.message.slice(0, 1024) : 'Unknown error.'}`, id);
    }).finally(() => {
      this.worker = undefined;
      // An explicit resume can race with the previous worker's final cleanup.
      if (!this.stopping && this.row(id).status === 'running') this.schedule(id);
    });
    this.worker = { id, done };
  }
  async idle() { while (this.worker) await this.worker.done; }
  async stop() {
    if (this.stopping) { await this.idle(); return; }
    this.stopping = true;
    if (this.worker && this.row(this.worker.id).status === 'running') this.store.run("UPDATE code_analyses SET status='interrupted',reason='The daemon stopped. Resume code analysis explicitly.' WHERE id=?", this.worker.id);
    await this.idle(); instances.delete(this.catalog);
  }
  private async run(id: string) {
    const begin = performance.now(), elapsed = this.row(id).elapsedMs;
    for (;;) {
      const row = this.row(id); if (row.status !== 'running') return; this.authorize(row);
      const unit = this.store.one<AnalysisUnit>("SELECT * FROM code_analysis_files WHERE runId=? AND status='pending' ORDER BY ordinal LIMIT 1", id);
      if (!unit) {
        const partial = this.store.one("SELECT fileId FROM code_analysis_files WHERE runId=? AND (status<>'parsed' OR gapCount>0) LIMIT 1", id)
          || this.catalog.readBuild(row.buildId).status === 'partial';
        this.store.run('UPDATE code_analyses SET status=?,published=1,elapsedMs=?,reason=? WHERE id=? AND status=\'running\'',
          partial ? 'partial' : 'completed', elapsed + performance.now() - begin, partial ? 'Source or code coverage gaps remain.' : null, id); return;
      }
      let reason = elapsed + performance.now() - begin >= this.limits.wallMs ? 'wall-time-limit'
        : unit.ordinal >= this.limits.documents ? 'document-limit' : null;
      if (reason) {
        this.store.transaction(() => {
          for (const pending of this.store.all<AnalysisUnit>("SELECT * FROM code_analysis_files WHERE runId=? AND status='pending'", id)) {
            this.save({ ...pending, status: 'unattempted', reason }, elapsed + performance.now() - begin);
          }
        }); continue;
      }
      let result = { ...unit };
      try {
        const file = this.metadata(row, unit.fileId); checked(inputHash(row, file) === unit.inputHash);
        checked(Number.isSafeInteger(file.size) && file.size > 0 && file.size === file.storedBytes);
        const spans = this.store.one<{ count: number }>('SELECT count(*) count FROM spans WHERE fileId=?', file.id)!.count;
        if (file.size > this.limits.fileBytes) result = { ...unit, status: 'excluded', reason: 'file-byte-limit' };
        else if (spans > this.limits.fileSpans) result = { ...unit, status: 'excluded', reason: 'file-span-limit' };
        else if (row.textBytes + file.size > this.limits.textBytes) reason = 'input-byte-limit';
        else {
          const document = this.document(row, file);
          result.inputBytes = document.raw.length;
          const facts = file.path.endsWith('.java') ? javaFacts(document.content) : typescriptFacts(document.content, file.path);
          const ranges = factRanges(document.content, facts);
          const payload = JSON.stringify({ ...this.payloadIdentity(row, unit, file), facts, ranges, evidence: document.refs } satisfies AnalysisPayload);
          const bytes = Buffer.byteLength(payload); result.gapCount = facts.gaps.length;
          if (bytes > this.limits.filePayloadBytes) result = { ...result, status: 'omitted', reason: 'file-payload-limit' };
          else if (row.payloadBytes + bytes > this.limits.payloadBytes) { result = { ...result, status: 'omitted', reason: 'payload-limit' }; reason = 'payload-limit'; }
          else result = { ...result, status: 'parsed', payload, payloadHash: sha256(payload), payloadBytes: bytes };
        }
      } catch (error) {
        result = { ...unit, status: 'failed', inputBytes: result.inputBytes, reason: error instanceof CatalogError ? error.code : 'CODE_EXTRACTION_FAILED' };
      }
      this.store.transaction(() => {
        this.authorize(this.row(id));
        if (reason === 'input-byte-limit') result = { ...result, status: 'unattempted', reason };
        this.save(result, elapsed + performance.now() - begin);
        if (reason) for (const pending of this.store.all<AnalysisUnit>("SELECT * FROM code_analysis_files WHERE runId=? AND status='pending'", id)) {
          this.save({ ...pending, status: 'unattempted', reason }, elapsed + performance.now() - begin);
        }
      });
      await yieldTurn();
    }
  }
  /** Caller owns the transaction: file state and cumulative counters publish together. */
  private save(unit: AnalysisUnit, elapsedMs: number) {
    const saved = this.store.run(`UPDATE code_analysis_files SET status=?,reason=?,inputBytes=?,payloadBytes=?,gapCount=?,payload=?,payloadHash=?,checkpointHash=? WHERE runId=? AND fileId=? AND status='pending'`,
      unit.status, unit.reason, unit.inputBytes, unit.payloadBytes, unit.gapCount, unit.payload, unit.payloadHash, checkpointHash(unit), unit.runId, unit.fileId);
    checked(saved.changes === 1);
    this.store.run('UPDATE code_analyses SET elapsedMs=?,textBytes=textBytes+?,payloadBytes=payloadBytes+? WHERE id=?', elapsedMs, unit.inputBytes, unit.payloadBytes, unit.runId);
  }
}
