"""A layout reconciliation must not skip the render-side explorer handoff."""
from pathlib import Path
import argparse,json
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--out',required=True);p.add_argument('--engine',default='chromium');a=p.parse_args()
out=Path(a.out);out.mkdir(parents=True,exist_ok=True);records=[];errors=[]
with sync_playwright() as pw:
 b=getattr(pw,a.engine).launch(headless=True);page=b.new_page(viewport={'width':390,'height':844},reduced_motion='reduce');page.on('pageerror',lambda e:errors.append(str(e)))
 try:
  for work,key in [('gain-graphs','gain'),('experience-replay','replay'),('rank-feasibility','rank'),('tic-lm','time'),('casepath','case'),('spatial-world','world')]:
   page.goto(a.url.rstrip('/')+f'/#work/{work}/at/0.2',wait_until='networkidle');page.wait_for_function('document.querySelector("#demo-root")?.dataset.ready==="true"')
   expected=page.evaluate("async key=>(await import('./modules/narrative/chapters.mjs')).stories[key].cameras.at(-1)",key)
   page.evaluate('''()=>{const r=document.querySelector('#demo-root'),y=+r.dataset.exploreAt+6;document.querySelectorAll('.n-chapter').forEach(e=>e.style.minHeight=(e.getBoundingClientRect().height+6)+'px');scrollTo({top:y,behavior:'instant'});}''')
   page.wait_for_function('document.querySelector("#demo-root").dataset.mode==="explore"')
   if key!='case':
    page.wait_for_function("()=>{const host=document.querySelector('.n-render-host'),canvas=host?.querySelector('.world-canvas');return !!host?.dataset.renderRevision&&canvas?.dataset.renderToken===host.dataset.renderRevision;}")
   actual=page.locator('.world-canvas').get_attribute('data-camera') if key!='case' else None
   result={'work':work,'expected_camera':expected,'actual_camera':actual,'explorer_unlocked':not page.locator('.n-explorer').evaluate('el=>el.inert'),'announcement':page.locator('.n-accessible-status').inner_text()}
   result['passed']=result['explorer_unlocked'] and result['announcement']=='Explorer unlocked.' and (actual is None or all(abs(x-y)<.002 for x,y in zip(expected,map(float,actual.split(',')))))
   records.append(result);(out/'progress.json').write_text(json.dumps(records,indent=2))
   if not result['passed']:page.screenshot(path=str(out/f'{work}-failure.png'));raise AssertionError(result)
  assert not errors
  (out/'acceptance.json').write_text(json.dumps({'engine':a.engine,'origin':a.url,'checks':records,'passed':len(records),'errors':errors},indent=2))
 finally:b.close()
print('EXPLORER_HANDOFFS_PASSED',len(records),a.engine,flush=True)
