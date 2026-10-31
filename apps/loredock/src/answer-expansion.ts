import { searchText } from './search-text.js';

export const expansionLimits = { seeds: 6, terms: 12, identifierCharacters: 80 } as const;
interface Seed { sourceId: string; text: string }
interface SymbolHint { name: string; affinity: number; qualified: boolean; occurrences: number }

/** Literal text hints only. Neither a name nor a member reference proves a relation. */
export function expansionTerms(seeds: readonly Seed[], queryTerms: readonly string[]): string[] {
  const query = new Set(queryTerms), groups = new Map<string, Map<string, SymbolHint>>();
  for (const seed of seeds.slice(0, expansionLimits.seeds)) {
    const symbols = new Map<string, boolean>();
    for (const name of seed.text.match(/\b(?:[A-Z][a-z]+(?:[A-Z][a-z]+)+|[a-z]+(?:[A-Z][a-z]+)+|[A-Z]+(?:_[A-Z]+)+)\b/g) ?? []) {
      if (name.length <= expansionLimits.identifierCharacters) symbols.set(name, false);
    }
    // Quoted owners cover configured Class.method references without treating
    // unquoted System/JSON calls or arbitrary prose words as new type hints.
    for (const match of seed.text.matchAll(/(['"`])([A-Z][A-Za-z0-9_]{1,79})(?:\.[A-Za-z_$][A-Za-z0-9_$]{0,79}){1,2}\1/g)) {
      symbols.set(match[2]!, true);
    }
    if (!symbols.size) continue;
    let group = groups.get(seed.sourceId);
    if (!group) { group = new Map(); groups.set(seed.sourceId, group); }
    for (const [name, qualified] of symbols) {
      const previous = group.get(name);
      const words = new Set(searchText(name).match(/[\p{L}\p{N}_]+/gu) ?? []);
      group.set(name, { name, qualified: qualified || previous?.qualified === true,
        occurrences: (previous?.occurrences ?? 0) + 1, affinity: [...words].filter(word => query.has(word)).length });
    }
  }
  const queues = [...groups.values()].map(group => ({ offset: 0, symbols: [...group.values()].sort((a, b) =>
    b.affinity - a.affinity || Number(b.qualified) - Number(a.qualified) || b.occurrences - a.occurrences || a.name.localeCompare(b.name)) }));
  const selected = new Set<string>();
  let progressed = true;
  while (progressed && selected.size < expansionLimits.terms) {
    progressed = false;
    for (const queue of queues) {
      while (queue.offset < queue.symbols.length && selected.size < expansionLimits.terms) {
        const symbol = queue.symbols[queue.offset++]!;
        if (selected.has(symbol.name)) continue;
        selected.add(symbol.name); progressed = true; break;
      }
    }
  }
  return [...selected];
}

/** Keep the fixed prefix, then admit two direct matches per expanded hint. */
export function interleaveCandidates<T extends { id: string }>(prefix: readonly T[], lexical: readonly T[], expanded: readonly T[]): T[] {
  const selected = new Map(prefix.map(candidate => [candidate.id, candidate]));
  const queues = [{ items: lexical, offset: 0, allowance: 2 }, { items: expanded, offset: 0, allowance: 1 }];
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const queue of queues) {
      let admitted = 0;
      while (queue.offset < queue.items.length && admitted < queue.allowance) {
        const candidate = queue.items[queue.offset++]!;
        if (selected.has(candidate.id)) continue;
        selected.set(candidate.id, candidate); progressed = true; admitted++;
      }
    }
  }
  return [...selected.values()];
}
