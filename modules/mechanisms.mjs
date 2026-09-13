/** Deterministic worked examples. None of these values are paper measurements. */
export const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
export const round = (x,n=3) => +x.toFixed(n);
export function gainTriangle(degrees=0) {
  const a = degrees*Math.PI/180;
  return { degrees, cycle:[Math.cos(a),Math.sin(a)], eigenvalues:[0,1,2].map(k=>1-Math.cos((a+2*Math.PI*k)/3)).sort((a,b)=>a-b),
    matrix:[['1','−½',`−½ exp(−i${degrees}°)`],['−½','1','−½'],[`−½ exp(i${degrees}°)`,'−½','1']], balanced:Math.abs(Math.sin(a/2))<1e-9 };
}
export function eigenvaluesSymmetric(matrix) {
  const a=matrix.map(r=>r.slice()), n=a.length;
  for(let iter=0;iter<100*n*n;iter++) {
    let p=0,q=1,max=0;
    for(let i=0;i<n;i++) for(let j=i+1;j<n;j++) if(Math.abs(a[i][j])>max){max=Math.abs(a[i][j]);p=i;q=j;}
    if(max<1e-12) break;
    const phi=.5*Math.atan2(2*a[p][q],a[q][q]-a[p][p]),c=Math.cos(phi),s=Math.sin(phi),app=a[p][p],aqq=a[q][q],apq=a[p][q];
    for(let k=0;k<n;k++) if(k!==p && k!==q) {const x=a[k][p],y=a[k][q];a[k][p]=a[p][k]=c*x-s*y;a[k][q]=a[q][k]=s*x+c*y;}
    a[p][p]=c*c*app-2*s*c*apq+s*s*aqq;a[q][q]=s*s*app+2*s*c*apq+c*c*aqq;a[p][q]=a[q][p]=0;
  }
  return a.map((r,i)=>Math.abs(r[i])<1e-10?0:r[i]).sort((x,y)=>x-y);
}
export const edges = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
export function signedGraph(signs=[1,1,1,1,1,1], removed=[]) {
  const L=Array.from({length:4},()=>Array(4).fill(0));
  edges.forEach(([u,v],i)=>{if(!removed.includes(i)){L[u][u]++;L[v][v]++;L[u][v]=-signs[i];L[v][u]=-signs[i];}});
  let best=Infinity,repair=[],assignment=[];
  for(let m=0;m<8;m++) {
    const x=[1,...[0,1,2].map(k=>(m>>k)&1?-1:1)];
    const bad=edges.flatMap(([u,v],i)=>!removed.includes(i)&&x[u]*x[v]!==signs[i]?[i]:[]);
    if(bad.length<best){best=bad.length;repair=bad;assignment=x;}
  }
  const eig=eigenvaluesSymmetric(L), min=Math.max(0,eig[0]);
  return {matrix:L,eigenvalues:eig,minimum:min,frustration:best,repair,assignment,lowerBound:Math.ceil(4*min/4-1e-9)};
}
export function replayExample(phase='old', memories=[true,true], strength=.8) {
  const theta=phase==='old'?[1,1]:phase==='new'?[2,2]:[2-(memories[0]?strength:0),2-(memories[1]?strength:0)];
  const oldLoss=.5*((theta[0]-1)**2+(theta[1]-1)**2), newLoss=.5*(theta[0]+theta[1]-4)**2;
  const missing=phase==='replay'?Math.hypot(memories[0]?0:strength,memories[1]?0:strength):Math.SQRT2*strength;
  return {theta,oldLoss,newLoss,missing,desired:[-strength,-strength]};
}
export function rankExample(rank=1,budget=.15) {
  const singular=[1,.7,.35], kept=singular.map((s,i)=>i<rank?s:0), residual=Math.hypot(...singular.map((s,i)=>s-kept[i]));
  const cost=.5*kept.reduce((sum,s,i)=>sum+([.1,.8,2][i]*s)**2,0);
  return {rank,singular,kept,residual,cost,parameters:6*rank,expressible:residual<1e-9,affordable:cost<=budget,budget};
}
export function timeExample(month=0,fraction=.5,stable=false) {
  const drift=stable?0:Math.max(0,month-3)*.25, newVariance=1/4, oldVariance=1/16;
  const bias=fraction*drift, variance=(1-fraction)**2*newVariance+fraction*fraction*oldVariance;
  return {month,drift,fraction,bias,variance,error:bias*bias+variance,withoutReplay:newVariance,benefit:newVariance-(bias*bias+variance),optimalFraction:newVariance/(drift*drift+newVariance+oldVariance)};
}
export const posteriorTarget = {mean:[1,-.5], h:[1,7]};
export function posteriorStep(state,method='natural',rate=.07) {
  const {mean,h}=posteriorTarget, m=state.m.slice(), c=state.c.slice();
  // Algorithm 1, exact diagonal Gaussian target, gamma=1. Both updates use old c.
  return {m:m.map((v,i)=>v-rate*(method==='natural'?c[i]**2:1)*h[i]*(v-mean[i])),
    c:c.map((v,i)=>method==='natural'?v-rate*.5*v*(h[i]*v*v-1):v-rate*(h[i]*v-1/v))};
}
export function posteriorKL(state) {
  return .5*state.m.reduce((sum,m,i)=>sum+posteriorTarget.h[i]*(m-posteriorTarget.mean[i])**2+posteriorTarget.h[i]*state.c[i]**2-Math.log(posteriorTarget.h[i]*state.c[i]**2)-1,0);
}
export function posteriorExample(steps=0,method='natural') {
  let s={m:[-2,1.5],c:[.8,.45]}, path=[s],loss=[posteriorKL(s)];
  for(let t=0;t<steps;t++){s=posteriorStep(s,method);path.push(s);loss.push(posteriorKL(s));}
  return {...s,steps,path,loss,kl:loss.at(-1)};
}
export function urbanExample(region=0,parking=5) {
  const contexts=[{name:'Dense centre',distance:1.2,vanSpeed:15,bikeSpeed:14,walk:3.5,parking:7},{name:'Residential streets',distance:2.1,vanSpeed:24,bikeSpeed:16,walk:1.5,parking:3},{name:'Outer district',distance:4.5,vanSpeed:38,bikeSpeed:18,walk:.7,parking:1}];
  const r=contexts[region],van=[60*r.distance/r.vanSpeed,parking,r.walk],bike=[60*r.distance/r.bikeSpeed,.5,.4];
  return {...r,parking,van,bike,vanTotal:van.reduce((a,b)=>a+b,0),bikeTotal:bike.reduce((a,b)=>a+b,0)};
}
export function interactionExample(distributed=false) {
  const pairs=distributed?[[0,0,2],[1,1,2],[2,2,2],[3,3,2]]:[[0,0,5],[1,0,1],[2,1,1],[3,2,1]];
  return {pairs,messages:8,recipientCounts:[0,1,2,3].map(i=>pairs.filter(p=>p[1]===i).reduce((a,p)=>a+p[2],0)),distinctRecipients:new Set(pairs.map(p=>p[1])).size};
}
export function newCase() {
  return {source:Object.freeze({date:'2026-05-12',text:'My laboratory camera broke on 12 May. The repair invoice is CHF 420.'}),policyEnd:'2026-05-31',parsed:null,review:null,invoice:420,invoiceReviewed:true,proposal:420,nodes:{},events:[],attempts:0};
}
function node(s,id,inputs,compute) {
  const signature=JSON.stringify(inputs),prev=s.nodes[id];
  if(!prev || prev.signature!==signature) s.nodes[id]={signature,value:compute(),version:(prev?.version||0)+1,changed:true};
  else s.nodes[id]={...prev,changed:false};
  return s.nodes[id].value;
}
export function refreshCase(s) {
  const human=s.review?.authority==='human' && s.review.date===s.source.date;
  const date=human?s.review.date:s.parsed;
  const resolved=node(s,'date',[s.source.date,s.parsed,s.review],()=>!!date && date===s.source.date && human);
  const covered=node(s,'coverage',[date,s.policyEnd],()=>!!date && date>='2026-01-01' && date<=s.policyEnd);
  const invoice=node(s,'invoice',[s.invoice,s.invoiceReviewed],()=>s.invoice>0 && s.invoiceReviewed);
  node(s,'gate',[resolved,covered,invoice,s.invoice,s.proposal],()=>resolved&&covered&&invoice&&s.invoice===s.proposal);
  return s;
}
export function caseAction(s,action) {
  if(action==='interpret'){s.parsed='2026-06-12';s.events.push('Stored interpretation: 12 June. Payment proposed, not authorized.');}
  else if(action==='untrusted'){s.review={date:s.source.date,authority:'model'};s.events.push('Model-suggested correction recorded. Human authority remains absent.');}
  else if(action==='correct'){s.review={date:s.source.date,authority:'human'};s.events.push('Human-reviewed correction: 12 May. Original source preserved.');}
  else if(action==='amend'){s.invoice=560;s.invoiceReviewed=false;s.events.push('Invoice changed to CHF 560. Independent amount review is required.');}
  refreshCase(s);
  if(action==='attempt'){s.attempts++;s.events.push(s.nodes.gate.value?'Human decision is admissible. No real payment is sent.':'REFUSED: the evidence obligations are not resolved.');}
  return s;
}
