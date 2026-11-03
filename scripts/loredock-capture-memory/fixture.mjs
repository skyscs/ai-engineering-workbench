import { execFileSync } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, writeFile, readdir, lstat, cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
export const hash = value => createHash('sha256').update(value).digest('hex');
async function fileHash(file) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(file, { highWaterMark: 65536 })) digest.update(chunk);
  return digest.digest('hex');
}

export function openState(dataDir, folder, services, observer) {
  const { CatalogStore, Catalog, SourceGit, CodeAnalysis, CodePaths } = services;
  const store = new CatalogStore(dataDir), sourceGit = new SourceGit();
  const counts = { gitCalls: 0, writeCalls: 0, factReads: 0, snapshots: 0, pathReads: 0, originalReads: 0 };
  const run = store.run.bind(store), gitRun = sourceGit.run.bind(sourceGit);
  store.run = (...args) => { counts.writeCalls++; return run(...args); };
  sourceGit.run = (...args) => { counts.gitCalls++; return gitRun(...args); };
  const catalog = new Catalog(store, sourceGit), analysis = new CodeAnalysis(catalog);
  const diagnostic = observer?.enabled ? observer.phase : undefined;
  const paths = new CodePaths(analysis, { diagnostic });
  const file = analysis.file.bind(analysis), snapshot = analysis.snapshot.bind(analysis);
  const read = paths.read.bind(paths), evidence = catalog.evidence.bind(catalog);
  analysis.file = (...args) => { counts.factReads++; return file(...args); };
  analysis.snapshot = (...args) => {
    counts.snapshots++; diagnostic?.('analysis-snapshot-before', { manifestHeaders: null });
    const value = snapshot(...args); diagnostic?.('analysis-snapshot-after', { snapshotFileIds: value.fileIds.length, manifestHeaders: null }); return value;
  };
  paths.read = (...args) => { counts.pathReads++; return read(...args); };
  catalog.evidence = (...args) => { counts.originalReads++; return evidence(...args); };
  const detach = observer?.attach(store.db) ?? (() => {}); let closed = false;
  return { store, catalog, analysis, paths, folder, services: { store, catalog, analysis, paths },
    counters: () => ({ ...counts, changedRows: store.one('SELECT total_changes() n').n }),
    legacy: () => hash(JSON.stringify(['answer_attempts', 'answer_sources', 'corrections', 'correction_sources', 'correction_flows', 'correction_reapplications'].map(table => store.all('SELECT * FROM ' + table)))),
    async close() {
      if (closed) return;
      await paths.stop(); await analysis.stop(); await catalog.stop(); detach();
      store.db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); store.close(); closed = true;
    } };
}

export async function prepareSources(root, corpus, state) {
  const revisions = {};
  for (const [name, files] of Object.entries(corpus)) {
    const directory = path.join(root, 'sources', name); await mkdir(directory, { recursive: true });
    const git = args => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', '-c', 'commit.gpgsign=false',
      '-c', 'user.name=LoreDock Diagnostic', '-c', 'user.email=fixture@example.invalid', ...args], {
      cwd: directory, encoding: 'utf8', timeout: 10000,
      env: { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_ATTR_NOSYSTEM: '1', LC_ALL: 'C',
        GIT_AUTHOR_DATE: '2026-04-04T00:00:00Z', GIT_COMMITTER_DATE: '2026-04-04T00:00:00Z' },
    }).trimEnd();
    git(['init', '-q', '--object-format=sha1', '--initial-branch=main', '--template=']);
    for (const [file, text] of Object.entries(files)) {
      const target = path.join(directory, file); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, text);
    }
    git(['add', '--all']); git(['commit', '-qm', 'Add owned arrival diagnostic source']);
    revisions[name] = git(['rev-parse', 'HEAD']); await state.catalog.addSource(directory);
  }
  return revisions;
}

// Call only after all owners have closed. No live database copying or symlink following.
export async function dataHashes(folder) {
  const files = {};
  async function walk(relative = '') {
    for (const name of (await readdir(path.join(folder, relative))).sort()) {
      const key = path.join(relative, name), file = path.join(folder, key), info = await lstat(file);
      if (info.isSymbolicLink() || (!info.isDirectory() && !info.isFile())) throw new Error('Only owned regular snapshot files are supported.');
      if (info.isDirectory()) await walk(key);
      else { if (name.endsWith('-wal') && info.size) throw new Error('The catalog WAL must be closed before copying.');
        files[key] = { bytes: info.size, sha256: await fileHash(file) }; }
    }
  }
  await walk(); return files;
}
export async function copyStoppedData(source, destination) {
  const before = await dataHashes(source);
  await cp(source, destination, { recursive: true, errorOnExist: true, force: false });
  const after = await dataHashes(destination);
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Stopped catalog copy differs.');
  return after;
}
