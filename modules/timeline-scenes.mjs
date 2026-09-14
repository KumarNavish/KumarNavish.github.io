import {works} from './content.mjs?v=scroll-4.2.1';
import {createStudio} from './studio-engine.mjs?v=scroll-4.2.1';
import {buildScene,sceneCameras} from './project-scenes.mjs?v=scroll-4.2.1';
import {gainTriangle,signedGraph,interactionExample,urbanExample,posteriorExample,replayExample,rankExample,timeExample,newCase,caseAction} from './mechanisms.mjs?v=scroll-4.2.1';
import {createLaboratory} from './world-model.mjs?v=scroll-4.2.1';
/** Thumbnails are rasterized from the same state-driven geometry as the project.
 * Each temporary graphics context is released after copying its finished frame. */
function example(type){switch(type){case'gain':return gainTriangle(120);case'bounds':return{...signedGraph([-1,1,1,1,1,1]),signs:[-1,1,1,1,1,1],removed:[]};case'interaction':return{...interactionExample(),paired:true,distributed:false};case'urban':return{...urbanExample(0,7),region:0};case'natural':return posteriorExample(12);case'replay':return{...replayExample('replay',[true,false]),phase:'replay',memories:[true,false]};case'rank':return rankExample(2);case'time':return timeExample(9);case'case':return caseAction(newCase(),'interpret');case'world':return{...createLaboratory(),selected:'microscope-1'};}}
export function mountTimelineScenes(main){let disposed=false;const queue=[],pending=new Set(),done=new Set();let running=false;
 function pump(){if(running||disposed||!queue.length)return;running=true;const link=queue.shift(),work=works.find(w=>w.id===link.dataset.work);const task=()=>{if(disposed){running=false;return;}try{const host=link.querySelector('.work-scene-preview'),canvas=host.querySelector('canvas');const renderer=createStudio(canvas,null,{camera:sceneCameras[work.mechanism]});renderer.set(buildScene(work.mechanism,example(work.mechanism),0));const copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;copy.getContext('2d').drawImage(canvas,0,0);renderer.dispose();canvas.replaceWith(copy);host.dataset.rendered='true';done.add(link);}catch{}running=false;pump();};const id=setTimeout(task,25);pending.add(id);}
 const links=[...main.querySelectorAll('.work-row')];links.forEach(a=>{const host=document.createElement('div');host.className='work-scene-preview';host.setAttribute('aria-hidden','true');host.append(document.createElement('canvas'));a.prepend(host);});links.sort((a,b)=>a.getBoundingClientRect().top-b.getBoundingClientRect().top);queue.push(...links);pump();
 return()=>{disposed=true;pending.forEach(clearTimeout);queue.length=0;};
}
