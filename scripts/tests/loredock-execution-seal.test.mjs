import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { assertLaunchBoundary } from '../loredock-prepared-flow/execution-verify.mjs';
import { inputFor, definition, executionPlan } from '../loredock-prepared-flow/execution-inputs.mjs';
import { coordinateOrdinary } from '../loredock-prepared-flow/coordinator.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

test('data-only reserved binding preserves original questions, references, counts and setup instructions', async () => {
  const oracle = JSON.parse(await readFile(path.join(root, 'fixtures/loredock-prepared-flow/oracle.json')));
  for (const [size, files, code] of [['representative', 240, 205], ['near-limit', 10000, 9965]]) {
    const input = inputFor(size);
    assert.equal(input.expectedFiles, files); assert.equal(input.expectedCodeFiles, code);
    assert.equal(Object.keys(input.corpus).length, 20); assert.deepEqual(input.expected, oracle.cases[0]);
    assert.equal(input.question, oracle.cases[0].question);
  }
  assert.deepEqual(definition.oracles, oracle.cases); assert.deepEqual(definition.references, oracle.references);
  assert.deepEqual(definition.engineerNote, oracle.engineerNote);
  assert.equal(definition.sourceName, 't-boundary-notes'); assert.equal(executionPlan.catalogRoots.length, 63);
  assert.equal(executionPlan.warmRepetitions, 3); assert.equal(executionPlan.modelEligibility, false);
  assert.throws(() => inputFor('ordinary'));
});

function boundary() {
  const output = '/owned/first', family = 'kiln-prepared-flow-127';
  const driver = { args: ['/node', '/repository/entry.mjs', output + '/run', '/repository/seal.json'],
    env: { PATH: '/usr/bin', LC_ALL: 'C', HOME: output + '/home' }, cwd: '/repository' };
  const limits = { wallMs: 2400000, storageBytes: 2147483648, catalogBytes: 536870912, graceMs: 10000, forcedExitWaitMs: 5000 };
  const command = ['/python', '-I', '-S', '-B', '/repository/owner.py', '--output', output];
  return { manifest: { schemaVersion: 'prepared-flow-execution-seal/1', repository: '/repository', driver, command, limits,
    plan: { family, ownerOutput: output, claimPath: '/owned/first.claim.json' } },
  family, directory: output + '/run/matrix', claimPath: '/owned/first.claim.json', argv: structuredClone(driver.args),
  env: structuredClone(driver.env), cwd: '/repository', executable: '/node',
  parent: { pid: 12, executable: '/python', args: structuredClone(command) }, command: structuredClone(driver),
  events: [{ event: 'subreaper-verified', pid: 12, isolated: 1, noSite: 1 }, { event: 'started', limits: structuredClone(limits) },
    { event: 'driver-started', pid: 13 }], pid: 13 };
}

test('launch verification binds the exact external owner, argv, environment and frozen limits', () => {
  assert.doesNotThrow(() => assertLaunchBoundary(boundary()));
  for (const mutate of [value => { value.env.NODE_OPTIONS = '--max-old-space-size=8192'; },
    value => { value.parent.args.push('--wall-ms', '9999999'); }, value => { value.parent.executable = '/other-python'; },
    value => { value.events[0].isolated = 0; }, value => { value.events[1].limits.wallMs = 9999999; },
    value => { value.events[2].pid = 99; }, value => { value.events.push({ event: 'signal' }); },
    value => { value.command.args[1] = '/another-entry'; }, value => { value.claimPath += '.retry'; },
    value => { value.argv.push('--retry'); }, value => { value.family = 'ordinary-control'; }]) {
    const value = boundary(); mutate(value); assert.throws(() => assertLaunchBoundary(value));
  }
});

test('the ordinary coordinator still rejects the reserved family before writing a claim', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'loredock-reserved-guard-'));
  t.diagnostic('Retained launch-guard test: ' + directory);
  await assert.rejects(coordinateOrdinary({ directory: path.join(directory, 'run'), claimPath: path.join(directory, 'claim'),
    family: executionPlan.family, cases: [] }), /cannot execute a reserved family/);
  await assert.rejects(readFile(path.join(directory, 'claim')), error => error.code === 'ENOENT');
});

test('static import audit resolves the real production ESM server and all workspace dependencies without candidate execution', () => {
  const audit = JSON.parse(execFileSync(process.execPath, ['--experimental-import-meta-resolve',
    'scripts/loredock-prepared-flow/import-audit.mjs'], { cwd: root, encoding: 'utf8' }));
  assert.equal(audit.candidateModulesEvaluated, 0); assert(audit.honoEntry.endsWith('/@hono/node-server/dist/index.mjs'));
  assert(Object.keys(audit.modules).some(file => file.endsWith('/apps/loredock/dist/question-preparation.js')));
  assert(Object.keys(audit.modules).some(file => file.endsWith('/scripts/loredock-prepared-flow/matrix-cases.mjs')));
  assert(audit.externalEntries.some(file => file.endsWith('/typescript/lib/typescript.js')));
});

test('seal inventory detects changed bytes, extra files and changed symlink targets without following an input file descriptor', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'loredock-seal-inventory-'));
  t.diagnostic('Retained seal-inventory test: ' + directory);
  // Only ordinary local files are observed. Importing this Python module does not run create/verify/run.
  const script = `import importlib.util,json,pathlib,sys
p=pathlib.Path(sys.argv[1]); spec=importlib.util.spec_from_file_location('seal',sys.argv[2]); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
m.REPOSITORY=p
a=p/'one'; a.write_text('same-size-a'); b=p/'two'; b.write_text('same-size-b'); link=p/'link'; link.symlink_to(a)
first=m.inventory([p]); a.write_text('same-size-c'); second=m.inventory([p]); assert first[str(a)]['sha256']!=second[str(a)]['sha256']
(p/'extra').write_text('extra'); third=m.inventory([p]); assert second[str(p)]['names']!=third[str(p)]['names']
link.unlink(); link.symlink_to(b); fourth=m.inventory([p]); assert third[str(link)]!=fourth[str(link)]
try: m.file_record(link)
except OSError: pass
else: raise AssertionError('No-follow file hashing accepted a symlink')
print(json.dumps({'changedBytes':True,'extraFile':True,'changedLink':True,'noFollow':True}))
`;
  const scriptPath = path.join(directory, 'test.py'); await writeFile(scriptPath, script, { flag: 'wx' });
  const result = JSON.parse(execFileSync('python3', ['-I', '-S', '-B', scriptPath, directory,
    path.join(root, 'scripts/loredock-prepared-flow/execution-seal.py')], { encoding: 'utf8' }));
  assert.deepEqual(result, { changedBytes: true, extraFile: true, changedLink: true, noFollow: true });
});

test('the actual isolated owner satisfies the launch boundary without loading a candidate or claiming a family', { timeout: 15000 }, async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'loredock-seal-owner-'));
  t.diagnostic('Retained actual seal-owner control: ' + directory);
  const output = path.join(directory, 'output'), scriptPath = path.join(directory, 'ordinary.mjs');
  const python = await realpath('/usr/bin/python3');
  const owner = path.join(root, 'scripts/loredock-prepared-flow/kernel-owner.py');
  const command = [python, '-I', '-S', '-B', owner, '--node', process.execPath, '--script', scriptPath,
    '--output', output, '--cwd', path.resolve(root)];
  const env = { PATH: process.env.PATH, LC_ALL: 'C', HOME: path.join(directory, 'home') };
  const verifyUrl = new URL('../loredock-prepared-flow/execution-verify.mjs', import.meta.url).href;
  const script = `import assert from 'node:assert/strict';
import {readFile,realpath,writeFile} from 'node:fs/promises';
import {assertLaunchBoundary} from ${JSON.stringify(verifyUrl)};
const output=${JSON.stringify(output)}, command=${JSON.stringify(command)}, env=${JSON.stringify(env)};
const driver=JSON.parse(await readFile(output+'/command.json'));
const events=(await readFile(output+'/owner.jsonl','utf8')).trimEnd().split('\\n').map(JSON.parse);
const parent={pid:process.ppid,executable:await realpath('/proc/'+process.ppid+'/exe'),args:(await readFile('/proc/'+process.ppid+'/cmdline','utf8')).split('\\0').filter(Boolean)};
const family='kiln-prepared-flow-127';
const manifest={schemaVersion:'prepared-flow-execution-seal/1',repository:process.cwd(),driver,command,
 limits:{wallMs:2400000,storageBytes:2147483648,catalogBytes:536870912,graceMs:10000,forcedExitWaitMs:5000},
 plan:{family,ownerOutput:output,claimPath:output+'.claim'}};
assert.deepEqual(driver.env,env);
assertLaunchBoundary({manifest,family,directory:output+'/run/matrix',claimPath:output+'.claim',argv:process.argv,
 env:{...process.env},cwd:process.cwd(),executable:process.execPath,parent,command:driver,events,pid:process.pid});
await writeFile(output+'/boundary.json',JSON.stringify({verified:true,candidateReads:0,familyClaimed:false}),{flag:'wx'});
`;
  await writeFile(scriptPath, script, { flag: 'wx' });
  execFileSync(command[0], command.slice(1), { env, timeout: 12000 });
  const outcome = JSON.parse(await readFile(path.join(output, 'result.json')));
  assert.equal(outcome.driverExit.exit, 0); assert.deepEqual(outcome.errors, []); assert.deepEqual(outcome.survivors, []);
  assert.deepEqual(JSON.parse(await readFile(path.join(output, 'boundary.json'))), { verified: true, candidateReads: 0, familyClaimed: false });
  await assert.rejects(readFile(output + '.claim'), error => error.code === 'ENOENT');
});
