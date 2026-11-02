import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { connectedCorpus, sourceNames } from '../fixtures/loredock-connected-admission/corpus.mjs';

export function connectedGit(root, source, args, trim = true) {
  assert.ok(sourceNames.includes(source));
  const result = execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', '-c', 'core.autocrlf=false',
    '-c', 'commit.gpgsign=false', '-c', 'user.name=LoreDock Fixture', '-c', 'user.email=fixture@example.invalid', ...args], {
    cwd: path.join(root, 'sources', source), encoding: 'utf8', timeout: 10000,
    env: { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_ATTR_NOSYSTEM: '1', LC_ALL: 'C',
      GIT_AUTHOR_DATE: '2026-02-02T00:00:00Z', GIT_COMMITTER_DATE: '2026-02-02T00:00:00Z' } });
  return trim ? result.trimEnd() : result;
}
export async function prepareConnectedCase(services, variant = 'small', analysisLimits = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'loredock-connected-')), corpus = connectedCorpus(variant), originals = new Map(), revisions = {};
  const directory = path.join(root, 'data'); let store, catalog, analysis, gitCalls = 0, writeCalls = 0;
  try {
    await mkdir(path.join(root, 'empty-template'));
    for (const source of sourceNames) {
      const target = path.join(root, 'sources', source); await mkdir(target, { recursive: true });
      connectedGit(root, source, ['init', '-q', '--object-format=sha1', '--initial-branch=main', `--template=${path.join(root, 'empty-template')}`]);
      for (const [file, text] of Object.entries(corpus[source])) {
        const name = path.join(target, file); await mkdir(path.dirname(name), { recursive: true }); await writeFile(name, text);
      }
      connectedGit(root, source, ['add', '--all']); connectedGit(root, source, ['commit', '-qm', `Add owned ${variant} parcel sources`]);
      revisions[source] = connectedGit(root, source, ['rev-parse', 'HEAD']);
      for (const [file, text] of Object.entries(corpus[source])) {
        assert.equal(connectedGit(root, source, ['show', `${revisions[source]}:${file}`], false), text);
        originals.set(`${source}/${revisions[source]}/${file}`, text);
      }
    }
    const open = () => {
      store = new services.CatalogStore(directory);
      const run = store.run.bind(store); store.run = (...args) => { writeCalls++; return run(...args); };
      const git = new services.SourceGit(), gitRun = git.run.bind(git); git.run = (...args) => { gitCalls++; return gitRun(...args); };
      catalog = new services.Catalog(store, git); analysis = new services.CodeAnalysis(catalog, analysisLimits);
    };
    open();
    for (const source of sourceNames) await catalog.addSource(path.join(root, 'sources', source));
    const index = async key => { const state = catalog.state(), build = catalog.start(key, state.sourceSetVersion, state.policyVersion); await catalog.idle(); return build.id; };
    const buildId = await index('first');
    return { root, directory, corpus, originals, revisions, buildId, index,
      get store() { return store; }, get catalog() { return catalog; }, get analysis() { return analysis; },
      counters: () => ({ gitCalls, writeCalls, changedRows: store.one('SELECT total_changes() n').n }),
      analyze: async (key, id = buildId) => { const run = analysis.start(key, id); await analysis.idle(); return run.id; },
      restart: async () => { await analysis.stop(); await catalog.stop(); store.close(); open(); },
      close: async () => { await analysis.stop(); await catalog.stop(); store.close(); await rm(root, { recursive: true, force: true }); } };
  } catch (error) { await analysis?.stop(); await catalog?.stop(); store?.close(); await rm(root, { recursive: true, force: true }); throw error; }
}
