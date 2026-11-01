import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import {test} from 'node:test';
import {demoEnvironment,demoRestartCommand,requireFreeDemoPort} from '../loredock-demo.mjs';

test('demo child mode isolates its data, disables answers/development and leaves the parent environment unchanged',()=>{
  const environment={PATH:'/owned/bin',LOREDOCK_DATA_DIR:'/normal/data',LOREDOCK_ANSWERS:'1',LOREDOCK_DEVELOPMENT:'1'},before={...environment};
  assert.deepEqual(demoEnvironment(environment,'/owned/demo'),{PATH:'/owned/bin',LOREDOCK_DATA_DIR:'/owned/demo',LOREDOCK_ANSWERS:'0',LOREDOCK_DEVELOPMENT:'0'});
  assert.deepEqual(environment,before);
  const tricky="/owned/demo space/'$(printf unsafe)`printf unsafe`";
  const probe=demoRestartCommand(tricky).replace('pnpm loredock','/usr/bin/env');
  const output=execFileSync('/bin/sh',['-c',probe],{encoding:'utf8',env:{PATH:'/usr/bin:/bin'}});
  assert.equal(output.split('\n').find(line=>line.startsWith('LOREDOCK_DATA_DIR=')),'LOREDOCK_DATA_DIR='+tricky);
});

test('an occupied demo port fails without closing its existing listener',async t=>{
  const server=createServer(socket=>socket.destroy());
  t.after(()=>new Promise((resolve,reject)=>server.close(error=>error&&error.code!=='ERR_SERVER_NOT_RUNNING'?reject(error):resolve())));
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen({host:'127.0.0.1',port:0},resolve);});
  const port=server.address().port;
  await assert.rejects(requireFreeDemoPort(port),{code:'EADDRINUSE'});assert.equal(server.listening,true);
  await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  await requireFreeDemoPort(port);
});
