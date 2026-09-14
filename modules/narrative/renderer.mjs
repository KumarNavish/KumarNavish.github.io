import {createStage,clear,metric,fmt} from './scene-kit.mjs?v=scroll-4.2.2';
import {stories} from './chapters.mjs?v=scroll-4.2.2';
import {gainScene,boundsScene} from './graph-scenes.mjs?v=scroll-4.2.2';
import {replayScene,rankScene,naturalScene} from './geometry-scenes.mjs?v=scroll-4.2.2';
import {timeScene,urbanScene,interactionScene} from './context-scenes.mjs?v=scroll-4.2.2';
import {caseScene} from './case-scene.mjs?v=scroll-4.2.2';
import {spatialScene} from './spatial-scene.mjs?v=scroll-4.2.2';
const palettes={gain:['#0b1d28',true],replay:['#eaf1e9',false],rank:['#151725',true],time:['#eee5d4',false],case:['#edf1f4',false],world:['#d6cec0',false],natural:['#122530',true],bounds:['#eee9df',false],urban:['#e5ecdf',false],interaction:['#ebeee7',false]};
const factories={gain:gainScene,bounds:boundsScene,replay:replayScene,rank:rankScene,time:timeScene,natural:naturalScene,world:spatialScene,urban:urbanScene,interaction:interactionScene};
export function createNarrativeRenderer(key,host,{onSelect=()=>{},onDrag=null,compact=false}={}){
 host.className='n-render-host '+stories[key].theme;let view=null,scene=null,disposed=false,free=false,touch=false,renderRevision=0;
 host.innerHTML='<div class="n-canvas-host world-viewport"></div><div class="n-scene-overlay"></div>';
 const canvasHost=host.firstElementChild,overlay=host.lastElementChild;
 if(key==='case'){canvasHost.classList.add('n-case-canvas');scene=caseScene(canvasHost);}
 else{const [background,dark]=palettes[key];try{view=createStage(canvasHost,{background,dark,camera:stories[key].cameras[0],target:stories[key].targets[0],floor:false,onPick:onSelect,onDrag});view.interactive(false);view.controls.enableDamping=false;view.setTick(null);view.pause(true);scene=factories[key](view,overlay);if(scene.picks)view.setPickables(scene.picks);}catch(e){canvasHost.innerHTML='<p class="n-graphics-fallback">3D is unavailable in this browser. The narrative and live calculations remain available below.</p>';host.dataset.graphics='unavailable';}}
 let touchButton=null;const gestures=()=>{if(!view)return;const mobile=innerWidth<=780,canvas=canvasHost.querySelector('canvas');canvas.style.setProperty('pointer-events',free&&(!mobile||touch)?'auto':'none','important');canvas.style.setProperty('touch-action',free&&mobile&&touch?'none':'pan-y','important');if(touchButton){touchButton.hidden=!mobile||!free;touchButton.textContent=touch?'Finish moving':'Move view';touchButton.setAttribute('aria-pressed',String(touch));}};if(view){touchButton=document.createElement('button');touchButton.type='button';touchButton.dataset.touchView='';touchButton.textContent='Move view';touchButton.onclick=()=>{touch=!touch;gestures();};canvasHost.querySelector('.camera-tools').prepend(touchButton);}window.addEventListener('resize',gestures);
 const fallback=document.createElement('div');fallback.className='n-fallback-reading';fallback.hidden=!!scene;overlay.append(fallback);
 return{render(f){if(disposed)return;host.dataset.frame=JSON.stringify({progress:f.progress,index:f.index,parameters:f.parameters,reveal:f.reveal,camera:f.camera,target:f.target});host.dataset.science=JSON.stringify(f.science);host.dataset.chapter=String(f.index);host.dataset.mode=f.exploring?'explore':'guide';
  if(scene)scene.render(f);else{fallback.innerHTML=textualFrame(f);}
  if(view){if(!f.exploring)view.seekCamera(f.camera,f.target);if(f.exploring!==free){free=f.exploring;touch=false;view.interactive(free);gestures();}
   // The scroll clock is the only clock: no queued or invisible scene animations.
   host.dataset.renderRevision=String(++renderRevision);view.setFrameToken(renderRevision);view.setTick(null);view.invalidate(true);
  }
 },setCamera(camera,target){view?.seekCamera(camera,target);},view,scene,dispose(){disposed=true;window.removeEventListener('resize',gestures);scene?.dispose();view?.dispose();host.replaceChildren();}};
}

function textualFrame(f){
 const s=f.science,r=f.reveal,show=(amount,html)=>amount>.01?html:'';
 switch(f.key){
 case 'gain':return metric('Closing angle',fmt(s.angles[f.visual.edge],0)+'°')+show(r.transport,metric('Inconsistent basis cycles',s.inconsistent))+show(r.spectrum,metric('Smallest eigenvalue',fmt(s.eigenvalues[0])))+show(r.certificate,metric('Minimum retunings · exact finite search',s.repair.ids.length));
 case 'replay':return metric('Earlier capability error',fmt(s.oldLoss))+show(r.current,metric('New-task loss',fmt(s.newLoss)))+show(r.oracle,metric('Full-history oracle',s.joint.map(v=>fmt(v,2)).join(', ')))+show(r.candidates,metric('Independent memory directions',s.directions))+show(r.residual,metric('Unavailable correction',fmt(s.unavailable)));
 case 'rank':return metric('Adapter rank',s.rank)+show(r.constraints,metric('Feasible repair',s.feasible?'Exists':'None'))+show(r.solution,metric('Minimum cost',s.cost===null?'—':fmt(s.cost)))+show(r.budget,metric('Allowed cost',fmt(s.budget)));
 case 'time':return metric('Period',s.month)+metric('Total observation budget',s.budget)+show(r.history,metric('Replay / current',`${s.replay} / ${s.newUpdates}`))+show(r.risk,metric('Expected current error',fmt(s.error,4))+metric('New-only error',fmt(s.noReplay,4)));
 case 'natural':return metric('Optimization steps',s.steps)+metric('Mean',s.m.map(x=>fmt(x,2)).join(', '))+show(r.surface,metric('Standard deviations',s.c.map(x=>fmt(x,2)).join(', ')))+show(r.loss,metric('KL divergence',fmt(s.kl)));
 case 'world':return r.sentence>.1?'<p class="n-fallback-sentence">Create a mountain laboratory at sunset.</p>'+show(r.semantics,metric('Supported concepts','Place · context · lighting')):r.structure>.1?metric('Persistent identities','microscope-1 · arm-1 · bench-1')+metric('Relations','Instruments on the workbench'):metric('World',s.created?'Materialized':'Placement anchors ready')+metric('Persistent objects',s.objects.length)+show(r.path,metric('Planned route steps',Math.max(0,s.path.length-1)))+show(r.edit,metric('Same microscope, new placement','Old route invalidated'));
 case 'bounds':return metric('Relationships',s.signs.map(v=>v>0?'+':'−').join(' '))+show(r.spectrum,metric('Smallest eigenvalue',fmt(s.minimum)))+show(r.certificate,metric('Spectral lower bound',s.lowerBound)+metric('Exact repair count',s.frustration));
 case 'urban':return metric('Van service time',fmt(s.shownVanTotal,1)+' min')+metric('Bike service time',fmt(s.shownBikeTotal,1)+' min');
 case 'interaction':return metric('Messages',s.messages)+show(r.pairs,metric('Recipient counts',s.paired?s.recipientCounts.join(' / '):'Hidden')+metric('Recipients reached',s.paired?s.distinctRecipients:'Hidden'));
 default:return '';
 }
}
