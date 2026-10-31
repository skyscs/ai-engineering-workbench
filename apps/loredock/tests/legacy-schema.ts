import type { CatalogStore } from '../src/store.js';

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
  store.db.exec('DROP TRIGGER code_analysis_boundary; DROP TABLE code_analysis_files; DROP TABLE code_analysis_sources; DROP TABLE code_analyses;');
}
