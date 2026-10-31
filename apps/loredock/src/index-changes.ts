import type { Catalog } from './catalog.js';
import { defaults } from './store.js';
import { safePath } from './git.js';
import { CatalogError } from './types.js';
import type { FileChangeCounts, FileChangeKind, IndexChanges } from './index-change-types.js';

export const changeLimits = { filesPerIndex: defaults.paths, details: 100, outputBytes: 512 * 1024 } as const;
const counts = (): FileChangeCounts => ({ initial: 0, added: 0, changed: 0, removed: 0, unchanged: 0, coverageChanged: 0, uncompared: 0 });
interface Entry { sourceId: string; path: string; mode: string; blob: string; size: number; status: string; reason: string | null; evidenceId: string | null }
const key = (entry: Entry) => JSON.stringify([entry.sourceId, entry.path]);

/** Inventory metadata only. Incomplete inventories cannot establish file absence. */
export function indexChanges(catalog: Catalog, buildId?: string): IndexChanges {
  const build = catalog.readBuild(buildId), project = catalog.store.project();
  const baseline = build.refresh.baselineBuildId ? catalog.readBuild(build.refresh.baselineBuildId) : undefined;
  const active = (id: string) => catalog.store.source(id).status === 'active';
  const currentSources = build.sources.filter(source => active(source.sourceId)), previousSources = baseline?.sources.filter(source => active(source.sourceId)) ?? [];
  function inventory(id: string): Entry[] {
    const records = catalog.store.all<Entry>(`SELECT f.sourceId,f.path,f.mode,f.blob,f.size,f.status,f.reason,
      (SELECT s.id FROM spans s WHERE s.fileId=f.id AND f.status='indexed' ORDER BY s.startLine LIMIT 1) AS evidenceId
      FROM files f JOIN sources src ON src.id=f.sourceId WHERE f.buildId=? AND src.status='active'
      ORDER BY f.sourceId,f.path LIMIT ?`, id, changeLimits.filesPerIndex + 1);
    if (records.length > changeLimits.filesPerIndex) throw new CatalogError('CHANGE_LIMIT', 'This inventory exceeds the comparison file limit.', 409);
    return records;
  }
  const now = inventory(build.id), before = baseline ? inventory(baseline.id) : [];
  const currentFiles = new Map(now.map(entry => [key(entry), entry])), previousFiles = new Map(before.map(entry => [key(entry), entry]));
  const comparison = !build.refresh.version ? 'legacy' : baseline ? 'update' : 'initial';
  const total = counts(), details: IndexChanges['files'] = [], candidates: IndexChanges['files'][] = [], gaps: string[] = [];
  let complete = comparison !== 'legacy';
  const sources = currentSources.map(source => {
    const previous = previousSources.find(previous => previous.sourceId === source.sourceId);
    const currentComplete = source.status === 'ready' && !source.omitted, previousComplete = !previous || previous.status === 'ready' && !previous.omitted;
    const inventoryComplete = currentComplete && previousComplete;
    if (!inventoryComplete) complete = false;
    const sourceCounts = counts(), sourceDetails: IndexChanges['files'] = [];
    const entries = new Map([...now.filter(entry => entry.sourceId === source.sourceId), ...before.filter(entry => entry.sourceId === source.sourceId)].map(entry => [key(entry), entry]));
    for (const [entryKey, entry] of entries) {
      const current = currentFiles.get(entryKey), old = previousFiles.get(entryKey);
      let kind: FileChangeKind;
      if (!baseline) kind = 'initial';
      else if (!old) kind = previousComplete ? 'added' : 'uncompared';
      else if (!current) kind = currentComplete ? 'removed' : 'uncompared';
      else if (current.blob !== old.blob || current.mode !== old.mode || current.size !== old.size) kind = 'changed';
      else kind = current.status === old.status && current.reason === old.reason ? 'unchanged' : 'coverageChanged';
      total[kind]++; sourceCounts[kind]++;
      if (kind !== 'unchanged' && kind !== 'initial') sourceDetails.push({ sourceId: source.sourceId, sourceName: source.name, path: entry.path, change: kind,
        previousStatus: old?.status ?? null, status: current?.status ?? null, previousEvidenceId: old?.evidenceId ?? null, evidenceId: current?.evidenceId ?? null });
    }
    sourceDetails.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0); candidates.push(sourceDetails);
    return { sourceId: source.sourceId, name: source.name, previousRevision: previous?.revision ?? null, revision: source.revision,
      isNew: Boolean(baseline && !previous), inventoryComplete, counts: sourceCounts };
  });
  if (currentSources.length !== build.sources.length || previousSources.length !== (baseline?.sources.length ?? 0)) {
    complete = false; gaps.push('Revoked source scopes are excluded from this comparison and its details.');
  }
  if (previousSources.some(source => !currentSources.some(current => current.sourceId === source.sourceId))) {
    complete = false; gaps.push('Some baseline source scopes are outside this index; their absence is not a file deletion claim.');
  }
  if (!sources.every(source => source.inventoryComplete)) gaps.push('An inventory failed or was truncated. Missing entries in that scope are not proof of addition or deletion.');
  if (build.status === 'partial' || baseline?.status === 'partial') gaps.push('Source analysis has coverage gaps. File-inventory comparison does not establish complete understanding or deployment.');
  if (baseline && baseline.extractorVersion !== build.extractorVersion) gaps.push('Extractor versions differ; source equality does not establish equal extraction results.');
  if (comparison === 'legacy') gaps.push('This index predates tracked refreshes; no update comparison or read metrics were recorded.');
  let bytes = 0;
  // Round-robin details prevent one repository from consuming the whole preview.
  for (let position = 0; candidates.some(items => position < items.length); position++) for (const items of candidates) {
    const item = items[position]; if (!item) continue;
    const cost = Buffer.byteLength(JSON.stringify(item)) + 1;
    if (details.length >= changeLimits.details || !safePath(item.path) || Buffer.byteLength(item.path) > 4096 || bytes + cost > changeLimits.outputBytes - 16 * 1024) continue;
    details.push(item); bytes += cost;
  }
  const metrics = build.refresh.version ? catalog.store.one<{ reusedFiles: number; gitReadAttempts: number; cacheRejections: number }>(`SELECT
    count(CASE WHEN f.reusedFromFileId IS NOT NULL AND f.status='indexed' THEN 1 END) AS reusedFiles,
    coalesce(sum(f.gitReadAttempts),0) AS gitReadAttempts,coalesce(sum(f.cacheRejected),0) AS cacheRejections
    FROM files f JOIN sources src ON src.id=f.sourceId WHERE f.buildId=? AND src.status='active'`, build.id)! : null;
  const result: IndexChanges = { schemaVersion: 'loredock-index-changes-v1', buildId: build.id, baselineBuildId: baseline?.id ?? null,
    policyVersion: build.policyVersion, registryVersion: project.sourceSetVersion,
    stale: build.id !== project.publishedBuildId || build.sourceSetVersion !== project.sourceSetVersion,
    comparison, complete, counts: total, sources, files: details, omittedDetails: candidates.reduce((sum, items) => sum + items.length, 0) - details.length,
    gaps, metrics, limits: changeLimits };
  if (Buffer.byteLength(JSON.stringify(result)) > changeLimits.outputBytes) throw new CatalogError('CHANGE_LIMIT', 'The change summary exceeds its output byte budget.', 409);
  return result;
}
