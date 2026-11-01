import type { MapEvidence } from './system-map-types.js';
import type { OrientationSection } from './orientation-types.js';

export const sectionLimits = { sections: 12, headingBytes: 160 } as const;

/** Conservative ATX navigation over validated text; not a complete Markdown parser. */
export function readmeSections(content: string, refs: Pick<MapEvidence, 'id' | 'startLine' | 'endLine'>[]) {
  const lines = content.split('\n'), headings: { title: string; level: number; startLine: number }[] = [];
  // Match issued evidence: a terminal newline does not create another source line.
  if (content.endsWith('\n')) lines.pop();
  let fence: string | undefined, html: string | undefined, list = false, listBlank = false;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    if (fence) {
      const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line)?.[1];
      if (close && close[0] === fence[0] && close.length >= fence.length) fence = undefined;
      continue;
    }
    if (html) {
      if (html === 'blank' ? !line.trim() : html === 'comment' ? line.includes('-->')
        : html === 'processing' ? line.includes('?>') : html === 'cdata' ? line.includes(']]>')
        : html === 'declaration' ? line.includes('>') : line.toLowerCase().includes(`</${html}>`)) html = undefined;
      continue;
    }
    const open = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (open && !(open[1]![0] === '`' && open[2]!.includes('`'))) { fence = open[1]; continue; }
    const comment = line.indexOf('<!--');
    if (comment >= 0) { if (!line.includes('-->', comment + 4)) html = 'comment'; continue; }
    if (/^ {0,3}<!\[CDATA\[/.test(line)) { if (!line.includes(']]>')) html = 'cdata'; continue; }
    if (/^ {0,3}<![A-Z]/.test(line)) { if (!line.includes('>')) html = 'declaration'; continue; }
    if (/^ {0,3}<\?/.test(line)) { if (!line.includes('?>')) html = 'processing'; continue; }
    const rawTag = /^ {0,3}<(script|pre|style|textarea)(?:[ \t>]|$)/i.exec(line)?.[1]?.toLowerCase();
    if (rawTag) { if (!line.toLowerCase().includes(`</${rawTag}>`)) html = rawTag; continue; }
    // HTML-looking blocks are intentionally conservative; full originals remain available.
    if (/^ {0,3}<\/?[A-Za-z!]/.test(line)) { html = 'blank'; continue; }
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
