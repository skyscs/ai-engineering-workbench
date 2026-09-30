import { randomUUID } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { CatalogError, type Build, type BuildSource, type BuildStatus, type Coverage, type Policy, type Source } from './types.js';
import type { RepositoryIdentity, TreeEntry } from './git.js';
import { safePath } from './git.js';
import { extractorVersion, sha256, spans } from './extract.js';
import { spanSearchText } from './search-text.js';

export const defaults = { sources: 3, paths: 10000, fileBytes: 1024 * 1024, totalBytes: 50 * 1024 * 1024, wallMs: 300000 };
export interface Project { policyVersion: number; sourceSetVersion: number; policy: string; publishedBuildId: string | null }
export interface BuildRow { id: string; requestId: string; payloadHash: string; status: BuildStatus; policyVersion: number; sourceSetVersion: number; policy: string; createdAt: string; reason: string | null; published: number; extractorVersion: string }
export interface BuildSourceRow { buildId: string; sourceId: string; name: string; path: string; gitDir: string; revision: string | null; tree: string | null; status: 'pending' | 'ready' | 'failed'; dirty: number | null; error: string | null; omitted: number }
export interface FileRow { id: string; buildId: string; sourceId: string; path: string; mode: string; blob: string; size: number; status: string; reason: string | null; error: string | null; contentHash: string | null; raw: Uint8Array | null; metadata: string }
const unfinished = ['preparing', 'running', 'pause_requested', 'paused', 'interrupted'];

export class CatalogStore {
  readonly db: DatabaseSync;
  readonly directory: string;
  private readonly owner: DatabaseSync;
  constructor(directory: string) {
    if (!path.isAbsolute(directory)) throw new Error('LoreDock data directory must be absolute.');
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.directory = realpathSync(directory);
    if (existsSync(path.join(this.directory, 'workbench.db'))) throw new Error('Use a separate LoreDock data directory.');
    for (const name of ['loredock.db', 'loredock.db-wal', 'loredock.db-shm', '.owner.db', '.owner.db-journal']) {
      const file = path.join(this.directory, name);
      try { const info = lstatSync(file); if (!info.isFile() || info.isSymbolicLink()) throw new Error('LoreDock data files must be regular files.'); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
    this.owner = new DatabaseSync(path.join(this.directory, '.owner.db'));
    try { this.owner.exec('PRAGMA busy_timeout=0; PRAGMA journal_mode=DELETE; BEGIN EXCLUSIVE;'); }
    catch { this.owner.close(); throw new Error('This LoreDock directory is already in use.'); }
    let opened: DatabaseSync | undefined;
    try {
      this.db = opened = new DatabaseSync(path.join(this.directory, 'loredock.db'));
      this.db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA secure_delete=ON;');
      const version = this.one<{ user_version: number }>('PRAGMA user_version')!.user_version;
      if (version < 0 || version > 3) throw new Error('Unsupported LoreDock database version.');
      if (!version) this.db.exec(`BEGIN IMMEDIATE;
        CREATE TABLE project (id INTEGER PRIMARY KEY CHECK(id=1), policyVersion INTEGER NOT NULL, sourceSetVersion INTEGER NOT NULL, policy TEXT NOT NULL, publishedBuildId TEXT);
        INSERT INTO project VALUES (1,1,1,'{"excludedPaths":[]}',NULL);
        CREATE TABLE sources (id TEXT PRIMARY KEY, name TEXT NOT NULL, path TEXT NOT NULL, gitDir TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('active','revoked')), purge TEXT NOT NULL CHECK(purge IN ('none','pending','completed')));
        CREATE UNIQUE INDEX active_identity ON sources(gitDir) WHERE status='active';
        CREATE TABLE builds (id TEXT PRIMARY KEY, requestId TEXT NOT NULL UNIQUE, payloadHash TEXT NOT NULL, status TEXT NOT NULL,
          policyVersion INTEGER NOT NULL, sourceSetVersion INTEGER NOT NULL, policy TEXT NOT NULL, createdAt TEXT NOT NULL, reason TEXT, published INTEGER NOT NULL DEFAULT 0, extractorVersion TEXT NOT NULL);
        CREATE TABLE build_sources (buildId TEXT NOT NULL REFERENCES builds(id), sourceId TEXT NOT NULL REFERENCES sources(id),
          name TEXT NOT NULL, path TEXT NOT NULL, gitDir TEXT NOT NULL, revision TEXT, tree TEXT, status TEXT NOT NULL DEFAULT 'pending',
          dirty INTEGER, error TEXT, omitted INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(buildId,sourceId));
        CREATE TABLE files (id TEXT PRIMARY KEY, buildId TEXT NOT NULL, sourceId TEXT NOT NULL, path TEXT NOT NULL, mode TEXT NOT NULL, blob TEXT NOT NULL,
          size INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', reason TEXT, error TEXT, contentHash TEXT, raw BLOB, metadata TEXT NOT NULL DEFAULT '{}',
          FOREIGN KEY(buildId,sourceId) REFERENCES build_sources(buildId,sourceId), UNIQUE(buildId,sourceId,path));
        CREATE INDEX file_units ON files(buildId,status);
        CREATE TABLE spans (id TEXT PRIMARY KEY, fileId TEXT NOT NULL REFERENCES files(id), startLine INTEGER NOT NULL, endLine INTEGER NOT NULL, text TEXT NOT NULL, hash TEXT NOT NULL);
        CREATE INDEX file_spans ON spans(fileId);
        CREATE VIRTUAL TABLE search USING fts5(spanId UNINDEXED, text);
        PRAGMA user_version=1; COMMIT;`);
      if (version < 2) this.transaction(() => {
        this.db.exec("CREATE VIRTUAL TABLE question_search USING fts5(spanId UNINDEXED, text, tokenize='porter unicode61');");
        for (const row of this.db.prepare("SELECT s.id,s.text,f.path FROM spans s JOIN files f ON f.id=s.fileId JOIN sources src ON src.id=f.sourceId WHERE f.status='indexed' AND src.status='active'").iterate()) {
          this.run('INSERT INTO question_search (spanId,text) VALUES (?,?)', row.id as string, spanSearchText(row.path as string, row.text as string));
        }
        this.db.exec('PRAGMA user_version=2');
      });
      if (version < 3) this.db.exec(`BEGIN IMMEDIATE;
        CREATE TABLE answer_settings (id INTEGER PRIMARY KEY CHECK(id=1), connection TEXT NOT NULL);
        CREATE TABLE answer_attempts (id TEXT PRIMARY KEY, requestId TEXT NOT NULL UNIQUE, payloadHash TEXT NOT NULL,
          question TEXT NOT NULL, buildId TEXT NOT NULL REFERENCES builds(id), policyVersion INTEGER NOT NULL, registryVersion INTEGER NOT NULL,
          status TEXT NOT NULL, context TEXT, inputHash TEXT NOT NULL, connection TEXT NOT NULL, runtime TEXT,
          model TEXT NOT NULL, effort TEXT NOT NULL, promptVersion TEXT NOT NULL, schemaVersion TEXT NOT NULL,
          result TEXT, usage TEXT, usageUnknownReason TEXT, reason TEXT, createdAt TEXT NOT NULL, dispatchedAt TEXT, completedAt TEXT);
        CREATE TABLE answer_sources (answerId TEXT NOT NULL REFERENCES answer_attempts(id), sourceId TEXT NOT NULL REFERENCES sources(id), PRIMARY KEY(answerId,sourceId));
        PRAGMA user_version=3; COMMIT;`);
      this.db.exec("UPDATE answer_attempts SET status='interrupted', reason='The daemon stopped. Start an explicit new attempt; provider completion may be unknown.', usageUnknownReason=CASE WHEN dispatchedAt IS NULL THEN 'Not dispatched before restart.' ELSE 'Provider completion and usage are unknown after restart.' END WHERE status IN ('preparing','running');");
      this.db.exec("UPDATE builds SET status='interrupted', reason='The daemon stopped. Resume explicitly.' WHERE status IN ('preparing','running','pause_requested');");
    } catch (error) { opened?.close(); this.owner.close(); throw error; }
  }
  one<T>(sql: string, ...args: SQLInputValue[]): T | undefined { return this.db.prepare(sql).get(...args) as T | undefined; }
  all<T>(sql: string, ...args: SQLInputValue[]): T[] { return this.db.prepare(sql).all(...args) as T[]; }
  run(sql: string, ...args: SQLInputValue[]) { return this.db.prepare(sql).run(...args); }
  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE;');
    try { const result = fn(); this.db.exec('COMMIT;'); return result; }
    catch (error) { this.db.exec('ROLLBACK;'); throw error; }
  }
  close() { try { this.db.close(); } finally { this.owner.close(); } }
  project(): Project { return this.one<Project>('SELECT * FROM project WHERE id=1')!; }
  sources() { return this.all<Source>('SELECT * FROM sources ORDER BY rowid'); }
  source(id: string): Source {
    const value = this.one<Source>('SELECT * FROM sources WHERE id=?', id);
    if (!value) throw new CatalogError('NOT_FOUND', 'Source not found.', 404);
    return value;
  }
  addSource(identity: RepositoryIdentity): Source {
    return this.transaction(() => {
      const active = this.sources().filter(source => source.status === 'active');
      const existing = active.find(source => source.gitDir === identity.gitDir);
      if (existing) return existing;
      if (active.length >= defaults.sources) throw new CatalogError('SOURCE_LIMIT', 'This pilot supports three active repositories. Revoke a source before adding another.');
      const id = randomUUID();
      this.run("INSERT INTO sources VALUES (?,?,?,?, 'active','none')", id, path.basename(identity.path), identity.path, identity.gitDir);
      this.run('UPDATE project SET sourceSetVersion=sourceSetVersion+1 WHERE id=1');
      return this.source(id);
    });
  }
  updatePolicy(value: unknown) {
    if (!Array.isArray(value) || value.length > 100 || !value.every(entry => typeof entry === 'string' && safePath(entry) && !entry.includes('*'))) throw new CatalogError('INVALID_POLICY', 'Use at most 100 relative paths or directory prefixes, without wildcards.');
    const policy: Policy = { excludedPaths: [...new Set(value as string[])].sort() };
    this.transaction(() => {
      if (JSON.stringify(policy) === this.project().policy) return;
      this.run('UPDATE project SET policy=?, policyVersion=policyVersion+1, publishedBuildId=NULL WHERE id=1', JSON.stringify(policy));
      this.run("UPDATE builds SET status='cancelled', reason='Source policy changed. Start a new index.' WHERE status IN ('preparing','running','pause_requested','paused','interrupted')");
    });
  }
  start(requestId: string, sourceSetVersion: number, policyVersion: number): BuildRow {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(requestId)) throw new CatalogError('INVALID_REQUEST', 'A valid request ID is required.');
    const payloadHash = sha256(JSON.stringify({ sourceSetVersion, policyVersion }));
    return this.transaction(() => {
      const previous = this.one<BuildRow>('SELECT * FROM builds WHERE requestId=?', requestId);
      if (previous) { if (previous.payloadHash !== payloadHash) throw new CatalogError('CONFLICT', 'This request ID was already used with different inputs.', 409); return previous; }
      const project = this.project();
      if (project.sourceSetVersion !== sourceSetVersion || project.policyVersion !== policyVersion) throw new CatalogError('CONFLICT', 'Sources or policy changed. Refresh before indexing.', 409);
      if (this.all<BuildRow>('SELECT * FROM builds').some(build => unfinished.includes(build.status))) throw new CatalogError('BUSY', 'Resume or cancel the unfinished index first.', 409);
      const sources = this.sources().filter(source => source.status === 'active');
      if (!sources.length) throw new CatalogError('NO_SOURCES', 'Add a local repository first.');
      const id = randomUUID();
      this.run("INSERT INTO builds (id,requestId,payloadHash,status,policyVersion,sourceSetVersion,policy,createdAt,extractorVersion) VALUES (?,?,?,'preparing',?,?,?,?,?)",
        id, requestId, payloadHash, policyVersion, sourceSetVersion, project.policy, new Date().toISOString(), extractorVersion);
      for (const source of sources) this.run('INSERT INTO build_sources (buildId,sourceId,name,path,gitDir) VALUES (?,?,?,?,?)', id, source.id, source.name, source.path, source.gitDir);
      return this.buildRow(id);
    });
  }
  buildRow(id: string): BuildRow {
    const value = this.one<BuildRow>('SELECT * FROM builds WHERE id=?', id);
    if (!value) throw new CatalogError('NOT_FOUND', 'Index not found.', 404);
    return value;
  }
  buildSources(id: string) { return this.all<BuildSourceRow>('SELECT * FROM build_sources WHERE buildId=? ORDER BY rowid', id); }
  writable(id: string) {
    const build = this.buildRow(id);
    return ['preparing', 'running', 'pause_requested'].includes(build.status) && build.policyVersion === this.project().policyVersion
      && !this.one("SELECT 1 FROM build_sources b JOIN sources s ON s.id=b.sourceId WHERE b.buildId=? AND s.status!='active'", id);
  }
  inventory(buildId: string, sourceId: string, entries: TreeEntry[], omitted: number) {
    this.transaction(() => {
      if (!this.writable(buildId)) return;
      for (const entry of entries) this.run('INSERT INTO files (id,buildId,sourceId,path,mode,blob,size) VALUES (?,?,?,?,?,?,?)', randomUUID(), buildId, sourceId, entry.path, entry.mode, entry.blob, entry.size);
      this.run("UPDATE build_sources SET status='ready', omitted=? WHERE buildId=? AND sourceId=?", omitted, buildId, sourceId);
    });
  }
  finishFile(file: FileRow, result: { reason: string; status?: string; error?: string } | { raw: Buffer; text: string; metadata: Record<string, unknown> }) {
    this.transaction(() => {
      if (!this.writable(file.buildId) || this.one<FileRow>('SELECT * FROM files WHERE id=?', file.id)?.status !== 'pending') return;
      if ('reason' in result) { this.run('UPDATE files SET status=?, reason=?, error=? WHERE id=?', result.status ?? 'excluded', result.reason, result.error ?? null, file.id); return; }
      const hash = sha256(result.raw);
      this.run("UPDATE files SET status='indexed', contentHash=?, raw=?, metadata=? WHERE id=?", hash, result.raw, JSON.stringify(result.metadata), file.id);
      for (const span of spans(result.text)) {
        const id = randomUUID();
        this.run('INSERT INTO spans VALUES (?,?,?,?,?,?)', id, file.id, span.startLine, span.endLine, span.text, sha256(span.text));
        this.run('INSERT INTO search (spanId,text) VALUES (?,?)', id, span.text);
        this.run('INSERT INTO question_search (spanId,text) VALUES (?,?)', id, spanSearchText(file.path, span.text));
      }
    });
  }
  coverage(id: string, sourceId?: string): Coverage {
    const records = this.all<{ status: string; reason: string | null; count: number; bytes: number }>(
      `SELECT status,reason,count(*) AS count,sum(size) AS bytes FROM files WHERE buildId=? ${sourceId ? 'AND sourceId=?' : ''} GROUP BY status,reason`, ...sourceId ? [id, sourceId] : [id]);
    const result: Coverage = { indexed: 0, excluded: 0, failed: 0, pending: 0, bytes: 0, reasons: {} };
    for (const record of records) {
      const key = record.status === 'purged' ? 'excluded' : record.status as 'indexed' | 'excluded' | 'failed' | 'pending';
      result[key] += record.count;
      if (record.status === 'indexed') result.bytes += record.bytes;
      if (record.reason) result.reasons[record.reason] = (result.reasons[record.reason] ?? 0) + record.count;
    }
    return result;
  }
  build(id: string): Build {
    const row = this.buildRow(id);
    const sources: BuildSource[] = this.buildSources(id).map(source => ({ sourceId: source.sourceId, name: source.name, revision: source.revision,
      tree: source.tree, status: source.status, dirty: source.dirty === null ? null : Boolean(source.dirty), error: source.error, omitted: source.omitted, coverage: this.coverage(id, source.sourceId) }));
    return { id, status: row.status, policyVersion: row.policyVersion, sourceSetVersion: row.sourceSetVersion, createdAt: row.createdAt,
      reason: row.reason, published: Boolean(row.published), sources, coverage: this.coverage(id), extractorVersion: row.extractorVersion };
  }
  publish(id: string) {
    this.transaction(() => {
      if (!this.writable(id) || this.buildRow(id).status !== 'running') return;
      const coverage = this.coverage(id), sources = this.buildSources(id);
      if (coverage.pending || sources.some(source => source.status === 'pending')) return;
      if (sources.every(source => source.status === 'failed') || (!coverage.indexed && coverage.failed)) {
        this.run("UPDATE builds SET status='failed',reason='No source content could be indexed. The previous published index is retained.' WHERE id=?", id);
        return;
      }
      const partial = coverage.excluded > 0 || coverage.failed > 0 || sources.some(source => source.status === 'failed' || source.omitted > 0);
      this.run('UPDATE builds SET status=?,published=1,reason=? WHERE id=?', partial ? 'partial' : 'completed', partial ? 'Coverage gaps are listed below.' : null, id);
      this.run('UPDATE project SET publishedBuildId=? WHERE id=1', id);
    });
  }
  revoke(id: string) {
    this.transaction(() => {
      if (this.source(id).status === 'revoked') return;
      this.run("UPDATE sources SET status='revoked',purge='pending' WHERE id=?", id);
      this.run('UPDATE project SET sourceSetVersion=sourceSetVersion+1 WHERE id=1');
      this.run("UPDATE builds SET status='cancelled',reason='A source was revoked.' WHERE id IN (SELECT buildId FROM build_sources WHERE sourceId=?) AND status IN ('preparing','running','pause_requested','paused','interrupted')", id);
    });
  }
  purge() {
    for (const source of this.sources().filter(source => source.purge === 'pending')) this.transaction(() => {
      this.run("UPDATE answer_attempts SET status='fenced',context=NULL,result=NULL,reason='An input source was revoked.' WHERE id IN (SELECT answerId FROM answer_sources WHERE sourceId=?)", source.id);
      this.run('DELETE FROM search WHERE spanId IN (SELECT s.id FROM spans s JOIN files f ON f.id=s.fileId WHERE f.sourceId=?)', source.id);
      this.run('DELETE FROM question_search WHERE spanId IN (SELECT s.id FROM spans s JOIN files f ON f.id=s.fileId WHERE f.sourceId=?)', source.id);
      this.run('DELETE FROM spans WHERE fileId IN (SELECT id FROM files WHERE sourceId=?)', source.id);
      this.run("UPDATE files SET raw=NULL, metadata='{}',status='purged',reason='revoked' WHERE sourceId=?", source.id);
      this.run("UPDATE sources SET purge='completed' WHERE id=?", source.id);
    });
  }
}
