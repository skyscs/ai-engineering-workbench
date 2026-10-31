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
  store.db.exec('DROP TABLE correction_reapplications;');
}
