import {evaluateNarrative,caseAt} from './model.mjs?v=scroll-4.2.2';
import {clone,compile,move,valid,difference} from '../worlds/compiler.mjs?v=scroll-4.2.2';
import {caseAction,refreshCase} from '../mechanisms.mjs?v=scroll-4.2.2';
import {graphState,memories,graphEdges,graphCycles} from '../worlds/math.mjs?v=scroll-4.2.2';
import {esc} from '../render.mjs?v=scroll-4.2.2';
const KEY='navish-scroll-sandbox-v4';
const b=(id,text)=>`<button type="button" data-explore="${id}">${text}</button>`;
const slider=(name,label,min,max,value,step=1)=>`<label class="n-control"><span>${label}<output>${value}</output></span><input data-parameter="${name}" type="range" aria-label="${label}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
export function createExplorer(key,host,onChange){
 let params=clone(evaluateNarrative(key,1).parameters),past=[],future=[],speech=null,active=false,disposed=false,message='';
 if(key==='case')params={state:caseAt(5)};if(key==='gain')Object.assign(params,{angles:Array(7).fill(0),cycle:-1,eigenmode:-1});
 const initial=()=>{const p=clone(evaluateNarrative(key,1).parameters);return key==='case'?{state:caseAt(5)}:key==='gain'?{...p,angles:Array(7).fill(0),cycle:-1,eigenmode:-1}:p;};
 function emit(){if(active)try{sessionStorage.setItem('navish-explorer-4.2:'+key,JSON.stringify(params));}catch{}onChange();}
 function state(){return evaluateNarrative(key,1,{explore:params}).science;}
 function say(text){message=text;const r=host.querySelector('[role="status"]');if(r)r.textContent=text;}
 function save(){if(key==='world')try{localStorage.setItem(KEY,JSON.stringify(params.scene));}catch{say('This browser cannot save locally. Export keeps the scene.');}}
 function commit(scene,label){const diff=difference(params.scene,scene);if(!diff.length){say('Already in that state. No objects replaced.');return;}past.push(clone(params.scene));if(past.length>40)past.shift();future=[];scene=clone(scene);scene.revision=params.scene.revision+1;params.scene=scene;save();message=label+': '+diff.join(' · ');render();emit();}
 function command(text){try{const result=compile(text,params.scene);commit(result.state,result.ops.map(o=>o.op.toUpperCase()).join(' → '));}catch(e){say(e.message);}}
 function render(){
 const focused=document.activeElement,attrs=['data-select','data-explore','data-memory','data-rank','data-sign','data-coordinate','data-case-date'];let focusSelector=null;
 if(host.contains(focused))for(const attr of attrs)if(focused.hasAttribute(attr)){focusSelector=`[${attr}="${CSS.escape(focused.getAttribute(attr))}"]`;break;}
 let controls='';
 if(key==='gain')controls=`<label class="n-control"><span>Relationship</span><select data-select="edge">${graphEdges.map(([a,c],i)=>`<option value="${i}" ${params.edge===i?'selected':''}>${'ABCDE'[a]}–${'ABCDE'[c]}</option>`).join('')}</select></label>${slider('angle','Relative orientation · degrees',-180,180,params.angle)}${b('repair','Find and apply a minimum repair')}<label class="n-control"><span>Follow a cycle</span><select data-select="cycle"><option value="-1">Through the selected edge</option>${graphCycles.map((ns,i)=>`<option value="${i}" ${params.cycle===i?'selected':''}>${[...ns,ns[0]].map(n=>'ABCDE'[n]).join(' → ')}</option>`).join('')}</select></label><label class="n-control"><span>Inspect an eigenmode</span><select data-select="eigenmode"><option value="-1">Show relationship instructions</option>${[0,1,2,3,4].map(i=>`<option value="${i}" ${params.eigenmode===i?'selected':''}>Mode ${i+1}${i===0?' · least energy':''}</option>`).join('')}</select></label><small>Each edge keeps its own angle. In mode view, arrow length is amplitude and direction is complex phase; the graph itself does not change.</small>`;
 if(key==='replay')controls=`<div class="n-memory-controls">${memories.map((m,i)=>`<button data-memory="${i}" aria-pressed="${params.selected.includes(i)}">${m.name}</button>`).join('')}</div>${slider('learning','New-task learning',0,1,params.learning,.02)}${slider('correction','Apply available correction',0,1,params.correction,.02)}${b('complete','Select A, B and C')}`;
 if(key==='rank')controls=`<div class="n-button-row">${[1,2,3].map(r=>`<button data-rank="${r}" aria-pressed="${params.rank===r}">Rank ${r}</button>`).join('')}</div>${slider('budget','Current-task change budget',.2,1.6,params.budget,.01)}${slider('tolerance','Relax A/B recovery by',0,1.4,params.tolerance||0,.05)}<small>Relaxation subtracts this amount from the A and B thresholds. The C requirement stays fixed. The solver and region both use these changed inequalities.</small>`;
 if(key==='time')controls=slider('month','Period',1,10,params.month)+slider('replay','Replay slots out of 64',0,48,params.replay)+slider('window','Historical window',1,6,params.window)+b('stable',params.stable?'Allow drift':'Keep the world stable')+b('oracle','Use the toy-oracle allocation');
 if(key==='natural')controls=slider('steps','Computed optimization steps',0,80,params.steps)+`<label class="n-control"><span>Update geometry</span><select data-select="method"><option value="natural" ${params.method==='natural'?'selected':''}>Natural gradient</option><option value="euclidean" ${params.method==='euclidean'?'selected':''}>Euclidean gradient</option></select></label>`;
 if(key==='bounds')controls=`<div class="n-button-row">${['AB','AC','AD','BC','BD','CD'].map((n,i)=>`<button data-sign="${i}">${n} ${params.signs[i]>0?'+':'−'}</button>`).join('')}</div>${b('remove','Remove a minimum repair')}`;
 if(key==='interaction')controls=b('pairs',params.paired?'Collapse into group totals':'Reveal individual accounts')+b('redistribute',params.distributed?'Concentrate replies':'Distribute the same eight replies');
 if(key==='urban')controls=`<label class="n-control"><span>Neighbourhood</span><select data-select="region">${['Dense centre','Residential','Outer district'].map((n,i)=>`<option value="${i}" ${params.region===i?'selected':''}>${n}</option>`).join('')}</select></label>`+slider('parking','Parking search · minutes',0,10,params.parking,.5);
 if(key==='case')controls=b('conflict','Introduce the conflicting report')+b('attempt','Attempt proposed action')+`<label class="n-control"><span>Review the date against the original</span><select data-case-date><option value="2026-05-12">12 May 2026</option><option value="2026-06-12">12 June 2026</option></select></label>`+b('review','Record human-reviewed date')+b('amend','Change the invoice')+b('export','Export provenance');
 if(key==='world'){
  const s=params.scene,o=s.objects.find(o=>o.id===(s.selected||'microscope-1'))||s.objects[2];controls=`<form class="n-compile-form"><label for="n-command">Change this same world</label><textarea id="n-command" maxlength="500" rows="2" placeholder="Move the microscope closer to the window."></textarea><div>${b('compile','Compile & apply')}${b('speak','Speak')}</div></form><div class="n-button-row">${b('plant','Add a plant')}${b('night','Change lighting')}${b('route','Route the agent')}</div><label class="n-control"><span>Inspect an object</span><select data-select="object">${s.objects.filter(o=>!['bench','window'].includes(o.type)).map(o=>`<option value="${o.id}" ${o.id===s.selected?'selected':''}>${esc(o.id)}</option>`).join('')}</select></label><div class="n-coordinate-row">${['x','y','z'].map(k=>`<label>${k}<input type="number" data-coordinate="${k}" aria-label="${k} coordinate" step="0.1" value="${o.position[k]}" ${k==='y'?'readonly':''}></label>`).join('')}</div><div class="n-button-row">${b('undo','Undo')}${b('redo','Redo')}${b('export','Export scene')}</div><small>Typed commands stay local. Optional speech may use the browser provider’s recognition service.</small>`;
 }
 host.innerHTML=`<div class="n-explorer-controls">${controls}${b('reset','Reset this example')}<p role="status">${esc(message)}</p></div>`;
 host.querySelectorAll('[data-parameter]').forEach(e=>e.addEventListener('input',()=>{params[e.dataset.parameter]=+e.value;if(key==='gain'&&e.dataset.parameter==='angle')params.angles[params.edge]=+e.value;e.closest('label').querySelector('output').value=e.value;emit();}));
 host.querySelectorAll('[data-select]').forEach(e=>e.addEventListener('change',()=>{const name=e.dataset.select;if(name==='object'){params.scene.selected=e.value;render();}else{params[name]=['edge','region','cycle','eigenmode'].includes(name)?+e.value:e.value;if(name==='edge')params.angle=params.angles[params.edge];if(name==='region')params.parking=[7,3,1][params.region];render();}emit();}));
 host.querySelectorAll('[data-memory]').forEach(e=>e.onclick=()=>{const i=+e.dataset.memory;params.selected=params.selected.includes(i)?params.selected.filter(x=>x!==i):params.selected.length<3?[...params.selected,i]:[...params.selected.slice(1),i];render();emit();});
 host.querySelectorAll('[data-rank]').forEach(e=>e.onclick=()=>{params.rank=+e.dataset.rank;render();emit();});host.querySelectorAll('[data-sign]').forEach(e=>e.onclick=()=>{params.signs[+e.dataset.sign]*=-1;params.removed=[];render();emit();});
 host.querySelectorAll('[data-coordinate]').forEach(e=>e.onchange=()=>{try{commit(move(params.scene,params.scene.selected||'microscope-1',{[e.dataset.coordinate]:+e.value}),'Coordinate edit');}catch(error){say(error.message);render();}});
 host.querySelectorAll('[data-explore]').forEach(e=>e.addEventListener('click',()=>action(e.dataset.explore)));
 const form=host.querySelector('form');form?.addEventListener('submit',e=>{e.preventDefault();action('compile');});
 if(focusSelector){const next=host.querySelector(focusSelector);if(next&&!next.disabled)next.focus({preventScroll:true});}
 if(key==='world'){host.querySelector('[data-explore="undo"]').disabled=!past.length;host.querySelector('[data-explore="redo"]').disabled=!future.length;host.querySelector('[data-explore="speak"]').disabled=!(window.SpeechRecognition||window.webkitSpeechRecognition);}
 }
 function action(id){
  if(id==='reset'){params=initial();past=[];future=[];message='The example is restored.';save();render();emit();return;}
  if(id==='repair'){const repair=state().repair;params.angles=repair.target.slice();params.angle=params.angles[params.edge];message=repair.ids.length?`Retuned ${repair.ids.length} edge${repair.ids.length===1?'':'s'}; other relationships were preserved.`:'The network is already balanced.';}
  if(id==='complete')params.selected=[0,2,3];
  if(id==='stable')params.stable=!params.stable;
  if(id==='oracle')params.replay=state().oracle;
  if(id==='remove')params.removed=state().repair;
  if(id==='pairs')params.paired=!params.paired;
  if(id==='redistribute'){params.paired=true;params.distributed=!params.distributed;}
  if(key==='case'){
   if(id==='conflict')params.state=caseAt(2);
   if(id==='attempt'||id==='amend')caseAction(params.state,id);
   if(id==='review'){const date=host.querySelector('[data-case-date]').value;params.state.review={date,authority:'human'};params.state.events.push(`Visitor reviewed ${date} against the original source.`);refreshCase(params.state);}
  }
  if(key==='world'){
   if(id==='compile'){command(host.querySelector('#n-command').value);return;}
   if(id==='plant'||id==='night'||id==='route'){command({plant:'Add a plant.',night:params.scene.lighting==='night'?'Make it daylight.':'Make it night.',route:'Send the agent to the microscope.'}[id]);return;}
   if(id==='undo'&&past.length){future.push(clone(params.scene));params.scene=past.pop();message='Previous scene restored.';save();}
   if(id==='redo'&&future.length){past.push(clone(params.scene));params.scene=future.pop();message='Scene edit restored.';save();}
   if(id==='speak'){const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Speech)return;if(speech){speech.abort();return;}speech=new Speech();speech.lang='en-US';speech.interimResults=false;speech.onresult=e=>{if(!disposed)command(e.results[0][0].transcript);};speech.onerror=e=>say(`Speech: ${e.error}. Typed commands still work.`);speech.onend=()=>{speech=null;};try{speech.start();say('Listening for one supported instruction.');}catch(e){say(e.message);}return;}
  }
  if(id==='export'){const data=key==='world'?params.scene:{kind:'synthetic demonstration',state:params.state};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=key==='world'?'persistent-laboratory.json':'case-provenance.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  render();emit();
 }
 render();return{parameters:()=>params,activate(){if(active)return;active=true;try{const text=sessionStorage.getItem('navish-explorer-4.2:'+key);if(text&&text.length<100000){const saved=JSON.parse(text);if(saved&&typeof saved==='object'&&(key!=='world'||valid(saved.scene))){const check=evaluateNarrative(key,1,{explore:saved});if(check.science){params=saved;message='Your exploration in this tab is restored.';render();}}}}catch{}if(key==='world')try{const saved=JSON.parse(localStorage.getItem(KEY));if(valid(saved)){params.scene=saved;message='Your saved sandbox is restored. The guided example remains separate.';render();}}catch{}},select(id){if(key==='gain'){params.edge=+id;params.angle=params.angles[params.edge];}if(key==='world')params.scene.selected=id;render();emit();},drag(id,p,done){if(key!=='world')return;try{if(done==='cancel'){emit();return;}const scene=move(params.scene,id,p);scene.selected=id;if(done)commit(scene,'Direct manipulation');else onChange(scene);}catch(e){say(e.message);emit();}},dispose(){disposed=true;speech?.abort();}};
}
