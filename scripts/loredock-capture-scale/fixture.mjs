import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile, symlink, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

// The caller owns the parent and supplies either fresh frozen inputs or separate regressions.
export async function receiptFixture(parent, corpus, { Catalog, CatalogStore, SourceGit, CodeAnalysis, CodePaths }) {
  const root = await mkdtemp(path.join(parent, 'receipt-fixture-')), revisions = {}, originals = new Map();
  let store, catalog, analysis, paths, gitCalls = 0, writeCalls = 0, factReads = 0, snapshots = 0, pathReads = 0;
  const git = (source, args) => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false',
    '-c', 'commit.gpgsign=false', '-c', 'user.name=LoreDock Fixture', '-c', 'user.email=fixture@example.invalid', ...args], {
    cwd: path.join(root, 'sources', source), encoding: 'utf8', timeout: 10000,
    env: { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_ATTR_NOSYSTEM: '1', LC_ALL: 'C',
      GIT_AUTHOR_DATE: '2026-03-03T00:00:00Z', GIT_COMMITTER_DATE: '2026-03-03T00:00:00Z' } }).trimEnd();
  const write = async (source, file, text) => { const target = path.join(root, 'sources', source, file); await mkdir(path.dirname(target), { recursive: true }); if (typeof text === 'string') await writeFile(target, text); else {
    if (!text || Object.keys(text).length !== 1 || text.symlink !== 'not-present') throw new Error('Invalid owned opaque fixture.');
    await symlink(text.symlink, target);
  } };
  const makeSource = async (source, files) => {
    await mkdir(path.join(root, 'sources', source), { recursive: true });
    git(source, ['init', '-q', '--object-format=sha1', '--initial-branch=main', '--template=']);
    for (const [file, text] of Object.entries(files)) await write(source, file, text);
    git(source, ['add', '--all']); git(source, ['commit', '-qm', 'Add owned receipt sources']);
    const revision = git(source, ['rev-parse', 'HEAD']); revisions[source] = revision;
    for (const [file, text] of Object.entries(files)) if (typeof text === 'string') originals.set(`${source}/${revision}/${file}`, text);
  };
  const open = () => {
    store = new CatalogStore(path.join(root, 'data')); const run = store.run.bind(store);
    store.run = (...args) => { writeCalls++; return run(...args); };
    const sourceGit = new SourceGit(), sourceRun = sourceGit.run.bind(sourceGit);
    sourceGit.run = (...args) => { gitCalls++; return sourceRun(...args); };
    catalog = new Catalog(store, sourceGit); analysis = new CodeAnalysis(catalog); paths = new CodePaths(analysis);
    const file = analysis.file.bind(analysis), snapshot = analysis.snapshot.bind(analysis), read = paths.read.bind(paths);
    analysis.file = (...args) => { factReads++; return file(...args); };
    analysis.snapshot = (...args) => { snapshots++; return snapshot(...args); };
    paths.read = (...args) => { pathReads++; return read(...args); };
  };
  const stop = async () => { await paths?.stop(); await analysis?.stop(); await catalog?.stop(); store?.close(); };
  try {
    for (const [source, files] of Object.entries(corpus)) await makeSource(source, files);
    await mkdir(path.join(root, 'receipts')); open();
    for (const source of Object.keys(corpus)) await catalog.addSource(path.join(root, 'sources', source));
    const index = async key => { const state = catalog.state(), build = catalog.start(key, state.sourceSetVersion, state.policyVersion); await catalog.idle(); return build.id; };
    const buildId = await index('receipt-initial');
    return { root, buildId, originals, revisions, folder: path.join(root, 'receipts'), git, write, index,
      get store() { return store; }, get catalog() { return catalog; }, get analysis() { return analysis; }, get paths() { return paths; },
      get services() { return { catalog, analysis, paths }; },
      counters: () => ({ gitCalls, writeCalls, factReads, snapshots, pathReads, changedRows: store.one('SELECT total_changes() n').n }),
      analyze: async (key = 'receipt-facts', id = buildId) => { const run = analysis.start(key, id); await analysis.idle(); return run.id; },
      addSource: async (name = 'extra-notes') => { await makeSource(name, { 'README.md': '# Extra owned notes\nNo implicit path equivalence.\n' }); await catalog.addSource(path.join(root, 'sources', name)); },
      commit: source => { git(source, ['add', '--all']); git(source, ['commit', '-qm', 'Update owned receipt lifecycle input']); return git(source, ['rev-parse', 'HEAD']); },
      legacyRows: () => createHash('sha256').update(JSON.stringify(['answer_attempts', 'answer_sources', 'corrections', 'correction_sources', 'correction_flows', 'correction_reapplications']
        .map(table => store.all('SELECT * FROM ' + table)))).digest('hex'),
      restart: async () => { await stop(); open(); },
      close: async () => { await stop(); await rm(root, { recursive: true, force: true }); } };
  } catch (error) { await stop(); await rm(root, { recursive: true, force: true }); throw error; }
}
