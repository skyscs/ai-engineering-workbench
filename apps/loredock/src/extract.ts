import { createHash } from 'node:crypto';
import path from 'node:path';
import { safePath, type TreeEntry } from './git.js';
import type { Policy } from './types.js';

export const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export const extractorVersion = 'text-v1';
export function exclusion(entry: TreeEntry, policy: Policy, fileBytes: number): string | null {
  if (!safePath(entry.path)) return 'unsafe-path';
  if (entry.mode === '120000') return 'symlink';
  if (entry.mode === '160000') return 'submodule';
  if (!['100644', '100755'].includes(entry.mode)) return 'unsupported-mode';
  const segments = entry.path.toLowerCase().split('/');
  if (segments.some(segment => ['.git', '.codex', 'node_modules', 'vendor', 'dist', 'build', 'secrets'].includes(segment)
    || segment === '.env' || segment.startsWith('.env.') || /\.(pem|key|p12|pfx)$/.test(segment))) return 'policy';
  if (policy.excludedPaths.some(prefix => entry.path === prefix || entry.path.startsWith(prefix + '/'))) return 'policy';
  if (entry.size > fileBytes) return 'file-size-limit';
  if (!entry.size) return 'empty';
  return null;
}

/** Conservative Maven subset: never resolve entities, DTDs, includes or URLs. */
function mavenMetadata(text: string): Record<string, unknown> | null {
  const clean = text.replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*<\?xml[^?]*\?>/, '');
  if (/<[!?]|&/.test(clean)) return null;
  const tokens = clean.match(/<[^>]*>|[^<]+/g) ?? [];
  if (tokens.join('') !== clean) return null;
  const stack: string[] = []; const result: Record<string, unknown> = { kind: 'maven' }; let rootSeen = false;
  for (const token of tokens) {
    if (token.startsWith('</')) {
      const match = /^<\/([A-Za-z_][\w.:-]*)\s*>$/.exec(token);
      if (!match || stack.pop() !== match[1]) return null;
    } else if (token.startsWith('<')) {
      const match = /^<([A-Za-z_][\w.:-]*)(?:\s+[A-Za-z_][\w.:-]*\s*=\s*(?:"[^"<>]*"|'[^'<>]*'))*\s*(\/?)>$/.exec(token);
      if (!match || stack.length > 64) return null;
      if (!stack.length) { if (rootSeen || match[1] !== 'project') return null; rootSeen = true; }
      if (!match[2]) stack.push(match[1]!);
    } else if (token.trim()) {
      if (!stack.length) return null;
      const key = stack.join('/');
      if (['project/groupId', 'project/artifactId', 'project/version', 'project/properties/maven.compiler.release'].includes(key)) result[stack.at(-1)!] = token.trim();
    }
  }
  return rootSeen && !stack.length ? result : null;
}

export function extract(bytes: Buffer, filePath: string): { reason: string } | { text: string; metadata: Record<string, unknown> } {
  if (bytes.includes(0)) return { reason: 'binary' };
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { return { reason: 'invalid-utf8' }; }
  if (text.startsWith('version https://git-lfs.github.com/spec/v1\n') || text.startsWith('version https://git-lfs.github.com/spec/v1\r\n')) return { reason: 'lfs-pointer' };
  const extension = path.posix.extname(filePath).toLowerCase();
  const name = path.posix.basename(filePath).toLowerCase();
  const allowed = ['.md', '.txt', '.log', '.java', '.js', '.jsx', '.ts', '.tsx', '.vue', '.json', '.xml', '.yaml', '.yml', '.properties', '.css', '.html', '.sql', '.sh', '.gradle'];
  if (!allowed.includes(extension) && !['readme', 'license', 'dockerfile', 'makefile', '.gitignore'].includes(name)) return { reason: 'unsupported-format' };
  let metadata: Record<string, unknown> = { kind: extension.slice(1) || 'text' };
  if (extension === '.json') {
    try {
      const value: unknown = JSON.parse(text);
      metadata = { kind: 'json' };
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const record = value as Record<string, unknown>;
        metadata.keys = Object.keys(record).slice(0, 100);
        if (name === 'package.json') for (const key of ['name', 'version']) if (typeof record[key] === 'string') metadata[key] = record[key];
      }
    } catch { return { reason: 'malformed-json' }; }
  }
  if (extension === '.xml') {
    if (/<!\s*(DOCTYPE|ENTITY)\b/i.test(text)) return { reason: 'xml-entity-declaration' };
    if (name === 'pom.xml') { const parsed = mavenMetadata(text); if (!parsed) return { reason: 'unsupported-maven-xml' }; metadata = parsed; }
  }
  return { text: text.replaceAll('\r\n', '\n'), metadata };
}

export function spans(text: string): { startLine: number; endLine: number; text: string }[] {
  const lines = text.split('\n'); if (text.endsWith('\n')) lines.pop();
  const result = [];
  for (let start = 0; start < lines.length; start += 120) {
    const selected = lines.slice(start, start + 120);
    result.push({ startLine: start + 1, endLine: start + selected.length, text: selected.join('\n') });
  }
  return result;
}
