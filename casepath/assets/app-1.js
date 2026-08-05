const DATA_URLS = {
  claims: 'data/claims.json',
  knowledge: 'data/knowledge.json',
  profiles: 'data/profiles.json',
  metrics: 'data/metrics.json',
  manifest: 'data/manifest.json',
};

const MODEL_ID = 'nvidia/nemotron-3-super-120b-a12b:free';
const APP_TITLE = 'CasePath Swiss Claim Lab';
const RELEASE_VERSION = '1.0.0';
const FREE_DAILY_LIMIT = 50;

const safeLocal = {
  get(key) { try { return window.localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { window.localStorage.setItem(key, value); } catch { } },
  remove(key) { try { window.localStorage.removeItem(key); } catch { } },
};
const safeSession = {
  get(key) { try { return window.sessionStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { window.sessionStorage.setItem(key, value); } catch { } },
  remove(key) { try { window.sessionStorage.removeItem(key); } catch { } },
};

const state = {
  data: null,
  view: 'journey',
  mode: safeLocal.get('casepath_mode') || 'public',
  claimId: safeLocal.get('casepath_claim') || 'DEF-003-E1',
  profileId: safeLocal.get('casepath_profile') || 'reference',
  analysisStatus: 'ready',
  runningStage: -1,
  selectedNodeId: null,
  selectedDocType: null,
  drawer: null,
  modal: null,
  sidebarOpen: false,
  claimLibraryOpen: false,
  filters: { q: '', language: 'all', scope: 'all', subcategory: 'all', complexity: 'all' },
  compare: { a: 'reference', b: 'static' },
  knowledgeQuery: '',
  knowledgeTab: 'claims',
  reviewDecision: 'approve',
  reviewEdits: [],
  reviewComment: '',
  liveRuns: JSON.parse(safeLocal.get('casepath_live_runs') || '{}'),
  generatedClaims: JSON.parse(safeLocal.get('casepath_generated_claims') || '[]'),
  openRouter: { key: safeSession.get('casepath_openrouter_key') || null, info: null, connecting: false },
  toasts: [],
};

const STAGES = [['intake','Intake'],['interpret','Understand'],['scope','Legal scope'],['category','Category'],['process','Process'],['checklist','Documents'],['action','Next action'],['review','Safety review']];
const MODULES = [
  { id:'orchestrator',name:'Pipeline orchestrator',role:'Runs the typed sequence, records state and applies fallbacks.',input:'ObservableClaimPackage + PipelineProfile',output:'RunReceipt + stage outputs',tools:['cache','trace store'],validator:'Run receipt completeness' },
  { id:'interpret',name:'Claim interpreter',role:'Proposes a source-linked Canonical Claim State from message and documents.',input:'ObservableClaimPackage',output:'CanonicalClaimState',tools:['safe document preview','fact registry'],validator:'Fact schema + source pointers' },
  { id:'scope',name:'Legal scope agent',role:'Proposes whether a current Swiss tenant-law dispute exists.',input:'CanonicalClaimState + approved context',output:'ScopeAssessment',tools:['legal source registry'],validator:'Closed scope vocabulary' },
  { id:'category',name:'Claim categorizer',role:'Selects a bounded defects subcategory without changing workflow structure.',input:'CanonicalClaimState',output:'CategoryAssessment',tools:['subcategory registry'],validator:'Category enum + evidence support' },
  { id:'process',name:'Process identification agent',role:'Proposes or executes the claim-specific process and first actionable blocker.',input:'CanonicalClaimState + ProcessLibrary',output:'ClaimProcessInstance',tools:['process library lookup'],validator:'Acyclic graph + one selected branch' },
  { id:'checklist',name:'Document checklist agent',role:'Derives evidence requirements from reached process nodes.',input:'ClaimProcessInstance + CanonicalClaimState',output:'ProcessDerivedChecklist',tools:['document registry lookup'],validator:'Node ownership + no repeat requests' },
  { id:'action',name:'Next-action agent',role:'Chooses the next safe human action and parallel deadline preservation where needed.',input:'Process + Checklist + Scope',output:'NextAction',tools:['safety gate'],validator:'No unsupported automation' },
  { id:'evaluator',name:'Evaluation agent',role:'Scores outputs against constraints and flags safety failures.',input:'Run artifacts + GroundTruthConstraints',output:'EvaluationReceipt',tools:['constraint evaluator'],validator:'Metric and evidence boundary checks' },
  { id:'adaptation',name:'Knowledge consolidation agent',role:'Turns repeated reviewed corrections into a quarantined candidate patch.',input:'ReviewedCorrections + protected set',output:'GovernedPatchCandidate',tools:['program synthesizer','regression suite'],validator:'Support threshold + no protected regression' },
];

const FACT_LABELS={tenancy_relation_established:'Tenancy relation established',swiss_jurisdiction:'Swiss jurisdiction',duplicate_claim:'Duplicate claim',defect_current:'Current defect',health_risk:'Immediate health risk',heating_emergency:'Heating emergency',urgent_response_completed:'Urgent triage completed',deadline_status:'Deadline status',deadline_preservation_completed:'Deadline preserved',landlord_notified:'Landlord notified',notice_proof_available:'Proof of notification available',landlord_response_known:'Landlord response known',cause_disputed:'Cause disputed',recurring_condensation:'Recurring condensation',landlord_alleges_ventilation:'Landlord alleges ventilation behaviour',ventilation_allegation_relevant:'Ventilation allegation is relevant',technical_report_disproves_ventilation:'Technical report contradicts allegation',visual_evidence_conflicts_with_moisture_claim:'Visual evidence conflicts with claim',independent_assessment_available:'Independent assessment available',heating_assessment_complete:'Heating assessment complete',inspection_access_disputed:'Inspection access disputed',evidence_complete:'Core evidence complete',remedy_objective_known:'Requested remedy known',repair_completed:'Repair completed',ventilation_evidence_complete:'Ventilation evidence complete'};
const NODE_LABELS={scope_gate:'Confirm the handling scope',urgent_triage:'Check immediate risk',urgent_response:'Complete urgent triage',urgent_response_pending:'Escalate the immediate risk',deadline_triage:'Check time-sensitive risk',deadline_preservation:'Preserve the possible deadline',deadline_preservation_pending:'Deadline action is pending',deadline_information:'Establish the relevant date',notice:'Check landlord notification',notice_required:'Landlord notification is missing',causation:'Resolve the disputed cause',ventilation_obligation:'Test the ventilation allegation',ventilation_evidence_required:'Collect ventilation evidence',technical_assessment:'Check technical assessment',technical_assessment_required:'Technical assessment is needed',heating_assessment:'Check heating evidence',heating_assessment_required:'Heating assessment is incomplete',inspection_access:'Check inspection access',inspection_access_resolution:'Resolve inspection access',evidence_sufficiency:'Check the core evidence',evidence_collection:'Collect the missing core evidence',remedy_objective:'Clarify the customer objective',objective_clarification:'Customer objective is unclear',repair_monitoring:'Check repair progress',monitor_repair:'Monitor repair',conciliation_readiness:'Prepare the next formal step',terminal_no_dispute:'No current dispute',terminal_out_of_scope:'Outside supported scope',terminal_duplicate:'Duplicate submission',terminal_scope_review:'Scope needs human review'};
const DOC_LABELS={lease_contract:'Lease contract',medical_confirmation:'Medical confirmation',humidity_temperature_log:'Humidity and temperature log',urgent_response_record:'Urgent response record',deadline_source:'Deadline source',deadline_filing_record:'Deadline filing record',proof_of_notification:'Proof of notification',landlord_response:'Landlord response',technical_inspection:'Technical inspection',building_envelope_assessment:'Building envelope assessment',ventilation_diary:'Ventilation diary',ventilation_allegation_correspondence:'Ventilation allegation correspondence',heating_service_report:'Heating service report',dated_photos:'Dated photos',customer_objective_record:'Customer objective record',repair_record:'Repair record'};
const ACTION_LABELS={request_evidence:'Request targeted evidence',urgent_escalation:'Escalate for urgent human triage',preserve_deadline:'Preserve the possible deadline',review_existing_evidence:'Review evidence already present',expert_review:'Send to expert review',monitor_repair:'Monitor repair progress',prepare_conciliation:'Prepare the next formal step',close_no_dispute:'Close: no current dispute',out_of_scope:'Route outside supported scope',link_duplicate:'Link to existing claim'};

function esc(value){return String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));}
function attr(value){return esc(value).replace(/`/g,'&#96;');}
function pretty(value){return String(value??'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());}
function fmtDate(value){try{return new Intl.DateTimeFormat('en-CH',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}catch{return value;}}
function fmtSize(bytes){if(!bytes)return'—';if(bytes<1024)return`${bytes} B`;if(bytes<1048576)return`${(bytes/1024).toFixed(1)} KB`;return`${(bytes/1048576).toFixed(1)} MB`;}
function valueLabel(value){if(value===true)return'Yes';if(value===false)return'No';if(value==null||value==='unknown')return'Unknown';return pretty(value);}
function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
function nowIso(){return new Date().toISOString();}
function uuid(){if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();const bytes=globalThis.crypto?.getRandomValues?crypto.getRandomValues(new Uint8Array(16)):Array.from({length:16},()=>Math.floor(Math.random()*256));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const h=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');return`${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}

function icon(name,cls=''){
  const paths={menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',journey:'<path d="M5 6h5v5H5zM14 13h5v5h-5zM10 8.5h2a4 4 0 0 1 4 4v.5"/>',knowledge:'<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5zM20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5z"/>',compare:'<path d="M7 4v16M17 4v16M4 7l3-3 3 3M14 17l3 3 3-3"/>',pipeline:'<circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M8 6h8M7 8l4 8M17 8l-4 8"/>',review:'<path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h3"/>',play:'<path d="m8 5 11 7-11 7z"/>',chevron:'<path d="m9 18 6-6-6-6"/>',close:'<path d="M6 6l12 12M18 6 6 18"/>',file:'<path d="M6 2h8l4 4v16H6zM14 2v5h5"/>',search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',plus:'<path d="M12 5v14M5 12h14"/>',download:'<path d="M12 3v12m0 0 5-5m-5 5-5-5M4 21h16"/>',inspect:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M4 12h2M18 12h2M12 4v2M12 18v2"/>',check:'<path d="m5 12 4 4L19 6"/>',alert:'<path d="M12 3 2.8 20h18.4zM12 9v4M12 17h.01"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',external:'<path d="M14 4h6v6M20 4l-9 9M18 13v7H4V6h7"/>',edit:'<path d="m4 20 4.5-1 10-10-3.5-3.5-10 10zM13.5 7 17 10.5"/>',shield:'<path d="M12 2 20 5v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5zM8 12l2.5 2.5L16 9"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',git:'<circle cx="6" cy="5" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="19" r="2"/><path d="M6 7v10M8 8c4 0 2-2 8-2"/>',copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>'};
  return`<svg class="${cls}" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]||paths.info}</svg>`;
}
