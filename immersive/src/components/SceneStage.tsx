import { forwardRef,useEffect,useImperativeHandle,useRef,useState } from 'react';
import type { ResearchRenderer,SceneConfig,SceneCallbacks } from '../engine/renderer';
import { Icon } from './Icon';
export type StageHandle={view:(name:string)=>void;pause:(value:boolean)=>void};
export function useReducedMotion(){
 const [reduced,setReduced]=useState(false);
 useEffect(()=>{
  const q=window.matchMedia('(prefers-reduced-motion: reduce)');
  const change=()=>setReduced(q.matches);change();
  q.addEventListener('change',change);return ()=>q.removeEventListener('change',change);
 },[]);
 return reduced;
}
type Props={config:SceneConfig;description:string;className?:string;callbacks?:SceneCallbacks;quiet?:boolean};
export const SceneStage=forwardRef<StageHandle,Props>(function SceneStage({config,description,className='',callbacks={},quiet=false},ref){
 const host=useRef<HTMLDivElement>(null),outer=useRef<HTMLDivElement>(null);
 const engine=useRef<ResearchRenderer|null>(null);
 const latest=useRef({config,callbacks});latest.current={config,callbacks};
 const [status,setStatus]=useState<'loading'|'ready'|'fallback'>('loading');
 const [error,setError]=useState('');
 useImperativeHandle(ref,()=>({view:name=>engine.current?.setView(name),pause:value=>engine.current?.setPaused(value)}),[]);
 useEffect(()=>{
  let cancelled=false,started=false;
  const load=async()=>{
   if(started||cancelled||!host.current)return;started=true;
   try{
    if(new URLSearchParams(location.search).has('no3d'))throw new Error('3D is disabled for this accessible view.');
    const module=await import('../engine/renderer');
    if(cancelled||!host.current)return;
    engine.current=new module.ResearchRenderer(host.current,latest.current.config,{
     onPick:id=>latest.current.callbacks.onPick?.(id),
     onMove:(id,p)=>latest.current.callbacks.onMove?.(id,p),
     onAgentDone:()=>latest.current.callbacks.onAgentDone?.(),
     onError:message=>{setError(message);setStatus('fallback');}
    });setStatus('ready');
   }catch(e){
    if(!cancelled){setError(e instanceof Error?e.message:'WebGL is unavailable.');setStatus('fallback');}
   }
  };
  const observer=new IntersectionObserver(entries=>{if(entries[0]?.isIntersecting)void load();},{rootMargin:'240px'});
  if(host.current)observer.observe(host.current);
  return ()=>{cancelled=true;observer.disconnect();engine.current?.dispose();engine.current=null;};
 },[]);
 useEffect(()=>{engine.current?.update(config);},[config]);
 const view=(name:string)=>engine.current?.setView(name);
 const fullscreen=()=>{if(document.fullscreenElement)void document.exitFullscreen();else void outer.current?.requestFullscreen().catch(()=>setError('Fullscreen is unavailable in this browser.'));};
 return <div ref={outer} className={`scene-stage ${className}`} data-state={status}>
  <div className="stage-host" ref={host} aria-label={description}/>
  {status!=='ready'&&<div className="stage-fallback" role="status">
   <div className="fallback-mark"><span/><span/><span/></div>
   <strong>{status==='loading'?'Opening the 3D view':'Continue with the explanation'}</strong>
   <p>{status==='loading'?description:error}</p>
   {status==='fallback'&&<small>The guided text, controls, calculations, and source links remain available below.</small>}
  </div>}
  <div className="viewport-topline"><span className={status==='ready'?'live-mark':''}>{status==='ready'?'Live 3D':status==='loading'?'Preparing scene':'Accessible view'}</span>{config.kind==='world'&&<span>Persistent world · r{config.world?.revision??0}</span>}</div>
  {!quiet&&<p className="viewport-description">{description}</p>}
  <div className="viewport-bar">
   <span className="viewport-help"><Icon name="orbit"/>{config.interaction==='move'?'Drag an object to move it':'Drag to orbit'}</span>
   <div className="camera-controls" aria-label="Camera controls">
    <button type="button" title="Rotate view left" aria-label="Rotate view left" onClick={()=>view('left')} disabled={status!=='ready'}><Icon name="back"/></button>
    <button type="button" title="Rotate view right" aria-label="Rotate view right" onClick={()=>view('right')} disabled={status!=='ready'}><Icon name="next"/></button>
    <button type="button" title="Zoom in" aria-label="Zoom in" onClick={()=>view('closer')} disabled={status!=='ready'}><Icon name="plus"/></button>
    <button type="button" title="Zoom out" aria-label="Zoom out" onClick={()=>view('farther')} disabled={status!=='ready'}><Icon name="minus"/></button>
    <button type="button" title="Reset camera" aria-label="Reset camera" onClick={()=>view('overview')} disabled={status!=='ready'}><Icon name="reset"/></button>
    <button type="button" title="Fullscreen 3D view" aria-label="Fullscreen 3D view" onClick={fullscreen} disabled={status!=='ready'}><Icon name="expand"/></button>
   </div>
  </div>
 </div>;
});
