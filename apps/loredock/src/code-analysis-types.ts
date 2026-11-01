import type { CodeFacts } from './code-facts.js';
import type { MapEvidence } from './system-map-types.js';

export const codeAnalysisLimits = { documents: 10000, fileBytes: 32768, fileSpans: 8, textBytes: 50 * 1024 * 1024,
  filePayloadBytes: 128 * 1024, payloadBytes: 16 * 1024 * 1024, wallMs: 300000 };
export type AnalysisLimits = typeof codeAnalysisLimits;
export type AnalysisStatus = 'running' | 'paused' | 'interrupted' | 'cancelled' | 'failed' | 'completed' | 'partial' | 'fenced';
export interface AnalysisRow {
  id: string; requestId: string; payloadHash: string; buildId: string; policyVersion: number; registryVersion: number;
  fingerprint: string; limits: string; manifestHash: string; candidates: number; status: AnalysisStatus; published: number;
  elapsedMs: number; textBytes: number; payloadBytes: number; createdAt: string; reason: string | null;
}
export interface AnalysisFile {
  id: string; sourceId: string; sourceName: string; revision: string; path: string; blob: string;
  contentHash: string; size: number; storedBytes: number;
}
export interface AnalysisUnit {
  runId: string; fileId: string; ordinal: number; inputHash: string;
  status: 'pending' | 'parsed' | 'excluded' | 'failed' | 'unattempted' | 'omitted'; reason: string | null;
  inputBytes: number; payloadBytes: number; gapCount: number; payload: string | null; payloadHash: string | null; checkpointHash: string | null;
}
export interface FactRange { startLine: number; endLine: number; textHash: string }
export interface FactRanges {
  offsetEncoding: 'UTF-16 code units'; symbols: (FactRange & { key: string })[];
  operations: (FactRange & { owner: string; kind: string })[];
}
export interface AnalysisPayload {
  schemaVersion: 'loredock-file-facts/1'; inputHash: string; fingerprint: string; buildId: string; fileId: string;
  sourceId: string; sourceName: string; revision: string; path: string; blob: string; contentHash: string;
  facts: CodeFacts; ranges: FactRanges; evidence: MapEvidence[];
}
export interface AnalysisSummary {
  id: string; buildId: string; status: AnalysisStatus; published: boolean; createdAt: string; reason: string | null;
  candidates: number; counts: Record<string, number>; gaps: number; filesWithGaps: number; examined: number;
  textBytes: number; payloadBytes: number; elapsedMs: number; limits: AnalysisLimits; fingerprint: string; currentParser: boolean; staleIndex: boolean;
}
export interface AnalysisFileSummary {
  fileId: string; sourceId: string; sourceName: string; path: string; status: AnalysisUnit['status']; reason: string | null; gapCount: number;
}
export interface AnalysisState {
  inventories: AnalysisSummary[]; pendingBuildId: string | null; automaticError: { buildId: string; message: string } | null;
}
