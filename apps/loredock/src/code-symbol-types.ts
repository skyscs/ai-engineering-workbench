import type { FactRange } from './code-analysis-types.js';
import type { SymbolFact } from './code-facts.js';
import type { MapEvidence } from './system-map-types.js';

export const codeSymbolLimits = { queryBytes: 200, matches: 20, outputBytes: 256 * 1024, wallMs: 5000 };
export interface CodeSymbolMatch {
  id: string; fileId: string; sourceId: string; sourceName: string; path: string; revision: string; blob: string; contentHash: string;
  name: string; qualifiedName: string; role: SymbolFact['role']; range: FactRange; evidence: MapEvidence[]; status: 'syntax-only';
}
export interface CodeSymbolResult {
  schemaVersion: 'loredock-code-symbols/1'; buildId: string; query: string; status: 'available' | 'unavailable'; reason: string | null;
  inventory: { id: string; fingerprint: string; policyVersion: number; registryVersion: number } | null;
  limits: typeof codeSymbolLimits; matches: CodeSymbolMatch[]; partial: boolean;
  coverage: { candidateFiles: number; retainedFiles: number; scannedFiles: number; scanComplete: boolean; timeStopped: boolean;
    matchedFiles: number; matchingSymbols: number; matchedSources: number; omittedMatches: number; outputLimited: boolean;
    filesWithSyntaxGaps: number; syntaxGapMessages: number; excluded: number; failed: number; unattempted: number; omitted: number } | null;
  limitation: string;
}
