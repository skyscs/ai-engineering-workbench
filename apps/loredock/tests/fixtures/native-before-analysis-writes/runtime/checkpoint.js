import { extract, extractorVersion, gitBlobHash, sha256, spans } from './extract.js';
import { CatalogError } from './types.js';
export const refreshVersion = 'git-reuse-v1';
export function checkpointHash(build, file, contentHash, metadata, chunks) {
    return sha256(JSON.stringify(['extracted-file-v1', build.policyVersion, build.policy, build.extractorVersion,
        file.sourceId, file.path, file.mode, file.blob, file.size, contentHash, metadata,
        chunks.map(chunk => [chunk.startLine, chunk.endLine, chunk.hash])]));
}
/** Validate an entire bounded checkpoint before copying any bytes into a new index. */
export function readCheckpoint(store, id, maxBytes) {
    const invalid = () => new CatalogError('CORRUPT_CHECKPOINT', 'A stored checkpoint failed validation. Read the pinned Git object again or cancel and index again.', 409);
    const file = store.one(`SELECT f.id,f.buildId,f.sourceId,f.path,f.mode,f.blob,f.size,f.status,f.reason,f.error,f.contentHash,f.extractionHash,
      f.reusedFromFileId,f.gitReadAttempts,f.cacheRejected,length(f.raw) AS storedBytes,length(CAST(f.metadata AS BLOB)) AS metadataBytes,
      b.policyVersion,b.policy,b.extractorVersion,s.status AS sourceStatus
    FROM files f JOIN builds b ON b.id=f.buildId JOIN sources s ON s.id=f.sourceId WHERE f.id=?`, id);
    if (!file || file.status !== 'indexed' || file.sourceStatus !== 'active' || file.policyVersion !== store.project().policyVersion
        || file.extractorVersion !== extractorVersion || !Number.isSafeInteger(file.size) || file.size < 1 || file.size > maxBytes
        || file.storedBytes !== file.size || file.metadataBytes > file.size * 2 + 4096)
        throw invalid();
    const shape = store.one('SELECT count(*) AS count,sum(length(CAST(text AS BLOB))) AS bytes FROM spans WHERE fileId=?', file.id);
    if (!shape.count || shape.count > Math.ceil((file.size + 1) / 120) || shape.bytes === null || shape.bytes > file.size)
        throw invalid();
    const stored = store.one('SELECT raw,metadata FROM files WHERE id=?', file.id);
    const raw = Buffer.from(stored.raw);
    if (raw.length !== file.size || raw.includes(0) || sha256(raw) !== file.contentHash || gitBlobHash(raw, file.blob) !== file.blob)
        throw invalid();
    let text, metadata;
    try {
        text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(raw).replaceAll('\r\n', '\n');
        const value = JSON.parse(stored.metadata);
        if (!value || typeof value !== 'object' || Array.isArray(value))
            throw invalid();
        metadata = value;
    }
    catch {
        throw invalid();
    }
    const actual = store.all('SELECT startLine,endLine,text,hash FROM spans WHERE fileId=? ORDER BY startLine', file.id), expected = spans(text);
    if (actual.length !== expected.length || actual.some((chunk, index) => chunk.startLine !== expected[index].startLine
        || chunk.endLine !== expected[index].endLine || chunk.text !== expected[index].text || sha256(chunk.text) !== chunk.hash))
        throw invalid();
    if (file.extractionHash !== null) {
        if (checkpointHash(file, file, file.contentHash, stored.metadata, actual) !== file.extractionHash)
            throw invalid();
    }
    else {
        // Schema 4 had no derivation fingerprint. Qualify legacy metadata by re-extraction.
        const legacy = extract(raw, file.path);
        if ('reason' in legacy || legacy.text !== text || JSON.stringify(legacy.metadata) !== stored.metadata)
            throw invalid();
    }
    return { raw, text, metadata };
}
