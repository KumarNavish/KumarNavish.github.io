/** Exact, small worked examples. These are not measured paper results. */
import {eigenvaluesSymmetric, signedGraph, posteriorExample, urbanExample, interactionExample} from '../mechanisms.mjs?v=scroll-4.2.2';
export {signedGraph,posteriorExample,urbanExample,interactionExample};
export const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
export const add=(a,b)=>a.map((x,i)=>x+b[i]);
export const sub=(a,b)=>a.map((x,i)=>x-b[i]);
export const scale=(a,k)=>a.map(x=>x*k);
export const norm=a=>Math.hypot(...a);
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const wrap=a=>((a+180)%360+360)%360-180;
export const graphEdges=[[0,1],[1,2],[2,3],[3,4],[4,0],[0,2],[1,3]];
export const graphCycles=[[0,1,2],[1,2,3],[0,1,2,3,4]];
const combinations=(n,k)=>{const r=[];function walk(a,s){if(a.length===k){r.push(a);return;}for(let i=s;i<n;i++)walk([...a,i],i+1);}walk([],0);return r;};
export function graphState(angles=Array(7).fill(0)){
 if(angles.length!==7||!angles.every(Number.isFinite))throw Error('Seven finite edge angles are required.');
 const n=5,degree=Array(n).fill(0),re=Array.from({length:n},()=>Array(n).fill(0)),im=re.map(r=>r.slice());
 graphEdges.forEach(([u,v])=>{degree[u]++;degree[v]++;});for(let i=0;i<n;i++)re[i][i]=1;
 graphEdges.forEach(([u,v],i)=>{const t=angles[i]*Math.PI/180,w=1/Math.sqrt(degree[u]*degree[v]);re[u][v]=re[v][u]=-Math.cos(t)*w;im[u][v]=-Math.sin(t)*w;im[v][u]=-im[u][v];});
 // Hermitian H maps to real symmetric [Re H, -Im H; Im H, Re H]. Eigenvalues repeat twice.
 const doubled=Array.from({length:2*n},(_,i)=>Array.from({length:2*n},(_,j)=>i<n?(j<n?re[i][j]:-im[i][j-n]):(j<n?im[i-n][j]:re[i-n][j-n])));
 const all=eigenvaluesSymmetric(doubled),eigenvalues=Array.from({length:n},(_,i)=>Math.max(0,(all[2*i]+all[2*i+1])/2));
 function directed(u,v){let i=graphEdges.findIndex(([a,b])=>a===u&&b===v);if(i>=0)return angles[i];i=graphEdges.findIndex(([a,b])=>a===v&&b===u);return -angles[i];}
 const cycles=graphCycles.map(nodes=>({nodes,angle:wrap(nodes.reduce((s,u,i)=>s+directed(u,nodes[(i+1)%nodes.length]),0))}));
 // Enumerate every spanning tree. Extending its vertex potentials gives a balanced gain assignment.
 // Minimize number of retuned edges, then total squared angular change. Tiny-graph exact search only.
 let repair=null;
 for(const tree of combinations(7,4)){
  const phase=[0,null,null,null,null];let changed=true;
  while(changed){changed=false;for(const i of tree){const[u,v]=graphEdges[i];if(phase[u]!==null&&phase[v]===null){phase[v]=phase[u]+angles[i];changed=true;}else if(phase[v]!==null&&phase[u]===null){phase[u]=phase[v]-angles[i];changed=true;}}}
  if(phase.includes(null))continue;
  const target=graphEdges.map(([u,v])=>wrap(phase[v]-phase[u])),d=target.map((x,i)=>wrap(x-angles[i])),ids=d.flatMap((x,i)=>Math.abs(x)>1e-7?[i]:[]),cost=dot(d,d);
  if(!repair||ids.length<repair.ids.length||(ids.length===repair.ids.length&&cost<repair.cost))repair={ids,target,cost};
 }
 return {angles:angles.map(wrap),degree,re,im,eigenvalues,cycles,inconsistent:cycles.filter(c=>Math.abs(c.angle)>1e-7).length,repair};
}
export const incoming=[1.35,1.05,.9];
export const memories=[{id:'A',name:'Skill A',v:[1,0,0]},{id:'A2',name:'Another A',v:[1,0,0]},{id:'B',name:'Skill B',v:[0,1,0]},{id:'C',name:'Skill C',v:[0,0,1]}];
export function replayState(selected=[0],learning=1,correction=1){
 const current=scale(incoming,learning),joint=scale(current,.5),desired=sub(joint,current),basis=[];
 for(const id of selected){let b=memories[id]?.v.slice();if(!b)throw Error('Unknown memory');for(const q of basis)b=sub(b,scale(q,dot(b,q)));if(norm(b)>1e-9)basis.push(scale(b,1/norm(b)));}
 let fullProjection=[0,0,0];for(const b of basis)fullProjection=add(fullProjection,scale(b,dot(desired,b)));
 const projected=scale(fullProjection,correction),unavailable=sub(desired,fullProjection),notApplied=sub(fullProjection,projected);
 const actual=add(current,projected),residual=sub(desired,projected);
 return {selected,learning,correction,current,joint,desired,projected,actual,residual,missing:norm(residual),unavailable:norm(unavailable),notApplied:norm(notApplied),directions:basis.length,oldLoss:.5*dot(actual,actual),newLoss:.5*dot(sub(actual,incoming),sub(actual,incoming)),jointLoss:.5*dot(actual,actual)+.5*dot(sub(actual,incoming),sub(actual,incoming))};
}
function solve(a,b){a=a.map((r,i)=>[...r,b[i]]);const n=b.length;for(let k=0;k<n;k++){let p=k;for(let i=k+1;i<n;i++)if(Math.abs(a[i][k])>Math.abs(a[p][k]))p=i;if(Math.abs(a[p][k])<1e-10)return null;[a[k],a[p]]=[a[p],a[k]];const d=a[k][k];for(let j=k;j<=n;j++)a[k][j]/=d;for(let i=0;i<n;i++)if(i!==k){const q=a[i][k];for(let j=k;j<=n;j++)a[i][j]-=q*a[k][j];}}return a.map(r=>r[n]);}
export const constraints=[{n:[1,0,1],b:1.4,name:'Recover A'},{n:[-1,0,1],b:.7,name:'Recover B'},{n:[0,1,0],b:.65,name:'Keep C'}];
export function rankState(rank=1,budget=.6,requirements=constraints){
 rank=clamp(Math.round(rank),1,3);const A=requirements.map(c=>c.n.slice(0,rank)),b=requirements.map(c=>c.b);let best=b.every(v=>v<=0)?Array(rank).fill(0):null;
 for(let k=1;k<=Math.min(3,rank);k++)for(const ids of combinations(3,k)){
  const rows=ids.map(i=>A[i]),lambda=solve(rows.map(a=>rows.map(c=>dot(a,c))),ids.map(i=>b[i]));if(!lambda||lambda.some(x=>x< -1e-8))continue;
  const x=Array(rank).fill(0);rows.forEach((r,i)=>r.forEach((v,j)=>x[j]+=v*lambda[i]));if(A.some((a,i)=>dot(a,x)<b[i]-1e-8))continue;
  if(!best||dot(x,x)<dot(best,best))best=x;
 }
 const repair=best?[...best,...Array(3-rank).fill(0)]:null,cost=repair?.reduce((a,x)=>a+.5*x*x,0)??null;
 return {rank,budget,repair,cost,feasible:!!repair,affordable:cost!==null&&cost<=budget+1e-8,radius:Math.sqrt(2*budget),slack:repair?requirements.map(c=>dot(c.n,repair)-c.b):null};
}
export const meanAt=t=>.32*Math.max(0,t-3);
export function timeState(month=2,replay=24,budget=64,window=3,stable=false){
 month=clamp(Math.round(month),1,10);budget=clamp(Math.round(budget),16,128);replay=clamp(Math.round(replay),0,Math.floor(budget*.75));window=clamp(Math.round(window),1,month);
 const current=stable?0:meanAt(month),ages=Array.from({length:window},(_,i)=>month-1-i),past=ages.reduce((s,t)=>s+(stable?0:meanAt(t)),0)/ages.length,alpha=replay/budget,drift=current-past;
 // Fixed compute allocation: B updates, each using one independent observation.
 // This illustrative archive is less noisy (variance .2 vs 1), explicitly not a universal property of old data.
 const variance=((budget-replay)+.2*replay)/(budget*budget),bias=-alpha*drift,error=bias*bias+variance,noReplay=1/budget;
 const oracle=drift===0?Math.floor(.75*budget):clamp(Math.round(.8/(2*drift*drift)),0,Math.floor(.75*budget));
 return {month,replay,budget,window,stable,current,past,ages,alpha,drift,variance,bias,error,noReplay,benefit:noReplay-error,newUpdates:budget-replay,oracle,totalUpdates:month*budget};
}
export function simulatePeriod(s,seed=1729){
 let r=seed>>>0;const uniform=()=>{r=(Math.imul(r,1664525)+1013904223)>>>0;return (r+.5)/4294967296;};
 const samples=[];for(let i=0;i<s.budget;i++){const old=i<s.replay,noise=Math.sqrt(-2*Math.log(uniform()))*Math.cos(2*Math.PI*uniform());samples.push({old,value:(old?s.past:s.current)+noise*Math.sqrt(old?.2:1)});}
 const estimate=samples.reduce((a,o)=>a+o.value,0)/s.budget;return{samples,estimate,processed:samples.length,replayed:samples.filter(o=>o.old).length};
}
