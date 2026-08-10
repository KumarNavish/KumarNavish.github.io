import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE=(process.env.BASE_URL||'https://casepath-guided-v13-preview.onrender.com').replace(/\/$/,'');
const API=(process.env.API_URL||'https://casepath-agentic-api.onrender.com').replace(/\/$/,'');
const OUT=path.resolve('guided-v13-smoke-out');
const checks=[];
const failures={console:[],page:[],request:[]};
const runIds=[];
let browser,page;

function check(name,condition,detail=''){
  const row={name,passed:Boolean(condition),detail};
  checks.push(row);
  if(!row.passed) throw new Error(`${name}: ${detail||'failed'}`);
}
function h(value=''){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function getJson(url,options={}){const r=await fetch(url,options);if(!r.ok)throw new Error(`${options.method||'GET'} ${url}: ${r.status}`);return r.json();}
async function shot(name,full=false){await page.screenshot({path:path.join(OUT,name),fullPage:full});}
async function show(selector,timeout=180000){await page.locator(selector).waitFor({state:'visible',timeout});}
async function text(selector,pattern,timeout=180000){await page.waitForFunction(({selector,source,flags})=>{const n=document.querySelector(selector);return n&&new RegExp(source,flags).test(n.textContent||'');},{selector,source:pattern.source,flags:pattern.flags},{timeout});}
async function overflow(){return page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth);}
async function run(runId){const end=Date.now()+180000;while(Date.now()<end){const value=await getJson(`${API}/api/runs/${runId}`);if(value.status==='complete')return value;if(value.status==='failed')throw new Error(value.error||'run failed');await new Promise(r=>setTimeout(r,250));}throw new Error('run timeout');}

async function main(){
  await fs.rm(OUT,{recursive:true,force:true});
  await fs.mkdir(OUT,{recursive:true});
  const health=await getJson(`${API}/healthz`);
  check('Full-process API is healthy',health.status==='ok'&&health.pipeline_release==='15.0.0',JSON.stringify(health));
  const reset=await getJson(`${API}/api/demo/reset`,{method:'POST'});
  check('Demo starts from mould playbook v3',reset.active_playbook==='mould-playbook-v3',JSON.stringify(reset));

  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
  page=await context.newPage();
  page.on('console',m=>{if(m.type()==='error')failures.console.push(m.text());});
  page.on('pageerror',e=>failures.page.push(String(e)));
  page.on('requestfailed',r=>{if(r.url().startsWith(BASE)||r.url().startsWith(API))failures.request.push(`${r.failure()?.errorText||'failed'} ${r.url()}`);});
  page.on('response',async response=>{try{const u=new URL(response.url());if(response.request().method()==='POST'&&u.origin===new URL(API).origin&&u.pathname==='/api/runs'&&response.ok()){const value=await response.json();if(value.run_id&&!runIds.includes(value.run_id))runIds.push(value.run_id);}}catch(_){}});

  const response=await page.goto(`${BASE}/?api=${encodeURIComponent(API)}&qa=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:120000});
  check('Public preview returns 200',response?.status()===200,`status=${response?.status()}`);
  await show('#runCasePath');
  await page.waitForFunction(()=>document.querySelectorAll('.attachment-row').length===6,null,{timeout:120000});
  check('Customer submission remains visible',await page.locator('#customerEmail .email-body').isVisible());
  check('Six actual attachments are listed',await page.locator('.attachment-row').count()===6);
  check('One primary demo action is visible',await page.locator('#runCasePath').count()===1);
  check('Old report-page structures are absent',await page.locator('.guide-section,.detail-dialog,.v15-stage-inner').count()===0);
  await shot('01-customer-submission.png');

  await page.locator('[data-artifact-id="art_lease"]').click();
  await show('#sourceViewer[open]');
  await show('#documentPage');
  const leaseSrc=String(await page.locator('#documentPage').getAttribute('src'));
  const leaseSize=await page.locator('#documentPage').evaluate(n=>({w:n.naturalWidth,h:n.naturalHeight}));
  check('Six-page lease opens as rendered pages',await page.locator('.page-thumb').count()===6&&leaseSrc.includes('/art_lease/pages/1'),`${leaseSrc}; ${JSON.stringify(leaseSize)}`);
  check('Rendered lease page has document resolution',leaseSize.w>500&&leaseSize.h>700,JSON.stringify(leaseSize));
  await page.locator('#zoomIn').click();
  check('Document zoom works',String(await page.locator('#documentPage').getAttribute('style')).includes('1.15'));
  await shot('02-actual-pdf-open.png');
  await page.locator('[data-source-tab="extraction"]').click();
  await show('#sourceStage pre');
  check('Original and machine extraction are separate views',await page.locator('[data-source-tab="original"][aria-selected="false"]').count()===1);
  await page.locator('#closeSourceViewer').click();

  await page.locator('[data-artifact-id="art_photo"]').click();
  await show('#sourceViewer[open]');
  await show('#sourceImage');
  const photoSize=await page.locator('#sourceImage').evaluate(n=>({w:n.naturalWidth,h:n.naturalHeight}));
  check('Actual photograph opens at useful resolution',photoSize.w>=1000&&photoSize.h>=700,JSON.stringify(photoSize));
  check('Photograph comes from source-artifact endpoint',String(await page.locator('#sourceImage').getAttribute('src')).includes('/api/artifacts/art_photo'));
  await shot('03-actual-photo-open.png');
  await page.locator('#closeSourceViewer').click();

  await page.locator('#runCasePath').click();
  await show('#liveWorkspace');
  check('Claim stays visible while agents work',await page.locator('.submission-pane').isVisible()&&await page.locator('#orchestratorBar').isVisible());
  check('One shared orchestrator is visible',/CasePath orchestrator/i.test(await page.locator('#orchestratorBar').innerText()));

  await text('#stageCanvas',/original submission is in the shared claim context/i);
  check('Reading stage displays source-level execution events',await page.locator('#stageCanvas .event-row').count()>=6);
  await shot('04-agents-reading-submission.png');

  await text('#stageCanvas',/separated what is known from what is still open/i);
  check('Understanding stage separates facts and unknowns',await page.locator('#stageCanvas .fact-row').count()>=7&&await page.locator('#stageCanvas .fact-row.unknown').count()>=1);
  check('Facts retain source links',await page.locator('#stageCanvas [data-source-ref]').count()>=5);
  await shot('05-claim-understanding.png');

  await text('#stageCanvas',/Swiss law has become handling questions/i);
  check('Law stage presents claim-specific handling questions',await page.locator('#stageCanvas .law-query').count()>=5);
  await shot('06-law-shapes-process.png');

  await text('#stageCanvas',/complete handling process is taking shape/i);
  await show('#stageCanvas .process-layout');
  check('Full process graph emerges in the main canvas',await page.locator('#stageCanvas .process-node').count()===11,`nodes=${await page.locator('#stageCanvas .process-node').count()}`);
  check('Current and blocked states are overlaid on full graph',await page.locator('#stageCanvas .process-node.current').count()===1&&await page.locator('#stageCanvas .process-node.blocked').count()>=2);
  check('Process is not hidden in a modal',await page.locator('dialog[open] .process-layout').count()===0);
  check('Alternative branches start collapsed',await page.locator('#stageCanvas .branch-options[hidden]').count()===1);
  await shot('07-process-emerging-live.png');

  await text('#stageCanvas',/Evidence now follows directly from the process/i);
  const inspector=await page.locator('#stageCanvas .decision-inspector').innerText();
  check('Evidence is attached to the selected process decision',/What this decision requires/i.test(inspector)&&/Independent technical assessment/i.test(inspector));
  check('Evidence states and reasons are visible',/Missing|Conditional|Available|Insufficient/i.test(inspector)&&/distinguish/i.test(inspector));
  await shot('08-evidence-attached-to-process.png');

  await text('#stageCanvas',/Previous cases are helping with the difficult decision/i);
  check('Three reviewed precedents appear at the relevant decision',await page.locator('#stageCanvas .precedent-mini').count()===3);
  check('Every precedent states why it helps',await page.locator('#stageCanvas .precedent-mini p').count()===3);
  await shot('09-precedents-at-decision.png');

  await text('#journeyNext',/Review the proposed playbook/i);
  check('Agents-working state transitions clearly to expert review',/Review the proposed playbook/i.test(await page.locator('#journeyNext').innerText()));
  check('Finished view keeps process, evidence, and precedents together',await page.locator('#stageCanvas .process-layout').count()>=1&&await page.locator('#stageCanvas .precedent-mini').count()===3);
  check('Report language is not the dominant story',!/20 evidence relationships across 12 process nodes/i.test(await page.locator('#stageCanvas').innerText()));
  await shot('10-playbook-ready.png',true);

  await page.locator('#stageCanvas [data-toggle-branches]').click();
  check('Four causation outcomes reveal on demand',await page.locator('#stageCanvas .branch-option').count()===4);
  const sourceLink=page.locator('#stageCanvas .decision-inspector [data-source-ref]').first();
  await sourceLink.click();
  await show('#sourceViewer[open]');
  check('Fact-to-evidence opens an exact original source',await page.locator('#sourceViewerTitle').innerText()!=='Attachment');
  await page.locator('#closeSourceViewer').click();

  await page.locator('#journeyNext').click();
  await show('#reviewForm');
  check('Expert edits reasoning beside the generated process',await page.locator('#stageCanvas .review-layout .process-layout').count()===1);
  check('Review focuses on one consequential choice',await page.locator('#reviewForm .review-choice').count()===2&&await page.locator('#reviewForm button[type="submit"]').count()===1);
  const impact=await page.locator('#reviewImpact').innerText();
  check('Process, evidence, and next-action changes preview immediately',/Process/i.test(impact)&&/Evidence/i.test(impact)&&/Next action/i.test(impact));
  await shot('11-expert-correction.png',true);

  await page.locator('#reviewForm button[type="submit"]').click();
  await show('#knowledgeResult .knowledge-flow');
  const learned=await page.locator('#stageCanvas').innerText();
  check('Knowledge Agent visibly consolidates the correction',/Knowledge Agent/i.test(learned)&&/What CasePath learned/i.test(learned));
  check('Support, target tests, protected regression, and release are visible',await page.locator('#knowledgeResult .knowledge-step').count()===5&&/Protected cases checked/i.test(learned));
  check('Knowledge moves visibly from v3 to v4 with rollback',/v3/i.test(learned)&&/v4/i.test(learned)&&/rollback/i.test(learned));
  await shot('12-what-casepath-learned.png',true);

  await page.locator('#journeyNext').click();
  await show('#laterAgentStream');
  await text('#journeyNext',/Restart the demo/i);
  await show('#laterResult .before-after');
  const laterText=await page.locator('#stageCanvas').innerText();
  check('Demo ends with an unseen claim using new knowledge',/Unseen claim/i.test(laterText)&&/New organizational knowledge used/i.test(laterText));
  check('Before/after highlights the new decision and conditional evidence order',/Test the ventilation allegation/i.test(laterText)&&/Building-envelope assessment/i.test(laterText)&&/conditional/i.test(laterText));
  await shot('13-later-claim-improved.png',true);

  check('Public UI created two real claim runs',runIds.length===2,JSON.stringify(runIds));
  const flagship=await run(runIds[0]);
  const later=await run(runIds[1]);
  check('Flagship created an 11-stage main process',flagship.result?.process?.main_spine?.length===11);
  check('Flagship created at least 20 process-grounded evidence relationships',flagship.result?.checklist?.items?.length>=20&&flagship.result.checklist.items.every(i=>i.node_id&&i.fact_id&&i.why),`items=${flagship.result?.checklist?.items?.length}`);
  check('Flagship retrieved exactly three reviewed precedents',flagship.result?.precedents?.length===3);
  check('Expert review released playbook v4',flagship.candidate?.status==='approved'&&flagship.candidate?.new_version==='mould-playbook-v4');
  check('Later run uses playbook v4',later.result?.playbook?.version==='mould-playbook-v4',later.result?.playbook?.version||'missing');
  check('Later process contains ventilation-dispute decision',later.result?.process?.nodes?.some(n=>n.node_id==='ventilation_dispute'));
  check('Later evidence model makes building-envelope testing conditional',later.result?.checklist?.items?.some(i=>i.item_id==='building_envelope'&&i.status==='conditional'));
  check('Reviewed flagship is the first later-claim precedent',later.result?.precedents?.[0]?.claim_id==='DEF-027-E0-DEMO',later.result?.precedents?.[0]?.claim_id||'missing');

  await page.locator('#openAudit').click();
  await show('#auditDrawer[open]');
  const audit=await page.locator('#auditContent').innerText();
  check('Unified audit contains all specialist agents',/Attachment Parsing Agent/i.test(audit)&&/Claim Understanding Agent/i.test(audit)&&/Legal Research Agent/i.test(audit)&&/Process Discovery Agent/i.test(audit)&&/Document Requirements Agent/i.test(audit)&&/Historical Claims Agent/i.test(audit)&&/Verification Agent/i.test(audit));
  check('Audit contains expert feedback and knowledge consolidation',/Expert Feedback Agent/i.test(audit)&&/Knowledge Consolidation Agent/i.test(audit));
  check('Technical identities remain available only on demand',/Implementation/i.test(audit)&&/Prompt/i.test(audit)&&/Validator/i.test(audit));
  await shot('14-complete-audit-trail.png');
  await page.locator('#closeAudit').click();

  for(const viewport of [{width:390,height:844,name:'390'},{width:320,height:700,name:'320'}]){
    await page.setViewportSize(viewport);
    await page.waitForTimeout(300);
    const extra=await overflow();
    check(`${viewport.name}px has no page-level horizontal overflow`,extra<=1,`overflow=${extra}`);
    check(`${viewport.name}px keeps customer submission available`,await page.locator('.submission-pane').isVisible());
    check(`${viewport.name}px keeps one primary next action`,await page.locator('#journeyNext').count()===1);
    await shot(`15-mobile-${viewport.name}.png`,true);
  }

  check('Skip link is present',await page.locator('.skip-link').count()===1);
  check('Visible icon-only controls have accessible names',await page.evaluate(()=>[...document.querySelectorAll('button.icon-button:not([hidden]),a.icon-button:not([hidden])')].every(n=>n.getAttribute('aria-label')||n.textContent.trim())));
  check('No console errors',failures.console.length===0,JSON.stringify(failures.console));
  check('No page errors',failures.page.length===0,JSON.stringify(failures.page));
  check('No public request failures',failures.request.length===0,JSON.stringify(failures.request));

  await getJson(`${API}/api/demo/reset`,{method:'POST'});
  const knowledge=await getJson(`${API}/api/knowledge`);
  check('Demo resets to v3 after QA',knowledge.active_playbook?.version==='mould-playbook-v3');

  await context.close();
  await browser.close();browser=null;
  const report={status:'passed',checkedAt:new Date().toISOString(),baseUrl:BASE,apiUrl:API,passed:checks.length,failed:0,checks,failures,runIds};
  await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify(report,null,2)+'\n');
  const images=['01-customer-submission.png','02-actual-pdf-open.png','03-actual-photo-open.png','04-agents-reading-submission.png','05-claim-understanding.png','06-law-shapes-process.png','07-process-emerging-live.png','08-evidence-attached-to-process.png','09-precedents-at-decision.png','10-playbook-ready.png','11-expert-correction.png','12-what-casepath-learned.png','13-later-claim-improved.png','14-complete-audit-trail.png','15-mobile-390.png','15-mobile-320.png'];
  await fs.writeFile(path.join(OUT,'index.html'),`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>CasePath live demo QA</title><style>body{font:15px system-ui;max-width:1160px;margin:40px auto;padding:0 20px;color:#15171a}li{margin:6px 0;color:#18744f}img{max-width:100%;border:1px solid #dde2e7;margin:8px 0 34px}code{background:#f1f3f5;padding:2px 5px;border-radius:4px}</style><h1>CasePath live demo QA: passed</h1><p><strong>${checks.length}</strong> checks passed against <code>${h(BASE)}</code> and <code>${h(API)}</code>.</p><ul>${checks.map(c=>`<li>✓ ${h(c.name)}</li>`).join('')}</ul>${images.map(i=>`<h2>${h(i)}</h2><img src="${h(i)}" alt="${h(i)}">`).join('')}`);
  console.log(JSON.stringify(report,null,2));
}

main().catch(async error=>{
  await fs.mkdir(OUT,{recursive:true});
  if(page)await page.screenshot({path:path.join(OUT,'failure.png'),fullPage:true}).catch(()=>null);
  const report={status:'failed',checkedAt:new Date().toISOString(),baseUrl:BASE,apiUrl:API,passed:checks.filter(c=>c.passed).length,failed:1,checks,failures,runIds,error:error instanceof Error?error.stack:String(error)};
  await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.error(report.error);
  process.exitCode=1;
}).finally(async()=>{if(browser)await browser.close().catch(()=>null);});
