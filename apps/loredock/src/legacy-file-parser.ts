import { AsyncLocalStorage } from 'node:async_hooks';
import type { CodeFacts } from './code-facts.js';
import { javaFacts } from './code-java.js';
import { typescriptFacts } from './code-typescript.js';

export interface LegacyFileInput { content: string; path: string }
export type LegacyFileParser = (input: LegacyFileInput) => Promise<CodeFacts>;
const adapters = new AsyncLocalStorage<LegacyFileParser>();

/** Internal test seam. Production still uses the existing direct parser, one file at a time. */
export function withLegacyFileParser<T>(parser: LegacyFileParser, action: () => T): T { return adapters.run(parser, action); }
export async function directLegacyFileParser({ content, path }: LegacyFileInput): Promise<CodeFacts> {
  return path.endsWith('.java') ? javaFacts(content) : typescriptFacts(content, path);
}
export async function parseLegacyFile(input: LegacyFileInput) { return (adapters.getStore() ?? directLegacyFileParser)(input); }
