import type { AnswerContext } from './answer-context.js';
import type { CandidateSelection } from './source-candidates.js';
import type { Catalog } from './catalog.js';
import { codeFlows } from './code-flows.js';
import { declarationMap } from './system-map.js';
import type { MapEvidence } from './system-map-types.js';
import { searchText } from './search-text.js';
import { CatalogError } from './types.js';

export const candidateLinkLimits = { sources: 4, linksPerSource: 2 } as const;
const kinds = ['http-target', 'event-delivery', 'contract-match', 'contract-difference', 'setting-match', 'setting-difference'] as const;
type LinkKind = typeof kinds[number];
export interface LinkEndpoint {
  sourceId: string; sourceName: string; revision: string; label: string; evidenceIds: string[];
}
export interface LinkEvidence extends MapEvidence { sourceId: string; contentHash: string; spanHash: string }
export interface CandidateLink {
  id: string; origin: 'code' | 'declaration'; kind: LinkKind; status: string; environment: string | null;
  from: LinkEndpoint; to: LinkEndpoint; reason: string; gaps: string[]; evidence: LinkEvidence[];
}
export interface LinkedSource {
  sourceId: string; sourceName: string; revision: string; links: CandidateLink[]; omittedLinks: number;
}
export interface CandidateLinks {
  schemaVersion: 'source-candidate-links-v1'; provenance: 'static-analysis'; verification: 'unverified';
  sources: LinkedSource[]; eligibleSources: number; eligibleLinks: number; omittedSources: number; omittedLinks: number;
  limits: typeof candidateLinkLimits;
}
export interface CandidateLinkContext extends CandidateLinks {
  projections: { code: { version: string; inputHash: string; coverage: ReturnType<typeof codeFlows>['coverage']; omissions: Record<string, number> };
    declarations: { version: string; inputHash: string; coverage: ReturnType<typeof declarationMap>['coverage']; omissions: Record<string, number> } };
  gaps: string[];
}

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const locator = (ref: LinkEvidence) => JSON.stringify([ref.sourceName, ref.revision, ref.path, ref.startLine, ref.endLine, ref.contentHash, ref.spanHash]);

/** One-hop reading context; never promote graph reachability to implementation ownership. */
export function selectCandidateLinks(context: Pick<AnswerContext, 'sources' | 'spans'>,
  selection: Pick<CandidateSelection, 'suggested' | 'distinctiveTerms'>, links: CandidateLink[]): CandidateLinks {
  const owners = new Map(context.sources.map(source => [source.sourceId, source]));
  const seeds = new Set(selection.suggested.map(source => source.sourceId));
  const anchors = new Map(context.spans.filter(span => seeds.has(span.sourceId) && selection.distinctiveTerms.some(term =>
    new Set(searchText(`${span.path}\n${span.text}`).match(/[\p{L}\p{N}_]+/gu) ?? []).has(term))).map(span => [span.id, span]));
  const bySource = new Map<string, CandidateLink[]>();
  for (const link of links) {
    if (!kinds.includes(link.kind)) continue;
    const refs = new Map(link.evidence.map(ref => [ref.id, ref]));
    const invalid = () => new CatalogError('INVALID_CONTEXT', 'A candidate relationship does not match its original source evidence.');
    for (const ref of link.evidence) {
      const owner = owners.get(ref.sourceId);
      if (!owner || ref.sourceName !== owner.name || ref.revision !== owner.revision) throw invalid();
    }
    for (const endpoint of [link.from, link.to]) {
      const owner = owners.get(endpoint.sourceId);
      if (!owner || endpoint.sourceName !== owner.name || endpoint.revision !== owner.revision || !endpoint.evidenceIds.length) throw invalid();
      for (const id of endpoint.evidenceIds) {
        const ref = refs.get(id);
        if (!ref || ref.sourceId !== endpoint.sourceId) throw invalid();
      }
    }
    if (link.from.sourceId === link.to.sourceId) continue;
    const seed = [link.from, link.to].find(endpoint => seeds.has(endpoint.sourceId) && endpoint.evidenceIds.some(id => {
      const anchor = anchors.get(id), ref = refs.get(id)!;
      if (!anchor) return false;
      if (anchor.sourceId !== endpoint.sourceId || locator(anchor) !== locator(ref)) throw invalid();
      return true;
    }));
    if (!seed) continue;
    const neighbor = link.from.sourceId === seed.sourceId ? link.to : link.from;
    if (seeds.has(neighbor.sourceId)) continue;
    const rows = bySource.get(neighbor.sourceId) ?? []; rows.push(link); bySource.set(neighbor.sourceId, rows);
  }
  const key = (link: CandidateLink) => {
    const endpoints = [link.from, link.to].map(endpoint => JSON.stringify([
      endpoint.evidenceIds.map(id => locator(link.evidence.find(ref => ref.id === id)!)).sort(), endpoint.label]));
    // A declaration comparison's stored left/right order is not a directed dependency.
    if (link.origin === 'declaration') endpoints.sort();
    return JSON.stringify([endpoints, link.evidence.map(locator).sort()]);
  };
  const eligibleSources = bySource.size, eligibleLinks = [...bySource.values()].reduce((sum, rows) => sum + rows.length, 0);
  const sources = context.sources.filter(source => bySource.has(source.sourceId)).slice(0, candidateLinkLimits.sources).map(source => {
    const rows = bySource.get(source.sourceId)!.sort((a, b) => kinds.indexOf(a.kind) - kinds.indexOf(b.kind) || compare(key(a), key(b)));
    return { sourceId: source.sourceId, sourceName: source.name, revision: source.revision!,
      links: rows.slice(0, candidateLinkLimits.linksPerSource), omittedLinks: Math.max(0, rows.length - candidateLinkLimits.linksPerSource) };
  });
  return { schemaVersion: 'source-candidate-links-v1', provenance: 'static-analysis', verification: 'unverified', sources,
    eligibleSources, eligibleLinks, omittedSources: eligibleSources - sources.length,
    omittedLinks: eligibleLinks - sources.reduce((sum, row) => sum + row.links.length, 0), limits: candidateLinkLimits };
}

export function candidateLinkContext(catalog: Catalog, context: AnswerContext, selection: CandidateSelection): CandidateLinkContext {
  const declarations = declarationMap(catalog, context.buildId), code = codeFlows(catalog, context.buildId);
  const links: CandidateLink[] = [], originals = new Map<string, LinkEvidence>();
  for (const projection of [declarations, code]) {
    if (projection.buildId !== context.buildId || projection.policyVersion !== context.policyVersion
      || projection.sourceSetVersion !== context.sourceSetVersion || projection.registryVersion !== context.registryVersion) {
      throw new CatalogError('INPUT_CHANGED', 'Candidate relationship inputs changed. Find candidates again.', 409);
    }
    for (const edge of projection.edges) {
      if (!(kinds as readonly string[]).includes(edge.kind)) continue;
      const from = projection.nodes.find(node => node.id === edge.from)!, to = projection.nodes.find(node => node.id === edge.to)!;
      if (from.sourceId === to.sourceId) continue;
      const evidence = [...new Set([...from.evidenceIds, ...to.evidenceIds, ...edge.evidenceIds])].map(id => {
        const issued = projection.evidence[id], original = originals.get(id) ?? (() => {
          const span = catalog.evidence(id);
          if (span.buildId !== context.buildId) throw new CatalogError('INVALID_CONTEXT', 'Candidate evidence belongs to another index.');
          const { text: _text, metadata: _metadata, snippet: _snippet, blobId: _blob, buildId: _build, ...ref } = span;
          originals.set(id, ref); return ref;
        })();
        if (!issued || issued.sourceName !== original.sourceName || issued.revision !== original.revision || issued.path !== original.path
          || issued.startLine !== original.startLine || issued.endLine !== original.endLine) {
          throw new CatalogError('INVALID_CONTEXT', 'Candidate relationship evidence changed.');
        }
        return original;
      }).sort((a, b) => compare(locator(a), locator(b)));
      const endpoint = (node: typeof from): LinkEndpoint => ({ sourceId: node.sourceId, sourceName: node.sourceName,
        revision: node.revision!, label: node.label, evidenceIds: [...node.evidenceIds].sort((a, b) => compare(locator(originals.get(a)!), locator(originals.get(b)!))) });
      links.push({ id: edge.id, origin: projection === code ? 'code' : 'declaration', kind: edge.kind as LinkKind,
        status: edge.status, environment: edge.environment, from: endpoint(from), to: endpoint(to), reason: edge.reason,
        gaps: 'gaps' in edge ? edge.gaps : [], evidence });
    }
  }
  return { ...selectCandidateLinks(context, selection, links), projections: {
    code: { version: code.adapterVersion, inputHash: code.inputHash, coverage: code.coverage, omissions: code.omissions },
    declarations: { version: declarations.adapterVersion, inputHash: declarations.inputHash, coverage: declarations.coverage, omissions: declarations.omissions } },
    gaps: [...new Set([...code.gaps, ...declarations.gaps,
      'These are direct, evidence-anchored reading clues. Equal or different declarations do not prove a live connection or runtime conflict.',
      'Only primary lexical sources seed these links. Missing links can reflect unsupported syntax, bounded analysis or missing source material.'])] };
}
