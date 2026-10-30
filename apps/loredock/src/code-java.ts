import { emptyFacts, type CodeFacts, type SymbolFact } from './code-facts.js';

interface Token { text: string; kind: 'id' | 'literal' | 'punctuation'; start: number; end: number }
interface Parameter { type: string; name: string }
interface Method { name: string; returns: string; parameters: Parameter[]; start: number; end: number; body?: [number, number] }
interface Declaration { name: string; kind: string; fields: Map<string, string>; methods: Method[] }
const modifiers = new Set(['public', 'private', 'protected', 'final', 'static', 'abstract', 'synchronized']);

function tokens(content: string): Token[] {
  // Java expands Unicode escapes before lexing, including inside comments. Do not misread them.
  if (/\\u+[\da-fA-F]{4}|"""/.test(content)) throw new Error('Unsupported Java escaping');
  const result: Token[] = [];
  for (let index = 0; index < content.length;) {
    const start = index, character = content[index]!;
    if (/\s/.test(character)) { index++; continue; }
    if (content.startsWith('//', index)) { const end = content.indexOf('\n', index); index = end < 0 ? content.length : end; continue; }
    if (content.startsWith('/*', index)) { const end = content.indexOf('*/', index + 2); if (end < 0) throw new Error('Unclosed comment'); index = end + 2; continue; }
    if (character === '"' || character === "'") {
      index++; let closed = false;
      while (index < content.length) {
        if (content[index] === '\n' || content[index] === '\r') throw new Error('Invalid literal');
        if (content[index] === '\\') { index += 2; continue; }
        if (content[index++] === character) { closed = true; break; }
      }
      if (!closed) throw new Error('Unclosed literal');
      result.push({ text: content.slice(start, index), kind: 'literal', start, end: index });
    } else if (/[A-Za-z_$]/.test(character)) {
      while (index < content.length && /[\w$]/.test(content[index]!)) index++;
      result.push({ text: content.slice(start, index), kind: 'id', start, end: index });
    } else if (/[0-9]/.test(character)) {
      while (index < content.length && /[\w.]/.test(content[index]!)) index++;
      result.push({ text: content.slice(start, index), kind: 'literal', start, end: index });
    } else if ('{}()[];,.=:+-*/<>!?&|%@'.includes(character)) {
      result.push({ text: character, kind: 'punctuation', start, end: ++index });
    } else throw new Error('Unsupported Java token');
    if (result.length > 10000) throw new Error('Java token limit');
  }
  return result;
}

/** A structural subset for the fixture's explicit interfaces, not a Java type checker. */
export function javaFacts(content: string): CodeFacts {
  const result = emptyFacts();
  try {
    const input = tokens(content), pairs = new Map<number, number>(), stack: number[] = [];
    for (let index = 0; index < input.length; index++) {
      const value = input[index]!.text;
      if (['(', '{', '['].includes(value)) {
        stack.push(index); if (stack.length > 64) throw new Error('Java depth limit');
      } else if ([')', '}', ']'].includes(value)) {
        const open = stack.pop();
        if (open === undefined || !['()', '{}', '[]'].includes(input[open]!.text + value)) throw new Error('Unbalanced Java');
        pairs.set(open, index);
      }
    }
    if (stack.length) throw new Error('Unbalanced Java');
    const text = (index: number) => input[index]?.text;
    function split(start: number, end: number): Token[][] {
      const parts: Token[][] = []; let beginning = start;
      for (let index = start; index < end; index++) {
        if (text(index) === ',') { parts.push(input.slice(beginning, index)); beginning = index + 1; }
        else if (pairs.has(index)) index = pairs.get(index)!;
      }
      if (beginning < end) parts.push(input.slice(beginning, end));
      return parts;
    }
    function parameters(start: number, end: number): Parameter[] | undefined {
      const parts = split(start, end), names = new Set<string>(), values: Parameter[] = [];
      for (const part of parts) {
        const simple = part.filter(token => token.text !== 'final');
        if (simple.length !== 2 || simple.some(token => token.kind !== 'id') || names.has(simple[1]!.text)) return;
        names.add(simple[1]!.text); values.push({ type: simple[0]!.text, name: simple[1]!.text });
      }
      return values;
    }
    const declarations: Declaration[] = []; let packageName = '', cursor = 0;
    while (cursor < input.length) {
      if (text(cursor) === 'package' || text(cursor) === 'import') {
        const end = input.findIndex((token, index) => index > cursor && token.text === ';');
        if (end < 0) throw new Error('Unclosed directive');
        if (text(cursor) === 'package') packageName = input.slice(cursor + 1, end).map(token => token.text).join('') + '.';
        cursor = end + 1; continue;
      }
      const beginning = cursor;
      while (modifiers.has(text(cursor) ?? '')) cursor++;
      const kind = text(cursor), name = input[cursor + 1];
      if (!kind || !['class', 'record', 'interface'].includes(kind) || name?.kind !== 'id') throw new Error('Unsupported Java declaration');
      cursor += 2;
      if (kind === 'record') {
        if (text(cursor) !== '(' || !pairs.has(cursor)) throw new Error('Unsupported record');
        const end = pairs.get(cursor)!, fields = parameters(cursor + 1, end);
        if (!fields) throw new Error('Unsupported record fields');
        const shape = JSON.stringify(Object.fromEntries(fields.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0).map(field => [field.name, field.type])));
        if (result.records[name.text] !== undefined) throw new Error('Ambiguous record');
        result.records[name.text] = shape; cursor = end + 1;
      }
      if (text(cursor) !== '{' || !pairs.has(cursor)) throw new Error('Unsupported inheritance or generics');
      const bodyEnd = pairs.get(cursor)!, declaration: Declaration = { name: name.text, kind, fields: new Map(), methods: [] };
      let member = cursor + 1;
      while (member < bodyEnd) {
        if (text(member) === ';') { member++; continue; }
        let head = member;
        while (modifiers.has(text(head) ?? '')) head++;
        let boundary = head;
        while (boundary < bodyEnd && !['(', ';', '{'].includes(text(boundary)!)) boundary++;
        if (text(boundary) === ';') {
          const field = input.slice(head, boundary);
          if (field.length !== 2 || field.some(token => token.kind !== 'id') || declaration.fields.has(field[1]!.text)) throw new Error('Unsupported field');
          declaration.fields.set(field[1]!.text, field[0]!.text); member = boundary + 1;
        } else if (text(boundary) === '(') {
          const prefix = input.slice(head, boundary), end = pairs.get(boundary)!;
          const params = parameters(boundary + 1, end), after = text(end + 1);
          if (!params || !prefix.length || prefix.length > 2 || prefix.some(token => token.kind !== 'id') || !['{', ';'].includes(after ?? '')) throw new Error('Unsupported method');
          const methodEnd = after === '{' ? pairs.get(end + 1)! : end + 1;
          const method: Method = { name: prefix.at(-1)!.text, returns: prefix.length === 2 ? prefix[0]!.text : '<constructor>',
            parameters: params, start: input[member]!.start, end: input[methodEnd]!.end,
            ...after === '{' ? { body: [end + 2, methodEnd] as [number, number] } : {} };
          declaration.methods.push(method); member = methodEnd + 1;
        } else throw new Error('Unsupported member');
      }
      if (declarations.some(existing => existing.name === name.text)) throw new Error('Ambiguous type');
      declarations.push(declaration); cursor = bodyEnd + 1;
      if (cursor <= beginning) throw new Error('No progress');
    }
    function profile(type: string, name: string, types: string[]): Method | undefined {
      const candidates = declarations.filter(item => item.kind === 'interface' && item.name === type)
        .flatMap(item => item.methods.filter(method => method.name === name && !method.body && method.returns === 'void'
          && method.parameters.length === types.length && types.every((expected, index) => !expected || method.parameters[index]!.type === expected)));
      return candidates.length === 1 ? candidates[0] : undefined;
    }
    for (const declaration of declarations.filter(item => item.kind === 'class')) for (const method of declaration.methods) {
      if (!method.body || method.returns === '<constructor>') continue;
      const [start, end] = method.body, body = input.slice(start, end);
      const nested = body.some((token, index) => {
        if (['class', 'interface', 'record'].includes(token.text) || token.text === '-' && body[index + 1]?.text === '>') return true;
        if (token.text !== 'new') return false;
        let opening = start + index + 1;
        while (opening < end && !['(', ';', '{', '}'].includes(text(opening)!)) opening++;
        return text(opening) === '(' && text((pairs.get(opening) ?? end) + 1) === '{';
      });
      if (nested) {
        result.gaps.push('unsupported-nested-java-code'); continue;
      }
      const symbol: SymbolFact = { key: `${packageName}${declaration.name}.${method.name}:${method.start}`,
        name: method.name, qualifiedName: `${packageName}${declaration.name}.${method.name}`, role: 'java-method', exported: false,
        className: `${packageName}${declaration.name}`, parameterTypes: method.parameters.map(parameter => parameter.type),
        start: method.start, end: method.end };
      if (result.symbols.length >= 100) { result.gaps.push('java-symbol-limit'); break; }
      result.symbols.push(symbol);
      const locals = new Map(method.parameters.map(parameter => [parameter.name, parameter.type])), ambiguous = new Set<string>();
      for (let index = start; index < end - 2; index++) {
        const type = input[index]!, variable = input[index + 1]!;
        if (type.kind !== 'id' || variable.kind !== 'id' || !['=', ';'].includes(text(index + 2) ?? '') || text(index - 1) === '.') continue;
        if (locals.has(variable.text)) ambiguous.add(variable.text);
        let value = type.text;
        if (value === 'var') value = text(index + 3) === 'new' && input[index + 4]?.kind === 'id' ? text(index + 4)! : '<unresolved>';
        locals.set(variable.text, value);
      }
      function variableType(part: Token[]): string | undefined {
        if (part.length === 1 && part[0]!.kind === 'id') {
          const name = part[0]!.text;
          if (!ambiguous.has(name)) return locals.get(name) ?? declaration.fields.get(name);
        }
        return;
      }
      for (let index = start; index < end - 3; index++) {
        const receiver = input[index]!, operation = input[index + 2]!;
        if (receiver.kind !== 'id' || text(index + 1) !== '.' || operation.kind !== 'id' || text(index + 3) !== '(') continue;
        const isThis = text(index - 1) === '.' && text(index - 2) === 'this';
        if (text(index - 1) === '.' && !isThis) continue;
        const receiverType = isThis ? declaration.fields.get(receiver.text) : variableType([receiver]);
        const close = pairs.get(index + 3)!;
        if (close >= end) continue;
        const args = split(index + 4, close);
        const range = { owner: symbol.key, start: receiver.start, end: input[close]!.end };
        if (receiverType === 'EventPublisher' && operation.text === 'publish') {
          const declared = profile(receiverType, 'publish', ['String', 'String', '']), payloadType = args[2] && variableType(args[2]);
          if (args.length !== 3 || !declared || payloadType !== declared.parameters[2]!.type || !result.records[payloadType]) { result.gaps.push('unresolved-publisher-payload'); continue; }
          result.operations.push({ ...range, kind: 'event-publish', properties: { receiverType, payloadType,
            recordSignature: result.records[payloadType]!, topicExpression: args[0]!.map(token => token.text).join('') } });
        } else if (receiverType === 'KafkaSubscriber' && operation.text === 'subscribe') {
          const declared = profile(receiverType, 'subscribe', ['String', 'String', declaration.name]);
          if (args.length !== 3 || !declared || args[2]!.length !== 1 || args[2]![0]!.text !== 'this') { result.gaps.push('unresolved-subscriber-handler'); continue; }
          result.operations.push({ ...range, kind: 'event-subscribe', properties: { receiverType, handlerClass: symbol.className!,
            topicExpression: args[0]!.map(token => token.text).join(''), dispatch: 'unresolved' } });
        } else if (receiverType === 'MongoCollection' && operation.text === 'replaceOne') {
          const declared = profile(receiverType, 'replaceOne', ['', '', 'boolean']), payloadType = args[1] && variableType(args[1]);
          if (args.length !== 3 || !declared || payloadType !== declared.parameters[1]!.type || !result.records[payloadType]) { result.gaps.push('unresolved-document-payload'); continue; }
          result.operations.push({ ...range, kind: 'document-write', properties: { receiverType, operation: 'replaceOne', payloadType,
            recordSignature: result.records[payloadType]!, collection: 'unresolved', upsertExpression: args[2]!.map(token => token.text).join('') } });
        }
      }
    }
    if (!result.symbols.length) result.gaps.push('unsupported-java-profile');
    result.gaps = [...new Set(result.gaps)]; return result;
  } catch {
    const failed = emptyFacts(); failed.gaps.push('unsupported-java-syntax'); return failed;
  }
}
