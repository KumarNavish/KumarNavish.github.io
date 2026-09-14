import {esc} from '../render.mjs?v=scroll-4.2';
import {createStage} from './stage.mjs?v=scroll-4.2';
export {esc};
export const fmt=(n,d=3)=>Number(n).toFixed(d);
export const btn=(id,text,cls='')=>`<button type="button" data-act="${id}" class="${cls}">${text}</button>`;
export const slider=(id,label,min,max,value,step=1,unit='')=>`<label class="w-slider"><span>${label}<output data-out="${id}">${value}${unit}</output></span><input aria-label="${label}" data-input="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
export const stat=(label,value,unit='',cls='')=>`<div class="w-stat ${cls}"><span>${label}</span><strong>${value}<small>${unit}</small></strong></div>`;
const chapters={
 observatory:['Local agreement','Introduce a conflict','Follow a whole cycle','Repair the network'],
 structure:['Consistent signs','Conflicting signs','Measure the damage','Remove a minimum repair'],
 'replay-world':['Earlier skills','Learn something new','A redundant memory','Supply the missing directions'],
 'rank-world':['A line cannot repair it','A plane is still too small','A repair becomes possible','Check what it costs'],
 'time-world':['Useful history','The present changes','The archive turns stale','Spend the budget differently'],
 'case-world':['Read the source','Inspect the interpretation','Witness the refusal','Correct and replay'],
 'spatial-world':['Create a world','Edit the same object','Inspect what changed','Act within the world'],
 'posterior-world':['An uncertain belief','Take one update','Follow 20 actual steps','Fit the distribution'],
 'urban-world':['Travel alone','The cost of stopping','Change the neighbourhood','Compare the whole delivery'],
 'conversation-world':['See the total','Reveal who replies','Redistribute the same count','Read the relationships']
};
export function exhibit(root,{theme='light',title,intro,controls='',panel='',math='',boundary='',noCanvas=false}){
 const labels=chapters[theme]||['Begin','Change','Inspect','Compare'];
 root.innerHTML=`<div class="world-exhibit ${theme}"><header class="w-head"><div><h2>${title}</h2><p>${intro}</p></div><div class="w-playback">${btn('play','Play the explanation','primary')}${btn('reset','Reset')}</div></header><nav class="w-chapters" aria-label="Guided explanation">${labels.map((text,i)=>`<button type="button" data-chapter="${i}" aria-current="${i===0?'step':'false'}"><span>${i+1}</span>${text}</button>`).join('')}</nav><div class="w-body ${noCanvas?'no-canvas':''}">${noCanvas?'':'<div class="world-viewport"></div>'}<aside class="w-panel">${panel}</aside></div><div class="w-controls">${controls}</div><div class="w-story" aria-live="polite"><div><h3 data-headline></h3><p data-description></p></div>${btn('next','Make a change','primary')}</div><details class="w-math"><summary>Inside the calculation · what this example does and does not show</summary><div>${math}<p>${boundary}</p></div></details></div>`;
 const outer=root.firstElementChild,read=root.querySelector('.w-panel'),c=root.querySelector('.w-controls');let stage=null,timer=null,index=0,sequence=null;
 function stop(){clearInterval(timer);timer=null;const b=root.querySelector('[data-act="play"]');b.textContent='Play the explanation';b.setAttribute('aria-pressed','false');}
 function activate(i){index=i;root.querySelectorAll('[data-chapter]').forEach((b,j)=>b.setAttribute('aria-current',j===i?'step':'false'));sequence?.(i);}
 function explore(){stop();root.querySelectorAll('[data-chapter]').forEach(b=>b.setAttribute('aria-current','false'));}
 root.addEventListener('input',explore);root.addEventListener('change',explore);
 root.querySelector('[data-act="play"]').addEventListener('click',()=>{if(timer){stop();return;}if(!sequence)return;activate(0);const b=root.querySelector('[data-act="play"]');b.textContent='Pause explanation';b.setAttribute('aria-pressed','true');timer=setInterval(()=>{if(index===3){stop();return;}activate(index+1);},5200);});
 root.querySelectorAll('[data-chapter]').forEach(b=>b.addEventListener('click',()=>{stop();activate(+b.dataset.chapter);}));
 return {root,outer,read,controls:c,stop,sequence:f=>{sequence=f;},stage(options={}){
   try{stage=createStage(root.querySelector('.world-viewport'),options);}catch(e){const host=root.querySelector('.world-viewport');host.classList.add('render-unavailable');host.innerHTML=`<div class="render-message"><h3>The live calculations are ready.</h3><p>${esc(e.message)}</p></div>`;root.dataset.renderFallback='reading';}return stage;
  },story(title,text,next){root.querySelector('[data-headline]').textContent=title;root.querySelector('[data-description]').textContent=text;const b=root.querySelector('[data-act="next"]');b.textContent=next||'Try another change';b.hidden=next===null;},
  state(s){root.dataset.state=JSON.stringify(s);},set(id,value,unit=''){const e=root.querySelector(`[data-input="${id}"]`);if(e)e.value=value;const o=root.querySelector(`[data-out="${id}"]`);if(o)o.value=value+unit;},
  on(id,fn){root.querySelectorAll(`[data-act="${id}"]`).forEach(b=>b.addEventListener('click',()=>{explore();fn();}));},
  input(id,fn){root.querySelector(`[data-input="${id}"]`).addEventListener('input',e=>fn(+e.target.value));},dispose(){stop();stage?.dispose();}
 };
}
