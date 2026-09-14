import {byId} from './content.mjs?v=scroll-4.1';
import {home,detail,notFound} from './render.mjs?v=scroll-4.1';
const main=document.querySelector('main');let dispose=()=>{},onHome=true,homeY=0,lastWork=null,sequence=0,currentRoute='';
try{homeY=Number(sessionStorage.getItem('timeline-y')||0);history.scrollRestoration='manual';}catch{}
function remember(){homeY=scrollY;try{sessionStorage.setItem('timeline-y',String(homeY));}catch{}}
document.addEventListener('click',e=>{const a=e.target.closest('a[href^="#"]');if(!a||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;if(a.dataset.work&&onHome){remember();lastWork=a.dataset.work;}if(a.hasAttribute('data-back')){e.preventDefault();location.hash='#timeline';}});
window.addEventListener('pagehide',()=>{if(onHome)remember();});window.addEventListener('hashchange',()=>route());
async function route(initial=false){
 const seq=++sequence;let hash;try{hash=decodeURIComponent(location.hash.slice(1));}catch{hash='work/invalid';}
 if(!hash.startsWith('work/')&&onHome&&currentRoute==='home'&&!initial){document.getElementById(hash||'top')?.scrollIntoView();return;}
 dispose();dispose=()=>{};
 if(hash.startsWith('work/')){
  onHome=false;const parts=hash.split('/'),w=byId[parts[1]],at=parts[2]==='at'&&Number.isFinite(+parts[3])?Math.max(0,Math.min(1,+parts[3])):null,chapter=parts[2]==='chapter'&&Number.isFinite(+parts[3])?Math.max(0,+parts[3]-1):null;
  main.innerHTML=w?detail(w):notFound();document.body.dataset.work=w?.id||'';document.title=w?`${w.title} — Navish Kumar`:'Work not found — Navish Kumar';window.scrollTo({top:0,behavior:'instant'});main.querySelector('h1')?.focus({preventScroll:true});currentRoute=w?.id||'invalid';if(!w)return;
  const experience=main.querySelector('.experience');experience.className='experience scroll-experience';experience.innerHTML='<div id="demo-root"><p class="world-loading" role="status">Opening the explanation…</p></div>';
  try{const {mountScrollNarrative}=await import('./narrative/director.mjs?v=scroll-4.1');if(seq!==sequence)return;const n=mountScrollNarrative(w,experience.firstElementChild,{at,chapter});dispose=()=>n.dispose();}catch(error){experience.innerHTML='<p class="world-load-error">The interactive explanation could not load. The original sources and contribution remain available below.</p>';console.error(error);}
 }else{
  const wasHome=onHome;onHome=true;document.body.dataset.work='';if(!initial||!main.querySelector('.journey'))main.innerHTML=home();document.title='Navish Kumar — A body of work, in motion';currentRoute='home';
  try{const{mountJourney}=await import('./narrative/journey.mjs?v=scroll-4.1');if(seq!==sequence)return;dispose=mountJourney(main);}catch(error){console.error(error);}
  requestAnimationFrame(()=>{if(seq!==sequence)return;if(!initial&&!wasHome&&hash==='timeline'){window.scrollTo({top:homeY,behavior:'instant'});if(lastWork)main.querySelector(`[data-work="${lastWork}"]`)?.focus({preventScroll:true});}else if(hash)document.getElementById(hash)?.scrollIntoView();});
 }
}
route(true);
