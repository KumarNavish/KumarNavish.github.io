import type { V3 } from './science';
export type Kind='bench'|'microscope'|'robot'|'sample'|'window'|'lamp'|'tree'|'cabinet';
export type Relation='beside'|'left'|'right'|'behind'|'front'|'on';
export type WorldObject={id:string;kind:Kind;name:string;position:V3;rotation:number;relation?:{type:Relation;target:string;offset?:V3}};
export type Intent={environment?:'mountain'|'forest'|'interior';time?:'day'|'sunset'|'night'|'dawn';add:{kind:Kind;count:number;force?:boolean}[];move:{kind:Kind;relation:Relation;targetKind:Kind;newest?:boolean}[];remove:{kind:Kind;all:boolean}[];goal?:{action:string;targetKind:Kind};notes:string[]};
export type HistoryEntry={text:string;revision:number;added:string[];changed:string[];removed:string[];interpretation:Intent};
export type WorldState={version:1;environment:'mountain'|'forest'|'interior';time:'day'|'sunset'|'night'|'dawn';objects:WorldObject[];counter:number;revision:number;history:HistoryEntry[];goal?:{action:string;targetId:string};agentPosition?:V3;agentHeading?:number};
const NOUNS:Record<Kind,RegExp>={bench:/\b(benches|bench|tables?)\b/i,microscope:/\bmicroscopes?\b/i,robot:/\b(robotic?|robot)\s+arms?\b/i,sample:/\b(samples?|specimens?|trays?)\b/i,window:/\bwindows?\b/i,lamp:/\b(lamps?|light fixtures?)\b/i,tree:/\b(trees?|pines?)\b/i,cabinet:/\bcabinets?\b/i};
export const NAMES:Record<Kind,string>={bench:'Lab bench',microscope:'Microscope',robot:'Robotic arm',sample:'Sample',window:'Window',lamp:'Task lamp',tree:'Pine',cabinet:'Cabinet'};
export const EXAMPLE='Create a quiet mountain laboratory at sunset, place a robotic arm beside a microscope, and let an agent inspect the sample.';
const blankIntent=():Intent=>({add:[],move:[],remove:[],notes:[]});
export const emptyWorld=():WorldState=>({version:1,environment:'mountain',time:'sunset',objects:[],counter:0,revision:0,history:[],agentPosition:[-2.9,0,1.75],agentHeading:0});
function mentions(text:string):Kind[]{return (Object.keys(NOUNS) as Kind[]).map(kind=>({kind,index:text.search(NOUNS[kind])})).filter(x=>x.index>=0).sort((a,b)=>a.index-b.index).map(x=>x.kind);}
function amount(text:string){if(/\b(two|2)\b/i.test(text))return 2;if(/\b(three|3)\b/i.test(text))return 3;if(/\b(four|4)\b/i.test(text))return 4;return 1;}
const RELATION=/\b(beside|next\s+to|left\s+of|right\s+of|behind|in\s+front\s+of|near|on)\b/i;
function relationName(text:string):Relation{if(/left/.test(text))return 'left';if(/right/.test(text))return 'right';if(/behind/.test(text))return 'behind';if(/front/.test(text))return 'front';if(text==='on')return 'on';return 'beside';}
/** Parse a declared, bounded command grammar; never treat reference nouns as new objects. */
export function parseIntent(raw:string):Intent{
 const text=raw.trim().toLowerCase();if(!text)throw new Error('Describe a scene or an edit first.');
 const intent=blankIntent(),creating=/\bcreate\b/.test(text);
 if(/\bmountain/.test(text))intent.environment='mountain';else if(/\bforest/.test(text))intent.environment='forest';else if(/\b(interior|indoor)\b/.test(text))intent.environment='interior';
 if(/\b(night|darker|dark)\b/.test(text))intent.time='night';else if(/\bsunset\b/.test(text))intent.time='sunset';else if(/\b(dawn|morning)\b/.test(text))intent.time='dawn';else if(/\b(day|daylight|brighter)\b/.test(text))intent.time='day';
 const expression=/\b(add|put|place|move|remove|delete)\b([\s\S]*?)(?=[,.;]|\band\s+(?:add|move|place|put|remove|delete|let|ask|make|set)\b|$)/gi;
 for(const match of text.matchAll(expression)){
  const verb=match[1],body=match[2];const relation=body.match(RELATION);
  const source=relation?body.slice(0,relation.index):body;
  const kinds=mentions(source);if(!kinds.length)throw new Error(`No supported object was identified after “${verb}”.`);
  for(const kind of kinds){
   if(verb==='remove'||verb==='delete'){
    for(let i=0;i<amount(source);i++)intent.remove.push({kind,all:/\ball\b/.test(source)});
    continue;
   }
   if(verb!=='move')intent.add.push({kind,count:amount(source),force:verb==='add'});
   if(relation){
    const targetKind=mentions(body.slice((relation.index??0)+relation[0].length))[0];
    if(!targetKind)throw new Error('A spatial relation needs a supported target object.');
    intent.move.push({kind,targetKind,relation:relationName(relation[0]),newest:verb==='add'});
   }else if(verb==='move')throw new Error('Specify a relation, for example “Move the microscope beside the window”.');
  }
 }
 if(creating){
  const kinds=mentions(text);if(/\b(lab|laboratory)\b/.test(text))kinds.push('bench','window');
  for(const kind of [...new Set(kinds)])if(!intent.add.some(a=>a.kind===kind)&&!intent.remove.some(r=>r.kind===kind))intent.add.push({kind,count:1});
 }
 const action=text.match(/\b(inspect|examine|check|calibrate)\b/);
 if(action){const targetKind=mentions(text.slice((action.index??0)+action[0].length))[0];if(!targetKind)throw new Error('Name the object the agent should approach.');intent.goal={action:action[0],targetKind};}
 if(/\bwhat changed\b/.test(text))intent.notes.push('query-changes');
 if(!intent.environment&&!intent.time&&!intent.add.length&&!intent.move.length&&!intent.remove.length&&!intent.goal&&!intent.notes.length)throw new Error('No supported edit was found. Try “Add a sample”, “Make it night”, or “Move the microscope beside the window”.');
 return intent;
}
const SMALL=new Set<Kind>(['microscope','robot','sample','lamp']);
function benchHeight(x:number,z:number,world:WorldState){
 const bench=world.objects.find(o=>o.kind==='bench');if(!bench)return 0;
 const angle=bench.rotation*Math.PI/180,dx=x-bench.position[0],dz=z-bench.position[2];
 const localX=dx*Math.cos(angle)+dz*Math.sin(angle),localZ=-dx*Math.sin(angle)+dz*Math.cos(angle);
 return Math.abs(localX)<2.6&&Math.abs(localZ)<.9?bench.position[1]+1.14:0;
}
function defaults(kind:Kind,n:number):V3{
 const p:Record<Kind,V3>={bench:[0,0,0],microscope:[-.95,1.14,-.15],robot:[.8,1.14,-.05],sample:[.2,1.14,.48],window:[0,0,-2.05],lamp:[1.85,1.14,-.2],tree:[3.4,0,-1.8],cabinet:[-2.8,0,-1.5]};
 const result=[...p[kind]] as V3;if(n){result[0]+=n*.64;result[2]+=(n%2)*.4;}return result;
}
function freePosition(p:V3,source:WorldObject,world:WorldState){
 return world.objects.every(o=>o.id===source.id||!SMALL.has(o.kind)||Math.hypot(p[0]-o.position[0],p[2]-o.position[2])>(source.kind==='sample'?.54:.7));
}
function positionRelative(source:WorldObject,target:WorldObject,type:Relation,world:WorldState):V3{
 let p:V3;
 if(type==='beside'&&target.kind==='window')p=[target.position[0]-1.5,0,target.position[2]+1.4];
 else if(type==='on')p=[target.position[0],target.position[1]+1.14,target.position[2]];
 else if(type==='beside'){
  const options:V3[]=[[.9,0,0],[-.9,0,0],[0,0,.7],[0,0,-.7]];
  const delta=options.find(d=>freePosition([target.position[0]+d[0],0,target.position[2]+d[2]],source,world))??options[0];
  p=[target.position[0]+delta[0],0,target.position[2]+delta[2]];
 }else p=[target.position[0]+(type==='left'?-.9:type==='right'?.9:0),0,target.position[2]+(type==='behind'?-.8:type==='front'?.8:0)];
 if(SMALL.has(source.kind))p[1]=benchHeight(p[0],p[2],world);return p;
}
/** Propagate explicit relative transforms; reject cyclic dependencies instead of silently drifting. */
function reconcile(world:WorldState){
 const visiting=new Set<string>(),done=new Set<string>();
 const visit=(o:WorldObject)=>{
  if(done.has(o.id))return;if(visiting.has(o.id))throw new Error('That edit would create a circular spatial relation.');visiting.add(o.id);
  if(o.relation){const target=world.objects.find(t=>t.id===o.relation?.target);if(!target)o.relation=undefined;else{visit(target);const d=o.relation.offset;if(d)o.position=[target.position[0]+d[0],target.position[1]+d[1],target.position[2]+d[2]];}}
  if(SMALL.has(o.kind))o.position[1]=benchHeight(o.position[0],o.position[2],world);
  visiting.delete(o.id);done.add(o.id);
 };
 world.objects.forEach(visit);
}
function finalize(previous:WorldState,next:WorldState,intent:Intent,text:string){
 reconcile(next);if(next.objects.length>40)throw new Error('This browser laboratory supports at most 40 editable objects.');
 if(next.goal&&!next.objects.some(o=>o.id===next.goal?.targetId))next.goal=undefined;
 const old=new Map(previous.objects.map(o=>[o.id,o]));
 const added=next.objects.filter(o=>!old.has(o.id)).map(o=>o.id);
 const changed=next.objects.filter(o=>old.has(o.id)&&JSON.stringify(old.get(o.id))!==JSON.stringify(o)).map(o=>o.id);
 const removed=previous.objects.filter(o=>!next.objects.some(n=>n.id===o.id)).map(o=>o.id);
 if(next.environment!==previous.environment)changed.push('environment');if(next.time!==previous.time)changed.push('lighting');
 if(JSON.stringify(next.agentPosition)!==JSON.stringify(previous.agentPosition))changed.push('agent');
 next.revision=previous.revision+1;next.history=[...previous.history,{text,revision:next.revision,added,changed,removed,interpretation:intent}].slice(-50);
 return next;
}
/** Apply the whole command transactionally. An unresolved reference commits nothing. */
export function applyCommand(world:WorldState,text:string):{world:WorldState;intent:Intent}{
 const intent=parseIntent(text),next=structuredClone(world);
 if(intent.notes.includes('query-changes')){
  const h=world.history.at(-1);intent.notes=[h?`Latest command: ${h.text}. Added: ${h.added.join(', ')||'none'}. Changed: ${h.changed.join(', ')||'none'}. Removed: ${h.removed.join(', ')||'none'}.`:'This is the example scene; no command has changed it yet.'];
  if(!intent.add.length&&!intent.move.length&&!intent.remove.length&&!intent.goal&&!intent.environment&&!intent.time)return {world:next,intent};
 }
 if(intent.environment)next.environment=intent.environment;if(intent.time)next.time=intent.time;
 for(const request of intent.remove){
  const matches=next.objects.filter(o=>o.kind===request.kind);if(!matches.length)throw new Error(`There is no ${NAMES[request.kind].toLowerCase()} to remove.`);
  const ids=new Set((request.all?matches:matches.slice(0,1)).map(o=>o.id));next.objects=next.objects.filter(o=>!ids.has(o.id));
 }
 const addedByKind=new Map<Kind,WorldObject[]>();
 for(const request of intent.add){
  const existing=next.objects.filter(o=>o.kind===request.kind);
  if(existing.length&&!request.force)continue;
  if(existing.length&&['bench','window'].includes(request.kind))throw new Error(`This laboratory has one ${NAMES[request.kind].toLowerCase()}; move the existing one instead.`);
  for(let i=0;i<request.count;i++){
   const ordinal=next.objects.filter(o=>o.kind===request.kind).length;
   const object:WorldObject={id:`${request.kind}-${next.counter++}`,kind:request.kind,name:NAMES[request.kind]+(ordinal?` ${ordinal+1}`:''),position:defaults(request.kind,ordinal),rotation:0};
   next.objects.push(object);addedByKind.set(request.kind,[...(addedByKind.get(request.kind)??[]),object]);
  }
 }
 for(const request of intent.move){
  const sources=request.newest?addedByKind.get(request.kind)??[]:next.objects.filter(o=>o.kind===request.kind).slice(0,1);
  if(!sources.length)throw new Error(`There is no ${NAMES[request.kind].toLowerCase()} to move.`);
  for(const object of sources){
   const target=next.objects.find(o=>o.kind===request.targetKind&&o.id!==object.id);
   if(!target)throw new Error(`Add a ${NAMES[request.targetKind].toLowerCase()} before using it as a reference.`);
   object.position=positionRelative(object,target,request.relation,next);
   object.relation={type:request.relation,target:target.id,offset:object.position.map((v,i)=>v-target.position[i]) as V3};
  }
 }
 if(intent.goal){
  const target=next.objects.find(o=>o.kind===intent.goal?.targetKind);
  if(!target)throw new Error('The agent’s target is absent. Add it before asking the agent to act.');
  next.goal={action:intent.goal.action,targetId:target.id};
 }
 return {world:finalize(world,next,intent,text),intent};
}
export function moveObject(world:WorldState,id:string,position:V3,rotation?:number):WorldState{
 if(!position.every(Number.isFinite))throw new Error('Object coordinates must be finite.');
 const next=structuredClone(world),object=next.objects.find(o=>o.id===id);if(!object)throw new Error('Select an existing object.');
 if(rotation===undefined){object.position=[Math.max(-4.4,Math.min(4.4,position[0])),position[1],Math.max(-3.4,Math.min(3.4,position[2]))];object.relation=undefined;}
 else{if(!Number.isFinite(rotation))throw new Error('Rotation must be finite.');object.rotation=((rotation%360)+360)%360;}
 const intent=blankIntent();intent.notes.push('Direct spatial manipulation');
 return finalize(world,next,intent,`${rotation===undefined?'Move':'Rotate'} ${object.name}`);
}
export function clearObjects(world:WorldState){const next=structuredClone(world);next.objects=[];next.goal=undefined;const intent=blankIntent();intent.notes.push('Clear all editable objects; preserve the environment');return finalize(world,next,intent,'Clear objects');}
export function initialWorld(){
 let world=applyCommand(emptyWorld(),EXAMPLE).world;
 world=applyCommand(world,'Add a cabinet.').world;
 world.history=[];world.revision=0;return world;
}
export function validateWorld(value:unknown):value is WorldState{
 if(!value||typeof value!=='object')return false;const w=value as WorldState;
 const validVector=(p:unknown)=>Array.isArray(p)&&p.length===3&&p.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<100);
 if(w.version!==1||!['mountain','forest','interior'].includes(w.environment)||!['day','dawn','sunset','night'].includes(w.time))return false;
 if(!Number.isInteger(w.counter)||w.counter<0||!Number.isInteger(w.revision)||w.revision<0||!Array.isArray(w.objects)||w.objects.length>40)return false;
 if(!w.objects.every(o=>o&&o.kind in NOUNS&&typeof o.id==='string'&&typeof o.name==='string'&&o.name.length<80&&validVector(o.position)&&Number.isFinite(o.rotation)))return false;
 if(new Set(w.objects.map(o=>o.id)).size!==w.objects.length)return false;
 if(!Array.isArray(w.history)||w.history.length>50||!w.history.every(h=>h&&typeof h.text==='string'&&Array.isArray(h.added)&&Array.isArray(h.changed)&&Array.isArray(h.removed)))return false;
 return !w.agentPosition||validVector(w.agentPosition);
}
/** Conservative floor-plan collision test, independent of the visual mesh tessellation. */
export function blocked(world:WorldState,x:number,z:number){
 const clearance=.23;
 for(const cx of [-3.1,3.1])for(const cz of [-2.2,2.2])if(Math.hypot(x-cx,z-cz)<.36)return true;
 return world.objects.some(o=>{
  const angle=o.rotation*Math.PI/180,dx=x-o.position[0],dz=z-o.position[2];
  const a=dx*Math.cos(angle)+dz*Math.sin(angle),b=-dx*Math.sin(angle)+dz*Math.cos(angle);
  if(o.kind==='bench')return Math.abs(a)<2.6+clearance&&Math.abs(b)<.9+clearance;
  if(o.kind==='cabinet')return Math.abs(a)<.5+clearance&&Math.abs(b)<.45+clearance;
  if(o.kind==='window')return Math.abs(a)<2.9+clearance&&Math.abs(b)<.07+clearance;
  if(o.kind==='tree')return Math.hypot(dx,dz)<.35+clearance;
  return SMALL.has(o.kind)&&o.position[1]<.4&&Math.hypot(dx,dz)<.25+clearance;
 });
}
/** A* on a 20 cm illustrative floor grid. No diagonal corner cutting or obstacle teleportation. */
export function agentPath(world:WorldState,targetId:string):V3[]{
 const target=world.objects.find(o=>o.id===targetId);if(!target)return [];
 const start=world.agentPosition??[-2.9,0,1.75];
 let end:V3=[target.position[0],0,target.position[2]+.7];
 const bench=world.objects.find(o=>o.kind==='bench');
 if(target.position[1]>.5&&bench)end=[Math.max(-2.8,Math.min(2.8,target.position[0])),0,bench.position[2]+1.35];
 if(target.kind==='bench')end=[target.position[0],0,target.position[2]+1.35];
 if(target.kind==='cabinet')end[2]=target.position[2]+.85;
 const size=.2,x0=-3.9,z0=-3.25,nx=40,nz=34;
 const cell=(x:number,z:number):[number,number]=>[Math.round((x-x0)/size),Math.round((z-z0)/size)];
 const point=(i:number,j:number):V3=>[x0+i*size,0,z0+j*size];
 const key=(i:number,j:number)=>j*nx+i;
 const s=cell(start[0],start[2]),g=cell(end[0],end[2]);
 const inside=([i,j]:[number,number])=>i>=0&&i<nx&&j>=0&&j<nz;
 if(!inside(s)||!inside(g)||blocked(world,end[0],end[2]))return [];
 const startKey=key(...s),goalKey=key(...g),open=new Set([startKey]);
 const cost=new Map([[startKey,0]]),parent=new Map<number,number>();
 const heuristic=(id:number)=>Math.abs(id%nx-g[0])+Math.abs(Math.floor(id/nx)-g[1]);
 let reached=false;
 for(let iteration=0;open.size&&iteration<nx*nz;iteration++){
  let current=-1,best=Infinity;
  for(const id of open){const f=(cost.get(id)??Infinity)+heuristic(id);if(f<best){best=f;current=id;}}
  if(current===goalKey){reached=true;break;}open.delete(current);
  const i=current%nx,j=Math.floor(current/nx);
  for(const [dx,dz] of [[1,0],[0,1],[-1,0],[0,-1]]){
   const a=i+dx,b=j+dz;if(a<0||a>=nx||b<0||b>=nz)continue;
   const p=point(a,b);if(blocked(world,p[0],p[2]))continue;
   const id=key(a,b),next=(cost.get(current)??Infinity)+1;
   if(next<(cost.get(id)??Infinity)){cost.set(id,next);parent.set(id,current);open.add(id);}
  }
 }
 if(!reached)return [];
 const ids=[goalKey];while(ids.at(-1)!==startKey){const p=parent.get(ids.at(-1)!);if(p===undefined)return [];ids.push(p);}
 const route:V3[]=[[...start] as V3,...ids.reverse().map(id=>point(id%nx,Math.floor(id/nx))),end];
 return route.filter((p,i)=>i===0||Math.hypot(p[0]-route[i-1][0],p[2]-route[i-1][2])>.001);
}
export function completeAgent(world:WorldState):WorldState{
 if(!world.goal)return world;const route=agentPath(world,world.goal.targetId);if(!route.length)return world;
 const next=structuredClone(world),target=next.objects.find(o=>o.id===next.goal?.targetId)!;
 next.agentPosition=[...route.at(-1)!] as V3;
 next.agentHeading=Math.atan2(target.position[0]-next.agentPosition[0],target.position[2]-next.agentPosition[2]);
 const intent=blankIntent();intent.notes.push('The rendered agent reached its approach point. No physical measurement was taken.');
 return finalize(world,next,intent,`Agent approached ${target.name}`);
}
export function describeHistory(entry:HistoryEntry,world:WorldState):string[]{
 const name=(id:string)=>world.objects.find(o=>o.id===id)?.name??id;
 const changes=[...entry.added.map(id=>`Added ${name(id)}`),...entry.changed.map(id=>`Changed ${name(id)}`),...entry.removed.map(id=>`Removed ${name(id)}`)];
 return changes.length?changes:['No material object changes.'];
}
