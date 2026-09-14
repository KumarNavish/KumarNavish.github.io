import {T,group,mesh,box,ball,line,ring,rod,point,segment,vector,alpha,annotation,contentHTML,metric,fmt,V,basePlane} from './scene-kit.mjs';
import {meanAt} from '../worlds/math.mjs';
export function timeScene(view,overlay){
 const g=group(view.content),labels=annotation(view),windows=[],track=group(g);basePlane(g,'#e8deca',24);
 for(let i=0;i<=10;i++){const w=group(track);box(w,[0,.9,0],[.075,1.55,1.2],'#bba987',{transparent:true,opacity:.7,roughness:.7});for(let j=0;j<5;j++)box(w,[.04,.4+j*.19,0],[.016,.035,.72],'#e9dfcd');windows.push(w);}
 const currentMean=ball(g,[1.4,0,0],.09,'#4f8c72'),estimate=ball(g,[1.4,0,0],.07,'#c1904e'),gap=segment(g,'#bd704f',.02),rail=segment(g,'#b4a183',.012);rail.set([-4.4,.08,1.3],[3,.08,1.3]);
 const budget=document.createElement('div');budget.className='n-budget';budget.innerHTML='<span class="n-small">Fixed learning budget · simulated observations</span><div class="n-budget-cells">'+Array.from({length:64},()=>'<i></i>').join('')+'</div><strong></strong>';overlay.append(budget);const cells=[...budget.querySelectorAll('i')],risk=document.createElement('div');risk.className='n-bottom-metrics';overlay.append(risk);
 return {render(f){const s=f.science,r=f.reveal,t=f.exploring?s.month:f.visual.time;
  windows.forEach((w,i)=>{const present=i===s.month,age=s.month-i,keep=age>0&&age<=s.window;w.position.set((i-t)*.73+1.4,.10+(s.stable?0:meanAt(i))*.37,-.35);alpha(w,i<=s.month?present?1:keep?.78:.22:0);w.children[0].material.color.set(present?'#5c937a':keep?(s.benefit<0?'#bb7b58':'#ad9c72'):'#c5bba9');});
  const p=[1.4,.2+s.current*.7,-1.5],e=[1.4,.2+(s.current+s.bias)*.7,-1.5];point(currentMean,p);point(estimate,e);gap.set(p,e);alpha(gap.g,r.risk);currentMean.visible=estimate.visible=r.risk>.01;
  cells.forEach((c,i)=>c.classList.toggle('replay',i<s.replay));budget.querySelector('strong').textContent=`${s.replay} replay + ${s.newUpdates} current = ${s.budget}`;budget.classList.toggle('attention',r.budget>.4);risk.hidden=r.risk<.01;risk.style.opacity=r.risk;
  contentHTML(risk,metric('Current expected error',fmt(s.error,4),s.benefit<0?'danger':'')+metric('Without replay',fmt(s.noReplay,4))+(f.position>=3.7?metric('Archive expected error',fmt(s.archiveError,4)):'')+(f.position>4.7?metric('Optimal replay slots',s.oracle):''));
  overlay.dataset.windowMeans=JSON.stringify(windows.map((w,i)=>s.stable?0:meanAt(i)));const a=[{text:`Present · period ${s.month}`,pos:[1.4,2.0+(s.stable?0:meanAt(s.month))*.37,-.35],tone:'green'}];if(r.risk>.7&&Math.abs(s.bias)>.02)a.push({text:'The archive pulls toward an outdated mean',pos:[1.4,.55+(s.current+s.bias)*.7,-1.5],tone:'red'});labels(a);
 },dispose(){budget.remove();risk.remove();}};
}
export function interactionScene(view,overlay){
 const g=group(view.content),labels=annotation(view);basePlane(g,'#e3e9e1');const nodes=[];
 for(let side=0;side<2;side++)for(let i=0;i<4;i++){const o=group(g);mesh(o,new T.CylinderGeometry(.26,.30,.12,32),side?'#cebca5':'#94b6a2',[0,.05,0]);ball(o,[0,.35,0],.15,side?'#ae8f73':'#64967f');nodes.push({o,side,i});}
 const arrows=Array.from({length:8},()=>segment(g,'#74a891',.015));const messages=Array.from({length:8},()=>ball(g,[0,0,0],.053,'#57886e'));
 const panel=document.createElement('div');panel.className='n-bottom-metrics';overlay.append(panel);
 return{render(f){const s=f.science,spread=f.visual.spread;nodes.forEach(({o,side,i})=>o.position.set(side?2.2:-2.2,0,(i-1.5)*1.1*spread));
  const pairs=s.pairs.flatMap(([a,b,n])=>Array.from({length:n},()=>[a,b]));pairs.forEach(([a,b],i)=>{const A=[-2.2,.37,(a-1.5)*1.1*spread],B=[2.2,.37,(b-1.5)*1.1*spread];arrows[i].set(A,B);point(messages[i],V(A).lerp(V(B),f.exploring?.25+i/12:Math.min(1,.2+i/12+f.visual.messages*.12)).toArray());});
  contentHTML(panel,metric('Messages',8)+(s.paired?metric('Most-reached account',Math.max(...s.recipientCounts)+'/8 replies')+metric('Recipients reached',s.distinctRecipients):metric('Pair structure','Hidden')));
  labels(spread<.3?[{text:'Group A',pos:[-2.2,.9,0],tone:'light-label'},{text:'Group B',pos:[2.2,.9,0],tone:'light-label'}]:nodes.filter(n=>n.side).map(({i})=>({text:`B${i+1} · ${s.recipientCounts[i]} replies`,pos:[2.2,.77,(i-1.5)*1.1],tone:'light-label'})));
 },dispose(){panel.remove();}};
}
function vehicle(parent,bike=false){const g=group(parent);if(bike){for(const x of[-.22,.22])ring(g,[x,.18,0],.14,'#40564b',[0,Math.PI/2,0],.026);rod(g,[-.22,.18,0],[.15,.44,0],.025,'#b07c4d');rod(g,[.15,.44,0],[.22,.18,0],.022,'#b07c4d');box(g,[-.05,.35,0],[.23,.24,.23],'#b98658');}else{box(g,[0,.36,0],[.9,.5,.48],'#e1e4d8');box(g,[.32,.47,0],[.2,.2,.49],'#66858d');for(const x of[-.27,.27])for(const z of[-.25,.25])mesh(g,new T.CylinderGeometry(.10,.10,.06,16),'#394b40',[x,.13,z]).rotation.x=Math.PI/2;}return g;}
export function urbanScene(view,overlay){
 const g=group(view.content),labels=annotation(view);basePlane(g,'#d9e3d2');box(g,[0,-.05,0],[8,.14,1.4],'#aebbb0');const buildings=[];
 for(const [x,z]of[[-2,-2],[1.8,-2],[-2,2],[2,2]]){const b=group(g);box(b,[x,.6,z],[1.3,1.2,1.2],'#d3d4bf');box(b,[x,1.22,z],[1.4,.05,1.3],'#839786');box(b,[x,.45,z+(z<0?.608:-.608)],[.28,.56,.018],'#799294');buildings.push(b);}
 for(let x=-3;x<=3;x++)box(g,[x,.03,0],[.32,.01,.026],'#edf0e6');const van=vehicle(g),bike=vehicle(g,true);van.position.set(-2.5,0,.3);bike.position.set(1.1,0,-.35);
 const walking=group(g);line(walking,[[-1,.04,.3],[-1.5,.04,.95],[-2,.04,1.4]],'#b18b62',.015);line(walking,[[1.2,.04,-.35],[1.8,.04,-1.4]],'#599279',.015);
 const panel=document.createElement('div');panel.className='n-service';overlay.append(panel);
 return{render(f){const s=f.science,r=f.reveal;van.position.x=-2.7+1.7*Math.min(1,(f.position+.3));bike.position.x=-2.7+3.9*Math.min(1,(f.position+.4));alpha(walking,r.walk);buildings.forEach((b,i)=>b.scale.y=s.region===2?.5:1+i*.09);
  contentHTML(panel,`<span class="n-small">Illustrative service time · minutes</span>${[['Van',s.shownVan,s.shownVanTotal],['Bike',s.shownBike,s.shownBikeTotal]].map(([n,parts,total])=>`<div><span>${n}</span><section>${parts.map((p,i)=>`<i class="part-${i}" style="width:${p/25*100}%"></i>`).join('')}</section><b>${fmt(total,1)}</b></div>`).join('')}<small>Travel${r.parking>.5?' + parking':''}${r.walk>.5?' + final walk':''}</small>`);
  labels(r.parking>.5&&r.walk<.6?[{text:`Van parking search · ${fmt(s.parking,1)} min`,pos:[van.position.x,1,.3],tone:'amber'}]:r.walk>.6?[{text:'The parcel still has to reach the door',pos:[-2,1.4,2],tone:'light-label'}]:[{text:'Same route. Different travel speed.',pos:[0,.7,0],tone:'light-label'}]);
 },dispose(){panel.remove();}};
}
