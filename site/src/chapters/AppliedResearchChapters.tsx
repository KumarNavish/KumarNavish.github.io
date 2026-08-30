import { useMemo, useState } from 'react'

import {
  ChapterScaffold,
  type ChapterEvidence,
  type ChapterStep,
} from './ChapterScaffold'

function RangeControl({ label, value, min, max, step, display, onChange }: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (value: number) => void
}) {
  return (
    <label className="chapter-control">
      <span>{label}<output>{display}</output></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  )
}

function InspectGrid({ items, formal }: { items: Array<[string,string,string]>; formal: string }) {
  return (
    <>
      <div className="chapter-inspect-grid">
        {items.map(([label,value,note]) => <article key={label}><span>{label}</span><strong>{value}</strong><p>{note}</p></article>)}
      </div>
      <div className="chapter-formal">{formal}</div>
    </>
  )
}

const URBAN_STEPS: ChapterStep[] = [
  { label:'Problem', title:'A city-wide average hides the street where a fleet decision succeeds.', body:'Cargo bikes can reduce urban emissions, but their advantage depends on local parking friction, density, road form, walking distance, and service conditions. One global label—“bike suitable”—is too coarse.', cue:'The cells begin identical even though their urban context is not.' },
  { label:'Why it matters', title:'Sustainability targets fail when they are detached from operations.', body:'A fleet operator needs to know where to deploy first, what service level to expect, and which neighbourhoods will still require vans.', cue:'Notice that the decision is spatial and operational, not only environmental.' },
  { label:'Key idea', title:'Treat each urban micro-region as a measurable context.', body:'The city is partitioned with Uber H3 cells. OpenStreetMap features and observed service-time components describe the conditions inside each cell.', cue:'The hexagons become different only after contextual features enter.' },
  { label:'Mechanism', title:'Predict vehicle performance locally, then compare transition scenarios.', body:'The model estimates delivery-time components for vans and cargo bikes. A planner can then rank cells by expected operational advantage under a chosen service target.', cue:'Increase lane coverage or parking friction and watch the first rollout wave move.' },
  { label:'What changes', title:'A climate ambition becomes a sequence of concrete decisions.', body:'Instead of asking whether cargo bikes work “in the city,” the system asks which cells should transition now, which should wait, and why.', cue:'The brightest cells are a prioritization, not an aesthetic heatmap.' },
  { label:'Boundary', title:'Predictions do not replace field trials.', body:'Open map features and observed service data are incomplete proxies. Transfer to a new city, season, operator, or parcel mix requires calibration and operational validation.', cue:'Raise volatility and watch confidence fall even when suitability stays high.' },
]

type Hex = { x:number; y:number; base:number; parking:number; density:number }
const HEXES: Hex[] = Array.from({ length: 32 },(_,index)=>({
  x:58+(index%8)*53+(Math.floor(index/8)%2)*26.5,
  y:68+Math.floor(index/8)*45,
  base:((index*37)%97)/97,
  parking:((index*19+13)%89)/89,
  density:((index*53+7)%101)/101,
}))

function hexPoints(x:number,y:number,size=25): string {
  return Array.from({length:6},(_,index)=>{
    const angle=Math.PI/3*index+Math.PI/6
    return `${x+Math.cos(angle)*size},${y+Math.sin(angle)*size}`
  }).join(' ')
}

function scoreHex(hex:Hex,lane:number,parking:number,volatility:number): number {
  const operational=.22+hex.density*.37+hex.parking*parking*.28+lane*.31-hex.base*.12
  return Math.max(0,Math.min(1,operational-volatility*.17))
}

function UrbanStage({ step,lane,parking,volatility }: { step:number;lane:number;parking:number;volatility:number }) {
  const scored=HEXES.map((hex,index)=>({ ...hex,index,score:scoreHex(hex,lane,parking,volatility) }))
  const firstWave=[...scored].sort((a,b)=>b.score-a.score).slice(0,5).map((item)=>item.index)
  const reliability=Math.max(.72,.98-volatility*.16+(lane-.5)*.06)
  return (
    <svg viewBox="0 0 540 430" role="img" aria-label="Urban H3 cells ranked for cargo-bike transition under local conditions">
      <rect width="540" height="430" fill="#f5f6f2"/>
      <text x="28" y="31" fill="#666c64" fontSize="10">micro-region decision surface · illustrative model</text>
      <g transform="translate(0 0)" opacity={step>=2?1:.28}>
        {scored.map((hex)=>{
          const selected=firstWave.includes(hex.index)
          return <g key={hex.index}><polygon points={hexPoints(hex.x,hex.y)} fill={`rgba(40,94,196,${.08+hex.score*.72})`} stroke={selected?'#c9472d':'#fff'} strokeWidth={selected?2.4:1.2}/>{selected?<text x={hex.x} y={hex.y+3} fill="#fff" fontSize="8" textAnchor="middle">{firstWave.indexOf(hex.index)+1}</text>:null}</g>
        })}
      </g>
      <g opacity={step>=0?1:.2}>
        <path d="M28 282 C112 228, 169 298, 270 237 S410 203, 510 148" fill="none" stroke="#aeb4aa" strokeWidth="8" strokeLinecap="round"/>
        <path d="M28 282 C112 228, 169 298, 270 237 S410 203, 510 148" fill="none" stroke={step>=3?'#c9472d':'#fff'} strokeWidth={1.5+lane*4.5} strokeLinecap="round" strokeDasharray={step>=3?undefined:'6 5'}/>
      </g>
      <g transform="translate(30 305)" opacity={step>=3?1:.16}>
        <rect width="480" height="88" rx="5" fill="#fff" stroke="#d9ddd4"/>
        <text x="16" y="22" fill="#666c64" fontSize="9">scenario result</text>
        <text x="16" y="49" fill="#111310" fontSize="15">first wave: cells {firstWave.map((index)=>index+1).join(' · ')}</text>
        <text x="16" y="70" fill="#666c64" fontSize="10">expected service reliability {(reliability*100).toFixed(1)}% · uncertainty ±{(3+volatility*9).toFixed(1)} pp</text>
      </g>
    </svg>
  )
}

export function UrbanLogisticsChapter() {
  const [step,setStep]=useState(0)
  const [lane,setLane]=useState(.58)
  const [parking,setParking]=useState(.63)
  const [volatility,setVolatility]=useState(.31)
  const scored=useMemo(()=>HEXES.map((hex)=>scoreHex(hex,lane,parking,volatility)),[lane,parking,volatility])
  const best=Math.max(...scored)
  const transition=scored.filter((score)=>score>.65).length
  const confidence=Math.max(.32,1-volatility*.68)
  return (
    <ChapterScaffold
      eyebrow="Urban AI · sustainable logistics"
      title="Make the fleet transition street-specific."
      thesis="Cargo-bike logistics is not a city-wide yes-or-no question. Urban context has to be resolved at the micro-region level before an environmental ambition can become an operational rollout."
      status="2023 · research project"
      steps={URBAN_STEPS} activeStep={step} onStepChange={setStep}
      stage={<UrbanStage step={step} lane={lane} parking={parking} volatility={volatility}/>} insight={[
        'A city average gives every street the same operational identity and therefore hides the deployment decision.',
        'The relevant output is not “green” or “not green”; it is a ranked rollout under service constraints.',
        'Each hexagon receives contextual features from open geographic data and observed delivery behaviour.',
        `${transition} of ${HEXES.length} cells currently clear the displayed transition threshold.`,
        'The numbered cells form the first operational wave; surrounding cells remain visible rather than being erased.',
        `Scenario confidence is ${Math.round(confidence*100)}%. High suitability with low confidence still requires a field test.`,
      ][step]}
      controls={<div className="chapter-control-grid"><RangeControl label="Bike-lane coverage" value={lane} min={0} max={1} step={.01} display={`${Math.round(lane*100)}%`} onChange={setLane}/><RangeControl label="Van parking friction" value={parking} min={0} max={1} step={.01} display={`${Math.round(parking*100)}%`} onChange={setParking}/><RangeControl label="Demand volatility" value={volatility} min={0} max={1} step={.01} display={`${Math.round(volatility*100)}%`} onChange={setVolatility}/></div>}
      inspect={<InspectGrid items={[["transition-ready",`${transition}/${HEXES.length}`,"Cells above the illustrative operational threshold."],["best local score",best.toFixed(2),"Highest modeled cargo-bike advantage under this scenario."],["scenario confidence",`${Math.round(confidence*100)}%`,"Falls as unmodeled volatility increases."]]} formal="Local decision model: ŷ(h, vehicle) = f(OSM featuresₕ, observed service componentsₕ, scenario). Compare predicted service time and reliability per H3 cell h before ranking rollout."/>}
      contribution={['A spatial abstraction that turns cargo-bike transition from a slogan into a testable local decision.','Partition cities into comparable H3 micro-regions rather than relying on coarse administrative averages.','Aggregate OpenStreetMap context and observed service-time components into machine-learning features.','Connect predictive outputs to concrete fleet-transition and routing questions.']}
      evidence={[
        { label:'Paper', title:'Modelling delivery vehicles across urban micro-regions', note:'The complete datasets, modelling choices, limitations, and initial empirical findings.', href:'https://arxiv.org/abs/2301.12887' },
        { label:'Open implementation', title:'green-last-mile', note:'Public repository associated with the urban delivery modelling work.', href:'https://github.com/KumarNavish/green-last-mile' },
        { label:'Spatial method', title:'H3 cells and OpenStreetMap features', note:'A replicable context representation designed to support rather than conceal operational differences.' },
      ]}
      boundary="The live planner is an explanatory scenario model, not a production fleet recommendation. Real deployment needs calibrated travel, parking, parcel, weather, labour, safety, and operator data for the target city."
      next={{ title:'Counterspeech dynamics', question:'How can observable interaction structure inform intervention without collapsing people into scores?', route:'/research/counterspeech' }}
    />
  )
}

const SOCIAL_STEPS: ChapterStep[] = [
  { label:'Problem', title:'Removing a message does not explain the interaction that produced it.', body:'Hate speech and counterspeech evolve through networks of users, audiences, communities, and repeated responses. Looking only at isolated text misses the behaviour around it.', cue:'The first pulse travels through relationships, not through a bag of words.' },
  { label:'Why it matters', title:'Intervention can protect people—or suppress the wrong voice.', body:'Platforms must reduce harm while avoiding blunt rules that erase context or restrict protective expression. That requires evidence about who responds, how strategies differ, and what interaction patterns persist.', cue:'Hate and counter users remain distinct populations with different measured behaviours.' },
  { label:'Key idea', title:'Study paired hate and counter users as interacting behaviour.', body:'The work constructs and releases an annotated dataset of user pairs, then compares lexical, linguistic, psycholinguistic, activity, and popularity signals.', cue:'The unit of analysis becomes the pair and its context, not only one post.' },
  { label:'Mechanism', title:'Trace how counterspeech can redirect the network response.', body:'The instrument shows a conceptual propagation model: counterspeech intensity and community separation alter which paths receive protective attention. It is an intuition layer over the empirical study, not its measured causal result.', cue:'Increase counterspeech and observe which routes become active.' },
  { label:'What changes', title:'Moderation gains a richer intervention vocabulary.', body:'The findings motivate interventions that distinguish harmful behaviour, target community context, and protective response rather than relying only on account removal.', cue:'The output is a review priority, not an automatic punishment.' },
  { label:'Boundary', title:'Behavioural association is not causal proof.', body:'Twitter-era data, annotation choices, platform dynamics, and demographic uncertainty constrain generalization. The study does not license automated individual-level moral judgement.', cue:'Tighten the review threshold and preserve human review.' },
]

type SocialNode={x:number;y:number;kind:'hate'|'counter'|'audience';community:number}
const SOCIAL_NODES:SocialNode[]=[
  {x:74,y:94,kind:'hate',community:0},{x:98,y:192,kind:'hate',community:0},{x:142,y:54,kind:'audience',community:0},{x:168,y:136,kind:'audience',community:0},
  {x:260,y:94,kind:'counter',community:1},{x:287,y:205,kind:'counter',community:1},{x:340,y:58,kind:'audience',community:1},{x:362,y:144,kind:'audience',community:1},
  {x:454,y:88,kind:'audience',community:2},{x:458,y:210,kind:'counter',community:2},{x:405,y:270,kind:'audience',community:2},{x:223,y:278,kind:'audience',community:1},
]
const SOCIAL_EDGES:[[number,number],...Array<[number,number]>]=[[0,2],[0,3],[1,3],[2,4],[3,4],[3,5],[4,6],[4,7],[5,7],[5,11],[6,8],[7,8],[7,9],[8,9],[9,10],[10,11],[3,11]]

function SocialStage({ step,counter,homophily,threshold }: { step:number;counter:number;homophily:number;threshold:number }) {
  return (
    <svg viewBox="0 0 540 430" role="img" aria-label="Paired hate and counterspeech users within an interaction network">
      <rect width="540" height="430" fill="#f5f6f2"/>
      <text x="28" y="31" fill="#666c64" fontSize="10">interaction network · explanatory projection</text>
      <g opacity={step>=0?1:.2}>
        {SOCIAL_EDGES.map(([a,b],index)=>{
          const left=SOCIAL_NODES[a],right=SOCIAL_NODES[b]
          const cross=left.community!==right.community
          const protective=(left.kind==='counter'||right.kind==='counter') && counter>(index%7)/7
          return <line key={index} x1={left.x} y1={left.y} x2={right.x} y2={right.y} stroke={protective?'#285ec4':cross&&homophily>.5?'#d4d8d0':'#aeb4aa'} strokeWidth={protective?2.8:1.1} opacity={cross?1-homophily*.7:1}/>
        })}
        {SOCIAL_NODES.map((node,index)=>{
          const fill=node.kind==='hate'?'#c9472d':node.kind==='counter'?'#285ec4':'#fff'
          return <g key={index}><circle cx={node.x} cy={node.y} r={node.kind==='audience'?7:11} fill={fill} stroke={node.kind==='audience'?'#8f978b':fill} strokeWidth="1.5"/><text x={node.x} y={node.y+25} fill="#666c64" fontSize="7" textAnchor="middle">{node.kind}</text></g>
        })}
      </g>
      <g transform="translate(30 315)" opacity={step>=2?1:.14}>
        <rect width="230" height="72" rx="5" fill="#fff" stroke="#d9ddd4"/>
        <text x="15" y="21" fill="#666c64" fontSize="9">paired-user evidence</text>
        <text x="15" y="44" fill="#111310" fontSize="12">language · activity · strategy · reach</text>
        <text x="15" y="61" fill="#666c64" fontSize="8">population-level comparison, not individual diagnosis</text>
      </g>
      <g transform="translate(280 315)" opacity={step>=4?1:.14}>
        <rect width="230" height="72" rx="5" fill="#fff" stroke="#d9ddd4"/>
        <text x="15" y="21" fill="#666c64" fontSize="9">intervention output</text>
        <text x="15" y="44" fill="#111310" fontSize="12">{counter>=threshold?'prioritize contextual review':'observe · insufficient signal'}</text>
        <text x="15" y="61" fill="#666c64" fontSize="8">never an automatic sanction</text>
      </g>
    </svg>
  )
}

export function CounterspeechChapter() {
  const [step,setStep]=useState(0)
  const [counter,setCounter]=useState(.58)
  const [homophily,setHomophily]=useState(.46)
  const [threshold,setThreshold]=useState(.62)
  const activeEdges=SOCIAL_EDGES.filter(([a,b],index)=>(SOCIAL_NODES[a].kind==='counter'||SOCIAL_NODES[b].kind==='counter')&&counter>(index%7)/7).length
  return (
    <ChapterScaffold
      eyebrow="Social computing · counterspeech"
      title="Understand the response around harmful speech."
      thesis="Hate and counterspeech are not isolated sentences. They are behaviours embedded in interaction networks, audiences, and community-specific strategies."
      status="2020 · published research"
      steps={SOCIAL_STEPS} activeStep={step} onStepChange={setStep}
      stage={<SocialStage step={step} counter={counter} homophily={homophily} threshold={threshold}/>} insight={[
        'The scientific object begins as an interaction: user, response, audience, and repeated behaviour.',
        'A protective response can be misclassified if a system ignores who is being targeted and why the reply exists.',
        'The released dataset pairs hate and counter users so behavioural asymmetries can be measured systematically.',
        `${activeEdges} displayed paths currently carry the conceptual counterspeech signal. This is not a causal estimate from the paper.`,
        counter>=threshold?'The interface recommends contextual review; it still refuses automatic sanction.':'The displayed signal remains below the review threshold.',
        'Population-level findings should guide better questions and safer review—not label an individual permanently.',
      ][step]}
      controls={<div className="chapter-control-grid"><RangeControl label="Counterspeech activity" value={counter} min={0} max={1} step={.01} display={`${Math.round(counter*100)}%`} onChange={setCounter}/><RangeControl label="Community separation" value={homophily} min={0} max={1} step={.01} display={`${Math.round(homophily*100)}%`} onChange={setHomophily}/><RangeControl label="Contextual review threshold" value={threshold} min={.2} max={.9} step={.01} display={`${Math.round(threshold*100)}%`} onChange={setThreshold}/></div>}
      inspect={<InspectGrid items={[["protective paths",String(activeEdges),"Conceptual propagation paths in this instrument."],["community separation",homophily.toFixed(2),"A manipulable intuition parameter, not a recovered paper coefficient."],["decision",counter>=threshold?'human review':'observe',"The interface deliberately exposes no auto-enforcement path."]]} formal="Empirical unit: annotated hate–counter user pairs. Analysis includes lexical, linguistic, psycholinguistic, activity, and popularity comparisons across communities."/>}
      contribution={['A released paired-user dataset that makes hate–counterspeech interaction measurable rather than anecdotal.','Annotate and analyse paired hate and counter users instead of treating every message independently.','Expose behavioural, linguistic, and popularity asymmetries between the populations.','Show that counterspeech strategies differ with target-community context, motivating more specific intervention design.']}
      evidence={[
        { label:'Publication', title:'Interaction dynamics between hate and counter users on Twitter', note:'The complete empirical study, annotation design, analyses, and limitations.', href:'https://dl.acm.org/doi/abs/10.1145/3371158.3371172' },
        { label:'Open repository', title:'Twitter-Hate-and-counter-speakers', note:'Public code and data context associated with the work.', href:'https://github.com/KumarNavish/Twitter-Hate-and-counter-speakers' },
        { label:'Scientific boundary', title:'Association and descriptive asymmetry', note:'The motion sequence is a guided intuition; it does not convert the study into a causal diffusion model.' },
      ]}
      boundary="The work studies platform-specific, annotated behavioural data and reports associations. It does not establish individual intent, causal treatment effects, or a universally safe automated moderation policy."
      next={{ title:'CasePath', question:'How can evidence stay bounded and reviewable as it enters a long decision process?', route:'/systems/casepath' }}
    />
  )
}

const CASE_STEPS: ChapterStep[] = [
  { label:'Problem', title:'A fluent answer can quietly outrun its evidence.', body:'Long-horizon cases contain documents, dates, missing facts, authority changes, and procedural dependencies. A language model that jumps directly from text to advice can hide uncertainty inside persuasive prose.', cue:'The raw sources begin unstructured and mutually incomplete.' },
  { label:'Why it matters', title:'A small unsupported fact can alter the entire downstream process.', body:'When the output affects housing, insurance, benefits, or legal procedure, fabricated certainty is not a cosmetic error. It can trigger the wrong deadline, document request, escalation, or action.', cue:'Remove one required fact and watch the process stop rather than improvise.' },
  { label:'Key idea', title:'Separate fallible interpretation from deterministic permission.', body:'Models may propose bounded facts with citations and uncertainty. Deterministic gates decide whether the validated state is sufficient to instantiate a process transition.', cue:'The model extracts; the gate permits or refuses.' },
  { label:'Mechanism', title:'Build a reviewable process graph, not a one-shot answer.', body:'Accepted facts create typed state, checklist obligations, dependencies, and evidence traces. Corrections update affected descendants while preserving the audit path.', cue:'The artifact grows only after each prerequisite clears.' },
  { label:'What changes', title:'The system can say exactly why it cannot proceed.', body:'Missing evidence, conflicting authority, or an invalid transition becomes a visible blocked state with the next required action—not an invented completion.', cue:'A refusal becomes operationally useful because it names the missing prerequisite.' },
  { label:'Boundary', title:'Process safety is not legal authority.', body:'A reviewable system still requires current sources, qualified domain review, jurisdictional constraints, privacy protection, and governance. The architecture controls failure surfaces; it does not abolish them.', cue:'Human authority remains a first-class node, not a decorative disclaimer.' },
]

type CaseFact={label:string;required:number}
const CASE_FACTS:CaseFact[]=[
  {label:'signed lease',required:.20},{label:'notice date',required:.38},{label:'payment record',required:.52},{label:'correspondence',required:.68},{label:'jurisdiction',required:.82},
]

function CasePathStage({ step,completeness,strictness,human }: { step:number;completeness:number;strictness:number;human:boolean }) {
  const accepted=CASE_FACTS.filter((fact)=>completeness>=fact.required).length
  const conflict=completeness>.42&&completeness<.63
  const pass=accepted>=Math.ceil(3+strictness*2)&&!conflict
  const stages=['sources','bounded extraction','deterministic gate','process state','action artifact']
  return (
    <svg viewBox="0 0 540 430" role="img" aria-label="CasePath converts cited evidence into a gated process artifact">
      <rect width="540" height="430" fill="#f5f6f2"/>
      <text x="28" y="31" fill="#666c64" fontSize="10">evidence-to-process execution trace</text>
      {stages.map((stage,index)=>{
        const x=28+index*102
        const complete=index===0||index===1?accepted>=index+2:index===2?pass:index>2?pass:false
        const blocked=index>=2&&!pass
        return <g key={stage} opacity={step>=Math.max(0,index-1)?1:.15}><rect x={x} y={102+(index%2)*26} width="82" height="80" rx="6" fill={complete?'rgba(27,107,80,.09)':blocked?'rgba(201,71,45,.08)':'#fff'} stroke={complete?'#1b6b50':blocked?'#c9472d':'#aeb4aa'} strokeWidth={complete||blocked?2:1}/><text x={x+41} y={135+(index%2)*26} fill="#111310" fontSize="8" textAnchor="middle">{stage}</text><text x={x+41} y={158+(index%2)*26} fill={complete?'#1b6b50':blocked?'#c9472d':'#666c64'} fontSize="8" textAnchor="middle">{complete?'complete':blocked?'blocked':'pending'}</text>{index<4?<path d={`M ${x+82} ${142+(index%2)*26} L ${x+102} ${142+((index+1)%2)*26}`} fill="none" stroke={complete?'#1b6b50':'#cfd4cb'} strokeWidth="2"/>:null}</g>
      })}
      <g transform="translate(30 242)" opacity={step>=1?1:.18}>
        <rect width="245" height="145" rx="5" fill="#fff" stroke="#d9ddd4"/>
        <text x="14" y="21" fill="#666c64" fontSize="9">extracted facts · each must cite a source</text>
        {CASE_FACTS.map((fact,index)=>{
          const present=index<accepted
          return <g key={fact.label}><circle cx="18" cy={45+index*18} r="4" fill={present?'#1b6b50':'#fff'} stroke={present?'#1b6b50':'#aeb4aa'}/><text x="30" y={48+index*18} fill={present?'#111310':'#8f978b'} fontSize="9">{fact.label}</text><text x="219" y={48+index*18} fill={present?'#1b6b50':'#c9472d'} fontSize="8" textAnchor="end">{present?'cited':'missing'}</text></g>
        })}
      </g>
      <g transform="translate(294 242)" opacity={step>=4?1:.18}>
        <rect width="216" height="145" rx="5" fill="#111310"/>
        <text x="14" y="22" fill="#bfc4ba" fontSize="9">gate result</text>
        <text x="14" y="51" fill="#fff" fontSize="15">{pass?'process permitted':'stop · evidence insufficient'}</text>
        <text x="14" y="77" fill="#bfc4ba" fontSize="9">{conflict?'conflicting dates require resolution':pass?'typed checklist and trace created':`need ${Math.max(0,Math.ceil(3+strictness*2)-accepted)} more required fact(s)`}</text>
        <text x="14" y="107" fill={human?'#e5b64d':'#c9472d'} fontSize="9">human authority: {human?'required at decision':'disabled · unsafe mode'}</text>
      </g>
    </svg>
  )
}

export function CasePathChapter() {
  const [step,setStep]=useState(0)
  const [completeness,setCompleteness]=useState(.74)
  const [strictness,setStrictness]=useState(.62)
  const [human,setHuman]=useState(true)
  const accepted=CASE_FACTS.filter((fact)=>completeness>=fact.required).length
  const required=Math.ceil(3+strictness*2)
  const conflict=completeness>.42&&completeness<.63
  const pass=accepted>=required&&!conflict&&human
  return (
    <ChapterScaffold
      eyebrow="Agent infrastructure · reviewable procedural work"
      title="Let evidence earn each process transition."
      thesis="CasePath is an architecture for converting fallible semantic extraction into bounded, inspectable, correction-stable procedural action under evolving authority."
      status="Active system research"
      steps={CASE_STEPS} activeStep={step} onStepChange={setStep}
      stage={<CasePathStage step={step} completeness={completeness} strictness={strictness} human={human}/>} insight={[
        'The documents are not yet a case state. Dates, authority, source identity, and missing fields remain unresolved.',
        conflict?'A date conflict is visible. The pipeline stops instead of selecting the more convenient interpretation.':'The displayed facts are incomplete but internally consistent.',
        'Semantic extraction proposes bounded values with citations; executable transitions remain deterministic.',
        pass?'The validated state can now instantiate a typed process and checklist.':'The process graph cannot be instantiated from the present evidence.',
        pass?'The artifact records what was used, what was decided, and which human authority remains responsible.':`The refusal is actionable: ${Math.max(0,required-accepted)} required fact(s) or a conflict still block the transition.`,
        human?'Human authority remains mandatory at the final decision boundary.':'Disabling human authority makes this configuration explicitly unsafe.',
      ][step]}
      controls={<div className="chapter-control-grid"><RangeControl label="Evidence completeness" value={completeness} min={0} max={1} step={.01} display={`${Math.round(completeness*100)}%`} onChange={setCompleteness}/><RangeControl label="Gate strictness" value={strictness} min={0} max={1} step={.01} display={`${Math.round(strictness*100)}%`} onChange={setStrictness}/><div className="chapter-control"><span>Decision authority<output>{human?'human required':'disabled'}</output></span><div className="chapter-control-buttons"><button type="button" className={human?'is-active':''} onClick={()=>setHuman(true)}>Require human</button><button type="button" className={!human?'is-active':''} onClick={()=>setHuman(false)}>Disable for stress test</button></div></div></div>}
      inspect={<InspectGrid items={[["cited facts",`${accepted}/${CASE_FACTS.length}`,"Only source-linked facts enter typed state."],["gate requirement",`${required} facts`,conflict?'A conflict blocks passage regardless of count.':'Count and consistency must both pass.'],["execution verdict",pass?'permit process':'stop',pass?'Checklist and evidence trace may be instantiated.':'No downstream action is fabricated.']]} formal="Transition rule: permit(s → s′) only if schema-valid evidence E satisfies deterministic prerequisites P(s,E,authority). Model hypotheses may populate E; they may not redefine P at runtime."/>}
      contribution={['An agent architecture in which procedural progress is earned through evidence rather than generated through confidence.','Separate cited semantic extraction from deterministic transition permission.','Represent process state, dependencies, checklists, authority, and correction lineage explicitly.','Treat “cannot proceed” as a useful system output with a named missing prerequisite and review path.']}
      evidence={[
        { label:'Live system', title:'CasePath', note:'The public execution environment and its evolving process, evidence, and verification surfaces.', href:'https://kumarnavish.github.io/casepath/' },
        { label:'System record', title:'CasePath source and verification workflows', note:'Repository artifacts include release gates, acceptance tests, reconstruction workflows, and knowledge-transfer documentation.', href:'https://github.com/KumarNavish/KumarNavish.github.io' },
        { label:'Research boundary', title:'Architecture before universal method claims', note:'The portfolio distinguishes implemented process infrastructure from still-open foundational learning questions.' },
      ]}
      boundary="Reviewability reduces hidden failure; it does not create legal, medical, insurance, or administrative authority. Every deployed domain still needs current sources, privacy controls, qualified reviewers, and jurisdiction-specific governance."
      next={{ title:'Spatial intelligence', question:'Can the same inspectable transition from language to state become a persistent world?', route:'/research/spatial-intelligence' }}
    />
  )
}
