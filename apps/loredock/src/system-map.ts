import path from 'node:path';
import type { Catalog } from './catalog.js';
import { extract, sha256, spans } from './extract.js';
import { CatalogError } from './types.js';
import type { DeclarationMap, MapEdge, MapEvidence, MapNode, MapNodeKind } from './system-map-types.js';

export const mapLimits = { documents: 100, fileBytes: 32 * 1024, textBytes: 256 * 1024,
  fileSpans: 8, members: 100, nodes: 150, edges: 250, comparisons: 2000, outputBytes: 512 * 1024 } as const;
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max = 512): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\x00-\x1f\x7f]/.test(value);
const scalar = (value: unknown): value is string | number | boolean => text(value) || (typeof value === 'number' && Number.isFinite(value)) || typeof value === 'boolean';
type Document = { id: string; sourceId: string; path: string; size: number; storedBytes: number };
type Comparison = { node: MapNode; group: string; signature: string; family: 'contract' | 'setting' };

/** A disposable read projection over original authorized evidence, never a model claim store. */
export function declarationMap(catalog: Catalog, buildId?: string): DeclarationMap {
  const build = catalog.readBuild(buildId), project = catalog.store.project();
  const sources = build.sources.filter(source => catalog.store.source(source.sourceId).status === 'active');
  const nodes: MapNode[] = [], edges: MapEdge[] = [], evidence = new Map<string, MapEvidence>();
  const omissions: Record<string, number> = {}, comparisons: Comparison[] = [];
  let bytes = 0, parsedBytes = 0, examinedDocuments = 0;
  const omit = (reason: string, count = 1) => { omissions[reason] = (omissions[reason] ?? 0) + count; };
  const id = (...parts: unknown[]) => sha256(JSON.stringify([build.id, 'json-declarations-v1', ...parts]));
  function reserve(item: MapNode | MapEdge, refs: MapEvidence[]) {
    const fresh = refs.filter(ref => !evidence.has(ref.id));
    const cost = Buffer.byteLength(JSON.stringify(item)) + 1 + fresh.reduce((sum, ref) => sum + Buffer.byteLength(JSON.stringify(ref)) + ref.id.length + 4, 0);
    if (bytes + cost > mapLimits.outputBytes - 16 * 1024) { omit('output-byte-limit'); return false; }
    bytes += cost; for (const ref of fresh) evidence.set(ref.id, ref); return true;
  }
  function edge(kind: MapEdge['kind'], from: MapNode, to: MapNode, status: MapEdge['status'], reason: string) {
    if (edges.length >= mapLimits.edges) { omit('edge-limit'); return; }
    const item: MapEdge = { id: id('edge', kind, from.id, to.id), kind, from: from.id, to: to.id, status,
      environment: from.environment === to.environment ? from.environment : null, reason,
      evidenceIds: [...new Set([...from.evidenceIds, ...to.evidenceIds])].sort() };
    if (reserve(item, [])) edges.push(item);
  }
  const repositories = new Map<string, MapNode>();
  for (const source of sources) {
    const item: MapNode = { id: id('repository', source.sourceId), kind: 'repository', label: source.name,
      sourceId: source.sourceId, sourceName: source.name, revision: source.revision, environment: null,
      provenance: 'catalog', properties: { status: source.status }, evidenceIds: [] };
    if (reserve(item, [])) { nodes.push(item); repositories.set(source.sourceId, item); }
  }
  const indexedFiles = catalog.store.one<{ count: number }>(`SELECT count(*) AS count FROM files f JOIN sources src ON src.id=f.sourceId
    WHERE f.buildId=? AND f.status='indexed' AND src.status='active'`, build.id)!.count;
  const predicate = "(lower(f.path) LIKE '%.json' OR lower(f.path)='pom.xml' OR lower(f.path) LIKE '%/pom.xml')";
  const candidateDocuments = catalog.store.one<{ count: number }>(`SELECT count(*) AS count FROM files f JOIN sources src ON src.id=f.sourceId
    WHERE f.buildId=? AND f.status='indexed' AND src.status='active' AND ${predicate}`, build.id)!.count;
  const documents = catalog.store.all<Document>(`SELECT id,sourceId,path,size,storedBytes FROM (
    SELECT f.id,f.sourceId,f.path,f.size,length(f.raw) AS storedBytes,
      row_number() OVER (PARTITION BY f.sourceId ORDER BY length(f.path),f.path) AS position
    FROM files f JOIN sources src ON src.id=f.sourceId WHERE f.buildId=? AND f.status='indexed' AND src.status='active' AND ${predicate})
    ORDER BY position,sourceId,path LIMIT ?`, build.id, mapLimits.documents);
  if (candidateDocuments > documents.length) omit('document-limit', candidateDocuments - documents.length);
  for (const file of documents) {
    if (!Number.isSafeInteger(file.size) || !Number.isSafeInteger(file.storedBytes) || file.size < 0 || file.storedBytes < 0) throw new CatalogError('CORRUPT_EVIDENCE', 'Map source bytes are unavailable.', 409);
    if (file.size > mapLimits.fileBytes || file.storedBytes > mapLimits.fileBytes) { omit('file-byte-limit'); continue; }
    if (parsedBytes + file.size > mapLimits.textBytes) { omit('input-byte-limit'); continue; }
    const issued = catalog.store.all<{ id: string }>('SELECT id FROM spans WHERE fileId=? ORDER BY startLine LIMIT ?', file.id, mapLimits.fileSpans + 1);
    if (!issued.length) throw new CatalogError('CORRUPT_EVIDENCE', 'Map document has no issued evidence spans.', 409);
    if (issued.length > mapLimits.fileSpans) { omit('file-span-limit'); continue; }
    const checked = issued.map(span => catalog.evidence(span.id));
    if (checked.some(span => span.buildId !== build.id || span.sourceId !== file.sourceId || span.path !== file.path)) throw new CatalogError('CORRUPT_EVIDENCE', 'Map evidence does not match its indexed file.', 409);
    const raw = catalog.store.one<{ raw: Uint8Array }>('SELECT raw FROM files WHERE id=?', file.id)!.raw;
    if (raw.length !== file.size || sha256(Buffer.from(raw)) !== checked[0]!.contentHash) throw new CatalogError('CORRUPT_EVIDENCE', 'Map source bytes failed validation.', 409);
    const content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(raw).replaceAll('\r\n', '\n');
    const expected = spans(content);
    if (expected.length !== checked.length || expected.some((span, index) => span.startLine !== checked[index]!.startLine || span.endLine !== checked[index]!.endLine || span.text !== checked[index]!.text)) throw new CatalogError('CORRUPT_EVIDENCE', 'Map evidence does not cover the complete declaration document.', 409);
    parsedBytes += raw.length; examinedDocuments++;
    const source = sources.find(source => source.sourceId === file.sourceId)!, repository = repositories.get(file.sourceId)!;
    const refs: MapEvidence[] = checked.map(({ id, sourceName, path, revision, startLine, endLine }) => ({ id, sourceName, path, revision, startLine, endLine }));
    let environment: string | null = null;
    function node(kind: MapNodeKind, pointer: string, label: string, properties: Record<string, string>): MapNode | undefined {
      const nodeId = id('node', file.sourceId, file.path, kind, pointer), existing = nodes.find(item => item.id === nodeId);
      if (existing) return existing;
      if (nodes.length >= mapLimits.nodes) { omit('node-limit'); return; }
      const item: MapNode = { id: nodeId, kind, label, sourceId: source.sourceId, sourceName: source.name, revision: source.revision,
        environment, provenance: 'declaration', properties, evidenceIds: refs.map(ref => ref.id) };
      if (!reserve(item, refs)) return;
      nodes.push(item); edge('declares', repository, item, 'declared', 'The indexed repository contains this declaration; service/runtime ownership is not inferred.'); return item;
    }
    if (path.posix.basename(file.path).toLowerCase() === 'pom.xml') {
      const result = extract(Buffer.from(raw), file.path);
      if ('reason' in result) { omit('unsupported-maven'); continue; }
      const props = Object.fromEntries(Object.entries(result.metadata).filter(([key, value]) => key !== 'kind' && scalar(value)).map(([key, value]) => [key, String(value)]));
      node('package', 'project', props.artifactId ?? file.path, props); continue;
    }
    let value: unknown;
    try { value = JSON.parse(content) as unknown; }
    catch { throw new CatalogError('CORRUPT_EVIDENCE', 'Indexed JSON is no longer valid.', 409); }
    if (!object(value)) { omit('unsupported-json'); continue; }
    if (value.environment !== undefined && value.environment !== null && !text(value.environment, 80)) { omit('unsupported-environment'); continue; }
    if (text(value.environment, 80)) environment = value.environment;
    if (path.posix.basename(file.path).toLowerCase() === 'package.json') {
      if (text(value.name, 256)) node('package', 'package', value.name, { name: value.name, ...scalar(value.version) ? { version: String(value.version) } : {} });
      else omit('unsupported-package');
    } else if (Array.isArray(value.routes)) {
      if (value.routes.length > mapLimits.members) omit('member-limit', value.routes.length - mapLimits.members);
      for (const [index, route] of value.routes.slice(0, mapLimits.members).entries()) {
        if (!object(route) || !text(route.method, 16) || !/^[A-Z]+$/.test(route.method) || !text(route.path, 512) || !route.path.startsWith('/') || !text(route.handler, 256)) { omit('unsupported-route'); continue; }
        const declared = node('http-route', `routes/${index}`, `${route.method} ${route.path}`, { method: route.method, path: route.path });
        const handler = node('handler-reference', route.handler, route.handler, { handler: route.handler, implementation: 'unresolved' });
        if (declared && handler) edge('routes-to', declared, handler, 'declared', 'The route declaration names this handler; its code implementation has not been resolved.');
      }
    } else if (text(value.name, 256) && object(value.fields) && text(value.transport, 128)) {
      if (!(text(value.version, 128) || (typeof value.version === 'number' && Number.isSafeInteger(value.version) && value.version >= 0))) { omit('unsupported-contract'); continue; }
      const fields = Object.entries(value.fields).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
      if (Object.keys(value).some(key => !['name', 'version', 'fields', 'transport', 'key', 'encoding', 'environment'].includes(key))
        || (value.key !== undefined && !text(value.key)) || (value.encoding !== undefined && !text(value.encoding))
        || fields.length > mapLimits.members || !fields.every(([key, type]) => text(key, 128) && text(type, 256))) { omit('unsupported-contract'); continue; }
      const props = { name: value.name, version: String(value.version), transport: value.transport,
        fields: JSON.stringify(Object.fromEntries(fields)), ...text(value.key) ? { key: value.key } : {}, ...text(value.encoding) ? { encoding: value.encoding } : {} };
      const declared = node('event-contract', 'contract', `${value.name} v${value.version}`, props);
      if (declared) comparisons.push({ node: declared, family: 'contract', group: JSON.stringify(['contract', environment, value.name, value.version]), signature: JSON.stringify(props) });
    } else if (/(^|\/)config\//i.test(file.path)) {
      const members = Object.entries(value).filter(([key]) => key !== 'environment');
      if (members.length > mapLimits.members) omit('member-limit', members.length - mapLimits.members);
      for (const [key, setting] of members.slice(0, mapLimits.members)) {
        if (!text(key, 128) || !scalar(setting)) { omit('unsupported-setting'); continue; }
        const declared = node('setting', key, key, { value: String(setting), valueType: typeof setting });
        if (declared) comparisons.push({ node: declared, family: 'setting', group: JSON.stringify(['setting', environment, key]), signature: JSON.stringify(setting) });
      }
    } else omit('unsupported-json');
  }
  let compared = 0;
  for (let i = 0; i < comparisons.length; i++) for (let j = i + 1; j < comparisons.length; j++) {
    const a = comparisons[i]!, b = comparisons[j]!;
    if (a.node.sourceId === b.node.sourceId || a.group !== b.group) continue;
    if (compared++ >= mapLimits.comparisons) { omit('comparison-limit'); continue; }
    const equal = a.signature === b.signature;
    edge(`${a.family}-${equal ? 'match' : 'difference'}`, a.node, b.node, equal ? 'candidate' : 'difference', a.family === 'contract'
      ? equal ? 'Matching static contract shapes; producer/consumer roles, encoding implementation and deployment compatibility are unverified.' : 'Same-name/version declarations differ; this does not establish runtime incompatibility. Review both sources.'
      : equal ? 'Equal scoped keys and values are a search clue; repository-owned keys do not prove a shared service, broker or runtime connection.' : 'Repository-owned configuration values differ in the same declared scope; this alone is not a runtime conflict.');
  }
  const gaps = ['Only supported declarations are mapped; source-code calls, service identities and complete business flows remain unresolved.',
    'README prose and runtime/deployment behavior are not analyzed by this projection.', 'Candidate matches do not merge entities or establish deployment coherence.'];
  if (build.status === 'partial') gaps.push('The source index is partial; excluded and failed material is unavailable.');
  if (sources.length !== build.sources.length) gaps.push('Revoked sources and their comparisons are excluded.');
  if (build.sourceSetVersion !== project.sourceSetVersion) gaps.push('The source registry changed after this index; newly registered sources are not part of this map.');
  if (Object.keys(omissions).length) gaps.push('Some declarations were omitted or unsupported; inspect the coverage details.');
  const result = { schemaVersion: 'loredock-map-v1' as const, adapterVersion: 'json-declarations-v1' as const, buildId: build.id,
    policyVersion: build.policyVersion, sourceSetVersion: build.sourceSetVersion, registryVersion: project.sourceSetVersion,
    stale: build.sourceSetVersion !== project.sourceSetVersion || build.id !== project.publishedBuildId,
    partial: true as const, deploymentCoherence: 'unknown' as const, nodes, edges, evidence: Object.fromEntries(evidence), gaps, omissions,
    coverage: { indexedFiles, candidateDocuments, examinedDocuments, parsedBytes }, limits: mapLimits };
  const output = { ...result, inputHash: sha256(JSON.stringify(result)) };
  if (Buffer.byteLength(JSON.stringify(output)) > mapLimits.outputBytes) throw new CatalogError('MAP_LIMIT', 'The map response exceeds its byte limit.', 409);
  return output;
}
