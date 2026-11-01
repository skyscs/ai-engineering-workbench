import type { CatalogStore } from '../src/store.js';
import type { DatabaseSync } from 'node:sqlite';

/** Recreate schema-8 literal storage only in owned migration fixtures. */
export function removeExternalSearchSchema(db: DatabaseSync) {
  const settings = db.prepare("SELECT k,v FROM search_config WHERE k<>'version' ORDER BY k").all();
  db.exec(`BEGIN IMMEDIATE;
    CREATE TABLE legacy_test_content AS SELECT rowid,spanId,text FROM search;
    DROP TABLE search;
    DROP VIEW literal_search_content;
    DROP TABLE literal_search_documents;
    CREATE VIRTUAL TABLE search USING fts5(spanId UNINDEXED,text);
    INSERT INTO search(rowid,spanId,text) SELECT rowid,spanId,text FROM legacy_test_content;
    DROP TABLE legacy_test_content;
    PRAGMA user_version=8; COMMIT;`);
  for (const setting of settings) db.prepare('INSERT INTO search(search,rank) VALUES (?,?)').run(setting.k!, typeof setting.v === 'number' ? BigInt(setting.v) : setting.v!);
}

/** Remove only refresh additions from owned test fixtures before legacy migration tests. */
export function removeRefreshSchema(store: CatalogStore) {
  removeReconciliationSchema(store);
  store.db.exec(`ALTER TABLE files DROP COLUMN extractionHash;
    ALTER TABLE files DROP COLUMN reusedFromFileId;
    ALTER TABLE files DROP COLUMN gitReadAttempts;
    ALTER TABLE files DROP COLUMN cacheRejected;
    ALTER TABLE builds DROP COLUMN baselineBuildId;
    ALTER TABLE builds DROP COLUMN refreshVersion;`);
}

/** Remove only schema 6 additions from owned legacy migration fixtures. */
export function removeReconciliationSchema(store: CatalogStore) {
  removeOnboardingSchema(store);
  store.db.exec('DROP TABLE correction_reapplications;');
}

/** Remove only schema 7 additions from owned legacy migration fixtures. */
export function removeOnboardingSchema(store: CatalogStore) {
  removeCodeAnalysisSchema(store);
  store.db.exec('DROP TABLE source_registrations; ALTER TABLE builds DROP COLUMN allocation;');
}

/** Remove only schema 8 additions from owned legacy migration fixtures. */
export function removeCodeAnalysisSchema(store: CatalogStore) {
  removeExternalSearchSchema(store.db);
  store.db.exec('DROP TRIGGER code_analysis_boundary; DROP TABLE code_analysis_files; DROP TABLE code_analysis_sources; DROP TABLE code_analyses;');
}
