import assert from 'node:assert/strict';

// Experimental catalogs are generated copies only. Never use this adapter with user data.
export function externalSearchStore(BaseStore) {
  return class ExternalSearchStore extends BaseStore {
    constructor(directory) {
      super(directory);
      try {
        const existing = this.one("SELECT name FROM sqlite_schema WHERE name='literal_search_experiment'");
        if (existing) {
          assert.equal(this.one('SELECT version FROM literal_search_experiment').version, 'external-literal/1');
        } else this.transaction(() => {
          assert.equal(this.one('PRAGMA user_version').user_version, 8);
          this.db.exec("INSERT INTO search(search,rank) VALUES('integrity-check',1)");
          const mismatch = this.one(`SELECT 1 FROM search LEFT JOIN spans s ON s.id=search.spanId
            WHERE s.id IS NULL OR CAST(search.text AS BLOB) IS NOT CAST(s.text AS BLOB) LIMIT 1`);
          assert.ok(!mismatch, 'Literal search and original spans must agree before conversion.');
          assert.equal(this.one('SELECT count(*) AS n FROM search').n, this.one('SELECT count(*) AS n FROM spans').n);
          assert.ok(!this.one('SELECT 1 FROM search GROUP BY spanId HAVING count(*)<>1 LIMIT 1'));
          this.db.exec(`
            CREATE TABLE literal_search_documents (id INTEGER PRIMARY KEY, spanId TEXT NOT NULL UNIQUE REFERENCES spans(id) ON DELETE CASCADE);
            INSERT INTO literal_search_documents (id,spanId) SELECT rowid,spanId FROM search;
            CREATE VIEW literal_search_content AS SELECT d.id AS rowid,d.spanId,s.text
              FROM literal_search_documents d JOIN spans s ON s.id=d.spanId;
            ALTER TABLE search RENAME TO original_search;
            CREATE VIRTUAL TABLE search USING fts5(spanId UNINDEXED,text,content='literal_search_content',content_rowid='rowid');
            INSERT INTO search (rowid,spanId,text) SELECT rowid,spanId,text FROM original_search;
            DROP TABLE original_search;
            CREATE TABLE literal_search_experiment (version TEXT NOT NULL);
            INSERT INTO literal_search_experiment VALUES ('external-literal/1');
          `);
        });
        this.db.exec("INSERT INTO search(search,rank) VALUES('integrity-check',1)");
      } catch (error) {this.close(); throw error;}
    }
    run(sql, ...args) {
      if (sql === 'INSERT INTO search (spanId,text) VALUES (?,?)') {
        const row = this.db.prepare('INSERT INTO literal_search_documents (spanId) VALUES (?) RETURNING id').get(args[0]);
        return super.run('INSERT INTO search (rowid,spanId,text) VALUES (?,?,?)', row.id, ...args);
      }
      return super.run(sql, ...args);
    }
  };
}

export function validateExternalSearch(store) {
  store.db.exec("INSERT INTO search(search,rank) VALUES('integrity-check',1)");
  assert.equal(store.one('SELECT count(*) AS n FROM literal_search_documents').n, store.one('SELECT count(*) AS n FROM spans').n);
  assert.ok(!store.one('SELECT 1 FROM pragma_foreign_key_check LIMIT 1'));
}

export function searchStorageAllocation(store) {
  const rows = store.all(`SELECT coalesce(s.tbl_name,d.name) AS tableName, sum(d.pgsize) AS bytes FROM dbstat d
    LEFT JOIN sqlite_schema s ON s.name=d.name GROUP BY coalesce(s.tbl_name,d.name)`);
  const literalBytes = rows.filter(row => row.tableName === 'search' || row.tableName.startsWith('search_')
    || row.tableName === 'literal_search_documents').reduce((sum,row) => sum + row.bytes, 0);
  const pageSize = store.one('PRAGMA page_size').page_size, pages = store.one('PRAGMA page_count').page_count;
  return {pageSize, pages, totalBytes: pageSize * pages, literalBytes,
    freePages: store.one('PRAGMA freelist_count').freelist_count};
}
