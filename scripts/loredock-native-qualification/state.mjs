import { hash } from '../loredock-capture-memory/fixture.mjs';

// Only scalar counters around real services. No diagnostic callbacks or SQL hooks.
export async function openNativeState(directory, services) {
  const { CatalogStore, Catalog, SourceGit, CodeAnalysis, CodePaths, NativeCaptures } = services;
  const store = new CatalogStore(directory), git = new SourceGit(), catalog = new Catalog(store, git), analysis = await CodeAnalysis.create(catalog);
  const paths = new CodePaths(analysis), captures = new NativeCaptures(analysis, { paths });
  const counts = { gitCalls: 0, writeCalls: 0, factReads: 0, snapshots: 0, pathReads: 0, originalReads: 0 };
  const wrap = (owner, method, counter) => { const original = owner[method].bind(owner); owner[method] = (...args) => { counts[counter]++; return original(...args); }; };
  wrap(store, 'run', 'writeCalls'); wrap(git, 'run', 'gitCalls'); wrap(analysis, 'file', 'factReads'); wrap(analysis, 'snapshot', 'snapshots');
  wrap(paths, 'read', 'pathReads'); wrap(catalog, 'evidence', 'originalReads');
  let closed = false;
  return { store, catalog, analysis, paths, captures,
    counters: () => ({ ...counts, changedRows: store.one('SELECT total_changes() n').n }),
    legacy: () => hash(JSON.stringify(['answer_attempts', 'answer_sources', 'corrections', 'correction_sources', 'correction_flows', 'correction_reapplications'].map(table => store.all('SELECT * FROM ' + table)))),
    async close() {
      if (closed) return; const errors = [];
      for (const action of [() => captures.stop(), () => paths.stop(), () => analysis.stop(), () => catalog.stop(),
        () => store.db.exec('PRAGMA wal_checkpoint(TRUNCATE)'), () => store.close()]) try { await action(); } catch (error) { errors.push(error); }
      closed = true; if (errors.length) throw new AggregateError(errors, 'Native worker cleanup failed.');
    } };
}
