import type { Catalog } from './catalog.js';
import { Corrections } from './corrections.js';
import type { CorrectionSnapshot, CorrectionTarget } from './correction-types.js';
import { codeFlows } from './code-flows.js';
import { declarationMap } from './system-map.js';
import type { CodeFlows, FlowEdge, FlowNode } from './code-flow-types.js';
import type { DeclarationMap, MapEdge, MapNode } from './system-map-types.js';
import { sha256 } from './extract.js';
import { CatalogError, type Build, type Evidence } from './types.js';
import type { ReapplicationInput, ReconciliationEntry, ReconciliationPreview } from './reconciliation-types.js';

export const reconciliationLimits = { ancestors: 20, corrections: 20, outputBytes: 512 * 1024 } as const;
type Graph = CodeFlows | DeclarationMap;
type Edge = FlowEdge | MapEdge;
type Node = FlowNode | MapNode;
const stable = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
const sorted = <T>(values: T[]) => [...values].sort((a, b) => stable(a).localeCompare(stable(b)));
const snapshot = (graph: Graph, edge: Edge): CorrectionSnapshot => {
  const endpoint = (id: string) => {
    const node = graph.nodes.find(node => node.id === id)!;
    return { id: node.id, label: node.label, sourceId: node.sourceId, sourceName: node.sourceName };
  };
  return { schemaVersion: graph.schemaVersion, adapterVersion: graph.adapterVersion, projectionHash: graph.inputHash,
    id: edge.id, kind: edge.kind, status: edge.status, reason: edge.reason, environment: edge.environment,
    from: endpoint(edge.from), to: endpoint(edge.to), evidenceIds: edge.evidenceIds };
};
const withoutProjectionHash = ({ projectionHash: _hash, ...value }: CorrectionSnapshot) => value;
const unavailable = () => new CatalogError('NOT_FOUND', 'This earlier review scope is unavailable. Choose an authorized index.', 404);

function validate(value: unknown): ReapplicationInput {
  const keys = ['requestId', 'buildId', 'sourceCorrectionId', 'targetId', 'previewHash', 'expectedRevision'];
  const invalid = () => new CatalogError('INVALID_REAPPLICATION', 'Review the current comparison before applying an earlier correction.');
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  const input = value as Record<string, unknown>;
  if (Object.keys(input).length !== keys.length || keys.some(key => !Object.hasOwn(input, key))
    || !['requestId', 'buildId', 'sourceCorrectionId'].every(key => typeof input[key] === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(input[key] as string))
    || !['targetId', 'previewHash'].every(key => typeof input[key] === 'string' && /^[a-f0-9]{64}$/.test(input[key] as string))
    || !Number.isSafeInteger(input.expectedRevision) || (input.expectedRevision as number) < 0) throw invalid();
  return { requestId: input.requestId as string, buildId: input.buildId as string, sourceCorrectionId: input.sourceCorrectionId as string,
    targetId: input.targetId as string, previewHash: input.previewHash as string, expectedRevision: input.expectedRevision as number };
}

/** A bounded, model-free comparison. Matching support never transfers a human decision automatically. */
export class Reconciliation {
  readonly corrections: Corrections;
  constructor(readonly catalog: Catalog) { this.corrections = new Corrections(catalog); }
  private revoked(buildId: string) {
    return Boolean(this.catalog.store.one("SELECT 1 FROM build_sources b JOIN sources s ON s.id=b.sourceId WHERE b.buildId=? AND s.status!='active'", buildId));
  }
  preview(buildId?: string, fromBuildId?: string): ReconciliationPreview {
    const target = this.catalog.readBuild(buildId), store = this.catalog.store, project = store.project();
    const editable = !this.revoked(target.id), gaps: string[] = [
      'Matching support does not verify the engineer statement in the wider current scope. Review both indexes before applying.',
      'Only links present in the bounded supported projections can be compared. Renames and runtime/deployment changes are not inferred.',
    ];
    const ancestors: ReconciliationPreview['ancestors'] = [], seen = new Set([target.id]);
    let next = target.refresh.baselineBuildId;
    while (editable && next && ancestors.length < reconciliationLimits.ancestors) {
      if (seen.has(next)) { gaps.push('The recorded index ancestry contains a cycle; comparison stops here.'); break; }
      seen.add(next);
      const row = store.one<{ id: string; published: number; policyVersion: number; createdAt: string; baselineBuildId: string | null }>('SELECT * FROM builds WHERE id=?', next);
      if (!row || !row.published || row.policyVersion !== project.policyVersion || this.revoked(next)) {
        gaps.push('An earlier index is missing, unpublished or unavailable under the current source policy. Comparison stops here.'); break;
      }
      const activeCorrections = store.one<{ count: number }>(`SELECT count(*) AS count FROM corrections c WHERE c.buildId=? AND c.purged=0 AND c.action!='withdraw'
        AND NOT EXISTS(SELECT 1 FROM corrections later WHERE later.buildId=c.buildId AND later.targetKind=c.targetKind AND later.targetId=c.targetId AND later.version>c.version)
        AND NOT EXISTS(SELECT 1 FROM correction_sources d JOIN sources s ON s.id=d.sourceId WHERE d.correctionId=c.id AND s.status!='active')`, next)!.count;
      ancestors.push({ id: row.id, createdAt: row.createdAt, activeCorrections }); next = row.baselineBuildId;
    }
    if (next && ancestors.length === reconciliationLimits.ancestors) gaps.push('Earlier review discovery is limited to 20 recorded refresh ancestors.');
    if (!editable) gaps.push('Index the remaining authorized sources before comparing earlier reviews.');
    if (fromBuildId && !ancestors.some(item => item.id === fromBuildId)) throw unavailable();
    // Never silently search backwards for an older note after a nearer withdrawal or skipped review.
    const selected = fromBuildId ?? ancestors[0]?.id ?? null;
    const previous = selected ? this.catalog.readBuild(selected) : undefined;
    const scope = (build: Build | undefined) => (build?.sources ?? []).filter(source => store.source(source.sourceId).status === 'active')
      .map(({ sourceId, name, revision }) => ({ sourceId, name, revision }));
    const result: Omit<ReconciliationPreview, 'previewHash'> = { schemaVersion: 'loredock-reconciliation-v1', buildId: target.id, fromBuildId: selected,
      policyVersion: project.policyVersion, registryVersion: project.sourceSetVersion, revision: project.correctionRevision,
      stale: target.id !== project.publishedBuildId || target.sourceSetVersion !== project.sourceSetVersion,
      editable, ancestors, scope: { previous: scope(previous), current: scope(target) }, entries: [], evidence: {},
      activeCorrections: 0, omittedCorrections: 0, gaps, limits: reconciliationLimits };
    if (selected) {
      const sourceNotes = this.corrections.list(selected).corrections.filter(item => item.action !== 'withdraw').sort((a, b) => b.revision - a.revision);
      result.activeCorrections = sourceNotes.length;
      const currentNotes = this.corrections.list(target.id).corrections;
      const graphs = new Map<string, Graph>(), evidence = new Map<string, Evidence>();
      const graph = (id: string, kind: CorrectionTarget) => {
        const key = `${id}:${kind}`; let value = graphs.get(key);
        if (!value) { value = kind === 'code-link' ? codeFlows(this.catalog, id) : declarationMap(this.catalog, id); graphs.set(key, value); }
        return value;
      };
      const readEvidence = (id: string) => {
        let value = evidence.get(id); if (!value) { value = this.catalog.evidence(id); evidence.set(id, value); } return value;
      };
      const paths = (node: Node, graph: Graph) => 'path' in node ? [node.path] : [...new Set(node.evidenceIds.map(id => graph.evidence[id]?.path))].sort();
      const nodeKey = (node: Node, graph: Graph) => ({ kind: node.kind, sourceId: node.sourceId, paths: paths(node, graph), label: node.label });
      const nodes = (edge: Edge, graph: Graph) => [graph.nodes.find(node => node.id === edge.from)!, graph.nodes.find(node => node.id === edge.to)!];
      const logical = (edge: Edge, graph: Graph) => {
        const endpoints = nodes(edge, graph).map(node => nodeKey(node, graph));
        return stable([edge.kind, 'flows' in graph ? endpoints : sorted(endpoints)]);
      };
      const semantics = (edge: Edge, graph: Graph) => {
        const endpoints = nodes(edge, graph).map(node => ({ ...nodeKey(node, graph), properties: node.properties,
          ...('path' in node ? { startLine: node.startLine, endLine: node.endLine } : { environment: node.environment, provenance: node.provenance }) }));
        const support = sorted([...new Set([...edge.evidenceIds, ...nodes(edge, graph).flatMap(node => node.evidenceIds)])].map(id => {
          const span = readEvidence(id);
          if (span.buildId !== graph.buildId) throw new CatalogError('CORRUPT_EVIDENCE', 'Link evidence belongs to another index.', 409);
          return { sourceId: span.sourceId, path: span.path, startLine: span.startLine, endLine: span.endLine, contentHash: span.contentHash, spanHash: span.spanHash };
        }));
        return sha256(stable([graph.schemaVersion, graph.adapterVersion, edge.kind, edge.status, edge.reason, edge.environment,
          'gaps' in edge ? sorted(edge.gaps) : [], 'flows' in graph ? endpoints : sorted(endpoints), support]));
      };
      for (const source of sourceNotes.slice(0, reconciliationLimits.corrections)) {
        const original = this.corrections.inspect(source.id).original;
        const entry: ReconciliationEntry = { source, original, status: 'unsupported', reason: 'The original adapter provenance is not supported for comparison.', current: null };
        const expected = source.targetKind === 'code-link' ? ['loredock-code-flows-v1', 'pilot-code-v3'] : ['loredock-map-v1', 'json-declarations-v2'];
        if (original.schemaVersion === expected[0] && original.adapterVersion === expected[1]) {
          const oldGraph = graph(selected, source.targetKind), newGraph = graph(target.id, source.targetKind);
          const oldEdge = oldGraph.edges.find(edge => edge.id === source.targetId);
          if (oldEdge && stable(withoutProjectionHash(snapshot(oldGraph, oldEdge))) === stable(withoutProjectionHash(original))) {
            const key = logical(oldEdge, oldGraph), oldMatches = oldGraph.edges.filter(edge => logical(edge, oldGraph) === key);
            const matches = newGraph.edges.filter(edge => logical(edge, newGraph) === key);
            if (oldMatches.length !== 1 || matches.length > 1) {
              entry.status = 'ambiguous'; entry.reason = 'Several links share this source/file identity. Write a new correction after reviewing the current links.';
            } else if (!matches.length) {
              entry.status = 'missing'; entry.reason = 'This link is absent from the current bounded projection. It may have changed or fallen outside coverage.';
            } else {
              const edge = matches[0]!; entry.current = snapshot(newGraph, edge);
              if (currentNotes.some(note => note.targetKind === source.targetKind && note.targetId === edge.id)) {
                entry.status = 'already-reviewed'; entry.reason = 'This index already has a correction or withdrawal for the link. Its decision will not be replaced.';
              } else if (semantics(oldEdge, oldGraph) === semantics(edge, newGraph)) {
                entry.status = 'support-unchanged'; entry.reason = 'The link semantics and all supporting file hashes/ranges match. Review the current scope before applying this note.';
              } else {
                entry.status = 'support-changed'; entry.reason = 'The link semantics or supporting source content changed. Review the current evidence and write a new correction.';
              }
            }
          } else entry.reason = 'The original claim cannot be reconstructed exactly with the supported adapter.';
          for (const claim of [entry.original, entry.current]) if (claim) for (const id of claim.evidenceIds) {
            const span = readEvidence(id);
            result.evidence[id] = { id, sourceName: span.sourceName, path: span.path, revision: span.revision, startLine: span.startLine, endLine: span.endLine };
          }
        }
        result.entries.push(entry);
        if (Buffer.byteLength(JSON.stringify(result)) > reconciliationLimits.outputBytes - 16384) {
          result.entries.pop();
          const used = new Set(result.entries.flatMap(item => [...item.original.evidenceIds, ...(item.current?.evidenceIds ?? [])]));
          for (const id of Object.keys(result.evidence)) if (!used.has(id)) delete result.evidence[id];
          gaps.push('Earlier review details reached the preview byte budget. Remaining corrections are omitted.'); break;
        }
      }
      result.omittedCorrections = sourceNotes.length - result.entries.length;
      if (result.omittedCorrections) gaps.push(`${result.omittedCorrections} earlier corrections are outside this bounded preview.`);
    }
    const preview = { ...result, previewHash: sha256(stable(result)) };
    if (Buffer.byteLength(JSON.stringify(preview)) > reconciliationLimits.outputBytes) throw new CatalogError('RECONCILIATION_LIMIT', 'Review comparison exceeds its output budget.', 409);
    return preview;
  }
  reapply(value: unknown) {
    const input = validate(value), payloadHash = sha256(stable(['reapply-v1', input]));
    const replay = this.corrections.replay(input.requestId, payloadHash); if (replay) return replay;
    const source = this.corrections.inspect(input.sourceCorrectionId), preview = this.preview(input.buildId, source.buildId);
    if (preview.revision !== input.expectedRevision || preview.previewHash !== input.previewHash) {
      throw new CatalogError('INPUT_CHANGED', 'The comparison changed. Refresh and review the earlier correction again.', 409);
    }
    const entry = preview.entries.find(item => item.source.id === source.id && item.current?.id === input.targetId);
    if (!preview.editable || !entry || entry.status !== 'support-unchanged' || !entry.current || source.action === 'withdraw') {
      throw new CatalogError('INVALID_REAPPLICATION', 'Only an unchanged, unreviewed link from the current comparison can receive this correction.', 409);
    }
    return this.corrections.reapply({ requestId: input.requestId, buildId: input.buildId,
      targetKind: source.targetKind, targetId: input.targetId, projectionHash: entry.current.projectionHash, expectedRevision: input.expectedRevision,
      expectedPreviousId: null, action: source.action, statement: source.statement, environment: source.environment,
    }, payloadHash, source.id, input.previewHash);
  }
}
