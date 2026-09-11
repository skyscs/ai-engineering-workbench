export interface Evidence {
  id: string;
  kind: 'repository_file' | 'git_commit' | 'artifact';
  description: string;
  repositoryId: string | null;
  revision: string | null;
  path: string | null;
  lineStart: number | null;
  lineEnd: number | null;
  artifactId: string | null;
  sha256: string | null;
  byteStart: number | null;
  byteEnd: number | null;
}
export interface InvestigationResult {
  investigation: { summary: string; timeline: { description: string; evidenceIds: string[] }[] };
  rootCause: { status: 'identified' | 'insufficient_evidence'; summary: string; evidenceIds: string[]; unresolvedQuestions: string[] };
  evidence: Evidence[];
}
/** One immutable publication contains the investigation and its associated root cause. */
export interface InvestigationReport {
  id: string; rootCauseId: string; taskId: string; stageRunId: string; version: number;
  contextRevision: number; createdAt: string; status: 'active' | 'superseded'; freshness: 'fresh' | 'stale';
  result: InvestigationResult;
}
export interface EvidenceContent { locator: string; text: string }
