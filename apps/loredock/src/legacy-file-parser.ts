import { AsyncLocalStorage } from 'node:async_hooks';
import type { CodeFacts } from './code-facts.js';

export interface LegacyFileInput { content: string; path: string }
export type LegacyFileParser = (input: LegacyFileInput) => Promise<CodeFacts>;
const adapters = new AsyncLocalStorage<LegacyFileParser>();

/** Internal test seam; production always supplies its catalog-owned lease. */
export function withLegacyFileParser<T>(parser: LegacyFileParser, action: () => T): T { return adapters.run(parser, action); }
export async function directLegacyFileParser({ content, path }: LegacyFileInput): Promise<CodeFacts> {
  return path.endsWith('.java') ? (await import('./code-java.js')).javaFacts(content)
    : (await import('./code-typescript.js')).typescriptFacts(content, path);
}
export async function parseLegacyFile(input: LegacyFileInput, owned: LegacyFileParser) { return (adapters.getStore() ?? owned)(input); }
