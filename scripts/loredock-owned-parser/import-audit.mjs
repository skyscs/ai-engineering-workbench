// Ordinary static regression adapter. Never creates, verifies or runs a qualification seal.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const original = new URL('../loredock-prepared-flow/import-audit.mjs', import.meta.url);
let source = await readFile(original, 'utf8');
assert.equal(createHash('sha256').update(source).digest('hex'), 'dea9bf6c5e6093530fa81ec4fc7225aefd5d1d1972c8e67db1accd9804da51ea');
const before = 'modules[path.join(repository, entries[0])]';
assert.equal(source.split(before).length, 2);
source = source.replace(before, "modules[path.join(repository, 'apps/loredock/dist/server.js')]");
const compiler = new URL('../../apps/loredock/node_modules/typescript/lib/typescript.js', import.meta.url).href;
source = source.replace("'../../apps/loredock/node_modules/typescript/lib/typescript.js'", JSON.stringify(compiler));
source = source.replaceAll('import.meta.url', JSON.stringify(original.href));
await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
