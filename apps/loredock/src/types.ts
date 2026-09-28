// Transport-only declarations: safe for type-only imports by the LoreDock UI.
export type BuildStatus = 'preparing' | 'running' | 'pause_requested' | 'paused' | 'interrupted' | 'cancelled' | 'completed' | 'partial' | 'failed';
export interface Policy { excludedPaths: string[] }
export interface Source { id: string; name: string; path: string; gitDir: string; status: 'active' | 'revoked'; purge: 'none' | 'pending' | 'completed' }
export interface Coverage { indexed: number; excluded: number; failed: number; pending: number; bytes: number; reasons: Record<string, number> }
export interface BuildSource {
  sourceId: string; name: string; revision: string | null; tree: string | null;
  status: 'pending' | 'ready' | 'failed'; dirty: boolean | null; error: string | null; omitted: number; coverage: Coverage;
}
export interface Build {
  id: string; status: BuildStatus; policyVersion: number; sourceSetVersion: number; createdAt: string;
  extractorVersion: string;
  reason: string | null; published: boolean; sources: BuildSource[]; coverage: Coverage;
}
export interface ProjectState {
  name: string; policy: Policy; policyVersion: number; sourceSetVersion: number;
  publishedBuildId: string | null; sources: Source[]; builds: Build[];
  limits: { sources: number; paths: number; fileBytes: number; totalBytes: number; wallMs: number };
}
export interface SearchHit { id: string; sourceId: string; sourceName: string; revision: string; path: string; startLine: number; endLine: number; snippet: string }
export interface SearchResult { buildId: string; stale: boolean; partial: boolean; hits: SearchHit[] }
export interface Evidence extends SearchHit { buildId: string; contentHash: string; spanHash: string; blobId: string; text: string; metadata: Record<string, unknown> }
export class CatalogError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: 400 | 403 | 404 | 409 | 422 = 400) { super(message); }
}
