import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm, symlink, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { bindingCorpus, sourceNames } from '../fixtures/loredock-binding-coverage/corpus.mjs';

export function bindingGit(root, source, args, trim = true, input) {
  assert.ok(sourceNames.includes(source));
  const result = execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', '-c', 'core.autocrlf=false',
    '-c', 'commit.gpgsign=false', '-c', 'user.name=LoreDock Fixture', '-c', 'user.email=fixture@example.invalid', ...args], {
    input, cwd: path.join(root, 'sources', source), encoding: 'utf8', timeout: 10000,
    env: { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_ATTR_NOSYSTEM: '1', LC_ALL: 'C',
      GIT_AUTHOR_DATE: '2026-02-02T00:00:00Z', GIT_COMMITTER_DATE: '2026-02-02T00:00:00Z' } });
  return trim ? result.trimEnd() : result;
}
export async function prepareBindingCase(services, totalFiles = 200, variant = 'base', options = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'loredock-binding-coverage-')), corpus = bindingCorpus(totalFiles, variant), originals = new Map(), revisions = {};
  const directory = path.join(root, 'data'); let store, catalog, analysis, gitCalls = 0, writeCalls = 0;
  try {
    await mkdir(path.join(root, 'empty-template'));
    for (const source of sourceNames) {
      const target = path.join(root, 'sources', source); await mkdir(target, { recursive: true });
      bindingGit(root, source, ['init', '-q', '--object-format=sha1', '--initial-branch=main', `--template=${path.join(root, 'empty-template')}`]);
      for (const [file, entry] of Object.entries(corpus[source])) {
        const name = path.join(target, file); await mkdir(path.dirname(name), { recursive: true });
        if (entry.mode === '120000') await symlink(entry.text, name);
        else if (entry.mode === '160000') await mkdir(name);
        else { await writeFile(name, entry.text); if (entry.mode === '100755') await chmod(name, 0o755); }
      }
      bindingGit(root, source, ['add', '--all']);
      for (const [file, entry] of Object.entries(corpus[source])) if (entry.mode === '160000') {
        const object = bindingGit(root, source, ['hash-object', '-w', '-t', 'commit', '--stdin'], true, entry.text);
        bindingGit(root, source, ['update-index', '--add', '--cacheinfo', `160000,${object},${file}`]);
      }
      bindingGit(root, source, ['commit', '-qm', `Add owned ${totalFiles} ${variant} booking sources`]);
      revisions[source] = bindingGit(root, source, ['rev-parse', 'HEAD']);
      const tree = new Map(bindingGit(root, source, ['ls-tree', '-rz', '--full-tree', 'HEAD'], false).split('\0').filter(Boolean).map(row => {
        const [meta, file] = row.split('\t'); return [file, meta.split(' ')[2]];
      }));
      assert.equal(tree.size, Object.keys(corpus[source]).length);
      for (const [file, { text, mode }] of Object.entries(corpus[source])) {
        const blob = createHash('sha1').update(`${mode === '160000' ? 'commit' : 'blob'} ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
        assert.equal(tree.get(file), blob);
        if (mode !== '160000') originals.set(`${source}/${revisions[source]}/${file}`, text);
      }
    }
    const open = async () => {
      store = new services.CatalogStore(directory);
      const run = store.run.bind(store); store.run = (...args) => { writeCalls++; return run(...args); };
      const git = new services.SourceGit(), gitRun = git.run.bind(git); git.run = (...args) => { gitCalls++; return gitRun(...args); };
      if (options.failInventory) {
        const inventory = git.inventory.bind(git);
        git.inventory = (identity, ...args) => {
          if (path.basename(identity.path) === options.failInventory)
            throw new services.CatalogError('GIT_FAILED', 'Owned fixture enumeration failure. Exit: 1.', 422);
          return inventory(identity, ...args);
        };
      }
      catalog = new services.Catalog(store, git, options.catalogLimits ?? {}); analysis = (services.CodeAnalysis.create ? await services.CodeAnalysis.create(catalog, options.analysisLimits ?? {}) : new services.CodeAnalysis(catalog, options.analysisLimits ?? {}));
    };
    await open();
    for (const source of options.registration ?? sourceNames) await catalog.addSource(path.join(root, 'sources', source));
    const index = async key => { const state = catalog.state(), build = catalog.start(key, state.sourceSetVersion, state.policyVersion); await catalog.idle(); return build.id; };
    if (options.excludedPaths) catalog.updatePolicy(options.excludedPaths);
    const buildId = await index('first');
    return { root, directory, corpus, originals, revisions, buildId, index,
      get store() { return store; }, get catalog() { return catalog; }, get analysis() { return analysis; },
      counters: () => ({ gitCalls, writeCalls, changedRows: store.one('SELECT total_changes() n').n }),
      analyze: async (key, id = buildId) => { const run = analysis.start(key, id); await analysis.idle(); return run.id; },
      restart: async () => { await analysis.stop(); await catalog.stop(); store.close(); await open(); },
      close: async () => { await analysis.stop(); await catalog.stop(); store.close(); await rm(root, { recursive: true, force: true }); } };
  } catch (error) { await analysis?.stop(); await catalog?.stop(); store?.close(); await rm(root, { recursive: true, force: true }); throw error; }
}
