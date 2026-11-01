import {lstatSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';

const databaseFiles = ['loredock.db', 'loredock.db-wal', 'loredock.db-shm', 'loredock.db-journal',
  '.owner.db', '.owner.db-journal', '.owner.db-wal', '.owner.db-shm'];
function regularFile(file, required = false) {
  try {
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('LoreDock data files must be regular files, not symlinks.');
    return stat.size;
  } catch (error) {
    if (error.code === 'ENOENT' && !required) return null;
    if (error.code === 'ENOENT') throw new Error('The existing LoreDock database was not found.');
    throw error;
  }
}
function allocationGroup(table) {
  if (table === 'files') return 'originalsAndFileMetadata';
  if (table === 'spans') return 'originalSpans';
  if (table === 'search' || table.startsWith('search_') || table === 'literal_search_documents') return 'literalSearch';
  if (table === 'question_search' || table.startsWith('question_search_')) return 'questionSearch';
  if (table.startsWith('code_')) return 'codeInventory';
  if (table === 'answer_attempts' || table === 'answer_sources') return 'answers';
  if (table.startsWith('correction')) return 'engineerReview';
  return 'catalogAndOtherMetadata';
}
const byteLength = column => `coalesce(length(CAST(${column} AS BLOB)),0)`;

export function auditStorage(directory) {
  if (typeof directory !== 'string' || !path.isAbsolute(directory)) throw new Error('Use an absolute existing LoreDock data directory.');
  try { lstatSync(path.join(directory, 'workbench.db')); throw new Error('Use a separate LoreDock data directory, not Workbench data.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const name of databaseFiles) regularFile(path.join(directory, name), name === 'loredock.db');
  const db = new DatabaseSync(path.join(directory, 'loredock.db'), {readOnly: true});
  let snapshot;
  try {
    db.exec('PRAGMA query_only=ON; PRAGMA trusted_schema=OFF; PRAGMA temp_store=MEMORY; PRAGMA busy_timeout=1000; BEGIN;');
    const one = sql => db.prepare(sql).get();
    const version = one('PRAGMA user_version').user_version;
    if (version !== 8 && version !== 9) throw new Error('Storage accounting requires LoreDock database schema 8 or 9; no migration was attempted.');
    const project = one('SELECT publishedBuildId FROM project WHERE id=1');
    if (!project) throw new Error('The LoreDock project record is missing.');
    const payload = (table, columns) => one(`SELECT count(*) AS rows, coalesce(sum(${columns.map(byteLength).join('+')}),0) AS bytes FROM ${table}`);
    const duplicateCandidates = (table, hash, content) => one(`SELECT coalesce(sum(copies-1),0) AS extraCopies,
      coalesce(sum((copies-1)*bytes),0) AS bytes FROM
      (SELECT count(*) AS copies, ${byteLength(content)} AS bytes FROM ${table}
       WHERE ${hash} IS NOT NULL AND ${content} IS NOT NULL GROUP BY ${hash}, ${byteLength(content)} HAVING count(*)>1)`);
    const pageSize = one('PRAGMA page_size').page_size, pages = one('PRAGMA page_count').page_count,
      freePages = one('PRAGMA freelist_count').freelist_count;
    const allocations = {};
    for (const row of db.prepare(`SELECT coalesce(s.tbl_name,d.name) AS tableName, sum(d.pgsize) AS bytes
      FROM dbstat d LEFT JOIN sqlite_schema s ON s.name=d.name GROUP BY coalesce(s.tbl_name,d.name)`).all()) {
      const group = allocationGroup(row.tableName); allocations[group] = (allocations[group] ?? 0) + row.bytes;
    }
    const accountedBytes = Object.values(allocations).reduce((sum, bytes) => sum + bytes, 0);
    const literalText = payload('search', ['text']);
    snapshot = {
      schemaVersion: 'loredock-storage-audit/2', capturedAt: new Date().toISOString(), databaseVersion: version,
      sqlite: {pageSize, pages, freePages, allocatedBytes: pages * pageSize, freePageBytes: freePages * pageSize,
        allocations, unassignedBytes: pages * pageSize - freePages * pageSize - accountedBytes},
      payloads: {
        originals: payload('files', ['raw']), fileMetadata: payload('files', ['metadata']),
        spans: payload('spans', ['text']), literalSearch: {...literalText,
          contentStorage: version === 9 ? 'shared-original-spans' : 'copied',
          copiedTextBytes: version === 9 ? 0 : literalText.bytes},
        questionSearch: payload('question_search', ['text']),
        codeFacts: payload('code_analysis_files', ['payload']), answerContexts: payload('answer_attempts', ['context']),
        answerResults: payload('answer_attempts', ['result']), engineerNotes: payload('corrections', ['statement','environment','target'])
      },
      generations: one(`SELECT count(*) AS total, count(CASE WHEN published=1 THEN 1 END) AS published,
        count(CASE WHEN status IN ('preparing','running','pause_requested','paused','interrupted') THEN 1 END) AS unfinished,
        count(CASE WHEN id=(SELECT publishedBuildId FROM project WHERE id=1) THEN 1 END) AS currentPointer FROM builds`),
      dependencies: {
        meaning: 'Overlapping generation counts, not deletion eligibility.',
        ...one(`SELECT
          (SELECT count(DISTINCT buildId) FROM answer_attempts) AS withAnswerAttempts,
          (SELECT count(DISTINCT buildId) FROM corrections) AS withEngineerReview,
          (SELECT count(DISTINCT buildId) FROM code_analyses) AS withCodeInventories,
          (SELECT count(DISTINCT baselineBuildId) FROM builds) AS usedAsRefreshBaseline,
          (SELECT count(DISTINCT original.buildId) FROM files reused JOIN files original ON original.id=reused.reusedFromFileId) AS withReusedFileReferences`)
      },
      duplicateCandidates: {
        meaning: 'Same stored hash and byte length only; neither verified equality nor reclaimable disk space.',
        originals: duplicateCandidates('files', 'contentHash', 'raw'), spans: duplicateCandidates('spans', 'hash', 'text')
      }
    };
    db.exec('ROLLBACK;');
  } finally { db.close(); }
  const files = databaseFiles.map(name => ({name, bytes: regularFile(path.join(directory, name), name === 'loredock.db')}));
  const report = {...snapshot, disk: {sampledAt: new Date().toISOString(), files,
    observedFileBytes: files.reduce((sum, file) => sum + (file.bytes ?? 0), 0)},
    limits: [
      'SQLite values describe one read snapshot; separately sampled sidecar lengths can change while LoreDock runs.',
      'Disk values are file lengths for the listed database files only, not allocated filesystem blocks or a directory total.',
      'Payload bytes are selected UTF-8/BLOB contents inside SQLite allocation. Do not add them to page or disk totals.',
      'Literal-search bytes are logical searchable text; copiedTextBytes excludes shared original spans. Mapping and postings are counted in SQLite allocation.',
      'Payload row counts include records with null content; bytes count only retained content.',
      'History has no automatic retention limit. This report does not delete, compact, checkpoint, migrate or restart work.',
      'A read-only SQLite connection may maintain shared-memory bookkeeping; this is not a forensic disk acquisition.'
    ]};
  function checkNumbers(value) {
    if (typeof value === 'number' && (!Number.isSafeInteger(value) || value < 0)) throw new Error('Storage counters exceed the supported integer range or are inconsistent.');
    if (value && typeof value === 'object') Object.values(value).forEach(checkNumbers);
  }
  checkNumbers(report);
  return report;
}

export function storageArguments(args) {
  if (args.length !== 2 || args[0] !== '--data-dir' || !path.isAbsolute(args[1])) {
    throw new Error('Usage: pnpm loredock:storage --data-dir /absolute/loredock-data');
  }
  return args[1];
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.stdout.write(JSON.stringify(auditStorage(storageArguments(process.argv.slice(2))), null, 2) + '\n'); }
  catch (error) { console.error(`Storage report failed: ${error.message}`); process.exitCode = 1; }
}
