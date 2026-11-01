import { readmeLines } from './readme-lines.js';
import type { MapEvidence } from './system-map-types.js';
import type { OrientationSection } from './orientation-types.js';

export const sectionLimits = { sections: 12, headingBytes: 160 } as const;

/** Conservative ATX navigation over validated text; not a complete Markdown parser. */
export function readmeSections(content: string, refs: Pick<MapEvidence, 'id' | 'startLine' | 'endLine'>[]) {
  const lines = content.split('\n'), headings: { title: string; level: number; startLine: number }[] = [];
  // Match issued evidence: a terminal newline does not create another source line.
  if (content.endsWith('\n')) lines.pop();
  let list = false, listBlank = false;
  for (const { line, index } of readmeLines(lines)) {
    if (/^ {0,3}(?:[-+*]|[0-9]{1,9}[.)])[ \t]+/.test(line)) { list = true; listBlank = false; continue; }
    if (list) {
      if (!line.trim()) { listBlank = true; continue; }
      if (/^[ \t]/.test(line) || (!listBlank && !/^#{1,6}(?:[ \t]|$)/.test(line))) continue;
      list = false; listBlank = false;
    }
    const heading = /^ {0,3}(#{1,6})(?:[ \t]+(.*)|[ \t]*)$/.exec(line);
    if (heading) headings.push({ title: (heading[2] ?? '').replace(/(?:^|[ \t]+)#+[ \t]*$/, '').trim(), level: heading[1]!.length, startLine: index + 1 });
  }
  const sections: OrientationSection[] = []; let omitted = 0;
  for (let index = 0; index < headings.length; index++) {
    const heading = headings[index]!;
    if (!heading.title || Buffer.byteLength(heading.title) > sectionLimits.headingBytes || sections.length >= sectionLimits.sections) { omitted++; continue; }
    const next = headings.slice(index + 1).find(other => other.level <= heading.level);
    const endLine = next ? next.startLine - 1 : lines.length;
    sections.push({ ...heading, endLine, evidenceIds: refs.filter(ref => ref.startLine <= endLine && ref.endLine >= heading.startLine).map(ref => ref.id) });
  }
  return { sections, omittedSections: omitted };
}
