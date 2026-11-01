import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readStorageSnapshot} from './loredock-storage.mjs';

export const historyLimits = Object.freeze({generations:1000,outputBytes:4*1024*1024});
const statuses = new Set(['preparing','running','pause_requested','paused','interrupted','cancelled','completed','partial','failed']);
const uuid = value => typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const timestamp = value => typeof value==='string' && value.length===24 && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString()===value;

export function auditHistory(directory) {
  return readStorageSnapshot(directory,(db,databaseVersion)=>{
    const one = sql => db.prepare(sql).get();
    const selected = 'SELECT id FROM builds ORDER BY rowid LIMIT '+historyLimits.generations;
    const groups = sql => new Map(db.prepare(sql).all().map(({id,...counts})=>[id,counts]));
    const total = one('SELECT count(*) AS n FROM builds').n;
    const rows = db.prepare('SELECT id,createdAt,status,published,baselineBuildId FROM builds ORDER BY rowid LIMIT ?').all(historyLimits.generations);
    const current = one('SELECT publishedBuildId FROM project WHERE id=1').publishedBuildId;
    const files = groups(`SELECT buildId AS id,count(*) AS total,
      count(CASE WHEN status='indexed' THEN 1 END) AS indexed,count(CASE WHEN status='excluded' THEN 1 END) AS excluded,
      count(CASE WHEN status='failed' THEN 1 END) AS failed,count(CASE WHEN status='pending' THEN 1 END) AS pending,
      count(CASE WHEN status='purged' THEN 1 END) AS purged,
      count(CASE WHEN status NOT IN ('indexed','excluded','failed','pending','purged') THEN 1 END) AS unrecognized,
      coalesce(sum(length(CAST(raw AS BLOB))),0) AS rawBytes FROM files WHERE buildId IN (${selected}) GROUP BY buildId`);
    const spans = groups(`SELECT f.buildId AS id,count(*) AS total,coalesce(sum(length(CAST(s.text AS BLOB))),0) AS textBytes
      FROM spans s JOIN files f ON f.id=s.fileId WHERE f.buildId IN (${selected}) GROUP BY f.buildId`);
    const search = table => groups(`SELECT f.buildId AS id,count(*) AS documents FROM ${table} q JOIN spans s ON s.id=q.spanId
      JOIN files f ON f.id=s.fileId WHERE f.buildId IN (${selected}) GROUP BY f.buildId`);
    const literal = search('search'), question = search('question_search');
    const answers = groups(`SELECT buildId AS id,count(*) AS total,count(CASE WHEN status IN ('preparing','running') THEN 1 END) AS unfinished
      FROM answer_attempts WHERE buildId IN (${selected}) GROUP BY buildId`);
    const review = groups(`SELECT buildId AS id,count(*) AS versions,count(CASE WHEN purged=1 THEN 1 END) AS purged,
      count(CASE WHEN action='withdraw' THEN 1 END) AS withdrawals FROM corrections WHERE buildId IN (${selected}) GROUP BY buildId`);
    const code = groups(`SELECT buildId AS id,count(*) AS runs,count(CASE WHEN status IN ('running','paused','interrupted') THEN 1 END) AS unfinished
      FROM code_analyses WHERE buildId IN (${selected}) GROUP BY buildId`);
    const codePayload = groups(`SELECT a.buildId AS id,coalesce(sum(length(CAST(f.payload AS BLOB))),0) AS bytes
      FROM code_analysis_files f JOIN code_analyses a ON a.id=f.runId WHERE a.buildId IN (${selected}) GROUP BY a.buildId`);
    const baseline = groups(`SELECT baselineBuildId AS id,count(*) AS total FROM builds WHERE baselineBuildId IN (${selected}) GROUP BY baselineBuildId`);
    const reuse = groups(`SELECT old.buildId AS id,count(*) AS total FROM files f JOIN files old ON old.id=f.reusedFromFileId
      WHERE old.buildId IN (${selected}) GROUP BY old.buildId`);
    const reapplications = side => groups(`SELECT ${side}.buildId AS id,count(*) AS total FROM correction_reapplications r
      JOIN corrections old ON old.id=r.sourceCorrectionId JOIN corrections newer ON newer.id=r.correctionId
      WHERE old.buildId<>newer.buildId AND ${side}.buildId IN (${selected}) GROUP BY ${side}.buildId`);
    const origins = reapplications('old'), targets = reapplications('newer');
    let foreignKeyViolations = 0, invalidReportedMetadata = 0;
    for (const _ of db.prepare('PRAGMA foreign_key_check').iterate()) foreignKeyViolations++;
    const currentPointerMissing = current!==null && !db.prepare('SELECT 1 FROM builds WHERE id=?').get(current);
    const currentPointerMalformed = current!==null && !uuid(current);
    const items = rows.map(row=>{
      const validId=uuid(row.id),validDate=timestamp(row.createdAt),validStatus=statuses.has(row.status),
        validBaseline=row.baselineBuildId===null || uuid(row.baselineBuildId),validPublished=row.published===0 || row.published===1;
      if (!validId || !validDate || !validStatus || !validBaseline || !validPublished) invalidReportedMetadata++;
      return {id:validId?row.id:null,createdAt:validDate?row.createdAt:null,status:validStatus?row.status:'unrecognized',
        published:validPublished?Boolean(row.published):null,current:row.id===current,baselineBuildId:validBaseline?row.baselineBuildId:null,
        files:files.get(row.id)??{total:0,indexed:0,excluded:0,failed:0,pending:0,purged:0,unrecognized:0,rawBytes:0},
        spans:spans.get(row.id)??{total:0,textBytes:0},
        search:{literalDocuments:literal.get(row.id)?.documents??0,questionDocuments:question.get(row.id)?.documents??0},
        answers:answers.get(row.id)??{total:0,unfinished:0},
        review:{...(review.get(row.id)??{versions:0,purged:0,withdrawals:0}),
          sourceForReapplications:origins.get(row.id)?.total??0,reappliedFromOtherBuilds:targets.get(row.id)?.total??0},
        code:{...(code.get(row.id)??{runs:0,unfinished:0}),payloadBytes:codePayload.get(row.id)?.bytes??0},
        incoming:{baselineBuilds:baseline.get(row.id)?.total??0,reusedFiles:reuse.get(row.id)?.total??0}};
    });
    const report={schemaVersion:'loredock-history-audit/1',capturedAt:new Date().toISOString(),databaseVersion,
      referenceChecks:{status:foreignKeyViolations || currentPointerMissing || currentPointerMalformed || invalidReportedMetadata?'inconsistent':'passed',
        foreignKeyViolations,currentPointerMissing,currentPointerMalformed,invalidReportedMetadata,
        coverage:'SQL foreign keys, current pointer and reported build metadata only; embedded JSON, FTS postings and transitive dependencies are not validated.'},
      generations:{total,reported:items.length,omitted:total-items.length,complete:total===items.length,limit:historyLimits.generations,items},
      limits:[
        'Direct references and logical payload counts do not establish deletion eligibility or reclaimable disk space.',
        'Literal and question FTS statistics span generations. Removing historical documents can change current ranking and selected context.',
        'Payload byte counters overlap SQLite allocation; do not add them to page/disk totals.',
        'Terminal, fenced, purged and withdrawn metadata is retained in counts. Omitted generations may have dependencies.',
        'This on-demand report may scan large histories. It never deletes, migrates, recovers, checkpoints, compacts or starts work.',
        'Read-only SQLite may maintain shared-memory bookkeeping; this is not a forensic disk acquisition.'
      ]};
    const updateCoverage=()=>{report.generations.reported=items.length;report.generations.omitted=total-items.length;report.generations.complete=total===items.length;};
    while(Buffer.byteLength(JSON.stringify(report,null,2)+'\n')>historyLimits.outputBytes && items.length) {items.pop();updateCoverage();}
    if(Buffer.byteLength(JSON.stringify(report,null,2)+'\n')>historyLimits.outputBytes) throw new Error('History report exceeds its output byte limit.');
    const validateNumbers=value=>{
      if(typeof value==='number' && (!Number.isSafeInteger(value) || value<0)) throw new Error('History counters are inconsistent or exceed the supported integer range.');
      if(value && typeof value==='object') Object.values(value).forEach(validateNumbers);
    };
    validateNumbers(report); return report;
  });
}
export function historyArguments(args) {
  if(args.length!==2 || args[0]!=='--data-dir' || !path.isAbsolute(args[1])) throw new Error('Usage: pnpm loredock:history --data-dir /absolute/loredock-data');
  return args[1];
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {process.stdout.write(JSON.stringify(auditHistory(historyArguments(process.argv.slice(2))),null,2)+'\n');}
  catch(error) {console.error(`History report failed: ${error.message}`);process.exitCode=1;}
}
