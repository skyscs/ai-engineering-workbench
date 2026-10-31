import type { TreeEntry } from './git.js';

export interface Allocation { version: 'source-shares-v1'; paths: number; bytes: number }
/** Fixed equal shares, including deterministic remainder, never borrowed across sources. */
export function share(budget: number, count: number, index: number) { return Math.floor(budget / count) + Number(index < budget % count); }
export function baselineOrder(a: TreeEntry, b: TreeEntry) {
  const rank = (entry: TreeEntry) => /^(readme|readme\.md|readme\.txt)$/i.test(entry.path) ? 0 : /^(package\.json|pom\.xml)$/.test(entry.path) ? 1 : 2;
  return rank(a) - rank(b) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
