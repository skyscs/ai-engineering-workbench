import assert from 'node:assert/strict';

// Recognize only the admitted emitted loading prefix, not arbitrary CommonJS code.
// This reader never evaluates the compiler or an application module.
export function directCompilerDependency(code) {
  assert.match(code, /^(?:\/\/[^\n]*\n)*import \{ createRequire \} from 'node:module';\n(?:import [^\n]+;\n)*const ts = createRequire\(import\.meta\.url\)\('typescript'\);\n/);
  assert.equal([...code.matchAll(/\bcreateRequire\b/g)].length, 2, 'Additional or shadowed CommonJS loading is unsupported.');
  return 'typescript';
}
