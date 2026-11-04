import assert from 'node:assert/strict';
import ts from 'typescript';

export const compilerOptions = Object.freeze({ target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022,
  isolatedModules: true, esModuleInterop: true, removeComments: false, sourceMap: false, newLine: ts.NewLineKind.LineFeed });

export function emitSource(source, fileName) {
  const result = ts.transpileModule(source, { fileName, compilerOptions, reportDiagnostics: true });
  assert.deepEqual(result.diagnostics, []);
  return result.outputText;
}

export function runtimeImports(emitted) {
  const parsed = ts.createSourceFile('reference.mjs', emitted, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS), imports = [];
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      assert.ok(ts.isStringLiteral(node.moduleSpecifier));
      imports.push({ name: node.moduleSpecifier.text, start: node.moduleSpecifier.getStart(parsed), end: node.moduleSpecifier.end });
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed); return imports;
}

// Test fixture construction/verification only. Application startup never rewrites source.
export function relocateSource(emitted, relocations) {
  const imports = runtimeImports(emitted), relative = imports.filter(item => item.name.startsWith('.'));
  assert.deepEqual([...new Set(relative.map(item => item.name))].sort(), Object.keys(relocations).sort());
  let result = emitted;
  for (const item of relative.reverse()) result = result.slice(0, item.start) + JSON.stringify(relocations[item.name]) + result.slice(item.end);
  return result;
}
