import type { Catalog } from './catalog.js';
import { sha256, spans } from './extract.js';
import { CatalogError } from './types.js';
import type { MapEvidence } from './system-map-types.js';

export interface MapDocument { id: string; sourceId: string; path: string; size: number; storedBytes: number }

/** Call only after checking metadata byte/span budgets; never accept a partial file. */
export function readMapDocument(catalog: Catalog, buildId: string, file: MapDocument, issued: { id: string }[]) {
  if (!issued.length) throw new CatalogError('CORRUPT_EVIDENCE', 'Map document has no issued evidence spans.', 409);
  const checked = issued.map(span => catalog.evidence(span.id));
  if (checked.some(span => span.buildId !== buildId || span.sourceId !== file.sourceId || span.path !== file.path)) {
    throw new CatalogError('CORRUPT_EVIDENCE', 'Map evidence does not match its indexed file.', 409);
  }
  const raw = catalog.store.one<{ raw: Uint8Array }>('SELECT raw FROM files WHERE id=?', file.id)!.raw;
  if (raw.length !== file.size || sha256(Buffer.from(raw)) !== checked[0]!.contentHash) {
    throw new CatalogError('CORRUPT_EVIDENCE', 'Map source bytes failed validation.', 409);
  }
  const content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(raw).replaceAll('\r\n', '\n');
  const expected = spans(content);
  if (expected.length !== checked.length || expected.some((span, index) => span.startLine !== checked[index]!.startLine
    || span.endLine !== checked[index]!.endLine || span.text !== checked[index]!.text)) {
    throw new CatalogError('CORRUPT_EVIDENCE', 'Map evidence does not cover the complete declaration document.', 409);
  }
  const refs: MapEvidence[] = checked.map(({ id, sourceName, path, revision, startLine, endLine }) => ({ id, sourceName, path, revision, startLine, endLine }));
  return { raw: Buffer.from(raw), content, refs };
}
