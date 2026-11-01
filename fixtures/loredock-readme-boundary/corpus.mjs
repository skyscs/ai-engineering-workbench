import {createHash} from 'node:crypto';

// Independent line/range oracle: these values precede any production projection.
export const boundaryShape={bytes:32768,lines:960,sections:12,omitted:4,parts:8};
const expectedRanges=[
  [1,1,799],[2,119,239],[3,121,239],[2,240,359],[3,241,359],[2,360,479],
  [3,361,479],[2,480,599],[3,481,599],[2,600,719],[3,601,719],[2,720,720],
];
export function boundaryReadme(sourceName) {
  if(!/^[a-z0-9-]{1,60}$/.test(sourceName))throw new Error('Use a bounded synthetic source name.');
  const lines=Array(boundaryShape.lines).fill('Documented line.');
  const sections=expectedRanges.map(([level,startLine,endLine],index)=>{
    const prefix=`${sourceName} section ${index+1} `;
    const title=prefix+'é'.repeat(Math.floor((160-Buffer.byteLength(prefix))/2))+((160-Buffer.byteLength(prefix))%2?'x':'');
    lines[startLine-1]='#'.repeat(level)+' '+title;
    const parts=[];for(let start=1;start<=960;start+=120)if(start<=endLine&&start+119>=startLine)parts.push({startLine:start,endLine:start+119});
    return {title,level,startLine,endLine,parts};
  });
  lines[1]=`Original ${sourceName} context.`;lines[2]='';
  lines[29]='````md';lines[30]='## Hidden fenced heading';lines[31]='```';lines[32]='## Still fenced';lines[33]='````';
  lines[39]='<!--';lines[40]='## Hidden comment heading';lines[41]='-->';
  lines[720]='## Omitted after the count cap';lines[799]='#';lines[839]='# '+'é'.repeat(81);lines[899]='## Omitted footer';
  let content=lines.join('\n')+'\n';
  const padding=boundaryShape.bytes-Buffer.byteLength(content);if(padding<0)throw new Error('Boundary text exceeded its fixed size.');
  lines[949]+='x'.repeat(padding);content=lines.join('\n')+'\n';
  return {sourceName,content,sha256:createHash('sha256').update(content).digest('hex'),sections,
    expected:{context:lines[1],omittedSections:4,originalParts:Array.from({length:8},(_,index)=>({startLine:index*120+1,endLine:(index+1)*120}))}};
}
