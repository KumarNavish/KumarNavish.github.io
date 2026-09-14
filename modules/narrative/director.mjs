import {positionAtProgress} from './inspection.mjs?v=scroll-4.2';
import {stories} from './chapters.mjs?v=scroll-4.2';
import {evaluateNarrative,progressFromAnchors} from './model.mjs?v=scroll-4.2';
import {createNarrativeRenderer} from './renderer.mjs?v=scroll-4.2';
import {createExplorer} from './explore.mjs?v=scroll-4.2';
import {esc} from '../render.mjs?v=scroll-4.2';
/** One scroll input, one pure frame. Navigation and autoplay move the page, never mutate a chapter. */
export function mountScrollNarrative(work,root,{at=null,chapter=null,startExploring=false}={}){
 const key=work.mechanism,story=stories[key],count=story.chapters.length;
 root.className='scroll-narrative';root.innerHTML=`<div class="n-intro"><p>Scroll to follow the idea. Scroll back to retrace it.</p><button data-auto type="button" aria-pressed="false">Auto-tour</button></div><div class="n-story-layout"><div class="n-stage world-exhibit ${story.theme}" tabindex="0" role="region" aria-label="${esc(work.title)} scientific narrative"><div class="n-stage-top"><span data-chapter-count>1 / ${count}</span><div><button data-prev type="button" aria-label="Previous chapter">←</button><button data-next type="button" aria-label="Next chapter">→</button><button data-skip type="button">Explore</button></div><i class="n-progress-line"></i></div><div class="n-stage-render"></div><div class="n-stage-caption"><p data-cue></p><span data-classification></span></div></div><div class="n-prose">${story.chapters.map((c,i)=>`<article class="n-chapter" data-chapter="${i}" id="${work.id}-chapter-${i+1}"><div><span class="n-step">${String(i+1).padStart(2,'0')}</span><h2>${esc(c.title)}</h2><p>${esc(c.body)}</p></div></article>`).join('')}<article class="n-explore-chapter"><div><span class="n-step">Your turn</span><h2>Now try it yourself.</h2><p>The same scientific object is now an instrument. Change its inputs. Scrolling back restores the guided argument without discarding your sandbox.</p><div class="n-explorer" inert></div><button type="button" data-restart class="n-restart">Return to the beginning ↑</button></div></article></div></div><p class="n-accessible-status" role="status" aria-live="polite"></p>`;
 const layout=root.querySelector('.n-story-layout'),stage=root.querySelector('.n-stage'),host=root.querySelector('.n-stage-render'),articles=[...root.querySelectorAll('.n-chapter')],exploreArticle=root.querySelector('.n-explore-chapter'),exploreHost=root.querySelector('.n-explorer'),mql=matchMedia('(prefers-reduced-motion: reduce)');
 let anchors=[],exploreAt=Infinity,raf=0,disposed=false,mode='guide',progress=0,lastProgress=-1,lastMode='',lastIndex=-1,autoFrame=0,autoStart=0,autoFrom=0,autoTo=0,force=false,preview=null,initializing=true,lastScrollY=scrollY,ownedHash=location.hash,layoutWidth=innerWidth,layoutHeight=innerHeight;
 // An incoming hash is a new navigation intent, even when it names the same work.
 // The old scene must not rewrite that intent while its hashchange event is queued.
 const ownsRoute=()=>!disposed&&root.isConnected&&location.hash===ownedHash;
 const explorer=createExplorer(key,exploreHost,scene=>{preview=scene||null;force=true;queue();});
 const renderer=createNarrativeRenderer(key,host,{onSelect:id=>{if(mode==='explore')explorer.select(id);},onDrag:(id,p,done)=>{if(mode==='explore')explorer.drag(id,p,done);}});
 function readLayout(){
  const y=scrollY,mobile=innerWidth<=780,z=innerHeight*.49;
  const readTop=(parseFloat(getComputedStyle(stage).top)||65)+stage.getBoundingClientRect().height+28;
  const points=mobile?articles.map(e=>e.querySelector('h2').getBoundingClientRect().top+y-readTop):articles.map(e=>e.getBoundingClientRect().top+y+e.clientHeight*.44-z);
  const end=mobile?exploreArticle.querySelector('h2').getBoundingClientRect().top+y-readTop:exploreArticle.getBoundingClientRect().top+y+60-z;
  points[0]=Math.max(points[0],layout.getBoundingClientRect().top+y-(mobile?65:98));
  return {points,end};
 }
 function measure(){
  if(!ownsRoute())return;
  // Responsive CSS can settle in several ResizeObserver passes. Pin the last rendered
  // reader state on every layout change, not just the initial window resize event.
  const before=anchors,oldExplore=exploreAt;
  const inStory=before.length&&lastProgress>=0&&lastScrollY>=before[0]-2&&lastScrollY<=oldExplore+exploreArticle.clientHeight;
  // A ResizeObserver callback can arrive after a new scroll but before its frame.
  // Preserve that newer input, not the obsolete rendered chapter. A real viewport
  // resize is different: its browser-induced scroll must retain the reader's p.
  const viewportChanged=layoutWidth!==innerWidth||layoutHeight!==innerHeight;
  const pendingScroll=before.length&&!viewportChanged&&Math.abs(scrollY-lastScrollY)>.5;
  const savedProgress=pendingScroll?progressFromAnchors(scrollY,before):lastProgress;
  const savedMode=pendingScroll?(scrollY>=oldExplore?'explore':'guide'):lastMode;
  const offset=(pendingScroll?scrollY:lastScrollY)-oldExplore;
  const measured=readLayout();anchors=measured.points;exploreAt=measured.end;
  const changed=before.length===anchors.length&&(anchors.some((v,i)=>Math.abs(v-before[i])>.5)||Math.abs(exploreAt-oldExplore)>.5);
  if(inStory&&changed){
   window.scrollTo({top:savedMode==='explore'?exploreAt+Math.max(4,offset):positionAtProgress(savedProgress,anchors),behavior:'instant'});
   // Further observer deliveries in this layout transaction inherit the same
   // reconciled position, even if the frame has not painted yet.
   lastProgress=savedProgress;lastMode=savedMode;lastScrollY=scrollY;
  }
  layoutWidth=innerWidth;layoutHeight=innerHeight;
  root.dataset.anchors=JSON.stringify(anchors);root.dataset.exploreAt=String(exploreAt);force=true;queue();
 }
 function frame(){raf=0;if(initializing||!ownsRoute()||anchors.length!==count)return;
  // Some engines deliver the scroll caused by resize before the resize event itself.
  // Reconcile layout before interpreting that scroll against the previous anchors.
  const geometry=readLayout();
  if(layoutWidth!==innerWidth||layoutHeight!==innerHeight||geometry.points.some((v,i)=>Math.abs(v-anchors[i])>.5)||Math.abs(geometry.end-exploreAt)>.5)measure();
  progress=Math.round(progressFromAnchors(scrollY,anchors)*1e6)/1e6;mode=scrollY>=exploreAt?'explore':'guide';if(progress===lastProgress&&mode===lastMode&&!force)return;force=false;
  if(mode==='explore')explorer.activate();const params=mode==='explore'?explorer.parameters():null;const f=evaluateNarrative(key,progress,{reduced:mql.matches,explore:preview&&params?{...params,scene:preview}:params});preview=null;
  const renderedMode=root.dataset.mode;root.dataset.progress=String(progress);root.dataset.mode=mode;root.dataset.state=JSON.stringify(f.science);root.dataset.narrative=JSON.stringify({key,progress:f.progress,index:f.index,local:f.local,reveal:f.reveal,camera:f.camera,cameraIntent:f.chapter.cameraIntent,attention:f.chapter.attention,parameters:f.parameters});
  stage.dataset.mode=mode;exploreHost.inert=mode!=='explore';exploreHost.classList.toggle('unlocked',mode==='explore');
  if(mode!==renderedMode&&mode==='explore')renderer.setCamera(story.cameras.at(-1),story.targets.at(-1));renderer.render(f);
  articles.forEach((a,i)=>a.setAttribute('aria-current',mode==='guide'&&i===f.index?'step':'false'));root.querySelector('[data-chapter-count]').textContent=mode==='explore'?'Explore':`${f.index+1} / ${count}`;root.querySelector('.n-progress-line').style.transform=`scaleX(${progress})`;
  root.querySelector('[data-cue]').textContent=mode==='explore'?'Change a control. The same computation responds.':mql.matches?`${f.index===0?'Before':'After'} — ${f.chapter.cue}`:f.chapter.cue;root.querySelector('[data-classification]').textContent=f.classification;
  root.querySelector('[data-prev]').disabled=progress===0&&mode==='guide';root.querySelector('[data-next]').disabled=mode==='explore';
  if(lastIndex!==f.index||renderedMode!==mode){root.querySelector('.n-accessible-status').textContent=mode==='explore'?'Explorer unlocked.':`Chapter ${f.index+1}: ${f.chapter.title}`;lastIndex=f.index;}
  // A copied URL, reload or new tab can reconstruct this exact guided progress.
  if(ownsRoute())try{const nextHash=mode==='explore'?`#work/${work.id}/explore`:`#work/${work.id}/at/${progress.toFixed(6)}`;history.replaceState({...history.state,narrative:progress},'',nextHash);ownedHash=location.hash;}catch{}
  lastProgress=progress;lastMode=mode;lastScrollY=scrollY;
 }
 function queue(){if(!disposed&&!raf)raf=requestAnimationFrame(frame);}
 function stop(){if(autoFrame)cancelAnimationFrame(autoFrame);autoFrame=0;root.querySelector('[data-auto]').textContent='Auto-tour';root.querySelector('[data-auto]').setAttribute('aria-pressed','false');}
 function moveTo(y,{animate=true}={}){if(!ownsRoute())return;stop();window.scrollTo({top:Math.max(0,y),behavior:animate&&!mql.matches?'smooth':'instant'});queue();}
 function goProgress(p,animate=false){moveTo(positionAtProgress(p,anchors),{animate});}
 function resize(){stop();measure();queue();}
 const visibility=()=>{if(document.hidden)stop();};
 root.querySelector('[data-next]').onclick=()=>{const i=Math.min(count-1,Math.floor(progress*(count-1)+.08)+1);moveTo(progress>=.999?exploreAt+4:anchors[i]);};
 root.querySelector('[data-prev]').onclick=()=>moveTo(mode==='explore'?anchors.at(-1):anchors[Math.max(0,Math.ceil(progress*(count-1)-.08)-1)]);
 root.querySelector('[data-skip]').onclick=()=>moveTo(exploreAt+4);root.querySelector('[data-restart]').onclick=()=>goProgress(0,true);
 root.querySelector('[data-auto]').onclick=()=>{if(autoFrame){stop();return;}autoStart=performance.now();autoFrom=scrollY;autoTo=exploreAt+4;if(autoFrom>=autoTo)autoFrom=Math.max(0,anchors[0]);root.querySelector('[data-auto]').textContent='Pause auto-tour';root.querySelector('[data-auto]').setAttribute('aria-pressed','true');const duration=Math.max(4000,(autoTo-autoFrom)*8);function auto(t){if(!ownsRoute()){stop();return;}const p=Math.min(1,(t-autoStart)/duration);window.scrollTo({top:autoFrom+(autoTo-autoFrom)*p,behavior:'instant'});queue();if(p<1)autoFrame=requestAnimationFrame(auto);else stop();}autoFrame=requestAnimationFrame(auto);};
 const manual=e=>{if(e.type==='keydown'&&['ArrowRight','ArrowLeft'].includes(e.key)&&stage.contains(e.target)&&mode==='guide'){e.preventDefault();root.querySelector(e.key==='ArrowRight'?'[data-next]':'[data-prev]').click();}else if(!e.target?.closest?.('[data-auto]'))stop();};
 window.addEventListener('scroll',queue,{passive:true});window.addEventListener('resize',resize);window.addEventListener('wheel',stop,{passive:true});window.addEventListener('touchstart',stop,{passive:true});root.addEventListener('pointerdown',manual);root.addEventListener('keydown',manual);mql.addEventListener('change',resize);document.addEventListener('visibilitychange',visibility);
 const ro=new ResizeObserver(measure);ro.observe(layout);ro.observe(stage);articles.forEach(a=>ro.observe(a.firstElementChild));measure();
 const init=requestAnimationFrame(()=>{if(!ownsRoute())return;measure();if(startExploring)moveTo(exploreAt+4,{animate:false});else if(at!==null)goProgress(at);else if(chapter!==null)goProgress(Math.max(0,Math.min(count-1,chapter))/(count-1));else queue();initializing=false;frame();root.dataset.ready='true';});
 return{dispose(){disposed=true;stop();cancelAnimationFrame(raf);cancelAnimationFrame(init);ro.disconnect();window.removeEventListener('scroll',queue);window.removeEventListener('resize',resize);window.removeEventListener('wheel',stop);window.removeEventListener('touchstart',stop);root.removeEventListener('pointerdown',manual);root.removeEventListener('keydown',manual);mql.removeEventListener('change',resize);document.removeEventListener('visibilitychange',visibility);explorer.dispose();renderer.dispose();}};
}
