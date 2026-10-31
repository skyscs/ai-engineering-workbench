import { DatabaseSync } from 'node:sqlite';
import { openStorage } from '../src/index.js';
import { migrate, migrations } from '../src/migrations.js';

const [mode, root] = process.argv.slice(2);
if (!root) throw new Error('Expected fixture directory.');
if (mode === 'interrupt-upload') {
  const storage = openStorage({ dataRoot: root });
  const workspaceId = storage.settings.listWorkspaces()[0]!.id;
  const taskId = storage.tasks.list(workspaceId)[0]!.id;
  const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(Buffer.from('partial')); } });
  void storage.tasks.artifacts.import(workspaceId, taskId, { name: 'interrupted.log', mimeType: 'text/plain', size: 100 }, body);
  await new Promise<void>((resolve) => setImmediate(resolve));
  process.send?.({ ready: true });
  setInterval(() => { storage.status(); }, 1000);
} else if (mode === 'interrupt-migration') {
  const db = new DatabaseSync(root);
  db.function('pause_migration', () => {
    process.send?.({ ready: true });
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
    return 0;
  });
  migrate(db, [...migrations, { version: migrations.length + 1, name: 'interrupted_fixture',
    sql: 'CREATE TABLE incomplete (id INTEGER PRIMARY KEY); SELECT pause_migration();' }]);
} else {
  try {
    const storage = openStorage({ dataRoot: root });
    process.send?.({ ready: true });
    if (mode === 'try') { storage.close(); process.disconnect(); }
    // Retain the ownership handle while the process is deliberately held alive.
    // An empty timer lets GC close otherwise unreachable SQLite handles before SIGKILL.
    else setInterval(() => { storage.status(); }, 1000);
  } catch (error) {
    process.send?.({ code: (error as { code?: string }).code });
    process.exitCode = 1;
    process.disconnect();
  }
}

process.on('message', message => {
  if (message !== 'collect') return;
  if (!globalThis.gc) throw new Error('This fixture requires --expose-gc for collection checks.');
  globalThis.gc();
  setImmediate(() => process.send?.({ collected: true }));
});
