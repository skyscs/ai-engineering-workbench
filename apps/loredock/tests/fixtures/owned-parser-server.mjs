import assert from 'node:assert/strict';
import { createRequire, syncBuiltinESMExports } from 'node:module';

const [entry, directory] = process.argv.slice(2), require = createRequire(import.meta.url);
const fs = require('node:fs'), read = fs.readFileSync;
fs.readFileSync = function(file, ...args) {
  assert(!String(file).endsWith('/typescript/lib/typescript.js'), 'The parent synchronously read the compiler.');
  return read.call(this, file, ...args);
};
syncBuiltinESMExports();
const compilerLoaded = () => Object.keys(require.cache).some(file => file.endsWith('/typescript/lib/typescript.js'));
const { LoreDockServer } = await import(entry);
assert.equal(compilerLoaded(), false);
const server = new LoreDockServer({ directory, port: 0 });
let stopping = false;
process.once('SIGTERM', () => {
  stopping = true;
  void server.stop().then(() => console.log(JSON.stringify({ stage: 'stopped', snapshot: server.catalog.parser.snapshot(), compilerLoaded: compilerLoaded() })),
    error => { console.error(error.stack); process.exitCode = 1; });
});
try {
  const port = await server.start();
  assert.equal(compilerLoaded(), false);
  console.log(JSON.stringify({ stage: 'ready', port, snapshot: server.catalog.parser.snapshot(), compilerLoaded: compilerLoaded() }));
} catch (error) {
  if (!stopping) { console.error(error.stack); process.exitCode = 1; }
  await server.stop();
}
