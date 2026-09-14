"""An explorer remains an explorer when responsive reflow clamps document scroll.
No event wrappers or force clicks: exercise the deployed reader's normal controls.
"""
from pathlib import Path
import argparse,json
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--out',required=True);p.add_argument('--engine',default='chromium');a=p.parse_args();out=Path(a.out);out.mkdir(parents=True,exist_ok=True);checks=[];errors=[]
with sync_playwright() as pw:
 browser=getattr(pw,a.engine).launch(headless=True);page=browser.new_page(viewport={'width':1440,'height':1000},reduced_motion='reduce');page.on('pageerror',lambda e:errors.append(str(e)))
 def check(name,ok,details=None):
  checks.append({'name':name,'passed':bool(ok),'details':details});(out/'progress.json').write_text(json.dumps(checks,indent=2));assert ok,name
 def observed():return page.evaluate("()=>{const r=document.querySelector('#demo-root'),e=document.querySelector('.n-explorer');return{mode:r.dataset.mode,science:JSON.parse(r.dataset.state),y:scrollY,max:document.documentElement.scrollHeight-innerHeight,exploreAt:+r.dataset.exploreAt,unlocked:!e.inert&&getComputedStyle(e).visibility==='visible',camera:document.querySelector('canvas').dataset.camera};}")
 try:
  page.goto(a.url.rstrip('/')+'/#work/gain-graphs/explore',wait_until='networkidle');page.wait_for_function("document.querySelector('#demo-root')?.dataset.ready==='true'")
  page.locator('[data-explore="reset"]').click();page.locator('[data-parameter="angle"]').evaluate('e=>{e.value=110;e.dispatchEvent(new Event("input",{bubbles:true}));}')
  page.locator('[data-select="eigenmode"]').select_option('4');page.wait_for_timeout(100);page.locator('[data-select="eigenmode"]').select_option('-1');page.wait_for_timeout(100)
  science=observed()['science']
  for width,height in [(390,844),(320,568),(1440,1000)]:
   page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(250);r=observed();check(f'{width}x{height}: reflow preserves explorer and parameters',r['mode']=='explore' and r['unlocked'] and r['science']==science,r)
  page.locator('[data-select="eigenmode"]').select_option('0');page.wait_for_timeout(100)
  for width,height in [(320,568),(390,844),(1440,1000)]:
   page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(250);r=observed();check(f'{width}x{height}: inspection-specific layout preserves explorer',r['mode']=='explore' and r['unlocked'] and r['science']==science,r)
  page.locator('[data-prev]').click();page.wait_for_function("document.querySelector('#demo-root').dataset.mode==='guide'");check('real reverse navigation is not mistaken for layout clamping',observed()['mode']=='guide')
  page.locator('[data-skip]').click();page.wait_for_function("document.querySelector('#demo-root').dataset.mode==='explore'");check('returning to exploration retains the user graph',observed()['science']==science)
  check('no runtime errors',not errors,errors)
  (out/'acceptance.json').write_text(json.dumps({'origin':a.url,'engine':a.engine,'checks':checks,'passed':len(checks),'errors':errors},indent=2))
 except Exception as error:
  (out/'failure.json').write_text(json.dumps({'error':str(error),'observed':observed(),'checks':checks},indent=2));page.screenshot(path=str(out/'failure.png'));raise
 finally:browser.close()
print('EXPLORER_REFLOW_PASSED',len(checks),a.engine,flush=True)
