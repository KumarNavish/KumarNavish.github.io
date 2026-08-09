import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL=(process.env.BASE_URL||'https://casepath-guided-v13-preview.onrender.com').replace(/\/$/,'');
const API_URL=(process.env.API_URL||'https://casepath-agentic-api.onrender.com').replace(/\/$/,'');
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

async function main(){
  await fs.rm(OUT,{recursive:true,force:true});
  await fs.mkdir(OUT,{recursive:true});
  const reset=await fetch(`${API_URL}/api/demo/reset`,{method:'POST'});
  record('Demo reset',reset.ok,`status=${reset.status}`);

  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
  page=await context.newPage();
  page.on('console',m=>{if(m.type()==='error')errors.console.push(m.text());});
  page.on('pageerror',e=>errors.page.push(String(e)));
  page.on('requestfailed',r=>{const u=r.url();if(u.startsWith(BASE_URL)||u.startsWith(API_URL))errors.requests.push(`${r.failure()?.errorText||'failed'} ${u}`);});

  const response=await page.goto(`${BASE_URL}/?smoke=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:120000});
  record('Public preview returns 200',response?.status()===200,`status=${response?.status()}`);
  await visible('#analyseBtn');
  await page.waitForFunction(()=>document.querySelectorAll('.attachment-row').length>=5,null,{timeout:120000});
  record('Original message loads',await page.locator('#customerMessage .email-body').isVisible());
  record('Original files load',await page.locator('.attachment-row').count()>=5,`files=${await page.locator('.attachment-row').count()}`);
  await screenshot('01-submission.png');

  const lease=page.locator('[data-artifact-id="art_lease"]').first();
  await lease.click();
  await visible('#artifactViewer[open]');
  await visible('#pdfPageImage');
  record('PDF source renders as an actual page',String(await page.locator('#pdfPageImage').getAttribute('src')).includes('/pages/'));
  await page.locator('#closeViewer').click();

  await page.locator('#analyseBtn').click();
  await visible('#analysis');
  await page.waitForTimeout(600);
  record('Real analysis stages are visible',await page.locator('#stageList .stage-item').count()===6);
  await screenshot('02-analysis.png');
  await page.waitForFunction(()=>{const g=document.querySelector('#guide');return g&&!g.hidden&&document.querySelector('#guideStepNumber')?.textContent?.trim()==='1';},null,{timeout:150000});
  await page.waitForFunction(()=>document.querySelector('#analysisLive')?.innerText.includes('Process graph and evidence model ready'),null,{timeout:30000});
  record('Analysis completion names the process graph and evidence model',/decision nodes validated|evidence items linked/i.test(await page.locator('#analysisLive').innerText()));

  let text=await stageText();
  record('Step 1 explains what arrived',/customer.*send|original files|original message/i.test(text),text.slice(0,220));
  record('One dominant question is shown',await page.locator('#guideStage .stage-answer').count()===1);
  record('Technical depth is hidden initially',await page.locator('#detailDialog[open]').count()===0);
  await screenshot('03-step-1.png');

  await nextStep(2); text=await stageText();
  record('Step 2 explains what CasePath understands',/understand|established|unknown|unresolved/i.test(text),text.slice(0,220));
  record('Facts remain source-linked',await page.locator('.fact-summary-row').count()>=3);

  await nextStep(3); text=await stageText();
  await visible('#guideStage .mvp-process-graph');
  record('Step 3 makes the current question dominant',/what.*cause|current question|process question/i.test(text),text.slice(0,220));
  record('How the graph was obtained is visible',await page.locator('#guideStage .mvp-origin-step').count()===4);
  record('The actual process graph is first-class',await page.locator('#guideStage .mvp-graph-step').count()>=5,`nodes=${await page.locator('#guideStage .mvp-graph-step').count()}`);
  record('The current process node is visually explicit',await page.locator('#guideStage .mvp-graph-step.current').count()===1);
  record('Future remedy remains visibly blocked',await page.locator('#guideStage .mvp-graph-step.blocked').count()>=1);
  record('Alternative branches remain collapsed initially',await page.locator('#guideStage .mvp-branch-grid[hidden]').count()===1);
  await screenshot('04-process-graph.png',true);
  await page.locator('#guideDetail').click();
  await visible('#detailDialog[open]');
  record('Full process graph is available on demand',await page.locator('#detailContent .mvp-graph-step').count()>=5);
  record('Node facts and evidence are inspectable',await page.locator('#detailContent .mvp-node-context').count()===1);
  record('Graph and checklist validators are visible in depth',await page.locator('#detailContent .mvp-validation-grid article').count()===4);
  await page.locator('#closeDetail').click();

  await nextStep(4); text=await stageText();
  record('Step 4 states the blocker',/block|unresolved|responsibility|cause/i.test(text),text.slice(0,220));
  record('Only relevant competing explanations are exposed',await page.locator('.branch-option').count()>=2);

  await nextStep(5); text=await stageText();
  await visible('#guideStage .mvp-checklist-derivation');
  record('Step 5 leads with evidence that resolves the blocker',/assessment|evidence|inspection/i.test(text),text.slice(0,220));
  record('Process to fact to evidence to checklist is explicit',await page.locator('#guideStage .mvp-derivation-step').count()===4);
  record('Checklist items remain linked to the current process node',await page.locator('#guideStage .mvp-checklist-row').count()>=2);
  record('Checklist distinguishes present, needed, and conditional evidence',await page.locator('#guideStage .mvp-checklist-row.provided, #guideStage .mvp-checklist-row.needed, #guideStage .mvp-checklist-row.conditional').count()>=2);
  record('Every visible checklist item explains why it exists',await page.locator('#guideStage .mvp-checklist-row p').count()===await page.locator('#guideStage .mvp-checklist-row').count());
  await screenshot('05-process-derived-checklist.png',true);
  await page.locator('#guideDetail').click();
  await visible('#detailDialog[open]');
  record('Aggregated checklist preserves process origin',await page.locator('#detailContent .mvp-node-checklist').count()>=1);
  record('Checklist validation boundary remains inspectable',await page.locator('#detailContent .mvp-validation').count()===1);
  await page.locator('#closeDetail').click();

  await nextStep(6); text=await stageText();
  record('Step 6 shows three useful previous cases',await page.locator('.precedent-guide-row').count()===3,`cases=${await page.locator('.precedent-guide-row').count()}`);
  record('Each case explains why it helps',await page.locator('.precedent-guide-row p').count()===3);
  await screenshot('06-precedents.png');

  await nextStep(7); text=await stageText();
  record('Step 7 limits review to one consequential decision',await page.locator('#guidedReviewForm').isVisible()&&await page.locator('.review-choice').count()===2);
  record('Expert has one clear approval action',await page.locator('#guidedReviewForm button[type="submit"]').count()===1);
  await screenshot('07-review.png');
  await page.locator('#guidedReviewForm button[type="submit"]').click();
  await page.waitForFunction(()=>document.querySelector('#guideStepNumber')?.textContent?.trim()==='8',null,{timeout:90000});

  text=await stageText();
  record('Step 8 explains what was learned',/reviewed precedent|candidate reusable rule|future handlers/i.test(text),text.slice(0,260));
  record('Immediate memory and shared rule are separated',await page.locator('.learning-line').count()===2);
  await screenshot('08-learning.png');

  await page.locator('#guideNext').click();
  await page.waitForFunction(()=>document.querySelector('.before-after')!==null,null,{timeout:90000});
  record('Later claim shows a meaningful before and after',await page.locator('.before-after-panel').count()===2);
  record('Approved memory changes evidence order',/conditional|before reviewed memory|after reviewed memory/i.test(await page.locator('.before-after').innerText()));
  await screenshot('09-proof.png');

  await page.locator('#openAuditGuide').click();
  await visible('#auditDrawer[open]');
  record('Full technical audit remains available on demand',await page.locator('#auditContent .audit-event').count()>=6);
  await page.locator('#closeAudit').click();

  for(const viewport of [{width:390,height:844,name:'390'},{width:320,height:700,name:'320'}]){
    await page.setViewportSize({width:viewport.width,height:viewport.height});
    await page.waitForTimeout(300);
    const overflow=await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-window.innerWidth);
    record(`${viewport.name}px has no page-level overflow`,overflow<=1,`overflow=${overflow}`);
    record(`${viewport.name}px keeps guided content readable`,await page.locator('#guide').isVisible()&&await page.locator('.stage-answer').isVisible());
    await screenshot(`10-mobile-${viewport.name}.png`,true);
  }

  record('No console errors',errors.console.length===0,JSON.stringify(errors.console));
  record('No page errors',errors.page.length===0,JSON.stringify(errors.page));
  record('No public request failures',errors.requests.length===0,JSON.stringify(errors.requests));

  await context.close();
  await browser.close();browser=null;
  const report={status:'passed',checkedAt:new Date().toISOString(),baseUrl:BASE_URL,apiUrl:API_URL,passed:checks.filter(x=>x.passed).length,failed:checks.filter(x=>!x.passed).length,checks,errors};
  await fs.writeFile(path.join(OUT,'report.json'),`${JSON.stringify(report,null,2)}\n`);
  const images=['01-submission.png','02-analysis.png','03-step-1.png','04-process-graph.png','05-process-derived-checklist.png','06-precedents.png','07-review.png','08-learning.png','09-proof.png','10-mobile-390.png','10-mobile-320.png'];
  await fs.writeFile(path.join(OUT,'index.html'),`<!doctype html><meta charset="utf-8"><title>CasePath process MVP QA</title><style>body{font:16px system-ui;max-width:1080px;margin:40px auto;padding:0 20px;color:#15171a}li{margin:7px 0;color:#18744f}img{max-width:100%;border:1px solid #ddd;margin:8px 0 28px}</style><h1>CasePath process MVP QA: passed</h1><p><strong>${report.passed}</strong> checks passed.</p><ul>${checks.map(x=>`<li>✓ ${x.name}</li>`).join('')}</ul>${images.map(x=>`<h2>${x}</h2><img src="${x}" alt="${x}">`).join('')}`);
  console.log(JSON.stringify(report,null,2));
}

main().catch(async error=>{
  await fs.mkdir(OUT,{recursive:true});
  if(page)await page.screenshot({path:path.join(OUT,'failure.png'),fullPage:true}).catch(()=>null);
  const report={status:'failed',checkedAt:new Date().toISOString(),baseUrl:BASE_URL,apiUrl:API_URL,passed:checks.filter(x=>x.passed).length,failed:checks.filter(x=>!x.passed).length+1,checks,errors,error:error instanceof Error?error.stack:String(error)};
  await fs.writeFile(path.join(OUT,'report.json'),`${JSON.stringify(report,null,2)}\n`);
  console.error(report.error);process.exitCode=1;
}).finally(async()=>{if(browser)await browser.close().catch(()=>null);});
