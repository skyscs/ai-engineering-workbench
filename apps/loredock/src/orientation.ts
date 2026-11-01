import { defaults } from './store.js';
import type { Catalog } from './catalog.js';
import { sha256 } from './extract.js';
import { readMapDocument, type MapDocument } from './map-document.js';
import { CatalogError } from './types.js';
import type { OrientationExcerpt, OrientationSource, ProjectOrientation } from './orientation-types.js';
import type { MapEvidence } from './system-map-types.js';
import { readmeSections, sectionLimits } from './readme-sections.js';
import { readmeLinks, linkedReadingLimits } from './readme-links.js';

export const orientationLimits = { repositories: defaults.sources, documents: 60, fileBytes: 32 * 1024, textBytes: 20 * 32 * 1024,
  fileSpans: 8, excerptBytes: 2000, excerptLines: 16, outputBytes: 512 * 1024, ...sectionLimits, ...linkedReadingLimits } as const;
interface Document extends MapDocument { status: string; reason: string | null }

/** Select original lines, never synthesize a repository role or interpret source instructions. */
function introduction(content: string, refs: MapEvidence[]): OrientationExcerpt | null {
  const lines = content.split('\n'); let fence: string | undefined;
  for (let start = 0; start < lines.length; start++) {
    const line = lines[start]!;
    const delimiter = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (delimiter) { if (!fence) fence = delimiter; else if (delimiter[0] === fence[0] && delimiter.length >= fence.length) fence = undefined; continue; }
    if (fence || !line.trim() || /^\s{0,3}#{1,6}(?:\s|$)/.test(line) || /^ {4}|^\t/.test(line)) continue;
    if (/^\s{0,3}(?:=+|-+)\s*$/.test(lines[start + 1] ?? '')) { start++; continue; }
    const selected: string[] = []; let truncated = false;
    for (let index = start; index < lines.length; index++) {
      const current = lines[index]!;
      if (!current.trim() || /^\s{0,3}(?:#{1,6}(?:\s|$)|`{3,}|~{3,})/.test(current)) break;
      if (selected.length >= orientationLimits.excerptLines || Buffer.byteLength([...selected, current].join('\n')) > orientationLimits.excerptBytes) { truncated = true; break; }
      selected.push(current);
    }
    if (!selected.length) return null;
    const startLine = start + 1, endLine = start + selected.length;
    const evidenceIds = refs.filter(span => span.startLine <= endLine && span.endLine >= startLine).map(span => span.id);
    return { text: selected.join('\n'), startLine, endLine, evidenceIds, truncated, provenance: 'documented', verification: 'unverified' };
  }
  return null;
}

/** Disposable orientation over one pinned source set; no Git, model or source execution. */
export function projectOrientation(catalog: Catalog, buildId?: string): ProjectOrientation {
  const build = catalog.readBuild(buildId), store = catalog.store, project = store.project();
  const sources = build.sources.filter(source => store.source(source.sourceId).status === 'active');
  if (sources.length > orientationLimits.repositories) throw new CatalogError('ORIENTATION_LIMIT', 'This index exceeds the orientation repository limit.', 409);
  const evidence: Record<string, MapEvidence> = {}, omissions: Record<string, number> = {};
  let parsedBytes = 0, examinedDocuments = 0;
  const omit = (reason: string) => { omissions[reason] = (omissions[reason] ?? 0) + 1; };
  const cards: OrientationSource[] = sources.map(source => ({ sourceId: source.sourceId, sourceName: source.name, revision: source.revision,
    sourceStatus: source.status, coverage: source.coverage, omittedInventory: source.omitted,
    readme: { path: null, state: 'missing', reason: 'No supported root README is recorded in this index. Nested documentation remains available through source search when indexed.' },
    context: null, sections: [], omittedSections: 0, linkedDocuments: [], omittedLinkedDocuments: 0, reading: [], gaps: [] }));
  function read(file: Document, card: OrientationSource) {
    if (file.status !== 'indexed') { card.gaps.push(`${file.path} is ${file.status}: ${file.reason ?? 'original text unavailable'}.`); omit('document-not-indexed'); return null; }
    if (!Number.isSafeInteger(file.size) || !Number.isSafeInteger(file.storedBytes) || file.size < 0 || file.storedBytes < 0) {
      throw new CatalogError('CORRUPT_EVIDENCE', 'Orientation source byte metadata is invalid.', 409);
    }
    let reason: string | undefined;
    if (file.size > orientationLimits.fileBytes || file.storedBytes > orientationLimits.fileBytes) reason = 'file-byte-limit';
    else if (examinedDocuments >= orientationLimits.documents) reason = 'document-limit';
    else if (parsedBytes + Math.max(file.size, file.storedBytes) > orientationLimits.textBytes) reason = 'input-byte-limit';
    const issued = reason ? [] : store.all<{ id: string }>('SELECT id FROM spans WHERE fileId=? ORDER BY startLine LIMIT ?', file.id, orientationLimits.fileSpans + 1);
    if (!reason && issued.length > orientationLimits.fileSpans) reason = 'file-span-limit';
    if (reason) { omit(reason); card.gaps.push(`${file.path} exceeds the orientation ${reason}. Open it through source search when available.`); return null; }
    const document = readMapDocument(catalog, build.id, file, issued);
    parsedBytes += document.raw.length; examinedDocuments++;
    for (const span of document.refs) evidence[span.id] = span;
    return document;
  }
  const documents = (sourceId: string, condition: string) => store.all<Document>(`SELECT f.id,f.sourceId,f.path,f.size,length(f.raw) AS storedBytes,f.status,f.reason
    FROM files f WHERE f.buildId=? AND f.sourceId=? AND ${condition} ORDER BY f.path LIMIT 4`, build.id, sourceId);
  // Give every repository's README priority over optional package reading links.
  for (const card of cards) {
    const source = sources.find(source => source.sourceId === card.sourceId)!;
    if (source.status === 'failed') card.gaps.push('Repository inventory failed; available documentation does not establish complete source coverage.');
    if (source.omitted) card.gaps.push('Repository inventory reached its path limit; missing documentation may be outside the recorded inventory.');
    if (source.coverage.excluded || source.coverage.failed) card.gaps.push('Some source files were excluded or failed; this card is not a complete repository analysis.');
    const candidates = documents(card.sourceId, "instr(f.path,'/')=0 AND lower(f.path) IN ('readme','readme.md','readme.txt')");
    if (candidates.length > 1) {
      card.readme = { path: null, state: 'ambiguous', reason: 'Several supported root README files are recorded. No preferred document or repository role is inferred; inspect source search.' };
      omit('ambiguous-readme'); continue;
    }
    const file = candidates[0];
    if (!file) {
      if (source.status === 'failed' || source.omitted) card.readme = { path: null, state: 'unavailable', reason: 'The root README cannot be determined from the incomplete repository inventory.' };
      omit('missing-readme'); continue;
    }
    const document = read(file, card);
    if (!document) {
      card.readme = { path: file.path, state: file.status === 'indexed' ? 'limited' : file.status === 'excluded' || file.status === 'purged' ? 'excluded' : 'unavailable',
        reason: card.gaps.at(-1)! }; continue;
    }
    card.reading.push({ kind: 'readme', path: file.path, evidenceIds: document.refs.map(span => span.id) });
    card.context = introduction(document.content, document.refs);
    Object.assign(card, readmeSections(document.content, document.refs));
    const linked = readmeLinks(document.content, file.path, document.refs);
    card.omittedLinkedDocuments = linked.omittedLinkedDocuments;
    card.linkedDocuments = linked.links.map(link => ({ ...link, state: 'missing', evidenceIds: [],
      reason: 'This linked document is not recorded in the selected index. It may be missing or outside inventory coverage.' }));
    if (card.omittedLinkedDocuments) { card.gaps.push(`${card.omittedLinkedDocuments} distinct local documentation links exceed navigation label/path/count limits.`); omit('linked-document-navigation-limit'); }
    if (card.omittedSections) { card.gaps.push(`${card.omittedSections} README headings are not listed because their labels are empty or exceed navigation limits.`); omit('section-navigation-limit'); }
    card.readme = { path: file.path, state: card.context ? 'available' : 'no-prose', reason: card.context
      ? 'Original introductory README lines; documented intent may be incomplete or outdated.'
      : 'No introductory prose fits the preview. Open the original README; no role is inferred from names, headings or code blocks.' };
    if (!card.context) omit('no-introductory-prose');
    if (card.context?.truncated) { card.gaps.push('The introductory paragraph exceeds the excerpt limit; only complete leading lines are shown.'); omit('excerpt-limit'); }
  }
  for (const card of cards) for (const file of documents(card.sourceId, "f.path IN ('package.json','pom.xml')")) {
    const document = read(file, card);
    if (document) card.reading.push({ kind: 'manifest', path: file.path, evidenceIds: document.refs.map(span => span.id) });
  }
  // Preserve README/manifest priority; share remaining reading capacity in source rounds.
  for (let round = 0; round < orientationLimits.linkedDocuments; round++) for (const card of cards) {
    const link = card.linkedDocuments[round]; if (!link) continue;
    const file = store.one<Document>(`SELECT f.id,f.sourceId,f.path,f.size,length(f.raw) AS storedBytes,f.status,f.reason
      FROM files f WHERE f.buildId=? AND f.sourceId=? AND f.path=?`, build.id, card.sourceId, link.path);
    if (!file) { omit('linked-document-not-recorded'); card.gaps.push(`${link.path}: ${link.reason}`); continue; }
    const document = read(file, card);
    if (document) { link.state = 'available'; link.reason = 'Original linked document from this saved repository revision; README intent is unverified.';
      link.evidenceIds = document.refs.map(ref => ref.id); }
    else { link.state = file.status === 'indexed' ? 'limited' : ['excluded', 'purged'].includes(file.status) ? 'excluded' : 'unavailable';
      link.reason = card.gaps.at(-1)!; }
  }
  const unindexedSources = store.all<{ id: string; name: string }>("SELECT id,name FROM sources WHERE status='active' ORDER BY rowid")
    .filter(source => !sources.some(recorded => recorded.sourceId === source.id)).map(({ id, name }) => ({ sourceId: id, sourceName: name }));
  const gaps = ['README excerpts are documented intent, not verified repository responsibilities, current configuration or deployment evidence.',
    'This view provides a starting point; it does not synthesize a complete architecture, reconcile contradictions or understand every source file.'];
  if (build.status === 'partial') gaps.push('The source index is partial; inspect source coverage and exclusions.');
  if (sources.length !== build.sources.length) gaps.push('Revoked sources and their documentation are excluded.');
  if (unindexedSources.length) gaps.push('Active repositories outside this saved index need a new knowledge update; their content is not mixed into this view.');
  const result = { schemaVersion: 'loredock-orientation-v3' as const, adapterVersion: 'readme-orientation-v4' as const, buildId: build.id,
    policyVersion: build.policyVersion, sourceSetVersion: build.sourceSetVersion, registryVersion: project.sourceSetVersion,
    stale: build.id !== project.publishedBuildId || build.sourceSetVersion !== project.sourceSetVersion,
    partial: true as const, deploymentCoherence: 'unknown' as const, sources: cards, unindexedSources, evidence, gaps, omissions,
    coverage: { repositories: cards.length, withContext: cards.filter(card => card.context).length, examinedDocuments, parsedBytes }, limits: orientationLimits };
  const output = { ...result, inputHash: sha256(JSON.stringify(result)) };
  if (Buffer.byteLength(JSON.stringify(output)) > orientationLimits.outputBytes) throw new CatalogError('ORIENTATION_LIMIT', 'Orientation output exceeds its byte budget.', 409);
  return output;
}
