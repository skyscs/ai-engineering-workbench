import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';

// Isolated mechanism probe. No application data paths, model calls or deletion command.
assert.equal(process.argv.length,2,'This in-memory probe takes no arguments.');
const hash = value => createHash('sha256').update(value).digest('hex');
const root = fileURLToPath(new URL('../',import.meta.url));
const db = new DatabaseSync(':memory:');
try {
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE originals (id INTEGER PRIMARY KEY,buildId TEXT NOT NULL,text TEXT NOT NULL);
    CREATE TABLE documents (id INTEGER PRIMARY KEY,spanId INTEGER NOT NULL UNIQUE REFERENCES originals(id) ON DELETE CASCADE);
    CREATE VIEW original_content AS SELECT d.id AS rowid,d.spanId,s.text FROM documents d JOIN originals s ON s.id=d.spanId;
    CREATE VIRTUAL TABLE search USING fts5(spanId UNINDEXED,text,content='original_content',content_rowid='rowid');
    CREATE VIRTUAL TABLE question_search USING fts5(spanId UNINDEXED,text,tokenize='porter unicode61');
    CREATE VIRTUAL TABLE temp.literal_words USING fts5vocab(main,'search','instance');
    CREATE VIRTUAL TABLE temp.question_words USING fts5vocab(main,'question_search','instance');`);
  const insert = (id,build,text) => {
    db.prepare('INSERT INTO originals VALUES (?,?,?)').run(id,build,text);
    db.prepare('INSERT INTO documents VALUES (?,?)').run(id,id);
    for (const table of ['search','question_search']) db.prepare(`INSERT INTO ${table}(rowid,spanId,text)VALUES(?,?,?)`).run(id,id,text);
  };
  insert(1,'current','alpha alpha ' + 'filler '.repeat(18)); insert(2,'current','alpha filler');
  for (let index=0;index<10;index++) insert(index+3,'historical','legacy '.repeat(200));
  const current = () => db.prepare("SELECT id,text FROM originals WHERE buildId='current' ORDER BY id").all().map(row=>({id:row.id,sha256:hash(row.text)}));
  const capture = () => Object.fromEntries([['search','literal_words'],['question_search','question_words']].map(([table,vocabulary])=>[table,{
    rows:db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n,
    tokenInstances:db.prepare(`SELECT count(*) AS n FROM temp.${vocabulary}`).get().n,
    currentTokens:db.prepare(`SELECT term,doc,col,offset FROM temp.${vocabulary} WHERE doc IN (1,2) ORDER BY term,doc,col,offset`).all(),
    scores:db.prepare(`SELECT ${table}.rowid AS id,rank FROM ${table} JOIN originals s ON s.id=${table}.spanId
      WHERE ${table} MATCH 'alpha' AND s.buildId='current' ORDER BY rank,${table}.rowid`).all()
  }]));
  const originalIdentities=current(),before=capture();
  db.exec(`BEGIN IMMEDIATE;
    DELETE FROM search WHERE spanId IN (SELECT id FROM originals WHERE buildId='historical');
    DELETE FROM question_search WHERE spanId IN (SELECT id FROM originals WHERE buildId='historical');
    DELETE FROM originals WHERE buildId='historical'; COMMIT;
    INSERT INTO search(search,rank)VALUES('integrity-check',1);
    INSERT INTO question_search(question_search,rank)VALUES('integrity-check',1);`);
  const after=capture(); assert.deepEqual(current(),originalIdentities); assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  for(const table of ['search','question_search']) {
    assert.equal(before[table].rows,12); assert.equal(after[table].rows,2);
    assert.equal(before[table].tokenInstances,2022); assert.equal(after[table].tokenInstances,22);
    assert.deepEqual(before[table].currentTokens,after[table].currentTokens);
    assert.deepEqual(before[table].scores.map(row=>row.id),[1,2]); assert.deepEqual(after[table].scores.map(row=>row.id),[2,1]);
  }
  const result={schemaVersion:'loredock-retention-ranking-probe/1',checkedAt:new Date().toISOString(),
    commit:execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    scriptSha256:hash(readFileSync(fileURLToPath(import.meta.url))),node:process.version,sqliteVersion:db.prepare('SELECT sqlite_version() AS version').get().version,
    scope:'In-memory FTS mechanism with a current-build filter; not the full application retrieval pipeline.',
    modelRequests:0,userDataOpened:false,originalIdentities,before,after,currentTextAndTokensUnchanged:true,rankingOrderChanged:true};
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
} finally {db.close();}
