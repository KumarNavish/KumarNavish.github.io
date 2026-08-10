import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL=(process.env.BASE_URL||'https://casepath-guided-v13-preview.onrender.com').replace(/\/$/,'');
const PREVIEW_API='https://casepath-full-lifecycle-v15-api.onrender.com';
const API_URL=(BASE_URL.includes('guided-v13-preview')?PREVIEW_API:(process.env.API_URL||'https://casepath-agentic-api.onrender.com')).replace(/\/$/,'');
const OUT=path.resolve('guided-v13-smoke-out');
const checks=[];
const errors={console:[],page:[],requests:[]};
let browser,page;

function record(name,passed,detail=''){
  const item={name,passed:Boolean(passed),detail};
  checks.push(item);
  if(!item.passed) throw new Error(`${name}: ${detail||'failed'}`);
}
async function visible(selector,timeout=120000){await page.locator(selector).waitFor({state:'visible',timeout});}
async function screenshot(name,fullPage=false){await page.screenshot({path:path.join(OUT,name),fullPage});}
async function stageText(){return (await page.locator('#guideStage').innerText()).trim();}
async function nextStep(expectedNumber){await page.locator('#guideNext').click();await page.waitForFunction(n=>document.querySelector('#guideStepNumber')?.textContent?.trim()===String(n),expectedNumber,{timeout:30000});}
async function json(url,options={}){
  const response=await fetch(url,options);
  if(!response.ok) throw new Error(`${options.method||'GET'} ${url}: ${response.status}`);
  return response.json();
}
async function pollRun(runId,timeout=160000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    const run=await json(`${API_URL}/api/runs/${runId}`);
    if(run.status==='complete') return run;
    if(run.status==='failed') throw new Error(run.error||'run failed');
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw new Error(`run ${runId} timed out`);
}

async function main(){
  await fs.rm(OUT,{recursive:true,force:true});
  await fs.mkdir(OUT,{recursive:true});

  const health=await json(`${API_URL}/healthz`);
  record('API reports the full lifecycle release',health.status==='ok'&&health.pipeline_release==='15.0.0',JSON.stringify(health));
  record('API exposes one orchestrator profile',/orchestrator/i.test(health.orchestrator||'')&&health.profile==='full-process-reference-agents',JSON.stringify({orchestrator:health.orchestrator,profile:health.profile}));
  const deployment=await json(`${API_URL}/deployment-health`);
  record('Frontend/API contract identifies guided lifecycle v15',deployment.frontend_contract==='guided-full-lifecycle-v15',JSON.stringify(deployment));
  const reset=await json(`${API_URL}/api/demo/reset`,{method:'POST'});
  record('Demo begins from playbook v3',reset.status==='reset'&&reset.active_playbook==='mould-playbook-v3',JSON.stringify(reset));

  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
  page=await context.newPage();
  page.on('console',message=>{if(message.type()==='error')errors.console.push(message.text());});
  page.on('pageerror',error=>errors.page.push(String(error)));
  page.on('requestfailed',request=>{const url=request.url();if(url.startsWith(BASE_URL)||url.startsWith(API_URL))errors.requests.push(`${request.failure()?.errorText||'failed'} ${url}`);});

  const publicUrl=`${BASE_URL}/?api=${encodeURIComponent(API_URL)}&lifecycle-qa=${Date.now()}`;
  const response=await page.goto(publicUrl,{waitUntil:'domcontentloaded',timeout:120000});
  record('Public lifecycle page returns HTTP 200',response?.status()===200,`status=${response?.status()}`);
  record('Browser remains on the requested public product',page.url().startsWith(`${BASE_URL}/`),page.url());
  await visible('#analyseBtn');
  await page.waitForFunction(()=>document.querySelectorAll('.attachment-row').length>=6,null,{timeout:120000});
  record('Original customer message loads',await page.locator('#customerMessage .email-body').isVisible());
  record('Six original source attachments load',await page.locator('.attachment-row').count()===6,`files=${await page.locator('.attachment-row').count()}`);
  record('Opening copy promises the complete process and knowledge loop',/complete handling process|reusable knowledge/i.test(await page.locator('.intro-lede').innerText()));
  await screenshot('01-original-submission.png');

  await page.locator('[data-artifact-id="art_lease"]').first().click();
  await visible('#artifactViewer[open]');
  await visible('#pdfPageImage');
  record('Actual PDF pages render in the source viewer',String(await page.locator('#pdfPageImage').getAttribute('src')).includes('/pages/'));
  record('Original and extracted representations remain separate',await page.locator('[data-viewer-tab="original"]').count()===1&&await page.locator('[data-viewer-tab="extraction"]').count()===1);
  await screenshot('02-actual-pdf.png');
  await page.locator('#closeViewer').click();

  await page.locator('[data-artifact-id="art_photo"]').first().click();
  await visible('#artifactViewer[open]');
  await visible('#sourceImage');
  record('Actual photographic evidence renders',String(await page.locator('#sourceImage').getAttribute('src')).includes('/api/artifacts/art_photo'));
  await screenshot('03-actual-photo.png');
  await page.locator('#closeViewer').click();

  await page.locator('#analyseBtn').click();
  await visible('#analysis');
  await page.waitForFunction(()=>document.querySelectorAll('#stageList .stage-item').length===7,null,{timeout:30000});
  record('Seven human-readable specialist stages are visible',await page.locator('#stageList .stage-item').count()===7);
  record('One orchestrator and one shared claim context are visible',await page.locator('#v15Orchestrator').isVisible()&&/shared claim context/i.test(await page.locator('#v15Orchestrator').innerText()));
  await page.waitForFunction(()=>document.querySelectorAll('#stageList .v15-agent-meta strong').length>=3,null,{timeout:90000});
  record('Specialist outputs appear as typed handoffs during execution',await page.locator('#stageList .v15-agent-meta strong').count()>=3);
  await screenshot('04-agents-processing.png');

  await page.waitForFunction(()=>{const guide=document.querySelector('#guide');return guide&&!guide.hidden&&document.querySelector('#guideStepNumber')?.textContent?.trim()==='1';},null,{timeout:180000});
  await page.waitForFunction(()=>/Complete claim-handling playbook ready/i.test(document.querySelector('#analysisLive')?.innerText||''),null,{timeout:30000});
  const completeText=await page.locator('#analysisLive').innerText();
  record('Completion summarizes the full process and evidence model',/process nodes/i.test(completeText)&&/evidence relationships/i.test(completeText)&&/reviewed precedents/i.test(completeText),completeText);

  let text=await stageText();
  record('Step 1 still begins with what the customer sent',/what did the customer send|original files|original message/i.test(text),text.slice(0,220));
  record('Technical depth stays hidden at intake',await page.locator('#detailDialog[open]').count()===0);

  await nextStep(2);
  await visible('#guideStage .v15-contribution-list');
  text=await stageText();
  record('Step 2 explains the specialist team rather than architecture boxes',/what did each specialist contribute/i.test(text)&&/one orchestrator/i.test(text),text.slice(0,260));
  record('Seven specialist contributions are visible',await page.locator('#guideStage .v15-contribution-list li').count()===7,`agents=${await page.locator('#guideStage .v15-contribution-list li').count()}`);
  record('Each specialist shows its question, artifact and handoff',await page.locator('#guideStage .v15-contribution-output').count()===7);
  record('Process, evidence and verification artifacts are named',/Full process graph|Evidence model|Verification report/i.test(text));
  await screenshot('05-agent-contributions.png',true);
  await page.locator('#guideDetail').click();
  await visible('#detailDialog[open]');
  record('Agent handoff detail preserves inputs and outputs',await page.locator('#detailContent .v15-agent-handoffs article').count()>=7);
  await page.locator('#closeDetail').click();

  await nextStep(3);
  await visible('#guideStage .v15-process');
  text=await stageText();
  record('Step 3 leads with the complete discovered process',/what complete process did the agents discover/i.test(text)&&/intake to resolution/i.test(text),text.slice(0,280));
  record('The default graph shows eleven main lifecycle stages',await page.locator('#guideStage .v15-process-node').count()===11,`nodes=${await page.locator('#guideStage .v15-process-node').count()}`);
  record('The full graph visibly includes intake, dispute, evidence, remedy, escalation and closure',/Claim intake/i.test(text)&&/Existence of a dispute/i.test(text)&&/Remedy selection/i.test(text)&&/Escalation/i.test(text)&&/Resolution and closure/i.test(text));
  record('The current decision is overlaid inside the full graph',await page.locator('#guideStage .v15-process-node.current').count()===1);
  record('Downstream responsibility and remedy remain visibly blocked',await page.locator('#guideStage .v15-process-node.blocked').count()>=2);
  record('Alternative causation outcomes are collapsed by default',await page.locator('#guideStage .v15-branch-options[hidden]').count()===1);
  await page.locator('#guideStage [data-v15-toggle-branches]').click();
  await visible('#guideStage .v15-branch-options');
  record('Four meaningful causation outcomes can be revealed',await page.locator('#guideStage .v15-branch-options article').count()===4);
  await screenshot('06-full-process-graph.png',true);
  await page.locator('#guideDetail').click();
  await visible('#detailDialog[open]');
  record('The full graph detail exposes all conditional branch and outcome nodes',await page.locator('#detailContent .v15-branch-catalog button').count()>=8,`branchNodes=${await page.locator('#detailContent .v15-branch-catalog button').count()}`);
  record('A process node exposes linked facts, evidence and law',await page.locator('#detailContent .v15-selected-node').count()===1&&await page.locator('#detailContent .v15-detail-law').count()>=1);
  record('Graph validation remains inspectable',/one current node|all selected edges connect/i.test(await page.locator('#detailContent').innerText()));
  await page.locator('#closeDetail').click();

  await nextStep(4);
  await visible('#guideStage .v15-current-decision');
  text=await stageText();
  record('Step 4 subordinates current state to the full process',/where is this claim inside the full process/i.test(text)&&/overlay/i.test(text),text.slice(0,260));
  record('Completed, current, blocked and immediate-action states are explicit',await page.locator('#guideStage .v15-overlay-grid section').count()===3&&await page.locator('#guideStage .v15-next-action').count()===1);
  record('The current question remains clear without dominating the product thesis',/What caused the recurring moisture condition/i.test(text));
  await screenshot('07-current-claim-overlay.png');

  await nextStep(5);
  await visible('#guideStage .v15-evidence-groups');
  text=await stageText();
  record('Step 5 presents the complete process-grounded evidence model',/what complete evidence model follows from that process/i.test(text),text.slice(0,260));
  record('The process→fact→evidence→document-state derivation is explicit',await page.locator('#guideStage .v15-derivation>div').count()===4);
  record('Evidence spans at least nine process nodes',await page.locator('#guideStage .v15-evidence-group').count()>=9,`groups=${await page.locator('#guideStage .v15-evidence-group').count()}`);
  record('At least fifteen evidence relationships are present',await page.locator('#guideStage .v15-evidence-item').count()>=15,`items=${await page.locator('#guideStage .v15-evidence-item').count()}`);
  record('Sufficient, insufficient, missing, conditional and not-applicable states all exist',
    await page.locator('#guideStage .v15-evidence-item.provided_sufficient').count()>=1&&
    await page.locator('#guideStage .v15-evidence-item.provided_insufficient').count()>=1&&
    await page.locator('#guideStage .v15-evidence-item.missing').count()>=1&&
    await page.locator('#guideStage .v15-evidence-item.conditional').count()>=1&&
    await page.locator('#guideStage .v15-evidence-item.not_applicable').count()>=1);
  record('Every evidence relationship contains a reason',await page.locator('#guideStage .v15-evidence-item p').count()===await page.locator('#guideStage .v15-evidence-item').count());
  record('Conditional evidence states when it applies',await page.locator('#guideStage .v15-evidence-item.conditional em').count()>=1);
  await screenshot('08-complete-evidence-model.png',true);
  await page.locator('#guideDetail').click();
  await visible('#detailDialog[open]');
  record('The complete checklist remains grouped by process origin',await page.locator('#detailContent .v15-detail-block').count()>=8);
  record('Evidence-validator checks remain inspectable',/every requirement linked to a process node/i.test(await page.locator('#detailContent').innerText()));
  await page.locator('#closeDetail').click();

  await nextStep(6);
  await visible('#guideStage .v15-precedents');
  text=await stageText();
  record('Step 6 shows exactly three reviewed organizational precedents',await page.locator('#guideStage .v15-precedents article').count()===3);
  record('Every precedent explains the branch, decisive evidence and expert lesson',
    await page.locator('#guideStage .v15-precedents dl').count()===3&&
    /Relevant branch/i.test(text)&&/Evidence that mattered/i.test(text)&&/Expert lesson/i.test(text));
  await screenshot('09-three-precedents.png',true);

  await nextStep(7);
  await visible('#guidedReviewForm');
  record('Expert review edits the reasoning rather than reviewing every field',await page.locator('#guidedReviewForm .review-choice').count()===2);
  record('The review preview names the process and evidence consequences',await page.locator('#guideStage .v15-review-impact').count()===1&&/process node added/i.test(await page.locator('#guideStage .v15-review-impact').innerText()));
  await screenshot('10-expert-correction.png');
  await page.locator('#guidedReviewForm button[type="submit"]').click();
  await page.waitForFunction(()=>document.querySelector('#guideStepNumber')?.textContent?.trim()==='8',null,{timeout:90000});
  await visible('#guideStage .v15-knowledge-flow');
  text=await stageText();
  record('Step 8 shows an organizational playbook release, not only case memory',/what did the organization learn/i.test(text)&&/mould-playbook-v4/i.test(text));
  record('Knowledge evolution shows v3, supporting claims, governance tests and v4',/mould-playbook-v3/i.test(text)&&/supporting claims/i.test(text)&&/target/i.test(text)&&/protected/i.test(text)&&/mould-playbook-v4/i.test(text));
  record('The released update shows process, branch, evidence and rollback deltas',await page.locator('#guideStage .v15-knowledge-delta article').count()===4);
  record('Target and protected tests are visible as passed',/6\/6 target/i.test(text)&&/12\/12 protected/i.test(text));
  await screenshot('11-knowledge-release.png',true);

  await page.locator('#guideNext').click();
  await page.waitForFunction(()=>document.querySelector('.v15-before-after')!==null,null,{timeout:90000});
  text=await stageText();
  record('The learning proof compares an unseen claim before and after the playbook release',/unseen claim/i.test(text)&&/Before reviewed knowledge/i.test(text)&&/After reviewed knowledge/i.test(text));
  record('The proof shows v3→v4 process and evidence counts',/mould-playbook-v3/i.test(text)&&/mould-playbook-v4/i.test(text)&&/9 nodes/i.test(text)&&/11 nodes/i.test(text));
  record('The improved claim adds the ventilation node and conditionalizes broader testing',/Test the ventilation allegation/i.test(text)&&/Building-envelope assessment/i.test(text)&&/conditional/i.test(text));
  record('Protected regression and rollback remain visible',/12\/12 unchanged/i.test(text)&&/rollback/i.test(text));
  await screenshot('12-unseen-claim-improved.png',true);

  const laterCreated=await json(`${API_URL}/api/runs`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({claim_id:'DEMO-MOULD-002'})});
  const laterRun=await pollRun(laterCreated.run_id);
  const laterResult=laterRun.result;
  record('The unseen claim actually reruns under playbook v4',laterResult.playbook?.version==='mould-playbook-v4',laterResult.playbook?.version||'missing');
  record('The rerun contains the new disputed-ventilation process node',laterResult.process?.nodes?.some(node=>node.node_id==='ventilation_dispute'));
  record('The rerun makes building-envelope testing conditional',laterResult.checklist?.items?.some(item=>item.item_id==='building_envelope'&&item.status==='conditional'));
  record('The expert-reviewed flagship becomes the first precedent',laterResult.precedents?.[0]?.claim_id==='DEF-027-E0-DEMO',laterResult.precedents?.[0]?.claim_id||'missing');
  record('The improved rerun avoids the unnecessary immediate request',laterResult.generated_benchmark_metrics?.unnecessary_immediate_requests===0);

  await page.locator('#openAuditGuide').click();
  await visible('#auditDrawer[open]');
  const auditText=await page.locator('#auditContent').innerText();
  record('Audit trail includes all seven specialists',/Attachment Parsing Agent/i.test(auditText)&&/Claim Understanding Agent/i.test(auditText)&&/Legal Research Agent/i.test(auditText)&&/Process Discovery Agent/i.test(auditText)&&/Document Requirements Agent/i.test(auditText)&&/Historical Claims Agent/i.test(auditText)&&/Verification Agent/i.test(auditText));
  record('Audit trail includes expert review and knowledge consolidation',/Expert Feedback Agent/i.test(auditText)&&/Knowledge Consolidation Agent/i.test(auditText));
  record('Audit trail keeps prompts, validators and implementation identity available',/Prompt/i.test(auditText)&&/Validator/i.test(auditText)&&/Implementation/i.test(auditText));
  await page.locator('#closeAudit').click();

  for(const viewport of [{width:390,height:844,name:'390'},{width:320,height:700,name:'320'}]){
    await page.setViewportSize({width:viewport.width,height:viewport.height});
    await page.waitForTimeout(350);
    const overflow=await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-window.innerWidth);
    record(`${viewport.name}px has no page-level horizontal overflow`,overflow<=1,`overflow=${overflow}`);
    record(`${viewport.name}px keeps the guided lifecycle readable`,await page.locator('#guide').isVisible()&&await page.locator('.stage-answer').isVisible());
    record(`${viewport.name}px keeps one primary next action reachable`,await page.locator('#guideNext').count()===1);
    await screenshot(`13-mobile-${viewport.name}.png`,true);
  }

  record('No browser console errors',errors.console.length===0,JSON.stringify(errors.console));
  record('No page errors',errors.page.length===0,JSON.stringify(errors.page));
  record('No public request failures',errors.requests.length===0,JSON.stringify(errors.requests));

  await json(`${API_URL}/api/demo/reset`,{method:'POST'});
  const resetKnowledge=await json(`${API_URL}/api/knowledge`);
  record('Public demo is reset after verification',resetKnowledge.active_playbook?.version==='mould-playbook-v3',JSON.stringify(resetKnowledge.active_playbook));

  await context.close();
  await browser.close(); browser=null;
  const report={status:'passed',checkedAt:new Date().toISOString(),baseUrl:BASE_URL,apiUrl:API_URL,passed:checks.filter(item=>item.passed).length,failed:checks.filter(item=>!item.passed).length,checks,errors};
  await fs.writeFile(path.join(OUT,'report.json'),`${JSON.stringify(report,null,2)}\n`);
  const images=['01-original-submission.png','02-actual-pdf.png','03-actual-photo.png','04-agents-processing.png','05-agent-contributions.png','06-full-process-graph.png','07-current-claim-overlay.png','08-complete-evidence-model.png','09-three-precedents.png','10-expert-correction.png','11-knowledge-release.png','12-unseen-claim-improved.png','13-mobile-390.png','13-mobile-320.png'];
  await fs.writeFile(path.join(OUT,'index.html'),`<!doctype html><meta charset="utf-8"><title>CasePath full lifecycle QA</title><style>body{font:16px system-ui;max-width:1120px;margin:40px auto;padding:0 20px;color:#15171a}li{margin:7px 0;color:#18744f}img{max-width:100%;border:1px solid #ddd;margin:8px 0 30px}code{background:#f1f3f5;padding:2px 5px;border-radius:4px}</style><h1>CasePath full lifecycle QA: passed</h1><p><strong>${report.passed}</strong> checks passed against <code>${BASE_URL}</code> and <code>${API_URL}</code>.</p><ul>${checks.map(item=>`<li>✓ ${item.name}</li>`).join('')}</ul>${images.map(image=>`<h2>${image}</h2><img src="${image}" alt="${image}">`).join('')}`);
  console.log(JSON.stringify(report,null,2));
}

main().catch(async error=>{
  await fs.mkdir(OUT,{recursive:true});
  if(page) await page.screenshot({path:path.join(OUT,'failure.png'),fullPage:true}).catch(()=>null);
  const report={status:'failed',checkedAt:new Date().toISOString(),baseUrl:BASE_URL,apiUrl:API_URL,passed:checks.filter(item=>item.passed).length,failed:checks.filter(item=>!item.passed).length+1,checks,errors,error:error instanceof Error?error.stack:String(error)};
  await fs.writeFile(path.join(OUT,'report.json'),`${JSON.stringify(report,null,2)}\n`);
  console.error(report.error);
  process.exitCode=1;
}).finally(async()=>{if(browser) await browser.close().catch(()=>null);});
