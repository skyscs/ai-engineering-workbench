import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { sha256 } from './extract.js';
import type { SourceGit } from './git.js';
import { CatalogStore, defaults } from './store.js';
import { CatalogError, type SourcePreview, type SourcePreviewRow, type SourceReceipt } from './types.js';

function pathsInput(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length || value.length > 40 || !value.every(p => typeof p === 'string' && p.length > 0 && p.length <= 4096)
    || Buffer.byteLength(JSON.stringify(value)) > 8192) throw new CatalogError('INVALID_PATHS', 'Use 1–40 explicit paths within 8 KiB.');
  return value as string[];
}

/** Explicit local paths only; preview performs no writes or source discovery. */
export class SourceRegistration {
  constructor(private readonly store: CatalogStore, private readonly git: SourceGit) {}
  async preview(value: unknown): Promise<SourcePreview> {
    const paths = pathsInput(value), sourceSetVersion = this.store.project().sourceSetVersion;
    const active = this.store.sources().filter(source => source.status === 'active');
    const rows: SourcePreviewRow[] = [], signal = AbortSignal.timeout(30000);
    for (const input of paths) {
      try {
        const identity = await this.git.identity(input, signal);
        if (identity.path === this.store.directory || identity.path.startsWith(this.store.directory + path.sep)) throw new CatalogError('INVALID_PATH', 'Sources must be outside the LoreDock data directory.');
        const existing = active.find(source => source.gitDir === identity.gitDir);
        const duplicate = rows.find(row => row.gitDir === identity.gitDir);
        rows.push({ input, ...identity, status: existing ? 'existing' : duplicate ? 'duplicate' : 'ready',
          reason: existing ? `Already registered as ${existing.name}.` : duplicate ? `Same Git repository as ${duplicate.input}.` : 'Ready to add.' });
      } catch (error) {
        rows.push({ input, status: 'invalid', reason: error instanceof Error ? error.message.slice(0, 1024) : 'Repository validation failed.' });
      }
    }
    if (sourceSetVersion !== this.store.project().sourceSetVersion) throw new CatalogError('STALE_PREVIEW', 'Repositories changed. Preview the paths again.', 409);
    const ready = rows.filter(row => row.status === 'ready').length, available = defaults.sources - active.length;
    const result = { sourceSetVersion, rows, ready, available, canRegister: ready > 0 && ready <= available };
    return { ...result, previewHash: sha256(JSON.stringify(result)) };
  }
  async register(input: Record<string, unknown>): Promise<SourceReceipt> {
    const paths = pathsInput(input.paths), { requestId, previewHash } = input;
    if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(requestId) || typeof previewHash !== 'string' || !/^[a-f0-9]{64}$/.test(previewHash)) throw new CatalogError('INVALID_REQUEST', 'Request ID and reviewed preview hash are required.');
    const payloadHash = sha256(JSON.stringify({ paths, previewHash }));
    const replay = () => {
      const previous = this.store.one<{ payloadHash: string; receipt: string }>('SELECT payloadHash,receipt FROM source_registrations WHERE requestId=?', requestId);
      if (!previous) return;
      if (previous.payloadHash !== payloadHash) throw new CatalogError('CONFLICT', 'This request ID was already used with different inputs.', 409);
      // IDs and registry revision only: replay never restores sources or returns purged text.
      return JSON.parse(previous.receipt) as SourceReceipt;
    };
    const previous = replay(); if (previous) return previous;
    let preview: SourcePreview;
    try { preview = await this.preview(paths); }
    catch (error) { const completed = replay(); if (completed) return completed; throw error; }
    return this.store.transaction(() => {
      const concurrent = replay(); if (concurrent) return concurrent;
      if (preview.previewHash !== previewHash || preview.sourceSetVersion !== this.store.project().sourceSetVersion) throw new CatalogError('STALE_PREVIEW', 'Repositories or paths changed. Preview the paths again.', 409);
      if (!preview.canRegister) throw new CatalogError('SOURCE_LIMIT', 'No valid new sources fit the twenty-repository limit. Edit the list and preview again.');
      const sourceIds: string[] = [];
      for (const row of preview.rows.filter(row => row.status === 'ready')) {
        const id = randomUUID(); sourceIds.push(id);
        this.store.run("INSERT INTO sources VALUES (?,?,?,?, 'active','none')", id, path.basename(row.path!), row.path!, row.gitDir!);
      }
      this.store.run('UPDATE project SET sourceSetVersion=sourceSetVersion+1 WHERE id=1');
      const receipt = { sourceIds, sourceSetVersion: this.store.project().sourceSetVersion };
      this.store.run('INSERT INTO source_registrations VALUES (?,?,?)', requestId, payloadHash, JSON.stringify(receipt));
      return receipt;
    });
  }
}
