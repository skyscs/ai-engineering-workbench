// Resolve the actual ESM graph without importing or evaluating application modules.
import assert from 'node:assert/strict';
import { readFile, realpath } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import ts from '../../apps/loredock/node_modules/typescript/lib/typescript.js';

assert(process.execArgv.includes('--experimental-import-meta-resolve'));
const repository = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const entries = ['apps/loredock/dist/index.js', 'scripts/loredock-prepared-flow/launcher.mjs',
  'scripts/loredock-prepared-flow/monitor.mjs', 'scripts/loredock-prepared-flow/execution.mjs'];
const pending = entries.map(file => path.join(repository, file)), modules = {}, externalEntries = {};
while (pending.length) {
  const file = await realpath(pending.pop());
  if (Object.hasOwn(modules, file)) continue;
  assert(file.startsWith(repository + '/')); const imports = [];
  const ast = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visit(node) {
    let literal;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) literal = node.moduleSpecifier;
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      assert.equal(node.arguments.length, 1); literal = node.arguments[0];
      assert(ts.isStringLiteral(literal), 'Computed workspace import is not sealed: ' + file);
    }
    if (literal) { assert(ts.isStringLiteral(literal)); imports.push(literal.text); }
    ts.forEachChild(node, visit);
  }
  visit(ast); modules[file] = [];
  for (const specifier of imports) {
    const resolved = import.meta.resolve(specifier, pathToFileURL(file).href);
    if (resolved.startsWith('node:')) { modules[file].push({ specifier, builtin: resolved }); continue; }
    assert(resolved.startsWith('file:')); const target = await realpath(fileURLToPath(resolved));
    assert(target.startsWith(repository + '/'), 'Unsealed import escapes the installation.');
    modules[file].push({ specifier, target });
    if (target.includes('/node_modules/')) externalEntries[target] = true;
    else pending.push(target);
  }
}
const production = modules[path.join(repository, entries[0])].find(row => row.specifier === '@hono/node-server');
const controlled = modules[path.join(repository, entries[1])].find(row => row.specifier.endsWith('/@hono/node-server/dist/index.mjs'));
assert.equal(production.target, controlled.target); assert(production.target.endsWith('/dist/index.mjs'));
console.log(JSON.stringify({ entries, modules, externalEntries: Object.keys(externalEntries).sort(), honoEntry: production.target,
  externalClosure: 'Every file and symlink in the complete installed packages is sealed, including internal conditional and CommonJS imports.',
  candidateModulesEvaluated: 0 }));
