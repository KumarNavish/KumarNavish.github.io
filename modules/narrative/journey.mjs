import {works} from '../content.mjs';
import {stories} from './chapters.mjs';
import {evaluateNarrative} from './model.mjs';
import {createNarrativeRenderer} from './renderer.mjs';
/** One living field, not ten live graphics contexts and not rasterized snapshots. */
export function mountJourney(main){
 const field=main.querySelector('.journey-field');if(!field)return()=>{};const host=field.querySelector('.journey-render'),rows=[...main.querySelectorAll('.journey-row')],mql=matchMedia('(prefers-reduced-motion: reduce)');let active=null,renderer=null,raf=0,disposed=false,last=-1,forced=null;
 function draw(){raf=0;if(disposed)return;const zone=innerWidth<=780?innerHeight*.79:innerHeight*.5;let best=null,distance=Infinity;
  rows.forEach(row=>{const r=row.getBoundingClientRect(),d=Math.abs(r.top+r.height*.45-zone);if(d<distance){distance=d;best=row;}});if(forced){best=forced;forced=null;}if(!best)return;
  const rect=best.getBoundingClientRect(),work=works.find(w=>w.id===best.dataset.work),local=Math.max(0,Math.min(1,(zone-rect.top)/Math.max(1,rect.height)));
  const ranges={world:[.30,1],rank:[.2,.85],gain:[0,.82],replay:[0,.82],time:[.1,.92]},range=ranges[work.mechanism]||[0,1],p=Math.round((range[0]+(range[1]-range[0])*local)*1e5)/1e5;
  if(active!==work.id){renderer?.dispose();renderer=createNarrativeRenderer(work.mechanism,host,{compact:true});active=work.id;field.className='journey-field world-exhibit '+stories[work.mechanism].theme;field.dataset.activeWork=active;field.querySelector('[data-preview-status]').textContent=`${work.year} · ${work.status}`;field.querySelector('[data-preview-contribution]').textContent=work.contribution;const link=field.querySelector('[data-preview-link]');link.href='#work/'+work.id;link.dataset.work=work.id;rows.forEach(r=>r.setAttribute('aria-current',r===best?'true':'false'));last=-1;}
  if(last===p)return;last=p;const f=evaluateNarrative(work.mechanism,p,{reduced:mql.matches});renderer.render(f);field.querySelector('[data-preview-cue]').textContent=f.chapter.cue;field.dataset.progress=String(p);field.dataset.science=JSON.stringify(f.science);
 }
 function queue(){if(!disposed&&!raf)raf=requestAnimationFrame(draw);}const focus=e=>{const row=e.target.closest('.journey-row');if(row){forced=row;queue();}};
 window.addEventListener('scroll',queue,{passive:true});window.addEventListener('resize',queue);main.addEventListener('focusin',focus);mql.addEventListener('change',queue);queue();
 return()=>{disposed=true;cancelAnimationFrame(raf);renderer?.dispose();window.removeEventListener('scroll',queue);window.removeEventListener('resize',queue);main.removeEventListener('focusin',focus);mql.removeEventListener('change',queue);};
}
