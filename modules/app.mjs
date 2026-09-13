import {byId} from './content.mjs';
import {home,detail,notFound,esc,play} from './render.mjs';
import {mountDemo} from './demos.mjs';
const main=document.querySelector('main');
let dispose=()=>{},onHome=true,homeY=0,lastWork=null,routeSequence=0;
try{homeY=Number(sessionStorage.getItem('timeline-y')||0);}catch{}
function rememberHome(){homeY=scrollY;try{sessionStorage.setItem('timeline-y',String(homeY));}catch{}}
document.addEventListener('click',e=>{
  const a=e.target.closest('a[href^="#"]');if(!a||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
  if(a.dataset.work){if(onHome){rememberHome();lastWork=a.dataset.work;}}
  if(a.hasAttribute('data-back')){e.preventDefault();if(location.hash==='#timeline')route();else location.hash='#timeline';}
});
window.addEventListener('pagehide',()=>{if(onHome)rememberHome();});
window.addEventListener('hashchange',()=>route());
async function route(initial=false){
  const seq=++routeSequence;dispose();dispose=()=>{};
  let hash;try{hash=decodeURIComponent(location.hash.slice(1));}catch{hash='work/invalid-link';}
  if(hash.startsWith('work/')){
    onHome=false;const id=hash.slice(5),w=byId[id];main.innerHTML=w?detail(w):notFound();document.title=w?`${w.title} — Navish Kumar`:'Work not found — Navish Kumar';window.scrollTo({top:0,behavior:'instant'});
    main.querySelector('h1')?.focus({preventScroll:true});if(!w)return;
    let timer=null,stage=0,demo=null;const root=main.querySelector('#demo-root'),playButton=main.querySelector('[data-play]'),copy=main.querySelector('.guide-copy');
    const stop=()=>{clearInterval(timer);timer=null;playButton.innerHTML=`${play}<span>Play explanation</span>`;playButton.setAttribute('aria-pressed','false');};
    const explore=(text)=>{stop();main.querySelectorAll('[data-stage]').forEach(b=>b.setAttribute('aria-current','false'));copy.innerHTML=`<strong>Explore the mechanism.</strong> ${esc(text||'Change a control and follow what actually changes below.')}`;};
    try{demo=await mountDemo(w,root,explore);}catch(err){root.innerHTML='<div class="lab-reading"><h3>The live explanation could not start.</h3><p>The research, evidence and timeline remain available below. Reload the page to retry.</p></div>';console.error(err);}
    if(seq!==routeSequence){demo?.dispose?.();return;}
    const activate=i=>{stage=i;main.querySelectorAll('[data-stage]').forEach((b,j)=>b.setAttribute('aria-current',j===i?'step':'false'));copy.innerHTML=`<strong>${esc(w.guide[i].title)}.</strong> ${esc(w.guide[i].text)}`;demo?.stage?.(i);};
    main.querySelectorAll('[data-stage]').forEach(b=>b.addEventListener('click',()=>{stop();activate(Number(b.dataset.stage));}));
    playButton.addEventListener('click',()=>{if(timer){stop();return;}activate(0);playButton.innerHTML='<span aria-hidden="true">Ⅱ</span><span>Pause explanation</span>';playButton.setAttribute('aria-pressed','true');timer=setInterval(()=>{if(stage<3)activate(stage+1);else stop();},6500);});
    main.querySelector('[data-reset]').addEventListener('click',()=>{stop();demo?.reset?.();activate(0);});
    dispose=()=>{stop();demo?.dispose?.();};
  }else{
    const wasHome=onHome;onHome=true;if(!initial||!main.querySelector('.timeline'))main.innerHTML=home();document.title='Navish Kumar — A body of work, in motion';
    requestAnimationFrame(()=>{if(seq!==routeSequence)return;if(hash==='contact'){document.querySelector('#contact')?.scrollIntoView();}else if(hash==='top'){window.scrollTo({top:0,behavior:'instant'});}else if(!initial&&!wasHome){window.scrollTo({top:homeY,behavior:'instant'});if(lastWork)main.querySelector(`[data-work="${lastWork}"]`)?.focus({preventScroll:true});}else if(hash && document.getElementById(hash)){document.getElementById(hash).scrollIntoView();}});
  }
}
route(true);
