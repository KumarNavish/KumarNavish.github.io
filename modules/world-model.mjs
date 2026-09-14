/** Local scene-state prototype. Deliberately limited grammar; no model, API or hidden action. */
import {clamp} from './mechanisms.mjs?v=scroll-4.2.1';
export const emptyWorld=()=>({version:1,created:false,lighting:'sunset',objects:[],relations:[],path:[],revision:0});
export const copy=x=>JSON.parse(JSON.stringify(x));
const obj=(id,type,name,x,y,z)=>({id,type,name,position:{x,y,z}});
export function createLaboratory(previous=emptyWorld()){
 const s=copy(previous);s.created=true;s.lighting='sunset';
 const defaults=[obj('bench-1','bench','Workbench',0,0,-1.8),obj('window-1','window','Window',0,1.8,-4),obj('microscope-1','microscope','Microscope',-1,1,-1.45),obj('robotic-arm-1','arm','Robotic arm',1.05,1,-1.5),obj('agent-1','agent','Agent',-2.8,0,2.4)];
 for(const o of defaults)if(!s.objects.some(p=>p.id===o.id))s.objects.push(o);
 s.relations=[{from:'microscope-1',to:'robotic-arm-1',type:'beside'},{from:'microscope-1',to:'bench-1',type:'on'},{from:'robotic-arm-1',to:'bench-1',type:'on'}];s.revision++;return s;
}
export function moveObject(state,id,position){
 const s=copy(state),o=s.objects.find(o=>o.id===id);if(!o||['bench','window'].includes(o.type))throw new Error('This structural object is fixed in the prototype.');
 const p={...o.position,...position};if(![p.x,p.y,p.z].every(Number.isFinite))throw new Error('Coordinates must be finite numbers.');
 if(['microscope','arm'].includes(o.type)){p.x=clamp(p.x,-1.65,1.65);p.y=1;p.z=clamp(p.z,-2.55,-1.05);}else{p.x=clamp(p.x,-4,4);p.y=0;p.z=clamp(p.z,-3.6,3.6);if(Math.abs(p.x)<2.2&&p.z> -2.85&&p.z<-.65)throw new Error('That position intersects the workbench.');}
 o.position=Object.fromEntries(Object.entries(p).map(([k,v])=>[k,+v.toFixed(3)]));s.path=[];s.revision++;return s;
}
const free=(x,z)=>Math.abs(x)<=4&&Math.abs(z)<=3.6&&!(Math.abs(x)<2.25&&z> -2.85&&z<-.65);
export function planPath(start,target){
 const step=.25,toCell=p=>[Math.round(p.x/step),Math.round(p.z/step)],key=([x,z])=>`${x},${z}`;
 let begin=toCell(start);if(!free(begin[0]*step,begin[1]*step))return [];
 const cells=[];for(let x=-16;x<=16;x++)for(let z=-14;z<=14;z++)if(free(x*step,z*step))cells.push([x,z]);
 cells.sort((a,b)=>Math.hypot(a[0]*step-target.x,a[1]*step-target.z)-Math.hypot(b[0]*step-target.x,b[1]*step-target.z));
 const goal=cells[0],queue=[begin],parent=new Map([[key(begin),null]]);let found=false;
 for(let i=0;i<queue.length;i++){const c=queue[i];if(key(c)===key(goal)){found=true;break;}for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const n=[c[0]+dx,c[1]+dz],k=key(n);if(!parent.has(k)&&free(n[0]*step,n[1]*step)){parent.set(k,c);queue.push(n);}}}
 if(!found)return[];const result=[];let c=goal;while(c){result.push({x:c[0]*step,y:0,z:c[1]*step});c=parent.get(key(c));}return result.reverse();
}
export function routeAgent(state){const s=copy(state),agent=s.objects.find(o=>o.id==='agent-1'),target=s.objects.find(o=>o.id==='microscope-1');if(!agent||!target)throw new Error('Create the laboratory first.');const path=planPath(agent.position,target.position);if(!path.length)throw new Error('No collision-free route is available.');s.path=path;agent.position={...path.at(-1)};s.revision++;return s;}
export function interpretCommand(state,input){
 if(typeof input!=='string'||input.length>400)return{ok:false,state,message:'Use one short supported command (up to 400 characters).'};
 const t=input.trim().toLowerCase().replace(/[!?]/g,'').replace(/\.(?!\d)/g,'').replace(/\s+/g,' ');let s;
 try{
  if(/^(create|build|make) (a |the )?(mountain )?lab(oratory)?( at sunset)?( put a microscope beside a robotic arm)?$/.test(t))s=createLaboratory(state);
  else if(!state.created)return{ok:false,state,message:'Start with “Create a mountain laboratory at sunset. Put a microscope beside a robotic arm.”'};
  else if(/^(move|put) (the )?microscope closer to (the )?window$/.test(t)){const p=state.objects.find(o=>o.id==='microscope-1').position;s=moveObject(state,'microscope-1',{z:p.z+(-4-p.z)*.45});}
  else if(/^(send|move|walk) (the )?agent to (the )?microscope$/.test(t))s=routeAgent(state);
  else if(/^(make it|set (the )?lighting to|change (the )?lighting to) (day|daylight|sunset|night)$/.test(t)){s=copy(state);s.lighting=t.endsWith('night')?'night':t.endsWith('sunset')?'sunset':'day';s.revision++;}
  else if(/^(add|place) (a |the )?plant$/.test(t)){s=copy(state);if(!s.objects.some(o=>o.id==='plant-1'))s.objects.push(obj('plant-1','plant','Plant',3.15,0,-2.7));s.revision++;}
  else{const m=t.match(/^move (the )?(microscope|robotic arm|agent|plant) (left|right|forward|back)( by (\d+(?:\.\d+)?) (metres?|meters?))?$/);if(!m)return{ok:false,state,message:'No change made. Try a displayed command, or use the object coordinates. This prototype does not understand unrestricted language.'};const id={microscope:'microscope-1','robotic arm':'robotic-arm-1',agent:'agent-1',plant:'plant-1'}[m[2]],o=state.objects.find(o=>o.id===id);if(!o)throw new Error('That object is not in the scene yet.');const amount=Math.min(2,+(m[5]||.35));s=moveObject(state,id,{[m[3]==='left'||m[3]==='right'?'x':'z']:o.position[m[3]==='left'||m[3]==='right'?'x':'z']+(m[3]==='left'||m[3]==='back'?-amount:amount)});}
  const diffs=diffWorld(state,s);if(!diffs.length)return{ok:true,state,message:'Already in that state. No objects were replaced.'};return{ok:true,state:s,message:diffs.join(' · ')};
 }catch(e){return{ok:false,state,message:e.message};}
}
export function diffWorld(a,b){const changes=[];for(const o of a.objects)if(!b.objects.some(p=>p.id===o.id))changes.push(`Removed ${o.name} [${o.id}]`);if(a.path.length&&!b.path.length)changes.push('Previous route cleared');if(!a.created&&b.created)changes.push('Laboratory created');if(a.lighting!==b.lighting)changes.push(`Lighting: ${a.lighting} → ${b.lighting}`);for(const o of b.objects){const p=a.objects.find(x=>x.id===o.id);if(!p){changes.push(`Added ${o.name} [${o.id}]`);continue;}for(const k of ['x','y','z'])if(p.position[k]!==o.position[k])changes.push(`${o.name} ${k}: ${p.position[k]} → ${o.position[k]}`);}if(b.path.length&&JSON.stringify(a.path)!==JSON.stringify(b.path))changes.push(`Route: ${b.path.length-1} collision-free grid steps`);return changes;}
export function validWorld(s){return !!s&&s.version===1&&typeof s.created==='boolean'&&['day','sunset','night'].includes(s.lighting)&&Array.isArray(s.objects)&&s.objects.length<30&&Array.isArray(s.path)&&s.path.length<1000&&new Set(s.objects.map(o=>o.id)).size===s.objects.length&&(!s.created||['bench-1','window-1','microscope-1','robotic-arm-1','agent-1'].every(id=>s.objects.some(o=>o.id===id)))&&s.path.every(p=>['x','y','z'].every(k=>Number.isFinite(p[k])&&Math.abs(p[k])<100))&&s.objects.every(o=>typeof o.name==='string'&&typeof o.id==='string'&&['bench','window','microscope','arm','agent','plant'].includes(o.type)&&['x','y','z'].every(k=>Number.isFinite(o.position?.[k])&&Math.abs(o.position[k])<100));}
export function historyStore(initial=emptyWorld()){
 let current=copy(initial),past=[],future=[],records=[];
 return{get state(){return copy(current);},get past(){return past.length;},get future(){return future.length;},get records(){return copy(records);},commit(next,label){if(!validWorld(next))throw new Error('Invalid scene state.');const changes=diffWorld(current,next);if(!changes.length)return false;past.push(current);if(past.length>30)past.shift();future=[];records.push({label,changes});if(records.length>30)records.shift();current=copy(next);return true;},undo(){if(!past.length)return false;future.push(current);current=past.pop();records.push({label:'Undo',changes:['Previous scene state restored.']});return true;},redo(){if(!future.length)return false;past.push(current);current=future.pop();records.push({label:'Redo',changes:['Scene edit restored.']});return true;}};
}
