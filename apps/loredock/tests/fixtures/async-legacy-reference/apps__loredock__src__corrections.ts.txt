import { randomUUID } from 'node:crypto';
import type { Catalog } from './catalog.js';
import { codeFlows } from './code-flows.js';
import { declarationMap } from './system-map.js';
import { sha256 } from './extract.js';
import { CatalogError } from './types.js';
import type { CorrectionHistory, CorrectionInput, CorrectionOverlay, CorrectionSnapshot, CorrectionSummary } from './correction-types.js';

export const correctionLimits = { targets: 100, versions: 20, statementBytes: 2000, snapshotBytes: 8192,
  outputBytes: 512 * 1024, historyBytes: 256 * 1024 } as const;
interface CorrectionRow {
  id: string; requestId: string; payloadHash: string; buildId: string; policyVersion: number; registryVersion: number;
  revision: number; targetKind: CorrectionInput['targetKind']; targetId: string; previousId: string | null;
  version: number; action: CorrectionInput['action']; statement: string | null; environment: string | null;
  target: string | null; contentHash: string; createdAt: string; purged: number;
}
const checksum = (row: Pick<CorrectionRow, 'buildId' | 'targetKind' | 'targetId' | 'version' | 'previousId' | 'action' | 'statement' | 'environment' | 'target'>) =>
  sha256(JSON.stringify([row.buildId, row.targetKind, row.targetId, row.version, row.previousId, row.action, row.statement, row.environment, row.target]));
interface ReapplicationRow {
  correctionId: string; sourceCorrectionId: string; sourceContentHash: string; targetContentHash: string; previewHash: string; lineageHash: string;
}
const lineageHash = (row: Omit<ReapplicationRow, 'lineageHash'>) => sha256(JSON.stringify([
  row.correctionId, row.sourceCorrectionId, row.sourceContentHash, row.targetContentHash, row.previewHash,
]));
const bounded = <T>(value: T, bytes: number): T => {
  if (Buffer.byteLength(JSON.stringify(value)) > bytes) throw new CatalogError('CORRECTION_LIMIT', 'Correction output exceeds its byte budget.', 409);
  return value;
};

function validate(value: unknown): CorrectionInput {
  const keys = ['requestId', 'buildId', 'targetKind', 'targetId', 'projectionHash', 'expectedRevision', 'expectedPreviousId', 'action', 'statement', 'environment'];
  const invalid = () => new CatalogError('INVALID_CORRECTION', 'Choose an indexed link, describe the correction in English, and use the current review version.');
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  const input = value as Record<string, unknown>;
  if (Object.keys(input).length !== keys.length || keys.some(key => !Object.hasOwn(input, key))
    || typeof input.requestId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(input.requestId)
    || typeof input.buildId !== 'string' || !input.buildId || input.buildId.length > 100
    || typeof input.targetKind !== 'string' || !['declaration-link', 'code-link'].includes(input.targetKind)
    || typeof input.targetId !== 'string' || !/^[a-f0-9]{64}$/.test(input.targetId)
    || typeof input.projectionHash !== 'string' || !/^[a-f0-9]{64}$/.test(input.projectionHash)
    || !Number.isSafeInteger(input.expectedRevision) || (input.expectedRevision as number) < 0
    || input.expectedPreviousId !== null && (typeof input.expectedPreviousId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(input.expectedPreviousId))
    || typeof input.action !== 'string' || !['dispute', 'clarify', 'withdraw'].includes(input.action)) throw invalid();
  if (input.action === 'withdraw') {
    if (input.statement !== null || input.environment !== null) throw invalid();
  } else {
    if (typeof input.statement !== 'string' || !input.statement.trim() || Buffer.byteLength(input.statement) > correctionLimits.statementBytes
      || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(input.statement)) throw invalid();
    if (input.environment !== null && (typeof input.environment !== 'string' || !input.environment.trim()
      || Buffer.byteLength(input.environment) > 80 || /[\x00-\x1f\x7f]/.test(input.environment))) throw invalid();
  }
  return { requestId: input.requestId, buildId: input.buildId, targetKind: input.targetKind as CorrectionInput['targetKind'], targetId: input.targetId,
    projectionHash: input.projectionHash, expectedRevision: input.expectedRevision as number, expectedPreviousId: input.expectedPreviousId as string | null,
    action: input.action as CorrectionInput['action'], statement: typeof input.statement === 'string' ? input.statement.replaceAll('\r\n', '\n').replaceAll('\r', '\n').trim() : null,
    environment: typeof input.environment === 'string' ? input.environment.trim() : null };
}

/** An append-only human review overlay. It never changes extracted source facts. */
export class Corrections {
  constructor(readonly catalog: Catalog) {}
  private latest(buildId: string, targetKind: CorrectionInput['targetKind'], targetId: string) {
    return this.catalog.store.one<CorrectionRow>('SELECT * FROM corrections WHERE buildId=? AND targetKind=? AND targetId=? ORDER BY version DESC LIMIT 1', buildId, targetKind, targetId);
  }
  private revoked(buildId: string) {
    return Boolean(this.catalog.store.one("SELECT 1 FROM build_sources b JOIN sources s ON s.id=b.sourceId WHERE b.buildId=? AND s.status!='active'", buildId));
  }
  private row(id: string) {
    const row = this.catalog.store.one<CorrectionRow>('SELECT * FROM corrections WHERE id=?', id);
    if (!row) throw new CatalogError('NOT_FOUND', 'Correction not found.', 404);
    return row;
  }
  private authorized(row: CorrectionRow) {
    this.catalog.readBuild(row.buildId);
    if (row.purged || row.policyVersion !== this.catalog.store.project().policyVersion || this.revoked(row.buildId)
      || this.catalog.store.one("SELECT 1 FROM correction_sources d JOIN sources s ON s.id=d.sourceId WHERE d.correctionId=? AND s.status!='active'", row.id)) {
      throw new CatalogError('NOT_FOUND', 'This correction is unavailable after a source authorization change.', 404);
    }
  }
  private original(row: CorrectionRow): CorrectionSnapshot {
    this.authorized(row);
    if (!row.target || checksum(row) !== row.contentHash) throw new CatalogError('CORRUPT_CORRECTION', 'Stored correction failed its integrity check.', 409);
    let target: CorrectionSnapshot;
    try { target = JSON.parse(row.target) as CorrectionSnapshot; }
    catch { throw new CatalogError('CORRUPT_CORRECTION', 'Stored correction has invalid provenance.', 409); }
    if (target.id !== row.targetId || !Array.isArray(target.evidenceIds) || !target.evidenceIds.length) throw new CatalogError('CORRUPT_CORRECTION', 'Stored correction has invalid provenance.', 409);
    for (const id of target.evidenceIds) if (this.catalog.evidence(id).buildId !== row.buildId) throw new CatalogError('CORRUPT_CORRECTION', 'Correction evidence belongs to another index.', 409);
    return target;
  }
  private summary(row: CorrectionRow): CorrectionSummary {
    this.original(row);
    const lineage = this.catalog.store.one<ReapplicationRow>('SELECT * FROM correction_reapplications WHERE correctionId=?', row.id);
    let reappliedFrom: CorrectionSummary['reappliedFrom'];
    if (lineage) {
      const source = this.row(lineage.sourceCorrectionId); this.authorized(source);
      if (lineage.lineageHash !== lineageHash(lineage) || lineage.sourceContentHash !== source.contentHash || lineage.targetContentHash !== row.contentHash
        || checksum(source) !== source.contentHash
        || source.buildId === row.buildId || source.targetKind !== row.targetKind || source.action === 'withdraw') {
        throw new CatalogError('CORRUPT_CORRECTION', 'Stored reapplication failed its provenance check.', 409);
      }
      reappliedFrom = { id: source.id, buildId: source.buildId, version: source.version };
    }
    return { id: row.id, buildId: row.buildId, targetKind: row.targetKind, targetId: row.targetId,
      version: row.version, revision: row.revision, previousId: row.previousId, createdAt: row.createdAt,
      action: row.action, statement: row.statement, environment: row.environment, provenance: 'human', verification: 'unverified',
      affectedFlowIds: this.catalog.store.all<{ flowId: string }>('SELECT flowId FROM correction_flows WHERE correctionId=? ORDER BY flowId', row.id).map(item => item.flowId),
      ...(reappliedFrom ? { reappliedFrom } : {}) };
  }
  inspect(id: string) { const row = this.row(id); return { ...this.summary(row), original: this.original(row) }; }
  replay(requestId: string, payloadHash: string): CorrectionSummary | undefined {
    const row = this.catalog.store.one<CorrectionRow>('SELECT * FROM corrections WHERE requestId=?', requestId);
    if (!row) return;
    this.authorized(row);
    if (row.payloadHash !== payloadHash) throw new CatalogError('CONFLICT', 'This request ID was already used with different correction inputs.', 409);
    return this.summary(row);
  }
  list(buildId?: string): CorrectionOverlay {
    const build = this.catalog.readBuild(buildId), project = this.catalog.store.project();
    const rows = this.revoked(build.id) ? [] : this.catalog.store.all<CorrectionRow>(`SELECT c.* FROM corrections c WHERE c.buildId=? AND c.purged=0
      AND NOT EXISTS(SELECT 1 FROM correction_sources d JOIN sources s ON s.id=d.sourceId WHERE d.correctionId=c.id AND s.status!='active')
      AND c.version=(SELECT max(other.version) FROM corrections other WHERE other.buildId=c.buildId AND other.targetKind=c.targetKind AND other.targetId=c.targetId)
      ORDER BY c.revision LIMIT ?`, build.id, correctionLimits.targets + 1);
    if (rows.length > correctionLimits.targets) throw new CatalogError('CORRECTION_LIMIT', 'This index exceeds its correction target limit.', 409);
    return bounded({ schemaVersion: 'loredock-corrections-v1', buildId: build.id, policyVersion: build.policyVersion,
      registryVersion: project.sourceSetVersion, revision: project.correctionRevision,
      stale: build.id !== project.publishedBuildId || build.sourceSetVersion !== project.sourceSetVersion,
      editable: !this.revoked(build.id), corrections: rows.map(row => this.summary(row)), limits: correctionLimits }, correctionLimits.outputBytes);
  }
  history(id: string): CorrectionHistory {
    const row = this.row(id); this.authorized(row);
    const versions = this.catalog.store.all<CorrectionRow>('SELECT * FROM corrections WHERE buildId=? AND targetKind=? AND targetId=? ORDER BY version DESC LIMIT ?',
      row.buildId, row.targetKind, row.targetId, correctionLimits.versions).map(item => ({ ...this.summary(item), original: this.original(item) }));
    return bounded({ buildId: row.buildId, revision: this.catalog.store.project().correctionRevision, versions }, correctionLimits.historyBytes);
  }
  save(value: unknown): CorrectionSummary {
    const input = validate(value);
    return this.write(input, sha256(JSON.stringify(input)));
  }
  /** Called only after the server has compared the exact preview and both source projections. */
  reapply(value: CorrectionInput, payloadHash: string, sourceCorrectionId: string, previewHash: string): CorrectionSummary {
    return this.write(validate(value), payloadHash, { sourceCorrectionId, previewHash });
  }
  private write(input: CorrectionInput, payloadHash: string, origin?: { sourceCorrectionId: string; previewHash: string }): CorrectionSummary {
    const store = this.catalog.store, replay = this.replay(input.requestId, payloadHash);
    if (replay) return replay;
    const build = this.catalog.readBuild(input.buildId);
    if (this.revoked(build.id)) throw new CatalogError('SOURCE_CHANGED', 'Index the remaining sources before adding corrections.', 409);
    const projection = input.targetKind === 'code-link' ? codeFlows(this.catalog, build.id) : declarationMap(this.catalog, build.id);
    if (projection.inputHash !== input.projectionHash) throw new CatalogError('INPUT_CHANGED', 'The map changed. Review the current link before saving.', 409);
    const previous = this.latest(build.id, input.targetKind, input.targetId);
    let snapshot: CorrectionSnapshot;
    let affectedFlowIds: string[];
    if (input.action === 'withdraw') {
      if (!previous || previous.action === 'withdraw') throw new CatalogError('CONFLICT', 'There is no active correction to withdraw.', 409);
      snapshot = this.original(previous); affectedFlowIds = this.summary(previous).affectedFlowIds;
    } else {
      const edge = projection.edges.find(edge => edge.id === input.targetId);
      if (!edge || input.targetKind === 'declaration-link' && edge.status === 'declared') throw new CatalogError('INVALID_TARGET', 'Choose an issued code link or cross-repository declaration comparison.', 422);
      const from = projection.nodes.find(node => node.id === edge.from)!, to = projection.nodes.find(node => node.id === edge.to)!;
      const endpoint = ({ id, label, sourceId, sourceName }: typeof from) => ({ id, label, sourceId, sourceName });
      snapshot = { schemaVersion: projection.schemaVersion, adapterVersion: projection.adapterVersion, projectionHash: projection.inputHash,
        id: edge.id, kind: edge.kind, status: edge.status, reason: edge.reason, environment: edge.environment,
        from: endpoint(from), to: endpoint(to), evidenceIds: edge.evidenceIds };
      const code = 'flows' in projection ? projection : codeFlows(this.catalog, build.id);
      affectedFlowIds = code.flows.filter(flow => input.targetKind === 'code-link' ? flow.edgeIds.includes(edge.id)
        : flow.evidenceIds.some(id => edge.evidenceIds.includes(id))).map(flow => flow.id).sort();
    }
    const target = JSON.stringify(snapshot);
    if (Buffer.byteLength(target) > correctionLimits.snapshotBytes) throw new CatalogError('CORRECTION_LIMIT', 'This link exceeds the correction evidence budget.', 409);
    return store.transaction(() => {
      const project = store.project(), current = this.latest(build.id, input.targetKind, input.targetId);
      if (project.correctionRevision !== input.expectedRevision || (current?.id ?? null) !== input.expectedPreviousId) {
        throw new CatalogError('CONFLICT', 'A correction changed. Refresh and review the latest version before saving.', 409);
      }
      const source = origin ? this.row(origin.sourceCorrectionId) : undefined;
      if (source) {
        this.original(source);
        if (current || source.buildId === build.id || this.latest(source.buildId, source.targetKind, source.targetId)?.id !== source.id
          || source.action === 'withdraw' || source.targetKind !== input.targetKind || source.action !== input.action
          || source.statement !== input.statement || source.environment !== input.environment) {
          throw new CatalogError('CONFLICT', 'The original or current correction changed. Review a new comparison before applying.', 409);
        }
      }
      const version = (current?.version ?? 0) + 1;
      if (version > correctionLimits.versions || version === correctionLimits.versions && input.action !== 'withdraw') {
        throw new CatalogError('CORRECTION_LIMIT', 'This link reached its version limit; the final version is reserved for withdrawal.', 409);
      }
      if (!current && store.one<{ count: number }>('SELECT count(*) AS count FROM (SELECT 1 FROM corrections WHERE buildId=? GROUP BY targetKind,targetId)', build.id)!.count >= correctionLimits.targets) {
        throw new CatalogError('CORRECTION_LIMIT', 'This index reached its correction target limit.', 409);
      }
      const row: CorrectionRow = { id: randomUUID(), requestId: input.requestId, payloadHash, buildId: build.id, policyVersion: build.policyVersion,
        registryVersion: project.sourceSetVersion, revision: project.correctionRevision + 1, targetKind: input.targetKind, targetId: input.targetId,
        previousId: current?.id ?? null, version, action: input.action, statement: input.statement, environment: input.environment,
        target, contentHash: '', createdAt: new Date().toISOString(), purged: 0 };
      row.contentHash = checksum(row);
      store.run(`INSERT INTO corrections (id,requestId,payloadHash,buildId,policyVersion,registryVersion,revision,targetKind,targetId,previousId,version,action,statement,environment,target,contentHash,createdAt)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, row.id, row.requestId, row.payloadHash, row.buildId, row.policyVersion, row.registryVersion,
      row.revision, row.targetKind, row.targetId, row.previousId, row.version, row.action, row.statement, row.environment, row.target, row.contentHash, row.createdAt);
      for (const source of build.sources) store.run('INSERT INTO correction_sources VALUES (?,?)', row.id, source.sourceId);
      if (current) store.run('INSERT OR IGNORE INTO correction_sources SELECT ?,sourceId FROM correction_sources WHERE correctionId=?', row.id, current.id);
      if (source && origin) {
        store.run('INSERT OR IGNORE INTO correction_sources SELECT ?,sourceId FROM correction_sources WHERE correctionId=?', row.id, source.id);
        const lineage = { correctionId: row.id, sourceCorrectionId: source.id, sourceContentHash: source.contentHash, targetContentHash: row.contentHash, previewHash: origin.previewHash };
        store.run('INSERT INTO correction_reapplications VALUES (?,?,?,?,?,?)', row.id, source.id, source.contentHash, row.contentHash, origin.previewHash, lineageHash(lineage));
      }
      for (const flowId of affectedFlowIds) store.run('INSERT INTO correction_flows VALUES (?,?)', row.id, flowId);
      store.run('UPDATE project SET correctionRevision=? WHERE id=1', row.revision);
      // Include validation in the transaction so publication failure leaves no half-written version.
      const result = this.summary(row);
      this.list(build.id); this.history(row.id);
      return bounded(result, correctionLimits.outputBytes);
    });
  }
}
