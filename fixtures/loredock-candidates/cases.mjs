// Fresh source/context examples, frozen before implementing the candidate selector.
// The test harness supplies realistic context metadata; expectations never enter ranking.
const span=(source,path,text)=>({source,path,text});
const sources=['badge','publisher','consumer','contract','weather','archive'];
const base=[
  span('badge','src/ZincBadge.vue','Application example. ZincBadge renders a label without a request.'),
  span('publisher','src/Emit.java','Application example. Emit creates a QuartzMoved record and calls the publication port.'),
  span('consumer','src/Consume.java','Application example. Consume accepts QuartzMoved through a storage port.'),
  span('contract','contracts/QuartzMoved.json','Application example. QuartzMoved declares a message shape.'),
  span('weather','src/Forecast.java','Application example. Forecast renders temperature readings.'),
  span('archive','README.md','Application example. Archive holds older QuartzHistory records.'),
];
export const candidateCases=[
  {id:'c01',question:'ZincBadge label',sources,spans:base,required:['badge'],maximum:1,status:'suggestions'},
  {id:'c02',question:'QuartzMoved',sources,spans:base,required:['publisher','consumer','contract'],maximum:3,status:'suggestions'},
  {id:'c03',question:'application',sources,spans:base,required:[],maximum:0,status:'unresolved'},
  {id:'c04',question:'zzcandidateunknown',sources,spans:base,required:[],maximum:0,status:'unresolved'},
  {id:'c05',question:'QuietBeacon',sources,spans:[...base,
    span('publisher','src/Beacon.java','QuietBeacon source declaration.'),span('consumer','src/Beacon.java','QuietBeacon receiver declaration.')],
    duplicateDisplayNames:['publisher','consumer'],required:['publisher','consumer'],maximum:2,status:'suggestions'},
  {id:'c06',question:'RareSignal',sources:Array.from({length:20},(_,i)=>`source-${i}`),
    spans:Array.from({length:20},(_,i)=>span(`source-${i}`,'README.md',i<8?'RareSignal declaration.':'Ordinary unrelated source.')),
    required:Array.from({length:6},(_,i)=>`source-${i}`),maximum:6,status:'suggestions',omittedMatches:2,tiedAtLimit:true},
  {id:'c07',question:'GhostWidget',sources,spans:base,displayNames:{weather:'GhostWidget'},required:[],maximum:0,status:'unresolved'},
  {id:'c08',question:'RainCall',sources,spans:[...base,span('weather','docs/gaps.md','No RainCall implementation is supplied here.')],
    required:['weather'],maximum:1,status:'suggestions',qualification:'A negative mention is a reading clue only, never proof of an implementation or cause.'},
];
