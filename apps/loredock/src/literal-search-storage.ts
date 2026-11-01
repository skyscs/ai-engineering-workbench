import type { DatabaseSync, SQLInputValue } from 'node:sqlite';

/** Called inside the schema migration transaction, before restart recovery. */
export function migrateLiteralSearch(db: DatabaseSync) {
  const sql = db.prepare("SELECT sql FROM sqlite_schema WHERE name='search'").get()?.sql;
  if (typeof sql !== 'string' || !/^CREATE\s+VIRTUAL\s+TABLE\s+(?:search|"search")\s+USING\s+fts5\s*\(\s*spanId\s+UNINDEXED\s*,\s*text\s*\)\s*$/i.test(sql)) {
    throw new Error('Unsupported legacy literal-search layout. Preserve the data directory and restore a compatible backup.');
  }
  db.exec("INSERT INTO search(search,rank) VALUES('integrity-check',1)");
  const mismatch = db.prepare(`SELECT 1 FROM search LEFT JOIN spans s ON s.id=search.spanId
    WHERE s.id IS NULL OR CAST(search.text AS BLOB) IS NOT CAST(s.text AS BLOB) LIMIT 1`).get();
  const searchCount = db.prepare('SELECT count(*) AS n FROM search').get()!.n;
  if (mismatch || searchCount !== db.prepare('SELECT count(*) AS n FROM spans').get()!.n
    || db.prepare('SELECT 1 FROM search GROUP BY spanId HAVING count(*)<>1 LIMIT 1').get()) {
    throw new Error('Literal search and original spans must agree before migration. Preserve the data directory and restore a compatible backup.');
  }
  const settings = db.prepare("SELECT k,v FROM search_config WHERE k<>'version' ORDER BY k").all();
  db.exec(`
    CREATE TABLE literal_search_documents (id INTEGER PRIMARY KEY, spanId TEXT NOT NULL UNIQUE REFERENCES spans(id) ON DELETE CASCADE);
    INSERT INTO literal_search_documents (id,spanId) SELECT rowid,spanId FROM search;
    CREATE VIEW literal_search_content AS SELECT d.id AS rowid,d.spanId,s.text
      FROM literal_search_documents d JOIN spans s ON s.id=d.spanId;
    ALTER TABLE search RENAME TO legacy_literal_search;
    CREATE VIRTUAL TABLE search USING fts5(spanId UNINDEXED,text,content='literal_search_content',content_rowid='rowid');
  `);
  for (const setting of settings) {
    // FTS numeric settings require SQLite INTEGER; node:sqlite binds JS numbers as REAL.
    const value = typeof setting.v === 'number' && Number.isSafeInteger(setting.v) ? BigInt(setting.v) : setting.v as SQLInputValue;
    db.prepare('INSERT INTO search(search,rank) VALUES (?,?)').run(setting.k as string, value);
  }
  db.exec(`INSERT INTO search (rowid,spanId,text) SELECT rowid,spanId,text FROM legacy_literal_search ORDER BY rowid;
    INSERT INTO search(search,rank) VALUES('integrity-check',1);
    DROP TABLE legacy_literal_search;
    PRAGMA user_version=9;`);
}
