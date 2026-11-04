import { readFile } from 'node:fs/promises';
import type { CodeAnalysis as CurrentAnalysis } from '../../../src/code-analysis.js';
import type { CatalogStore as CurrentStore } from '../../../src/store.js';
// @ts-expect-error Preserved test-only compiled source; manifest verification checks its exact origin.
import { CodeAnalysis as ReferenceAnalysis } from './code-analysis.mjs';
// @ts-expect-error Preserved test-only compiled source; no application imports this facade.
import { CatalogStore as ReferenceStore } from './store.mjs';

// The constructor types describe the unchanged public interface, not shared private ownership.
export const CodeAnalysis = ReferenceAnalysis as typeof CurrentAnalysis;
export type CodeAnalysis = CurrentAnalysis;
export const CatalogStore = ReferenceStore as typeof CurrentStore;
export type CatalogStore = CurrentStore;

const archived: Record<string, string> = {
  'apps/loredock/src/store.ts': 'store.ts.txt',
  'apps/loredock/src/code-analysis.ts': 'code-analysis.ts.txt',
};
export async function referenceSource(file: string): Promise<Buffer> {
  return readFile(Object.hasOwn(archived, file) ? new URL(archived[file]!, import.meta.url)
    : new URL('../../../../../' + file, import.meta.url));
}
