import {lstatSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {auditStorage} from './loredock-storage.mjs';

function requireFiles(directory) {
  if (typeof directory !== 'string' || !path.isAbsolute(directory)) throw new Error('Use an absolute existing LoreDock data directory.');
  try {lstatSync(path.join(directory, 'workbench.db')); throw new Error('Use LoreDock data, not Workbench data.');}
  catch (error) {if (error.code !== 'ENOENT') throw error;}
  for (const name of ['loredock.db', 'loredock.db-wal', 'loredock.db-shm', 'loredock.db-journal',
    '.owner.db', '.owner.db-journal', '.owner.db-wal', '.owner.db-shm']) {
    try {
      const stat = lstatSync(path.join(directory, name));
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('LoreDock database and owner files must be regular files, not symlinks.');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      if (name === 'loredock.db' || name === '.owner.db') throw new Error('An existing LoreDock database and owner file are required. Nothing was created.');
    }
  }
}

export function compactStorage(directory) {
  requireFiles(directory);
  const owner = new DatabaseSync(path.join(directory, '.owner.db'));
  let database;
  try {
    try {owner.exec('PRAGMA busy_timeout=0; PRAGMA journal_mode=DELETE; BEGIN EXCLUSIVE;');}
    catch (error) {
      if ([5, 6].includes(error.errcode)) throw new Error('This LoreDock directory is in use. Stop LoreDock before compacting.');
      throw error;
    }
    const before = auditStorage(directory);
    let status = 'unchanged';
    if (before.sqlite.freePages > 0) {
      database = new DatabaseSync(path.join(directory, 'loredock.db'));
      database.exec('PRAGMA foreign_keys=ON; PRAGMA trusted_schema=OFF; PRAGMA busy_timeout=1000;');
      const check = () => {
        const rows = database.prepare('PRAGMA quick_check').all();
        if (rows.length !== 1 || rows[0].quick_check !== 'ok') throw new Error('SQLite integrity validation failed. Preserve the data and restore a known-good backup.');
      };
      const checkpoint = () => {
        const result = database.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
        if (result.busy !== 0) throw new Error('Another database reader or writer blocks compaction. Close it before trying again.');
      };
      check(); checkpoint(); database.exec('VACUUM;'); check(); checkpoint();
      database.close(); database = undefined; status = 'compacted';
    }
    const after = auditStorage(directory);
    return {schemaVersion: 'loredock-storage-compaction/2', completedAt: new Date().toISOString(), status,
      reclaimedSqliteBytes: before.sqlite.allocatedBytes - after.sqlite.allocatedBytes, before, after,
      limits: [
        'This explicit operation keeps logical records and history; it does not impose a total storage quota.',
        'Only already-free SQLite pages trigger compaction. Actual savings also depend on page layout.',
        'A failure can leave completed checkpoint or compaction work in place. No automatic retry or job recovery is performed.'
      ]};
  } finally {try {database?.close();} finally {owner.close();}}
}

export function compactionArguments(args) {
  if (args.length !== 2 || args[0] !== '--data-dir' || !path.isAbsolute(args[1])) {
    throw new Error('Usage: pnpm loredock:compact --data-dir /absolute/loredock-data');
  }
  return args[1];
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {process.stdout.write(JSON.stringify(compactStorage(compactionArguments(process.argv.slice(2))), null, 2) + '\n');}
  catch (error) {console.error(`Storage compaction failed: ${error.message}`); process.exitCode = 1;}
}
