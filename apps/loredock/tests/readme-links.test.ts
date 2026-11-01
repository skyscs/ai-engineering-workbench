import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readmeLinks} from '../src/readme-links.js';

const refs=[{id:'part-1',startLine:1,endLine:120},{id:'part-2',startLine:121,endLine:240}];
const parse=(text:string)=>readmeLinks(text,'README.md',refs);

test('literal local links preserve source order and origins, decode once and deduplicate target paths',()=>{
  const result=parse('See [Architecture](./docs/architecture.md#design).\n- [Setup](docs/setup%20guide.txt)\n'
    +'[Repeated](docs/./architecture.md#other) [Self](README.md#setup)\n'+'\n'.repeat(117)+'[Terms](docs/README)');
  assert.deepEqual(result.links,[
    {label:'Architecture',path:'docs/architecture.md',line:1,readmeEvidenceIds:['part-1']},
    {label:'Setup',path:'docs/setup guide.txt',line:2,readmeEvidenceIds:['part-1']},
    {label:'Terms',path:'docs/README',line:121,readmeEvidenceIds:['part-2']}]);
  assert.equal(result.omittedLinkedDocuments,0);
});

test('URLs, absolute paths, traversal, malformed encoding, controls and unsupported targets cannot be followed',()=>{
  const unsafe=['https://example.invalid/a.md','http://user:secret@example.invalid/a.md','file:///etc/a.md','javascript:alert','//host/a.md',
    '/etc/a.md','C:/a.md','../other/a.md','docs/../a.md','%2e%2e/a.md','%2Fetc/a.md','%5Cetc%5Ca.md','docs/%252e%252e/a.md',
    'docs/a.md?token=anything','docs/a%3Fq.md','docs/a%00.md','docs/a%0A.md','docs/a%C2%85.md','docs/%E0%A4.md','docs/%ZZ.md','docs//a.md','a.js','logo.png','#section'];
  for(const target of unsafe)assert.deepEqual(parse(`[Link](${target})`),{links:[],omittedLinkedDocuments:0},target);
});

test('code, comments, quoted/indented text, images and unsupported link forms do not create reading entries',()=>{
  const text=['````md','[Fence](a.md)','```','[Still fenced](b.md)','````',
    '~~~','[Tilde](c.md)','~~~','<!--','[Comment](d.md)','-->','<pre>','','[Raw](e.md)','</pre>',
    '<div>','[HTML](f.md)','</div>','','    [Indented](g.md)','> [Quoted](h.md)',
    '`[Inline](i.md)`','``[Inner ` tick](j.md)``','`[Unclosed](k.md)',
    '![Image](l.md)','\\[Escaped](m.md)','[nested [label]](n.md)','[Reference][target]','[target]: o.md',
    '[Title](p.md "Title")','[Angle](<q.md>)','[`Code label`](r.md)',
    'Read `[Ignored](s.md)` then [Visible](docs/visible.md).'].join('\n');
  assert.deepEqual(parse(text).links.map(link=>link.path),['docs/visible.md']);
});

test('whole-label/path/count omissions are bounded and duplicate references retain the first occurrence',()=>{
  const many=parse(`[${'é'.repeat(81)}](long.md) [Shorter duplicate](long.md) [ ](empty.md)\n`
    +`[Too long path](${'a'.repeat(510)}.md)\n[${'é'.repeat(80)}](first.md) [Second](second.md) [Third](third.md) [Fourth](fourth.md) [Again](fourth.md)`);
  assert.equal(many.links.length,3);assert.equal(many.omittedLinkedDocuments,4);assert.equal(Buffer.byteLength(many.links[0]!.label),160);
  assert.deepEqual(many.links.map(link=>link.path),['first.md','second.md','third.md']);
  assert.equal(parse('[<img src=x onerror=alert>](literal.md)').links[0]!.label,'<img src=x onerror=alert>');
});
