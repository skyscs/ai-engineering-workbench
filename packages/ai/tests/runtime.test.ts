import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CodexCliRuntime, type AIRunRequest, type AIEvent } from '../src/index.js';

function fixture(t: TestContext, mode = 'success', timeoutMs = 10000) {
  const root = mkdtempSync(path.join(tmpdir(), 'aew-ai-test-')), config = path.join(root, 'config'), cwd = path.join(root, 'repo');
  mkdirSync(config); mkdirSync(cwd); writeFileSync(path.join(config, 'config.toml'), '');
  const executable = path.join(root, 'codex-fixture');
  writeFileSync(executable, `#!${process.execPath}\nrequire(${JSON.stringify(fileURLToPath(new URL('./fixture-cli.cjs', import.meta.url)))});`, { mode: 0o700 });
  const capture = path.join(root, 'capture.json'), pid = path.join(root, 'pid');
  const env = { PATH: process.env.PATH!, CODEX_HOME: config, FIXTURE_MODE: mode, FIXTURE_CAPTURE: capture, FIXTURE_PID: pid };
  const controller = new AbortController();
  const request = { workspaceId:'w',taskId:'t',stageRunId:'r', connection:{executablePath:executable,configProfile:null,configHome:config}, profile:{modelIdentifier:'opaque-model',reasoningEffort:'medium'},
    workingDirectory:cwd,readRoots:[cwd],contextManifest:{},instructions:'Read selected text café.',outputSchemaVersion:'fixture-v1',outputSchema:{type:'object'},
    validateResult:(v: unknown) => !!v && typeof v === 'object' && 'summary' in v, accessMode:'read',signal:controller.signal } as unknown as AIRunRequest;
  t.after(() => rmSync(root, { recursive:true,force:true }));
  return { root,config,cwd,env,capture,pid,controller,request,runtime:new CodexCliRuntime({env,timeoutMs}) };
}
async function collect(runtime: CodexCliRuntime, request: AIRunRequest) { const events: AIEvent[]=[]; for await (const event of runtime.run(request)) events.push(event); return events; }
const failure = (code: string) => (error: unknown) => !!error && typeof error === 'object' && 'failure' in error && (error.failure as {code:string}).code === code;

test('chunked UTF-8, unknown events and recoverable errors preserve a completed validated result and selected launch settings', async (t) => {
  const f=fixture(t), events=await collect(f.runtime,f.request);
  assert.equal(events[0]!.type,'runtime'); assert.equal(events.at(-1)!.type,'result');
  assert.match(JSON.stringify(events.at(-1)),/café/); assert.doesNotMatch(JSON.stringify(events),/DO_NOT_PERSIST/);
  const capture=JSON.parse(readFileSync(f.capture,'utf8')) as {args:string[];prompt:string};
  assert.equal(capture.prompt,f.request.instructions);
  for (const flag of ['never','read-only','--json','--output-schema','opaque-model','model_reasoning_effort="medium"','notify=[]']) assert.ok(capture.args.includes(flag));
  assert.ok(!capture.args.includes('--add-dir')); assert.ok(!capture.args.includes('--dangerously-bypass-approvals-and-sandbox'));
});

test('missing named profiles, linked profiles and project config cannot fall back or launch', async (t) => {
  const f=fixture(t); f.request.connection.configProfile='absent';
  await assert.rejects(collect(f.runtime,f.request),failure('MISSING_PROFILE')); assert.equal(existsSync(f.capture),false);
  symlinkSync(path.join(f.config,'config.toml'),path.join(f.config,'absent.config.toml'));
  await assert.rejects(collect(f.runtime,f.request),failure('INVALID_CONFIGURATION'));
  f.request.connection.configProfile=null; mkdirSync(path.join(f.cwd,'.codex'));
  await assert.rejects(collect(f.runtime,f.request),failure('PROJECT_CONFIGURATION')); assert.equal(existsSync(f.capture),false);
});

test('unverified versions, MCP and failing diagnostics are rejected without leaking configuration output', async (t) => {
  for(const [mode,code] of [['mcp','UNSUPPORTED_MCP'],['config-fail','CONFIGURATION_FAILED']] as const) {
    const f=fixture(t,mode); await assert.rejects(collect(f.runtime,f.request),(error:unknown)=>{ assert.doesNotMatch(JSON.stringify(error),/DO_NOT_PERSIST/); return failure(code)(error); }); assert.equal(existsSync(f.capture),false);
  }
  const f=fixture(t); const runtime=new CodexCliRuntime({env:{...f.env,FIXTURE_VERSION:'codex-cli 99.0.0'}});
  await assert.rejects(collect(runtime,f.request),failure('UNSUPPORTED_VERSION'));
});

test('configuration changes between recorded preflight and exec fail closed',async(t)=>{
  const f=fixture(t), iterator=f.runtime.run(f.request)[Symbol.asyncIterator]();
  assert.equal((await iterator.next()).value.type,'runtime');
  writeFileSync(path.join(f.config,'config.toml'),'changed=true');
  await assert.rejects(iterator.next(),failure('CONFIGURATION_CHANGED')); assert.equal(existsSync(f.capture),false);
});

test('malformed framing, missing completion, invalid schema and nonzero exit cannot publish success',async(t)=>{
  for(const [mode,code] of [['malformed','INVALID_JSONL'],['partial','INVALID_JSONL'],['no-completion','PROCESS_FAILED'],['invalid-result','INVALID_RESULT'],['nonzero','PROCESS_FAILED'],['oversize','RESULT_LIMIT']] as const) {
    const f=fixture(t,mode); await assert.rejects(collect(f.runtime,f.request),failure(code));
  }
});

test('authentication errors retain exit status and redact diagnostic credentials',async(t)=>{
  const f=fixture(t,'failure'); await assert.rejects(collect(f.runtime,f.request),(error:unknown)=>{
    assert.ok(failure('AUTHENTICATION_REQUIRED')(error)); const result=(error as {failure:{exitCode:number;stderr:string}}).failure;
    assert.equal(result.exitCode,1); assert.doesNotMatch(result.stderr,/sk-secretfixture|user:password/); return true;
  });
});

test('event flood is explicitly truncated while final structured output remains available',async(t)=>{
  const f=fixture(t,'flood'), events=await collect(f.runtime,f.request);
  assert.equal(events.filter((e)=>e.type==='truncated').length,1); assert.equal(events.at(-1)!.type,'result');
  assert.ok(Buffer.byteLength(JSON.stringify(events))<11*1024**2);
});

test('cancellation owns descendants and takes precedence; concurrent requests are rejected',async(t)=>{
  const f=fixture(t,'sleep'), pending=collect(f.runtime,f.request);
  const outcome=assert.rejects(pending,failure('CANCELLED'));
  await assert.rejects(collect(f.runtime,f.request),failure('RUNTIME_BUSY'));
  const deadline=Date.now()+5000; while(!existsSync(f.pid)&&Date.now()<deadline) await new Promise(r=>setTimeout(r,10));
  assert.ok(existsSync(f.pid)); const child=Number(readFileSync(f.pid,'utf8'));
  f.controller.abort(); await outcome;
  // A reaped process may briefly be a zombie; it must not continue executing.
  try { const stat=readFileSync(`/proc/${child}/stat`,'utf8'); assert.match(stat,/\) Z /); } catch(error) { if((error as NodeJS.ErrnoException).code!=='ENOENT') throw error; }
});

test('timeout and pre-aborted requests stop without a successful result',async(t)=>{
  const f=fixture(t,'sleep',300); await assert.rejects(collect(f.runtime,f.request),failure('TIMEOUT'));
  const second=fixture(t); second.controller.abort(); await assert.rejects(collect(second.runtime,second.request),failure('CANCELLED')); assert.equal(existsSync(second.capture),false);
});

test('every CLI subprocess uses the saved home despite an inherited corporate home', async(t)=>{
  const f=fixture(t), other=path.join(f.root,'corporate'), capture=path.join(f.root,'environment.jsonl');
  mkdirSync(other); writeFileSync(path.join(other,'config.toml'),'');
  const inherited={...f.env,CODEX_HOME:other,FIXTURE_ENV_CAPTURE:capture};
  const events=await collect(new CodexCliRuntime({env:inherited}),f.request);
  const rows=readFileSync(capture,'utf8').trim().split('\n').map(line=>JSON.parse(line) as {args:string[];configHome:string});
  assert.ok(rows.length>=4); assert.ok(rows.every(row=>row.configHome===f.config));
  assert.ok(rows.some(row=>row.args.includes('--version'))); assert.ok(rows.some(row=>row.args.includes('exec')));
  assert.equal((events[0] as {data:{configHome:string}}).data.configHome,f.config);
  assert.equal(inherited.CODEX_HOME,other);
});

test('unbound, missing, redirected homes and ambient credentials fail before any subprocess',async(t)=>{
  const f=fixture(t), capture=path.join(f.root,'environment.jsonl'), env={...f.env,FIXTURE_ENV_CAPTURE:capture};
  const selected=f.request.connection.configHome;
  for(const home of [null,'relative',path.join(f.root,'missing')]) {
    f.request.connection.configHome=home;
    await assert.rejects(collect(new CodexCliRuntime({env}),f.request),failure(home && path.isAbsolute(home)?'CONFIGURATION_UNAVAILABLE':'CONFIGURATION_REQUIRED'));
  }
  const redirected=path.join(f.root,'redirected'); symlinkSync(f.config,redirected); f.request.connection.configHome=redirected;
  await assert.rejects(collect(new CodexCliRuntime({env}),f.request),failure('CONFIGURATION_UNAVAILABLE'));
  f.request.connection.configHome=selected;
  await assert.rejects(collect(new CodexCliRuntime({env:{...env,CODEX_API_KEY:'never-persist-this-fixture'}}),f.request),error=>{
    assert.doesNotMatch(JSON.stringify(error),/never-persist-this-fixture/); return failure('AMBIENT_AUTH_OVERRIDE')(error);
  });
  assert.equal(existsSync(capture),false);
});
