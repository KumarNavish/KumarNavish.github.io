import { useEffect,useMemo,useRef,useState } from 'react';
import { SceneStage,useReducedMotion,type StageHandle } from './components/SceneStage';
import { Icon } from './components/Icon';
import { BackLink } from './components/Shell';
import { downloadJSON } from './components/ScientificPanel';
import { initialWorld,emptyWorld,applyCommand,moveObject,validateWorld,EXAMPLE,type WorldState,type Intent } from './engine/world';
import type { SceneConfig } from './engine/renderer';
import type { V3 } from './engine/science';
type Recognition={lang:string;interimResults:boolean;onresult:((e:{results:ArrayLike<ArrayLike<{transcript:string}>>})=>void)|null;onerror:((e:{error:string})=>void)|null;onend:(()=>void)|null;start:()=>void;abort:()=>void};
const STORAGE='navish-spatial-world-v1';
export function SpatialLab(){
 const [world,setWorld]=useState<WorldState>(initialWorld),[command,setCommand]=useState(EXAMPLE);
 const [selected,setSelected]=useState(''),[mode,setMode]=useState<'orbit'|'move'>('orbit');
 const [tab,setTab]=useState<'objects'|'intent'|'history'>('objects');
 const [intent,setIntent]=useState<Intent|null>(null),[error,setError]=useState('');
 const [run,setRun]=useState(false),[runCycle,setRunCycle]=useState(0);
 const [agent,setAgent]=useState<'ready'|'walking'|'paused'|'done'>('ready');
 const [loaded,setLoaded]=useState(false),[saved,setSaved]=useState(false);
 const [micSupported,setMicSupported]=useState(false),[listening,setListening]=useState(false);
 const recognition=useRef<Recognition|null>(null),past=useRef<WorldState[]>([]);
 const stage=useRef<StageHandle>(null),reduced=useReducedMotion();
 useEffect(()=>{
  try{const raw=localStorage.getItem(STORAGE);if(raw){const data=JSON.parse(raw);if(validateWorld(data))setWorld(data);}setSaved(true);}catch{setSaved(false);}
  setLoaded(true);
  const w=window as unknown as {SpeechRecognition?:unknown;webkitSpeechRecognition?:unknown};setMicSupported(Boolean(w.SpeechRecognition||w.webkitSpeechRecognition));
  return ()=>recognition.current?.abort();
 },[]);
 useEffect(()=>{if(!loaded)return;try{localStorage.setItem(STORAGE,JSON.stringify(world));setSaved(true);}catch{setSaved(false);}},[world,loaded]);
 const config=useMemo<SceneConfig>(()=>({kind:'world',step:runCycle,value:0,world,selected,runAgent:run,interaction:mode,reduced}),[world,selected,run,runCycle,mode,reduced]);
 const object=world.objects.find(o=>o.id===selected);
 function commit(next:WorldState,autoRun=false){
  past.current=[...past.current,world].slice(-20);stage.current?.pause(false);setWorld(next);setRun(autoRun);
  setAgent(autoRun?'walking':'ready');if(autoRun)setRunCycle(v=>v+1);
  if(!next.objects.some(o=>o.id===selected))setSelected('');setError('');
 }
 function submit(text=command){
  try{const result=applyCommand(world,text);setIntent(result.intent);commit(result.world,Boolean(result.intent.goal));}
  catch(e){setError(e instanceof Error?e.message:'The command could not be applied.');}
 }
 function manipulate(id:string,position:V3,rotation?:number){commit(moveObject(world,id,position,rotation));setSelected(id);}
 function undo(){const previous=past.current.pop();if(!previous)return;stage.current?.pause(false);setWorld(previous);setRun(false);setAgent('ready');setSelected('');setError('');}
 function runRobot(){
  if(agent==='walking'){stage.current?.pause(true);setAgent('paused');return;}
  if(agent==='paused'){stage.current?.pause(false);setAgent('walking');return;}
  submit('Let an agent inspect the sample.');
 }
 function dictate(){
  if(listening){recognition.current?.abort();setListening(false);return;}
  const w=window as unknown as {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};
  const Constructor=w.SpeechRecognition??w.webkitSpeechRecognition;if(!Constructor)return;
  const r=new Constructor();r.lang='en-US';r.interimResults=true;
  r.onresult=e=>setCommand(Array.from(e.results).map(row=>row[0]?.transcript??'').join(' '));
  r.onerror=e=>{setError(`Speech could not start (${e.error}). The text input remains available.`);setListening(false);};
  r.onend=()=>setListening(false);recognition.current=r;
  try{r.start();setListening(true);}catch{setError('Speech recognition is unavailable. Please type the instruction.');}
 }
 const clear=()=>commit({...emptyWorld(),environment:world.environment,time:world.time,revision:world.revision+1,history:[...world.history,{text:'Clear objects',revision:world.revision+1,changes:['Removed all editable objects']} ]});
 return <main id="main" className="lab-page page-width">
  <BackLink href="/frontier">Frontier</BackLink>
  <header className="lab-heading"><div><h1>Build a world.<br/><span>Keep changing it.</span></h1></div><p>Describe a place, arrange its objects, and give an agent a task. Your next instruction edits the same world.</p></header>
  <div className="lab-view-controls"><div className="segmented"><button aria-pressed={mode==='orbit'} onClick={()=>setMode('orbit')}><Icon name="orbit"/>Orbit</button><button aria-pressed={mode==='move'} onClick={()=>setMode('move')}><Icon name="move"/>Move objects</button></div><div className="camera-presets"><button onClick={()=>stage.current?.view('overview')}>Overview</button><button onClick={()=>stage.current?.view('inside')}>Eye level</button><button onClick={()=>stage.current?.view('top')}>Plan view</button></div><span>{saved?'Saved in this browser':'Local world'}</span></div>
  <div className="lab-layout">
   <div className="lab-main">
    <SceneStage ref={stage} config={config} className="world-stage" description="An editable three-dimensional mountain laboratory with a persistent object registry." quiet callbacks={{onPick:setSelected,onMove:(id,p)=>manipulate(id,p),onAgentDone:()=>setAgent('done')}}/>
    <form className="world-command" onSubmit={e=>{e.preventDefault();submit();}}>
     <label htmlFor="scene-command">Describe the scene or the next change</label>
     <div className="command-row"><textarea id="scene-command" value={command} rows={2} maxLength={600} onChange={e=>setCommand(e.target.value)} placeholder="Move the microscope beside the window…"/><button type="button" className={`mic-button ${listening?'listening':''}`} aria-label={listening?'Stop dictation':'Dictate a command'} title={micSupported?'Your browser handles speech recognition':'Speech unavailable here; use text'} disabled={!micSupported} onClick={dictate}><Icon name="mic"/></button><button className="button" type="submit">Apply<Icon name="arrow"/></button></div>
     {error&&<p className="command-error" role="alert">Command not applied: {error}</p>}
     <div className="command-examples"><span>Try</span>{['Make it night','Add a second sample','Move the microscope beside the window'].map(text=><button type="button" key={text} onClick={()=>{setCommand(text);submit(text);}}>{text}</button>)}</div>
    </form>
    <div className="world-bottom-actions"><button onClick={undo} disabled={!past.current.length}><Icon name="back"/>Undo</button><button onClick={clear}>Clear objects</button><button onClick={()=>commit(initialWorld())}>Reset example</button><span>{world.objects.length} objects · revision {world.revision}</span></div>
    <p className="lab-integrity">Real WebGL geometry. A declared local parser, not a generative model. Typed commands stay in your browser; optional dictation uses your browser’s speech service.</p>
   </div>
   <aside className="world-inspector">
    <div className="inspector-tabs" aria-label="World inspection view">{(['objects','intent','history'] as const).map(t=><button key={t} aria-pressed={tab===t} onClick={()=>setTab(t)}>{t[0].toUpperCase()+t.slice(1)}</button>)}</div>
    {tab==='objects'&&<div className="object-list" aria-label="World objects">{world.objects.length===0?<p className="empty-note">The object registry is empty. Apply the example command to populate it.</p>:world.objects.map(o=><button key={o.id} aria-pressed={selected===o.id} onClick={()=>setSelected(o.id)} data-object-id={o.id}><span className={`object-symbol symbol-${o.kind}`}/><span><strong>{o.name}</strong><small>x {o.position[0].toFixed(1)} · z {o.position[2].toFixed(1)}</small></span><Icon name="next" size={14}/></button>)}</div>}
    {tab==='intent'&&<div className="intent-view"><h3>Declared interpretation</h3><p>The parser recognizes a bounded vocabulary. Nothing here is generated by a language model.</p><pre>{intent?JSON.stringify(intent,null,2):'Apply a command to inspect its interpretation.'}</pre></div>}
    {tab==='history'&&<div className="world-history">{world.history.length===0?<p className="empty-note">This is the editable example scene. No commands have been applied yet.</p>:[...world.history].reverse().map((h,i)=><article key={`${h.revision}-${i}`}><span>Revision {h.revision}</span><h3>{h.text}</h3><ul>{h.changes.map((c,j)=><li key={j}>{c}</li>)}</ul></article>)}</div>}
    {object&&tab==='objects'&&<section className="selection-controls"><h3>{object.name}</h3><p>Move in scene coordinates, or select Move objects and drag in 3D.</p><div className="nudge-controls">{([["x −",-.25,0],["x +",.25,0],["z −",0,-.25],["z +",0,.25]] as const).map(([label,x,z])=><button key={label} aria-label={`Move ${object.name} ${label}`} onClick={()=>manipulate(object.id,[object.position[0]+x,object.position[1],object.position[2]+z])}>{label}</button>)}</div><button className="rotate-object" onClick={()=>manipulate(object.id,object.position,object.rotation+45)}>Rotate +45°</button></section>}
    <section className="agent-box"><div><span className={`agent-indicator ${agent}`}/><h3>Situated agent</h3><small>{agent==='done'?'Complete':agent==='paused'?'Paused':agent==='walking'?'Moving':'Ready'}</small></div><p>{agent==='done'?'The robot reached the sample. This is a simulated inspection, not a physical measurement.':agent==='walking'?'Following explicit waypoints through the front aisle.':'Ask the demonstration robot to approach a sample in this world.'}</p><button className="button secondary" disabled={!world.objects.some(o=>o.kind==='sample')} onClick={runRobot}><Icon name={agent==='walking'?'pause':'play'}/>{agent==='walking'?'Pause agent':agent==='paused'?'Resume agent':agent==='done'?'Run again':reduced?'Resolve agent task':'Run agent'}</button></section>
    <button className="export-world" onClick={()=>downloadJSON(world,'navish-world.json')}><Icon name="download"/>Export world state</button>
   </aside>
  </div>
  <section className="spatial-argument"><div><span>Language → intent → world → action</span><h2>The important part is what persists.</h2></div><div><p>The microscope has an identity and coordinates. A relation refers to another existing object. A new command changes only the relevant state. Language and direct manipulation operate on the same world.</p><p className="small">This browser prototype uses procedural 3D assets and deterministic interpretation. It is not unrestricted text-to-3D generation, a physics engine, or a learned embodied policy.</p></div></section>
 </main>;
}
