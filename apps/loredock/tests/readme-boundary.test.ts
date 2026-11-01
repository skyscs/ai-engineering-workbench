import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readmeSections} from '../src/readme-sections.js';
// @ts-expect-error The independent synthetic corpus is plain JavaScript.
import {boundaryReadme,boundaryShape} from '../../../fixtures/loredock-readme-boundary/corpus.mjs';

test('the boundary corpus has exact original bytes/lines and independently specified heading ranges',()=>{
  const input=boundaryReadme('synthetic-orders'),lines=input.content.split('\n');lines.pop();
  assert.equal(Buffer.byteLength(input.content),32768);assert.equal(lines.length,960);
  assert.equal(input.sections.length,12);assert.equal(input.expected.originalParts.length,8);
  assert.equal(input.sections[0].endLine,799);assert.equal(input.sections[11].endLine,720);
  for(const section of input.sections){assert.equal(Buffer.byteLength(section.title),160);assert.equal(lines[section.startLine-1],'#'.repeat(section.level)+' '+section.title);}
  assert.throws(()=>boundaryReadme('../outside'));
});

test('twenty bounded README outlines preserve every expected section and issued part at full input size',()=>{
  let bytes=0,sections=0,omissions=0;
  for(let index=0;index<20;index++){
    const input=boundaryReadme(`source-${index}`),parts=(input.expected.originalParts as {startLine:number;endLine:number}[]).map((part,i)=>({...part,id:`source-${index}-part-${i}`}));
    const result=readmeSections(input.content,parts);
    const expected=(input.sections as {title:string;level:number;startLine:number;endLine:number;parts:{startLine:number;endLine:number}[]}[])
      .map(({parts:expectedParts,...section})=>({...section,evidenceIds:expectedParts.map(part=>parts.find(ref=>ref.startLine===part.startLine&&ref.endLine===part.endLine)!.id)}));
    assert.deepEqual(result.sections,expected);assert.equal(result.omittedSections,boundaryShape.omitted);
    bytes+=Buffer.byteLength(input.content);sections+=result.sections.length;omissions+=result.omittedSections;
  }
  assert.deepEqual({bytes,sections,omissions},{bytes:655360,sections:240,omissions:80});
});
