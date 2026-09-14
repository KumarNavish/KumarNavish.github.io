import {byId} from './content.mjs?v=worlds-3';
import {home,detail,notFound} from './render.mjs?v=worlds-3';
import {mountTimelineScenes} from './timeline-scenes.mjs?v=studio-2';
const main=document.querySelector('main');
let dispose=()=>{},onHome=true,homeY=0,lastWork=null,routeSequence=0;
try{homeY=Number(sessionStorage.getItem('timeline-y')||0);}catch{}
function rememberHome(){homeY=scrollY;try{sessionStorage.setItem('timeline-y',String(homeY));}catch{}}
document.addEventListener('click',e=>{const a=e.target.closest('a[href^="#"]');if(!a||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;if(a.dataset.work&&onHome){rememberHome();lastWork=a.dataset.work;}if(a.hasAttribute('data-back')){e.preventDefault();if(location.hash==='#timeline')route();else location.hash='#timeline';}});
window.addEventListener('pagehide',()=>{if(onHome)rememberHome();});
window.addEventListener('hashchange',()=>route());
async function route(initial=false){
 const seq=++routeSequence;dispose();dispose=()=>{};
 let hash;try{hash=decodeURIComponent(location.hash.slice(1));}catch{hash='work/invalid-link';}
 if(hash.startsWith('work/')){
  onHome=false;const w=byId[hash.slice(5)];main.innerHTML=w?detail(w):notFound();document.title=w?`${w.title} — Navish Kumar`:'Work not found — Navish Kumar';document.body.dataset.work=w?.id||'';window.scrollTo({top:0,behavior:'instant'});main.querySelector('h1')?.focus({preventScroll:true});if(!w)return;
  const experience=main.querySelector('.experience');experience.classList.add('living-experience');experience.innerHTML='<div id="demo-root" class="demo-root"><p class="world-loading" role="status">Opening the scientific world…</p></div>';const root=experience.firstElementChild;
  try{const{mountLivingWorld}=await import('./worlds/index.mjs?v=worlds-3');if(seq!==routeSequence)return;const demo=mountLivingWorld(w,root);dispose=()=>demo.dispose();}catch(err){root.innerHTML='<div class="world-load-error"><h2>The interactive world could not load.</h2><p>The contribution, evidence and original sources remain readable below. Reload to retry.</p></div>';console.error(err);}
 }else{
  const wasHome=onHome;onHome=true;document.body.dataset.work='';if(!initial||!main.querySelector('.timeline'))main.innerHTML=home();document.title='Navish Kumar — A body of work, in motion';dispose=mountTimelineScenes(main);
  requestAnimationFrame(()=>{if(seq!==routeSequence)return;if(hash==='contact')document.querySelector('#contact')?.scrollIntoView();else if(hash==='top')window.scrollTo({top:0,behavior:'instant'});else if(!initial&&!wasHome){window.scrollTo({top:homeY,behavior:'instant'});if(lastWork)main.querySelector(`[data-work="${lastWork}"]`)?.focus({preventScroll:true});}else if(hash&&document.getElementById(hash))document.getElementById(hash).scrollIntoView();});
 }
}
route(true);
