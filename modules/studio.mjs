import {createStudio} from './studio-engine.mjs?v=studio-2';
import {buildScene,sceneCameras} from './project-scenes.mjs?v=studio-2';
/** Guidance is selected from the live calculation; it is not a model response. */
export function sceneAdvice(type,s){
 switch(type){
 case'gain':return s.balanced?{text:'All three instructions can agree. Change the closing relationship.',action:'Introduce a contradiction',target:'gain-break'}:{text:`One changed edge moved the smallest eigenvalue to ${s.eigenvalues[0].toFixed(3)}.`,action:'Repair the closing edge',target:'repair'};
 case'bounds':return s.frustration?{text:`At least ${s.lowerBound} edge must change; enumeration finds ${s.frustration}.`,action:'Apply a minimum repair',target:'repair'}:{text:'A consistent assignment exists. Try making one relationship disagree.',action:'Flip a relationship',target:'edge-0'};
 case'interaction':return !s.paired?{text:'The aggregate cannot tell you who is actually being reached.',action:'Reveal the people',target:'pairs'}:{text:s.distributed?'Same count. A different pattern of contact.':'Most replies reach one person; the group total hides this.',action:'Redistribute the replies',target:'pattern'};
 case'urban':return {text:s.vanTotal>s.bikeTotal?'Stop overhead reverses the comparison. This is not just a speed contest.':'A faster journey is only part of the delivery.',action:(s.parking||0)<4?'Add parking search':'Remove parking search',target:'parking'};
 case'natural':return {text:s.steps<20?'The distribution must learn its location and its uncertainty together.':'This is the computed Gaussian update, not an animated promise of convergence.',action:s.steps<20?'Run 20 actual steps':'Return to the starting estimate',target:'iterations'};
 case'replay':return s.phase==='old'?{text:'One set of parameters serves both earlier capabilities.',action:'Learn the new task',target:'new'}:s.phase==='new'?{text:'The new task is fitted. Both earlier predictions have moved off target.',action:'Replay one memory',target:'replay'}:s.missing>0?{text:`These memories cannot supply ${s.missing.toFixed(3)} of the desired correction.`,action:'Include the missing memory',target:'memories'}:{text:'Both correction directions are available. The new-task cost remains real.',action:'Remove one memory',target:'memories'};
 case'rank':return !s.expressible?{text:'More optimizer steps cannot create a direction the adapter cannot express.',action:'Unlock one more direction',target:'rank'}:!s.affordable?{text:'The repair is expressible, but it exceeds the current-task cost budget.',action:'Test a larger cost budget',target:'budget'}:{text:'Expressible and affordable are two separate conditions. Both hold here.',action:'Restrict the adapter again',target:'rank'};
 case'time':return {text:s.benefit>=0?'Here, old observations remove more noise than the bias they add.':'The historical data did not change. Its relevance to the present did.',action:s.benefit>=0?'Advance into a changing world':'Use the toy-optimal mixture',target:s.benefit>=0?'advance':'oracle'};
 case'case':return !s.parsed?{text:'The original is evidence. An interpretation is a separate record.',action:'Read the interpretation',target:'interpret'}:!s.nodes.gate.value?{text:s.review?.authority==='human'?'A changed invoice needs its own review; the date correction cannot authorize it.':'A plausible proposal cannot resolve its own contradiction.',action:s.review?.authority==='human'?'Try the blocked action':'Record the reviewed date',target:s.review?.authority==='human'?'attempt':'correct'}:{text:'Date and coverage were replayed. The independent invoice check was retained.',action:'Challenge the invoice',target:'amend'};
 default:return {text:'Change a control to inspect its consequence.',action:'Reset',target:'reset'};
 }
}
export function mountProjectScene(work,root){
 const host=root.querySelector('.lab-visual');if(!host)return{dispose(){}};
 const holder=document.createElement('div');holder.className='scene-host';
 holder.innerHTML='<div class="scene-stage"><canvas tabindex="0" aria-label="Interactive three-dimensional explanation. Drag to orbit; arrow keys rotate; plus and minus zoom."></canvas><div class="scene-labels" aria-hidden="true"></div><div class="scene-view-tag">3D / live calculation</div><div class="scene-orbit-hint">Drag to orbit · Select an object</div></div><div class="scene-navigation"><div><button type="button" data-camera="left" aria-label="Rotate scene left">↶</button><button type="button" data-camera="right" aria-label="Rotate scene right">↷</button><button type="button" data-camera="reset">Reset view</button></div><div><button type="button" data-camera="motion" aria-pressed="false">Animate flow</button><button type="button" data-camera="expand" aria-expanded="false">Expand view</button></div></div><div class="scene-insight"><p data-advice></p><button type="button" data-next></button></div>';
 host.append(holder);const canvas=holder.querySelector('canvas'),layer=holder.querySelector('.scene-labels'),motion=holder.querySelector('[data-camera="motion"]');let view,state,disposed=false,frame=0,visible=true,animate=false,lastFrame=0,lastMesh=null,transition=0;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const input=(id,value,event='input')=>{const el=root.querySelector('#'+id);if(el){if(el.type==='checkbox')el.checked=!!value;else el.value=value;el.dispatchEvent(new Event(event,{bubbles:true}));}};
 const action=id=>root.querySelector(`[data-action="${id}"]`)?.click();
 function apply(id){
  if(id.startsWith('edge-')){if(work.mechanism==='gain')input('angle',state.balanced?120:0);else action(id);}
  else if(id.startsWith('region-'))input('region',+id.slice(7),'change');
  else if(id.startsWith('month-'))input('month',+id.slice(6));
  else if(id.startsWith('memory-')){const i=+id.slice(7);input('memory-'+(i?'b':'a'),!state.memories[i],'change');}
  else if(id==='gain-break')input('angle',120);
  else if(id==='memories')input('memory-b',!state.memories[1],'change');
  else if(id==='parking')input('parking',state.parking<4?7:0);
  else if(id==='iterations')input('iterations',state.steps<20?20:0);
  else if(id==='rank')input('rank',state.rank===3?1:state.rank+1);
  else if(id==='budget')input('budget',.6);
  else if(id==='advance'){input('stable',false,'change');input('month',10);}
  else if(id==='pattern')action('pattern');
  else action(id);
 }
 try{view=createStudio(canvas,layer,{camera:sceneCameras[work.mechanism],onPick:apply});host.classList.add('has-scene');}
 catch(e){holder.remove();host.classList.add('scene-unavailable');const notice=document.createElement('p');notice.className='scene-error';notice.textContent=e.message;host.append(notice);return{dispose(){}};}
 function draw(now=performance.now()){if(disposed||!state)return;const mesh=buildScene(work.mechanism,state,animate?now/1000:0);view.set(mesh);lastMesh=mesh;}
 function loop(now){if(disposed)return;if(animate&&visible&&!document.hidden&&now-lastFrame>(view.mode==='webgl'?50:240)){draw(now);lastFrame=now;}frame=requestAnimationFrame(loop);}
 function sync(){if(disposed)return;try{state=JSON.parse(root.dataset.state);const advice=sceneAdvice(work.mechanism,state);holder.querySelector('[data-advice]').textContent=advice.text;const next=holder.querySelector('[data-next]');next.textContent=advice.action+' →';next.dataset.target=advice.target;draw();holder.dataset.ready='true';}catch(e){console.error('Scene update',e);}}
 const motionTypes=['gain','bounds','interaction','urban','replay','time','case'];if(!motionTypes.includes(work.mechanism))motion.hidden=true;
 const observer=new MutationObserver(sync);observer.observe(root,{attributes:true,attributeFilter:['data-state']});
 const io=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;});io.observe(canvas);
 holder.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-next'))apply(b.dataset.target);if(b.dataset.camera==='left')view.orbit(-.3);if(b.dataset.camera==='right')view.orbit(.3);if(b.dataset.camera==='reset')view.reset();if(b.dataset.camera==='motion'){animate=!animate;motion.textContent=animate?'Pause flow':'Animate flow';motion.setAttribute('aria-pressed',String(animate));if(!animate)draw();}if(b.dataset.camera==='expand'){holder.classList.toggle('expanded');b.setAttribute('aria-expanded',String(holder.classList.contains('expanded')));b.textContent=holder.classList.contains('expanded')?'Compact view':'Expand view';}});
 sync();if(view.mode==='webgl'&&!reduced.matches&&motionTypes.includes(work.mechanism)){animate=true;motion.textContent='Pause flow';motion.setAttribute('aria-pressed','true');}frame=requestAnimationFrame(loop);
 return {dispose(){disposed=true;observer.disconnect();io.disconnect();cancelAnimationFrame(frame);cancelAnimationFrame(transition);view.dispose();}};
}
