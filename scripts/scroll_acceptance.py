"""Exercise actual scroll input and record the argument in both directions.
No browser-policy changes, mocked graphics, or timestamp-driven chapter mutations.
"""
from pathlib import Path
import argparse,json,time,hashlib,urllib.request
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser()
parser.add_argument('--url',required=True);parser.add_argument('--out',required=True)
parser.add_argument('--record',action='store_true');parser.add_argument('--reference',action='store_true')
parser.add_argument('--wait-release',action='store_true');args=parser.parse_args()
base=args.url.rstrip('/')+'/';out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
root=Path(__file__).resolve().parents[1]
works=['gain-graphs','experience-replay','rank-feasibility','tic-lm','casepath','spatial-world','natural-gradient','spectral-bounds','urban-microregions','interaction-dynamics']
flagships=set(works[:6]);checks=[];errors=[];network=[];http=[];recordings=[]
def check(name,condition,detail=None):
 checks.append({'name':name,'pass':bool(condition),**({'detail':detail} if detail is not None else {})})
 (out/'checks-progress.json').write_text(json.dumps(checks,indent=2))
 assert condition,name
if args.wait_release:
 expected=(root/'index.html').read_bytes()
 for attempt in range(40):
  try:
   if urllib.request.urlopen(base+'?scroll-release='+str(attempt),timeout=15).read()==expected:break
  except Exception:pass
  time.sleep(6)
 else:raise RuntimeError('Published index did not reach the expected release; no stale-build acceptance.')

def attach(page):
 page.set_default_timeout(25000)
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('requestfailed',lambda r:network.append({'url':r.url,'error':r.failure}))
 page.on('response',lambda r:http.append({'url':r.url,'status':r.status}) if r.status>=400 else None)
def state(page):return json.loads(page.locator('#demo-root').get_attribute('data-state'))
def narrative(page):return json.loads(page.locator('#demo-root').get_attribute('data-narrative'))
def scroll_to(page,y,delay=95):
 page.evaluate('(y)=>window.scrollTo({top:y,behavior:"instant"})',max(0,y));page.wait_for_timeout(delay)
def knots(page):return json.loads(page.locator('#demo-root').get_attribute('data-anchors'))
def at(page,p,delay=130):
 a=knots(page);u=p*(len(a)-1);i=int(u);j=min(len(a)-1,i+1);scroll_to(page,a[i]+(a[j]-a[i])*(u-i),delay)
 page.wait_for_function('(p)=>Math.abs(+document.querySelector("#demo-root").dataset.progress-p)<.0005',arg=p)
def start(page,work,deep=''):
 page.goto(base+'#work/'+work+deep,wait_until='networkidle');page.wait_for_selector('#demo-root[data-anchors]');page.wait_for_timeout(100)
 check(work+' page identity',work in page.url and page.locator('.n-chapter').count()>=4)
 if work!='casepath':
  page.wait_for_selector('.world-canvas[data-rendered="webgl2"]')
  check(work+' actual WebGL2 renderer',page.locator('.world-canvas').get_attribute('data-rendered')=='webgl2')
  if work!='spatial-world':check(work+' visible introductory geometry',int(page.locator('.world-canvas').get_attribute('data-calls'))>0)
  else:check('spatial introduction is language before geometry',page.locator('.n-sentence').is_visible() or float(page.locator('#demo-root').get_attribute('data-progress'))>0)
def explore(page):
 y=float(page.locator('#demo-root').get_attribute('data-explore-at'));scroll_to(page,y+10,180)
 page.wait_for_function('document.querySelector("#demo-root").dataset.mode==="explore"')
def export_scene(page):
 with page.expect_download() as download:page.locator('[data-explore="export"]').click()
 return json.loads(Path(download.value.path()).read_text())

with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 if args.reference:
  ref=browser.new_page(viewport={'width':1440,'height':1000})
  try:
   ref.goto('https://www.anthropic.com/institute/econ-scenarios',wait_until='domcontentloaded',timeout=45000);ref.wait_for_timeout(1800)
   texts=ref.locator('body').inner_text();(out/'reference-reading.txt').write_text(texts)
   positions=[0,1200,2200,3400,5000]
   for i,y in enumerate(positions):scroll_to(ref,y,350);ref.screenshot(path=str(out/f'reference-{i}.png'))
   (out/'reference-inspection.json').write_text(json.dumps({'url':ref.url,'title':ref.title(),'positions':positions,'observed_sticky':ref.evaluate('''()=>[...document.querySelectorAll('*')].filter(e=>getComputedStyle(e).position==='sticky').map(e=>({tag:e.tagName,class:String(e.className),top:getComputedStyle(e).top})).slice(0,15)'''),'scope':'Interaction grammar only. No styles, branding or graphic assets copied.'},indent=2))
  except Exception as e:(out/'reference-inspection-error.txt').write_text(str(e))
  ref.close()
 page=browser.new_page(viewport={'width':1440,'height':1000},reduced_motion='no-preference');attach(page)
 page.goto(base,wait_until='networkidle');page.wait_for_selector('.journey-field[data-active-work]')
 check('new release identity',page.locator('meta[name="portfolio-release"]').get_attribute('content')=='scroll-4.2.1')
 check('all ten works remain in one timeline',page.locator('.work-row').count()==10)
 check('homepage no snapshot thumbnails',page.locator('.work-scene-preview').count()==0)
 page.screenshot(path=str(out/'home-desktop.png'))
 for path in ['index.html','modules/app.mjs','modules/narrative/model.mjs','modules/narrative/director.mjs','narrative.css']:
  response=page.request.get(base+path);check('origin matches authored bytes '+path,response.status==200 and response.body()==(root/path).read_bytes())
 for i in range(10):
  row=page.locator('.journey-row').nth(i);work=row.get_attribute('data-work');rect=row.bounding_box();y=page.evaluate('scrollY')+rect['y']+rect['height']*.45-500;scroll_to(page,y,230)
  check('homepage active field follows '+work,page.locator('.journey-field').get_attribute('data-active-work')==work)
  check('homepage at most one live canvas',page.locator('.journey-render canvas').count()<=1)
  before=page.locator('.journey-field').get_attribute('data-science');scroll_to(page,y+35,180)
  if work!='casepath':check('homepage preview has scroll-derived computation '+work,page.locator('.journey-field').get_attribute('data-science')!=before or page.locator('.journey-field').get_attribute('data-progress') is not None)
 for work in works:
  start(page,work);a=knots(page);capture={};frames={}
  check(work+' no Play required',page.locator('[data-play]').count()==0)
  check(work+' explorer initially locked',page.locator('.n-explorer').evaluate('(e)=>e.inert'))
  for i in range(len(a)):
   at(page,i/(len(a)-1));capture[i]=page.locator('#demo-root').get_attribute('data-state');frames[i]=narrative(page)
   page.screenshot(path=str(out/f'{work}-chapter-{i+1}-desktop.png'))
   check(work+f' sticky chapter {i+1}',abs(page.locator('.n-stage').bounding_box()['y']-98)<2)
  for i in reversed(range(len(a))):
   at(page,i/(len(a)-1));check(work+f' reverse reconstructs chapter {i+1}',page.locator('#demo-root').get_attribute('data-state')==capture[i])
  at(page,.371);before=page.locator('#demo-root').get_attribute('data-state');page.wait_for_timeout(500)
  check(work+' settled scroll does not advance the narrative',page.locator('#demo-root').get_attribute('data-state')==before)
  at(page,.89,60);at(page,.371,140);check(work+' fast jump has no queued story mutations',page.locator('#demo-root').get_attribute('data-state')==before)
  before_progress=float(page.locator('#demo-root').get_attribute('data-progress'));url=page.url
  page.reload(wait_until='networkidle');page.wait_for_selector('#demo-root[data-narrative]');page.wait_for_timeout(230)
  check(work+' deep reload reconstructs progress',abs(float(page.locator('#demo-root').get_attribute('data-progress'))-before_progress)<.0005)
  check(work+' no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  if work!='casepath':
   at(page,.62);page.wait_for_timeout(200);c=page.locator('.world-canvas');before_frame=int(c.get_attribute('data-frame'));page.wait_for_timeout(250)
   check(work+' renderer settles when scroll stops',int(c.get_attribute('data-frame'))-before_frame<=1)
  if work=='gain-graphs':
   check('gain initial operator is withheld',frames[0]['reveal']['operator']==0);check('gain cycle precedes operator',frames[2]['reveal']['operator']==0);check('gain repair restores zero',json.loads(capture[len(a)-1])['eigenvalues'][0]<1e-8)
  if work=='experience-replay':
   check('replay forgetting precedes oracle',frames[1]['reveal']['oracle']==0 and json.loads(capture[1])['oldLoss']>0)
   check('replay redundant buffer has residual',json.loads(capture[5])['directions']==1 and json.loads(capture[5])['unavailable']>0)
  if work=='rank-feasibility':check('rank no repair before feasibility',json.loads(capture[2])['repair'] is None and frames[3]['reveal']['solution']==0)
  if work=='tic-lm':check('temporal zero replay is possible and budget stays fixed',json.loads(capture[5])['replay']==0 and json.loads(capture[3])['processed']==64)
  if work=='casepath':
   hold=json.loads(capture[3]);ready=json.loads(capture[5]);check('source conflict reaches HOLD',not hold['nodes']['gate']['value']);check('scoped replay retains invoice version',ready['nodes']['gate']['value'] and ready['nodes']['invoice']['version']==hold['nodes']['invoice']['version']);check('source never changes',hold['source']==ready['source'])
  if work=='spatial-world':
   at(page,4/6);check('spatial structure materializes into visible geometry',int(page.locator('.world-canvas').get_attribute('data-calls'))>0);ids=page.locator('.n-scene-overlay').get_attribute('data-object-identities');at(page,1);check('same 3D objects survive the guided edit',page.locator('.n-scene-overlay').get_attribute('data-object-identities')==ids)
  explore(page);check(work+' exploration unlocks after the argument',not page.locator('.n-explorer').evaluate('(e)=>e.inert'))
  if work=='spatial-world':
   original=state(page);page.locator('#n-command').fill('Add a plant. Read my email.');page.locator('[data-explore="compile"]').click();check('unsupported compound command remains atomic',state(page)==original)
   page.locator('#n-command').fill('Add a plant.');page.locator('[data-explore="compile"]').click();page.wait_for_timeout(160);added=state(page);check('sandbox adds a persistent object',len(added['objects'])==len(original['objects'])+1)
   at(page,.3);explore(page);check('backtracking never discards sandbox edits',state(page)==added)
   check('export contains actual sandbox state',export_scene(page)==added)
   page.locator('[data-explore="undo"]').click();page.wait_for_timeout(100);check('sandbox undo restores the preceding scene',state(page)==original)
   page.locator('[data-explore="redo"]').click();page.wait_for_timeout(100);check('sandbox redo restores the edit',state(page)==added)
   page.reload(wait_until='networkidle');page.wait_for_selector('#demo-root[data-anchors]');explore(page);check('real-origin reload retains sandbox',state(page)==added)
   page.locator('[data-explore="reset"]').click();page.wait_for_timeout(100);reset_state=state(page);page.reload(wait_until='networkidle');page.wait_for_selector('#demo-root[data-anchors]');explore(page);check('sandbox reset is also persisted',state(page)==reset_state)
  elif work=='casepath':
   page.locator('[data-explore="conflict"]').click();page.wait_for_timeout(100);page.locator('[data-case-date]').select_option('2026-06-12');page.locator('[data-explore="review"]').click();page.wait_for_timeout(100)
   check('incorrect review cannot authorize the proposal',not state(page)['nodes']['gate']['value']);check('incorrect review is not described as accepted','conflicts' in page.locator('[data-assertion]').inner_text())
   page.locator('[data-case-date]').select_option('2026-05-12');page.locator('[data-explore="review"]').click();page.wait_for_timeout(100);check('correct source review authorizes a human decision',state(page)['nodes']['gate']['value'])
   page.locator('[data-explore="amend"]').click();page.wait_for_timeout(100);check('new invoice reopens the correct obligation',not state(page)['nodes']['gate']['value'] and 'INVOICE' in page.locator('[data-hold]').inner_text())
  elif work=='rank-feasibility':
   page.locator('[data-rank="1"]').click();page.wait_for_timeout(120);check('interactive infeasibility never draws a repair',state(page)['repair'] is None)
  elif work=='experience-replay':
   page.locator('[data-explore="complete"]').click();page.wait_for_timeout(120);check('interactive complete memory span removes unavailable correction',state(page)['unavailable']<1e-8)
  elif work=='gain-graphs':
   page.locator('[data-parameter="angle"]').evaluate('(e)=>{e.value=110;e.dispatchEvent(new Event("input",{bubbles:true}));}');page.wait_for_timeout(100);check('interactive edge changes eigensystem',state(page)['eigenvalues'][0]>.01)
  print('DESKTOP',work,'PASS',flush=True)
 page.close()
 # Six flagships get forward/backward, slow transition, fast jump and explorer recordings in each mode.
 for mode,width,height,reduced in [('desktop',1440,1000,'no-preference'),('mobile',390,844,'no-preference'),('reduced',1440,1000,'reduce')]:
  for work in works:
   record=args.record and work in flagships
   kwargs={'viewport':{'width':width,'height':height},'reduced_motion':reduced}
   if record:kwargs.update(record_video_dir=str(out/'recordings'),record_video_size={'width':width,'height':height})
   context=browser.new_context(**kwargs);page=context.new_page();attach(page);start(page,work)
   a=knots(page);frames=[]
   scroll_to(page,max(0,a[0]-150),160)
   for i in range(len(a)):
    if i:
     for step in range(1,9):scroll_to(page,a[i-1]+(a[i]-a[i-1])*step/8,35 if record else 10)
    else:scroll_to(page,a[0],100)
    at(page,i/(len(a)-1),160 if record else 100);frames.append(page.locator('#demo-root').get_attribute('data-state'))
    if mode!='desktop':page.screenshot(path=str(out/f'{work}-chapter-{i+1}-{mode}.png'))
   explore(page);page.wait_for_timeout(250)
   for i in reversed(range(len(a))):
    if record and i<len(a)-1:
     for step in range(1,7):scroll_to(page,a[i+1]+(a[i]-a[i+1])*step/6,30)
    else:scroll_to(page,a[i],100)
    at(page,i/(len(a)-1),100)
    check(work+f' {mode} reverse state {i+1}',page.locator('#demo-root').get_attribute('data-state')==frames[i])
   at(page,.77,90);at(page,.13,90);at(page,.77,90);f=state(page);page.wait_for_timeout(200);check(work+' '+mode+' fast jump settles',state(page)==f)
   check(work+' '+mode+' layout fits',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
   if reduced=='reduce':check(work+' reduced mode preserves chapter endpoints',len(frames)==len(a))
   if work=='gain-graphs' and mode=='mobile':
    at(page,.4);y=page.evaluate('scrollY');stage=page.locator('.n-stage').bounding_box();page.mouse.move(stage['x']+stage['width']/2,stage['y']+stage['height']/2);page.mouse.wheel(0,220);page.wait_for_timeout(180);check('scroll over the scientific canvas is not trapped',page.evaluate('scrollY')>y+100)
   video=page.video if record else None;page.close();context.close()
   if video:
    path=Path(video.path());target=out/'recordings'/f'{work}-{mode}-forward-reverse.webm';path.rename(target);recordings.append({'work':work,'mode':mode,'path':str(target.relative_to(out)),'contains':['forward','reverse','slow transition','fast jump','explorer unlock']})
   print(mode.upper(),work,'PASS',flush=True)
 # Optional auto-tour must advance the same page progress and yield to direct scroll.
 page=browser.new_page(viewport={'width':1440,'height':1000});attach(page);start(page,'gain-graphs');page.locator('[data-auto]').click();page.wait_for_timeout(900);page.mouse.wheel(0,300);page.wait_for_timeout(180)
 check('manual scrolling stops optional auto-tour',page.locator('[data-auto]').get_attribute('aria-pressed')=='false');page.close()
 context=browser.new_context(java_script_enabled=False);page=context.new_page();page.goto(base);check('no-JS timeline and original sources remain readable',page.locator('.work-row').count()==10 and page.locator('noscript a').count()>=9);context.close()
 check('no uncaught JavaScript errors',not errors,errors)
 check('no failed resources',not network,network);check('no HTTP errors',not http,http)
 if args.record:check('18 flagship recordings completed',len(recordings)==18)
 result={'origin':base,'checks':checks,'passed':sum(c['pass'] for c in checks),'errors':errors,'network_failures':network,'http_errors':http,'recordings':recordings,'browser':'Unmodified Playwright Chromium / WebGL2','viewports':[[1440,1000],[390,844]],'remaining_limits':['Physical touch hardware and device GPU performance','Actual speech-recognition service','Safari/WebKit','Independent newcomer comprehension assessment']}
 (out/'acceptance.json').write_text(json.dumps(result,indent=2));browser.close()
print('PASSED',len(checks),flush=True)
