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
  const value = { summary: 'Fixture café investigation', findings: ['Read both repositories.'], unresolvedQuestions: [] };
  const result = mode === 'invalid-result' ? '{}' : JSON.stringify(value);
  if (mode === 'oversize') emit({type:'item.completed',item:{type:'agent_message',text:'x'.repeat(2*1024*1024+1)}});
  else {
    const bytes = Buffer.from(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:result}})+'\n');
    for (const byte of bytes) { process.stdout.write(Buffer.from([byte])); await new Promise((r)=>setImmediate(r)); }
  }
  if (mode !== 'no-completion') emit({type:'turn.completed'});
  if (mode === 'nonzero') process.exitCode = 3;
});
