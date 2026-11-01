import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readmeSections,sectionLimits} from '../src/readme-sections.js';
import {spans} from '../src/extract.js';

function outline(text:string) {return readmeSections(text,spans(text).map((span,index)=>({...span,id:`part-${index+1}`})));}

test('nested sections retain original ranges, repeated labels and every overlapping issued part',()=>{
  const text=['# Project','Intro.','## Architecture','Description.','### Boundaries','Details.','## Architecture','Second description.','# Operations','Runbook.',''].join('\n');
  const result=outline(text);assert.equal(result.omittedSections,0);
  assert.deepEqual(result.sections.map(({title,level,startLine,endLine})=>({title,level,startLine,endLine})),[
    {title:'Project',level:1,startLine:1,endLine:8},{title:'Architecture',level:2,startLine:3,endLine:6},
    {title:'Boundaries',level:3,startLine:5,endLine:6},{title:'Architecture',level:2,startLine:7,endLine:8},
    {title:'Operations',level:1,startLine:9,endLine:10}]);
  const long=outline('\n'.repeat(119)+'## Spanning original parts\n'+Array(125).fill('Original documentation.').join('\n')+'\n## Next\nDone.');
  assert.equal(long.sections[0]!.startLine,120);assert.equal(long.sections[0]!.endLine,245);
  assert.deepEqual(long.sections[0]!.evidenceIds,['part-1','part-2','part-3']);
});

test('code fences need matching character, sufficient length and an otherwise empty closer',()=>{
  const text=['# Visible','````js','# Hidden A','```','# Hidden B','```` trailing','# Hidden C','~~~~','# Hidden D','````',
    '~~~','# Hidden E','~~~','# After','    ## Indented code','\t## Tab code','> ## Quoted',
    '- List item','  ## Nested list','lazy continuation','  ### Still nested','','  ```','## Fenced list body','  ```','# Outside list'].join('\n');
  assert.deepEqual(outline(text).sections.map(row=>row.title),['Visible','After','Outside list']);
  assert.deepEqual(outline('```bad`info\n## Not inside a valid fence').sections.map(row=>row.title),['Not inside a valid fence']);
});

test('HTML blocks, multiline comments and processing content cannot contribute apparent headings',()=>{
  const text=['# Public','<!-- comment','','## Commented','-->','Prose <!-- another comment','## Inline commented','-->',
    '<ScRiPt>','','# Script body','</ScRiPt>','<div>','## HTML block','</div>','','<![CDATA[','','## CDATA',']]>',
    '<?example','','## Processing','?>','<!DECLARATION','','## Declaration','>','## <img src=x onerror="window.injected=true">'].join('\n');
  assert.deepEqual(outline(text).sections.map(row=>row.title),['Public','<img src=x onerror="window.injected=true">']);
});

test('omitted labels still close earlier ranges; heading count and UTF-8 bounds never truncate labels',()=>{
  const text=['# Parent','## Included','Body.','# '+ 'é'.repeat(81),'Other.','## Next','#','# ###','# '+ 'é'.repeat(80)].join('\n');
  const result=outline(text);assert.equal(result.omittedSections,3);
  assert.deepEqual(result.sections.map(row=>row.title),['Parent','Included','Next','é'.repeat(80)]);
  assert.equal(result.sections[0]!.endLine,3);assert.equal(result.sections[1]!.endLine,3);assert.equal(result.sections[2]!.endLine,6);
  const many=outline(Array.from({length:sectionLimits.sections+2},(_,index)=>`## Heading ${index}\nBody ${index}.`).join('\n'));
  assert.equal(many.sections.length,12);assert.equal(many.omittedSections,2);assert.equal(many.sections.at(-1)!.endLine,24);
});

test('only supported ATX syntax becomes navigation; inline markup stays literal and source order stays fixed',()=>{
  const text=['Setext title','===','#nospace','####### Seven','\\# Escaped','   ### Three spaces ###','    # Code',
    '## Literal#','## [Terms](javascript:alert(1))','## Term_1 `IDENTIFIER`'].join('\n');
  assert.deepEqual(outline(text).sections.map(row=>row.title),['Three spaces','Literal#','[Terms](javascript:alert(1))','Term_1 `IDENTIFIER`']);
});
