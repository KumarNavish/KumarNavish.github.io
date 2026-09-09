import { useMemo,useState } from 'react';
import { Link } from './navigation';
import { SceneStage,useReducedMotion } from './components/SceneStage';
import { ScientificPanel } from './components/ScientificPanel';
import { BackLink } from './components/Shell';
import { Icon } from './components/Icon';
import { EXHIBITS,PERIOD_NAMES,statusLabel,type Exhibit } from './data/exhibits';
import { initialWorld } from './engine/world';
import type { SceneConfig } from './engine/renderer';
export function EvidenceSection({exhibit:e}:{exhibit:Exhibit}){
 const manuscript=['experience-replay-optimization','rank-feasibility'].includes(e.work.id);
 return <section className="work-evidence">
  <div><h2>The contribution</h2><p className="contribution-text">{e.work.contribution}</p><p className="small">{e.work.role}</p></div>
  <div><h2>Go to the source</h2><h3>{e.work.title}</h3><p>{e.work.venue}</p><p className="coauthors">Navish Kumar{e.work.coauthors.length?`, ${e.work.coauthors.join(', ')}`:''}</p><div className="evidence-links">{e.work.evidence.filter(v=>v.public&&v.url.startsWith('https://')).map((v,i)=><a key={i} href={v.url} target="_blank" rel="noreferrer">{manuscript?'Submission source record':v.label}<Icon name="arrow" size={14}/></a>)}</div>{manuscript&&<p className="source-disclosure">Current review outcome could not be independently retrieved on 5 September 2026. No acceptance or current conference decision is claimed.</p>}</div>
  <div className="boundary"><h2>Where the claim stops</h2><p>{e.work.limitation}</p></div>
 </section>;
}
export function ProjectPage({exhibit:e}:{exhibit:Exhibit}){
 const next=EXHIBITS[(EXHIBITS.indexOf(e)+1)%EXHIBITS.length];
 return <main id="main" className="project-page page-width"><BackLink/>
  <header className="project-heading"><div><p className="project-meta">{PERIOD_NAMES[e.work.period]} · {e.work.year} · {statusLabel(e.work)}</p><h1>{e.question}</h1></div><p>{e.name}</p></header>
  <ScientificPanel exhibit={e}/><EvidenceSection exhibit={e}/>
  <section className="project-continuation"><div><span>The next question</span><p>{e.work.nextQuestion}</p></div><Link href={next.work.route}>{next.name}<Icon name="arrow"/></Link></section>
 </main>;
}
export function WorkPage(){
 const [id,setId]=useState(EXHIBITS[0].work.id),e=EXHIBITS.find(x=>x.work.id===id)!;
 const reduced=useReducedMotion();const world=useMemo(initialWorld,[]);
 const worldConfig=useMemo<SceneConfig>(()=>({kind:'world',step:0,value:0,world,reduced}),[world,reduced]);
 return <main id="main" className="work-page page-width"><header className="page-heading"><h1>Every work.<br/><span>A way into the idea.</span></h1><p>Choose a project to operate its explanation. The published record, current research, and frontier remain distinct.</p></header>
  <div className="work-atlas"><nav className="work-selector" aria-label="Choose a research work">{EXHIBITS.map((x,i)=><button key={x.work.id} aria-pressed={id===x.work.id} onClick={()=>setId(x.work.id)}><span>{String(i+1).padStart(2,'0')}</span><div><strong>{x.name}</strong><small>{PERIOD_NAMES[x.work.period]} · {x.work.year} · {statusLabel(x.work)}</small></div></button>)}</nav>
   <div className="active-work" key={id}><header><h2>{e.name}</h2><Link href={e.work.route}>Open full explanation<Icon name="arrow" size={16}/></Link></header>{e.work.id==='spatial-intelligence'?<><SceneStage config={worldConfig} description={e.question}/><p className="atlas-world-note">An orbitable 3D scene. Enter the lab to issue commands, move objects, and inspect world history.</p></>:<ScientificPanel exhibit={e} compact/>}<p className="atlas-contribution">{e.work.contribution}</p></div>
  </div>
 </main>;
}
const RELATIONS:Record<string,string>={'direct-methodological-inheritance':'Methodological inheritance','recurring-question':'Recurring question','adjacent-application':'Adjacent application','later-extension':'Later extension'};
export function TrajectoryPage(){
 const [selected,setSelected]=useState(''),[lens,setLens]=useState('time');
 const [period,setPeriod]=useState('all'),[year,setYear]=useState('all'),[status,setStatus]=useState('all');
 const reduced=useReducedMotion(),e=EXHIBITS.find(w=>w.work.id===selected);
 const config=useMemo<SceneConfig>(()=>({kind:'trajectory',step:4,value:0,selected,comparison:lens,reduced}),[selected,lens,reduced]);
 const visible=EXHIBITS.filter(x=>(period==='all'||x.work.period===period)&&(year==='all'||String(x.work.year)===year)&&(status==='all'||statusLabel(x.work)===status));
 const related=e?[...new Map(e.work.relations.map(r=>[r.targetId,{relation:r,exhibit:EXHIBITS.find(x=>x.work.id===r.targetId)}])).values()]:[];
 return <main id="main" className="trajectory-page page-width">
  <header className="page-heading"><h1>Follow the question.</h1><p>From local relationships to learning under change, then evidence-bound action and persistent worlds. These are related questions—not a claim that every paper inherits the previous method.</p></header>
  <div className="horizon-labels"><span><b>Past</b>Structure & geometry</span><span><b>Now</b>Adaptation & evidence</span><span><b>Next</b>Persistent worlds</span></div>
  <div className="trajectory-lenses" aria-label="Organize the research gallery">{['time','questions','methods','systems','frontier'].map(l=><button key={l} aria-pressed={lens===l} onClick={()=>setLens(l)}>{l[0].toUpperCase()+l.slice(1)}</button>)}<button className="reset-gallery" onClick={()=>{setSelected('');setLens('time');}}>Reset overview</button></div>
  <SceneStage config={config} description="Select a research object to move closer. Switch lenses to reorganize the same ten works." className="trajectory-scene" callbacks={{onPick:setSelected}}/>
  <section className="timeline-section"><header><h2>The research record</h2><details className="record-filters"><summary>Filter the record</summary><div><label>Period<select value={period} onChange={ev=>setPeriod(ev.target.value)}><option value="all">All periods</option><option value="foundations">Past</option><option value="current">Now</option><option value="frontier">Next</option></select></label><label>Year<select value={year} onChange={ev=>setYear(ev.target.value)}><option value="all">All years</option>{[...new Set(EXHIBITS.map(x=>x.work.year))].map(y=><option key={y}>{y}</option>)}</select></label><label>Status<select value={status} onChange={ev=>setStatus(ev.target.value)}><option value="all">All statuses</option>{[...new Set(EXHIBITS.map(x=>statusLabel(x.work)))].map(s=><option key={s}>{s}</option>)}</select></label><button onClick={()=>{setYear('all');setPeriod('all');setStatus('all');}}>Clear filters</button></div></details></header>
   <div className="timeline-record">{visible.map(x=><button key={x.work.id} className={selected===x.work.id?'timeline-item selected':'timeline-item'} aria-pressed={selected===x.work.id} onClick={()=>setSelected(x.work.id)}><span className="timeline-year">{x.work.year}</span><i aria-hidden="true"/><div><small>{PERIOD_NAMES[x.work.period]} · {statusLabel(x.work)}</small><h3>{x.name}</h3><p>{x.question}</p></div><Icon name="arrow"/></button>)}</div>
   {visible.length===0&&<p className="empty-note">No work matches these filters. Clear filters to restore the complete record.</p>}
  </section>
  {e?<section className="trajectory-detail" aria-live="polite"><div><span>{PERIOD_NAMES[e.work.period]} · {e.work.dateLabel}</span><h2>{e.question}</h2><Link className="button" href={e.work.route}>Enter {e.name}<Icon name="arrow"/></Link></div><div><h3>The contribution</h3><p>{e.work.contribution}</p><h3>What came next</h3><p>{e.work.nextQuestion}</p><div className="related-works">{related.map(r=>r.exhibit&&<Link key={r.exhibit.work.id} href={r.exhibit.work.route}><span>{RELATIONS[r.relation.kind]}</span><strong>{r.exhibit.name}<Icon name="arrow" size={14}/></strong><p>{r.relation.note}</p></Link>)}</div></div></section>:<p className="trajectory-prompt">Choose a work in the gallery or the record to open its contribution, relationships, and next question.</p>}
 </main>;
}
export function ResearchPage(){
 const [query,setQuery]=useState('');const papers=EXHIBITS.filter(e=>e.work.type==='paper'&&(e.work.title+' '+e.work.coauthors.join(' ')+' '+e.work.themes.join(' ')).toLowerCase().includes(query.toLowerCase()));
 return <main id="main" className="research-page page-width"><header className="page-heading"><h1>Papers and<br/><span>open questions.</span></h1><p>Exact source records sit alongside the contribution and its boundary. Interactive examples explain the mechanism; they do not stand in for evidence.</p></header>
  <div className="research-clusters"><Link href="/trajectory"><span>01 · Structure</span><h2>Make local relationships measurable.</h2><p>Interaction networks, gain Laplacians, and spatial context.</p></Link><Link href="/work/experience-replay-optimization"><span>02 · Learning</span><h2>Understand the cost of changing.</h2><p>Optimization geometry, replay, and constrained adaptation.</p></Link><Link href="/systems/casepath"><span>03 · Action</span><h2>Keep evidence attached to decisions.</h2><p>State, obligations, provenance, and explicit limitations.</p></Link></div>
  <section className="paper-record"><header><h2>Research record</h2><label className="paper-search"><span className="sr-only">Search papers</span><input type="search" placeholder="Search title, author, or topic" value={query} onChange={e=>setQuery(e.target.value)}/></label></header>
   {papers.map(e=><article key={e.work.id} className="paper-row"><div className="paper-year">{e.work.year}<span>{statusLabel(e.work)}</span></div><div><Link href={e.work.route}><h3>{e.work.title}</h3></Link><p className="paper-authors">Navish Kumar · {e.work.coauthors.join(' · ')}</p><p>{e.work.contribution}</p><small>{e.work.venue}</small></div><div className="paper-actions"><Link href={e.work.route}>Explore in 3D<Icon name="arrow" size={15}/></Link>{e.work.evidence.filter(v=>v.public&&v.url.startsWith('https://')).slice(0,1).map(v=><a key={v.url} href={v.url} target="_blank" rel="noreferrer">Source record<Icon name="arrow" size={15}/></a>)}</div></article>)}
   {!papers.length&&<p className="empty-note">No matching papers. Try a broader title or topic.</p>}
   <p className="research-note">Publication metadata follows the supplied source records. Current review outcomes for Experience Replay and Rank Feasibility could not be reverified on 5 September 2026 and are deliberately not stated as acceptance or rejection.</p>
  </section>
  <section className="ongoing-research"><h2>Still being investigated</h2><p>Temporal replay value is ongoing research. CasePath is a system prototype. Persistent worlds is a frontier interface experiment.</p><div>{EXHIBITS.filter(e=>e.work.type!=='paper').map(e=><Link key={e.work.id} href={e.work.route}>{e.name}<Icon name="arrow"/></Link>)}</div></section>
 </main>;
}
export function SystemsPage(){
 const e=EXHIBITS.find(x=>x.work.id==='casepath')!;
 return <main id="main" className="systems-page page-width"><header className="page-heading"><h1>Keep the evidence<br/><span>attached to the action.</span></h1><p>CasePath explores the layer before judgment: reconstruct the case state, expose missing evidence, and prepare a reviewable next step without letting a model become the decision-maker.</p></header><div className="system-context"><span>CasePath · system prototype</span><p>Try a synthetic conflict between two inspection records. Then apply a superseding correction and watch the admission state change.</p><Link href="/systems/casepath">Project record<Icon name="arrow"/></Link></div><ScientificPanel exhibit={e}/><div className="system-boundaries"><div><h2>Model responsibility</h2><p>Propose bounded interpretations. Preserve the link back to the source. Never manufacture authority from fluency.</p></div><div><h2>Kernel responsibility</h2><p>Evaluate explicit obligations and source relationships. Hold when the available records conflict.</p></div><div><h2>Human responsibility</h2><p>Validate the evidence and the judgment. A consistent review packet does not establish real-world truth.</p></div></div><EvidenceSection exhibit={e}/></main>;
}
export function FrontierPage(){
 const reduced=useReducedMotion(),world=useMemo(initialWorld,[]);
 const config=useMemo<SceneConfig>(()=>({kind:'world',step:0,value:0,world,reduced}),[world,reduced]);
 return <main id="main" className="frontier-page page-width"><header className="page-heading"><h1>Give the next idea<br/><span>a world to live in.</span></h1><p>Two directions ask what an intelligent system should keep: history that remains useful, and a world whose state survives the next interaction.</p></header><div className="frontier-world"><SceneStage config={config} description="A real three-dimensional, persistent laboratory. Enter the lab to change it." quiet/><div><span>Spatial intelligence · working interface prototype</span><h2>Language that edits<br/>the same world.</h2><p>Objects have identities, positions, and relationships. Move them with language or direct interaction. Watch a demonstration agent act on the current state.</p><Link className="button" href="/frontier/spatial-intelligence">Enter the spatial lab<Icon name="arrow"/></Link><p className="small">Deterministic parser. Procedural 3D assets. No claim of unrestricted generation or learned embodiment.</p></div></div><section className="temporal-direction"><div><span>Time-continual learning · ongoing research</span><h2>When does history<br/>stop earning its place?</h2></div><div><p>Replaying old tokens consumes a finite budget. The question is whether a historical window remains more valuable than the current data it replaces.</p><Link className="text-link" href="/work/ticlm-replay-value">Explore temporal replay value<Icon name="arrow"/></Link></div></section></main>;
}
export function AboutPage(){
 const arc=[['2020','Observe interaction.','Paired-user analysis and gain graphs made relationships—and their global consequences—precise.','/work/counterspeech-dynamics'],['2023','Keep local context.','Urban delivery modelling showed what a city-wide average can conceal.','/work/urban-microregion-logistics'],['2025','Let geometry explain learning.','Square-root natural-gradient work connected optimization behavior with explicit guarantees.','/work/square-root-natural-gradient'],['2026','Understand the update.','Replay and rank feasibility ask how models can adapt without hiding interference or impossible corrections.','/work/experience-replay-optimization'],['Now','Bind action to evidence.','CasePath explores how model interpretation can remain separate from operational authority.','/systems/casepath'],['Next','Build persistent interfaces.','Spatial computing asks what happens when language edits a world that people can inspect and act inside.','/frontier/spatial-intelligence']];
 return <main id="main" className="about-page page-width"><header className="about-heading"><div><h1>Navish Kumar</h1><p>Machine-learning researcher.<br/>Systems builder.</p></div><div><p>I am a PhD researcher at the University of Basel, working across optimization, continual learning, and intelligent systems.</p><p>The domains have changed. The recurring question is how to make a consequential change visible enough to understand, test, and use.</p><a className="text-link" href="https://dmi.unibas.ch/de/personen/navish-kumar/" target="_blank" rel="noreferrer">University profile<Icon name="arrow"/></a></div></header>
  <section className="about-arc" aria-label="Research development">{arc.map(([year,title,text,route])=><article key={year}><span>{year}</span><div><h2>{title}</h2><p>{text}</p></div><Link href={route} aria-label={`Explore: ${title}`}><Icon name="arrow"/></Link></article>)}</section>
  <section className="about-contact"><div><h2>Let’s work on<br/>a difficult question.</h2><p>Continual learning, optimization, scientific software, evidence-grounded systems, and human–AI interfaces.</p></div><div><a href="mailto:navish.kumar@unibas.ch">navish.kumar@unibas.ch<Icon name="arrow"/></a><a href="https://kumarnavish.github.io/artifacts/resume.pdf" target="_blank" rel="noreferrer"><Icon name="download"/>Public résumé PDF</a><p>Basel, Switzerland</p></div></section>
 </main>;
}
export function NotFoundPage(){return <main id="main" className="not-found page-width"><h1>This page isn’t in the atlas.</h1><p>The research, systems, and spatial lab are still one step away.</p><Link href="/work" className="button">Browse the work<Icon name="arrow"/></Link></main>;}
