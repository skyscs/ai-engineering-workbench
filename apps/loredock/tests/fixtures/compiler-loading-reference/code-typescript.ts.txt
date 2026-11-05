import ts from 'typescript';
import { emptyFacts, type CodeFacts, type SymbolFact } from './code-facts.js';
import { headerLimits, requestHeaderProperties } from './http-headers.js';

const identifier = /^[A-Za-z_$][\w$]*$/;
const literal = (node: ts.Node | undefined): string | undefined => node && ts.isStringLiteralLike(node) ? node.text : undefined;
const propertyName = (node: ts.PropertyName): string | undefined => ts.isIdentifier(node) || ts.isStringLiteral(node) ? node.text : undefined;

/** Parse text only: no program, tsconfig, package resolution, plugins or source execution. */
export function typescriptFacts(content: string, filePath: string): CodeFacts {
  const result = emptyFacts();
  let sourceText = content, offset = 0, vueAction: string | undefined;
  if (filePath.endsWith('.vue')) {
    const envelope = /^\s*<script setup(?: lang="ts")?>([\s\S]*?)<\/script>\s*<template>\s*<button @click="([A-Za-z_$][\w$]*)">[^<>]*<\/button>\s*<\/template>\s*$/.exec(content);
    if (!envelope) { result.gaps.push('unsupported-vue-envelope'); return result; }
    sourceText = envelope[1]!; offset = content.indexOf('>') + 1; vueAction = envelope[2]!;
  }
  try {
    const source = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true,
      filePath.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS);
    // createSourceFile's syntax diagnostics are present in the locked compiler 5.9.3.
    const diagnostics = (source as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics;
    if (diagnostics.length) { result.gaps.push('invalid-typescript-syntax'); return result; }
    const all: ts.Node[] = [], stack: { node: ts.Node; depth: number }[] = [{ node: source, depth: 0 }];
    while (stack.length) {
      const { node, depth } = stack.pop()!;
      if (all.length >= 12000 || depth > 96) { result.gaps.push('typescript-syntax-limit'); return result; }
      all.push(node); ts.forEachChild(node, child => { stack.push({ node: child, depth: depth + 1 }); });
    }
    const bindings = new Map<string, number>(), assigned = new Set<string>();
    function bind(name: ts.BindingName) {
      if (ts.isIdentifier(name)) bindings.set(name.text, (bindings.get(name.text) ?? 0) + 1);
      else for (const element of name.elements) if (ts.isBindingElement(element)) bind(element.name);
    }
    for (const node of all) {
      if (ts.isVariableDeclaration(node) || ts.isParameter(node)) bind(node.name);
      if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isClassDeclaration(node)) && node.name) bind(node.name);
      if (ts.isImportSpecifier(node) || ts.isNamespaceImport(node) || ts.isImportClause(node) && node.name) bind(node.name!);
      const target = ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
        && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment ? node.left
        : (ts.isPostfixUnaryExpression(node) || ts.isPrefixUnaryExpression(node))
          && (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken) ? node.operand : undefined;
      if (target) {
        const names = target.getText(source).match(/[A-Za-z_$][\w$]*/g) ?? [];
        for (const name of names) assigned.add(name);
      }
    }
    const imports = new Map<string, { imported: string; module: string }>();
    for (const statement of source.statements) if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const clause = statement.importClause;
      if (clause && !clause.isTypeOnly && clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const element of clause.namedBindings.elements) if (!element.isTypeOnly) imports.set(element.name.text,
          { imported: element.propertyName?.text ?? element.name.text, module: statement.moduleSpecifier.text });
      }
    }
    type Body = ts.Block | ts.ConciseBody;
    const functions: { symbol: SymbolFact; body: Body; dojo?: string }[] = [];
    for (const statement of source.statements) {
      if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) {
        const name = statement.name.text;
        const symbol: SymbolFact = { key: `${name}:${statement.getStart(source)}`, name, qualifiedName: name, role: 'function',
          exported: Boolean(statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)),
          start: offset + statement.getStart(source), end: offset + statement.end };
        functions.push({ symbol, body: statement.body });
      } else if (vueAction && ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) if (ts.isIdentifier(declaration.name) && declaration.name.text === vueAction
          && declaration.initializer && ts.isArrowFunction(declaration.initializer)) {
          const symbol: SymbolFact = { key: `${vueAction}:${declaration.getStart(source)}`, name: vueAction, qualifiedName: vueAction,
            role: 'vue-action', exported: false, start: 0, end: content.length };
          functions.push({ symbol, body: declaration.initializer.body });
        }
      }
    }
    // Explicit AMD export profiles; a same-named object is not a Dojo import.
    if (source.statements.length === 1 && ts.isExpressionStatement(source.statements[0]!)) {
      const call = source.statements[0].expression;
      if (ts.isCallExpression(call) && ts.isIdentifier(call.expression) && call.expression.text === 'define'
        && !bindings.has('define') && !assigned.has('define') && call.arguments.length === 2) {
        const deps = call.arguments[0]!, factory = call.arguments[1]!;
        if (ts.isArrayLiteralExpression(deps) && deps.elements.length === 1 && literal(deps.elements[0]) === 'dojo/request'
          && ts.isFunctionExpression(factory) && factory.parameters.length === 1 && ts.isIdentifier(factory.parameters[0]!.name)
          && !factory.asteriskToken && !factory.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword)
          && !factory.parameters[0]!.dotDotDotToken && !factory.parameters[0]!.initializer
          && factory.body.statements.length === 1 && ts.isReturnStatement(factory.body.statements[0]!)) {
          const returned = factory.body.statements[0].expression, alias = factory.parameters[0]!.name.text;
          const dynamicBindings = all.some(node => ts.isWithStatement(node) || ts.isCallExpression(node)
            && ts.isIdentifier(node.expression) && node.expression.text === 'eval');
          if (returned && bindings.get(alias) === 1 && !assigned.has(alias) && !dynamicBindings) {
            if (ts.isFunctionExpression(returned) && returned.name) {
              const name = returned.name.text, symbol: SymbolFact = { key: `${name}:${returned.getStart(source)}`, name,
                qualifiedName: name, role: 'amd-function', exported: true, start: 0, end: content.length };
              functions.push({ symbol, body: returned.body, dojo: alias });
            } else if (ts.isObjectLiteralExpression(returned)) {
              if (returned.properties.length > 100) result.gaps.push('typescript-symbol-limit');
              else {
                const names = new Set<string>();
                const entries = returned.properties.map(property => {
                  if (!ts.isPropertyAssignment(property)) return;
                  const name = propertyName(property.name), value = property.initializer;
                  if (!name || !identifier.test(name) || name === '__proto__' || names.has(name)
                    || !ts.isFunctionExpression(value) || value.asteriskToken
                    || value.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword)) return;
                  names.add(name); return { name, value, property };
                });
                if (entries.every(entry => entry !== undefined)) for (const { name, value, property } of entries) {
                  const symbol: SymbolFact = { key: `${name}:${property.getStart(source)}`, name, qualifiedName: name,
                    role: 'amd-function', exported: true, start: offset + property.getStart(source), end: offset + property.end };
                  functions.push({ symbol, body: value.body, dojo: alias });
                }
              }
            }
          }
        }
        if (!functions.length) result.gaps.push('unsupported-amd-shape');
      }
    }
    function requestUrl(node: ts.Expression): Record<string, string> | undefined {
      let value = literal(node), baseExpression = 'same-origin';
      if (ts.isTemplateExpression(node) && !node.head.text && node.templateSpans.length === 1) {
        const span = node.templateSpans[0]!;
        if (!/^import\.meta\.env\.[A-Za-z_][\w]*$/.test(span.expression.getText(source))) return;
        value = span.literal.text; baseExpression = span.expression.getText(source);
      }
      if (!value || value.length > 512 || /[\x00-\x20\x7f?#]/.test(value)) return;
      if (/^https?:\/\//.test(value)) { const url = new URL(value); baseExpression = url.origin; value = url.pathname; }
      if (!value.startsWith('/') || value.startsWith('//')) return;
      return { path: value, baseExpression };
    }
    function requestHeaders(options: ts.Expression | undefined): Record<string, string> {
      if (!options) return requestHeaderProperties([]);
      if (!ts.isObjectLiteralExpression(options)) return requestHeaderProperties();
      let headers: ts.Expression | undefined;
      for (const prop of options.properties) {
        if (!ts.isPropertyAssignment(prop) || !propertyName(prop.name) || propertyName(prop.name) === '__proto__') return requestHeaderProperties();
        if (propertyName(prop.name) === 'headers') {
          if (headers) return requestHeaderProperties();
          headers = prop.initializer;
        }
      }
      if (!headers) return requestHeaderProperties([]);
      if (!ts.isObjectLiteralExpression(headers) || headers.properties.length > headerLimits.names) return requestHeaderProperties();
      const names: string[] = [];
      for (const prop of headers.properties) {
        if (!ts.isPropertyAssignment(prop)) return requestHeaderProperties();
        const name = propertyName(prop.name);
        // A non-computed __proto__ assignment is not an ordinary own field in JS.
        if (!name || name === '__proto__') return requestHeaderProperties();
        names.push(name);
      }
      return requestHeaderProperties(names);
    }
    for (const entry of functions.slice(0, 100)) {
      result.symbols.push(entry.symbol);
      const work: ts.Node[] = [entry.body];
      while (work.length) {
        const node = work.pop()!;
        if (node !== entry.body && ts.isFunctionLike(node)) { result.gaps.push('nested-function-not-followed'); continue; }
        ts.forEachChild(node, child => { work.push(child); });
        if (!ts.isCallExpression(node)) continue;
        if (ts.isIdentifier(node.expression)) {
          const name = node.expression.text, imported = imports.get(name);
          if (imported) {
            if (bindings.get(name) === 1 && !assigned.has(name)) result.calls.push({ owner: entry.symbol.key, local: name, ...imported });
            else result.gaps.push('shadowed-or-reassigned-import');
          }
        }
        let method: string | undefined;
        if (ts.isIdentifier(node.expression) && node.expression.text === 'fetch') {
          if (bindings.has('fetch') || assigned.has('fetch')) { result.gaps.push('shadowed-or-reassigned-fetch'); continue; }
          method = 'GET';
          const options = node.arguments[1];
          if (options) {
            if (!ts.isObjectLiteralExpression(options)) { result.gaps.push('dynamic-http-options'); continue; }
            const names = new Set<string>(); let valid = true;
            for (const prop of options.properties) {
              if (!ts.isPropertyAssignment(prop)) { valid = false; break; }
              const key = propertyName(prop.name);
              if (!key || names.has(key)) { valid = false; break; } names.add(key);
              if (key === 'method') method = literal(prop.initializer)?.toUpperCase();
            }
            if (!valid || !method) { result.gaps.push('dynamic-http-options'); continue; }
          }
        } else if (entry.dojo && ts.isPropertyAccessExpression(node.expression)
          && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === entry.dojo) method = node.expression.name.text.toUpperCase();
        if (!method) continue;
        const url = node.arguments[0] && requestUrl(node.arguments[0]);
        if (!url || !['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(method)) {
          result.gaps.push('dynamic-or-unsupported-http-request'); continue;
        }
        const headers = requestHeaders(node.arguments[1]);
        if (headers.requestHeaderStatus === 'unknown') result.gaps.push('unresolved-http-headers');
        result.operations.push({ owner: entry.symbol.key, kind: 'http-request', start: offset + node.getStart(source), end: offset + node.end,
          properties: { method, ...url, adapter: entry.dojo ? 'dojo/request AMD' : 'fetch', ...headers } });
      }
    }
    if (functions.length > 100) result.gaps.push('typescript-symbol-limit');
    if (!result.symbols.length) result.gaps.push('unsupported-typescript-profile');
    if (vueAction && !functions.some(entry => entry.symbol.role === 'vue-action')) result.gaps.push('unresolved-vue-action');
    result.gaps = [...new Set(result.gaps)]; return result;
  } catch {
    const failed = emptyFacts(); failed.gaps.push('unsupported-typescript-syntax'); return failed;
  }
}
