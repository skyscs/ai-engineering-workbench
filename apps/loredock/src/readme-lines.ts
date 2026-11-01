/** Conservative block exclusions shared by README navigation selectors. */
export function* readmeLines(lines: readonly string[]): Generator<{ line: string; index: number }> {
  let fence: string | undefined, html: string | undefined;
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
    yield { line, index };
  }
}
