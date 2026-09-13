"""Browser acceptance on actual HTTP-delivered modules. Never rewrites browser policies.
Usage: python scripts/browser_acceptance.py --url http://127.0.0.1:8765 --out /tmp/qa
Use --wait-release for the published origin after a Pages deployment.
"""
from pathlib import Path
import argparse, hashlib, json, time, urllib.request
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('--url',required=True);parser.add_argument('--out',required=True);parser.add_argument('--wait-release',action='store_true');args=parser.parse_args()
base=args.url.rstrip('/')+'/';out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
ids=['interaction-dynamics','spectral-bounds','gain-graphs','urban-microregions','natural-gradient','experience-replay','rank-feasibility','tic-lm','casepath','spatial-world']
checks=[];errors=[];requests=[];modes={}
def check(name,condition):
 checks.append({'name':name,'pass':bool(condition)})
 (out/'progress.json').write_text(json.dumps(checks,indent=2))
 assert condition,name
if args.wait_release:
 for attempt in range(24):
  try:
   html=urllib.request.urlopen(base,timeout=20).read().decode()
   if 'portfolio-release" content="studio-2' in html:break
  except Exception:pass
  time.sleep(10)
 else:raise RuntimeError('The expected studio-2 release did not reach the origin in four minutes.')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
 page.set_default_timeout(20000)
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('requestfailed',lambda r:requests.append({'url':r.url,'failure':r.failure}))
 response=page.goto(base,wait_until='networkidle');check('HTTP home',response.status==200)
 check('release identity',page.locator('meta[name="portfolio-release"]').get_attribute('content')=='studio-2')
 check('static works',page.locator('.work-row').count()==10)
 page.wait_for_function("document.querySelectorAll('.work-scene-preview[data-rendered=\"true\"]').length===10");page.screenshot(path=str(out/'home-desktop.png'),full_page=True)
 root=Path(__file__).resolve().parents[1]
 for filename in ['modules/studio-engine.mjs','modules/project-scenes.mjs','modules/demos.mjs','modules/world-view.mjs','studio.css']:
  r=page.request.get(base+filename+'?v=studio-2')
  check('source identity '+filename,r.status==200 and hashlib.sha256(r.body()).digest()==hashlib.sha256((root/filename).read_bytes()).digest())
 def go(work):
  page.goto(base+'#work/'+work,wait_until='networkidle')
  page.wait_for_selector('[data-work-page="'+work+'"] #demo-root[data-state]')
  page.wait_for_selector('canvas[data-rendered]')
  motion=page.locator('[data-camera="motion"]')
  if motion.count() and motion.is_visible() and motion.get_attribute('aria-pressed')=='true':motion.click()
 def state():return json.loads(page.locator('#demo-root').get_attribute('data-state'))
 for work in ids:
  go(work);check(work+' / meaningful page',page.locator('h1').inner_text().strip()!='')
  check(work+' / initial 3D',page.locator('canvas').get_attribute('data-rendered') in ['webgl','software-3d'])
  modes[work]=page.locator('canvas').get_attribute('data-rendered')
  for stage in [0,1,2,3]:
   page.locator('[data-stage="'+str(stage)+'"]').click();page.wait_for_timeout(100)
   check(work+' / stage '+str(stage),page.locator('#demo-root').get_attribute('data-state') is not None)
  if work=='spatial-world':page.wait_for_timeout(3000)
  check(work+' / no overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  page.evaluate("document.activeElement?.blur();window.scrollTo({top:0,behavior:'instant'})");page.screenshot(path=str(out/(work+'-desktop.png')),full_page=True)
  if work!='spatial-world':
   before=state();camera=page.locator('canvas').get_attribute('data-camera');page.locator('[data-camera="right"]').click()
   check(work+' / orbit preserves result',before==state() and camera!=page.locator('canvas').get_attribute('data-camera'))
   page.locator('[data-next]').click();page.wait_for_timeout(150);check(work+' / contextual action',before!=state())
  print('BROWSER',work,'PASS',modes[work],flush=True)
 go('experience-replay')
 for memories in [(False,False),(False,True),(True,False)]:
  page.locator('[data-stage="2"]').click()
  for selector,selected in zip(['#memory-a','#memory-b'],memories):page.locator(selector).set_checked(selected)
  page.locator('[data-next]').click();page.wait_for_timeout(100)
  check('replay / complete memory set '+str(memories),state()['missing']==0 and all(state()['memories']))
 go('spatial-world');page.locator('[data-reset]').click();before=state();page.locator('[data-command="Move the microscope closer to the window."]').click();after=state()
 check('world / IDs preserved',[o['id'] for o in before['objects']]==[o['id'] for o in after['objects']])
 check('world / one object changed',sum(a!=b for a,b in zip(before['objects'],after['objects']))==1)
 page.locator('[data-undo]').click();check('world / undo',state()==before);page.locator('[data-redo]').click();check('world / redo',state()==after)
 page.reload(wait_until='networkidle');page.wait_for_selector('#demo-root[data-state]');check('world / real-origin persistence',state()==after)
 page.locator('#world-input').fill('Do something unsupported');page.locator('.command-form button').click();check('world / unsupported rejected',state()==after)
 for work in ids:
  page.set_viewport_size({'width':390,'height':844});go(work);page.locator('[data-stage="2"]').click();page.wait_for_timeout(100)
  check(work+' / mobile no overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  page.evaluate("document.activeElement?.blur();window.scrollTo({top:0,behavior:'instant'})");page.screenshot(path=str(out/(work+'-mobile.png')),full_page=True)
 page.goto(base,wait_until='networkidle');page.wait_for_function("document.querySelectorAll('.work-scene-preview[data-rendered=\"true\"]').length===10");page.screenshot(path=str(out/'home-mobile.png'),full_page=True)
 nojs=browser.new_context(java_script_enabled=False);static=nojs.new_page();static.goto(base,wait_until='load');check('no JavaScript / research accessible',static.locator('.work-row').count()==10 and static.locator('noscript a').count()>0);nojs.close()
 check('no uncaught JavaScript errors',not errors);check('no failed resource requests',not requests)
 browser.close()
result={'url':base,'actual_http_delivery':True,'checks':checks,'passed':len(checks),'errors':errors,'request_failures':requests,'renderers':modes,'untested':['Physical GPU performance','Real microphone recognition','Safari','Human assessment of emotional impact']}
(out/'acceptance.json').write_text(json.dumps(result,indent=2));print('ACCEPTANCE_JSON',json.dumps(result),flush=True)
