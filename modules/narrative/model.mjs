import {gainEigenmode,recoveryConstraints} from './inspection.mjs?v=scroll-4.2';
import {constraints} from '../worlds/math.mjs?v=scroll-4.2';
import {stories} from './chapters.mjs?v=scroll-4.2';
import {graphState,replayState,rankState,timeState,simulatePeriod,posteriorExample,signedGraph,urbanExample,interactionExample,clamp} from '../worlds/math.mjs?v=scroll-4.2';
import {newCase,refreshCase,caseAction} from '../mechanisms.mjs?v=scroll-4.2';
import {empty,laboratory,compile,route,clone} from '../worlds/compiler.mjs?v=scroll-4.2';
export const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
export const mix=(a,b,t)=>a+(b-a)*t;
export function sample(values,u){const i=Math.min(values.length-1,Math.floor(Math.max(0,u))),j=Math.min(values.length-1,i+1),t=smooth((u-i-.1)/.8);return Array.isArray(values[i])?values[i].map((v,k)=>mix(v,values[j][k],t)):mix(values[i],values[j],t);}
export function caseAt(chapter=0){
 const s=newCase();s.invoiceReviewed=false;refreshCase(s);
 s.events=['Original customer message received. No source was overwritten.'];
 if(chapter>=1){s.invoiceReviewed=true;s.parsed='2026-05-12';s.review={date:'2026-05-12',authority:'human'};s.events.push('Invoice and policy received. Initial reviewer checked 12 May against message-1.');refreshCase(s);}
 if(chapter>=2){s.parsed='2026-06-12';s.review=null;s.events.push('New repair report says 12 June. Earlier date assertion revoked pending review.');refreshCase(s);}
 if(chapter>=3)caseAction(s,'attempt');
 if(chapter>=4)caseAction(s,'correct');
 if(chapter>=5)s.events.push('Provenance packet assembled. A human decision is admissible; no payment sent.');
 s.report=chapter>=2?{id:'report-2',date:'2026-06-12',synthetic:true,resolution:chapter>=4?'Discrepancy resolved by reviewed original source':'Conflicts with original source'}:null;
 return s;
}
const planned=laboratory(),routed=route(planned),edited=compile('Move the microscope closer to the window.',routed).state;
export const initialScene=()=>clone(planned);
export const finalScene=()=>clone(edited);
const allReveal={graph:1,operator:1,spectrum:1,transport:1,certificate:1,skills:1,current:1,oracle:1,candidates:1,correction:1,residual:1,constraints:1,feasible:1,solution:1,budget:1,windows:1,history:1,risk:1,source:1,assertion:1,conflict:1,gate:1,packet:1,sentence:0,semantics:0,structure:0,anchors:0,world:1,path:1,edit:1,surface:1,target:1,loss:1,pairs:1,parking:1,walk:1};
/** Pure reconstruction: no clock, DOM, random entropy, storage, or accumulated mutation. */
export function evaluateNarrative(key,progress,{reduced=false,explore=null}={}){
 const story=stories[key];if(!story)throw Error('Unknown narrative '+key);if(!Number.isFinite(progress))throw Error('Progress must be finite.');
 const p=clamp(progress,0,1),raw=p*(story.chapters.length-1),u=reduced?Math.round(raw):raw,index=Math.min(story.chapters.length-1,Math.round(u)),phase=u-Math.floor(u),at=(a,b=a+.65)=>smooth((u-a)/(b-a));
 const frame={key,progress:p,position:u,index,local:phase,chapter:story.chapters[index],camera:sample(story.cameras,u),target:sample(story.targets,u),reveal:{},visual:{},science:null,classification:key==='world'?'Conceptual explanation · local compiler':key==='case'?'Synthetic case · deterministic checks':key==='time'?'Declared simulation · 64 observations':'Computed live · illustrative example',exploring:!!explore};
 const r=frame.reveal,v=frame.visual;let params={};
 switch(key){
 case'gain':{
  params={angle:sample([0,110,110,110,110,0],u),edge:1,...explore};const angles=params.angles?params.angles.slice():Array(7).fill(0);angles[params.edge]=params.angle;frame.science=graphState(angles);frame.inspection=explore&&params.eigenmode>=0?gainEigenmode(frame.science,params.eigenmode):null;Object.assign(r,{graph:1,transport:at(1.1,1.5),operator:at(2.2,2.85),spectrum:at(3.15,3.85),certificate:at(4.15,4.85)});v.transport=clamp(u-1,0,1);v.focus=sample([0,1,.3,0,.6,0],u);v.edge=params.edge;v.angle=params.angle;v.cycle=params.cycle??-1;break;}
 case'replay':{
  params={learning:sample([0,1,1,1,1,1],u),correction:sample([0,0,0,0,1,1],u),selected:u<3.2?[0]:u<4.5?[0,2,3]:[0,1],...explore};frame.science=replayState(params.selected,params.learning,params.correction);Object.assign(r,{skills:1,current:at(.05,.7),oracle:at(1.3,2),candidates:at(2.6,3.3),correction:at(2.15,2.8),residual:at(4.5,4.8)});v.duplicate=u>=4.5;break;}
 case'rank':{
  params={rank:u<1.5?1:u<2.6?2:3,budget:sample([.6,.6,.6,.6,1.25,.6],u),...explore};const rules=recoveryConstraints(constraints,params.tolerance||0);frame.science=rankState(params.rank,params.budget,rules);frame.visual.rules=rules;Object.assign(r,{constraints:at(.25,1),feasible:at(2.5,3.1),solution:at(3.3,4),budget:at(4.15,4.8)});v.opening=sample([1,1,2,3,3,3],u);break;}
 case'time':{
  params={month:Math.round(sample([1,2,3,8,10,10],u)),replay:Math.round(sample([0,24,24,24,24,0],u)),window:5,stable:false,...explore};const s=timeState(params.month,params.replay,64,params.window,params.stable);const observed=simulatePeriod(s,1729+s.month);frame.science={...s,processed:observed.processed,estimate:observed.estimate,archiveError:((1-s.alpha)*s.drift)**2+s.variance,archiveNewOnly:s.drift**2+s.noReplay};Object.assign(r,{windows:1,history:at(.15,.8),budget:at(1.2,1.8),risk:at(2.35,3)});v.time=sample([1,2,3,8,10,10],u);break;}
 case'case':{
  params={chapter:index,...explore};frame.science=params.state?clone(params.state):caseAt(params.chapter);Object.assign(r,{source:1,assertion:at(.2,.9),conflict:at(1.4,1.95),gate:at(.5,.95),packet:at(4.3,5)});break;}
 case'world':{
  const s=u>=4?clone(planned):empty();if(u>=4){s.revision=1;
   if(u>=4.05){s.path=clone(routed.path);const distance=at(4.1,4.9)*(s.path.length-1),a=s.path[Math.floor(distance)],b=s.path[Math.min(s.path.length-1,Math.ceil(distance))],t=distance%1;s.objects.find(o=>o.id==='agent-1').position={x:mix(a.x,b.x,t),y:0,z:mix(a.z,b.z,t)};s.revision=2;}
   if(u>5.1){const t=at(5.1,5.95),o=s.objects.find(o=>o.id==='microscope-1'),end=edited.objects.find(o=>o.id==='microscope-1');o.position={x:mix(o.position.x,end.position.x,t),y:1,z:mix(o.position.z,end.position.z,t)};s.path=[];s.revision=3;}
  }
  params={scene:s,...explore};frame.science=clone(params.scene);v.plan=clone(planned);Object.assign(r,{sentence:1-at(2.2,2.8),semantics:at(.35,1),structure:at(1.25,1.85)*(1-at(3.1,3.7)),anchors:at(2.2,2.9)*(1-at(3.45,3.95)),world:at(3.15,4),path:at(4.05,4.3)*(1-at(5.1,5.5)),edit:at(5.1,5.9)});v.pathProgress=at(4.1,4.9);break;}
 case'natural':{
  params={steps:Math.round(sample([0,0,20,60],u)),method:'natural',...explore};frame.science={...posteriorExample(params.steps,params.method),method:params.method};Object.assign(r,{surface:at(.2,.9),target:at(.35,1),loss:at(1.15,1.8)});break;}
 case'bounds':{
  params={signs:u<.4?[1,1,1,1,1,1]:[-1,1,1,1,1,1],removed:u>=2.6?[0]:[],...explore};frame.science={...signedGraph(params.signs,params.removed),signs:params.signs,removed:params.removed};Object.assign(r,{spectrum:at(1.25,1.9),certificate:at(1.4,2)});v.cut=at(2.1,3);break;}
 case'urban':{
  params={region:u<2.5?0:2,parking:sample([0,7,7,1],u),...explore};const s=urbanExample(params.region,params.parking);Object.assign(r,{parking:at(.2,1),walk:at(1.2,2)});const travelOnly=u<.05;
  const parts=s.van.map((n,i)=>i===1?n*r.parking:i===2?n*r.walk:n),bike=s.bike.map((n,i)=>i===1?n*r.parking:i===2?n*r.walk:n);frame.science={...s,region:params.region,shownVan:parts,shownBike:bike,shownVanTotal:parts.reduce((a,b)=>a+b),shownBikeTotal:bike.reduce((a,b)=>a+b)};v.journey=clamp(u/2,0,1);break;}
 case'interaction':{
  params={paired:u>=.45,distributed:u>=1.5,...explore};frame.science={...interactionExample(params.distributed),...params};r.pairs=at(.1,.9);v.spread=r.pairs;v.messages=at(.45,1);break;}
 }
 if(explore){Object.assign(r,allReveal);if(key==='world'){r.structure=0;r.sentence=0;r.semantics=0;r.anchors=0;v.pathProgress=1;}if(key==='urban'){const s=frame.science;s.shownVan=s.van;s.shownBike=s.bike;s.shownVanTotal=s.vanTotal;s.shownBikeTotal=s.bikeTotal;}if(key==='interaction')v.spread=params.paired?1:0;}
 frame.parameters=params;return frame;
}
export function progressFromAnchors(y,anchors){
 if(!Number.isFinite(y)||anchors.length<2||anchors.some((n,i)=>!Number.isFinite(n)||(i&&n<=anchors[i-1])))throw Error('Ordered finite narrative anchors required.');
 if(y<=anchors[0])return 0;if(y>=anchors.at(-1))return 1;let i=0;while(y>anchors[i+1])i++;return (i+(y-anchors[i])/(anchors[i+1]-anchors[i]))/(anchors.length-1);
}
