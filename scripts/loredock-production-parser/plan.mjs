import { createHash } from 'node:crypto';

const content = (length, calls) => `export function useful() { return fetch('/useful'); }\nexport function ${'a'.repeat(length)}() { ${"fetch('/bounded');".repeat(calls)} }\n`;
export const transportCases = [
  { id: 'ordinary', nameLength: 32, calls: 4 },
  { id: 'dense-operations', nameLength: 450, calls: 1100 },
  { id: 'long-owner', nameLength: 8000, calls: 100 },
].map(row => {
  const text = content(row.nameLength, row.calls);
  return { ...row, path: 'src/control.ts', content: text, bytes: Buffer.byteLength(text),
    sha256: createHash('sha256').update(text).digest('hex') };
});
export const transportPlan = Object.freeze({
  schemaVersion: 'ordinary-production-parser-prerequisite/1',
  applicationBase: '48b88a9b5b7f7a70bc2a8a5491007279ad7ec57e',
  node: '22.23.2', entry: 'scripts/loredock-production-parser/transport.mjs',
  cases: transportCases.map(({ content, ...row }) => row),
  inputBytes: 32768, responseBytes: 524288, operationMs: 5000,
  ownerMs: 60000, cleanupMs: 10000,
  gate: 'Every successful direct graph must remain exactly serializable through the owned adapter. Stop production adoption on any mismatch or transport rejection.',
  useful: 'Every direct graph retains the useful function and HTTP operation; originals remain in a stopped catalog and synthetic Git repository.',
  observer: 'Retain first whole-child exit, elapsed time and process CPU/RSS diagnostics. No event-loop, aggregate heap, startup or resource qualification.',
  repeatPolicy: 'Create a new first-attempt directory exclusively. Preserve every case and failure; do not rerun or overwrite this observation.',
  modelCalls: 0, corporateSources: 0, reservedFamilyReads: 0, productionChanges: false,
});
