import { createHash } from 'node:crypto';

// Opt-in candidate over the pinned baseline. Only snapshot allocation ownership changes.
export function createStreamingAnalysis({ CodeAnalysis, CatalogError, codeAnalysisLimits }) {
  const checked = condition => {
    if (!condition) throw new CatalogError('CORRUPT_CODE_CHECKPOINT', 'Stored code analysis failed validation. Start a new inventory.', 409);
  };
  const checkpointHash = unit => createHash('sha256').update(JSON.stringify([
    unit.runId, unit.fileId, unit.ordinal, unit.inputHash, unit.status, unit.reason,
    unit.inputBytes, unit.payloadBytes, unit.gapCount, unit.payloadHash,
  ])).digest('hex');
  return class StreamingCodeAnalysis extends CodeAnalysis {
    snapshot(id) {
      const store = this.catalog.store, row = store.one('SELECT * FROM code_analyses WHERE id=?', id);
      if (!row) throw new CatalogError('NOT_FOUND', 'This code inventory is unavailable or was evicted.', 404);
      // Same authorization as the baseline; no private service methods or cached results.
      const project = store.project();
      if (row.status === 'fenced' || project.policyVersion !== row.policyVersion || project.sourceSetVersion !== row.registryVersion)
        throw new CatalogError('ANALYSIS_FENCED', 'Sources or policy changed. Start a new code inventory.', 409);
      this.catalog.readBuildHeader(row.buildId);
      if (row.fingerprint !== this.fingerprint) throw new CatalogError('PARSER_CHANGED', 'The code parser changed. Start a new inventory.', 409);
      checked(row.limits === JSON.stringify(this.limits));
      if (!row.published) throw new CatalogError('NOT_READY', 'Finish code analysis before querying its facts.', 409);

      const manifest = createHash('sha256').update('['), fileIds = [];
      let count = 0, textBytes = 0, payloadBytes = 0;
      const statement = store.db.prepare(`SELECT runId,fileId,ordinal,inputHash,status,reason,inputBytes,payloadBytes,gapCount,payloadHash,checkpointHash,
      length(CAST(payload AS BLOB)) storedBytes FROM code_analysis_files WHERE runId=? ORDER BY ordinal LIMIT ?`);
      for (const unit of statement.iterate(id, codeAnalysisLimits.documents + 1)) {
        checked(count < codeAnalysisLimits.documents && unit.ordinal === count && unit.status !== 'pending'
          && checkpointHash(unit) === unit.checkpointHash
          && Number.isSafeInteger(unit.inputBytes) && unit.inputBytes >= 0
          && Number.isSafeInteger(unit.payloadBytes) && unit.payloadBytes >= 0
          && Number.isSafeInteger(unit.gapCount) && unit.gapCount >= 0
          && (unit.status === 'parsed' ? unit.storedBytes === unit.payloadBytes && unit.payloadBytes <= this.limits.filePayloadBytes
            : unit.storedBytes === null && unit.payloadBytes === 0 && unit.payloadHash === null));
        if (count) manifest.update(',');
        manifest.update(JSON.stringify({ fileId: unit.fileId, inputHash: unit.inputHash }));
        count++; textBytes += unit.inputBytes; payloadBytes += unit.payloadBytes;
        if (unit.status === 'parsed') fileIds.push(unit.fileId);
      }
      checked(count === row.candidates && manifest.update(']').digest('hex') === row.manifestHash
        && textBytes === row.textBytes && row.textBytes <= this.limits.textBytes
        && payloadBytes === row.payloadBytes && row.payloadBytes <= this.limits.payloadBytes);
      return { summary: this.get(id), policyVersion: row.policyVersion, registryVersion: row.registryVersion,
        manifestHash: row.manifestHash, fileIds };
    }
  };
}
