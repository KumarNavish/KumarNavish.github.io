/** Small, explicit mathematical examples. These are not manuscript experiments. */
export type V3 = [number, number, number];
export type V2 = [number, number];
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const norm = (v: number[]) => Math.hypot(...v);
export const mean2 = (a: V2[]): V2 => [a.reduce((s,v)=>s+v[0],0)/a.length,a.reduce((s,v)=>s+v[1],0)/a.length];
export const sub2 = (a: V2,b: V2): V2 => [a[0]-b[0],a[1]-b[1]];
export const add2 = (a: V2,b: V2): V2 => [a[0]+b[0],a[1]+b[1]];
export const mul2 = (a: V2,s: number): V2 => [a[0]*s,a[1]*s];
export const GRAPH_EDGES: [number,number][] = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[0,3]];

/** Jacobi diagonalization of a real symmetric matrix. Sorted ascending. */
export function eigenvaluesSymmetric(input: number[][]): number[] {
  const a=input.map(row=>[...row]), n=a.length;
  for(let iter=0;iter<80*n*n;iter++){
    let p=0,q=1,max=0;
    for(let i=0;i<n;i++) for(let j=i+1;j<n;j++) if(Math.abs(a[i][j])>max){max=Math.abs(a[i][j]);p=i;q=j;}
    if(max<1e-11) break;
    const phi=0.5*Math.atan2(2*a[p][q],a[q][q]-a[p][p]),c=Math.cos(phi),s=Math.sin(phi);
    const pp=a[p][p],qq=a[q][q],pq=a[p][q];
    for(let i=0;i<n;i++) if(i!==p&&i!==q){const ip=a[i][p],iq=a[i][q];a[i][p]=a[p][i]=c*ip-s*iq;a[i][q]=a[q][i]=s*ip+c*iq;}
    a[p][p]=c*c*pp-2*s*c*pq+s*s*qq;
    a[q][q]=s*s*pp+2*s*c*pq+c*c*qq;a[p][q]=a[q][p]=0;
  }
  return a.map((r,i)=>Math.abs(r[i])<1e-10?0:r[i]).sort((x,y)=>x-y);
}
export function gainGraph(phase: number, normalized=false, repaired=false){
  const n=6,re=Array.from({length:n},()=>Array(n).fill(0) as number[]),im=re.map(r=>[...r]);
  const edges=GRAPH_EDGES.filter((_,i)=>!(repaired&&i===0)),degree=Array(n).fill(0) as number[];
  edges.forEach(([i,j])=>{degree[i]++;degree[j]++;});
  for(let i=0;i<n;i++) re[i][i]=normalized?(degree[i]?1:0):degree[i];
  edges.forEach(([i,j])=>{const p=i===0&&j===1?phase:0,den=normalized?Math.sqrt(degree[i]*degree[j]):1;
    re[i][j]=re[j][i]=-Math.cos(p)/den;im[i][j]=-Math.sin(p)/den;im[j][i]=-im[i][j];});
  const realBlock=Array.from({length:n*2},(_,i)=>Array.from({length:n*2},(_,j)=>i<n?(j<n?re[i][j]:-im[i][j-n]):(j<n?im[i-n][j]:re[i-n][j-n])));
  const doubled=eigenvaluesSymmetric(realBlock),eigen=Array.from({length:n},(_,i)=>(doubled[2*i]+doubled[2*i+1])/2);
  const balanced=repaired||Math.abs(Math.sin(phase/2))<1e-8;
  return {re,im,eigen,degree,balanced,frustration:balanced?0:1,cycleAngle:repaired?0:Math.atan2(Math.sin(phase),Math.cos(phase))};
}

export function replayExample(budget: number, interference: number, mode:'greedy'|'random'|'dense'='greedy', deficient=false){
  const theta=interference*Math.PI/180,w:V2=[-0.5,0],currentCenter:V2=[2.5,0];
  const oldCenter:V2=[-0.5+1.5*Math.cos(theta),1.5*Math.sin(theta)];
  const memories:V2[]=Array.from({length:12},(_,i)=>[oldCenter[0]+0.85*Math.cos(i*2.399),oldCenter[1]+0.7*Math.sin(i*2.399)]);
  const gradients=memories.map(v=>sub2(w,v)),gc=sub2(w,currentCenter),go=mean2(gradients),target=mul2(add2(gc,go),.5);
  const available=deficient?gradients.map(g=>[Math.abs(g[0])*-0.5,g[1]*.1] as V2):gradients;
  const k=clamp(Math.round(budget),1,12),selected:number[]=[];
  if(mode==='dense') selected.push(...available.map((_,i)=>i));
  else if(mode==='random') selected.push(...[0,4,8,1,7,3,11,5,2,10,6,9].slice(0,k));
  else {
    for(let t=0;t<k;t++){
      let best=-1,score=Infinity;
      for(let i=0;i<available.length;i++) if(!selected.includes(i)){
        const m=mean2([...selected,i].map(j=>available[j])),err=norm(sub2(m,go));
        if(err<score){score=err;best=i;}
      }
      selected.push(best);
    }
  }
  const realized=mul2(add2(gc,mean2(selected.map(i=>available[i]))),.5),eta=.65;
  const currentOnly=sub2(w,mul2(gc,eta)),corrected=sub2(w,mul2(realized,eta)),ideal=sub2(w,mul2(target,eta));
  const loss=(v:V2,c:V2)=>.5*((v[0]-c[0])**2+(v[1]-c[1])**2);
  const oldLoss=(v:V2)=>memories.reduce((s,c)=>s+loss(v,c),0)/memories.length;
  return {w,currentCenter,oldCenter,memories,gradients:available,gc,go,target,realized,selected,currentOnly,corrected,ideal,
    residual:norm(sub2(realized,target)),oldBefore:oldLoss(w),oldAfterCurrent:oldLoss(currentOnly),oldAfterReplay:oldLoss(corrected),
    newBefore:loss(w,currentCenter),newAfterCurrent:loss(currentOnly,currentCenter),newAfterReplay:loss(corrected,currentCenter)};
}

function solve(a:number[][], b:number[]):number[]|null {
 const m=a.map((r,i)=>[...r,b[i]]),n=b.length;
 for(let j=0;j<n;j++){
  let p=j;for(let i=j+1;i<n;i++) if(Math.abs(m[i][j])>Math.abs(m[p][j]))p=i;
  if(Math.abs(m[p][j])<1e-10)return null;[m[p],m[j]]=[m[j],m[p]];
  const v=m[j][j];for(let k=j;k<=n;k++)m[j][k]/=v;
  for(let i=0;i<n;i++)if(i!==j){const f=m[i][j];for(let k=j;k<=n;k++)m[i][k]-=f*m[j][k];}
 }return m.map(r=>r[n]);
}
/** Exact active-set enumeration for this two-constraint, three-dimensional QP. */
export function rankExample(rank:number, budget:number){
 const all=[[1,0,1],[-1,.3,1]],a=all.map(r=>r.slice(0,rank)),b=[1,1];
 let best:number[]|null=null;
 for(let mask=1;mask<4;mask++){
  const ids=[0,1].filter(i=>(mask&(1<<i))!==0);if(ids.length>rank)continue;
  const gram=ids.map(i=>ids.map(j=>a[i].reduce((s,v,k)=>s+v*a[j][k],0))),lambda=solve(gram,ids.map(i=>b[i]));
  if(!lambda||lambda.some(v=>v< -1e-8))continue;
  const x=Array.from({length:rank},(_,k)=>ids.reduce((s,i,j)=>s+lambda[j]*a[i][k],0));
  if(a.some((r,i)=>r.reduce((s,v,k)=>s+v*x[k],0)<b[i]-1e-7))continue;
  if(!best||norm(x)<norm(best))best=x;
 }
 const magnitude=best?norm(best):null,position:V3=[best?.[0]??0,best?.[2]??0,best?.[1]??0];
 return {rank,solution:best,position,magnitude,feasible:!!best,usable:magnitude!==null&&magnitude<=budget,a,b};
}

export function temporalExample(replay:number,shift:number,age:number){
 const fraction=clamp(replay,0,80)/100,staleness=clamp(shift,0,1)*age/5;
 const backward=-fraction*(.7/(1+.1*age));
 const current=fraction*(1.6*staleness-.12),forward=fraction*(1.15*staleness-.08);
 const net=-(backward+current+forward)/3;
 return {currentTokens:100-replay,oldTokens:replay,backward,current,forward,net,
   recommended:net>0?replay:0,weights:[backward,current,forward],
   matrix:Array.from({length:6},(_,i)=>Array.from({length:6},(_,j)=>i===5?(j<5?backward*(1+.12*(5-j)):current):.03*(i-j)**2))};
}

export function urbanExample(parking:number,density:number){
 const van={travel:3.2,parking,walking:1.2+density*.55,unload:1.4};
 const bike={travel:4.8,parking:.3,walking:.45,unload:2.0+density*.1};
 const sum=(x:typeof van)=>Object.values(x).reduce((a,b)=>a+b,0);
 return {van,bike,vanTime:sum(van),bikeTime:sum(bike),winner:sum(van)<sum(bike)?'van':'cargo bike'};
}

export function gaussianExample(anisotropy:number,steps:number){
 const target:V2=[.45,1.8],precision:V2=[anisotropy,1];
 const natural:V3[]=[],euclidean:V3[]=[];
 const path=(nat:boolean)=>{
  let mu:V2=[2.3,1.7],sd:V2=[1.15,.6];const out:V3[]=[];const losses:number[]=[];
  for(let i=0;i<=steps;i++){
   const loss=.5*(precision[0]*(mu[0]**2+sd[0]**2)+precision[1]*(mu[1]**2+sd[1]**2)-2-Math.log(precision[0]*precision[1]*sd[0]**2*sd[1]**2));
   out.push([mu[0],loss*.12,mu[1]]);losses.push(loss);
   const dt=.045/Math.max(1,anisotropy/3);
   mu=mu.map((v,k)=>v-dt*(nat?sd[k]**2:1)*precision[k]*v) as V2;
   sd=sd.map((v,k)=>Math.max(.04,v-dt*(nat?.5*v*v:1)*(precision[k]*v-1/v))) as V2;
  }
  return {path:out,losses,mu,sd};
 };
 const n=path(true),e=path(false);natural.push(...n.path);euclidean.push(...e.path);
 return {natural,euclidean,n,e,target,precision};
}

export type EvidenceSource={id:string;field:string;value:string;supersedes?:string};
export function evidenceGate(sources:EvidenceSource[]){
 const superseded=new Set(sources.map(s=>s.supersedes).filter(Boolean));
 const active=sources.filter(s=>!superseded.has(s.id));
 const values=new Set(active.filter(s=>s.field==='inspection-date').map(s=>s.value));
 return {status:values.size===1?'READY':values.size===0?'MISSING':'HOLD',active:active.map(s=>s.id),superseded:[...superseded],
   obligation:values.size===1?'One current inspection date is supported. Human review remains required.':values.size===0?'Supply an inspection date.':'Resolve the conflicting inspection dates.'};
}
