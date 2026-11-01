import type { MapEvidence } from './system-map-types.js';
import { readmeLines } from './readme-lines.js';

export const linkedReadingLimits = { linkedDocuments: 3, linkLabelBytes: 160, linkPathBytes: 512 } as const;
export interface ReadmeLink { label: string; path: string; line: number; readmeEvidenceIds: string[] }

/** Resolve only a literal relative document name, never a URL or filesystem path. */
function targetPath(destination: string): string | null {
  const literal = destination.split('#')[0]!;
  let decoded: string;
  try { decoded = decodeURIComponent(literal); } catch { return null; }
  if (!decoded || decoded.startsWith('/') || /[\\:%?<>\p{Cc}]/u.test(decoded)) return null;
  const parts = decoded.split('/');
  if (parts.some(part => part === '..' || !part)) return null;
  const normalized = parts.filter(part => part !== '.').join('/');
  return /(?:\.(?:md|txt)|(?:^|\/)readme)$/i.test(normalized) ? normalized : null;
}

/** Mask complete or unmatched inline code without manufacturing a different label. */
function withoutCode(line: string): string {
  const runs = [...line.matchAll(/`+/g)]; let output = '', cursor = 0;
  for (let index = 0; index < runs.length; index++) {
    const open = runs[index]!;
    let close = index + 1;
    while (close < runs.length && runs[close]![0].length !== open[0].length) close++;
    const end = close === runs.length ? line.length : runs[close]!.index! + runs[close]![0].length;
    output += line.slice(cursor, open.index) + '\0'.repeat(end - open.index!); cursor = end;
    if (close === runs.length) break;
    index = close;
  }
  return output + line.slice(cursor);
}

export function readmeLinks(content: string, readmePath: string, refs: Pick<MapEvidence, 'id' | 'startLine' | 'endLine'>[]) {
  const links: ReadmeLink[] = [], seen = new Set<string>(); let omittedLinkedDocuments = 0;
  for (const { line, index } of readmeLines(content.split('\n'))) {
    if (/^(?: {4}|\t)|^ {0,3}>/.test(line)) continue;
    // Deliberately excludes images, escaped/nested labels, titles and multiline syntax.
    for (const match of withoutCode(line).matchAll(/(?<!!|\\)\[([^\[\]\\\0]+)\]\(([^\s()\\\0]+)\)/g)) {
      const label = match[1]!.trim(), target = targetPath(match[2]!);
      if (!target || target === readmePath || seen.has(target)) continue;
      seen.add(target);
      if (!label || Buffer.byteLength(label) > linkedReadingLimits.linkLabelBytes || Buffer.byteLength(target) > linkedReadingLimits.linkPathBytes
        || links.length >= linkedReadingLimits.linkedDocuments) { omittedLinkedDocuments++; continue; }
      const sourceLine = index + 1;
      links.push({ label, path: target, line: sourceLine,
        readmeEvidenceIds: refs.filter(ref => ref.startLine <= sourceLine && ref.endLine >= sourceLine).map(ref => ref.id) });
    }
  }
  return { links, omittedLinkedDocuments };
}
