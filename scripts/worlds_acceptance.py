"""Real-origin acceptance for the authored living worlds. Does not change browser policies."""
from pathlib import Path
import argparse, json, hashlib, time, urllib.request, io
from PIL import Image
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--out',required=True);p.add_argument('--wait-release',action='store_true');args=p.parse_args()
base=args.url.rstrip('/')+'/';out=Path(args.out);out.mkdir(parents=True,exist_ok=True);root=Path(__file__).resolve().parents[1]
ids=['gain-graphs','experience-replay','rank-feasibility','tic-lm','casepath','natural-gradient','spatial-world','spectral-bounds','urban-microregions','interaction-dynamics']
checks=[];errors=[];failures=[];http_errors=[]
def check(name,condition):
 checks.append({'name':name,'pass':bool(condition)});(out/'progress.json').write_text(json.dumps(checks,indent=2));assert condition,name
if args.wait_release:
 expected=(root/'index.html').read_bytes()
 for i in range(24):
  try:
   if urllib.request.urlopen(base,timeout=15).read()==expected:break
  except Exception:pass
  time.sleep(8)
 else:raise RuntimeError('Expected source has not reached the public origin.')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True);page=browser.new_page(viewport={'width':1440,'height':1040},device_scale_factor=1,reduced_motion='reduce')
 page.set_default_timeout(20000)
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('requestfailed',lambda r:failures.append({'url':r.url,'failure':r.failure}))
 page.on('response',lambda r:http_errors.append({'url':r.url,'status':r.status}) if r.status>=400 else None)
 r=page.goto(base,wait_until='networkidle');check('home HTTP 200',r.status==200);check('release identity',page.locator('meta[name="portfolio-release"]').get_attribute('content')=='worlds-3')
 check('canonical timeline contains ten works',page.locator('.work-row').count()==10)
 page.screenshot(path=str(out/'home-desktop.png'),full_page=True)
 for f in ['modules/app.mjs','modules/worlds/index.mjs','modules/worlds/geometry.mjs','modules/worlds/compiler.mjs','worlds.css','vendor/three.module.min.js']:
  res=page.request.get(base+f);check('published bytes '+f,res.status==200 and res.body()==(root/f).read_bytes())
 def state():return json.loads(page.locator('#demo-root').get_attribute('data-state'))
 def go(work):
  page.goto(base+'#work/'+work,wait_until='networkidle');page.wait_for_selector('#demo-root[data-state]');check(work+' meaningful content',page.locator('.w-head h2').inner_text()!='')
  if work!='casepath':page.wait_for_selector('.world-canvas[data-rendered="webgl2"]');check(work+' WebGL2 scene',int(page.locator('.world-canvas').get_attribute('data-calls'))>0)
 def click(a):page.locator('[data-act="'+a+'"]').click();page.wait_for_timeout(60)
 def shot(work):
  page.evaluate("document.activeElement?.blur();scrollTo({top:0,behavior:'instant'})")
  page.wait_for_timeout(80)
  box=page.locator('.world-exhibit').bounding_box()
  data=page.screenshot(path=str(out/(work+'-page.png')),full_page=True)
  image=Image.open(io.BytesIO(data));x,y,w,h=box['x'],box['y'],box['width'],box['height']
  image.crop((round(x),round(y),round(x+w),round(y+h))).save(out/(work+'.png'))

 for work in ids:
  go(work)
  if work=='gain-graphs':
   click('next');check('gain contradiction reaches three basis cycles',state()['inconsistent']==3 and state()['eigenvalues'][0]>.1);shot(work);click('next');check('gain repair restores spectral zero',state()['inconsistent']==0 and state()['eigenvalues'][0]<1e-8)
  elif work=='experience-replay':
   click('next');click('memory1');before=state();check('duplicate memory adds no independent direction',before['directions']==1 and before['missing']>0);shot(work);click('next');check('complete memory basis removes residual',state()['missing']<1e-8 and state()['directions']==3);page.locator('[data-input="correction"]').evaluate("el=>{el.value=.5;el.dispatchEvent(new Event('input',{bubbles:true}));}");check('partial step is not labelled an unavailable direction',state()['unavailable']<1e-8 and state()['notApplied']>0);click('next');check('contextual action finishes the available correction',state()['missing']<1e-8)
  elif work=='rank-feasibility':
   click('rank2');check('rank-two solver does not draw a nonexistent repair',state()['repair'] is None and page.locator('.spatial-label',has_text='Minimum-norm repair').count()==0);click('rank3');check('rank-three repair exists but exceeds budget',state()['feasible'] and not state()['affordable']);shot(work);click('next');check('separate cost budget admits repair',state()['affordable'])
  elif work=='tic-lm':
   check('replay initially useful',state()['benefit']>0);click('month8');check('same replay becomes harmful with fixed budget',state()['benefit']<0 and state()['processed']==64 and state()['replay']==24);shot(work);click('next');check('oracle allocation changes budget without claiming a learned policy',state()['processed']==64 and state()['replay']==state()['oracle']);before=state();click('next');check('post-oracle comparison is not a dead end',state()!=before and state()['replay']==24)
  elif work=='casepath':
   click('interpret');click('attempt');check('conflicting interpretation produces HOLD',not state()['nodes']['gate']['value'] and 'HOLD' in page.locator('.hold-state').inner_text());shot(work);invoice=state()['nodes']['invoice']['version'];click('review');page.locator('[data-reviewed-date]').select_option('2026-06-12');click('confirm-review');check('incorrect human date does not bypass source check',not state()['nodes']['gate']['value']);click('review');page.locator('[data-reviewed-date]').select_option('2026-05-12');click('confirm-review');check('correct review selectively replays while retaining invoice',state()['nodes']['gate']['value'] and state()['nodes']['invoice']['version']==invoice);shot('casepath-corrected');click('amend');check('changed invoice independently reblocks action',not state()['nodes']['gate']['value'])
  elif work=='spatial-world':
   click('create');page.wait_for_function("JSON.parse(document.querySelector('#demo-root').dataset.state).created");before=state();identities=json.loads(page.locator('#demo-root').get_attribute('data-object-identities'));click('closer');page.wait_for_timeout(600);after=state();check('language edit preserves object IDs', [o['id'] for o in before['objects']]==[o['id'] for o in after['objects']]);check('language edit changes only microscope',sum(a!=b for a,b in zip(before['objects'],after['objects']))==1);check('renderer preserves actual scene object identities',identities==json.loads(page.locator('#demo-root').get_attribute('data-object-identities')))
   click('undo');check('undo restores scene',state()==before);click('redo');check('redo restores edit',state()==after);page.reload(wait_until='networkidle');page.wait_for_selector('#demo-root[data-state]');check('reload preserves actual origin state',state()==after)
   page.locator('#scene-command').fill('Add a plant. Read my email.');page.locator('button[type="submit"]').click();check('unsupported multi-clause command is atomic',state()==after)
   click('plant');page.wait_for_timeout(600);click('route');page.wait_for_timeout(600);check('agent computes an obstacle-avoiding path',len(state()['path'])>1);shot(work)
   before=state();c=page.locator('.world-canvas');pts=json.loads(c.get_attribute('data-pick-points'));point=next(x for x in pts if x['id']=='microscope-1');b=c.bounding_box();page.mouse.move(b['x']+point['x'],b['y']+point['y']);page.mouse.down();page.mouse.move(b['x']+point['x']+25,b['y']+point['y']+7,steps=5);page.mouse.up();page.wait_for_timeout(150);check('direct manipulation edits the same scene',state()!=before)
   with page.expect_download() as dl:click('export')
   exported=json.loads(Path(dl.value.path()).read_text());check('scene export matches current state',exported==state());before=state();click('enter');check('entering the lab changes only the viewpoint',state()==before);shot('spatial-inside');click('enter')
  elif work=='natural-gradient':
   start=time.monotonic();click('run');page.wait_for_function("JSON.parse(document.querySelector('#demo-root').dataset.state).steps>=20");check('actual Gaussian optimization reduces KL',state()['kl']<1);check('reduced-motion optimizer responds within five seconds',time.monotonic()-start<5);shot(work)
   count=int(page.locator('.world-canvas').get_attribute('data-geometries'));click('run');page.wait_for_timeout(150);check('repeated steps retain GPU geometry',int(page.locator('.world-canvas').get_attribute('data-geometries'))<=count+1 and state()['steps']==40)
  elif work=='spectral-bounds':
   click('next');check('signed relationship produces positive repair requirement',state()['frustration']>0);shot(work);click('next');check('minimum removal resolves signed graph',state()['frustration']==0)
  elif work=='urban-microregions':
   click('next');check('parking overhead changes the computed vehicle comparison',state()['vanTotal']>state()['bikeTotal']);shot(work)
  elif work=='interaction-dynamics':
   click('next');before=state();click('next');check('same total different recipients',state()['messages']==before['messages'] and state()['recipientCounts']!=before['recipientCounts']);shot(work)
  check(work+' no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  if work!='casepath':
   before=state();camera=page.locator('.world-canvas').get_attribute('data-camera');page.locator('[data-view="right"]').click();page.wait_for_timeout(150);check(work+' camera does not change the scientific state',state()==before and camera!=page.locator('.world-canvas').get_attribute('data-camera'))
  print('WORLD',work,'PASS',flush=True)
 for work in ids:
  page.set_viewport_size({'width':390,'height':844});go(work)
  if work=='casepath':click('interpret');click('attempt')
  elif work=='rank-feasibility':click('rank3')
  elif work=='gain-graphs':click('next')
  elif work=='tic-lm':click('month8')
  elif work=='experience-replay':click('next')
  elif work=='natural-gradient':page.locator('[data-input="steps"]').evaluate("el=>{el.value=20;el.dispatchEvent(new Event('input',{bubbles:true}));}")
  check(work+' mobile no overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  shot(work+'-mobile')
 page.set_viewport_size({'width':1440,'height':1040});page.emulate_media(reduced_motion='no-preference')
 go('natural-gradient');start=time.monotonic();click('run');page.wait_for_function("JSON.parse(document.querySelector('#demo-root').dataset.state).steps===20",timeout=15000);check('normal-motion optimizer finishes 20 actual steps',time.monotonic()-start<15);shot('natural-gradient-motion')
 go('gain-graphs');page.locator('[data-chapter="2"]').click();page.wait_for_function("Math.abs(Number(document.querySelector('#demo-root').dataset.transportedAngle)-110)<.1",timeout=10000);check('cycle transport returns with the computed mismatch',state()['inconsistent']==3);shot('gain-cycle-transport')
 go('rank-feasibility');c=page.locator('.world-canvas');page.wait_for_timeout(1000);a=int(c.get_attribute('data-frame'));page.wait_for_timeout(500);check('static scene stops redrawing when idle',int(c.get_attribute('data-frame'))-a<3)
 page.emulate_media(reduced_motion='reduce')
 go('gain-graphs');page.locator('[data-act="play"]').click();page.wait_for_timeout(5500);check('guided playback changes the actual state',state()['inconsistent']>0);click('play')
 page.set_viewport_size({'width':390,'height':844});page.goto(base,wait_until='networkidle');page.screenshot(path=str(out/'home-mobile.png'),full_page=True)
 c=browser.new_context(java_script_enabled=False);p0=c.new_page();p0.goto(base);check('no JavaScript original sources still accessible',p0.locator('.work-row').count()==10 and p0.locator('noscript a').count()>=9);c.close()
 check('no uncaught JavaScript errors',not errors);check('no failed network resources',not failures);check('no HTTP resource errors',not http_errors)
 (out/'acceptance.json').write_text(json.dumps({'origin':base,'checks':checks,'passed':len(checks),'errors':errors,'network_failures':failures,'http_errors':http_errors,'renderer':'Three.js WebGL2 in standard headless Chromium','viewports':[[1440,1040],[390,844]],'untested':['Physical GPU performance','Actual microphone recognition','Safari','Headset VR','Independent human wow assessment']},indent=2));browser.close()
print('PASSED',len(checks),flush=True)
