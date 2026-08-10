import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL=(process.env.BASE_URL||'https://casepath-guided-v13-preview.onrender.com').replace(/\/$/,'');
const API_URL=(process.env.API_URL||'https://casepath-agentic-api.onrender.com').replace(/\/$/,'');
const OUT=path.resolve('guided-v13-smoke-out');
const checks=[];
const errors={console:[],page:[],requests:[]};
const runIds=[];
let browser,page;

function record(name,passed,detail=''){
  const item={name,passed:Boolean(passed),detail};
  checks.push(item);
  if(!item.passed) throw new Error(`${name}: ${detail||'failed'}`);
}
function escapeHtml(value=''){
  return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
async function json(url,options={}){
  const response=await fetch(url,options);
  if(!response.ok) throw new Error(`${options.method||'GET'} ${url}: ${response.status}`);
  return response.json();
}
async function visible(selector,timeout=150000){await page.locator(selector).waitFor({state:'visible',timeout});}
async function screenshot(name,fullPage=false){await page.screenshot({path:path.join(OUT,name),fullPage});}
async function waitText(selector,pattern,timeout=150000){
  await page.waitForFunction(({selector,source,flags})=>{
    const node=document.querySelector(selector);
    return node&&new RegExp(source,flags).test(node.textContent||'');
  },{selector,source:pattern.source,flags:pattern.flags},{timeout});
}
async function noOverflow(){
  return page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-window.innerWidth);
}
async function pollRun(runId,timeout=150000){
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
  record('API is the full-process lifecycle implementation',health.status==='ok'&&health.pipeline_release==='15.0.0',JSON.stringify(health));
  const reset=await json(`${API_URL}/api/demo/reset`,{method:'POST'});
  record('Demo begins from the pre-review playbook',reset.status==='reset'&&reset.active_playbook==='mould-playbook-v3',JSON.stringify(reset));

  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
  page=await context.newPage();
  page.on('console',message=>{if(message.type()==='error')errors.console.push(message.text());});
  page.on('pageerror',error=>errors.page.push(String(error)));
  page.on('requestfailed',request=>{
    const url=request.url();
    if(url.startsWith(BASE_URL)||url.startsWith(API_URL)) errors.requests.push(`${request.failure()?.errorText||'failed'} ${url}`);
  });
  page.on('response',async response=>{
    try{
      const url=new URL(response.url());
      const request=response.request();
      if(request.method()==='POST'&&url.origin===new URL(API_URL).origin&&url.pathname==='/api/runs'&&response.ok()){
        const payload=await response.json();
        if(payload.run_id&&!runIds.includes(payload.run_id)) runIds.push(payload.run_id);
      }
    }catch(_){ }
  });

  const publicUrl=`${BASE_URL}/?api=${encodeURIComponent(API_URL)}&live-workspace-qa=${Date.now()}`;
  const response=await page.goto(publicUrl,{waitUntil:'domcontentloaded',timeout:120000});
  record('Public workspace returns HTTP 200',response?.status()===200,`status=${response?.status()}`);
  record('Browser remains on the requested public product',page.url().startsWith(`${BASE_URL}/`),page.url());
  await visible('#runCasePath');
  await page.waitForFunction(()=>document.querySelectorAll('.attachment-row').length===6,null,{timeout:120000});
  record('The customer message stays visible beside CasePath',await page.locator('#customerEmail .email-body').isVisible());
  record('All six original attachments are first-class objects',await page.locator('.attachment-row').count()===6,`files=${await page.locator('.attachment-row').count()}`);
  record('One obvious action starts the uninterrupted demo',await page.locator('#runCasePath').count()===1&&/Watch CasePath handle this claim/i.test(await page.locator('#runCasePath').innerText()));
  record('The old report and guided-page structures are absent',await page.locator('.guide-section,.v15-stage-inner,.detail-dialog').count()===0);
  record('Desktop begins with exactly two primary panes',await page.locator('.submission-pane').isVisible()&&await page.locator('.work-pane').isVisible());
  await screenshot('01-customer-submission.png');

  await page.locator('[data-artifact-id="art_lease"]').click();
  await visible('#sourceViewer[open]');
  await visible('#documentPage');
  record('The six-page lease opens as actual rendered pages',await page.locator('.page-thumb').count()===6&&String(await page.locator('#documentPage').getAttribute('src')).includes('/pages/art_lease/1'),`pages=${await page.locator('.page-thumb').count()}`);
  const pageNatural=await page.locator('#documentPage').evaluate(image=>({w:image.naturalWidth,h:image.naturalHeight}));
  record('The rendered PDF page is not a text placeholder',pageNatural.w>500&&pageNatural.h>700,JSON.stringify(pageNatural));
  await page.locator('#zoomIn').click();
  record('PDF zoom works',String(await page.locator('#documentPage').getAttribute('style')).includes('1.15'));
  await screenshot('02-actual-pdf-open.png');
  await page.locator('[data-source-tab="extraction"]').click();
  await visible('#sourceStage pre');
  record('Original attachment and machine extraction are visibly separate',await page.locator('[data-source-tab="original"][aria-selected="false"]').count()===1&&/Machine|Page 1/i.test(await page.locator('#sourceStage').innerText()));
  await page.locator('#closeSourceViewer').click();

  await page.locator('[data-artifact-id="art_photo"]').click();
  await visible('#sourceViewer[open]');
  await visible('#sourceImage');
  const photoNatural=await page.locator('#sourceImage').evaluate(image=>({w:image.naturalWidth,h:image.naturalHeight}));
  record('The original customer photograph opens at useful resolution',photoNatural.w>=1000&&photoNatural.h>=700,JSON.stringify(photoNatural));
  record('The photograph is served as the actual source artifact',String(await page.locator('#sourceImage').getAttribute('src')).includes('/api/artifacts/art_photo'));
  await screenshot('03-actual-photo-open.png');
  await page.locator('#closeSourceViewer').click();

  await page.locator('#runCasePath').click();
  await visible('#liveWorkspace');
  record('The claim remains visible while CasePath works',await page.locator('.submission-pane').isVisible()&&await page.locator('#orchestratorBar').isVisible());
  record('A single orchestrator is visible without an architecture diagram',/CasePath orchestrator/i.test(await page.locator('#orchestratorBar').innerText()));
  await waitText('#stageCanvas',/original submission is in the shared claim context/i);
  record('Reading events come from the original source package',await page.locator('#stageCanvas .event-row').count()>=6,`rows=${await page.locator('#stageCanvas .event-row').count()}`);
  await screenshot('04-agents-reading-submission.png');

  await waitText('#stageCanvas',/separated what is known from what is still open/i);
  record('Claim understanding exposes supported facts and unresolved facts',await page.locator('#stageCanvas .fact-row').count()>=7&&await page.locator('#stageCanvas .fact-row.unknown').count()>=1);
  record('Important facts link directly back to source evidence',await page.locator('#stageCanvas [data-source-ref]').count()>=5);
  await screenshot('05-claim-understanding.png');

  await waitText('#stageCanvas',/Swiss law has become handling questions/i);
  record('Legal research appears as process-shaping questions',await page.locator('#stageCanvas .law-query').count()>=5);
  record('Legal work does not end as a detached source list',/Official source linked|Handling principle/i.test(await page.locator('#stageCanvas').innerText()));
  await screenshot('06-law-shapes-process.png');

  await waitText('#stageCanvas',/complete handling process is taking shape/i);
  await visible('#stageCanvas .process-layout');
  record('The full process graph emerges inside the main workspace',await page.locator('#stageCanvas .process-node').count()===11,`nodes=${await page.locator('#stageCanvas .process-node').count()}`);
  record('The current claim is overlaid inside the complete process',await page.locator('#stageCanvas .process-node.current').count()===1&&await page.locator('#stageCanvas .process-node.blocked').count()>=2);
  record('The process graph is not hidden in a modal',await page.locator('dialog[open] .process-layout').count()===0);
  record('Branches are folded until they matter',await page.locator('#stageCanvas .branch-options[hidden]').count()===1);
  await screenshot('07-process-emerging-live.png');

  await waitText('#stageCanvas',/Evidence now follows directly from the process/i);
  await visible('#stageCanvas .decision-inspector');
  const evidenceText=await page.locator('#stageCanvas .decision-inspector').innerText();
  record('Evidence appears inside the selected process decision',/What this decision requires/i.test(evidenceText)&&/Independent technical assessment/i.test(evidenceText));
  record('Process evidence carries actionable states, not only counts',/Missing|Conditional|Available|Insufficient/i.test(evidenceText));
  record('The reason for the technical assessment is visible',/distinguish building, use-related and mixed causes|distinguish plausible causes/i.test(evidenceText));
  await screenshot('08-evidence-attached-to-process.png');

  await waitText('#stageCanvas',/Previous cases are helping with the difficult decision/i);
  record('Three reviewed precedents arrive when the decision needs them',await page.locator('#stageCanvas .precedent-mini').count()===3,`precedents=${await page.locator('#stageCanvas .precedent-mini').count()}`);
  record('Each precedent explains why it helps',await page.locator('#stageCanvas .precedent-mini p').count()===3);
  await screenshot('09-precedents-at-decision.png');

  await waitText('#journeyNext',/Review the proposed playbook/i,180000);
  await visible('#journeyNext');
  record('The finished moment transitions from agents working to human review',/Review the proposed playbook/i.test(await page.locator('#journeyNext').innerText()));
  record('The finished analysis keeps process, evidence, and precedents together',await page.locator('#stageCanvas .process-layout').count()>=1&&await page.locator('#stageCanvas .precedent-mini').count()===3);
  record('No report-style evidence count is the dominant headline',!/20 evidence relationships across 12 process nodes/i.test(await page.locator('#stageCanvas').innerText()));
  await screenshot('10-playbook-ready.png',true);

  await page.locator('#stageCanvas .process-node.current [data-node-id]').click();
  record('Selecting a decision reveals its facts, evidence, and legal basis in place',/What this decision knows/i.test(await page.locator('#stageCanvas .decision-inspector').innerText())&&/Why this step exists/i.test(await page.locator('#stageCanvas .decision-inspector').innerText()));
  await page.locator('#stageCanvas [data-toggle-branches]').click();
  record('The causation decision reveals four meaningful outcomes on demand',await page.locator('#stageCanvas .branch-option').count()===4);
  const firstSource=page.locator('#stageCanvas .decision-inspector [data-source-ref]').first();
  await firstSource.click();
  await visible('#sourceViewer[open]');
  record('Fact-to-evidence interaction opens the exact original source',await page.locator('#sourceViewerTitle').innerText()!=='Attachment');
  await page.locator('#closeSourceViewer').click();

  await page.locator('#journeyNext').click();
  await visible('#reviewForm');
  record('Expert review edits the reasoning directly beside the process',await page.locator('#stageCanvas .review-layout .process-layout').count()===1&&await page.locator('#reviewForm').isVisible());
  record('Review focuses on one consequential decision',await page.locator('#reviewForm .review-choice').count()===2&&await page.locator('#reviewForm button[type="submit"]').count()===1);
  const impactText=await page.locator('#reviewImpact').innerText();
  record('The process, evidence, and next-action consequences are previewed',/Process/i.test(impactText)&&/Evidence/i.test(impactText)&&/Next action/i.test(impactText));
  await screenshot('11-expert-correction.png',true);

  await page.locator('#reviewForm button[type="submit"]').click();
  await visible('#knowledgeResult .knowledge-flow',120000);
  const knowledgeText=await page.locator('#stageCanvas').innerText();
  record('Knowledge consolidation is another visible agentic moment',/Knowledge Agent/i.test(knowledgeText)&&/What CasePath learned/i.test(knowledgeText));
  record('Reviewed memory, support, tests, regression, and release are visible',await page.locator('#knowledgeResult .knowledge-step').count()===5&&/Protected cases checked/i.test(knowledgeText));
  record('The knowledge version visibly changes from v3 to v4',/mould-playbook-v3|v3/i.test(knowledgeText)&&/mould-playbook-v4|v4/i.test(knowledgeText));
  record('Rollback remains visible',/rollback/i.test(knowledgeText));
  await screenshot('12-what-casepath-learned.png',true);

  await page.locator('#journeyNext').click();
  await visible('#laterAgentStream');
  await waitText('#journeyNext',/Restart the demo/i,180000);
  await visible('#laterResult .before-after');
  const laterText=await page.locator('#stageCanvas').innerText();
  record('The demo ends by running an unseen claim, not at a knowledge screen',/Unseen claim/i.test(laterText)&&/New organizational knowledge used/i.test(laterText));
  record('The before-and-after difference names the improved branch and evidence order',/Test the ventilation allegation/i.test(laterText)&&/Building-envelope assessment/i.test(laterText)&&/conditional/i.test(laterText));
  record('The unseen claim visibly uses the reviewed flagship as precedent',/reviewed flagship claim/i.test(laterText));
  await screenshot('13-later-claim-improved.png',true);

  record('Two actual claim runs were created through the public UI',runIds.length===2,JSON.stringify(runIds));
  const flagship=await pollRun(runIds[0]);
  const later=await pollRun(runIds[1]);
  record('Flagship run produced the complete 11-stage handling spine',flagship.result?.process?.main_spine?.length===11,`mainSpine=${flagship.result?.process?.main_spine?.length}`);
  record('Flagship evidence model contains process-linked requirements',flagship.result?.checklist?.items?.length>=20&&flagship.result.checklist.items.every(item=>item.node_id&&item.fact_id&&item.why),`items=${flagship.result?.checklist?.items?.length}`);
  record('Exactly three useful reviewed claims were retrieved',flagship.result?.precedents?.length===3);
  record('Expert review created an approved shared playbook update',flagship.candidate?.status==='approved'&&flagship.candidate?.new_version==='mould-playbook-v4',JSON.stringify(flagship.candidate));
  record('Later run actually used the v4 playbook',later.result?.playbook?.version==='mould-playbook-v4',later.result?.playbook?.version||'missing');
  record('Later run contains the new ventilation decision',later.result?.process?.nodes?.some(node=>node.node_id==='ventilation_dispute'));
  record('Later run makes broader testing conditional',later.result?.checklist?.items?.some(item=>item.item_id==='building_envelope'&&item.status==='conditional'));
  record('Later run retrieves the reviewed flagship first',later.result?.precedents?.[0]?.claim_id==='DEF-027-E0-DEMO',later.result?.precedents?.[0]?.claim_id||'missing');
  record('Later run avoids the unnecessary immediate request',later.result?.generated_benchmark_metrics?.unnecessary_immediate_requests===0);

  await page.locator('#openAudit').click();
  await visible('#auditDrawer[open]');
  const auditText=await page.locator('#auditContent').innerText();
  record('One audit trail contains all specialists',/Attachment Parsing Agent/i.test(auditText)&&/Claim Understanding Agent/i.test(auditText)&&/Legal Research Agent/i.test(auditText)&&/Process Discovery Agent/i.test(auditText)&&/Document Requirements Agent/i.test(auditText)&&/Historical Claims Agent/i.test(auditText)&&/Verification Agent/i.test(auditText));
  record('The audit includes expert review and knowledge consolidation',/Expert Feedback Agent/i.test(auditText)&&/Knowledge Consolidation Agent/i.test(auditText));
  record('Technical identities stay behind the audit view',/Implementation/i.test(auditText)&&/Prompt/i.test(auditText)&&/Validator/i.test(auditText));
  await screenshot('14-complete-audit-trail.png');
  await page.locator('#closeAudit').click();

  for(const viewport of [{width:390,height:844,name:'390'},{width:320,height:700,name:'320'}]){
    await page.setViewportSize({width:viewport.width,height:viewport.height});
    await page.waitForTimeout(350);
    const overflow=await noOverflow();
    record(`${viewport.name}px has no page-level horizontal overflow`,overflow<=1,`overflow=${overflow}`);
    record(`${viewport.name}px keeps one obvious primary action`,await page.locator('#journeyNext').count()===1);
    record(`${viewport.name}px keeps the customer submission available`,await page.locator('.submission-pane').isVisible());
    await screenshot(`15-mobile-${viewport.name}.png`,true);
  }

  record('Keyboard skip link exists',await page.locator('.skip-link').count()===1);
  record('All visible icon-only controls have accessible names',await page.evaluate(()=>[...document.querySelectorAll('button.icon-button:not([hidden]),a.icon-button:not([hidden])')].every(node=>node.getAttribute('aria-label')||node.textContent.trim())));
  record('No browser console errors',errors.console.length===0,JSON.stringify(errors.console));
  record('No page errors',errors.page.length===0,JSON.stringify(errors.page));
  record('No public request failures',errors.requests.length===0,JSON.stringify(errors.requests));

  await json(`${API_URL}/api/demo/reset`,{method:'POST'});
  const knowledge=await json(`${API_URL}/api/knowledge`);
  record('Public demo is reset after acceptance testing',knowledge.active_playbook?.version==='mould-playbook-v3',JSON.stringify(knowledge.active_playbook));

  await context.close();
  await browser.close(); browser=null;

  const report={status:'passed',checkedAt:new Date().toISOString(),baseUrl:BASE_URL,apiUrl:API_URL,passed:checks.filter(item=>item.passed).length,failed:checks.filter(item=>!item.passed).length,checks,errors,runIds};
  await fs.writeFile(path.join(OUT,'report.json'),`${JSON.stringify(report,null,2)}\n`);
  const images=[
    '01-customer-submission.png','02-actual-pdf-open.png','03-actual-photo-open.png','04-agents-reading-submission.png',
    '05-claim-understanding.png','06-law-shapes-process.png','07-process-emerging-live.png','08-evidence-attached-to-process.png',
    '09-precedents-at-decision.png','10-playbook-ready.png','11-expert-correction.png','12-what-casepath-learned.png',
    '13-later-claim-improved.png','14-complete-audit-trail.png','15-mobile-390.png','15-mobile-320.png'
  ];
  await fs.writeFile(path.join(OUT,'index.html'),`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>CasePath live-workspace QA</title><style>body{font:15px system-ui;max-width:1160px;margin:40px auto;padding:0 20px;color:#15171a}h1{font-size:34px}li{margin:6px 0;color:#18744f}img{max-width:100%;border:1px solid #dfe3e7;margin:8px 0 34px}code{background:#f1f3f5;padding:2px 5px;border-radius:4px}</style><h1>CasePath live-workspace QA: passed</h1><p><strong>${report.passed}</strong> checks passed against <code>${escapeHtml(BASE_URL)}</code> and <code>${escapeHtml(API_URL)}</code>.</p><ul>${checks.map(item=>`<li>✓ ${escapeHtml(item.name)}</li>`).join('')}</ul>${images.map(image=>`<h2>${escapeHtml(image)}</h2><img src="${escapeHtml(image)}" alt="${escapeHtml(image)}">`).join('')}`);
  console.log(JSON.stringify(report,null,2));
}

main().catch(async error=>{
  await fs.mkdir(OUT,{recursive:true});
  if(page) await page.screenshot({path:path.join(OUT,'failure.png'),fullPage:true}).catch(()=>null);
  const report={status:'failed',checkedAt:new Date().toISOString(),baseUrl:BASE_URL,apiUrl:API_URL,passed:checks.filter(item=>item.passed).length,failed:checks.filter(item=>!item.passed).length+1,checks,errors,runIds,error:error instanceof Error?error.stack:String(error)};
  await fs.writeFile(path.join(OUT,'report.json'),`${JSON.stringify(report,null,2)}\n`);
  console.error(report.error);
  process.exitCode=1;
}).finally(async()=>{if(browser) await browser.close().catch(()=>null);});
