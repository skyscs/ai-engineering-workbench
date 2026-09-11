const fs = require('node:fs');
const { spawn } = require('node:child_process');
if (process.env.FIXTURE_ENV_CAPTURE) fs.appendFileSync(process.env.FIXTURE_ENV_CAPTURE, JSON.stringify({ args: process.argv.slice(2), configHome: process.env.CODEX_HOME }) + '\n');
const args = process.argv.slice(2), mode = process.env.FIXTURE_MODE;
if (args.includes('--version')) { console.log(process.env.FIXTURE_VERSION || 'codex-cli 0.154.0'); process.exit(); }
if (args.includes('features')) { for (const name of ['apps','plugins','hooks','browser_use','computer_use','image_generation','multi_agent']) console.log(`${name} stable false`); process.exit(); }
if (args.includes('mcp')) {
  if (mode === 'config-fail') { console.error('secret=DO_NOT_PERSIST'); process.exit(2); }
  console.log(mode === 'mcp' ? '[{"enabled":true,"token":"DO_NOT_PERSIST"}]' : '[]'); process.exit();
}
let prompt = '';
process.stdin.setEncoding('utf8'); process.stdin.on('data', (c) => prompt += c);
const emit = (event) => process.stdout.write(JSON.stringify(event) + '\n');
process.stdin.on('end', async () => {
  if (process.env.FIXTURE_CAPTURE) fs.writeFileSync(process.env.FIXTURE_CAPTURE, JSON.stringify({ args, prompt }));
  if (mode === 'sleep') {
    const child = spawn(process.execPath, ['-e', `process.on('SIGTERM',()=>{});setInterval(()=>{},1000)`], { stdio: 'inherit', detached: true });
    fs.writeFileSync(process.env.FIXTURE_PID, String(child.pid));
    process.on('SIGTERM', () => {}); setInterval(() => {}, 1000); return;
  }
  if (mode === 'malformed') { process.stdout.write('{broken\n'); return; }
  if (mode === 'partial') { process.stdout.write('{"type":'); return; }
  if (mode === 'failure') { console.error('Authorization: Bearer sk-secretfixture https://user:password@example.invalid'); emit({type:'turn.failed',error:{message:'authentication required'}}); process.exitCode = 1; return; }
  if (mode === 'stderr-flood') process.stderr.write('x'.repeat(65536));
  if (mode === 'flood') for (let i = 0; i < 1400; i++) emit({type:'error',message:'x'.repeat(8192)});
  emit({type:'unknown.future',secret:'DO_NOT_PERSIST'});
  emit({type:'error',message:'Recoverable connection failure'});
  let value = { summary: 'Fixture café investigation', findings: ['Read both repositories.'], unresolvedQuestions: [] };
  const schemaIndex = args.indexOf('--output-schema');
  if (schemaIndex >= 0 && JSON.parse(fs.readFileSync(args[schemaIndex + 1], 'utf8')).properties?.investigation) {
    const input = JSON.parse(prompt.slice(prompt.lastIndexOf('\n') + 1)), repo = input.repositories[0];
    const entry = input.artifacts.find(e => e.range);
    const file = { id:'e1', kind:'repository_file', description:'Pinned repository source.', repositoryId:repo.id, revision:repo.resolvedCommitSha,
      path:mode === 'invalid-evidence' ? 'missing' : 'file', lineStart:1, lineEnd:1, artifactId:null, sha256:null, byteStart:null, byteEnd:null };
    const evidence = [file];
    if (entry) evidence.push({ id:'log', kind:'artifact', description:'Selected log.', repositoryId:null,revision:null,path:null,lineStart:null,lineEnd:null,
      artifactId:entry.id,sha256:entry.sha256,byteStart:entry.range.start,byteEnd:entry.range.end });
    value = { investigation:{summary:'Fixture café investigation\n\n**Observed** `source` [unsafe](javascript:alert(1)) <img src=x onerror=alert(1)>\n\n```text\nPreserve incomplete fence',
      timeline:[{description:'Inspect the retained revision.',evidenceIds:['e1']}]},
      rootCause:{status:'identified',summary:'Synthetic source and log support this explanation.',evidenceIds:evidence.map(e=>e.id),unresolvedQuestions:[]}, evidence };
  }
  const result = mode === 'invalid-result' ? '{}' : JSON.stringify(value);
  if (mode === 'oversize') emit({type:'item.completed',item:{type:'agent_message',text:'x'.repeat(2*1024*1024+1)}});
  else {
    const bytes = Buffer.from(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:result}})+'\n');
    for (const byte of bytes) { process.stdout.write(Buffer.from([byte])); await new Promise((r)=>setImmediate(r)); }
  }
  if (mode !== 'no-completion') emit({type:'turn.completed'});
  if (mode === 'nonzero') process.exitCode = 3;
});
